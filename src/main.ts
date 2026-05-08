import {Editor, EditorPosition, MarkdownView, Plugin} from "obsidian";
import {EditorView} from "@codemirror/view";
import {EditorSelection} from "@codemirror/state";
import {createLogger, Logger} from "./log";
import {
	COMMAND_IDS,
	COMMANDS_THAT_EXTEND_LAST_KILL_BACKWARD,
	COMMANDS_THAT_EXTEND_LAST_KILL_FORWARD,
	type CommandId,
} from "./commands/ids";
import type {CommandDef} from "./commands/definitions";
import {registerCommands} from "./commands/register";
import {KillRing} from "./kill-ring/kill-ring";

type MarkdownViewWithCM = MarkdownView & { editor?: { cm?: EditorView } };

enum Direction {
	Forward, Backward
}

export default class EmacsTextEditorPlugin extends Plugin {
	// toggle to enable debug logging
	debugEnabled = false
	private logger: Logger = createLogger("emacs-text-editor", () => this.debugEnabled);
	extendLastKill = false
	extendLastKillBackwards = false
	private readonly killRing = new KillRing(120);
	lastCommandInvoked?: CommandId = undefined
	yankEnd?: EditorPosition = undefined
	// TODO: Consider possibility migrate to native selection mechanism
	selectFrom?: EditorPosition = undefined
	yankStart?: EditorPosition = undefined

	onload() {
		console.log("loading plugin: Emacs text editor");
		// Any mousedown anywhere cancels mark-mode and yank-pop session,
		// matching emacs (where keyboardQuit does both) and Obsidian's
		// own selection-cancel behavior. Cheap no-op when neither is active.
		this.registerDomEvent(document, "mousedown", () => {
			this.cancelYankPop();
			this.selectFrom = undefined;
		});
		registerCommands(this, buildCommands(this));
	}

	commandInvoked(id: CommandId) {
		this.logger.debug("command invoked: " + id)
		if (id !== COMMAND_IDS.YANK_POP) {
			this.cancelYankPop()
		}
		const isRepeat = this.lastCommandInvoked === id
		this.extendLastKill = isRepeat && COMMANDS_THAT_EXTEND_LAST_KILL_FORWARD.has(id)
		this.extendLastKillBackwards = isRepeat && COMMANDS_THAT_EXTEND_LAST_KILL_BACKWARD.has(id)
		this.lastCommandInvoked = id
	}

	onunload() {
		console.log('unloading plugin: Emacs text editor');
	}

	withSelectionUpdate(editor: Editor, callback: () => void) {
		if (this.selectFrom !== undefined) {
			editor.setSelection(editor.getCursor())
		}

		callback()

		this.extendSelection(editor)
	}

	extendSelection(editor: Editor) {
		if (this.selectFrom === undefined) {
			return
		}
		const start = this.selectFrom
		const end = editor.getCursor()
		this.logger.debug("extending selection to cursor at " + JSON.stringify(end))
		editor.setSelection(start, end)
		this.logger.debug("selection is now from " + JSON.stringify(start) + " to " + JSON.stringify(end))
		this.logger.debug("selected text: " + editor.getSelection())
	}

	async withDelete(editor: Editor, callback: () => void) {
		const cursorBefore = editor.getCursor()
		callback()
		const cursorAfter = editor.getCursor()
		editor.setSelection(cursorBefore, cursorAfter)
		this.logger.debug("set selection from " + cursorBefore + " to " + cursorAfter + ", selected text: " + editor.getSelection())
		this.logger.debug("seplacing selection with empty string")
		editor.replaceSelection("")
		this.cancelSelect(editor)
	}


	async killRingSave(text: string) {
		this.killRing.save(text, {
			extendForward: this.extendLastKill,
			extendBackward: this.extendLastKillBackwards,
		});
		const stored = this.killRing.current();
		if (stored === undefined) {
			return;
		}
		const clipboardText = await navigator.clipboard.readText();
		if (clipboardText === stored) {
			return;
		}
		await navigator.clipboard.writeText(stored);
		this.logger.debug("wrote text to navigator clipboard: " + stored);
	}

	cancelSelect(editor: Editor) {
		this.logger.debug("clearing selection")
		editor.setSelection(editor.getCursor(), editor.getCursor());
		this.selectFrom = undefined;
	}

