# 第 8 段 — `nodeRepl` 宿主能力（js 内核）

**验证：** `native/node-repl-tools.txt` + `native/node-repl-env.txt`（本机 `cua_node/bin/node_repl`）+ 活 kernel `/var/folders/…/kernel.js` `trusted-worker.js` + `verify/results/debug-live.json`。细节：`agents/30-node-repl-rest/FINDINGS.md`。

抓包只用了 `nodeRepl.write`。其余 `reversed_unused`。GitHub 把 `node_repl`/`cua_repl` 当同一类服务器，**没有**这些 JS 成员实现。

## MCP 工具（模型可见）

Stock 四个。**没有**短名工具 `js_add`（那是 `js_add_node_module_dir` 的 strings 前缀）。

| 工具 | 抓包 | Schema / 说明 |
|---|---|---|
| `js` | 37 | `{code, title?, timeout_ms?}`。`title` min 1 / **max 80**。`timeout_ms` integer **minimum 1**，省略 = **30000 ms**。超时：`js execution timed out; kernel reset, rerun your request` |
| `js_reset` | 1 | `{}`。杀 **untrusted** 内核，banner 再跑 `setupCUA`；不关标签/App。`js_add_node_module_dir` 根 **还在**。trusted worker 不杀 |
| `turn_ended` | hook，模型 UI 看不见（`_meta.ui.visibility: []`） | `{hook_event_name, session_id, turn_id}` 全 `minLength:1`。unified-computer-use Stop/Interrupt/SubagentStop |
| `js_add_node_module_dir` | 否 | `{path}` 绝对 `node_modules` 路径。`path must be absolute` / `path must name a node_modules directory`。JSONL `{type:"add_node_module_dir"}`。cua_repl `enabled_tools` 丢掉它 |

cua_repl `.mcp.json` `enabled_tools: ["js","js_reset","turn_ended"]`。`timeout_ms` 抓包从未设置。

## 两个 `nodeRepl` 对象（agent 12 / 30，活 JS 已确认）

模型 `js` 看到的是 **冻结的 untrusted** 桥：`write`、`emitImage`、可选 `emitAudio`、`cwd/homeDir/tmpDir/requestMeta`，以及仅当 `NODE_REPL_TRUSTED_RPC_ENABLED=1` 时的 `rpc`。

`createElicitation`、`nativePipe`、`launchServices`、`fetch`、`config.*`、`withSuspendedTimeout`、`emitContentItem`、`setResponseMeta`、hooks、`otel`/`telemetry` 只在 **trusted-worker.js**。sky / browser-desktop 从 trusted 侧调它们。

**`nativePipe` 怎么只进 trusted：** `createNativePipeBridge` 只在 `privileged-node-repl.js` 的 `createPrivilegedWorkerRuntime` 里调用，再 `Object.create(untrustedNodeRepl, { nativePipe, … })`。唯一入口是 `trusted-worker.js`。kernel **不 import** 这份文件，untrusted `createNodeReplBridge` 没有这个成员。

Electron `Di()` 会改写 unified-computer-use `.mcp.json`：换成捆绑 Node + `launch.mjs`，注入 `CUA_REPL_NODE_REPL_PATH`。tinysky 打开后 `Jte()` **删掉** Browser/Chrome/Computer Use 技能目录，把模型赶到 `cua.*`。

## `NODE_REPL_*` 环境变量

路径列表用 **OS pathsep**（本机 `:`）。**不是逗号。** 逗号只用于 untrusted env 白名单。

