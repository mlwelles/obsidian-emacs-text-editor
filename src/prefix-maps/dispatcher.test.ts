import {beforeEach, describe, expect, it, vi} from "vitest";
import {PrefixDispatcher, type PrefixMap} from "./dispatcher";

const cx = {ctrl: true, key: "x"} as const;
const cs = {ctrl: true, key: "s"} as const;
const cf = {ctrl: true, key: "f"} as const;
const cg = {ctrl: true, key: "g"} as const;
const k5 = {key: "5"} as const;
const k0 = {key: "0"} as const;
const kb = {key: "b"} as const;

const fakeLogger = {debug: vi.fn()};

function makeEvent(spec: {ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean; key: string}): KeyboardEvent {
	return new KeyboardEvent("keydown", {
		ctrlKey: spec.ctrl ?? false,
		altKey: spec.alt ?? false,
		shiftKey: spec.shift ?? false,
		metaKey: spec.meta ?? false,
		key: spec.key,
	});
}

describe("PrefixDispatcher", () => {
	let saveAction: ReturnType<typeof vi.fn>;
	let findFileAction: ReturnType<typeof vi.fn>;
	let switchBufferAction: ReturnType<typeof vi.fn>;
	let closeWindowAction: ReturnType<typeof vi.fn>;
	let dispatcher: PrefixDispatcher;

	beforeEach(() => {
		saveAction = vi.fn();
		findFileAction = vi.fn();
		switchBufferAction = vi.fn();
		closeWindowAction = vi.fn();
		const maps: PrefixMap[] = [
			{
				prefix: cx,
				bindings: [
					{chord: cs, action: saveAction},
					{chord: cf, action: findFileAction},
					{chord: kb, action: switchBufferAction},
					{
						chord: k5,
						subBindings: [{chord: k0, action: closeWindowAction}],
					},
				],
			},
		];
		dispatcher = new PrefixDispatcher(maps, fakeLogger, {timeoutMs: 5000});
	});

	it("returns false for events that don't match any prefix in idle state", () => {
		const consumed = dispatcher.handle(makeEvent({key: "a"}));
		expect(consumed).toBe(false);
	});

	it("returns true and switches to awaiting on prefix match", () => {
		const consumed = dispatcher.handle(makeEvent(cx));
		expect(consumed).toBe(true);
		expect(saveAction).not.toHaveBeenCalled();
	});

	it("dispatches the matched leaf action on second chord", () => {
		dispatcher.handle(makeEvent(cx));
		const consumed = dispatcher.handle(makeEvent(cs));
		expect(consumed).toBe(true);
		expect(saveAction).toHaveBeenCalledTimes(1);
	});

	it("returns to idle after dispatching a leaf", () => {
		dispatcher.handle(makeEvent(cx));
		dispatcher.handle(makeEvent(cs));
		// Now in idle. Next prefix should be accepted.
		expect(dispatcher.handle(makeEvent(cx))).toBe(true);
	});

	it("descends into a sub-prefix and dispatches on third chord", () => {
		dispatcher.handle(makeEvent(cx));
		expect(dispatcher.handle(makeEvent(k5))).toBe(true);
		expect(closeWindowAction).not.toHaveBeenCalled();
		expect(dispatcher.handle(makeEvent(k0))).toBe(true);
		expect(closeWindowAction).toHaveBeenCalledTimes(1);
	});

	it("cancels on C-g and returns to idle", () => {
		dispatcher.handle(makeEvent(cx));
		const consumed = dispatcher.handle(makeEvent(cg));
		expect(consumed).toBe(true);
		expect(saveAction).not.toHaveBeenCalled();
		// Idle: next non-prefix should pass through
		expect(dispatcher.handle(makeEvent({key: "a"}))).toBe(false);
	});

	it("cancels on Escape and returns to idle", () => {
		dispatcher.handle(makeEvent(cx));
		const consumed = dispatcher.handle(makeEvent({key: "Escape"}));
		expect(consumed).toBe(true);
		expect(dispatcher.handle(makeEvent({key: "a"}))).toBe(false);
	});

	it("ignores unmatched second chord and returns to idle (consumes the chord to avoid stray inserts)", () => {
		dispatcher.handle(makeEvent(cx));
		const consumed = dispatcher.handle(makeEvent({key: "z"})); // no binding
		expect(consumed).toBe(true);
		expect(dispatcher.handle(makeEvent({key: "a"}))).toBe(false);
	});

	it("re-press of prefix while awaiting cancels-and-restarts", () => {
		dispatcher.handle(makeEvent(cx));
		// Press C-x again — restart; still awaiting at top level.
		const consumed = dispatcher.handle(makeEvent(cx));
		expect(consumed).toBe(true);
		// Now press s once — should dispatch save once.
		dispatcher.handle(makeEvent(cs));
		expect(saveAction).toHaveBeenCalledTimes(1);
	});

	it("cancels via timeout if user pauses too long", () => {
		vi.useFakeTimers();
		try {
			const d = new PrefixDispatcher(
				[
					{
						prefix: cx,
						bindings: [{chord: cs, action: saveAction}],
					},
				],
				fakeLogger,
				{timeoutMs: 100},
			);
			d.handle(makeEvent(cx));
			vi.advanceTimersByTime(150);
			// After timeout, dispatcher is idle; next non-prefix passes through.
			expect(d.handle(makeEvent({key: "a"}))).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});

	it("cancel() resets state from any awaiting position", () => {
		dispatcher.handle(makeEvent(cx));
		dispatcher.handle(makeEvent(k5)); // descended into sub-prefix
		dispatcher.cancel();
		expect(dispatcher.handle(makeEvent({key: "a"}))).toBe(false);
		expect(closeWindowAction).not.toHaveBeenCalled();
	});
});
