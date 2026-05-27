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
			// Reset state BEFORE invoking the action so any synchronous
			// keystrokes the action might trigger (it shouldn't, but
			// defensive) see the dispatcher in idle.
			this.state = "idle";
			this.currentBindings = [];
			binding.action();
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
