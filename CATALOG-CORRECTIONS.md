# 目录纠错（skeptic agent 22）

独立 Agent 对照 raw.json 后的结论：**CAPABILITY-CATALOG.json 的 `in_traces` 不能当完成证明。** 以本文件为准。

## 抓包里模型**写过**的（37 段 `js` code）

浏览器：`cua.getBrowser` `cua.listTabs` `cua.getTab` `browser.browserId` `browser.tabs.get` `tab.click` `tab.typeText` `tab.getAXState` `pt.dev.logs` `pt.playwright.locator` `.fill` `.press` `.evaluate` `nodeRepl.write`

原生：`cua.getApp` `cua.listApps` `app.getScreenshot` `getAXState` `getAXStateAndScreenshot` `click` `pressKey` `typeText` `paste` `setValue` `performSecondaryAction`

协议：`js_reset` `request_user_input_async`

**没有** `tab.ax.*`、`sky.*`、`locator().click`、`cua.initialize`。

## 目录里标错的 YES

- `AXAPI.write` ← 其实是 `nodeRepl.write`
- `AXAPI.performSecondaryAction/pressKey/setValue` ← 只出现在 **原生** `linearApp`/`linear`，不是浏览器 AX
- `PlaywrightLocator.click` / `.locator` ← 没有这些调用；有的是 `PlaywrightAPI.locator` + `.fill/.press/.evaluate`

## 目录里漏标的

`PlaywrightLocator.fill/press/evaluate`、`Tab.playwright`、`Tab.dev`、`Browser.tabs`、`request_user_input_async`、`cua.initialize`/`browsers`/`computer`、`nodeRepl.rpc`/`nativePipe`/`launchServices`、window2/linux 方法。

详见 `agents/22-catalog-skeptic/FINDINGS.md`。正文清单已拆到 NODEREPL.md / SKY-PLATFORMS.md / TAB-SURFACES.md。
