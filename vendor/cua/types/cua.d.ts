import * as browser_client from "@oai/browser";
import { sky } from "@oai/sky";
type BrowserAgentApi = Awaited<ReturnType<typeof browser_client.setupBrowserRuntime>>;
export declare const cua: {
    initialize: typeof initialize;
    computer: null | typeof sky;
    browsers: null | BrowserAgentApi["browsers"];
    documentation: null | BrowserAgentApi["documentation"];
};
declare function initialize(): Promise<{
    errors?: string[] | undefined;
    apps: import("node_modules/@oai/sky/src/types/window/ListApps").App[];
    browsers: {
        tabs: browser_client.GlobalAgentBrowserTab[];
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
export {};
