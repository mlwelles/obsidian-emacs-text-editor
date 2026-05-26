import type {Editor} from "obsidian";

export function recenterToBottom(editor: Editor): void {
	const cursor = editor.getCursor();
	editor.scrollIntoView(
		{from: {line: cursor.line, ch: cursor.ch}, to: {line: cursor.line, ch: cursor.ch}},
		true,
	);
}
