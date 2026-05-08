# Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Salvage four upstream improvements onto the fork (release as `0.4.0`), then refactor the 607-line single-file plugin into a tested, modular `src/` tree (release as `0.5.0`). No public behavior change beyond the salvage. The kill-ring / yank-pop / mark state machines become testable units before any new feature work.

**Architecture:** Two phases. Phase 0 is four behavior-additive or behavior-fixing commits on the current `main.ts`. Phase 1 splits `main.ts` into focused modules under `src/` — pure-state classes (`KillRing`, `YankPopSession`, `MarkState`, `RepeatDetector`) get unit tests under vitest; Obsidian-coupled code (editor ops, command registration) stays integration-tested by manual regression in the test vault.

**Tech Stack:** TypeScript (strict mode), esbuild, eslint, vitest (new), GitHub Actions (new). Obsidian Plugin API. CodeMirror 6 imports for visual-line-edge handling.

**Test vault:** `~/Documents/Obsidian/blackbook`. Install with `OBSIDIAN_PLUGINS_DIR=~/Documents/Obsidian/blackbook/Notes/.obsidian/plugins make install`.

**Source design docs:**
- `docs/plans/2026-05-06-refactor-and-reorg.md` — what + why
- `docs/plans/2026-05-06-emacs-bindings-everywhere-design.md` — context for what comes after this plan

**Status assumptions at start:** branch `main` at `d71a360` (manifest version `0.3.1`), upstream remote present but no future merges planned, no test infrastructure, no CI for build/lint/test.

---

## Phase 0 — Salvage upstream improvements

Four commits on the current single-file `main.ts`. No structural change. Each commit is independently shippable. After Phase 0 ships, tag `0.4.0`.

The skipped upstream work and rationale lives in `docs/plans/2026-05-06-refactor-and-reorg.md` § "Pre-refactor: Phase 0 — Salvage upstream improvements".

### Task 0.1: Visual line edges for `move-beginning-of-line` and `move-end-of-line`

