# 第 2 段 — 浏览器 CUA（tinysky + browser-desktop）

**验证：PASS。** raw.json 任务 1 的 14 次 `js`、49 处 API 引用，每一处都能在 tinysky 类型 **或** `api.json` 里对上。`verify/results/block2-browser-traces.json`。GitHub openai/codex **没有** 这些方法。

## 模型入口（tinysky，ChatGPT.app 独有）

| 方法 | 语义 | 任务 1 |
|---|---|---|
| `cua.getBrowser({ id?, url? })` | **只选浏览器，不开标签**。`id` 优先；否则 `getForUrl` / `getDefault` | YES：`getBrowser({ url: "https://ant.design/components/form" })` |
| `cua.listTabs({ browser? })` | 列出标签，不 claim | YES |
| `cua.getTab(id, { browser? })` | 绑定 tab，自动 dump 全量 AX | YES：`getTab("1", {browser: browser.browserId})`。运行时 id 是 `"1"` 不是文档字面 `"iab"` |
| `cua.createBrowserTab(browserId, url?, { visible?, sessionName? })` | 真正开页 | 本任务未用（页面已在右侧打开） |
| `cua.listBrowsers` / `cua.getState` | 库存 | 未用 |

GitHub 对照：零命中 `getBrowser`。Harness 只知道 MCP 名 `js`。

## 共用操作面 `Target`（装饰在 Tab 上）

`tab.click` / `typeText` / `getAXState` 来自 tinysky `decorateTab` → `tab.ax.*`。  
`api.json` 里 AXAPI 默认 `unsupportedByDefaultIn: iab|extension|cdp`，桌面用 `apiSupportOverrides["Tab.ax"]` 再打开。

任务 1 用了：`tab.click(index)`、`tab.typeText`、`tab.getAXState({emit:false?})`。

## 低层 Agent API（`@oai/browser-desktop` `api.json`，146 成员）

任务 1 另外走了 **未装饰的** `BrowserTab` 句柄：

```js
let pt = await browser.tabs.get("1");
pt.dev.logs({ levels:["log"], limit:5 })
pt.playwright.locator('[id="validateOnly_name"]').fill(...)
pt.playwright.locator(...).press('ControlOrMeta+a')
pt.playwright.locator(...).evaluate(el => ...)
```

`cua.getTab` 得到的 `tab` 做 AX；`browser.tabs.get` 得到的 `pt` 做 Playwright / dev.logs。类型上 `Tab = BrowserTab & Target`，`tab.playwright` 应该存在，但模型按 first-use 文档拆成两个句柄。

## 任务 1 未用、但仍属浏览器能力（源码已在 app 里）

见 `CAPABILITIES.md` 第 4 节全表。优先补齐：

- `createBrowserTab` / `tab.goto|back|forward|reload|close`
- `tab.markDeliverable` / `markHandoff` / `requestManualHandoff`
- capabilities: visibility, viewport, management, cdp, botDetection, browserAuth, pageAssets, webmcp
- ContentAPI / CUAAPI（坐标版）/ DomCUAAPI / clipboard / dialogs / history / claimTab

这些在 GitHub **同样没有实现**，只有 `browser_computer_use_requirements.rs` 的 origin 策略字段（access/downloads/uploads/full_cdp/webmcp/history）和插件 hook。
