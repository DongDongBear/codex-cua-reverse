# V5 — Trace→API→live-proof matrix

**Verdict:** reconstruction of the **trace API set**, **tinysky → sky → IPC type/encoder**, and **browser-desktop (not IPC)** path is **shape-proven**. **No trace API is `live_pass`.** Native observation (`list_apps` / GetSkyshot) was attempted and **failed**. Mutating native APIs are `shape_ok` (types + IPC + encoder; not sent). Browser inventory was not live-bound. Unnamed `js?` rows are kept and are **not** CUA calls.

Canonical table: [`/Users/dongdong/Desktop/codex-cua-reverse/verify/API-MATRIX.md`](/Users/dongdong/Desktop/codex-cua-reverse/verify/API-MATRIX.md)

Status vocabulary: `live_pass` | `shape_ok` | `unknown` | `live_fail`.  
**`live_pass` is used only when I read a result file or command output showing success.** None of the 27 unique trace names qualify.

---

## 1. What I ran / read

Ran:

```
node /Users/dongdong/Desktop/codex-cua-reverse/verify/static-contract.mjs
```

Exit 0. Wrote `/Users/dongdong/Desktop/codex-cua-reverse/verify/results/static-contract.json` (`2026-09-10T10:54:01.115Z`): **22/22** `ok`, 0 unknown, 0 failed. That script covers `verify/trace-apis.json` only (not Playwright locator methods, not `js?`).

Live result files **read** (not produced by this agent except static-contract):

| File | ts | What it actually shows |
|---|---|---|
| `verify/results/static-contract.json` | 10:54:01 | All 22 named trace APIs type-ok; native IPC type **names** present in `native/ipc-request-types.txt` |
| `verify/results/native-ipc.json` | 11:01:43 (rewrite of the same fail) | sock exists; `ping` **socket closed**; `list_apps` / `get_app_state_finder` **30s timeout**; adversarial `ok:true` only because any reject counts — message is `socket closed`, **not** `-10013` |
| `verify/results/mcp-client.json` | 10:57:56 | Content-Length MCP: `initialize` and `tools/list` **timed out**. Client binary exists. |
| `verify/results/mcp-ndjson.json` | 10:59:32 | NDJSON MCP: `initialize` + `tools/list` **succeed**; `list_apps` and `get_app_state` return tool-error text |
| `verify/results/sky-shim.json` | 11:00:36 | Import/mapping/encode **ok**; live `listApps` / `getAppState_Finder` **fail**; Unix connect then **FIN, 0 inbound JSON-RPC bytes**; 5 outbound `ping`s |

Additional live artifacts read:

- `verify/agents/v3-mcp-client/probe.json` — NDJSON MCP `initialize`/`tools/list` pass; `tools/call:list_apps` and `get_app_state:Finder` return **`Computer Use server error -10000: Sender process is not authenticated`**
- `verify/agents/v1-native-ipc/independent-node.json` and `independent-python.json` — connect ok; after writing uint32le JSON-RPC frames, **EOF in ~20ms, recv_bytes=0** (same for CodexComputerUseIPC-5 and `-0`)
- `verify/agents/v1-native-ipc/identity.json` — `SkyComputerUseService` pid 3802 holds `computeruse.sock`; cua_node is team `2DC432GLL2`; generic node is unsigned
- `verify/agents/v4-browser/` — **empty** (no live browser inventory)

Did **not** replay Linear `click` / `typeText` / `setValue` / `paste` / `pressKey`. Did **not** dump screenshot bytes.

---

## 2. Unique APIs from traces

Source: `/Users/dongdong/Desktop/codex-cua-reverse/traces/all-js-calls.json` (39 events).  
Inventory: `/Users/dongdong/Desktop/codex-cua-reverse/verify/trace-apis.json` (37 `js` with `code` + **2 unnamed `js?` kept**).

`trace-apis.json`: `total_js_events: 39`, `with_code: 37`, `unnamed_question_duplicates: 2`, **22 named APIs**.