Source: upstream commit `a3267c7` (PR #24). Without this, `C-a` / `C-e` on a wrapped paragraph go to the *logical* line edge rather than the visual line edge. Combined with the fork's already-correct visual `C-n` / `C-p`, the asymmetry is jarring.

**Files:**
- Modify: `main.ts` (imports, `move-beginning-of-line` callback, `move-end-of-line` callback, new `moveToLineBoundary` helper)

- [ ] **Step 1: Add CodeMirror 6 imports**

Open `main.ts`. Replace the import line:

```ts
import {Editor, EditorPosition, MarkdownView, Plugin} from "obsidian";
```

with:

```ts
import {Editor, EditorPosition, MarkdownView, Plugin} from "obsidian";
import {EditorView} from "@codemirror/view";
import {EditorSelection} from "@codemirror/state";
```

These packages are already external in `esbuild.config.mjs:23-31` (no install needed; Obsidian provides them at runtime).

- [ ] **Step 2: Add `moveToLineBoundary` and `getCodeMirrorView` helpers**

Insert these methods inside the `EmacsTextEditorPlugin` class, after the existing `moveToNextParagraph` method (near line 605):

```ts
	getCodeMirrorView(markdownView: MarkdownView): EditorView | undefined {
		return (markdownView as MarkdownView & { editor?: { cm?: EditorView } }).editor?.cm;
	}

	moveToLineBoundary(editor: Editor, view: EditorView, forward: boolean) {
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
```

This is a fork-adapted version of upstream's helper. It uses the fork's `selectFrom` instead of upstream's `markPosition`, and skips upstream's `disableSelectionWhenPossible` machinery (the fork doesn't have that concept).

- [ ] **Step 3: Replace `move-end-of-line` callback to use the helper with CM6 fallback**

Find the `move-end-of-line` `addCommand` block (currently main.ts:103-115). Replace its `editorCallback` body so it tries the CM6 path first and falls back to the existing logical-line path:

```ts
		this.addCommand({
			id: 'move-end-of-line',
			name: 'Move end of line',
			hotkeys: [{modifiers: ["Ctrl"], key: "e"}],
			editorCallback: (editor: Editor, markdownView: MarkdownView) => {
				this.commandInvoked("move-end-of-line")
				const view = this.getCodeMirrorView(markdownView)
				if (view) {
					this.moveToLineBoundary(editor, view, true)
				} else {
					this.withSelectionUpdate(editor, () => {
						const cursor = editor.getCursor()
						const lineContent = editor.getLine(cursor.line)
						editor.setCursor({line: cursor.line, ch: lineContent.length})
					})
				}
			}
		});
```

- [ ] **Step 4: Replace `move-beginning-of-line` callback similarly**

Find the `move-beginning-of-line` block (currently main.ts:117-128). Replace:

```ts
		this.addCommand({
			id: 'move-beginning-of-line',
			name: 'Move cursor to beginning of line',
			hotkeys: [{modifiers: ["Ctrl"], key: "a"}],
			editorCallback: (editor: Editor, markdownView: MarkdownView) => {
				this.commandInvoked("move-beginning-of-line")
				const view = this.getCodeMirrorView(markdownView)
				if (view) {
					this.moveToLineBoundary(editor, view, false)
				} else {
					this.withSelectionUpdate(editor, () => {
						const cursor = editor.getCursor()
						editor.setCursor({line: cursor.line, ch: 0})
					})
				}
			}
		});
```

- [ ] **Step 5: Build and install**

Run:

```sh
export OBSIDIAN_PLUGINS_DIR=~/Documents/Obsidian/blackbook/Notes/.obsidian/plugins
make install
```

Expected: build succeeds, no TypeScript errors, file copied to `${OBSIDIAN_PLUGINS_DIR}/emacs-text-editor`.

- [ ] **Step 6: Manual regression in Obsidian**

Reload Obsidian (Cmd-R in the developer console, or disable+enable the plugin in settings). In the test vault, open or create a note with a paragraph long enough to wrap on the current window width.

Verify each of:
1. Cursor mid-wrapped-line, press `C-e` → cursor jumps to the *visual* end of the wrapped row, not the end of the paragraph.
2. Cursor mid-wrapped-line, press `C-a` → cursor jumps to the *visual* start of the wrapped row.
3. Press `C-Space`, move within the wrapped paragraph, then `C-e` → selection extends to the visual end (mark-region preserved).
4. Same, `C-a` → selection extends to the visual start.
5. On a non-wrapped short line, `C-a` and `C-e` still work as before (sanity check).

If any verification fails, fix before commit.

- [ ] **Step 7: Commit**

```sh
git add main.ts
git commit -m "feat: visual line edges for C-a / C-e on wrapped lines

Port upstream PR #24 (a3267c7). On wrapped paragraphs, move-beginning-of-line
and move-end-of-line now go to the visual line edge instead of the logical
line edge, matching emacs and the fork's already-correct C-n / C-p behavior.

Uses CodeMirror 6's view.moveToLineBoundary directly. Falls back to the
existing logical-line logic if no CM6 view is available."
```

---

### Task 0.2: Mark stability — mousedown cancels selection

Source: upstream commit `9982a26` (PR #20), partial port. The substantive selection-stability fix in #20 (computing destinations directly instead of select→move→re-expand) is mostly absorbed by Task 0.1 for the line-edge cases; the remaining piece worth porting is the mousedown listener that cancels mark mode, matching keyboard-quit semantics.

> **Plan note (revised 2026-05-07):** The literal upstream PR #20 only cleared the mark on mousedown. The fork's `keyboardQuit` cancels both the mark AND the yank-pop session, and a mouse click is at least as strong a "doing something else" signal as `C-g`. Without canceling the yank-pop session, a `yank → click → M-y` sequence operates on stale `yankStart`/`yankEnd` positions. The handler matches `keyboardQuit`'s precedent.

**Files:**
- Modify: `main.ts` (`onload`)

- [ ] **Step 1: Register mousedown listener**

In `onload`, immediately after `console.log('loading plugin: Emacs text editor');` (main.ts:29), add:

```ts
		// Any mousedown anywhere cancels mark-mode and yank-pop session,
		// matching emacs (where keyboardQuit does both) and Obsidian's
		// own selection-cancel behavior. Cheap no-op when neither is active.
		this.registerDomEvent(document, "mousedown", () => {
			this.cancelYankPop();
			this.selectFrom = undefined;
		});
```

`registerDomEvent` is the Obsidian-supplied wrapper around `addEventListener` that auto-removes on plugin unload — important so the listener doesn't outlive the plugin.

- [ ] **Step 2: Build and install**

```sh
make install
```

Expected: clean build.

- [ ] **Step 3: Manual regression in Obsidian**

Reload Obsidian. In the test vault:
1. Set mark with `C-Space`, move with `C-f` a few times → selection should appear.
2. Click somewhere else with the mouse → selection clears immediately.
3. Press `C-w` (kill-region) → no-op (selection is gone).
4. Re-test the kill-ring still works without mouse interaction: `C-Space`, `C-f` `C-f` `C-f`, `C-w` → text killed.
5. `C-y` yanks back.

If any fail, debug before committing.

- [ ] **Step 4: Commit**

```sh
git add main.ts
git commit -m "fix: mousedown cancels mark mode

Port the mousedown handler from upstream PR #20 (9982a26). Clicking outside
the active selection now clears the mark, matching Obsidian's selection
behavior and emacs's expectation that clicking elsewhere cancels the region.

The remaining substance of #20 (selection stability across links/widgets via
direct-move) is absorbed by Task 0.1's CM6-direct path for line edges."
```

---

### Task 0.3: Add `mark-whole-buffer` command

Source: upstream commit `288e967` (PR #25), `mark-whole-buffer` half. This is needed for the design doc's `C-x h` Layer 3b binding. Unbound by default; assignable via Obsidian hotkey settings.

**Files:**
- Modify: `main.ts` (`onload`)

- [ ] **Step 1: Add the command registration**

In `onload`, after the `set-mark-command` block (around main.ts:253), insert:

```ts
		this.addCommand({
			id: 'mark-whole-buffer',
			name: 'Mark whole buffer',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.commandInvoked('mark-whole-buffer')
				const lastLine = editor.lineCount() - 1
				const bufferStart = {line: 0, ch: 0}
				const bufferEnd = {line: lastLine, ch: editor.getLine(lastLine).length}
				this.selectFrom = bufferStart
				editor.setSelection(bufferStart, bufferEnd)
			}
		});
```

No `hotkeys` — this command is unbound by default. Users can assign one in Obsidian settings, and the upcoming Layer 3b plan will wire `C-x h` to it.

- [ ] **Step 2: Build and install**

```sh
make install
```

- [ ] **Step 3: Manual regression**

Reload Obsidian. In the test vault:
1. Open the Obsidian command palette (`Cmd-P`), type "mark whole buffer" → command appears.
2. Run it → entire note becomes selected; `selectFrom` is at `{line: 0, ch: 0}`.
3. Press `C-w` → entire buffer killed and saved to kill ring.
4. Press `C-y` → buffer restored.
5. Press `Cmd-Z` to undo any test changes.

- [ ] **Step 4: Commit**

```sh
git add main.ts
git commit -m "feat: add mark-whole-buffer command

Port from upstream PR #25 (half of 288e967). New command 'mark-whole-buffer'
selects the entire note, sets the mark at buffer start. No default hotkey;
the upcoming Layer 3b plan will bind it to C-x h."
```

---

### Task 0.4: Add `transpose-chars` command

Source: upstream commit `288e967`, `transpose-chars` half. Standard emacs `C-t`. Left unbound by default because Obsidian's `C-t` is "open new tab" and we don't rebind Obsidian defaults additively in the salvage phase.

**Files:**
- Modify: `main.ts` (`onload`, new `transposeChars` helper)

- [ ] **Step 1: Add the command registration**

In `onload`, after the `recenter-top-bottom` block (around main.ts:293), insert:

```ts
		this.addCommand({
			id: 'transpose-chars',
			name: 'Transpose chars',
			editorCallback: (editor: Editor, _: MarkdownView) => {
				this.commandInvoked('transpose-chars')
				this.transposeChars(editor)
			}
		});
```

- [ ] **Step 2: Add the `transposeChars` helper**

After the `moveToNextParagraph` method (near line 605, before the new `moveToLineBoundary` from Task 0.1), insert:

```ts
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
```

Adapted from upstream: replaced `disableSelection(editor)` with the fork's `cancelSelect(editor)`.

- [ ] **Step 3: Build and install**

```sh
make install
```

- [ ] **Step 4: Manual regression**

Reload Obsidian. Open a note with text. Open command palette, run "Transpose chars" with cursor:
1. Mid-word ("foo|bar") → "fob|oar" (swapped chars to the left of cursor).
2. At line start (`ch === 0`) → no-op.
3. On a 1-char line → no-op.
4. At line end → swaps the last two chars; cursor stays at end.

- [ ] **Step 5: Commit**

```sh
git add main.ts
git commit -m "feat: add transpose-chars command

Port from upstream PR #25 (other half of 288e967). New command
'transpose-chars' swaps the two characters around the cursor (standard
emacs C-t behavior). No default hotkey because Obsidian's C-t is reserved
for new-tab; users can assign in settings."
```

---

### Task 0.5: Bump version, full regression, tag `0.4.0`

**Files:**
- Modify: `package.json` (version field)
- Modify: `manifest.json` (auto-updated by `version-bump.mjs` via `npm version`)
- Modify: `versions.json` (auto-updated)

- [ ] **Step 1: Bump version to 0.4.0**

```sh
npm version 0.4.0 --no-git-tag-version
node version-bump.mjs
```

`npm_package_version` is read from `process.env` by `version-bump.mjs:3`, so running the script after `npm version` propagates the bump to `manifest.json` and `versions.json`. The `--no-git-tag-version` flag avoids `npm`'s auto-tag (we tag deliberately at the end).

Verify: `manifest.json:5` now reads `"version": "0.4.0"`; `versions.json` has a new `"0.4.0": "0.15.0"` entry.

- [ ] **Step 2: Full Phase 0 regression checklist**

Reload Obsidian. Walk through every binding from `AGENTS.md` § Testing, plus the four salvage additions:

Layer 1 (existing, must still work):
- C-f / C-b / C-n / C-p (movement)
- M-f / M-b (word movement)
- C-a / C-e (line edges — now visual, verify)
- M-S-, / M-S-. (buffer edges)
- M-S-[ / M-S-] (paragraph)
- C-d / C-k (delete/kill)
- M-d / M-Backspace (kill word)
- C-Space + movement + C-w / M-w (mark, kill, save)
- C-y / M-y (yank, yank-pop)
- C-/ / C-S-_ (undo / redo)
- C-l (recenter)
- C-g (keyboard quit)

Salvage:
- C-a / C-e on a wrapped paragraph (Task 0.1)
- mousedown after C-Space cancels selection (Task 0.2)
- "Mark whole buffer" via command palette (Task 0.3)
- "Transpose chars" via command palette (Task 0.4)

If any regress, fix and re-commit before tagging.

- [ ] **Step 3: Commit version bump and tag**

```sh
git add package.json manifest.json versions.json
git commit -m "chore: release 0.4.0 (salvage upstream improvements)

Phase 0 of the refactor plan (docs/plans/2026-05-06-refactor-and-reorg.md):
- visual line edges for C-a / C-e on wrapped lines
- mousedown cancels mark mode
- mark-whole-buffer command
- transpose-chars command

No structural change; all four are surface-level additions/fixes on the
existing single-file main.ts. Refactor work begins next as 0.5.0."
git tag 0.4.0
```

- [ ] **Step 4: Decide whether to push**

The release workflow at `.github/workflows/release.yml` triggers on any tag push. If a public draft release is desired, push the tag now:

```sh
git push origin main
git push origin 0.4.0
```

Otherwise leave local; the tag remains as a checkpoint marker.

---

## Phase 1 — Refactor

Ten tasks total. Tooling first, then the eight extraction commits, then the release. Each commit individually verifiable: build passes, plugin loads, smoke test of a representative binding works.

The behavior contract is: **no public behavior change vs `0.4.0`.** The four bug fixes that emerge structurally during extraction (the `'backwards-kill-word'` typo from `main.ts:9`, the `console.log` leaks at `main.ts:519,522`, the `"seplacing"` typo at `main.ts:370`, the kill-ring index reset assumption) get corrected as part of their containing extraction commit and verified by unit tests on the extracted modules.

### Task 1.0: Set up vitest, eslint script, CI

Tooling must exist before Task 1.4 (KillRing extraction with tests) but can land first as scaffolding.

**Files:**
- Modify: `package.json` (devDependencies, scripts)
- Create: `vitest.config.ts`
- Modify: `Makefile` (lint target uses script)
- Create: `.github/workflows/ci.yml`

- [ ] **Step 1: Add vitest as devDependency and update scripts**

Edit `package.json`. Replace the entire `scripts` and `devDependencies` blocks:

```json
	"scripts": {
		"dev": "node esbuild.config.mjs",
		"build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
		"test": "vitest run",
		"test:watch": "vitest",
		"lint": "eslint --fix src/**/*.ts",
		"typecheck": "tsc -noEmit -skipLibCheck",
		"version": "node version-bump.mjs && git add manifest.json versions.json"
	},
	"keywords": [],
	"author": "",
	"license": "GPL-3.0",
	"devDependencies": {
		"@types/node": "^16.11.6",
		"@typescript-eslint/eslint-plugin": "5.29.0",
		"@typescript-eslint/parser": "5.29.0",
		"builtin-modules": "3.3.0",
		"esbuild": "0.17.3",
		"eslint": "^8.57.0",
		"obsidian": "latest",
		"tslib": "2.4.0",
		"typescript": "4.7.4",
		"vitest": "^1.6.0"
	}
```

(Add `eslint` if not already present; check current `node_modules/eslint/package.json` to confirm version. The lint script previously called `eslint` directly from `Makefile` without a package.json declaration.)

- [ ] **Step 2: Install new deps**

```sh
npm install
```

Expected: `vitest` and `eslint` (if newly added) appear under `node_modules`. No errors.

- [ ] **Step 3: Create `vitest.config.ts`**

Create at repo root:

```ts
import {defineConfig} from "vitest/config";

export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		environment: "node",
	},
});
```

- [ ] **Step 4: Verify vitest runs (no tests yet, should still pass)**

```sh
npm test
```

Expected: vitest reports "No test files found" and exits 0. (Vitest treats no-tests as success by default; if the version installed exits non-zero, add `passWithNoTests: true` to the config's `test` block.)

- [ ] **Step 5: Update Makefile lint target**

Edit `Makefile`. Replace the lint stanza:

```make
lint: setup
	npm run lint
```

(Was `eslint --fix main.ts`; now uses the npm script which globs `src/**/*.ts`. Note: `src/` doesn't exist yet — the script will silently no-op until Task 1.1 moves the file. Acceptable.)

- [ ] **Step 6: Create CI workflow**

Create `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

- [ ] **Step 7: Commit**

```sh
git add package.json package-lock.json vitest.config.ts Makefile .github/workflows/ci.yml
git commit -m "chore: add vitest, eslint script, CI workflow

Tooling scaffolding for the refactor. No source changes yet; src/ will be
created in the next task. CI runs lint, typecheck, test, build on every
push and PR to main."
```

---

### Task 1.1: Move source to `src/`

**Files:**
- Move: `main.ts` → `src/main.ts`
- Modify: `esbuild.config.mjs` (entryPoints)
- Modify: `tsconfig.json` (include)

- [ ] **Step 1: Move the file**

```sh
mkdir -p src
git mv main.ts src/main.ts
```

- [ ] **Step 2: Update esbuild entry point**

Edit `esbuild.config.mjs:18`. Change:

```js
	entryPoints: ["main.ts"],
```

to:

```js
	entryPoints: ["src/main.ts"],
```

- [ ] **Step 3: Update tsconfig include**

Edit `tsconfig.json:21-23`. Change:

```json
	"include": [
		"**/*.ts"
	]
```

to:

```json
	"include": [
		"src/**/*.ts"
	]
```

- [ ] **Step 4: Build and verify output unchanged**

```sh
npm run build
```

Expected: `main.js` written to repo root (esbuild's `outfile: "main.js"` is unchanged), no errors.

- [ ] **Step 5: Install and smoke-test**

```sh
make install
```

Reload Obsidian. Verify `C-f` works in a markdown note (representative single-binding test).

- [ ] **Step 6: Commit**

```sh
git add src/main.ts esbuild.config.mjs tsconfig.json
git rm main.ts
git commit -m "refactor: move source to src/

Pure relocation. esbuild entryPoints and tsconfig include updated. Build
output (main.js) unchanged."
```

---

### Task 1.2: Extract logger

**Files:**
- Create: `src/log.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create `src/log.ts`**

```ts
export interface Logger {
	debug(msg: string): void;
}

export function createLogger(prefix: string, enabled: () => boolean): Logger {
	return {
		debug(msg: string): void {
			if (!enabled()) {
				return;
			}
			console.log(prefix + ": " + msg);
		},
	};
}
```

- [ ] **Step 2: Wire logger into the plugin**

In `src/main.ts`:

1. Add an import at the top:
   ```ts
   import {createLogger, Logger} from "./log";
   ```
2. Add a private field to the class (replace `debugEnabled = false`):
   ```ts
   debugEnabled = false;
   private logger: Logger = createLogger("emacs-text-editor", () => this.debugEnabled);
   ```
3. Delete the `logDebug` method (currently lines 331-336).
4. Replace every `this.logDebug(...)` call with `this.logger.debug(...)`. There are roughly 20 such calls; an editor-wide replace works.
5. Replace the two `console.log(...)` calls inside `yankPop` (currently lines 519 and 522) with `this.logger.debug(...)`. **This fixes the leak from the design doc § Bugs.**

- [ ] **Step 3: Build, install, smoke-test**

```sh
make install
```

Reload Obsidian. Toggle `debugEnabled` off (default) — no plugin debug messages should appear in the developer console after performing kill/yank operations. Briefly set `debugEnabled = true` (e.g., temporarily edit and reload) — messages should appear, prefixed `emacs-text-editor:`.

- [ ] **Step 4: Test the logger in isolation**

Create `src/log.test.ts`:

```ts
import {describe, expect, it, vi} from "vitest";
import {createLogger} from "./log";

describe("createLogger", () => {
	it("emits messages with the prefix when enabled", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		const log = createLogger("test", () => true);
		log.debug("hello");
		expect(spy).toHaveBeenCalledWith("test: hello");
		spy.mockRestore();
	});

	it("suppresses messages when the predicate returns false", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		const log = createLogger("test", () => false);
		log.debug("hello");
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});

	it("re-evaluates the predicate on each call", () => {
		const spy = vi.spyOn(console, "log").mockImplementation(() => {});
		let enabled = false;
		const log = createLogger("test", () => enabled);
		log.debug("first");
		expect(spy).not.toHaveBeenCalled();
		enabled = true;
		log.debug("second");
		expect(spy).toHaveBeenCalledWith("test: second");
		spy.mockRestore();
	});
});
```

Run:

```sh
npm test
```

Expected: 3 passing tests.

- [ ] **Step 5: Commit**

```sh
git add src/log.ts src/log.test.ts src/main.ts
git commit -m "refactor: extract logger to src/log.ts

Pure-state logger with a predicate-based enable check. Unit tested.
Fixes the two unconditional console.log leaks in yankPop (was line 519
and 522 of the old main.ts) noted in the refactor plan's bug list."
```

---

### Task 1.3: Extract command IDs and command table

**Files:**
- Create: `src/commands/ids.ts`
- Create: `src/commands/definitions.ts`
- Create: `src/commands/register.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Create `src/commands/ids.ts`**

```ts
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
```

**Note:** The constant `COMMANDS_THAT_EXTEND_LAST_KILL_BACKWARD` references `BACKWARD_KILL_WORD` (no `s`), which is the actual registered command id. The old `main.ts:9` had `'backwards-kill-word'` — a typo. **This task fixes the bug** because the constant is now derived from the same `COMMAND_IDS` map used to register the command, so they cannot drift again.

- [ ] **Step 2: Create `src/commands/definitions.ts`**

Define the `CommandDef` type and a stub `COMMANDS` array. The full array gets populated in Step 3 once the type is in place.

```ts
import type {Editor, MarkdownView, Plugin} from "obsidian";
import type {CommandId} from "./ids";

export interface HotkeyDef {
	modifiers: string[];
	key: string;
}

export interface CommandDef {
	id: CommandId;
	name: string;
	hotkeys?: HotkeyDef[];
	editorCallback: (editor: Editor, view: MarkdownView, plugin: Plugin) => void | Promise<void>;
}
```

- [ ] **Step 3: Create `src/commands/register.ts`**

```ts
import type {Plugin} from "obsidian";
import type {CommandDef} from "./definitions";

export function registerCommands(plugin: Plugin, commands: CommandDef[]): void {
	for (const cmd of commands) {
		plugin.addCommand({
			id: cmd.id,
			name: cmd.name,
			hotkeys: cmd.hotkeys,
			editorCallback: (editor, view) => cmd.editorCallback(editor, view, plugin),
		});
	}
}
```

- [ ] **Step 4: Move command definitions out of `onload`**

This is the largest mechanical edit in the plan. In `src/main.ts`, replace each of the 27 `this.addCommand({ ... })` calls in `onload` with an entry in a new `buildCommands(plugin)` function that returns `CommandDef[]`. The function lives at the top of `src/main.ts` for now (it'll move to `src/commands/definitions.ts` in Task 1.8).

Pattern: every existing entry like

```ts
this.addCommand({
	id: 'forward-char',
	name: 'Forward char',
	hotkeys: [{modifiers: ["Ctrl"], key: "f"}],
	editorCallback: (editor: Editor, _: MarkdownView) => {
		this.commandInvoked("forward-char")
		this.withSelectionUpdate(editor, () => {
			this.cancelYankPop();
			editor.exec("goRight")
		})
	}
});
```

becomes an entry in the array, with `this` references replaced by the `plugin` parameter cast to `EmacsTextEditorPlugin`:

```ts
{
	id: COMMAND_IDS.FORWARD_CHAR,
	name: "Forward char",
	hotkeys: [{modifiers: ["Ctrl"], key: "f"}],
	editorCallback: (editor, _, plugin) => {
		const p = plugin as EmacsTextEditorPlugin;
		p.commandInvoked(COMMAND_IDS.FORWARD_CHAR);
		p.withSelectionUpdate(editor, () => {
			p.cancelYankPop();
			editor.exec("goRight");
		});
	},
},
```

Then `onload` collapses to:

```ts
async onload() {
	this.killRing = new Array<string>(this.killRingMaxSize);
	this.logger.debug("loading plugin: Emacs text editor");
	this.registerDomEvent(document, "mousedown", () => {
		this.selectFrom = undefined;
	});
	registerCommands(this, buildCommands(this));
}
```

This task is mechanical but tedious. Take it carefully; do all 27 entries before building.

Add at the top of `src/main.ts`:

```ts
import {COMMAND_IDS} from "./commands/ids";
import {registerCommands} from "./commands/register";
import type {CommandDef} from "./commands/definitions";

function buildCommands(plugin: EmacsTextEditorPlugin): CommandDef[] {
	return [
		// ... 27 entries, one per existing addCommand call ...
	];
}
```

- [ ] **Step 5: Build and verify TypeScript catches drift**

```sh
npm run build
```

Expected: build passes. The `as const` type on `COMMAND_IDS` plus the `CommandId` type means any typo in an entry's `id` is a compile error — verify by deliberately introducing one:

```sh
# In src/main.ts, change one entry's id from COMMAND_IDS.FORWARD_CHAR to "forward-charr"
# Run npm run build → should fail with: Type '"forward-charr"' is not assignable to type ...
# Revert.
```

(Don't commit this step's tampering; just confirm the type system works.)

- [ ] **Step 6: Update `commandInvoked` to use the typed sets**

In `src/main.ts`, find `commandInvoked` (currently main.ts:320-329). Replace:

```ts
const ExtendLastKillOnRepeatCommands = ['kill-word', 'backward-kill-word', 'kill-line']
const ExtendLastKillBackwardsOnRepeatCommands = ['backwards-kill-word']
```

(Delete these top-level constants entirely.)

And rewrite `commandInvoked`:

```ts
commandInvoked(id: CommandId) {
	this.logger.debug("command invoked: " + id);
	if (id !== COMMAND_IDS.YANK_POP) {
		this.cancelYankPop();
	}
	const isRepeat = this.lastCommandInvoked === id;
	this.extendLastKill = isRepeat && COMMANDS_THAT_EXTEND_LAST_KILL_FORWARD.has(id);
	this.extendLastKillBackwards = isRepeat && COMMANDS_THAT_EXTEND_LAST_KILL_BACKWARD.has(id);
	this.lastCommandInvoked = id;
}
```

Update the field type `lastCommandInvoked?: CommandId = undefined;` to use the new type.

Update the import block in `src/main.ts` to also bring in the predicate sets:

```ts
import {
	COMMAND_IDS,
	COMMANDS_THAT_EXTEND_LAST_KILL_BACKWARD,
	COMMANDS_THAT_EXTEND_LAST_KILL_FORWARD,
	type CommandId,
} from "./commands/ids";
```

This is where the **`'backwards-kill-word'` typo bug fix** materializes: the sets contain `COMMAND_IDS.BACKWARD_KILL_WORD`, and the dispatcher in `backward-kill-word`'s callback now also references `COMMAND_IDS.BACKWARD_KILL_WORD`. Same constant, no drift possible.

- [ ] **Step 7: Build, install, smoke-test**

```sh
make install
```

Reload Obsidian. Verify all 27 bindings still fire (run through the `AGENTS.md` § Testing list). Critically: verify that **`M-Backspace` now extends the kill ring on repeat** (the bug fix). Sequence:

1. Type three words: `aaa bbb ccc`
2. Cursor at end of line.
3. `M-Backspace` → kill "ccc"
4. `M-Backspace` again → kill " bbb"
5. `C-y` → should yield "ccc bbb" (concatenated in reverse order)

Before this commit, `M-Backspace` second invocation overwrites instead of extending.

- [ ] **Step 8: Commit**

```sh
git add src/commands/ src/main.ts
git commit -m "refactor: extract command IDs, definitions, and registrar

Replaces the 27 inline addCommand calls in onload with a data-driven table
in buildCommands(). Command IDs become a const-as map with a derived
CommandId type, so the registered id and the id used in commandInvoked()
cannot drift.

Fixes the 'backwards-kill-word' vs 'backward-kill-word' typo
(refactor plan § Bugs to fix). Backward-kill-word now correctly extends
the kill ring on repeat, matching emacs."
```

---

### Task 1.4: Extract `KillRing` class with unit tests

**Files:**
- Create: `src/kill-ring/kill-ring.ts`
- Create: `src/kill-ring/kill-ring.test.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write `src/kill-ring/kill-ring.test.ts` (TDD — failing first)**

```ts
import {beforeEach, describe, expect, it} from "vitest";
import {KillRing} from "./kill-ring";

describe("KillRing", () => {
	let ring: KillRing;

	beforeEach(() => {
		ring = new KillRing(4); // small max for ring-wrap tests
	});

	describe("save and current", () => {
		it("returns undefined when empty", () => {
			expect(ring.current()).toBeUndefined();
		});

		it("returns the last saved item", () => {
			ring.save("a");
			expect(ring.current()).toBe("a");
		});

		it("advances current to the most recent save", () => {
			ring.save("a");
			ring.save("b");
			expect(ring.current()).toBe("b");
		});

		it("wraps around when exceeding maxSize", () => {
			ring.save("a");
			ring.save("b");
			ring.save("c");
			ring.save("d");
			ring.save("e"); // overwrites slot of "a"
			expect(ring.current()).toBe("e");
		});
	});

	describe("save with extendForward", () => {
		it("appends text to the current entry without advancing the index", () => {
			ring.save("foo");
			ring.save(" bar", {extendForward: true});
			expect(ring.current()).toBe("foo bar");
		});
	});

	describe("save with extendBackward", () => {
		it("prepends text to the current entry without advancing the index", () => {
			ring.save("bar");
			ring.save("foo ", {extendBackward: true});
			expect(ring.current()).toBe("foo bar");
		});
	});

	describe("rotate (yank-pop)", () => {
		it("returns undefined when empty", () => {
			expect(ring.rotate()).toBeUndefined();
		});

		it("returns the previous entry on each call", () => {
			ring.save("a");
			ring.save("b");
			ring.save("c");
			expect(ring.rotate()).toBe("b");
			expect(ring.rotate()).toBe("a");
		});

		it("wraps to the most-recent entry past the start", () => {
			ring.save("a");
			ring.save("b");
			ring.save("c");
			expect(ring.rotate()).toBe("b");
			expect(ring.rotate()).toBe("a");
			expect(ring.rotate()).toBe("c"); // wraps
		});
	});

	describe("size and bounds", () => {
		it("never grows beyond maxSize", () => {
			for (let i = 0; i < 10; i++) {
				ring.save(`item${i}`);
			}
			expect(ring.size()).toBe(4);
		});
	});
});
```

- [ ] **Step 2: Run tests to verify they fail (no implementation yet)**

```sh
npm test
```

Expected: all tests fail with "Cannot find module './kill-ring'" or similar.

- [ ] **Step 3: Implement `src/kill-ring/kill-ring.ts`**

```ts
export interface SaveOptions {
	extendForward?: boolean;
	extendBackward?: boolean;
}

export class KillRing {
	private ring: (string | undefined)[];
	private endIndex = -1;
	private currentIndex = -1;

	constructor(private readonly maxSize: number = 120) {
		this.ring = new Array<string | undefined>(maxSize);
	}

	save(text: string, opts: SaveOptions = {}): void {
		if ((opts.extendForward || opts.extendBackward) && this.currentIndex >= 0) {
			const existing = this.ring[this.currentIndex] ?? "";
			this.ring[this.currentIndex] = opts.extendBackward ? text + existing : existing + text;
			return;
		}
		this.currentIndex++;
		if (this.currentIndex >= this.maxSize) {
			this.currentIndex = 0;
		}
		if (this.currentIndex > this.endIndex) {
			this.endIndex = this.currentIndex;
		}
		this.ring[this.currentIndex] = text;
	}

	current(): string | undefined {
		if (this.currentIndex < 0) {
			return undefined;
		}
		return this.ring[this.currentIndex];
	}

	rotate(): string | undefined {
		if (this.endIndex < 0) {
			return undefined;
		}
		this.currentIndex--;
		if (this.currentIndex < 0) {
			this.currentIndex = this.endIndex;
		}
		return this.ring[this.currentIndex];
	}

	size(): number {
		return this.endIndex + 1;
	}
}
```

- [ ] **Step 4: Run tests to verify they pass**

```sh
npm test
```

Expected: all tests pass.

- [ ] **Step 5: Wire `KillRing` into the plugin**

In `src/main.ts`:

1. Import: `import {KillRing} from "./kill-ring/kill-ring";`
2. Replace the field declarations:
   ```ts
   killRing: string[] = []
   killRingEndIndex = -1
   killRingMaxSize = 120
   yankIndex = -1
   ```
   with:
   ```ts
   private readonly killRing = new KillRing(120);
   ```
3. Delete the `killRing = new Array<string>(this.killRingMaxSize)` line from `onload` (no longer needed; constructor handles allocation).
4. Rewrite `killRingSave` to delegate to the class:
   ```ts
   async killRingSave(text: string) {
       this.killRing.save(text, {
           extendForward: this.extendLastKill,
           extendBackward: this.extendLastKillBackwards,
       });
       const clipboardText = await navigator.clipboard.readText();
       const stored = this.killRing.current();
       if (stored !== undefined && clipboardText !== stored) {
           await navigator.clipboard.writeText(stored);
           this.logger.debug("wrote text to navigator clipboard: " + stored);
       }
   }
   ```
5. In `yank` (currently main.ts:480-502), replace `this.killRing[this.yankIndex]` with `this.killRing.current()`. Replace the `this.yankPopIndex = this.yankIndex - 1` line with a yank-pop session start (handled in Task 1.5; for now, leave a comment `// TODO(yank-pop): track session in YankPopSession`).
6. In `yankPop` (currently main.ts:511-530), this code references `this.killRing[this.yankPopIndex]` and decrements `this.yankPopIndex`. Replace with `this.killRing.rotate()`.

This is a substantive rewrite of `yank` and `yankPop` — keep the diff small by leaving the old yank-pop tracking fields (`yankStart`, `yankEnd`, `yankPopIndex`) in place; Task 1.5 cleans them up.

- [ ] **Step 6: Build, install, manual regression**

```sh
make install
```

Reload Obsidian. Run the kill-ring section of `AGENTS.md` § Testing:

1. Kill 3 distinct strings.
2. `C-y` yanks the most recent.
3. `M-y` rotates through the older two.
4. `M-d M-d M-d` extends a single kill (verify via `C-y` showing concatenated text).
5. `M-Backspace M-Backspace M-Backspace` extends backward (concatenated in reverse — Task 1.3's typo fix is exercised here too).
6. `C-w` (kill-region) on a selection saves correctly.

- [ ] **Step 7: Commit**

```sh
git add src/kill-ring/ src/main.ts
git commit -m "refactor: extract KillRing to src/kill-ring/

Pure-state class with no Obsidian or DOM dependency. 11 unit tests cover
basic save/current, ring wrap-around, extend-forward and extend-backward
on repeat, and rotate (yank-pop). The clipboard sync remains plugin-side.

The previous fields (killRing, killRingEndIndex, yankIndex, killRingMaxSize)
collapse into a single private readonly KillRing instance."
```

---

### Task 1.5: Extract `YankPopSession`

**Files:**
- Create: `src/kill-ring/yank-pop.ts`
- Create: `src/kill-ring/yank-pop.test.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write `src/kill-ring/yank-pop.test.ts` (failing first)**

```ts
import {describe, expect, it} from "vitest";
import {YankPopSession} from "./yank-pop";

describe("YankPopSession", () => {
	it("starts inactive", () => {
		const session = new YankPopSession();
		expect(session.isActive()).toBe(false);
		expect(session.range()).toBeUndefined();
	});

	it("becomes active after start", () => {
		const session = new YankPopSession();
		session.start({line: 0, ch: 0}, {line: 0, ch: 5});
		expect(session.isActive()).toBe(true);
		expect(session.range()).toEqual({
			start: {line: 0, ch: 0},
			end: {line: 0, ch: 5},
		});
	});

	it("becomes inactive after cancel", () => {
		const session = new YankPopSession();
		session.start({line: 0, ch: 0}, {line: 0, ch: 5});
		session.cancel();
		expect(session.isActive()).toBe(false);
		expect(session.range()).toBeUndefined();
	});

	it("update replaces the end position only", () => {
		const session = new YankPopSession();
		session.start({line: 0, ch: 0}, {line: 0, ch: 5});
		session.updateEnd({line: 0, ch: 7});
		expect(session.range()).toEqual({
			start: {line: 0, ch: 0},
			end: {line: 0, ch: 7},
		});
	});

	it("update on inactive session is a no-op", () => {
		const session = new YankPopSession();
		session.updateEnd({line: 0, ch: 7});
		expect(session.isActive()).toBe(false);
	});
});
```

- [ ] **Step 2: Run, verify failing**

```sh
npm test
```

- [ ] **Step 3: Implement `src/kill-ring/yank-pop.ts`**

```ts
import type {EditorPosition} from "obsidian";

export interface YankPopRange {
	start: EditorPosition;
	end: EditorPosition;
}

export class YankPopSession {
	private startPos?: EditorPosition;
	private endPos?: EditorPosition;

	start(start: EditorPosition, end: EditorPosition): void {
		this.startPos = start;
		this.endPos = end;
	}

	cancel(): void {
		this.startPos = undefined;
		this.endPos = undefined;
	}

	isActive(): boolean {
		return this.startPos !== undefined && this.endPos !== undefined;
	}

	range(): YankPopRange | undefined {
		if (!this.isActive()) {
			return undefined;
		}
		return {start: this.startPos!, end: this.endPos!};
	}

	updateEnd(end: EditorPosition): void {
		if (!this.isActive()) {
			return;
		}
		this.endPos = end;
	}
}
```

- [ ] **Step 4: Verify tests pass**

```sh
npm test
```

- [ ] **Step 5: Wire into the plugin**

In `src/main.ts`:

1. Import: `import {YankPopSession} from "./kill-ring/yank-pop";`
2. Replace the fields:
   ```ts
   yankEnd?: EditorPosition = undefined
   yankStart?: EditorPosition = undefined
   yankPopIndex = -1
   ```
   with:
   ```ts
   private readonly yankPop = new YankPopSession();
   ```
3. In `cancelYankPop` (currently main.ts:504-509), replace the body:
   ```ts
   cancelYankPop() {
       this.yankPop.cancel();
       this.logger.debug("yank pop stopped");
   }
   ```
4. In `yank` (currently main.ts:480-502), replace the trailing yank-pop tracking block:
   ```ts
   this.yankStart = position;
   editor.setCursor(this.yankStart.line, this.yankStart.ch + clipboardText.length);
   this.yankEnd = editor.getCursor()
   this.yankPopIndex = this.yankIndex - 1;
   ```
   with:
   ```ts
   const newEnd = {line: position.line, ch: position.ch + clipboardText.length};
   editor.setCursor(newEnd);
   this.yankPop.start(position, newEnd);
   ```
5. In `yankPop` (currently main.ts:511-530), rewrite around the session:
   ```ts
   async yankPop(editor: Editor) {
       this.logger.debug("yank pop started");
       const range = this.yankPop.range();
       if (!range) {
           this.logger.debug("can't yank pop");
           return;
       }
       const text = this.killRing.rotate();
       if (text === undefined) {
           this.logger.debug("kill ring empty");
           return;
       }
       this.cancelSelect(editor);
       editor.setSelection(range.start, range.end);
       editor.replaceSelection(text);
       const newEnd = {line: range.start.line, ch: range.start.ch + text.length};
       editor.setCursor(newEnd);
       this.yankPop.updateEnd(newEnd);
       this.logger.debug("yank popped '" + text + "'");
   }
   ```

- [ ] **Step 6: Build, install, regression**

```sh
make install
```

Reload Obsidian. Test yank-pop semantics:

1. Kill three distinct strings: "alpha", "beta", "gamma".
2. `C-y` → "gamma" inserted at cursor.
3. `M-y` → "gamma" replaced with "beta".
4. `M-y` → "beta" replaced with "alpha".
5. `M-y` → "alpha" replaced with "gamma" (wrap).
6. Move cursor (`C-f`) → yank-pop cancels.
7. `M-y` after move → no-op.

- [ ] **Step 7: Commit**

```sh
git add src/kill-ring/yank-pop.ts src/kill-ring/yank-pop.test.ts src/main.ts
git commit -m "refactor: extract YankPopSession to src/kill-ring/yank-pop.ts

Tracks the start/end of the active yank insertion. Replaces three loose
fields (yankStart, yankEnd, yankPopIndex) with one cohesive class.
Rotation through the kill ring now goes through KillRing.rotate(); the
session only owns positional state."
```

---

### Task 1.6: Extract `MarkState`

**Files:**
- Create: `src/selection/mark.ts`
- Create: `src/selection/mark.test.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write `src/selection/mark.test.ts` (failing first)**

```ts
import {describe, expect, it} from "vitest";
import {MarkState} from "./mark";

describe("MarkState", () => {
	it("starts inactive", () => {
		const mark = new MarkState();
		expect(mark.isActive()).toBe(false);
		expect(mark.origin()).toBeUndefined();
	});

	it("becomes active after set", () => {
		const mark = new MarkState();
		mark.set({line: 1, ch: 5});
		expect(mark.isActive()).toBe(true);
		expect(mark.origin()).toEqual({line: 1, ch: 5});
	});

	it("becomes inactive after clear", () => {
		const mark = new MarkState();
		mark.set({line: 1, ch: 5});
		mark.clear();
		expect(mark.isActive()).toBe(false);
		expect(mark.origin()).toBeUndefined();
	});

	it("set replaces the previous origin", () => {
		const mark = new MarkState();
		mark.set({line: 1, ch: 5});
		mark.set({line: 2, ch: 0});
		expect(mark.origin()).toEqual({line: 2, ch: 0});
	});
});
```

- [ ] **Step 2: Run, verify failing**

```sh
npm test
```

- [ ] **Step 3: Implement `src/selection/mark.ts`**

```ts
import type {EditorPosition} from "obsidian";

export class MarkState {
	private originPos?: EditorPosition;

	set(pos: EditorPosition): void {
		this.originPos = pos;
	}

	clear(): void {
		this.originPos = undefined;
	}

	isActive(): boolean {
		return this.originPos !== undefined;
	}

	origin(): EditorPosition | undefined {
		return this.originPos;
	}
}
```

- [ ] **Step 4: Verify tests pass**

```sh
npm test
```

- [ ] **Step 5: Wire into the plugin**

In `src/main.ts`:

1. Import: `import {MarkState} from "./selection/mark";`
2. Replace the field `selectFrom?: EditorPosition = undefined` with `private readonly mark = new MarkState();`.
3. Replace every `this.selectFrom !== undefined` with `this.mark.isActive()`.
4. Replace every read of `this.selectFrom` (e.g., `editor.setSelection(this.selectFrom, ...)`) with `this.mark.origin()`. Add non-null assertions where TypeScript demands them, guarded by `isActive()` checks above.
5. Replace `this.selectFrom = pos` with `this.mark.set(pos)`.
6. Replace `this.selectFrom = undefined` (in `cancelSelect` and the mousedown handler) with `this.mark.clear()`.
7. In `selectionIsActive`, replace the body with `return this.mark.isActive();` (or delete the method and use `this.mark.isActive()` at call sites).

The mousedown handler in `onload` becomes:
```ts
this.registerDomEvent(document, "mousedown", () => {
    this.mark.clear();
});
```

- [ ] **Step 6: Build, install, regression**

```sh
make install
```

Reload Obsidian. Test mark-region:
1. `C-Space` → mark set.
2. Move with `C-f`/`C-n` → selection extends.
3. `C-w` → kill region.
4. `C-y` → yank back.
5. `C-Space` then mouse-click elsewhere → mark cleared (Task 0.2 still works).
6. `C-g` after `C-Space` → mark cleared.

- [ ] **Step 7: Commit**

```sh
git add src/selection/ src/main.ts
git commit -m "refactor: extract MarkState to src/selection/mark.ts

Replaces the loose selectFrom field with a class that owns the mark
lifecycle (set, clear, isActive, origin). Unit tested. No behavior change."
```

---

### Task 1.7: Extract `RepeatDetector`

**Files:**
- Create: `src/tracking/repeat-detector.ts`
- Create: `src/tracking/repeat-detector.test.ts`
- Modify: `src/main.ts`

- [ ] **Step 1: Write `src/tracking/repeat-detector.test.ts`**

```ts
import {describe, expect, it} from "vitest";
import {RepeatDetector} from "./repeat-detector";

describe("RepeatDetector", () => {
	it("returns isRepeat=false on first track", () => {
		const detector = new RepeatDetector();
		expect(detector.track("kill-line").isRepeat).toBe(false);
	});

	it("returns isRepeat=true when the same id is tracked twice in a row", () => {
		const detector = new RepeatDetector();
		detector.track("kill-line");
		expect(detector.track("kill-line").isRepeat).toBe(true);
	});

	it("returns isRepeat=false when a different id is tracked", () => {
		const detector = new RepeatDetector();
		detector.track("kill-line");
		expect(detector.track("kill-word").isRepeat).toBe(false);
	});

	it("last() returns the most recent id", () => {
		const detector = new RepeatDetector();
		expect(detector.last()).toBeUndefined();
		detector.track("forward-char");
		expect(detector.last()).toBe("forward-char");
		detector.track("backward-char");
		expect(detector.last()).toBe("backward-char");
	});
});
```

- [ ] **Step 2: Run, verify failing**

```sh
npm test
```

- [ ] **Step 3: Implement `src/tracking/repeat-detector.ts`**

```ts
export class RepeatDetector {
	private lastId?: string;

	track(id: string): {isRepeat: boolean} {
		const isRepeat = this.lastId === id;
		this.lastId = id;
		return {isRepeat};
	}

	last(): string | undefined {
		return this.lastId;
	}
}
```

- [ ] **Step 4: Verify tests pass**

```sh
npm test
```

- [ ] **Step 5: Wire into `commandInvoked`**

In `src/main.ts`:

1. Import: `import {RepeatDetector} from "./tracking/repeat-detector";`
2. Replace `lastCommandInvoked?: CommandId = undefined;` with `private readonly repeats = new RepeatDetector();`.
3. Rewrite `commandInvoked`:
   ```ts
   commandInvoked(id: CommandId) {
       this.logger.debug("command invoked: " + id);
       if (id !== COMMAND_IDS.YANK_POP) {
           this.cancelYankPop();
       }
       const {isRepeat} = this.repeats.track(id);
       this.extendLastKill = isRepeat && COMMANDS_THAT_EXTEND_LAST_KILL_FORWARD.has(id);
       this.extendLastKillBackwards = isRepeat && COMMANDS_THAT_EXTEND_LAST_KILL_BACKWARD.has(id);
   }
   ```

- [ ] **Step 6: Build, install, regression**

```sh
make install
```

Reload Obsidian. Verify extend-on-repeat still works (M-d M-d M-d → concatenated kill).

- [ ] **Step 7: Commit**

```sh
git add src/tracking/ src/main.ts
git commit -m "refactor: extract RepeatDetector to src/tracking/

Replaces the lastCommandInvoked field and inline isRepeat boolean with
a tiny class. Unit tested. No behavior change."
```

---

### Task 1.8: Extract editor-ops modules

**Files:**
- Create: `src/editor-ops/movement.ts`
- Create: `src/editor-ops/editing.ts`
- Create: `src/editor-ops/paragraph.ts`
- Create: `src/editor-ops/recenter.ts`
- Create: `src/editor-ops/visual-line.ts` (the `moveToLineBoundary` helper from Task 0.1)
- Move: command definitions out of `src/main.ts` into `src/commands/definitions.ts`
- Modify: `src/main.ts` (becomes thin wiring)

This is the largest task by raw lines moved but mechanical: take the existing methods on `EmacsTextEditorPlugin` and convert them to free functions that take their dependencies as parameters.

- [ ] **Step 1: Create `src/editor-ops/movement.ts`**

Move these methods from the plugin class into module-level functions:

```ts
import type {Editor, MarkdownView} from "obsidian";
import {EditorSelection} from "@codemirror/state";
import {EditorView} from "@codemirror/view";
import type {MarkState} from "../selection/mark";
import type {Logger} from "../log";

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
	if (!start) {
		return;
	}
	const end = editor.getCursor();
	logger.debug("extending selection to cursor at " + JSON.stringify(end));
	editor.setSelection(start, end);
}

export function getCodeMirrorView(markdownView: MarkdownView): EditorView | undefined {
	return (markdownView as MarkdownView & {editor?: {cm?: EditorView}}).editor?.cm;
}

export function moveToLineBoundary(
	editor: Editor,
	view: EditorView,
	mark: MarkState,
	forward: boolean,
): void {
	const cmSelection = view.state.selection.main;
	const headCursor = EditorSelection.cursor(cmSelection.head, cmSelection.assoc);
	const newRange = view.moveToLineBoundary(headCursor, forward);
	const newPos = editor.offsetToPos(newRange.head);
	const origin = mark.origin();
	if (origin) {
		editor.setSelection(origin, newPos);
	} else {
		editor.setCursor(newPos);
	}
}
```

- [ ] **Step 2: Create `src/editor-ops/editing.ts`**

Move `withDelete`, `withKill`, `withSelect`, `replaceSelectedText`, `killLine`, `killWord`, `killRegion`, `yank`. Each becomes a free function that accepts the dependencies it needs.

```ts
import type {Editor, EditorPosition} from "obsidian";
import type {KillRing} from "../kill-ring/kill-ring";
import type {YankPopSession} from "../kill-ring/yank-pop";
import type {MarkState} from "../selection/mark";
import type {Logger} from "../log";

export interface KillContext {
	killRing: KillRing;
	mark: MarkState;
	yankPop: YankPopSession;
	logger: Logger;
	extendLastKill: () => boolean;
	extendLastKillBackwards: () => boolean;
}

export async function killRingSave(text: string, ctx: KillContext): Promise<void> {
	ctx.killRing.save(text, {
		extendForward: ctx.extendLastKill(),
		extendBackward: ctx.extendLastKillBackwards(),
	});
	const clipboardText = await navigator.clipboard.readText();
	const stored = ctx.killRing.current();
	if (stored !== undefined && clipboardText !== stored) {
		await navigator.clipboard.writeText(stored);
		ctx.logger.debug("wrote text to navigator clipboard: " + stored);
	}
}

export function cancelSelect(editor: Editor, ctx: KillContext): void {
	ctx.logger.debug("clearing selection");
	editor.setSelection(editor.getCursor(), editor.getCursor());
	ctx.mark.clear();
}

export async function withDelete(editor: Editor, ctx: KillContext, callback: () => void): Promise<void> {
	const cursorBefore = editor.getCursor();
	callback();
	const cursorAfter = editor.getCursor();
	editor.setSelection(cursorBefore, cursorAfter);
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
	editor.setSelection(start, end);
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
	if (save) {
		const selectedText = editor.getSelection();
		await killRingSave(selectedText, ctx);
	}
	editor.replaceSelection(text);
	cancelSelect(editor, ctx);
}

export async function withKill(editor: Editor, ctx: KillContext, callback: () => void): Promise<void> {
	withSelect(editor, ctx, callback);
	await replaceSelectedText(editor, ctx, "", true);
}

export async function killLine(editor: Editor, ctx: KillContext): Promise<void> {
	const cursor = editor.getCursor();
	const line = editor.getLine(cursor.line);
	if (line === "") {
		await withKill(editor, ctx, () => {
			editor.exec("goRight");
		});
		return;
	}
	const textToBeRetained = line.slice(0, cursor.ch);
	const textToBeCut = line.slice(cursor.ch);
	await killRingSave(textToBeCut, ctx);
	editor.setLine(cursor.line, textToBeRetained);
	editor.setCursor(cursor.line, cursor.ch);
}

export async function killRegion(editor: Editor, ctx: KillContext): Promise<void> {
	await replaceSelectedText(editor, ctx, "", true);
}

export async function yank(editor: Editor, ctx: KillContext): Promise<void> {
	ctx.yankPop.cancel();
	const clipboardText = await navigator.clipboard.readText();
	const yankText = ctx.killRing.current();
	if (yankText !== clipboardText) {
		await killRingSave(clipboardText, ctx);
	}
	const position = editor.getCursor();
	if (!ctx.mark.isActive()) {
		editor.replaceRange(clipboardText, position);
	} else {
		editor.replaceSelection(clipboardText);
		cancelSelect(editor, ctx);
	}
	const newEnd: EditorPosition = {line: position.line, ch: position.ch + clipboardText.length};
	editor.setCursor(newEnd);
	ctx.yankPop.start(position, newEnd);
}

export async function yankPop(editor: Editor, ctx: KillContext): Promise<void> {
	const range = ctx.yankPop.range();
	if (!range) {
		ctx.logger.debug("can't yank pop");
		return;
	}
	const text = ctx.killRing.rotate();
	if (text === undefined) {
		return;
	}
	cancelSelect(editor, ctx);
	editor.setSelection(range.start, range.end);
	editor.replaceSelection(text);
	const newEnd: EditorPosition = {line: range.start.line, ch: range.start.ch + text.length};
	editor.setCursor(newEnd);
	ctx.yankPop.updateEnd(newEnd);
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
	const transposed =
		line.slice(0, swapLeftIndex) +
		line[swapRightIndex] +
		line[swapLeftIndex] +
		line.slice(swapRightIndex + 1);
	editor.replaceRange(
		transposed,
		{line: cursor.line, ch: 0},
		{line: cursor.line, ch: line.length},
	);
	editor.setCursor({line: cursor.line, ch: Math.min(swapRightIndex + 1, transposed.length)});
}
```

- [ ] **Step 3: Create `src/editor-ops/paragraph.ts`**

Move the existing `moveToNextParagraph` and `Direction` enum verbatim. Drop the `this.` (none in the original — it's already a pure method).

```ts
import type {Editor} from "obsidian";

export enum Direction {
	Forward,
	Backward,
}

export function moveToNextParagraph(editor: Editor, direction: Direction): void {
	// ... full body copied verbatim from main.ts:554-605, with `editor` parameter ...
}
```

- [ ] **Step 4: Create `src/editor-ops/recenter.ts`**

```ts
import type {Editor} from "obsidian";

export function recenterToBottom(editor: Editor): void {
	const cursor = editor.getCursor();
	editor.scrollIntoView(
		{from: {line: cursor.line, ch: cursor.ch}, to: {line: cursor.line, ch: cursor.ch}},
		true,
	);
}
```

- [ ] **Step 5: Move command definitions to `src/commands/definitions.ts`**

The 27 entries from `buildCommands()` move out of `src/main.ts` and into `src/commands/definitions.ts`. The function signature becomes:

```ts
export function buildCommands(plugin: EmacsTextEditorPlugin): CommandDef[] {
	// ... 27 entries, each calling into the editor-ops modules ...
}
```

`EmacsTextEditorPlugin` must be importable. Since the plugin class lives in `src/main.ts` and `definitions.ts` lives under `src/commands/`, an import cycle is created. Break it by extracting just the type into a small interface:

Create `src/commands/plugin-context.ts`:

```ts
import type {KillRing} from "../kill-ring/kill-ring";
import type {YankPopSession} from "../kill-ring/yank-pop";
import type {MarkState} from "../selection/mark";
import type {RepeatDetector} from "../tracking/repeat-detector";
import type {Logger} from "../log";
import type {CommandId} from "./ids";

export interface PluginContext {
	killRing: KillRing;
	yankPop: YankPopSession;
	mark: MarkState;
	repeats: RepeatDetector;
	logger: Logger;
	commandInvoked(id: CommandId): void;
	extendLastKill: boolean;
	extendLastKillBackwards: boolean;
}
```

Have `EmacsTextEditorPlugin` implement `PluginContext`. `definitions.ts` imports only `PluginContext`.

- [ ] **Step 6: Reduce `src/main.ts` to wiring**

After all extractions, `src/main.ts` should look approximately:

```ts
import {Plugin} from "obsidian";
import {createLogger, Logger} from "./log";
import {KillRing} from "./kill-ring/kill-ring";
import {YankPopSession} from "./kill-ring/yank-pop";
import {MarkState} from "./selection/mark";
import {RepeatDetector} from "./tracking/repeat-detector";
import {
	COMMAND_IDS,
	COMMANDS_THAT_EXTEND_LAST_KILL_BACKWARD,
	COMMANDS_THAT_EXTEND_LAST_KILL_FORWARD,
	type CommandId,
} from "./commands/ids";
import {buildCommands} from "./commands/definitions";
import {registerCommands} from "./commands/register";
import type {PluginContext} from "./commands/plugin-context";

export default class EmacsTextEditorPlugin extends Plugin implements PluginContext {
	debugEnabled = false;
	readonly logger: Logger = createLogger("emacs-text-editor", () => this.debugEnabled);
	readonly killRing = new KillRing(120);
	readonly yankPop = new YankPopSession();
	readonly mark = new MarkState();
	readonly repeats = new RepeatDetector();
	extendLastKill = false;
	extendLastKillBackwards = false;

	onload() {
		this.logger.debug("loading plugin: Emacs text editor");
		this.registerDomEvent(document, "mousedown", () => {
			this.mark.clear();
		});
		registerCommands(this, buildCommands(this));
	}

	onunload() {
		this.logger.debug("unloading plugin: Emacs text editor");
	}

	commandInvoked(id: CommandId): void {
		this.logger.debug("command invoked: " + id);
		if (id !== COMMAND_IDS.YANK_POP) {
			this.yankPop.cancel();
		}
		const {isRepeat} = this.repeats.track(id);
		this.extendLastKill = isRepeat && COMMANDS_THAT_EXTEND_LAST_KILL_FORWARD.has(id);
		this.extendLastKillBackwards = isRepeat && COMMANDS_THAT_EXTEND_LAST_KILL_BACKWARD.has(id);
	}
}
```

Target: under 100 lines.

- [ ] **Step 7: Build, install, full regression**

```sh
make install
```

Reload Obsidian. Walk through the entire `AGENTS.md` § Testing checklist plus all four salvage commands. Every binding must work.

If any regress: fix in-place. Do not advance.

- [ ] **Step 8: Commit**

```sh
git add src/editor-ops/ src/commands/ src/main.ts
git commit -m "refactor: extract editor-ops modules and command definitions

Final extraction step of the refactor plan:
- src/editor-ops/movement.ts: cursor movement + selection helpers
- src/editor-ops/editing.ts: kill, yank, transpose; takes a KillContext
- src/editor-ops/paragraph.ts: forward/backward paragraph
- src/editor-ops/recenter.ts: scroll-into-view
- src/commands/definitions.ts: full 27-entry command table
- src/commands/plugin-context.ts: interface decoupling definitions from main.ts

main.ts is now ~50 lines of wiring. Each editor-op is a free function
taking its dependencies as parameters, ready for reuse by the upcoming
in-input bindings (Layer 2)."
```

---

### Task 1.9: Tag `0.5.0`, update README and AGENTS.md

**Files:**
- Modify: `package.json`, `manifest.json`, `versions.json` (via `npm version`)
- Modify: `README.md` (note the new src layout if relevant)
- Modify: `AGENTS.md` (already covers the structure conceptually; verify accuracy)

- [ ] **Step 1: Verify the test vault still loads the plugin**

Final smoke test before tagging:

```sh
make install
```

Reload Obsidian. Walk the full `AGENTS.md` § Testing list one more time.

- [ ] **Step 2: Bump version to 0.5.0**

```sh
npm version 0.5.0 --no-git-tag-version
node version-bump.mjs
```

- [ ] **Step 3: Update README.md if needed**

If the README references `main.ts` at the repo root, update to mention `src/main.ts`. If it mentions running tests, document `npm test`. (Read `README.md` and decide; if no relevant references, skip this step.)

- [ ] **Step 4: Verify `AGENTS.md` accuracy**

Re-read `AGENTS.md`. Specifically: the Repository Layout section currently says `main.ts — entire plugin source (single file)`. Update to:

```markdown
- `src/` — plugin source split by concern
  - `src/main.ts` — Plugin class, lifecycle, wiring
  - `src/commands/` — command IDs, definitions table, registrar
  - `src/kill-ring/` — KillRing + YankPopSession (pure state, unit tested)
  - `src/selection/` — MarkState (pure state, unit tested)
  - `src/tracking/` — RepeatDetector (pure state, unit tested)
  - `src/editor-ops/` — Obsidian-coupled cursor/edit operations
  - `src/log.ts` — logger factory
- `vitest.config.ts` — test runner config
- `.github/workflows/ci.yml` — lint + typecheck + test + build on PR
```

Add a "Testing" subsection under "Build & Install Loop" referencing `npm test`.

- [ ] **Step 5: Commit version bump and doc updates**

```sh
git add package.json manifest.json versions.json README.md AGENTS.md
git commit -m "chore: release 0.5.0 (refactor checkpoint)

End of the refactor plan (docs/plans/2026-05-06-refactor-and-reorg.md).
src/ layout, vitest, CI, four pure-state classes with unit tests, no
public behavior change vs 0.4.0. Ready for feature work (Layer 2 / 3
per docs/plans/2026-05-06-emacs-bindings-everywhere-design.md)."
```

- [ ] **Step 6: Tag and optionally push**

```sh
git tag 0.5.0
```

If a public release is desired:

```sh
git push origin main
git push origin 0.5.0
```

The `.github/workflows/release.yml` workflow will build and create a draft GitHub release with `main.js` and `manifest.json` attached.

---

## Self-review checklist

After all 14 commits land, verify:

- [ ] **Spec coverage:** every "Bug to fix" and "Design issue" from `docs/plans/2026-05-06-refactor-and-reorg.md` is addressed.
  - `'backwards-kill-word'` typo → fixed in Task 1.3 (constants derived from same map).
  - `console.log` leaks in `yankPop` → fixed in Task 1.2 (logger replaces console.log).
  - `"seplacing"` typo → silently fixed in Task 1.8 (the log line is rewritten in `editing.ts`'s `withDelete`).
  - Index reset on plugin reload → fixed in Task 1.4 (KillRing constructor allocates fresh ring).
  - 290-line `onload` → fixed across Tasks 1.3 and 1.8.
  - String IDs → fixed in Task 1.3 (typed `COMMAND_IDS` map).
  - `commandInvoked` doing three jobs → split across Tasks 1.5 (yank-pop cancel), 1.7 (repeat tracking), and 1.4 (extend-kill flags now via context object).
  - Logger coupled to plugin → fixed in Task 1.2.
  - No tests → fixed in Tasks 1.4, 1.5, 1.6, 1.7 (4 pure-state classes covered).
  - Cargo-cult `async` → cleaned up implicitly during Task 1.8 rewrite.
  - `main.ts` at repo root → fixed in Task 1.1.
  - No CI → fixed in Task 1.0.
  - No test runner → fixed in Task 1.0.

- [ ] **No placeholders:** all code blocks contain executable code; all step descriptions reference exact file paths and concrete commands. Search the plan for `TODO`, `TBD`, `...`, "fill in", "similar to" — any hits should be expanded.

- [ ] **Type consistency:** `CommandId`, `KillContext`, `PluginContext` types referenced consistently across tasks. Method names (`save`, `current`, `rotate`, `track`, `set`, `clear`, `isActive`, `origin`) match across module and call sites.

- [ ] **Frequent commits:** 14 commits total (4 salvage + 1 salvage release + 1 tooling + 1 src move + 6 extractions + 1 release). Each behaviorally testable in isolation; nothing forces a multi-commit "fix the whole thing at once" rebase.

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-05-07-refactor-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Which approach?
