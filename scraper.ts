import { promises as fs } from "fs";
import * as path from "path";
import { Browser, BrowserContext, Page, chromium } from "playwright-chromium";

import { __root } from "./config";
import { querySelector, querySelectorAll } from "./util/querySelector";
import { sleep } from "./util/sleep";

let isCDPSession = false;

async function attach(options = {}) {
	options["devtools"] ??= !options["headless"];
	options["headless"] ??= true;

	let browser: Browser;

	try {
		browser = await chromium.connectOverCDP("http://localhost:9222");

		isCDPSession = true;
	} catch (error) {
		browser = await chromium.launch(options);
	}

	let contexts = browser.contexts();

	if (contexts.length === 0) {
		contexts = [await browser.newContext()];
	}

	return {
		"browser": browser,
		"contexts": contexts
	};
}

let browser: Browser;
let context: BrowserContext;

async function scrape(url, options = {}) {
	if (browser === undefined) {
		({ browser, "contexts": [context] } = await attach(options));
	}

	const page: Page = await context.newPage();

	await page.goto(url);

	await page.waitForLoadState("networkidle");

	// Prep work

	page.route("**/*", function(route) {
		return [/* "image", "stylesheet", */ "media", "font", "imageset"].includes(route.request().resourceType())
			? route.abort()
			: route.continue();
	});

	/*
	const selectors = {
		"video": (page: Page) => (n) => page.locator("css=ytd-rich-grid-renderer > #contents > ytd-rich-grid-row > #contents > ytd-rich-item-renderer > #content > ytd-rich-grid-media > #dismissible").nth(n),
		// @ts-expect-error
		"videoTitle": (page: Page) => (n) => selectors.video(n).locator("css=#details > #meta > h3")
	};

	for (const [key, selector] of Object.entries(selectors)) {
		if (typeof selector === "function") {
			selectors[key] = selector(page);
		}
	}

	const $ = querySelector(page);
	*/

	const $$ = querySelectorAll(page);

	// Actual scraping logic

	const loadingIndicator = page.locator("css=ytd-rich-grid-renderer > #contents > ytd-continuation-item-renderer > tp-yt-paper-spinner");

	for await (const video of $$("ytd-rich-grid-renderer > #contents > ytd-rich-grid-row > #contents > ytd-rich-item-renderer > #content > ytd-rich-grid-media > #dismissible")) {
		// @ts-expect-error
		await video.evaluate(function(element) {
			element.scrollIntoView(true);
		});

		await (function(locator) {
			return new Promise<void>(function recurse(resolve, reject) {
				setTimeout(function() {
					if (locator.getAttribute("active") !== null) {
						resolve();
					}
				}, 2000);
			});
		})(loadingIndicator);

		const popupPromise = context.waitForEvent("page");

		// @ts-expect-error
		await video.click({ "button": "middle" });

		const popup = await popupPromise;

		await popup.evaluate(function() {
			document.getElementById("movie_player").remove();
		});

		const title = await popup.locator("css=ytd-rich-grid-renderer > #contents > ytd-rich-grid-row > #contents > ytd-rich-item-renderer > #content > ytd-rich-grid-media > #dismissible > #details > #meta > h3").first().innerText();
		let game;
		let year;

		try {
			game = await popup.locator("css=#primary #below > ytd-watch-metadata #endpoint-link > #text-container > #title").first().innerText();
			year = await popup.locator("css=#primary #below > ytd-watch-metadata #endpoint-link > #text-container > #subtitle").first().innerText();
		} catch (error) { }

		await popup.close();

		console.log({
			"title": title,
			"game": game,
			"year": year
		});
	}

	// </>

	await page.close();

	return function destroy() {
		return [
			context.close(),
			isCDPSession ? Promise.resolve() : browser.close()
		].reduce(function(previous, next) {
			// @ts-expect-error
			return previous.then(next);
		}, Promise.resolve());
	};
}

const outputDirectory = path.join(__root, "dist");

await fs.mkdir(outputDirectory, { "recursive": true });

const destroy = await scrape("https://www.youtube.com/@Northernlion/videos", {
	"outputDirectory": outputDirectory,
	"headless": !(Boolean(process.env["CI"]) || process.platform === "win32" || Boolean(process.env["DISPLAY"]))
});

destroy();

export { browser, context };
