export enum ElementKind {
	SingleLineInput,
	MultiLineInput,
	ContentEditable,
	Skip,
}

const SINGLE_LINE_INPUT_TYPES = new Set([
	"text",
	"search",
	"email",
	"url",
	"tel",
	"number",
]);

export function classifyElement(el: Element | null): ElementKind {
	if (!el) {
		return ElementKind.Skip;
	}
	if (isInsideCmEditor(el)) {
		return ElementKind.Skip;
	}
	if (el instanceof HTMLInputElement) {
		if (SINGLE_LINE_INPUT_TYPES.has(el.type)) {
			return ElementKind.SingleLineInput;
		}
		return ElementKind.Skip;
	}
	if (el instanceof HTMLTextAreaElement) {
		return ElementKind.MultiLineInput;
	}
	if (el instanceof HTMLElement && isContentEditableElement(el)) {
		return ElementKind.ContentEditable;
	}
	return ElementKind.Skip;
}

// Real browsers (and Obsidian's Electron host) implement HTMLElement.isContentEditable,
// which correctly resolves the inherited contentEditable state. jsdom (used for tests)
// does not implement it, so fall back to checking the contentEditable property when
// isContentEditable is unavailable. The fallback only handles the explicit-true case;
// inheritance through ancestors is a real-browser-only concern and is not exercised by
// our tests.
function isContentEditableElement(el: HTMLElement): boolean {
	if (typeof el.isContentEditable === "boolean") {
		return el.isContentEditable;
	}
	return el.contentEditable === "true";
}

function isInsideCmEditor(el: Element): boolean {
	let current: Element | null = el;
	while (current) {
		if (current.classList && current.classList.contains("cm-editor")) {
			return true;
		}
		current = current.parentElement;
	}
	return false;
}
