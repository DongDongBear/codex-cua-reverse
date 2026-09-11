# 现场调试（2026-09-11）

脚本：`verify/debug-live.py`  
日志：`verify/results/debug-live.json`

用逆向出来的路径真跑了一次：**本机 `cua_node/bin/node_repl` + `js` + tinysky banner**（和 ChatGPT 桌面同一套二进制）。

## 通了的

| 步骤 | 结果 |
|---|---|
| MCP `initialize` / `tools/list` | NDJSON，工具就是 `js` / `js_reset` / `js_add_node_module_dir` |
| 第一段 `js` | banner `setupCUA({browser,computer})` 跑起来，倒出 Computer Use 文档（和抓包 first-use 同一份） |
| `nodeRepl.rpc("sky", {type:"setup"})` | **`target:"mac"`**，方法：`list_apps, get_app_state, click, drag, paste, perform_secondary_action, press_key, scroll, select_text, set_value, type_text`（**有 paste**，和 MCP 10 工具表对得上并多了 paste） |
| `nodeRepl.rpc("browser", {method:"setup", ...})` | 成功，`apiManifest` 回来，`disabledMemberIds=[]` |
| `NODE_REPL_REQUEST_META` | `session_id` / `turn_id` 已注入 |

这说明：**js 工具、tinysky、sky Mac 客户端、browser-desktop setup，按逆向数据是对的。**

## 没通的（UI 没动起来）

| 步骤 | 错误 |
|---|---|
| `cua.listApps()` / `cua.getApp("Finder")` / `rpc sky list_apps` | `Sky Computer Use native pipe startup failed` |
| `cua.getBrowser()` / `listTabs` | `No browser is available` |
| `createBrowserTab("iab", example.com, {visible:true})` | `Browser is not available: iab` |

独立拉起来的 `node_repl` 里，模型侧 `nodeRepl` 只有：`cwd, env, homeDir, tmpDir, requestMeta, write, emitImage, rpc`。  
**没有** `nativePipe` / `launchServices`（那些在 trusted-worker 里）。`rpc("sky")` 能 setup，但一执行就要连 `computeruse.sock`，仍失败。

浏览器 setup 成功，但 **扫不到 IAB/Chrome 后端**（ChatGPT 没有把 in-app browser 登记给我们这个 REPL）。`/tmp/codex-browser-use/*.sock` 在磁盘上有，握手接不上。

未认证进程连 socket 会被踢，这和之前的 −10000 / ping FIN 是同一道门：服务只给 **ChatGPT 拉起来的那条** `node_repl` 当发送方。

## ChatGPT 桌面真执行（2026-09-11，用户「执行了」）

抓包：`codex-traffic/2026-09-11/0999_WS_backend-api_codex_responses`  
模型：`gpt-6-astra`。只发了一段 `js`：

```js
let app = await cua.getApp("Finder");  // title: 获取 Finder
```

**成功。** 工具结果带 Computer Use 文档 + AX：

```
App: Finder.
0 scroll area (disabled) desktop
  1 container desktop
    2 image … Secondary Actions: open
    …
    21 image (selected) codex-cua-reverse, Secondary Actions: open
22 menu bar
```

ChatGPT 结论（与树一致）：**元素 0 是禁用桌面滚动区，没有 Raise。** 没有发第二段 `performSecondaryAction(0,"Raise")`。

这证明：

1. ChatGPT 自己的 `cua_repl` **能** `getApp("Finder")`（旁路 REPL 不行）
2. `performSecondaryAction` 必须打在 **带该 secondary action 的节点** 上；Linear 的 `Raise` ≠ Finder 桌面的 0
3. 图标 secondary 是 `open`，不是 `Raise`

旁路 `node_repl` 仍然：`native pipe startup failed` / `No browser is available`。

## 你在屏幕上会看到什么

- 旁路脚本：只有日志，不动界面
- ChatGPT 执行：绑定了 Finder，读到桌面图标树；**没有**把窗口 Raise 到前台（0 号不能 Raise）
