import type {Editor, MarkdownView} from "obsidian";
import {EditorSelection} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import type {MarkState} from "../selection/mark";
import type {Logger} from "../log";

// MarkdownView.editor.cm is undocumented Obsidian internals exposing the
// underlying CodeMirror 6 EditorView. If a future Obsidian release changes
// this shape, the optional-chained access returns undefined and callers
// fall back to the logical-line path.
type MarkdownViewWithCM = MarkdownView & {editor?: {cm?: EditorView}};

export function withSelectionUpdate(
	editor: Editor,
	mark: MarkState,
	logger: Logger,
	callback: () => void,
): void {
	if (mark.isActive()) {
		editor.setSelection(editor.getCursor());
	}
	callback();
	extendSelection(editor, mark, logger);
}

export function extendSelection(editor: Editor, mark: MarkState, logger: Logger): void {
	const start = mark.origin();
	if (start === undefined) {
		return;
	}
	const end = editor.getCursor();
	logger.debug("extending selection to cursor at " + JSON.stringify(end));
	editor.setSelection(start, end);
	logger.debug("selection is now from " + JSON.stringify(start) + " to " + JSON.stringify(end));
	logger.debug("selected text: " + editor.getSelection());
}

export function getCodeMirrorView(markdownView: MarkdownView): EditorView | undefined {
	return (markdownView as MarkdownViewWithCM).editor?.cm;
}

// CodeMirror 6 represents the position at the end of a wrapped visual line
// and the start of the next visual line as the SAME document offset; they
// are disambiguated by the `assoc` (associativity) value on the cursor.
// Going through Obsidian's editor.setCursor() loses `assoc`, so the cursor
// renders at the start of the next visual line instead of the end of the
// current one. Dispatch through the CodeMirror view directly to preserve
// `assoc`.
export function moveToVisualLineBoundary(
	editor: Editor,
	view: EditorView,
	mark: MarkState,
	forward: boolean,
): void {
	const cmSelection = view.state.selection.main;
	const headCursor = EditorSelection.cursor(cmSelection.head, cmSelection.assoc);
	const newRange = view.moveToLineBoundary(headCursor, forward);

	const origin = mark.origin();
	const newSelection = origin !== undefined
		? EditorSelection.create([
			EditorSelection.range(editor.posToOffset(origin), newRange.head, newRange.assoc),
		])
		: EditorSelection.create([
			EditorSelection.cursor(newRange.head, newRange.assoc),
		]);

	view.dispatch({
		selection: newSelection,
		scrollIntoView: true,
	});
}
