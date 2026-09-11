# FINDINGS — unused `@oai/browser-desktop` capabilities

**Verdict:** The two captured tasks (`task-1-ant-design-form`, `task-2-linear-issue`) only exercised IAB AX + a Playwright locator subset + `tab.dev.logs` (task 1) and native `cua.getApp` (task 2). Everything listed in this file is **shipped, reversed from local disk, and unused in those traces** (`reversed_unused`). Native hosts advertise optional capabilities in `getInfo().capabilities.{browser,tab}`; the service then filters them. IAB / Chrome-extension / CDP (cloud) support is **not** one global matrix — it is `api.json` `unsupportedByDefaultIn` **plus** `documents.json` `when.browserTypes` **plus** service type checks **plus** whatever the connected host advertises.

Did not live-navigate the user's browsers. Sources: `vendor/browser-desktop/docs/**`, `docs/api.json`, `@oai/browser-desktop` 0.1.1 `scripts/browser-client.mjs` + `browser-service.mjs`, tinysky-alt (`create_tinysky_alt.pretty.js`, `tinysky_alt.types.d.ts`, plugin `browser-description.md`), `traces/*.json`.

---

## How capabilities are discovered

```ts
type BrowserCapabilityCollection = {
  get(id: string): Promise<unknown>;
  list(): Promise<Array<{ id: string; description: string }>>;
};
type TabCapabilityCollection = BrowserCapabilityCollection;
```

- `get(id)` throws `Capability is not available: ${id}` if the connected backend did not advertise it (or env stripped it).
- Browser cap `.documentation()` reads `capabilities/browser/${id}`.
- Tab cap `.documentation()` reads `capabilities/tab/${id}` (WebMCP is the exception: packaged as `docs/webmcp.md`, `documents.json` name `"webmcp"`).
- Env deny-lists (comma-separated ids): `BROWSER_USE_DISABLE_BROWSER_CAPABILITIES`, `BROWSER_USE_DISABLE_TAB_CAPABILITIES`. Empty → no filter.
- First-use dump lists advertised ids under `# Additional Capabilities` with `.documentation()` pointers. Capability markdown itself is `mode: "model"` — **not** stuffed into first-use.
- `requiredFor` commands refuse until that doc name is in `readNames` (`assertRequiredDocumentationRead`). Included first-use docs are pre-marked read. Tinysky passes `excludedDocumentation: ["confirmations"]` so the browser dump omits `confirmations.md`, but `readBrowser` still `readNames.add`s every guidance name, including excluded ones — CDP/WebMCP do **not** then demand a second `agent.documentation.get("confirmations")`.

Registered factories (client = service order):

| Scope | ids |
|---|---|
| `browser.capabilities` | `management`, `visibility`, `viewport` |
| `tab.capabilities` | `cdp`, `botDetection`, `browserAuth`, `pageAssets`, `webmcp` (`internalOnly: true`) |

Commands with **no** dedicated JS `O(...)` handler are forwarded as `executeUnhandledCommand` to the native session (`visibility` / `viewport` / `management`). Dedicated handlers exist for CDP, botDetection, browserAuth, pageAssets, WebMCP.

Support legend used below:

| Tag | Meaning |
|---|---|
| **iab** | ChatGPT in-app browser (`type: "iab"`) |
| **chrome** | Chromium extension backend (`type: "extension"`, family `chrome`/`edge`/…) |
| **cdp** | Cloud / GaaS browser (`type: "cdp"`) |
| yes / no / if advertised / gated | see each row |

---

## Trace usage (both tasks)

Grep of `traces/*.json` `args.code`: **none** of `capabilities.get`, `createBrowserTab`, `nameSession`, `claimTab`, `markDeliverable`, `markHandoff`, `tab.goto` / `back` / `forward` / `reload` / `close`, `tab.content`, `tab.cua`, `tab.dom_cua`, `tab.clipboard`, `getJsDialog`, `browser.history`, `webmcp`, `botDetection`, `browserAuth`, `pageAssets`, `viewport`, `visibility`, `management`.

Task 1 bound an already-open IAB tab (`cua.getBrowser({url})` → `cua.listTabs` → `cua.getTab("1")` + `browser.tabs.get("1")`) and used AX `tab.click` / `typeText` / `getAXState` plus `pt.playwright.locator.(fill|press|evaluate)` and `pt.dev.logs`. Task 2 never touched a browser.

Every section below is **`reversed_unused`** unless noted.

---

## 1. `management` (browser capability)

**Docs:** `docs/capabilities/browser/management.md` (`mode: "model"`).

```ts
const capability = await browser.capabilities.get("management");

type BrowserManagementNamespace = Record<string, (...args: Array<unknown>) => Promise<unknown>>;

interface ManagementBrowserCapability {
  windows: BrowserManagementNamespace;
  tabs: BrowserManagementNamespace;
  tabGroups: BrowserManagementNamespace;
  bookmarks: BrowserManagementNamespace;
  getAuditTrail(): Promise<{
    changes: Array<{
      args: Array<unknown>;
      before: {
        bookmarks?: Array<{ id: string; index?: number; parentId?: string; title: string; url?: string }>;
        tabLayout?: {
          groups: Array<{ collapsed: boolean; color: string; id: number; title?: string; windowId: number }>;
          tabs: Array<{ autoDiscardable: boolean; groupId: number; id: number; index: number; pinned: boolean; url?: string; windowId: number }>;
        };
        windows?: Array<{ focused: boolean; height?: number; id: number; left?: number; state?: string; top?: number; width?: number }>;
      };
      createdAt: number;
      method: string;
      namespace: string;
      result?: number | { id: string };
    }>;
  }>;
}
```

