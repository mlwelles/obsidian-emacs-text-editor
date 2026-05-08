# Design: Rebrand to Obsidian Emacs Everywhere

**Date:** 2026-05-08
**Status:** Approved (pending user review of this spec)

## Summary

Rename the project from `mlwelles/obsidian-emacs-text-editor` (a fork of `Klojer/obsidian-emacs-text-editor`) to a standalone project, **Obsidian Emacs Everywhere**. Update all metadata, repo settings, and documentation. Cut a 1.0.0 release. Defer community-directory submission to a later, separate effort.

## Goals

- Establish a distinct identity for the project, reflecting its expanded scope (in-input bindings, multi-chord prefix maps, soft-dep integrations) versus the upstream.
- Position the project around its differentiator: emacs/readline keybindings work **everywhere there is text** in Obsidian, not only in the markdown editor.
- Land a clean 1.0.0 release suitable for community-directory submission later.

## Non-goals

- Migration code, compatibility shims, or migration documentation. The author is the only user; this is a clean break.
- Submitting to the Obsidian community plugin directory as part of this effort. Submission is documented (Section 4 below) but deferred to a separate effort after a 1-2 week bake period.
- Code-level refactoring or feature work. This effort is metadata, documentation, and release plumbing only.

## Identity

| Attribute | Value |
|---|---|
| Project name | Obsidian Emacs Everywhere |
| GitHub repo | `mlwelles/obsidian-emacs-everywhere` |
| Plugin `id` | `emacs-everywhere` |
| Display name | `Emacs Everywhere` |
| Tagline | *Emacs and readline keybindings in the editor and in every text input.* |
| Initial version | 1.0.0 |