Extra unique names **in the code** but not split out in `trace-apis.json`:

- `tab.playwright.locator.fill` (4)
- `tab.playwright.locator.evaluate` (1)
- `tab.playwright.locator.press` (2)

Plus two `js?` rows (duplicates kept, different args).

**27 matrix rows.** No `sky.*` calls in any `code`. No `cua.createBrowserTab` / `cua.listBrowsers` / `tab.goto`.

---

## 3. Mapping that **is** proven (source + static-contract + encoder)

### 3.1 Native: tinysky Target → sky snake_case → IPC

From `/Users/dongdong/Desktop/codex-cua-reverse/agents/01-cua-tinysky/copies/oai_js_cua/tinysky_alt/create_tinysky_alt.pretty.js`:

- `cua.getApp(t)` requires `sky.target === "mac"`, calls `sky.get_app_state({ app: t, disableDiff: true })`, returns a façade bound to the **resolved** `i.app`.
- `cua.listApps()` → `sky.list_apps()`.
- `getAXState` / `getAXStateAndScreenshot` → `sky.get_app_state` with `disableDiffing` mapped to `disableDiff`.
- `getScreenshot` → `sky.get_app_state({ app })` then fetch screenshot URL.
- `click([x,y])` → `sky.click({ app, x, y, … })`; `click(index)` → `{ element_index }`.
- `pressKey` → `press_key`; `typeText` → `type_text`; `setValue` → `set_value`; `paste` → `paste` (default format `"text"`); `performSecondaryAction` → `perform_secondary_action`.

From `/Users/dongdong/Desktop/codex-cua-reverse/vendor/sky/js/mac-client.js` (and sky-shim encode checks):

| Mac client | `requestType` | `request.action` key |
|---|---|---|
| `listApps` | `ComputerUseIPCListAppsRequest` | (empty request) |
| `getAppState` | `ComputerUseIPCAppGetSkyshotRequest` | `{ app, disableDiff? }` |
| `click` / `typeText` / `setValue` / `paste` / `pressKey` / `performSecondaryAction` / … | `ComputerUseIPCAppPerformActionRequest` | `click` / `type` / `setValue` / `paste` / `pressKey` / `performSecondaryAction` |

Those type **names** exist in `/Users/dongdong/Desktop/codex-cua-reverse/native/ipc-request-types.txt`.

JS does **not** send `ComputerUseIPCAppStartRequest` for `getApp`; native GetSkyshot docs say the service may start a session internally. Policy `ComputerUseIPCAppPolicyRequest` is a JS gate on the sky client, not a trace-level API.

### 3.2 Browser: tinysky → `@oai/browser-desktop`, **not** CUA IPC

`cua.getBrowser` / `listTabs` / `getTab` / `tab.*` Target methods / `browser.tabs.get` / `tab.playwright` / `tab.dev.logs` are browser-desktop (`api.json`) + tinysky `decorateTab` (`tab.click` → `tab.ax.click`). No `ComputerUseIPC*` type.

`browser.tabs.get` returns a raw `BrowserTab` (`pt.playwright`, `pt.dev`). `cua.getTab` returns `Tab & Target`. Traces use **both** handles on the same IAB tab.

### 3.3 Encoder matches Linear traces (local, not live)

`verify/results/sky-shim.json` captured (Finder stand-in, **not successfully sent**):

- `click([119,35])` → `coordinate._0 = [119, 35]`, `clickCount: 1`, `mouseButton: 0`
- element click → `elementID._0 = "0"` (string)
- `typeText('Linear')` → `{ type: { _0: "Linear" } }` (not `typeText`)
- `setValue(128, …)` → `{ setValue: { elementID: "128", value } }`

This is **shape_ok**, not live_pass.

---

## 4. Live attempts — what is actually proven

### Native-pipe (reconstructed JSON-RPC)

Proven:

- Socket path exists: `~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock` (mode 0600).
- `SkyComputerUseService` (pid 3802) **holds** that socket (`identity.json` `lsof`).
- Independent clients **can connect**.
- After a uint32le-framed `ping` / `request`, the service **FINs with zero JSON-RPC bytes** (~20ms). Same for API version `CodexComputerUseIPC-5` and `CodexComputerUseIPC-0`.
- Bundled cua_node is team-signed `2DC432GLL2`; the verify process used unsigned/fnm node.

**Not proven:** a JSON-RPC `result` or `error` on the native-pipe. Therefore **not** proven: `ping` → `{ serverApiVersion }`, `list_apps` inventory, Finder skyshot, or `-10013 incompatibleClientVersion`.

`native-ipc.json` marks adversarial as `ok: true` with `rejected: true` / `message: "socket closed"`. GOAL allowed “clean transport error”, but **correct-version ping also closes**, so this does **not** prove version checking.

`sky-shim.json` `auth.note`: “Service accepted the Unix socket then FIN with zero JSON-RPC bytes. No ServerErrorCode on the wire.” Live `listApps`/`getAppState` then fail because the shim has no `nodeRepl.launchServices`.

### Official `SkyComputerUseClient mcp`

Proven:

- Binary exists and is signed (`com.openai.sky.CUAService.cli`, team `2DC432GLL2`).
- Transport that works here is **NDJSON JSON-RPC**, not LSP `Content-Length` (`mcp-client.json` timed out; `mcp-ndjson.json` / `probe.json` succeeded).
- `initialize` → serverInfo `name: "Computer Use"`, protocol `2024-11-05`.
- `tools/list` → 10 tools: `list_apps`, `get_app_state`, `click`, `perform_secondary_action`, `set_value`, `select_text`, `scroll`, `drag`, `press_key`, `type_text`.
- **No `paste`** on this MCP surface (tinysky traces **do** call `app.paste`). MCP is a **parallel** official client, not the js/tinysky path the traces used.
- `tools/call list_apps` and `get_app_state(Finder)` return **live native error `-10000`** (`senderProcessNotAuthenticated`). That code is in sky `ServerErrorCode` (`sky-shim.json` / `errors.js`). It proves the helper reached the Computer Use auth layer. It does **not** return apps or AX text.

MCP `element_index` schema is **string**; tinysky/sky `.d.ts` use **number**; IPC `elementID` is `String(index)`. Shape-consistent, not live-executed.

### Browser

No live `getBrowser` / `listTabs` / bind result. `verify/agents/v4-browser/` empty. Browser rows stay `shape_ok`.

---

## 5. Reconstruction claims — proven or not

| Claim | Status |
|---|---|
| The 37 `js` bodies in `traces/all-js-calls.json` are the CUA APIs the model used | **Proven** (file contents) |
| Keep two unnamed `js?` duplicates | **Proven** they exist; **not** executable CUA |
| Those `js?` rows are `request_user_input_async` and `js_reset` | **Not independently proven here** (no websocket jsonl in this workspace). Agent 05 `calls.json` asserts it; V5 does not upgrade that to live/static proof of the wire name |
| Named trace APIs ⊆ tinysky / sky / browser-desktop types | **Proven** (`static-contract.mjs` 22/22 + api.json for Playwright methods) |
| Native Target is a façade over Mac `sky.*` snake_case | **Proven** (`create_tinysky_alt.pretty.js`) |
| Mac sky client sends `ComputerUseIPCListAppsRequest` / `GetSkyshot` / `PerformAction` | **Proven** (`mac-client.js` + type names in `ipc-request-types.txt` + sky-shim capturedRequests) |
| PerformAction encoder matches Linear `click([119,35])` / index / `typeText` / `setValue` | **Proven locally** (sky-shim encode). **Not live-sent** |
| Traces used tinysky `cua.getApp` / `app.*`, not `sky.click({app})` | **Proven** (no `sky.` in trace code) |
| Browser APIs are `@oai/browser-desktop`, not native IPC | **Proven** (tinysky + api.json) |
| `getBrowser({url})` selects a browser and does not open a tab | **Proven from source/docs**, not live |
| Native-pipe is uint32le + JSON-RPC `ping`/`request`, API `CodexComputerUseIPC-5` | **Proven from `native-pipe.js`**. Live: frames were **written**; **no inbound RPC** |
| Live `ping` / `list_apps` / Finder `get_app_state` succeed on the socket | **False / live_fail** |
| Wrong API version yields `-10013` | **Not proven** (EOF for v5 and v0) |
| SkyComputerUseClient MCP `tools/list` matches window sky methods | **Mostly proven live** (10 tools). **Gaps:** no `paste`; no audio; MCP is not the trace transport |
| MCP `list_apps` / `get_app_state` return inventory / AX | **live_fail** (`-10000` unauthenticated sender) |
| `-10000` is `senderProcessNotAuthenticated` | **Proven** as a **code table** in `errors.js` / sky-shim; **and** as live MCP error text |
| Capture `-10005 noWindowsAvailable` on coordinate click | **Not proven by V5 live**. Agent 05 `calls.json` records it on two Linear clicks; sky maps `-10005` → `unknownError`. Not re-executed |
| `nodeRepl.write` is the REPL output API used in traces | **shape_ok** (docs + 10 uses in traces). Not live-replayed |
| Browser live inventory (`getBrowser` / `listTabs` / `getTab`) | **unknown as live**; **shape_ok** as types |

