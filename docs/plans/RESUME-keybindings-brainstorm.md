# Resume — Keybindings Feature Brainstorm

**Session date:** 2026-05-06
**Status:** Brainstorm complete; design doc written; refactor planned. Ready for implementation.
**Original goal:** Bind basic emacs keybindings to every text input in Obsidian, not just the markdown editor.

## Current state

Two plan documents exist in this directory:

1. **`2026-05-06-emacs-bindings-everywhere-design.md`** — full design for the feature work. Three layers (in-editor existing, in-input new, workspace bindings new). Soft-dependency policy. Module structure. Phasing.

2. **`2026-05-06-refactor-and-reorg.md`** — the prerequisite. Code review of current `main.ts`, bug fixes, module split, `src/` reorg, vitest + CI tooling. **This is sequenced FIRST**, before any feature work.

**Sequence:** Refactor plan → its implementation plan → execute → feature design → its implementation plan → execute.

## Decisions locked in during brainstorming

These are settled. Don't re-litigate unless the user explicitly reopens them.

| Question | Decision |
|---|---|
| Which surfaces matter? | All text inputs: `<input>`, `<textarea>`, `[contenteditable]`, plus secondary CodeMirror — i.e., D ("all of the above") |
| Which emacs bindings? | Match the existing plugin's command set 1:1 (option D from the brainstorm) |
| Kill ring scope | One unified kill ring shared across editor and inputs (option C) — feasible because the user owns the plugin |
| Detection strategy | Document-level keydown listener in capture phase (option A); skip elements inside `.cm-editor` |
| Collision policy | Emacs wins; rebind Obsidian defaults to their emacs equivalents where sensible; never remove Obsidian defaults outright; additive only |
| Multi-chord support | Soft dependency on `obsidian-sequence-hotkeys`. Listen for plugin-enabled/disabled events; dynamic re-register |
| M-x and similar global aliases | Yes — additive Layer 3 |
| Soft-dependency policy | Codified: prefer richer plugin if available, fall back to native, drop only if neither exists. Documented in `AGENTS.md` |
| `C-x C-f` mapping | Quick switcher (find-file with completion across vault) |
| `C-x d` mapping | File explorer (dired) |
| `C-x b` mapping | Switcher++ "open editors" mode if enabled, else quick switcher |
| `M-x` upgrade path | Switcher++ commands mode if enabled, else native command palette |
| Macro keys (`C-x (`, `C-x )`, `C-x e`) | Dropped — no Obsidian plugin provides keystroke recording |
| Layer 2 binding table | Finalized at 16 entries — see design doc |
| File structure | Module split (option B) — see design doc + refactor plan |

## Soft dependencies established

| Plugin | What it powers | Native fallback |
|---|---|---|
| `obsidian-sequence-hotkeys` | All multi-chord (`C-x …`) bindings | None — Layer 3b silently inactive |
| `darlal-switcher-plus` (Quick Switcher++) | M-x, C-x C-f, C-x b | `command-palette:open`, `switcher:open`, `switcher:open` |
| `cycle-through-panes` | C-x o | `workspace:next-tab` (imperfect; cycles tabs not panes) |

All three soft deps live in AGENTS.md and the design doc; runtime detection via `app.plugins.enabledPlugins` plus enable/disable event listeners.

## Open questions still pending in brainstorm

These were acknowledged at the design-doc review gate; user has not yet given final approval to proceed:

1. **Layer numbering** — design doc renumbered the three layers (L1=existing editor, L2=in-input, L3=workspace) versus the brainstorm conversation's numbering. Worth confirming the design-doc numbering reads cleaner before locking in.
2. **Module split granularity** — design doc proposes `input-bindings/cursor.ts` + `region.ts` + `filter.ts` as a subdirectory. Could be collapsed to fewer files if that feels over-split.
3. **Phasing** — 7 phases ending in a release. Comfortable with that granularity?
4. **Refactor checkpoint release** — tag a 0.10.0 "refactor only" release after the refactor, or roll into the same release as the new features?

## Next concrete step

The brainstorming skill's terminal state is "invoke writing-plans skill." Two plans need writing-plans treatment, in order:

1. **Refactor implementation plan** — turns `2026-05-06-refactor-and-reorg.md` into a step-by-step executable plan (8 commits, what to verify after each, etc.).
2. **Feature implementation plan** — turns `2026-05-06-emacs-bindings-everywhere-design.md` into a step-by-step executable plan (the 7 phases).

Resume the brainstorm gate first (get user signoff on the open questions above), then move to writing-plans.

## Working environment notes

- **Repo:** `~/Developer/mlwelles/obsidian-emacs-text-editor`
- **Test vault:** `~/Documents/Obsidian/blackbook` — this is where `make install` deploys
- **Build/install:** `OBSIDIAN_PLUGINS_DIR=~/Documents/Obsidian/blackbook/Notes/.obsidian/plugins make install`
- **All conventions:** see `AGENTS.md` in repo root
- **Plans live here:** `docs/plans/` — every plan from this and future sessions belongs here

## Prompt to paste in the new opencode session

Start a fresh `opencode` process with `~/Developer/mlwelles/obsidian-emacs-text-editor` as the working directory, then paste:

> I'm resuming a brainstorm/planning session for adding emacs keybindings to every text input in Obsidian. Read `AGENTS.md` for repo conventions and `docs/plans/RESUME-keybindings-brainstorm.md` for full context on where we left off — including locked-in decisions, soft dependencies, and the four open questions still pending my approval. Also read `docs/plans/2026-05-06-refactor-and-reorg.md` and `docs/plans/2026-05-06-emacs-bindings-everywhere-design.md` since those are the in-progress plans.
>
> The refactor must land before feature work. After you've absorbed the context, walk me through the four open questions in the resume doc one at a time so I can sign off, then invoke the writing-plans skill to produce the refactor's executable implementation plan first, then the feature's implementation plan.
>
> The test vault is `~/Documents/Obsidian/blackbook` — when builds need testing, install there.
