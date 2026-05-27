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
		resolution:
			"emacs wins; users wanting select-all can rebind editor:select-all to Cmd-A",
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
		resolution:
			"emacs wins inside editor; Layer 3a's C-x 0 binds close-pane to the emacs equivalent",
	},
	{
		hotkey: "Ctrl-Y",
		emacsCommand: "yank",
		obsidianDefault: "Redo",
		resolution:
			"emacs wins; redo available via Ctrl-Shift-/ (emacs-style) or Cmd-Shift-Z (platform default)",
	},
	{
		hotkey: "Alt-X",
		emacsCommand: "M-x (workspace command palette)",
		obsidianDefault: "(none)",
		resolution:
			"no conflict; subject to macOS dead-key on US-English layouts (produces \u2248)",
	},
	{
		hotkey: "Ctrl-X",
		emacsCommand: "(prefix; in-house dispatcher)",
		obsidianDefault: "Cut",
		resolution:
			"emacs wins as a prefix; native Cut available via Cmd-X. Press Ctrl-X then wait > 5s, or press Esc / Ctrl-G to cancel.",
	},
	{
		hotkey: "Ctrl-S",
		emacsCommand: "search (workspace)",
		obsidianDefault: "(none — Cmd-S saves)",
		resolution: "no conflict; saves still via Cmd-S",
	},
	{
		hotkey: "Ctrl-G",
		emacsCommand: "keyboard-quit (editor) / workspace cancel (else)",
		obsidianDefault: "(none)",
		resolution:
			"Layer 1 keyboard-quit fires when editor is focused; Layer 3a workspace C-g fires otherwise (blurs focused element + dispatches Escape)",
	},
	{
		hotkey: "Ctrl-Space",
		emacsCommand: "set-mark",
		obsidianDefault: "(IME composition on some platforms; otherwise none)",
		resolution:
			"emacs wins; IME composition users should rebind set-mark to a different chord via Obsidian's Hotkeys settings",
	},
];
