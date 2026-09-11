import type { SetupOptions } from "./types";
export type * from "./types";
/** Set up the enabled providers and core docs without collecting inventory. */
export declare function setupCUA(options?: SetupOptions): Promise<void>;
