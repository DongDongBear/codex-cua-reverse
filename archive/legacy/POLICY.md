# 第 15 段 — 策略 / 确认 / elicitation

**验证：** `agents/16-policy/FINDINGS.md` + Linear 抓包。GitHub 有 TOML allow/deny 和 Guardian；**拦不拦点击**只在本机 JS+native。

## 两层

| 层 | 能不能挡住 click |
|---|---|
| 确认 markdown（`confirmations.md`、`tinysky-alt-confirmations.md`、`browser-safety.md`、技能） | **不能**。只是 prompt |
| `withComputerUsePolicy` → native `ComputerUseIPCAppPolicyRequest` | **能**。结果 `allowed \| denied \| forbidden` |

`allowed` 之后 JS 走 `nodeRepl.createElicitation`。Host 拦截器可用 `content.source = "computer-use-persisted-state"` 自动同意，然后把 `app` 冻成 **`appPath`**。

## 审批文件

schema：`{ "approvedBundleIdentifiers": string[] }`，在 CUAService group container 的 `Software/`。本机 **文件不存在**（只在会话里 persist）。没有往桌面倒 PII。

URL 黑名单管的是 **浏览器窗口**，不是 Linear.app。

## 和抓包的关系

`request_user_input_async` **不是** CUA：问 issue 标题，立刻 `{"accepted":true}`，用户后补「可以的」。

为什么「全权由你控制」之后仍能点 Linear：

- Linear 不是 forbidden
- App 级 prompt 已经过了
- native **不读聊天原文**
- 系统提示：用户文本压过技能里的「提交前永远确认」

所以 category [9]「submit 必确认」在这次 **没有被 clicker 执行**。
