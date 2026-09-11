import type { Point } from "../Point";
export type Input = {
    /** At least two desktop coordinates to visit in order during the drag. */
    path: Array<Point>;
    /** Optional key chord to hold during the drag, using the same format as `press_key()`. */
    key?: string;
};
export type Return = Promise<void>;
/** Drag through an ordered path of desktop coordinates. */
export type Function = (input: Input) => Return;
