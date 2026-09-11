# FINDINGS — remaining `node_repl` / kernel / trusted-worker (agent 30)

Local disk only. No exploits. No tokens.

**Binaries / extracts**

| Path | What |
|---|---|
| `/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node_repl` | Mach-O arm64, 18 725 584 bytes, crate `node_repl@0.1.0` |
| `/var/folders/sz/2jf5mk0n3fj161vq1tjphn_40000gn/T/.tmpsdJ9Ei/` | Live kernel extract (2026-09-11 01:09): split `kernel.js` + `trusted-worker.js` + siblings |
| `/tmp/node_repl_extract/` | Older concatenated dump (do not use; files glued together) |
| `verify/results/debug-live.json` | Live MCP `initialize` + `tools/list` against this binary |

This note dumps what **NODEREPL.md was missing**: every `NODE_REPL_*` env the binary actually reads, the four MCP tools + `timeout_ms`, sandbox socket list format (**colon / `std::env::split_paths`, not comma**), `js_add_node_module_dir`, `exec_redacted_source`, the model-check string, and why `nativePipe` exists only on the trusted worker.

---

## Verdict

`node_repl` is a Rust MCP stdio server that spawns two Node children:

1. **Untrusted kernel** — `NODE_REPL_NODE_PATH --experimental-vm-modules kernel.js --session-id … --working-dir …`. VM `codeGeneration: {strings:false, wasm:false}`. Frozen `nodeRepl` from `createNodeReplBridge` (no `nativePipe`).
2. **Trusted worker** — `trusted-worker.js <cwd>`. Full `process.env`. `createPrivilegedWorkerRuntime` **is the only caller** of `createNativePipeBridge`; it installs `nativePipe` on `globalThis.nodeRepl`.

`strings` concatenates adjacent Rust `&str` (no NUL). `native/node-repl-env.txt` therefore glued names (`…SOCKETSL`, `…TIMEOUT_MSHOME`). Exact names below come from a byte scan + the live JS extract.

---

## 1. All `NODE_REPL_*` env (binary + JS)

### 1.1 Names the `node_repl` binary / kernel / worker actually contain

| Env | Split format | Role |
|---|---|---|
| `NODE_REPL_NODE_PATH` | path | Node 24 used to spawn kernel + trusted worker (`cua_node/bin/node`) |
| `NODE_REPL_NODE_MODULE_DIRS` | **OS pathsep** (`:` mac/linux, `;` win) — JS `path.delimiter` | `node_modules` search roots; trusted `createRequire(root+"/node-repl-trusted.js")` |
| `NODE_REPL_TRUSTED_CODE_PATHS` | **OS pathsep** | Absolute roots; trusted `registerHooks` realpath must stay inside |
| `NODE_REPL_TRUSTED_SERVICES` | JSON object `service → specifier\|file:\|abs path` | Trusted `handleRpc` map. Missing/invalid: `Trusted RPC service is not configured` / `does not export handleRpc` |
| `NODE_REPL_TRUSTED_RPC_ENABLED` | `"1"` | Rust sets this when it actually spawned the worker (packed literal `…ENABLED1`). Kernel then defines `nodeRepl.rpc` |
| `NODE_REPL_JS_BANNER` | raw JS | First kernel cell wraps it in `await (async () => { … })()` then **deletes** it from `process.env` |
| `NODE_REPL_TOOL_OVERRIDES` | JSON | `{ server_instructions?, tools: { js\|js_reset\|js_add_node_module_dir\|turn_ended: { description?, field_descriptions?, omit? } } }`. Unknown tool: `unknown node_repl tool override: `. `cannot omit required field … from node_repl tool` |
| `NODE_REPL_UNTRUSTED_ENV_ALLOWLIST` | **comma** | Kernel `pickEnv`: `.split(",").map(trim)`. Copied into untrusted `nodeRepl.env`. Trusted worker snapshots **all** string env |
| `NODE_REPL_ENABLE_AUDIO` | `"1"` | Adds `nodeRepl.emitAudio` on both bridges |
| `NODE_REPL_TRACE_META` | `"1"` | Trusted worker installs `nodeRepl.telemetry` (`createResponseMetaTracer`) |
| `NODE_REPL_REQUEST_META` | JSON | Host fallback for exec `request_meta` / `x-codex-turn-metadata` |
| `NODE_REPL_NATIVE_PIPE_CONNECT_TIMEOUT_MS` | int ms | Packed next to `HOME` in rodata. Electron live value `1000`. Failure: `native pipe initial connect timed out` |
| `NODE_REPL_RUNTIME_MODE` | string | Packed with isolation env. `gaas-browser` requires Codex sandbox; `Codex app-server is unavailable in gaas-browser runtime mode` |
| `NODE_REPL_ENABLE_NETWORK_ISOLATION` | flag | Sandbox network isolation |
| `NODE_REPL_SANDBOX_ALLOWED_UNIX_SOCKETS` | **OS pathsep, not comma** | Extra sockets for `--allow-unix-socket`. Parser: `node_repl::sandbox::parse_allowed_unix_sockets_from_process_env` uses **`std::env::SplitPaths`** |
| `NODE_REPL_ACTIVE_EXEC_REGISTRY_DIR` | dir | Live exec records; default relative `node_repl/active_execs`. Failures: `failed to create/write/publish/encode/remove node_repl active exec record` |
| `NODE_REPL_DISABLE_ANALYTICS` | flag | Sentry opt-out (`node_repl@0.1.0` / `sentry.rust/0.47.0`) |
| `NODE_REPL_SENTRY_USER_ID` | string | Analytics user |
| `NODE_REPL_DISABLE_STRICT_AUTO_REVIEW` | flag | Packed with the next two (adjacent `&str`) |
| `NODE_REPL_FORCE_STRICT_AUTO_REVIEW` | flag | Force approval elicitation |
| `NODE_REPL_ENFORCE_MODEL_CHECK` | flag | Gate: `node_repl is unavailable for this model` |

