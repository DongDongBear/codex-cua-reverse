# Catalog skeptic — completeness refutation

**Verdict: INCOMPLETE**

Sources independently re-read (local disk only):

- Catalog: `/Users/dongdong/Desktop/codex-cua-reverse/CAPABILITY-CATALOG.json`, `/Users/dongdong/Desktop/codex-cua-reverse/CAPABILITIES.md`
- Types: `/Users/dongdong/Desktop/codex-cua-reverse/vendor/cua/types/tinysky_alt.types.d.ts`, `/Users/dongdong/Desktop/codex-cua-reverse/vendor/cua/types/cua.d.ts`, `/Users/dongdong/Desktop/codex-cua-reverse/vendor/sky/types/window/WindowComputerUseClient.d.ts`, `/Users/dongdong/Desktop/codex-cua-reverse/vendor/sky/types/SkyClient.d.ts`, `/Users/dongdong/Desktop/codex-cua-reverse/agents/02-sky-native/d.ts/types/window2/Window2ComputerUseClient.d.ts`, `/Users/dongdong/Desktop/codex-cua-reverse/agents/02-sky-native/d.ts/types/full-desktop/FullDesktopComputerUseClient.d.ts`
- `api.json`: `/Users/dongdong/Desktop/codex-cua-reverse/vendor/browser-desktop/api.json` (146 interface members = catalog `browser_desktop` count; types-with-methods are **not** cataloged)
- node_repl: `/Users/dongdong/Desktop/codex-cua-reverse/native/node-repl-tools.txt`, `/Users/dongdong/Desktop/codex-cua-reverse/_tmp/node_repl_js/worker-runtime.js`, `privileged-node-repl.js`, `kernel.js`, `privileged-node-repl-config.js`
- Traces: `/Users/dongdong/Desktop/codex拦截-两轮-raw.json` (`output_item.done`: **js×37 + request_user_input_async×1 + js_reset×1**), `/Users/dongdong/Desktop/codex-cua-reverse/traces/all-js-calls.json`
- Live: `/Users/dongdong/Desktop/codex-cua-reverse/LIVE-VERIFICATION.md`, `/Users/dongdong/Desktop/codex-cua-reverse/verify/API-MATRIX.md`, `/Users/dongdong/Desktop/codex-cua-reverse/verify/agents/v5-matrix/FINDINGS.md`, `/Users/dongdong/Desktop/codex-cua-reverse/verify/results/mcp-ndjson.json`

Catalog snapshot: tinysky 27, sky 13 (Mac window only), repl 8, browser_desktop 146. **No `live_pass` field.** `js_call_count: 39` conflates 37 `js` bodies with two non-js protocol items.

`GOAL-STATUS.md` already says “Not complete yet” and lists CROSSCHECK + unused capabilities as remaining. This report is the independent disproof that the JSON catalog is still not a closed set.

---

## missing[]

APIs that exist in the four required sources (and/or in `tools_in_raw`) but have **no catalog id**.

### tinysky types (`tinysky_alt.types.d.ts` `TinySkyAlt` / `vendor/cua/types/cua.d.ts`)

| id | source | why it matters |
|---|---|---|
| `cua.initialize` | `TinySkyAlt.initialize(): Promise<State>` | Documented first-call in `tinysky-alt-core-node-repl.md`. Banner already ran `setupCUA`; `initialize()` ≡ `getState()`. Traces never call it. Catalog tinysky starts at `getState`. |
| `cua.browsers` | `TinySkyAlt.browsers?: Browsers` | Installed by `create_tinysky_alt` when browser is on; this is `agent.browsers`. |
| `cua.computer` | `TinySkyAlt.computer?: Computer` (`typeof sky`) | Installed when computer is on. Runtime alias of Mac `sky`. |
| `cua.documentation` | legacy `vendor/cua/types/cua.d.ts` package-main `cua` | Parallel object, not tinysky-alt global; still a shipped `@oai/cua` member. |
| `globalThis.agent` | `create_tinysky_alt.js` `Reflect.set(globalThis,"agent", f)` | Raw Agent; model used `browser.tabs.get` off the tinysky Browser, but `agent` is a live global. |

### sky types (Mac catalog is a subset of `SkyClient`)

`vendor/sky/types/SkyClient.d.ts` is `FullDesktop \| Window \| Window2`. Catalog `sky[]` is **only** `WindowComputerUseClient` (`target:"mac"`). Window2 / full-desktop types live at `agents/02-sky-native/d.ts/types/` (vendor tree did **not** copy those folders).

