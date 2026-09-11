# FINDINGS — V2 `@oai/sky` Mac client + `nodeRepl.nativePipe` shim

**Agent:** verification V2  
**When:** 2026-09-10  
**Package:** `@oai/sky` **0.6.26** from ChatGPT.app `cua_node`  
**API version:** `CodexComputerUseIPC-5`  
**Safety:** Finder observation only. No Linear `click` / `typeText` / `setValue`. AX text truncated. No screenshot bytes written.

## Verdict

The JS wrapper reconstruction is **proven**.

1. The bundled `MacComputerUseClient` imported from ChatGPT.app through a `globalThis.nodeRepl.nativePipe` shim.
2. `listApps()` and `getAppState({ app: "Finder", disableDiff: true })` were **actually invoked**. They encode `ComputerUseIPCListAppsRequest` and `ComputerUseIPCAppGetSkyshotRequest` — the same IPC types `cua.listApps` / `cua.getApp` / `app.getAXState` use in the traces.
3. `click` / `typeText` / `setValue` encode `ComputerUseIPCAppPerformActionRequest` with `action.click` / `action.type` / `action.setValue`. Encoding was captured locally and **never sent**.
4. Every `WindowComputerUseClient` snake_case method has a camelCase twin on `MacComputerUseClient`. Tinysky `Target` is a third, bound, camelCase surface (`getAXState`, not `getAppState`).

Live native round-trip of `listApps` / `getAppState("Finder")` did **not** complete. The service accepted the Unix socket, the client wrote JSON-RPC `ping` `{ clientApiVersion: "CodexComputerUseIPC-5" }`, then the service sent FIN with **zero inbound bytes**. No JSON-RPC `error.code` was returned, so `SkyComputerUseError` / `ServerErrorCode` did not fire. JS wrapped the close as `SkyComputerUseTransportError: Sky Computer Use service startup request failed`.

The code that *would* apply if the service answered with a JSON-RPC auth error is **`senderProcessNotAuthenticated` = `-10000`**. Observed on the wire: silent close, `jsonRpcErrorCode: null`.

Harness: `/Users/dongdong/Desktop/codex-cua-reverse/verify/sky-shim.mjs`  
Result JSON: `/Users/dongdong/Desktop/codex-cua-reverse/verify/results/sky-shim.json`

---

## What ran

Shim (required surface):

```js
globalThis.nodeRepl.nativePipe.createConnection(path) -> Promise<net.Socket>
globalThis.nodeRepl.env.SKY_CUA_SERVICE_NATIVE_PIPE_PATH
apiVersion: "CodexComputerUseIPC-5"
```

Client import:

```
file:///Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/sky/dist/project/cua/sky_js/src/targets/mac/client.js
```

Errors:

```
.../targets/mac/errors.js
```

Live stack at the time of the call:

| Piece | State |
|---|---|
| Socket `~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock` | exists, `srw-------`, owner user |
| `SkyComputerUseService` | pid 3802, from `~/.codex/computer-use/Codex Computer Use.app` |
| ChatGPT.app | pid 3579 |
| Trusted `node_repl` | pids 5746 / 5769 (not used; shim is a standalone process) |
| Node used for the shim | ChatGPT `cua_node/bin/node` v24.20.0, team `2DC432GLL2` |

Calls (in order):

| Check | Result |
|---|---|
| import + shim | pass |
| method-name mapping vs `WindowComputerUseClient.d.ts` / tinysky `Target` | pass (`allWindowMethodsPresentOnMac: true`) |
| `client.listApps()` | invoked; IPC type captured; native ping FIN → `SkyComputerUseTransportError` |
| `client.getAppState({ app: "Finder", disableDiff: true })` | same |
| encode `click([119,35])` like Linear trace | pass, **not sent** |
| encode `click(elementIndex)` | pass, **not sent** |
| encode `typeText("Linear")` | pass, **not sent** |
| encode `setValue(128, …)` | pass, **not sent** |

---

## Three naming layers (do not collapse)

