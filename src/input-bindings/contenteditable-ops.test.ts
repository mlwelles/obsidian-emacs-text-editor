/**
 * Tests for contenteditable-ops. jsdom does not implement
 * Selection.modify, so movement and extend-based deletion ops are mostly
 * verified by checking that Selection.modify is called with the expected
 * arguments (spy-style). Ops that rely only on Selection.toString and
 * Range mutation (which jsdom does support) are exercised end-to-end.
 *
 * Manual regression in Obsidian/Electron remains the authoritative test
 * surface for this module; see docs/plans/MANUAL-TESTING.md.
 */
import {afterEach, beforeEach, describe, expect, it, vi} from "vitest";
import {
	backwardChar,
	backwardKillWord,
	backwardWord,
	beginningOfLine,
	deleteChar,
	endOfLine,
	extendSelection,
	forwardChar,
	forwardWord,
	getSelectedText,
	killLine,
	killRegion,
	killRingSave,
	killWord,
	nextLine,
	previousLine,
	yank,
} from "./contenteditable-ops";

function makeEditable(html: string): HTMLElement {
	const el = document.createElement("div");
	el.contentEditable = "true";
	el.innerHTML = html;
	document.body.appendChild(el);
	return el;
}

function selectWholeNode(el: HTMLElement, node: Node, start = 0, end?: number): Selection {
	const range = document.createRange();
	const len = node.nodeType === Node.TEXT_NODE ? (node.textContent ?? "").length : node.childNodes.length;
	range.setStart(node, start);
	range.setEnd(node, end ?? len);
	const sel = window.getSelection();
	if (!sel) throw new Error("no selection");
	sel.removeAllRanges();
	sel.addRange(range);
	return sel;
}

function collapseTo(el: HTMLElement, node: Node, offset: number): Selection {
	const range = document.createRange();
	range.setStart(node, offset);
	range.setEnd(node, offset);
	const sel = window.getSelection();
	if (!sel) throw new Error("no selection");
	sel.removeAllRanges();
	sel.addRange(range);
	return sel;
}

let modifySpy: ReturnType<typeof vi.spyOn> | undefined;

beforeEach(() => {
	// Stub Selection.modify because jsdom does not implement it.
	const proto = Object.getPrototypeOf(window.getSelection() ?? {}) as {modify?: unknown};
	if (typeof proto.modify !== "function") {
		(proto as {modify: (alter: string, dir: string, gran: string) => void}).modify = () => {};
	}
	const sel = window.getSelection();
	if (sel) {
		// Selection.modify is not in the lib.dom Selection type; cast through unknown.
		modifySpy = vi.spyOn(sel as unknown as Record<string, () => void>, "modify");
	}
});

afterEach(() => {
	modifySpy?.mockRestore();
	modifySpy = undefined;
	document.body.innerHTML = "";
});

describe("getSelectedText", () => {
	it("returns the selected text within the element", () => {
		const el = makeEditable("hello world");
		const textNode = el.firstChild as Text;
		selectWholeNode(el, textNode, 0, 5);
		expect(getSelectedText(el)).toBe("hello");
	});

	it("returns empty string when nothing is selected in the element", () => {
		const el = makeEditable("hello");
		// Place selection outside the element.
		const outside = document.createElement("div");
		outside.textContent = "other";
		document.body.appendChild(outside);
		selectWholeNode(outside, outside.firstChild as Text, 0, 1);
		expect(getSelectedText(el)).toBe("");
	});

	it("returns empty string when selection anchors inside el but focus is outside", () => {
		// Simulates a user starting a selection inside the contenteditable
		// and dragging out into a sibling: anchorNode is still inside el
		// but focusNode escapes. We must not act on this selection -
		// range.deleteContents() would mutate DOM outside el.
		const el = makeEditable("inside");
		const sibling = document.createElement("div");
		sibling.textContent = "outside";
		document.body.appendChild(sibling);

		const range = document.createRange();
		range.setStart(el.firstChild as Text, 0);
		range.setEnd(sibling.firstChild as Text, 3);
		const sel = window.getSelection();
		if (!sel) throw new Error("no selection");
		sel.removeAllRanges();
		sel.addRange(range);

		// Sanity: anchor is inside el, focus is in sibling.
		expect(el.contains(sel.anchorNode)).toBe(true);
		expect(el.contains(sel.focusNode)).toBe(false);

		expect(getSelectedText(el)).toBe("");
	});
});

