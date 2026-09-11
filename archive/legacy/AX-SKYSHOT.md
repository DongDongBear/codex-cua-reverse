# 第 14 段 — 模型看见的 AX 文本和截图

**验证：** `agents/20-ax-skyshot/FINDINGS.md` + raw.json 的 `function_call_output`（不是 arguments）。

模型 **看不到** JSON 树，也看不到 `file://` PNG。工具结果是一组 part：

1. 墙上时钟 `input_text`
2. AX / 文档 `input_text`（缩进文本）
3. `input_image`：字符串 **`data:image/jpeg;base64,…`**

## 文本格式

浏览器头：`Browser tab: 1, Title: "…", URL: "…"`  
原生头：`Window: "…", App: Linear.`

行大致是：`4523 text field (settable) * Username :`  
整数 id、role、名字，后面可有 `Description:` / `Value:` / `ID:` / `Secondary Actions:` / `(settable)`。

diff 默认：`+` / `~`，以及 `Removed element IDs: a-b`。id **单调递增、不复用**。要整棵树：tinysky `{ disableDiffing: true }`；sky/IPC 是 **`disableDiff`**。两个名字混用等于没传。

原生第一次会在前面加 `<app_specific_instructions>`（`window_result.js`；`com.apple.iWork.Numbers` 除外）。

## 截图

- IAB：`tab.ax.get("state"|"screenshot"|"both")` → RPC `tab_ax_get_state`。只截图 **不推进** diff 基线。
- 原生：`ComputerUseIPCAppGetSkyshotRequest` → `skyshot.{text, screenshot.url}`。JS 可能拿到 `file://` PNG，发给模型仍是 JPEG data URL。

没有把截图字节写到桌面。
