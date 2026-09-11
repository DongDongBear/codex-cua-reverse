# V3 — Official `SkyComputerUseClient mcp` (second live path)

**Verdict.** The signed Computer Use CLI speaks **newline-delimited JSON-RPC 2.0 on stdio**, not LSP `Content-Length`. `cua mcp` is a real MCP server named **“Computer Use”**. `tools/list` returns **exactly 10 tools**, whose names are the sky window API (`list_apps`, `get_app_state`, `click`, …). That is a **parallel model-facing surface** to unified-computer-use’s `js` REPL (`cua.getApp` / `app.click`). Both eventually hit `SkyComputerUseService`; JS `@oai/sky` uses the **unix socket**, this client uses **XPC**.

Live `tools/call` for the two read-only tools (`list_apps`, `get_app_state` on Finder) **reaches the client and comes back as MCP `isError`**, not a JSON-RPC transport failure:

```text
Computer Use server error -10000: Sender process is not authenticated
```

That is the documented native code `senderProcessNotAuthenticated`. Spawning the CLI from Node does not satisfy the service’s trusted-parent / sender-auth check (ChatGPT.app / team `2DC432GLL2`). Protocol reconstruction is still proven: initialize, `tools/list`, and tool dispatch all work.

Did **not** call `click` / `type_text` / `press_key` / `set_value` / `select_text` / `scroll` / `drag` / `perform_secondary_action`. Did **not** talk to `cua messages mcp`. Did **not** click Linear.

---

## 1. Binary, help, plugin wiring

| Item | Value |
|---|---|
| Executable | `/Users/dongdong/.codex/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient` |
| Bundle id | `com.openai.sky.CUAService.cli` |
| Version | `26.902.1000968` (CFBundleVersion `1000968`) |
| Signature | Developer ID Application: OpenAI OpCo, LLC (`2DC432GLL2`), hardened runtime, notarized, arm64 |
| Help argv0 | `cua` (the binary’s own usage string) |
| Live clicker | `SkyComputerUseService` pid **3802**, socket `~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock` |

`cua help` / `cua help mcp` (this binary):

```
USAGE: cua <subcommand>
  mcp                     Runs the Computer Use client as an MCP server
  event-stream
  computer-history
  calendar
  messages
  turn-ended              Handles a Codex turn-ended notification

OVERVIEW: Runs the Computer Use client as an MCP server
USAGE: cua mcp
```

Sibling MCP modes (not exercised here): `cua event-stream mcp`, `cua computer-history mcp`, `cua calendar mcp`, `cua messages mcp`. Swift types: `ComputerUseMCPServer`, `MessagesMCPServer`, `CalendarMCPServer`, `ComputerHistoryMCPServer`, `EventStreamMCPServer`.

### Plugin `computer-use` `.mcp.json`

Shipped at:

- `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/.mcp.json`
- `/Users/dongdong/.codex/plugins/cache/openai-bundled/computer-use/1.0.1000968/.mcp.json`
- repo copy: `/Users/dongdong/Desktop/codex-cua-reverse/vendor/plugins/computer-use/.mcp.json`

```json
{
  "mcpServers": {
    "computer-use": {
      "command": "./bin/computer-use-client-launcher",
      "args": ["mcp"],
      "cwd": ".",
      "env_vars": ["CODEX_HOME"]
    }
  }
}
```

Launcher (`…/computer-use/bin/computer-use-client-launcher`):

```sh
codex_home="${CODEX_HOME:-${HOME}/.codex}"
client="${codex_home}/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient"
exec "${client}" "$@"
```

`~/.codex/config.toml` also has a **disabled** duplicate:

```toml
[mcp_servers.computer-use]
command = "./Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient"
args = ["mcp"]
cwd = "."
enabled = false
```

`[plugins."computer-use@openai-bundled"] enabled = true` — plugin is on; this MCP server is **not** the live `js` path.

### Unified plugin is a different MCP

`/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/unified-computer-use/.mcp.json`:

```json
{
  "mcpServers": {
    "cua_repl": {
      "command": "node",
      "args": ["scripts/launch.mjs"],
      "enabled": false,
      "enabled_tools": ["js", "js_reset", "turn_ended"]
    }
  }
}
```

