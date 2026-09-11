# FINDINGS — `@oai/browser-desktop` (IAB / Chrome extension / CDP / Playwright)

**Verdict:** ChatGPT.app Computer Use talks to browsers through two stacked APIs. The model-facing entry points are tinysky-alt `cua.getBrowser` / `cua.createBrowserTab` / `cua.getTab` (plus `tab.click` / `tab.playwright`). Those wrap `@oai/browser-desktop`, whose real surface is `agent.browsers` + `Tab.playwright` + optional capabilities, served over Node REPL RPC (`setup`/`execute`) by `@oai/browser-desktop/service`. Browser ids `"iab"` / `"chrome"` / `"edge"` are **aliases** for type/family, not necessarily the opaque `browserId` returned after selection. Playwright is an injected, read-only-evaluate subset of Playwright, not a Playwright process. Tab claiming exists only on extension backends. Visibility and `sessionName` are create-time options that map onto `capabilities.visibility` and `browser.nameSession`. The model tool namespace in traces is `mcp__cua_repl` with nested `js` / `js_reset`.

---

## 1. Package identity

`/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/browser-desktop/package.json`:

```json
{
  "name": "@oai/browser-desktop",
  "version": "0.1.1",
  "description": "Production browser runtime for Codex Desktop.",
  "type": "module",
  "exports": {
    ".": "./scripts/browser-client.mjs",
    "./service": "./scripts/browser-service.mjs"
  },
  "dependencies": {
    "classic-level": "3.0.0"
  }
}
```

There is **no `.d.ts` in this package**. The API contract is `docs/api.json` (58K, `root: "Agent"`). Bundles:

| File | Size | Role |
|---|---|---|
| `scripts/browser-client.mjs` | 147K | `export { setupBrowserRuntime }`. Client proxy objects. |
| `scripts/browser-service.mjs` | 1.2M | `export { handleRpc }`. Trusted service: `setup` + `execute`. |
| `scripts/browser-accessibility.wasm.br` | 3.9M | AX helper. |
| `scripts/zxing_reader.wasm` | 1.0M | QR decode for `browserAuth`. |

`@oai/cua` 0.2.4 vendors a near-copy at `dist/lib/js/oai_js_browser/dist/skill/scripts/`. `browser-client.mjs` is byte-identical. `browser-service.mjs` differs (~31KB, minifier names + extra desktop docs/shim). **Production wiring uses the desktop package as the trusted service**, and tinysky currently *imports the vendored client*:

- Plugin launch sets `NODE_REPL_TRUSTED_SERVICES = { browser: "@oai/browser-desktop/service", sky: "@oai/sky/service" }`.
- `create_tinysky_alt.js` does `import(".../oai_js_browser/dist/skill/scripts/browser-client.js").then(({setupBrowserRuntime}) => e({ decorateTab, undocumentedApiMembers:["Tab.ax"], excludedDocumentation: ... }))`.
- Client `setupBrowserRuntime` requires `globalThis.nodeRepl.rpc` and calls `rpc("browser", { method: "setup"|"execute", params })`.

Default environment string: `"codex-app"`.

---

## 2. Two APIs the model actually uses

### A. Tinysky-alt `cua.*` (what the `js` tool description teaches)

From `tinysky_alt/types.d.ts` and `tinysky-alt-core-cua-repl.md`:

```ts
type GetBrowserOptions = { id?: string; url?: string };
type CreateBrowserTabOptions = { visible?: boolean; sessionName?: string };
type BrowserOptions = { browser?: string };

declare const cua: {
  getBrowser(options?: GetBrowserOptions): Promise<Browser>;
  createBrowserTab(browserId: string, url?: string, options?: CreateBrowserTabOptions): Promise<Tab>;
  getTab(id: string, options?: BrowserOptions): Promise<Tab>;
  listBrowsers(options?: ObservationOptions): Promise<BrowserInfo[]>;
  listTabs(options?: BrowserOptions & ObservationOptions): Promise<TabInfo[]>;
};
```

`Tab` is `BrowserTab & Target`. `Target` is the shared AX action surface (`getAXState`, `click`, `typeText`, …). Tinysky **decorates** the low-level tab so `tab.click(325)` is `tab.ax.click(325)`, and hides `Tab.ax` from generated docs (`undocumentedApiMembers: ["Tab.ax"]`).

`setupCUA` also does `Reflect.set(globalThis, "agent", f)` where `f` is the Agent object from `setupBrowserRuntime`. After first-use docs, the model can call `browser.tabs.get`, `tab.playwright`, `browser.user.claimTab`, etc.

