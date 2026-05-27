import {classifyElement, ElementKind} from "./element-filter";
import * as ops from "./ops";
import * as ceOps from "./contenteditable-ops";
import type {KillRing} from "../kill-ring/kill-ring";
import type {MarkState} from "../selection/mark";
import type {RepeatDetector} from "../tracking/repeat-detector";
import type {Logger} from "../log";

export interface InputBindingsContext {
	killRing: KillRing;
	mark: MarkState;
	repeats: RepeatDetector;
	logger: Logger;
}

const ID = {
	FORWARD_CHAR: "input:forward-char",
	BACKWARD_CHAR: "input:backward-char",
	NEXT_LINE: "input:next-line",
	PREVIOUS_LINE: "input:previous-line",
	FORWARD_WORD: "input:forward-word",
	BACKWARD_WORD: "input:backward-word",
	BEGINNING_OF_LINE: "input:beginning-of-line",
	END_OF_LINE: "input:end-of-line",
	DELETE_CHAR: "input:delete-char",
	KILL_LINE: "input:kill-line",
	KILL_WORD: "input:kill-word",
	BACKWARD_KILL_WORD: "input:backward-kill-word",
	KILL_RING_SAVE: "input:kill-ring-save",
	KILL_REGION: "input:kill-region",
	YANK: "input:yank",
	YANK_POP: "input:yank-pop",
	SET_MARK: "input:set-mark",
	KEYBOARD_QUIT: "input:keyboard-quit",
} as const;

interface KeySpec {
	ctrl?: boolean;
	alt?: boolean;
	shift?: boolean;
	meta?: boolean;
	key: string; // event.key value
	id: string;
}

const KEY_SPECS: KeySpec[] = [
	{ctrl: true, key: "f", id: ID.FORWARD_CHAR},
	{ctrl: true, key: "b", id: ID.BACKWARD_CHAR},
	{ctrl: true, key: "n", id: ID.NEXT_LINE},
	{ctrl: true, key: "p", id: ID.PREVIOUS_LINE},
	{alt: true, key: "f", id: ID.FORWARD_WORD},
	{alt: true, key: "b", id: ID.BACKWARD_WORD},
	{ctrl: true, key: "a", id: ID.BEGINNING_OF_LINE},
	{ctrl: true, key: "e", id: ID.END_OF_LINE},
	{ctrl: true, key: "d", id: ID.DELETE_CHAR},
	{ctrl: true, key: "k", id: ID.KILL_LINE},
	{alt: true, key: "d", id: ID.KILL_WORD},
	{alt: true, key: "Backspace", id: ID.BACKWARD_KILL_WORD},
	{alt: true, key: "w", id: ID.KILL_RING_SAVE},
	{ctrl: true, key: "w", id: ID.KILL_REGION},
	{ctrl: true, key: "y", id: ID.YANK},
	{alt: true, key: "y", id: ID.YANK_POP},
	{ctrl: true, key: " ", id: ID.SET_MARK},
	{ctrl: true, key: "g", id: ID.KEYBOARD_QUIT},
];

function matches(event: KeyboardEvent, spec: KeySpec): boolean {
	if ((spec.ctrl ?? false) !== event.ctrlKey) return false;
	if ((spec.alt ?? false) !== event.altKey) return false;
	if ((spec.shift ?? false) !== event.shiftKey) return false;
	if ((spec.meta ?? false) !== event.metaKey) return false;
	return event.key === spec.key;
}

export function installInputBindings(
	target: Document,
	ctx: InputBindingsContext,
	registerCleanup: (cleanup: () => void) => void,
): void {
	const handler = (event: KeyboardEvent) => {
		const kind = classifyElement(event.target as Element | null);
		// Layer 1 owns the markdown editor (cm-editor descendants); they are
		// classified as Skip by the element filter.
		const spec = KEY_SPECS.find(s => matches(event, s));
		if (!spec) {
			return;
		}
		if (kind === ElementKind.SingleLineInput || kind === ElementKind.MultiLineInput) {
			event.preventDefault();
			event.stopPropagation();
			dispatchInput(spec.id, event.target as HTMLInputElement | HTMLTextAreaElement, ctx);
			return;
		}
		if (kind === ElementKind.ContentEditable) {
			event.preventDefault();
			event.stopPropagation();
			dispatchContentEditable(spec.id, event.target as HTMLElement, ctx);
			return;
		}
	};
	target.addEventListener("keydown", handler, {capture: true});
	registerCleanup(() => {
		target.removeEventListener("keydown", handler, {capture: true});
	});
}

