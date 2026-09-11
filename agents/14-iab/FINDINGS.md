# FINDINGS — ChatGPT.app in-app browser (IAB / CodexBrowser)

**Verdict.** The in-app browser is not Chrome, not Playwright, and not `@oai/sky`. It is an Owl/Electron guest `webview` inside Codex (product name **Codex In-app Browser**, type `"iab"`), driven over JSON-RPC sockets under `/tmp/codex-browser-use` by `@oai/browser-desktop/service`, then wrapped for the model as tinysky-alt `cua.getBrowser` / `cua.getTab` / `tab.click`. Live Task 1 ids were `"1"` for **both** `browser.browserId` and `tab.id`. `"iab"` is a **type alias** accepted by `browsers.get("iab")`, not the opaque instance id returned after selection. `cua.getBrowser({ url })` selects a backend and dumps first-use docs; it does **not** open or navigate a tab. Task 1 reused the user-opened right-pane page (`providerTabId` UUID, title `Form - Ant Design`) instead of `createBrowserTab`.

No live form-filling was performed for this reverse. Evidence is local disk + the two-round intercept.

---

## 0. Identity

| Name the model/docs use | What it actually is |
|---|---|
| `"iab"` / `@Browser` / `plugin://browser@openai-bundled` | Backend **type** + plugin mention of the in-app browser |
| `Codex In-app Browser` | `getInfo().name` from the Electron IAB backend |
| `CodexBrowser` | Owl Chromium **scoped user-agent prefix** on packaged guest navigations to OpenAI hosts |
| `browser.browserId === "1"` (Task 1) | Service-assigned sequential id `String(kY++)`, `kY` starts at `1` |
| `tab.id === "1"` (Task 1) | IAB backend sequential `cdpTabId`, `nextCdpTabId` starts at `1` |
| `tab.providerTabId` | Host UUID (`e118c787-0c80-43ff-b884-63d7e1235315` on Task 1); mention `tabId` |
| `metadata.codexSessionId` | Codex **conversation/thread** id. Tab-mention `browserId=` matches this, **not** `"1"` and **not** `"iab"` |

ChatGPT.app version `26.903.61454` (`owl-app.ini` `UserDataDirectoryName=Codex`). Electron package `openai-codex-electron`, Owl runtime, Electron `42.3.0`.

---

## 1. Stack

```
Codex renderer (right/bottom pane, or hidden-browser-use host)
  guest <webview>  partition persist:codex-browser-app-route:{conversationId}\0{browserTabId}
  preload .vite/build/browser-page-preload.js
  UA prefix CodexBrowser (Owl switch, packaged only)
       ▲  debugger / CDP on webContents
Electron main  class Sve  logger browser-use-iab-api
  JSON-RPC listen  /tmp/codex-browser-use  (win32: \\.\pipe\codex-browser-use)
       ▲
cua_node  NODE_REPL_TRUSTED_SERVICES.browser = @oai/browser-desktop/service
  handleRpc setup/execute
  discovers sockets, getInfo(), assigns id "1","2",…
  filters IAB by metadata.codexSessionId === current conversation
       ▲
tinysky-alt create_tinysky_alt.js
  cua.getBrowser / createBrowserTab / getTab / listTabs
  decorateTab → tab.click = tab.ax.click
       ▲
model tool  mcp__cua_repl.js   (executed_tool_calls name mcp__cua_repl__js)
```

Two other plugins ship the **same** `browser-client.mjs` / `browser-service.mjs` trees:

- `plugins/browser` — skill `control-in-app-browser`, aliases `@browser` / in-app browser
- `plugins/chrome` — skill `control-chrome`, plus native host `extension-host/macos/arm64/ChatGPT for Chrome`

Production CUA REPL does **not** import those plugin copies. `unified-computer-use/scripts/launch.mjs` points the trusted service at `@oai/browser-desktop/service`. tinysky imports the vendored client inside `@oai/cua/.../oai_js_browser/.../browser-client.js`.

`plugins/sites` is **not** IAB. It is the Sites website builder (templates, webmcp). IAB is only the surface used to open localhost/file targets those sites produce.

---

## 2. Owl user-agent: `CodexBrowser`

From `.vite/build/bootstrap-CVEIInaq.js` (packaged only):

