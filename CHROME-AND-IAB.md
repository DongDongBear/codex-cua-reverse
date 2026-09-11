# 第 12 段 — Chrome 扩展 vs 内置浏览器（IAB）

**验证：** agents/13 + 14 对照 raw.json 任务 1。任务 1 是 **IAB**，不是 Chrome。GitHub 无 native host / Owl webview 实现。

## 一句话

| | IAB（抓包用的） | Chrome / Edge |
|---|---|---|
| `type` | `"iab"` | `"extension"` |
| 进程 | Owl/Electron guest，UA 前缀 `CodexBrowser` | Native Messaging `com.openai.codexextension` → `ChatGPT for Chrome` |
| 管道 | `/tmp/codex-browser-use/*.sock` | 同一目录；本机 live `e3a02578-….sock`，扩展 `hehggadaopoacecdllhhajmbjkdcmajg` |
| `"iab"` / `"chrome"` | **别名**，用来 `browsers.get` | **family 别名**，取第一个匹配扩展 |
| 运行时 `browserId` | 递增数字，任务 1 是 **`"1"`** | 不透明 id；mention 用 `extensionInstanceId` |
| 认领用户标签 | **没有** `Browser.user` | `openTabs` + `claimTab`，标签仍留在用户条 |
| `sessionName` | IAB 上基本不走这条 | Chrome **标签组标题** |
| `visible` | `capabilities.visibility.set`（开新 tab 前） | `set(true)` 会 `focusTab` 系统窗口 |

## 任务 1 对上的事实

- `cua.getBrowser({ url: ant.design })` **没开新标签**，只选中已有 IAB
- `listTabs`：`id:"1"`，`providerTabId:"e118c787-…"`，`browserId:"1"`，URL 已是 form 页
- `getTab("1")` 是 session-control 已有行，不是 `claimTab`
- 从未 `createBrowserTab` / `nameSession` / `"chrome"`

## 产品名

`getInfo` 显示 **Codex In-app Browser**。partition：`persist:codex-browser-app-route:{conversation}\0{tab}`。preload：`browser-page-preload.js`。

未标记的 agent 标签在 `turn_ended` 会关；用户自己开的标签留下。

细节：`agents/13-chrome-extension/FINDINGS.md`、`agents/14-iab/FINDINGS.md`。
