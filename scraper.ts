import { promises as fs } from "fs";
import * as path from "path";
import { Browser, BrowserContext, Page, chromium } from "playwright-chromium";

import { __root } from "./config";

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

	// Actual scraping logic

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
