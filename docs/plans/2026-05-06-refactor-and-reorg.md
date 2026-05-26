# Refactor & Reorg — Plan

**Date:** 2026-05-06
**Status:** Approved (open questions resolved 2026-05-07)
**Repo:** `mlwelles/obsidian-emacs-text-editor`

## Goal

Restructure the existing plugin so it follows TypeScript and Obsidian-plugin best practices, before adding new features (per `2026-05-06-emacs-bindings-everywhere-design.md`). No behavior change. Preserve every existing binding and the kill-ring / yank-pop semantics exactly.

## Why now

Adding the three-layer architecture (in-input bindings, prefix maps, global aliases) on top of the current 607-line single file would multiply the existing problems. Cleaning up first means each new feature lands in a smaller, clearer codebase.

## Code-review findings

### Bugs to fix during refactor

1. **`'backwards-kill-word'` typo** (line 9). The repeat-detection list has `'backwards-kill-word'` (extra `s`); the actual command id is `'backward-kill-word'` (line 189). Backward kill-word doesn't extend the kill ring on repeat, contrary to apparent intent.
2. **`console.log` leaks** (lines 519, 522 in `yankPop`). Should be `this.logDebug` — currently logs unconditionally.
3. **`"seplacing"` typo** (line 370 in `withDelete`). Cosmetic.
4. **Index reset on plugin reload.** `killRingEndIndex = -1` initialized at field declaration, but `killRing` is overwritten in `onload`. Probably benign (Obsidian creates a fresh instance on enable) but worth tightening.

### Design issues to address

1. **`onload` is 290 lines of repetitive `addCommand` calls.** Every command has the same shape: id → name → hotkey → callback that calls `commandInvoked(id)` → wraps editor op. Extract to a data table + a helper that registers from the table.
2. **Plugin class is a flat field bag.** Three concerns tangled:
   - **Kill ring:** `killRing`, `killRingEndIndex`, `killRingMaxSize`, `yankIndex`, `extendLastKill`, `extendLastKillBackwards`
   - **Yank-pop session:** `yankStart`, `yankEnd`, `yankPopIndex`
   - **Selection/mark:** `selectFrom`
   - **Command tracking:** `lastCommandInvoked`
   Each gets its own class with its own invariants.
3. **String IDs everywhere.** `commandInvoked("forward-char")` is checked against the registered id by convention only. Replace with an enum or a const `as const` map so TypeScript catches drift.
4. **`commandInvoked` is doing three jobs.** Tracking last-command, deciding extend-kill flags, cancelling yank-pop. Each is its own concern and each lives behind its proper module after the split.
5. **Logging coupled to plugin instance.** Standalone module/function, configurable via plugin setting later if wanted.
6. **No tests.** The kill-ring with extend-on-repeat and yank-pop is pure state-machine logic with no Obsidian dependency. Trivial to unit test once extracted.
7. **Cargo-cult `async`.** Several `editorCallback`s are `async` but only await operations like `navigator.clipboard.readText()`, which is fine — but a few `async` arrows have no `await` at all. Drop the keyword where unused.

### Repo structure issues

1. `main.ts` at repo root. Modern Obsidian plugins put source in `src/`.
2. No CI for build/lint. Only release workflow exists.
3. No test runner configured.
4. Build copies `main.js` only; modern practice copies `manifest.json` and `styles.css` too if present (we have none, but be ready).

## Target file structure

```
.
├── src/
│   ├── main.ts                    # Plugin class; onload/onunload; wires modules
│   ├── commands/
│   │   ├── definitions.ts         # The command table (CommandDef[])
│   │   ├── register.ts            # Iterates the table, calls plugin.addCommand
│   │   └── ids.ts                 # const IDS = { ... } as const; type CommandId
│   ├── kill-ring/
│   │   ├── kill-ring.ts           # KillRing class — pure state, no Obsidian
│   │   ├── kill-ring.test.ts      # Unit tests
│   │   ├── yank-pop.ts            # YankPopSession — tracks active yank-pop window
│   │   └── yank-pop.test.ts
│   ├── selection/
│   │   ├── mark.ts                # MarkState — selectFrom; selection lifecycle
│   │   └── mark.test.ts
│   ├── editor-ops/
│   │   ├── movement.ts            # forward-char, next-line, etc. (Obsidian-side)
│   │   ├── editing.ts             # kill-line, kill-word, delete-char, etc.
│   │   ├── paragraph.ts           # forward/backward-paragraph (extracted, well-tested)
│   │   └── recenter.ts
│   ├── tracking/
│   │   ├── repeat-detector.ts     # tracks last command id; returns "is repeat?"
│   │   └── repeat-detector.test.ts
│   └── log.ts                     # logger factory; debug toggle
├── tests/
│   └── (vitest config picks up *.test.ts in src/)
├── docs/
│   ├── plans/                     # design + plan docs (this file)
│   └── (architecture notes if useful)
├── manifest.json
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── vitest.config.ts               # NEW
├── .eslintrc
├── .github/workflows/
│   ├── release.yml                # existing
│   └── ci.yml                     # NEW: lint + typecheck + test on PRs
├── Makefile                       # update entry point to src/main.ts
├── AGENTS.md
└── README.md
```