```js
var he = "owl-scoped-user-agent-additional-hosts";
var ge = "owl-scoped-user-agent-prefix";
function _e({isPackaged:e}) {
  return e ? [
    {name: he, value: "openai.com,chatgpt.com,chatgpt.site,chatgpt-team.site"},
    {name: ge, value: "CodexBrowser"},
  ] : [];
}
```

Main then `app.commandLine.appendSwitch(name, value)` unless the switch is already set. This is an **Owl** Chromium flag, not a `webContents.setUserAgent` call in app JS. It prefixes the guest UA when the navigation host is in that allowlist.

Separate from IAB guests: the **shell** preload exposes `getDesktopUserAgent()` → `Codex Desktop/${appVersion} (Mac OS; arm64)`. That is the Codex UI webview, not the IAB page.

Process list label the user cited (`Codex (Renderer) owl-scoped-user-agent-prefix=CodexBrowser`) is this switch on the Owl renderer.

---

## 3. Electron host

### 3.1 Where the page lives

IAB tabs are thread-scoped guest webviews, not a top-level `BrowserWindow` of their own.

| Host | `hostKind` / flags | When |
|---|---|---|
| Right or bottom sidebar | attach via `will-attach-webview`, `IAB_LIFECYCLE browser sidebar will attach webview` | User-visible pane (`right-panel` / `bottom-panel`) |
| `HiddenBrowserUseWebviewHost` | `hostKind: "hidden-browser-use"`, `isVisible: false`, `shouldPaint: false`, `shouldBootstrapWhenHidden: true` | Agent work while the pane is not shown |
| `HiddenBackgroundBrowserWebviewHost` | `isVisible: false`, `shouldPaint: false`, adopted `webContents` | Background / restore, **not** `isBrowserUseTab` |

`uz(hostKind)` maps `hidden-browser-use` and `null` → no panel side. Visibility capability is what moves work into the visible pane.

`setBrowserVisibleForBrowserUse` throws on subagent routes: `IAB visibility is not supported in a subagent thread`.

### 3.2 Partition / storage

- Per-tab guest: `persist:codex-browser-app-route:` + `encodeURIComponent(conversationId + "\0" + browserTabId)`.
- Settings / chrome:// chrome of the in-app browser: `persist:codex-browser-app` (`Gy` in `src-J2PvP4xj.js`), plus sibling partitions for passwords/contact-info.
- IAB settings routes: `/settings/browser-use/downloads`, `/settings/browser-use/history`, `/settings/browser-use/passwords`.

### 3.3 Preload

`.vite/build/browser-page-preload.js` (~515 KB) is the IAB **guest** preload (`VZ = join(__dirname, "browser-page-preload.js")` in `browser-sidebar-manager`). It injects isolated-world helpers (`document`, `modelContext`) used for WebMCP / page tools. The Codex UI preload (`.vite/build/preload.js`) is a different file (`electronBridge`, Sentry, chunked IPC).

### 3.4 CDP

The IAB backend attaches `webContents.debugger`, forwards CDP `message` events as `onCDPEvent`, and implements `executeCdpForBrowserUse`. `Page.reload` is emulated via `webContents.reload()`. Input commands enable `Emulation.setFocusEmulationEnabled`. Playwright in the service injects into this debugger; IAB uses `mouseWheel` for CUA scroll, extension uses `synthesizeScrollGesture`.

Paint: `webContents.setPageCapturePaintLeaseEnabled(true)` on the session-controlled tab so screenshots/AX work even when the guest is not the focused OS window.

---

## 4. Native JSON-RPC backend (`Sve`, logger `browser-use-iab-api`)

Socket directory:

```js
ma = platform => platform === "win32" ? "\\\\.\\pipe\\codex-browser-use" : "/tmp/codex-browser-use"
```

Service lists the directory (`readdir`) and connects every candidate socket. Each IAB instance answers `getInfo`:

```js
{
  apiSupportOverrides: {
    "Browser.user": false,
    ...U().inAppBrowserUseHistory ? {"Browser.history": true} : {},
    "Tab.markDeliverable": true,
    "Tab.markHandoff": true,
  },
  name: "Codex In-app Browser",
  version: /* app version */,
  type: "iab",
  capabilities: {
    browser: [visibility, viewport],          // ove = [ZY.info, cX.info]
    tab: [pageAssets, ...webmcp if flagged],  // sve + optional zY.info
  },
  metadata: {
    codexSessionId: conversationId,           // getMetadata
    codexAppSessionId, codexAppBuildFlavor,   // optional
  },
}
```

