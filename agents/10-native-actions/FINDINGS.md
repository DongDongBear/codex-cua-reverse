# FINDINGS — native actions traces did not fully exercise

Local sources only. No live Linear clicks, no exploits, no new IPC against the service.

Traces (`agents/05-traces`) used native Target via `cua.getApp`: `getScreenshot`, `getAXState`, `getAXStateAndScreenshot`, `click(index|[x,y])`, `typeText`, `setValue`, `paste`, `pressKey`, `performSecondaryAction`, plus `cua.getApp` / `cua.listApps`. They never called `drag`, `scroll`, `selectText`, or audio, and never called `sky.*` snake_case. Coordinate `click([119,35])` failed twice as `Computer Use server error -10005: noWindowsAvailable`.

This file is the missing wire contract: tinysky Target → `sky.*` twins → `MacComputerUseClient` → JSON-RPC `ComputerUseIPCAppPerformActionRequest` (and the non-action request types those twins use).

---

## Verdict

All unused native Target methods are thin aliases of Mac `sky.*`. Every app-targeted `sky.*` call (except `list_apps` and audio) goes through `withComputerUsePolicy`, then one length-prefixed JSON-RPC 2.0 `request` on `computeruse.sock`, API `CodexComputerUseIPC-5`.

| Target (traces / tinysky) | `sky.*` (snake_case) | IPC `requestType` | `action` discriminator |
|---|---|---|---|
| `app.drag([x1,y1],[x2,y2])` | `sky.drag` | `ComputerUseIPCAppPerformActionRequest` | `drag` |
| `app.scroll(i\|[x,y], dir, pages?)` | `sky.scroll` | same | `scroll` |
| `app.selectText(i, text, opts?)` | `sky.select_text` | same | `selectText` |
| *(not on Target)* | `sky.start_audio_recording?` | `ComputerUseIPCStartAudioRecordingRequest` | — |
| *(not on Target)* | `sky.stop_audio_recording?` | `ComputerUseIPCStopAudioRecordingRequest` | — |

Audio methods exist on `sky` only when `SKY_ENABLE_AUDIO=1`. Tinysky `Target` / `App` has **no** audio. `SkyComputerUseClient` MCP also has **no** paste and **no** audio; it does expose `drag` / `scroll` / `select_text` as snake_case tools.

`-10005` is **not** a dedicated `noWindowsAvailable` IPC code. JS `ServerErrorCode.unknownError === -10005`. Native wraps inner window/AX failures (case name `noWindowsAvailable`) as that code; the JSON-RPC **message** is the inner case name. The model-visible string is `Computer Use server error -10005: noWindowsAvailable`.

---

## 1. Three name layers (do not mix)

```
tinysky Target (camelCase, app bound)
  app.drag([x1,y1],[x2,y2])
  app.scroll(i | [x,y], direction, pages?)
  app.selectText(i, text, { prefix?, suffix?, selectionType? })
        │
        ▼
public sky (snake_case, app: in every call)
  sky.drag({ app, from_x, from_y, to_x, to_y })
  sky.scroll({ app, element_index? | x,y, direction, pages? })
  sky.select_text({ app, element_index, text, prefix?, suffix?, selection_type? })
        │  withComputerUsePolicy  →  app rewritten to appPath
        ▼
MacComputerUseClient (camelCase)
  client.drag({ app, fromX, fromY, toX, toY })
  client.scroll({ app, elementIndex?, x?, y?, direction, pages? })
  client.selectText({ app, elementIndex, text, prefix?, suffix?, selection? })
        │
        ▼
JSON-RPC requestType ComputerUseIPCAppPerformActionRequest
  { app, action: { drag | scroll | selectText | …: {…} } }
```

`create_client.js` installs the snake_case object (`target: "mac"`). Trusted REPL does not run those functions in-process: `sky.js` RPCs `{ type: "execute", method, args }` to `@oai/sky/service` `handleRpc`, which calls the real client. Linux-only `drag_handle` is split into `drag_start` / `drag_move` / `drag_end`; Mac has no handle.

Tinysky mapping (`create_tinysky_alt.js`), Mac-only (`sky.target === "mac"` or throw `Native app bindings are unavailable for ${target}.`):

