# Rebrand to Obsidian Emacs Everywhere — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rename `mlwelles/obsidian-emacs-text-editor` (a fork) to standalone `mlwelles/obsidian-emacs-everywhere`, update all metadata and documentation, and cut a 1.0.0 release. Community-directory submission is deferred to a separate effort.

**Architecture:** Pure metadata/documentation rebrand. No code logic changes. Plugin `id` changes from `emacs-text-editor` to `emacs-everywhere`. License remains GPL-3.0 (locked by upstream).

**Tech Stack:** Obsidian plugin API, TypeScript, esbuild, Make, GitHub.

**Spec:** `docs/specs/2026-05-08-rebrand-to-emacs-everywhere-design.md`

**No tests:** This is a rebrand, not a feature. Verification is manual: `make lint`, `make build`, `make install`, then smoke-test bindings in Obsidian per `AGENTS.md` testing checklist. There is no automated test suite for this plugin (Obsidian plugins are hard to test outside the host).

---

## File Structure

Files modified by this plan:

- `manifest.json` — plugin id, name, description, version, authorUrl
- `package.json` — name, version, description, author, repository/bugs/homepage
- `Makefile` — install path
- `main.ts` — add top-of-file source header (no code changes)
- `README.md` — full rewrite
- `AGENTS.md` — repo URLs and project name
- `versions.json` — already correct, no change

Files NOT modified:
- `LICENSE` — already GPL-3.0, correct, stays
- `tsconfig.json`, `esbuild.config.mjs`, `.eslintrc`, `.editorconfig`, `version-bump.mjs` — no changes
- `main.ts` body — no logic changes

External operations:
- GitHub repo rename via web settings
- Local `git remote set-url`
- Git tag `1.0.0` and GitHub release with `main.js` + `manifest.json` attached

---

## Pre-flight (no commits)

### Task 0: Confirm clean working tree and current state

**Files:** none

- [ ] **Step 1: Verify working tree is clean**

Run: `git status`
Expected: `nothing to commit, working tree clean` (or only ignored files).

If there are uncommitted changes, stop and resolve before proceeding.

- [ ] **Step 2: Confirm you are on `main`**

Run: `git rev-parse --abbrev-ref HEAD`
Expected: `main`

If not on main, run `git checkout main`.

- [ ] **Step 3: Confirm current remote**

Run: `git remote -v`
Expected output includes:
```
origin	https://github.com/mlwelles/obsidian-emacs-text-editor.git (fetch)
origin	https://github.com/mlwelles/obsidian-emacs-text-editor.git (push)
upstream	https://github.com/Klojer/obsidian-emacs-text-editor.git (fetch)
upstream	https://github.com/Klojer/obsidian-emacs-text-editor.git (push)
```

- [ ] **Step 4: Confirm test vault is set**

Run: `echo $OBSIDIAN_PLUGINS_DIR`
Expected: a non-empty path ending in `.obsidian/plugins` (e.g. `~/Documents/Obsidian/blackbook/Notes/.obsidian/plugins`).

If empty, set per `AGENTS.md`: `export OBSIDIAN_PLUGINS_DIR=~/Documents/Obsidian/blackbook/Notes/.obsidian/plugins`.

---

## Phase 1: GitHub repo rename and remote update

### Task 1: Rename the GitHub repository

**Files:** none (GitHub web UI)

- [ ] **Step 1: Rename via GitHub settings**

In a browser, navigate to `https://github.com/mlwelles/obsidian-emacs-text-editor/settings`.

In the "Repository name" field, change `obsidian-emacs-text-editor` to `obsidian-emacs-everywhere` and click **Rename**.

GitHub installs an auto-redirect from the old URL to the new URL.

- [ ] **Step 2: Update local `origin` remote**

Run:
```bash
git remote set-url origin https://github.com/mlwelles/obsidian-emacs-everywhere.git
```

- [ ] **Step 3: Verify remote update**

Run: `git remote -v`
Expected:
```
origin	https://github.com/mlwelles/obsidian-emacs-everywhere.git (fetch)
origin	https://github.com/mlwelles/obsidian-emacs-everywhere.git (push)
upstream	https://github.com/Klojer/obsidian-emacs-text-editor.git (fetch)
upstream	https://github.com/Klojer/obsidian-emacs-text-editor.git (push)
```