That is `node_repl` + tinysky `cua.*`, **not** `SkyComputerUseClient mcp`. Traces (`cua.getApp`, `app.click`) went through `js`, then `@oai/sky` → unix socket.

---

## 2. Framing (harness vs live)

Official client strings: `MCP/StdioTransport.swift`, `_TtC17ComputerUseClient17JSONRPCLineBuffer`, `mcp.transport.stdio`. **No `Content-Length` string** in the binary.

| Framing | Result |
|---|---|
| LSP `Content-Length: N\r\n\r\n{json}` (`verify/mcp-client.mjs`) | **timeout**. stderr empty. `initialize` never answered. |
| Newline-delimited JSON (`{json}\n`) | **works**. stdout is one JSON object per line, no headers. |

Harness report: `verify/agents/v3-mcp-client/harness-stdout.json`. Live NDJSON report: `verify/agents/v3-mcp-client/probe.json`.

Stdout head (NDJSON):

```text
{"id":1,"jsonrpc":"2.0","result":{"capabilities":{"tools":{"listChanged":false}},"protocolVersion":"2024-11-05","serverInfo":{"name":"Computer Use","version":"14e7d17f…"}}}
```

**stderr: empty** on both the Content-Length timeout and the successful NDJSON session (no Statsig / XPC logs on stderr).

JSON-RPC extras (read-only, not Computer Use tools):

| Method | Result |
|---|---|
| `initialize` | `protocolVersion: "2024-11-05"`, capabilities `{ tools: { listChanged: false } }` only (no resources/prompts/elicitation advertised) |
| `tools/list` | 10 tools |
| `resources/list` | `-32601` Unknown method |
| `prompts/list` | `-32601` Unknown method |
| JSON-RPC `ping` | `result: {}` (this is **not** native-pipe `ping` / `CodexComputerUseIPC-5`) |

Binary also contains MCP protocol version strings `2024-11-05`, `2025-03-26`, `2025-06-18`, `2025-11-25`. Negotiated version in this session: **`2024-11-05`**.

`serverInfo.version` is a 64-hex digest (`14e7d17f1f59e77ca541a15071e980628cd08977a4dda111c96e0564d337056b`), not `26.902.1000968`.

---

## 3. Live `tools/list` (complete)

Order matches Swift `ComputerUseMCPToolName`:

1. `list_apps`
2. `get_app_state`
3. `click`
4. `perform_secondary_action`
5. `set_value`
6. `select_text`
7. `scroll`
8. `drag`
9. `press_key`
10. `type_text`

**Not present:** `paste`, `start_audio_recording`, `stop_audio_recording`, browser/`cua.getTab`, Messages `send_message` / `find_chats`, Computer History, Record & Replay.

Annotations (live):

| Tool | `readOnlyHint` | `idempotentHint` | `destructiveHint` |
|---|---|---|---|
| `list_apps`, `get_app_state` | true | true | false |
| all eight action tools | false | false | false |

`get_app_state` is marked read-only even though its description says it **starts an app-use session** (native `ComputerUseIPCAppStartRequest`).

### Input schemas (live)

| Tool | required | properties |
|---|---|---|
| `list_apps` | — | `{}` |
| `get_app_state` | `app` | `app: string` — **no `disableDiff`** |
| `click` | `app` | `element_index: string`, `x`, `y`, `click_count: integer`, `mouse_button: left\|right\|middle` |
| `perform_secondary_action` | `app`, `element_index`, `action` | all strings |
| `set_value` | `app`, `element_index`, `value` | |
| `select_text` | `app`, `element_index`, `text` | `prefix`, `suffix`, **`selection`**: `text\|cursor_before\|cursor_after` |
| `scroll` | `app`, `element_index`, `direction` | `pages: number`. **no `x`/`y`** |
| `drag` | `app`, `from_x`, `from_y`, `to_x`, `to_y` | |
| `press_key` | `app`, `key` | xdotool-style (`Return`, `super+c`, `KP_0`) |
| `type_text` | `app`, `text` | |

`list_apps` description: running apps + apps used in the last 14 days, with usage frequency.

