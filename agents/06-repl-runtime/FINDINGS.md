# Verdict

**JS Computer Use does not run in ChatGPT’s Electron renderer.** It runs in a bundled **Node 24.20.0** (`cua_node/bin/node`) under a **Rust MCP stdio server** (`cua_node/bin/node_repl`, crate `node_repl@0.1.0`). The model-facing tool is MCP **`js`** (plus `js_reset` / `turn_ended`). Unified Computer Use wraps that binary as MCP server **`cua_repl`**.

On the **first `js` call of a kernel**, `node_repl` prepends `NODE_REPL_JS_BANNER` and evaluates it as an ESM cell. The CUA banner is `setupCUA({browser, computer})` from `@oai/cua/tinyskyAlt`. That **installs global `cua`** and loads providers. It does **not** collect inventory. `cua.initialize()` is `setupCUA()` then `cua.getState()`. After the banner, `initialize()` is just inventory. The live unified-computer-use tool text tells the model to call `cua.getState()` / `getBrowser` / `getApp` / …, not `initialize()`. Captured traces match that: first cell was `cua.getBrowser({url})`.

**Persistence is in-process VM state**, not disk. Each `js` call is a new ESM “cell” compiled with `vm.SourceTextModule`. Top-level `let`/`const`/`var`/`function`/`class` bindings are re-exported and imported by the next cell via a synthetic `@prev` module. `js_reset` kills the Node kernel and starts a fresh one (banner runs again). Browser tabs and native apps are not closed.

**Globals that actually exist in this CUA REPL:**

| Global | Who installs it | Role |
|---|---|---|
| `nodeRepl` | kernel, locked (`writable:false`) | host bridge: `write`, `emitImage`, `rpc`, cwd/env |
| `tmpDir` | kernel, locked | `os.tmpdir()` |
| `cua` | banner → `setupCUA` → `Reflect.set(globalThis,"cua",…)` | tinysky-alt API |
| `agent` | `create_tinysky_alt` when browser is enabled | raw `@oai/browser` agent (undocumented) |
| `cua.computer` | same, when computer is enabled | `sky` client (RPC proxy) |
| `sky` | **not auto-global** | `import("@oai/sky")` or `cua.computer`; legacy skill assigns `globalThis.sky` |
| `tools` | **absent** | Codex `code_mode` / `features.js_repl`, not this runtime |

Privileged APIs (`nodeRepl.fetch`, `nativePipe`, `createElicitation`, `config`, `launchServices`, `addTurnEndedHandler`) live on the **trusted worker** `nodeRepl`, not on the untrusted user VM.

---

## Process graph

```
ChatGPT.app (Electron, app.asar)
  resolves cua_node/bin/node + cua_node/bin/node_repl
  writes ~/.codex/config.toml  [mcp_servers.node_repl]
  patches unified-computer-use .mcp.json  (cua_repl.enabled, CUA_REPL_* env)
        │
        ▼
  Resources/codex  (Rust CLI / app-server)
        │  MCP stdio
        ▼
  unified-computer-use  MCP server name = cua_repl
    command = cua_node/bin/node
    args    = [plugin/scripts/launch.mjs]
        │  spawn(CUA_REPL_NODE_REPL_PATH)  stdio inherit
        ▼
  cua_node/bin/node_repl     Rust MCP server  (js / js_reset / turn_ended / js_add_node_module_dir)
        │  JSONL over pipes
        ├─ untrusted Node kernel   bin/node --experimental-vm-modules kernel.js --session-id --working-dir
        │     vm.createContext({ codeGeneration: { strings:false, wasm:false } })
        │     user cells + NODE_REPL_JS_BANNER
        │     nodeRepl.rpc("browser"|"sky", request)  if NODE_REPL_TRUSTED_RPC_ENABLED=1
        │
        └─ trusted Node worker     trusted-worker.js  (full process.env, no vm isolate)
              import(NODE_REPL_TRUSTED_SERVICES[service]).handleRpc
              browser → @oai/browser-desktop/service
              sky     → @oai/sky/service → Codex Computer Use.app (native pipe)
```