**Disambiguation:** The README will note that the project is unaffiliated with [`tecosaur/emacs-everywhere`](https://github.com/tecosaur/emacs-everywhere), the unrelated desktop tool that pops a floating emacs editor for any application.

**Attribution:** The README and the top-of-file source header in `main.ts` will note that the project was originally forked from [`Klojer/obsidian-emacs-text-editor`](https://github.com/Klojer/obsidian-emacs-text-editor) and is now an independent project.

## Positioning

Two of the four positioning options carry the brand:

1. **Pragmatic ergonomics** (headline) — emacs-style keybindings for people who think in emacs but live in Obsidian, including those who don't use emacs but expect readline-style editing in every text field (a familiar mental model for macOS users).
2. **Comprehensive coverage** (supporting) — extensive emacs binding coverage including in-input bindings and multi-chord prefix maps.

The name "Everywhere" foregrounds (1). The tagline and README cover (2).

## File and metadata changes

### `manifest.json`

| Field | Before | After |
|---|---|---|
| `id` | `emacs-text-editor` | `emacs-everywhere` |
| `name` | `Emacs text editor` | `Emacs Everywhere` |
| `description` | `Partial emulation of Emacs text editor for Obisidian` | `Emacs and readline keybindings in the editor and in every text input.` |
| `version` | `0.3.1` | `1.0.0` |
| `authorUrl` | (absent) | `https://github.com/mlwelles` |

`minAppVersion` and `isDesktopOnly` unchanged. No `fundingUrl`.

### `package.json`

- `name` → `obsidian-emacs-everywhere`
- `version` → `1.0.0`
- `description` → tagline (matches manifest)
- `author` → set/verify
- `repository`, `bugs`, `homepage` → point at `mlwelles/obsidian-emacs-everywhere`

### `versions.json`

Add `"1.0.0": "0.15.0"` entry. Existing 0.x entries retained for history.

### `Makefile`

Install path updated from `$OBSIDIAN_PLUGINS_DIR/emacs-text-editor` to `$OBSIDIAN_PLUGINS_DIR/emacs-everywhere`. Same change in the `uninstall` target.

### `README.md`

Full rewrite. Sections:

- Headline + tagline
- What it is / what it isn't
- Install (manual via Makefile; community-directory entry once approved)
- Keybinding reference (current README's table is stale — missing in-input bindings, kill ring, multi-chord)
- Soft-dependency table (mirrors `AGENTS.md`)
- Known limitations
- Attribution to Klojer's upstream
- Disambiguation re: `tecosaur/emacs-everywhere`
- License

### `AGENTS.md`

Update repo URLs and project name. Most content unchanged.

### `main.ts`

Update top-of-file comment header: project name, attribution, license. No code changes for the rename itself. Command ids preserved as-is (hygiene).

### `LICENSE`

Add or update. MIT (Obsidian-community norm). Preserve upstream copyright; add author copyright line.

## Migration

None. Author is sole user. Clean break.

## Community directory submission (deferred)

Captured here for completeness. Executed as a separate effort after a 1-2 week bake period on 1.0.0.

### Pre-submission stabilization checklist

Audit `main.ts` against the [Obsidian plugin guidelines](https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines), focusing on:

- Document-level `keydown` listeners must use `this.registerDomEvent()` so Obsidian cleans them up on plugin disable.
- No `innerHTML` / `outerHTML` / `insertAdjacentHTML`. Use `createEl`, `setText`, `addClass`.
- No `var`. Use `const` / `let`.
- No `console.log` in production paths; `console.warn` / `console.error` for genuine errors only.
- Kill ring (module-scoped) cleared on `onunload`.
- All `setInterval` / `setTimeout` registered via `this.registerInterval()`.
- No `app.workspace.activeLeaf` (deprecated). Use `getActiveViewOfType`.
- `manifest.json` `minAppVersion` accurate.
- `isDesktopOnly` honest — verify mobile behavior or flip to `true`.

### Submission mechanics

1. Fork [`obsidianmd/obsidian-releases`](https://github.com/obsidianmd/obsidian-releases).
2. Append to `community-plugins.json`:
   ```json
   {
     "id": "emacs-everywhere",
     "name": "Emacs Everywhere",
     "author": "mlwelles",
     "description": "Emacs and readline keybindings in the editor and in every text input.",
     "repo": "mlwelles/obsidian-emacs-everywhere"
   }
   ```
3. Open a PR. Bot validates; maintainer review follows (days to weeks).
4. Address feedback. Once merged, the plugin appears in the in-app community directory within hours.

## Execution sequence

Concrete commits for the rename. Implementation plan will expand each into tasks.

1. **Pre-flight** — verify upstream license; draft new tagline and README skeleton locally. No commits.
2. **Rename GitHub repo** — `obsidian-emacs-text-editor` → `obsidian-emacs-everywhere` via GitHub settings. Auto-redirect installed.
3. **Update local `origin`** — `git remote set-url origin <new-url>`. Verify and push a no-op.
4. **Branch** — `git checkout -b rebrand/emacs-everywhere`.
5. **Commit 1 — manifest + package metadata** — `manifest.json`, `package.json`, `versions.json`.
6. **Commit 2 — build + install paths** — `Makefile`. Verify with `make install` to test vault.
7. **Commit 3 — source header** — `main.ts` top-of-file comment.
8. **Commit 4 — LICENSE** — add or update.
9. **Commit 5 — README rewrite** — full rewrite per spec above.
10. **Commit 6 — AGENTS.md** — repo URLs and project name.
11. **Verify locally** — `make lint`, `make build`, `make install`, smoke-test per `AGENTS.md` testing checklist (layers 1, 2, and a multi-chord).
12. **Merge to `main`** and push.
13. **Tag and release** — `git tag 1.0.0 && git push --tags`. Create GitHub release for `1.0.0` with `main.js` and `manifest.json` attached as assets.
14. **Bake period** — 1-2 weeks of personal use. Capture issues for a 1.0.1.
15. **(Separate effort)** — submit to community directory per Section 4.

## Risks

- **Namespace overlap with `tecosaur/emacs-everywhere`.** Mitigated by the README disambiguation note and the differing ecosystems (desktop tool vs. Obsidian plugin). Plugin `id` uniqueness is per-Obsidian, so no technical collision.
- **GitHub redirect drift.** Auto-redirects work indefinitely but referencing the old URL in new content (badges, CI, third-party links) accumulates technical debt. Mitigated by updating local `origin` and all in-repo references in the rebrand commits.
- **Submission rejection later.** Mitigated by the pre-submission audit checklist and the bake period.

## Open questions

None at spec time.
