import type { MouseButton } from "../MouseButton";
export type Input = {
    /** X coordinate on the desktop screenshot. */
    x: number;
    /** Y coordinate on the desktop screenshot. */
    y: number;
    /** Mouse button to click. */
    mouse_button?: MouseButton;
    /** Number of clicks to perform. */
    click_count?: number;
    /** Optional key chord to hold during the click, using the same format as `press_key()`. */
    key?: string;
    /** Milliseconds to hold the mouse button down for each click. */
    duration?: number;
};
export type Return = Promise<void>;
/** Click at a desktop coordinate. */
export type Function = (input: Input) => Return;