| id | client | source file |
|---|---|---|
| `sky.activate_window` | window2 / Windows | `Window2ComputerUseClient.d.ts` |
| `sky.get_window` | window2 | same |
| `sky.get_window_state` | window2 | same |
| `sky.launch_app` | window2 | same |
| `sky.list_windows` | window2 | same |
| `sky.drag_handle` | full-desktop / Linux | `FullDesktopComputerUseClient.d.ts` |
| `sky.get_screenshot` | full-desktop | same |
| `sky.move` | full-desktop | same |
| `sky.target` | all three (discriminator `"mac"\|"windows"\|"linux"`) | all three client types |

Mac-only extras (`paste`, `select_text`, `get_app_state`) **are** cataloged. Windows-only / Linux-only extras are not. `cua.getApp` **throws** if `sky.target !== "mac"` — that branch is uncataloged behavior.

### api.json types (not `interfaces`)

Interface members are 146/146 in the catalog. These **method-bearing types** are in `api.json` `"types"` and have **zero** catalog rows:

| id | api.json type text |
|---|---|
| `BrowserCapabilityCollection.get` | `get(id: string): Promise<unknown>` |
| `BrowserCapabilityCollection.list` | `list(): Promise<Array<{ id: string; description: string }>>` |
| `TabCapabilityCollection.get` | `get(id: string): Promise<unknown>` |
| `TabCapabilityCollection.list` | `list(): Promise<Array<{ id: string; description: string }>>` |

`create_tinysky_alt.js` **calls** `r.capabilities.get("visibility").set(...)` on `createBrowserTab({visible})`. Capability IDs and methods are documented under `vendor/browser-desktop/docs/capabilities/` and `webmcp.md` but are not catalog ids: `management.{tabs,windows,tabGroups,bookmarks,getAuditTrail}`, `viewport.{set,reset}`, `visibility.{get,set}`, `botDetection.report`, `browserAuth.request`, `cdp.{send,readEvents}`, `pageAssets.{list,bundle}`, `webmcp.fetchTools` / `tools.call`. `CAPABILITIES.md` §5 lists the **docs**, not the methods. `GOAL-STATUS.md` still names these as remaining work.

### node_repl strings (`native/node-repl-tools.txt` + kernel/privileged source)

Catalog `repl[]` is only: `js`, `js_reset`, `turn_ended`, `js_add_node_module_dir`, `nodeRepl.write`, `nodeRepl.emitImage`, `nodeRepl.emitAudio`, `nodeRepl.createElicitation`.

Present in `native/node-repl-tools.txt` and **missing** from catalog:

| id | notes |
|---|---|
| `js_add` | Extracted tool name. Catalog uses `js_add_node_module_dir` (MCP long name). **Mis-normalized pair, not a second tool.** See duplicates. |
| `nodeRepl.config` | plus `read` / `readToml` / `writeToml` / `readRequirements` / `writeValue` / `batchWrite` (`privileged-node-repl-config.js`) |
| `nodeRepl.cwd` | untrusted kernel object |
| `nodeRepl.emitContentItem` | privileged |
| `nodeRepl.fetch` | privileged `authenticatedFetch` |
| `nodeRepl.homeDir` | untrusted |
| `nodeRepl.launchServices` | + `openApplication({applicationPath\|bundleIdentifier})` |
| `nodeRepl.requestMeta` | getter |
| `nodeRepl.rpc` | trusted RPC (`"browser"` / `"sky"`); required by browser-client |
| `nodeRepl.setResponseMeta` | privileged |
| `nodeRepl.tmpDir` | untrusted |
| `nodeRepl.withSuspendedTimeout` | privileged |

Also in kernel/privileged **source** but not even in `node-repl-tools.txt` (so also missing from catalog):

| id | file |
|---|---|
| `nodeRepl.env` | `worker-runtime.js` base object |
| `nodeRepl.nativePipe.createConnection` | `kernel.js`; connection `{write,on,off,end}` — LIVE-VERIFICATION names this as the trusted native path |
| `nodeRepl.otel.log` | privileged |
| `nodeRepl.addTurnEndedHandler` | privileged |
| `nodeRepl.addAfterSubmittedCodeHook` | privileged |
| `nodeRepl.gaasBrowserConfig` | privileged getter |
| `nodeRepl.telemetry` | optional, when `NODE_REPL_TRACE_META=1` |

