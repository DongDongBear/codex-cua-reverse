# 第 3 段 — 桌面原生 Computer Use（tinysky App / sky / MCP）

**验证：PASS。** raw.json 任务 2：25 个 `output_item.done`（23×`js` + `request_user_input_async` + `js_reset`），49 处 API 引用全部在 tinysky Target 文档里。`verify/results/block3-native-traces.json`。

GitHub openai/codex **没有** `cua.getApp` / `sky.click`。只有：

- `computer_use.rs`：按 bundle id allow/deny
- `cua_repl.turn_ended` hook
- Guardian `computer_use_only`

## 模型写法（抓包）

同一 `js` 工具，绑定原生 App：

```js
let linearApp = await cua.getApp("Linear");          // 显示名
linearApp = await cua.getApp("com.linear");          // bundle id（listApps 之后）
await linearApp.getScreenshot();
await linearApp.performSecondaryAction(0, "Raise");
await linearApp.click(8);                            // AX index
await linearApp.click([119, 35]);                    // 坐标；曾返回 -10005 noWindowsAvailable
await linearApp.pressKey("c");                       // xdotool 风格
await linearApp.typeText("...");
await linearApp.paste(longText, { format: "text" });
await linearApp.setValue(128, "...");
await linearApp.getAXState();
await linearApp.getAXStateAndScreenshot();
await cua.listApps();
```

中途 `js_reset` 清 REPL 绑定，不清 App。其后必须重新 `getApp`。

## 三层同名（已和 live MCP `tools/list` 对过）

| tinysky Target | `@oai/sky` window | 本机 MCP（SkyComputerUseClient） |
|---|---|---|
| `cua.listApps` | `list_apps` | `list_apps` |
| `cua.getApp` + getAX/screenshot | `get_app_state` | `get_app_state` `{app}` |
| `click` | `click` | `click` `{app, element_index?, x?, y?, ...}` |
| `performSecondaryAction` | `perform_secondary_action` | 同名 |
| `setValue` | `set_value` | 同名 |
| `pressKey` | `press_key` | 同名 |
| `typeText` | `type_text` | 同名 |
| `paste` | `paste`（Mac JS 有） | **MCP 列表没有** ← 抓包用了 paste |
| `selectText` / `scroll` / `drag` | 有 | MCP 有；**抓包未用** |
| audio start/stop | 可选，`SKY_ENABLE_AUDIO` | MCP 列表没有 |

Live：`tools/list` 成功。`tools/call list_apps` 从本进程返回 **`-10000 Sender process is not authenticated`**（鉴权本身也是逆向结果）。直连 `computeruse.sock` 会被踢；必须 `node_repl.nativePipe` 或 ChatGPT 拉起的 client。

IPC：`CodexComputerUseIPC-5`，`ComputerUseIPCListAppsRequest` / `AppGetSkyshotRequest` / `AppPerformActionRequest`。
