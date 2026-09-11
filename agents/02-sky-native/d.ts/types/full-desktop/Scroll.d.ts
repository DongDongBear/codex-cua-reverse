import type { Direction } from "../Direction";
export type Input = {
    /** Direction to scroll. */
    direction: Direction;
    /** Distance to scroll in pixels. */
    pixels?: number;
    /** Optional X coordinate for the scroll origin. */
    x?: number;
    /** Optional Y coordinate for the scroll origin. */
    y?: number;
    /** Optional key chord to hold during the scroll, using the same format as `press_key()`. */
    key?: string;
};
export type Return = Promise<void>;
/** Scroll the desktop by direction, optionally from a coordinate. */
export type Function = (input: Input) => Return;