Client: each namespace is a `Proxy` — `management.tabs.query(...)` → RPC `browser_management_call` `{ namespace, method, args, browser_id }`. Audit: `browser_management_get_audit_trail`. Both unhandled at the JS service layer → native `executeUnhandledCommand`.

Chrome-API subset (docs, not a TS enum in `api.json`): organize only. Denied: navigation, history, privileged APIs, shared-group edits, `windows.remove`, URL args on `windows.create`, non-http(s) bookmark URLs. Destructive bookmark deletes need explicit confirmation even if the prompt already authorized deletion.

| Backend | Support |
|---|---|
| iab | **if advertised.** No `unsupportedByDefaultIn`. Host must implement the Chrome-shaped namespaces; IAB may advertise a subset or omit the cap. |
| chrome | **if advertised.** This is the intended surface (windows / tabGroups / bookmarks). |
| cdp | **if advertised.** No type check in JS; cloud host decides. |

**Tinysky:** not wrapped. After `cua.getBrowser` / `createBrowserTab`, the live `Browser` has `.capabilities`. Model must `await browser.capabilities.get("management")`. First-use only lists the id if the host advertised it.

---

## 2. `viewport` (browser capability)

**Docs:** `docs/capabilities/browser/viewport.md`.

```ts
const capability = await browser.capabilities.get("viewport");

interface ViewportSize { height: number; width: number; }
interface ViewportBrowserCapability {
  set(options: ViewportSize): Promise<void>;
  reset(): Promise<void>;
}
```

RPC: `browser_viewport_set` `{ browser_id, width, height }` (positive ints), `browser_viewport_reset` `{ browser_id }`. Unhandled → native. Docs: do **not** set during normal setup; reset temporary overrides unless the user asked to keep them.

| Backend | Support |
|---|---|
| iab | **if advertised** |
| chrome | **if advertised** |
| cdp | **if advertised** |

No `unsupportedByDefaultIn`. No tinysky create-option. Not in plugin `browser-description.md`.

**Tinysky:** only via `browser.capabilities.get("viewport")` on the Agent `Browser` from `cua.getBrowser` / `createBrowserTab`.

---

## 3. `visibility` (browser capability)

**API docs:** `docs/capabilities/browser/visibility.md`. **Guidance:** `docs/visibility.md` (included when this cap is advertised).

```ts
const capability = await browser.capabilities.get("visibility");

interface VisibilityBrowserCapability {
  get(): Promise<boolean>;
  set(visible: boolean): Promise<void>;
}
```

RPC: `browser_visibility_get` → `{ visible }`, `browser_visibility_set` `{ browser_id, visible }`. Unhandled → native. Guidance: keep work in the background; `set(true)` when the user should watch. Localhost does **not** by itself require visibility.

| Backend | Support |
|---|---|
| iab | **if advertised.** Plugin copy treats this as the IAB show/hide control. |
| chrome | **if advertised.** Plugin blurb does not mention `visible` for Chrome/Edge, but the same tinysky option still calls this cap when present. |
| cdp | **if advertised** |

**Tinysky:** first-class create option.

```ts
type CreateBrowserTabOptions = { visible?: boolean; sessionName?: string };
cua.createBrowserTab(browserId, url?, { visible })
// → (await browser.capabilities.get("visibility")).set(visible)  BEFORE tabs.new()
```

Omitted `visible` leaves current visibility. Missing cap throws from `capabilities.get`. Plugin:

```js
let tab = await cua.createBrowserTab("iab", url, { visible: boolean });
```

Traces used `getBrowser` + `getTab` on an already-visible IAB — never `createBrowserTab` / `visibility.set`.

---

## 4. `botDetection` (tab capability)

**Docs:** `docs/capabilities/tab/botDetection.md`. Cloud-browser telemetry. Does **not** unblock the page.

```ts
const capability = await tab.capabilities.get("botDetection");

interface BotDetectionTabCapability {
  report(options: {
    reason: "captcha_failed" | "access_denied" | "challenge_loop" | "unexpected_bot_error";
  }): Promise<{ hostname: null | string; status: "reported" }>;
}
```

RPC `tab_bot_detection_report` `{ browser_id, tab_id, reason }`. Service records `browser_use_bot_detection_reported` with **parsed hostname only** (never full URL). No backend-type check in the handler — any advertised tab can report.

Do **not** use for `ERR_BLOCKED_BY_ADMINISTRATOR`, proxy, DNS/TLS, timeouts.

| Backend | Support |
|---|---|
| iab | **if advertised.** Docs speak of “cloud browser task”; desktop IAB host may omit it. |
| chrome | **if advertised** (same) |
| cdp | **intended.** Cloud/GaaS is the documented caller. |

**Tinysky:** `tab.capabilities.get("botDetection")` on the decorated `Tab` (`BrowserTab & Target`). Not in tinysky core docs. `internalOnly` is **false**.

---

## 5. `browserAuth` (tab capability)