### In `tools_in_raw` / raw `output_item.done` but not in catalog `repl[]`

`GOAL-STATUS.md` done-criterion 3: “Every `js` call in the raw JSON maps to a catalog API (**including `js_reset` / `request_user_input_async`**)”.

| id | raw evidence |
|---|---|
| `request_user_input_async` | Task 2 `output_item.done` ×1. Catalog `tools_in_raw` lists it. **No catalog id.** Advertised on every `response.create` next to `wait`, `request_user_input`, `sleep`, `followup_task`, `interrupt_agent`, `list_agents`, `send_message`, `spawn_agent`, `wait_agent`, `exec`. |

Those host tools are not tinysky/sky/api.json/node_repl, but the catalog’s own completion bar requires `request_user_input_async`.

---

## wrong_trace_flags[]

Ground truth: every `js` `arguments.code` in `/Users/dongdong/Desktop/codex拦截-两轮-raw.json` (37 cells) + `/Users/dongdong/Desktop/codex-cua-reverse/traces/all-js-calls.json`. **Zero** cells contain `tab.ax.`, `pt.ax.`, `sky.`, `.ax.write(`, or `locator(...).locator(`/`locator(...).click(`.

Bindings actually used: `browser`, `tab` (tinysky `Tab & Target`), `pt` (`browser.tabs.get("1")` raw BrowserTab), `linearApp` / `linear` (tinysky `App`).

### False positives (`in_traces: true`, name never appears in model JS)

| catalog id | claimed | actual in raw JS | why wrong |
|---|---|---|---|
| `AXAPI.click` | true | `tab.click` / `linearApp.click` / `linear.click` | Browser Target forwards to `tab.ax.click` **inside tinysky**. Native App does **not** go through AXAPI at all. Model never wrote `*.ax.click`. |
| `AXAPI.get` | true | `tab.getAXState` / `app.getAXState` | Same: decorateTab uses `t.ax.get("state")` internally. Native uses `sky.get_app_state`. |
| `AXAPI.typeText` | true | `tab.typeText` (browser) + `linearApp/linear.typeText` (native) | Native is not AXAPI. |
| `AXAPI.performSecondaryAction` | true | **only** `linearApp.performSecondaryAction` | Native Target. **No browser AX call.** |
| `AXAPI.pressKey` | true | **only** `linearApp.pressKey` | Native. No `tab.pressKey` / `tab.ax.pressKey`. |
| `AXAPI.setValue` | true | **only** `linear.setValue` | Native. No browser AX. |
| `AXAPI.write` | true | **`nodeRepl.write` only** | Catalog confused `nodeRepl.write` with `tab.ax.write()`. CAPABILITIES.md §4 also marks `AXAPI.write` 抓包 YES. Smoking gun. |
| `PlaywrightLocator.click` | true | no `locator(...).click(` | Clicks were `tab.click` / `app.click`. |
| `PlaywrightLocator.locator` | true | no nested `.locator().locator()` | 7× `pt.playwright.locator(selector)` = `PlaywrightAPI.locator`, not `PlaywrightLocator.locator`. |
| `Browsers.get` | true | `cua.getBrowser({ url })` | tinysky path is `browsers.getForUrl(url)` when `id` is omitted (`create_tinysky_alt.js`). Model never called `browsers.get`. |

`CAPABILITIES.md` copies the same false YES flags onto AXAPI.

### False negatives (`in_traces: false`, present in raw JS)

| catalog id | catalog | actual | counts in 37 `js` bodies |
|---|---|---|---|
| `PlaywrightLocator.fill` | false | `pt.playwright.locator(...).fill(...)` | 4 |
| `PlaywrightLocator.press` | false | `.locator(...).press('ControlOrMeta+a'\|'Backspace')` | 2 |
| `PlaywrightLocator.evaluate` | false | `.locator(...).evaluate(el=>…)` | 1 |
| `Browsers.getForUrl` | false | internal of `cua.getBrowser({url})` | 1 (if internals count; then `Browsers.get` must be false) |
| `Tab.playwright` | false | `pt.playwright.locator` | 7 property accesses |
| `Tab.dev` | false | `pt.dev.logs` | 1 |
| `Browser.tabs` | false | `browser.tabs.get("1")` | 1 |
| `Tabs.list` | false | internal of `cua.listTabs` / `cua.getTab` | if internals count, should be true |