Electron (`app.asar`) is the one that:

- sets `CUA_REPL_NODE_REPL_PATH` to `e.nodeRepl.command` (the `node_repl` binary)
- sets `CUA_REPL_ENABLED_SURFACES` to `browser,computer` (or a subset)
- builds `mcp_servers.node_repl.env` with `NODE_REPL_NODE_PATH`, `NODE_REPL_NODE_MODULE_DIRS`, `NODE_REPL_TRUSTED_CODE_PATHS`, `NODE_REPL_TRUSTED_SERVICES`, `CODEX_CLI_PATH`, `CODEX_HOME`

`launch.mjs` then **overrides** `NODE_REPL_TRUSTED_SERVICES` / `NODE_REPL_JS_BANNER` / `NODE_REPL_TOOL_OVERRIDES` for the cua_repl child.

There is a **parallel** path: ChatGPT also registers MCP server `node_repl` that execs the Rust binary **directly** (no banner). Browser/computer-use **skills** tell the model to `await import("@oai/sky")` or use `mcp__node_repl__js`. Unified Computer Use is the tinysky path with global `cua`.

---

## `cua_node` layout

Archive identity (`manifest.json`):

| Field | Value |
|---|---|
| platform/arch | darwin-arm64 |
| `node_version` | **24.20.0** |
| `runtime_archive_version` | `0.0.11/20260902191201-81d486bd9181` |
| `runtime_archive_name` | `cua-node-0.0.11-20260902191201-81d486bd9181-darwin-arm64.tar.gz` |
| `node_archive_path` | `v24.20.0/node-v24.20.0-darwin-arm64.tar.gz` |
| `node_path` | `bin/node` |
| `node_repl_path` | `bin/node_repl` |
| `node_modules` | `lib/node_modules` |

Confirmed by running `bin/node -v` → `v24.20.0` (V8 13.6, modules 137, napi 10). `bin/setup.sh` asserts `node --version` equals `v${manifest.node_version}` and that `import("@oai/sky")` exports `sky`.

### `bin/` (complete)

| File | Type | Size | Notes |
|---|---|---|---|
| `node` | Mach-O arm64 | 116M | bundled Node, not system node |
| `node_repl` | Mach-O arm64 | 18M | Rust MCP + embedded kernel JS |
| `npm` | sh wrapper | 1.1K | `exec $runtime_root/bin/node …/npm-cli.js` |
| `npx` | sh wrapper | 1.1K | same pattern |
| `corepack` | sh wrapper | 1.1K | same pattern |
| `setup.sh` | bash | 1.8K | archive self-test |
| `setup.ps1` | ps1 | 3.5K | Windows twin |

There is **no** `cua_repl` binary. `cua_repl` is the MCP **server name** plus `launch.mjs`.

`node_repl --help`:

```
Run the node_repl MCP stdio server.
Usage: node_repl [OPTIONS]
      --disable-sandbox  Start the Node kernel directly even when CODEX_CLI_PATH is set
```

No `--version`. Crate version string in the binary: `node_repl@0.1.0`. Embedded rust modules: `mcp_server.rs`, `repl_manager.rs`, `trusted_process.rs`, `active_exec_registry.rs`, `native_pipe.rs`, `authenticated_fetch.rs`, `launch_services.rs`, `computer_use.rs`, `config_manager.rs`, `sandbox_state.rs`, `browser_gaas_config.rs`, `codex_app_server.rs`.

### `lib/node_modules` (OAI + runtime)

| Package | Version | Role |
|---|---|---|
| `@oai/cua` | 0.2.4 | tinysky-alt (`./tinyskyAlt`), older `cua.initialize` |
| `@oai/sky` | 0.6.26 | native AX client; `./service` = trusted RPC |
| `@oai/browser-desktop` | 0.1.1 | IAB/Chrome/CDP; `./service` = trusted RPC |
| `@oai/cdp-browser-backend` | 0.4.2 | listed in package-map; **not extracted as a directory** |
| `playwright` / `playwright-core` | 1.57.0 | `tab.playwright` |
| `sharp` + `@img/sharp-darwin-arm64` | 0.35.4 | image |
| `classic-level` | 3.0.0 | browser persistence |
| `npm` | 11.19.0 | bundled with Node |
| `corepack` | 0.35.0 | bundled with Node |
| `@statsig/js-client` | 3.33.3 | sky telemetry |