| Env | 分隔 | 作用 |
|---|---|---|
| `NODE_REPL_NODE_PATH` | — | 内核 / worker 的 Node |
| `NODE_REPL_NODE_MODULE_DIRS` | `:` | package 根 |
| `NODE_REPL_TRUSTED_CODE_PATHS` | `:` | trusted `import` 必须 realpath 落在里面 |
| `NODE_REPL_TRUSTED_SERVICES` | JSON | `{browser, sky}` → specifier |
| `NODE_REPL_TRUSTED_RPC_ENABLED` | `"1"` | rust spawn worker 时写入；kernel 才挂 `rpc` |
| `NODE_REPL_JS_BANNER` | 源码 | 首 cell 前置后从 `process.env` 删掉 |
| `NODE_REPL_TOOL_OVERRIDES` | JSON | 改 description / field_descriptions / omit 字段 |
| `NODE_REPL_UNTRUSTED_ENV_ALLOWLIST` | **逗号** | 拷进 untrusted `nodeRepl.env` |
| `NODE_REPL_SANDBOX_ALLOWED_UNIX_SOCKETS` | **`:`（`std::env::split_paths`）** | 额外 unix socket → sandbox `--allow-unix-socket`。默认还带 Group Container CUA sock |
| `NODE_REPL_ENABLE_AUDIO` | `"1"` | `emitAudio` |
| `NODE_REPL_TRACE_META` | `"1"` | trusted `nodeRepl.telemetry` |
| `NODE_REPL_REQUEST_META` | JSON | exec meta 兜底 |
| `NODE_REPL_NATIVE_PIPE_CONNECT_TIMEOUT_MS` | int | 默认 Electron `1000`。失败：`native pipe initial connect timed out` |
| `NODE_REPL_RUNTIME_MODE` | 如 `gaas-browser` | 云浏览器；此模式不能关 sandbox |
| `NODE_REPL_ENABLE_NETWORK_ISOLATION` | flag | sandbox 网络 |
| `NODE_REPL_ACTIVE_EXEC_REGISTRY_DIR` | 目录 | 活 exec 记录（`node_repl/active_execs`） |
| `NODE_REPL_DISABLE_ANALYTICS` / `NODE_REPL_SENTRY_USER_ID` | — | Sentry |
| `NODE_REPL_DISABLE_STRICT_AUTO_REVIEW` / `FORCE_STRICT_AUTO_REVIEW` / `ENFORCE_MODEL_CHECK` | flag | 审批 / 模型门 |

**不在 `node_repl` 二进制字面量里：** `NODE_REPL_INSTRUCTIONS_USE_CASE_{BROWSER,CHROME,COMPUTER_USE}`（Electron 写；rust `server_instructions_from_env` 扫 `vars_os()` 填 MCP `Use Cases:`）；`NODE_REPL_HOST_SERVICES_PIPE_PATH`（sky JS `ensureService`，不是 rust env）。

模型门失败字面量：`node_repl is unavailable for this model`。白名单不在 C 字符串里。`x-codex-turn-metadata`：`model` / `node_repl_auto_review_required` / `node_repl_disabled` / `message`。

## `exec_redacted_source`

每个 `js` cell 在 `evaluate` **之前** 发 `{type:"exec_redacted_source", id, source}`。`diagnostics.js`：绑定标识符 → `idN`，字符串 → `""`，模板/正则/注释抹掉，最长 **16384** 再 `/* truncated */`。给 strict auto-review / guardian，**不是** 模型看到的 tool 输出。

## `nodeRepl` 对象

抓包：`nodeRepl.write(value)`（还可带 channel：`cua.core` / `cua.browser` / `cua.state`）。

| 成员 | 在哪 | 角色 |
|---|---|---|
| `write` | 两边 | 文本给模型（`itemId` → `named_outputs`） |
| `emitImage` / `emitAudio` | 两边；audio 要 env | 多模态。untrusted 无 `emitContentItem` |
| `cwd` `homeDir` `tmpDir` | 两边 | 路径。`tmpDir` 还是锁定全局 |
| `env` | 两边，内容不同 | untrusted = 逗号白名单快照；trusted = 全 `process.env` |
| `requestMeta` | 两边 | 含 `x-codex-turn-metadata` |
| `rpc("browser"\|"sky", req)` | **untrusted only**（env=1） | 转发 trusted `handleRpc` |
| `createElicitation` | trusted | policy 确认 |
| `setResponseMeta` / `emitContentItem` | trusted | 回写 meta / 额外 content |
| `nativePipe.createConnection(path)` | **trusted only** | 连 `computeruse.sock` 的本机可信路径 |
| `launchServices.openApplication({applicationPath\|bundleIdentifier})` | trusted | 拉起 Computer Use.app |
| `fetch` | trusted | privileged `authenticated_fetch` |
| `config.{readToml,writeToml,read,readRequirements,writeValue,batchWrite}` | trusted | toml；`writeToml("config.toml")` 拒绝 |
| `withSuspendedTimeout` | trusted | 拉长 js 超时 |
| `addTurnEndedHandler` / `addAfterSubmittedCodeHook` | trusted | `{run, timeoutMs}` |
| `otel.log` / `telemetry` / `gaasBrowserConfig` | trusted | 诊断 / 云浏览器。`telemetry` 要 `TRACE_META=1` |

沙盒额外 socket：`NODE_REPL_SANDBOX_ALLOWED_UNIX_SOCKETS` 用 **OS 路径分隔符（mac 上是 `:`）**，不是逗号。旁路脚本曾用逗号，解析会错。`nativePipe` **只**装在 trusted-worker。全表：`agents/30-node-repl-rest/FINDINGS.md`。

## 和抓包的关系

`js` 的 `code` 跑在 untrusted 内核里。`cua` 是 banner 装的。`pt.dev.logs` 走 browser RPC，结果再用 `nodeRepl.write` 吐给模型。
