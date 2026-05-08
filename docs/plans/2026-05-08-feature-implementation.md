# Emacs Bindings Everywhere — Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Layer 2 (in-input bindings) and Layer 3 (workspace + multi-chord) on top of the modular `src/` tree produced by the refactor. Ship as `0.6.0`. Brings emacs/readline keybindings to every text-input surface in Obsidian — search bar, quick switcher, command palette, file rename, settings, frontmatter, plugin modals — and adds workspace-level commands (M-x, C-s, etc.) plus multi-chord prefix maps (C-x C-s, C-x b, etc.) when the optional Sequence Hotkeys plugin is enabled.

**Architecture:** Three new logical layers, each landing in its own module. Soft-dependency framework comes first because Phase 3a depends on it. Layer 2 reuses the `KillRing` and `MarkState` from the refactor as a shared kill-ring/mark across editor and inputs. Layer 3a is ordinary `addCommand` registrations. Layer 3b is conditional registration via the Sequence Hotkeys plugin's API, dynamically toggled when that plugin is enabled or disabled.

**Tech Stack:** TypeScript (strict), esbuild, vitest. Obsidian Plugin API. DOM Selection / Range APIs (Layer 2 for `[contenteditable]`). Sequence Hotkeys plugin's runtime API (Layer 3b).

**Test vault:** `~/Documents/Obsidian/blackbook`.

**Predecessor plans:**
- `docs/plans/2026-05-06-emacs-bindings-everywhere-design.md` — design
- `docs/plans/2026-05-06-refactor-and-reorg.md` — refactor design
- `docs/plans/2026-05-07-refactor-implementation.md` — refactor implementation

**Predicate:** the refactor implementation plan has been executed; current version is `0.5.0` or later (verified at `0.5.1` as of 2026-05-08); `src/` tree exists with `KillRing`, `YankPopSession`, `MarkState`, `RepeatDetector`, command IDs/definitions/registrar, editor-ops modules; vitest is configured (29 tests passing across 5 files); CI workflow exists at `.github/workflows/ci.yml`. **If any of those assumptions is false, stop and execute the refactor first.**

---

## File structure (new modules added in this plan)

Files to be created on top of the refactored tree:

```
src/
├── soft-deps/
│   ├── plugin-detector.ts     # Phase 1: detect enabled plugins, subscribe to toggle events
│   ├── plugin-detector.test.ts
│   ├── command-resolver.ts    # Phase 1: resolve preferred + fallback to active command id
│   ├── command-resolver.test.ts
│   └── known-plugins.ts       # Phase 1: typed handles for the three soft-deps
├── input-bindings/
│   ├── index.ts               # Phase 2: capture-phase keydown listener, dispatch
│   ├── element-filter.ts      # Phase 2: which elements get bindings
│   ├── element-filter.test.ts
│   ├── ops.ts                 # Phase 2: vanilla-DOM cursor / region primitives
│   └── ops.test.ts
├── workspace-bindings/
│   └── single-chord.ts        # Phase 3a: M-x, C-s, C-r, M-%, C-g aliases
├── prefix-maps/
│   └── multi-chord.ts         # Phase 4: Sequence Hotkeys integration
├── collisions.ts              # Phase 5: documented collision map (data only)
└── main.ts                    # modified: wire new modules
```

Files modified by this plan:

- `src/main.ts` — add wiring for soft-deps, input-bindings, workspace-bindings, multi-chord
- `AGENTS.md` — keep table accurate; add notes on Layer 2 capture-phase listener
- `README.md` — feature documentation, soft-dep table
- `manifest.json`, `package.json`, `versions.json` — version bump to 0.6.0

---

## Verification phase (no commits)

### Task V.1: Confirm refactor predicate

**Files:** none

- [ ] **Step 1: Verify version is 0.5.0 or later**

Run: `cat manifest.json | python3 -c "import json,sys; print(json.load(sys.stdin)['version'])"`
Expected: `0.5.0` or higher (`0.5.1` as of 2026-05-08).

If lower, the refactor implementation plan has not been executed. Stop and run that plan first.

- [ ] **Step 2: Verify `src/` tree exists**

Run: `ls src/ src/kill-ring/ src/selection/ src/tracking/ src/commands/ src/editor-ops/`
Expected: directories exist with files matching the refactor plan's targets.

- [ ] **Step 3: Verify tests pass**

Run: `npm test`
Expected: all unit tests pass (logger, KillRing, YankPopSession, MarkState, RepeatDetector).

- [ ] **Step 4: Verify clean working tree**

Run: `git status`
Expected: clean.

- [ ] **Step 5: Confirm test vault env var**

Run: `echo $OBSIDIAN_PLUGINS_DIR`
Expected: non-empty path ending in `.obsidian/plugins`.

If any verification fails, stop.

### Task V.2: Verify soft-dep plugin IDs and command IDs at runtime

**This task requires a live Obsidian install and is not subagent-executable.** A subagent dispatched to run this plan must stop here, surface the verification request to the user, and resume after the user has filled in `docs/plans/2026-05-08-soft-dep-runtime-ids.md`.

The design doc references three soft-dep plugins by id: `obsidian-sequence-hotkeys`, `darlal-switcher-plus`, `cycle-through-panes`. These are the GitHub repo names. The actual runtime ids in `app.plugins.enabledPlugins` may differ. Same for command ids exposed by these plugins.

**Files:** none

- [ ] **Step 1: Open the test vault and install the three optional plugins**

In Obsidian, Settings → Community plugins → Browse → install:
- "Sequence Hotkeys" by Roan Moolman
- "Quick Switcher++" by Daniel
- "Cycle through panes" (any of: by `Yuichi-Aragi`, `Quorafind`, etc.)

Enable each.

- [ ] **Step 2: Read the actual plugin IDs from runtime**

Open the developer console (Cmd-Option-I). Run:
```js
Array.from(app.plugins.enabledPlugins)
```

Expected output is an array of plugin ids. Note the exact strings for each of the three plugins.

- [ ] **Step 3: List commands each plugin exposes**

Still in the console, for each plugin id you noted, run:
```js
Object.keys(app.commands.commands).filter(id => id.startsWith("<plugin-id>:"))
```