| Target | `sky` call |
|---|---|
| `drag(from, to)` | `{ app, from_x: from[0], from_y: from[1], to_x: to[0], to_y: to[1] }` — **must** be arrays; `{x,y}` would be treated as `element_index` |
| `scroll(t, direction, pages?)` | array `t` → `{ x: t[0], y: t[1] }`; else `{ element_index: t }`; `pages` omitted when undefined |
| `selectText(i, text, o?)` | `{ element_index: i, text, prefix?, suffix?, selection_type: o.selectionType }` |
| `click(t, { mouseButton, clickCount })` | array → `{ x, y }`; else `{ element_index }`; `mouse_button` / `click_count` |
| `paste(text, { format })` | `{ text, format: format ?? "text" }` |
| `pressKey(key)` / `typeText(text)` / `setValue(i,v)` / `performSecondaryAction(i,a)` | snake_case twins |

`cua.getApp(name)` first calls `sky.get_app_state({ app: name, disableDiff: true })`, then binds Target methods to the **returned** `state.app` (after policy rewrite this is `appPath`).

Snake_case wrappers (`targets/mac/{drag,scroll,select_text,click,…}.js`) only rename fields and wrap policy:

```js
// drag.js
withComputerUsePolicy("drag", input, (e) =>
  client.drag({ app: e.app, fromX: e.from_x, fromY: e.from_y, toX: e.to_x, toY: e.to_y }))

// scroll.js
withComputerUsePolicy("scroll", input, (i) =>
  client.scroll({ app: i.app, direction: i.direction, elementIndex: i.element_index, pages: i.pages, x: i.x, y: i.y }))

// select_text.js  — public selection_type → client.selection
withComputerUsePolicy("select_text", input, (t) =>
  client.selectText({ app: t.app, elementIndex: t.element_index, text: t.text,
                      prefix: t.prefix, suffix: t.suffix, selection: t.selection_type }))
```

---

## 2. Transport envelope (`native-pipe.js`)

Socket, in order: `SKY_CUA_SERVICE_NATIVE_PIPE_PATH`, else `~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock`. Connect via `nodeRepl.nativePipe.createConnection`. Framing: **uint32 little-endian length + UTF-8 JSON**, max **8 MiB**. JSON-RPC 2.0. One in-flight RPC per transport (serialized promise chain). Default timeout **120 s**. `id` starts at 1.

If connect/ping fails: `ensureService` `{ service: "computer-use" }` on `NODE_REPL_HOST_SERVICES_PIPE_PATH` (JSON-RPC id 0, 5 s), else `nodeRepl.launchServices.openApplication` (`SKY_CUA_SERVICE_PATH` / `$CODEX_HOME/computer-use/Codex Computer Use.app` / `{ bundleIdentifier: "com.openai.sky.CUAService" }`).

### Ping (handshake)

```json
{ "id": 1, "jsonrpc": "2.0", "method": "ping",
  "params": { "clientApiVersion": "CodexComputerUseIPC-5" } }
```

Result must have `serverApiVersion === clientApiVersion`, else `SkyComputerUseTransportError` (version mismatch) / JS maps native `-10013` `incompatibleClientVersion`. Native also has JSON-RPC method `close` (JS never sends it).

### Request

```json
{
  "id": 2,
  "jsonrpc": "2.0",
  "method": "request",
  "params": {
    "clientApiVersion": "CodexComputerUseIPC-5",
    "codexTurnMetadata": { },
    "deadlineUnixMilliseconds": 0,
    "requestType": "ComputerUseIPCAppPerformActionRequest",
    "request": { }
  }
}
```

- `deadlineUnixMilliseconds` = `Date.now() + timeoutSeconds * 1000` (default 120 s).
- `codexTurnMetadata`: `options.codexMetadata` else client constructor else `nodeRepl.requestMeta["x-codex-turn-metadata"]` (string JSON parsed; bytes decoded as UTF-8 JSON). Native field names nearby: `session_id`, `turn_id`, `turn_started_at_unix_ms`, `reasoning_effort`, `user_input_requested_during_turn`.
- `request` is recursively stripped of `undefined` (`A()` in `mac-client.js`). `null` is kept.
- Success: `{ "jsonrpc": "2.0", "id": N, "result": … }`.
- Failure: `{ "jsonrpc": "2.0", "id": N, "error": { "code": <int>, "message": "<string>" } }`. JS requires both `code` (number) and `message` (string); no `data` field is read. Becomes `SkyComputerUseError { code, errorName, message, request: null, requestType: "jsonRPC" }`.