**Docs:** `docs/capabilities/tab/browserAuth.md`. `documents.json` `requiredFor: ["tab_browser_auth_handoff"]`. QR decode uses packaged `zxing_reader.wasm`.

```ts
const capability = await tab.capabilities.get("browserAuth");

type BrowserAuthSelector = string | PlaywrightLocator;

interface BrowserAuthTabCapability {
  request(options: {
    origin: string;                     // scheme+host+port, no path
    fields: Array<{
      id: string;                       // /^[A-Za-z0-9_-]{1,48}$/, not __proto__/constructor/prototype
      label: string;
      type: string;                     // actual HTML input type
      autocomplete?: string | null;
      required: boolean;
      selector: BrowserAuthSelector;
    }>;                                 // max 6; may be [] with options or qr_code
    options?: Array<{                   // min 2 max 10; either selector XOR field_ids
      id: string;
      label: string;                    // completes "Continue with {label}"
      selector?: BrowserAuthSelector;
      field_ids?: string[];             // max 6
    }>;
    qr_code?: true;
    submit?: { selector: BrowserAuthSelector; action: "click" | "press_enter" };
  }): Promise<{
    status:
      | "submitted" | "declined" | "cancelled" | "unavailable" | "expired"
      | "origin_changed" | "page_changed" | "locator_invalid" | "submission_failed";
    locator_error?: { field_id: string; reason: "not_user_visible" };
    selected_option?: string;
    reason?: "user_took_over";
  }>;
}
```

Must have fields **or** options **or** `qr_code`. Locators must belong to this tab. Credentials never return. CAPTCHA is out of scope. `unavailable` / `submission_failed` must not fall back to chat password entry.

| Backend | Support |
|---|---|
| iab | **if advertised.** Handler throws `Jn(clientInfo.name)` if tab caps lack `browserAuth`. |
| chrome | **if advertised** |
| cdp | **if advertised.** Result `declined` + `reason: "user_took_over"` is the cloud manual-takeover path. |

**Tinysky:** not wrapped. Docs tell the model to inspect with `tab.dom_cua.get_visible_dom()` and `tab.playwright` locators, then `browserAuth.request`. Core tinysky docs never mention it. After auth, recovery is `browser.tabs.new()` + `goto(targetOrigin)` — Agent API, not `cua.createBrowserTab`.

---

## 6. `cdp` (tab capability)

**Docs:** `docs/capabilities/tab/cdp.md`. `requiredFor: ["tab_cdp_call", "tab_cdp_events"]` (plus `confirmations`).

```ts
const capability = await tab.capabilities.get("cdp");

type CdpTarget = { sessionId: string; targetId?: never } | { sessionId?: never; targetId: string };

interface CdpTabCapability {
  send(method: string, params?: Record<string, unknown>, options?: {
    target?: CdpTarget;
    timeoutMs?: number;
  }): Promise<unknown>;
  readEvents(options?: {
    afterSequence?: number;
    limit?: number;          // 1..1000
    methods?: string[];      // non-empty if set
    target?: CdpTarget;
    timeoutMs?: number;
  }): Promise<{
    cursor: number;
    events: Array<{
      method: string;
      params?: Record<string, unknown>;
      sequence: number;
      source: { extensionId?: string; sessionId?: string; tabId?: number; targetId?: string };
    }>;
    hasMore: boolean;
    truncated: boolean;
  }>;
}
```

RPC `tab_cdp_call` / `tab_cdp_events`. Client adds **+2000 ms** to event `timeoutMs` for transport. Origin-scoped. Prefer higher-level APIs. If you mutate page/browser state through CDP and leave it, tell the user.

Service gates:

1. `preferences.assertFullCdpEnabled()` — GaaS needs `BROWSER_USE_FULL_CDP_ACCESS_ENABLED`; desktop needs `config.global` full-CDP **true** (not default) and not enterprise-denied (`featureRequirements` / `Om("Full CDP access is disabled in browser config.")`).
2. Backend type `ii(runtime, type)`: **extension and iab always allowed to *attempt***; **`type: "cdp"` only if security mode is `gaas-browser-environment` AND the env flag**. Error if not: `"Full CDP access is currently only available for browser extension and in-app browser tabs."`
3. `$Y` **injects** the `cdp` tab cap into `getInfo` capabilities when (1)+(2) pass and the host omitted it.
4. Paused document-response interception blocks raw CDP.
5. `ensureFullCdpAllowed` / `ensureRawCdpUrlAllowed` per command.

| Backend | Support |
|---|---|
| iab | **gated** (user/config full CDP). Injectable even if host did not advertise. |
| chrome | **gated** (same). |
| cdp | **gated harder.** Injection/call only in GaaS + `BROWSER_USE_FULL_CDP_ACCESS_ENABLED`. Separately, advertising this cap on a `type: "cdp"` browser re-enables `Tab.requestManualHandoff` (see §11). |

**Tinysky:** `tab.capabilities.get("cdp")`. Not in core docs. Must `.documentation()` (or have `capabilities/tab/cdp` included) before first `send` / `readEvents`.

---

## 7. `pageAssets` (tab capability)

**Docs:** `docs/capabilities/tab/pageAssets.md`.

