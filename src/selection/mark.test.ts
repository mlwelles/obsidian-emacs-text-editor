import {describe, expect, it} from "vitest";
import {MarkState} from "./mark";

describe("MarkState", () => {
	it("starts inactive", () => {
		const mark = new MarkState();
		expect(mark.isActive()).toBe(false);
		expect(mark.origin()).toBeUndefined();
	});

	it("becomes active after set", () => {
		const mark = new MarkState();
		mark.set({line: 1, ch: 5});
		expect(mark.isActive()).toBe(true);
		expect(mark.origin()).toEqual({line: 1, ch: 5});
	});

	it("becomes inactive after clear", () => {
		const mark = new MarkState();
		mark.set({line: 1, ch: 5});
		mark.clear();
		expect(mark.isActive()).toBe(false);
		expect(mark.origin()).toBeUndefined();
	});

	it("set replaces the previous origin", () => {
		const mark = new MarkState();
		mark.set({line: 1, ch: 5});
		mark.set({line: 2, ch: 0});
		expect(mark.origin()).toEqual({line: 2, ch: 0});
	});
});