`requestType` values this JS client sends:

| JS method | `requestType` | `request` body |
|---|---|---|
| `listApps` | `ComputerUseIPCListAppsRequest` | `{}` |
| `getAppPolicy` | `ComputerUseIPCAppPolicyRequest` | `{ "app": "<string>" }` |
| `startApp` | `ComputerUseIPCAppStartRequest` | `{ "app": "<string>" }` — **not** called by public `sky.*` |
| `getAppState` | `ComputerUseIPCAppGetSkyshotRequest` | `{ "app": "<string>", "disableDiff": <bool>? }` |
| actions | `ComputerUseIPCAppPerformActionRequest` | `{ "app": "<string>", "action": { … } }` |
| `startAudioRecording` | `ComputerUseIPCStartAudioRecordingRequest` | `{ "maxDurationMilliseconds": <int> }` |
| `stopAudioRecording` | `ComputerUseIPCStopAudioRecordingRequest` | `{}` |

Empty `app` (null / whitespace) throws JS `TypeError("app is required")` before IPC.

---

## 3. `ComputerUseIPCAppPerformActionRequest`

Swift: `init(app: String, action: ComputerUseIPCAction)`.

Native `ComputerUseIPCAction` case names (coding-key dump + JS encoder, same order):

`click`, `performSecondaryAction`, `setValue`, `selectText`, `scroll`, `drag`, `pressKey`, `type`, `paste`

Encoded as a **single-key object** (Swift enum with associated values). Result type `ComputerUseIPCActionResult` is `{ app: ComputerUseIPCApp, skyshot?: ComputerUseIPCSkyshot }`. Public `sky.*` / Target treat actions as `Promise<void>` and discard it.

`ComputerUseIPCLocationSpecifier` (click / scroll `at`):

```json
{ "elementID":  { "_0": "<decimal string of integer index>" } }
{ "coordinate": { "_0": [ <x number>, <y number> ] } }
```

`_0` is Swift’s unlabeled associated-value coding key. `elementIndex` present (including `0`) **wins**; coordinates are not sent. If `elementIndex` is omitted, both `x` and `y` must be finite numbers (`TypeError` otherwise). Index must be a JS integer (`Number.isInteger`); it is sent as a **string**. Coordinates are `Number(x/y)` (finite, not required to be integers). Native `AppController.click(at: [Int]?, …)` truncates later.

### 3.1 `drag` — unused in traces

Public:

```ts
sky.drag({ app: string, from_x: number, from_y: number, to_x: number, to_y: number })
app.drag([from_x, from_y], [to_x, to_y])
```

IPC (after policy rewrite of `app` → `appPath`):

```json
{
  "app": "/Applications/Linear.app",
  "action": {
    "drag": {
      "from": [119, 35],
      "to": [400, 200]
    }
  }
}
```

No `LocationSpecifier`, no element index, no mouse button. Native implements drag as `ComputerUseAppController.click(at:from, with:mouseButton, clickCount:, andDragTo:to, returnSkyshot:)`. Synthesized path: `AccessibilitySupport.SynthesizedEvent.click(at:andDragTo:mouseButton:count:…)`.

JS `TypeError` if any of the four coords is non-finite.

MCP tool `drag` (SkyComputerUseClient, not traces): required `app, from_x, from_y, to_x, to_y`; description “pixel coordinates”.

### 3.2 `scroll` — unused in traces

Public:

```ts
sky.scroll({
  app: string,
  direction: "up"|"down"|"left"|"right"|"u"|"d"|"l"|"r",
  pages?: number,            // default 1; JS: finite and > 0 (fractional allowed)
  element_index?: number,
  x?: number, y?: number
})
app.scroll(elementIndex | [x, y], direction, pages?)
```

IPC:

```json
{
  "app": "/Applications/Linear.app",
  "action": {
    "scroll": {
      "at": { "elementID": { "_0": "42" } },
      "direction": "down",
      "pages": 1
    }
  }
}
```

Coordinate form:

```json
"at": { "coordinate": { "_0": [640, 480] } }
```

Direction aliases are normalized **before** IPC (`u`/`up` → `"up"`, etc.). Invalid → `TypeError("direction must be up, down, left, or right")`. `pages` default 1; `TypeError("pages must be a finite number > 0")` otherwise.