`get_app_state` description: “Start an app use session if needed, then get the state of the app's key window and return a screenshot and accessibility tree. This must be called once per assistant turn before interacting with the app.” Matches native “session must call `get_app_state` before other actions.”

---

## 4. Live read-only `tools/call`

Called only:

- `list_apps` `{}`
- `get_app_state` `{ app: "Finder", disableDiff: true }` (extra key ignored by schema; still dispatched)

Both returned MCP success envelopes with `isError: true` (JSON-RPC `result`, not `error`):

```json
{
  "content": [
    { "type": "text", "text": "Computer Use server error -10000: Sender process is not authenticated" }
  ],
  "isError": true,
  "_meta": {
    "codex/telemetry": { "span": { "did_trigger_server_user_flow": false } }
  }
}
```

(`_meta` was present on `list_apps`; `get_app_state` returned the same text error without the telemetry object in this capture.)

Native mapping (`@oai/sky` `errors.js`): **-10000 = `senderProcessNotAuthenticated`**. Client ↔ service is **XPC** (`ComputerUseIPCXPCTransport` / `SAIComputerUseIPCXPCProtocol`), with leftover Apple Event strings for bootstrap-port / PID. A Node parent is not a trusted ChatGPT ancestor (`MISSING_PARENT` / `UNTRUSTED_PARENT` / `RELAY_WITHOUT_TRUSTED_ANCESTOR` in the same binary).

This is **not** a framing bug. NDJSON initialize + `tools/list` completed in ~300 ms; the auth error is the service/client gate.

The unix-socket path (`verify/native-ipc.mjs`, `CodexComputerUseIPC-5`) is the other live path and does **not** go through this MCP process.

---

## 5. Map: MCP tool → tinysky JS → sky window → IPC

Two model APIs, one native service.

```
traces / unified-computer-use
  js { code: "await cua.getApp('Linear'); await linearApp.click([119,35])" }
    → tinysky App façade (camelCase, app handle closed over)
      → sky.window (snake_case, { app, element_index, ... })
        → MacComputerUseClient (camelCase)
          → unix JSON-RPC  uint32le + JSON   CodexComputerUseIPC-5
            → SkyComputerUseService

computer-use plugin MCP
  tools/call { name: "click", arguments: { app, element_index, x, y } }
    → ComputerUseMCPServer
      → XPC ComputerUseIPCXPCTransport
        → same SkyComputerUseService
```

### 5.1 Inventory / observation

| MCP tool | tinysky JS (traces) | sky window | IPC `requestType` |
|---|---|---|---|
| `list_apps` | `cua.listApps()` | `sky.list_apps()` | `ComputerUseIPCListAppsRequest` |
| `get_app_state` | `cua.getApp(name)` (first call, `disableDiff: true`) | `sky.get_app_state({ app, disableDiff? })` | **`ComputerUseIPCAppStartRequest`** (session) then **`ComputerUseIPCAppGetSkyshotRequest`**; policy `ComputerUseIPCAppPolicyRequest` |
| `get_app_state` (again) | `app.getAXState()` / `getScreenshot()` / `getAXStateAndScreenshot()` | same `get_app_state` | `ComputerUseIPCAppGetSkyshotRequest` |

Tinysky `create_tinysky_alt`: `cua.getApp(t)` calls `sky.get_app_state({ app: t, disableDiff: true })` then returns an `App` object that re-calls `sky.get_app_state` for AX/screenshot. MCP `get_app_state` is that whole observation, not a persistent handle.

MCP schema **omits `disableDiff`**. JS/sky/IPC all have `disableDiff`. Passing it from this probe did not change the -10000 outcome.

### 5.2 Actions (shape only — not called live)

All of these are `ComputerUseIPCAppPerformActionRequest` with a tagged `action`. JS wrappers (`targets/mac/*.js`) snake_case → `MacComputerUseClient` camelCase → IPC.

