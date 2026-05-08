import type {Editor, EditorPosition} from "obsidian";
import type {KillRing} from "../kill-ring/kill-ring";
import type {YankPopSession} from "../kill-ring/yank-pop";
import type {MarkState} from "../selection/mark";
import type {Logger} from "../log";

export interface KillContext {
	killRing: KillRing;
	mark: MarkState;
	yankPopSession: YankPopSession;
	logger: Logger;
	extendLastKill: () => boolean;
	extendLastKillBackwards: () => boolean;
}

export async function killRingSave(text: string, ctx: KillContext): Promise<void> {
	ctx.killRing.save(text, {
		extendForward: ctx.extendLastKill(),
		extendBackward: ctx.extendLastKillBackwards(),
	});
	const stored = ctx.killRing.current();
	if (stored === undefined) {
		return;
	}
	const clipboardText = await navigator.clipboard.readText();
	if (clipboardText === stored) {
		return;
	}
	await navigator.clipboard.writeText(stored);
	ctx.logger.debug("wrote text to navigator clipboard: " + stored);
}

export function cancelSelect(editor: Editor, ctx: KillContext): void {
	ctx.logger.debug("clearing selection");
	editor.setSelection(editor.getCursor(), editor.getCursor());
	ctx.mark.clear();
}

export function cancelYankPop(ctx: KillContext): void {
	ctx.yankPopSession.cancel();
	ctx.logger.debug("yank pop stopped");
}

export async function withDelete(editor: Editor, ctx: KillContext, callback: () => void): Promise<void> {
	const cursorBefore = editor.getCursor();
	callback();
	const cursorAfter = editor.getCursor();
	editor.setSelection(cursorBefore, cursorAfter);
	ctx.logger.debug("set selection from " + JSON.stringify(cursorBefore) + " to " + JSON.stringify(cursorAfter) + ", selected text: " + editor.getSelection());
	ctx.logger.debug("replacing selection with empty string");
	editor.replaceSelection("");
	cancelSelect(editor, ctx);
}

export function withSelect(editor: Editor, ctx: KillContext, callback: () => void): void {
	cancelSelect(editor, ctx);
	const start = editor.getCursor();
	ctx.mark.set(start);
	callback();
	const end = editor.getCursor();
	ctx.logger.debug("selecting text from " + JSON.stringify(start) + " to " + JSON.stringify(end));
	editor.setSelection(start, end);
	ctx.logger.debug("selected text is now: " + editor.getSelection());
}

export async function replaceSelectedText(
	editor: Editor,
	ctx: KillContext,
	text = "",
	save = true,
): Promise<void> {
	if (!ctx.mark.isActive()) {
		return;
	}
	ctx.logger.debug("replacing selected text");
	if (!text) {
		text = "";
	}
	if (save) {
		const selectedText = editor.getSelection();
		ctx.logger.debug("saving selected text to kill ring: " + selectedText);
		await killRingSave(selectedText, ctx);
	}
	editor.replaceSelection(text);
	ctx.logger.debug("replaced selected text with '" + text + "'");
	cancelSelect(editor, ctx);
}

export async function withKill(editor: Editor, ctx: KillContext, callback: () => void): Promise<void> {
	withSelect(editor, ctx, callback);
	await replaceSelectedText(editor, ctx, "", true);
}

export async function killLine(editor: Editor, ctx: KillContext): Promise<void> {
	const cursor = editor.getCursor();
	const line = editor.getLine(cursor.line);
	ctx.logger.debug("kill-line - line is '" + line + "'");
	if (line === "") {
		await withKill(editor, ctx, () => {
			editor.exec("goRight");
		});
		return;
	}
	ctx.logger.debug("kill-line - cursor is " + JSON.stringify(cursor));
	const textToBeRetained = line.slice(0, cursor.ch);
	const textToBeCut = line.slice(cursor.ch);
	await killRingSave(textToBeCut, ctx);
	ctx.logger.debug("kill-line - setting line " + cursor.line + " to '" + textToBeRetained + "'");
	editor.setLine(cursor.line, textToBeRetained);
	editor.setCursor(cursor.line, cursor.ch);
}

export async function killRegion(editor: Editor, ctx: KillContext): Promise<void> {
	await replaceSelectedText(editor, ctx, "", true);
}

export async function yank(editor: Editor, ctx: KillContext): Promise<void> {
	ctx.logger.debug("started yank");
	cancelYankPop(ctx);
	const clipboardText = await navigator.clipboard.readText();
	const yankText = ctx.killRing.current();
	if (yankText !== clipboardText) {
		await killRingSave(clipboardText, ctx);
	}
	const position = editor.getCursor();
	if (!ctx.mark.isActive()) {
		ctx.logger.debug("inserting text at position " + JSON.stringify(position) + ": " + clipboardText);
		editor.replaceRange(clipboardText, position);
	} else {
		ctx.logger.debug("replacing selection with: " + clipboardText);
		editor.replaceSelection(clipboardText);
		cancelSelect(editor, ctx);
	}
	const newEnd: EditorPosition = {line: position.line, ch: position.ch + clipboardText.length};
	editor.setCursor(newEnd);
	ctx.yankPopSession.start(position, newEnd);
	ctx.logger.debug("yanked '" + yankText + "'");
}

export async function yankPop(editor: Editor, ctx: KillContext): Promise<void> {
	ctx.logger.debug("yank pop started");
	const range = ctx.yankPopSession.range();
	if (!range) {
		ctx.logger.debug("can't yank pop");
		return;
	}
	const yankPopText = ctx.killRing.rotate();
	if (yankPopText === undefined) {
		ctx.logger.debug("kill ring empty");
		return;
	}
	ctx.logger.debug("yank pop text: " + yankPopText);
	cancelSelect(editor, ctx);
	editor.setSelection(range.start, range.end);
	editor.replaceSelection(yankPopText);
	const newEnd: EditorPosition = {line: range.start.line, ch: range.start.ch + yankPopText.length};
	editor.setCursor(newEnd);
	ctx.yankPopSession.updateEnd(newEnd);
	ctx.logger.debug("yank popped '" + yankPopText + "'");
}

export function setMark(editor: Editor, ctx: KillContext): void {
	// start new selection from cursor if already started
	if (ctx.mark.isActive()) {
		cancelSelect(editor, ctx);
	}
	const start = editor.getCursor();
	ctx.mark.set(start);
	ctx.logger.debug("selection start is now " + JSON.stringify(start));
}

export function keyboardQuit(editor: Editor, ctx: KillContext): void {
	cancelYankPop(ctx);
	cancelSelect(editor, ctx);
}

export function transposeChars(editor: Editor, ctx: KillContext): void {
	cancelSelect(editor, ctx);
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

export async function killWord(editor: Editor, ctx: KillContext): Promise<void> {
	cancelSelect(editor, ctx);
	await withKill(editor, ctx, () => {
		editor.exec("goWordRight");
	});
}
