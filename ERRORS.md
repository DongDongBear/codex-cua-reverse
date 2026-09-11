# 第 10 段 — Computer Use 错误码

**验证：** JS `errors.js` −10000…−10020（21 项）+ native `ServerError.Code` −10000…−10029（30 项）+ 抓包 −10005 `noWindowsAvailable` + live MCP −10000。  
完整表与 Swift 元数据见 `agents/27-error-codes/FINDINGS.md`。paste / audio 仍见下文（原 `agents/19-paste-audio-errors/FINDINGS.md`）。

模型看见的形状（native 前缀，**不在** JS `errors.js`）：

```
Computer Use server error <code>: <detail>
```

JS `SkyComputerUseError.errorName` 只认 −10000…−10020；之外（含 native −10021…−10029）是 `"jsonRPCError"`。`message` 原样来自 JSON-RPC，**不会**改成 enum 名。

## 已验到的 code

| code | JS 名 | 实际见到的 message | 出处 |
|---|---|---|---|
| −10000 | `senderProcessNotAuthenticated` | live MCP：`Sender process is not authenticated` | `verify/results/mcp-ndjson.json` id 3；Messages/Calendar/EventStream/History 同样 |
| −10005 | **`unknownError`** | 抓包坐标 click：`noWindowsAvailable`（AccessibilitySupport 细节名，**不在** JS / `Code` enum） | task-2 `click([119,35])` ×2 |
| −10013 | `incompatibleClientVersion` | 本进程 ping 还没走到 JSON-RPC 就被踢，**没验到**。JS ping 版本不一致走的是 `SkyComputerUseTransportError`，不是这个 code | unix 未认证路径：socket FIN、0 字节 |

unix `computeruse.sock` 未认证：connect 成功 → ping → **对端 FIN，没有** `error.code`（`SkyComputerUseTransportError`）。XPC MCP 才返回 −10000 字符串。鉴权在 JSON-RPC 之前，所以 −10013 在这条路径上无法证明。

坐标点击要有可截的内容窗口；同一轮 AX **index** 点击菜单仍成功。`pressKey('c')` 不走坐标窗口，没抛 −10005。

## 完整 `ServerErrorCode` 表

JS 21 项与 native 前 21 项 **同名同值**（`rawValue = −10000 − discriminator`）。native 另有 −10021…−10029。

| code | JS `ServerErrorCode` | Native `Code` | Native / human detail | 本机见到 |
|---:|---|---|---|---|
| −10000 | `senderProcessNotAuthenticated` | 同名 | `Sender process is not authenticated`。分析用原因（不是 JSON-RPC message）：`MISSING_PARENT` / `UNTRUSTED_PARENT` / `RELAY_WITHOUT_TRUSTED_ANCESTOR` | **live MCP** |
| −10001 | `couldNotGetRequestData` | 同名 | `Could not get request data`（Apple Event） | — |
| −10002 | `couldNotGetRequestTypeName` | 同名 | `Could not get request type name from Apple event` | — |
| −10003 | `couldNotResolveRequestType` | 同名 | `Could not resolve request type: ` | — |
| −10004 | `unhandledEvent` | 同名 | `Unhandled event: ` | — |
| −10005 | **`unknownError`** | 同名 | 兜底。抓包细节 **`noWindowsAvailable`**。其它 action/窗口 case 作为 **message** 叠在这个 code 上（见下节） | **抓包** 坐标 click |
| −10006 | `appNotAllowed` | 同名 | `Computer Use is not allowed to use the app '` … `' for safety reasons.`；`Computer use actions are not allowed for system security process: ` | — |
| −10007 | `runningApplicationNotFound` | 同名 | `Running application not found: ` | — |
| −10008 | `accessibilityError` | 同名 | 前缀 `Accessibility error: ` | — |
| −10009 | `permissionsNotGranted` | 同名 | `Computer Use permissions are not granted` | — |
| −10010 | `invalidApp` | 同名 | enum only | — |
| −10011 | `noActiveSession` | 同名 | `Computer Use is not active for '` … `'。必须先 `get_app_state` | — |
| −10012 | `userStoppedSession` | 同名 | 用户本 turn 明确停掉 session 的长文案。native 会话 case：`appStoppedByUser`。JS telemetry `cancelled` | — |
| −10013 | `incompatibleClientVersion` | 同名 | 请用户重启 ChatGPT 的版本不匹配长文案。JS ping mismatch ≠ 这个 code | 未验到 |
| −10014 | `permissionsPending` | 同名 | Accessibility + Screen Recording 还在授权；长文案要求 **再 call 一次、不要结束 turn** | — |
| −10015 | `blockedURL` | 同名 | 当前浏览器 URL 不允许 Computer Use，结束 session | — |
| −10016 | `userIntervened` | 同名 | 用户介入 / 接管。JS telemetry `cancelled`。伴随：重新 `get_app_state` | — |
| −10017 | `couldNotGetSenderPID` | 同名 | `Could not get sender PID from Apple event` | — |
| −10018 | `ambiguousApp` | 同名 | `Ambiguous app identifier '` … `Multiple apps share this bundle identifier` … 改用 app 名或完整路径 | — |
| −10019 | `couldNotGetBootstrapPort` | 同名 | `Could not get XPC bootstrap mach port from Apple event` | — |
| −10020 | `screenLocked` | 同名 | 锁屏三条：自动解锁失败 / 检测到物理输入暂停自动解锁 / 请求无法关联 ChatGPT thread。都要用户手动解锁 | — |
| −10021 | （JS 无 → `jsonRPCError`） | **`turnEnded`** | `Computer Use is unavailable because the current turn ended. It will work again after the next user message.` | — |
| −10022 | （JS 无） | **`messagesPermissionsPending`** | `Messages permission setup is still open` | — |
| −10023 | （JS 无） | **`messagesPermissionsDenied`** | `Required Messages permissions were not granted` | — |
| −10024 | （JS 无） | **`messagesQueryTimedOut`** | `The Messages database query exceeded its time limit` | — |
| −10025 | （JS 无） | **`messagesInvalidRequest`** | `Invalid Messages request: ` | — |
| −10026 | （JS 无） | **`messagesAmbiguousDestination`** | `Ambiguous Messages destination: ` | — |
| −10027 | （JS 无） | **`messagesSendPlanUnavailable`** | send plan 不可用 / 已被消费 | — |
| −10028 | （JS 无） | **`messagesSendOutcomeUncertain`** | 无法确认发送是否完成，重发可能重复 | — |
| −10029 | （JS 无） | **`messagesSendRateLimited`** | `Messages sending is temporarily rate limited. Try again in ` | — |

