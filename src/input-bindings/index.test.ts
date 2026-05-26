import {afterEach, describe, expect, it} from "vitest";
import {installInputBindings, type InputBindingsContext} from "./index";
import {KillRing} from "../kill-ring/kill-ring";
import {MarkState} from "../selection/mark";
import {RepeatDetector} from "../tracking/repeat-detector";
import type {Logger} from "../log";

const noopLogger: Logger = {debug: () => {}};

interface Harness {
	ctx: InputBindingsContext;
	el: HTMLTextAreaElement;
	cleanup: () => void;
}

function setup(value = ""): Harness {
	const ctx: InputBindingsContext = {
		killRing: new KillRing(120),
		mark: new MarkState(),
		repeats: new RepeatDetector(),
		logger: noopLogger,
	};
	const cleanups: Array<() => void> = [];
	installInputBindings(document, ctx, c => cleanups.push(c));
	const el = document.createElement("textarea");
	document.body.appendChild(el);
	el.value = value;
	el.focus();
	return {
		ctx,
		el,
		cleanup: () => {
			cleanups.forEach(c => c());
			el.remove();
		},
	};
}

function fireKey(el: HTMLElement, init: KeyboardEventInit): void {
	el.dispatchEvent(new KeyboardEvent("keydown", {bubbles: true, cancelable: true, ...init}));
}

describe("dispatcher: Meta keys on macOS (alt-composed glyph)", () => {
	let h: Harness | undefined;
	afterEach(() => {
		h?.cleanup();
		h = undefined;
	});

	it("M-d (Option-d) kills the next word even though event.key is '∂'", () => {
		h = setup("hello world");
		h.el.setSelectionRange(0, 0);
		fireKey(h.el, {key: "∂", code: "KeyD", altKey: true});
		expect(h.el.value).toBe(" world");
	});

	it("M-f (Option-f) moves point to end of word even though event.key is 'ƒ'", () => {
		h = setup("hello world");
		h.el.setSelectionRange(0, 0);
		fireKey(h.el, {key: "ƒ", code: "KeyF", altKey: true});
		expect(h.el.selectionStart).toBe(5); // end of "hello"
	});
});

describe("dispatcher: mark mode + repeated C-f extends one char at a time", () => {
	let h: Harness | undefined;
	afterEach(() => {
		h?.cleanup();
		h = undefined;
	});

	it("each C-f advances point and extends the region", () => {
		h = setup("abcdef");
		h.el.setSelectionRange(0, 0);
		// Activate mark at position 0
		h.ctx.mark.set({line: 0, ch: 0});

		fireKey(h.el, {key: "f", code: "KeyF", ctrlKey: true});
		expect(h.el.selectionStart).toBe(0);
		expect(h.el.selectionEnd).toBe(1);

		fireKey(h.el, {key: "f", code: "KeyF", ctrlKey: true});
		expect(h.el.selectionStart).toBe(0);
		expect(h.el.selectionEnd).toBe(2);

		fireKey(h.el, {key: "f", code: "KeyF", ctrlKey: true});
		expect(h.el.selectionStart).toBe(0);
		expect(h.el.selectionEnd).toBe(3);
	});

	it("C-b after extending forward shrinks the region from the right edge", () => {
		h = setup("abcdef");
		h.el.setSelectionRange(0, 0);
		h.ctx.mark.set({line: 0, ch: 0});

		// extend to (0, 3)
		fireKey(h.el, {key: "f", code: "KeyF", ctrlKey: true});
		fireKey(h.el, {key: "f", code: "KeyF", ctrlKey: true});
		fireKey(h.el, {key: "f", code: "KeyF", ctrlKey: true});
		expect(h.el.selectionEnd).toBe(3);

		// C-b should shrink to (0, 2)
		fireKey(h.el, {key: "b", code: "KeyB", ctrlKey: true});
		expect(h.el.selectionStart).toBe(0);
		expect(h.el.selectionEnd).toBe(2);
	});
});
