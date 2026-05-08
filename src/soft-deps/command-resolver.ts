import type {PluginDetector} from "./plugin-detector";

export interface PreferredCommand {
	pluginId: string;
	commandId: string;
}

export interface FallbackCommand {
	commandId: string;
}

export interface ResolveSpec {
	preferred: PreferredCommand;
	fallback?: FallbackCommand;
}

export interface ResolvedCommand {
	commandId: string | undefined;
	source: "preferred" | "fallback" | "none";
}

/**
 * Resolves a (preferred, fallback) command pair against the live plugin
 * state exposed by `PluginDetector`. Callers can also `watch(...)` a spec
 * and receive a freshly-resolved command whenever the preferred plugin is
 * enabled or disabled, so hotkeys can be re-registered without an
 * Obsidian reload.
 */
export class CommandResolver {
	constructor(private readonly detector: PluginDetector) {}

	resolve(spec: ResolveSpec): ResolvedCommand {
		return this.resolveWith(spec, this.detector.isEnabled(spec.preferred.pluginId));
	}

	watch(spec: ResolveSpec, callback: (resolved: ResolvedCommand) => void): () => void {
		return this.detector.subscribe(spec.preferred.pluginId, enabled => {
			callback(this.resolveWith(spec, enabled));
		});
	}

	private resolveWith(spec: ResolveSpec, preferredEnabled: boolean): ResolvedCommand {
		if (preferredEnabled) {
			return {commandId: spec.preferred.commandId, source: "preferred"};
		}
		if (spec.fallback) {
			return {commandId: spec.fallback.commandId, source: "fallback"};
		}
		return {commandId: undefined, source: "none"};
	}
}
