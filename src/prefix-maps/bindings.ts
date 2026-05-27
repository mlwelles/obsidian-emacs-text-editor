import type {Plugin} from "obsidian";
import type {CommandResolver} from "../soft-deps/command-resolver";
import {SWITCHER_PLUS, CYCLE_THROUGH_PANES, NATIVE_FALLBACKS} from "../soft-deps/known-plugins";
import type {PrefixMap} from "./dispatcher";

export const COMMAND_IDS = {
	SAVE_BUFFER: "save-buffer",
	FIND_FILE: "find-file",
	REVEAL_IN_EXPLORER: "reveal-in-explorer",
	SWITCH_BUFFER: "switch-buffer",
	CLOSE_PANE: "close-pane",
	CLOSE_OTHER_PANES: "close-other-panes",
	SPLIT_HORIZONTAL: "split-horizontal",
	SPLIT_VERTICAL: "split-vertical",
	OTHER_WINDOW: "other-window",
	MARK_WHOLE_BUFFER: "select-all",
	UNDO_PREFIX: "undo",
	OPEN_NEW_WINDOW: "open-new-window",
	CLOSE_WINDOW: "close-window",
	QUIT_APP: "quit-app",
} as const;

export type EmacsCommandId = typeof COMMAND_IDS[keyof typeof COMMAND_IDS];

// Local interface for app.commands.executeCommandById which isn't in
// the published Obsidian type definitions.
interface AppWithCommands {
	commands: {
		executeCommandById: (id: string) => unknown;
	};
}

function exec(plugin: Plugin, id: string): void {
	(plugin.app as unknown as AppWithCommands).commands.executeCommandById(id);
}

interface CommandSpec {
	id: EmacsCommandId;
	name: string;
	dispatch: (plugin: Plugin, resolver: CommandResolver) => void;
}

const COMMAND_SPECS: CommandSpec[] = [
	{
		id: COMMAND_IDS.SAVE_BUFFER,
		name: "Save buffer (C-x C-s)",
		dispatch: (p) => exec(p, NATIVE_FALLBACKS.editorSave),
	},
	{
		id: COMMAND_IDS.FIND_FILE,
		name: "Find file (C-x C-f)",
		dispatch: (p, r) => {
			const resolved = r.resolve({
				preferred: {pluginId: SWITCHER_PLUS.pluginId, commandId: SWITCHER_PLUS.commands.fileMode},
				fallback: {commandId: NATIVE_FALLBACKS.switcher},
			});
			if (resolved.commandId) exec(p, resolved.commandId);
		},
	},
	{
		id: COMMAND_IDS.REVEAL_IN_EXPLORER,
		name: "Reveal active file in explorer (C-x d)",
		dispatch: (p) => exec(p, NATIVE_FALLBACKS.editorRevealInExplorer),
	},
	{
		id: COMMAND_IDS.SWITCH_BUFFER,
		name: "Switch buffer (C-x b)",
		dispatch: (p, r) => {
			const resolved = r.resolve({
				preferred: {pluginId: SWITCHER_PLUS.pluginId, commandId: SWITCHER_PLUS.commands.editorsMode},
				fallback: {commandId: NATIVE_FALLBACKS.switcher},
			});
			if (resolved.commandId) exec(p, resolved.commandId);
		},
	},
	{
		id: COMMAND_IDS.CLOSE_PANE,
		name: "Close pane (C-x 0 / C-x k)",
		dispatch: (p) => exec(p, NATIVE_FALLBACKS.workspaceCloseActivePane),
	},
	{
		id: COMMAND_IDS.CLOSE_OTHER_PANES,
		name: "Close other panes (C-x 1)",
		dispatch: (p) => exec(p, NATIVE_FALLBACKS.workspaceCloseOthers),
	},
	{
		id: COMMAND_IDS.SPLIT_HORIZONTAL,
		name: "Split horizontal (C-x 2)",
		dispatch: (p) => exec(p, NATIVE_FALLBACKS.workspaceSplitHorizontal),
	},
	{
		id: COMMAND_IDS.SPLIT_VERTICAL,
		name: "Split vertical (C-x 3)",
		dispatch: (p) => exec(p, NATIVE_FALLBACKS.workspaceSplitVertical),
	},
	{
		id: COMMAND_IDS.OTHER_WINDOW,
		name: "Other window (C-x o)",
		dispatch: (p, r) => {
			const resolved = r.resolve({
				preferred: {
					pluginId: CYCLE_THROUGH_PANES.pluginId,
					commandId: CYCLE_THROUGH_PANES.commands.cycle,
				},
				fallback: {commandId: NATIVE_FALLBACKS.workspaceNextTab},
			});
			if (resolved.commandId) exec(p, resolved.commandId);
		},
	},
	{
		id: COMMAND_IDS.MARK_WHOLE_BUFFER,
		name: "Select all (C-x h)",
		dispatch: (p) => exec(p, NATIVE_FALLBACKS.editorSelectAll),
	},
	{
		id: COMMAND_IDS.UNDO_PREFIX,
		name: "Undo prefix (C-x u)",
		dispatch: (p) => exec(p, NATIVE_FALLBACKS.editorUndo),
	},
	{
		id: COMMAND_IDS.OPEN_NEW_WINDOW,
		name: "Open new window (C-x 5 2)",
		dispatch: (p) => exec(p, NATIVE_FALLBACKS.workspaceOpenNewWindow),
	},
	{
		id: COMMAND_IDS.CLOSE_WINDOW,
		name: "Close window (C-x 5 0)",
		dispatch: (p) => exec(p, NATIVE_FALLBACKS.workspaceCloseWindow),
	},
	{
		id: COMMAND_IDS.QUIT_APP,
		name: "Quit Obsidian (C-x C-c)",
		dispatch: (p) => exec(p, NATIVE_FALLBACKS.appQuit),
	},
];