Expected: list of command ids exposed by the plugin. Specifically note:
- For Sequence Hotkeys: any `register-sequence` / `register-prefix` style commands. (The integration in Phase 4 may use the plugin's API directly via `app.plugins.plugins["<id>"].api` rather than commands; check both.)
- For Switcher++: `command-palette` mode, `editors` mode, `find-file` / `open` style commands.
- For Cycle through panes: cycle-pane / next-pane commands.

- [ ] **Step 4: Record findings in a scratch note**

Create `docs/plans/2026-05-08-soft-dep-runtime-ids.md` with the verified IDs:

```markdown
# Soft-dep runtime IDs (verified <date>)

## Sequence Hotkeys
- Plugin id: <verified value>
- API access: app.plugins.plugins["<id>"]?.<api-shape>
- Notes: <how to register a multi-chord prefix>

## Quick Switcher++ (darlal-switcher-plus)
- Plugin id: <verified value>
- Commands used:
  - <command-id-for-commands-mode>
  - <command-id-for-editors-mode>
  - <command-id-for-default-open>

## Cycle through panes
- Plugin id: <verified value>
- Commands used:
  - <command-id-for-cycle>
```

The Phase 1, 3a, 3b, and 4 tasks consume this file as the source of truth. **If you can't verify a plugin id or command, stop and ask the user for guidance — do not guess.**

---

## Phase 1 — Soft-deps foundation

Soft-deps must exist before Phase 3a (M-x dispatches via the resolver). Pure logic; no Obsidian DOM needed. Heavily unit tested.

### Task 1.1: `PluginDetector` class with detection and toggle subscription

**Files:**
- Create: `src/soft-deps/plugin-detector.ts`
- Create: `src/soft-deps/plugin-detector.test.ts`

- [ ] **Step 1: Write `src/soft-deps/plugin-detector.test.ts` (failing first)**

```ts
import {beforeEach, describe, expect, it, vi} from "vitest";
import {PluginDetector} from "./plugin-detector";

interface FakeApp {
	plugins: {
		enabledPlugins: Set<string>;
	};
	workspace: {
		on: (event: string, cb: (id: string) => void) => unknown;
		offref: (ref: unknown) => void;
	};
}

function makeFakeApp(initialEnabled: string[] = []): FakeApp {
	const handlers = new Map<string, Set<(id: string) => void>>();
	return {
		plugins: {enabledPlugins: new Set(initialEnabled)},
		workspace: {
			on(event, cb) {
				if (!handlers.has(event)) {
					handlers.set(event, new Set());
				}
				handlers.get(event)!.add(cb);
				const ref = {event, cb};
				return ref;
			},
			offref(ref) {
				const r = ref as {event: string; cb: (id: string) => void};
				handlers.get(r.event)?.delete(r.cb);
			},
		},
		// test helper:
		_emit(event: string, id: string) {
			handlers.get(event)?.forEach(cb => cb(id));
		},
	} as FakeApp & {_emit(event: string, id: string): void};
}

describe("PluginDetector", () => {
	it("returns true for plugins enabled at construction", () => {
		const app = makeFakeApp(["alpha", "beta"]);
		const detector = new PluginDetector(app as any);
		expect(detector.isEnabled("alpha")).toBe(true);
		expect(detector.isEnabled("beta")).toBe(true);
	});

	it("returns false for plugins not enabled", () => {
		const app = makeFakeApp(["alpha"]);
		const detector = new PluginDetector(app as any);
		expect(detector.isEnabled("beta")).toBe(false);
	});

	it("notifies subscribers when a plugin is enabled at runtime", () => {
		const app = makeFakeApp() as ReturnType<typeof makeFakeApp> & {_emit(e: string, id: string): void};
		const detector = new PluginDetector(app as any);
		const onChange = vi.fn();
		detector.subscribe("alpha", onChange);
		expect(onChange).not.toHaveBeenCalled();
		app.plugins.enabledPlugins.add("alpha");
		app._emit("plugin-enabled", "alpha");
		expect(onChange).toHaveBeenCalledWith(true);
	});

	it("notifies subscribers when a plugin is disabled at runtime", () => {
		const app = makeFakeApp(["alpha"]) as ReturnType<typeof makeFakeApp> & {_emit(e: string, id: string): void};
		const detector = new PluginDetector(app as any);
		const onChange = vi.fn();
		detector.subscribe("alpha", onChange);
		app.plugins.enabledPlugins.delete("alpha");
		app._emit("plugin-disabled", "alpha");
		expect(onChange).toHaveBeenCalledWith(false);
	});

	it("ignores events for unrelated plugins", () => {
		const app = makeFakeApp() as ReturnType<typeof makeFakeApp> & {_emit(e: string, id: string): void};
		const detector = new PluginDetector(app as any);
		const onChange = vi.fn();
		detector.subscribe("alpha", onChange);
		app._emit("plugin-enabled", "beta");
		expect(onChange).not.toHaveBeenCalled();
	});

	it("unsubscribes cleanly", () => {
		const app = makeFakeApp() as ReturnType<typeof makeFakeApp> & {_emit(e: string, id: string): void};
		const detector = new PluginDetector(app as any);
		const onChange = vi.fn();
		const unsubscribe = detector.subscribe("alpha", onChange);
		unsubscribe();
		app.plugins.enabledPlugins.add("alpha");
		app._emit("plugin-enabled", "alpha");
		expect(onChange).not.toHaveBeenCalled();
	});

	it("dispose removes all subscriptions", () => {
		const app = makeFakeApp() as ReturnType<typeof makeFakeApp> & {_emit(e: string, id: string): void};
		const detector = new PluginDetector(app as any);
		const a = vi.fn();
		const b = vi.fn();
		detector.subscribe("alpha", a);
		detector.subscribe("beta", b);
		detector.dispose();
		app._emit("plugin-enabled", "alpha");
		app._emit("plugin-enabled", "beta");
		expect(a).not.toHaveBeenCalled();
		expect(b).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run, verify failing**

```sh
npm test
```

Expected: all tests fail with "Cannot find module './plugin-detector'".

- [ ] **Step 3: Implement `src/soft-deps/plugin-detector.ts`**

```ts
import type {App, EventRef} from "obsidian";

type ChangeCallback = (enabled: boolean) => void;

export class PluginDetector {
	private subscribers = new Map<string, Set<ChangeCallback>>();
	private enabledRef: EventRef;
	private disabledRef: EventRef;

	constructor(private readonly app: App) {
		// Cast: app.workspace.on supports custom plugin lifecycle events
		// that aren't in the published Obsidian type definitions.
		this.enabledRef = (this.app.workspace as unknown as {
			on(event: string, cb: (id: string) => void): EventRef;
		}).on("plugin-enabled", (id: string) => this.notify(id, true));
		this.disabledRef = (this.app.workspace as unknown as {
			on(event: string, cb: (id: string) => void): EventRef;
		}).on("plugin-disabled", (id: string) => this.notify(id, false));
	}

	isEnabled(pluginId: string): boolean {
		return this.app.plugins.enabledPlugins.has(pluginId);
	}

	subscribe(pluginId: string, callback: ChangeCallback): () => void {
		if (!this.subscribers.has(pluginId)) {
			this.subscribers.set(pluginId, new Set());
		}
		this.subscribers.get(pluginId)!.add(callback);
		return () => {
			this.subscribers.get(pluginId)?.delete(callback);
		};
	}

	dispose(): void {
		this.subscribers.clear();
		this.app.workspace.offref(this.enabledRef);
		this.app.workspace.offref(this.disabledRef);
	}

	private notify(pluginId: string, enabled: boolean): void {
		this.subscribers.get(pluginId)?.forEach(cb => cb(enabled));
	}
}
```

**Note:** The Obsidian type definitions may not declare `app.plugins.enabledPlugins` or `plugin-enabled` / `plugin-disabled` events publicly. The `unknown` casts above are intentional — these are documented runtime APIs but undocumented types. If the casts cause lint warnings, suppress them locally.

- [ ] **Step 4: Verify tests pass**

```sh
npm test
```

Expected: 7 passing tests.

- [ ] **Step 5: Commit**

```sh
git add src/soft-deps/plugin-detector.ts src/soft-deps/plugin-detector.test.ts
git commit -m "feat(soft-deps): add PluginDetector

Detects whether a given plugin is enabled and notifies subscribers when
the state changes via Obsidian's plugin-enabled / plugin-disabled
workspace events. Pure-state class with full unit-test coverage; uses
the runtime app.plugins.enabledPlugins API, which is not in the public
type definitions (cast through unknown)."
```

### Task 1.2: `CommandResolver` for preferred + fallback resolution

**Files:**
- Create: `src/soft-deps/command-resolver.ts`
- Create: `src/soft-deps/command-resolver.test.ts`

- [ ] **Step 1: Write `src/soft-deps/command-resolver.test.ts` (failing first)**

```ts
import {describe, expect, it, vi} from "vitest";
import {CommandResolver, type ResolvedCommand} from "./command-resolver";
import type {PluginDetector} from "./plugin-detector";

function makeDetector(enabled: string[] = []): PluginDetector {
	const subscribers = new Map<string, Set<(enabled: boolean) => void>>();
	return {
		isEnabled: (id: string) => enabled.includes(id),
		subscribe: (id: string, cb: (enabled: boolean) => void) => {
			if (!subscribers.has(id)) subscribers.set(id, new Set());
			subscribers.get(id)!.add(cb);
			return () => subscribers.get(id)?.delete(cb);
		},
		dispose: () => subscribers.clear(),
		_emit: (id: string, enabled: boolean) => subscribers.get(id)?.forEach(cb => cb(enabled)),
	} as unknown as PluginDetector;
}

describe("CommandResolver", () => {
	it("returns the preferred command id when the preferred plugin is enabled", () => {
		const detector = makeDetector(["preferred-plugin"]);
		const resolver = new CommandResolver(detector);
		const result = resolver.resolve({
			preferred: {pluginId: "preferred-plugin", commandId: "preferred-plugin:open"},
			fallback: {commandId: "native:open"},
		});
		expect(result.commandId).toBe("preferred-plugin:open");
		expect(result.source).toBe("preferred");
	});

	it("returns the fallback command id when the preferred plugin is not enabled", () => {
		const detector = makeDetector([]);
		const resolver = new CommandResolver(detector);
		const result = resolver.resolve({
			preferred: {pluginId: "preferred-plugin", commandId: "preferred-plugin:open"},
			fallback: {commandId: "native:open"},
		});
		expect(result.commandId).toBe("native:open");
		expect(result.source).toBe("fallback");
	});

	it("returns undefined when the preferred plugin is missing and no fallback is provided", () => {
		const detector = makeDetector([]);
		const resolver = new CommandResolver(detector);
		const result = resolver.resolve({
			preferred: {pluginId: "absent-plugin", commandId: "absent:do"},
		});
		expect(result.commandId).toBeUndefined();
		expect(result.source).toBe("none");
	});

	it("notifies a watcher when the preferred plugin toggles", () => {
		const detector = makeDetector([]) as unknown as PluginDetector & {
			_emit(id: string, enabled: boolean): void;
		};
		const resolver = new CommandResolver(detector);
		const onChange = vi.fn();
		resolver.watch(
			{
				preferred: {pluginId: "p", commandId: "p:do"},
				fallback: {commandId: "native:do"},
			},
			onChange,
		);
		expect(onChange).not.toHaveBeenCalled();
		detector._emit("p", true);
		expect(onChange).toHaveBeenCalledWith({commandId: "p:do", source: "preferred"});
		detector._emit("p", false);
		expect(onChange).toHaveBeenCalledWith({commandId: "native:do", source: "fallback"});
	});
});
```

- [ ] **Step 2: Run, verify failing**

```sh
npm test
```

- [ ] **Step 3: Implement `src/soft-deps/command-resolver.ts`**

```ts
import type {PluginDetector} from "./plugin-detector";

export interface PreferredCommand {
	pluginId: string;
	commandId: string;
}

export interface FallbackCommand {
	commandId: string;
}

export interface ResolveSpec {
	preferred: PreferredCommand;
	fallback?: FallbackCommand;
}

export interface ResolvedCommand {
	commandId: string | undefined;
	source: "preferred" | "fallback" | "none";
}

export class CommandResolver {
	constructor(private readonly detector: PluginDetector) {}

	resolve(spec: ResolveSpec): ResolvedCommand {
		if (this.detector.isEnabled(spec.preferred.pluginId)) {
			return {commandId: spec.preferred.commandId, source: "preferred"};
		}
		if (spec.fallback) {
			return {commandId: spec.fallback.commandId, source: "fallback"};
		}
		return {commandId: undefined, source: "none"};
	}

	watch(spec: ResolveSpec, callback: (resolved: ResolvedCommand) => void): () => void {
		return this.detector.subscribe(spec.preferred.pluginId, () => {
			callback(this.resolve(spec));
		});
	}
}
```

- [ ] **Step 4: Verify tests pass**

```sh
npm test
```

- [ ] **Step 5: Commit**

```sh
git add src/soft-deps/command-resolver.ts src/soft-deps/command-resolver.test.ts
git commit -m "feat(soft-deps): add CommandResolver

Resolves preferred + fallback command pairs through the PluginDetector.
watch() lets callers re-register affected hotkeys when the preferred
plugin toggles, so users never need to reload Obsidian after enabling
or disabling a soft-dep plugin."
```

### Task 1.3: `known-plugins.ts` with typed handles for the three soft-deps

**Files:**
- Create: `src/soft-deps/known-plugins.ts`

This module is data only — no logic, no tests. It captures the verified plugin ids and command ids from Task V.2 in one place.

- [ ] **Step 1: Create `src/soft-deps/known-plugins.ts`**

Use the verified ids from `docs/plans/2026-05-08-soft-dep-runtime-ids.md`. The skeleton:

```ts
/**
 * Verified plugin and command IDs for the soft-deps in this project.
 * Source of truth: docs/plans/2026-05-08-soft-dep-runtime-ids.md (verified
 * against a live Obsidian install on <DATE>).
 *
 * Update this file whenever a soft-dep plugin renames a command or its
 * runtime id changes.
 */

export const SEQUENCE_HOTKEYS = {
	pluginId: "<verified-id>",
	// API shape captured in src/prefix-maps/multi-chord.ts
} as const;

export const SWITCHER_PLUS = {
	pluginId: "<verified-id>",
	commands: {
		commandsMode: "<verified-id>",
		editorsMode: "<verified-id>",
		fileMode: "<verified-id>",
	},
} as const;

export const CYCLE_THROUGH_PANES = {
	pluginId: "<verified-id>",
	commands: {
		cycle: "<verified-id>",
	},
} as const;

export const NATIVE_FALLBACKS = {
	commandPalette: "command-palette:open",
	switcher: "switcher:open",
	editorSearch: "editor:open-search",
	editorSearchReplace: "editor:open-search-replace",
	editorSave: "editor:save-file",
	workspaceNextTab: "workspace:next-tab",
	workspaceCloseActivePane: "workspace:close",
	workspaceCloseOthers: "workspace:close-others",
	workspaceSplitHorizontal: "workspace:split-horizontal",
	workspaceSplitVertical: "workspace:split-vertical",
	workspaceOpenNewWindow: "workspace:open-new-window",
	workspaceCloseWindow: "workspace:close-window",
	editorUndo: "editor:undo",
	editorSelectAll: "editor:select-all",
	appQuit: "app:quit",
} as const;
```

Replace every `<verified-id>` placeholder with the real value from Task V.2.

**If a value cannot be verified, stop. Do not guess.**

- [ ] **Step 2: Verify the file compiles**

```sh
npm run typecheck
```

Expected: success.

- [ ] **Step 3: Commit**

```sh
git add src/soft-deps/known-plugins.ts
git commit -m "feat(soft-deps): add typed handles for known soft-dep plugins

Captures the runtime plugin IDs and command IDs for Sequence Hotkeys,
Quick Switcher++, and Cycle through panes, plus the native Obsidian
fallbacks. Verified against a live install per
docs/plans/2026-05-08-soft-dep-runtime-ids.md."
```

### Task 1.4: Wire the soft-deps foundation into `main.ts`

**Files:**
- Modify: `src/main.ts`

- [ ] **Step 1: Add fields and dispose in `onunload`**

In `src/main.ts`, add:
```ts
import {PluginDetector} from "./soft-deps/plugin-detector";
import {CommandResolver} from "./soft-deps/command-resolver";
```

Add fields to the plugin class:
```ts
private detector!: PluginDetector;
private resolver!: CommandResolver;
```

In `onload`, after the logger initialization, add:
```ts
this.detector = new PluginDetector(this.app);
this.resolver = new CommandResolver(this.detector);
```

In `onunload`, add:
```ts
this.detector?.dispose();
```

(The `?.` guards the case where `onunload` runs before `onload` finishes — defensive.)

- [ ] **Step 2: Build, verify clean**

```sh
make build
```

Expected: success. No new functionality yet; just wiring.

- [ ] **Step 3: Commit**

```sh
git add src/main.ts
git commit -m "feat(soft-deps): wire PluginDetector and CommandResolver into plugin

No user-visible change yet; Phase 3a and Phase 4 consume the resolver.
onunload disposes the detector to release the workspace event handlers."
```

---

## Phase 2 — Layer 2: in-input bindings

The headline feature. A single document-level keydown listener in capture phase routes emacs keys to vanilla-DOM cursor / region operations on `<input>`, `<textarea>`, and `[contenteditable]` elements. Skips elements inside `.cm-editor` (the markdown editor's CodeMirror surface) — Layer 1 handles those.

Macro-strategy: build the element filter and the DOM-side ops first (testable in jsdom-style fakes), then wire them through a single capture-phase keydown handler that uses the existing `KillRing` and `MarkState`.

### Task 2.1: Element filter

**Files:**
- Create: `src/input-bindings/element-filter.ts`
- Create: `src/input-bindings/element-filter.test.ts`

The filter answers: *should this DOM element receive emacs bindings from Layer 2?*

- [ ] **Step 1: Write `src/input-bindings/element-filter.test.ts` (failing first)**

```ts
import {describe, expect, it} from "vitest";
import {classifyElement, ElementKind} from "./element-filter";

function makeInput(type = "text"): HTMLInputElement {
	const el = document.createElement("input");
	el.type = type;
	return el;
}

describe("classifyElement", () => {
	it("classifies a text <input> as SingleLineInput", () => {
		expect(classifyElement(makeInput("text"))).toBe(ElementKind.SingleLineInput);
	});

	it("classifies a search <input> as SingleLineInput", () => {
		expect(classifyElement(makeInput("search"))).toBe(ElementKind.SingleLineInput);
	});

	it("classifies an email <input> as SingleLineInput", () => {
		expect(classifyElement(makeInput("email"))).toBe(ElementKind.SingleLineInput);
	});

	it("classifies a password <input> as Skip", () => {
		expect(classifyElement(makeInput("password"))).toBe(ElementKind.Skip);
	});

	it("classifies a checkbox <input> as Skip", () => {
		expect(classifyElement(makeInput("checkbox"))).toBe(ElementKind.Skip);
	});

	it("classifies a <textarea> as MultiLineInput", () => {
		const el = document.createElement("textarea");
		expect(classifyElement(el)).toBe(ElementKind.MultiLineInput);
	});

	it("classifies a contenteditable div as ContentEditable", () => {
		const el = document.createElement("div");
		el.contentEditable = "true";
		expect(classifyElement(el)).toBe(ElementKind.ContentEditable);
	});

	it("classifies a non-editable div as Skip", () => {
		const el = document.createElement("div");
		expect(classifyElement(el)).toBe(ElementKind.Skip);
	});

	it("returns Skip for elements inside .cm-editor", () => {
		const cm = document.createElement("div");
		cm.className = "cm-editor";
		const inner = document.createElement("input");
		inner.type = "text";
		cm.appendChild(inner);
		document.body.appendChild(cm);
		expect(classifyElement(inner)).toBe(ElementKind.Skip);
		document.body.removeChild(cm);
	});

	it("returns ContentEditable when the element is editable, even if a non-editable ancestor wraps it", () => {
		const wrapper = document.createElement("div");
		wrapper.contentEditable = "false";
		const inner = document.createElement("div");
		inner.contentEditable = "true";
		wrapper.appendChild(inner);
		// The descendant's own isContentEditable wins over the wrapper's
		// contenteditable=false attribute. (Note: HTMLElement.isContentEditable
		// inherits unless explicitly overridden, so a true descendant of a
		// false ancestor still reads as content-editable.)
		expect(classifyElement(inner)).toBe(ElementKind.ContentEditable);
	});

	it("returns Skip for null", () => {
		expect(classifyElement(null)).toBe(ElementKind.Skip);
	});
});
```

**Note:** Tests use the DOM API which requires jsdom. Configure vitest:

- [ ] **Step 2: Update `vitest.config.ts` to use jsdom for DOM-touching tests**

Current (from refactor):
```ts
export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		environment: "node",
	},
});
```

Change to:
```ts
export default defineConfig({
	test: {
		include: ["src/**/*.test.ts"],
		environment: "jsdom",
	},
});
```

Add `jsdom` as devDependency:

```sh
npm install --save-dev jsdom @types/jsdom
```

Verify pure-state tests from the refactor still pass under jsdom (they should — jsdom is a superset of node for basic JS):

```sh
npm test
```

Expected: KillRing, YankPopSession, MarkState, RepeatDetector, log tests still pass.

- [ ] **Step 3: Run new tests, verify failing**

```sh
npm test -- element-filter
```

Expected: tests fail with "Cannot find module './element-filter'".

- [ ] **Step 4: Implement `src/input-bindings/element-filter.ts`**

```ts
export enum ElementKind {
	SingleLineInput,
	MultiLineInput,
	ContentEditable,
	Skip,
}

