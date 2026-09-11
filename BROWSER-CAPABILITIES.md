# 第 5 段 — 浏览器 capabilities（动态广告，不在抓包里）

**验证：源码文档 + `api.json` 交叉。** 任务 1 没用 `capabilities.get`。  
GitHub 只有策略开关（`allow_webmcp`、`full_cdp_access`、downloads/uploads），没有这些 JS 接口。

Capabilities 不是 `api.json` 的一级 interface。`Browser.capabilities` / `Tab.capabilities` 类型是：

```ts
get(id: string): Promise<unknown>
list(): Promise<Array<{ id: string; description: string }>>
```

具体 id 写在 `docs/capabilities/**`。字符串是否出现在 `api.json` 里：

| id | 层 | api.json 字面 | 文档 |
|---|---|---|---|
| `visibility` | browser | 否 | `set(true/false)` / `get()` — tinysky `createBrowserTab(..., {visible})` 会调它 |
| `viewport` | browser | 是 | `set({width,height})` / `reset()` |
| `management` | browser | 否 | Chrome 风格 windows/tabs/tabGroups/bookmarks，不 claim |
| `cdp` | tab | 是 | `send(method, params)` + `readEvents`；origin 受限 |
| `botDetection` | tab | 否 | 云浏览器验证码/拦截上报 |
| `browserAuth` | tab | 否 | 安全登录；凭证不回模型 |
| `pageAssets` | tab | 否 | `list()` / `bundle()` 导出静态资源 |
| `webmcp` | tab | 否 | `fetchTools()` / `tools.call`；GitHub `allow_webmcp` |

一级 Tab/Browser 成员（**在 api.json**，抓包只用了其中一部分）：

`goto/back/forward/reload/close`、`markDeliverable/markHandoff/requestManualHandoff`、`nameSession`、`history`、`user.claimTab`、`screenshot`、`clipboard`、`content`、`cua`（坐标 CUA）、`dom_cua`、`playwright`、`dev`、`ax`。

Live（agent v4）：本机 REPL 已起，`BROWSER_USE_AVAILABLE_BACKENDS=chrome,iab`。无 trusted `nodeRepl` 时 `setupBrowserRuntime` 直接失败。未再对用户标签做 `listTabs`（会开第二会话）。
