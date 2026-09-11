# 第 9 段 — SkyClient 三个后端（本机只活 Mac）

**验证：** `SkyClient.d.ts` 是联合类型。`load_options()`：`darwin`→window，`win32`→window2，`linux`→full-desktop。  
这台 ChatGPT.app 是 darwin，**只有 window**。window2 / linux 签名在 app 的 `@oai/sky` 类型里，运行时不会装。

| | window Mac（live） | window2 Windows | full-desktop Linux |
|---|---|---|---|
| `target` | `"mac"` | `"windows"` | `"linux"` |
| 绑定 | `app: string` | `{app, id, title?}` 窗口 | 整桌面，无 app |
| 观察 | AX 文本 + 一张截图 | 可选 AX 结构 + 多截图 | JPEG，**无 AX** |
| 启动 | `get_app_state` 隐式 | **显式** `launch_app` | n/a |
| 独有 | `paste` `select_text` `get_app_state` `list_apps` | `activate_window` `get_window` `get_window_state` `list_windows` | `move` `drag_handle` `get_screenshot` |
| 共有 | click drag press_key scroll type_text audio? | 同左减 paste | 无 set_value / secondary |

`cua.getApp` **仅** `sky.target === "mac"`，否则抛错。Windows 上 `getState().apps` 仍可能有 `list_apps`，但 tinysky 不会做成 `App` Target。

GitHub 配置有 `ComputerUseWindowsConfigToml`（aumid/exe），没有这些 JS 方法。
