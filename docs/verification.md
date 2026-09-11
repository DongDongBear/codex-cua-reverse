# 验证

不冒充 ChatGPT 当发送方。点屏效果来自 ChatGPT 会话的抓包 + 残留窗口；包能否 load 来自本 agent 直调。

## 抓包

| 会话 | 路径 | 结论 |
|---|---|---|
| 两轮主任务 | 本机 `codex拦截-两轮-raw.json` | 37× `js` + `js_reset` + `request_user_input_async`；`exec` 0 次 |
| 1074 | `codex-traffic/2026-09-11/1074_…` | 19 步 Finder 桌面：paste 超时、白图、scroll/drag −10005、无 Raise；IAB example.com 14–19 OK。后又 11 步本地页：fill/click OK，scroll detached |
| 1161 | `codex-traffic/2026-09-11/1161_…` | 12× `js`。换 TextEdit + 文件夹窗口后 paste/截图/Raise/scroll **OK** |

1161 逐步对照（你报的结果 × websocket code）原表在 `archive/legacy/ALIGN.md`，要点：

- `setValue(2,'CUA-ALIGN-OK')` + `paste('align-paste')` → 正文拼接
- Finder `performSecondaryAction(...,'Raise')` 打在 **窗口** 节点
- `scroll(34,'down',1)` 条 0→~0.77
- `createBrowserTab(..., 127.0.0.1:8765, {visible:true})` + playwright `#name/#btn-ok`
- Alert CDP 超时、再取 AX 超时：API 有，这次没跑成

## 残留界面（读，不点）

核过：TextEdit `Untitled` 正文 `CUA-ALIGN-OKalign-paste`；Finder 窗口名 `codex-cua-reverse`；`http://127.0.0.1:8765/` 测试页还在。

## 静态 + 本 agent 调包

- `verify/static-contract.mjs`：**22/22** 抓包 API 能在 tinysky / api.json / IPC 名里找到
- `node_repl` MCP：`js` 工具、banner、`rpc("sky").setup` 方法表 **OK**
- `cua.listApps` / `getApp`：`native pipe startup failed`
- `SkyComputerUseClient` `tools/list`：10 个工具 **OK**；`list_apps`：−10000 / 无结果

日志：`verify/results/debug-live.json`、`agent-direct-mcp.json`。

## 怎么读这些结果

API 形状和错误语义是稳的（1074 桌面失败、1161 有窗口成功）。  
这个 agent 自己点不了屏，是发送方认证，不是包调错。
