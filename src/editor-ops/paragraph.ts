import type {Editor} from "obsidian";

export enum Direction {
	Forward,
	Backward,
}

export function moveToNextParagraph(editor: Editor, direction: Direction): void {
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