### B. Agent API (`docs/api.json`) — what `browser.documentation()` dumps

Root interface `Agent`: `browsers: Browsers`, `documentation: Documentation`.

`Browsers.list()`:

```ts
list(): Promise<Array<{
  family?: string;
  id: string;
  metadata?: { codexSessionId?: string; extensionInstanceId?: string };
  name: string;
  profileName?: string;
  type: "iab" | "extension" | "cdp"
}>>;
```

`getDefault()` and `getForUrl()` exist but `documented: false`. Tinysky still calls them internally.

`Browser.user` is `unsupportedByDefaultIn: ["iab", "cdp"]` — claiming is an extension feature.

---

## 3. `getBrowser` vs `createBrowserTab` vs `getTab`

Implementation is `create_tinysky_alt.js` (quoted below, de-minified). Comments in types.d.ts:

```ts
/** Select a browser and display its documentation without opening a tab. */
getBrowser?(options?: GetBrowserOptions): Promise<Browser>;
/** Apply browser settings, create a tab, and display its initial full accessibility state. */
createBrowserTab?(browserId: string, url?: string, options?: CreateBrowserTabOptions): Promise<Tab>;
/** Bind by tab id or providerTabId, claiming user tabs, and display full accessibility state. */
getTab?(id: string, options?: BrowserOptions): Promise<Tab>;
```

### `cua.getBrowser({ id?, url? })`

1. Does **not** open a tab. Plugin copy: “Selecting a browser does not open a tab.”
2. Resolver `g({ browser: options.id }, url)`:
   - if `id` given → `browsers.get(id)` (**id wins** over url; node-repl docs: “`id` taking precedence over `url`”).
   - else if url given and `getForUrl` exists → `browsers.getForUrl(url)` (bare hostnames get `https://` prefixed via `URL.canParse`).
   - else `getDefault()`, else first of `list()`.
3. Awaits `browser.documentation()` (first-use, cached per `browserId`).
4. Emits docs under `cua.core` / `cua.browser`; does **not** emit AX state. Docs: “`cua.getBrowser()` automatically displays its first-use documentation; do not write the returned browser object or reread its documentation.”

Plugin `browser-description.md` says to call `getBrowser({ url })` **only when the user has not named a browser**. Named `@Browser` / `@Chrome` / `@Edge` should go straight to `createBrowserTab`.

`getForUrl` ranking in the service (`dM` / `ZY`):

- `file:` or localhost/`127.0.0.1`/`::1` → prefer **iab**.
- Else score open tabs: exact URL → origin+pathname → hostname → hostname hierarchy.
- Tie-break: iab, then preferred extension instance, then any extension, then first.

`getDefault` (`cM`): iab → preferred extension → any extension → first.

### `cua.createBrowserTab(browserId, url?, { visible?, sessionName? })`

Throws if `browserId` is missing: `"createBrowserTab requires a browser ID. Select one with cua.getBrowser()."`

Then:

1. `g({ browser: browserId })` — same alias resolution as `get`.
2. If `sessionName` set: `browser.nameSession(sessionName)`, else throw `Browser ${id} does not support sessionName`.
3. If `visible` set: `(await browser.capabilities.get("visibility")).set(visible)`.
4. `tab = await browser.tabs.new()`; if url, `tab.goto(url)` (again `https://` prefix if needed).
5. `tab.getAXState({ disableDiffing: true, emit: false })` then emit that full tree.

Plugin text:

```javascript
let tab = await cua.createBrowserTab("iab", url, { visible: boolean });
let tab = await cua.createBrowserTab(browserName, url, browserOptions);
```

“Known URL and other named browser: pass its name directly; do not call `getBrowser` first.”

### `cua.getTab(id, { browser? })`

1. Requires a tab id (`getTab requires a tab id`).
2. Resolves browser via `g({ browser })` (default browser if omitted).
3. `tabs.list()` match on `id` **or** `providerTabId`.
4. If not found **and** `browser.user.openTabs` + `claimTab` exist (extension): search user tabs the same way; if already in agent list, `tabs.get`, else **`user.claimTab`**.
5. Else throw `Tab not found: ${id} in browser ${browserId}`.
6. Emit full AX state.

Plugin tab-mention path: `cua.getState()`, match `providerTabId`/`title`/`url` to the mention, then `cua.getTab(tabId, { browser: browserId })`.