`@oai/sky` also ships `Codex Computer Use.app` (SkyComputerUseService + client + installer + lock-screen guardian).

---

## How JS executes

1. MCP `tools/call` name `js` with `{ code, title?, timeout_ms? }`. Default timeout **30000 ms**. `output_token_limit` for cua_repl `js` is **25000**.
2. Rust `repl_manager` starts (or reuses) a Node kernel: `NODE_REPL_NODE_PATH` + `--experimental-vm-modules` + embedded `kernel.js`. Kernel argv: `--session-id`, `--working-dir`. Then `chdir(workingDir)`.
3. Host → kernel JSONL `{ type:"exec", id, code, request_meta?, form_elicitation_supported?, gaas_browser_config? }`.
4. `handleExec`:
   - parse user code with **meriyah 7.0.0** (`parseModule`, `disableWebCompat: true`)
   - instrument top-level bindings so they can be committed across cells
   - **once per kernel**, prefix:

     ```js
     await (async () => {
     ${NODE_REPL_JS_BANNER}
     })();
     import.meta.__codexInternalMarkBannerExecuted();
     ```

     Then delete `NODE_REPL_JS_BANNER` from `process.env` so it cannot leak into user code.
   - compile `new SourceTextModule(source, { context: runtimeContext })`
   - `link`: only allowed static import is **`@prev`** (previous cell namespace). Anything else: *Use `await import(...)` instead.*
   - `evaluate()`, drain background tasks (`emitImage` / `rpc` promises), then `submitted_code_complete` + trusted `run_hooks`
5. Result JSONL `{ type:"exec_result", ok, output, named_outputs, content_items, error }`. Named outputs come from `nodeRepl.write(value, itemId)`.
6. Console.log/info/warn/error/debug during a cell are captured as `kind:"line"` output events.

Untrusted context globals populated by `createRuntimeContext`: `globalThis`, `Buffer`, `console`, `URL`, fetch/Headers/Request/Response, timers, `crypto`, `atob`/`btoa`, `structuredClone`, `performance`. **`eval` / `new Function` / wasm are disabled** (`codeGeneration.strings=false, wasm=false`). **`node:process` is denylisted** so user code cannot corrupt the JSONL transport. Bare package imports must resolve under configured `node_modules` roots (`.js` / `.mjs` only; no directory imports).

Kernel bootstrap also freezes `nodeRepl.env` to `NODE_REPL_UNTRUSTED_ENV_ALLOWLIST` (comma-separated names). Trusted worker sees full `process.env`.

---

## Persistence

Comment in kernel.js:

> Every exec is compiled as a fresh ESM "cell". `previousModule` is the most recently committed module namespace. `previousBindings` tracks which top-level names should be carried forward. Each new cell imports a synthetic view of the previous namespace and redeclares those names so user variables behave like a persistent REPL.

Carry rules:

- Next cell prelude: `import * as __prev from "@prev";` then `let/const/var name = __prev.name` for names not redeclared in the new cell.
- Redeclaring the same name in a later cell is allowed (`let tab = …` again). `const` reassignment warns: *use let for reassignable variables*.
- Failed cells still promote **committed** bindings (instrumentation marks declarations after they run). Uncommitted shadowing of a prior name is recovered from the old module.
- `js_reset` (MCP): *Reset the JavaScript kernel and clear all bindings.* cua_repl copy: *The next cua_repl.js call initializes a fresh runtime for the enabled surfaces. This does not close browser tabs or native apps.*
- Sandbox change also resets: `js sandbox changed; kernel reset, rerun your request`.
- Uncaught exception / unhandled rejection **kills the kernel** (`scheduleFatalExit`).
- Package modules loaded from `node_modules` stay cached across cells (`persistentPrefix = "package:"`). Local file modules are cleared each exec.
- `js_add_node_module_dir` adds a `node_modules` search root that **survives `js_reset`**.