### 1.2 Packed spawn / strip lists (not extra env names)

Kernel spawn copies (packed after `--experimental-vm-modules` / `LC_ALL`):

`NODE_REPL_ENABLE_AUDIO`, `SYSTEMROOT`, `TMP`, `TMPDIR`, `USERPROFILE`, `WINDIR`, `CODEX_HOME`, `NODE_REPL_JS_BANNER`, `NODE_REPL_UNTRUSTED_ENV_ALLOWLIST`, `NODE_REPL_TRUSTED_RPC_ENABLED=1`

Dangerous env **names** packed together (strip / do not inherit into sandbox Node):

`NODE_REPL_TRUSTED_SERVICES`, `NODE_REPL_NODE_MODULE_DIRS`, `NODE_REPL_TRUSTED_CODE_PATHS`, `NODE_OPTIONS`, `NODE_PATH`, `LD_PRELOAD`, `LD_LIBRARY_PATH`, `DYLD_INSERT_LIBRARIES`, `BROWSER_USE_SECURITY_MODE`

### 1.3 Names **not** in the `node_repl` binary (Electron / sky JS only)

| Name | Who | Notes |
|---|---|---|
| `NODE_REPL_INSTRUCTIONS_USE_CASE_{BROWSER,CHROME,COMPUTER_USE}` | `app.asar` `xs()` / `Ei()` | **No contiguous literal in `node_repl`.** Rust `mcp_server::server_instructions_from_env` walks `std::env::vars_os()` and appends matching values under MCP `instructions` → `Use Cases:`. Live NDJSON with values `"Control"` three times produced three bullets |
| `NODE_REPL_HOST_SERVICES_PIPE_PATH` | `@oai/sky` `native-pipe.js` | `ensureService {service:"computer-use"}`. **Not** a `node_repl` env |

Related non-`NODE_REPL_*` the binary still reads: `CODEX_CLI_PATH`, `CODEX_HOME`, `HOME`, `TMPDIR`/`TMP`/`TEMP`, clap `--disable-sandbox` (`DISABLE_SANDBOX` — “Start the Node kernel directly even when `CODEX_CLI_PATH` is set”).

---

## 2. MCP tools, timeout, schemas

Stock tools (serde structs `JsToolArgs` / `JsResetArgs` / `JsAddNodeModuleDirArgs` / `TurnEnded`). **There is no tool named `js_add`.** `native/node-repl-tools.txt` `js_add` is the prefix of `js_add_node_module_dir`.

Live `tools/list` (`verify/results/debug-live.json`):

### `js`

Description (stock; cua_repl `NODE_REPL_TOOL_OVERRIDES` replaces the whole string):

> Execute JavaScript in a persistent `node_repl` with top-level await. Top-level bindings persist until `js_reset` and can be redeclared. Use `const` for stable values and `let` for changing values. Use dynamic imports such as `await import("playwright")`; top-level static imports and `node:process` are unavailable. Use `nodeRepl.write(value)` for output and `await nodeRepl.emitImage(image)` for images. Execution context is available through `nodeRepl.cwd`, `nodeRepl.homeDir`, `nodeRepl.tmpDir`, and `nodeRepl.requestMeta`. The default timeout is 30000 ms (30 seconds); increase `timeout_ms` for longer operations. Use `js_add_node_module_dir` when an additional package directory is required.