Native `AppController.scroll(deltaX: Int, deltaY: Int)` — IPC `direction` + `pages` is converted server-side to integer deltas. Native error `invalidScrollPages` exists alongside JS validation. `noScrollDirection` / `noScrollAmount` are AppController errors.

**MCP vs JS:** MCP `scroll` **requires** `element_index` + `direction`; **no** `x`/`y`. Description: “Fractional values are supported. Defaults to 1”. JS/tinysky allow coordinate origin.

### 3.3 `selectText` — unused in traces

Public sky uses `selection_type`; IPC and MCP use `selection`.

```ts
sky.select_text({
  app: string,
  element_index: number,
  text: string,
  prefix?: string,
  suffix?: string,
  selection_type?: "text" | "cursor_before" | "cursor_after"  // default "text"
})
app.selectText(elementIndex, text, { prefix?, suffix?, selectionType? })
```

IPC (undefined `prefix`/`suffix` stripped):

```json
{
  "app": "/Applications/Linear.app",
  "action": {
    "selectText": {
      "elementID": "42",
      "text": "hello",
      "prefix": "foo",
      "suffix": "bar",
      "selection": "text"
    }
  }
}
```

`elementID` is a **string**, not `{ _0: … }` (unlike `at`). Default `selection` is always sent (`"text"`). Native `ComputerUseIPCTextSelection` is a `String` raw-value enum. MCP schema enum: `"text" | "cursor_before" | "cursor_after"`. Swift case names nearby: `cursorBefore` / `cursorAfter` with snake_case raw values.

Native: `AppController.selectText(elementID: Int, text:, prefix:, suffix:, selection:, returnSkyshot:)`. Docs (MCP + plugin): “Provide text exactly as it appears in the accessibility tree, including any Markdown formatting.” Errors: `cannotSelectTextForElement`, `textToSelectNotFound`.

### 3.4 Exercised actions — same encoder, for the complete catalog

These **were** in traces; included because the user asked for every `mac-client.js` action shape.

**click** (index **or** `[x,y]`; traces used both):

```json
{ "app": "…", "action": {
  "click": {
    "at": { "elementID": { "_0": "8" } },
    "clickCount": 1,
    "mouseButton": 0
  } } }
```

Coordinate: `"at": { "coordinate": { "_0": [119, 35] } }`. `clickCount` default 1. `mouseButton`: `left|l|0` → `0`, `right|r|1` → `1`, `middle|m|2` → `2` (CGMouseButton). Traces’ `click([119,35])` is this coordinate form; it is what returned `-10005 noWindowsAvailable`.

**paste** (trace used `{ format: "text" }`):

```json
{ "app": "…", "action": { "paste": { "text": "…", "format": "text" } } }
```

`format` is required on sky (`"text" | "md" | "html"`). Native `ComputerUseIPCPasteFormat` String enum. Restores pasteboard; native error `pasteboardChangedDuringPaste` / `pasteboardWriteFailed` / `pasteboardReadTimedOut`. **Not** on SkyComputerUseClient MCP.

**pressKey**: unlabeled associated value. Empty/whitespace `key` throws in JS.

```json
{ "app": "…", "action": { "pressKey": { "_0": "super+space" } } }
```

**typeText** — discriminator is `type`, not `typeText`:

```json
{ "app": "…", "action": { "type": { "_0": "hello" } } }
```

`\n`/`\r` simulate Return (plugin warning). Native `noTextToType`.

**setValue**:

```json
{ "app": "…", "action": { "setValue": { "elementID": "128", "value": "…" } } }
```

Native also has `autosubmitSearchFields: Bool` on `AppController.setValue` — **not** sent by JS (native default). Error `cannotSetValueForNonSettableElement`.

**performSecondaryAction** (traces: `"Raise"`, `"zoom the window"`):

```json
{ "app": "…", "action": {
  "performSecondaryAction": { "action": "Raise", "elementID": "0" } } }
```

Do not invent names; they must appear in AX “Secondary Actions:”. Native `invalidSecondaryActionForElement`.

---

## 4. Non-action IPC used by the twins

### `list_apps` / `ComputerUseIPCListAppsRequest`

Request `{}`. Result is a **bare array** of `ComputerUseIPCDiscoveredApp`:

```json
[{
  "displayName": "Linear",
  "bundleIdentifier": "com.linear",
  "appPath": "/Applications/Linear.app",
  "lastUsedDate": "2026-09-10T…",
  "useCount": 11,
  "isRunning": true,
  "isFrontmost": false
}]
```

Swift: `displayName` / `bundleIdentifier` non-optional `String`; `appPath`/`lastUsedDate`/`useCount` optional; `isRunning`/`isFrontmost` `Bool`. Date type is `Foundation.Date`; binary has `JSONISO8601DateFormatter`. JS public `App` keeps `id = bundleIdentifier ?? displayName ?? "unknown"`, drops `appPath` and `isFrontmost`. MCP copy: “running, as well as any that have been used in the last 14 days”. **No** app policy.

### `get_app_state` / `ComputerUseIPCAppGetSkyshotRequest`

```json
{ "app": "/Applications/Linear.app", "disableDiff": true }
```

`disableDiff` omitted when undefined (native Swift init is non-optional `Bool`; decode-if-present defaults false). Result `ComputerUseIPCSkyshotResult`:

```json
{
  "app": { "pid": 1234, "bundleIdentifier": "com.linear", "appPath": "/Applications/Linear.app" },
  "skyshot": {
    "text": "…AX tree…",
    "screenshot": { "url": "file:///…png", "mimeType": "image/png" }
  },
  "appSpecificInstructions": "…"
}
```

JS `window_result`: missing `skyshot` throws; empty screenshot URL → `screenshot: null`; first observation per app prepends `<app_specific_instructions>` except `com.apple.iWork.Numbers`. `cua.getApp` always uses `disableDiff: true` once, then Target `getAXState` diffs unless `{ disableDiffing: true }`.

Native GetSkyshot **starts an app session if needed** (implicit launch). Public JS never calls `startApp` / `ComputerUseIPCAppStartRequest`.

### Audio — unused; gated

`create_client.js`: methods attached only if `process.env.SKY_ENABLE_AUDIO === "1"`. Types mark them optional.

**start** (`sky.start_audio_recording({ max_duration_ms? })`):

- Default `60000`, clamp **integer 100…300000** else JS `Error("audio recording duration must be an integer from 100 through 300000")`.
- Own elicitation (not `getAppPolicy`): “Allow Computer Use to record computer audio?”, `riskLevel: "high"`, `persist: ["session"]` only, `tool_name: "start_audio_recording"`.
- IPC `ComputerUseIPCStartAudioRecordingRequest`: `{ "maxDurationMilliseconds": 60000 }` (Swift `Int?`; JS always sends the clamped int).
- Result `ComputerUseIPCEmptyResponse` `{}`.
- Native `ComputerUseAudioRecorder` (`recordingURL`, `autoStopTask`, `didAutoStop`, `owner`, `stream`). Errors: `invalidDuration`, `recordingAlreadyActive`, `noDisplay`.

**stop** (`sky.stop_audio_recording()`):

- IPC `ComputerUseIPCStopAudioRecordingRequest` `{}` → `ComputerUseIPCAudio { "url": "file://…" }`.
- JS requires non-empty `file:` URL, reads bytes, returns `{ filepath, bytes, data_url }` with `audio/wav` (docs: 24 kHz stereo WAV).
- REPL RPC strips `bytes` on the wire and rehydrates from `data_url`.
- Errors: `noActiveRecording`, `recordingNotOwned`.

Not on tinysky Target. Not on SkyComputerUseClient MCP.

---

## 5. Policy / elicitation

Every app-targeted public method (`get_app_state`, `click`, `drag`, `paste`, `perform_secondary_action`, `press_key`, `scroll`, `select_text`, `set_value`, `type_text`) is `withComputerUsePolicy(toolName, input, op)` in `computer-use-policy.js`.

1. `setComputerUseResponseMeta(null)` then `getAppPolicy({ app })` → `ComputerUseIPCAppPolicyRequest` `{ "app": "<caller string>" }`.
2. Result `ComputerUseIPCAppPolicyResult`:

```json
{
  "allowPersistentApproval": true,
  "decision": "allowed",
  "target": {
    "appPath": "/Applications/Linear.app",
    "bundleIdentifier": "com.linear",
    "displayName": "Linear",
    "risk": "high",
    "warningSubtitle": null
  }
}
```