So `let browser` / `let tab` in traces remaining live across later `js` calls is this `@prev` machinery, not a hidden disk store.

---

## `initialize()` on the first `js` call

There are **two** `cua` constructors in `@oai/cua`:

### A. tinysky-alt (what the banner uses)

`dist/lib/js/oai_js_cua/src/tinysky_alt/globals.js`:

```js
const l = {
  initialize() {
    return (async () => {
      await n();          // setupCUA once
      return l.getState();
    })();
  },
};
function n(t = {}) {
  return i != null || (i = create_tinysky_alt(t).then((t) => Object.assign(l, t))), i;
}
Reflect.set(globalThis, "cua", l);
export { n as setupCUA };
```

`setupCUA` (banner) **does not call `getState`**. It:

1. Optionally imports `browser-client.setupBrowserRuntime` and `sky`.
2. Emits core docs (`tinysky-alt-core-*-repl.md`) via `nodeRepl.write(docs, "cua.core")`, plus confirmation policy once.
3. `Object.assign`s `getState`, `getBrowser`, `createBrowserTab`, `getTab`, `listBrowsers`, `listTabs`, `getApp`, `listApps`, `browsers`, `computer` onto `cua`.
4. `Reflect.set(globalThis, "agent", browserRuntime)` when browser is on.

`cua.initialize()` after the banner ≡ `cua.getState()` (apps + browsers + tabs inventory, emitted as `cua.state`).

First-use docs for a **specific browser** are emitted on `getBrowser` / `createBrowserTab` / `getTab` (`item_id = "cua.browser"`). Initial AX tree is emitted on getApp / getTab / createBrowserTab (`"cua.state"`). `{ emit:false }` suppresses state/screenshot emission; first-use docs still go out.

### B. older `@oai/cua` main export (`cua.js`)

`initialize()` calls `setupBrowserRuntime`, assigns `cua.computer = sky`, `cua.browsers`, then `get_state(...)`. No `setupCUA`, no banner. Not what unified-computer-use runs.

### What the model is told to do

| Doc | First call |
|---|---|
| `tinysky-alt-core-node-repl.md` | `cua.initialize()` then pick a target |
| `tinysky-alt-core-cua-repl.md` | `cua.getState()` (no `initialize` on the type) |
| unified `js-tool-description.md` | first cell = **exactly one** of getState / getBrowser / createBrowserTab / getTab / getApp |
| computer-use skill | `globalThis.sky = (await import("@oai/sky")).sky` then `sky.get_app_state` |

Live traces (`traces/all-js-calls.json`) never call `initialize()`. Cell 1 is `let browser = await cua.getBrowser({ url })`.

---

## Globals in detail

### `nodeRepl` (untrusted VM)

Created by `createNodeReplBridge` in embedded `worker-runtime.js`. Frozen + `defineLockedGlobal`.

| Member | Behavior |
|---|---|
| `cwd` | kernel working dir |
| `env` | allowlisted snapshot |
| `homeDir` | `HOME` or null |
| `tmpDir` | `os.tmpdir()` (sandbox redirects TMPDIR) |
| `requestMeta` | frozen MCP request meta for this exec (`openai/confirmation_policies`, `x-codex-turn-metadata`, …) |
| `write(value, itemId?)` | **sync**. `formatLog([value])` → `outputEvents`. `itemId` must be nonempty string; used as named output key |
| `emitImage(imageLike)` | **async**. normalizes to data URL, JSONL `emit_image`, waits for host ack |
| `emitAudio(dataUrl)` | only if `NODE_REPL_ENABLE_AUDIO=1` |
| `rpc(service, request)` | only if `NODE_REPL_TRUSTED_RPC_ENABLED=1`. JSON-serializable request. Forwards to trusted worker |

