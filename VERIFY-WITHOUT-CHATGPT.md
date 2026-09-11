# 不让 ChatGPT 当调用方时，怎么验证逆向

旁路 `node_repl` **不能** `listApps`/点屏（鉴权）。验证不靠我冒充发送方，靠三件事：抓包、留下的界面、类型契约。

## 1. 抓包（调用方是 ChatGPT，观察者是我们）

`1161_WS_…/websocket.jsonl` 里 12 段 `js` 的 code 和你报的 12 步一一对应。这已经是「真调用」，只是发送方不是这个 agent。

## 2. 残留界面（我刚才用 AppleScript **读**，没再点）

| 逆向/1161 声称 | 现在本机读到 |
|---|---|
| TextEdit 正文 `CUA-ALIGN-OKalign-paste` | `DOC:Untitled TEXT:CUA-ALIGN-OKalign-paste` |
| Finder 窗口 `codex-cua-reverse` | `codex-cua-reverse` |
| 测试页还在 | `http://127.0.0.1:8765/` 仍是 CUA regression lab |

这是效果对齐：1161 的 `setValue`/`paste`/`createBrowserTab` 在磁盘/窗口上还在。

## 3. 静态契约（完全不连 Computer Use）

`verify/static-contract.mjs`：抓包 API **22/22** 能在 tinysky / `api.json` / IPC 请求名里找到。  
`SkyComputerUseClient tools/list` 的 10 个名字和 sky window 一致。

## 做不到的

这个 agent 自己 `cua.getApp` / `click`：native pipe 失败。那不是验证手段，是鉴权结论。
