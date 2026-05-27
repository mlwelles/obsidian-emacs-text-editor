/**
 * Layer-2 operations for contenteditable elements.
 *
 * Uses the modern Selection + Range APIs:
 *   - Selection.modify("move"|"extend", direction, granularity) for cursor
 *     movement and selection extension.
 *   - Range.deleteContents() for removal.
 *   - Range.insertNode() for insertion.
 *   - Synthetic InputEvent("input", {inputType, ...}) dispatched after every
 *     mutation, matching the input-events spec
 *     (https://w3c.github.io/input-events/).
 *
 * Notably absent: document.execCommand. It is deprecated and forbidden here.
 *
 * Tests for this module are largely deferred to manual regression in
 * Obsidian. jsdom does not implement Selection.modify; testing the
 * cursor-movement paths in jsdom would require mocking, which mostly
 * verifies that we call the API rather than that we use it correctly.
 * Manual smoke testing in Electron is more informative. A handful of tests
 * that exercise APIs jsdom does support (Selection.toString,
 * Range.deleteContents, Range.insertNode) ride along in the *.test.ts
 * sibling file.
 */

type Direction = "forward" | "backward" | "left" | "right";
type Granularity =
	| "character"
	| "word"
	| "line"
	| "lineboundary"
	| "sentence"
	| "sentenceboundary"
	| "paragraph"
	| "paragraphboundary"
	| "documentboundary";

interface SelectionWithModify extends Selection {
	modify(alter: "move" | "extend", direction: Direction, granularity: Granularity): void;
}

function getActiveSelection(el: HTMLElement): SelectionWithModify | null {
	const win = el.ownerDocument?.defaultView ?? window;
	const sel = win.getSelection() as SelectionWithModify | null;
	if (!sel || sel.rangeCount === 0) return null;
	// Only act if the selection is anchored within this element.
	const anchor = sel.anchorNode;
	if (!anchor || !el.contains(anchor)) return null;
	return sel;
}

function dispatchInput(el: HTMLElement, inputType: string, data?: string): void {
	const init: InputEventInit = {inputType, bubbles: true};
	if (data !== undefined) init.data = data;
	el.dispatchEvent(new InputEvent("input", init));
}

// ---------- movement ----------

export function forwardChar(el: HTMLElement): void {
	const sel = getActiveSelection(el);
	if (!sel) return;
	sel.modify("move", "right", "character");
}

export function backwardChar(el: HTMLElement): void {
	const sel = getActiveSelection(el);
	if (!sel) return;
	sel.modify("move", "left", "character");
}

export function forwardWord(el: HTMLElement): void {
	const sel = getActiveSelection(el);
	if (!sel) return;
	sel.modify("move", "forward", "word");
}

export function backwardWord(el: HTMLElement): void {
	const sel = getActiveSelection(el);
	if (!sel) return;
	sel.modify("move", "backward", "word");
}

export function beginningOfLine(el: HTMLElement): void {
	const sel = getActiveSelection(el);
	if (!sel) return;
	sel.modify("move", "backward", "lineboundary");
}

export function endOfLine(el: HTMLElement): void {
	const sel = getActiveSelection(el);
	if (!sel) return;
	sel.modify("move", "forward", "lineboundary");
}

export function nextLine(el: HTMLElement): void {
	const sel = getActiveSelection(el);
	if (!sel) return;
	sel.modify("move", "forward", "line");
}

export function previousLine(el: HTMLElement): void {
	const sel = getActiveSelection(el);
	if (!sel) return;
	sel.modify("move", "backward", "line");
}

// ---------- selection extension (used by the router when mark is active) ----------

/**
 * Extend the current selection by `granularity` in `direction`. The router
 * calls this in place of `forwardChar` etc. when MarkState reports active.
 */
export function extendSelection(el: HTMLElement, direction: Direction, granularity: Granularity): void {
	const sel = getActiveSelection(el);
	if (!sel) return;
	sel.modify("extend", direction, granularity);
}

// ---------- deletion ----------

export function deleteChar(el: HTMLElement): void {
	const sel = getActiveSelection(el);
	if (!sel) return;
	if (sel.isCollapsed) {
		sel.modify("extend", "right", "character");
	}
	deleteSelectionRanges(sel);
	dispatchInput(el, "deleteContentForward");
}

export function killWord(el: HTMLElement): string {
	const sel = getActiveSelection(el);
	if (!sel) return "";
	if (sel.isCollapsed) {
		sel.modify("extend", "forward", "word");
	}
	const text = sel.toString();
	deleteSelectionRanges(sel);
	dispatchInput(el, "deleteWordForward");
	return text;
}

export function backwardKillWord(el: HTMLElement): string {
	const sel = getActiveSelection(el);
	if (!sel) return "";
	if (sel.isCollapsed) {
		sel.modify("extend", "backward", "word");
	}
	const text = sel.toString();
	deleteSelectionRanges(sel);
	dispatchInput(el, "deleteWordBackward");
	return text;
}

export function killLine(el: HTMLElement): string {
	const sel = getActiveSelection(el);
	if (!sel) return "";
	if (sel.isCollapsed) {
		// Extend to end-of-line. If already at end-of-line, extend one
		// character forward so the trailing newline gets killed (matches
		// the textarea kill-line behavior).
		sel.modify("extend", "forward", "lineboundary");
		if (sel.isCollapsed) {
			sel.modify("extend", "forward", "character");
		}
	}
	const text = sel.toString();
	if (!text) return "";
	deleteSelectionRanges(sel);
	dispatchInput(el, "deleteSoftLineForward");
	return text;
}

export function killRegion(el: HTMLElement): string {
	const sel = getActiveSelection(el);
	if (!sel) return "";
	const text = sel.toString();
	if (!text) return "";
	deleteSelectionRanges(sel);
	dispatchInput(el, "deleteContentBackward");
	return text;
}

export function killRingSave(el: HTMLElement): string {
	const sel = getActiveSelection(el);
	if (!sel) return "";
	const text = sel.toString();
	sel.collapseToEnd();
	return text;
}

// ---------- insertion ----------

export function yank(el: HTMLElement, text: string): void {
	const sel = getActiveSelection(el);
	if (!sel || sel.rangeCount === 0) return;
	const range = sel.getRangeAt(0);
	range.deleteContents();
	const doc = el.ownerDocument ?? document;
	const node = doc.createTextNode(text);
	range.insertNode(node);
	// Place the caret immediately after the inserted node.
	range.setStartAfter(node);
	range.setEndAfter(node);
	sel.removeAllRanges();
	sel.addRange(range);
	dispatchInput(el, "insertText", text);
}

// ---------- inspection ----------

export function getSelectedText(el: HTMLElement): string {
	const sel = getActiveSelection(el);
	if (!sel) return "";
	return sel.toString();
}

// ---------- internals ----------

function deleteSelectionRanges(sel: Selection): void {
	for (let i = 0; i < sel.rangeCount; i++) {
		const r = sel.getRangeAt(i);
		r.deleteContents();
	}
	sel.collapseToStart();
}