`write` extra `itemId` values used by tinysky: `"cua.core"`, `"cua.browser"`, `"cua.state"`.

### `nodeRepl.emitImage`

Accepts:

- `data:` URL (passed through)
- `file:` URL → `readFileSync` + sniff PNG/JPEG/WebP
- `Uint8Array` / `Buffer` / `ArrayBuffer` / view → sniff mime
- `{ bytes, mimeType }` (no other keys)

Sends `{ type:"emit_image", id, exec_id, image_url }` and is tracked as a background task so the cell does not finish until the image is attached. AX `getScreenshot` / `getAXStateAndScreenshot` call `emitImage({ bytes, mimeType:"image/png" })` unless `{ emit:false }`.

Host-side errors in the binary: `nodeRepl.emitImage only accepts data URLs` (stricter rust decoder for some paths), `missing emitted image`.

### `nodeRepl` (trusted worker, extra)

`createPrivilegedNodeReplBridge` prototypes the untrusted bridge and adds:

- `rpc` target side: `handleRpc` on configured services
- `fetch` → host `authenticated_fetch` (not Node fetch)
- `createElicitation`
- `nativePipe.createConnection(path)` (Sky computer-use socket)
- `launchServices.openApplication({ applicationPath | bundleIdentifier })`
- `config.readToml / writeToml / writeValue / batchWrite` (refuses writing `config.toml` via writeToml)
- `addAfterSubmittedCodeHook` / `addTurnEndedHandler`
- `setResponseMeta` / `emitContentItem` / `withSuspendedTimeout` / `otel.log` / `gaasBrowserConfig`

`turn_ended` MCP tool runs those handlers (`hook_event_name`, `session_id`, `turn_id`). Plugin hooks: Interrupt / Stop / SubagentStop.

### `cua`

See tinysky `TinySkyAlt` in `types.d.ts`. Surfaces gated by banner options. `getApp` / `listApps` throw on non-mac (`Native app bindings are unavailable for ${target}`).

### `sky`

`@oai/sky` `sky.js`:

- If `typeof nodeRepl.rpc === "function"`: at module load, `rpc("sky", {type:"setup"})` → `{target, methods}`. Each method becomes `rpc("sky", {type:"execute", method, args})`.
- Else: local `create_client(load_options())` (needs `OAI_SKY_CONFIG_PATH` or `process.platform`).
- Missing rpc: `sky requires node_repl; configure NODE_REPL_TRUSTED_SERVICES`.

Trusted `service.js` `handleRpc`: `setup` | `execute` | linux `drag_*`. Screenshots returned as `{filepath, data_url}`; client unwraps to `{filepath, bytes, data_url}`.

Mac transport: `nodeRepl.nativePipe` to `~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock` (or `SKY_CUA_SERVICE_NATIVE_PIPE_PATH`).

### `tools`

**Not installed.** Kernel never defines it. `features.js_repl` is `false` in live `~/.codex/config.toml`. `cua_repl` tools are omitted from `code_mode` (`omit_tools_from: ["code_mode","deferred"]`). If a model writes `tools.*` in this REPL it is a `ReferenceError` unless user code created it.

Undocumented extra: **`globalThis.agent`** = full browser agent (Playwright, capabilities, `documentation`, …) when browser setup ran.

---

## `NODE_REPL_*` and `CUA_REPL_*`

### Set by `launch.mjs` (cua_repl)

```js
NODE_REPL_TRUSTED_SERVICES = {
  browser?: "@oai/browser-desktop/service",  // if CUA_REPL_ENABLED_SURFACES has browser
  sky?:     "@oai/sky/service",              // if computer
}
NODE_REPL_JS_BANNER = contents of banner.js | banner-browser.js | banner-computer.js
NODE_REPL_TOOL_OVERRIDES = {
  server_instructions: "UI automation through a persistent JavaScript session…",
  tools: {
    js: {
      description: js-tool-description + browser-description + computer-description + js-output-description,
      field_descriptions: { code: "JavaScript to execute using the initialized CUA runtime." }
    },
    js_reset: { description: js-reset.md }
  }
}
```

