import {describe, expect, it, vi} from "vitest";
import {CommandResolver} from "./command-resolver";
import type {PluginDetector} from "./plugin-detector";

function makeDetector(enabled: string[] = []): PluginDetector {
	const subscribers = new Map<string, Set<(enabled: boolean) => void>>();
	return {
		isEnabled: (id: string) => enabled.includes(id),
		subscribe: (id: string, cb: (enabled: boolean) => void) => {
			if (!subscribers.has(id)) subscribers.set(id, new Set());
			subscribers.get(id)!.add(cb);
			return () => subscribers.get(id)?.delete(cb);
		},
		dispose: () => subscribers.clear(),
		_emit: (id: string, enabled: boolean) => subscribers.get(id)?.forEach(cb => cb(enabled)),
	} as unknown as PluginDetector;
}

describe("CommandResolver", () => {
	it("returns the preferred command id when the preferred plugin is enabled", () => {
		const detector = makeDetector(["preferred-plugin"]);
		const resolver = new CommandResolver(detector);
		const result = resolver.resolve({
			preferred: {pluginId: "preferred-plugin", commandId: "preferred-plugin:open"},
			fallback: {commandId: "native:open"},
		});
		expect(result.commandId).toBe("preferred-plugin:open");
		expect(result.source).toBe("preferred");
	});

	it("returns the fallback command id when the preferred plugin is not enabled", () => {
		const detector = makeDetector([]);
		const resolver = new CommandResolver(detector);
		const result = resolver.resolve({
			preferred: {pluginId: "preferred-plugin", commandId: "preferred-plugin:open"},
			fallback: {commandId: "native:open"},
		});
		expect(result.commandId).toBe("native:open");
		expect(result.source).toBe("fallback");
	});

	it("returns undefined when the preferred plugin is missing and no fallback is provided", () => {
		const detector = makeDetector([]);
		const resolver = new CommandResolver(detector);
		const result = resolver.resolve({
			preferred: {pluginId: "absent-plugin", commandId: "absent:do"},
		});
		expect(result.commandId).toBeUndefined();
		expect(result.source).toBe("none");
	});

	it("notifies a watcher when the preferred plugin toggles", () => {
		const detector = makeDetector([]) as unknown as PluginDetector & {
			_emit(id: string, enabled: boolean): void;
		};
		const resolver = new CommandResolver(detector);
		const onChange = vi.fn();
		resolver.watch(
			{
				preferred: {pluginId: "p", commandId: "p:do"},
				fallback: {commandId: "native:do"},
			},
			onChange,
		);
		expect(onChange).not.toHaveBeenCalled();
		detector._emit("p", true);
		expect(onChange).toHaveBeenCalledWith({commandId: "p:do", source: "preferred"});
		detector._emit("p", false);
		expect(onChange).toHaveBeenCalledWith({commandId: "native:do", source: "fallback"});
	});
});
