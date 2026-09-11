# FINDINGS — SkyComputerUseClient MCP, NDJSON JSON-RPC (live)

**Verdict.** The official Computer Use MCP server is `SkyComputerUseClient mcp`. It speaks **newline-delimited JSON-RPC 2.0 on stdio**, not LSP `Content-Length`. Live `initialize` + `tools/list` work. The ten tools are the snake_case window API. `list_apps` / `get_app_state` are the MCP names for tinysky `cua.listApps` / `cua.getApp` → `@oai/sky` `sky.list_apps` / `sky.get_app_state` → `ComputerUseIPCListAppsRequest` / `ComputerUseIPCAppStartRequest`+`ComputerUseIPCAppGetSkyshotRequest`.

Unix-socket `ping` (`CodexComputerUseIPC-5`, uint32le frames) is **not** a valid live path from Node: the service accepts the TCP-style connect then **closes with zero bytes**. That happens for:

1. fnm Node **v24.15.0** signed by **Node.js Foundation (`HX7739G8FX`)**, Identifier=`node`
2. ChatGPT **`cua_node/bin/node`** signed by **OpenAI OpCo (`2DC432GLL2`)**, Identifier=`node`

Team id `2DC432GLL2` is not enough. The two live identities that can actually talk to `SkyComputerUseService` are:

- **`node_repl.nativePipe.createConnection`** — host-proxied (`NativePipeRequestOp::Connect` in `node_repl`); JS `@oai/sky` requires `globalThis.nodeRepl`
- **this signed MCP client** — Identifier=`com.openai.sky.CUAService.cli`, team `2DC432GLL2`

Spawning the MCP client from untrusted Node still fails **`ComputerUseIPCSenderAuthorization`**: `tools/call list_apps` returns MCP `isError` text `Computer Use server error -10000: Sender process is not authenticated`. Parent of the live child was fnm `node` (`HX7739G8FX`) — `UNTRUSTED_PARENT` / `RELAY_WITHOUT_TRUSTED_ANCESTOR`. Official launch is Codex → `computer-use-client-launcher` → `SkyComputerUseClient mcp` under a `2DC432GLL2` parent.

No Linear `click` / `type_text` / `set_value` / `paste` / `press_key`. Finder `get_app_state` was attempted; it did not return in 45s (no screenshot bytes written). AX text truncated in evidence.

---

## 1. Live binary / service

| Piece | Path / value |
|---|---|
| MCP client | `/Users/dongdong/.codex/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient` |
| argv | `mcp` |
| bundle id | `com.openai.sky.CUAService.cli` |
| team | `2DC432GLL2` (Developer ID Application: OpenAI OpCo, LLC) |
| service | `SkyComputerUseService` pid **3802**, Identifier=`com.openai.sky.CUAService` |
| named JS socket | `/Users/dongdong/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock` (`srw-------`, owner `dongdong`) |
| launcher | `.../plugins/computer-use/bin/computer-use-client-launcher` → `exec "$client" "$@"` with `args: ["mcp"]` |

Client strings: `_TtC3MCP14StdioTransport`, `MCP/StdioTransport.swift`, `mcp.transport.stdio`, `legacy_mcp`. IPC types in the same binary include the full `ComputerUseIPC*` set plus `ComputerUseIPCXPCTransport`.

---

## 2. Framing: NDJSON, not Content-Length

### 2.1 NDJSON (this run)

stdin/stdout: one JSON object per line (`JSON.stringify(msg) + "\n"`).

First stdout bytes (hex): `7b226964223a312c226a736f6e727063223a22322e30222c22726573756c7422…` = `{ "id":1,"jsonrpc":"2.0","result":…`.

Parser events all `via: "ndjson"`.

`initialize` result (id 1):

```json
{
  "capabilities": { "tools": { "listChanged": false } },
  "protocolVersion": "2024-11-05",
  "serverInfo": {
    "name": "Computer Use",
    "version": "14e7d17f1f59e77ca541a15071e980628cd08977a4dda111c96e0564d337056b"
  }
}
```

Then `notifications/initialized`, then `tools/list` (id 2) succeeds.

### 2.2 Content-Length control (negative)

Same binary, same `mcp` argv, but frames as `Content-Length: N\r\n\r\n{json}`.

