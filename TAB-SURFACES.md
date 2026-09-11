# 第 6 段 — 浏览器上的四套操作面

**验证：** 全部签名来自本机 `vendor/browser-desktop/api.json`。抓包任务 1 只用了 **AX Target**（`tab.click`）+ **Playwright locator.fill/press/evaluate** + **dev.logs**。其余 `reversed_unused`。GitHub 无这些 interface。

一个 `Tab` 上同时挂着：

```
tab.ax        AXAPI          无障碍树 index / 坐标
tab           Target         tinysky 把 ax.* 抄到 tab 上（模型写 tab.click）
tab.cua       CUAAPI         视口坐标（Computer-Use 风格 click/type/scroll）
tab.dom_cua   DomCUAAPI      可见 DOM node_id
tab.playwright PlaywrightAPI  注入的 Playwright 子集
tab.clipboard / content / dev / capabilities
```

## 1. AXAPI = 抓包里的 `tab.click(325)`

| 方法 | 抓包 |
|---|---|
| `click(number \| [x,y], {mouseButton?, clickCount?})` | YES |
| `typeText(text)` | YES |
| `get("state"\|"screenshot"\|"both", {disableDiffing?})` | tinysky 包成 `getAXState` |
| `setValue` / `pressKey` / `scroll` / `drag` / `selectText` / `performSecondaryAction` | 浏览器任务未用 |
| `write(...)` | 给模型看的 emit；tinysky 默认 `nodeRepl.write` |

`unsupportedByDefaultIn: iab|extension|cdp`，桌面靠 override 打开。

## 2. CUAAPI `tab.cua.*`（坐标，不是 AX index）

`click` `double_click` `drag` `keypress` `move` `scroll` `type`  
`downloadMedia`：`unsupported iab`，`documented: false`

和 Target **不是**同一套：这里是 viewport 坐标 + keypress 数组，不是 element index。

## 3. DomCUAAPI `tab.dom_cua.*`

先 `get_visible_dom()` 拿 node id，再 `click/double_click/type/keypress/scroll({node_id?})`。  
`downloadMedia` 同样 IAB 不支持。

## 4. Playwright（抓包用了 locator 三方法）

**Page：** `locator` `getByRole/Text/Label/Placeholder/TestId` `frameLocator` `evaluate`（只读）`expectNavigation` `waitForEvent(download|filechooser)` `waitForLoadState/URL/Timeout` `domSnapshot`；`elementInfo`/`elementScreenshot` undocumented。

**Locator：** 抓包：`fill` `press` `evaluate`。其余：`click/dblclick/type/check/uncheck/setChecked/selectOption/pressSequentially/filter/nth/first/last/and/or/count/waitFor/getAttribute/innerText/textContent/isVisible/isEnabled/downloadMedia/...`

**上传：** 不是 `setInputFiles`。文档：`waitForEvent("filechooser")` → `chooser.setFiles([absPath])`。

## 5. 其它 Tab 成员

| API | 说明 | 抓包 |
|---|---|---|
| `goto/back/forward/reload/close` | 导航 | 否（页已打开） |
| `markDeliverable/markHandoff` | 交卷/留给下轮 | 否 |
| `requestManualHandoff` | 云浏览器交给用户 | 否；cdp 不支持 |
| `screenshot` | 视口/全页 | 否（用了 AX） |
| `title()` `url()` | | 否 |
| `getJsDialog()` | alert/confirm/prompt/beforeunload | 否 |
| `content.export` / `exportGsuite` / `exportYouTubeTranscript` | 导出 | 否 |
| `clipboard.read/write/readText/writeText` | | 否（paste 走 AX+Ctrl+v） |
| `user.openTabs` / `claimTab` | Chrome 认领用户标签 | 否 |
| `user.getTabContext` | undocumented，三后端都 unsupported | 否 |
| `tabs.content` | 后台抽正文；iab/extension/cdp 全 unsupported | 否 |
| `tabs.new/list/get/selected` | | `tabs.get` YES |

## 6. 确认策略

`confirmations.md`：浏览器里删数据、建账号、传敏感信息、过验证码、装软件要确认。非浏览器动作不走这套。GitHub `BrowserUseOriginPolicyToml` 是配置层，不是这套文案。