| Field | Schema |
|---|---|
| `code` | required string. “JavaScript code to execute with top-level await.” |
| `title` | optional. `minLength: 1`, **`maxLength: 80`**. “Short user-facing description of what the code does.” |
| `timeout_ms` | optional integer **`minimum: 1`**. “Optional execution timeout in milliseconds. **Defaults to 30000 (30 seconds)** when omitted.” |

Timeout kill: `js execution timed out; kernel reset, rerun your request` and Sentry `node_repl js execution timed out`. Trusted-only `nodeRepl.withSuspendedTimeout` sends `suspend_timeout` / `resume_timeout`. Untrusted bridge has no such method. Traces never set `timeout_ms`.

Approval (strict auto-review): `JavaScript execution requires an approval elicitation`; denied / no ack: `JavaScript execution was denied` / `did not receive approval`. Elicitation title `Run JavaScript`. Meta: `codex_request_type=codex_strict_auto_review`, `connector_id=node_repl`, `connector_name=Node REPL`.

### `js_reset`

> Reset the JavaScript kernel and clear all bindings.

Args `{}`. Result text `js kernel reset`. Kills the **untrusted** Node kernel (not the trusted worker). Banner re-runs. `js_add_node_module_dir` roots **survive**. Annotations: `readOnlyHint: true`, `destructiveHint: false`, `openWorldHint: false`.

Sandbox change also resets: `js sandbox changed; kernel reset, rerun your request`.

### `js_add_node_module_dir`

> Add an absolute `node_modules` directory for package imports. The directory remains available after `js_reset`.

Arg `path` (required, `minLength: 1`): “Absolute path to a node_modules directory to add to Node package resolution.”

Host checks (binary): `path must be absolute`; `path must name a node_modules directory`.

Kernel JSONL `{type:"add_node_module_dir", path}` → `addModuleSearchBase`:

- trim; resolve relative against cwd
- if basename is `node_modules`, use the **parent** as the search base (so `…/lib/node_modules` becomes `…/lib`)
- insert **before** cwd in `moduleSearchBases` (cwd stays last)
- duplicates ignored

Bare `import("pkg")` only resolves files **inside** a configured base’s `node_modules`. cua_repl `.mcp.json` `enabled_tools` drops this tool; generic `mcp_servers.node_repl` still advertises it.

### `turn_ended`

> Notify trusted libraries that a Codex turn ended. Repeated notifications for the same session and turn are ignored.

Required: `hook_event_name`, `session_id`, `turn_id` (all `minLength: 1`). Error: `turn_ended requires non-empty event, session, and turn IDs`. Timeouts: `turn-ended handlers timed out` / `turn-ended response channel closed`. Annotations: `idempotentHint: true`. `_meta.ui.visibility: []` (hidden from the model UI). Trusted worker `{type:"turn_ended"}` runs `addTurnEndedHandler` hooks **concurrently**.

### MCP `instructions` (initialize)

Stock template (audio sentence is always in the template; `emitAudio` still needs the env flag):

