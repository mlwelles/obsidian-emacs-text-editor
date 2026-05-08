# Emacs Bindings Everywhere — Feature Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Layer 2 (in-input bindings) and Layer 3 (workspace single-chord + in-house multi-chord) on top of the modular `src/` tree produced by the refactor. Ship as `0.6.0`. Brings emacs/readline keybindings to every text-input surface in Obsidian — search bar, quick switcher, command palette, file rename, settings, frontmatter, plugin modals — and adds workspace-level commands (M-x, C-s, etc.) plus multi-chord prefix maps (C-x C-s, C-x b, etc.) handled by our own dispatcher.

**Architecture:** Three new logical layers, each landing in its own module. Soft-dependency framework comes first because Phase 3a depends on it. Layer 2 reuses the `KillRing` and `MarkState` from the refactor as a shared kill-ring/mark across editor and inputs. Layer 3a is ordinary `addCommand` registrations resolved through the soft-deps framework where richer plugins exist. Layer 3b is an in-house prefix-chord state machine that piggybacks on the Layer-2 capture-phase keydown listener — no third-party multi-chord plugin dependency.

**Tech Stack:** TypeScript (strict), esbuild, vitest. Obsidian Plugin API. DOM Selection / Range APIs (Layer 2 for `[contenteditable]`).

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
│   ├── dispatcher.ts          # Phase 4: in-house prefix-chord state machine
│   ├── dispatcher.test.ts
│   └── bindings.ts            # Phase 4: PREFIX_BINDINGS table + emacs:* commands
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

### Task V.2: Verify soft-dep plugin IDs and command IDs (DONE — 2026-05-08)

Verified at brainstorm time against a live Obsidian install with all soft-deps installed and enabled. Recorded here for reference; no further action needed.

| Soft-dep | Runtime plugin id | Manifest version | Notes |
|---|---|---|---|
| Quick Switcher++ | `darlal-switcher-plus` | 6.1.1 | Commands map cleanly; resolver-driven from Phase 3a |
| Cycle through panes | `cycle-through-panes` | 1.4.0 | Manifest renamed to "Tab Switcher" (id unchanged) |

**Switcher++ command IDs (verified):**

- M-x → `darlal-switcher-plus:switcher-plus:open-commands`
- C-x C-f (find-file) → `darlal-switcher-plus:switcher-plus:open` (default file mode)
- C-x b (switch-buffer) → `darlal-switcher-plus:switcher-plus:open-editors`
- Bonus modes: `open-headings`, `open-symbols`, `open-related-items`, `open-vaults`, `open-workspaces`, `open-starred`

**Cycle through panes command ID (verified):**

- C-x o → `cycle-through-panes:cycle-through-panes`
- Reverse cycle (optional binding): `cycle-through-panes:cycle-through-panes-reverse`