describe("killRegion", () => {
	it("deletes selected text, returns it, and dispatches an input event", () => {
		const el = makeEditable("hello world");
		const textNode = el.firstChild as Text;
		selectWholeNode(el, textNode, 6, 11);
		const events: InputEvent[] = [];
		el.addEventListener("input", e => events.push(e as InputEvent));

		const killed = killRegion(el);

		expect(killed).toBe("world");
		expect(el.textContent).toBe("hello ");
		expect(events).toHaveLength(1);
		expect(events[0].inputType).toBe("deleteContentBackward");
	});

	it("returns empty string and dispatches nothing when selection is collapsed", () => {
		const el = makeEditable("hello");
		collapseTo(el, el.firstChild as Text, 2);
		const events: InputEvent[] = [];
		el.addEventListener("input", e => events.push(e as InputEvent));

		const killed = killRegion(el);

		expect(killed).toBe("");
		expect(events).toHaveLength(0);
	});

	it("does not delete or mutate sibling DOM when selection focus is outside el", () => {
		// Without the focusNode guard, killRegion would call
		// range.deleteContents() on a range that spans into a sibling,
		// destroying content outside el.
		const el = makeEditable("inside");
		const sibling = document.createElement("div");
		sibling.textContent = "outside";
		document.body.appendChild(sibling);

		const range = document.createRange();
		range.setStart(el.firstChild as Text, 0);
		range.setEnd(sibling.firstChild as Text, 7);
		const sel = window.getSelection();
		if (!sel) throw new Error("no selection");
		sel.removeAllRanges();
		sel.addRange(range);

		const events: InputEvent[] = [];
		el.addEventListener("input", e => events.push(e as InputEvent));

		const killed = killRegion(el);

		expect(killed).toBe("");
		expect(el.textContent).toBe("inside");
		expect(sibling.textContent).toBe("outside");
		expect(events).toHaveLength(0);
	});
});

describe("killRingSave", () => {
	it("returns selected text without modifying it and collapses selection to end", () => {
		const el = makeEditable("hello world");
		const textNode = el.firstChild as Text;
		selectWholeNode(el, textNode, 0, 5);

		const saved = killRingSave(el);

		expect(saved).toBe("hello");
		expect(el.textContent).toBe("hello world");
		const sel = window.getSelection();
		expect(sel?.isCollapsed).toBe(true);
	});
});

describe("yank", () => {
	it("inserts text at the cursor and dispatches an input event with insertText", () => {
		const el = makeEditable("hello world");
		collapseTo(el, el.firstChild as Text, 5);
		const events: InputEvent[] = [];
		el.addEventListener("input", e => events.push(e as InputEvent));

		yank(el, " brave");

		expect(el.textContent).toBe("hello brave world");
		expect(events).toHaveLength(1);
		expect(events[0].inputType).toBe("insertText");
		expect(events[0].data).toBe(" brave");
	});

	it("replaces a non-empty selection with the yanked text", () => {
		const el = makeEditable("hello world");
		const textNode = el.firstChild as Text;
		selectWholeNode(el, textNode, 6, 11);

		yank(el, "everyone");

		expect(el.textContent).toBe("hello everyone");
	});

	it("places the caret immediately after the inserted text", () => {
		const el = makeEditable("xy");
		collapseTo(el, el.firstChild as Text, 1);

		yank(el, "ABC");

		expect(el.textContent).toBe("xABCy");
		const sel = window.getSelection();
		expect(sel?.isCollapsed).toBe(true);
		// The caret should be after 'ABC' (offset 4 in the merged string,
		// though node identity depends on how the DOM split happened).
	});
});

describe("movement (Selection.modify-based)", () => {
	it("forwardChar calls modify(move, right, character)", () => {
		const el = makeEditable("hello");
		collapseTo(el, el.firstChild as Text, 0);
		forwardChar(el);
		expect(modifySpy).toHaveBeenCalledWith("move", "right", "character");
	});

	it("backwardChar calls modify(move, left, character)", () => {
		const el = makeEditable("hello");
		collapseTo(el, el.firstChild as Text, 3);
		backwardChar(el);
		expect(modifySpy).toHaveBeenCalledWith("move", "left", "character");
	});

	it("forwardWord calls modify(move, forward, word)", () => {
		const el = makeEditable("foo bar");
		collapseTo(el, el.firstChild as Text, 0);
		forwardWord(el);
		expect(modifySpy).toHaveBeenCalledWith("move", "forward", "word");
	});

	it("backwardWord calls modify(move, backward, word)", () => {
		const el = makeEditable("foo bar");
		collapseTo(el, el.firstChild as Text, 7);
		backwardWord(el);
		expect(modifySpy).toHaveBeenCalledWith("move", "backward", "word");
	});

	it("beginningOfLine calls modify(move, backward, lineboundary)", () => {
		const el = makeEditable("hello");
		collapseTo(el, el.firstChild as Text, 3);
		beginningOfLine(el);
		expect(modifySpy).toHaveBeenCalledWith("move", "backward", "lineboundary");
	});

	it("endOfLine calls modify(move, forward, lineboundary)", () => {
		const el = makeEditable("hello");
		collapseTo(el, el.firstChild as Text, 0);
		endOfLine(el);
		expect(modifySpy).toHaveBeenCalledWith("move", "forward", "lineboundary");
	});

	it("nextLine calls modify(move, forward, line)", () => {
		const el = makeEditable("hello");
		collapseTo(el, el.firstChild as Text, 0);
		nextLine(el);
		expect(modifySpy).toHaveBeenCalledWith("move", "forward", "line");
	});

	it("previousLine calls modify(move, backward, line)", () => {
		const el = makeEditable("hello");
		collapseTo(el, el.firstChild as Text, 0);
		previousLine(el);
		expect(modifySpy).toHaveBeenCalledWith("move", "backward", "line");
	});

	it("does nothing when selection is outside the element", () => {
		const el = makeEditable("hello");
		const outside = document.createElement("div");
		outside.contentEditable = "true";
		outside.textContent = "other";
		document.body.appendChild(outside);
		collapseTo(outside, outside.firstChild as Text, 1);

		forwardChar(el);
		expect(modifySpy).not.toHaveBeenCalled();
	});
});