```
Use `js` for `node_repl` execution with persistent, redeclarable top-level bindings, `js_reset` to clear bindings, and `js_add_node_module_dir` to add package directories. Use `await nodeRepl.emitAudio(audioDataUrl)` to return an `audio/*` data URL.

Use Cases:
```

`server_instructions_from_env` then appends `- {value}` bullets from the use-case env vars.

---

## 3. Sandbox allowed sockets: colon, not comma

**Format of `NODE_REPL_SANDBOX_ALLOWED_UNIX_SOCKETS` is the OS path list separator.**

Evidence:

- Rust symbol `node_repl::sandbox::parse_allowed_unix_sockets_from_process_env` iterates **`std::env::SplitPaths`** (`std::env::split_paths`). That is `:` on macOS/Linux and `;` on Windows — the same rule as `PATH`.
- Sandbox helper argv includes `--allow-unix-socket`.
- Packed next to the env name: default CUA socket relative `Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/` (joined with `HOME`).
- Native-pipe path checks: `native pipe path must be absolute` / `is not a socket` / `has no parent directory` / `has no file name` / `file name is too long`.

**Not comma.** `verify/debug-live.py` joined two sockets with `","` — that is the wrong delimiter for this parser (a comma-joined string is one path). Contrast:

| Env | Split |
|---|---|
| `NODE_REPL_SANDBOX_ALLOWED_UNIX_SOCKETS` | `split_paths` → `:` here |
| `NODE_REPL_NODE_MODULE_DIRS` | JS `path.delimiter` → `:` here |
| `NODE_REPL_TRUSTED_CODE_PATHS` | JS `path.delimiter` → `:` here |
| `NODE_REPL_UNTRUSTED_ENV_ALLOWLIST` | **comma** |
| `NODE_REPL_TRUSTED_SERVICES` | JSON, not a path list |
| `CUA_REPL_ENABLED_SURFACES` / `BROWSER_USE_AVAILABLE_BACKENDS` | comma (`browser,computer` / `chrome,iab`) — those are **not** this env |

`gaas-browser` cannot `--disable-sandbox`: `the gaas-browser node_repl sandbox cannot be disabled`. Seatbelt failures: `sandbox-exec:`, `macos_sandbox_failed`. Linux: `features.use_legacy_landlock=true`, `shell_environment_policy.inherit="all"`.

---

## 4. `exec_redacted_source`

Kernel, after `buildModuleSource` and **before** `module.evaluate()`:

```js
send({
  type: "exec_redacted_source",
  id: message.id,
  source: builtSource.redactedSource,
});
```

`diagnostics.js` (`redactedDiagnosticSourceMaxLength = 16_384`):

| Token | Replacement |
|---|---|
| Identifier that is a binding (not uncomputed member/property key) | `id0`, `id1`, … (`#idN` for private) |
| StringLiteral | `""` |
| TemplateLiteral | `` `${ `` / `` `` `` / `}${` / `}` `` |
| RegularExpression | `/(?:)/` |
| comments | `/* */` |
| over 16384 chars | slice + `\n/* truncated */` |

Rust: `KernelToHost::ExecRedactedSource` (2 fields: id + source). Diagnostics events: `redacted_source_available`, `redacted_source`, `redacted_source_exec_completed` (`src/diagnostics.rs:79/98`). Consumed by strict auto-review / guardian (`NODE_REPL_DISABLE_STRICT_AUTO_REVIEW` / `FORCE_STRICT_AUTO_REVIEW`), **not** returned as model-visible `js` output.

---

## 5. Model-check string

Exact MCP error:

```
node_repl is unavailable for this model
```

Gated by `NODE_REPL_ENFORCE_MODEL_CHECK` (desktop feature `nodeReplEnforceModelCheck`). `x-codex-turn-metadata` / `NodeReplTurnMetadata` fields:

`model`, `node_repl_auto_review_required`, `node_repl_disabled`, `message`

**No model-id allow-list is a C string in this binary.** These traces used `gpt-6-astra` successfully. Allow-list is compiled / Statsig / host-side, still unanswered (agent 06 Q20 / UNREVERSED.md).

---

## 6. `nativePipe` is injected only into the trusted worker

Call chain (live extract `/var/folders/…/.tmpsdJ9Ei/`):

```
trusted-worker.js
  createWorkerRuntime(...)           // untrusted-shaped bridge, then Object.freeze(runtime.nodeRepl)
  createPrivilegedWorkerRuntime({ env: full process.env, runtime, telemetryBridge })
    createNativePipeBridge({ execContext, send })          // ONLY here
    createPrivilegedNodeReplBridge({ nativePipe: nativePipeBridge.nativePipe, nodeRepl: runtime.nodeRepl, ... })
      Object.create(nodeRepl, { nativePipe: { value, enumerable:true, writable:false, configurable:false }, ... })
  Object.defineProperty(globalThis, "nodeRepl", { value: privilegedRuntime.nodeRepl, writable:false, configurable:false, enumerable:false })
