# 模型 API（`js` 里写的）

出处：`vendor/cua/types/tinysky_alt.types.d.ts`、`tinysky-alt-core-cua-repl.md`、`vendor/browser-desktop/api.json`、`vendor/sky/types/window/`。  
实现细节见 [how-it-works.md](how-it-works.md)。

## `cua`

```ts
cua.getState({ emit? }): Promise<State>

cua.getBrowser({ id?, url? }): Promise<Browser>      // 只选浏览器，不开标签
cua.createBrowserTab(browserId, url?, { visible?, sessionName? }): Promise<Tab>
cua.getTab(id, { browser? }): Promise<Tab>
cua.listBrowsers(): Promise<BrowserInfo[]>
cua.listTabs({ browser? }): Promise<TabInfo[]>

cua.getApp(app: string): Promise<App>               // 显示名 / bundle id / 路径；仅 Mac
cua.listApps(): Promise<AppInfo[]>
```

选型别名 `"iab"` / `"chrome"` / `"edge"`；运行时 id 常是 `"1"`。

## Target（`Tab` 和 `App` 共用）

```ts
getAXState({ emit?, disableDiffing? })      // native 上字段名是 disableDiff
getScreenshot({ emit? })
getAXStateAndScreenshot(...)
click(index | [x,y], { mouseButton?, clickCount? })
typeText(text)
setValue(index, value)
pressKey(key)                               // xdotool 风格，如 super+space
paste(text, { format?: "text"|"md"|"html" })
scroll(index | [x,y], direction, pages?)
drag([x,y], [x,y])
selectText(index, text, { prefix?, suffix?, selectionType? })
performSecondaryAction(index, action)       // 如 Raise、open
```

浏览器 `paste`：clipboard + `Ctrl+v`（Mac 上变成 Meta）。原生 `paste`：IPC，会恢复剪贴板。

## 浏览器额外

- `tab.playwright.locator(sel).fill/press/evaluate/...`（evaluate **只读**）
- `tab.goto/back/forward/reload/close`
- `tab.ax` / `tab.cua`（坐标）/ `tab.dom_cua` / `clipboard` / `capabilities.get(id)`
- `getJsDialog()`：要先点出 alert/confirm

## 抓包里实际用过的

任务1 浏览器：`getBrowser` `listTabs` `getTab` `tab.click` `typeText` `getAXState` `tabs.get` `playwright.fill/press/evaluate` `dev.logs`。

任务2 原生：`getApp` `listApps` `getScreenshot` `getAXState(AndScreenshot)` `click` `pressKey` `typeText` `paste` `setValue` `performSecondaryAction`。

1161 对齐：TextEdit `setValue`+`paste`；Finder 窗口 `Raise`+`scroll`；IAB `createBrowserTab`+playwright fill/click。

未在抓包出现但类型里有的（`reversed_unused`）：`drag`/`selectText`（MCP 有）、capabilities、`claimTab`、坐标 `tab.cua.*` 等。全表曾展开在 `archive/legacy/CAPABILITIES.md`。