	selectionIsActive(): boolean {
		return (this.selectFrom !== undefined)
	}

	async withKill(editor: Editor, callback: () => void) {
		this.withSelect(editor, callback)
		await this.replaceSelectedText(editor, "", true)
	}

	async replaceSelectedText(editor: Editor, text = "", save = true) {
		if (!this.selectionIsActive()) {
			return;
		}
		this.logger.debug("replacing selected text")
		if (!text) {
			text = ""
		}
		if (save) {
			const selectedText = editor.getSelection()
			this.logger.debug("saving selected text to kill ring: " + selectedText)
			await this.killRingSave(selectedText)
		}
		editor.replaceSelection(text);
		this.logger.debug("replaced selected text with '" + text + "'")
		this.cancelSelect(editor);
	}

	withSelect(editor: Editor, callback: () => void) {
		this.cancelSelect(editor);
		const start = editor.getCursor();
		this.selectFrom = start
		callback();
		const end = editor.getCursor();
		this.logger.debug("selecting text from " + JSON.stringify(start) + " to " + JSON.stringify(end))
		editor.setSelection(start, end);
		this.logger.debug("selected text is now: " + editor.getSelection())

	}

	async killWord(editor: Editor) {
		this.cancelSelect(editor);
		await this.withKill(editor, () => {
			editor.exec("goWordRight");
		});
	}