- [ ] **Step 4: Verify connectivity to renamed repo**

Run: `git fetch origin`
Expected: succeeds with no errors.

### Task 2: Create rebrand branch

**Files:** none

- [ ] **Step 1: Create and switch to branch**

Run: `git checkout -b rebrand/emacs-everywhere`

- [ ] **Step 2: Verify branch**

Run: `git rev-parse --abbrev-ref HEAD`
Expected: `rebrand/emacs-everywhere`

---

## Phase 2: Metadata commits

### Task 3: Update `manifest.json`

**Files:**
- Modify: `manifest.json`

- [ ] **Step 1: Replace `manifest.json` contents**

Current content:
```json
{
	"id": "emacs-text-editor",
	"name": "Emacs text editor",
	"description": "Partial emulation of Emacs text editor for Obisidian",
	"version": "0.3.1",
	"minAppVersion": "0.15.0",
	"isDesktopOnly": false
}
```

Replace with:
```json
{
	"id": "emacs-everywhere",
	"name": "Emacs Everywhere",
	"description": "Emacs and readline keybindings in the editor and in every text input.",
	"version": "1.0.0",
	"minAppVersion": "0.15.0",
	"isDesktopOnly": false,
	"author": "mlwelles",
	"authorUrl": "https://github.com/mlwelles"
}
```

Note: `manifest.json` uses tabs (not spaces). Preserve tab indentation.

- [ ] **Step 2: Verify JSON is valid**

Run: `python3 -c "import json; json.load(open('manifest.json'))"`
Expected: no output (success). If JSON is malformed, command exits with an error.

- [ ] **Step 3: Verify `versions.json` already has 1.0.0**

Run: `cat versions.json`
Expected:
```json
{
	"1.0.0": "0.15.0"
}
```

If the entry is missing, add it. (The current repo already has it; this step is a sanity check.)

### Task 4: Update `package.json`

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Replace `package.json` contents**

Current content:
```json
{
	"name": "emacs-text-editor",
	"version": "0.3.1",
	"description": "Partial emulation of Emacs text editor for Obisidian",
	"main": "main.js",
	"scripts": {
		"dev": "node esbuild.config.mjs",
		"build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
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
		"obsidian": "latest",
		"tslib": "2.4.0",
		"typescript": "4.7.4"
	}
}
```

Replace with:
```json
{
	"name": "obsidian-emacs-everywhere",
	"version": "1.0.0",
	"description": "Emacs and readline keybindings in the editor and in every text input.",
	"main": "main.js",
	"scripts": {
		"dev": "node esbuild.config.mjs",
		"build": "tsc -noEmit -skipLibCheck && node esbuild.config.mjs production",
		"version": "node version-bump.mjs && git add manifest.json versions.json"
	},
	"keywords": ["obsidian", "obsidian-plugin", "emacs", "keybindings", "readline"],
	"author": "mlwelles",
	"license": "GPL-3.0",
	"repository": {
		"type": "git",
		"url": "https://github.com/mlwelles/obsidian-emacs-everywhere.git"
	},
	"bugs": {
		"url": "https://github.com/mlwelles/obsidian-emacs-everywhere/issues"
	},
	"homepage": "https://github.com/mlwelles/obsidian-emacs-everywhere#readme",
	"devDependencies": {
		"@types/node": "^16.11.6",
		"@typescript-eslint/eslint-plugin": "5.29.0",
		"@typescript-eslint/parser": "5.29.0",
		"builtin-modules": "3.3.0",
		"esbuild": "0.17.3",
		"obsidian": "latest",
		"tslib": "2.4.0",
		"typescript": "4.7.4"
	}
}
```

Note: `package.json` uses tabs. Preserve.

- [ ] **Step 2: Verify JSON is valid**

Run: `python3 -c "import json; json.load(open('package.json'))"`
Expected: no output.

### Task 5: Commit metadata changes

**Files:** `manifest.json`, `package.json`

- [ ] **Step 1: Stage and commit**

```bash
git add manifest.json package.json
git commit -m "chore: rebrand metadata to Emacs Everywhere

Update manifest.json id, name, description, version (0.3.1 -> 1.0.0),
and add author/authorUrl. Update package.json name, version, description,
author, repository, bugs, homepage. License remains GPL-3.0.

versions.json already contains the 1.0.0 -> 0.15.0 entry; no change needed."
```