`TabDevAPI.logs` correctly true. Parent property `Tab.dev` incorrectly false. Same split for `Tab.playwright` vs `PlaywrightAPI.locator`.

### Duplicate / mis-normalized names (tab vs pt vs linearApp)

The catalog collapses live identifiers into `target.*` / `app.*` / `tab.*` without recording the binding. Traces use **two handles for one IAB tab** and **two names for one native app**:

| live identifier | how it was bound | what the model called | catalog bucket |
|---|---|---|---|
| `tab` | `cua.getTab("1", {browser: browser.browserId})` | `click`, `typeText`, `getAXState` | `target.*` **and** `AXAPI.*` (double-count) |
| `pt` | `browser.tabs.get("1")` | `pt.dev.logs`, `pt.playwright.locator` | labeled `tab.playwright` / `tab.dev` in `trace_apis` and CAPABILITIES §6 — **pt is not `tab`** |
| `linearApp` | `cua.getApp("Linear")` then `'com.linear'` | screenshot / Raise / zoom / pressKey / coord click | `target.*` / `app.*` |
| `linear` | `cua.getApp('com.linear')` after `js_reset` | File/Window menu, paste, setValue, submit | same `target.*` as `linearApp` |

`trace_apis` names (`app.click` ×14, `tab.getAXState` ×12, …) do not match catalog ids (`target.click`, `AXAPI.click`, `PlaywrightLocator.click`). One physical `tab.click(325)` is credited to **three** catalog rows: `target.click`, `AXAPI.click`, and (wrongly) not distinguished from `PlaywrightLocator.click`.

Other name bugs:

- `js_add` (`native/node-repl-tools.txt`) vs catalog `js_add_node_module_dir` (MCP). Same tool, two ids.
- `sky.click` vs MCP `click` vs `target.click` vs `app.click` vs `tab.click` vs `AXAPI.click` vs `CUAAPI.click` vs `PlaywrightLocator.click` — eight labels, one user-visible “click”.
- `nodeRepl.write` vs `AXAPI.write` vs `TabClipboardAPI.write` — three `write`s; traces only used the first.

---

## overclaimed_live[]

`verify/API-MATRIX.md` vocabulary: **`live_pass` = a result file showing the API succeeding against the live stack. Count = 0.**

| claim | where | actual evidence | required status |
|---|---|---|---|
| Catalog is live-complete | implicit: no `live_pass` field, 194 rows presented as the capability set | Catalog cannot record live_pass. Completeness criterion in `CAPABILITIES.md` also requires independent Agent confirmation — agents 08–12 dirs **do not exist**. | not live_pass |
| “Live MCP: **10** native tools listed and schema-checked” | `GOAL-STATUS.md` | `verify/results/mcp-ndjson.json` `tools/list` succeeded. That is MCP discovery, **not** `sky.list_apps` / `cua.listApps` succeeding. | `tools/list` = protocol_ok; APIs ≠ live_pass |
| “Live path: MCP tool list + error codes match reconstruction **(done)**” | `GOAL-STATUS.md` done-when #4 | `tools/call list_apps` → `-10000 Sender process is not authenticated`. Auth-wall reconstruction ≠ API live_pass. | live_fail for `list_apps` / `get_app_state` |
| “SkyComputerUseClient MCP (live, this session)” table mapping MCP tools → trace APIs | `LIVE-VERIFICATION.md` §2 | Only `initialize`, `tools/list`, failed `list_apps`, schema-reject `get_app_state` (missing `app`) ran. **No** live `click` / `type_text` / `paste` / AX. | overclaim if read as live execution |
| “22/22 unique trace APIs match tinysky types + IPC request type names” | `LIVE-VERIFICATION.md`, `static-contract.json` | Static shape. v5-matrix: **shape_ok, not live_pass**. | shape_ok |
| Native unix socket “reconstructed protocol actually called” | `LIVE-VERIFICATION.md` title / §1 | Connect then **socket closed** (system Node **and** OpenAI-signed cua_node). No JSON-RPC body. | live_fail of ping |
| `cua.getApp` / `cua.listApps` / `app.getAXState` / `getScreenshot` / `getAXStateAndScreenshot` | any reading of catalog `in_traces:true` as live-verified | `verify/API-MATRIX.md`: all five **`live_fail`**. | live_fail |
| MCP `paste` | catalog has `sky.paste` / `target.paste` in_traces true (paste **was** in traces) | Live MCP `tool_names` **omit paste**. JS `@oai/sky` has paste; this MCP server does not. LIVE-VERIFICATION states this; catalog does not. | not live, and MCP surface ≠ JS surface |
| CAPABILITIES.md AXAPI 抓包 YES | §4 | See wrong_trace_flags. Also not live. | false on both axes |