`decision`: `"allowed" | "denied" | "forbidden"` (`ComputerUseIPCAppPolicyDecision`). `risk`: `"high" | "low"`. `warningSubtitle` optional.

3. Branch **before** elicitation:
   - `denied` → throw `Computer Use is blocked from using the app '${bundleIdentifier}' by your organization's policy.`
   - `forbidden` → throw `Computer Use is not allowed to use the app '${bundleIdentifier}' for safety reasons.`
   - `allowed` → continue.
4. `nodeRepl.createElicitation({ message, meta })`:

```json
{
  "message": "Allow Computer Use to use \"Linear\"?",
  "meta": {
    "codex_approval_kind": "mcp_tool_call",
    "connector_id": "computer-use",
    "connector_name": "Computer Use",
    "persist": ["session", "always"],
    "riskLevel": "high",
    "subtitle": "<warningSubtitle if present>",
    "tool_call_id": "<from x-codex-turn-metadata call_id or item_id>",
    "tool_name": "drag",
    "tool_params": { "app": "com.linear" },
    "tool_params_display": [{ "name": "app", "display_name": "App", "value": "Linear" }]
  }
}
```

`persist` is `["session","always"]` if `allowPersistentApproval`, else `["session"]` only. If the elicitation result `content.source === "computer-use-persisted-state"`, skip “approval requested” telemetry (already stored). `action !== "accept"` → throw `Computer Use was not approved to use ${displayName}`. Actions map to telemetry `accepted|canceled|declined`; `_meta.persist === "always"` → `approvalPersistence: "always"`, else `"session"`.

5. Freeze input: copy own enumerable data properties, set `app` to `target.appPath`, `writable: false`, `Object.freeze`. Getters/accessors throw. Native action RPCs therefore see a **path**, not `"Linear"`.
6. `nodeRepl.withSuspendedTimeout` around the native call.
7. Statsig `CodexComputerUseMcpToolCalled` (`pluginId: computer-use@openai-bundled`, `transport: native_pipe`, `invocationSource: code_mode`). `userStoppedSession` (−10012) and `userIntervened` (−10016) → telemetry `cancelled`.

Response meta (`nodeRepl.setResponseMeta`):

```json
{ "codex/toolSurface": { "kind": "computerUse", "app": { "kind": "appId", "appId": "com.linear" } } }
```

If bundle is `com.google.Chrome`, also `"codex/computerUseChrome": true`.

`list_apps` skips app policy (`setComputerUseResponseMeta(null)`). Audio start has the separate elicitation in §4.

Model-facing confirmation taxonomy (`tinysky-alt-confirmations.md`) is **in addition** to this runtime gate: drag/scroll/select are “direct UI actions” and inherit that policy. Runtime elicitation is per-app, not per-action-risk.

---

## 6. Error codes −10000…−10020 and `-10005 noWindowsAvailable`

### JS table (`targets/mac/errors.js`) — socket-path contract

`SkyComputerUseError.errorName` is this map; unknown codes → `"jsonRPCError"`.

| code | JS `errorName` | Native description string (service) |
|---:|---|---|
| −10000 | `senderProcessNotAuthenticated` | `Sender process is not authenticated` |
| −10001 | `couldNotGetRequestData` | `Could not get request data` (Apple Event / XPC leftover) |
| −10002 | `couldNotGetRequestTypeName` | `Could not get request type name from Apple event` |
| −10003 | `couldNotResolveRequestType` | `Could not resolve request type: ` |
| −10004 | `unhandledEvent` | *(no dedicated sentence in the same block)* |
| **−10005** | **`unknownError`** | prefix `Computer Use server error ` + **inner** error |
| −10006 | `appNotAllowed` | `Computer Use is not allowed to use the app '` … `' for safety reasons.` |
| −10007 | `runningApplicationNotFound` | client: `Running application not found: ` |
| −10008 | `accessibilityError` | prefix `Accessibility error: ` |
| −10009 | `permissionsNotGranted` | `Computer Use permissions are not granted` |
| −10010 | `invalidApp` | *(identifier resolution)* |
| −10011 | `noActiveSession` | `Computer Use is not active for '` … `'. You first must call \`get_app_state\` …` |
| −10012 | `userStoppedSession` | long “explicitly stopped by the user for this turn…” |
| −10013 | `incompatibleClientVersion` | ping `serverApiVersion` mismatch |
| −10014 | `permissionsPending` | Accessibility + Screen Recording still pending; “call this tool again” |
| −10015 | `blockedURL` | session ended; Computer Use not allowed on current browser URL |
| −10016 | `userIntervened` | *(physical input / user takeover)* |
| −10017 | `couldNotGetSenderPID` | Apple Event |
| −10018 | `ambiguousApp` | `Ambiguous app identifier '…'. Multiple apps share this bundle identifier: …. Use an app name or full app path instead.` |
| −10019 | `couldNotGetBootstrapPort` | Apple Event / XPC mach port |
| −10020 | `screenLocked` | lock-screen path |

