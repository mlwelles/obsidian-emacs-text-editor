/**
 * Layer 2 emacs/readline operations for contenteditable elements.
 *
 * Uses the modern non-deprecated stack:
 * - Selection.modify(alter, direction, granularity) for cursor movement
 *   and selection extension. Baseline since 2020.
 * - Range.deleteContents() for removal.
 * - Range.insertNode(document.createTextNode(text)) for insertion.
 * - Synthetic InputEvent("input", {inputType, data?, bubbles: true})
 *   dispatched after each mutation for host notification.
 *
 * NO document.execCommand anywhere - it's deprecated.
 *
 * Selection.modify-driven paths are spy-verified in tests; full behavior
 * is verified by manual regression in Electron (jsdom does not implement
 * Selection.modify). Range-API paths (kill-region, yank, kill-ring-save,
 * get-selected-text) are exercised end-to-end in jsdom.
 *
 * Known cost: native browser undo (Cmd-Z) does NOT include our DOM
 * mutations. Users requiring undo should use C-_ / C-/ (Obsidian's
 * command system) or rely on host-managed undo (e.g., file rename has
 * its own undo mechanism via Obsidian's vault API).
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
	// Both endpoints must be inside `el`. If the user starts a selection
	// inside the editable and drags out into a sibling, anchorNode stays
	// inside but focusNode escapes; acting on such a selection would
	// mutate DOM outside our target element.
	const anchor = sel.anchorNode;
	if (!anchor || !el.contains(anchor)) return null;
	const focus = sel.focusNode;
	if (!focus || !el.contains(focus)) return null;
	return sel;
}

/**
 * Dispatch a synthetic InputEvent on `el`. Named `fireInputEvent` (not
 * `dispatchInput`) to avoid collision with the router's `dispatchInput`
 * function in `./index.ts`, which serves a different purpose (routing
 * commands to operations for input/textarea elements).
 */
function fireInputEvent(el: HTMLElement, inputType: string, data?: string): void {
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
	// If the caret was at the end of the editable, modify() was a no-op
	// and the selection is still collapsed. Bail before firing a synthetic
	// input event that would mislead Obsidian's modification trackers.
	if (sel.isCollapsed) return;
	deleteSelectionRanges(sel);
	fireInputEvent(el, "deleteContentForward");
}

export function killWord(el: HTMLElement): string {
	const sel = getActiveSelection(el);
	if (!sel) return "";
	if (sel.isCollapsed) {
		sel.modify("extend", "forward", "word");
	}
	const text = sel.toString();
	deleteSelectionRanges(sel);
	fireInputEvent(el, "deleteWordForward");
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
	fireInputEvent(el, "deleteWordBackward");
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
	fireInputEvent(el, "deleteSoftLineForward");
	return text;
}

export function killRegion(el: HTMLElement): string {
	const sel = getActiveSelection(el);
	if (!sel) return "";
	const text = sel.toString();
	if (!text) return "";
	deleteSelectionRanges(sel);
	fireInputEvent(el, "deleteContentBackward");
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
	fireInputEvent(el, "insertText", text);
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
