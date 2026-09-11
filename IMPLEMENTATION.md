# ChatGPT 如何实现 Computer Use / Browser Use

本文把 **已经抠出的 JS 源码** 串成实现策略，并对 **没反编译的 Swift 模块** 给出有依据的猜测。  
证据：`vendor/` 里的 `launch.mjs`、`create_tinysky_alt.js`、`native-pipe.js`、sky `mac-client`、browser-desktop；`SkyComputerUseService` 字符串/类型；抓包 0127/0223、1074、1161。

核过（不经过 ChatGPT 当发送方）：TextEdit 仍是 `CUA-ALIGN-OKalign-paste`；Finder 窗口 `codex-cua-reverse`；静态契约 22/22。

---

## 一、产品策略：不给 click tool，给一个受监护的 JS 智能体

模型在桌面主会话里看到的不是 `computer_click(x,y)`，而是 **`js`**（广告名 `mcp__cua_repl.js`）。旁边的 `functions.exec` 是 code-mode，两轮抓包 **0 次**用于点 UI。

这样做的原因从源码能看出来：

1. **控制流留给模型。** 一次 `js` 里可以 `getApp`、循环 `getAXState`、再 `click`。扁平 tool 做不到。
2. **状态跨调用保留。** `node_repl` 顶层绑定直到 `js_reset`。任务2 中途 `js_reset` 后必须重新 `getApp`。
3. **真正危险的能力不给模型进程。** kernel 里的 `nodeRepl` 只有 `write` / `rpc`；`nativePipe` 在 trusted-worker。

开源 `openai/codex` 只认识名字：`cua_repl` 和 `node_repl` 算同一类 REPL（`mcp.rs`），Stop hook 打 `turn_ended`。**点屏代码不在 GitHub。**

---

## 二、进程怎么接上（源码）

### 1. 插件把 markdown 变成工具描述

`vendor/plugins/unified-computer-use/launch.mjs`：

- 环境变量 `CUA_REPL_NODE_REPL_PATH` 必须是绝对路径（ChatGPT 写成 `cua_node/bin/node_repl`）。
- `CUA_REPL_ENABLED_SURFACES` 默认 `browser,computer`，决定 banner 是 `banner.js` / 只有浏览器 / 只有电脑。
- spawn 时注入：
  - `NODE_REPL_TRUSTED_SERVICES`：`{ browser: "@oai/browser-desktop/service", sky: "@oai/sky/service" }`
  - `NODE_REPL_JS_BANNER`：banner 源码（首 cell 会 `setupCUA`）
  - `NODE_REPL_TOOL_OVERRIDES`：把 `js-tool-description.md` + browser/computer/output md **拼进 `js.description`**

所以拦截里看到的超长 `js` 工具说明，不是模型权重里的，是 **本机 markdown 拼出来的**。

Electron 打开 tinysky 后会删掉旧 Browser/Chrome/Computer Use 技能目录（agent 12 / app.asar），避免模型和 `cua.*` 抢两套 API。

### 2. node_repl：两个 Node，一种 MCP

Rust `node_repl` 是 MCP stdio 服务器（`rmcp`）。它拉：

| 进程 | 装的 `nodeRepl` | 干什么 |
|---|---|---|
| **kernel.js**（untrusted VM） | `write`、`emitImage`、`rpc`、路径 | 跑模型的 `code` |
| **trusted-worker.js** | 另有 `nativePipe.createConnection`、`launchServices`、`createElicitation` | 跑 `@oai/sky/service`、`@oai/browser-desktop/service` |

模型 `await cua.listApps()` 在 kernel 里走 tinysky → `sky.list_apps` → **`nodeRepl.rpc("sky", {type:"execute", method:"list_apps"})`** → worker 里才碰 socket。

旁路我自己 spawn 的 `node_repl`：`rpc("sky").setup` 能成功（Mac 方法表回来），`listApps` 失败在 worker 连 sock 的 **ping 被踢**。这证明拆进程的策略成立：setup 不连 sock，execute 才连。

---

## 三、tinysky：把浏览器和 App 收成同一套 Target

核心是 `vendor/cua/js/create_tinysky_alt.js`（`create_tinysky_alt`）。

### 第一次调用会倒文档

内部 `emit` 用 `nodeRepl.write(..., channel)`：