```ts
const capability = await tab.capabilities.get("pageAssets");

interface PageAssetsTabCapability {
  list(): Promise<{
    id: string;
    pageUrl: null | string;
    assets: Array<{
      id: string;
      kind: "script" | "font" | "image" | "stylesheet" | "video" | "other";
      name: string;
      url: string;
      sources: Array<{ kind: "attribute" | "computedStyle" | "resource"; nodeId?: number; property?: string }>;
    }>;
    inlineSvgs: Array<{ id: string; markup: string; name: string }>;
    summary: { byKind: Partial<Record<"script"|"font"|"image"|"stylesheet"|"video"|"other", number>>; inlineSvgCount: number; totalCount: number };
  }>;
  bundle(options: {
    inventoryId: string;
    kinds?: Array<"font" | "image" | "stylesheet" | "video">;  // no script/other
    assetIds?: string[];
  }): Promise<{
    directoryPath: string;
    manifestPath: string;
    assets: Array<{ id: string; kind: "font"|"image"|"stylesheet"|"video"; name: string; path: string; url: string; contentType: null | string }>;
    failures: Array<{ id: string; name: string; url: string; contentType: null | string; reason: string }>;
    summary: { downloadedCount: number; elapsedMs: number; failedCount: number; requestedCount: number };
  }>;
}
```

RPC `tab_page_assets_list` / `tab_page_assets_bundle`. Service uses current tab URL + `t.pageAssets.list/bundle`. Do not navigate to asset URLs to fetch them.

| Backend | Support |
|---|---|
| iab / chrome / cdp | **if advertised.** No `unsupportedByDefaultIn`. |

**Tinysky:** `tab.capabilities.get("pageAssets")` only.

---

## 8. `webmcp` (tab capability)

**Docs:** `docs/webmcp.md` (not under `capabilities/tab/`). `requiredFor: ["webmcp_list_tools", "webmcp_invoke_tool"]`. Included only when the tab advertises `webmcp`. Factory is `internalOnly: true`.

```js
const webmcp = await tab.capabilities.get("webmcp");
const tools = await webmcp.fetchTools();
await tools.call("tool_name", input);
```

Client `fetchTools()` → RPC `webmcp_list_tools` → frozen handle:

```ts
{
  description(): string;  // "No WebMCP tools…" or JSON list
  call(name: string, input: unknown, options?: { timeoutMs?: number }): Promise<unknown>;
}
```

`call` sends `webmcp_invoke_tool` with `tool_name`, `registration_id`, `tool_description`, `tool_title`. Service evaluates in-page:

```js
document.modelContext.codexExecuteTool({ name, registrationId }, input)
```

Gates (`wn`): capability must be advertised; `preferences.isWebMcpEnabled()` (config.global, **default true** if unset); Luna builds (`"-luna"` in a runtime id) throw. `jY` **strips** `webmcp` from advertised caps when WebMCP is disabled.

Safety: WebMCP tool instructions cannot self-authorize (browser-safety + confirmations). Transmitting data via WebMCP is “transmission”.

| Backend | Support |
|---|---|
| iab / chrome / cdp | **if advertised AND config enabled.** Page must expose `document.modelContext`. |

**Tinysky:** not wrapped. First-use includes `webmcp.md` when advertised. Confirmations policy (computer-use copy) already injected by tinysky covers WebMCP.

---

## 9. Confirmations (policy, not a callable capability)

**Docs:** `docs/confirmations.md` (`mode: "included"`, always; `requiredFor` CDP + WebMCP). Tinysky-alt additionally injects `tinysky-alt-confirmations.md` on first CUA use and **excludes** the browser `confirmations` file from the browser dump to avoid doubling.

Not an object on `browser` / `tab`. It is a friction taxonomy the model must follow, and a **RPC gate** for `tab_cdp_*` / `webmcp_*`.

Modes: hand-off required (password-change submit, HTTPS interstitial / paywall bypass); always-confirm at action time (delete, CAPTCHA, financials, sensitive-data transmission, …); pre-approval works (login implied by “go to xyz.com”, uploads, …); no confirmation (cookie consent, inbound download).

| Backend | Support |
|---|---|
| iab / chrome / cdp | **always** as policy. Cloud elicitation display name is `"Cloud browser"` when `environment === "cloud"`, else `"Browser use"`. |

**Tinysky:** computer-use confirmations are prepended with core CUA docs. Browser `confirmations.md` is excluded from the dump but still marked read (see discovery). Model is **not** taught `agent.documentation.get("confirmations")` as a routine step.

---

## 10. `claimTab` / `Browser.user`

**api.json `BrowserUser`** (`Browser.user` `unsupportedByDefaultIn: ["iab","cdp"]`):

```ts
interface BrowserUserTabInfo {
  id: string;
  lastOpened?: string;
  providerTabId?: string;
  tabGroup?: string;
  title?: string;
  url?: string;
}

interface BrowserUser {
  openTabs(): Promise<Array<BrowserUserTabInfo>>;
  claimTab(tab: string | BrowserUserTabInfo): Promise<Tab>;
  getTabContext(tab: string | BrowserUserTabInfo): Promise<BrowserUserTabContext>; // undocumented; unsupported on extension+iab+cdp
}

type BrowserUserTabContext =
  | { kind: "text"; text: string; title: string; truncated: boolean; url: string }
  | { data: Uint8Array; fileName: string; kind: "document"; mimeType: string; title: string; url: string };
```

