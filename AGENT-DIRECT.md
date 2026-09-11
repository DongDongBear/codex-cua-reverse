# Agent 直接调逆向包（不经过 ChatGPT）

调用方：本机 Grok agent，不是 ChatGPT 会话。  
二进制：`cua_node/bin/node_repl`、`SkyComputerUseClient mcp`、`@oai/sky` / tinysky banner。

## 我调通了什么

| 调用 | 结果 |
|---|---|
| `node_repl` MCP `initialize` / `tools/list` | OK。工具 `js` / `js_reset` / `js_add_node_module_dir`。server `rmcp` |
| `js` + banner `setupCUA` | OK。倒出和抓包一样的 Computer Use TypeScript API |
| `nodeRepl.rpc("sky", {type:"setup"})` | OK。`target:"mac"`，方法含 list_apps/click/paste/… |
| `nodeRepl` 对象 | 只有 `cwd, env, homeDir, tmpDir, requestMeta, write, emitImage, rpc`。**没有 nativePipe** |
| `SkyComputerUseClient mcp` `tools/list` | OK。10 个工具：list_apps, get_app_state, click, perform_secondary_action, set_value, select_text, scroll, drag, press_key, type_text（无 paste） |

## 我调不通什么（鉴权，不是包调错）

| 调用 | 结果 |
|---|---|
| `js`: `cua.listApps()` / `cua.getApp("Finder")` | `Sky Computer Use native pipe startup failed`（~5.4s，ping 被踢） |
| `js`: `cua.getBrowser()` | `No browser is available` |
| `js`: `createBrowserTab("iab", …)` | `Browser is not available: iab` |
| MCP `tools/call list_apps` | 无 JSON-RPC 结果（此前同路径是 −10000） |

日志：`verify/results/debug-live.json`、`verify/results/agent-direct-mcp.json`。

**结论：** 逆向的 JS/MCP 包我能自己 load、setup、列工具。点屏/IAB 仍要求 ChatGPT 当父进程。这不是「没调用」，是发送方认证拒绝这个 agent。
