import type { setupBrowserRuntime } from "@oai/browser";
import type { sky } from "@oai/sky";
type BrowserProvider = Awaited<ReturnType<typeof setupBrowserRuntime>>["browsers"];
type Browser = Awaited<ReturnType<BrowserProvider["get"]>>;
export declare function get_state({ browsers: browser_provider, computer, }: {
    browsers?: BrowserProvider;
    computer?: typeof sky;
}): Promise<{
    errors?: string[] | undefined;
    apps: import("node_modules/@oai/sky/src/types/window/ListApps").App[];
    browsers: {
        tabs: import("@oai/browser").GlobalAgentBrowserTab[];
        id: string;
        name?: string;
        family?: string;
        type?: "iab" | "extension" | "cdp";
        profileName?: string;
        metadata?: {
            extensionInstanceId?: string;
            codexSessionId?: string;
        };
    }[];
}>;
export declare function get_browser_tabs(browser: Browser): Promise<import("@oai/browser").GlobalAgentBrowserTab[]>;
export {};
