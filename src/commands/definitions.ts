import {MarkdownView, type Editor, type MarkdownFileInfo, type Modifier} from "obsidian";
import {COMMAND_IDS, type CommandId} from "./ids";
import type {PluginContext} from "./plugin-context";
import {Direction, moveToNextParagraph} from "../editor-ops/paragraph";
import {recenterToBottom} from "../editor-ops/recenter";
import {
	getCodeMirrorView,
	moveToVisualLineBoundary,
	withSelectionUpdate,
} from "../editor-ops/movement";
import {
	cancelSelect,
	keyboardQuit,
	killLine,
	killRegion,
	killRingSave,
	killWord,
	setMark,
	transposeChars,
	withDelete,
	withKill,
	yank,
	yankPop,
} from "../editor-ops/editing";

export interface HotkeyDef {
	modifiers: Modifier[];
	key: string;
}

export interface CommandDef {
	id: CommandId;
	name: string;
	hotkeys?: HotkeyDef[];
	editorCallback: (editor: Editor, view: MarkdownView | MarkdownFileInfo) => void | Promise<void>;
}

export function buildCommands(ctx: PluginContext): CommandDef[] {
	return [
		{
			id: COMMAND_IDS.FORWARD_CHAR,
			name: "Forward char",
			hotkeys: [{modifiers: ["Ctrl"], key: "f"}],
			editorCallback: (editor) => {
				ctx.commandInvoked(COMMAND_IDS.FORWARD_CHAR);
				withSelectionUpdate(editor, ctx.mark, ctx.logger, () => {
					editor.exec("goRight");
				});
			},
		},
		{
			id: COMMAND_IDS.BACKWARD_CHAR,
			name: "Backward char",
			hotkeys: [{modifiers: ["Ctrl"], key: "b"}],
			editorCallback: (editor) => {
				ctx.commandInvoked(COMMAND_IDS.BACKWARD_CHAR);
				withSelectionUpdate(editor, ctx.mark, ctx.logger, () => {
					editor.exec("goLeft");
				});
			},
		},
		{
			id: COMMAND_IDS.NEXT_LINE,
			name: "Next line",
			hotkeys: [{modifiers: ["Ctrl"], key: "n"}],
			editorCallback: (editor) => {
				ctx.commandInvoked(COMMAND_IDS.NEXT_LINE);
				withSelectionUpdate(editor, ctx.mark, ctx.logger, () => {
					editor.exec("goDown");
				});
			},
		},
		{
			id: COMMAND_IDS.PREVIOUS_LINE,
			name: "Previous line",
			hotkeys: [{modifiers: ["Ctrl"], key: "p"}],
			editorCallback: (editor) => {
				ctx.commandInvoked(COMMAND_IDS.PREVIOUS_LINE);
				withSelectionUpdate(editor, ctx.mark, ctx.logger, () => {
					editor.exec("goUp");
				});
			},
		},
		{
			id: COMMAND_IDS.FORWARD_WORD,
			name: "Forward word",
			hotkeys: [{modifiers: ["Alt"], key: "f"}],
			editorCallback: (editor) => {
				ctx.commandInvoked(COMMAND_IDS.FORWARD_WORD);
				withSelectionUpdate(editor, ctx.mark, ctx.logger, () => {
					editor.exec("goWordRight");
				});
			},
		},
		{
			id: COMMAND_IDS.BACKWARD_WORD,
			name: "Backward word",
			hotkeys: [{modifiers: ["Alt"], key: "b"}],
			editorCallback: (editor) => {
				ctx.commandInvoked(COMMAND_IDS.BACKWARD_WORD);
				withSelectionUpdate(editor, ctx.mark, ctx.logger, () => {
					editor.exec("goWordLeft");
				});
			},
		},
		{
			id: COMMAND_IDS.MOVE_END_OF_LINE,
			name: "Move end of line",
			hotkeys: [{modifiers: ["Ctrl"], key: "e"}],
			editorCallback: (editor, markdownView) => {
				ctx.commandInvoked(COMMAND_IDS.MOVE_END_OF_LINE);
				const view = markdownView instanceof MarkdownView ? getCodeMirrorView(markdownView) : undefined;
				if (view) {
					moveToVisualLineBoundary(editor, view, ctx.mark, true);
				} else {
					withSelectionUpdate(editor, ctx.mark, ctx.logger, () => {
						const cursor = editor.getCursor();
						const lineContent = editor.getLine(cursor.line);
						editor.setCursor({line: cursor.line, ch: lineContent.length});
					});
				}
			},
		},
		{
			id: COMMAND_IDS.MOVE_BEGINNING_OF_LINE,
			name: "Move cursor to beginning of line",
			hotkeys: [{modifiers: ["Ctrl"], key: "a"}],
			editorCallback: (editor, markdownView) => {
				ctx.commandInvoked(COMMAND_IDS.MOVE_BEGINNING_OF_LINE);
				const view = markdownView instanceof MarkdownView ? getCodeMirrorView(markdownView) : undefined;
				if (view) {
					moveToVisualLineBoundary(editor, view, ctx.mark, false);
				} else {
					withSelectionUpdate(editor, ctx.mark, ctx.logger, () => {
						const cursor = editor.getCursor();
						editor.setCursor({line: cursor.line, ch: 0});
					});
				}
			},
		},
		{
			id: COMMAND_IDS.BEGINNING_OF_BUFFER,
			name: "Beginning of buffer",
			hotkeys: [{modifiers: ["Alt", "Shift"], key: ","}],
			editorCallback: (editor) => {
				ctx.commandInvoked(COMMAND_IDS.BEGINNING_OF_BUFFER);
				withSelectionUpdate(editor, ctx.mark, ctx.logger, () => {
					editor.exec("goStart");
				});
			},
		},
		{
			id: COMMAND_IDS.END_OF_BUFFER,
			name: "End of buffer",
			hotkeys: [{modifiers: ["Alt", "Shift"], key: "."}],
			editorCallback: (editor) => {
				ctx.commandInvoked(COMMAND_IDS.END_OF_BUFFER);
				withSelectionUpdate(editor, ctx.mark, ctx.logger, () => {
					editor.exec("goEnd");
				});
			},
		},
		{
			id: COMMAND_IDS.KILL_LINE,
			name: "Kill line",
			hotkeys: [{modifiers: ["Ctrl"], key: "k"}],
			editorCallback: async (editor) => {
				ctx.commandInvoked(COMMAND_IDS.KILL_LINE);
				await killLine(editor, ctx.killCtx);
			},
		},
		{
			id: COMMAND_IDS.DELETE_CHAR,
			name: "Delete char",
			hotkeys: [{modifiers: ["Ctrl"], key: "d"}],
			editorCallback: async (editor) => {
				ctx.commandInvoked(COMMAND_IDS.DELETE_CHAR);
				await withDelete(editor, ctx.killCtx, () => {
					editor.exec("goRight");
				});
			},
		},
		{
			id: COMMAND_IDS.KILL_WORD,
			name: "Kill word",
			hotkeys: [{modifiers: ["Alt"], key: "d"}],
			editorCallback: async (editor) => {
				ctx.commandInvoked(COMMAND_IDS.KILL_WORD);
				await killWord(editor, ctx.killCtx);
			},
		},
		{
			id: COMMAND_IDS.BACKWARD_KILL_WORD,
			name: "Backward kill word",
			hotkeys: [{modifiers: ["Alt"], key: "Backspace"}],
			editorCallback: async (editor) => {
				ctx.commandInvoked(COMMAND_IDS.BACKWARD_KILL_WORD);
				await withKill(editor, ctx.killCtx, () => {
					editor.exec("goWordLeft");
				});
			},
		},
		{
			id: COMMAND_IDS.KILL_RING_SAVE,
			name: "Kill ring save",
			hotkeys: [{modifiers: ["Alt"], key: "w"}],
			editorCallback: async (editor) => {
				ctx.commandInvoked(COMMAND_IDS.KILL_RING_SAVE);
				if (!ctx.mark.isActive()) {
					return;
				}
				await killRingSave(editor.getSelection(), ctx.killCtx);
				cancelSelect(editor, ctx.killCtx);
			},
		},
		{
			id: COMMAND_IDS.KILL_REGION,
			name: "Kill region",
			hotkeys: [{modifiers: ["Ctrl"], key: "w"}],
			editorCallback: async (editor) => {
				ctx.commandInvoked(COMMAND_IDS.KILL_REGION);
				await killRegion(editor, ctx.killCtx);
			},
		},
		{
			id: COMMAND_IDS.YANK,
			name: "Yank",
			hotkeys: [{modifiers: ["Ctrl"], key: "y"}],
			editorCallback: async (editor) => {
				ctx.commandInvoked(COMMAND_IDS.YANK);
				await yank(editor, ctx.killCtx);
			},
		},
		{
			id: COMMAND_IDS.YANK_POP,
			name: "Yank Pop",
			hotkeys: [{modifiers: ["Alt"], key: "y"}],
			editorCallback: async (editor) => {
				ctx.commandInvoked(COMMAND_IDS.YANK_POP);
				await yankPop(editor, ctx.killCtx);
			},
		},
		{
			id: COMMAND_IDS.SET_MARK_COMMAND,
			name: "Set mark command",
			hotkeys: [{modifiers: ["Ctrl"], key: " "}],
			editorCallback: (editor) => {
				ctx.commandInvoked(COMMAND_IDS.SET_MARK_COMMAND);
				setMark(editor, ctx.killCtx);
			},
		},
		{
			id: COMMAND_IDS.MARK_WHOLE_BUFFER,
			name: "Mark whole buffer",
			editorCallback: (editor) => {
				ctx.commandInvoked(COMMAND_IDS.MARK_WHOLE_BUFFER);
				const lastLine = editor.lineCount() - 1;
				const bufferStart = {line: 0, ch: 0};
				const bufferEnd = {line: lastLine, ch: editor.getLine(lastLine).length};
				ctx.mark.set(bufferStart);
				editor.setSelection(bufferStart, bufferEnd);
			},
		},
		{
			id: COMMAND_IDS.KEYBOARD_QUIT,
			name: "Keyboard-quit",
			hotkeys: [{modifiers: ["Ctrl"], key: "g"}],
			editorCallback: (editor) => {
				ctx.commandInvoked(COMMAND_IDS.KEYBOARD_QUIT);
				keyboardQuit(editor, ctx.killCtx);
			},
		},
		{
			id: COMMAND_IDS.UNDO,
			name: "Undo",
			hotkeys: [{modifiers: ["Ctrl", "Shift"], key: "-"}, {modifiers: ["Ctrl"], key: "/"}],
			editorCallback: (editor) => {
				ctx.commandInvoked(COMMAND_IDS.UNDO);
				editor.undo();
			},
		},
		{
			id: COMMAND_IDS.REDO,
			name: "Redo",
			hotkeys: [{modifiers: ["Ctrl", "Shift", "Alt"], key: "-"}, {modifiers: ["Ctrl", "Shift"], key: "/"}],
			editorCallback: (editor) => {
				ctx.commandInvoked(COMMAND_IDS.REDO);
				editor.redo();
			},
		},
		{
			id: COMMAND_IDS.RECENTER_TOP_BOTTOM,
			name: "Recenter",
			hotkeys: [{modifiers: ["Ctrl"], key: "l"}],
			editorCallback: (editor) => {
				ctx.commandInvoked(COMMAND_IDS.RECENTER_TOP_BOTTOM);
				recenterToBottom(editor);
			},
		},
		{
			id: COMMAND_IDS.TRANSPOSE_CHARS,
			name: "Transpose chars",
			editorCallback: (editor) => {
				ctx.commandInvoked(COMMAND_IDS.TRANSPOSE_CHARS);
				transposeChars(editor, ctx.killCtx);
			},
		},
		{
			id: COMMAND_IDS.FORWARD_PARAGRAPH,
			name: "Forward paragraph",
			hotkeys: [{modifiers: ["Alt", "Shift"], key: "]"}],
			editorCallback: (editor) => {
				ctx.commandInvoked(COMMAND_IDS.FORWARD_PARAGRAPH);
				withSelectionUpdate(editor, ctx.mark, ctx.logger, () => {
					moveToNextParagraph(editor, Direction.Forward);
				});
			},
		},
		{
			id: COMMAND_IDS.BACKWARD_PARAGRAPH,
			name: "Backward paragraph",
			hotkeys: [{modifiers: ["Alt", "Shift"], key: "["}],
			editorCallback: (editor) => {
				ctx.commandInvoked(COMMAND_IDS.BACKWARD_PARAGRAPH);
				withSelectionUpdate(editor, ctx.mark, ctx.logger, () => {
					moveToNextParagraph(editor, Direction.Backward);
				});
			},
		},
	];
}
