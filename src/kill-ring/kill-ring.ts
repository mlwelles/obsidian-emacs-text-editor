export interface SaveOptions {
	extendForward?: boolean;
	extendBackward?: boolean;
}

export class KillRing {
	private ring: (string | undefined)[];
	private headIndex = -1;
	private rotationIndex = -1;
	private endIndex = -1;

	constructor(private readonly maxSize: number = 120) {
		this.ring = new Array<string | undefined>(maxSize);
	}

	save(text: string, opts: SaveOptions = {}): void {
		if ((opts.extendForward || opts.extendBackward) && this.headIndex >= 0) {
			const existing = this.ring[this.headIndex] ?? "";
			this.ring[this.headIndex] = opts.extendBackward ? text + existing : existing + text;
			this.rotationIndex = this.headIndex;
			return;
		}
		this.headIndex++;
		if (this.headIndex >= this.maxSize) {
			this.headIndex = 0;
		}
		if (this.headIndex > this.endIndex) {
			this.endIndex = this.headIndex;
		}
		this.ring[this.headIndex] = text;
		this.rotationIndex = this.headIndex;
	}

	current(): string | undefined {
		if (this.headIndex < 0) {
			return undefined;
		}
		return this.ring[this.headIndex];
	}

	rotate(): string | undefined {
		if (this.endIndex < 0) {
			return undefined;
		}
		this.rotationIndex--;
		if (this.rotationIndex < 0) {
			this.rotationIndex = this.endIndex;
		}
		return this.ring[this.rotationIndex];
	}

	size(): number {
		return this.endIndex + 1;
	}
}
