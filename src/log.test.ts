import {describe, expect, it, vi} from "vitest";
import {createLogger} from "./log";

describe("createLogger", () => {
	it("emits messages with the prefix when enabled", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		const log = createLogger("test", () => true);
		log.debug("hello");
		expect(spy).toHaveBeenCalledWith("test: hello");
		spy.mockRestore();
	});

	it("suppresses messages when the predicate returns false", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		const log = createLogger("test", () => false);
		log.debug("hello");
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});

	it("re-evaluates the predicate on each call", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		let enabled = false;
		const log = createLogger("test", () => enabled);
		log.debug("first");
		expect(spy).not.toHaveBeenCalled();
		enabled = true;
		log.debug("second");
		expect(spy).toHaveBeenCalledWith("test: second");
		spy.mockRestore();
	});
});