`listTabs` unions `browser.tabs.list()` with `browser.user.openTabs()` (errors on openTabs become `[]`) and stamps `browserId` on each row. **Listing does not claim.**

Live trace (`traces/task-1-ant-design-form.json`) used the “wrong” combo and still worked: `getBrowser({ url })` then `getTab("1")` instead of `createBrowserTab("iab", url, { visible })`. That selects a browser that already had the page, it does not navigate.

---

## 4. IDs: `iab` / `chrome` / `edge` (and friends)

Three **types** in the API: `"iab" | "extension" | "cdp"`.

Service matcher `ux({ browserId, clientInfo, requestedBrowserId })`:

```js
return Eh(r) ? Th(t.type) === r
     : bh(r) ? t.type === "extension" && (t.family ?? "chrome") === r
     : e === r;
```

- `Eh(r)`: requested is `"extension" | "iab" | "cdp"` → match by **type**.
- `bh(r)`: requested is a family key in the Chromium catalog → match extension whose `family ?? "chrome"` equals it.
- else exact `id` match (opaque instance id).

Family catalog keys seen in the service: **`chrome`, `edge`, `brave`, `opera`, `vivaldi`**. Model-facing plugin text only advertises:

- `"iab"` — in-app / `@Browser`
- `"chrome"` — `@Chrome`
- `"edge"` — `@Edge`

Telemetry map `GU = { cdp: "cdp", extension: "chrome", iab: "iab" }` (extension type reported as chrome).

**Do not confuse these aliases with mention `browserId` query params:**

| Mention | URL shape | How to resolve |
|---|---|---|
| IAB tab | `plugin://browser@openai-bundled?mention=tab-v1&browserId=...&tabId=...` **without** `source=extension` | `list()` type `iab` whose `metadata.codexSessionId === browserId`, then `tabs.list()` match `providerTabId`+title+url, then `tabs.get(id)` |
| Chrome tab | `plugin://browser@openai-bundled?mention=tab-v1&source=extension&browserId=...&tabId=...` or `plugin://chrome@openai-bundled?...` / `chrome-internal` / `chrome-dev` | `list()` type `extension` whose `metadata.extensionInstanceId === browserId`, then `user.openTabs()` exact object, then `user.claimTab(tab)` |

Fail closed if title/url snapshot drifted (tab-id reuse after restart).

`cdp` type is a third backend (`gaas-browser-environment` / cloud). `Tab.requestManualHandoff` is unsupported on iab/extension/cdp **by default**, re-enabled on cdp when the tab advertises the `cdp` capability.

---

## 5. `tab.playwright`

Not stock Playwright. Client class (`Ke`) RPCs `playwright_*` commands into the service, which injects `browser-use-playwright` / `__codexPlaywrightInjected` into the tab via CDP.

`api.json` `PlaywrightAPI`:

- Query: `locator`, `frameLocator`, `getByRole/Text/Label/Placeholder/TestId`
- Wait: `waitForEvent("download"|"filechooser")`, `waitForLoadState`, `waitForTimeout`, `waitForURL`, `expectNavigation`
- Inspect: `domSnapshot()`, `evaluate` (**“Evaluate JavaScript in a read-only page scope.”**), undocumented `elementInfo` / `elementScreenshot`
- Locator actions: click, dblclick, fill, type, press, pressSequentially, check/uncheck/setChecked, selectOption, waitFor, filter/and/or/nth/first/last, evaluate/evaluateAll, downloadMedia, text getters, isVisible/isEnabled, getAttribute

Service hard limits:

- `playwright.evaluate` DOM is **read-only** (`… is not available in playwright.evaluate because the DOM is read-only`).
- `waitForLoadState` **rejects `networkidle`**.
- `waitForEvent` only `'download'` and `'filechooser'`.
- Uploads: `waitForEvent("filechooser")` then `chooser.setFiles([absolutePath])`. There is **no** `locator.setInputFiles`.
- Chrome/Edge file-URL access must be enabled or upload fails with a canned chrome://extensions / edge://extensions message.

`tinysky-alt-other-browser-apis.md` (the only extra browser doc tinysky always injects on first browser use):

> Playwright locators are more verbose … ensure there are opportunities to reduce several calls to `getAXState()` to justify the more verbose code.
> Use Playwright for long/repetitive tasks where indices are unstable, or sites you are developing.

The Agent-side twin is `docs/accessibility.md` (uses `tab.ax.write()`). Tinysky hides `ax` and teaches `tab.getAXState()` / `tab.click()` instead. Both say: AX first, Playwright as a batching fallback.

