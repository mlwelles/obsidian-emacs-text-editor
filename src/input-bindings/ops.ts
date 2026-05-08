export type EditableElement = HTMLInputElement | HTMLTextAreaElement;

export function forwardChar(el: EditableElement): void {
	const pos = el.selectionStart ?? 0;
	const next = Math.min(pos + 1, el.value.length);
	el.setSelectionRange(next, next);
}

export function backwardChar(el: EditableElement): void {
	const pos = el.selectionStart ?? 0;
	const next = Math.max(pos - 1, 0);
	el.setSelectionRange(next, next);
}

export function forwardWord(el: EditableElement): void {
	const pos = el.selectionStart ?? 0;
	const next = nextWordBoundary(el.value, pos, 1);
	el.setSelectionRange(next, next);
}

export function backwardWord(el: EditableElement): void {
	const pos = el.selectionStart ?? 0;
	const next = nextWordBoundary(el.value, pos, -1);
	el.setSelectionRange(next, next);
}

export function beginningOfLine(el: EditableElement): void {
	const pos = el.selectionStart ?? 0;
	if (el instanceof HTMLInputElement) {
		el.setSelectionRange(0, 0);
		return;
	}
	const next = el.value.lastIndexOf("\n", pos - 1) + 1;
	el.setSelectionRange(next, next);
}

export function endOfLine(el: EditableElement): void {
	const pos = el.selectionStart ?? 0;
	if (el instanceof HTMLInputElement) {
		el.setSelectionRange(el.value.length, el.value.length);
		return;
	}
	const nlIndex = el.value.indexOf("\n", pos);
	const next = nlIndex < 0 ? el.value.length : nlIndex;
	el.setSelectionRange(next, next);
}

export function nextLine(el: EditableElement): void {
	if (el instanceof HTMLInputElement) {
		return;
	}
	const pos = el.selectionStart ?? 0;
	const lineStart = el.value.lastIndexOf("\n", pos - 1) + 1;
	const column = pos - lineStart;
	const nextLineStart = el.value.indexOf("\n", pos);
	if (nextLineStart < 0) {
		return;
	}
	const lineAfterStart = nextLineStart + 1;
	const lineAfterEnd = el.value.indexOf("\n", lineAfterStart);
	const lineAfterLen = (lineAfterEnd < 0 ? el.value.length : lineAfterEnd) - lineAfterStart;
	const next = lineAfterStart + Math.min(column, lineAfterLen);
	el.setSelectionRange(next, next);
}

export function previousLine(el: EditableElement): void {
	if (el instanceof HTMLInputElement) {
		return;
	}
	const pos = el.selectionStart ?? 0;
	const lineStart = el.value.lastIndexOf("\n", pos - 1) + 1;
	if (lineStart === 0) {
		return;
	}
	const column = pos - lineStart;
	const prevLineEnd = lineStart - 1;
	const prevLineStart = el.value.lastIndexOf("\n", prevLineEnd - 1) + 1;
	const prevLineLen = prevLineEnd - prevLineStart;
	const next = prevLineStart + Math.min(column, prevLineLen);
	el.setSelectionRange(next, next);
}

export function deleteChar(el: EditableElement): void {
	const pos = el.selectionStart ?? 0;
	if (pos >= el.value.length) {
		return;
	}
	el.value = el.value.slice(0, pos) + el.value.slice(pos + 1);
	el.setSelectionRange(pos, pos);
	el.dispatchEvent(new Event("input", {bubbles: true}));
}

export function killWord(el: EditableElement): string {
	const start = el.selectionStart ?? 0;
	const end = nextWordBoundary(el.value, start, 1);
	const killed = el.value.slice(start, end);
	el.value = el.value.slice(0, start) + el.value.slice(end);
	el.setSelectionRange(start, start);
	el.dispatchEvent(new Event("input", {bubbles: true}));
	return killed;
}

export function backwardKillWord(el: EditableElement): string {
	const end = el.selectionStart ?? 0;
	const start = nextWordBoundary(el.value, end, -1);
	const killed = el.value.slice(start, end);
	el.value = el.value.slice(0, start) + el.value.slice(end);
	el.setSelectionRange(start, start);
	el.dispatchEvent(new Event("input", {bubbles: true}));
	return killed;
}

export function killLine(el: EditableElement): string {
	const start = el.selectionStart ?? 0;
	if (start >= el.value.length) {
		return "";
	}
	if (el instanceof HTMLInputElement) {
		const killed = el.value.slice(start);
		el.value = el.value.slice(0, start);
		el.setSelectionRange(start, start);
		el.dispatchEvent(new Event("input", {bubbles: true}));
		return killed;
	}
	const nlIndex = el.value.indexOf("\n", start);
	const end = nlIndex < 0 ? el.value.length : (nlIndex === start ? start + 1 : nlIndex);
	const killed = el.value.slice(start, end);
	el.value = el.value.slice(0, start) + el.value.slice(end);
	el.setSelectionRange(start, start);
	el.dispatchEvent(new Event("input", {bubbles: true}));
	return killed;
}

export function getSelectedText(el: EditableElement): string {
	const start = el.selectionStart ?? 0;
	const end = el.selectionEnd ?? 0;
	return el.value.slice(start, end);
}

export function killRegion(el: EditableElement): string {
	const start = el.selectionStart ?? 0;
	const end = el.selectionEnd ?? 0;
	if (start === end) {
		return "";
	}
	const killed = el.value.slice(start, end);
	el.value = el.value.slice(0, start) + el.value.slice(end);
	el.setSelectionRange(start, start);
	el.dispatchEvent(new Event("input", {bubbles: true}));
	return killed;
}

export function killRingSave(el: EditableElement): string {
	const text = getSelectedText(el);
	const end = el.selectionEnd ?? 0;
	el.setSelectionRange(end, end);
	return text;
}

export function yank(el: EditableElement, text: string): void {
	const start = el.selectionStart ?? 0;
	const end = el.selectionEnd ?? 0;
	el.value = el.value.slice(0, start) + text + el.value.slice(end);
	const next = start + text.length;
	el.setSelectionRange(next, next);
	el.dispatchEvent(new Event("input", {bubbles: true}));
}

function nextWordBoundary(text: string, from: number, direction: 1 | -1): number {
	let pos = from;
	const isWordChar = (c: string) => /\w/.test(c);
	if (direction === 1) {
		while (pos < text.length && !isWordChar(text[pos])) pos++;
		while (pos < text.length && isWordChar(text[pos])) pos++;
	} else {
		while (pos > 0 && !isWordChar(text[pos - 1])) pos--;
		while (pos > 0 && isWordChar(text[pos - 1])) pos--;
	}
	return pos;
}
