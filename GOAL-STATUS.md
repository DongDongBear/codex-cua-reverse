# /goal status — reverse ALL Computer Use + Browser Use

**Objective:** Reverse every computer-use and browser-use capability of this machine's ChatGPT.app, verify against `/Users/dongdong/Desktop/codex拦截-两轮-raw.json`.

## 现在的结论

| 范围 | 状态 |
|---|---|
| 这两轮 raw.json 里用到的 CUA | **DONE**（独立重解析 39/39 function_call；37 js 对上 tinysky API） |
| ChatGPT.app 里模型能调的 CUA/Browser API 清单 | **DONE**（tinysky + sky window + api.json 146 + 8 capability + Playwright 子集 + nodeRepl） |
| GitHub openai/codex | **DONE**：harness 名字 only；0 个 `cua.get*` 实现 |
| 本进程 live 列出真实 AX | **按设计失败**（−10000 / unix ping FIN） |
| `SkyComputerUseService` 里 CGEvent 逐条反编译 | **不做**（有 IPC 请求名 + Swift 类型足够说明谁在点） |

独立 raw 重解析：`agents/11-raw-reparse/`（2889 frames，39/39 deltas=done）。  
CROSSCHECK：`CROSSCHECK.md`。纠错：`CATALOG-CORRECTIONS.md`。  
QUESTIONS：`agents/17-questions-resolved/`（185：156 已答；剩下几乎全是编译过的 Swift）。

## Agent 产出（均已写 FINDINGS）

01 tinysky · 02 sky · 03 browser-desktop · 04 plugin · 05 traces · 06 node_repl · 07 native app · 08 crosscheck · 09 unused browser caps · 10 unused native IPC · 11 raw reparse · 12 repl/plugins · 13 Chrome · 14 IAB · 15 Playwright · 16 policy · 17 QUESTIONS 185 题 · 18 exec vs js · 19 paste/audio/errors · 20 AX/skyshot · 21 IPC extras · 22 catalog skeptic · 23 GitHub · v1–v7 live verify
