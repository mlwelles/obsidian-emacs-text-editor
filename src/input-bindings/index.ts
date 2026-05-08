import {classifyElement, ElementKind} from "./element-filter";
import * as ops from "./ops";
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
		// Layer 1 owns markdown editor (cm-editor descendants); ContentEditable
		// is not yet supported in Layer 2.
		if (kind !== ElementKind.SingleLineInput && kind !== ElementKind.MultiLineInput) {
			return;
		}
		const el = event.target as HTMLInputElement | HTMLTextAreaElement;
		const spec = KEY_SPECS.find(s => matches(event, s));
		if (!spec) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		dispatch(spec.id, el, ctx);
	};
	target.addEventListener("keydown", handler, {capture: true});
	registerCleanup(() => {
		target.removeEventListener("keydown", handler, {capture: true});
	});
}

function dispatch(
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