RPC: `browser_user_open_tabs`, `browser_user_claim_tab`, `browser_user_get_tab_context`. Native: `getUserTabs`, `claimUserTab`. Client `claimTab` accepts a string id **or** `{ id }` from `openTabs()` (docs insist on the exact object for title/url fail-closed). Service `claimTab` records `tabLifecycle.recordAcquired`. Stale extension → `"Please update the ChatGPT extension in ${displayName}…"`.

Docs: `tab-claiming-chrome.md` (included for `browserTypes: ["extension"]`). Claiming does **not** move the tab into an agent tab group. `getTabContext` is dead on this desktop runtime (`unsupportedByDefaultIn` all three types, `documented: false`).

| Backend | Support |
|---|---|
| iab | **no** (`Browser.user` unsupported). Mentions use `tabs.list` / `tabs.get` (`tab-mentions-iab.md`). |
| chrome | **yes.** Required for `@Chrome` tab mentions (`source=extension`). |
| cdp | **no** (`Browser.user` unsupported). |

**Tinysky:**

```ts
cua.getTab(id, { browser? })
```

1. `tabs.list()` match `id` **or** `providerTabId`.
2. Else if `user.openTabs` + `user.claimTab` exist: search user tabs the same way; if already in the agent list, `tabs.get`, else **`user.claimTab(userTab)`**.
3. `listTabs` / `getState` union `openTabs()` **without** claiming (errors → `[]`).

Plugin mention path: `cua.getState()` then `cua.getTab(tabId, { browser: browserId })`. Traces never claimed; task 1 tab `"1"` was already in `tabs.list()`.

---

## 11. `markDeliverable` / `markHandoff` (+ `requestManualHandoff`)

**api.json `Tab`:**

```ts
markDeliverable(): Promise<void>;  // unsupportedByDefaultIn: ["cdp"]
markHandoff(): Promise<void>;      // unsupportedByDefaultIn: ["cdp"]
requestManualHandoff(): Promise<void>; // unsupportedByDefaultIn: ["extension","iab","cdp"]
```

Client: both marks → RPC `mark_tab` `{ tab_id, status: "deliverable" | "handoff" }` → native `markTab`. Latest mark wins, turn-scoped. `requestManualHandoff` → `tab_manual_handoff_request`. Re-enabled on `type: "cdp"` when the tab advertises the **`cdp` capability**.

Cleanup docs:

| File | When | Behavior |
|---|---|---|
| `tab-cleanup-iab.md` | iab + mark members | Agent-created tabs close at turn end unless marked. User-opened IAB tabs stay. |
| `tab-cleanup-chrome.md` | extension + mark members | Agent-created Chrome tabs close unless marked. **Unmarked claimed tabs are released (left open, control dropped).** |

Plugin Stop / Interrupt / SubagentStop hooks fire MCP `turn_ended` on `cua_repl` to run that cleanup. `turn_ended` is **not** in the model-facing `mcp__cua_repl` tool list.

| Backend | Support |
|---|---|
| iab | **yes** (marks). No `requestManualHandoff`. |
| chrome | **yes** (marks). No `requestManualHandoff`. |
| cdp | **marks no** by default. **`requestManualHandoff` yes** when tab cap `cdp` is advertised. |

**Tinysky:** on the decorated `Tab` interface in `tinysky-alt-core-cua-repl.md` / `types.d.ts`:

```ts
interface Tab extends Target {
  goto(url: string): Promise<void>;
  back(): Promise<void>;
  forward(): Promise<void>;
  reload(): Promise<void>;
  close(): Promise<void>;
  markDeliverable(): Promise<void>;
  markHandoff(): Promise<void>;
}
```

`createBrowserTab` / `getTab` do **not** auto-mark. Model must call `tab.markDeliverable()` / `markHandoff()` itself. Unused in traces (task 1 reused a user IAB tab, which cleanup leaves open anyway).

---

## 12. `tab.goto` / `back` / `forward` / `reload` / `close`

**api.json `Tab`:**

```ts
goto(url: string): Promise<void>;
back(): Promise<void>;
forward(): Promise<void>;
reload(): Promise<void>;
close(): Promise<void>;
url(): Promise<undefined | string>;
title(): Promise<undefined | string>;
```

Also on tinysky `Tab` (above). Related `Tabs`:

```ts
tabs.new(): Promise<Tab>;
tabs.get(id: string): Promise<Tab>;
tabs.list(): Promise<TabInfo[]>;
tabs.selected(): Promise<undefined | Tab>;
tabs.content(options: TabsContentOptions): Promise<TabsContentResult[]>; // unsupported iab+extension+cdp — dead here
```

RPC: `navigate_tab_url` (`Page.navigate`, default 10s load wait), `navigate_tab_back` / `_forward` (`Page.getNavigationHistory` + `Page.navigateToHistoryEntry`), `navigate_tab_reload` (`Page.reload`), `close_tab` (`cdp.closeTab`), `create_tab` (`tabs.create` + `recordCreated`). `goto` throws if url or tab id missing. `api-use-behavior.md`: if already on that URL, do **not** `goto` (it reloads).

| Backend | Support |
|---|---|
| iab / chrome / cdp | **yes** for goto/back/forward/reload/close/new. `Tabs.content` **no** on all three. |

**Tinysky:**

