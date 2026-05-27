import type {Plugin} from "obsidian";
import type {CommandResolver} from "../soft-deps/command-resolver";
import {SWITCHER_PLUS, NATIVE_FALLBACKS} from "../soft-deps/known-plugins";

// Obsidian's public typings don't expose `app.commands.executeCommandById`,
// but it has been a stable runtime API for years and the rest of the plugin
// ecosystem depends on it. Narrow the cast to this single shape.
interface AppWithCommands {
	commands: {
		executeCommandById(id: string): boolean;
	};
}

function exec(plugin: Plugin, commandId: string): void {
	(plugin.app as unknown as AppWithCommands).commands.executeCommandById(commandId);
}

/**
 * Registers Layer-3a single-chord global aliases:
 *   M-x  -> command palette (Switcher++ commands mode if enabled)
 *   C-s  -> editor:open-search
 *   C-r  -> editor:open-search (Obsidian has no distinct reverse-isearch UI)
 *   M-%  -> editor:open-search-replace
 *   C-g  -> workspace-level keyboard-quit (blur + Escape)
 *
 * C-g collision note: Layer 1's `keyboard-quit` is registered with
 * `editorCallback`, so Obsidian only invokes it when the markdown editor is
 * focused. When focus is anywhere else (a modal, a sidebar input, the
 * frontmatter editor, etc.) Obsidian falls through to this workspace-scoped
 * variant.
 */
export function registerWorkspaceSingleChords(
	plugin: Plugin,
	resolver: CommandResolver,
): void {
	plugin.addCommand({
		id: "workspace-mx",
		name: "M-x (Execute extended command)",
		hotkeys: [{modifiers: ["Alt"], key: "x"}],
		callback: () => {
			const resolved = resolver.resolve({
				preferred: {
					pluginId: SWITCHER_PLUS.pluginId,
					commandId: SWITCHER_PLUS.commands.commandsMode,
				},
				fallback: {commandId: NATIVE_FALLBACKS.commandPalette},
			});
			if (resolved.commandId) {
				exec(plugin, resolved.commandId);
			}
		},
	});

	plugin.addCommand({
		id: "workspace-cs",
		name: "C-s (Search)",
		hotkeys: [{modifiers: ["Ctrl"], key: "s"}],
		callback: () => {
			exec(plugin, NATIVE_FALLBACKS.editorSearch);
		},
	});

	plugin.addCommand({
		id: "workspace-cr",
		name: "C-r (Search reverse, same UI as C-s)",
		hotkeys: [{modifiers: ["Ctrl"], key: "r"}],
		callback: () => {
			exec(plugin, NATIVE_FALLBACKS.editorSearch);
		},
	});

	plugin.addCommand({
		id: "workspace-m-percent",
		name: "M-% (Query replace)",
		hotkeys: [{modifiers: ["Alt", "Shift"], key: "5"}],
		callback: () => {
			exec(plugin, NATIVE_FALLBACKS.editorSearchReplace);
		},
	});

	plugin.addCommand({
		id: "workspace-cg",
		name: "C-g (Keyboard quit at workspace level)",
		hotkeys: [{modifiers: ["Ctrl"], key: "g"}],
		callback: () => {
			// Send Escape to the focused element to close modals / clear selections.
			const focused = document.activeElement as HTMLElement | null;
			focused?.blur();
			document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape"}));
		},
	});
}