| MCP tool | tinysky JS | sky window | IPC `action` key (`mac-client.js`) |
|---|---|---|---|
| `click` | `app.click(index \| [x,y], { mouseButton, clickCount })` | `sky.click({ app, element_index?, x?, y?, mouse_button?, click_count? })` | `{ click: { at, clickCount, mouseButton } }` |
| `drag` | `app.drag([x,y],[x,y])` | `sky.drag({ app, from_x, from_y, to_x, to_y })` | `{ drag: { from, to } }` |
| `scroll` | `app.scroll(index \| [x,y], direction, pages?)` | `sky.scroll({ app, element_index?, x?, y?, direction, pages? })` | `{ scroll: { at, direction, pages } }` |
| `press_key` | `app.pressKey(key)` | `sky.press_key({ app, key })` | `{ pressKey: { _0: key } }` |
| `type_text` | `app.typeText(text)` | `sky.type_text({ app, text })` | `{ type: { _0: text } }` |
| `set_value` | `app.setValue(index, value)` | `sky.set_value({ app, element_index, value })` | `{ setValue: { elementID, value } }` |
| `select_text` | `app.selectText(index, text, { prefix, suffix, selectionType })` | `sky.select_text({ …, selection_type })` | `{ selectText: { elementID, text, prefix, suffix, selection } }` |
| `perform_secondary_action` | `app.performSecondaryAction(index, action)` | `sky.perform_secondary_action({ app, element_index, action })` | `{ performSecondaryAction: { action, elementID } }` |
| **(no MCP tool)** | `app.paste(text, { format })` | `sky.paste({ app, text, format })` | `{ paste: { text, format } }` — `PasteCodingKeys` exists natively |
| **(no MCP tool)** | — | `sky.start_audio_recording?` / `stop_audio_recording?` (if `SKY_ENABLE_AUDIO=1`) | `ComputerUseIPCStartAudioRecordingRequest` / `Stop…` |

Native action coding keys also include `ActivateCodingKeys` / `DeactivateCodingKeys` (not on sky window or this MCP).

### 5.3 Browser trace APIs — **not on this server**

`cua.getBrowser`, `cua.listTabs`, `cua.getTab`, `tab.click`, `tab.getAXState`, `tab.playwright`, `tab.dev.logs`, `nodeRepl.write` live on **`cua_repl` / `node_repl` `js`**, `@oai/browser-desktop`. `cua mcp` has no browser tools.

### 5.4 Schema deltas MCP vs JS/sky

| Topic | MCP (live) | sky window / tinysky |
|---|---|---|
| `element_index` | JSON Schema **string** | number; native then `String(index)` as `elementID` |
| `get_app_state.disableDiff` | absent | JS `disableDiff` / tinysky `disableDiffing` |
| `scroll` coordinates | **required `element_index`**, no `x`/`y` | index **or** `x`/`y` |
| select-mode field | `selection` | sky d.ts `selection_type` → wrapper maps to native `selection` |
| mouse button | enum `left\|right\|middle` only | also `l`/`r`/`m` / 0/1/2 in `MacComputerUseClient` |
| `paste` | missing | Mac-only sky method |
| closed-over `app` | every tool takes `app: string` | tinysky `App` closes over the name; traces look like `linearApp.click(119)` |

---

## 6. What this proves for GOAL.md step 6

GOAL: “Official client — `SkyComputerUseClient mcp` `tools/list` + a read tool.”

| Check | Status |
|---|---|
| Signed client exists and runs `mcp` | pass |
| `cua help mcp` | pass |
| Plugin `.mcp.json` → launcher → this binary | pass |
| Framing | **NDJSON**, not Content-Length. Harness `mcp-client.mjs` currently fails. |
| `tools/list` | pass, 10 names = sky window API |
| Read tool dispatch | pass as MCP call; native result **-10000** without ChatGPT parent |
| Mutating tools / Linear / Messages send | **not called** (safety) |

---

## 7. Artifacts

| File | What |
|---|---|
| `/Users/dongdong/Desktop/codex-cua-reverse/verify/agents/v3-mcp-client/probe.json` | NDJSON initialize + full schemas + read-only calls |
| `/Users/dongdong/Desktop/codex-cua-reverse/verify/agents/v3-mcp-client/harness-stdout.json` | Content-Length timeout |
| `/Users/dongdong/Desktop/codex-cua-reverse/verify/mcp-client.mjs` | original harness (writes Content-Length, no trailing `\n` on the JSON body) |
| `/Users/dongdong/Desktop/codex-cua-reverse/verify/agents/v3-mcp-client/probe.mjs` | NDJSON probe used for the live session |