`CUA_REPL_NODE_REPL_PATH` must be an **absolute** executable (the Rust `node_repl`). `CUA_REPL_ENABLED_SURFACES` default `browser,computer`.

### Set by Electron / rust host (also on direct `mcp_servers.node_repl`)

Observed keys (values redacted / summarized):

| Env | Meaning |
|---|---|
| `NODE_REPL_NODE_PATH` | `cua_node/bin/node` |
| `NODE_REPL_NODE_MODULE_DIRS` | `cua_node/lib/node_modules` (`:` / `;` separated) |
| `NODE_REPL_TRUSTED_CODE_PATHS` | absolute roots the trusted worker may `import`; Electron joins `CODEX_HOME` + node_module dirs |
| `NODE_REPL_TRUSTED_SERVICES` | JSON map service name → specifier or absolute `file:` / path |
| `NODE_REPL_TRUSTED_RPC_ENABLED` | rust sets `1` when spawning kernel+worker |
| `NODE_REPL_JS_BANNER` | consumed then deleted |
| `NODE_REPL_TOOL_OVERRIDES` | JSON, overrides MCP tool descriptions |
| `NODE_REPL_UNTRUSTED_ENV_ALLOWLIST` | comma list copied into `nodeRepl.env` |
| `NODE_REPL_REQUEST_META` | fallback request meta |
| `NODE_REPL_ENABLE_AUDIO` | `1` enables `emitAudio` |
| `NODE_REPL_TRACE_META` | `1` enables response-meta tracer |
| `NODE_REPL_NATIVE_PIPE_CONNECT_TIMEOUT_MS` | default `1000` in Electron |
| `NODE_REPL_DISABLE_ANALYTICS` | sentry opt-out |
| `NODE_REPL_SENTRY_USER_ID` | analytics |
| `NODE_REPL_DISABLE_STRICT_AUTO_REVIEW` / `FORCE_STRICT_AUTO_REVIEW` / `ENFORCE_MODEL_CHECK` | approval gates |
| `NODE_REPL_RUNTIME_MODE` | e.g. gaas-browser |
| `NODE_REPL_ENABLE_NETWORK_ISOLATION` | sandbox |
| `NODE_REPL_SANDBOX_ALLOWED_UNIX_SOCKETS` | extra sockets |
| `NODE_REPL_ACTIVE_EXEC_REGISTRY_DIR` | live exec records |
| `NODE_REPL_INSTRUCTIONS_USE_CASE_{BROWSER,CHROME,COMPUTER_USE}` | empty string = surface enabled (Electron) |
| `CODEX_CLI_PATH` | sandbox helper; `--disable-sandbox` skips |
| `CODEX_HOME` | `~/.codex` |
| `BROWSER_USE_AVAILABLE_BACKENDS` | e.g. `chrome,iab` |
| `SKY_CUA_SERVICE_PATH` / `SKY_CUA_SERVICE_NATIVE_PIPE_PATH` / `SKY_CUA_NATIVE_PIPE` | Computer Use.app |

### `NODE_REPL_TRUSTED_CODE_PATHS`

Trusted worker `registerHooks({resolve})`: every `file:` import must `realpath` inside one of these roots. Bare specifiers resolve only via `createRequire(root + "/node-repl-trusted.js").resolve(pkg)` **inside** `NODE_REPL_NODE_MODULE_DIRS`. Failure: `Trusted RPC package must resolve within a configured trusted module directory`.

Each service module **must export `handleRpc`**.

Browser service (`browser-service.mjs` tail):

```js
export { MVe as handleRpc };
// handleRpc({ method, params }) → setup | execute
```

`setup({environment, undocumentedApiMembers, excludedDocumentation})` requires privileged `nodeRepl` (`createElicitation` etc.). Environment must be `codex-app` | `training` | `cloud`.

Sky service: `handleRpc({type:"setup"|"execute"|drag_*})`.

---

## MCP tools (default vs override)

Default `js` description inside `node_repl` (before overrides):

