import type { ElementHandle, FrameLocator, Page } from "playwright-chromium";

export function querySelector(page: FrameLocator | Page) {
	return async function(...selectors: string[]) {
		selectors = selectors.flat(Infinity);

		const results = page.locator("css=" + selectors.join(", "));

		return (await results.count() > 0) ? results.first().elementHandle() : null;
	};
}

async function toArray(page, results, options = {}): Promise<ElementHandle[]> {
	options["depth"] ??= 1;

	const elements = [];

	for (let n = 0, result = results.nth(n); n < await results.count(); n++, result = results.nth(n)) {
		const element = await result.elementHandle();

		if (options["depth"] >= 0) {
			element["children"] = await toArray(page, result.locator("css=> *"), { "depth": options["depth"] - 1 });
		}

		elements.push(element);
	}

	return elements;
}

export function querySelectorAll(page: FrameLocator | Page) {
	// This is in a bit of a weird state because we couldn't decide on:
	//
	//  - $$([".one", ".two"])              //
	//  - $$(".one", ".two")                //
	//  - $$(".one, .two", [startNode])     // Browser-style
	//
	// and whether or not those should have any meaningful differences.

	// Array notation should be

	return function(...selectors: string[]) {
		selectors = selectors.flat(Infinity);

		let n = 0;
		let x = 0;

		return {
			"toArray": function() {
				return toArray(page, page.locator("css=" + selectors[x]));
			},
			[Symbol.asyncIterator]: function next(selector = selectors[x]) {
				return {
					"next": async function() {
						let elementHandle;

						try {
							const results = page.locator("css=" + selector);

							if (n < await results.count()) {
								elementHandle = await results.nth(n).elementHandle();

								n += 1;
							} else if (selectors.length < x) {
								n = 0;

								x += 1;

								return next(selectors[x]);
							}
						} catch (error) { }

						return {
							"value": elementHandle,
							"done": elementHandle === undefined
						};
					}
				};
			}
		};
	};
}
