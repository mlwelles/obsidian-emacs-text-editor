export const COMMAND_IDS = {
	FORWARD_CHAR: "forward-char",
	BACKWARD_CHAR: "backward-char",
	NEXT_LINE: "next-line",
	PREVIOUS_LINE: "previous-line",
	FORWARD_WORD: "forward-word",
	BACKWARD_WORD: "backward-word",
	MOVE_END_OF_LINE: "move-end-of-line",
	MOVE_BEGINNING_OF_LINE: "move-beginning-of-line",
	BEGINNING_OF_BUFFER: "beginning-of-buffer",
	END_OF_BUFFER: "end-of-buffer",
	KILL_LINE: "kill-line",
	DELETE_CHAR: "delete-char",
	KILL_WORD: "kill-word",
	BACKWARD_KILL_WORD: "backward-kill-word",
	KILL_RING_SAVE: "kill-ring-save",
	KILL_REGION: "kill-region",
	YANK: "yank",
	YANK_POP: "yank-pop",
	SET_MARK_COMMAND: "set-mark-command",
	KEYBOARD_QUIT: "keyboard-quit",
	UNDO: "undo",
	REDO: "redo",
	RECENTER_TOP_BOTTOM: "recenter-top-bottom",
	FORWARD_PARAGRAPH: "forward-paragraph",
	BACKWARD_PARAGRAPH: "backward-paragraph",
	MARK_WHOLE_BUFFER: "mark-whole-buffer",
	TRANSPOSE_CHARS: "transpose-chars",
} as const;

export type CommandId = typeof COMMAND_IDS[keyof typeof COMMAND_IDS];

export const COMMANDS_THAT_EXTEND_LAST_KILL_FORWARD: ReadonlySet<CommandId> = new Set([
	COMMAND_IDS.KILL_WORD,
	COMMAND_IDS.KILL_LINE,
]);

export const COMMANDS_THAT_EXTEND_LAST_KILL_BACKWARD: ReadonlySet<CommandId> = new Set([
	COMMAND_IDS.BACKWARD_KILL_WORD,
]);