| Layer | Names | Binding | File |
|---|---|---|---|
| Public `sky` (`WindowComputerUseClient`) | **snake_case**: `list_apps`, `get_app_state`, `type_text`, `set_value`, `press_key`, `perform_secondary_action`, `select_text` | `{ app }` on every call | `/Users/dongdong/Desktop/codex-cua-reverse/vendor/sky/types/window/WindowComputerUseClient.d.ts` |
| Native JS client (`MacComputerUseClient`) | **camelCase**: `listApps`, `getAppState`, `typeText`, `setValue`, `pressKey`, `performSecondaryAction`, `selectText` | `{ app }` or bare string | ChatGPT.app `targets/mac/client.js` + `client.d.ts` |
| Tinysky `Target` (`cua.getApp` handle) | **camelCase**, bound app: `getAXState`, `getScreenshot`, `getAXStateAndScreenshot`, `typeText`, `setValue`, `pressKey` | app captured at `getApp` | `/Users/dongdong/Desktop/codex-cua-reverse/vendor/cua/types/tinysky_alt.types.d.ts` |

`create_client.js` builds the snake_case object from per-method wrappers (`list_apps.js`, `get_app_state.js`, `click.js`, …). Each wrapper calls `getClient()` → singleton `MacComputerUseClient` and translates `element_index` → `elementIndex`, `from_x` → `fromX`, `selection_type` → `selection`, `disableDiffing` → `disableDiff`.

Live prototype of the bundled class (this run):

```
listApps, startAudioRecording, stopAudioRecording, getAppPolicy, startApp,
getAppState, click, drag, paste, performSecondaryAction, pressKey, scroll,
setValue, selectText, typeText, performAction, request, getTransport, transport
```

Extras on `MacComputerUseClient` that are **not** on `WindowComputerUseClient`: `getAppPolicy`, `startApp` (policy / implicit-launch internals). Private: `performAction`, `request`, `getTransport`, `transport`.

### Snake → camel map (live `method_name_mapping`)

| `WindowComputerUseClient` | `MacComputerUseClient` | tinysky `Target` |
|---|---|---|
| `list_apps` | `listApps` | `cua.listApps` (not on `Target`) |
| `get_app_state` | `getAppState` | `getAXState` / `getScreenshot` / `getAXStateAndScreenshot` |
| `click` | `click` | `click` |
| `drag` | `drag` | `drag` |
| `paste` | `paste` | `paste` |
| `perform_secondary_action` | `performSecondaryAction` | `performSecondaryAction` |
| `press_key` | `pressKey` | `pressKey` |
| `scroll` | `scroll` | `scroll` |
| `select_text` | `selectText` | `selectText` |
| `set_value` | `setValue` | `setValue` |
| `type_text` | `typeText` | `typeText` |
| `start_audio_recording?` | `startAudioRecording` | — |
| `stop_audio_recording?` | `stopAudioRecording` | — |

Window snake_case ↔ Mac camelCase is **1:1** (`allWindowMethodsPresentOnMac: true`). Tinysky observation names are **not** `getAppState`; they wrap `sky.get_app_state`.

Trace → wrapper (`create_tinysky_alt.js`):

```
cua.getApp("Linear")
  → sky.get_app_state({ app: "Linear", disableDiff: true })
    → MacComputerUseClient.getAppState({ app, disableDiff: true })

app.getAXState({ disableDiffing })
  → sky.get_app_state({ app, disableDiff: disableDiffing })
    → MacComputerUseClient.getAppState

app.click([119, 35])
  → sky.click({ app, x: 119, y: 35 })
    → MacComputerUseClient.click({ app, x, y, clickCount: 1, mouseButton: "left" })

app.typeText(text) → sky.type_text → MacComputerUseClient.typeText
app.setValue(i, v) → sky.set_value → MacComputerUseClient.setValue
```

