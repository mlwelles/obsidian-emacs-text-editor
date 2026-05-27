# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, Cursor, OpenCode, Aider, Amp, etc.) working in this repository. Human contributors are also welcome to use this as a quick orientation.

## What This Is

An Obsidian plugin that emulates Emacs text-editing keybindings. Originally a fork of [Klojer/obsidian-emacs-text-editor](https://github.com/Klojer/obsidian-emacs-text-editor); the `mlwelles` fork has split from upstream and extends it with broader binding coverage (in-input bindings, multi-chord prefix maps, global aliases) and a soft-dependency policy for plugin integrations.

## Repository Layout

- `src/` — plugin source split by concern
  - `src/main.ts` — Plugin class, lifecycle, wiring (under 100 lines)
  - `src/commands/ids.ts` — typed `COMMAND_IDS` map and kill-extend predicate sets
  - `src/commands/definitions.ts` — `buildCommands(plugin)` table of 27+ command entries
  - `src/commands/register.ts` — `registerCommands(plugin, commands)` registrar
  - `src/commands/plugin-context.ts` — `PluginContext` interface (decouples definitions from main.ts)
  - `src/kill-ring/kill-ring.ts` — `KillRing` class (pure state, unit tested)
  - `src/kill-ring/yank-pop.ts` — `YankPopSession` (pure state, unit tested)
  - `src/selection/mark.ts` — `MarkState` (pure state, unit tested)
  - `src/tracking/repeat-detector.ts` — `RepeatDetector` (pure state, unit tested)
  - `src/editor-ops/movement.ts` — cursor movement + selection helpers
  - `src/editor-ops/editing.ts` — kill/yank/transpose/mark/keyboard-quit (uses `KillContext`)
  - `src/editor-ops/paragraph.ts` — forward/backward paragraph (pure string scanning)
  - `src/editor-ops/recenter.ts` — `scrollIntoView` wrapper
  - `src/log.ts` — logger factory
- `manifest.json` — Obsidian plugin manifest
- `esbuild.config.mjs` — bundler config (entry: `src/main.ts`); outputs `main.js`
- `Makefile` — build/install/uninstall targets
- `package.json` — dev dependencies and `dev`/`build`/`test`/`lint`/`typecheck` scripts
- `vitest.config.ts` — test runner config (picks up `src/**/*.test.ts`)
- `.github/workflows/ci.yml` — lint + typecheck + test + build on push/PR to main
- `.github/workflows/release.yml` — GitHub release on tag push
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
make lint       # npm run lint:fix (eslint with --fix on src/**/*.ts)
make build      # tsc typecheck + esbuild production bundle → main.js
make install    # build + copy main.js, manifest.json into $OBSIDIAN_PLUGINS_DIR/emacs-text-editor
make uninstall  # remove installed copy
```

Direct npm scripts:

```sh
npm run dev         # esbuild watch mode
npm run build       # tsc typecheck + esbuild production
npm test            # vitest run
npm run test:watch  # vitest watch mode
npm run lint        # eslint (read-only; CI uses this)
npm run lint:fix    # eslint --fix (developer-side auto-fix)
npm run typecheck   # tsc -noEmit
```

For an iteration loop while developing, run `npm run dev` in one terminal (esbuild watch mode) and reload Obsidian (Cmd-R in the developer console, or disable+enable the plugin in settings) to pick up changes.

**Test in Obsidian by reloading the plugin, not by reading `main.js`.** The build output is not the source of truth.

## Branching & Workflow

- `main` is the integration branch
- Feature branches off `main`; rebase before merge when reasonable
- The fork has split from upstream Klojer; the `upstream` remote is no longer pulled from. Inherited upstream tags (`0.1.0` through `0.10.0`) were deleted. The fork's own version line starts at `0.4.0` (salvage release) and `0.5.0` (refactor checkpoint).
- Tag releases with semver matching `manifest.json`'s `version` field; `version-bump.mjs` keeps `manifest.json` and `versions.json` in sync (run via `npm version <ver>` which triggers the `version` lifecycle script)

## Architecture Notes

The plugin runs in three conceptual layers:

1. **In-editor bindings** (markdown editor) — registered via `addCommand` with `editorCallback`, hooks Obsidian's CodeMirror-backed `editor` API. Original plugin behavior.
2. **In-input bindings** (vanilla `<input>` / `<textarea>` / `[contenteditable]`) — document-level keydown listener in capture phase. Filters by target element type, skips elements inside `.cm-editor`. Implements cursor movement, kill/yank, mark/region for plain DOM inputs.
3. **Workspace bindings** — single-chord global aliases (M-x, C-s, etc.) registered as ordinary `addCommand` entries with `hotkeys`; multi-chord prefix maps (C-x C-s, C-x b, etc.) handled by an in-house `PrefixDispatcher` state machine that piggybacks on layer 2's capture-phase keydown listener. No third-party multi-chord plugin dependency.

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
| (none for multi-chord) | Multi-chord uses our own `PrefixDispatcher` | n/a |
| `darlal-switcher-plus` (Quick Switcher++) | M-x, C-x C-f, C-x b | `command-palette:open`, `switcher:open`, `switcher:open` respectively |
| `cycle-through-panes` | C-x o | `workspace:next-tab` (imperfect — cycles tabs, not panes) |

Update this table when adding, removing, or changing soft deps. The README's "Optional plugins" section must mirror it.

## Coding Conventions

- TypeScript strict mode (see `tsconfig.json`)
- ESLint with `@typescript-eslint`; run `npm run lint` (read-only check) or `npm run lint:fix` (auto-fix) before committing. CI uses the read-only `lint`.
- One feature per commit; descriptive messages in Conventional Commits style preferred but not strictly required
- Prefer small, focused functions; extract helpers when a single file exceeds ~500 lines per logical concern. After the 0.5.0 refactor, `src/main.ts` is intended to stay under 100 lines (wiring only); editor-ops modules target ~200 lines per concern.
- Comment non-obvious DOM-event-hijacking logic; emacs-key collisions and capture-phase ordering are easy to misread
- Pure-state classes (KillRing, YankPopSession, MarkState, RepeatDetector) carry unit tests; Obsidian-coupled code (editor-ops, command callbacks) is verified by manual regression in the test vault

## Testing

### Automated tests

- `npm test` — runs vitest against `src/**/*.test.ts`
- Pure-state classes have unit-test coverage:
  - `KillRing` (13 tests): save/current, ring wrap, extend-forward, extend-backward, rotate, head-vs-rotation invariant, save-resets-rotation
  - `YankPopSession` (5 tests): lifecycle, range, updateEnd
  - `MarkState` (4 tests): lifecycle, set-replaces-origin
  - `RepeatDetector` (4 tests): isRepeat semantics, last-id tracking
  - Logger (3 tests): prefix, predicate gating, predicate re-evaluation
- Layer 2 (in-input bindings, 0.6.0+):
  - `PluginDetector` (7 tests): isEnabled, subscribe, dispose, multi-subscriber
  - `CommandResolver` (4 tests): resolve preferred/fallback/none, watch transitions
  - `classifyElement` (11 tests): input types, textarea, contenteditable, .cm-editor descendant skip
  - `ops` (32 tests): movement, kill, region for HTMLInputElement / HTMLTextAreaElement
  - `contenteditable-ops` (23+ tests): mutation paths end-to-end in jsdom; movement paths spy-verified (jsdom lacks `Selection.modify`, so semantic correctness verified manually in Electron)

CI runs the full suite plus typecheck and build on every push and PR to main.

### Manual regression (host-required)

Obsidian-coupled code (router, ContentEditable semantics, command callbacks) requires manual regression in the host since jsdom can't exercise `Selection.modify` and Obsidian itself is not headless. Manual regression script at `docs/plans/MANUAL-TESTING.md`.

#### Layer 2 surface status (verified 2026-05-08)

| Surface | Element kind | Status |
|---|---|---|
| Search bar (left sidebar) | input | working (verified) |
| Quick switcher (Cmd-O) | input | working (verified) |
| Command palette (Cmd-P) | input | working (verified) |
| QuickAdd modal text inputs | input | working (verified) |
| Settings text inputs | input | working (verified) |
| Inline title editor (`<div class="inline-title" contenteditable>`) | contenteditable | working (verified) |
| File rename dialog | contenteditable (presumed) | working (verified) |
| Breadcrumb path filename | contenteditable (presumed) | working (verified) |
| New-note modal filename | contenteditable (presumed) | working (verified) |
| Project navigator sidebar | mixed (input + contenteditable) | working (verified) |
| Frontmatter property editor | contenteditable | not yet exercised; expected to work via contenteditable path |
| Markdown editor (Layer 1, `.cm-editor`) | CodeMirror | unchanged; Layer 2 listener correctly skips `.cm-editor` descendants |

For each Layer 2 surface, verify: C-f/b/n/p, C-a/e, M-f/b, C-d, C-k, M-d, M-Backspace, C-Space + movement + C-w/M-w, C-y, M-y, C-g.

Cross-layer kill-ring smoke test: kill text in the markdown editor with `M-d`, focus into the inline title editor or a search bar, press `C-y` — the killed text should appear. Verifies the shared kill ring crosses layers.

Layer 1 regression check: open a markdown note, exercise the same bindings, confirm no behavior change versus 0.5.1.

#### Known Layer 2 limitations

- **`Selection.modify` granularity gotchas in contenteditable.** Cursor movement by word in contenteditable uses the host's notion of word boundaries (Unicode-aware in Chromium). May differ slightly from Layer 1's CodeMirror word boundaries or from Layer 2's input/textarea regex-based boundaries (which are `\w`-only, ASCII).
- **Native browser undo (Cmd-Z) does NOT include our contenteditable DOM mutations.** Yank into contenteditable cannot be undone via Cmd-Z. Users requiring undo should use the host's own undo (e.g., the inline title editor's host-managed rename history) or rely on plugin-specific undo. Cost of using non-deprecated `Range.insertNode` / `Range.deleteContents` instead of the deprecated `document.execCommand`.
- **Mark state shared between input/textarea and contenteditable.** The mark's `{line, ch}` offset is meaningless when crossing element kinds; users who set the mark in an input then focus a contenteditable should press `C-g` to reset. Documented design wart in the feature implementation plan.

## Known Limitations

- **macOS Alt-key dead keys:** M-x produces `≈` on US-English layouts. Electron normalizes `Alt+X` correctly in most cases, but exotic input methods may eat the keystroke before the plugin sees it. Document this; do not work around it in code.
- **No keyboard macro recording.** No Obsidian plugin provides this. C-x ( / C-x ) / C-x e are intentionally unbound.
- **Obsidian doesn't expose every action as a command.** Some emacs equivalents are approximate (e.g., C-x 5 0 closes a window — Obsidian's per-window close is not always a command).

## When in Doubt

- Read `main.ts` end-to-end before making non-trivial changes; the file is small enough.
- Match existing patterns. The original plugin's `addCommand({ id, name, hotkeys, editorCallback })` shape is the template for layers 1 and 3.
- For layer 2 (in-input), write a single capture-phase listener and route by event characteristics, not by attaching one listener per element.
- Never remove an existing Obsidian default binding. Be additive.
