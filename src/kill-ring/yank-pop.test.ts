import {describe, expect, it} from "vitest";
import {YankPopSession} from "./yank-pop";

describe("YankPopSession", () => {
	it("starts inactive", () => {
		const session = new YankPopSession();
		expect(session.isActive()).toBe(false);
		expect(session.range()).toBeUndefined();
	});

	it("becomes active after start", () => {
		const session = new YankPopSession();
		session.start({line: 0, ch: 0}, {line: 0, ch: 5});
		expect(session.isActive()).toBe(true);
		expect(session.range()).toEqual({
			start: {line: 0, ch: 0},
			end: {line: 0, ch: 5},
		});
	});

	it("becomes inactive after cancel", () => {
		const session = new YankPopSession();
		session.start({line: 0, ch: 0}, {line: 0, ch: 5});
		session.cancel();
		expect(session.isActive()).toBe(false);
		expect(session.range()).toBeUndefined();
	});

	it("update replaces the end position only", () => {
		const session = new YankPopSession();
		session.start({line: 0, ch: 0}, {line: 0, ch: 5});
		session.updateEnd({line: 0, ch: 7});
		expect(session.range()).toEqual({
			start: {line: 0, ch: 0},
			end: {line: 0, ch: 7},
		});
	});

	it("update on inactive session is a no-op", () => {
		const session = new YankPopSession();
		session.updateEnd({line: 0, ch: 7});
		expect(session.isActive()).toBe(false);
	});
});
