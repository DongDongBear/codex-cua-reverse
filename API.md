# CUA API（从本机 .d.ts / 技能文档抽出）

模型在 `js` 工具里写的就是下面这些。原文：

- `vendor/cua/types/tinysky_alt.types.d.ts`
- `vendor/cua/docs/tinysky-alt-core-cua-repl.md`
- `vendor/sky/types/window/*.d.ts`

## 1. 全局 `cua`（tinysky-alt）

```ts
cua.getState(options?: { emit?: boolean }): Promise<State>

// 浏览器
cua.getBrowser(options?: { id?: string; url?: string }): Promise<Browser>
cua.createBrowserTab(browserId, url?, { visible?, sessionName? }): Promise<Tab>
cua.getTab(id, { browser? }): Promise<Tab>
cua.listBrowsers(): Promise<BrowserInfo[]>
cua.listTabs({ browser? }): Promise<TabInfo[]>

// 原生 App
cua.getApp(app: string): Promise<App>   // 显示名 / bundle id / 路径
cua.listApps(): Promise<AppInfo[]>
```

`getBrowser({ url })`：**只选浏览器，不开标签**。真正开页用 `createBrowserTab`。你第一轮却写了 `getBrowser({ url: "https://ant.design/..." })`，和官方「选浏览器」语义不完全一样，但 runtime 仍会返回一个 browser 绑定。

浏览器 id：

- `"iab"` — ChatGPT 内置浏览器
- `"chrome"` / `"edge"`

## 2. `Tab` / `App` 共用操作面 `Target`

```ts
target.getAXState({ emit?, disableDiffing? }): Promise<string>
target.getScreenshot({ emit? }): Promise<Uint8Array>
target.getAXStateAndScreenshot(...)
target.click(elementIndex | [x,y], { mouseButton?, clickCount? })
target.typeText(text)
target.setValue(elementIndex, value)
target.pressKey(key)          // xdotool 风格: Return, Tab, super+c
target.scroll(index | [x,y], direction, pages?)
target.drag(from, to)
target.paste(text, { format?: "text"|"md"|"html" })
target.selectText(elementIndex, text, { prefix?, suffix?, selectionType? })
target.performSecondaryAction(elementIndex, action)
```

浏览器 Tab 额外：

```ts
tab.goto(url) / back() / forward() / reload() / close()
tab.markDeliverable() / markHandoff()
// 文档还允许 Playwright 后备（长流程、index 不稳定时）
tab.playwright.locator(...)
```

`getAXState()` 默认返回 **和上次的 diff**。要整棵树：`{ disableDiffing: true }`。  
`{ emit: false }` 禁止自动 `nodeRepl.write` 以免刷屏。

## 3. 原生 `sky`（旧/并行 API）

computer-use 插件技能用的是这套，参数带 `app:`：

```ts
sky.click({ app, element_index?, x?, y?, mouse_button?, click_count? })
sky.get_app_state({ app, disableDiff? })  // 返回 { app, screenshot, text }
sky.list_apps()
sky.type_text({ app, text })
sky.set_value({ app, element_index, value })
sky.press_key({ app, key })
sky.scroll({ app, element_index?, direction, pages? })
sky.paste({ app, text, format })
sky.drag({ app, from_x, from_y, to_x, to_y })
sky.select_text({ app, element_index, text, prefix?, suffix? })
sky.perform_secondary_action({ app, element_index, action })
```

`app` 可以是显示名、bundle id（如 `com.google.Chrome`）或路径。  
`get_app_state` 在 app 没开时会后台启动。

新 tinysky 把这些收成 `cua.getApp(name)` 之后的 `app.click(index)`。

## 4. `js` 工具本身

模型侧 schema 几乎只有一个字段：

```
js({ code: string, title?: string })
```

`code` 在已初始化的 CUA REPL 里执行，状态跨调用保留（所以后面可以直接 `await tab.click(325)`）。  
`js_reset` 清 REPL。

接线见 `vendor/plugins/unified-computer-use/launch.mjs`。