Independent confirmation from v5: “**do not claim live_pass** for any trace API.” This catalog still has no live column and surrounding docs still say the live path is done.

---

## verdict

**INCOMPLETE**

Not a documentation nit: the catalog (1) drops whole type surfaces (TinySkyAlt `initialize`/`browsers`/`computer`, SkyClient window2+full-desktop, api.json capability collections, most of `nodeRepl.*`, `request_user_input_async`), (2) marks the wrong `in_traces` bits by aliasing `tab`/`pt`/`linearApp`/`linear`/`ax`/`playwright`, (3) has **zero** `live_pass` rows while GOAL-STATUS treats live verification as finished.

`api.json` **interfaces** are the one closed subset (146/146). That is not completeness.

---

## Agents / files still required

Directories `agents/08`–`agents/12` are listed in `GOAL-STATUS.md` as in-flight and **are not on disk**. Do not mark complete until these exist and the catalog is rewritten against them.

| still required | job | why this skeptic cannot skip it |
|---|---|---|
| **Catalog rewrite** of `CAPABILITY-CATALOG.json` + `CAPABILITIES.md` | Add every `missing[]` id; split `in_traces` into `in_model_js` vs `internal_callee`; add `live_pass`/`live_fail`/`shape_ok`; stop double-counting Target vs AXAPI vs Playwright; record live bindings `tab`/`pt`/`linearApp`/`linear`. | Current JSON is the artifact under test. |
| `agents/08-crosscheck/CROSSCHECK.md` | Independent 01–07 FINDINGS vs raw.json contradictions (AXAPI.write, js? vs request_user_input_async/js_reset, pt vs tab). | `GOAL-STATUS` done-when #2; file missing. |
| `agents/09-unused-browser-capabilities/` | Catalog `BrowserCapabilityCollection` / `TabCapabilityCollection` + management/viewport/visibility/botDetection/browserAuth/cdp/pageAssets/webmcp methods with signatures from the docs + `api.json` types. | `GOAL-STATUS` remaining work; tinysky already calls `visibility.set`. |
| `agents/10-unused-native-ipc/` | Window2 + full-desktop sky methods; paste-vs-MCP; audio gate (`SKY_ENABLE_AUDIO`); IPC request types (`ComputerUseIPC*` Messages/Calendar/Skysight/EventStream/FrontmostWindow/StartCapture). | Catalog sky[] is Mac-window-only. |
| `agents/12-noderepl-plugins/` | Full privileged `nodeRepl.*` (config/fetch/rpc/nativePipe/launchServices/…); `js_add` vs `js_add_node_module_dir`; chrome/IAB claim (`BrowserUser.claimTab`, extension host). | `native/node-repl-tools.txt` is already a longer list than catalog.repl. |
| `agents/11-raw-reparse/` | One table: every `output_item.done` name + every identifier in `code` → **exactly one** catalog id. Must include `request_user_input_async`. | This report sampled; GOAL-STATUS done-when #3 is still false. |
| Live path **not** live_pass | V1–V7 already proved `-10000` / socket FIN / live_pass=0. A later agent may only flip `live_pass` with a **trusted** `nodeRepl.nativePipe` / ChatGPT-parent result file showing `list_apps` + Finder GetSkyshot **success**. Unsigned MCP `tools/list` must not be reused as live_pass. | `verify/API-MATRIX.md`, `verify/results/mcp-ndjson.json`. |
| Vendor types copy | `vendor/sky/types/{window2,full-desktop}/` are imported by `SkyClient.d.ts` but **absent** from vendor (only under `agents/02-sky-native/d.ts/types/`). | Catalog authors working from vendor/ will keep dropping window2/linux. |

Until the rewrite lands and CROSSCHECK has no unresolved API-map contradictions, treat `CAPABILITY-CATALOG.json` as a **partial index of api.json interfaces + Mac window sky + a truncated nodeRepl**, not a complete capability catalog.