- `cua.createBrowserTab(id, url)` → `tabs.new()` then `tab.goto(url)` (adds `https://` if `URL.canParse` fails).
- Decorated `Tab` exposes the five navigation methods directly (`tab.goto` is **not** `tab.playwright` — client Playwright also has undocumented `goBack`/`goForward` that `api.json` does not list).
- Traces never navigated: the IAB was already on `https://ant.design/components/form`.

---

## 13. `ContentAPI` (`tab.content`)

**api.json:**

```ts
interface ContentAPI {
  export(): Promise<string>; // default asset-loader path → file path
  exportGsuite(type: "pdf" | "md" | "xlsx" | "csv" | "docx" | "pptx"): Promise<string>;
  exportYouTubeTranscript(): Promise<string>; // youtube.com / www.youtube.com /watch → UTF-8 .txt path
}
```

RPC: `tab_content_export`, `tab_content_export_gsuite`, `tab_content_export_youtube_transcript`. GSuite: tab URL must be `docs.google.com/{document|presentation|spreadsheets}/d/{id}` (not `/pub`); type must match doc kind (`document`: pdf/md/docx, `spreadsheets`: pdf/xlsx/csv, `presentation`: pdf/pptx). Fetches export URL via in-page `fetch`, writes via `filesystem.writeFile`. YouTube: CDP `evaluateJavascript` of a transcript extractor; fails if not a supported watch URL or transcript missing. In-memory GSuite cap 32 MiB (`Google Workspace export is too large for in-memory tab context`).

| Backend | Support |
|---|---|
| iab / chrome / cdp | **yes** (no `unsupportedByDefaultIn` on `Tab.content`). |

**Tinysky:** live on `tab.content` (BrowserTab). Not in core CUA docs / `other-browser-apis.md`. Unused.

---

## 14. `CUAAPI` (`tab.cua`) — coordinate CUA

**api.json:**

```ts
type ClickOptions = { x: number; y: number; button?: number; keypress?: string[] };
type DoubleClickOptions = { x: number; y: number; keypress?: string[] };
type CuaDownloadMediaOptions = { x: number; y: number; timeoutMs?: number };
type DragOptions = { path: Array<{ x: number; y: number }>; keys?: string[] };
type KeypressOptions = { keys: string[] };
type MoveOptions = { x: number; y: number; keys?: string[] };
type ScrollOptions = { x: number; y: number; scrollX: number; scrollY: number; keypress?: string[] };
type TypeOptions = { text: string };

interface CUAAPI {
  click(options: ClickOptions): Promise<void>;
  double_click(options: DoubleClickOptions): Promise<void>;
  downloadMedia(options: CuaDownloadMediaOptions): Promise<void>; // undocumented; unsupportedByDefaultIn: ["iab"]
  drag(options: DragOptions): Promise<void>;
  keypress(options: KeypressOptions): Promise<void>;
  move(options: MoveOptions): Promise<void>;
  scroll(options: ScrollOptions): Promise<void>;
  type(options: TypeOptions): Promise<void>;
}
```

RPC `cua_click` / `cua_double_click` / `cua_drag` / `cua_keypress` / `cua_move` / `cua_scroll` / `cua_type` / `cua_download_media`. Service `Em` uses CDP `Input.dispatchMouseEvent` + `moveMouse`; **IAB scroll method is `mouseWheel`, extension/cdp is `synthesizeScrollGesture`**. Downloads: IAB throws `"Downloads are not supported by ${name}."` for `cua_download_media` (and `dom_cua_download_media`); Playwright download path/wait is still allowed on IAB.

When tinysky AX is **on**, service sets `apiSupportOverrides["Tab.cua"]=false` and `"Tab.dom_cua"=false` so generated API docs hide them. Live objects may still exist; the model is taught `tab.click` (AX) instead.

AX enablement (`qY`):

| type | default on this production desktop |
|---|---|
| iab | off unless feature flag `codex-browser-use-tinysky` (`enabledByDefault: false`) |
| extension | off in production (`In()==="production"` → `enabledByDefault: false`) unless flag |
| cdp | `BROWSER_USE_ENABLE_TINYSKY_ACCESSIBILITY==="1"` |

Task 1 **did** use AX `tab.click`, so this machine’s IAB had `Tab.ax` enabled — therefore `tab.cua` was the **disabled** surface for that session.

| Backend | Support |
|---|---|
| iab | **yes**, except `downloadMedia` **no**. Hidden in docs when AX on. |
| chrome | **yes** including `downloadMedia`. Hidden when AX on. |
| cdp | **yes** including `downloadMedia`. Hidden when AX on. |

**Tinysky:** does **not** alias `tab.cua.click` onto `tab.click`. `tab.click` is `tab.ax.click`. Coordinate CUA is the Agent fallback when AX is off / undocumented. Unused in traces (they used AX + Playwright).

---

## 15. `DomCUAAPI` (`tab.dom_cua`)

**api.json:**

```ts
type DomClickOptions = { node_id: string };
type DomDownloadMediaOptions = { node_id: string; timeoutMs?: number };
type DomKeypressOptions = { keys: string[] };
type DomScrollOptions = { node_id?: string; x: number; y: number };
type DomTypeOptions = { text: string };

interface DomCUAAPI {
  get_visible_dom(): Promise<unknown>;
  click(options: DomClickOptions): Promise<void>;
  double_click(options: DomClickOptions): Promise<void>;
  downloadMedia(options: DomDownloadMediaOptions): Promise<void>; // undocumented; unsupported iab
  keypress(options: DomKeypressOptions): Promise<void>;
  scroll(options: DomScrollOptions): Promise<void>;
  type(options: DomTypeOptions): Promise<void>;
}
```