```

Untrusted kernel (`kernel.js`):

- imports `createWorkerRuntime` only — **never** `privileged-node-repl.js`
- `createNodeReplBridge` members: `cwd`, `env` (allowlist), `homeDir`, `tmpDir`, `requestMeta`, `write`, `emitImage`, optional `emitAudio`
- then maybe `nodeRepl.rpc` if `NODE_REPL_TRUSTED_RPC_ENABLED=1`
- `Object.freeze` + `defineLockedGlobal(runtimeContext, "nodeRepl", nodeRepl)`
- inbound JSONL: `exec` | `add_node_module_dir` | settle acks. **No** `native_pipe_*` handler

Privileged extras (trusted `globalThis.nodeRepl` only): `nativePipe`, `createElicitation`, `fetch`, `launchServices`, `config.{readToml,writeToml,read,readRequirements,writeValue,batchWrite}`, `addTurnEndedHandler` / `addAfterSubmittedCodeHook` (both `{run, timeoutMs}`), `setResponseMeta`, `emitContentItem`, `withSuspendedTimeout`, `otel.log`, `gaasBrowserConfig`, optional `telemetry`. `env` on this object is the **full** frozen `process.env`.

`nativePipe.createConnection(path)` JSONL:

| Direction | `type` | `op` |
|---|---|---|
| worker → rust | `native_pipe_request` | `connect` `{path}` / `write` `{connection_id,data_base64}` / `close` `{connection_id}` |
| rust → worker | `native_pipe_response` / `native_pipe_data` / `native_pipe_closed` | |

Returned handle: `{ write(bytes), on("data"\|"close"\|"error"), off, end }`. Sky’s `native-pipe.js` calls this from `@oai/sky/service` running **inside** the trusted worker. Untrusted `js` cannot reach the CUA socket through `nodeRepl`.

---

## 7. Kernel / trusted JSONL (remaining types)

**Kernel → host** (`KernelToHost` tagged): `exec_result` (`ok, output, named_outputs, content_items, error`), `exec_redacted_source`, `submitted_code_complete` (`execution_duration_ms`), `emit_image` / `emit_audio`, `trusted_service_request` / `trusted_service_hooks`, `turn_ended_result`.

**Trusted → host** (same tagged enum): `elicit`, `authenticated_fetch`, `config_action` (`read_toml` / `write_toml` / `read_config` / `read_config_requirements` / `write_config_value` / `batch_write_config`), `launch_services_action` / `open_application`, `suspend_timeout` / `resume_timeout`, `response_meta`, `response_meta_trace`, `otel_log`, `native_pipe_request`.

Kernel argv: `--session-id` (salts `__codex_internal_commit_*` binding names) and `--working-dir` (then `chdir`). Live: `--working-dir /Users/dongdong/Documents/ChatGPT/Desktop`.

Fatal kernel: uncaught exception / unhandled rejection → `node_repl kernel …; kernel reset. Catch or handle async errors…` then `process.exit(1)`. Host: `node_repl kernel closed unexpectedly`.

Active exec record fields (packed): `version`, `execId`, `sessionId`, `turnId`, `sandbox`, `nodeReplPid`, `kernelPid`, `startedAtMs`.

---

## 8. Live kernel file set (not in NODEREPL.md)

`/var/folders/…/.tmpsdJ9Ei/` (also older copies under `.tmpV5pbQ7` etc.):

| File | Bytes | Role |
|---|---|---|
| `kernel.js` | 56208 | Untrusted VM REPL |
| `trusted-worker.js` | 6935 | Privileged host |
| `worker-runtime.js` | 12941 | Shared JSONL + untrusted `createNodeReplBridge` |
| `privileged-node-repl.js` | 19589 | Privileged prototype + `nativePipe` |
| `privileged-node-repl-config.js` | 7189 | `nodeRepl.config.*` |
| `diagnostics.js` | 5195 | `redactDiagnosticSource` |
| `tracing.js` | 6446 | `telemetry` spans (max 1024 / 32 attrs) |
| `realmChecks.js` | 640 | Cross-realm `ArrayBuffer` brand check |
| `meriyah.umd.min.js` | 133892 | ESM parser for bindings + redaction |
| `package.json` | 19 | `{"type":"commonjs"}` |

Rust crate files (event strings): `src/mcp_server.rs`, `src/mcp_server/strict_auto_review.rs`, `src/repl_manager.rs` (~2676+ lines), `src/trusted_process.rs`, `src/native_pipe.rs`, `src/sandbox.rs` (module; no `src/sandbox.rs:` panic line), `src/sandbox_state.rs`, `src/diagnostics.rs`, `src/active_exec_registry.rs`, `src/launch_services.rs`, `src/config_manager.rs`, `src/authenticated_fetch.rs`, `src/browser_gaas_config.rs`, `src/otel.rs`, `src/host.rs`, `src/main.rs`.

---

## NODEREPL.md gaps this pass fills

- Full `NODE_REPL_*` table + comma vs colon
- Four tool schemas including `title.maxLength=80`, `timeout_ms.minimum=1`, default 30000
- `js_add` is **not** a second tool
- `exec_redacted_source` pipeline (16384, idN / wiped strings)
- Model-check exact string + `NodeReplTurnMetadata`
- `nativePipe` injection only via `createPrivilegedWorkerRuntime` in `trusted-worker.js`