**Multi-chord plugin (Sequence Hotkeys / leader-hotkeys): not used.** Phase 4 implements an in-house prefix-chord dispatcher; no soft-dep on either plugin. Both can coexist with this plugin without conflict (they handle different sequences than ours, and our capture-phase listener fires before either's listener).

If a future user reports collisions between our in-house dispatcher and another multi-chord plugin's bindings, document and resolve case-by-case. No automatic deconfliction is planned.

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

### Task 1.3: `known-plugins.ts` with typed handles for the soft-dep plugins

**Files:**
- Create: `src/soft-deps/known-plugins.ts`

Data-only module; captures the verified plugin and command IDs from Task V.2 in one place. No Sequence Hotkeys / leader-hotkeys entries — Phase 4 uses an in-house dispatcher.

- [ ] **Step 1: Create `src/soft-deps/known-plugins.ts`**

```ts
/**
 * Verified plugin and command IDs for the soft-deps in this project.
 * Source of truth: docs/plans/2026-05-08-feature-implementation.md § Task V.2
 * (verified against a live Obsidian install on 2026-05-08).
 *
 * Update this file whenever a soft-dep plugin renames a command or its
 * runtime id changes.
 */

export const SWITCHER_PLUS = {
	pluginId: "darlal-switcher-plus",
	commands: {
		// Switcher++ namespaces its own commands with a "switcher-plus:" prefix
		// inside the plugin's own id, hence the doubled segments.
		commandsMode: "darlal-switcher-plus:switcher-plus:open-commands",
		editorsMode: "darlal-switcher-plus:switcher-plus:open-editors",
		fileMode: "darlal-switcher-plus:switcher-plus:open",
	},
} as const;

export const CYCLE_THROUGH_PANES = {
	// Plugin manifest renamed to "Tab Switcher"; runtime id unchanged.
	pluginId: "cycle-through-panes",
	commands: {
		cycle: "cycle-through-panes:cycle-through-panes",
		cycleReverse: "cycle-through-panes:cycle-through-panes-reverse",
	},
} as const;

export const NATIVE_FALLBACKS = {
	commandPalette: "command-palette:open",
	switcher: "switcher:open",
	editorSearch: "editor:open-search",
	editorSearchReplace: "editor:open-search-replace",
	editorSave: "editor:save-file",
	editorRevealInExplorer: "file-explorer:reveal-active-file",
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

- [ ] **Step 2: Verify the file compiles**

```sh
npm run typecheck
```

Expected: success.

- [ ] **Step 3: Commit**

```sh
git add src/soft-deps/known-plugins.ts
git commit -m "feat(soft-deps): add typed handles for known soft-dep plugins

Captures verified runtime plugin IDs and command IDs for Quick
Switcher++ and Cycle through panes, plus native Obsidian fallbacks.
No multi-chord-plugin entries — Phase 4 implements an in-house
prefix-chord dispatcher rather than depending on Sequence Hotkeys
or leader-hotkeys."
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

## Phase 4 — Layer 3b: in-house multi-chord prefix dispatcher

`C-x` prefix sequences handled by an in-house state machine. No third-party plugin dependency. Piggybacks on the Phase-2 capture-phase keydown listener so it gets first crack at keys, before any Obsidian or other-plugin handler.

### Task 4.1: `PrefixDispatcher` state machine

**Files:**
- Create: `src/prefix-maps/dispatcher.ts`
- Create: `src/prefix-maps/dispatcher.test.ts`

The state machine. Inputs: keyboard events. State: `idle`, `awaiting`. When a registered prefix chord is matched in `idle`, transitions to `awaiting` with a sub-binding list. Subsequent chord either leaves the dispatcher (matched leaf), descends into a nested sub-prefix (e.g., `C-x 5 0` — `C-x` then `5` is a sub-prefix, then `0`), or cancels.

Cancel triggers: `C-g`, `Escape`, timeout (default 5s), unmatched chord.

- [ ] **Step 1: Write `src/prefix-maps/dispatcher.test.ts` (failing first)**

```ts
import {beforeEach, describe, expect, it, vi} from "vitest";
import {PrefixDispatcher, type PrefixMap} from "./dispatcher";

const cx = {ctrl: true, key: "x"} as const;
const cs = {ctrl: true, key: "s"} as const;
const cf = {ctrl: true, key: "f"} as const;
const cg = {ctrl: true, key: "g"} as const;
const k5 = {key: "5"} as const;
const k0 = {key: "0"} as const;
const kb = {key: "b"} as const;

const fakeLogger = {debug: vi.fn()};

function makeEvent(spec: {ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean; key: string}): KeyboardEvent {
	return new KeyboardEvent("keydown", {
		ctrlKey: spec.ctrl ?? false,
		altKey: spec.alt ?? false,
		shiftKey: spec.shift ?? false,
		metaKey: spec.meta ?? false,
		key: spec.key,
	});
}

describe("PrefixDispatcher", () => {
	let saveAction: ReturnType<typeof vi.fn>;
	let findFileAction: ReturnType<typeof vi.fn>;
	let switchBufferAction: ReturnType<typeof vi.fn>;
	let closeWindowAction: ReturnType<typeof vi.fn>;
	let dispatcher: PrefixDispatcher;

	beforeEach(() => {
		saveAction = vi.fn();
		findFileAction = vi.fn();
		switchBufferAction = vi.fn();
		closeWindowAction = vi.fn();
		const maps: PrefixMap[] = [
			{
				prefix: cx,
				bindings: [
					{chord: cs, action: saveAction},
					{chord: cf, action: findFileAction},
					{chord: kb, action: switchBufferAction},
					{
						chord: k5,
						subBindings: [{chord: k0, action: closeWindowAction}],
					},
				],
			},
		];
		dispatcher = new PrefixDispatcher(maps, fakeLogger, {timeoutMs: 5000});
	});

	it("returns false for events that don't match any prefix in idle state", () => {
		const consumed = dispatcher.handle(makeEvent({key: "a"}));
		expect(consumed).toBe(false);
	});

	it("returns true and switches to awaiting on prefix match", () => {
		const consumed = dispatcher.handle(makeEvent(cx));
		expect(consumed).toBe(true);
		expect(saveAction).not.toHaveBeenCalled();
	});

	it("dispatches the matched leaf action on second chord", () => {
		dispatcher.handle(makeEvent(cx));
		const consumed = dispatcher.handle(makeEvent(cs));
		expect(consumed).toBe(true);
		expect(saveAction).toHaveBeenCalledTimes(1);
	});

	it("returns to idle after dispatching a leaf", () => {
		dispatcher.handle(makeEvent(cx));
		dispatcher.handle(makeEvent(cs));
		// Now in idle. Next prefix should be accepted.
		expect(dispatcher.handle(makeEvent(cx))).toBe(true);
	});

	it("descends into a sub-prefix and dispatches on third chord", () => {
		dispatcher.handle(makeEvent(cx));
		expect(dispatcher.handle(makeEvent(k5))).toBe(true);
		expect(closeWindowAction).not.toHaveBeenCalled();
		expect(dispatcher.handle(makeEvent(k0))).toBe(true);
		expect(closeWindowAction).toHaveBeenCalledTimes(1);
	});

	it("cancels on C-g and returns to idle", () => {
		dispatcher.handle(makeEvent(cx));
		const consumed = dispatcher.handle(makeEvent(cg));
		expect(consumed).toBe(true);
		expect(saveAction).not.toHaveBeenCalled();
		// Idle: next non-prefix should pass through
		expect(dispatcher.handle(makeEvent({key: "a"}))).toBe(false);
	});

	it("cancels on Escape and returns to idle", () => {
		dispatcher.handle(makeEvent(cx));
		const consumed = dispatcher.handle(makeEvent({key: "Escape"}));
		expect(consumed).toBe(true);
		expect(dispatcher.handle(makeEvent({key: "a"}))).toBe(false);
	});

	it("ignores unmatched second chord and returns to idle (consumes the chord to avoid stray inserts)", () => {
		dispatcher.handle(makeEvent(cx));
		const consumed = dispatcher.handle(makeEvent({key: "z"})); // no binding
		expect(consumed).toBe(true);
		expect(dispatcher.handle(makeEvent({key: "a"}))).toBe(false);
	});

	it("re-press of prefix while awaiting cancels-and-restarts", () => {
		dispatcher.handle(makeEvent(cx));
		// Press C-x again — restart; still awaiting at top level.
		const consumed = dispatcher.handle(makeEvent(cx));
		expect(consumed).toBe(true);
		// Now press s once — should dispatch save once.
		dispatcher.handle(makeEvent(cs));
		expect(saveAction).toHaveBeenCalledTimes(1);
	});

	it("cancels via timeout if user pauses too long", () => {
		vi.useFakeTimers();
		try {
			const d = new PrefixDispatcher(
				[
					{
						prefix: cx,
						bindings: [{chord: cs, action: saveAction}],
					},
				],
				fakeLogger,
				{timeoutMs: 100},
			);
			d.handle(makeEvent(cx));
			vi.advanceTimersByTime(150);
			// After timeout, dispatcher is idle; next non-prefix passes through.
			expect(d.handle(makeEvent({key: "a"}))).toBe(false);
		} finally {
			vi.useRealTimers();
		}
	});

	it("cancel() resets state from any awaiting position", () => {
		dispatcher.handle(makeEvent(cx));
		dispatcher.handle(makeEvent(k5)); // descended into sub-prefix
		dispatcher.cancel();
		expect(dispatcher.handle(makeEvent({key: "a"}))).toBe(false);
		expect(closeWindowAction).not.toHaveBeenCalled();
	});
});
```

- [ ] **Step 2: Run, verify failing**

```sh
npm test -- dispatcher
```

Expected: 11 tests fail with "Cannot find module './dispatcher'".

- [ ] **Step 3: Implement `src/prefix-maps/dispatcher.ts`**

```ts
import type {Logger} from "../log";

export interface ChordSpec {
	ctrl?: boolean;
	alt?: boolean;
	shift?: boolean;
	meta?: boolean;
	key: string;
}

export interface PrefixBinding {
	chord: ChordSpec;
	action?: () => void;
	subBindings?: PrefixBinding[];
}

export interface PrefixMap {
	prefix: ChordSpec;
	bindings: PrefixBinding[];
}

export interface DispatcherOptions {
	timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5000;
const CANCEL_KEYS: ChordSpec[] = [
	{ctrl: true, key: "g"},
	{key: "Escape"},
];

function chordMatches(event: KeyboardEvent, spec: ChordSpec): boolean {
	const wantCtrl = !!spec.ctrl;
	const wantAlt = !!spec.alt;
	const wantShift = !!spec.shift;
	const wantMeta = !!spec.meta;
	if (event.ctrlKey !== wantCtrl) return false;
	if (event.altKey !== wantAlt) return false;
	if (event.shiftKey !== wantShift) return false;
	if (event.metaKey !== wantMeta) return false;
	return event.key === spec.key;
}

export class PrefixDispatcher {
	private state: "idle" | "awaiting" = "idle";
	private currentBindings: PrefixBinding[] = [];
	private timeoutHandle: ReturnType<typeof setTimeout> | null = null;
	private readonly timeoutMs: number;

	constructor(
		private readonly maps: PrefixMap[],
		private readonly logger: Logger,
		options: DispatcherOptions = {},
	) {
		this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
	}

	handle(event: KeyboardEvent): boolean {
		if (this.state === "idle") {
			const matchedMap = this.maps.find((m) => chordMatches(event, m.prefix));
			if (!matchedMap) {
				return false;
			}
			this.enterAwaiting(matchedMap.bindings, "prefix " + matchedMap.prefix.key);
			return true;
		}
		// awaiting
		// Cancel keys override sub-bindings (so users can always C-g out).
		if (CANCEL_KEYS.some((c) => chordMatches(event, c))) {
			this.cancel();
			return true;
		}
		// Re-press of any top-level prefix while awaiting: restart.
		const restartMap = this.maps.find((m) => chordMatches(event, m.prefix));
		if (restartMap) {
			this.cancelTimeout();
			this.enterAwaiting(restartMap.bindings, "restart prefix " + restartMap.prefix.key);
			return true;
		}
		const binding = this.currentBindings.find((b) => chordMatches(event, b.chord));
		if (!binding) {
			this.logger.debug("PrefixDispatcher: unmatched chord, cancelling");
			this.cancel();
			return true;
		}
		this.cancelTimeout();
		if (binding.action) {
			binding.action();
			this.state = "idle";
			this.currentBindings = [];
			return true;
		}
		if (binding.subBindings && binding.subBindings.length > 0) {
			this.enterAwaiting(binding.subBindings, "sub-prefix " + binding.chord.key);
			return true;
		}
		// Binding has neither action nor subBindings — defensive cancel.
		this.cancel();
		return true;
	}

	cancel(): void {
		if (this.state === "awaiting") {
			this.logger.debug("PrefixDispatcher: cancelled");
		}
		this.state = "idle";
		this.currentBindings = [];
		this.cancelTimeout();
	}

	private enterAwaiting(bindings: PrefixBinding[], reason: string): void {
		this.state = "awaiting";
		this.currentBindings = bindings;
		this.cancelTimeout();
		this.timeoutHandle = setTimeout(() => {
			this.logger.debug("PrefixDispatcher: timeout, cancelling");
			this.state = "idle";
			this.currentBindings = [];
			this.timeoutHandle = null;
		}, this.timeoutMs);
		this.logger.debug("PrefixDispatcher: " + reason);
	}

	private cancelTimeout(): void {
		if (this.timeoutHandle !== null) {
			clearTimeout(this.timeoutHandle);
			this.timeoutHandle = null;
		}
	}
}
```

- [ ] **Step 4: Verify tests pass**

```sh
npm test
```

Expected: 11 dispatcher tests pass; pre-existing tests still pass.

- [ ] **Step 5: Commit**

```sh
git add src/prefix-maps/dispatcher.ts src/prefix-maps/dispatcher.test.ts
git commit -m "feat(prefix-maps): in-house multi-chord prefix dispatcher

State machine for emacs-style prefix sequences: idle / awaiting,
with nested sub-prefixes (C-x 5 0) and cancellation via C-g, Escape,
timeout, or unmatched chord. 11 unit tests cover the full state
graph.

Replaces the previously-planned Sequence Hotkeys integration. The
dispatcher avoids any third-party multi-chord plugin dependency and
works uniformly across all users."
```

### Task 4.2: `PREFIX_BINDINGS` table and `emacs:*` commands

**Files:**
- Create: `src/prefix-maps/bindings.ts`
- Modify: `src/main.ts`

Defines the `C-x` binding table; registers each leaf action as an `addCommand` entry (no default hotkey — the dispatcher delivers them). Each command's callback dispatches via the existing `CommandResolver` for soft-dep aware behavior.

- [ ] **Step 1: Create `src/prefix-maps/bindings.ts`**

```ts
import type {Plugin} from "obsidian";
import type {CommandResolver} from "../soft-deps/command-resolver";
import {SWITCHER_PLUS, CYCLE_THROUGH_PANES, NATIVE_FALLBACKS} from "../soft-deps/known-plugins";
import type {PrefixMap} from "./dispatcher";

export const COMMAND_IDS = {
	SAVE_BUFFER: "save-buffer",
	FIND_FILE: "find-file",
	REVEAL_IN_EXPLORER: "reveal-in-explorer",
	SWITCH_BUFFER: "switch-buffer",
	CLOSE_PANE: "close-pane",
	CLOSE_OTHER_PANES: "close-other-panes",
	SPLIT_HORIZONTAL: "split-horizontal",
	SPLIT_VERTICAL: "split-vertical",
	OTHER_WINDOW: "other-window",
	MARK_WHOLE_BUFFER: "select-all",
	UNDO_PREFIX: "undo",
	OPEN_NEW_WINDOW: "open-new-window",
	CLOSE_WINDOW: "close-window",
	QUIT_APP: "quit-app",
} as const;

export type EmacsCommandId = typeof COMMAND_IDS[keyof typeof COMMAND_IDS];

interface CommandSpec {
	id: EmacsCommandId;
	name: string;
	dispatch: (plugin: Plugin, resolver: CommandResolver) => void;
}

const COMMAND_SPECS: CommandSpec[] = [
	{
		id: COMMAND_IDS.SAVE_BUFFER,
		name: "Save buffer (C-x C-s)",
		dispatch: (p) => p.app.commands.executeCommandById(NATIVE_FALLBACKS.editorSave),
	},
	{
		id: COMMAND_IDS.FIND_FILE,
		name: "Find file (C-x C-f)",
		dispatch: (p, r) => {
			const resolved = r.resolve({
				preferred: {pluginId: SWITCHER_PLUS.pluginId, commandId: SWITCHER_PLUS.commands.fileMode},
				fallback: {commandId: NATIVE_FALLBACKS.switcher},
			});
			if (resolved.commandId) p.app.commands.executeCommandById(resolved.commandId);
		},
	},
	{
		id: COMMAND_IDS.REVEAL_IN_EXPLORER,
		name: "Reveal active file in explorer (C-x d)",
		dispatch: (p) => p.app.commands.executeCommandById(NATIVE_FALLBACKS.editorRevealInExplorer),
	},
	{
		id: COMMAND_IDS.SWITCH_BUFFER,
		name: "Switch buffer (C-x b)",
		dispatch: (p, r) => {
			const resolved = r.resolve({
				preferred: {pluginId: SWITCHER_PLUS.pluginId, commandId: SWITCHER_PLUS.commands.editorsMode},
				fallback: {commandId: NATIVE_FALLBACKS.switcher},
			});
			if (resolved.commandId) p.app.commands.executeCommandById(resolved.commandId);
		},
	},
	{
		id: COMMAND_IDS.CLOSE_PANE,
		name: "Close pane (C-x 0 / C-x k)",
		dispatch: (p) => p.app.commands.executeCommandById(NATIVE_FALLBACKS.workspaceCloseActivePane),
	},
	{
		id: COMMAND_IDS.CLOSE_OTHER_PANES,
		name: "Close other panes (C-x 1)",
		dispatch: (p) => p.app.commands.executeCommandById(NATIVE_FALLBACKS.workspaceCloseOthers),
	},
	{
		id: COMMAND_IDS.SPLIT_HORIZONTAL,
		name: "Split horizontal (C-x 2)",
		dispatch: (p) => p.app.commands.executeCommandById(NATIVE_FALLBACKS.workspaceSplitHorizontal),
	},
	{
		id: COMMAND_IDS.SPLIT_VERTICAL,
		name: "Split vertical (C-x 3)",
		dispatch: (p) => p.app.commands.executeCommandById(NATIVE_FALLBACKS.workspaceSplitVertical),
	},
	{
		id: COMMAND_IDS.OTHER_WINDOW,
		name: "Other window (C-x o)",
		dispatch: (p, r) => {
			const resolved = r.resolve({
				preferred: {
					pluginId: CYCLE_THROUGH_PANES.pluginId,
					commandId: CYCLE_THROUGH_PANES.commands.cycle,
				},
				fallback: {commandId: NATIVE_FALLBACKS.workspaceNextTab},
			});
			if (resolved.commandId) p.app.commands.executeCommandById(resolved.commandId);
		},
	},
	{
		id: COMMAND_IDS.MARK_WHOLE_BUFFER,
		name: "Select all (C-x h)",
		dispatch: (p) => p.app.commands.executeCommandById(NATIVE_FALLBACKS.editorSelectAll),
	},
	{
		id: COMMAND_IDS.UNDO_PREFIX,
		name: "Undo prefix (C-x u)",
		dispatch: (p) => p.app.commands.executeCommandById(NATIVE_FALLBACKS.editorUndo),
	},
	{
		id: COMMAND_IDS.OPEN_NEW_WINDOW,
		name: "Open new window (C-x 5 2)",
		dispatch: (p) => p.app.commands.executeCommandById(NATIVE_FALLBACKS.workspaceOpenNewWindow),
	},
	{
		id: COMMAND_IDS.CLOSE_WINDOW,
		name: "Close window (C-x 5 0)",
		dispatch: (p) => p.app.commands.executeCommandById(NATIVE_FALLBACKS.workspaceCloseWindow),
	},
	{
		id: COMMAND_IDS.QUIT_APP,
		name: "Quit Obsidian (C-x C-c)",
		dispatch: (p) => p.app.commands.executeCommandById(NATIVE_FALLBACKS.appQuit),
	},
];

export function registerPrefixCommands(plugin: Plugin, resolver: CommandResolver): Map<string, () => void> {
	const handles = new Map<string, () => void>();
	for (const spec of COMMAND_SPECS) {
		const fullId = "emacs:" + spec.id;
		const callback = () => spec.dispatch(plugin, resolver);
		plugin.addCommand({
			id: spec.id, // Obsidian prepends the manifest id automatically
			name: spec.name,
			callback,
		});
		handles.set(fullId, callback);
	}
	return handles;
}

export function buildCxPrefixMap(handles: Map<string, () => void>): PrefixMap {
	const get = (id: string) => {
		const fn = handles.get("emacs:" + id);
		if (!fn) throw new Error("missing emacs command: " + id);
		return fn;
	};
	return {
		prefix: {ctrl: true, key: "x"},
		bindings: [
			{chord: {ctrl: true, key: "s"}, action: get(COMMAND_IDS.SAVE_BUFFER)},
			{chord: {ctrl: true, key: "f"}, action: get(COMMAND_IDS.FIND_FILE)},
			{chord: {key: "d"}, action: get(COMMAND_IDS.REVEAL_IN_EXPLORER)},
			{chord: {key: "b"}, action: get(COMMAND_IDS.SWITCH_BUFFER)},
			{chord: {key: "k"}, action: get(COMMAND_IDS.CLOSE_PANE)},
			{chord: {key: "0"}, action: get(COMMAND_IDS.CLOSE_PANE)},
			{chord: {key: "1"}, action: get(COMMAND_IDS.CLOSE_OTHER_PANES)},
			{chord: {key: "2"}, action: get(COMMAND_IDS.SPLIT_HORIZONTAL)},
			{chord: {key: "3"}, action: get(COMMAND_IDS.SPLIT_VERTICAL)},
			{chord: {key: "o"}, action: get(COMMAND_IDS.OTHER_WINDOW)},
			{chord: {key: "h"}, action: get(COMMAND_IDS.MARK_WHOLE_BUFFER)},
			{chord: {key: "u"}, action: get(COMMAND_IDS.UNDO_PREFIX)},
			{
				chord: {key: "5"},
				subBindings: [
					{chord: {key: "2"}, action: get(COMMAND_IDS.OPEN_NEW_WINDOW)},
					{chord: {key: "0"}, action: get(COMMAND_IDS.CLOSE_WINDOW)},
				],
			},
			{chord: {ctrl: true, key: "c"}, action: get(COMMAND_IDS.QUIT_APP)},
		],
	};
}
```

- [ ] **Step 2: Wire into `src/main.ts`**

Add imports:
```ts
import {PrefixDispatcher} from "./prefix-maps/dispatcher";
import {registerPrefixCommands, buildCxPrefixMap} from "./prefix-maps/bindings";
```

Add a field:
```ts
private prefixDispatcher!: PrefixDispatcher;
```

In `onload`, after Phase 3a wiring:
```ts
const handles = registerPrefixCommands(this, this.resolver);
const cxPrefixMap = buildCxPrefixMap(handles);
this.prefixDispatcher = new PrefixDispatcher([cxPrefixMap], this.logger);
```

The dispatcher itself is consumed by Phase 4 task 4.3 (the wiring step).

- [ ] **Step 3: Build, install, smoke-test commands appear**

```sh
make install
```

Reload Obsidian. Open the command palette (Cmd-P). Type "emacs". Verify all 14 `Emacs text editor: ...` commands appear (Save buffer, Find file, ...). They aren't bound to any keys yet (no default hotkey, dispatcher not yet hooked into the keydown listener). Phase 4 task 4.3 wires the dispatcher.

- [ ] **Step 4: Commit**

```sh
git add src/prefix-maps/bindings.ts src/main.ts
git commit -m "feat(prefix-maps): emacs:* commands and C-x prefix map

Defines 14 emacs-style commands (save-buffer, find-file, switch-buffer,
close-pane, split-horizontal, etc.) as Obsidian addCommand entries.
Each command's callback dispatches through CommandResolver where a
richer plugin alternative exists (Switcher++ for find-file/switch-buffer,
Cycle through panes for other-window).

Builds the C-x PrefixMap consumed by the PrefixDispatcher in the next
task. Commands are unbound by default; dispatcher delivers them. Users
can also bind via Obsidian's Hotkeys settings if they prefer."
```

### Task 4.3: Wire the dispatcher into the Layer-2 keydown listener

**Files:**
- Modify: `src/input-bindings/index.ts`
- Modify: `src/main.ts`

The dispatcher must run **before** the Layer-2 ID-spec dispatch, because `C-x` itself is a chord we want to claim before Layer 2 considers it. Modify `installInputBindings` to accept an optional dispatcher and consult it first.

- [ ] **Step 1: Modify `src/input-bindings/index.ts` to consult the dispatcher**

In the `InputBindingsContext` interface, add an optional field:
```ts
export interface InputBindingsContext {
	killRing: KillRing;
	mark: MarkState;
	repeats: RepeatDetector;
	logger: Logger;
	prefixDispatcher?: {handle(event: KeyboardEvent): boolean};
}
```

In the `handler` inside `installInputBindings`, consult the dispatcher first:
```ts
const handler = (event: KeyboardEvent) => {
	if (ctx.prefixDispatcher?.handle(event)) {
		event.preventDefault();
		event.stopPropagation();
		return;
	}
	// ... existing classification + KEY_SPECS dispatch ...
};
```

Note: the dispatcher is called for **every** keydown, even when the target is not an input/textarea. This is intentional — `C-x C-s` should save the file regardless of whether focus is in the editor, in a search bar, or nowhere. The dispatcher's prefix matching is conservative (only fires on registered chords), so non-prefix keys pass through to the existing element-classification path.

- [ ] **Step 2: Modify `src/main.ts` to pass the dispatcher into the bindings context**

Update the `installInputBindings(...)` call:
```ts
installInputBindings(
	document,
	{
		killRing: this.killRing,
		mark: this.mark,
		repeats: this.repeats,
		logger: this.logger,
		prefixDispatcher: this.prefixDispatcher,
	},
	cleanup => this.register(cleanup),
);
```

- [ ] **Step 3: Build and install**

```sh
make install
```

Reload Obsidian.

- [ ] **Step 4: Manual smoke test — multi-chord bindings fire**

In any markdown note:
- `C-x C-s` → file saves (status bar reflects).
- `C-x C-f` → opens Switcher++ file mode (or native switcher if Switcher++ not enabled).
- `C-x b` → opens Switcher++ editors mode.
- `C-x o` → cycles panes (or next tab if Cycle through panes not enabled).
- `C-x 5 2` → opens new window.
- `C-x 5 0` → closes window.
- `C-x h` → selects all in editor.
- `C-x u` → undo.
- `C-x 1` → close other panes.
- `C-x 2` / `C-x 3` → split.

`C-x` then `C-g` → cancels prefix; subsequent `C-g` returns to keyboard-quit (Layer 1).

`C-x` then wait 5 seconds → prefix auto-cancels.

`C-x` then `z` (unbound) → cancel; `z` not inserted.

- [ ] **Step 5: Manual regression — Layer 1 and Layer 2 still work**

Verify Layer 1 (markdown editor) and Layer 2 (in-input) bindings still work as before. The dispatcher should pass through keys it doesn't recognize.

If any regress, the dispatcher's `handle()` is consuming events it shouldn't. Debug by logging in the dispatcher.

- [ ] **Step 6: Commit**

```sh
git add src/input-bindings/index.ts src/main.ts
git commit -m "feat(prefix-maps): wire PrefixDispatcher into Layer-2 keydown listener

The dispatcher gets first crack at every keydown via the existing
capture-phase listener. It returns true when a chord is consumed
(prefix entry, leaf dispatch, cancel); the listener then short-
circuits without falling through to Layer-2 ID-spec dispatch. False
returns pass through unchanged.

Multi-chord bindings now work: C-x C-s, C-x C-f, C-x b, C-x o, etc.
Cancel via C-g, Escape, 5s timeout, or unmatched chord."
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
		emacsCommand: "(prefix; in-house dispatcher)",
		obsidianDefault: "Cut",
		resolution: "emacs wins as a prefix; native Cut available via Cmd-X",
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

- [ ] **Step 5: Layer 3b regression (in-house dispatcher)**

Exercise every entry in the C-x prefix map. Verify cancel via `C-g` mid-prefix, cancel via Escape, cancel via 5-second timeout. Re-press of `C-x` mid-awaiting restarts the prefix. Unbound second chord (e.g., `C-x z`) cancels and does not insert the second key.

- [ ] **Step 6: Soft-dep dynamic toggle**

- Disable Switcher++. Verify `M-x` falls back to native palette without Obsidian reload.
- Re-enable. Verify `M-x` switches back.
- Disable Cycle through panes. Verify `C-x o` falls back to `workspace:next-tab`. Re-enable; verify it switches back.

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

Use the structure from the deferred rebrand spec (`docs/specs/2026-05-08-rebrand-to-emacs-everywhere-design.md`) as a draft if useful. Sections:

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
ship; soft-deps integration with Switcher++ and Cycle through panes;
in-house prefix-chord dispatcher for multi-chord (no third-party
multi-chord plugin dependency); full unit-test coverage for soft-deps
logic, DOM ops, and the dispatcher state machine; manual surface
checklist green for inputs and textareas (contenteditable deferred)."
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

- [ ] **Soft-dep dynamic toggle:** Task 5.2 step 6 verified. Switcher++ and Cycle through panes enable/disable propagate without an Obsidian reload.

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


