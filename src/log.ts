export interface Logger {
	debug(msg: string): void;
}

export function createLogger(prefix: string, enabled: () => boolean): Logger {
	return {
		debug(msg: string): void {
			if (!enabled()) {
				return;
			}
			console.log(prefix + ": " + msg);
		},
	};
}
