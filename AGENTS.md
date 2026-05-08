# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, Cursor, OpenCode, Aider, Amp, etc.) working in this repository. Human contributors are also welcome to use this as a quick orientation.

## What This Is

An Obsidian plugin that emulates Emacs text-editing keybindings. Originally a fork of [Klojer/obsidian-emacs-text-editor](https://github.com/Klojer/obsidian-emacs-text-editor); the `mlwelles` fork extends it with broader binding coverage (in-input bindings, multi-chord prefix maps, global aliases) and a soft-dependency policy for plugin integrations.

## Repository Layout

- `main.ts` — entire plugin source (single file)
- `manifest.json` — Obsidian plugin manifest
- `esbuild.config.mjs` — bundler config; outputs `main.js`
- `Makefile` — build/install/uninstall targets
- `package.json` — dev dependencies and `dev`/`build` scripts
- `versions.json`, `version-bump.mjs` — release versioning
- Compiled artifacts (`main.js`) are gitignored except for releases

## Build & Install Loop

**Test target vault:** `~/Documents/Obsidian/blackbook` — this is where `make install` deploys for testing. Always test changes against this vault unless explicitly told otherwise.

The Makefile uses `OBSIDIAN_PLUGINS_DIR` to install into the vault. Set it once per shell session:

```sh
export OBSIDIAN_PLUGINS_DIR=~/Documents/Obsidian/blackbook/Notes/.obsidian/plugins
```

Then:

```sh
make setup      # npm install
make lint       # eslint --fix main.ts
make build      # tsc typecheck + esbuild production bundle → main.js
make install    # build + copy main.js, manifest.json into $OBSIDIAN_PLUGINS_DIR/emacs-text-editor
make uninstall  # remove installed copy
```

For an iteration loop while developing, run `npm run dev` in one terminal (esbuild watch mode) and reload Obsidian (Cmd-R in the developer console, or disable+enable the plugin in settings) to pick up changes.

**Test in Obsidian by reloading the plugin, not by reading `main.js`.** The build output is not the source of truth.

## Branching & Workflow

- `main` is the integration branch
- Feature branches off `main`; rebase before merge when reasonable
- Upstream remote is `upstream` (Klojer's repo); periodically merge or cherry-pick relevant fixes
- Tag releases with semver matching `manifest.json`'s `version` field; `version-bump.mjs` keeps `manifest.json` and `versions.json` in sync

## Architecture Notes

The plugin runs in three conceptual layers:

1. **In-editor bindings** (markdown editor) — registered via `addCommand` with `editorCallback`, hooks Obsidian's CodeMirror-backed `editor` API. Original plugin behavior.
2. **In-input bindings** (vanilla `<input>` / `<textarea>` / `[contenteditable]`) — document-level keydown listener in capture phase. Filters by target element type, skips elements inside `.cm-editor`. Implements cursor movement, kill/yank, mark/region for plain DOM inputs.
3. **Workspace bindings** — single-chord global aliases (M-x, C-s, etc.) registered as ordinary `addCommand` entries with `hotkeys`; multi-chord prefix maps (C-x C-s, C-x b, etc.) registered programmatically via the Sequence Hotkeys plugin's API when that plugin is enabled.

A single global kill ring is shared across layers 1 and 2.

## Soft-Dependency Policy

Some bindings deliver a richer experience when paired with another plugin. The policy:

1. **Prefer the best available implementation.** If a third-party plugin offers a richer UX (e.g., Quick Switcher++ over the native command palette), use it.
2. **Fall back to a native Obsidian command** when the preferred plugin is not enabled. The binding still works, just without the richer UI.
3. **Drop the binding silently** only when no reasonable fallback exists (e.g., keyboard macro recording — neither Obsidian nor any plugin currently provides this).
4. **Declare every soft dependency** in this `AGENTS.md` and in the `README.md`. List them in `manifest.json` if/when Obsidian adds a manifest field for it; until then, runtime detection is the contract.
5. **Detect plugins dynamically.** Check `app.plugins.enabledPlugins` at load and listen for `plugin-enabled` / `plugin-disabled` events. Re-register affected bindings on toggle. Never require an Obsidian reload to pick up a plugin enable/disable.

When adding a new binding, an agent must follow the decision flow:

```
Does a plugin provide a richer implementation?
├─ yes → register preferred path; add fallback to native command; document the soft dep here
├─ no, but a native command exists → register native command directly
└─ no, and no fallback exists → drop the binding; explain in code comment and in this file
```

### Current Soft Dependencies

| Plugin | Bindings affected | Fallback when absent |
|---|---|---|
| `obsidian-sequence-hotkeys` | All multi-chord (C-x …) bindings | Bindings disabled (no native multi-chord support) |
| `darlal-switcher-plus` (Quick Switcher++) | M-x, C-x C-f, C-x b | `command-palette:open`, `switcher:open`, `switcher:open` respectively |
| `cycle-through-panes` | C-x o | `workspace:next-tab` (imperfect — cycles tabs, not panes) |

Update this table when adding, removing, or changing soft deps. The README's "Optional plugins" section must mirror it.

## Coding Conventions

- TypeScript strict mode (see `tsconfig.json`)
- ESLint with `@typescript-eslint`; run `make lint` (or `npm run lint` if added) before committing
- One feature per commit; descriptive messages in Conventional Commits style preferred but not strictly required
- Prefer small, focused functions; extract helpers when `main.ts` exceeds ~500 lines per logical concern
- Comment non-obvious DOM-event-hijacking logic; emacs-key collisions and capture-phase ordering are easy to misread

## Testing

There is no automated test suite (Obsidian plugins are notoriously hard to test outside the host). Manual test checklist for any change touching layer 2 (in-input bindings):

- Search bar (left sidebar)
- Quick switcher (Cmd-O / Cmd-P)
- Command palette
- File rename dialog (right-click → Rename)
- Settings text inputs (any plugin's settings panel)
- Frontmatter property editor
- A modal from a plugin (e.g., QuickAdd capture)

For each, verify: C-f/b/n/p, C-a/e, M-f/b, C-d, C-k, M-d, M-Backspace, C-Space + movement + C-w/M-w, C-y, C-g.

Layer 1 regression check: open a markdown note, exercise the same bindings, confirm no behavior change versus the previous release.

## Known Limitations

- **macOS Alt-key dead keys:** M-x produces `≈` on US-English layouts. Electron normalizes `Alt+X` correctly in most cases, but exotic input methods may eat the keystroke before the plugin sees it. Document this; do not work around it in code.
- **No keyboard macro recording.** No Obsidian plugin provides this. C-x ( / C-x ) / C-x e are intentionally unbound.
- **Obsidian doesn't expose every action as a command.** Some emacs equivalents are approximate (e.g., C-x 5 0 closes a window — Obsidian's per-window close is not always a command).

## When in Doubt

- Read `main.ts` end-to-end before making non-trivial changes; the file is small enough.
- Match existing patterns. The original plugin's `addCommand({ id, name, hotkeys, editorCallback })` shape is the template for layers 1 and 3.
- For layer 2 (in-input), write a single capture-phase listener and route by event characteristics, not by attaching one listener per element.
- Never remove an existing Obsidian default binding. Be additive.