- `cua.core`：tinysky 核心文档；computer 打开时再拼 confirmation policy
- `cua.browser`：每个 **新的 browserId** 倒一次该浏览器的 API 文档
- `cua.state`：AX 文本等状态

所以任务1 第一次 `getBrowser` 工具结果特别长，不是 bug，是 **故意把 API 手册灌进上下文**。`js_reset` 后再 `getApp` 会再倒 computer 文档（约 21k，没有 Playwright）。

### `getBrowser` 故意不开页

源码顺序：`id` → `getForUrl(url)` → `getDefault()` → `list()[0]`。  
`url` 只用来选「哪个浏览器」，**没有** `tabs.new()`。开页是 `createBrowserTab`：

1. `browsers.get(browserId)`
2. 可选 `nameSession`（IAB 上函数存在但是 **no-op**；Chrome 才改标签组标题）
3. `capabilities.get("visibility").set(visible)` **先于** 开标签
4. `tabs.new()` + 可选 `goto(url)`
5. 立刻 `getAXState({disableDiffing:true, emit:false})` 再 emit

1161 打开 `http://127.0.0.1:8765/` 走的就是这条，不是 `getBrowser({url})`。

### `getApp` 是 Mac 专用包装器

```js
if (sky.target !== "mac") throw Native app bindings unavailable
const state = await sky.get_app_state({ app, disableDiff: true })
// 返回 Target：click 把 number|[x,y] 译成 element_index 或 x,y
```

注意字段名：**tinysky 的 `disableDiffing` 在 native 上变成 `disableDiff`**。混用等于没传。1161 TextEdit/Finder 用的是 `disableDiffing: true`。

`click(8)` → `{app, element_index:8}`；`click([119,35])` → `{app, x, y}`。任务2 坐标点菜单栏曾 **−10005 `noWindowsAvailable`**：native 认为没有可截的内容窗口。

浏览器 Target 是 `decorateTab`：同样的 `click/typeText` 转到 `tab.ax.*`。`paste` **不是** IPC paste：写 clipboard 再 **`pressKey("Ctrl+v")`**（服务把 Ctrl 映射成 ControlOrMeta → Mac 上是 Meta）。native `app.paste` 才走 IPC `action.paste` 并恢复剪贴板。

---

## 四、原生 Computer Use：JS 只编码，Swift 才点屏

### JSON-RPC 帧（已还原）

`vendor/sky/js/native-pipe.js`：

- 帧：`uint32le` + UTF-8 JSON，最大 8MiB
- `ping { clientApiVersion: "CodexComputerUseIPC-5" }`，服务端必须回同一 `serverApiVersion`
- `request { clientApiVersion, requestType, request, deadlineUnixMilliseconds, codexTurnMetadata }`
- 启动：先连 Group Container `computeruse.sock`（250ms）；失败则 `ensureService`（内部 host pipe，正式包通常不起）或 `launchServices.openApplication(com.openai.sky.CUAService)`；再连 5s。仍失败 → **`native pipe startup failed`**（旁路看到的就是这个，不是「没有 sock」）

请求串行：`this.#queue = this.#queue.then(() => rpc())`，同一时间只有一个 in-flight request。

### 谁在点

`SkyComputerUseService`（home 拷贝与 ChatGPT 捆绑 **字节相同**）。  
`SkyComputerUseClient` 只是 MCP/XPC 客户端，自己不动鼠标。  
锁屏另有 `CUALockScreenGuardian`。

JS `PerformAction` 的 action 键：`click` / `type` / `paste` / `pressKey` / `scroll` / `drag` / `setValue` / `selectText` / `performSecondaryAction`。  
观察一律 `AppGetSkyshotRequest`（AX 文本 + 可选截图）。模型看到的是缩进文本 + **JPEG data URL**，即使 JS 侧文件是 `file://` PNG。

官方 MCP `tools/list` **没有 paste**，JS/IPC 有。1161 TextEdit `paste({format:'text'})` 成功，正文变成 `CUA-ALIGN-OKalign-paste`。

---

## 五、Browser Use：IAB 是 ChatGPT 里的 WebView，不是系统 Chrome

`@oai/browser-desktop` 的 `rpc("browser",{method:"setup"})` **只建 apiManifest，不连 sock**。所以旁路 setup 成功、`getBrowser` 仍 `No browser is available`。

真正的标签在 ChatGPT 进程里：

