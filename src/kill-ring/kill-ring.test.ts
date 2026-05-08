import {beforeEach, describe, expect, it} from "vitest";
import {KillRing} from "./kill-ring";

describe("KillRing", () => {
	let ring: KillRing;

	beforeEach(() => {
		ring = new KillRing(4); // small max for ring-wrap tests
	});

	describe("save and current", () => {
		it("returns undefined when empty", () => {
			expect(ring.current()).toBeUndefined();
		});

		it("returns the last saved item", () => {
			ring.save("a");
			expect(ring.current()).toBe("a");
		});

		it("advances current to the most recent save", () => {
			ring.save("a");
			ring.save("b");
			expect(ring.current()).toBe("b");
		});

		it("wraps around when exceeding maxSize", () => {
			ring.save("a");
			ring.save("b");
			ring.save("c");
			ring.save("d");
			ring.save("e"); // overwrites slot of "a"
			expect(ring.current()).toBe("e");
		});
	});

	describe("save with extendForward", () => {
		it("appends text to the current entry without advancing the index", () => {
			ring.save("foo");
			ring.save(" bar", {extendForward: true});
			expect(ring.current()).toBe("foo bar");
		});
	});

	describe("save with extendBackward", () => {
		it("prepends text to the current entry without advancing the index", () => {
			ring.save("bar");
			ring.save("foo ", {extendBackward: true});
			expect(ring.current()).toBe("foo bar");
		});
	});

	describe("rotate (yank-pop)", () => {
		it("returns undefined when empty", () => {
			expect(ring.rotate()).toBeUndefined();
		});

		it("returns the previous entry on each call", () => {
			ring.save("a");
			ring.save("b");
			ring.save("c");
			expect(ring.rotate()).toBe("b");
			expect(ring.rotate()).toBe("a");
		});

		it("wraps to the most-recent entry past the start", () => {
			ring.save("a");
			ring.save("b");
			ring.save("c");
			expect(ring.rotate()).toBe("b");
			expect(ring.rotate()).toBe("a");
			expect(ring.rotate()).toBe("c"); // wraps
		});
	});

	describe("size and bounds", () => {
		it("never grows beyond maxSize", () => {
			for (let i = 0; i < 10; i++) {
				ring.save(`item${i}`);
			}
			expect(ring.size()).toBe(4);
		});
	});

	describe("rotation does not affect current", () => {
		it("current() always returns the head, regardless of rotation", () => {
			ring.save("a");
			ring.save("b");
			ring.save("c");
			ring.rotate();
			expect(ring.current()).toBe("c");
			ring.rotate();
			expect(ring.current()).toBe("c");
		});

		it("save resets the rotation cursor", () => {
			ring.save("a");
			ring.save("b");
			ring.save("c");
			ring.rotate(); // moves rotation to "b"
			ring.rotate(); // moves rotation to "a"
			ring.save("d"); // resets rotation
			expect(ring.rotate()).toBe("c"); // first rotate after fresh save → previous head
		});

		it("save with extendForward resets the rotation cursor", () => {
			ring.save("foo");
			ring.save("bar");
			ring.rotate(); // moves rotation to "foo"
			ring.save(" baz", {extendForward: true}); // extends "bar" → "bar baz"; resets rotation
			expect(ring.current()).toBe("bar baz");
			expect(ring.rotate()).toBe("foo");
		});
	});
});