Live unsigned MCP (`verify/results/mcp-ndjson.json`): `Computer Use server error -10000: Sender process is not authenticated` — same format family, human inner text.

### Why traces say `-10005: noWindowsAvailable`

1. JS maps **code −10005 → name `unknownError`**. There is **no** JS symbol `noWindowsAvailable`.
2. `noWindowsAvailable` is an **AccessibilitySupport** window-resolution case, next to `windowNotFoundAtPosition`, `windowNotFoundForID`, `failedToGetWindowIDForElement`. It is **not** a `ComputerUseIPCClient.ServerError.Code` case.
3. Native JSON-RPC still sends **code −10005**. The **message** is the inner case name `noWindowsAvailable` (no human sentence, unlike −10000).
4. Presented to the model as `Computer Use server error -10005: noWindowsAvailable`. Prefix string `Computer Use server error ` lives in **both** `SkyComputerUseService` and `SkyComputerUseClient`. MCP client also has `throwMappedServerError(errorNumber:errorString:)` (`Int32`, `String`). JS `native-pipe.js` copies `error.message` onto `SkyComputerUseError` unchanged; `errorName` stays `unknownError`.

Trace evidence (`agents/05-traces/calls.json`): two `js` calls `await linearApp.click([119,35]); await linearApp.getAXStateAndScreenshot();` both returned that string. AX **index** clicks on the menu bar in the same session succeeded. Coordinate click needs a key/capturable window; menu-bar AX does not. Nearby native errors: `noCapturableWindow`, `cgWindowNotFound`.

Agent 07’s table listing −10005 as `unknownError` is the **JS name**. The **message** in traces is the inner window error. Both are true.

### Native `ServerError` cases JS does not map

Same enum string table, extra cases: `messagesInvalidRequest`, `messagesAmbiguousDestination`, `messagesSendPlanUnavailable`, `messagesSendRateLimited`, `turnEnded`, `messagesPermissionsPending`, `messagesPermissionsDenied`, `messagesQueryTimedOut`, `messagesSendOutcomeUncertain`, `serverError`, `couldNotFindServiceApp`. Numeric codes for these are **not** in JS. If the socket ever returned them, `errorName` would be `jsonRPCError`. `legacyMCP` / `nodeRepl` in the same dump are a **client-type** raw-value enum, not error codes.

### Action-layer errors likely also wrapped as −10005

AppController / capture cases (message = case name, same wrapping pattern as `noWindowsAvailable`):

`noCapturableWindow`, `invalidSecondaryActionForElement`, `systemSecurityTargetNotAllowed`, `menuClickFailed`, `menuMouseActionNotSupported`, `appQuit`, `noTextToType`, `pasteboardWriteFailed`, `pasteboardReadTimedOut`, `pasteboardChangedDuringPaste`, `invalidDuration`, `noScrollDirection`, `noScrollAmount`, `noAXTree`, `cannotSetValueForNonSettableElement`, `cannotSelectTextForElement`, `textToSelectNotFound`, `invalidElementID`, `invalidScrollPages`, `blockedByPolicy`, `screenshotCaptureFailed`, `noActiveRecording`, `recordingAlreadyActive`, `recordingNotOwned`, `noDisplay`.

Session cases with **first-class** codes: `appNotAllowed` (−10006), `noActiveSession` (−10011), `userIntervened` (−10016), `appStoppedByUser` (related to −10012).

AX failures with dedicated code: `accessibilityError` (−10008) using prefix `Accessibility error: `.

---

## 7. MCP `SkyComputerUseClient` vs JS `@oai/sky` (same service, different façade)

