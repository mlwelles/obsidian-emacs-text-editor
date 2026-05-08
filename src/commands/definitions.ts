import type {Editor, MarkdownFileInfo, MarkdownView, Modifier, Plugin} from "obsidian";
import type {CommandId} from "./ids";

export interface HotkeyDef {
	modifiers: Modifier[];
	key: string;
}

export interface CommandDef {
	id: CommandId;
	name: string;
	hotkeys?: HotkeyDef[];
	editorCallback: (editor: Editor, view: MarkdownView | MarkdownFileInfo, plugin: Plugin) => void | Promise<void>;
}
