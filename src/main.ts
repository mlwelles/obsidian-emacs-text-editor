import {MarkdownView, Plugin} from "obsidian";
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
import {YankPopSession} from "./kill-ring/yank-pop";
import {MarkState} from "./selection/mark";
import {RepeatDetector} from "./tracking/repeat-detector";
import {Direction, moveToNextParagraph} from "./editor-ops/paragraph";
import {recenterToBottom} from "./editor-ops/recenter";
import {
	getCodeMirrorView,
	moveToVisualLineBoundary,
	withSelectionUpdate,
} from "./editor-ops/movement";
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
	type KillContext,
} from "./editor-ops/editing";

export default class EmacsTextEditorPlugin extends Plugin {
	// toggle to enable debug logging
	debugEnabled = false
	readonly logger: Logger = createLogger("emacs-text-editor", () => this.debugEnabled);
	extendLastKill = false
	extendLastKillBackwards = false
	readonly killRing = new KillRing(120);
	private readonly repeats = new RepeatDetector();
	// TODO: Consider possibility migrate to native selection mechanism
	readonly mark = new MarkState();
	readonly yankPopSession = new YankPopSession();
	readonly killCtx: KillContext = {
		killRing: this.killRing,
		mark: this.mark,
		yankPopSession: this.yankPopSession,
		logger: this.logger,
		extendLastKill: () => this.extendLastKill,
		extendLastKillBackwards: () => this.extendLastKillBackwards,
	};

	onload() {
		console.log("loading plugin: Emacs text editor");
		// Any mousedown anywhere cancels mark-mode and yank-pop session,
		// matching emacs (where keyboardQuit does both) and Obsidian's
		// own selection-cancel behavior. Cheap no-op when neither is active.
		this.registerDomEvent(document, "mousedown", () => {
			this.yankPopSession.cancel();
			this.mark.clear();
		});
		registerCommands(this, buildCommands(this));
	}

	commandInvoked(id: CommandId) {
		this.logger.debug("command invoked: " + id)
		if (id !== COMMAND_IDS.YANK_POP) {
			this.yankPopSession.cancel();
		}
		const {isRepeat} = this.repeats.track(id)
		this.extendLastKill = isRepeat && COMMANDS_THAT_EXTEND_LAST_KILL_FORWARD.has(id)
		this.extendLastKillBackwards = isRepeat && COMMANDS_THAT_EXTEND_LAST_KILL_BACKWARD.has(id)
	}

	onunload() {
		console.log('unloading plugin: Emacs text editor');
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
				withSelectionUpdate(editor, ep.mark, ep.logger, () => {
					ep.yankPopSession.cancel();
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
				withSelectionUpdate(editor, ep.mark, ep.logger, () => {
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
				withSelectionUpdate(editor, ep.mark, ep.logger, () => {
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
				withSelectionUpdate(editor, ep.mark, ep.logger, () => {
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
				withSelectionUpdate(editor, ep.mark, ep.logger, () => {
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
				withSelectionUpdate(editor, ep.mark, ep.logger, () => {
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
				const view = getCodeMirrorView(markdownView as MarkdownView);
				if (view) {
					moveToVisualLineBoundary(editor, view, ep.mark, true);
				} else {
					withSelectionUpdate(editor, ep.mark, ep.logger, () => {
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
				const view = getCodeMirrorView(markdownView as MarkdownView);
				if (view) {
					moveToVisualLineBoundary(editor, view, ep.mark, false);
				} else {
					withSelectionUpdate(editor, ep.mark, ep.logger, () => {
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
				withSelectionUpdate(editor, ep.mark, ep.logger, () => {
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
				withSelectionUpdate(editor, ep.mark, ep.logger, () => {
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
				await killLine(editor, ep.killCtx);
			},
		},
		{
			id: COMMAND_IDS.DELETE_CHAR,
			name: "Delete char",
			hotkeys: [{modifiers: ["Ctrl"], key: "d"}],
			editorCallback: async (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.DELETE_CHAR);
				await withDelete(editor, ep.killCtx, () => {
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
				await killWord(editor, ep.killCtx);
			},
		},
		{
			id: COMMAND_IDS.BACKWARD_KILL_WORD,
			name: "Backward kill word",
			hotkeys: [{modifiers: ["Alt"], key: "Backspace"}],
			editorCallback: async (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.BACKWARD_KILL_WORD);
				await withKill(editor, ep.killCtx, () => {
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
				if (!ep.mark.isActive()) {
					return;
				}
				await killRingSave(editor.getSelection(), ep.killCtx);
				cancelSelect(editor, ep.killCtx);
			},
		},
		{
			id: COMMAND_IDS.KILL_REGION,
			name: "Kill region",
			hotkeys: [{modifiers: ["Ctrl"], key: "w"}],
			editorCallback: async (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.KILL_REGION);
				await killRegion(editor, ep.killCtx);
			},
		},
		{
			id: COMMAND_IDS.YANK,
			name: "Yank",
			hotkeys: [{modifiers: ["Ctrl"], key: "y"}],
			editorCallback: async (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.YANK);
				await yank(editor, ep.killCtx);
			},
		},
		{
			id: COMMAND_IDS.YANK_POP,
			name: "Yank Pop",
			hotkeys: [{modifiers: ["Alt"], key: "y"}],
			editorCallback: async (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.YANK_POP);
				await yankPop(editor, ep.killCtx);
			},
		},
		{
			id: COMMAND_IDS.SET_MARK_COMMAND,
			name: "Set mark command",
			hotkeys: [{modifiers: ["Ctrl"], key: " "}],
			editorCallback: (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.SET_MARK_COMMAND);
				setMark(editor, ep.killCtx);
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
				ep.mark.set(bufferStart);
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
				keyboardQuit(editor, ep.killCtx);
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
				recenterToBottom(editor);
			},
		},
		{
			id: COMMAND_IDS.TRANSPOSE_CHARS,
			name: "Transpose chars",
			editorCallback: (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.TRANSPOSE_CHARS);
				transposeChars(editor, ep.killCtx);
			},
		},
		{
			id: COMMAND_IDS.FORWARD_PARAGRAPH,
			name: "Forward paragraph",
			hotkeys: [{modifiers: ["Alt", "Shift"], key: "]"}],
			editorCallback: (editor, _, p) => {
				const ep = p as EmacsTextEditorPlugin;
				ep.commandInvoked(COMMAND_IDS.FORWARD_PARAGRAPH);
				withSelectionUpdate(editor, ep.mark, ep.logger, () => {
					moveToNextParagraph(editor, Direction.Forward);
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
				withSelectionUpdate(editor, ep.mark, ep.logger, () => {
					moveToNextParagraph(editor, Direction.Backward);
				});
			},
		},
	];
}