Live `tools/list` (`verify/results/mcp-ndjson.json`):

`list_apps`, `get_app_state`, `click`, `perform_secondary_action`, `set_value`, `select_text`, `scroll`, `drag`, `press_key`, `type_text`.

| | JS / tinysky (traces) | MCP client tools |
|---|---|---|
| paste | yes | **no** |
| audio | gated `SKY_ENABLE_AUDIO` | **no** |
| scroll origin | `element_index` **or** `x,y` | **required** `element_index` only |
| select field | sky `selection_type` → IPC `selection` | tool arg already `selection` |
| click `element_index` schema | JS number → IPC string | JSON schema **string** |
| drag | tinysky `[x,y]` pairs; sky `from_x`… | tool `from_x`… (same names as sky) |

MCP `select_text` description matches native: exact AX text, optional prefix/suffix, `selection` default text. MCP `get_app_state`: “This must be called once per assistant turn before interacting with the app” (session rule; JS tinysky also errors −10011 if you skip it).

Traces used **tinysky JS**, not this MCP server. Unsigned MCP calls fail −10000 (sender auth). This document does not replay MCP drag/scroll/select against Linear.

---

## 8. Worked examples (unused actions → exact frames)

`app` shown after policy rewrite. Framing: 4-byte LE length then this JSON.

**drag**

```json
{
  "id": 7,
  "jsonrpc": "2.0",
  "method": "request",
  "params": {
    "clientApiVersion": "CodexComputerUseIPC-5",
    "codexTurnMetadata": { "turn_id": "…" },
    "deadlineUnixMilliseconds": 1770000000000,
    "requestType": "ComputerUseIPCAppPerformActionRequest",
    "request": {
      "app": "/Applications/Linear.app",
      "action": { "drag": { "from": [10, 20], "to": [300, 400] } }
    }
  }
}
```

**scroll** one page down at AX index 42

```json
"request": {
  "app": "/Applications/Linear.app",
  "action": {
    "scroll": {
      "at": { "elementID": { "_0": "42" } },
      "direction": "down",
      "pages": 1
    }
  }
}
```

**selectText** cursor after “hello”

```json
"request": {
  "app": "/Applications/Linear.app",
  "action": {
    "selectText": {
      "elementID": "42",
      "text": "hello",
      "selection": "cursor_after"
    }
  }
}
```

**start / stop audio** (only if `SKY_ENABLE_AUDIO=1`)

```json
{ "requestType": "ComputerUseIPCStartAudioRecordingRequest",
  "request": { "maxDurationMilliseconds": 60000 } }
{ "requestType": "ComputerUseIPCStopAudioRecordingRequest",
  "request": {} }
```

Stop result: `{ "url": "file:///…/….wav" }` → JS `{ filepath, bytes, data_url }`.

---

## Sources

- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/sky/dist/project/cua/sky_js/src/targets/mac/{client,native-pipe,errors,computer-use-policy,create_client,drag,scroll,select_text,audio_recording,click,paste,press_key,set_value,type_text,perform_secondary_action,get_app_state,list_apps,window_result,lazy-client}.js`
- vendor copies: `vendor/sky/js/mac-client.js`, `vendor/sky/js/native-pipe.js`, `vendor/sky/js/service.js`
- tinysky: `create_tinysky_alt.js` / `agents/01-cua-tinysky/copies/oai_js_cua/tinysky_alt/create_tinysky_alt.pretty.js`
- types: `agents/02-sky-native/d.ts/targets/mac/*.d.ts`, `types/window/{Drag,Scroll,SelectText,StartAudioRecording,StopAudioRecording}.d.ts`
- native: `SkyComputerUseService` / `SkyComputerUseClient` strings + `nm` demangle (`ComputerUseIPCAction`, `LocationSpecifier`, `SkyshotResult`, `AppPolicyResult`, `ServerError.Code`, `AppController.click(…andDragTo:)`, `selectText`, `performPaste`, `scroll(deltaX:deltaY:)`, `AudioRecorder`)
- traces: `agents/05-traces/FINDINGS.md`, `calls.json` (`-10005 noWindowsAvailable`)
- MCP schema: `verify/results/mcp-ndjson.json`
- prior: `agents/02-sky-native/FINDINGS.md`, `agents/07-native-app/FINDINGS.md` (transport / −10005 JS name)