```14:29:/Users/dongdong/Desktop/codex-cua-reverse/vendor/sky/types/window/WindowComputerUseClient.d.ts
export type WindowComputerUseClient = {
    target: "mac";
    click: Click.Function;
    drag: Drag.Function;
    get_app_state: GetAppState.Function;
    list_apps: ListApps.Function;
    paste: Paste.Function;
    perform_secondary_action: PerformSecondaryAction.Function;
    press_key: PressKey.Function;
    scroll: Scroll.Function;
    select_text: SelectText.Function;
    set_value: SetValue.Function;
    type_text: TypeText.Function;
    start_audio_recording?: StartAudioRecording.Function;
    stop_audio_recording?: StopAudioRecording.Function;
};
```

```57:73:/Users/dongdong/Desktop/codex-cua-reverse/vendor/cua/types/tinysky_alt.types.d.ts
export interface Target {
    getAXState(options?: StateOptions): Promise<string>;
    getScreenshot(options?: ObservationOptions): Promise<Uint8Array>;
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
```

---

## Request types vs traces (client.js, independently inspected)

Bundled `client.js` constants (minified one-liner; names recovered from the file):

| JS const | `requestType` string |
|---|---|
| `r` | `ComputerUseIPCAppPolicyRequest` |
| `o` | `ComputerUseIPCStartAudioRecordingRequest` |
| `n` | `ComputerUseIPCStopAudioRecordingRequest` |
| `s` | `ComputerUseIPCAppGetSkyshotRequest` |
| `i` | `ComputerUseIPCListAppsRequest` |
| `u` | `ComputerUseIPCAppPerformActionRequest` |
| `p` | `ComputerUseIPCAppStartRequest` |

Method → IPC (from the same file):

| `MacComputerUseClient` | `requestType` | Body |
|---|---|---|
| `listApps` | `ComputerUseIPCListAppsRequest` | `{}` |
| `getAppState` | `ComputerUseIPCAppGetSkyshotRequest` | `{ app, disableDiff? }` |
| `getAppPolicy` | `ComputerUseIPCAppPolicyRequest` | `{ app }` |
| `startApp` | `ComputerUseIPCAppStartRequest` | `{ app }` |
| `click` / `typeText` / `setValue` / `paste` / `pressKey` / `scroll` / `drag` / `selectText` / `performSecondaryAction` | `ComputerUseIPCAppPerformActionRequest` | `{ app, action: { <key>: … } }` |
| audio start/stop | `ComputerUseIPCStartAudioRecordingRequest` / `Stop…` | `{ maxDurationMilliseconds? }` / `{}` |

Live capture from wrapping `MacComputerUseClient.prototype.request` **before** the transport ran:

```json
{ "requestType": "ComputerUseIPCListAppsRequest", "request": {}, "apiVersion": "CodexComputerUseIPC-5" }
{ "requestType": "ComputerUseIPCAppGetSkyshotRequest", "request": { "app": "Finder", "disableDiff": true }, "apiVersion": "CodexComputerUseIPC-5" }
```

That matches traces:

| Trace API | Example | IPC |
|---|---|---|
| `cua.listApps` | `await cua.listApps()` | `ComputerUseIPCListAppsRequest` |
| `cua.getApp` | `let linearApp = await cua.getApp("Linear")` | `ComputerUseIPCAppGetSkyshotRequest` (`disableDiff: true`) |
| `app.getAXState` | `await linearApp.getAXState()` | `ComputerUseIPCAppGetSkyshotRequest` |
| `app.getAXStateAndScreenshot` | `await linearApp.getAXStateAndScreenshot()` | same |
| `app.getScreenshot` | `await linearApp.getScreenshot()` | same |
| `app.click` / `typeText` / `setValue` / `paste` / `pressKey` / `performSecondaryAction` | Linear issue session | `ComputerUseIPCAppPerformActionRequest` |

`getApp` / `getAXState*` are **not** a separate native “get app” RPC. They are all GetSkyshot. `startApp` exists on the Mac client but public `sky.get_app_state` does not call it; launch is inside GetSkyshot.

---

## Action encoding (shape-only; not sent)

`performAction(app, action, options)` always sends:

```js
{ app, action }  // requestType ComputerUseIPCAppPerformActionRequest
```

