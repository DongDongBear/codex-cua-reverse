# Trace → tinysky → sky → IPC → live-proof matrix

Status vocabulary (one value per row):

| Status | Meaning |
|---|---|
| `live_pass` | A result file or command output **I read** shows the API succeeding against the live stack. **None in this matrix.** |
| `shape_ok` | Types + (where native) IPC request type + JS encoder match traces. Live success was **not** obtained (mutating APIs were not sent; browser inventory was not live-bound). |
| `live_fail` | Live attempt targeting this API (or the same IPC) ran and **failed**. |
| `unknown` | Not a CUA API / not executable from the `js?` capture rows. |

Columns: **trace name** | **tinysky method** | **sky method** | **IPC request type** | **live result** | **evidence path**

`sky.*` is unused in traces. Native rows show the sky method **tinysky calls**. Browser / REPL rows have no sky method and no `ComputerUseIPC*` type.

Counts in notes come from `verify/trace-apis.json` (invocation counts) unless marked otherwise.

---

## Native surface (task-2 Linear)

| trace name | tinysky method | sky method | IPC request type | live result | evidence path |
|---|---|---|---|---|---|
| `cua.getApp` | `cua.getApp(target)` → `App` | `sky.get_app_state({ app, disableDiff: true })` then bind | `ComputerUseIPCAppGetSkyshotRequest` | `live_fail` | `verify/results/static-contract.json`; `vendor/cua` tinysky `getApp`; `verify/results/native-ipc.json` (`get_app_state_finder` timeout); `verify/results/sky-shim.json` (`getAppState_Finder` startup fail; encode `{app, disableDiff:true}`); `verify/results/mcp-ndjson.json` (`get_app_state` → `-10000`) |
| `cua.listApps` | `cua.listApps()` | `sky.list_apps()` | `ComputerUseIPCListAppsRequest` | `live_fail` | `verify/results/static-contract.json`; tinysky `listApps`; `verify/results/native-ipc.json` (`list_apps` timeout); `verify/results/sky-shim.json` (`listApps` fail; captured `ComputerUseIPCListAppsRequest {}`); `verify/results/mcp-ndjson.json` (`list_apps` → `-10000`) |
| `app.getAXState` | `App.getAXState(opts?)` | `sky.get_app_state({ app, disableDiff? })` → `.text` | `ComputerUseIPCAppGetSkyshotRequest` | `live_fail` | tinysky Target; `vendor/sky/types/window/GetAppState.d.ts`; same live files as `cua.getApp` |
| `app.getScreenshot` | `App.getScreenshot(opts?)` | `sky.get_app_state({ app })` → screenshot URL → bytes | `ComputerUseIPCAppGetSkyshotRequest` | `live_fail` | tinysky Target; same live GetSkyshot attempts (Finder only; no image bytes dumped) |
| `app.getAXStateAndScreenshot` | `App.getAXStateAndScreenshot(opts?)` | `sky.get_app_state({ app, disableDiff? })` → `{ text, screenshot }` | `ComputerUseIPCAppGetSkyshotRequest` | `live_fail` | tinysky Target; same live GetSkyshot attempts |
| `app.click` | `App.click(index \| [x,y], opts?)` | `sky.click({ app, element_index \| x,y, mouse_button?, click_count? })` | `ComputerUseIPCAppPerformActionRequest` | `shape_ok` | static-contract; tinysky `click` → `sky.click`; `vendor/sky/js/mac-client.js` `action.click`; `verify/results/sky-shim.json` `encode_click_coord_like_trace` `[119,35]` and `encode_click_element_like_trace` (not sent) |
| `app.pressKey` | `App.pressKey(key)` | `sky.press_key({ app, key })` | `ComputerUseIPCAppPerformActionRequest` | `shape_ok` | static-contract; tinysky `pressKey` → `press_key`; mac-client `{ pressKey: { _0: key } }` (not live-sent) |
| `app.typeText` | `App.typeText(text)` | `sky.type_text({ app, text })` | `ComputerUseIPCAppPerformActionRequest` | `shape_ok` | static-contract; tinysky `typeText` → `type_text`; sky-shim `encode_typeText_like_trace` `{ type: { _0: "Linear" } }` (not sent) |
| `app.setValue` | `App.setValue(index, value)` | `sky.set_value({ app, element_index, value })` | `ComputerUseIPCAppPerformActionRequest` | `shape_ok` | static-contract; tinysky `setValue` → `set_value`; sky-shim `encode_setValue_like_trace` `{ setValue: { elementID: "128", value } }` (not sent) |
| `app.paste` | `App.paste(text, { format? })` | `sky.paste({ app, text, format })` | `ComputerUseIPCAppPerformActionRequest` | `shape_ok` | static-contract; tinysky default `format: "text"`; mac-client `{ paste: { text, format } }`. Official MCP `tools/list` does **not** advertise `paste`. Not live-sent. |
| `app.performSecondaryAction` | `App.performSecondaryAction(index, action)` | `sky.perform_secondary_action({ app, element_index, action })` | `ComputerUseIPCAppPerformActionRequest` | `shape_ok` | static-contract; tinysky → `perform_secondary_action`; mac-client `{ performSecondaryAction: { action, elementID } }`. MCP schema has this tool. Not live-sent. |

## Browser surface (task-1 Ant Design Form)

