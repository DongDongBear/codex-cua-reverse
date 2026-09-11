# IAB / Chrome 宿主怎么发现、怎么握手（JS）

扫描目录：macOS `/tmp/codex-browser-use`，Windows `\\.\pipe\codex-browser-use`（`browser-service.mjs` 里 `ma()`）。

`rpc("browser").setup` **只建 manifest，不连 sock**。所以旁路 setup 成功、`getBrowser` 仍空。完整握手：`agents/26-iab-handshake/FINDINGS.md`。

旁路 REPL 能 `rpc("browser").setup` 拿到 `apiManifest`，但 `getBrowsers()` 仍空：sock **文件在** 不等于已登记会话。扩展还要求 `agent_request_header_enabled`；版本不够会抛：

`This browser requires agent request headers. Update the Chrome extension before continuing.`

会话参数带 `session_id` / `turn_id`（Codex turn metadata）。没有 ChatGPT 把 IAB 登记进这条 REPL，扫描结果不会变成可用 `type:"iab"` 浏览器。

## 服务里出现的命令名（抽样，给 Agent 用的 RPC 名）

浏览器：`browser_visibility_set/get`、`browser_viewport_set/reset`、`browser_management_call`、`browser_user_claim_tab`、`browser_user_open_tabs`、`get_browser_for_url`

标签：`tab_ax_get_state`、`tab_ax_action`、`tab_cdp_call`、`tab_cdp_events`、`tab_screenshot`、`tab_dev_logs`、`tab_clipboard_*`、`navigate_tab_*`、`tab_page_assets_*`、`tab_content_export*`

WASM 修订（AX 文本）：`computer_use_browser_wasm_revision_*`

更细的 sock JSON-RPC 帧由 agents/26 补。