−10001 / −10002 / −10017 / −10019 是 **Apple Event** 文案（遗留 / host bootstrap），不是 JS unix-socket 热路径。

client 本地、**不是** JSON-RPC `Code`：`couldNotFindServiceApp`（找不到 Codex Computer Use.app）、`serverError`（MCP 侧包装）。

## −10005 上叠的 native 细节（不是独立 IPC code）

JS **没有** `noWindowsAvailable`。抓包 code 仍是 −10005，message 是内层 case 名。

窗口 / AX（与 `noWindowsAvailable` 同族）：`windowNotFoundAtPosition`、`windowNotFoundForID`、`failedToGetWindowIDForElement`、`elementPresumedOOPAndNotFound`、`noFrontmostApp`、`cgWindowNotFound`、`noCapturableWindow`、`matchingWindowNotFound`、`noMatchingWindow`、`windowNotFound`。

动作层（message = case 名或人话；**不要**当成新的 −100xx）：

| case | 人话（有则列出） |
|---|---|
| `pasteboardWriteFailed` | `Could not write generated content to the clipboard` |
| `pasteboardReadTimedOut` | `Timed out waiting for the application to read the clipboard` |
| `pasteboardChangedDuringPaste` | 用户可能和 paste 冲突，先核对 app 状态 |
| `cannotSetValueForNonSettableElement` | 元素不可 set value |
| `cannotSelectTextForElement` / `textToSelectNotFound` | 不能选 / 找不到要选的文本 |
| `invalidElementID` / `invalidScrollPages` | element ID 失效，重新 get 屏幕内容 |
| `invalidSecondaryActionForElement` | 不是该元素的 secondary action |
| `noScrollDirection` / `noScrollAmount` | Missing scroll direction / amount |
| `noAXTree` | `AX tree unexpectedly missing.` |
| `screenshotCaptureFailed` | `The screen capture failed.` / `UI tree capture failed.` |
| `cannotClickOffscreenElement` | 点到屏幕外 |
| `noActiveRecording` / `invalidDuration` / `recordingAlreadyActive` / `recordingNotOwned` / `noDisplay` | audio IPC |
| `menuClickFailed` / `menuMouseActionNotSupported` / `appQuit` / `noTextToType` / `blockedByPolicy` | enum only |

有**独立 code**、不要算进 −10005：`appNotAllowed` −10006、`runningApplicationNotFound` −10007、`accessibilityError` −10008、`noActiveSession` −10011、`userStoppedSession` −10012、`userIntervened` −10016。

## 不是 `ServerErrorCode`

| 种类 | 例子 |
|---|---|
| JS transport | `SkyComputerUseTransportError`：pipe 不可用、startup failed、silent FIN、frame too large、`API version mismatch` |
| JS 组织策略 | `Computer Use is blocked from using the app '…' by your organization's policy.`（`denied`，无 code） |
| JS 安全策略（IPC 前） | 与 −10006 同一句 safety 文案（`forbidden`） |
| JS 用户拒绝 | `Computer Use was not approved to use …` / audio |
| MCP schema | `Missing required argument: app` |
| MCP 帧 | `Content-Length` → JSON-RPC **−32700** `Invalid message format` |
| native 配置 / 传输 | `Computer Use is disabled by your configuration.`；`IPC server is unavailable`；app-group container unavailable |

## paste 三路径（已验）

1. 原生 tinysky `app.paste` → IPC `action.paste`，**恢复剪贴板**（抓包 YES）  
2. 官方 MCP **没有** paste 工具  
3. 浏览器 `tab.paste` → clipboard write + **`Ctrl+v`**（不是 `Cmd+v`），**不**恢复剪贴板

Native paste 失败细节走 −10005：`pasteboardWriteFailed` / `pasteboardReadTimedOut` / `pasteboardChangedDuringPaste`。IPC format：`text` / `html` / **`markdown`**（JS 写 `md`）。

## audio

本机 app **有**录音 IPC。模型面要 `SKY_ENABLE_AUDIO=1` **且** `NODE_REPL_ENABLE_AUDIO=1`。tinysky `App` **没有** audio 方法。旧 CAPABILITIES「wrapped by cua.App」是错的。MCP `tools/list` 也无 audio。

Audio 失败细节同样叠在 −10005：`noActiveRecording`、`invalidDuration`、`recordingAlreadyActive`、`recordingNotOwned`、`noDisplay`。开始录音的用户 elicitation 失败是普通 `Error`（「was not approved to record computer audio」），不是 `ServerErrorCode`。