`Browser.user` is **hard-off** on IAB (`unsupportedByDefaultIn: ["iab","cdp"]` plus override `false`). There is **no** `claimTab` / `openTabs` on this backend.

Service may later inject tab capability `cdp` when full CDP is enabled (`$Y` / `Di.info`). Task 1 first-use listed `cdp` and `webmcp`, so both were on for that session.

### 4.1 Tab records

```js
nextCdpTabId = 1
updateTabForInfo: cdpTabId = existing || nextCdpTabId++
serializeTab: {
  id: cdpTabId,                 // number 1 → JSON "1"
  providerTabId: browserTabId,  // UUID
  sessionControlled,
  title, url, active
}
```

Agent `createTabForBrowserUse`:

1. `browserTabId = brand("browser-use:" + randomUUID())`
2. `setBrowserUseActive(true)`
3. apply pending visibility/viewport intents
4. `openPageForBrowserUse({ browserTabId, startingUrl: initialPageUrl ?? "about:blank" })`
5. `updateTabForPage(..., "temporary")`
6. `markBrowserUseCommandForTab` → `sessionControlled = true`

User-opened tabs come from `host.getTabsForBrowserUse()` with `lifetime: browserUseTabLifetime` (persistent) and `sessionControlled: isBrowserUsePage` (false until a command binds them).

`getTab` on a not-yet-controlled tab **selects** it (`selectedTabIdsByRouteKey`) and, on first command, `markBrowserUseCommandForTab` takes session control. That is the IAB substitute for Chrome `claimTab`.

### 4.2 `turnEnded` / marks

`markTab` RPC (`status: "handoff" | "deliverable"`, requires `turn_id` + integer `tabId`):

```js
n.mark = { status, turnId }
recordBrowserUseTurn(session, req)  // remembers this turn used the browser
```

tinysky `tab.markDeliverable()` / `tab.markHandoff()` → client `#t("deliverable"|"handoff")` → `mark_tab`.

On `turnEnded`, only if `usedTurnIdsByConversationId.get(conversationId) === turn_id`:

```js
for sessionControlled tabs:
  restore clipboard bridge
  detach debugger
  mark = (tab.mark.turnId === thisTurn) ? tab.mark.status : null
  if mark === "handoff" && lifetime === "temporary":
      delete mark; keep tab (still in session)
  else if mark != null || lifetime === "persistent":
      releaseTab()   // drop session control, leave the webview open
  else:
      closeTab()     // unmarked agent-created temporary tabs
setBrowserUseActive(false)
clear pending visibility/viewport
```

This is exactly `tab-cleanup-iab.md`:

- Agent-created (temporary) tabs close at turn end unless marked.
- User-opened (persistent) tabs stay; if they were session-controlled they are **released**, not closed.
- `markDeliverable` → treat as keep-open output (`releaseTab`).
- `markHandoff` on a temporary tab → survive into the next turn still bound.
- Marks are turn-scoped; latest mark wins; must re-mark next turn.

Plugin Stop / Interrupt / SubagentStop hooks call MCP `turn_ended` on `cua_repl` / `node_repl` with `session_id` + `turn_id`.

`nameSession` on IAB: `getRequiredBrowserHost` then require a string name — **no-op** (no Chrome tab-group rename).

---

## 5. `@oai/browser-desktop` discovery

`iM` (refresh):

1. Require Codex turn metadata `session_id` + `turn_id` (`iI`).
2. `codexSessionId = fr(nodeRepl)`: subagent uses `thread_id`, else `session_id`.
3. List `/tmp/codex-browser-use` sockets (`WY` → `HY`/`zY`).
4. Connect each (`Jm.create` + `getInfo`). New pipes get `id: String(kY++)` with `kY = 1`. Existing pipes are reused (same id).
5. `DY`: keep IAB backends whose `metadata.codexSessionId` equals current conversation **and** (if set) `codexAppBuildFlavor` matches `BROWSER_USE_CODEX_APP_BUILD_FLAVOR`. Close the rest.
6. `OY`/`Ch`: drop backends not in `BROWSER_USE_AVAILABLE_BACKENDS` (if unset, all types allowed). Telemetry map `GU = { cdp:"cdp", extension:"chrome", iab:"iab" }`.

If no IAB survives the session filter: `VY` reason `missing-session-metadata` | `no-iab-backends` | `no-session-match`.

