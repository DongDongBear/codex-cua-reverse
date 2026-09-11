export type Input = {
    /** X coordinate on the desktop screenshot. */
    x: number;
    /** Y coordinate on the desktop screenshot. */
    y: number;
    /** Optional key chord to hold while moving, using the same format as `press_key()`. */
    key?: string;
};
export type Return = Promise<void>;
/** Move the pointer to a desktop coordinate. */
export type Function = (input: Input) => Return;
