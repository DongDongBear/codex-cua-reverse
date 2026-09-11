# 抓包对照

`js` 调用从拦截 JSON 抽出，完整列表：

- [traces/task-1-ant-design-form.json](traces/task-1-ant-design-form.json)
- [traces/task-2-linear-issue.json](traces/task-2-linear-issue.json)
- [traces/all-js-calls.json](traces/all-js-calls.json)

## 任务 1 · Ant Design Form（浏览器）

用户：在内置浏览器打开 form 页，测输入 / submit。

| # | 对应 API | 代码摘要 |
|---|---|---|
| 1 | `cua.getBrowser({ url })` | 选浏览器并带上 ant.design/form |
| 2 | `cua.listTabs({ browser })` | 找当前标签 |
| 3 | `cua.getTab("1", { browser })` | 绑定 tab |
| 4 | `tab.click` + `getAXState` | 空表单提交，看校验 |
| 5 | `tab.click` + `typeText` | 输入测试用户/密码再提交 |
| 6 | `browser.tabs.get` + `playwright` / `dev.logs` | 看提交回调 |
| 7+ | `tab.click` / `playwright.locator().fill` | 下拉、重置、清空 |

走的是 **browser 表面**（`@oai/browser-desktop`），不是 `sky.click({ app: ... })`。

## 任务 2 · Linear 建 issue（原生 App）

用户：操作电脑上的 Linear，建 issue 指给他。

同一 `js` 工具，但会 `cua.getApp(...)` 或对 Linear 窗口做 AX click/type。完整参数见 `traces/task-2-linear-issue.json`。

## 读法

1. 打开 `API.md` 看方法签名。  
2. 打开 traces JSON 看 `args.code` / `args.title`。  
3. 需要原文技能说明时看 `vendor/cua/docs/tinysky-alt-core-cua-repl.md`。