const SINGLE_LINE_INPUT_TYPES = new Set([
	"text",
	"search",
	"email",
	"url",
	"tel",
	"number",
]);

export function classifyElement(el: Element | null): ElementKind {
	if (!el) {
		return ElementKind.Skip;
	}
	if (isInsideCmEditor(el)) {
		return ElementKind.Skip;
	}
	if (el instanceof HTMLInputElement) {
		if (SINGLE_LINE_INPUT_TYPES.has(el.type)) {
			return ElementKind.SingleLineInput;
		}
		return ElementKind.Skip;
	}
	if (el instanceof HTMLTextAreaElement) {
		return ElementKind.MultiLineInput;
	}
	if (el instanceof HTMLElement && el.isContentEditable) {
		return ElementKind.ContentEditable;
	}
	return ElementKind.Skip;
}

function isInsideCmEditor(el: Element): boolean {
	let current: Element | null = el;
	while (current) {
		if (current.classList && current.classList.contains("cm-editor")) {
			return true;
		}
		current = current.parentElement;
	}
	return false;
}
```

- [ ] **Step 5: Verify tests pass**

```sh
npm test
```

Expected: 11 element-filter tests pass; pre-existing tests still pass.

- [ ] **Step 6: Commit**

```sh
git add src/input-bindings/element-filter.ts src/input-bindings/element-filter.test.ts vitest.config.ts package.json package-lock.json
git commit -m "feat(input-bindings): add element classifier

Determines whether a DOM element should receive Layer-2 emacs bindings
and what kind it is (single-line input, multi-line textarea, content-
editable div). Skips password / checkbox / button inputs and anything
inside .cm-editor (Layer 1 handles those).

