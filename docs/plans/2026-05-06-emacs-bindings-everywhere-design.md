# Emacs Bindings Everywhere — Design

**Date:** 2026-05-06
**Status:** Approved (open questions resolved 2026-05-07)
**Repo:** `mlwelles/obsidian-emacs-text-editor`

## Goal

Extend the plugin so emacs keybindings work in **every** text-input surface in Obsidian — not just the markdown editor. Add multi-chord prefix maps (`C-x …`) and global emacs aliases (`M-x`, `C-s`, etc.) where Obsidian has equivalent commands. Integrate richer third-party plugin behavior via a soft-dependency policy.

## Background

The current plugin (v0.9.0) registers Obsidian commands with emacs hotkeys, hooked through Obsidian's `editor` API. This works inside the markdown editor pane but not in:

- Search bar, quick switcher, command palette
- File rename dialog, settings text inputs
- Frontmatter property editor, modal text fields from plugins
- Any plugin's text input

Users with emacs muscle memory hit C-a in a rename dialog and select all instead of moving to start of line.

## Three-layer architecture

The plugin will operate in three logical layers:

### Layer 1 — In-editor bindings (existing)

Markdown editor (CodeMirror). Registered via `addCommand({ editorCallback })`. **No change to existing behavior.** Existing v0.9.0 commands stay exactly as they are.

### Layer 2 — In-input bindings (new)

Vanilla DOM text inputs: `<input>`, `<textarea>`, `[contenteditable]`. Implemented via a single document-level keydown listener registered in capture phase, filtering by `event.target`. Skips elements inside `.cm-editor` (CodeMirror handles those via Layer 1).

Bindings: matches the existing Layer 1 command set 1:1 — same emacs keys do the same things, just adapted to vanilla-DOM cursor APIs (`selectionStart` / `selectionEnd` / `setRangeText`) instead of CodeMirror's `editor` API.

Mark/region/kill ring is shared with Layer 1.

### Layer 3 — Workspace bindings (new)

Two sub-categories:

**3a. Single-chord global aliases** — `M-x`, `C-s`, etc. Registered as ordinary `addCommand` entries with `hotkeys`. Obsidian's hotkey system handles dispatch.

**3b. Multi-chord prefix maps** — `C-x C-s`, `C-x b`, etc. Implemented by an in-house prefix-chord state machine sharing the Layer-2 capture-phase keydown listener. No third-party plugin dependency. Bindings work uniformly whether or not the user has any other multi-chord plugin (leader-hotkeys, Sequence Hotkeys, etc.) installed.

## Layer 1 binding table (unchanged from v0.9.0)

For reference. No changes.

| Binding | Action |
|---|---|
| C-f / C-b | forward / backward char |
| C-n / C-p | next / previous line |
| M-f / M-b | forward / backward word |
| C-a / C-e | beginning / end of line |
| M-S-, / M-S-. | beginning / end of buffer |
| M-S-[ / M-S-] | backward / forward paragraph |
| C-k | kill line |
| C-d / M-d | delete char / kill word forward |
| M-Backspace | kill word backward |
| C-Space | set mark |
| C-w / M-w | kill region / kill-ring save |
| C-y | yank |
| C-/ / C-S-_ | undo / redo |
| C-g | keyboard quit |
| C-l | recenter |
| M-u / M-l / M-c | upcase / downcase / capitalize word |

## Layer 2 binding table (new — matches Layer 1 1:1 in vanilla inputs)

Every Layer 1 binding has a Layer 2 implementation. Where Obsidian has no analog (e.g., recenter in a single-line search input), the binding is a no-op for that input type.

Per-input-type behavior notes:

- **Single-line `<input>`:** C-n / C-p are no-ops (no next/previous line concept). C-a / C-e behave normally. M-S-, / M-S-. equivalent to C-a / C-e.
- **Multi-line `<textarea>`:** All bindings active. Lines computed from value + `\n`.
- **`[contenteditable]`:** Use Selection / Range APIs. More complex; treat as multi-line textarea where possible.

## Layer 3a binding table — single-chord global aliases

Additive only. Never removes existing Obsidian defaults.

| Binding | Obsidian command (preferred) | Fallback | Notes |
|---|---|---|---|
| M-x | `switcher-plus:open-commands` | `command-palette:open` | Soft dep on Switcher++ |
| C-s | `editor:open-search` | — | Native only |
| C-r | `editor:open-search` | — | Same UI as C-s; reverse direction not separately exposed |
| M-S-5 (M-%) | `editor:open-search-replace` | — | Native only |
| C-g | (custom: dispatch Escape, blur focused element) | — | Closes modals, clears selection |

