# Manual Testing Script — `0.4.0` and `0.5.0`

This script verifies every binding and behavior change from the salvage release (`0.4.0`) and the refactor checkpoint (`0.5.0`). The two phases are tested together because `0.5.0` is intended to have **no behavior change** vs `0.4.0` beyond a small set of internal bug fixes.

If anything fails, stop, capture the failure mode, and report back before tagging or pushing.

---

## Prerequisites

- Test vault at `~/Documents/Obsidian/blackbook` is open in Obsidian.
- The branch `refactor/salvage-and-modularize` is the current HEAD of the worktree at `~/Developer/mlwelles/obsidian-emacs-text-editor/.worktrees/refactor-salvage-and-modularize`.

## Install

From the worktree:

```sh
cd ~/Developer/mlwelles/obsidian-emacs-text-editor/.worktrees/refactor-salvage-and-modularize
export OBSIDIAN_PLUGINS_DIR=~/Documents/Obsidian/blackbook/Notes/.obsidian/plugins
npm run build
cp main.js manifest.json "$OBSIDIAN_PLUGINS_DIR/emacs-text-editor/"
```

(Direct copy bypasses `make install`'s lint dependency, which uses bare `eslint` not on PATH; the lint already ran via `npm run lint` during the implementation work.)

## Reload the plugin

In Obsidian, one of:

- Cmd+P → "Reload app without saving"
- Settings → Community plugins → toggle "Emacs text editor" off, then on

Open the developer console (Cmd+Opt+I → Console tab). After reload, you should see `loading plugin: Emacs text editor` printed once. If `unloading plugin: Emacs text editor` appears multiple times in succession or `loading` does not appear, the plugin failed to initialize — check the console for stack traces and stop testing.

## Test note setup

Create or open a markdown note in the test vault. Paste the following content. Resize the Obsidian window so the long paragraph wraps onto at least 3 visual rows (you'll need this for the visual-line-edge tests).

```
This is the first paragraph. It is short.

Here is a deliberately long paragraph that will wrap across multiple visual lines when the window is at a normal width. The point is to have a paragraph that the editor breaks into several visual rows so that visual-line-edge bindings can be observed in action. Keep adding words until you are sure this paragraph wraps at least twice on your current window width to give yourself enough room for the wrapped-line tests below.

Third paragraph.

Fourth paragraph for paragraph-navigation testing.
```

Place the cursor on the first paragraph's first character before each test unless otherwise noted.

---

## Section A — Layer 1 baseline regression

Every binding that existed in `0.3.1` must still work. These tests verify the refactor didn't break anything.

For each row: place the cursor where indicated, press the key combo, observe the result. Mark pass / fail in the rightmost column.

| # | Cursor position | Key combo | Expected result | Pass? |
|---|---|---|---|---|
| A1 | Anywhere mid-line | `C-f` | Cursor moves one character right | |
| A2 | Anywhere mid-line | `C-b` | Cursor moves one character left | |
| A3 | Mid-line, paragraph 1 | `C-n` | Cursor moves down one visual row | |
| A4 | Mid-line, paragraph 3 | `C-p` | Cursor moves up one visual row | |
| A5 | Mid-word | `M-f` | Cursor jumps to start of next word | |
| A6 | Mid-word | `M-b` | Cursor jumps to start of current word | |
| A7 | Short non-wrapped line | `C-a` | Cursor at column 0 | |
| A8 | Short non-wrapped line | `C-e` | Cursor at end of line | |
| A9 | Anywhere | `M-S-,` (M-<) | Cursor jumps to top of buffer | |
| A10 | Anywhere | `M-S-.` (M->) | Cursor jumps to end of buffer | |
| A11 | Mid-paragraph 2 | `M-S-]` | Cursor jumps to start of paragraph 3 | |
| A12 | Mid-paragraph 3 | `M-S-[` | Cursor jumps to end of paragraph 2 (or start of paragraph 3) | |
| A13 | Mid-line | `C-d` | Single character to the right of cursor deleted (NOT placed in clipboard) | |
| A14 | Empty line | `C-k` | Empty line removed; lines below shift up | |
| A15 | Mid-line with content | `C-k` | Text from cursor to end of line killed (saved to kill ring) | |
| A16 | Beginning of word | `M-d` | Word forward killed | |
| A17 | End of word | `M-Backspace` | Previous word killed | |
| A18 | Anywhere | `C-Space`, then `C-f` × 5, then `C-w` | 5 chars selected, then killed (in kill ring) | |
| A19 | Anywhere | `C-Space`, then `C-f` × 5, then `M-w` | 5 chars selected, copied (NOT deleted), selection cleared | |
| A20 | After A18/A19 | `C-y` | Killed/saved text inserted at cursor | |
| A21 | Anywhere | `C-/` | Last edit undone | |
| A22 | After undo | `C-S-/` (Ctrl+Shift+Slash) | Redo | |
| A23a | Anywhere | `C-_` (Ctrl+Underscore) | Undo (standard emacs binding) | |
| A23b | After undo | `C-M-_` (Ctrl+Alt+Underscore) | Redo (standard emacs binding) | |
| A23c | Anywhere | `C-S--` (Ctrl+Shift+Minus, produces `_` on US layout) | Undo (compatibility binding) | |
| A23d | After undo | `C-S-A--` (Ctrl+Shift+Alt+Minus) | Redo (compatibility binding) | |
| A24 | Anywhere | `C-l` | Cursor line scrolled to bottom of viewport | |
| A25 | Anywhere | `C-g` | Selection cleared (no error) | |

**If any of A1–A24 fails, stop and report.** These are the regression-critical bindings.

---

## Section B — Phase 0 salvage additions

These are the four behavior changes/additions in `0.4.0`.

### B1 — Visual line edges for `C-a` / `C-e` on wrapped lines

Place the cursor in the **middle of a wrapped row** within the long paragraph (e.g., on visual row 2 of a paragraph that wraps to 3 rows).

| # | Action | Expected | Pass? |
|---|---|---|---|
| B1.1 | Press `C-e` | Cursor jumps to the **visual** end of that wrapped row (NOT the end of the paragraph) | |
| B1.2 | From visual end, press `C-a` | Cursor jumps to the **visual** start of that same wrapped row | |
| B1.3 | Place cursor mid-row, press `C-Space`, then `C-e` | Selection extends to visual end (the mark is preserved) | |
| B1.4 | Same setup, then `C-a` | Selection extends to visual start | |
| B1.5 | Short non-wrapped line, `C-a` and `C-e` | Same behavior as before — column 0 / end of line | |

### B2 — Mousedown cancels mark and yank-pop

| # | Action | Expected | Pass? |
|---|---|---|---|
| B2.1 | `C-Space`, move with `C-f` × 3 (selection visible) | Selection appears | |
| B2.2 | Click elsewhere with the mouse | Selection clears immediately | |
| B2.3 | `C-y` to yank, then click elsewhere with the mouse, then `M-y` | `M-y` does NOT splice text at the old yank position (yank-pop session was canceled by the click) | |
| B2.4 | `C-Space`, no movement, then click elsewhere | Mark cleared (verifiable: subsequent `C-w` is a no-op) | |

### B3 — `mark-whole-buffer` command

| # | Action | Expected | Pass? |
|---|---|---|---|
| B3.1 | Cmd+P → type "mark whole buffer" | Command appears in palette | |
| B3.2 | Run it | Entire note selected; mark set at top of buffer | |
| B3.3 | Press `C-w` immediately after | Entire buffer killed; saved to kill ring | |
| B3.4 | Press `C-y` to restore | Buffer text returns | |
| B3.5 | `Cmd+Z` to undo any test changes | Test note reverts | |

### B4 — `transpose-chars` command

| # | Action | Expected | Pass? |
|---|---|---|---|
| B4.1 | Type `foobar`, place cursor between `o` and `b` (after `foo`), Cmd+P → "Transpose chars", run | Becomes `fobpoar`? — actually swaps the two characters around cursor: `foo|bar` → `fob|oar`, cursor moves one right | |
| B4.2 | Cursor at column 0, run "Transpose chars" | No-op | |
| B4.3 | Single-char line, run "Transpose chars" | No-op | |
| B4.4 | Cursor at end of line `ab\|`, run "Transpose chars" | Becomes `ba\|`; cursor at end | |

---

## Section C — Phase 1 refactor verifications

The refactor (`0.5.0`) intends no public behavior change vs `0.4.0`. These tests verify the bug fixes that materialized during extraction work correctly.

### C1 — `M-Backspace` repeat extends backward kill (the `backwards-kill-word` typo fix)

In `0.3.1`, repeating `M-Backspace` did NOT concatenate kills (typo bug). In `0.5.0`, it should.

| # | Action | Expected | Pass? |
|---|---|---|---|
| C1.1 | Type `aaa bbb ccc` on a fresh line. Move cursor to end. | Setup | |
| C1.2 | Press `M-Backspace` once | `ccc` killed; line reads `aaa bbb ` | |
| C1.3 | Press `M-Backspace` again immediately (no other commands between) | `bbb` killed; line reads `aaa ` | |
| C1.4 | Press `C-y` | The yanked text should be `bbb ccc` (the two kills concatenated) — NOT just `bbb` (the most recent kill alone) | |

If C1.4 yields `bbb` only, the typo fix didn't materialize correctly. Stop and report.

### C2 — `M-d` repeat extends forward kill (already worked in `0.3.1`, re-verify)

| # | Action | Expected | Pass? |
|---|---|---|---|
| C2.1 | Type `aaa bbb ccc` on a fresh line. Move cursor to start. | Setup | |
| C2.2 | Press `M-d` once | `aaa` killed; line reads ` bbb ccc` | |
| C2.3 | Press `M-d` again immediately | ` bbb` killed; line reads ` ccc` | |
| C2.4 | Press `C-y` | Yanked text should be `aaa bbb` (the two kills concatenated) | |

### C3 — `C-y` always yanks the most recent kill, regardless of prior `M-y` rotations (the KillRing head/rotation fix)

In `0.3.1`, this worked because of separate `yankIndex` and `yankPopIndex` fields. In a naive single-cursor implementation, this would break. The fix introduced separate `headIndex` and `rotationIndex` in `KillRing`. Verify.

| # | Action | Expected | Pass? |
|---|---|---|---|
| C3.1 | Kill three distinct strings in sequence: e.g., select "alpha" + `C-w`, select "beta" + `C-w`, select "gamma" + `C-w` | Three entries in kill ring; head is "gamma" | |
| C3.2 | Press `C-y` | "gamma" inserted at cursor | |
| C3.3 | Press `M-y` | "gamma" replaced with "beta" | |
| C3.4 | Press `M-y` again | "beta" replaced with "alpha" | |
| C3.5 | Move cursor with `C-f` (cancels yank-pop session). Press `C-y` again. | Should yank "gamma" — the head — NOT "alpha" (the rotated position) | |

If C3.5 yanks "alpha" instead of "gamma", the head/rotation invariant is broken. Report.

### C4 — `M-y` rotation wrap-around

| # | Action | Expected | Pass? |
|---|---|---|---|
| C4.1 | Setup as in C3 (three kills in ring) | Setup | |
| C4.2 | `C-y` → "gamma", `M-y` → "beta", `M-y` → "alpha", `M-y` again | Should wrap to "gamma" (head) | |

### C5 — `C-d` does NOT save to kill ring

| # | Action | Expected | Pass? |
|---|---|---|---|
| C5.1 | Type some text. Use `C-d` to delete a character. | Character gone. | |
| C5.2 | Without any other kill operation, press `C-y` | Should yank whatever was previously in the kill ring (NOT the deleted character) | |

### C6 — `set-mark-command` (`C-Space`) sets mark at current position

| # | Action | Expected | Pass? |
|---|---|---|---|
| C6.1 | Place cursor mid-line, press `C-Space` | No visible change, but mark is set | |
| C6.2 | Move with `C-f` × 5 | Selection extends from mark to current cursor | |
| C6.3 | Press `C-Space` again at the new position | Mark relocated to current cursor; selection collapses | |

### C7 — `C-g` clears mark and cancels yank-pop

| # | Action | Expected | Pass? |
|---|---|---|---|
| C7.1 | `C-Space`, move, then `C-g` | Selection clears | |
| C7.2 | `C-y` to yank, then `C-g`, then `M-y` | `M-y` should be a no-op (yank-pop session canceled) | |

### C8 — Plugin loads cleanly

In the developer console, after reload, you should see exactly:

- `loading plugin: Emacs text editor` (once)

You should NOT see:

- Any TypeError, ReferenceError, or "Cannot read property" stack traces
- Any messages that begin with `emacs-text-editor: ` (those are debug output, gated by `debugEnabled = false` by default)
- Any unconditional `console.log` from inside the plugin's command callbacks (the two `yankPop` leaks should now be debug-gated)

---

## Section D — Soft validation: in-input bindings (NOT YET IMPLEMENTED)

These are deliberately deferred to `0.6.0+` per the design plan. Verify they still **fail** as expected (i.e., emacs bindings do NOT work in non-editor inputs):

| # | Action | Expected | Pass? |
|---|---|---|---|
| D1 | Open Obsidian's quick switcher (Cmd+O), type some text, press `C-a` | Should select all (Obsidian default) — NOT move cursor to start (emacs behavior) | |
| D2 | Open the file rename dialog, press `C-f` | Native browser/Obsidian behavior — NOT cursor-forward | |

If these unexpectedly start working, the in-input layer was inadvertently activated. Investigate.

---

## After all sections pass

Report results to the agent, copy-pasting the test grid with pass/fail marks. If everything is green:

- The 0.4.0 and 0.5.0 tags are confirmed and can stay.
- Optionally push:

  ```sh
  git push origin refactor/salvage-and-modularize
  git push origin 0.4.0
  git push origin 0.5.0
  ```

  The `.github/workflows/release.yml` will create draft GitHub releases with `main.js` and `manifest.json` attached.

If anything failed:

- Describe the failure (which test number, what happened, console output).
- Do NOT push the tags.
- Decide whether the failure warrants:
  - A quick fix on this branch (amend or new commit)
  - A revert of one or more refactor commits
  - Moving the tag pointer once a fix lands

---

## Failure-mode diagnostics

If a kill-ring test fails:

1. Open the developer console.
2. Run `app.plugins.plugins['emacs-text-editor'].debugEnabled = true`.
3. Reproduce the failure.
4. Capture all `emacs-text-editor: ...` log lines.
5. Include them in the failure report.

If the plugin doesn't load at all:

1. Check the console for the stack trace.
2. Verify `manifest.json` in the installed location matches `0.5.0`:
   ```sh
   cat ~/Documents/Obsidian/blackbook/Notes/.obsidian/plugins/emacs-text-editor/manifest.json
   ```
3. Verify `main.js` is the recently-built one:
   ```sh
   ls -la ~/Documents/Obsidian/blackbook/Notes/.obsidian/plugins/emacs-text-editor/main.js
   ```
4. Re-run the install steps from the top.