- [ ] **Step 2: Verify commit**

Run: `git log -1 --stat`
Expected: shows `manifest.json` and `package.json` changed, both with insertions and deletions.

---

## Phase 3: Build/install path

### Task 6: Update `Makefile` install path

**Files:**
- Modify: `Makefile`

- [ ] **Step 1: Change `INSTALL_DIR`**

Current line 4:
```
INSTALL_DIR = ${OBSIDIAN_PLUGINS_DIR}/emacs-text-editor
```

Change to:
```
INSTALL_DIR = ${OBSIDIAN_PLUGINS_DIR}/emacs-everywhere
```

- [ ] **Step 2: Verify build still works**

Run: `make build`
Expected: success, produces `main.js`.

If TypeScript or esbuild errors appear, stop and resolve before proceeding.

- [ ] **Step 3: Install to test vault and verify directory name**

Run: `make install`
Expected: succeeds; copies `main.js` and `manifest.json` to `$OBSIDIAN_PLUGINS_DIR/emacs-everywhere/`.

Run: `ls -d $OBSIDIAN_PLUGINS_DIR/emacs-everywhere/`
Expected: directory exists.

- [ ] **Step 4: Clean up the old installed plugin directory**

Run: `rm -rf $OBSIDIAN_PLUGINS_DIR/emacs-text-editor/`

This removes the previously-installed copy under the old `id`. After this and an Obsidian reload, only the new plugin appears.

- [ ] **Step 5: Commit**

```bash
git add Makefile
git commit -m "chore: update install path to emacs-everywhere"
```

---

## Phase 4: Source header

### Task 7: Add top-of-file header to `main.ts`

**Files:**
- Modify: `main.ts:1`

- [ ] **Step 1: Add header above the existing first line**

Current `main.ts` line 1:
```typescript
import {Editor, EditorPosition, MarkdownView, Plugin} from "obsidian";
```

Insert above it (so the file begins with the header, then a blank line, then the import):
```typescript
/*
 * Obsidian Emacs Everywhere
 * Emacs and readline keybindings in the editor and in every text input.
 *
 * https://github.com/mlwelles/obsidian-emacs-everywhere
 *
 * Originally forked from Klojer/obsidian-emacs-text-editor
 * (https://github.com/Klojer/obsidian-emacs-text-editor); now an
 * independent project with substantially expanded scope.
 *
 * Copyright (C) 2024 mlwelles
 * Copyright (C) 2022-2024 Klojer (upstream)
 *
 * Licensed under the GNU General Public License, version 3 (GPL-3.0).
 * See LICENSE for the full license text.
 */

import {Editor, EditorPosition, MarkdownView, Plugin} from "obsidian";
```

- [ ] **Step 2: Verify build still works**

Run: `make build`
Expected: success.

- [ ] **Step 3: Verify lint passes**

Run: `make lint`
Expected: success, no errors. (ESLint should accept block comments at the top of the file.)

- [ ] **Step 4: Commit**

```bash
git add main.ts
git commit -m "docs: add source header with project name, attribution, license"
```

---

## Phase 5: README rewrite

### Task 8: Rewrite `README.md`

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace `README.md` contents**

Replace the entire file with the following:

```markdown
# Obsidian Emacs Everywhere

> Emacs and readline keybindings in the editor and in every text input.

A community plugin for [Obsidian](https://obsidian.md) that brings Emacs-style keybindings throughout the app: in the markdown editor, in every plain `<input>` and `<textarea>`, and as workspace-level commands. Includes a shared kill ring, mark/region selection, multi-chord prefix maps (`C-x ...`), and integrations with several other community plugins.

If you have ever instinctively typed `C-a` in a search bar, frontmatter editor, or rename dialog and watched the cursor go nowhere useful, this plugin is for you. The same readline-style keys that macOS exposes by default in every text field (thanks to its NeXTSTEP lineage) work across all of Obsidian when this plugin is enabled.

## Status

This project began as a fork of [`Klojer/obsidian-emacs-text-editor`](https://github.com/Klojer/obsidian-emacs-text-editor) and has since grown substantially in scope. It is now an independent project. **Not affiliated with [`tecosaur/emacs-everywhere`](https://github.com/tecosaur/emacs-everywhere)**, the unrelated desktop tool that pops a floating Emacs editor for any application.

## Features

- **Editor bindings.** All the Emacs movement, killing, yanking, and paragraph-navigation commands you would expect in the markdown editor.
- **In-input bindings.** The same keys work in plain `<input>`, `<textarea>`, and `[contenteditable]` elements: search bars, the quick switcher, the command palette, the file rename dialog, plugin settings panels, the frontmatter property editor, and modal text inputs from other plugins.
- **Shared kill ring.** A single kill ring (default size 120, matching Emacs) is shared across the editor and in-input layers. Repeated `C-k` / `M-d` / `M-Backspace` extends the previous kill, just like in Emacs and readline.
- **Mark and region.** `C-Space` sets the mark; movement commands extend the region; `C-w` / `M-w` cut/copy; `C-g` cancels.
- **Multi-chord prefixes.** `C-x C-s` (save), `C-x C-f` (file finder), `C-x b` (buffer switcher), `C-x o` (other window), and more. (Requires the [Sequence Hotkeys](https://github.com/moolmanruan/obsidian-sequence-hotkeys) plugin; see Optional plugins below.)
- **Workspace aliases.** `M-x` opens the command palette, `C-s` opens search, etc.

## Install

### Manual install

```sh
export OBSIDIAN_PLUGINS_DIR=/path/to/your/vault/.obsidian/plugins
make install
```

This builds the plugin and copies `main.js` and `manifest.json` into `$OBSIDIAN_PLUGINS_DIR/emacs-everywhere/`. Reload Obsidian or toggle the plugin in Settings → Community plugins.

### Community directory

Not yet listed. Submission to the Obsidian community plugin directory is planned after a stabilization period.

## Optional plugins

Some bindings deliver a richer experience when paired with another plugin. The plugin detects each one at load and falls back to a native Obsidian command when the preferred plugin is not installed.

| Plugin | Bindings affected | Fallback when absent |
|---|---|---|
| [Sequence Hotkeys](https://github.com/moolmanruan/obsidian-sequence-hotkeys) | All multi-chord (`C-x ...`) bindings | Bindings disabled (no native multi-chord support) |
| [Quick Switcher++](https://github.com/darlal/obsidian-switcher-plus) | `M-x`, `C-x C-f`, `C-x b` | Native `command-palette:open` and `switcher:open` |
| [Cycle through panes](https://github.com/Yuichi-Aragi/cycle-through-panes) | `C-x o` | `workspace:next-tab` (cycles tabs, not panes) |

## Keybinding reference

| Hotkey | Command | Description |
|---|---|---|
| `C-f` | Forward char | Move cursor one character forward |
| `C-b` | Backward char | Move cursor one character backward |
| `C-n` | Next line | Move cursor to next line |
| `C-p` | Previous line | Move cursor to previous line |
| `C-a` | Beginning of line | Move cursor to beginning of line |
| `C-e` | End of line | Move cursor to end of line |
| `M-f` | Forward word | Move cursor one word forward |
| `M-b` | Backward word | Move cursor one word backward |
| `M-]` | Forward paragraph | Move cursor one paragraph forward |
| `M-[` | Backward paragraph | Move cursor one paragraph backward |
| `M-<` | Beginning of buffer | Move to start of buffer |
| `M->` | End of buffer | Move to end of buffer |
| `C-d` | Delete char | Delete character forward |
| `M-d` | Kill word | Kill word forward (extends kill on repeat) |
| `M-Backspace` | Backward kill word | Kill word backward (extends kill on repeat) |
| `C-k` | Kill line | Kill to end of line (extends kill on repeat) |
| `C-w` | Kill region | Cut selection |
| `M-w` | Kill ring save | Copy selection |
| `C-y` | Yank | Paste from kill ring |
| `M-y` | Yank pop | Cycle through previous kills (after `C-y`) |
| `C-Space` | Set mark | Begin a selection |
| `C-g` | Keyboard quit | Cancel selection / abort prefix |
| `C-l` | Recenter | Scroll current line to center |
| `C-/` | Undo | Undo |
| `C-S--` | Redo | Redo |
| `M-x` | Command palette | Open command palette |

For multi-chord bindings (`C-x C-s`, `C-x b`, etc.), see [`AGENTS.md`](AGENTS.md) and the in-app Hotkeys settings.

## Manual test checklist

For each of the following contexts, verify `C-f` / `C-b` / `C-n` / `C-p`, `C-a` / `C-e`, `M-f` / `M-b`, `C-d`, `C-k`, `M-d`, `M-Backspace`, `C-Space` + movement + `C-w` / `M-w`, `C-y`, `C-g`:

- Search bar (left sidebar)
- Quick switcher (`Cmd-O` / `Cmd-P`)
- Command palette
- File rename dialog (right-click → Rename)
- Settings text inputs (any plugin's settings panel)
- Frontmatter property editor
- A modal from a plugin (e.g., QuickAdd capture)

Markdown-editor regression check: open a note, exercise the same bindings, confirm no behavior change.

## Known limitations

- **macOS Alt-key dead keys.** `M-x` on US-English layouts produces `≈`. Electron normalizes `Alt+X` correctly in most cases, but exotic input methods may eat the keystroke.
- **No keyboard macro recording.** No Obsidian plugin currently provides this. `C-x (`, `C-x )`, and `C-x e` are intentionally unbound.
- **Approximate window/frame commands.** Obsidian does not expose every action as a command. Some Emacs equivalents are best-effort.

## Attribution

Originally forked from [`Klojer/obsidian-emacs-text-editor`](https://github.com/Klojer/obsidian-emacs-text-editor). Significant additions and the rebrand to "Emacs Everywhere" are by [mlwelles](https://github.com/mlwelles).

## License

GPL-3.0. See [`LICENSE`](LICENSE).
```

- [ ] **Step 2: Verify markdown renders sensibly**

Run: `head -5 README.md`
Expected: starts with `# Obsidian Emacs Everywhere` and the tagline blockquote.

- [ ] **Step 3: Commit**

```bash
git add README.md
git commit -m "docs: rewrite README for Obsidian Emacs Everywhere

New headline, tagline, what-it-does, install, soft-dependency table,
keybinding reference, manual test checklist, known limitations,
attribution to upstream, disambiguation re: tecosaur/emacs-everywhere."
```

---

## Phase 6: AGENTS.md update

### Task 9: Update repo URLs and project name in `AGENTS.md`

**Files:**
- Modify: `AGENTS.md`

- [ ] **Step 1: Replace project name occurrences**

In `AGENTS.md`, replace every literal occurrence of `obsidian-emacs-text-editor` with `obsidian-emacs-everywhere`. There are two: the GitHub URL of the upstream fork-of (line ~10) and the description of `mlwelles` fork.

For the upstream attribution (top-of-file paragraph), keep the upstream URL `Klojer/obsidian-emacs-text-editor` intact (that is the upstream's name, which is unchanged), but update the `mlwelles` fork reference.

Specifically, find:
```
An Obsidian plugin that emulates Emacs text-editing keybindings. Originally a fork of [Klojer/obsidian-emacs-text-editor](https://github.com/Klojer/obsidian-emacs-text-editor); the `mlwelles` fork extends it with broader binding coverage (in-input bindings, multi-chord prefix maps, global aliases) and a soft-dependency policy for plugin integrations.
```

Replace with:
```
An Obsidian plugin that brings Emacs and readline keybindings to the markdown editor and to every plain text input. Originally forked from [Klojer/obsidian-emacs-text-editor](https://github.com/Klojer/obsidian-emacs-text-editor); now an independent project (Obsidian Emacs Everywhere) with substantially expanded scope: in-input bindings, multi-chord prefix maps, global aliases, and a soft-dependency policy for plugin integrations.
```

- [ ] **Step 2: Update install-path reference**

Find the line under "Build & Install Loop" that references `emacs-text-editor`:
```
make install    # build + copy main.js, manifest.json into $OBSIDIAN_PLUGINS_DIR/emacs-text-editor
```

Replace with:
```
make install    # build + copy main.js, manifest.json into $OBSIDIAN_PLUGINS_DIR/emacs-everywhere
```

- [ ] **Step 3: Verify no stale references remain**

Run: `grep -n "emacs-text-editor" AGENTS.md`
Expected output: only the upstream attribution line referencing `Klojer/obsidian-emacs-text-editor` (the upstream's repo name, which is unchanged).

If any other occurrences remain, fix them. The only acceptable surviving occurrence is in the URL `https://github.com/Klojer/obsidian-emacs-text-editor`.

- [ ] **Step 4: Commit**

```bash
git add AGENTS.md
git commit -m "docs(agents): update project name and install path"
```

---

## Phase 7: Local verification

### Task 10: Smoke-test the renamed plugin

**Files:** none

- [ ] **Step 1: Clean build**

Run:
```bash
make lint
make build
```
Expected: both succeed without errors.

- [ ] **Step 2: Reinstall**

Run: `make install`
Expected: succeeds; new copy lands at `$OBSIDIAN_PLUGINS_DIR/emacs-everywhere/`.

- [ ] **Step 3: Confirm only the new plugin directory exists**

Run: `ls $OBSIDIAN_PLUGINS_DIR | grep -E '^(emacs-text-editor|emacs-everywhere)$'`
Expected: only `emacs-everywhere`. If `emacs-text-editor` still exists, run `rm -rf $OBSIDIAN_PLUGINS_DIR/emacs-text-editor`.

- [ ] **Step 4: Reload Obsidian and enable the plugin**

In Obsidian:
1. Open the developer console (`Cmd-Option-I`) and run `app.commands.executeCommandById('app:reload')`, OR quit and reopen Obsidian.
2. Settings → Community plugins → confirm "Emacs Everywhere" appears in the list with version 1.0.0.
3. Toggle it on if not already enabled.

Expected: plugin loads; console shows `loading plugin: Emacs text editor` (this string is in `main.ts` and will be updated in a future task only if you choose; for the rebrand it is left as-is since the spec is metadata-only and `main.ts` body is not changed).

- [ ] **Step 5: Manual smoke test — markdown editor (layer 1)**

Open any markdown note. Verify each binding moves the cursor / acts as expected:
- `C-f`, `C-b`, `C-n`, `C-p`, `C-a`, `C-e` — cursor movement
- `M-f`, `M-b` — word movement
- `C-d` — delete char
- `C-k` — kill line
- `C-Space`, then movement, then `C-w` — cut region
- `C-y` — yank

Expected: behavior identical to before the rebrand.

- [ ] **Step 6: Manual smoke test — in-input (layer 2)**

Open the quick switcher (`Cmd-O`). Type a few characters. Verify:
- `C-f` / `C-b` move within the input
- `C-a` / `C-e` jump to start/end
- `C-d` deletes forward
- `M-Backspace` kills word backward

Expected: bindings work in the quick switcher input.

- [ ] **Step 7: Manual smoke test — multi-chord (layer 3)**

If the Sequence Hotkeys plugin is enabled, try `C-x C-s` (save). Expected: file saves, status bar reflects save.

If Sequence Hotkeys is not enabled, skip this step (multi-chord requires it).

- [ ] **Step 8: Confirm no regressions**

If any binding misbehaves, stop. Investigate with `git bisect` against `main` (the rebrand should not have changed any behavior).

### Task 11: Merge to `main` and push

**Files:** none

- [ ] **Step 1: Switch to `main`**

Run: `git checkout main`

- [ ] **Step 2: Fast-forward merge**

Run: `git merge --ff-only rebrand/emacs-everywhere`
Expected: fast-forwards `main` to include all rebrand commits.

If merge is not fast-forward (someone else pushed in the meantime), stop and resolve manually. This branch is solo work, so this should not happen.

- [ ] **Step 3: Push**

Run: `git push origin main`
Expected: succeeds; remote `main` updated.

- [ ] **Step 4: Delete the rebrand branch locally**

Run: `git branch -d rebrand/emacs-everywhere`

---

## Phase 8: Tag and release

### Task 12: Tag and create the GitHub release

**Files:** none

- [ ] **Step 1: Create the tag**

Run:
```bash
git tag -a 1.0.0 -m "Emacs Everywhere 1.0.0

First release under the new name. See README.md for the full feature
list. No code changes from 0.3.1 — this is a rebrand release."
```

- [ ] **Step 2: Push the tag**

Run: `git push origin 1.0.0`
Expected: tag appears on GitHub.

- [ ] **Step 3: Confirm release artifacts are built**

Run: `make build`
Expected: produces a current `main.js`.

Verify both files exist:
```bash
ls -la main.js manifest.json
```

- [ ] **Step 4: Create the GitHub release**

Use the GitHub CLI:
```bash
gh release create 1.0.0 \
  main.js manifest.json \
  --title "Emacs Everywhere 1.0.0" \
  --notes "$(cat <<'EOF'
First release under the new name **Obsidian Emacs Everywhere**.

This is a rebrand release. The project was previously published as
\`emacs-text-editor\` (a fork of [Klojer/obsidian-emacs-text-editor](https://github.com/Klojer/obsidian-emacs-text-editor)).
No code changes from 0.3.1.

## Install

Manual install:
\`\`\`sh
export OBSIDIAN_PLUGINS_DIR=/path/to/your/vault/.obsidian/plugins
make install
\`\`\`

See [README.md](https://github.com/mlwelles/obsidian-emacs-everywhere/blob/main/README.md) for the full feature list, soft-dependency table, and keybinding reference.

Not affiliated with [tecosaur/emacs-everywhere](https://github.com/tecosaur/emacs-everywhere) (the desktop floating-editor tool).
EOF
)"
```

Expected: release URL printed. Visit it in a browser to confirm `main.js` and `manifest.json` are attached as assets.

If `gh` is not installed, create the release manually via `https://github.com/mlwelles/obsidian-emacs-everywhere/releases/new`, select tag `1.0.0`, paste the body above, and upload `main.js` and `manifest.json` as binaries.

---

## Phase 9: Bake (separate effort)

### Task 13: Personal use period

**Files:** none

This task spans 1-2 weeks of normal personal use. Not actionable in a single session.

- [ ] **Step 1: Note any regressions or paper cuts**

Keep a running list (in `docs/notes/post-rebrand-bake.md` or similar) of any issues encountered.

- [ ] **Step 2: Cut a 1.0.1 if anything is found**

For any meaningful bug, branch off `main`, fix, bump `manifest.json` and `package.json` to `1.0.1`, add a `versions.json` entry, tag, and release.

- [ ] **Step 3: Proceed to community-directory submission**

After the bake period and any 1.0.x patches, follow the submission section of the spec (`docs/specs/2026-05-08-rebrand-to-emacs-everywhere-design.md`, Section 4) in a separate effort.

---

## Self-review

Reviewing this plan against the spec:

1. **Identity** — Task 3 (manifest), Task 4 (package.json), Task 7 (header), Task 8 (README), Task 9 (AGENTS.md) cover all identity attributes from the spec's identity table.
2. **File-and-metadata changes** — Every file listed in the spec's "File and metadata changes" section has a task: `manifest.json` (Task 3), `package.json` (Task 4), `versions.json` (Task 3 step 3, no-op verify), `Makefile` (Task 6), `README.md` (Task 8), `AGENTS.md` (Task 9), `main.ts` header (Task 7), `LICENSE` (no-op, spec confirms).
3. **Migration** — Spec says none. Plan has none. Match.
4. **Community directory submission** — Spec defers; plan defers (Phase 9 step 3 references the spec section).
5. **Execution sequence** — Plan tasks follow the spec's 14-step sequence. Steps 1-2 (pre-flight) → Task 0. Steps 3-4 (rename remote, branch) → Tasks 1-2. Step 5 (manifest+package) → Tasks 3-5. Step 6 (Makefile) → Task 6. Step 7 (source header) → Task 7. Step 8 (README) → Task 8. Step 9 (AGENTS.md) → Task 9. Step 10 (verify) → Task 10. Step 11 (merge) → Task 11. Step 12 (tag+release) → Task 12. Step 13-14 (bake + later submission) → Task 13.
6. **Placeholders** — none. All tasks have concrete commands and file content.
7. **Type/name consistency** — `emacs-everywhere` used consistently as the plugin id everywhere. `Emacs Everywhere` (display) used consistently. Repo name `obsidian-emacs-everywhere` used consistently.

No gaps found. Plan is ready.

---

## Execution

Plan complete and saved to `docs/plans/2026-05-08-rebrand-to-emacs-everywhere.md`.

Two execution options:

1. **Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.
2. **Inline Execution** — execute tasks in this session using executing-plans, batch execution with checkpoints.

Tell me which approach you want.
