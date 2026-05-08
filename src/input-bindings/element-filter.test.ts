import {describe, expect, it} from "vitest";
import {classifyElement, ElementKind} from "./element-filter";

function makeInput(type = "text"): HTMLInputElement {
	const el = document.createElement("input");
	el.type = type;
	return el;
}

describe("classifyElement", () => {
	it("classifies a text <input> as SingleLineInput", () => {
		expect(classifyElement(makeInput("text"))).toBe(ElementKind.SingleLineInput);
	});

	it("classifies a search <input> as SingleLineInput", () => {
		expect(classifyElement(makeInput("search"))).toBe(ElementKind.SingleLineInput);
	});

	it("classifies an email <input> as SingleLineInput", () => {
		expect(classifyElement(makeInput("email"))).toBe(ElementKind.SingleLineInput);
	});

	it("classifies a password <input> as Skip", () => {
		expect(classifyElement(makeInput("password"))).toBe(ElementKind.Skip);
	});

	it("classifies a checkbox <input> as Skip", () => {
		expect(classifyElement(makeInput("checkbox"))).toBe(ElementKind.Skip);
	});

	it("classifies a <textarea> as MultiLineInput", () => {
		const el = document.createElement("textarea");
		expect(classifyElement(el)).toBe(ElementKind.MultiLineInput);
	});

	it("classifies a contenteditable div as ContentEditable", () => {
		const el = document.createElement("div");
		el.contentEditable = "true";
		expect(classifyElement(el)).toBe(ElementKind.ContentEditable);
	});

	it("classifies a non-editable div as Skip", () => {
		const el = document.createElement("div");
		expect(classifyElement(el)).toBe(ElementKind.Skip);
	});

	it("returns Skip for elements inside .cm-editor", () => {
		const cm = document.createElement("div");
		cm.className = "cm-editor";
		const inner = document.createElement("input");
		inner.type = "text";
		cm.appendChild(inner);
		document.body.appendChild(cm);
		expect(classifyElement(inner)).toBe(ElementKind.Skip);
		document.body.removeChild(cm);
	});

	it("returns ContentEditable when the element is editable, even if a non-editable ancestor wraps it", () => {
		const wrapper = document.createElement("div");
		wrapper.contentEditable = "false";
		const inner = document.createElement("div");
		inner.contentEditable = "true";
		wrapper.appendChild(inner);
		// The descendant's own isContentEditable wins over the wrapper's
		// contenteditable=false attribute. (Note: HTMLElement.isContentEditable
		// inherits unless explicitly overridden, so a true descendant of a
		// false ancestor still reads as content-editable.)
		expect(classifyElement(inner)).toBe(ElementKind.ContentEditable);
	});

	it("returns Skip for null", () => {
		expect(classifyElement(null)).toBe(ElementKind.Skip);
	});
});