Client Playwright object also has `goBack`/`goForward` that are **not** in `PlaywrightAPI` in api.json (navigation is `tab.back()` / `tab.forward()`).

Trace used both: `tab.click(325)` (AX) and `pt.playwright.locator('[id="validateOnly_name"]').fill(...)`.

---

## 6. Claiming tabs

Extension-only. `Browser.user` unsupported on iab/cdp.

`docs/tab-claiming-chrome.md`:

- Decode mention, `browsers.list()`, match `metadata.extensionInstanceId`.
- `openTabs()`, find exact `{ providerTabId, title, url }`, pass **that object** to `claimTab`.
- “Claiming gives the current browser session control of the chosen external browser tab without moving it into an agent tab group, and returns a normal controllable `Tab`.”
- “Do not guess tab ids. Only claim ids that came from the current `openTabs()` result.”

Client `claimTab` accepts `string | { id: string }` and sends `browser_user_claim_tab`. Service `claimUserTab` is a native-host `sendSessionRequest`.

IAB: no claim. `docs/tab-mentions-iab.md`: all IAB tabs are already `tabs.list()` / `tabs.get`. Reuse instead of duplicating.

Tinysky `getTab` auto-claims if the id is only in `openTabs()`. `listTabs` does not.

Cleanup (`tab-cleanup-chrome.md`): unmarked **claimed** user tabs are **released** (left open, session control dropped). Agent-created Chrome tabs close at turn end unless `markDeliverable` / `markHandoff`. IAB: agent-created tabs temporary; user-opened tabs stay.

---

## 7. Visibility

Two docs:

**Guidance** `docs/visibility.md` (included when capability `visibility` is advertised):

> Keep browser work in the background by default.
> Show the browser when the user's request is primarily to put a page in front of them …
> When the browser should be visible, call `await (await browser.capabilities.get("visibility")).set(true)`.

**API** `docs/capabilities/browser/visibility.md`:

```ts
const capability = await browser.capabilities.get("visibility");
interface VisibilityBrowserCapability {
  get(): Promise<boolean>;
  set(visible: boolean): Promise<void>;
}
```

Tinysky `createBrowserTab(..., { visible })` is exactly that `set(visible)` **before** `tabs.new()`.

Plugin: IAB uses `{ visible: true|false }` in `createBrowserTab`. Chrome/Edge docs do not mention `visible` in the plugin blurb (they mention `sessionName` instead), but the same option still hits the capability if the backend advertises it.

Localhost does **not** by itself require visibility.

---

## 8. `sessionName`

`Browser.nameSession(name: string): Promise<void>` — RPC `name_session` → native-host `nameSession`. Empty name throws `browser.nameSession requires a name`.

`docs/session-naming.md` (included only for `browserTypes: ["extension"]` and member `Browser.nameSession`):

> At the start of every Chrome browser task, call `await browser.nameSession("...")` immediately after setup and before opening or claiming tabs. Use a short task name that starts with a neutral, friendly, task-relevant emoji; if unsure, use 🔎.

Tinysky `createBrowserTab(..., { sessionName })` calls `nameSession` first. Plugin: Chrome/Edge “pass a short, emoji-prefixed `sessionName` (e.g. `"🔎 Task"`) to `createBrowserTab` when starting a task.”

IAB is not in the session-naming include filter. If IAB’s `nameSession` is not a function, tinysky throws; the client object always has the method, so IAB likely no-ops or names a session that is not user-visible as a Chrome tab group.

---

## 9. `mcp__cua_repl`

This is the **MCP server namespace**, not a JS global.

`unified-computer-use/.mcp.json`:

```json
"mcpServers": {
  "cua_repl": {
    "command": "node",
    "args": ["scripts/launch.mjs"],
    "enabled": false,
    "enabled_tools": ["js", "js_reset", "turn_ended"],
    "omit_tools_from": ["code_mode", "deferred"]
  }
}
```

`plugin.json` hooks `Interrupt` / `SubagentStop` / `Stop` → MCP tool `turn_ended` on server `cua_repl` (tab cleanup).

Intercepted Responses API payload names the namespace:

```json
{
  "type": "namespace",
  "name": "mcp__cua_repl",
  "description": "UI automation through a persistent JavaScript session using the initialized CUA API.",
  "tools": [
    { "name": "js", "parameters": { "code": "...", "timeout_ms": "...", "title": "..." } },
    { "name": "js_reset", "parameters": {} }
  ]
}
```