RPC `dom_cua_get_visible_dom` / `_click` / `_double_click` / `_keypress` / `_scroll` / `_type` / `_download_media`. `get_visible_dom` returns a filtered DOM with node ids (used heavily in `browserAuth.md`; omits iframe ownership — use `playwright.domSnapshot()` for frames). Same IAB download block and same AX-on hide as `CUAAPI`.

| Backend | Support |
|---|---|
| iab | **yes**, except `downloadMedia` **no**. Hidden when AX on. |
| chrome / cdp | **yes**. Hidden when AX on. |

**Tinysky:** live as `tab.dom_cua`. Not in core CUA docs. `other-browser-apis.md` only mentions Playwright. browserAuth docs (capability markdown) are the main teacher.

---

## 16. Clipboard (`tab.clipboard`) + tinysky `tab.paste`

**api.json `TabClipboardAPI`:**

```ts
type TabClipboardEntry = { mimeType: string; text?: string; base64?: string }; // exactly one of text|base64
type TabClipboardItem = {
  entries: Array<TabClipboardEntry>;
  presentationStyle?: "unspecified" | "inline" | "attachment";
};

interface TabClipboardAPI {
  read(): Promise<Array<TabClipboardItem>>;
  readText(): Promise<string>;
  write(items: Array<TabClipboardItem>): Promise<void>;
  writeText(text: string): Promise<void>;
}
```

RPC `tab_clipboard_read` / `_read_text` / `_write` / `_write_text`. Service installs a per-tab CDP bridge (`__browserUseClipboardBridge`) via `clipboard.ensurePageClipboard(cdp, {tabId})`, then `runExclusive`. Cleanup on tab detach / turn detach.

| Backend | Support |
|---|---|
| iab / chrome / cdp | **yes** |

**Tinysky:** `tab.paste(text, { format?: "text"|"md"|"html" })` is **not** native paste:

1. `text` → `clipboard.writeText` if present, else `ax.typeText`.
2. `html` / `md` → `clipboard.write([{ entries: [{ mimeType, text }] }])` (`html` writes both `text/html` and `text/plain`; `md` is plain text — docs: Markdown source inserted as plain text).
3. Then `ax.pressKey("Ctrl+v")`.
4. Unlike native `app.paste`, browser paste **does not restore** the user’s clipboard.

Traces used `app.paste` on Linear only. Browser clipboard unused.

---

## 17. Dialogs (`tab.getJsDialog`)

**api.json:**

```ts
type Dialog = AlertDialog | BeforeUnloadDialog | ConfirmDialog | PromptDialog;

getJsDialog(): Promise<undefined | Dialog>;

interface AlertDialog        { type: "alert";        dismiss(): Promise<void>; }
interface BeforeUnloadDialog { type: "beforeunload"; dismiss(): Promise<void>; }
interface ConfirmDialog      { type: "confirm";      accept(): Promise<void>; dismiss(): Promise<void>; }
interface PromptDialog       { type: "prompt";       accept(text: string): Promise<void>; dismiss(): Promise<void>; }
```

RPC `tab_get_js_dialog` → `{ dialog: { id, type } | null }`; actions `tab_handle_js_dialog` `{ action: "accept"|"dismiss", dialog_id, prompt_text? }`. Service reads `t.cdp.getJsDialog` / `activeJsDialog`. `accept` on `alert` or `beforeunload` throws `Dialog type ${type} does not support accept`. Timeout constant 60s on handle.

| Backend | Support |
|---|---|
| iab / chrome / cdp | **yes** |

**Tinysky:** live `tab.getJsDialog()`. Not in core docs. Unused.

---

## 18. `browser.history` (`nameSession` is §19)

**api.json `Browser.history`** (`unsupportedByDefaultIn: ["iab","cdp"]`):

```ts
interface BrowserHistoryOptions {
  from?: string | Date;
  to?: string | Date;
  limit?: number;          // positive int
  queries?: string[];      // non-empty if set
}
interface BrowserHistoryEntry {
  dateVisited: string;     // ISO 8601
  title?: string;
  url: string;
}

history(options: BrowserHistoryOptions): Promise<Array<BrowserHistoryEntry>>;
```

RPC `browser_user_history` → native `getUserHistory`. `api-use-behavior.md`: confirmation-gated; one focused call with date bounds + small `queries`; never speculative.

`ensureCommandAllowed`: if command is history, load `getHistoryPermission` (enterprise `allowHistoryAccess` / `allow_history_access`, else persisted always-ask/never-ask). Deny throws policy error; otherwise **elicitation** (`KA(createElicitation, …)`) before the read. Local-testing security mode skips live policy and uses persisted permission only.

| Backend | Support |
|---|---|
| iab | **no** |
| chrome | **yes**, confirmation-gated |
| cdp | **no** |

**Tinysky:** `browser.history(...)` on the Agent `Browser`. Not in core CUA docs. Unused.

---

## 19. `nameSession`

**api.json `Browser`:**

```ts
nameSession(name: string): Promise<void>;
```