Server immediately emits NDJSON parse errors with **UUID** ids (not the numeric request ids):

```json
{
  "error": {
    "code": -32700,
    "data": { "detail": "Invalid message format" },
    "message": "Parse error: Invalid JSON: Invalid message format"
  },
  "id": "780AADAA-BCAC-434D-94B9-8BDF42EF20A7"
}
```

Six such errors, then our `initialize` / `tools/list` time out because ids never match. `verify/mcp-client.mjs` (Content-Length writer) previously timed out for the same reason.

**Contract:** stdio MCP = newline-delimited JSON-RPC. Native JS pipe = uint32le length + JSON (`CodexComputerUseIPC-5`). Do not mix.

---

## 3. `tools/list` (live)

Ten tools. `readOnlyHint: true` only on `list_apps` and `get_app_state`. No `paste`, no audio, no Messages/Calendar/Skysight.

| MCP tool | required args | readOnlyHint |
|---|---|---|
| `list_apps` | _(none)_ | true |
| `get_app_state` | `app` | true |
| `click` | `app` (`element_index` or `x`+`y`) | false |
| `perform_secondary_action` | `app`, `element_index`, `action` | false |
| `set_value` | `app`, `element_index`, `value` | false |
| `select_text` | `app`, `element_index`, `text` | false |
| `scroll` | `app`, `element_index`, `direction` | false |
| `drag` | `app`, `from_x`, `from_y`, `to_x`, `to_y` | false |
| `press_key` | `app`, `key` | false |
| `type_text` | `app`, `text` | false |

`get_app_state` description (live): “Start an app use session if needed, then get the state of the app's key window and return a screenshot and accessibility tree. This must be called once per assistant turn before interacting with the app.” That is implicit `startApp` + skyshot, matching `@oai/sky` Mac `get_app_state`.

Full schemas: [`tools-list.json`](tools-list.json).

---

## 4. Read-only `tools/call`

Safety: only `list_apps` and `get_app_state` with `app: "Finder"`. Mutating tools listed above were **not** invoked.

### 4.1 `list_apps`

MCP JSON-RPC **succeeded** (id 3, `hasResult: true`). Tool result is an error payload:

```json
{
  "isError": true,
  "content": [
    { "type": "text", "text": "Computer Use server error -10000: Sender process is not authenticated" }
  ],
  "_meta": { "codex/telemetry": { "span": { "did_trigger_server_user_flow": false } } }
}
```

`-10000` = `senderProcessNotAuthenticated` in `@oai/sky` `errors.js`. Fail-closed copy in the native binaries: “Sender process is not authenticated”.

Child pid **49944**, parent **49819** = this probe’s fnm `node`. After the call, `lsof` shows a new anonymous unix fd (`->0x27e8fcd7a282e5da`) and **does not** name `computeruse.sock`. The MCP client talks to the service over **XPC / anonymous unix** (`ComputerUseIPCXPCTransport`), not the JS native-pipe socket. The JS socket is a separate listener on the service (`fd 8` = `computeruse.sock`).

### 4.2 `get_app_state` Finder

`tools/call` `{ name: "get_app_state", arguments: { app: "Finder" } }` **timed out at 45s**. No result, no screenshot, no AX text. Likely blocked in “start an app use session” / elicitation after the same authorization failure (description says session start is part of this tool). Evidence sanitizer never saw image bytes.

---

## 5. Map MCP → tinysky → sky → IPC

Unified-computer-use REPL never uses these MCP tools. The model writes `cua.getApp("Linear")` in the `js` tool. Mapping is name-level, not a second wire.

```
MCP list_apps / get_app_state / click / …
        ║  same window API, different transport
        ║
tinysky  cua.listApps() / cua.getApp(name) / app.click(i)
        ║
sky      sky.list_apps() / sky.get_app_state({app}) / sky.click({app,…})
        ║  WindowComputerUseClient (target: "mac")
        ║
MacComputerUseClient  listApps / startApp+getAppState / click→performAction
        ║  nativePipe JSON-RPC  method "request"
        ║
ComputerUseIPC*  on CodexComputerUseIPC-5  →  SkyComputerUseService
```