/**
 * Registers each emacs:* command as an Obsidian addCommand with no
 * default hotkey. The PrefixDispatcher delivers them when the user
 * presses C-x ... sequences. Users can also bind these manually via
 * Obsidian's Hotkeys settings if they prefer different chords.
 *
 * Returns a Map from full command id ("emacs:save-buffer" etc.) to
 * the action callback, consumed by buildCxPrefixMap().
 */
export function registerPrefixCommands(plugin: Plugin, resolver: CommandResolver): Map<string, () => void> {
	const handles = new Map<string, () => void>();
	for (const spec of COMMAND_SPECS) {
		const fullId = "emacs:" + spec.id;
		const callback = () => spec.dispatch(plugin, resolver);
		plugin.addCommand({
			id: spec.id, // Obsidian prepends the manifest id automatically
			name: spec.name,
			callback,
		});
		handles.set(fullId, callback);
	}
	return handles;
}

export function buildCxPrefixMap(handles: Map<string, () => void>): PrefixMap {
	const get = (id: string): (() => void) => {
		const fn = handles.get("emacs:" + id);
		if (!fn) throw new Error("missing emacs command: " + id);
		return fn;
	};
	return {
		prefix: {ctrl: true, key: "x"},
		bindings: [
			{chord: {ctrl: true, key: "s"}, action: get(COMMAND_IDS.SAVE_BUFFER)},
			{chord: {ctrl: true, key: "f"}, action: get(COMMAND_IDS.FIND_FILE)},
			{chord: {key: "d"}, action: get(COMMAND_IDS.REVEAL_IN_EXPLORER)},
			{chord: {key: "b"}, action: get(COMMAND_IDS.SWITCH_BUFFER)},
			{chord: {key: "k"}, action: get(COMMAND_IDS.CLOSE_PANE)},
			{chord: {key: "0"}, action: get(COMMAND_IDS.CLOSE_PANE)},
			{chord: {key: "1"}, action: get(COMMAND_IDS.CLOSE_OTHER_PANES)},
			{chord: {key: "2"}, action: get(COMMAND_IDS.SPLIT_HORIZONTAL)},
			{chord: {key: "3"}, action: get(COMMAND_IDS.SPLIT_VERTICAL)},
			{chord: {key: "o"}, action: get(COMMAND_IDS.OTHER_WINDOW)},
			{chord: {key: "h"}, action: get(COMMAND_IDS.MARK_WHOLE_BUFFER)},
			{chord: {key: "u"}, action: get(COMMAND_IDS.UNDO_PREFIX)},
			{
				chord: {key: "5"},
				subBindings: [
					{chord: {key: "2"}, action: get(COMMAND_IDS.OPEN_NEW_WINDOW)},
					{chord: {key: "0"}, action: get(COMMAND_IDS.CLOSE_WINDOW)},
				],
			},
			{chord: {ctrl: true, key: "c"}, action: get(COMMAND_IDS.QUIT_APP)},
		],
	};
}