Switches vitest environment to jsdom so DOM-touching tests can run."
```

### Task 2.2: Vanilla-DOM cursor and region ops

**Files:**
- Create: `src/input-bindings/ops.ts`
- Create: `src/input-bindings/ops.test.ts`

Implements the binding operations against vanilla DOM APIs. For `<input>` and `<textarea>`: `selectionStart` / `selectionEnd` / `setRangeText`. For `[contenteditable]`: Selection / Range APIs.

Scope for this task: cursor movement (forward / backward char and word, line edges, next/previous line), char delete, kill word forward/backward, kill line. Region (mark + cut/copy/paste) lands in Task 2.3 to keep the diff manageable.

**Note on multi-line motion in textareas:** `C-n` / `C-p` move by *textual* lines (counted via `\n` characters), not visual lines. For most Obsidian text inputs (single-line or short multi-line), this is indistinguishable. For wrapped textareas with long lines, the cursor may not appear to move "down a row" but rather to the next `\n`-delimited line. Documented limitation; matches Layer 1 v0.5.0 behavior on long wrapped lines.

- [ ] **Step 1: Write `src/input-bindings/ops.test.ts` (failing first)**

```ts
import {beforeEach, describe, expect, it} from "vitest";
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
		expect(el.selectionStart).toBe(3); // end of "foo"
	});

	it("skips whitespace then moves to end of next word", () => {
		const el = makeTextarea("foo bar baz", 3);
		forwardWord(el);
		expect(el.selectionStart).toBe(7); // end of "bar"
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
		expect(el.selectionStart).toBe(4); // start of "bar"
	});

	it("skips whitespace then moves to start of previous word", () => {
		const el = makeTextarea("foo bar baz", 4);
		backwardWord(el);
		expect(el.selectionStart).toBe(0); // start of "foo"
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
		const el = makeTextarea("line one\nline two\nline three", 14); // mid line two
		beginningOfLine(el);
		expect(el.selectionStart).toBe(9); // start of "line two"
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
		expect(el.selectionStart).toBe(17); // end of "line two"
	});
});