function dispatchInput(
	id: string,
	el: HTMLInputElement | HTMLTextAreaElement,
	ctx: InputBindingsContext,
): void {
	const {isRepeat} = ctx.repeats.track(id);
	switch (id) {
		case ID.FORWARD_CHAR:
			ops.forwardChar(el);
			extendOrClear(el, ctx);
			return;
		case ID.BACKWARD_CHAR:
			ops.backwardChar(el);
			extendOrClear(el, ctx);
			return;
		case ID.NEXT_LINE:
			ops.nextLine(el);
			extendOrClear(el, ctx);
			return;
		case ID.PREVIOUS_LINE:
			ops.previousLine(el);
			extendOrClear(el, ctx);
			return;
		case ID.FORWARD_WORD:
			ops.forwardWord(el);
			extendOrClear(el, ctx);
			return;
		case ID.BACKWARD_WORD:
			ops.backwardWord(el);
			extendOrClear(el, ctx);
			return;
		case ID.BEGINNING_OF_LINE:
			ops.beginningOfLine(el);
			extendOrClear(el, ctx);
			return;
		case ID.END_OF_LINE:
			ops.endOfLine(el);
			extendOrClear(el, ctx);
			return;
		case ID.DELETE_CHAR:
			ops.deleteChar(el);
			return;
		case ID.KILL_LINE: {
			const killed = ops.killLine(el);
			if (killed) ctx.killRing.save(killed, {extendForward: isRepeat});
			return;
		}
		case ID.KILL_WORD: {
			const killed = ops.killWord(el);
			ctx.killRing.save(killed, {extendForward: isRepeat});
			return;
		}
		case ID.BACKWARD_KILL_WORD: {
			const killed = ops.backwardKillWord(el);
			ctx.killRing.save(killed, {extendBackward: isRepeat});
			return;
		}
		case ID.KILL_RING_SAVE: {
			const text = ops.killRingSave(el);
			if (text) ctx.killRing.save(text);
			ctx.mark.clear();
			return;
		}
		case ID.KILL_REGION: {
			const text = ops.killRegion(el);
			if (text) ctx.killRing.save(text);
			ctx.mark.clear();
			return;
		}
		case ID.YANK: {
			const text = ctx.killRing.current();
			if (text !== undefined) ops.yank(el, text);
			return;
		}
		case ID.YANK_POP: {
			const text = ctx.killRing.rotate();
			if (text !== undefined) ops.yank(el, text);
			return;
		}
		case ID.SET_MARK: {
			// MarkState was designed for editor positions {line, ch};
			// for inputs we co-opt `ch` as the absolute character offset
			// within el.value and set line=0. See feature plan § Phase 2
			// "Note on mark-origin storage".
			ctx.mark.set({line: 0, ch: el.selectionStart ?? 0});
			return;
		}
		case ID.KEYBOARD_QUIT: {
			ctx.mark.clear();
			const point = el.selectionDirection === "backward"
				? (el.selectionStart ?? 0)
				: (el.selectionEnd ?? 0);
			el.setSelectionRange(point, point);
			return;
		}
	}
}

function extendOrClear(el: HTMLInputElement | HTMLTextAreaElement, ctx: InputBindingsContext): void {
	if (!ctx.mark.isActive()) {
		return;
	}
	const origin = ctx.mark.origin();
	if (!origin) return;
	// In Layer 2, mark origin's `ch` field stores the absolute offset (line is unused for inputs).
	const start = Math.min(origin.ch, el.selectionStart ?? 0);
	const end = Math.max(origin.ch, el.selectionStart ?? 0);
	el.setSelectionRange(start, end);
}