> Execute JavaScript in a persistent `node_repl` with top-level await. Top-level bindings persist until `js_reset` and can be redeclared. … Use `nodeRepl.write(value)` for output and `await nodeRepl.emitImage(image)` for images. … default timeout is 30000 ms … Use `js_add_node_module_dir` when an additional package directory is required.

Schema fields (from binary): `code` (JS, maxLength), `title` (short user-facing description), `timeout_ms` (optional, default 30000).

Other tools:

- `js_reset` — kill kernel, clear bindings
- `js_add_node_module_dir` — absolute `node_modules` path; persists across reset
- `turn_ended` — `{hook_event_name, session_id, turn_id}`; duplicate (session,turn) ignored

cua_repl `.mcp.json`: `enabled_tools: ["js","js_reset","turn_ended"]` — **does not expose** `js_add_node_module_dir` to the model.

---

## `nodeRepl.write` vs observation APIs

Tinysky `create_tinysky_alt.js` queues writes so docs then state stay ordered:

```
write(coreDocs, "cua.core")
write(browserDocs, "cua.browser")
write(stateOrJson, "cua.state")
```

Kernel `renderOutputEvents` concatenates events **without** `item_id` into `output`, and groups `item_id` streams into `named_outputs` (Map insertion order, values only).

`getAXState` → `write(text, "cua.state")`.  
`getScreenshot` → `emitImage({bytes, mimeType:"image/png"})`.  
Calling `write`/`emitImage` again on those results duplicates content; docs say pass `{emit:false}` to get a return value silently.

`write` is **not** `console.log`. Console goes to `kind:"line"`. `write` is `kind:"write"` and can take any inspectable value.

---

## Security notes (descriptive, not an exploit)

- Two processes: untrusted VM (user `js`) vs trusted worker (OAI packages + native pipe).
- User VM cannot `import("node:process")`, cannot `eval`, cannot wasm, cannot static-import arbitrary files.
- Trusted worker **can** use full Node, native addons, Sky socket, authenticated fetch.
- `NODE_REPL_TRUSTED_CODE_PATHS` is the allowlist for that worker’s ESM graph.
- Analytics: binary contains a Sentry DSN and Statsig client endpoint inside `@oai/sky` telemetry; gated by `NODE_REPL_DISABLE_ANALYTICS`. Not copied here.
- `js` may require an approval elicitation (`JavaScript execution requires an approval`, `codex_strict_auto_review`).

---

## Live host config (redacted)

`~/.codex/config.toml` was read only to see how the app actually launches the REPL. No API keys were present. Relevant **shape** (values summarized):

- `[features] js_repl = false`
- `[mcp_servers.node_repl] command = …/cua_node/bin/node_repl`
- env includes `NODE_REPL_NODE_PATH`, `NODE_REPL_NODE_MODULE_DIRS`, `NODE_REPL_TRUSTED_CODE_PATHS` (`$CODEX_HOME` + cua_node modules), `NODE_REPL_TRUSTED_SERVICES` JSON `{browser: <cached browser-service.mjs>, sky: "@oai/sky/service"}`, `CODEX_CLI_PATH`, `SKY_CUA_SERVICE_PATH`
- plugin `unified-computer-use@openai-bundled` enabled; its on-disk `.mcp.json` still has `cua_repl.enabled: false` until Electron’s `Di()` rewrite (app.asar patches that file when surfaces + nodeRepl exist)

Do not treat `~/.codex/config.toml` as a secret store in writeups; it can grow tokens later.

---

## Docs vs runtime mismatches

1. Skill/docs still say **`node_repl`** or **`cua_repl`** as the tool name; the model tool is **`js`**.
2. `tinysky-alt-core-node-repl.md` leads with `cua.initialize()`; cua-repl docs and the injected js description lead with `getState()` / entry points. Banner already called `setupCUA`.
3. `sky` is global only if the model (or the old computer-use skill) assigns it. Tinysky hangs it at `cua.computer`.
4. `tools` global is documentation leftover from code-mode, not this kernel.
