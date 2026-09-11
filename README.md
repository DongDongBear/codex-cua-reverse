# ChatGPT 桌面 Computer Use / Browser Use 逆向

本机 ChatGPT.app 的只读分析。不是 OpenAI 官方仓库，不含 `SkyComputerUseService` 可执行文件。说明见 [NOTICE.md](NOTICE.md)。

## 怎么读

按这个顺序即可，根目录不再堆平行说明：

| # | 文件 | 内容 |
|---|---|---|
| 1 | [docs/how-it-works.md](docs/how-it-works.md) | 实现：`js` REPL、tinysky、native-pipe、IAB；未反编译模块的推断 |
| 2 | [docs/api.md](docs/api.md) | 模型在 `js` 里实际写的 `cua.*` / Target / Playwright |
| 3 | [docs/verification.md](docs/verification.md) | 抓包 1074/1161、残留界面、agent 自己调包 |
| 4 | [docs/unreversed.md](docs/unreversed.md) | 编译体 / 鉴权 / 仍是黑盒的部分 |

更细的 Agent 笔记、拷出来的 `.d.ts`/JS、抓包在下面，需要时再翻。

## 三句话

1. 模型工具是持久 **`js`**（`mcp__cua_repl`），不是 GitHub 的 `exec`，也不是扁平 `computer_click`。
2. `cua.getBrowser` / `cua.getApp` 是同一套 Target；浏览器走 IAB 或 Chrome 扩展，原生走 `SkyComputerUseService`（IPC `CodexComputerUseIPC-5`）。
3. 点屏锁在 ChatGPT 父进程上。旁路能 load 包、setup、列工具，不能 `listApps`。

## 证据目录

| 路径 | 什么 |
|---|---|
| `vendor/` | 从本机 app 抽出的 JS / `.d.ts` / 插件 |
| `traces/` | 两轮主会话的 `js` 调用 |
| `verify/` | 静态契约、MCP、agent 直调日志 |
| `native/` | IPC 类型名、bundle id 抽样 |
| `agents/` | 分路 FINDINGS（原始笔记） |
| `test-site/` | IAB 测试页 `http://127.0.0.1:8765/` |
| `docs/prompts/` | 回归用过的提示词 |
| `archive/legacy/` | 整理前的散文档（内容已吸收到 `docs/`） |

抓包原件在本机 `~/Desktop/codex-traffic/` 和 `codex拦截-两轮-raw.json`，不在本仓库。
