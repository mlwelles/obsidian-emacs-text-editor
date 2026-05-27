# Emacs Text Editor for Obsidian

> Emacs and readline keybindings in the editor and in every text input.

A community plugin for [Obsidian](https://obsidian.md) that brings emacs-style keybindings throughout the app: in the markdown editor, in every plain `<input>` / `<textarea>` / `[contenteditable]` element, and as workspace-level commands. Includes a shared kill ring, mark/region selection, and multi-chord prefix maps (`C-x ...`) handled by an in-house dispatcher with optional integration with several other community plugins.

If you have ever instinctively typed `C-a` in a search bar, frontmatter editor, or rename dialog and watched the cursor go nowhere useful, this plugin is for you. The same readline-style keys that macOS exposes by default in every text field work across all of Obsidian when this plugin is enabled — plus the `M-` (Alt) bindings macOS doesn't provide.

## Status

This project began as a fork of [`Klojer/obsidian-emacs-text-editor`](https://github.com/Klojer/obsidian-emacs-text-editor) and has since grown substantially in scope. It is now maintained independently.

## Features

- **In-editor bindings** (Layer 1). Emacs movement, killing, yanking, and paragraph-navigation commands in the markdown editor.
- **In-input bindings** (Layer 2). The same keys work in plain `<input>`, `<textarea>`, and `[contenteditable]` elements: search bars, quick switcher, command palette, file rename dialog, inline title editor, breadcrumb path editor, plugin settings panels, frontmatter property editor, and modal text inputs from other plugins.
- **Workspace bindings** (Layer 3). Single-chord global aliases (`M-x`, `C-s`, `C-r`, `M-%`, `C-g`) and multi-chord prefix maps (`C-x C-s`, `C-x C-f`, `C-x b`, `C-x o`, `C-x 5 0`, etc.) via an in-house prefix dispatcher.
- **Shared kill ring** (default size 120, matching emacs). One kill ring across all three layers; killing in the editor and yanking into a search bar works as expected. Repeated `C-k` / `M-d` / `M-Backspace` extends the previous kill.
- **Mark and region.** `C-Space` sets the mark; movement extends the region; `C-w` / `M-w` cut/copy; `C-g` cancels.
- **No third-party multi-chord dependency.** The in-house dispatcher handles `C-x` prefix sequences directly. Coexists cleanly with leader-hotkeys, Sequence Hotkeys, or any other multi-chord plugin.

## Install

### Manual install

```sh
export OBSIDIAN_PLUGINS_DIR=/path/to/your/vault/.obsidian/plugins
make install
```

This builds the plugin and copies `main.js` and `manifest.json` into `$OBSIDIAN_PLUGINS_DIR/emacs-text-editor/`. Reload Obsidian or toggle the plugin in Settings → Community plugins.

### Uninstall

```sh
export OBSIDIAN_PLUGINS_DIR=/path/to/your/vault/.obsidian/plugins
make uninstall
```

### Community directory

Not yet listed. Submission to the Obsidian community plugin directory is planned after a stabilization period.

## Optional plugins

Some bindings deliver a richer experience when paired with another plugin. The plugin detects each one at load and falls back to a native Obsidian command when the preferred plugin is not installed. No reload required when toggling these plugins.

| Plugin | Bindings affected | Fallback when absent |
|---|---|---|
| [Quick Switcher++](https://github.com/darlal/obsidian-switcher-plus) | `M-x`, `C-x C-f`, `C-x b` | Native `command-palette:open` / `switcher:open` |
| [Cycle through panes](https://github.com/Yuichi-Aragi/cycle-through-panes) | `C-x o` | Native `workspace:next-tab` (cycles tabs, not panes) |

## Keybinding reference

### Editor + input bindings (Layers 1 & 2)

| Hotkey | Command | Description |
|---|---|---|
| `C-f` | Forward char | Move cursor one character forward |
| `C-b` | Backward char | Move cursor one character backward |
| `C-n` | Next line | Move cursor to next line |
| `C-p` | Previous line | Move cursor to previous line |
| `C-a` | Beginning of line | Move cursor to beginning of line (visual line on wrapped text) |
| `C-e` | End of line | Move cursor to end of line (visual line on wrapped text) |
| `M-f` | Forward word | Move cursor one word forward |
| `M-b` | Backward word | Move cursor one word backward |
| `M-S-]` | Forward paragraph | Move cursor one paragraph forward (editor only) |
| `M-S-[` | Backward paragraph | Move cursor one paragraph backward (editor only) |
| `M-S-,` | Beginning of buffer | Move to start of buffer (editor only) |
| `M-S-.` | End of buffer | Move to end of buffer (editor only) |
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
| `C-l` | Recenter | Scroll current line to center (editor only) |
| `C-/` or `C-_` | Undo | Undo (editor only) |
| `C-S-/` or `C-M-_` | Redo | Redo (editor only) |
| `C-t` | Transpose chars | Swap two characters around cursor (editor only) |

### Workspace bindings (Layer 3a)

| Hotkey | Command |
|---|---|
| `M-x` | Open command palette (Switcher++ commands mode if enabled) |
| `C-s` | Open editor search |
| `C-r` | Open editor search (no separate reverse-search UI in Obsidian) |
| `M-S-5` (`M-%`) | Open search-and-replace |
| `C-g` | Workspace-level cancel (blurs focused element + dispatches Escape; falls back to Layer 1 keyboard-quit when editor is focused) |

### Multi-chord prefix bindings (Layer 3b)

Press `C-x` then the second chord. The dispatcher cancels on `C-g`, `Escape`, an unmatched chord, or after a 5-second pause.

| Sequence | Command | Native fallback |
|---|---|---|
| `C-x C-s` | Save buffer | `editor:save-file` |
| `C-x C-f` | Find file | Switcher++ file mode or native switcher |
| `C-x d` | Reveal active file in explorer | `file-explorer:reveal-active-file` |
| `C-x b` | Switch buffer | Switcher++ editors mode or native switcher |
| `C-x k` / `C-x 0` | Close active pane | `workspace:close` |
| `C-x 1` | Close other panes | `workspace:close-others` |
| `C-x 2` | Split horizontal | `workspace:split-horizontal` |
| `C-x 3` | Split vertical | `workspace:split-vertical` |
| `C-x o` | Other window | Cycle through panes plugin or `workspace:next-tab` |
| `C-x h` | Select all | `editor:select-all` |
| `C-x u` | Undo | `editor:undo` |
| `C-x 5 2` | Open new window | `workspace:open-new-window` |
| `C-x 5 0` | Close window | `workspace:close-window` |
| `C-x C-c` | Quit Obsidian | `app:quit` |

## Known hotkey collisions

| Hotkey | Conflict | Resolution |
|---|---|---|
| `C-a` | Obsidian default: Select all | emacs wins inside the editor and inputs; rebind `editor:select-all` to `Cmd-A` if you want select-all |
| `C-k` | Obsidian default: Insert link | emacs wins; insert-link via the command palette |
| `C-w` | Obsidian default (Linux/Windows): Close active pane | emacs wins inside editor and inputs; `C-x 0` invokes close-pane via emacs |
| `C-y` | Obsidian default: Redo | emacs wins; redo via `C-S-/` (emacs-style) or `Cmd-S-Z` |
| `C-x` | Obsidian default: Cut | emacs wins as a prefix; native cut via `Cmd-X` |

## Known limitations

- **macOS Alt-key dead keys.** `M-x` on US-English layouts produces `≈` if the Electron normalization fails. Most users see this work correctly; exotic input methods may eat the keystroke.
- **No keyboard macro recording.** No Obsidian plugin provides this. `C-x (`, `C-x )`, and `C-x e` are intentionally unbound.
- **No native browser undo for contenteditable yanks.** When yanking text into a contenteditable element (e.g., the inline title editor), `Cmd-Z` will not undo the yank — the modifications bypass the browser's undo stack. Users requiring undo should use the host's own undo (e.g., Obsidian's vault rename history) or rebuild the kill via re-yanking. This is the cost of using non-deprecated `Range.deleteContents` / `Range.insertNode` instead of the deprecated `document.execCommand("insertText", ...)`.
- **Word boundary divergence.** Layer 1 (markdown editor) and Layer 2 ContentEditable use the browser's Unicode-aware word boundaries. Layer 2 input/textarea uses a regex-based `\w` boundary (ASCII only). Non-ASCII identifiers may move slightly differently between layers.
- **Mark state shared across element kinds.** Setting the mark in an input then focusing a contenteditable leaves the mark in an inconsistent state. Press `C-g` to reset.

## Manual test checklist

For each of the following contexts, verify `C-f` / `C-b` / `M-f` / `M-b`, `C-a` / `C-e`, `C-d`, `C-k`, `M-d`, `M-Backspace`, `C-Space` + movement + `C-w` / `M-w`, `C-y`, `C-g`:

- Markdown editor (Layer 1)
- Search bar (left sidebar)
- Quick switcher (`Cmd-O`)
- Command palette (`Cmd-P`)
- File rename dialog
- Inline title editor (above the editor pane)
- Settings text inputs

For multi-chord: `C-x C-s` saves; `C-x C-f` opens find-file; `C-x b` switches buffer; `C-x o` cycles panes; `C-x 5 2` opens new window.

Cross-layer kill-ring smoke test: kill text in the editor with `M-d`, focus into a search bar, press `C-y` — the killed text should appear.

## Attribution

Originally forked from [`Klojer/obsidian-emacs-text-editor`](https://github.com/Klojer/obsidian-emacs-text-editor). Significant additions (in-input bindings, multi-chord prefix maps, shared kill ring, soft-dep integration) by [mlwelles](https://github.com/mlwelles).

## License

GPL-3.0. See [`LICENSE`](LICENSE).
