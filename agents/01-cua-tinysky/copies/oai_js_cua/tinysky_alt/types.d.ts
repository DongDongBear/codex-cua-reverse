import type { AXDirection, AXMouseButton, AXPoint, AXSelectionType, BrowserTab, GlobalAgentApi } from "@oai/browser";
import type { sky } from "@oai/sky";
export type { BrowserTab } from "@oai/browser";
export interface SetupOptions {
    browser?: boolean;
    computer?: boolean;
}
export type Browsers = GlobalAgentApi<Tab>["browsers"];
export type Browser = Awaited<ReturnType<Browsers["get"]>>;
export type BrowserInfo = Awaited<ReturnType<Browsers["list"]>>[number];
export type TabInfo = Awaited<ReturnType<Browser["tabs"]["list"]>>[number] & {
    browserId: string;
};
export type Computer = typeof sky;
export type MacComputer = Extract<Computer, {
    target: "mac";
}>;
export type Point = AXPoint;
export type Direction = AXDirection;
export type MouseButton = AXMouseButton;
export type SelectionType = AXSelectionType;
export interface ObservationOptions {
    /** Display the observation to the model. Defaults to true. */
    emit?: boolean;
}
export interface StateOptions extends ObservationOptions {
    disableDiffing?: boolean;
}
export interface ClickOptions {
    mouseButton?: MouseButton;
    clickCount?: number;
}
export interface SelectTextOptions {
    prefix?: string;
    suffix?: string;
    selectionType?: SelectionType;
}
export interface PasteOptions {
    format?: "text" | "md" | "html";
}
export interface BrowserOptions {
    browser?: string;
}
export interface GetBrowserOptions {
    id?: string;
    url?: string;
}
export interface CreateBrowserTabOptions {
    visible?: boolean;
    sessionName?: string;
}
export interface StateAndScreenshot {
    state: string;
    screenshot?: Uint8Array;
}
/** The shared interaction surface of an explicitly bound app or tab. */
export interface Target {
    /** Display and return the current accessibility state. */
    getAXState(options?: StateOptions): Promise<string>;
    /** Display and return the screenshot. */
    getScreenshot(options?: ObservationOptions): Promise<Uint8Array>;
    /** Display and return accessibility state and its screenshot, when available. */
    getAXStateAndScreenshot(options?: StateOptions): Promise<StateAndScreenshot>;
    paste(text: string, options?: PasteOptions): Promise<void>;
    click(target: number | Point, options?: ClickOptions): Promise<void>;
    drag(from: Point, to: Point): Promise<void>;
    pressKey(key: string): Promise<void>;
    scroll(target: number | Point, direction: Direction, pages?: number): Promise<void>;
    selectText(elementIndex: number, text: string, options?: SelectTextOptions): Promise<void>;
    setValue(elementIndex: number, value: string): Promise<void>;
    typeText(text: string): Promise<void>;
    performSecondaryAction(elementIndex: number, action: string): Promise<void>;
}
export interface App extends Target {
}
/** The original browser tab, augmented with the shared interaction surface. */
export type Tab = BrowserTab & Target;
export interface AppInfo {
    id: string;
    displayName?: string;
    isRunning?: boolean;
    lastUsedDate?: string;
    useCount?: number;
}
export interface State {
    apps: AppInfo[];
    browsers: Array<BrowserInfo & {
        tabs: Awaited<ReturnType<Browser["tabs"]["list"]>>;
    }>;
    /** Inventory failures; the other inventory remains usable. */
    errors?: string[];
}
/** Only enabled providers and their methods are installed. */
export interface TinySkyAlt {
    /** Set up the runtime and collect and display fresh app and browser/tab inventory. */
    initialize(): Promise<State>;
    /** Collect and display fresh app and browser/tab inventory. */
    getState?(options?: ObservationOptions): Promise<State>;
    browsers?: Browsers;
    computer?: Computer;
    /** Select a browser and display its documentation without opening a tab. */
    getBrowser?(options?: GetBrowserOptions): Promise<Browser>;
    /** Apply browser settings, create a tab, and display its initial full accessibility state. */
    createBrowserTab?(browserId: string, url?: string, options?: CreateBrowserTabOptions): Promise<Tab>;
    /** Bind by tab id or providerTabId, claiming user tabs, and display full accessibility state. */
    getTab?(id: string, options?: BrowserOptions): Promise<Tab>;
    listBrowsers?(options?: ObservationOptions): Promise<BrowserInfo[]>;
    /** List user and controlled tabs without claiming them; optionally scope to one browser. */
    listTabs?(options?: BrowserOptions & ObservationOptions): Promise<TabInfo[]>;
    /** Bind a native app and display its initial full accessibility state. */
    getApp?(target: string): Promise<App>;
    listApps?(options?: ObservationOptions): Promise<AppInfo[]>;
}