	async killLine(editor: Editor) {
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);
		this.logger.debug("kill-line - line is '" + line + "'")
		if (line === '') {
			await this.withKill(editor, () => {
				editor.exec("goRight")
			})
			return
		}
		this.logger.debug("kill-line - cursor is " + JSON.stringify(cursor))
		const textToBeRetained = line.slice(0, cursor.ch);
		const textToBeCut = line.slice(cursor.ch);
		await this.killRingSave(textToBeCut)
		this.logger.debug("kill-line - setting line " + cursor.line + " to '" + textToBeRetained + "'")
		editor.setLine(cursor.line, textToBeRetained);
		editor.setCursor(cursor, cursor.ch);
	}

	async killRegion(editor: Editor) {
		await this.replaceSelectedText(editor, "", true)
	}

	async yank(editor: Editor) {
		this.logger.debug("started yank")
		this.cancelYankPop();
		const clipboardText = await navigator.clipboard.readText();
		const yankText = this.killRing.current()
		if (yankText !== clipboardText) {
			await this.killRingSave(clipboardText)
		}
		const position = editor.getCursor();
		if (!this.selectionIsActive()) {
			this.logger.debug("inserting text at position " + position + ": " + clipboardText)
			editor.replaceRange(clipboardText, position);
		} else {
			this.logger.debug("replacing selection with: " + clipboardText)
			editor.replaceSelection(clipboardText);
			this.cancelSelect(editor);
		}
		this.yankStart = position;
		editor.setCursor(this.yankStart.line, this.yankStart.ch + clipboardText.length);
		this.yankEnd = editor.getCursor()
		this.logger.debug("yanked '" + yankText + "'")
	}

	cancelYankPop() {
		this.yankStart = undefined;
		this.yankEnd = undefined;
		this.logger.debug("yank pop stopped")
	}

	async yankPop(editor: Editor) {
		this.logger.debug("yank pop started")
		if (this.yankStart === undefined || this.yankEnd === undefined) {
			this.logger.debug("can't yank pop")
			return;
		}
		const yankPopText = this.killRing.rotate();
		if (yankPopText === undefined) {
			return;
		}
		this.logger.debug("yank pop text: " + yankPopText)
		this.cancelSelect(editor);
		editor.setSelection(this.yankStart, this.yankEnd)
		editor.replaceSelection(yankPopText);
		editor.setCursor(this.yankStart.line, this.yankStart.ch + yankPopText.length);
		this.yankEnd = editor.getCursor()
		this.logger.debug("yank popped '" + yankPopText + "'")
	}

	setMark(editor: Editor) {
		/*  start new selection from cursor if already started */
		if (this.selectionIsActive()) {
			this.cancelSelect(editor);
		}
		this.selectFrom = editor.getCursor();
		this.logger.debug("selection start is now " + this.selectFrom)
	}

	keyboardQuit(editor: Editor) {
		this.cancelYankPop();
		this.cancelSelect(editor)
	}

	recenterToBottom(editor: Editor) {
		const cursor = editor.getCursor();
		const range = {
			from: {line: cursor.line, ch: cursor.ch}, to: {line: cursor.line, ch: cursor.ch}
		};
		editor.scrollIntoView(range, true);
	}

	moveToNextParagraph(editor: Editor, direction: Direction) {
		const cursor = editor.getCursor();
		const value = editor.getValue();
		const maxOffset = value.length;
		const currentOffset = editor.posToOffset(cursor);

		if ((direction === Direction.Forward && currentOffset >= maxOffset) || (direction === Direction.Backward && currentOffset === 0)) {
			return;
		}

		let nextParagraphOffset = direction === Direction.Forward ? maxOffset : 0;
		let foundText = false;
		let foundFirstBreak = false;

		function isNewLine(position: number, direction: Direction): boolean {
			if (direction === Direction.Forward) {
				return value[position] === "\n" || (value[position] === "\r" && value[position + 1] === "\n");
			} else {
				return value[position] === "\n" || (position > 0 && value[position - 1] === "\r" && value[position] === "\n");
			}
		}

		const step = direction === Direction.Forward ? 1 : -1;
		let i = currentOffset;

		while ((direction === Direction.Forward && i < maxOffset) || (direction === Direction.Backward && i > 0)) {
			if (foundText && isNewLine(i, direction)) {
				if (foundFirstBreak) {
					nextParagraphOffset = direction === Direction.Forward ? i : i + 1;
					if ((direction === Direction.Forward && value[i] === "\r") || (direction === Direction.Backward && i > 0 && value[i - 1] === "\r")) {
						nextParagraphOffset += direction === Direction.Forward ? 1 : -1;
					}
					break;
				} else {
					foundFirstBreak = true;
					i += step;
					continue;
				}
			} else {
				foundFirstBreak = false;
			}

			if (value[i] !== "\n" && value[i] !== "\r" && value[i] !== " ") {
				foundText = true;
			}

			i += step;
		}

		const newPos = editor.offsetToPos(nextParagraphOffset);
		editor.setCursor(newPos);
	}

	// TODO Task 1.8: revisit visibility after editor-ops extraction.
	transposeChars(editor: Editor) {
		this.cancelSelect(editor);
		const cursor = editor.getCursor();
		const line = editor.getLine(cursor.line);
		if (line.length < 2 || cursor.ch === 0) {
			return;
		}
		const swapRightIndex = cursor.ch < line.length ? cursor.ch : line.length - 1;
		const swapLeftIndex = swapRightIndex - 1;
		const transposedLine =
			line.slice(0, swapLeftIndex) +
			line[swapRightIndex] +
			line[swapLeftIndex] +
			line.slice(swapRightIndex + 1);
		editor.replaceRange(
			transposedLine,
			{line: cursor.line, ch: 0},
			{line: cursor.line, ch: line.length},
		);
		editor.setCursor({
			line: cursor.line,
			ch: Math.min(swapRightIndex + 1, transposedLine.length),
		});
	}

	// MarkdownView.editor.cm is undocumented Obsidian internals exposing the
	// underlying CodeMirror 6 EditorView. If a future Obsidian release changes
	// this shape, the optional-chained access returns undefined and callers
	// fall back to the logical-line path.
	// TODO Task 1.8: revisit visibility after editor-ops extraction.
	getCodeMirrorView(markdownView: MarkdownView): EditorView | undefined {
		return (markdownView as MarkdownViewWithCM).editor?.cm;
	}

	// TODO Task 1.8: revisit visibility after editor-ops extraction.
	moveToVisualLineBoundary(editor: Editor, view: EditorView, forward: boolean) {
		const cmSelection = view.state.selection.main;
		const headCursor = EditorSelection.cursor(cmSelection.head, cmSelection.assoc);
		const newRange = view.moveToLineBoundary(headCursor, forward);
		const newPos = editor.offsetToPos(newRange.head);
		if (this.selectFrom !== undefined) {
			editor.setSelection(this.selectFrom, newPos);
		} else {
			editor.setCursor(newPos);
		}
	}

}