## Layer 3b binding table — multi-chord (C-x prefix)

Implemented by an in-house prefix-chord state machine. No third-party plugin dependency. The dispatcher hooks the same document-level capture-phase keydown listener used by Layer 2, so it sees keys before any other Obsidian or plugin handler. Cancellable via `C-g`, Escape, or a configurable timeout (default ~5 seconds).

| Sequence | Emacs meaning | Obsidian (preferred) | Fallback |
|---|---|---|---|
| C-x C-s | save-buffer | `editor:save-file` | — |
| C-x C-f | find-file | `switcher-plus:open` | `switcher:open` |
| C-x d | dired | `file-explorer:reveal-active-file` (or focus explorer) | — |
| C-x b | switch-to-buffer | `switcher-plus:open-editors` | `switcher:open` |
| C-x C-b | list-buffers | (recent files panel) | — |
| C-x k | kill-buffer | `workspace:close` | — |
| C-x 0 | delete-window | `workspace:close-active-pane` | — |
| C-x 1 | delete-other-windows | `workspace:close-others` | — |
| C-x 2 | split-window-below | `workspace:split-horizontal` | — |
| C-x 3 | split-window-right | `workspace:split-vertical` | — |
| C-x o | other-window | `cycle-through-panes:cycle-through-panes` | `workspace:next-tab` |
| C-x h | mark-whole-buffer | `editor:select-all` (or DOM equivalent in Layer 2) | — |
| C-x u | undo | `editor:undo` | — |
| C-x 5 2 | make-frame | `workspace:open-new-window` | — |
| C-x 5 0 | delete-frame | `workspace:close-window` | — |
| C-x C-c | save-buffers-kill-terminal | `app:quit` | — |

## Soft-dependency policy

This is a load-bearing rule. Documented in `AGENTS.md`. Summarized:

1. **Prefer the best available implementation** when a third-party plugin offers richer UX.
2. **Fall back to a native Obsidian command** when the plugin isn't enabled.
3. **Drop the binding silently** only when neither path exists (e.g., macro recording).
4. **Document every soft dep** in `AGENTS.md` and `README.md`.
5. **Detect dynamically** via `app.plugins.enabledPlugins`; listen for `plugin-enabled` / `plugin-disabled` events; never require an Obsidian reload.

Current soft deps:

| Plugin | Affected bindings | Native fallback |
|---|---|---|
| (none for Layer 3b) | Layer 3b uses an in-house dispatcher | n/a — no soft-dep |
| `darlal-switcher-plus` | M-x, C-x C-f, C-x b | `command-palette:open`, `switcher:open`, `switcher:open` |
| `cycle-through-panes` | C-x o | `workspace:next-tab` |

## Module structure

`main.ts` becomes the orchestration entry point. Per-concern modules:

```
main.ts                 # Plugin class; lifecycle (onload/onunload); wires modules
kill-ring.ts            # Shared kill-ring state; mark management; clipboard fallback
editor-bindings.ts      # Layer 1: existing addCommand entries (extracted from main.ts)
input-bindings/
  index.ts              # Layer 2 entry: capture-phase listener + element filter
  ops.ts                # Vanilla-DOM cursor + region primitives
workspace-bindings.ts   # Layer 3a: single-chord aliases via addCommand
prefix-map.ts           # Layer 3b: in-house prefix-chord state machine
soft-deps.ts            # Plugin detection + dynamic re-registration
collisions.ts           # Documented Obsidian-default rebinding map
types.ts                # Shared types
```

Each module under ~300 lines target. `main.ts` should be small enough to read end-to-end.

## Implementation strategy

Assumes the refactor plan (`2026-05-06-refactor-and-reorg.md`) has already shipped as `0.5.0` — meaning Phase 0 salvage (`0.4.0`) and the eight-commit refactor are both in. Layer 1 bindings, kill-ring, and module split are already in place. Five phases:

### Phase 1 — Soft-deps foundation
Build `soft-deps.ts`: detect plugins via `app.plugins.enabledPlugins`; subscribe to `plugin-enabled` / `plugin-disabled` events; expose a resolver that takes a preferred + fallback command pair and returns the active one. No bindings yet — just the resolver, exercised by unit tests with a mocked plugins map. This dependency must exist before Phase 3 needs it.