---

## 6. Per-row live result (trace APIs)

**`live_fail` (5)** — same live GetSkyshot / ListApps attempts:

- `cua.getApp`, `cua.listApps`, `app.getAXState`, `app.getScreenshot`, `app.getAXStateAndScreenshot`

**`shape_ok` (20)** — contract + encoder; mutating not sent; browser not live-bound:

- Native: `app.click`, `app.pressKey`, `app.typeText`, `app.setValue`, `app.paste`, `app.performSecondaryAction`
- Browser/REPL: `cua.getBrowser`, `cua.listTabs`, `cua.getTab`, `browser.browserId`, `browser.tabs.get`, `tab.click`, `tab.typeText`, `tab.getAXState`, `tab.dev.logs`, `tab.playwright.locator`, `.fill`, `.evaluate`, `.press`, `nodeRepl.write`

**`unknown` (2)** — `js?` questions, `js?` empty args

**`live_pass` (0)**

---

## 7. `js?` duplicates (kept)

From `traces/all-js-calls.json`:

1. `fc_05a61cc4349bad21016aa280a05f0487d081bb1e09838a7da0` — `args.questions[0].title` about the Linear issue. No `code`.
2. `fc_05a61cc4349bad21016aa280f6cf9887d08fe9980781dc6353` — `args: {}`. No `code`.

GOAL: “unnamed `js?` duplicates — kept in traces; not executable (empty args)”. Row 1 is also not executable CUA (questions payload).

---

## 8. Bottom line

The reconstructed **call graph** for captured desktop `js` is:

```
js code
  ├─ cua.* / App Target  →  sky.list_apps / sky.get_app_state / sky.click|type_text|… 
  │                         →  ComputerUseIPCListAppsRequest
  │                         →  ComputerUseIPCAppGetSkyshotRequest
  │                         →  ComputerUseIPCAppPerformActionRequest
  ├─ cua.getBrowser|listTabs|getTab / tab.* / playwright / dev.logs
  │                         →  @oai/browser-desktop (RPC setup/execute), not CUA IPC
  └─ nodeRepl.write         →  cua_node kernel
```

That graph is **proven from types + vendor JS + static-contract + local encoder**.

The reconstructed **native-pipe conversation** is **not live-proven**: the service is up and accepts the Unix connect, then closes with **no JSON-RPC body**. The official MCP client **is** live at `initialize`/`tools/list`, but read tools return **`-10000`** from this unsigned parent. Until a trusted cua_node/`nodeRepl` path returns apps + Finder AX (truncated), **do not claim live_pass** for any trace API.