Matcher `ux({ browserId, clientInfo, requestedBrowserId })`:

- requested is `"iab"|"extension"|"cdp"` → match **type**
- requested is a family key in the Chromium catalog (`chrome|edge|brave|opera|vivaldi`) → match extension family
- else exact `id` (`"1"`)

So `browsers.get("iab")` and `browsers.get("1")` both hit the Task 1 IAB. Plugin text teaches `"iab"`; live `browser.browserId` after `getBrowser({url})` was `"1"`.

### 5.1 `getDefault` / `getForUrl`

```js
cM: iab ?? preferred extension instance ?? any extension ?? first
dM:
  if only one browser → that one
  if URL is file: or localhost/127.0.0.1/::1/*.localhost → IAB if present
  else score open tab URLs: exact → origin+pathname → hostname → hostname hierarchy
  tie-break $o: iab ?? preferred extension ?? first
  fallback: iab ?? extension ?? first
```

Local/file URLs **prefer IAB even when Chrome is connected**. Public https prefers whichever backend already has a matching tab; IAB still wins ties.

---

## 6. Why `cua.getBrowser({ url })` does not open a tab

`create_tinysky_alt.js` `getBrowser`:

```js
getBrowser(options) {
  const url = options?.url
  const href = url === undefined || URL.canParse(url) ? url : `https://${url}`
  const browser = await g({ browser: options?.id }, href)
  await emit(undefined, { browser })  // docs only, no AX, no tab
  return browser
}
```

Resolver `g`:

1. `options.id` → `browsers.get(id)` (**id wins**)
2. else if url and `getForUrl` exist → `browsers.getForUrl(url)`
3. else `getDefault()` else first of `list()`

It awaits `browser.documentation()` (cached per `browserId`) and emits `cua.core` + `cua.browser`. It never calls `tabs.new()` or `goto`.

`js-tool-description.md` (concatenated into the `js` tool):

> Selecting a browser does not open a tab.

`createBrowserTab(browserId, url?, { visible?, sessionName? })` is the opener:

1. require non-empty `browserId`
2. resolve `g({ browser: browserId })`
3. optional `nameSession`
4. if `visible` is passed: `(await capabilities.get("visibility")).set(visible)` **before** `tabs.new()`
5. `tabs.new()`; if url, `tab.goto` (`https://` prefix if needed)
6. emit full AX (`disableDiffing: true`)

Plugin `browser-description.md` policy:

- Known URL + `@Browser` → `createBrowserTab("iab", url, { visible })`
- Known URL, user did **not** name a browser → `getBrowser({ url })` only
- Named Chrome/Edge → `createBrowserTab(name, url, { sessionName })` — do not call `getBrowser` first

Task 1 followed the “unknown browser, known URL” branch, then bound the **already open** tab.

---

## 7. Task 1 vs raw intercept (must-match)

User (0127): *我在右侧的浏览器打开了 ant design 的 form 页面…*

| # | `js` code | Result in `codex拦截-两轮-raw.json` |
|---|---|---|
| 1 | `let browser = await cua.getBrowser({ url: "https://ant.design/components/form" })` | First-use docs. `# Selected Browser` **Name: Codex In-app Browser, Type: iab, ID: 1**. No tab open. Wall ~2.9s. Tool name `mcp__cua_repl__js`. |
| 2 | `await cua.listTabs({ browser: browser.browserId })` | `[{"id":"1","providerTabId":"e118c787-0c80-43ff-b884-63d7e1235315","title":"Form - Ant Design","url":"https://ant.design/components/form","browserId":"1"}]` |
| 3 | `let tab = await cua.getTab("1", { browser: browser.browserId })` | Full AX dump of that page (~119k). No `createBrowserTab`. |
| 4 | `tab.click(325); tab.getAXState()` | Empty submit / validation |
| 5 | `tab.click` + `tab.typeText` (username/password) + submit | Fill + submit |
| 6 | `let pt = await browser.tabs.get("1"); pt.dev.logs({levels:["log"],limit:5})` | Console + Fill-form click |
| 7–14 | more `tab.click` / `pt.playwright.locator().fill/evaluate/press` | Dropdown, reset, validateOnly, keyboard clear |

`createBrowserTab`, `tab.goto`, `tab.markDeliverable`, `visible: true`, `sky.*` were **not** used.

