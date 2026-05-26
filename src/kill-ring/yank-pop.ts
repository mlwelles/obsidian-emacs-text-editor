import type {EditorPosition} from "obsidian";

export interface YankPopRange {
	start: EditorPosition;
	end: EditorPosition;
}

export class YankPopSession {
	private startPos?: EditorPosition;
	private endPos?: EditorPosition;

	start(start: EditorPosition, end: EditorPosition): void {
		this.startPos = start;
		this.endPos = end;
	}

	cancel(): void {
		this.startPos = undefined;
		this.endPos = undefined;
	}

	isActive(): boolean {
		return this.startPos !== undefined && this.endPos !== undefined;
	}

	range(): YankPopRange | undefined {
		if (this.startPos === undefined || this.endPos === undefined) {
			return undefined;
		}
		return {start: this.startPos, end: this.endPos};
	}

	updateEnd(end: EditorPosition): void {
		if (!this.isActive()) {
			return;
		}
		this.endPos = end;
	}
}