- 每个会话一个 `/tmp/codex-browser-use/<uuid>.sock`
- UA 前缀 `CodexBrowser`，partition `persist:codex-browser-app-route:{conversation}\0{tab}`
- 发现：trusted worker `readdir` + `getInfo`
- 没有单独 handshake token；要 `nativePipe` + peer 签名 + `session_id`/`turn_id`，IAB 还要这条 session 在 ChatGPT 里有 **route**

Chrome/Edge 是另一条：Native Messaging `com.openai.codexextension`，同一 sock 目录。`claimTab` 只在 extension。任务1 用的是 IAB，`browserId`/`tab id` 都是 `"1"`。

Playwright 不是本机 Playwright 进程：CDP isolated world `browser-use-playwright`。`evaluate` 在 **只读** world。上传走 `filechooser`，没有 `setInputFiles`。1161 `#name`.fill / `#btn-ok`.click 后页面 `ok:CUA-ALIGN`，http 日志 `GET / 200`。

---

## 六、策略：prompt 是演出，native 才是闸门

`withComputerUsePolicy` → `ComputerUseIPCAppPolicyRequest` → `allowed | denied | forbidden`。  
`allowed` 之后 `nodeRepl.createElicitation`。host 可用已批准 bundle 自动同意，并把后续 `app` 冻成 **路径**。

`confirmations.md` / 技能「提交前确认」**挡不住** click：native **不读聊天**。用户说「全权由你控制」后仍能点 Linear，是因为 Linear 不是 forbidden、审批已过。

`request_user_input_async` 是 Codex `functions`，立刻 `accepted:true`，不是 CUA elicitation。

---

## 七、没逆向出的模块：能确定什么、猜测什么

下面 **不是源码**，是字符串 + 类型 + 抓包行为上的推断。标成猜测。

### 1. 发送方认证（Swift，未反编译）

**确定：** 枚举四个 `UNSPECIFIED` / `MISSING_PARENT` / `UNTRUSTED_PARENT` / `RELAY_WITHOUT_TRUSTED_ANCESTOR`。unix 在 accept 用 `LOCAL_PEERTOKEN`，未认证 **0 字节 FIN**，所以旁路看不到 −10000。MCP 经签名 Client 走 XPC，list 工具过、动作 −10000。

**猜：** 允许的 signing id 白名单是 `node_repl` + 祖先 `com.openai.codex{,.alpha,.beta,...}`。Team `2DC432GLL2` 必要但不充分（Identifier=`node` 的 cua_node 仍被拒）。`parentProcessIsCodex` 多半是「沿 parent/responsible 链找到 Codex 签名」。不猜如何伪造。

### 2. App 解析与启动

**确定：** JS 把字符串原样交给 `get_app_state({app})`。−10018 `ambiguousApp`。有 `NSWorkspace` / `runningApplications` 一类符号。

**猜：** 先精确 bundle id，再 `localizedName`/`unlocalizedName`，再 path。多个命中才 ambiguous。未运行则 `NSWorkspace.openApplication`，选项里既有 activate 也有后台 launch 字符串——抓包 Linear `getApp` 会把已开的 App 拉到可 AX，不一定每次都 `activateIgnoringOtherApps`。Finder 桌面 vs 文件夹窗口是 **同一个 app 不同 AX 根**，不是两个 bundle。

### 3. 点击 / 键盘（CGEvent vs AXPress）

**确定：** 链了 `CGEvent`、`EventTap`（click/keyboard/mouse）、`AXPress`、`AXConfirm`、`SyntheticAppFocusEnforcer`。

**猜：** 默认 **EventTap/CGEvent** 合成到屏幕坐标（skyshot 坐标系）；对 AX 节点则先查 `kAXPosition`/`kAXSize` 再点中心。`AXPress` 是后备（菜单、settable 失败时）。`pressKey` 用 xdotool 风格解析（`super+space`）再 CGEvent 键盘 tap。坐标点在「没有内容窗口」时直接 −10005，**来不及**发事件——这解释 1074 桌面 `scroll(0)` / `drag` 几乎 0ms 失败。

### 4. Skyshot（AX 文本 + 截图）

**确定：** ScreenCaptureKit（`SCShareableContent`、`SCStream`）。文本是缩进 role/name，id 单调不复用。diff 默认 `+`/`~`/`Removed element IDs`。Statsig `feature/axTreeDiffing`、`feature/skyshotClassifier`。

