# ChatGPT 桌面 Computer Use / Browser Use 实现策略

依据：本机 ChatGPT.app JS/类型、`SkyComputerUseService` 字符串、两轮 raw.json、回归 1074/1161 抓包。  
开源 `openai/codex` 只提供 harness 名字和 TOML 策略，**动作实现全在桌面端**。

刚核过（不经过 ChatGPT 当发送方）：TextEdit 仍是 `CUA-ALIGN-OKalign-paste`；Finder 窗口仍是 `codex-cua-reverse`；静态契约 **22/22**；1161 仍是 12× `js`。

---

## 1. 产品策略：一个 JS REPL，两套后端

模型 **不** 调 `computer_click` 这种扁平 tool。桌面主会话广告的是：

- `mcp__cua_repl.js` / `js_reset`（wire 名 `js`）
- 旁边的 `functions.exec` **从不用于点 UI**（两轮 0 次）

策略是：给模型一个 **持久 Node 沙箱**，全局 `cua`，自己写控制流（循环、条件、Playwright locator）。状态跨 `js` 调用保留，直到 `js_reset`。

插件 `unified-computer-use` 的 `launch.mjs`：

1. 读 `CUA_REPL_ENABLED_SURFACES`（`browser,computer`）
2. 拼 `js` description（markdown 工具说明）
3. spawn `cua_node/bin/node_repl`，注入  
   `NODE_REPL_TRUSTED_SERVICES = { browser: @oai/browser-desktop/service, sky: @oai/sky/service }`
4. Electron 打开 tinysky 后删掉旧 Browser/Chrome 技能，把模型赶到 `cua.*`

Stop/Interrupt hook → `cua_repl.turn_ended`（GitHub `bundled_hooks.rs` 对得上）。

---

## 2. 运行时：不信任的 kernel + 信任的 worker

`node_repl`（Rust MCP）拉两个 Node：

| | kernel（模型 `js`） | trusted-worker |
|---|---|---|
| `nodeRepl` | `write` / `emitImage` / `rpc` / 路径 | 另有 `nativePipe`、`launchServices`、`createElicitation`、`fetch`、`config` |
| 权限 | VM，`codeGeneration.strings=false` | 可连 unix sock、开 Computer Use.app |
| 调后端 | `rpc("sky"\|"browser", …)` | 真正执行 `@oai/sky` / `@oai/browser-desktop` |

第一段 `js` 会跑 banner `setupCUA`，把 `@oai/cua` tinysky-alt 装成全局 `cua`。  
`exec_redacted_source` 在 evaluate 前发给 guardian（标识符打码），不是模型看到的输出。

---

## 3. 模型 API：tinysky 把两套后端收成同一套 Target

`cua.getBrowser` / `cua.getApp` 都返回 **Target**：`click` / `typeText` / `getAXState` / `setValue` / `paste` / `pressKey` / `scroll` / `drag` / `performSecondaryAction`。

| 入口 | 后端 | 抓包 |
|---|---|---|
| `getBrowser({url?})` | **只选**浏览器，不开标签 | 任务1 |
| `createBrowserTab(id, url, {visible, sessionName})` | 才开页 | 1074/1161 IAB |
| `getTab` / `listTabs` | 绑定已有标签 | 任务1 id `"1"` |
| `getApp("Linear"\|bundle id)` | 原生 AX | 任务2、1161 TextEdit/Finder |
| `listApps` / `getState` | 库存 | 回归 |

浏览器上同一 Tab 还叠了 Playwright / 坐标 CUA / DOM CUA / capabilities（cdp、webmcp…）。任务1 用 AX click + `browser.tabs.get` 上的 `playwright.locator.fill/press/evaluate`。evaluate 在 **只读** world。

IAB vs Chrome：`"iab"`/`"chrome"` 是选型别名；运行时 `browserId` 是 `"1"`。IAB 没有 `claimTab`；`nameSession` 在 IAB 是 no-op，Chrome 是标签组标题。

