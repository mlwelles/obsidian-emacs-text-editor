import type {KillRing} from "../kill-ring/kill-ring";
import type {YankPopSession} from "../kill-ring/yank-pop";
import type {MarkState} from "../selection/mark";
import type {Logger} from "../log";
import type {KillContext} from "../editor-ops/editing";
import type {CommandId} from "./ids";

// PluginContext is the shape that buildCommands depends on. Defined here
// (not in main.ts) so src/commands/definitions.ts can import it without
// pulling in EmacsTextEditorPlugin and creating an import cycle.
//
// EmacsTextEditorPlugin implements PluginContext.
export interface PluginContext {
	readonly killRing: KillRing;
	readonly yankPopSession: YankPopSession;
	readonly mark: MarkState;
	readonly logger: Logger;
	readonly killCtx: KillContext;
	commandInvoked(id: CommandId): void;
	extendLastKill: boolean;
	extendLastKillBackwards: boolean;
}
