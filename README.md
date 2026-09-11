# Codex CUA 逆向（本机 ChatGPT.app）

本机 ChatGPT 桌面 **Computer Use / Browser Use** 的逆向笔记（`js` / `cua` / `@oai/sky` / IAB）。入口就是本文件。实现策略（含源码路径和未反编译模块的推断）：[IMPLEMENTATION.md](IMPLEMENTATION.md)。没抠出来的清单：[UNREVERSED.md](UNREVERSED.md)。说明：[NOTICE.md](NOTICE.md)。

从本机 ChatGPT 桌面端抽出 **Computer Use + Browser Use** 的全部接口，并用你的抓包验证：

`/Users/dongdong/Desktop/codex拦截-两轮-raw.json`

## 架构

模型桌面工具是 **`js`**（MCP `cua_repl`，持久 Node REPL）。
`unified-computer-use` 把 JS 丢进 `cua_node` 的 `node_repl`，全局 **`cua`**（tinysky-alt）：

```
ChatGPT.app
  └─ Contents/Resources/codex          # 发 response.create；工具 js / js_reset
       ▼
  unified-computer-use / launch.mjs
       ▼
  cua_node（node_repl）                 # 全局 cua
       ├─ @oai/browser-desktop         # cua.getBrowser / tab.click / tab.playwright
       └─ @oai/sky                     # cua.getApp("Linear") / app.click / setValue
            ▼
  Codex Computer Use.app               # AX / CGEvent
```

开源 `github.com/openai/codex` **没有** 这套 CUA。进程细节：[ARCHITECTURE.md](ARCHITECTURE.md)。模型写法：[API.md](API.md)。

两轮抓包：Ant Design Form 走内置浏览器（14× `js`）；Linear 建 issue 走原生 App（23× `js` + `request_user_input_async` + `js_reset`）。`exec` 在工具树里，一次没调。`sky.*` 没直接出现，原生走 `cua.getApp`。对照：[TRACES.md](TRACES.md)。

Live：`SkyComputerUseClient mcp`（NDJSON）`tools/list` 是 10 个与 `sky` window API 同名的工具。本进程 `list_apps` → **`-10000 Sender process is not authenticated`**。未签名 Node 直连 `computeruse.sock` 会被踢。现场：[DEBUG-LIVE.md](DEBUG-LIVE.md)、[LIVE-VERIFICATION.md](LIVE-VERIFICATION.md)、[NATIVE-PIPE.md](NATIVE-PIPE.md)。

## 文件

| 文件 | 内容 |
|---|---|
| [ARCHITECTURE.md](ARCHITECTURE.md) | 进程怎么串 |
| [API.md](API.md) | 模型在 `js` 里写的 `cua.*` / Target |
| [TRACES.md](TRACES.md) | 两轮任务如何对应 API |
| [UNREVERSED.md](UNREVERSED.md) | 没还原出来的（Swift / 鉴权 / 黑盒） |
| [REGRESSION.md](REGRESSION.md) | 1074：Finder 19 步 + 本地页 11 步 |
| [ALIGN.md](ALIGN.md) | 1161 抓包 × 你列的 12 步 × 逆向（未再开 ChatGPT） |
| [test-site/](test-site/) | 本地 IAB 测试页 `http://127.0.0.1:8765/` |
| [DEBUG-LIVE.md](DEBUG-LIVE.md) | 用 `node_repl`+`js` 现场调试 |
| [LIVE-VERIFICATION.md](LIVE-VERIFICATION.md) | 真调 MCP / socket |
| [NATIVE-PIPE.md](NATIVE-PIPE.md) | sock → ensureService → launch → ping |
| [IAB-SOCK.md](IAB-SOCK.md) | /tmp/codex-browser-use；setup 不连 sock |
| [native/policy-bundle-ids.md](native/policy-bundle-ids.md) | 抽样 42 个 bundle id（不是完整策略表） |
| [agents/24-sender-auth/FINDINGS.md](agents/24-sender-auth/FINDINGS.md) | unix FIN vs MCP −10000 |
| [agents/26-iab-handshake/FINDINGS.md](agents/26-iab-handshake/FINDINGS.md) | IAB 无 token，要 session route |
| [agents/30-node-repl-rest/FINDINGS.md](agents/30-node-repl-rest/FINDINGS.md) | 全部 `NODE_REPL_*` env |
| [GITHUB-VS-DESKTOP.md](GITHUB-VS-DESKTOP.md) | 开源 openai/codex 只有 harness；动作 API 在 app 里 |
| [BROWSER-CUA.md](BROWSER-CUA.md) | 浏览器 `cua` / Target / playwright |
| [NATIVE-CUA.md](NATIVE-CUA.md) | 原生 App Target / sky / MCP |
| [UNUSED-APIS.md](UNUSED-APIS.md) | 抓包没走但仍在 app 里的能力 |
| [BROWSER-CAPABILITIES.md](BROWSER-CAPABILITIES.md) | visibility/cdp/webmcp 等动态能力 |
| [TAB-SURFACES.md](TAB-SURFACES.md) | 浏览器四套操作面 AX/CUA/DOM/Playwright |
| [NATIVE-ACTIONS.md](NATIVE-ACTIONS.md) | 原生 click/paste/scroll/drag/… |
| [NODEREPL.md](NODEREPL.md) | js 内核 / nodeRepl.* |
| [SKY-PLATFORMS.md](SKY-PLATFORMS.md) | Mac/Win/Linux sky 差异 |
| [CHROME-AND-IAB.md](CHROME-AND-IAB.md) | 扩展 native host vs 内置 Owl 浏览器 |
| [PLAYWRIGHT.md](PLAYWRIGHT.md) | 注入 Playwright 子集 |
| [AX-SKYSHOT.md](AX-SKYSHOT.md) | 模型看见的 AX 文本和截图 |
| [POLICY.md](POLICY.md) | App 审批和确认 |
| [ERRORS.md](ERRORS.md) | −10000/−10005、paste 三路径、audio 门闩 |
| [IPC-EXTRAS.md](IPC-EXTRAS.md) | Messages/History 等同进程其它 MCP |
| [CROSSCHECK.md](CROSSCHECK.md) | 7 路 FINDINGS × raw.json |
| [CATALOG-CORRECTIONS.md](CATALOG-CORRECTIONS.md) | 抓包 YES/NO 纠错 |
| [CAPABILITIES.md](CAPABILITIES.md) | 146 个 browser-desktop 成员全表 |
| [COMPLETENESS.md](COMPLETENESS.md) | 完成度与未做事项 |
| [agents/17-questions-resolved/FINDINGS.md](agents/17-questions-resolved/FINDINGS.md) | 01–07 共 185 个问题 |
| [agents/](agents/) | 各路 Agent 的 FINDINGS |
| [vendor/](vendor/) | 从 app 拷出的 `.d.ts` / 文档 / `launch.mjs` |
| [traces/](traces/) | 从拦截抽出的 `js` 调用 |
