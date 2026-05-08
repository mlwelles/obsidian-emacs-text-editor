export class RepeatDetector {
	private lastId?: string;

	track(id: string): {isRepeat: boolean} {
		const isRepeat = this.lastId === id;
		this.lastId = id;
		return {isRepeat};
	}

	last(): string | undefined {
		return this.lastId;
	}
}