---

## 4. 原生点屏：JS 编码，Swift 执行

trusted-worker 里 `@oai/sky` → unix JSON-RPC `CodexComputerUseIPC-5`：

```
uint32le 长度 + JSON
ping { clientApiVersion }
request { requestType, request, deadline, codexTurnMetadata }
```

| 模型 | IPC |
|---|---|
| listApps / getAX / 截图 | `ListApps` / `AppGetSkyshot` |
| click/type/paste/scroll/drag/setValue/Raise | `AppPerformAction` 的不同 `action` 键 |
| 审批 | `AppPolicyRequest` |

进程：`SkyComputerUseService`（`com.openai.sky.CUAService`），sock 在 Group Container。  
动作后 settle：二进制里能看到 **0.25s / 5.0s**。`format:'md'` 会经 SlimCore **渲染**成富文本。

**发送方认证**（旁路点不了的原因）：

- unix：`LOCAL_PEERTOKEN`，未认证 **直接 FIN**
- MCP client：能 `tools/list`，动作 → **−10000** `RELAY_WITHOUT_TRUSTED_ANCESTOR`
- 认 parent/responsible 的 team + signing id；要 `node_repl` 且祖先是 `com.openai.codex*`

官方 MCP 工具表比 JS 少 **paste**（JS/IPC 有；MCP `tools/list` 没有）。

---

## 5. 浏览器宿主

trusted browser-service **不**在 setup 时连 sock。ChatGPT 按会话在 `/tmp/codex-browser-use/<uuid>.sock` **listen**；service `readdir` + `getInfo`。没有单独 handshake token，但要：

1. `nativePipe.createConnection`（trusted）
2. peer 代码签名
3. 每个调用带 `session_id` / `turn_id`
4. IAB 还要这条 session 在 ChatGPT 里有 **route**

旁路假 meta → `No browser is available`。ChatGPT 会话里 `createBrowserTab(..., 127.0.0.1:8765, {visible:true})` 能开页（http 200）。

导航后 AX 下标作废（detached）；要先重新 `getAXState`。弹窗必须先点出 dialog，`getJsDialog` 才有对象。

---

## 6. 策略与确认（两层）

| 层 | 能否挡住 click |
|---|---|
| prompt：`confirmations.md`、技能「提交前确认」 | **不能**。native 不读聊天 |
| `ComputerUseIPCAppPolicyRequest` → allowed/denied/forbidden | **能** |

`allowed` 后 `createElicitation`；host 可用已批准 bundle 自动同意，并把 `app` 冻成路径。  
`BundleIdentifiers` 有 terminal / 密码管理器 / browser / ChatGPT 自身 / SecurityAgent 等 cluster（抽样 42 个 id，**不是**完整表）。`com.google.Chrome` 不在这串里，走 Chromium 检测。Linear 现场：`allowed` + `risk: high` + 可持久批准。

URL 黑名单管浏览器目标，不管 Linear.app。

`request_user_input_async` 是 Codex `functions`，**不是** CUA。

---

## 7. 错误怎么用

JS `ServerErrorCode` −10000…−10020；native 还有 −10021…−10029（Messages/`turnEnded`）。  
`message` 是 native 字符串：−10005 既可能是 `noWindowsAvailable`，也可能是 `pasteboardReadTimedOut`。  
坐标/scroll 打在没有内容窗口的桌面 → −10005。有窗口的 TextEdit/文件夹窗口则 paste/截图/Raise/scroll 都成功（1161 vs 1074）。

---

## 8. 实现策略一句话

ChatGPT 把「操作电脑」做成 **受宿主监护的 JS 智能体**：模型只写 `cua.*`；真正的 AX/CGEvent/IAB 锁在签名过的父进程后面；策略在 native，文案确认只是 prompt。开源仓负责挂上 `cua_repl` 这个名字，不负责点屏。
