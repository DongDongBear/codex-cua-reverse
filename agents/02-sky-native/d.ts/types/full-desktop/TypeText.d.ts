export type Input = {
    /** Text to type into the current focus. */
    text: string;
};
export type Return = Promise<void>;
/** Type text into the current focus on the desktop. */
export type Function = (input: Input) => Return;