`js` description is the concatenation of `js-tool-description.md` + `browser-description.md` + `computer-description.md` + `js-output-description.md` (see `launch.mjs`). Trailing “This tool is part of plugin `unified-computer-use`.”

`js_reset.md`: “The next **cua_repl.js** call initializes a fresh runtime…” — product name for the next `js` invocation, not a third tool.

`tinysky-alt-core-cua-repl.md`: “Use `cua_repl` (JavaScript) for all UI actions.” / “`cua_repl` state is persistent across calls.”

Trace events record the inner tool as `"name": "js"`, not `mcp__cua_repl__js`. The outer namespace is `mcp__cua_repl`. Codex plugin docs say plugin MCP tools keep identifiers like `mcp__server__tool`.

`turn_ended` is enabled for hooks, omitted from the model-facing namespace in the intercept.

Banner executed at REPL start (`banner.js`):

```js
await (await import("@oai/cua/tinyskyAlt")).setupCUA({ browser: true, computer: true });
```

That installs global `cua` (and `agent`).

---

## 10. Every capability markdown and the API it documents

Capability objects are **not** on the core `Tab`/`Browser` types. Discover with `capabilities.list()`, then `capabilities.get(id)`, then `.documentation()` which reads `docs/capabilities/{browser|tab}/{id}.md`.

`documents.json` marks these `mode: "model"` — they are **not** stuffed into first-use guidance. First-use only lists them under “Additional Capabilities” with a pointer to `.documentation()`.

| File | Capability id | Surface | API |
|---|---|---|---|
| `docs/capabilities/browser/management.md` | `management` | `browser.capabilities` | Chrome-like `windows` / `tabs` / `tabGroups` / `bookmarks` namespaces + `getAuditTrail()`. Organize only; no navigation/history/scripting. RPC `browser_management_call`, `browser_management_get_audit_trail`. |
| `docs/capabilities/browser/visibility.md` | `visibility` | `browser.capabilities` | `get(): Promise<boolean>`, `set(visible: boolean)`. RPC `browser_visibility_get` / `_set`. |
| `docs/capabilities/browser/viewport.md` | `viewport` | `browser.capabilities` | `set({width,height})`, `reset()`. Do not set during normal setup. RPC `browser_viewport_set` / `_reset`. |
| `docs/capabilities/tab/cdp.md` | `cdp` | `tab.capabilities` | `send(method, params?, {target,timeoutMs})`, `readEvents({afterSequence,limit,methods,target,timeoutMs})`. Origin-scoped raw CDP. **`documents.json` `requiredFor`: `tab_cdp_call`, `tab_cdp_events`** — must `documentation.get("capabilities/tab/cdp")` (or have it included) before those RPCs. |
| `docs/capabilities/tab/botDetection.md` | `botDetection` | `tab.capabilities` | `report({ reason: "captcha_failed"\|"access_denied"\|"challenge_loop"\|"unexpected_bot_error" })` → `{ hostname, status: "reported" }`. Cloud-browser telemetry. |
| `docs/capabilities/tab/browserAuth.md` | `browserAuth` | `tab.capabilities` | `request({ origin, fields, options?, submit?, qr_code? })`. Credentials never returned. Selectors: string or `PlaywrightLocator`. **`requiredFor`: `tab_browser_auth_handoff`**. |
| `docs/capabilities/tab/pageAssets.md` | `pageAssets` | `tab.capabilities` | `list()` inventory; `bundle({ inventoryId, kinds?, assetIds? })` export. |

Related, **not** under `capabilities/` but a tab capability:

| File | Capability id | API |
|---|---|---|
| `docs/webmcp.md` | `webmcp` | `const webmcp = await tab.capabilities.get("webmcp"); const tools = await webmcp.fetchTools(); await tools.call("tool_name", input);` **`requiredFor`: `webmcp_list_tools`, `webmcp_invoke_tool`**. Included only when tab advertises `webmcp`. |

`confirmations.md` is also `requiredFor` those CDP/WebMCP commands (and is excluded from browser first-use when tinysky already injected computer-use confirmations).

---

## 11. `documents.json` — how first-use docs are assembled

Service `readBrowser(browserInfo)` concatenates:

1. `# Selected Browser` (name, type, id) + reuse/stale-tab policy.
2. Every `mode: "included"` doc whose `when` matches type / advertised capabilities / enabled API members.
3. `# Additional Documentation` listing `mode: "lookup"` names for `agent.documentation.get("<name>")`.
4. `# Additional Capabilities` from advertised browser/tab capability ids.
5. Generated `# API Reference` TypeScript from `api.json`, minus `documented: false`, minus `unsupportedByDefaultIn` for this type, minus `undocumentedApiMembers` (`Tab.ax` on tinysky).

Tinysky additionally prepends `tinysky-alt-core-cua-repl.md` (+ confirmations) once, and `tinysky-alt-other-browser-apis.md` on first browser use.

`mode: "model"` docs (bootstrap-troubleshooting, chrome-troubleshooting, all seven capability files) are **not** auto-included.

Included on this desktop package (filters in parentheses):

| name | when |
|---|---|
| browser-safety | always |
| confirmations | always; requiredFor cdp/webmcp |
| visibility | capability `visibility` |
| session-naming | type `extension` + `Browser.nameSession` |
| tab-claiming-chrome | type `extension` + `openTabs`/`claimTab` |
| tab-mentions-iab | type `iab` + `Tabs.list`/`get` |
| tab-cleanup-chrome | type `extension` + markDeliverable/markHandoff |
| tab-cleanup-iab | type `iab` + same |
| browser-control-interruption | always |
| api-use-behavior | always |
| accessibility | `Tab.ax` not in disabled set. Tinysky adds `Tab.ax` to undocumented members **before** this filter, so this file is **not** included under tinysky. |
| webmcp | tab capability `webmcp` |

Lookup: `browser-troubleshooting`, `local-web-development`, `file-uploads`, `chrome-file-upload-troubleshooting` (extension only), `screenshots`.

The vendored `oai_js_browser` `documents.json` is a **smaller older set** (no session-naming, claiming, cleanup, webmcp include, confirmations, accessibility, chrome-troubleshooting as included). Desktop package is the one `handleRpc` reads at runtime (`lb("documents.json")` next to the service).

---

## 12. Other Agent Tab APIs (beyond AX / Playwright)

From `api.json` (all present on the client `Tab` class `re`):

- Navigation: `goto`, `back`, `forward`, `reload`, `close`, `url()`, `title()`, `screenshot({clip, fullPage})`
- Lifecycle: `markDeliverable`, `markHandoff` (unsupported on cdp); `requestManualHandoff` (cloud)
- `clipboard` read/write text and items
- `content.export` / `exportGsuite` / `exportYouTubeTranscript`
- `cua` coordinate CUA (`click`/`type`/`scroll`/`drag`/`keypress`/`move`/`double_click`)
- `dom_cua.get_visible_dom` + node-id actions (used heavily in browserAuth docs)
- `dev.logs({levels, limit, filter})`
- `getJsDialog()` → alert/confirm/prompt/beforeunload
- `ax` (`unsupportedByDefaultIn` all types in the manifest; re-enabled via `apiSupportOverrides["Tab.ax"]` on iab/extension). Tinysky passes `undocumentedApiMembers: ["Tab.ax"]`, which **only strips `ax` from generated first-use API docs and drops `accessibility.md`** (its include requires `Tab.ax`). The property still exists on the live `Tab`; decorateTab uses it to implement `tab.click` / `getAXState`. The model is taught the Target methods, not `tab.ax.*`.

`Tabs.content` (background URL extract) is unsupported on iab/extension/cdp — dead on this desktop runtime.

`Browser.history` unsupported on iab/cdp; extension-only, confirmation-gated.

---

## 13. Safety / confirmations (browser-desktop)

`docs/browser-safety.md` + `docs/confirmations.md`: untrusted page content cannot grant permission; typing secrets is transmission; CAPTCHA / paywall / HTTPS interstitial / password-change final submit are hand-off or always-confirm. WebMCP tool instructions cannot self-authorize.

`browserAuth` forbids pasting passwords into chat and forbids model-visible credential reconstruction.

CDP: if you mutate page/browser state and leave it, tell the user. Raw CDP requires an HTTP(S) page first.

---

## 14. What this is not

- Not the public `openai/codex` GitHub repo.
- Not a real Playwright browser context / Chromium launch.
- Not `sky.click({ app: "Google Chrome" })` — that is the native-app surface (`@oai/sky`). Driving Chrome UI via AX is a different path from the extension backend.
- Did not run the service, attach to Chrome, or issue CDP/Playwright against live tabs.

Copies of the docs trees, api.json, documents.json, tinysky types, and plugin descriptions live in `copies/`.