Client trims; empty throws `browser.nameSession requires a name`. RPC `name_session` → native `nameSession({ name })`. Docs `session-naming.md` included only for `browserTypes: ["extension"]` + member present: at the start of every Chrome task, name immediately after setup, short emoji-prefixed label (default 🔎).

| Backend | Support |
|---|---|
| iab | **method exists on the JS object.** Session-naming guidance is **not** included. Native may no-op; tinysky still calls it if `sessionName` is passed (does **not** check cap, only `typeof nameSession === "function"` — always true on the client class). |
| chrome | **yes**, user-visible as the agent tab-group / session name. |
| cdp | **method exists**; guidance filter is extension-only. |

**Tinysky:**

```js
await cua.createBrowserTab(browserName, url, { sessionName: "🔎 Task" });
// first: browser.nameSession(sessionName); throw if nameSession missing
```

Plugin: Chrome/Edge should pass emoji-prefixed `sessionName`. IAB plugin copy does not. Traces never created a Chrome session.

---

## Tinysky exposure map (unused surfaces)

`setupCUA({ browser: true })` installs global `cua` and `Reflect.set(globalThis, "agent", runtime)`. After `getBrowser`, the model may use the full Agent `Browser`/`Tab` (playwright, capabilities, clipboard, …). Core markdown only **teaches** Target AX + the navigation/mark methods on `Tab`.

| Capability | Tinysky entry | Taught in core CUA docs? |
|---|---|---|
| visibility | `createBrowserTab(..., { visible })` | yes (option only) |
| nameSession | `createBrowserTab(..., { sessionName })` | yes (option only) |
| goto | `createBrowserTab(id, url)` and `tab.goto` | yes |
| back/forward/reload/close | `tab.*` | yes |
| markDeliverable/Handoff | `tab.markDeliverable` / `markHandoff` | yes |
| claimTab | `cua.getTab` auto-claim | getTab comment only; no `user.claimTab` in core types |
| management / viewport / botDetection / browserAuth / cdp / pageAssets / webmcp | `browser|tab.capabilities.get(id)` | **no** (Additional Capabilities pointer) |
| confirmations | injected computer-use copy; browser file excluded | yes (tinysky copy) |
| ContentAPI | `tab.content.*` | no |
| CUAAPI | `tab.cua.*` | no (AX `tab.click` instead) |
| DomCUAAPI | `tab.dom_cua.*` | no |
| clipboard | `tab.clipboard.*` and `tab.paste` | paste yes; clipboard API no |
| dialogs | `tab.getJsDialog` | no |
| history | `browser.history` | no |

`tinysky-alt-other-browser-apis.md` (always injected on first browser use) only justifies **Playwright** as an AX-batching fallback. That is the only extra browser API the two traces used (`pt.playwright.locator`).

---

## RPC cheat sheet (unused commands)

| RPC | Client | Native / notes |
|---|---|---|
| `browser_management_call` / `_get_audit_trail` | `management.*` / `getAuditTrail` | `executeUnhandledCommand` |
| `browser_visibility_get` / `_set` | `visibility.get/set` | unhandled |
| `browser_viewport_set` / `_reset` | `viewport.set/reset` | unhandled |
| `tab_bot_detection_report` | `botDetection.report` | telemetry only |
| `tab_cdp_call` / `tab_cdp_events` | `cdp.send` / `readEvents` | dedicated; full-CDP gated |
| `tab_browser_auth_handoff` | `browserAuth.request` | dedicated; requiredFor doc |
| `tab_page_assets_list` / `_bundle` | `pageAssets.list/bundle` | dedicated |
| `webmcp_list_tools` / `webmcp_invoke_tool` | `fetchTools` / `tools.call` | `document.modelContext.codexExecuteTool` |
| `browser_user_claim_tab` / `_open_tabs` | `user.claimTab` / `openTabs` | `claimUserTab` / `getUserTabs` |
| `browser_user_history` | `browser.history` | `getUserHistory` + elicitation |
| `name_session` | `browser.nameSession` | `nameSession` |
| `mark_tab` | `markDeliverable` / `markHandoff` | `markTab` |
| `tab_manual_handoff_request` | `requestManualHandoff` | cdp + cap only |
| `navigate_tab_url/_back/_forward/_reload` | `goto/back/forward/reload` | CDP Page.* |
| `close_tab` / `create_tab` | `close` / `tabs.new` | `closeTab` / `createTab` |
| `tab_content_export*` | `content.*` | filesystem paths |
| `cua_*` / `dom_cua_*` | `tab.cua` / `tab.dom_cua` | Input.* / visible DOM |
| `tab_clipboard_*` | `tab.clipboard` | CDP clipboard bridge |
| `tab_get_js_dialog` / `tab_handle_js_dialog` | `getJsDialog` | CDP JS dialog |

---

## What this does not claim

- Live `getInfo().capabilities` for this Mac’s IAB / Chrome extension (would require attaching to the user’s browsers).
- Exact Chrome Management allowlist of method names (native `executeUnhandledCommand`; JS only proxies `windows|tabs|tabGroups|bookmarks` + docs restrictions).
- Whether IAB `nameSession` is a no-op in ChatGPT UI (JS always sends the RPC).
- Viewport: CSS vs OS window vs CDP `Emulation.setDeviceMetricsOverride` (native unhandled).