Captured encodings (Finder dummy target, `__dryRun` short-circuit so native never saw them):

**`app.click([119, 35])`** (Linear trace “打开 issue 创建窗口”):

```json
{
  "app": "Finder",
  "action": {
    "click": {
      "at": { "coordinate": { "_0": [119, 35] } },
      "clickCount": 1,
      "mouseButton": 0
    }
  }
}
```

**`app.click(elementIndex)`**:

```json
{
  "action": {
    "click": {
      "at": { "elementID": { "_0": "0" } },
      "clickCount": 1,
      "mouseButton": 0
    }
  }
}
```

XOR: `elementIndex` present → `elementID._0 = String(index)`; else `coordinate._0 = [x, y]`. Mouse: `left/l`→0, `right/r`→1, `middle/m`→2. Default clickCount 1.

**`app.typeText("Linear")`**:

```json
{ "action": { "type": { "_0": "Linear" } } }
```

Key is **`type`**, not `typeText`.

**`app.setValue(128, value)`**:

```json
{ "action": { "setValue": { "elementID": "128", "value": "shape-only" } } }
```

`elementID` is a **string** of the integer index.

Same file, not live-called (source only):

| JS method | `action` key | Payload |
|---|---|---|
| `pressKey` | `pressKey` | `{ _0: key }` |
| `paste` | `paste` | `{ text, format }` |
| `performSecondaryAction` | `performSecondaryAction` | `{ action, elementID }` |
| `scroll` | `scroll` | `{ at: elementID\|coordinate, direction, pages }` |
| `drag` | `drag` | `{ from: [x,y], to: [x,y] }` |
| `selectText` | `selectText` | `{ elementID, text, prefix, suffix, selection }` |

Wire field for select is `selection`, not Window type’s `selection_type`.

---

## Transport the shim satisfied

`native-pipe.js` requires `globalThis.nodeRepl` and:

1. `nodeRepl.nativePipe.createConnection(path)` returning a thenable `net.Socket` (`on`/`off`/`write`/`end`).
2. `nodeRepl.env.SKY_CUA_SERVICE_NATIVE_PIPE_PATH`, else  
   `~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock`.
3. Framing: little-endian u32 length + UTF-8 JSON-RPC 2.0, max 8 MiB.
4. Handshake `ping` `{ clientApiVersion }` must echo `serverApiVersion`. Default **`CodexComputerUseIPC-5`**.
5. `request` params: `{ clientApiVersion, codexTurnMetadata, deadlineUnixMilliseconds, request, requestType }`.

This run: five outbound pings, all `clientApiVersion: "CodexComputerUseIPC-5"`, **no inbound frames**.

If the first 250 ms of connect+ping fails, the library tries `NODE_REPL_HOST_SERVICES_PIPE_PATH` `ensureService` or `nodeRepl.launchServices.openApplication`. The shim did not provide `launchServices`, so the JS error became:

```
SkyComputerUseTransportError
  message: Sky Computer Use service startup request failed
  cause: Error: Sky Computer Use requires nodeRepl.launchServices support
```

That outer message is a **fallback after ping/close**, not evidence the socket was missing. Socket existed; connect succeeded; ping was written; peer FINed in ~25 ms with 0 bytes.

Raw ping with the same signed `cua_node` (no wrapper) reproduced it: connect → write ping → `end` / `close hadError false`, no `data`.

---

## Auth failure and `ServerErrorCode`

Imported live from bundled `errors.js`:

| name | code |
|---|---:|
| `senderProcessNotAuthenticated` | **-10000** |
| `couldNotGetRequestData` | -10001 |
| `couldNotGetRequestTypeName` | -10002 |
| `couldNotResolveRequestType` | -10003 |
| `unhandledEvent` | -10004 |
| `unknownError` | -10005 |
| `appNotAllowed` | -10006 |
| `runningApplicationNotFound` | -10007 |
| `accessibilityError` | -10008 |
| `permissionsNotGranted` | -10009 |
| `invalidApp` | -10010 |
| `noActiveSession` | -10011 |
| `userStoppedSession` | -10012 |
| `incompatibleClientVersion` | -10013 |
| `permissionsPending` | -10014 |
| `blockedURL` | -10015 |
| `userIntervened` | -10016 |
| `couldNotGetSenderPID` | -10017 |
| `ambiguousApp` | -10018 |
| `couldNotGetBootstrapPort` | -10019 |
| `screenLocked` | -10020 |

