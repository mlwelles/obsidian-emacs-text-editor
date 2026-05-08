import type {App, EventRef} from "obsidian";

type ChangeCallback = (enabled: boolean) => void;

/**
 * Detects whether an Obsidian plugin is currently enabled and notifies
 * subscribers when its enabled/disabled state changes.
 *
 * Uses runtime APIs that are not in the published Obsidian type
 * definitions (`app.plugins.enabledPlugins`, `plugin-enabled` /
 * `plugin-disabled` workspace events). Casts through `unknown` where
 * the type system complains.
 */
export class PluginDetector {
	private subscribers = new Map<string, Set<ChangeCallback>>();
	private enabledRef: EventRef;
	private disabledRef: EventRef;

	constructor(private readonly app: App) {
		const workspace = this.app.workspace as unknown as {
			on(event: string, cb: (id: string) => void): EventRef;
		};
		this.enabledRef = workspace.on("plugin-enabled", (id: string) =>
			this.notify(id, true),
		);
		this.disabledRef = workspace.on("plugin-disabled", (id: string) =>
			this.notify(id, false),
		);
	}

	isEnabled(pluginId: string): boolean {
		const plugins = (this.app as unknown as {
			plugins: {enabledPlugins: Set<string>};
		}).plugins;
		return plugins.enabledPlugins.has(pluginId);
	}

	subscribe(pluginId: string, callback: ChangeCallback): () => void {
		let set = this.subscribers.get(pluginId);
		if (!set) {
			set = new Set();
			this.subscribers.set(pluginId, set);
		}
		set.add(callback);
		return () => {
			this.subscribers.get(pluginId)?.delete(callback);
		};
	}

	dispose(): void {
		this.subscribers.clear();
		this.app.workspace.offref(this.enabledRef);
		this.app.workspace.offref(this.disabledRef);
	}

	private notify(pluginId: string, enabled: boolean): void {
		this.subscribers.get(pluginId)?.forEach(cb => cb(enabled));
	}
}
