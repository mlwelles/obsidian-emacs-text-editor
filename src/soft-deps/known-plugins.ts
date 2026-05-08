/**
 * Verified plugin and command IDs for the soft-deps in this project.
 * Source of truth: docs/plans/2026-05-08-feature-implementation.md § Task V.2
 * (verified against a live Obsidian install on 2026-05-08).
 *
 * Update this file whenever a soft-dep plugin renames a command or its
 * runtime id changes.
 */

export const SWITCHER_PLUS = {
	pluginId: "darlal-switcher-plus",
	commands: {
		// Switcher++ namespaces its own commands with a "switcher-plus:" prefix
		// inside the plugin's own id, hence the doubled segments.
		commandsMode: "darlal-switcher-plus:switcher-plus:open-commands",
		editorsMode: "darlal-switcher-plus:switcher-plus:open-editors",
		fileMode: "darlal-switcher-plus:switcher-plus:open",
	},
} as const;

export const CYCLE_THROUGH_PANES = {
	// Plugin manifest renamed to "Tab Switcher"; runtime id unchanged.
	pluginId: "cycle-through-panes",
	commands: {
		cycle: "cycle-through-panes:cycle-through-panes",
		cycleReverse: "cycle-through-panes:cycle-through-panes-reverse",
	},
} as const;

export const NATIVE_FALLBACKS = {
	commandPalette: "command-palette:open",
	switcher: "switcher:open",
	editorSearch: "editor:open-search",
	editorSearchReplace: "editor:open-search-replace",
	editorSave: "editor:save-file",
	editorRevealInExplorer: "file-explorer:reveal-active-file",
	workspaceNextTab: "workspace:next-tab",
	workspaceCloseActivePane: "workspace:close",
	workspaceCloseOthers: "workspace:close-others",
	workspaceSplitHorizontal: "workspace:split-horizontal",
	workspaceSplitVertical: "workspace:split-vertical",
	workspaceOpenNewWindow: "workspace:open-new-window",
	workspaceCloseWindow: "workspace:close-window",
	editorUndo: "editor:undo",
	editorSelectAll: "editor:select-all",
	appQuit: "app:quit",
} as const;