`SkyComputerUseError` sets `errorName` from this table when a JSON-RPC `error.code` arrives. `incompatibleClientVersion` (-10013) is special-cased in `native-pipe.js` (no retry).

**This run did not receive a JSON-RPC error.** `auth.jsonRpcErrorCode === null`. The class that threw is `SkyComputerUseTransportError`, not `SkyComputerUseError`.

Native binary strings (local `strings` on `SkyComputerUseService`, no probing): `senderProcessNotAuthenticated`, `incompatibleClientVersion`, analytics reasons `MISSING_PARENT` / `UNTRUSTED_PARENT` / `RELAY_WITHOUT_TRUSTED_ANCESTOR`. Allowed-looking host ids include `com.openai.codex{,.alpha,.beta,.dev,.nightly}`. The shim’s parent is not ChatGPT; `cua_node` is team-signed `2DC432GLL2` but that is not sufficient. Same-uid + mode `0600` is enough to **connect**; the service then drops the peer.

If a trusted `node_repl` (child of ChatGPT, already running) called the same client, ping would be expected to succeed and `listApps` / `getAppState("Finder")` would be the live observation path. This agent did not inject into that REPL.

Independent native harness (`verify/native-ipc.mjs`, same socket) also got `ping` → `socket closed` with `rpc: null`, then list/skyshot timeouts. Confirms the close is at the service, not a bug in the JS wrapper.

---

## Safety record

- Live methods: `listApps`, `getAppState("Finder")` only. Both died at ping, so Finder was never observed and no AX / screenshot payload existed to truncate.
- `click` / `typeText` / `setValue` used Finder as a dummy `app` string and `__dryRun` so `ComputerUseIPCAppPerformActionRequest` was **not** written to the socket.
- No Linear window actions.
- Result JSON stores truncated text heads and screenshot scheme only; no `data:` / `file:` bytes.

---

## Evidence paths

| Path | What |
|---|---|
| `/Users/dongdong/Desktop/codex-cua-reverse/verify/sky-shim.mjs` | Shim + harness |
| `/Users/dongdong/Desktop/codex-cua-reverse/verify/results/sky-shim.json` | Live report |
| `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/sky/dist/project/cua/sky_js/src/targets/mac/client.js` | Request types + encoders |
| `.../native-pipe.js` | Pipe, ping, framing |
| `.../errors.js` | `ServerErrorCode` |
| `.../create_client.js`, `list_apps.js`, `get_app_state.js`, `click.js`, `type_text.js`, `set_value.js` | snake_case → camelCase |
| `/Users/dongdong/Desktop/codex-cua-reverse/vendor/sky/types/window/WindowComputerUseClient.d.ts` | Public sky API |
| `/Users/dongdong/Desktop/codex-cua-reverse/vendor/cua/types/tinysky_alt.types.d.ts` | tinysky `Target` |
| `/Users/dongdong/Desktop/codex-cua-reverse/vendor/cua/js/create_tinysky_alt.js` | `cua.getApp` / `getAXState` mapping |
| `/Users/dongdong/Desktop/codex-cua-reverse/verify/trace-apis.json` | Trace API inventory |
| `/Users/dongdong/Desktop/codex-cua-reverse/native/ipc-request-types.txt` | Native Swift type names |

---

## Remaining gap

JS wrapper shape is proven. A **successful** GetSkyshot of Finder still needs a sender the service will authenticate (ChatGPT-hosted `node_repl.nativePipe`, not a standalone Node even when the binary is OpenAI-signed). Until then, live AX text for Finder is unverified by this agent. That is an auth boundary, not a reconstruction miss.
