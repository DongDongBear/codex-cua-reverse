# 架构

```
ChatGPT.app
  └─ Contents/Resources/codex          # 桌面端 Rust 二进制（发 response.create）
       │
       │  模型工具：js / js_reset
       │  描述由 NODE_REPL_TOOL_OVERRIDES 注入
       ▼
  unified-computer-use 插件
    scripts/launch.mjs
      spawn CUA_REPL_NODE_REPL_PATH
      NODE_REPL_TRUSTED_SERVICES = { browser: @oai/browser-desktop/service,
                                     sky:     @oai/sky/service }
       ▼
  cua_node（独立 Node，不是系统 node）
    @oai/cua          tinysky-alt，暴露全局 `cua`
    @oai/browser-desktop   标签页 / IAB / Chrome 扩展 / Playwright
    @oai/sky          原生辅助功能客户端
       ▼
  Codex Computer Use.app               # 真正点屏幕、读 AX 树的原生程序
```

## 工具怎么挂上模型

`vendor/plugins/unified-computer-use/launch.mjs` 会：

1. 读 `CUA_REPL_ENABLED_SURFACES`（默认 `browser,computer`）
2. 拼出 `js` 工具的 description（若干 markdown 拼在一起）
3. 以 MCP 工具 `js` / `js_reset` / `turn_ended` 跑 `cua_repl`

对应 `.mcp.json`：

```json
"enabled_tools": ["js", "js_reset", "turn_ended"]
```

所以你在拦截里看到的不是 `computer_click` 这种扁平 function，而是 **一段 JS**，在持久 REPL 里调 `cua.*`。

## 两套表面

| 表面 | 模型写法 | 实现 |
|---|---|---|
| 浏览器（IAB / Chrome） | `cua.getBrowser` / `cua.getTab` / `tab.click(325)` | `@oai/browser-desktop` |
| 原生 Mac App | `cua.getApp("Linear")` 或 `sky.click({ app, element_index })` | `@oai/sky` → Computer Use.app |

第一轮 Ant Design Form 走浏览器表面。  
第二轮 Linear 走原生 App 表面（同一套 `js` 工具）。

## 本机路径

| 东西 | 路径 |
|---|---|
| CUA Node | `/Applications/ChatGPT.app/Contents/Resources/cua_node/` |
| `@oai/cua` | `.../cua_node/lib/node_modules/@oai/cua` |
| `@oai/sky` | `.../cua_node/lib/node_modules/@oai/sky` |
| Computer Use.app | `.../@oai/sky/Codex Computer Use.app` |
| unified-computer-use 插件 | `.../plugins/openai-bundled/plugins/unified-computer-use/` |
| computer-use 插件（旧/并行） | `.../plugins/openai-bundled/plugins/computer-use/` |

## 和开源仓库的关系

`github.com/openai/codex` 有 CLI 的 `exec` / `exec_command` / code mode。  
**没有** `cua.getBrowser`、`@oai/sky`、`Codex Computer Use.app`。
