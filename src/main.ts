import {Plugin} from "obsidian";
import {createLogger, Logger} from "./log";
import {
	COMMAND_IDS,
	COMMANDS_THAT_EXTEND_LAST_KILL_BACKWARD,
	COMMANDS_THAT_EXTEND_LAST_KILL_FORWARD,
	type CommandId,
} from "./commands/ids";
import {buildCommands} from "./commands/definitions";
import {registerCommands} from "./commands/register";
import type {PluginContext} from "./commands/plugin-context";
import {KillRing} from "./kill-ring/kill-ring";
import {YankPopSession} from "./kill-ring/yank-pop";
import {MarkState} from "./selection/mark";
import {RepeatDetector} from "./tracking/repeat-detector";
import {cancelYankPop, type KillContext} from "./editor-ops/editing";
import {PluginDetector} from "./soft-deps/plugin-detector";
import {CommandResolver} from "./soft-deps/command-resolver";
import {installInputBindings} from "./input-bindings";

export default class EmacsTextEditorPlugin extends Plugin implements PluginContext {
	// toggle to enable debug logging
	debugEnabled = false;
	readonly logger: Logger = createLogger("emacs-text-editor", () => this.debugEnabled);
	extendLastKill = false;
	extendLastKillBackwards = false;
	readonly killRing = new KillRing(120);
	readonly mark = new MarkState();
	readonly yankPopSession = new YankPopSession();
	private readonly repeats = new RepeatDetector();
	private readonly inputRepeats = new RepeatDetector();
	private detector!: PluginDetector;
	private resolver!: CommandResolver;
	readonly killCtx: KillContext = {
		killRing: this.killRing,
		mark: this.mark,
		yankPopSession: this.yankPopSession,
		logger: this.logger,
		extendLastKill: () => this.extendLastKill,
		extendLastKillBackwards: () => this.extendLastKillBackwards,
	};

	onload() {
		console.log("loading plugin: Emacs text editor");
		this.detector = new PluginDetector(this.app);
		this.resolver = new CommandResolver(this.detector);
		installInputBindings(
			document,
			{
				killRing: this.killRing,
				mark: this.mark,
				repeats: this.inputRepeats,
				logger: this.logger,
			},
			cleanup => this.register(cleanup),
		);
		// Any mousedown anywhere cancels mark-mode and yank-pop session,
		// matching emacs (where keyboardQuit does both) and Obsidian's
		// own selection-cancel behavior. Cheap no-op when neither is active.
		this.registerDomEvent(document, "mousedown", () => {
			cancelYankPop(this.killCtx);
			this.mark.clear();
		});
		registerCommands(this, buildCommands(this));
	}

	onunload() {
		this.detector?.dispose();
		console.log("unloading plugin: Emacs text editor");
	}

	commandInvoked(id: CommandId): void {
		this.logger.debug("command invoked: " + id);
		if (id !== COMMAND_IDS.YANK_POP) {
			cancelYankPop(this.killCtx);
		}
		const {isRepeat} = this.repeats.track(id);
		this.extendLastKill = isRepeat && COMMANDS_THAT_EXTEND_LAST_KILL_FORWARD.has(id);
		this.extendLastKillBackwards = isRepeat && COMMANDS_THAT_EXTEND_LAST_KILL_BACKWARD.has(id);
	}
}
