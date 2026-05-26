import type {EditorPosition} from "obsidian";

export class MarkState {
	private originPos?: EditorPosition;

	set(pos: EditorPosition): void {
		this.originPos = pos;
	}

	clear(): void {
		this.originPos = undefined;
	}

	isActive(): boolean {
		return this.originPos !== undefined;
	}

	origin(): EditorPosition | undefined {
		return this.originPos;
	}
}