Why it worked without opening a tab:

1. User already had the form in the **right** IAB pane (`hostKind` right-panel).
2. `getForUrl("https://ant.design/components/form")` ranked IAB first (exact open-tab URL match, IAB tie-break).
3. `listTabs` is `tabs.list()` ∪ `user.openTabs()` (openTabs throws/empty on IAB) and stamps `browserId: browser.browserId` (`"1"`).
4. `getTab("1")` matches `id` **or** `providerTabId`. `"1"` is `cdpTabId`. Binding a user tab session-controls it; no Chrome-style claim.

`tab` (tinysky Target) and `pt` (`browser.tabs.get`) are the same IAB page. The model used `tab.click` / `tab.typeText` (AX) and `pt.playwright` / `pt.dev.logs` (Agent Tab APIs). tinysky hides `Tab.ax` from first-use docs (`undocumentedApiMembers: ["Tab.ax"]`) but `decorateTab` still forwards Target methods to `tab.ax.*`.

First-use IAB dump included: visibility + viewport browser caps; pageAssets + webmcp + cdp tab caps; tab-mentions-iab; tab-cleanup-iab; **no** `Browser.user`, **no** session-naming, **no** tab-claiming-chrome. `history` and `nameSession` still appeared in the generated API block; IAB `nameSession` is a no-op, `history` is gated by `inAppBrowserUseHistory`.

---

## 8. Listing, “claiming”, mentions

### 8.1 List

`cua.listTabs({ browser })` → resolve that browser, `get_browser_tabs`:

```js
openTabs = browser.user?.openTabs?.().catch(() => [])  // [] on IAB
listed  = browser.tabs.list()
union by tab.id, agent list wins on collision
stamp browserId
```

IAB `tabs.list()` is already **all** in-app tabs (user + agent). No second inventory.

### 8.2 No claim

`Browser.user` unsupported on iab/cdp. `getTab` never reaches `claimTab` on IAB. Docs `tab-mentions-iab.md`: all IAB tabs are `tabs.list` / `tabs.get`; reuse instead of duplicating.

Chrome path (for contrast): mention `source=extension` → `user.openTabs()` exact object → `user.claimTab(tab)`.

### 8.3 Mentions

Composer node `browserTabMention`. Path builder in main (`yq`):

```js
{ browserId: conversationId, pluginId: browser, source: "iab",
  tabId: browserTabId, snapshot: { title, url } }
```

URL shape:

`plugin://browser@openai-bundled?mention=tab-v1&browserId=<codexSessionId>&tabId=<providerTabId>&title=...&url=...`

**without** `source=extension`. Resolve:

1. `agent.browsers.list()`
2. type `"iab"` whose `metadata.codexSessionId === browserId`
3. `tabs.list()` exact `providerTabId` + title + url
4. `tabs.get(tab.id)` — the sequential `"1"`, not the UUID

Fail closed if title/url drifted. Do not assume an earlier-turn `iab` / `browser` binding still exists.

`[@Browser](plugin://browser@openai-bundled)` with no mention query names the **type**, not a tab.

---

## 9. `visible: true` — IAB vs Chrome

| | IAB | Chrome / Edge |
|---|---|---|
| Plugin option on `createBrowserTab` | `{ visible: true\|false }` | `{ sessionName: "🔎 Task" }` |
| Implementation | `capabilities.get("visibility").set(visible)` **before** `tabs.new()` | `browser.nameSession(name)` first; throws if missing |
| Capability docs | included when backend advertises `visibility` (IAB always does) | `session-naming.md` included only for `browserTypes: ["extension"]` |
| Default | Keep work in the background. Localhost does **not** by itself require show. | Session name labels the automation tab group; does not map to IAB visibility |
| Live Task 1 | User already had the pane open on the right. Model never called `set(true)`. | unused |

Pending intents: if `visibility.set(true)` runs **before** a host/tab exists, IAB stores `pendingVisibilityRouteKeys` and applies `setBrowserVisibleForBrowserUse(true)` on the next `createTab` / `markBrowserUseCommandForTab`. Viewport `set`/`reset` is the same pattern (`pendingViewportSizesByRouteKey`).

Guidance (`docs/visibility.md`, included on Task 1):

> Show the browser when the user's request is primarily to put a page in front of them or let them watch the interaction… When the browser should be visible, call `await (await browser.capabilities.get("visibility")).set(true)`.

