import {describe, expect, it} from "vitest";
import {
	forwardChar,
	backwardChar,
	forwardWord,
	backwardWord,
	beginningOfLine,
	endOfLine,
	nextLine,
	previousLine,
	deleteChar,
	killWord,
	backwardKillWord,
	killLine,
	killRegion,
	killRingSave,
	yank,
	getSelectedText,
} from "./ops";

function makeTextarea(value: string, selStart: number, selEnd = selStart): HTMLTextAreaElement {
	const el = document.createElement("textarea");
	document.body.appendChild(el);
	el.value = value;
	el.setSelectionRange(selStart, selEnd);
	return el;
}

describe("forwardChar", () => {
	it("moves the cursor forward by one in a textarea", () => {
		const el = makeTextarea("hello", 2);
		forwardChar(el);
		expect(el.selectionStart).toBe(3);
		expect(el.selectionEnd).toBe(3);
	});

	it("does nothing at end of value", () => {
		const el = makeTextarea("hi", 2);
		forwardChar(el);
		expect(el.selectionStart).toBe(2);
	});
});

describe("backwardChar", () => {
	it("moves the cursor backward by one", () => {
		const el = makeTextarea("hello", 3);
		backwardChar(el);
		expect(el.selectionStart).toBe(2);
	});

	it("does nothing at start of value", () => {
		const el = makeTextarea("hi", 0);
		backwardChar(el);
		expect(el.selectionStart).toBe(0);
	});
});

describe("forwardWord", () => {
	it("moves to end of current word", () => {
		const el = makeTextarea("foo bar baz", 0);
		forwardWord(el);
		expect(el.selectionStart).toBe(3);
	});

	it("skips whitespace then moves to end of next word", () => {
		const el = makeTextarea("foo bar baz", 3);
		forwardWord(el);
		expect(el.selectionStart).toBe(7);
	});

	it("stops at end of value", () => {
		const el = makeTextarea("foo", 3);
		forwardWord(el);
		expect(el.selectionStart).toBe(3);
	});
});

describe("backwardWord", () => {
	it("moves to start of current word", () => {
		const el = makeTextarea("foo bar baz", 7);
		backwardWord(el);
		expect(el.selectionStart).toBe(4);
	});

	it("skips whitespace then moves to start of previous word", () => {
		const el = makeTextarea("foo bar baz", 4);
		backwardWord(el);
		expect(el.selectionStart).toBe(0);
	});
});

describe("beginningOfLine", () => {
	it("in a single-line input moves to position 0", () => {
		const el = document.createElement("input");
		el.value = "hello world";
		el.setSelectionRange(7, 7);
		beginningOfLine(el);
		expect(el.selectionStart).toBe(0);
	});

	it("in a multi-line textarea moves to start of current line", () => {
		const el = makeTextarea("line one\nline two\nline three", 14);
		beginningOfLine(el);
		expect(el.selectionStart).toBe(9);
	});
});

describe("endOfLine", () => {
	it("in a single-line input moves to end of value", () => {
		const el = document.createElement("input");
		el.value = "hello world";
		el.setSelectionRange(2, 2);
		endOfLine(el);
		expect(el.selectionStart).toBe(11);
	});

	it("in a multi-line textarea moves to end of current line", () => {
		const el = makeTextarea("line one\nline two\nline three", 14);
		endOfLine(el);
		expect(el.selectionStart).toBe(17);
	});
});

describe("nextLine", () => {
	it("moves cursor to same column on next textual line", () => {
		const el = makeTextarea("line one\nline two\nline three", 4);
		nextLine(el);
		expect(el.selectionStart).toBe(13);
	});

	it("clamps to end of next line if shorter than current column", () => {
		const el = makeTextarea("line one\nhi\nline three", 7);
		nextLine(el);
		expect(el.selectionStart).toBe(11);
	});

	it("does nothing in single-line input", () => {
		const el = document.createElement("input");
		el.value = "hello";
		el.setSelectionRange(2, 2);
		nextLine(el);
		expect(el.selectionStart).toBe(2);
	});

	it("stops at end of value if no next line", () => {
		const el = makeTextarea("only line", 4);
		nextLine(el);
		expect(el.selectionStart).toBe(4);
	});
});

describe("previousLine", () => {
	it("moves cursor to same column on previous textual line", () => {
		const el = makeTextarea("line one\nline two\nline three", 13);
		previousLine(el);
		expect(el.selectionStart).toBe(4);
	});

	it("clamps to end of previous line if shorter than current column", () => {
		const el = makeTextarea("hi\nline two\nline three", 7);
		previousLine(el);
		expect(el.selectionStart).toBe(2);
	});

	it("does nothing if cursor is on the first line", () => {
		const el = makeTextarea("only line", 4);
		previousLine(el);
		expect(el.selectionStart).toBe(4);
	});
});