`cua.getApp(name)` (`create_tinysky_alt.js`): requires `sky.target === "mac"`, calls `sky.get_app_state({ app: name, disableDiff: true })`, binds Target methods to the **resolved** `state.app`, emits AX text. So MCP `get_app_state` ≡ tinysky `cua.getApp` observation (plus session start). `app.getAXState` / `getScreenshot` / `getAXStateAndScreenshot` are extra `get_app_state` calls, not extra MCP tools.

| MCP | tinysky | sky (window) | MacComputerUseClient | IPC |
|---|---|---|---|---|
| `list_apps` | `cua.listApps()` | `sky.list_apps()` | `listApps()` | `ComputerUseIPCListAppsRequest` → `ComputerUseIPCDiscoveredApp[]` |
| `get_app_state` | `cua.getApp(name)` ; `app.getAXState` / `getScreenshot` / `getAXStateAndScreenshot` | `sky.get_app_state({app, disableDiff?})` | `startApp` + `getAppState` | `ComputerUseIPCAppStartRequest` then `ComputerUseIPCAppGetSkyshotRequest` → `ComputerUseIPCAppState` / `ComputerUseIPCSkyshot` |
| `click` | `app.click(i \| [x,y])` | `sky.click` | `click` → `performAction` | `ComputerUseIPCAppPerformActionRequest` `{ click: { at: elementID\|coordinate, clickCount, mouseButton } }` |
| `perform_secondary_action` | `app.performSecondaryAction` | `sky.perform_secondary_action` | `performSecondaryAction` | same request `{ performSecondaryAction }` |
| `set_value` | `app.setValue` | `sky.set_value` | `setValue` | `{ setValue: { elementID, value } }` |
| `select_text` | `app.selectText` | `sky.select_text` | `selectText` | `{ selectText }` |
| `scroll` | `app.scroll` | `sky.scroll` | `scroll` | `{ scroll: { at, direction, pages } }` |
| `drag` | `app.drag([x1,y1],[x2,y2])` | `sky.drag` | `drag` | `{ drag: { from, to } }` |
| `press_key` | `app.pressKey` | `sky.press_key` | `pressKey` | `{ pressKey: { _0: key } }` |
| `type_text` | `app.typeText` | `sky.type_text` | `typeText` | `{ type: { _0: text } }` |

**Present in sky/tinysky, absent from this MCP `tools/list`:**

| tinysky / sky | IPC |
|---|---|
| `app.paste` / `sky.paste` | `ComputerUseIPCAppPerformActionRequest` `{ paste }` (`ComputerUseIPCPasteFormat`) |
| `sky.start_audio_recording` / `stop_audio_recording` (gated `SKY_ENABLE_AUDIO=1`) | `ComputerUseIPCStartAudioRecordingRequest` / `ComputerUseIPCStopAudioRecordingRequest` |

Native also has Messages, Calendar, Skysight, event-stream, capture-animation IPC types the MCP computer-use surface does not export.

JS request type names that `@oai/sky` actually sends: `ComputerUseIPCAppPolicyRequest`, `ComputerUseIPCListAppsRequest`, `ComputerUseIPCAppStartRequest`, `ComputerUseIPCAppGetSkyshotRequest`, `ComputerUseIPCAppPerformActionRequest`, audio start/stop.

---

## 6. SenderAuthorization — why Node ping dies

### 6.1 Named socket ping (uint32le JSON-RPC `ping`)

Target: `computeruse.sock`, method `ping`, params `{ clientApiVersion: "CodexComputerUseIPC-5" }`.

| Client | codesign | result |
|---|---|---|
| fnm `node` v24.15.0 | Identifier=`node`, Team=`HX7739G8FX` (Node.js Foundation) | connect + write, then **socket closed**, 0 bytes, ~59 ms |
| `cua_node/bin/node` | Identifier=`node`, Team=`2DC432GLL2` (OpenAI OpCo), Developer ID 2026-09-08 | connect + write 98 bytes, then **socket closed**, 0 bytes, ~32 ms |

OpenAI-signed Node is still Identifier=`node`, not a CUA bundle. The service fail-closes the JS JSON-RPC socket without a JSON-RPC error body.

