/// <reference path="../node_modules/@types/chrome/index.d.ts" />

//// Init

const documentUrlPatterns = [
	"https://www.youtube.com/*"
];

chrome.runtime.onInstalled.addListener(function() {
	chrome.contextMenus.create({
		"id": "open-sidepanel",
		"title": "Open Sidepanel",
		"contexts": ["all"],
		"documentUrlPatterns": documentUrlPatterns
	});
});

chrome.sidePanel.setPanelBehavior({ "openPanelOnActionClick": true });

//// Side Panel

async function openSidePanel(tabId, info, tab) {
	const matches = tab.url !== undefined && documentUrlPatterns.filter(function(url) {
		return new RegExp(url.replace(/\*/gu, "\\S*"), "mu").test(tab.url);
	}).length > 0;

	if (matches) {
		await chrome.sidePanel.setOptions({
			"tabId": tabId,
			"path": "pages/sidepanel/index.html",
			"enabled": true
		});

		try {
			// @ts-expect-error Chrome v116+
			await chrome.sidePanel.open?.({
				"tabId": tabId
			});
		} catch (error) {
			const knownErrors = [
				"`sidePanel.open()` may only be called in response to a user gesture.",
				"No matching signature."
			];

			if (!knownErrors.includes(error.message)) {
				throw error;
			}
		}
	} else {
		await chrome.sidePanel.setOptions({
			"tabId": tabId,
			"enabled": false
		});
	}
}

chrome.tabs.onUpdated.addListener(openSidePanel);

//// Context Menu

chrome.contextMenus.onClicked.addListener(function({ selectionText }) {
	// https://bugs.chromium.org/p/chromium/issues/detail?id=1478648
	chrome.tabs.query({
		"active": true
	}, function([{ id }]) {
		// TODO: Message passing would be better.
		chrome.sidePanel.setOptions({
			"tabId": id,
			"path": "pages/sidepanel/index.html#" + selectionText,
			"enabled": true
		});

		// @ts-expect-error Chrome v116+
		chrome.sidePanel.open?.({
			"tabId": id
		});
	});
});

//// Messaging

chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
	console.log(request, sender);
});

//// Debug

chrome.storage.onChanged.addListener(function(changes, namespace) {
	const [change] = Object.keys(changes);

	console.log(change + ": " + changes[change]["oldValue"] + " -> " + changes[change]["newValue"]);
});

export { };