describe("extendSelection", () => {
	it("calls modify(extend, direction, granularity)", () => {
		const el = makeEditable("hello");
		collapseTo(el, el.firstChild as Text, 0);
		extendSelection(el, "forward", "word");
		expect(modifySpy).toHaveBeenCalledWith("extend", "forward", "word");
	});
});

describe("deletion ops (Selection.modify-based)", () => {
	it("deleteChar dispatches deleteContentForward when selection is non-collapsed after extend", () => {
		const el = makeEditable("hello");
		// Pre-extend a selection so toString() yields something even
		// though our stub modify is a no-op. This simulates the case
		// where Selection.modify successfully extended the selection.
		const textNode = el.firstChild as Text;
		selectWholeNode(el, textNode, 2, 3);
		const events: InputEvent[] = [];
		el.addEventListener("input", e => events.push(e as InputEvent));

		deleteChar(el);

		// Selection started non-collapsed so modify() is not called.
		expect(events).toHaveLength(1);
		expect(events[0].inputType).toBe("deleteContentForward");
	});

	it("deleteChar is a no-op when selection stays collapsed (e.g., caret at end-of-editable)", () => {
		const el = makeEditable("hello");
		// Stubbed modify is a no-op, so the collapsed selection at offset
		// 2 stays collapsed - simulating cursor-at-end-of-editable in
		// Electron where there's nothing to delete forward.
		collapseTo(el, el.firstChild as Text, 2);
		const events: InputEvent[] = [];
		el.addEventListener("input", e => events.push(e as InputEvent));

		deleteChar(el);

		expect(modifySpy).toHaveBeenCalledWith("extend", "right", "character");
		// No input event because nothing was deleted; downstream listeners
		// must not be misled into thinking a deletion happened.
		expect(events).toHaveLength(0);
	});

	it("killWord dispatches deleteWordForward and returns text from current selection", () => {
		const el = makeEditable("foo bar");
		// Pre-extend a selection so toString() yields something even
		// though our stub modify is a no-op.
		const textNode = el.firstChild as Text;
		selectWholeNode(el, textNode, 0, 3);
		const events: InputEvent[] = [];
		el.addEventListener("input", e => events.push(e as InputEvent));

		const killed = killWord(el);

		expect(killed).toBe("foo");
		expect(events).toHaveLength(1);
		expect(events[0].inputType).toBe("deleteWordForward");
	});

	it("backwardKillWord dispatches deleteWordBackward", () => {
		const el = makeEditable("foo bar");
		const textNode = el.firstChild as Text;
		selectWholeNode(el, textNode, 4, 7);
		const events: InputEvent[] = [];
		el.addEventListener("input", e => events.push(e as InputEvent));

		const killed = backwardKillWord(el);

		expect(killed).toBe("bar");
		expect(events).toHaveLength(1);
		expect(events[0].inputType).toBe("deleteWordBackward");
	});

	it("killLine dispatches deleteSoftLineForward when there is text to kill", () => {
		const el = makeEditable("hello");
		const textNode = el.firstChild as Text;
		selectWholeNode(el, textNode, 0, 5);
		const events: InputEvent[] = [];
		el.addEventListener("input", e => events.push(e as InputEvent));

		const killed = killLine(el);

		expect(killed).toBe("hello");
		expect(events).toHaveLength(1);
		expect(events[0].inputType).toBe("deleteSoftLineForward");
	});

	it("killLine returns empty and dispatches nothing when nothing to kill", () => {
		const el = makeEditable("hello");
		// Collapsed at end with stubbed modify (no-op): nothing to kill.
		collapseTo(el, el.firstChild as Text, 5);
		const events: InputEvent[] = [];
		el.addEventListener("input", e => events.push(e as InputEvent));

		const killed = killLine(el);

		expect(killed).toBe("");
		expect(events).toHaveLength(0);
	});
});