Adversarial wrong-version ping in `verify/native-ipc.mjs` also got `socket closed` (not `-10013`), consistent with “unauthenticated sender never reaches version check”.

### 6.2 Why `node_repl.nativePipe` is different

`cua_node/bin/node_repl` (Identifier=`node_repl`, team `2DC432GLL2`) embeds a **kernel↔host** bridge, not a raw `net.connect`:

- JS: `nativePipe.createConnection(pipePath)`
- kernel messages: `NativePipeRequestOp::Connect` / `Write` / `Close`
- host: `privilegedRuntime.nativePipeBridge`

`@oai/sky` `native-pipe.js` throws if `globalThis.nodeRepl.nativePipe.createConnection` is missing (“Sky Computer Use requires the trusted nodeRepl runtime”). The unix connect is performed on the **ChatGPT/Codex host** side (trusted ancestor), not by a random Node process that happens to be OpenAI-signed.

Live `node_repl` pids (5746, 5769) do **not** currently hold `computeruse.sock`; only `SkyComputerUseService` 3802 listens. Connections are on-demand through that host bridge.

### 6.3 MCP client identity vs parent

MCP client itself is a valid CUA identity (`com.openai.sky.CUAService.cli`, app group `2DC432GLL2.com.openai.sky.CUAService`). Parent code requirement on the bundle is team `2DC432GLL2`.

Authorization strings in the client:

- `CODEX_COMPUTER_USE_IPC_AUTHORIZATION_FAILURE_REASON_MISSING_PARENT`
- `CODEX_COMPUTER_USE_IPC_AUTHORIZATION_FAILURE_REASON_UNTRUSTED_PARENT`
- `CODEX_COMPUTER_USE_IPC_AUTHORIZATION_FAILURE_REASON_RELAY_WITHOUT_TRUSTED_ANCESTOR`
- type `ComputerUseIPCSenderAuthorization`

This run: parent = fnm Node (`HX7739G8FX`) → `list_apps` `-10000`. That is the parent check, not “unsigned MCP binary”. Codex launching `computer-use-client-launcher` keeps the ancestor on team `2DC432GLL2`.

### 6.4 Valid vs invalid live paths

| Path | Ping / request to CUAService |
|---|---|
| fnm / Homebrew / Node.js Foundation `node` → `computeruse.sock` | socket closed |
| OpenAI-signed `cua_node/bin/node` → `computeruse.sock` | socket closed |
| `@oai/sky` with a fake `net.connect` shim from unsigned Node | socket closed (see `verify/results/native-ipc.json`) |
| `node_repl.nativePipe` inside trusted CUA REPL | intended JS path |
| `SkyComputerUseClient mcp` under trusted `2DC432GLL2` parent | intended MCP path |
| `SkyComputerUseClient mcp` under untrusted Node parent (this probe) | stdio MCP works; `tools/call` hits `-10000` |

---

## 7. Safety

- Mutating MCP tools not called (`click`, `perform_secondary_action`, `set_value`, `select_text`, `scroll`, `drag`, `press_key`, `type_text`).
- No Linear interaction.
- Finder `get_app_state` attempted; timed out; **no screenshot bytes on disk**.
- Evidence sanitizer omits `data:image` / base64 / `type:image` / long AX strings.

---

## 8. Evidence files

All under `/Users/dongdong/Desktop/codex-cua-reverse/verify/agents/v7-mcp-ndjson/`:

| file | contents |
|---|---|
| [`probe.mjs`](probe.mjs) | NDJSON harness + Content-Length control + socket pings |
| [`evidence.json`](evidence.json) | combined live report |
| [`mcp-session.json`](mcp-session.json) | initialize / tools/list / list_apps / get_app_state / lsof |
| [`tools-list.json`](tools-list.json) | full live tool schemas |
| [`ping.json`](ping.json) | named-socket ping from fnm node and `cua_node/bin/node` |
| [`identity.json`](identity.json) | codesign of client, nodes, `node_repl`, service |
| [`mapping.json`](mapping.json) | MCP ↔ tinysky ↔ sky ↔ `ComputerUseIPC*` |

Live timestamps: initialize/tools/list/list_apps at **2026-09-10T11:07–11:08Z**. Service pid 3802 was already running (`Codex Computer Use.app`).