describe("deleteChar", () => {
	it("removes the character forward of the cursor", () => {
		const el = makeTextarea("hello", 2);
		deleteChar(el);
		expect(el.value).toBe("helo");
		expect(el.selectionStart).toBe(2);
	});

	it("does nothing at end of value", () => {
		const el = makeTextarea("hi", 2);
		deleteChar(el);
		expect(el.value).toBe("hi");
	});
});

describe("killLine", () => {
	it("kills from cursor to end of textual line and returns the killed text", () => {
		const el = makeTextarea("line one\nline two", 4);
		const killed = killLine(el);
		expect(killed).toBe(" one");
		expect(el.value).toBe("line\nline two");
		expect(el.selectionStart).toBe(4);
	});

	it("kills the newline if cursor is at end of line", () => {
		const el = makeTextarea("line one\nline two", 8);
		const killed = killLine(el);
		expect(killed).toBe("\n");
		expect(el.value).toBe("line oneline two");
	});

	it("returns empty string at end of value", () => {
		const el = makeTextarea("hi", 2);
		const killed = killLine(el);
		expect(killed).toBe("");
		expect(el.value).toBe("hi");
	});

	it("kills entire line content in single-line input", () => {
		const el = document.createElement("input");
		el.value = "hello world";
		el.setSelectionRange(6, 6);
		const killed = killLine(el);
		expect(killed).toBe("world");
		expect(el.value).toBe("hello ");
	});
});

describe("killWord", () => {
	it("returns the killed text and removes it forward", () => {
		const el = makeTextarea("foo bar baz", 0);
		const killed = killWord(el);
		expect(killed).toBe("foo");
		expect(el.value).toBe(" bar baz");
		expect(el.selectionStart).toBe(0);
	});

	it("preserves leading whitespace in the killed text", () => {
		const el = makeTextarea("foo bar baz", 3); // cursor between "foo" and " bar"
		const killed = killWord(el);
		expect(killed).toBe(" bar");
		expect(el.value).toBe("foo baz");
	});

	it("returns empty string when there's no word to kill", () => {
		const el = makeTextarea("foo", 3); // at end
		const killed = killWord(el);
		expect(killed).toBe("");
		expect(el.value).toBe("foo");
	});
});

describe("backwardKillWord", () => {
	it("returns the killed text and removes it backward", () => {
		const el = makeTextarea("foo bar baz", 7);
		const killed = backwardKillWord(el);
		expect(killed).toBe("bar");
		expect(el.value).toBe("foo  baz");
		expect(el.selectionStart).toBe(4);
	});

	it("preserves trailing whitespace in the killed text", () => {
		const el = makeTextarea("foo bar baz", 4); // cursor at start of "bar"
		const killed = backwardKillWord(el);
		expect(killed).toBe("foo ");
		expect(el.value).toBe("bar baz");
	});

	it("returns empty string when there's no word to kill backward", () => {
		const el = makeTextarea("foo", 0); // at start
		const killed = backwardKillWord(el);
		expect(killed).toBe("");
		expect(el.value).toBe("foo");
	});
});

describe("getSelectedText", () => {
	it("returns the selected substring", () => {
		const el = makeTextarea("hello world", 0, 5);
		expect(getSelectedText(el)).toBe("hello");
	});

	it("returns empty string when no selection", () => {
		const el = makeTextarea("hello", 2, 2);
		expect(getSelectedText(el)).toBe("");
	});
});

describe("killRegion", () => {
	it("removes the selected text and returns it", () => {
		const el = makeTextarea("hello world", 6, 11);
		const killed = killRegion(el);
		expect(killed).toBe("world");
		expect(el.value).toBe("hello ");
		expect(el.selectionStart).toBe(6);
	});

	it("returns empty string when no selection", () => {
		const el = makeTextarea("hello", 2, 2);
		expect(killRegion(el)).toBe("");
		expect(el.value).toBe("hello");
	});
});

describe("killRingSave", () => {
	it("returns the selected text without modifying the value", () => {
		const el = makeTextarea("hello world", 6, 11);
		const saved = killRingSave(el);
		expect(saved).toBe("world");
		expect(el.value).toBe("hello world");
		expect(el.selectionStart).toBe(11); // selection collapsed to end
	});
});

describe("yank", () => {
	it("inserts text at cursor and advances cursor", () => {
		const el = makeTextarea("hello ", 6);
		yank(el, "world");
		expect(el.value).toBe("hello world");
		expect(el.selectionStart).toBe(11);
	});

	it("replaces selection with text", () => {
		const el = makeTextarea("hello there", 6, 11);
		yank(el, "world");
		expect(el.value).toBe("hello world");
		expect(el.selectionStart).toBe(11);
	});
});
