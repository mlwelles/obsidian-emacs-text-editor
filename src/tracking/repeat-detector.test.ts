import {describe, expect, it} from "vitest";
import {RepeatDetector} from "./repeat-detector";

describe("RepeatDetector", () => {
	it("returns isRepeat=false on first track", () => {
		const detector = new RepeatDetector();
		expect(detector.track("kill-line").isRepeat).toBe(false);
	});

	it("returns isRepeat=true when the same id is tracked twice in a row", () => {
		const detector = new RepeatDetector();
		detector.track("kill-line");
		expect(detector.track("kill-line").isRepeat).toBe(true);
	});

	it("returns isRepeat=false when a different id is tracked", () => {
		const detector = new RepeatDetector();
		detector.track("kill-line");
		expect(detector.track("kill-word").isRepeat).toBe(false);
	});

	it("last() returns the most recent id", () => {
		const detector = new RepeatDetector();
		expect(detector.last()).toBeUndefined();
		detector.track("forward-char");
		expect(detector.last()).toBe("forward-char");
		detector.track("backward-char");
		expect(detector.last()).toBe("backward-char");
	});
});
