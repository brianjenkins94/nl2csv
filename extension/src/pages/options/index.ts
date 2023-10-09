const form = document.querySelector("form");

form.addEventListener("submit", function(event) {
	event.preventDefault();
});

for (const formElement of form.elements) {
	formElement.value = (await chrome.storage.sync.get())[formElement.name] ?? "";

	formElement.addEventListener("input", function(event) {
		chrome.storage.sync.set({ [this.name]: this.value });
	});
}

export { };