| trace name | tinysky method | sky method | IPC request type | live result | evidence path |
|---|---|---|---|---|---|
| `cua.getBrowser` | `cua.getBrowser({ id?, url? })` | — | — | `shape_ok` | `vendor/cua/types/tinysky_alt.types.d.ts`; tinysky `getBrowser` → `browsers.get` / `getForUrl` / `getDefault` (does **not** open a tab); `vendor/browser-desktop/api.json` `Browsers.get`. No live browser-inventory result file. |
| `cua.listTabs` | `cua.listTabs({ browser? })` | — | — | `shape_ok` | tinysky `listTabs`; `api.json` `Tabs.list`. No live bind. |
| `cua.getTab` | `cua.getTab(id, { browser? })` | — | — | `shape_ok` | tinysky `getTab` → `tabs.list` + `tabs.get` (decorated `Tab & Target`). No live bind. |
| `browser.browserId` | `Browser.browserId` (property) | — | — | `shape_ok` | `api.json` `Browser.browserId`; traces `browser.browserId`. Not a call. |
| `browser.tabs.get` | `Browser.tabs.get(id)` (raw `BrowserTab`, not Target) | — | — | `shape_ok` | `api.json` `Tabs.get`; trace `pt = await browser.tabs.get("1")`. No live bind. |
| `tab.click` | `Tab.click` → `tab.ax.click` | — | — | `shape_ok` | tinysky `decorateTab`; `tinysky-alt-core-cua-repl.md` `Target.click`. Browser RPC, not CUA IPC. |
| `tab.typeText` | `Tab.typeText` → `tab.ax.typeText` | — | — | `shape_ok` | `decorateTab`; Target types. |
| `tab.getAXState` | `Tab.getAXState` → `tab.ax.get("state")` | — | — | `shape_ok` | `decorateTab`; Target types. `{ emit:false }` used in traces. |
| `tab.dev.logs` | `Tab.dev.logs` (`TabDevAPI`) | — | — | `shape_ok` | `api.json` `TabDevAPI.logs`; trace `pt.dev.logs({levels:["log"],limit:5})`. |
| `tab.playwright.locator` | `Tab.playwright.locator(selector)` | — | — | `shape_ok` | `api.json` `PlaywrightAPI.locator` → `PlaywrightLocator`. 7 locator() calls in traces. |
| `tab.playwright.locator.fill` | `PlaywrightLocator.fill(value)` | — | — | `shape_ok` | `api.json` `PlaywrightLocator.fill`. 4 fills in traces. Not in `trace-apis.json` as its own name. |
| `tab.playwright.locator.evaluate` | `PlaywrightLocator.evaluate(fn)` | — | — | `shape_ok` | `api.json` `PlaywrightLocator.evaluate`. 1 call. |
| `tab.playwright.locator.press` | `PlaywrightLocator.press(key)` | — | — | `shape_ok` | `api.json` `PlaywrightLocator.press`. 2 presses in one `js` call. |

## REPL / capture artifacts

| trace name | tinysky method | sky method | IPC request type | live result | evidence path |
|---|---|---|---|---|---|
| `nodeRepl.write` | `nodeRepl.write(value)` (kernel, not tinysky Target) | — | — | `shape_ok` | `vendor/cua/docs/tinysky-alt-core-cua-repl.md` Output; `vendor/plugins/unified-computer-use/js-output-description.md`; `native/node-repl-tools.txt`. No live REPL write result. |
| `js?` (questions) | — | — | — | `unknown` | `traces/all-js-calls.json` item `fc_05a61cc4349bad21016aa280a05f0487d081bb1e09838a7da0`: `name=js?`, `call_id=null`, `event=response.function_call_arguments.done`, `args.questions`. Not CUA `code`. Kept as unnamed duplicate. |
| `js?` (empty args) | — | — | — | `unknown` | `traces/all-js-calls.json` item `fc_05a61cc4349bad21016aa280f6cf9887d08fe9980781dc6353`: `name=js?`, `args={}`. Not executable CUA. Kept as unnamed duplicate. |

---

## Live-proof summary (trace APIs only)

| live result | n | APIs |
|---|---:|---|
| `live_pass` | 0 | — |
| `live_fail` | 5 | `cua.getApp`, `cua.listApps`, `app.getAXState`, `app.getScreenshot`, `app.getAXStateAndScreenshot` |
| `shape_ok` | 20 | native mutating (`click` / `pressKey` / `typeText` / `setValue` / `paste` / `performSecondaryAction`); all browser/REPL names above |
| `unknown` | 2 | both `js?` rows |

Official MCP `initialize` + `tools/list` **did** succeed (`verify/results/mcp-ndjson.json`). That is not a trace API. MCP `list_apps` / `get_app_state` returned native `-10000` (`senderProcessNotAuthenticated`), so they do **not** upgrade native observation rows to `live_pass`.

---

## Encoder payloads that match traces (local JS, not live)

From `verify/results/sky-shim.json` `capturedRequests` / encode checks (Finder stand-in; **not sent** after ping FIN):

| Trace shape | IPC `request.action` |
|---|---|
| `app.click([119,35])` | `{ click: { at: { coordinate: { _0: [119, 35] } }, clickCount: 1, mouseButton: 0 } }` |
| `app.click(0)` (element index) | `{ click: { at: { elementID: { _0: "0" } }, clickCount: 1, mouseButton: 0 } }` |
| `app.typeText('Linear')` | `{ type: { _0: "Linear" } }` |
| `app.setValue(128, …)` | `{ setValue: { elementID: "128", value } }` |

From `vendor/sky/js/mac-client.js` (not in sky-shim encode checks):

| Trace shape | IPC `request.action` |
|---|---|
| `app.pressKey(key)` | `{ pressKey: { _0: key } }` |
| `app.paste(text, { format })` | `{ paste: { text, format } }` |
| `app.performSecondaryAction(i, action)` | `{ performSecondaryAction: { action, elementID: String(i) } }` |
