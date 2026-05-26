import {describe, expect, it, vi} from "vitest";
import {PluginDetector} from "./plugin-detector";

interface FakeApp {
	plugins: {
		enabledPlugins: Set<string>;
	};
	workspace: {
		on: (event: string, cb: (id: string) => void) => unknown;
		offref: (ref: unknown) => void;
	};
}

function makeFakeApp(initialEnabled: string[] = []): FakeApp {
	const handlers = new Map<string, Set<(id: string) => void>>();
	return {
		plugins: {enabledPlugins: new Set(initialEnabled)},
		workspace: {
			on(event, cb) {
				if (!handlers.has(event)) {
					handlers.set(event, new Set());
				}
				handlers.get(event)!.add(cb);
				const ref = {event, cb};
				return ref;
			},
			offref(ref) {
				const r = ref as {event: string; cb: (id: string) => void};
				handlers.get(r.event)?.delete(r.cb);
			},
		},
		// test helper:
		_emit(event: string, id: string) {
			handlers.get(event)?.forEach(cb => cb(id));
		},
	} as FakeApp & {_emit(event: string, id: string): void};
}

describe("PluginDetector", () => {
	it("returns true for plugins enabled at construction", () => {
		const app = makeFakeApp(["alpha", "beta"]);
		const detector = new PluginDetector(app as any);
		expect(detector.isEnabled("alpha")).toBe(true);
		expect(detector.isEnabled("beta")).toBe(true);
	});

	it("returns false for plugins not enabled", () => {
		const app = makeFakeApp(["alpha"]);
		const detector = new PluginDetector(app as any);
		expect(detector.isEnabled("beta")).toBe(false);
	});

	it("notifies subscribers when a plugin is enabled at runtime", () => {
		const app = makeFakeApp() as ReturnType<typeof makeFakeApp> & {_emit(e: string, id: string): void};
		const detector = new PluginDetector(app as any);
		const onChange = vi.fn();
		detector.subscribe("alpha", onChange);
		expect(onChange).not.toHaveBeenCalled();
		app.plugins.enabledPlugins.add("alpha");
		app._emit("plugin-enabled", "alpha");
		expect(onChange).toHaveBeenCalledWith(true);
	});

	it("notifies subscribers when a plugin is disabled at runtime", () => {
		const app = makeFakeApp(["alpha"]) as ReturnType<typeof makeFakeApp> & {_emit(e: string, id: string): void};
		const detector = new PluginDetector(app as any);
		const onChange = vi.fn();
		detector.subscribe("alpha", onChange);
		app.plugins.enabledPlugins.delete("alpha");
		app._emit("plugin-disabled", "alpha");
		expect(onChange).toHaveBeenCalledWith(false);
	});

	it("ignores events for unrelated plugins", () => {
		const app = makeFakeApp() as ReturnType<typeof makeFakeApp> & {_emit(e: string, id: string): void};
		const detector = new PluginDetector(app as any);
		const onChange = vi.fn();
		detector.subscribe("alpha", onChange);
		app._emit("plugin-enabled", "beta");
		expect(onChange).not.toHaveBeenCalled();
	});

	it("unsubscribes cleanly", () => {
		const app = makeFakeApp() as ReturnType<typeof makeFakeApp> & {_emit(e: string, id: string): void};
		const detector = new PluginDetector(app as any);
		const onChange = vi.fn();
		const unsubscribe = detector.subscribe("alpha", onChange);
		unsubscribe();
		app.plugins.enabledPlugins.add("alpha");
		app._emit("plugin-enabled", "alpha");
		expect(onChange).not.toHaveBeenCalled();
	});

	it("dispose removes all subscriptions", () => {
		const app = makeFakeApp() as ReturnType<typeof makeFakeApp> & {_emit(e: string, id: string): void};
		const detector = new PluginDetector(app as any);
		const a = vi.fn();
		const b = vi.fn();
		detector.subscribe("alpha", a);
		detector.subscribe("beta", b);
		detector.dispose();
		app._emit("plugin-enabled", "alpha");
		app._emit("plugin-enabled", "beta");
		expect(a).not.toHaveBeenCalled();
		expect(b).not.toHaveBeenCalled();
	});
});