Chrome `visible` still hits the same capability **if** that backend advertises it; the plugin blurb does not teach it.

---

## 10. `tab.click` / `typeText` / Playwright / `dev.logs`

tinysky `decorateTab`:

| Model call | Implementation |
|---|---|
| `tab.click(i)` / `tab.click([x,y])` | `tab.ax.click` |
| `tab.typeText(s)` | `tab.ax.typeText` |
| `tab.getAXState()` | `tab.ax.get("state")` + `nodeRepl.write(..., "cua.state")` |
| `tab.paste` | clipboard write + `ax.pressKey("Ctrl+v")` |
| `tab.playwright` | **not** added by tinysky; already on Agent `Tab` |
| `tab.dev.logs` | Agent `TabDevAPI` |

Service Playwright is an injected, **read-only-evaluate** subset (`__codexPlaywrightInjected`). `playwright.evaluate` DOM is read-only. IAB keypress path allocates `iabInputTargetToken` (`iab-input-${Date.now()}-...`) so Input.dispatch goes to the right guest.

`api.json` `CUAAPI.downloadMedia` is `unsupportedByDefaultIn: ["iab"]`.

Task 1 used both AX indices (325, 4523, …) and CSS locators (`[id="validateOnly_name"]`). `{ emit: false }` + `nodeRepl.write(filter)` was used to shrink AX.

---

## 11. Plugins and skills

| Plugin | Role vs IAB |
|---|---|
| `unified-computer-use` | Live CUA REPL. Banner `setupCUA({browser:true,computer:true})`. Tool descriptions teach `createBrowserTab("iab", url, { visible })`. |
| `browser` | Skill `control-in-app-browser`. Direct `setupBrowserRuntime` + `agent.browsers.get("iab")`. Same docs tree. `turn_ended` hooks on `node_repl`. |
| `chrome` | Same client/service + Chromium native host. `get("chrome")` / `get("edge")`. |
| `sites` | Site builder. Not an IAB backend. Local preview is supposed to go through IAB. |
| `computer-use` | Native AX / Computer Use.app. Parallel, not IAB. |

Feature flags in Electron (`U()`): `inAppBrowserUse`, `inAppBrowserUseAllowed`, `inAppBrowserUseHistory`, `browserUseTinysky`, `browserPane`, `webMcp`, `externalBrowserUse`, … Defaults in the bundled object are `false`; production enables them via Statsig/config (`experimentalFeature/list` at host ready, then `setInAppBrowserFeatureEnabled`).

Workspace origin policy (`browser-use-origin-state-queries`): `featureRequirements.in_app_browser` / `browser_use` / `browser_use_external` / `browser_use_full_cdp_access`; per-origin allow/deny for access, uploads, downloads, history.

Env the service reads: `BROWSER_USE_AVAILABLE_BACKENDS`, `BROWSER_USE_CODEX_APP_BUILD_FLAVOR`, `BROWSER_USE_CODEX_APP_VERSION`, `BROWSER_USE_TINYSKY_ENABLED`, `BROWSER_USE_DISABLE_*`, `BROWSER_USE_SECURITY_MODE`, `BROWSER_USE_PREFERRED_EXTENSION_INSTANCE_ID`, `BROWSER_USE_FULL_CDP_ACCESS_ENABLED`.

---

## 12. First-use documents that are IAB-specific

`documents.json` includes when `browserTypes: ["iab"]`:

- `tab-mentions-iab` (requires `Tabs.list`/`get`)
- `tab-cleanup-iab` (requires `Tab.markDeliverable`/`markHandoff`)

Always-on for this session: `browser-safety`, `confirmations` (tinysky actually **excludes** confirmations from browser first-use because it already printed computer-use confirmations — they still appeared under `cua.core`), `visibility` (capability present), `browser-control-interruption`, `api-use-behavior`.

Not included on IAB: `session-naming`, `tab-claiming-chrome`, `tab-cleanup-chrome`, `chrome-file-upload-troubleshooting`.

---

## 13. What this is not

- Not public `openai/codex` GitHub.
- Not a Playwright-launched Chromium.
- Not `sky.click({ app: "Google Chrome" })`.
- Not the Chrome extension backend (`type: "extension"`, native host `ChatGPT for Chrome`).
- Not cloud `type: "cdp"` / GaaS.
- This reverse did not attach to live tabs or drive the form again.
