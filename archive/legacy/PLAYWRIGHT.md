# 第 13 段 — `tab.playwright` 子集

**验证：** `agents/15-playwright/FINDINGS.md` + 任务 1 raw。  
不是 Playwright 进程：注入 CDP isolated world `browser-use-playwright` + `__codexPlaywrightInjected`。

抓包句柄是 **`pt.playwright`**（`browser.tabs.get("1")`），不是 `tab.playwright`（虽然类型上 Tab 也有这个字段）。

## 任务 1 用过（4）

| 调用 | 说明 |
|---|---|
| `locator('[id="…"]')` | PlaywrightAPI.locator |
| `.fill(...)` 含 `fill('')` | 整段替换 |
| `.press('ControlOrMeta+a')` 再 `Backspace` | macOS 上 ControlOrMeta → **Meta**；这是全选，不是剪贴板 |
| `.evaluate(el => ({value, buttons}))` | 跑在 **只读** world `browser-use-readonly-js`，不能改 DOM |

## 目录 62

- `reversed_unused` 56：其余 PlaywrightAPI / FrameLocator / Locator / Download / FileChooser
- `undocumented` 2：客户端有 `goBack`/`goForward`，`api.json` PlaywrightAPI 没有；RPC 等同 `tab.back()`/`tab.forward()`
- 上传：**没有** `locator.setInputFiles`。必须 `waitForEvent("filechooser")` → `chooser.setFiles([abs])`
- `waitForLoadState` **拒绝** `networkidle`
- `elementInfo` / `elementScreenshot`：`documented: false`，service 表里没有 JS handler

GitHub openai/codex 无此注入。
