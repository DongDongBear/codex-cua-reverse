# Live verification (reconstructed protocol actually called)

Date: 2026-09-10. Against running ChatGPT.app + `SkyComputerUseService` pid 3802.

## What was called

### 1. Native unix socket (reconstructed JSON-RPC)

Socket: `~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock`  
Frame: `uint32le` + JSON-RPC 2.0, method `ping` / `request`, version `CodexComputerUseIPC-5`.

| Caller | Result |
|---|---|
| system Node (Node.js Foundation) | connect ok, then **socket closed** on ping |
| OpenAI-signed `cua_node/bin/node` (Team `2DC432GLL2`, app group `2DC432GLL2.com.openai.sky.CUAService`) | same: **socket closed** |
| Conclusion | Raw `net.createConnection` is **not** enough. Trusted path is `nodeRepl.nativePipe` (node_repl) or signed `SkyComputerUseClient` **XPC**. Error family: `senderProcessNotAuthenticated` **-10000**. |

Evidence: `verify/results/native-ipc.json`, `verify/results/sky-shim.json`.

### 2. SkyComputerUseClient MCP (live, this session)

Framing is **newline JSON-RPC**, not `Content-Length` (Content-Length → `-32700 Invalid message format`).

`initialize` → server `Computer Use`.

`tools/list` returned **exactly** the Mac window Computer Use surface:

| MCP tool | Schema | Matches traces / tinysky |
|---|---|---|
| `list_apps` | `{}` | `cua.listApps` / `sky.list_apps` |
| `get_app_state` | `{app}` required | `cua.getApp` + `getAXState` / `getScreenshot` |
| `click` | `{app, element_index?, x?, y?, mouse_button?, click_count?}` | `app.click(index \| [x,y])` |
| `perform_secondary_action` | `{app, element_index, action}` | `app.performSecondaryAction` (trace: `"Raise"`, `"zoom the window"`) |
| `set_value` | `{app, element_index, value}` | `app.setValue` |
| `select_text` | `{app, element_index, text, prefix?, suffix?, selection?}` | Target.selectText (unused in traces) |
| `scroll` | `{app, element_index, direction, pages?}` | Target.scroll (unused) |
| `drag` | `{app, from_x, from_y, to_x, to_y}` | Target.drag (unused) |
| `press_key` | `{app, key}` | `app.pressKey` (`c`, `super+space`, `Return`) |
| `type_text` | `{app, text}` | `app.typeText` |

**Not on this MCP list:** `paste` (traces **did** call `app.paste`), `start_audio_recording` / `stop_audio_recording` (gated). Paste exists on JS `@oai/sky` Mac client + tinysky Target, not on this MCP server.

Live `tools/call list_apps` (from this unsigned parent):

```
Computer Use server error -10000: Sender process is not authenticated
```

Live `get_app_state` without `app`: schema reject `Missing required argument: app` (schema reconstruction confirmed).

Evidence: `verify/results/mcp-ndjson.json`.

### 3. Static contract vs traces

22/22 unique trace APIs match tinysky types + IPC request type names.  
`verify/results/static-contract.json` exit 0.

Raw file `/Users/dongdong/Desktop/codex拦截-两轮-raw.json`: **37× `js` + 1× `request_user_input_async` + 1× `js_reset`**. Pre-extracted `traces/*.json` had two `js?` empties; websocket `output_item.done` names them (agent 05).

## Independent agents (v2–v6)

| Agent | 结论 |
|---|---|
| v2 sky shim | 编码路径正确（ListApps / GetSkyshot / PerformAction）。socket 上 `ping` 后对端 FIN，0 字节 JSON-RPC。 |
| v3 MCP | NDJSON `tools/list` = 10 个 sky 工具。`list_apps`/`get_app_state(Finder)` → **-10000**。无 `paste`。 |
| v4 browser | 活着的 `node_repl` 已加载 `@oai/browser-desktop/service`。无 trusted REPL 的 import 失败符合源码。任务 1 API 都能对上 RPC 命令名。 |
| v5 matrix | 抓包 API **没有** `live_pass`（本进程过不了鉴权）。shape_ok 20；原生观测 5 个 live_fail。 |
| v6 adversarial | 帧格式/版本/方法名/getBrowser 不开页 在源码成立。`js?` **不是**空 js：分别是 `request_user_input_async` 和 `js_reset`。 |
| v7 MCP NDJSON | 与 v3 一致：10 工具、无 paste。OpenAI 签名的 `cua_node` **照样**被 unix ping 踢掉（Identifier 仍是 `node`）。可信路径是 `node_repl.nativePipe` 或 ChatGPT 拉起的 `SkyComputerUseClient`。 |

## Safety

No Linear click/type/setValue/paste was replayed. No screenshot bytes written.
