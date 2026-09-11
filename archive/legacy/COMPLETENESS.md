# 逆向完成度（Computer Use + Browser Use）

目标：ChatGPT.app 上 **所有** CUA 电脑操作 + 浏览器操作能力都有本机出处，并用 raw.json 标清「用过 / 没用过」。

skeptic（agents/22）：旧 `CAPABILITY-CATALOG.json` 的 `in_traces` 有假阳性（把 `nodeRepl.write` 算成 `AXAPI.write`）。以 [CATALOG-CORRECTIONS.md](CATALOG-CORRECTIONS.md) 为准。

## 已闭环（源码 + 抓包或 live 形状）

| 块 | 文档 | 验证 |
|---|---|---|
| 工具树 `js`/`js_reset`/`exec` | GITHUB-VS-DESKTOP.md | raw.json 13 对工具，两轮一致 |
| 浏览器 tinysky 入口 | BROWSER-CUA.md | 任务1 49/49 |
| 原生 tinysky App | NATIVE-CUA.md | 任务2 49/49 |
| 动态 capabilities | BROWSER-CAPABILITIES.md | 文档 vs api.json 字面 |
| Tab 四套操作面 | TAB-SURFACES.md | api.json 全成员列出 |
| 原生动作全表 | NATIVE-ACTIONS.md | d.ts + MCP list |
| Live 鉴权 | LIVE-VERIFICATION.md | NDJSON MCP；unix ping 被踢；-10000 |
| nodeRepl 宿主 | NODEREPL.md | strings 全成员 |
| Sky 三平台 | SKY-PLATFORMS.md | 本机只活 Mac window |
| 目录纠错 | CATALOG-CORRECTIONS.md | vs raw.json 假阳性 |
| 错误码 / paste / audio | ERRORS.md | 抓包 −10005 + live −10000 |
| 同总线其它产品 | IPC-EXTRAS.md | Messages/History 不是 cua.* |
| 交叉校验 | CROSSCHECK.md | 16 条共识；`js?` 已拆开 |
| GitHub vs 桌面 | GITHUB-VS-DESKTOP.md | 198 desktop_only；0 个 CUA API 在开源仓 |
| exec ≠ js | agents/18-advertised-tools/ | 43 次 create，工具树 SHA 相同；0×exec |
| Chrome vs IAB | CHROME-AND-IAB.md | 任务1 是 IAB id `"1"`；Chrome 扩展 unused |
| Playwright 子集 | PLAYWRIGHT.md | 4 个 traces_used；evaluate 只读 world |
| AX / skyshot | AX-SKYSHOT.md | raw 工具结果：缩进文本 + JPEG data URL |
| 策略 / elicitation | POLICY.md | native 才挡 click；markdown 只是 prompt |
| 独立 raw 重解析 | agents/11-raw-reparse/ | 2889 帧，39/39 call 对齐 |
| 未用原生 IPC 形状 | agents/10-native-actions/ | drag/scroll/selectText 编码 |
| 01–07 QUESTIONS | agents/17-questions-resolved/ | 185 题：156 已答 / 26 未答 / 3 范围外 |
| 未还原清单 | UNREVERSED.md | Swift 黑盒、鉴权、IAB 握手 |
| ChatGPT live Finder | DEBUG-LIVE.md | getApp 成功；index 0 无 Raise |

## 能力是否「逆向出来」的标准

1. **有签名**（.d.ts / api.json / MCP schema / 插件 md）  
2. **知道怎么接到模型**（`js` 里 `cua`/`tab`/`app`，或旧 `sky.*`，或 MCP 扁平工具）  
3. **抓包对照**：用过 = 调用级验证；没用过 = 标 `reversed_unused`，不能假装 live

按这个标准：

- **模型在这两轮里用到的 CUA 动作：已完成。**  
- **app 里还装了但这两轮没调用的 API：签名已从本机抽出（本文件引用的各段）。**  
- **GitHub openai/codex：harness + 策略，不是动作实现。**

## 未做 / 不能做（不是漏签名）

- 用未认证进程把 `list_apps` 跑出真实 app 列表（-10000 / socket FIN）  
- 复放 Linear 点击（会改用户数据）  
- 给 live `node_repl` 再挂一个 listTabs（会抢会话）  
- 反编译 `SkyComputerUseService` 里 CGEvent 的每一条指令（有 Swift 类型名 + IPC 请求名足够说明「谁在点」）

## 仍由后台 Agent 补细节（不挡「能力清单」）

Chrome 扩展 native host、IAB 进程、Playwright 未用方法的实现注释、policy/elicitation、CROSSCHECK.md。清单本身已经覆盖 tinysky + sky window + browser-desktop 22 个 interface。