Module size target: ~150 lines per file. Hard ceiling: 300.

## Pre-refactor: Phase 0 — Salvage upstream improvements

Before the refactor, port four upstream Klojer commits that are pure bug fixes or additive features. Each lands as a behavior-additive or behavior-fixing commit on the current `main.ts`, with no structural change yet. After Phase 0 the plugin ships as `0.4.0`.

The skipped upstream work falls in three groups:

1. **Key-repeat infrastructure** (PRs #15, #16, #18) — orthogonal to the emacs-everywhere goal, ~300 lines of settings + timer machinery; Obsidian's native repeat handles this adequately.
2. **Already done in the fork.** Visual line motion for `next-line`/`previous-line` (#21, 6aece50) is already in place — the fork's `next-line` and `previous-line` callbacks call `editor.exec("goDown"/"goUp")` (main.ts:62, 74). The `delete-char` no-clipboard fix (#17, 8c314cb) is also already in place — the fork's `withDelete` (main.ts:364) replaces selection with empty string and never calls `killRingSave`, distinct from `withKill` which does save.
3. **Not applicable.** The Cyrillic regex fix (#23, f4bf6a1) operates on upstream's custom word-boundary code; the fork uses `editor.exec("goWordRight"/"goWordLeft")` and inherits Obsidian's word-boundary detection. Verify during Phase 0 manual regression that Cyrillic works correctly; if it doesn't, port the regex into whichever module ends up handling word logic.

| Commit | Source PR | Summary |
|---|---|---|
| `feat: visual line edges for move-beginning/end-of-line` | #24 (a3267c7) | Direct CM6 integration so `C-a`/`C-e` honor visual lines on wrapped text |
| `fix: mark region stability across links and on mousedown` | #20 (9982a26) | Selection survives crossing links/widgets; mousedown cancels selection |
| `feat: add mark-whole-buffer command` | half of #25 (288e967) | New unbound command; needed by Layer 3b's `C-x h` |
| `feat: add transpose-chars command` | half of #25 (288e967) | New unbound command (`C-t` in emacs) |

## Refactor strategy

Eight commits. Each commit individually verifiable: build passes, plugin loads in Obsidian, manual smoke test of a representative binding works.

### Commit 1 — Move source to `src/`, update build

Move `main.ts` → `src/main.ts`. Update `esbuild.config.mjs` `entryPoints: ["src/main.ts"]`. Update `tsconfig.json` `include`. No code changes. Verify build. Manual smoke test: install, load Obsidian, C-f works.

### Commit 2 — Extract logger

Create `src/log.ts`:
```ts
export interface Logger {
  debug(msg: string, ...args: unknown[]): void;
}
export function createLogger(prefix: string, enabled: () => boolean): Logger { ... }
```

Replace `this.logDebug(...)` and stray `console.log(...)` calls in `main.ts` with logger usage. Plugin instance gets `private logger: Logger` initialized in `onload`. Fix yank-pop `console.log` leaks here.

### Commit 3 — Extract command IDs and command table

Create `src/commands/ids.ts`:
```ts
export const COMMAND_IDS = {
  FORWARD_CHAR: 'forward-char',
  BACKWARD_CHAR: 'backward-char',
  // ... all 25
} as const;
export type CommandId = typeof COMMAND_IDS[keyof typeof COMMAND_IDS];
```

Create `src/commands/definitions.ts` with a `CommandDef` type and a `COMMANDS: CommandDef[]` array. Move every `addCommand` call's data — id, name, hotkey, callback — into entries in this array.

Create `src/commands/register.ts` with `registerCommands(plugin, commands)` that iterates and calls `plugin.addCommand`.

`onload` collapses to a few lines. Fixes the `'backwards-kill-word'` vs `'backward-kill-word'` typo because callbacks now reference `COMMAND_IDS.BACKWARD_KILL_WORD`, not a free string.

### Commit 4 — Extract KillRing class

Create `src/kill-ring/kill-ring.ts`:
```ts
export class KillRing {
  constructor(private maxSize = 120) { ... }
  save(text: string, opts?: { extendBackward?: boolean; extendForward?: boolean }): void
  current(): string | undefined        // text at yankIndex
  rotate(): string | undefined         // for yank-pop
  // no clipboard logic — caller bridges
}
```

Pure state, no Obsidian, no `navigator`. Plugin owns clipboard sync separately (a thin wrapper that calls `killRing.save(...)` then writes to `navigator.clipboard`).

Add `src/kill-ring/kill-ring.test.ts` covering: basic save/yank, ring wrap-around at max size, extend-forward (M-d repeated), extend-backward (M-Backspace repeated — this is where the bug fix shows up as a passing test), rotation for yank-pop.

### Commit 5 — Extract YankPopSession

Create `src/kill-ring/yank-pop.ts`:
```ts
export class YankPopSession {
  start(start: EditorPosition, end: EditorPosition): void
  cancel(): void
  isActive(): boolean
  // cursor positions of the last yank insertion + index pointer
}
```

Tests cover: start → cancel, can't pop without start, basic state transitions.

### Commit 6 — Extract MarkState

Create `src/selection/mark.ts`:
```ts
export class MarkState {
  set(pos: EditorPosition): void
  clear(): void
  isActive(): boolean
  origin(): EditorPosition | undefined
}
```

Plugin's `withSelect` / `withSelectionUpdate` / `cancelSelect` collapse around this.

### Commit 7 — Extract RepeatDetector

Create `src/tracking/repeat-detector.ts`:
```ts
export class RepeatDetector {
  track(id: string): { isRepeat: boolean }
  last(): string | undefined
}
```

This replaces the `lastCommandInvoked` field + the implicit boolean computation in `commandInvoked`. The "should this kill extend?" decision moves from `commandInvoked` (which becomes empty enough to delete) into the kill-line/kill-word callbacks themselves, where it's clearer.

### Commit 8 — Extract editor-ops modules

Move the operation implementations (currently methods on `EmacsTextEditorPlugin`) into focused modules:

- `src/editor-ops/movement.ts` — `forwardChar`, `backwardChar`, `goToEndOfLine`, `goToBeginningOfLine`, `forwardParagraph`, etc. Each takes `(editor, mark, ...)` as needed.
- `src/editor-ops/editing.ts` — `killLine`, `killRegion`, `killWord`, `deleteChar`, `yank`.
- `src/editor-ops/paragraph.ts` — the existing `moveToNextParagraph` logic, cleaned up. Direction enum stays.
- `src/editor-ops/recenter.ts` — trivial; keep separate for tidy commands table.

Each function takes its dependencies as parameters (editor, killRing, mark, yankPop, logger). `main.ts` becomes mostly wiring: instantiate state objects, build the command table referencing these functions with bound dependencies, register commands.

After commit 8, `main.ts` should be under 100 lines.

## Tooling additions

### Vitest

Add `vitest` as devDependency. `vitest.config.ts` minimal:
```ts
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: { include: ['src/**/*.test.ts'] }
});
```

`package.json` scripts:
```json
"test": "vitest run",
"test:watch": "vitest",
"lint": "eslint --fix src/**/*.ts",
"typecheck": "tsc -noEmit -skipLibCheck"
```

Update `Makefile` `lint` target accordingly.

### CI

`.github/workflows/ci.yml`:
```yaml
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run lint
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
```

### Editor config

`.editorconfig` already exists — verify it's sane during this work, no change unless inconsistent.

## Test coverage targets

After refactor:
- **KillRing:** ≥90% lines covered. Every public method tested. Edge cases: empty ring, single-element ring, extend on repeat (forward + backward), wrap-around, rotation.
- **YankPopSession:** 100% (small surface).
- **MarkState:** 100% (tiny surface).
- **RepeatDetector:** 100%.
- **editor-ops:** lower priority — tightly coupled to Obsidian's `Editor`, harder to mock. Skip for v1; address with integration tests later.
- **paragraph navigation:** add unit tests, since it's pure string scanning. Mockable with a fake editor that returns `getValue()` and `posToOffset` / `offsetToPos`. Worth the effort — this is the most algorithmically dense code in the plugin.

## Manual regression after refactor

After commit 8, full regression pass on a vault:

1. **Movement:** C-f, C-b, C-n, C-p, M-f, M-b, C-a, C-e, M-S-,, M-S-., M-S-[, M-S-]
2. **Editing:** C-d, C-k (empty line), C-k (with content), M-d, M-Backspace
3. **Mark/region:** C-Space, move, C-w (kill region), C-y (yank back)
4. **Kill ring:** kill 3 different things, M-y after C-y rotates correctly
5. **Extend-kill on repeat:** M-d M-d M-d → kill ring contains the concatenation; M-Backspace M-Backspace M-Backspace → same, prepended (this verifies the bug fix)
6. **Undo/redo:** C-/, C-S-_
7. **Misc:** C-l, C-g

If any regresses, fix in-place; do not advance to feature work.

## Out of scope for this plan

- Any new bindings (Layer 2/3 from the design doc — that's the next plan)
- UI changes
- Settings panel for debug toggle (could come later; not now)
- Migrating to Obsidian's newer command API patterns if they exist (assume current API is fine)
- Renaming exported plugin id in `manifest.json` (would break user installs)

## Order of operations

1. Phase 0 (salvage) lands first. Tag `0.4.0` after manual regression confirms behavior.
2. Refactor (the eight commits in this plan) lands next. **Tag `0.5.0` as the refactor checkpoint** — module split + tooling, no feature changes. The standalone tag isolates any subtle regressions (the kill-ring / yank-pop state machine is the highest-risk piece) from feature work that follows.
3. Feature design plan (`2026-05-06-emacs-bindings-everywhere-design.md`) executes last; that work targets `0.6.0`.

The fork is split from upstream (Klojer's repo); these are now the fork's own version numbers, independent of upstream's tag history (which goes through `0.10.0` for unrelated upstream work).

## Risk

Low. Each commit is reversible. Behavior is preserved by intent. Manual regression after every commit catches drift early. Unit tests give confidence on the kill-ring state machine, which is the highest-risk piece to refactor.