**猜：** 先对目标 app 的窗口做 `AXUIElementCopyAttributeValue` 递归，过滤 offscreen；再对窗口 bounds 做 SCStream 截图。分类器可能用于「空桌面/全白」打标，但 1074 白图 **仍然作为 `input_image` 发给模型**，所以分类器更像分析/遥测，不是丢图。`needsUISettleBeforeSkyshot` 默认 false；settle 函数里 immediate **0.25s 和 5.0s** 更像「短等一帧 + 有进度条最多 5 秒」，插件文案「先约 1 秒」可能是旧文档。

### 5. 策略表 `BundleIdentifiers`

**确定：** 连续 42 个 bundle id，cluster：密码管理器、terminal、Safari/Atlas/Chromium 家族、ChatGPT 变体、SecurityAgent。`isForbiddenComputerUseTarget`。`ComputerUseAllowForbiddenTargets` user default。Chrome **不在** 这 42 个里。Linear 现场 `allowed` + `risk:high` + `allowPersistentApproval:true`。

**猜：** `forbidden` = 系统安全/自己吃自己（SecurityAgent、ChatGPT 自身、可能 Finder 部分场景）；`denied` = org TOML；`elevatedRisk` 密码管理器走更重的 elicitation 文案，但 **high 也会给 Linear 这种普通 Electron**，所以 high ≠ 禁止。Chrome 用 `NSPrincipalClass == BrowserCrApplication` / `isChromiumApp` 走「Computer Use Chrome」专用路径（扩展），避免和 Safari bundle 表混在一起。`allowPersistentApproval` 在 Linear 为 true，更像「非 forbidden 且用户已同意过这类 app」，不是 MDM 专用。

### 6. Paste md

**确定：** SlimCore `MarkdownRichTextProvider` → NSAttributedString，并声明 markdown 源 UTI。浏览器 paste 是 clipboard + Ctrl+v，**不渲染**。

**猜：** native `format:'md'` 往 pasteboard 同时放 `public.html`/`public.rtf` 和 `net.daringfireball.markdown`，目标 App 按自己能读的 UTI 取。TextEdit 取了纯文本路径所以 1161 看到字面 `align-paste`。没 live 跑过 md。

### 7. IAB 宿主（Electron，未把 asar 全读完）

**确定：** Owl WebView、partition、sock listen、`agent_request_header_enabled`。

**猜：** ChatGPT 主进程按 `conversation_id` 登记 route；`getInfo` 对不上 session 就当这个 sock 不是给当前 turn 的。`turn_ended` 关掉 **未 markDeliverable、且不是用户自己开的** 标签。弹窗 `getJsDialog` 依赖 CDP Page.javascriptDialogOpening；1161 `#btn-alert` CDP **超时** 更像 isolated world 没点到 page 的 button 或 dialog 被 IAB 壳拦了，而不是 API 不存在。

### 8. Guardian / 锁屏插件

**确定：** 独立 app + Authorization Plugin 安装器。无 Accessibility entitlement（TCC 本来就不是 entitlement）。

**猜：** 锁屏时普通服务的 AX 到不了 loginwindow；Guardian 用 authorization plugin 挂在安全会话，XPC 回主服务。日常 CUA 用不到。版本 1000366→1000968 是捆绑插件升级，不是运行时热更新。

### 9. Windows / Linux sky

类型在，这台 Mac `load_options()` 只装 window。  
**猜：** Windows 按 HWND + UIA；Linux 整桌面截图无 AX（所以 tinysky `getApp` 直接抛错）。不会在这台机器上被证伪。

---

## 八、实现策略压缩成一张图

```
模型  js(code)
  → kernel（无 nativePipe）
      tinysky cua.getApp / getBrowser / tab.playwright
      rpc("sky"|"browser")
  → trusted-worker
      sky:  length-prefix JSON-RPC → computeruse.sock
      browser: nativePipe → /tmp/codex-browser-use/*.sock
  → SkyComputerUseService / ChatGPT IAB
      认证祖先必须是 Codex
      policy → AX/CGEvent 或 WebView CDP
  → 结果：缩进 AX + JPEG → nodeRepl.write / emitImage → 模型
```

闸门在 **进程身份和 native policy**，不在模型 prompt。所以：ChatGPT 会话能点屏；这个 agent 能 load 同一套 JS 包、setup、列工具，但不能 `listApps`。1161 与 1074 的差异证明 API 形状稳，失败主要是 **AX 目标选错** 和偶发 CDP/AX 超时。