describe("nextLine", () => {
	it("moves cursor to same column on next textual line", () => {
		const el = makeTextarea("line one\nline two\nline three", 4); // mid "line one"
		nextLine(el);
		expect(el.selectionStart).toBe(13); // column 4 of "line two"
	});

	it("clamps to end of next line if shorter than current column", () => {
		const el = makeTextarea("line one\nhi\nline three", 7); // near end of "line one"
		nextLine(el);
		expect(el.selectionStart).toBe(11); // end of "hi"
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
		const el = makeTextarea("line one\nline two\nline three", 13); // column 4 of "line two"
		previousLine(el);
		expect(el.selectionStart).toBe(4); // column 4 of "line one"
	});

	it("clamps to end of previous line if shorter than current column", () => {
		const el = makeTextarea("hi\nline two\nline three", 7); // mid "line two"
		previousLine(el);
		expect(el.selectionStart).toBe(2); // end of "hi"
	});

	it("stops at start of value if no previous line", () => {
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
		const el = makeTextarea("line one\nline two", 4); // mid "line one"
		const killed = killLine(el);
		expect(killed).toBe(" one");
		expect(el.value).toBe("line\nline two");
		expect(el.selectionStart).toBe(4);
	});

	it("kills the newline if cursor is at end of line", () => {
		const el = makeTextarea("line one\nline two", 8); // end of "line one"
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
});

describe("backwardKillWord", () => {
	it("returns the killed text and removes it backward", () => {
		const el = makeTextarea("foo bar baz", 7);
		const killed = backwardKillWord(el);
		expect(killed).toBe("bar");
		expect(el.value).toBe("foo  baz");
		expect(el.selectionStart).toBe(4);
	});
});
```

- [ ] **Step 2: Run, verify failing**

```sh
npm test -- ops
```

- [ ] **Step 3: Implement `src/input-bindings/ops.ts`**

```ts
export type EditableElement = HTMLInputElement | HTMLTextAreaElement;

export function forwardChar(el: EditableElement): void {
	const pos = el.selectionStart ?? 0;
	const next = Math.min(pos + 1, el.value.length);
	el.setSelectionRange(next, next);
}

export function backwardChar(el: EditableElement): void {
	const pos = el.selectionStart ?? 0;
	const next = Math.max(pos - 1, 0);
	el.setSelectionRange(next, next);
}

export function forwardWord(el: EditableElement): void {
	const pos = el.selectionStart ?? 0;
	const next = nextWordBoundary(el.value, pos, 1);
	el.setSelectionRange(next, next);
}

export function backwardWord(el: EditableElement): void {
	const pos = el.selectionStart ?? 0;
	const next = nextWordBoundary(el.value, pos, -1);
	el.setSelectionRange(next, next);
}

export function beginningOfLine(el: EditableElement): void {
	const pos = el.selectionStart ?? 0;
	if (el instanceof HTMLInputElement) {
		el.setSelectionRange(0, 0);
		return;
	}
	const next = el.value.lastIndexOf("\n", pos - 1) + 1;
	el.setSelectionRange(next, next);
}

export function endOfLine(el: EditableElement): void {
	const pos = el.selectionStart ?? 0;
	if (el instanceof HTMLInputElement) {
		el.setSelectionRange(el.value.length, el.value.length);
		return;
	}
	const nlIndex = el.value.indexOf("\n", pos);
	const next = nlIndex < 0 ? el.value.length : nlIndex;
	el.setSelectionRange(next, next);
}

export function nextLine(el: EditableElement): void {
	if (el instanceof HTMLInputElement) {
		return; // no-op in single-line input
	}
	const pos = el.selectionStart ?? 0;
	const lineStart = el.value.lastIndexOf("\n", pos - 1) + 1;
	const column = pos - lineStart;
	const nextLineStart = el.value.indexOf("\n", pos);
	if (nextLineStart < 0) {
		return; // no next line
	}
	const lineAfterStart = nextLineStart + 1;
	const lineAfterEnd = el.value.indexOf("\n", lineAfterStart);
	const lineAfterLen = (lineAfterEnd < 0 ? el.value.length : lineAfterEnd) - lineAfterStart;
	const next = lineAfterStart + Math.min(column, lineAfterLen);
	el.setSelectionRange(next, next);
}

export function previousLine(el: EditableElement): void {
	if (el instanceof HTMLInputElement) {
		return;
	}
	const pos = el.selectionStart ?? 0;
	const lineStart = el.value.lastIndexOf("\n", pos - 1) + 1;
	if (lineStart === 0) {
		return; // already on first line
	}
	const column = pos - lineStart;
	const prevLineEnd = lineStart - 1; // position of the preceding "\n"
	const prevLineStart = el.value.lastIndexOf("\n", prevLineEnd - 1) + 1;
	const prevLineLen = prevLineEnd - prevLineStart;
	const next = prevLineStart + Math.min(column, prevLineLen);
	el.setSelectionRange(next, next);
}

export function deleteChar(el: EditableElement): void {
	const pos = el.selectionStart ?? 0;
	if (pos >= el.value.length) {
		return;
	}
	el.value = el.value.slice(0, pos) + el.value.slice(pos + 1);
	el.setSelectionRange(pos, pos);
	el.dispatchEvent(new Event("input", {bubbles: true}));
}

export function killWord(el: EditableElement): string {
	const start = el.selectionStart ?? 0;
	const end = nextWordBoundary(el.value, start, 1);
	const killed = el.value.slice(start, end);
	el.value = el.value.slice(0, start) + el.value.slice(end);
	el.setSelectionRange(start, start);
	el.dispatchEvent(new Event("input", {bubbles: true}));
	return killed.trim() || killed;
}

export function backwardKillWord(el: EditableElement): string {
	const end = el.selectionStart ?? 0;
	const start = nextWordBoundary(el.value, end, -1);
	const killed = el.value.slice(start, end);
	el.value = el.value.slice(0, start) + el.value.slice(end);
	el.setSelectionRange(start, start);
	el.dispatchEvent(new Event("input", {bubbles: true}));
	return killed.trim() || killed;
}

export function killLine(el: EditableElement): string {
	const start = el.selectionStart ?? 0;
	if (start >= el.value.length) {
		return "";
	}
	if (el instanceof HTMLInputElement) {
		const killed = el.value.slice(start);
		el.value = el.value.slice(0, start);
		el.setSelectionRange(start, start);
		el.dispatchEvent(new Event("input", {bubbles: true}));
		return killed;
	}
	const nlIndex = el.value.indexOf("\n", start);
	const end = nlIndex < 0 ? el.value.length : (nlIndex === start ? start + 1 : nlIndex);
	const killed = el.value.slice(start, end);
	el.value = el.value.slice(0, start) + el.value.slice(end);
	el.setSelectionRange(start, start);
	el.dispatchEvent(new Event("input", {bubbles: true}));
	return killed;
}

function nextWordBoundary(text: string, from: number, direction: 1 | -1): number {
	let pos = from;
	const isWordChar = (c: string) => /\w/.test(c);
	if (direction === 1) {
		// skip non-word chars, then consume word chars
		while (pos < text.length && !isWordChar(text[pos])) pos++;
		while (pos < text.length && isWordChar(text[pos])) pos++;
	} else {
		// skip non-word chars (going back), then consume word chars
		while (pos > 0 && !isWordChar(text[pos - 1])) pos--;
		while (pos > 0 && isWordChar(text[pos - 1])) pos--;
	}
	return pos;
}
```

**Note:** killed-text trimming behavior — emacs semantics: `kill-word` returns the entire span including leading whitespace. The kill-ring-save consumer doesn't need to filter; the test expectations above (`expect(killed).toBe("foo")`, `expect(killed).toBe("bar")`) reflect that the leading-whitespace skip happens *before* the kill, so the killed span is the word itself with no leading spaces. The implementation matches: `nextWordBoundary` advances past whitespace before consuming word chars, so the kill range starts at the first word char. The `trim() || killed` fallback in the implementation is for the edge case where the entire range is whitespace; in normal use the trim is a no-op.

- [ ] **Step 4: Verify tests pass**

```sh
npm test
```

- [ ] **Step 5: Commit**

```sh
git add src/input-bindings/ops.ts src/input-bindings/ops.test.ts
git commit -m "feat(input-bindings): vanilla-DOM cursor and kill ops

Cursor movement (forward/backward char and word, beginning/end of line),
delete-char, kill-word, backward-kill-word for HTMLInputElement and
HTMLTextAreaElement. ContentEditable handling lands in a follow-up;
inputs and textareas are the high-value 80% of Obsidian's text surfaces.

Each editing operation dispatches an 'input' event so any host code
listening for changes (e.g., search bars debouncing keystrokes) sees
the modification."
```

### Task 2.3: Region ops (mark, kill region, kill-ring save, yank)

**Files:**
- Modify: `src/input-bindings/ops.ts` (add region helpers)
- Modify: `src/input-bindings/ops.test.ts` (add tests)

Implements the mark / region / yank ops against vanilla DOM. Layer 2 shares the kill ring with Layer 1, so region operations call into the same `KillRing` instance.

- [ ] **Step 1: Append region tests to `src/input-bindings/ops.test.ts`**

```ts
import {killRegion, killRingSave, yank, getSelectedText} from "./ops";

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
```

- [ ] **Step 2: Run tests, verify failing**

```sh
npm test -- ops
```

- [ ] **Step 3: Append region ops to `src/input-bindings/ops.ts`**

```ts
export function getSelectedText(el: EditableElement): string {
	const start = el.selectionStart ?? 0;
	const end = el.selectionEnd ?? 0;
	return el.value.slice(start, end);
}

export function killRegion(el: EditableElement): string {
	const start = el.selectionStart ?? 0;
	const end = el.selectionEnd ?? 0;
	if (start === end) {
		return "";
	}
	const killed = el.value.slice(start, end);
	el.value = el.value.slice(0, start) + el.value.slice(end);
	el.setSelectionRange(start, start);
	el.dispatchEvent(new Event("input", {bubbles: true}));
	return killed;
}

export function killRingSave(el: EditableElement): string {
	const text = getSelectedText(el);
	const end = el.selectionEnd ?? 0;
	el.setSelectionRange(end, end);
	return text;
}

export function yank(el: EditableElement, text: string): void {
	const start = el.selectionStart ?? 0;
	const end = el.selectionEnd ?? 0;
	el.value = el.value.slice(0, start) + text + el.value.slice(end);
	const next = start + text.length;
	el.setSelectionRange(next, next);
	el.dispatchEvent(new Event("input", {bubbles: true}));
}
```

- [ ] **Step 4: Verify tests pass**

```sh
npm test
```

- [ ] **Step 5: Commit**

```sh
git add src/input-bindings/ops.ts src/input-bindings/ops.test.ts
git commit -m "feat(input-bindings): region ops for kill-region, kill-ring-save, yank

getSelectedText, killRegion, killRingSave, yank for HTMLInputElement and
HTMLTextAreaElement. Mark management stays in MarkState (already
extracted in the refactor) — these are the leaf operations the keydown
handler will compose with the shared kill-ring."
```

### Task 2.4: Capture-phase keydown router

**Files:**
- Create: `src/input-bindings/index.ts`
- Modify: `src/main.ts` (register the listener)

The single document-level keydown listener that routes emacs keys to the ops above. Skips elements not classified as editable. Works through the shared `KillRing`, `MarkState`, and `RepeatDetector` instances.

- [ ] **Step 1: Create `src/input-bindings/index.ts`**

```ts
import {classifyElement, ElementKind} from "./element-filter";
import * as ops from "./ops";
import type {KillRing} from "../kill-ring/kill-ring";
import type {MarkState} from "../selection/mark";
import type {RepeatDetector} from "../tracking/repeat-detector";
import type {Logger} from "../log";

export interface InputBindingsContext {
	killRing: KillRing;
	mark: MarkState;
	repeats: RepeatDetector;
	logger: Logger;
}

const ID = {
	FORWARD_CHAR: "input:forward-char",
	BACKWARD_CHAR: "input:backward-char",
	NEXT_LINE: "input:next-line",
	PREVIOUS_LINE: "input:previous-line",
	FORWARD_WORD: "input:forward-word",
	BACKWARD_WORD: "input:backward-word",
	BEGINNING_OF_LINE: "input:beginning-of-line",
	END_OF_LINE: "input:end-of-line",
	DELETE_CHAR: "input:delete-char",
	KILL_LINE: "input:kill-line",
	KILL_WORD: "input:kill-word",
	BACKWARD_KILL_WORD: "input:backward-kill-word",
	KILL_RING_SAVE: "input:kill-ring-save",
	KILL_REGION: "input:kill-region",
	YANK: "input:yank",
	YANK_POP: "input:yank-pop",
	SET_MARK: "input:set-mark",
	KEYBOARD_QUIT: "input:keyboard-quit",
} as const;

interface KeySpec {
	ctrl?: boolean;
	alt?: boolean;
	shift?: boolean;
	meta?: boolean;
	key: string; // event.key value
	id: string;
}

const KEY_SPECS: KeySpec[] = [
	{ctrl: true, key: "f", id: ID.FORWARD_CHAR},
	{ctrl: true, key: "b", id: ID.BACKWARD_CHAR},
	{ctrl: true, key: "n", id: ID.NEXT_LINE},
	{ctrl: true, key: "p", id: ID.PREVIOUS_LINE},
	{alt: true, key: "f", id: ID.FORWARD_WORD},
	{alt: true, key: "b", id: ID.BACKWARD_WORD},
	{ctrl: true, key: "a", id: ID.BEGINNING_OF_LINE},
	{ctrl: true, key: "e", id: ID.END_OF_LINE},
	{ctrl: true, key: "d", id: ID.DELETE_CHAR},
	{ctrl: true, key: "k", id: ID.KILL_LINE},
	{alt: true, key: "d", id: ID.KILL_WORD},
	{alt: true, key: "Backspace", id: ID.BACKWARD_KILL_WORD},
	{alt: true, key: "w", id: ID.KILL_RING_SAVE},
	{ctrl: true, key: "w", id: ID.KILL_REGION},
	{ctrl: true, key: "y", id: ID.YANK},
	{alt: true, key: "y", id: ID.YANK_POP},
	{ctrl: true, key: " ", id: ID.SET_MARK},
	{ctrl: true, key: "g", id: ID.KEYBOARD_QUIT},
];

function matches(event: KeyboardEvent, spec: KeySpec): boolean {
	if (spec.ctrl !== !!event.ctrlKey) return false;
	if (spec.alt !== !!event.altKey) return false;
	if ((spec.shift ?? false) !== event.shiftKey) return false;
	if ((spec.meta ?? false) !== event.metaKey) return false;
	return event.key === spec.key;
}

export function installInputBindings(
	target: Document,
	ctx: InputBindingsContext,
	registerCleanup: (cleanup: () => void) => void,
): void {
	const handler = (event: KeyboardEvent) => {
		const kind = classifyElement(event.target as Element | null);
		if (kind !== ElementKind.SingleLineInput && kind !== ElementKind.MultiLineInput) {
			return;
		}
		const el = event.target as HTMLInputElement | HTMLTextAreaElement;
		const spec = KEY_SPECS.find(s => matches(event, s));
		if (!spec) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		dispatch(spec.id, el, ctx);
	};
	target.addEventListener("keydown", handler, {capture: true});
	registerCleanup(() => {
		target.removeEventListener("keydown", handler, {capture: true});
	});
}

function dispatch(
	id: string,
	el: HTMLInputElement | HTMLTextAreaElement,
	ctx: InputBindingsContext,
): void {
	const {isRepeat} = ctx.repeats.track(id);
	switch (id) {
		case ID.FORWARD_CHAR:
			ops.forwardChar(el);
			extendOrClear(el, ctx);
			return;
		case ID.BACKWARD_CHAR:
			ops.backwardChar(el);
			extendOrClear(el, ctx);
			return;
		case ID.NEXT_LINE:
			ops.nextLine(el);
			extendOrClear(el, ctx);
			return;
		case ID.PREVIOUS_LINE:
			ops.previousLine(el);
			extendOrClear(el, ctx);
			return;
		case ID.FORWARD_WORD:
			ops.forwardWord(el);
			extendOrClear(el, ctx);
			return;
		case ID.BACKWARD_WORD:
			ops.backwardWord(el);
			extendOrClear(el, ctx);
			return;
		case ID.BEGINNING_OF_LINE:
			ops.beginningOfLine(el);
			extendOrClear(el, ctx);
			return;
		case ID.END_OF_LINE:
			ops.endOfLine(el);
			extendOrClear(el, ctx);
			return;
		case ID.DELETE_CHAR:
			ops.deleteChar(el);
			return;
		case ID.KILL_LINE: {
			const killed = ops.killLine(el);
			if (killed) ctx.killRing.save(killed, {extendForward: isRepeat});
			return;
		}
		case ID.KILL_WORD: {
			const killed = ops.killWord(el);
			ctx.killRing.save(killed, {extendForward: isRepeat});
			return;
		}
		case ID.BACKWARD_KILL_WORD: {
			const killed = ops.backwardKillWord(el);
			ctx.killRing.save(killed, {extendBackward: isRepeat});
			return;
		}
		case ID.KILL_RING_SAVE: {
			const text = ops.killRingSave(el);
			if (text) ctx.killRing.save(text);
			ctx.mark.clear();
			return;
		}
		case ID.KILL_REGION: {
			const text = ops.killRegion(el);
			if (text) ctx.killRing.save(text);
			ctx.mark.clear();
			return;
		}
		case ID.YANK: {
			const text = ctx.killRing.current();
			if (text !== undefined) ops.yank(el, text);
			return;
		}
		case ID.YANK_POP: {
			const text = ctx.killRing.rotate();
			if (text !== undefined) ops.yank(el, text);
			return;
		}
		case ID.SET_MARK: {
			// MarkState was designed for editor positions {line, ch};
			// for inputs we co-opt `ch` as the absolute character offset
			// within el.value and set line=0. See § "Known design wart".
			ctx.mark.set({line: 0, ch: el.selectionStart ?? 0});
			return;
		}
		case ID.KEYBOARD_QUIT: {
			ctx.mark.clear();
			const pos = el.selectionEnd ?? el.selectionStart ?? 0;
			el.setSelectionRange(pos, pos);
			return;
		}
	}
}

function extendOrClear(el: HTMLInputElement | HTMLTextAreaElement, ctx: InputBindingsContext): void {
	if (!ctx.mark.isActive()) {
		return;
	}
	const origin = ctx.mark.origin();
	if (!origin) return;
	// In Layer 2, mark origin's `ch` field stores the absolute offset (line is unused for inputs).
	const start = Math.min(origin.ch, el.selectionStart ?? 0);
	const end = Math.max(origin.ch, el.selectionStart ?? 0);
	el.setSelectionRange(start, end);
}
```

**Note on mark-origin storage (known design wart):** `MarkState` was designed for editor positions ({line, ch}). For Layer 2, we co-opt the `ch` field as an absolute character offset within the input's value, setting `line: 0`. This is a deliberate compromise; the alternative is a separate `InputMarkState` class which doubles the type surface for marginal clarity.

**Failure mode to watch for:** if the user sets the mark in the editor (Layer 1, gets {line, ch} editor coords), then focuses an input and starts moving (Layer 2 reads `mark.origin().ch` as an absolute offset), the absolute-offset read on editor-position data will be wrong. Mitigation: Layer 2's keydown listener only acts on inputs/textareas; the editor's Layer 1 callbacks only fire when an editor is focused. Since both consult the same `MarkState`, focus transitions between editor and input lose mark state — but that's emacs-correct behavior (mark is per-buffer; switching buffers cancels the active region). The current code handles this implicitly: when `MarkState.set` is called with new coords on focus change, the previous interpretation is lost.

If a user actively complains about cross-surface mark behavior, replace with a per-surface mark stored at the call site or split into `EditorMarkState` and `InputMarkState`.

- [ ] **Step 2: Wire into `src/main.ts`**

Add imports:
```ts
import {installInputBindings} from "./input-bindings";
```

In `onload`, after the soft-deps wiring:
```ts
installInputBindings(
	document,
	{
		killRing: this.killRing,
		mark: this.mark,
		repeats: this.repeats,
		logger: this.logger,
	},
	cleanup => this.register(cleanup),
);
```

The `this.register(cleanup)` call hooks Obsidian's plugin lifecycle so the listener is removed on unload. (Plugin's `register(cleanup)` accepts a function and calls it on unload.)

- [ ] **Step 3: Build and install**

```sh
make install
```

Reload Obsidian.

- [ ] **Step 4: Manual smoke test — quick switcher**

Open quick switcher (Cmd-O). Type a few characters into the search field. Verify:

1. `M-f` (Alt-f) jumps cursor forward by word.
2. `M-b` (Alt-b) jumps cursor backward by word.
3. `M-Backspace` kills the previous word.
4. `M-d` kills the next word.
5. `C-Space` then `M-f` then `C-w` kills the selected word and saves to kill-ring.
6. `C-y` yanks it back.

(`C-f`, `C-b`, `C-a`, `C-e`, `C-d` already work on macOS; verify they don't break.)

- [ ] **Step 5: Manual smoke test — command palette, settings, file rename**

Repeat step 4 in:
- Command palette (Cmd-P)
- File rename dialog (right-click any file → Rename)
- Any plugin's settings input (e.g., a plugin's display-name field)

Expected: bindings work consistently across all these surfaces.

- [ ] **Step 6: Manual regression — markdown editor**

Open a markdown note. Run the full Layer 1 test from `AGENTS.md` § Testing. Expected: no regression — Layer 2 listener skips elements inside `.cm-editor`.

- [ ] **Step 7: Commit**

```sh
git add src/input-bindings/index.ts src/main.ts
git commit -m "feat(input-bindings): capture-phase keydown router

Single document-level listener in capture phase routes emacs keys to
vanilla-DOM ops. Skips elements inside .cm-editor (Layer 1 handles
those). Shares the existing KillRing, MarkState, and RepeatDetector
with Layer 1, so kills made in the editor can be yanked into a search
bar and vice versa."
```

### Task 2.5: Verify all surface targets

**Files:** none

The full surface list from the design doc plus any encountered during testing.

- [ ] **Step 1: Run the surface checklist**

For each surface below, exercise: `M-f`, `M-b`, `M-d`, `M-Backspace`, `C-Space` + movement + `C-w`, `M-w`, `C-y`, `C-g`. Note any failures with which surface and which binding, and fix in-place before proceeding.

- [ ] Search bar (left sidebar)
- [ ] Quick switcher (Cmd-O)
- [ ] Command palette (Cmd-P)
- [ ] File rename dialog
- [ ] Settings text inputs (any plugin's settings panel)
- [ ] Frontmatter property editor (Cmd-Click frontmatter property name)
- [ ] A modal from a plugin (e.g., QuickAdd capture)

**Expected failures (acceptable for now):**
- `[contenteditable]` surfaces (frontmatter rich-text, some plugin modals) won't work fully until a future task adds Selection-API ops for them. Document which surfaces are affected; the design doc accepts this limitation for v0.6.0.

- [ ] **Step 2: If `[contenteditable]` surfaces are critical, defer or extend**

The design doc has `[contenteditable]` "where possible." If a high-value surface (e.g., frontmatter property editor) is `[contenteditable]` and bindings don't work there, decide:
- **Defer:** document as a known limitation; ship 0.6.0 without; address in 0.6.1 if community pressure warrants.
- **Extend now:** add Selection / Range API equivalents in `ops.ts` and a third element-kind branch in `index.ts`. Not in scope for this task; would be its own 2.6.

Recommendation: defer. Get 0.6.0 to users; learn what hurts most.

- [ ] **Step 3: Document the surface coverage in `AGENTS.md`**

Update the `AGENTS.md` § Testing section's surface list with verified-working / known-broken status. Commit as a doc-only update:

```sh
git add AGENTS.md
git commit -m "docs(agents): document Layer-2 surface coverage status"
```

---

## Phase 3 — Layer 3a: single-chord workspace bindings

Adds `M-x`, `C-s`, `C-r`, `M-%`, and a workspace-level `C-g` as ordinary `addCommand` registrations. `M-x` resolves through the soft-deps resolver (Switcher++ if enabled, native palette otherwise). The other four use native Obsidian commands directly.

The existing Layer 1 `C-g` (`keyboard-quit`) remains; Layer 3a's workspace `C-g` is a fallback that fires only when Layer 1's `editorCallback` doesn't match (i.e., editor not focused).

### Task 3.1: `single-chord.ts` workspace registration

**Files:**
- Create: `src/workspace-bindings/single-chord.ts`
- Modify: `src/main.ts` (call the registration)

- [ ] **Step 1: Create `src/workspace-bindings/single-chord.ts`**

```ts
import type {Plugin} from "obsidian";
import type {CommandResolver} from "../soft-deps/command-resolver";
import {SWITCHER_PLUS, NATIVE_FALLBACKS} from "../soft-deps/known-plugins";

export function registerWorkspaceSingleChords(
	plugin: Plugin,
	resolver: CommandResolver,
): void {
	plugin.addCommand({
		id: "workspace-mx",
		name: "M-x (Execute extended command)",
		hotkeys: [{modifiers: ["Alt"], key: "x"}],
		callback: () => {
			const resolved = resolver.resolve({
				preferred: {
					pluginId: SWITCHER_PLUS.pluginId,
					commandId: SWITCHER_PLUS.commands.commandsMode,
				},
				fallback: {commandId: NATIVE_FALLBACKS.commandPalette},
			});
			if (resolved.commandId) {
				plugin.app.commands.executeCommandById(resolved.commandId);
			}
		},
	});

	plugin.addCommand({
		id: "workspace-cs",
		name: "C-s (Search)",
		hotkeys: [{modifiers: ["Ctrl"], key: "s"}],
		callback: () => {
			plugin.app.commands.executeCommandById(NATIVE_FALLBACKS.editorSearch);
		},
	});

	plugin.addCommand({
		id: "workspace-cr",
		name: "C-r (Search reverse, same UI as C-s)",
		hotkeys: [{modifiers: ["Ctrl"], key: "r"}],
		callback: () => {
			plugin.app.commands.executeCommandById(NATIVE_FALLBACKS.editorSearch);
		},
	});

	plugin.addCommand({
		id: "workspace-m-percent",
		name: "M-% (Query replace)",
		hotkeys: [{modifiers: ["Alt", "Shift"], key: "5"}],
		callback: () => {
			plugin.app.commands.executeCommandById(NATIVE_FALLBACKS.editorSearchReplace);
		},
	});

	plugin.addCommand({
		id: "workspace-cg",
		name: "C-g (Keyboard quit at workspace level)",
		hotkeys: [{modifiers: ["Ctrl"], key: "g"}],
		callback: () => {
			// Send Escape to the focused element to close modals / clear selections.
			const focused = document.activeElement as HTMLElement | null;
			focused?.blur();
			document.dispatchEvent(new KeyboardEvent("keydown", {key: "Escape"}));
		},
	});
}
```

**Note on collision with Layer 1 C-g:** Obsidian's hotkey dispatch picks the first matching command. Layer 1 registers `keyboard-quit` with `editorCallback` (only fires when editor is focused). Layer 3a registers `workspace-cg` with `callback` (fires regardless of focus). When the editor is focused, both are eligible; Obsidian picks the editor-callback variant. When not focused, only the workspace one fires. This is the desired behavior.

If testing shows Obsidian picks the workspace one even with the editor focused, swap `Ctrl+g` on `workspace-cg` to no default hotkey and let users opt in. Document and proceed.

- [ ] **Step 2: Wire into `src/main.ts`**

Add import:
```ts
import {registerWorkspaceSingleChords} from "./workspace-bindings/single-chord";
```

In `onload`, after Phase 1 wiring:
```ts
registerWorkspaceSingleChords(this, this.resolver);
```

- [ ] **Step 3: Build and install**

```sh
make install
```

- [ ] **Step 4: Manual test**

Reload Obsidian. With Switcher++ enabled:
- `M-x` → opens Switcher++ in commands mode.
- `C-s` → opens search.
- `C-r` → opens search.
- `M-%` (Alt+Shift+5) → opens search-replace.
- `C-g` outside the editor → closes any modal.
- `C-g` inside the editor → keyboard-quit (Layer 1 wins; selection cancels).

Disable Switcher++ in Settings → Community plugins:
- `M-x` → opens native command palette.

Re-enable Switcher++:
- `M-x` → returns to Switcher++ commands mode without an Obsidian reload.

If the dynamic switch doesn't work, the resolver's watch hook isn't being called. Debug by logging in the resolver or the detector.

- [ ] **Step 5: Commit**

```sh
git add src/workspace-bindings/single-chord.ts src/main.ts
git commit -m "feat(workspace-bindings): single-chord global aliases

Adds M-x, C-s, C-r, M-%, C-g as workspace-level commands. M-x dispatches
through the soft-deps resolver (Switcher++ commands mode if enabled,
native command-palette:open otherwise). The others use native Obsidian
commands directly.

Layer 1's editor-scoped C-g (keyboard-quit) takes precedence when the
editor is focused; the workspace C-g fills in elsewhere (closes modals,
blurs focused element)."
```

---

## Phase 4 — Layer 3b: multi-chord prefix maps

`C-x` prefix sequences via the Sequence Hotkeys plugin's API. Hard requires Sequence Hotkeys; bindings are silently inactive when it is disabled.

### Task 4.1: Sequence Hotkeys API integration

**Files:**
- Create: `src/prefix-maps/multi-chord.ts`
- Modify: `src/main.ts`

The Sequence Hotkeys plugin exposes a runtime API on `app.plugins.plugins["<id>"]`. The exact shape of the API was captured in Task V.2; this task consumes it.

- [ ] **Step 1: Document the Sequence Hotkeys API shape**

Open `docs/plans/2026-05-08-soft-dep-runtime-ids.md`. The "Sequence Hotkeys API access" section should describe how to register a multi-chord. Common patterns:

- **Pattern A:** the plugin exposes `addSequence(sequence: string[], commandId: string)` directly on the plugin instance.
- **Pattern B:** the plugin exposes its API at `app.plugins.plugins[id].api.addSequence(...)`.
- **Pattern C:** the plugin reads sequences from a settings file; programmatic registration is unsupported.

**If Pattern C, this entire phase is unimplementable as designed.** Stop and reconsider. Alternatives:
- Drop multi-chord from v0.6.0; ship Layer 2 + Layer 3a only.
- Switch to a different multi-chord library or write our own dispatcher (much larger effort).

Assuming Pattern A or B applies, proceed.

- [ ] **Step 2: Create `src/prefix-maps/multi-chord.ts`**

```ts
import type {App, Plugin} from "obsidian";
import type {CommandResolver} from "../soft-deps/command-resolver";
import {SEQUENCE_HOTKEYS, SWITCHER_PLUS, CYCLE_THROUGH_PANES, NATIVE_FALLBACKS} from "../soft-deps/known-plugins";

interface SequenceHotkeysApi {
	// Adjust signature to match verified API from Task V.2.
	registerSequence(sequence: string[], action: () => void): () => void; // returns unregister
}

interface PrefixBinding {
	sequence: string[]; // e.g., ["C-x", "C-s"]
	preferred?: {pluginId: string; commandId: string};
	fallback: {commandId: string};
	description: string;
}

const PREFIX_BINDINGS: PrefixBinding[] = [
	{
		sequence: ["C-x", "C-s"],
		fallback: {commandId: NATIVE_FALLBACKS.editorSave},
		description: "save-buffer",
	},
	{
		sequence: ["C-x", "C-f"],
		preferred: {pluginId: SWITCHER_PLUS.pluginId, commandId: SWITCHER_PLUS.commands.fileMode},
		fallback: {commandId: "switcher:open"},
		description: "find-file",
	},
	{
		sequence: ["C-x", "d"],
		fallback: {commandId: "file-explorer:reveal-active-file"},
		description: "dired (reveal active file in explorer)",
	},
	{
		sequence: ["C-x", "b"],
		preferred: {pluginId: SWITCHER_PLUS.pluginId, commandId: SWITCHER_PLUS.commands.editorsMode},
		fallback: {commandId: "switcher:open"},
		description: "switch-to-buffer",
	},
	// Note: C-x C-b (list-buffers / recent-files panel) is intentionally
	// dropped. Obsidian's recent-files functionality has no stable
	// command id; users wanting this can install the "Recent Files"
	// community plugin and bind it manually.
	{
		sequence: ["C-x", "k"],
		fallback: {commandId: NATIVE_FALLBACKS.workspaceCloseActivePane},
		description: "kill-buffer",
	},
	{
		sequence: ["C-x", "0"],
		fallback: {commandId: NATIVE_FALLBACKS.workspaceCloseActivePane},
		description: "delete-window",
	},
	{
		sequence: ["C-x", "1"],
		fallback: {commandId: NATIVE_FALLBACKS.workspaceCloseOthers},
		description: "delete-other-windows",
	},
	{
		sequence: ["C-x", "2"],
		fallback: {commandId: NATIVE_FALLBACKS.workspaceSplitHorizontal},
		description: "split-window-below",
	},
	{
		sequence: ["C-x", "3"],
		fallback: {commandId: NATIVE_FALLBACKS.workspaceSplitVertical},
		description: "split-window-right",
	},
	{
		sequence: ["C-x", "o"],
		preferred: {pluginId: CYCLE_THROUGH_PANES.pluginId, commandId: CYCLE_THROUGH_PANES.commands.cycle},
		fallback: {commandId: NATIVE_FALLBACKS.workspaceNextTab},
		description: "other-window",
	},
	{
		sequence: ["C-x", "h"],
		fallback: {commandId: NATIVE_FALLBACKS.editorSelectAll},
		description: "mark-whole-buffer",
	},
	{
		sequence: ["C-x", "u"],
		fallback: {commandId: NATIVE_FALLBACKS.editorUndo},
		description: "undo",
	},
	{
		sequence: ["C-x", "5", "2"],
		fallback: {commandId: NATIVE_FALLBACKS.workspaceOpenNewWindow},
		description: "make-frame (open new window)",
	},
	{
		sequence: ["C-x", "5", "0"],
		fallback: {commandId: NATIVE_FALLBACKS.workspaceCloseWindow},
		description: "delete-frame (close window)",
	},
	{
		sequence: ["C-x", "C-c"],
		fallback: {commandId: NATIVE_FALLBACKS.appQuit},
		description: "save-buffers-kill-terminal",
	},
];

export class MultiChordRegistry {
	private unregisters: Array<() => void> = [];
	private unsubResolver?: () => void;

	constructor(
		private readonly app: App,
		private readonly plugin: Plugin,
		private readonly resolver: CommandResolver,
	) {}

	enable(): void {
		const api = this.getApi();
		if (!api) {
			return;
		}
		for (const binding of PREFIX_BINDINGS) {
			this.registerOne(api, binding);
		}
	}

	disable(): void {
		this.unregisters.forEach(u => u());
		this.unregisters = [];
		this.unsubResolver?.();
		this.unsubResolver = undefined;
	}

	private getApi(): SequenceHotkeysApi | undefined {
		const plugin = this.app.plugins.plugins[SEQUENCE_HOTKEYS.pluginId];
		// Adjust to match verified API location from Task V.2.
		const api = (plugin as unknown as {api?: SequenceHotkeysApi})?.api;
		return api;
	}

	private registerOne(api: SequenceHotkeysApi, binding: PrefixBinding): void {
		const action = () => {
			const resolved = binding.preferred
				? this.resolver.resolve({preferred: binding.preferred, fallback: binding.fallback})
				: {commandId: binding.fallback.commandId, source: "fallback" as const};
			if (resolved.commandId) {
				this.app.commands.executeCommandById(resolved.commandId);
			}
		};
		const unregister = api.registerSequence(binding.sequence, action);
		this.unregisters.push(unregister);
	}
}
```

**Note:** The `SequenceHotkeysApi` interface above is a placeholder. Replace `registerSequence(sequence, action)` with the verified signature from Task V.2. If the verified API takes different parameter shapes (e.g., a string like `"C-x C-s"` instead of an array), update the call sites accordingly.

- [ ] **Step 3: Wire into `src/main.ts`**

Add imports:
```ts
import {MultiChordRegistry} from "./prefix-maps/multi-chord";
import {SEQUENCE_HOTKEYS} from "./soft-deps/known-plugins";
```

Add a field:
```ts
private multiChord!: MultiChordRegistry;
```

In `onload`, after Phase 3a wiring:
```ts
this.multiChord = new MultiChordRegistry(this.app, this, this.resolver);
const updateMultiChord = (enabled: boolean) => {
	this.multiChord.disable();
	if (enabled) {
		this.multiChord.enable();
	}
};
if (this.detector.isEnabled(SEQUENCE_HOTKEYS.pluginId)) {
	this.multiChord.enable();
}
this.detector.subscribe(SEQUENCE_HOTKEYS.pluginId, updateMultiChord);
```

In `onunload`, before `this.detector?.dispose()`:
```ts
this.multiChord?.disable();
```

- [ ] **Step 4: Build and install**

```sh
make install
```

- [ ] **Step 5: Manual test**

Reload Obsidian with Sequence Hotkeys enabled. Test each binding:

- `C-x C-s` → save current note.
- `C-x C-f` → with Switcher++, opens find-file mode; without it, opens native quick switcher.
- `C-x b` → with Switcher++, opens editors mode; without it, native switcher.
- `C-x k` → close active pane.
- `C-x 1` → close other panes.
- `C-x 2` → split horizontal.
- `C-x 3` → split vertical.
- `C-x o` → with Cycle through panes, cycles panes; without it, next tab.
- `C-x h` → select all in editor.
- `C-x u` → undo.

Disable Sequence Hotkeys → all `C-x` bindings stop firing. Re-enable → they return without an Obsidian reload.

- [ ] **Step 6: Commit**

```sh
git add src/prefix-maps/multi-chord.ts src/main.ts
git commit -m "feat(prefix-maps): multi-chord C-x bindings via Sequence Hotkeys

Twelve C-x prefix bindings (C-x C-s, C-x C-f, C-x b, C-x k, C-x 0/1/2/3,
C-x o, C-x h, C-x u, C-x C-c). Each routes through the soft-deps resolver
where a richer plugin alternative exists; otherwise falls back to a
native Obsidian command.

Hard requires the Sequence Hotkeys plugin. The detector subscription
toggles registration when Sequence Hotkeys is enabled / disabled
without requiring an Obsidian reload."
```

---

## Phase 5 — Collision documentation, regression, release

Final phase: document known collisions with Obsidian defaults (data only — no behavior change), full regression across all layers, version bump, README update, tag `0.6.0`.

### Task 5.1: Document collisions

**Files:**
- Create: `src/collisions.ts`

A data-only module enumerating Obsidian default hotkeys this plugin overrides or collides with. Doesn't change behavior; serves as a single source of truth for the README's known-conflicts table and as a future-self reference.

- [ ] **Step 1: Create `src/collisions.ts`**

```ts
/**
 * Known collisions between this plugin's bindings and Obsidian's defaults
 * or common community-plugin defaults. Data only; no runtime behavior.
 *
 * Resolution policy from AGENTS.md § Soft-Dependency Policy:
 *   - emacs wins for keys this plugin claims
 *   - never remove an Obsidian default outright
 *   - rebind Obsidian defaults to their emacs equivalent where sensible
 *
 * Update this table when adding, removing, or changing bindings.
 */

export interface Collision {
	hotkey: string;
	emacsCommand: string;
	obsidianDefault: string;
	resolution: string;
}

export const KNOWN_COLLISIONS: Collision[] = [
	{
		hotkey: "Ctrl-A",
		emacsCommand: "move-beginning-of-line",
		obsidianDefault: "Select all",
		resolution: "emacs wins; users wanting select-all can rebind editor:select-all to Cmd-A",
	},
	{
		hotkey: "Ctrl-D",
		emacsCommand: "delete-char",
		obsidianDefault: "(none on most platforms)",
		resolution: "no conflict",
	},
	{
		hotkey: "Ctrl-K",
		emacsCommand: "kill-line",
		obsidianDefault: "Insert link",
		resolution: "emacs wins; insert-link via command palette",
	},
	{
		hotkey: "Ctrl-W",
		emacsCommand: "kill-region",
		obsidianDefault: "Close active pane (Linux/Windows)",
		resolution: "emacs wins inside editor; Layer 3a's C-x 0 binds close-pane to the emacs equivalent",
	},
	{
		hotkey: "Ctrl-Y",
		emacsCommand: "yank",
		obsidianDefault: "Redo",
		resolution: "emacs wins; redo available via Ctrl-Shift-/ (emacs-style) or Cmd-Shift-Z (platform default)",
	},
	{
		hotkey: "Alt-X",
		emacsCommand: "M-x (workspace command palette)",
		obsidianDefault: "(none)",
		resolution: "no conflict; subject to macOS dead-key on US-English layouts",
	},
	{
		hotkey: "Ctrl-X",
		emacsCommand: "(prefix; via Sequence Hotkeys when enabled)",
		obsidianDefault: "Cut",
		resolution: "emacs wins as a prefix when Sequence Hotkeys is enabled; native Cut available via Cmd-X",
	},
];
```

- [ ] **Step 2: Commit**

```sh
git add src/collisions.ts
git commit -m "docs(collisions): document known hotkey collisions

Data-only module; no runtime behavior. Single source of truth for the
README's known-conflicts table and a reference for future binding
additions. Mirrors the AGENTS.md soft-dependency / collision policy."
```

### Task 5.2: Full regression

**Files:** none

- [ ] **Step 1: Build, install, reload Obsidian**

```sh
make install
```

Reload Obsidian.

- [ ] **Step 2: Layer 1 regression (markdown editor)**

Open a markdown note. Run the entire `AGENTS.md` § Testing list. Expected: no regressions vs `0.5.0`.

- [ ] **Step 3: Layer 2 regression (in-input)**

For each surface (search bar, quick switcher, command palette, file rename, settings input, frontmatter property editor, plugin modal), exercise the binding set. Note any failures.

- [ ] **Step 4: Layer 3a regression**

- `M-x` → Switcher++ commands mode (or native palette).
- `C-s` / `C-r` → search.
- `M-%` (Alt+Shift+5) → search-replace.
- `C-g` workspace fallback → closes modals.

- [ ] **Step 5: Layer 3b regression (with Sequence Hotkeys enabled)**

Run through every entry in PREFIX_BINDINGS.

- [ ] **Step 6: Soft-dep dynamic toggle**

- Disable Switcher++. Verify `M-x` falls back to native palette without Obsidian reload.
- Re-enable. Verify `M-x` switches back.
- Disable Sequence Hotkeys. Verify all C-x bindings disappear.
- Re-enable. Verify they return.

If any fails, fix in-place before tagging.

- [ ] **Step 7: Run unit tests one more time**

```sh
npm test
```

Expected: all pass.

### Task 5.3: README rewrite

**Files:**
- Modify: `README.md`

The current README is the original Klojer fork's table. Replace with a feature-complete README documenting all three layers.

- [ ] **Step 1: Rewrite `README.md`**

Use the structure from the deferred rebrand spec (`docs/superpowers/specs/2026-05-08-rebrand-to-emacs-everywhere-design.md`) as a draft if useful. Sections:

- Headline + tagline
- What it is / what it isn't
- Install (manual via Makefile; community-directory entry once approved)
- Layers and feature table (Layer 1 in editor, Layer 2 in inputs, Layer 3 workspace + multi-chord)
- Soft-dependency table (mirrors `AGENTS.md`'s)
- Keybinding reference (full table from current README plus the new Layer 3 entries)
- Known limitations (macOS Alt-key dead keys, no macro recording, contenteditable surfaces incomplete)
- Attribution to Klojer's upstream
- License (GPL-3.0)

Do not commit the rebrand to "Emacs Everywhere" yet — that's a separate effort per the rebrand spec. Keep the project name as-is for this release.

- [ ] **Step 2: Commit**

```sh
git add README.md
git commit -m "docs: rewrite README for 0.6.0 feature set

Documents Layer 1 (editor), Layer 2 (in-input), Layer 3 (workspace +
multi-chord). Soft-dependency table mirrors AGENTS.md. Keybinding
reference includes the new Layer 3 entries. Project name unchanged
(rebrand deferred to a separate effort)."
```

### Task 5.4: Bump version, tag, release

**Files:**
- Modify: `package.json` (via npm version)
- Modify: `manifest.json`, `versions.json` (auto-updated by version-bump.mjs)

- [ ] **Step 1: Bump version to 0.6.0**

```sh
npm version 0.6.0 --no-git-tag-version
```

(Same convention as the refactor plan: `npm version` runs the `version` lifecycle script auto. Do not invoke `version-bump.mjs` separately.)

Verify: `manifest.json` reads `"version": "0.6.0"`; `versions.json` has a new entry.

- [ ] **Step 2: Commit**

```sh
git add package.json manifest.json versions.json
git commit -m "chore: release 0.6.0 (emacs bindings everywhere)

End of the feature implementation plan
(docs/plans/2026-05-08-feature-implementation.md). Layer 2 and Layer 3
ship; soft-deps integration with Sequence Hotkeys, Switcher++, Cycle
through panes; full unit-test coverage for soft-deps logic and DOM ops;
manual surface checklist green for inputs and textareas (contenteditable
deferred)."
```

- [ ] **Step 3: Tag and optionally push**

```sh
git tag 0.6.0
```

If publishing the release:
```sh
git push origin main
git push origin 0.6.0
```

The `.github/workflows/release.yml` will build and create a draft GitHub release with `main.js` and `manifest.json` attached.

---

## Self-review checklist

After all phases land, verify:

- [ ] **Spec coverage:** every binding in the design doc's tables (Layer 2 16 entries, Layer 3a 5 entries, Layer 3b 12 entries) has a corresponding registration. The KEY_SPECS array (Phase 2 task 2.4), PREFIX_BINDINGS array (Phase 4 task 4.1), and the addCommand calls in single-chord.ts (Phase 3a task 3.1) cover them.

- [ ] **No placeholders:** `<verified-id>` placeholders in `src/soft-deps/known-plugins.ts` are filled in with real values from Task V.2. The `SequenceHotkeysApi` interface in `src/prefix-maps/multi-chord.ts` matches the verified API shape.

- [ ] **Type consistency:** `ResolvedCommand`, `PreferredCommand`, `ResolveSpec`, `InputBindingsContext`, `Collision` types referenced consistently. Method names (`isEnabled`, `subscribe`, `resolve`, `watch`, `dispose`, `enable`, `disable`) match across modules.

- [ ] **Test coverage:** unit tests for `PluginDetector` (7 tests), `CommandResolver` (4 tests), `classifyElement` (11 tests), `ops` movement+kill (~17 tests) all pass. DOM tests run under jsdom.

- [ ] **Commit hygiene:** ~14 commits across the four phases (3 in Phase 1, 5 in Phase 2, 1 in Phase 3, 1 in Phase 4, 4 in Phase 5). Each builds on its predecessors; nothing forces a multi-commit rebase.

- [ ] **Surface checklist:** Task 2.5's surface verification was done; failures documented in AGENTS.md or filed as 0.6.x issues. No silent regressions.

- [ ] **Soft-dep dynamic toggle:** Task 5.2 step 6 verified. Switcher++ and Sequence Hotkeys enable/disable propagate without an Obsidian reload.

- [ ] **No production console.log:** `grep -rn "console\\.log" src/` returns zero results. All logging goes through the logger.

---

## Future work (deferred from this plan)

These were flagged during plan self-review and intentionally deferred to keep 0.6.0 scope tight.

- **Router unit tests for `src/input-bindings/index.ts`.** Currently only manual smoke tests cover Task 2.4's dispatch logic — the most complex piece in Layer 2. Worth a vitest suite with a fake DOM event and mocked KillRing/MarkState/RepeatDetector. File a 0.6.x issue.
- **`[contenteditable]` Layer 2 ops.** Frontmatter property editor and some plugin modals use contenteditable; Selection / Range API equivalents of the input/textarea ops are needed. Defer; document as known limitation in 0.6.0.
- **Visual-line motion for `C-n` / `C-p` in textareas.** Currently moves by textual line (counted via `\n`); on wrapped long lines this is not the same as visual-row motion. Matches Layer 1 v0.5.0 behavior. Could be improved later.
- **MarkState refactor for cross-surface use.** Current Layer 2 co-opts `ch` as an absolute character offset (kludge documented above). Refactor only if user reports a concrete problem.
- **Per-binding kill-ring integration in Layer 2 router.** `set-mark` and `keyboard-quit` currently bypass the RepeatDetector intentionally; double-check their interaction with `extendLastKill` after some real-world use.

---

## Execution Handoff

Plan complete and saved to `docs/plans/2026-05-08-feature-implementation.md`. Two execution options:

**1. Subagent-Driven (recommended)** — dispatch a fresh subagent per task, review between tasks, fast iteration.

**2. Inline Execution** — execute tasks in this session using `executing-plans`, batch execution with checkpoints.

Subagent-driven is recommended given the breadth of this plan (5 phases, ~14 commits, frequent context switches between unit tests and live Obsidian smoke tests).