// ---------- ContentEditable dispatch ----------
//
// The ContentEditable path uses the Selection API directly, so mark
// extension is handled differently: instead of recomputing a range from
// stored offsets (as inputs do), we call Selection.modify("extend", ...)
// in place of Selection.modify("move", ...) whenever the mark is active.
// The MarkState's stored {line, ch} from SET_MARK is unused in this path;
// we rely on the Selection's own anchor as the mark origin.

function dispatchContentEditable(id: string, el: HTMLElement, ctx: InputBindingsContext): void {
	const {isRepeat} = ctx.repeats.track(id);
	const markActive = ctx.mark.isActive();
	const alterMove = markActive ? extendMove : moveMove;
	switch (id) {
		case ID.FORWARD_CHAR:
			alterMove(el, "right", "character");
			return;
		case ID.BACKWARD_CHAR:
			alterMove(el, "left", "character");
			return;
		case ID.FORWARD_WORD:
			alterMove(el, "forward", "word");
			return;
		case ID.BACKWARD_WORD:
			alterMove(el, "backward", "word");
			return;
		case ID.BEGINNING_OF_LINE:
			alterMove(el, "backward", "lineboundary");
			return;
		case ID.END_OF_LINE:
			alterMove(el, "forward", "lineboundary");
			return;
		case ID.NEXT_LINE:
			alterMove(el, "forward", "line");
			return;
		case ID.PREVIOUS_LINE:
			alterMove(el, "backward", "line");
			return;
		case ID.DELETE_CHAR:
			ceOps.deleteChar(el);
			return;
		case ID.KILL_LINE: {
			const killed = ceOps.killLine(el);
			if (killed) ctx.killRing.save(killed, {extendForward: isRepeat});
			return;
		}
		case ID.KILL_WORD: {
			const killed = ceOps.killWord(el);
			if (killed) ctx.killRing.save(killed, {extendForward: isRepeat});
			return;
		}
		case ID.BACKWARD_KILL_WORD: {
			const killed = ceOps.backwardKillWord(el);
			if (killed) ctx.killRing.save(killed, {extendBackward: isRepeat});
			return;
		}
		case ID.KILL_RING_SAVE: {
			const text = ceOps.killRingSave(el);
			if (text) ctx.killRing.save(text);
			ctx.mark.clear();
			return;
		}
		case ID.KILL_REGION: {
			const text = ceOps.killRegion(el);
			if (text) ctx.killRing.save(text);
			ctx.mark.clear();
			return;
		}
		case ID.YANK: {
			const text = ctx.killRing.current();
			if (text !== undefined) ceOps.yank(el, text);
			return;
		}
		case ID.YANK_POP: {
			const text = ctx.killRing.rotate();
			if (text !== undefined) ceOps.yank(el, text);
			return;
		}
		case ID.SET_MARK: {
			// In the contenteditable path the live Selection anchor serves
			// as the mark; we still set MarkState so movement ops know to
			// extend rather than move. The stored offset is unused.
			ctx.mark.set({line: 0, ch: 0});
			return;
		}
		case ID.KEYBOARD_QUIT: {
			ctx.mark.clear();
			const sel = (el.ownerDocument?.defaultView ?? window).getSelection();
			sel?.collapseToEnd();
			return;
		}
	}
}

type CeDirection = "forward" | "backward" | "left" | "right";
type CeGranularity = "character" | "word" | "line" | "lineboundary";

function moveMove(el: HTMLElement, direction: CeDirection, granularity: CeGranularity): void {
	switch (granularity) {
		case "character":
			direction === "right" ? ceOps.forwardChar(el) : ceOps.backwardChar(el);
			return;
		case "word":
			direction === "forward" ? ceOps.forwardWord(el) : ceOps.backwardWord(el);
			return;
		case "lineboundary":
			direction === "forward" ? ceOps.endOfLine(el) : ceOps.beginningOfLine(el);
			return;
		case "line":
			direction === "forward" ? ceOps.nextLine(el) : ceOps.previousLine(el);
			return;
	}
}

function extendMove(el: HTMLElement, direction: CeDirection, granularity: CeGranularity): void {
	ceOps.extendSelection(el, direction, granularity);
}
