import { existsSync, promises as fs } from "fs";
import * as path from "path";
import { Browser, BrowserContext, Page, chromium } from "playwright-chromium";
import Papa from "papaparse";

import { __root } from "./config";
import { querySelector, querySelectorAll } from "./util/querySelector";
import { sleep } from "./util/sleep";

const isWindows = process.platform === "win32";

let isCDPSession = false;

async function attach(options = {}) {
	options["devtools"] ??= !options["headless"];
	options["headless"] ??= true;

	let browser: Browser;

	try {
		browser = await chromium.connectOverCDP("http://localhost:9222");

		isCDPSession = true;
	} catch (error) {
		const args = options["args"] ?? [
			`--js-flags=--expose-gc`
		];

		try {
			const extensionBasePath = path.join(isWindows ? path.join(process.env["LOCALAPPDATA"]) : path.join(process.env["HOME"] + "Library", "Application Support"), "Google", "Chrome", "User Data", "Default", "Extensions", "cjpalhdlnbpafiamejdnhcphjbkeiagm");

			const latestVersion = (await Promise.all((await fs.readdir(extensionBasePath))
				.map(async function(fileName) {
					return {
						"name": fileName,
						"ctime": (await fs.stat(path.join(extensionBasePath, fileName))).ctime
					};
				})))
				.sort(function(a, b) {
					return b.ctime.getTime() - a.ctime.getTime();
				})[0].name;

			const pathToExtension = path.join(extensionBasePath, latestVersion);

			if (options["headless"] === true) {
				args.push("--headless=new");
			}

			args.push(
				`--disable-extensions-except=${pathToExtension}`,
				`--load-extension=${pathToExtension}`
			);

			return {
				"contexts": [await chromium.launchPersistentContext("", {
					"args": args,
					...options
				})]
			};
		} catch (error) {
			browser = await chromium.launch(options);
		}
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

async function retry(video) {
	let popup;

	let date;
	let title;
	let url;
	let game;
	let year;

	try {
		const popupPromise = context.waitForEvent("page");

		await video.click({
			"button": "middle",
			"force": true
		});

		popup = await popupPromise;

		await popup.evaluate(function() {
			setInterval(function() {
				document.getElementById("movie_player")?.remove();
			}, 100);
		});

		await popup.locator("css=#primary #below > ytd-watch-metadata > #above-the-fold > #bottom-row > #description").click();

		popup.setDefaultTimeout(5000);

		date = await popup.locator("css=#primary #below > ytd-watch-metadata > #above-the-fold > #bottom-row > #description #info-container > yt-formatted-string > span:nth-child(3)").innerText();
		title = await popup.locator("css=#primary #below > ytd-watch-metadata > #above-the-fold > #title").innerText();
		url = popup.url();

		try {
			game = await popup.locator("css=#primary #below > ytd-watch-metadata #endpoint-link > #text-container > #title").first().innerText();
			year = await popup.locator("css=#primary #below > ytd-watch-metadata #endpoint-link > #text-container > #subtitle").first().innerText();
		} catch (error) { }

		await popup.close();
	} catch (error) {
		console.log(error);

		await popup?.close();

		return retry(video);
	}

	return {
		"date": date.trim(),
		"title": title.trim(),
		"url": url.trim(),
		"game": game?.trim() || undefined,
		"year": year?.trim() || undefined
	};
}

async function scrape(url, options = {}) {
	if (browser === undefined) {
		({ browser, "contexts": [context] } = await attach(options));
	}

	const page: Page = await context.newPage();

	await page.goto(url);

	await page.waitForLoadState("networkidle");

	// Prep work

	const outputFile = path.join(outputDirectory, "results.csv");

	//await fs.writeFile(outputFile, Papa.unparse([["date", "title", "url", "game", "year"]], {
	//  "quotes": true
	//}) + "\n");

	const file = await fs.readFile(outputFile, { "encoding": "utf8" });

	page.route("**/*", function(route) {
		return ["image", "stylesheet", "media", "font", "imageset"].includes(route.request().resourceType())
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

	const loadingIndicator = page.locator("css=ytd-rich-grid-renderer > #contents > ytd-continuation-item-renderer > tp-yt-paper-spinner").last();

	let count = 0;

	for await (const video of $$("ytd-rich-grid-renderer > #contents > ytd-rich-grid-row > #contents > ytd-rich-item-renderer > #content > ytd-rich-grid-media > #dismissible")) {
		// @ts-expect-error
		await video.evaluate(function(element) {
			element.scrollIntoView(true);
		});

		count += 1;
		console.log(count);

		// This loading indicator check has problems
		await (function recurse(locator) {
			return new Promise<void>(function(resolve, reject) {
				try {
					if (locator.getAttribute("active") !== null) {
						console.log("✅");

						resolve();
					} else {
						console.log("❌");

						setTimeout(async function() {
							await recurse(locator);

							resolve();
						}, 2000);
					}
				} catch (error) {
					resolve();
				}
			});
		})(loadingIndicator);

		// @ts-expect-error
		await video.evaluate(function(element) {
			element.parentNode.parentNode.parentNode.style.display = "none";

			gc?.();
		});

		// @ts-expect-error
		if (file.includes(await (await video.$("#details > #meta #video-title-link")).getAttribute("href"))) {
			continue;
		}

		// THIS CAN CAUSE AN INFINITE LOOP
		const result = await retry(video);

		await fs.appendFile(outputFile, Papa.unparse([result], {
			"header": false,
			"quotes": true
		}) + "\n");
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