### Phase 2 — Layer 2: in-input bindings
Implement `input-bindings/index.ts` (capture-phase listener + element filter) and `input-bindings/ops.ts` (cursor + region primitives). Order: `<input>` and `<textarea>` first; `[contenteditable]` last. Wire kill-ring. Manual test against the surface checklist (search, palette, rename, settings, frontmatter, plugin modals). Commit per surface verified.

### Phase 3 — Layer 3a: global aliases
Add `workspace-bindings.ts`. Register M-x, C-s, C-r, M-%, C-g via `addCommand` + `hotkeys`. M-x dispatches through the Phase 1 soft-deps resolver (Switcher++ vs native palette). Commit.

### Phase 4 — Layer 3b: prefix maps
Add `prefix-map.ts`. Implement a `PrefixDispatcher` class: state machine tracking idle / awaiting-second / awaiting-third chord; matches against a registered prefix-map table; cancels on `C-g` / Escape / timeout. Hook into the Layer-2 capture-phase keydown listener so it gets first crack at keys, returns true when a chord is consumed. Commit.

### Phase 5 — Collision documentation, regression, release
`collisions.ts` captures every known Obsidian default that conflicts with our bindings plus the resolution policy (emacs wins; rebind to emacs equivalent where sensible; drop otherwise) — documentation-as-code, not active behavior. Full surface checklist from `AGENTS.md`. Layer 1 regression check. Bump version, update README, tag release.

## Testing approach

No automated suite (Obsidian plugins are hard to test outside the host). Per change:

**Layer 1 regression (every change):** open a markdown note, exercise C-f/b/n/p, C-a/e, M-f/b, C-d/k, M-d, M-Backspace, C-Space + movement + C-w/M-w, C-y, C-g, C-/, C-S-_.

**Layer 2 surface checklist:** for each of (search bar, quick switcher, command palette, file rename, settings input, frontmatter property editor, plugin modal), verify the same bindings as Layer 1 minus those that don't apply to the surface (e.g., no C-n in single-line input).

**Layer 3a:** M-x opens palette; C-s opens search; C-r opens search; M-% opens replace; C-g closes modals.

**Layer 3b:** every entry in the C-x table fires its mapped command. `C-g` mid-prefix cancels. Timeout (~5s) auto-cancels. Re-press of the prefix while in awaiting state cancels and starts fresh.

**Soft-dep verification:** disable Switcher++; verify M-x falls back to native palette. Re-enable; verify M-x switches back to Switcher++ without reload. Repeat for cycle-through-panes.

## Known limitations

- **macOS Alt-key dead keys.** M-x produces `≈` on US-English layouts. Electron normalizes `Alt+X` in most cases; exotic input methods may eat the keystroke. Documented as a known limitation, not worked around.
- **No keyboard macro recording.** No Obsidian plugin provides this. C-x ( / C-x ) / C-x e are intentionally unbound.
- **Approximate Obsidian command coverage.** Not every emacs concept maps cleanly. C-x 5 0 (close window) depends on Obsidian's `workspace:close-window` which isn't always available; fail gracefully.
- **`[contenteditable]` quirks.** Selection / Range APIs behave differently than `<input>` / `<textarea>`. Some plugin UIs use `[contenteditable]` with internal state synchronization (React, etc.) that may not see our DOM mutations. Document failures as we find them; fix only where the surface is high-traffic.

## Out of scope

- Automated tests (no host).
- Replacing or extending the existing markdown-editor bindings (Layer 1 frozen).
- Macro recording.
- Customizing the binding table via plugin settings (future work).
- Cross-vault kill-ring sharing.

## Open questions resolved during review

Resolved 2026-05-07; carried over from the brainstorm gate.

| Question | Resolution |
|---|---|
| Layer numbering | L1 = existing in-editor; L2 = in-input (new); L3 = workspace (new). Locked. |
| Module split granularity | Layer 2 collapses to two files (`input-bindings/index.ts` + `ops.ts`) instead of three. |
| Phasing | Five phases instead of seven: Phase 1 obsoleted by the refactor plan; soft-deps moved to the front (Phase 1) since Phase 3 depends on it; collision doc folded into the release phase. |
| Refactor checkpoint release | Tag `0.5.0` after the refactor lands; feature work targets `0.6.0`. (Originally drafted as `0.10.0`/`0.11.0`; revised after auditing repo state — fork is split from upstream Klojer at version `0.3.1`. A salvage phase ports six upstream improvements as `0.4.0` before the refactor.) |