function buildCommands(plugin: EmacsTextEditorPlugin): CommandDef[] {
	return [
		{
			id: COMMAND_IDS.FORWARD_CHAR,
			name: "Forward char",
			hotkeys: [{modifiers: ["Ctrl"], key: "f"}],
			editorCallback: (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.FORWARD_CHAR);
				ep.withSelectionUpdate(editor, () => {
					ep.cancelYankPop();
					editor.exec("goRight");
				});
			},
		},
		{
			id: COMMAND_IDS.BACKWARD_CHAR,
			name: "Backward char",
			hotkeys: [{modifiers: ["Ctrl"], key: "b"}],
			editorCallback: (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.BACKWARD_CHAR);
				ep.withSelectionUpdate(editor, () => {
					editor.exec("goLeft");
				});
			},
		},
		{
			id: COMMAND_IDS.NEXT_LINE,
			name: "Next line",
			hotkeys: [{modifiers: ["Ctrl"], key: "n"}],
			editorCallback: (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.NEXT_LINE);
				ep.withSelectionUpdate(editor, () => {
					editor.exec("goDown");
				});
			},
		},
		{
			id: COMMAND_IDS.PREVIOUS_LINE,
			name: "Previous line",
			hotkeys: [{modifiers: ["Ctrl"], key: "p"}],
			editorCallback: (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.PREVIOUS_LINE);
				ep.withSelectionUpdate(editor, () => {
					editor.exec("goUp");
				});
			},
		},
		{
			id: COMMAND_IDS.FORWARD_WORD,
			name: "Forward word",
			hotkeys: [{modifiers: ["Alt"], key: "f"}],
			editorCallback: (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.FORWARD_WORD);
				ep.withSelectionUpdate(editor, () => {
					editor.exec("goWordRight");
				});
			},
		},
		{
			id: COMMAND_IDS.BACKWARD_WORD,
			name: "Backward word",
			hotkeys: [{modifiers: ["Alt"], key: "b"}],
			editorCallback: (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.BACKWARD_WORD);
				ep.withSelectionUpdate(editor, () => {
					editor.exec("goWordLeft");
				});
			},
		},
		{
			id: COMMAND_IDS.MOVE_END_OF_LINE,
			name: "Move end of line",
			hotkeys: [{modifiers: ["Ctrl"], key: "e"}],
			editorCallback: (editor, markdownView, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.MOVE_END_OF_LINE);
				const view = ep.getCodeMirrorView(markdownView as MarkdownView);
				if (view) {
					ep.moveToVisualLineBoundary(editor, view, true);
				} else {
					ep.withSelectionUpdate(editor, () => {
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
			editorCallback: (editor, markdownView, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.MOVE_BEGINNING_OF_LINE);
				const view = ep.getCodeMirrorView(markdownView as MarkdownView);
				if (view) {
					ep.moveToVisualLineBoundary(editor, view, false);
				} else {
					ep.withSelectionUpdate(editor, () => {
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
			editorCallback: (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.BEGINNING_OF_BUFFER);
				ep.withSelectionUpdate(editor, () => {
					editor.exec("goStart");
				});
			},
		},
		{
			id: COMMAND_IDS.END_OF_BUFFER,
			name: "End of buffer",
			hotkeys: [{modifiers: ["Alt", "Shift"], key: "."}],
			editorCallback: (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.END_OF_BUFFER);
				ep.withSelectionUpdate(editor, () => {
					editor.exec("goEnd");
				});
			},
		},
		{
			id: COMMAND_IDS.KILL_LINE,
			name: "Kill line",
			hotkeys: [{modifiers: ["Ctrl"], key: "k"}],
			editorCallback: async (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.KILL_LINE);
				await ep.killLine(editor);
			},
		},
		{
			id: COMMAND_IDS.DELETE_CHAR,
			name: "Delete char",
			hotkeys: [{modifiers: ["Ctrl"], key: "d"}],
			editorCallback: async (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.DELETE_CHAR);
				await ep.withDelete(editor, () => {
					editor.exec("goRight");
				});
			},
		},
		{
			id: COMMAND_IDS.KILL_WORD,
			name: "Kill word",
			hotkeys: [{modifiers: ["Alt"], key: "d"}],
			editorCallback: async (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.KILL_WORD);
				await ep.withKill(editor, () => {
					editor.exec("goWordRight");
				});
			},
		},
		{
			id: COMMAND_IDS.BACKWARD_KILL_WORD,
			name: "Backward kill word",
			hotkeys: [{modifiers: ["Alt"], key: "Backspace"}],
			editorCallback: async (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.BACKWARD_KILL_WORD);
				await ep.withKill(editor, () => {
					editor.exec("goWordLeft");
				});
			},
		},
		{
			id: COMMAND_IDS.KILL_RING_SAVE,
			name: "Kill ring save",
			hotkeys: [{modifiers: ["Alt"], key: "w"}],
			editorCallback: async (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.KILL_RING_SAVE);
				if (!ep.selectionIsActive()) {
					return;
				}
				await ep.killRingSave(editor.getSelection());
				ep.cancelSelect(editor);
			},
		},
		{
			id: COMMAND_IDS.KILL_REGION,
			name: "Kill region",
			hotkeys: [{modifiers: ["Ctrl"], key: "w"}],
			editorCallback: async (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.KILL_REGION);
				await ep.killRegion(editor);
			},
		},
		{
			id: COMMAND_IDS.YANK,
			name: "Yank",
			hotkeys: [{modifiers: ["Ctrl"], key: "y"}],
			editorCallback: async (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.YANK);
				await ep.yank(editor);
			},
		},
		{
			id: COMMAND_IDS.YANK_POP,
			name: "Yank Pop",
			hotkeys: [{modifiers: ["Alt"], key: "y"}],
			editorCallback: async (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.YANK_POP);
				await ep.yankPop(editor);
			},
		},
		{
			id: COMMAND_IDS.SET_MARK_COMMAND,
			name: "Set mark command",
			hotkeys: [{modifiers: ["Ctrl"], key: " "}],
			editorCallback: (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.SET_MARK_COMMAND);
				ep.setMark(editor);
			},
		},
		{
			id: COMMAND_IDS.MARK_WHOLE_BUFFER,
			name: "Mark whole buffer",
			editorCallback: (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.MARK_WHOLE_BUFFER);
				const lastLine = editor.lineCount() - 1;
				const bufferStart = {line: 0, ch: 0};
				const bufferEnd = {line: lastLine, ch: editor.getLine(lastLine).length};
				ep.selectFrom = bufferStart;
				editor.setSelection(bufferStart, bufferEnd);
			},
		},
		{
			id: COMMAND_IDS.KEYBOARD_QUIT,
			name: "Keyboard-quit",
			hotkeys: [{modifiers: ["Ctrl"], key: "g"}],
			editorCallback: (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.KEYBOARD_QUIT);
				ep.keyboardQuit(editor);
			},
		},
		{
			id: COMMAND_IDS.UNDO,
			name: "Undo",
			hotkeys: [{modifiers: ["Ctrl", "Shift"], key: "-"}, {modifiers: ["Ctrl"], key: "/"}],
			editorCallback: (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.UNDO);
				editor.undo();
			},
		},
		{
			id: COMMAND_IDS.REDO,
			name: "Redo",
			hotkeys: [{modifiers: ["Ctrl", "Shift", "Alt"], key: "-"}, {modifiers: ["Ctrl", "Shift"], key: "/"}],
			editorCallback: (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.REDO);
				editor.redo();
			},
		},
		{
			id: COMMAND_IDS.RECENTER_TOP_BOTTOM,
			name: "Recenter",
			hotkeys: [{modifiers: ["Ctrl"], key: "l"}],
			editorCallback: (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.RECENTER_TOP_BOTTOM);
				ep.recenterToBottom(editor);
			},
		},
		{
			id: COMMAND_IDS.TRANSPOSE_CHARS,
			name: "Transpose chars",
			editorCallback: (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.TRANSPOSE_CHARS);
				ep.transposeChars(editor);
			},
		},
		{
			id: COMMAND_IDS.FORWARD_PARAGRAPH,
			name: "Forward paragraph",
			hotkeys: [{modifiers: ["Alt", "Shift"], key: "]"}],
			editorCallback: (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.FORWARD_PARAGRAPH);
				ep.withSelectionUpdate(editor, () => {
					ep.moveToNextParagraph(editor, Direction.Forward);
				});
			},
		},
		{
			id: COMMAND_IDS.BACKWARD_PARAGRAPH,
			name: "Backward paragraph",
			hotkeys: [{modifiers: ["Alt", "Shift"], key: "["}],
			editorCallback: (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.BACKWARD_PARAGRAPH);
				ep.withSelectionUpdate(editor, () => {
					ep.moveToNextParagraph(editor, Direction.Backward);
				});
			},
		},
	];
}
