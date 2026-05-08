import type {Plugin} from "obsidian";
import type {CommandDef} from "./definitions";

export function registerCommands(plugin: Plugin, commands: CommandDef[]): void {
	for (const cmd of commands) {
		plugin.addCommand({
			id: cmd.id,
			name: cmd.name,
			hotkeys: cmd.hotkeys,
			editorCallback: (editor, view) => cmd.editorCallback(editor, view, plugin),
		});
	}
}
