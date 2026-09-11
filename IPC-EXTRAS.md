# 第 11 段 — 同一条 native 总线上的其它产品

`SkyComputerUseService` 不只做点击。同一 client 二进制 `SkyComputerUseClient` 用不同 argv 开不同 MCP。  
**这些不是 tinysky `cua.*`。** 抓包两轮 CUA 没用它们。

| argv | 产品 | 和 CUA 关系 |
|---|---|---|
| `mcp` | Computer Use 10 工具 | **就是**窗口 CUA |
| `messages mcp` | 读/发 iMessage | 独立产品 |
| `computer-history mcp` | Skysight 使用记录 | 独立 |
| `event-stream mcp` | Record & Replay | 独立 |
| `calendar mcp` | placeholder `not_implemented` | 无插件 |
| `turn-ended` | 回合结束 | hook |

详见 `agents/21-ipc-extras/FINDINGS.md`。GitHub 的 `computer-use` 插件 hook 只认 `turn_ended`，没有 Messages API。
