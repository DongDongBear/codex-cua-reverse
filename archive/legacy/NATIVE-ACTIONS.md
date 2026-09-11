# 第 7 段 — 原生动作全表（含抓包未用）

**验证：** sky `window/*.d.ts` + live MCP `tools/list` 10 工具 + mac-client.js 编码。  
抓包用过的标 YES；MCP 有但抓包没有的标 MCP。

| tinysky | sky | MCP | IPC | 抓包 |
|---|---|---|---|---|
| `listApps` | `list_apps` | `list_apps` | `ComputerUseIPCListAppsRequest` | YES |
| `getApp` + AX/截图 | `get_app_state` | `get_app_state` | `AppGetSkyshotRequest` | YES |
| `click(index\|[x,y])` | `click` `{element_index?,x?,y?,mouse_button?,click_count?}` | `click` | `PerformAction` `action.click` | YES |
| `typeText` | `type_text` `{text}` | `type_text` | `action.type` | YES |
| `setValue` | `set_value` `{element_index,value}` | `set_value` | `action.setValue` | YES |
| `pressKey` | `press_key` `{key}` xdotool | `press_key` | `action.pressKey` | YES |
| `performSecondaryAction` | `perform_secondary_action` | 同名 | `action.performSecondaryAction` | YES Raise / zoom |
| `paste(text,{format})` | `paste` `{text, format: text\|md\|html}` 贴完恢复剪贴板 | **无** | `action.paste` | YES `{format:'text'}` |
| `scroll(index\|[x,y], dir, pages?)` | `scroll` | `scroll` `{element_index, direction, pages?}` | `action.scroll` | 否 |
| `drag([x,y],[x,y])` | `drag` `{from_x,from_y,to_x,to_y}` | `drag` | `action.drag` | 否 |
| `selectText` | `select_text` `{text,prefix?,suffix?,selection_type?}` | `select_text` (`selection` 不是 selection_type) | `action.selectText` | 否 |
| （无 tinysky 包装） | `start/stop_audio_recording` 需 **两个** env | MCP 无 | `Start/StopAudioRecordingRequest` | 否。**不是** `cua.App` 方法 |

`click([119,35])` 在 Linear 上返回 **-10005 noWindowsAvailable**（坐标要有内容窗口；菜单栏 AX index 仍可点）。

`pressKey('c')` 在无内容窗口时也可能落到菜单焦点。`js_reset` 清绑定后必须重新 `getApp`。

## IPC 信封（agent 10，未发到 Linear）

帧：`uint32le` 长度 + JSON-RPC `ping` / `request`，版本 `CodexComputerUseIPC-5`。  
`PerformAction` 的 `action` 键：`click` `performSecondaryAction` `setValue` `selectText` `scroll` `drag` `pressKey` `type` `paste`。

- `typeText` 线上是 `{ type: { _0: text } }`
- `pressKey` 线上是 `{ pressKey: { _0: key } }`
- `scroll.at` 是 `elementID` 或 `coordinate`；`pages` 必须 `> 0`
- `selectText`：tinysky `selectionType` → 线上 `selection`；`elementID` 是字符串
- `drag`：native 做成 `click(at:andDragTo:)`；scroll 变成 `deltaX`/`deltaY`

GitHub：只有 bundle id allow/deny，没有这些动作签名。
