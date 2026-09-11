# Verdict

The model-facing tools `js`, `js_reset`, and `turn_ended` are **not implemented by either plugin**. They are the stock MCP tools of the bundled `cua_node/bin/node_repl` binary. `unified-computer-use` is a **hidden stdio wrapper** (`mcpServers.cua_repl`) whose only job is to spawn that binary and redecorate it:

1. ChatGPT.app rewrites the plugin cache `.mcp.json` from `enabled: false` / `command: "node"` into a live server that runs `cua_node/bin/node` + `scripts/launch.mjs`, with `CUA_REPL_NODE_REPL_PATH` and `CUA_REPL_ENABLED_SURFACES` injected.
2. `launch.mjs` reads those two `CUA_REPL_*` vars, concatenates markdown into `NODE_REPL_TOOL_OVERRIDES`, picks a `setupCUA` banner, overwrites `NODE_REPL_TRUSTED_SERVICES`, and `spawn`s `node_repl` with `stdio: "inherit"` so Codex’s MCP stdio talks to `node_repl` through the wrapper.
3. `node_repl` advertises `js` / `js_reset` / `turn_ended` / `js_add_node_module_dir`. The plugin’s `enabled_tools` whitelist drops the fourth. The first `js` call prepends `NODE_REPL_JS_BANNER` (`setupCUA({ browser, computer })`), which installs global `cua`.
4. `turn_ended` is a real MCP tool on that same server. Unified-computer-use **hooks** (`Interrupt` / `Stop` / `SubagentStop`) call `cua_repl.turn_ended`. Browser/Chrome plugins call `node_repl.turn_ended`. A third, native path is Codex `notify = [SkyComputerUseClient, "turn-ended"]`.

`computer-use@openai-bundled` is a **parallel, older path**, not the source of `js`:

- User-facing skill. On this machine `bundledContentVariant` is `"node-repl"`, so the desktop copies `.codex-plugin/computer-use-node-repl.md` over `skills/computer-use/SKILL.md` and tells the model to use `node_repl` + `sky.*`.
- Plugin MCP `computer-use` launches `SkyComputerUseClient mcp`. **Not running** here: `~/.codex/config.toml` has `[mcp_servers.computer-use] enabled = false`, and there is no live launcher/`SkyComputerUseClient` MCP process.
- Native UI still works because `@oai/sky/service` (a trusted RPC, not that MCP) talks over a native pipe to `SkyComputerUseService`, which ChatGPT.app starts itself.

Live this session (2026-09-10): **two** `node_repl` MCP servers are up — generic `mcp_servers.node_repl` (PID 5746) **and** `cua_repl`’s child (PID 5769). Intercepted tool calls are unprefixed `"name": "js"`. `features.js_repl = false` disables Codex’s built-in js_repl feature; the tools the model sees come from these MCP servers.

```mermaid
sequenceDiagram
    autonumber
    participant App as ChatGPT.app<br/>(Electron / app.asar)
    participant Codex as Codex binary<br/>app-server PID 3632
    participant Plugin as unified-computer-use<br/>plugin cache .mcp.json
    participant Launch as cua_node/bin/node<br/>scripts/launch.mjs PID 5748
    participant Repl as cua_node/bin/node_repl<br/>PID 5769 (cua_repl)
    participant Kernel as kernel.js + banner
    participant Trusted as trusted-worker.js
    participant Browser as @oai/browser-desktop/service
    participant Sky as @oai/sky/service
    participant Native as SkyComputerUseService<br/>PID 3802
    participant CUAApp as Codex Computer Use.app
    participant Nested as nested codex app-server<br/>stdio PID 7250

    App->>Plugin: Di(): enable cua_repl, set command/args/env<br/>CUA_REPL_NODE_REPL_PATH, CUA_REPL_ENABLED_SURFACES
    App->>Codex: spawn app-server (stdio MCP client)
    Codex->>Launch: stdio MCP initialize / tools/list<br/>(command = cua_node/bin/node)
    Launch->>Launch: read CUA_REPL_* ; concat markdown<br/>set NODE_REPL_TOOL_OVERRIDES / JS_BANNER / TRUSTED_SERVICES
    Launch->>Repl: spawn(CUA_REPL_NODE_REPL_PATH, [], stdio inherit)
    Repl->>Nested: spawn `codex app-server --listen stdio://`<br/>(approvals / trusted RPC)
    Repl-->>Codex: tools/list = js, js_reset, turn_ended<br/>(js_add_node_module_dir stripped by enabled_tools)
    Note over Codex: model tool name is unprefixed `js`<br/>(cua_repl / node_repl special-cased)

    Codex->>Repl: tools/call js {code, title?}
    Repl->>Kernel: first call prepends NODE_REPL_JS_BANNER
    Kernel->>Kernel: setupCUA({browser:true, computer:true})
    Kernel->>Trusted: import handleRpc for trusted services
    Trusted->>Browser: browser RPCs (IAB / Chrome)
    Trusted->>Sky: sky RPCs
    Sky->>Native: native pipe JSON-RPC<br/>(~/Library/Group Containers/.../computeruse.sock)
    Native->>CUAApp: AX / screenshot / click / type
    Kernel-->>Repl: nodeRepl.write / emitImage
    Repl-->>Codex: tool result (25k token cap on js)

    Codex->>Repl: hooks Interrupt/Stop/SubagentStop
    Repl->>Trusted: turn_ended {hook_event_name, session_id, turn_id}
    Trusted-->>Repl: turn_ended_result (deduped per session+turn)
    Repl-->>Codex: MCP result

    Note over App,Native: separate Codex notify argv:<br/>SkyComputerUseClient turn-ended<br/>(not the MCP tool)
```

---

## 1. What the plugins actually contain

### 1.1 `unified-computer-use` (hidden, version `26.903.61454`)

App bundle (dotfiles omitted by Finder-style listings):

| Path | Role |
|---|---|
| `.codex-plugin/plugin.json` | Manifest: hooks + `mcpServers: "./.mcp.json"`. No skills, no `interface`. Desktop marks it `hidden: true`, `installWhenMissing: true`, `mcpServerName: "cua_repl"`. |
| `.mcp.json` | **Shipped disabled.** Server name `cua_repl`. |
| `scripts/launch.mjs` | Compiled from `project/cua/cua_repl/src/launch.ts`. Wrapper, not an MCP parser. |
| `resources/banner*.js` | First-exec JS injected as `NODE_REPL_JS_BANNER`. |
| `resources/*.md` | Strings concatenated into `NODE_REPL_TOOL_OVERRIDES`. |

Shipped `.mcp.json`:

```json
{
  "mcpServers": {
    "cua_repl": {
      "command": "node",
      "args": ["scripts/launch.mjs"],
      "enabled": false,
      "enabled_tools": ["js", "js_reset", "turn_ended"],
      "omit_tools_from": ["code_mode", "deferred"],
      "startup_timeout_sec": 120,
      "tools": {
        "js": { "output_token_limit": 25000 }
      }
    }
  }
}
```

Meaning of the MCP fields (Codex `RawMcpServerConfig`):

- `enabled: false` — do not start until the desktop rewrites this file.
- `enabled_tools` — allowlist. `node_repl` also implements `js_add_node_module_dir`; it never reaches the model on `cua_repl`.
- `omit_tools_from: ["code_mode", "deferred"]` — hide these tools from the code-mode host and the deferred executor. Code-mode computer-use instead attributes invocations to `mcpServerName: "node_repl"` (see `app.asar` `tne()`).
- `tools.js.output_token_limit: 25000` — Codex-side cap on `js` results.

Hooks in `plugin.json` fire the **same** MCP tool, not a shell:

| Hook | `session_id` interpolation |
|---|---|
| `Interrupt` | `${session_id}` |
| `Stop` | `${session_id}` |
| `SubagentStop` | `${agent_id}` (not session_id) |

Payload is always `{ hook_event_name, session_id, turn_id }` against `server: "cua_repl"`, `tool: "turn_ended"`.

### 1.2 `computer-use` (user-facing, version `1.0.1000968`)

| Path | Role |
|---|---|
| `.codex-plugin/plugin.json` | User-facing `interface` (Computer Use). `mcpServers` + `skills`. After install, desktop writes `bundledContentVariant: "node-repl"`. |
| `.mcp.json` | Native MCP: `./bin/computer-use-client-launcher mcp`, `env_vars: ["CODEX_HOME"]`. |
| `bin/computer-use-client-launcher` | 14-line `#!/bin/sh` that `exec`s `~/.codex/computer-use/Codex Computer Use.app/.../SkyComputerUseClient "$@"`. |
| `skills/computer-use/SKILL.md` | **Shipped** copy is confirmation-policy only (no `node_repl` bootstrap). |
| `.codex-plugin/computer-use-node-repl.md` | Alternate skill: `node_repl` + `globalThis.sky = (await import("@oai/sky")).sky`. |

Desktop `vte()` in `app.asar`: if `computerUseSkillVariant === "node-repl"`, copy `computer-use-node-repl.md` → `skills/computer-use/SKILL.md`. Observed on this machine in `~/.codex/.tmp/bundled-marketplaces/openai-bundled/plugins/computer-use/` (`bundledContentVariant: "node-repl"`, skill starts with “Use `node_repl` (JavaScript) for all Computer Use actions”).

That skill documents the **old** API (`sky.click({ app, element_index })`), not tinysky `cua.getApp()`. Unified-computer-use is the tinysky path.

The native `computer-use` MCP is **not** the `js` tool. It would expose SkyComputerUseClient’s own MCP methods. Live, it is off.

---

## 2. ChatGPT.app is the missing injector (`CUA_REPL_*` is not in the Codex binary)

`CUA_REPL_NODE_REPL_PATH` / `CUA_REPL_ENABLED_SURFACES` do **not** appear in `/Applications/ChatGPT.app/Contents/Resources/codex`. They appear in:

1. `launch.mjs` (the only reader)
2. `app.asar` function `Di()` (the writer)

`Di()` (minified, reconstructed):

```js
async function Di(e) {
  const plugin = findPlugin(e.marketplaces, /* n.uc */ "unified-computer-use");
  if (!plugin?.installed) return false;
  const enable = e.nodeRepl != null && e.surfaces.length > 0;
  const mcpPath = join(pluginCacheDir, ".mcp.json");
  const parsed = parse(mcpPath);               // schema: { mcpServers: { cua_repl: {} } }
  const c = parsed.mcpServers.cua_repl;
  c.enabled = enable;
  c.env_vars = e.nodeRepl?.env_vars ?? [];
  c.env = {
    ...e.nodeRepl?.env,
    CUA_REPL_NODE_REPL_PATH: e.nodeRepl?.command,          // cua_node/bin/node_repl
    CUA_REPL_ENABLED_SURFACES: e.surfaces.join(","),       // "browser,computer"
    BROWSER_USE_AVAILABLE_BACKENDS: e.browserBackends.join(","),
  };
  if (e.nodeRepl != null) {
    c.command = e.nodeRepl.env.NODE_REPL_NODE_PATH;        // cua_node/bin/node
    c.args = [join(pluginCacheDir, "scripts/launch.mjs")];
  }
  atomicWrite(mcpPath, parsed); // tmp-${uuid} then rename
  return enable;
}
```

Gating (`Zte()`): `features.browserUseTinysky && nodePath && nodeReplPath && mcpToolExposure && plugin installed+enabled+AVAILABLE && not WSL`.

Live rewritten file (this machine):

`/Users/dongdong/.codex/plugins/cache/openai-bundled/unified-computer-use/26.903.61454/.mcp.json`

Copy: `copies/unified-computer-use/.mcp.rewritten.json`.

`command` becomes the bundled Node, **not** `node_repl`. `node_repl` is only the child `launch.mjs` spawns.

`unified-computer-use` is listed in desktop plugin tables as `hidden: true` — it auto-installs and is not a picker tile. `computer-use` is the visible one (`installWhenMissingRequiresOptIn: true`).

---

## 3. `launch.mjs`: every env var

Source comment: `// ../../../project/cua/cua_repl/src/launch.ts`.

### 3.1 Variables `launch.mjs` **reads**

| Var | Required | Default | Effect |
|---|---|---|---|
| `CUA_REPL_NODE_REPL_PATH` | yes, must be an **absolute** path | none — throws `CUA_REPL_NODE_REPL_PATH must name an absolute executable` | `spawn(executable, [])` |
| `CUA_REPL_ENABLED_SURFACES` | no | `"browser,computer"` | comma list; each token must be `browser` or `computer`; empty set throws |

Unknown surface → `Unknown CUA_REPL_ENABLED_SURFACES value: …`.

Banner selection:

| browser | computer | file |
|---|---|---|
| true | true | `resources/banner.js` → `setupCUA({ browser: true, computer: true })` |
| true | false | `banner-browser.js` |
| false | true | `banner-computer.js` |

### 3.2 Variables `launch.mjs` **sets on the child** (overrides parent)

Child env is `{ ...process.env, ...overrides }` with `stdio: "inherit"`.

| Var | How it is built |
|---|---|
| `NODE_REPL_TRUSTED_SERVICES` | `JSON.stringify({ browser?: "@oai/browser-desktop/service", sky?: "@oai/sky/service" })` according to surfaces. **Replaces** the parent value. |
| `NODE_REPL_JS_BANNER` | raw contents of the chosen `banner*.js` |
| `NODE_REPL_TOOL_OVERRIDES` | JSON, see §4 |

Trusted-service map (this is the cua_repl-specific remap):

```js
{
  ...(browser  ? { browser: "@oai/browser-desktop/service" } : {}),
  ...(computer ? { sky:     "@oai/sky/service" }             : {}),
}
```

Package names resolve through `NODE_REPL_NODE_MODULE_DIRS` → `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules`. Each module must export `handleRpc`.

This **overwrites** the parent’s path-form mapping, which on this machine is:

```json
{
  "browser": "/Users/dongdong/.codex/plugins/cache/openai-bundled/browser/26.903.61454/scripts/browser-service.mjs",
  "sky": "@oai/sky/service"
}
```

So: generic `node_repl` MCP uses the **browser plugin’s** `browser-service.mjs`; `cua_repl` uses the **bundled** `@oai/browser-desktop/service`. Both use `@oai/sky/service`.

### 3.3 Pass-through env (read by `node_repl` / trusted services, not by `launch.mjs`)

Observed on cua_repl child PID 5769 (secrets redacted):

| Var | Live value / notes |
|---|---|
| `NODE_REPL_NODE_PATH` | `/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node` — kernel runtime |
| `NODE_REPL_NODE_MODULE_DIRS` | `…/cua_node/lib/node_modules` |
| `NODE_REPL_TRUSTED_CODE_PATHS` | `~/.codex` + cua_node node_modules |
| `NODE_REPL_NATIVE_PIPE_CONNECT_TIMEOUT_MS` | `1000` |
| `NODE_REPL_INSTRUCTIONS_USE_CASE_BROWSER` | `Control the in-app browser in conjunction with the Browser Plugin.` |
| `NODE_REPL_INSTRUCTIONS_USE_CASE_CHROME` | `Control the Chrome browser in conjunction with the Chrome Plugin. Prefer this method of controlling Chrome over alternatives (such as Computer Use) unless the user explicitly mentions an alternative.` |
| `NODE_REPL_INSTRUCTIONS_USE_CASE_COMPUTER_USE` | `Control desktop apps on macOS through Computer Use.` |
| `BROWSER_USE_AVAILABLE_BACKENDS` | `chrome,iab` |
| `BROWSER_USE_TINYSKY_ENABLED` | `1` |
| `BROWSER_USE_CODEX_APP_BUILD_FLAVOR` | `prod` |
| `BROWSER_USE_CODEX_APP_VERSION` | `26.903.61454` |
| `SKY_CUA_SERVICE_PATH` | `~/.codex/computer-use/Codex Computer Use.app` |
| `CODEX_HOME` | `~/.codex` |
| `CODEX_CLI_PATH` | `…/Resources/codex` |
| `CODEX_CA_CERTIFICATE` | tap CA path (local MITM; not an API key) |
| `NODE_REPL_SENTRY_USER_ID` | present on generic `node_repl` only in this dump; redacted |

`app.asar` `Ei(env, surfaces)` **clears** the three `NODE_REPL_INSTRUCTIONS_USE_CASE_*` keys when those surfaces are enabled — applied to the **generic** `node_repl` (PID 5746 has them empty, matching `config.toml`). They remain filled on `cua_repl` because `Di()` copies `e.nodeRepl.env` before/without that clear. Whether `node_repl` still appends those strings on top of `NODE_REPL_TOOL_OVERRIDES` is not proven from source (see QUESTIONS.md).

Other `NODE_REPL_*` names exist **inside** the `node_repl` binary but were unset on the live cua_repl child: `NODE_REPL_TRUSTED_RPC_ENABLED`, `NODE_REPL_RUNTIME_MODE`, `NODE_REPL_REQUEST_META`, `NODE_REPL_TRACE_META`, `NODE_REPL_ACTIVE_EXEC_REGISTRY_DIR`, `NODE_REPL_ENABLE_AUDIO`, `NODE_REPL_ENABLE_NETWORK_ISOLATION`, `NODE_REPL_UNTRUSTED_ENV_ALLOWLIST`, `NODE_REPL_DISABLE_ANALYTICS`, `NODE_REPL_DISABLE_STRICT_AUTO_REVIEW`, `NODE_REPL_FORCE_STRICT_AUTO_REVIEW`, `NODE_REPL_ENFORCE_MODEL_CHECK`.

### 3.4 Process behavior

- Forwards `SIGINT` / `SIGTERM` / `SIGHUP` to the child.
- On child `close`: if signaled, re-raises; else `exitCode = code >= 0 ? code : 1`.
- Does **not** parse MCP. Codex ↔ `node_repl` is byte-transparent through inherited stdio.

---

## 4. `NODE_REPL_TOOL_OVERRIDES` concatenation (the `js` description)

`launch.mjs` builds one JSON env var:

```js
NODE_REPL_TOOL_OVERRIDES = {
  server_instructions: serverInstructions.trim(),
  tools: {
    js: {
      description: [description, browserDescription, computerDescription, outputDescription].join("\n\n"),
      field_descriptions: {
        code: "JavaScript to execute using the initialized CUA runtime."
      }
    },
    js_reset: { description: resetDescription }
  }
}
```

File map:

| Slot | File | Disabled-surface substitute |
|---|---|---|
| `server_instructions` | `server-instructions.md` (`.trim()`) | — |
| `tools.js.description[0]` | `js-tool-description.md` | — |
| `tools.js.description[1]` | `browser-description.md` | `"Browser APIs are disabled."` |
| `tools.js.description[2]` | `computer-description.md` | `"Native computer APIs are disabled."` |
| `tools.js.description[3]` | `js-output-description.md` | — |
| `tools.js.field_descriptions.code` | hardcoded string | — |
| `tools.js_reset.description` | `js-reset.md` (raw, keeps trailing newline) | — |
| `turn_ended` | **not overridden** | stock `node_repl` text |

Join is **always four parts**, even when a surface is off — the stub sentence still occupies a slot.

Disabled-surface stubs are **not** used on this machine (`CUA_REPL_ENABLED_SURFACES=browser,computer`).

`node_repl` parses this as `{ server_instructions, tools: { name: { description, field_descriptions } } }`. Unknown keys log `unknown node_repl tool override`. `turn_ended` is omitted, so the model/hook schema stays the binary default:

- description: `Notify trusted libraries that a Codex turn ended. Repeated notifications for the same session and turn are ignored.`
- args: `hook_event_name`, `session_id`, `turn_id` (all non-empty; `minLength` on the event name)

Default (non-overridden) `js` description inside the binary is the generic persistent-REPL blurb (“Execute JavaScript in a persistent `node_repl` with top-level await…”). cua_repl **replaces** that entire string.

### 4.1 Exact `js.description` the live cua_repl child has

Observed `NODE_REPL_TOOL_OVERRIDES` on PID 5769 (whitespace is four markdown files joined with `"\n\n"`):

```
Control native apps or browsers on the user’s computer by reading or operating UI. Prefer purpose-built skills, connectors, APIs, or CLIs when available.

On your first call, or after a reset, execute exactly one of the API calls shown below, optionally assigning its result to a variable. Do not add other API calls, waits, or snapshots to that invocation.
The tool result will include documentation and, when creating or selecting a tab or selecting an app, its initial UI state. Selecting a browser does not open a tab. Read that result before continuing.
Use only APIs described in the tool instructions or returned documentation.

When you need an inventory of available apps, browsers, and tabs, get a snapshot of all enabled surfaces. Otherwise, use the relevant entry point below:

```javascript
await cua.getState();
```

<then browser-description.md>

<then computer-description.md>

<then js-output-description.md>
```

`js_reset` override text (from `js-reset.md`) names the tool `cua_repl.js`:

> Reset the persistent CUA JavaScript session. All JavaScript bindings are discarded. The next **cua_repl.js** call initializes a fresh runtime for the enabled surfaces. This does not close browser tabs or native apps, or erase their state.

`server_instructions` (MCP server instructions, not a tool):

> UI automation through a persistent JavaScript session using the initialized CUA API.

### 4.2 How `node_repl` applies the banner

Embedded `kernel.js`:

```js
const jsBanner = process.env.NODE_REPL_JS_BANNER;
delete process.env.NODE_REPL_JS_BANNER;   // hide from user JS
let jsBannerExecuted = false;
// on first js eval:
!jsBannerExecuted && jsBanner?.trim()
  ? `await (async () => {\n${jsBanner}\n})();\nimport.meta.__codexInternalMarkBannerExecuted();\n`
  : /* user code only */
```

So the model’s first `js` (and the first `js` after `js_reset`, which kills the kernel) actually runs `setupCUA(...)` **before** `code`. `@oai/cua/tinyskyAlt` assigns `globalThis.cua`.

`js_reset` stock description: `Reset the JavaScript kernel and clear all bindings.` Override replaces that with the CUA-specific paragraph above. It does **not** close tabs/apps.

---

## 5. The three model-facing tools

`node_repl` is an rmcp stdio server (`src/mcp_server.rs`). Tools from the binary:

| Tool | In `enabled_tools`? | Overridden? | Model-visible on cua_repl? |
|---|---|---|---|
| `js` | yes | description + `code` field text | yes |
| `js_reset` | yes | description | yes |
| `turn_ended` | yes | no | yes (also used by hooks) |
| `js_add_node_module_dir` | **no** | no | no on cua_repl |

### 5.1 `js`

Stock schema (binary strings): `code` (required, non-empty), optional `title` (“Short user-facing description of what the code does.”), optional `timeout_ms` (default 30000). Override only changes `code`’s field description.

Intercepted traces store `"name": "js"` with `{ code, title? }` — no `cua_repl.` / `mcp__` prefix. Codex special-cases server names `node_repl` and `cua_repl` (`app.asar` helper `Yg`: true iff the name is `node_repl` or `cua_repl`; feature `non_prefixed_mcp_tool_names`). Plugin MCP tools in general are documented as `mcp__server__tool`; these two servers are the exception.

`js` execution:

1. Optional banner (once per kernel).
2. User `code` in a persistent kernel with top-level await.
3. Bindings survive across calls until `js_reset` or sandbox change / timeout kill.
4. Output via `nodeRepl.write` / `nodeRepl.emitImage` (tinysky also auto-emits AX/docs unless `{ emit: false }`).

### 5.2 `js_reset`

Clears the kernel. Next `js` re-runs the banner (`setupCUA` again). Does not touch OS/browser state.

### 5.3 `turn_ended`

MCP tool, not a fake hook name. Binary:

- `turn_ended requires non-empty event, session, and turn IDs`
- Repeated (session, turn) notifications are ignored
- Forwards `TrustedServiceHooksRequestTurnEnded { hook_event_name, session_id, turn_id }` into trusted services
- Trusted worker replies `turn_ended_result`
- Timeouts: `turn-ended handlers timed out` / `turn-ended response channel closed`

Three **distinct** turn-end channels on this machine:

| Channel | Who calls | Who receives |
|---|---|---|
| MCP `cua_repl.turn_ended` | unified-computer-use hooks Interrupt/Stop/SubagentStop | cua_repl `node_repl` → trusted `browser` + `sky` |
| MCP `node_repl.turn_ended` | browser + chrome plugin hooks (same three events) | generic `node_repl` PID 5746 |
| Codex `notify` argv | Codex on turn complete (`config.toml` `notify = [SkyComputerUseClient, "turn-ended"]`) | native client, **not** MCP |

`browser.turn_ended` also exists as a connector-side name inside the Codex binary (`codex_apps` / `connector_openai_browser`). Separate from these.

---

## 6. Trusted services and native CUA

`node_repl` (`trusted-worker.js` / `src/trusted_process.rs`):

```js
const configuredServices = JSON.parse(process.env.NODE_REPL_TRUSTED_SERVICES);
// each value is a module specifier or absolute path
// module.handleRpc must be a function
```

cua_repl child (PID 5769):

```json
{ "browser": "@oai/browser-desktop/service", "sky": "@oai/sky/service" }
```

generic `node_repl` (PID 5746):

```json
{
  "browser": "/Users/dongdong/.codex/plugins/cache/openai-bundled/browser/26.903.61454/scripts/browser-service.mjs",
  "sky": "@oai/sky/service"
}
```

`@oai/sky/service` → `handleRpc` in `…/@oai/sky/dist/project/cua/sky_js/src/service.js`. Methods `setup` / `execute` / drag-handle RPCs.

Mac transport (`native-pipe.js`):

1. Connect `nodeRepl.nativePipe` to `SKY_CUA_SERVICE_NATIVE_PIPE_PATH`, else `~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock`.
2. On failure, JSON-RPC `ensureService { service: "computer-use" }` over `NODE_REPL_HOST_SERVICES_PIPE_PATH`, or `launchServices.openApplication` using `SKY_CUA_SERVICE_PATH` / `CODEX_HOME/computer-use/Codex Computer Use.app` / bundle id `com.openai.sky.CUAService`.
3. Framed JSON-RPC to `SkyComputerUseService`.

Live: `SkyComputerUseService` PID 3802 parent is **ChatGPT.app** (3579), not the plugin launcher. The plugin MCP (`SkyComputerUseClient mcp`) is unused. Desktop + sky service start the native app; `js`/`cua.*`/`sky.*` call into it over the pipe.

Browser surface: tinysky `create_tinysky_alt.js` dynamically imports `oai_js_browser/.../browser-client.js` when `setupCUA({ browser: true })`. That is the in-process client talking to `@oai/browser-desktop/service` (IAB + Chrome extension / CDP).

Nested process: cua_repl `node_repl` PID 5769 spawned `/Applications/ChatGPT.app/Contents/Resources/codex app-server --listen stdio://` (PID 7250). That is the trusted-RPC / approvals helper (`codex app-server stdout is unavailable` lives in the same binary). It is **not** the main app-server (PID 3632).

---

## 7. `~/.codex/config.toml` (redacted) — how this machine is actually wired

Relevant bits only. No tokens in these stanzas.

```toml
notify = [
    "/Users/dongdong/.codex/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient",
    "turn-ended",
]

[plugins."computer-use@openai-bundled"]
enabled = true

[plugins."unified-computer-use@openai-bundled"]
enabled = true

[plugins."browser@openai-bundled"]
enabled = true

[plugins."chrome@openai-bundled"]
enabled = true

[features]
hooks = true
js_repl = false          # built-in Codex js_repl feature OFF; MCP supplies js

[mcp_servers.node_repl]
args = []
command = "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node_repl"
startup_timeout_sec = 120

[mcp_servers.node_repl.env]
NODE_REPL_NATIVE_PIPE_CONNECT_TIMEOUT_MS = "1000"
NODE_REPL_NODE_MODULE_DIRS = "/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules"
NODE_REPL_NODE_PATH = "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node"
NODE_REPL_TRUSTED_CODE_PATHS = "/Users/dongdong/.codex:/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules"
CODEX_HOME = "/Users/dongdong/.codex"
BROWSER_USE_AVAILABLE_BACKENDS = "chrome,iab"
BROWSER_USE_TINYSKY_ENABLED = "1"
NODE_REPL_INSTRUCTIONS_USE_CASE_BROWSER = ""
NODE_REPL_INSTRUCTIONS_USE_CASE_CHROME = ""
NODE_REPL_INSTRUCTIONS_USE_CASE_COMPUTER_USE = ""
BROWSER_USE_CODEX_APP_BUILD_FLAVOR = "prod"
BROWSER_USE_CODEX_APP_VERSION = "26.903.61454"
NODE_REPL_TRUSTED_SERVICES = '{"browser":"<browser-plugin>/scripts/browser-service.mjs","sky":"@oai/sky/service"}'
SKY_CUA_SERVICE_PATH = "/Users/dongdong/.codex/computer-use/Codex Computer Use.app"
CODEX_CLI_PATH = "/Applications/ChatGPT.app/Contents/Resources/codex"

[mcp_servers.computer-use]
command = "./Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient"
args = ["mcp"]
cwd = "."
enabled = false
```

Implications:

- `features.js_repl = false` does **not** stop `mcp_servers.node_repl` or plugin `cua_repl`. It only disables the first-party js_repl feature (`js_repl_node_path` / `js_repl_tools_only` in `ConfigToml`).
- User-level `[mcp_servers.computer-use] enabled = false` collides with the plugin server of the same name. Live: no `computer-use-client-launcher`, no `SkyComputerUseClient`. Native CUA still runs via the service ChatGPT.app launched.
- `notify` `turn-ended` is the native client argv, distinct from MCP `turn_ended`.
- Generic `node_repl` is **explicitly** configured and **is running** next to `cua_repl`. Browser/Chrome hooks target **that** server.

Main Codex process (PID 3632) is spawned by ChatGPT.app as:

`codex -c features.code_mode_host=true app-server … -c mcp_servers.codex_app={…}`

`CODEX_MCP_NODE_PATH` on the Electron parent is the same bundled Node.

---

## 8. Two stacks, one model tool name

| | Unified tinysky (`cua_repl`) | Legacy (`node_repl` + computer-use skill) |
|---|---|---|
| MCP server name | `cua_repl` | `node_repl` (and optionally `computer-use`) |
| Who starts it | plugin `.mcp.json` after `Di()` rewrite | `config.toml` `[mcp_servers.node_repl]` |
| Wrapper | `launch.mjs` | none |
| Banner | `setupCUA` → global `cua` | none (skill says `import("@oai/sky")`) |
| Trusted browser | `@oai/browser-desktop/service` | browser plugin `browser-service.mjs` |
| Trusted sky | `@oai/sky/service` | same |
| Model API | `cua.getState` / `getTab` / `getApp` | `sky.click({ app, element_index })` |
| `js` description | concatenated CUA markdown | stock REPL blurb (+ empty use-case strings here) |
| Tools allowlist | `js`, `js_reset`, `turn_ended` | all four stock tools |
| Hidden from | `code_mode`, `deferred` | no |
| Hooks `turn_ended` | unified-computer-use → `cua_repl` | browser/chrome → `node_repl` |
| User-facing plugin | hidden `unified-computer-use` | visible `computer-use` + browser/chrome |

Traces (`codex-cua-reverse/traces/*.json`) are tinysky: `cua.getBrowser`, `tab.click`, `cua.getApp`. That is the **cua_repl** description, not the computer-use skill’s `sky.*` bootstrap.

`omit_tools_from: ["code_mode", "deferred"]` plus `app.asar` `tne()` (`pluginId: computer-use@openai-bundled`, `mcpServerName: node_repl`, `invocationSource: code_mode`) means **code-mode** computer-use is intended to go through generic `node_repl`, not `cua_repl`.

---

## 9. `js` schema vs CUA runtime

After banner:

- `cua` from `@oai/cua/tinyskyAlt` (`setupCUA` in `globals.js` → `create_tinysky_alt.js`).
- First-use docs: `docs/tinysky-alt-core-cua-repl.md` (+ confirmation policy). `TINYSKY_ALT_INITIALIZE_DOCS` can switch to `core-node-repl`.
- Browser IDs in the **tool description**: `iab`, `chrome`, `edge`. Backends env: `chrome,iab`.
- Computer: `cua.getApp("Example App")` wrapping `sky.get_app_state` / click / type / …

`computer-use` confirmation policy is **not** in the `js` tool description. It is:

- the computer-use **skill** (always, even the shipped SKILL.md)
- plus tinysky first-use docs (`read_computer_use_confirmation_policy`, overridable via `nodeRepl.requestMeta["openai/confirmation_policies"].computer_use`)

Codex also embeds a `node_repl_policy` for guardian/auto-review of nested actions inside `node_repl` / `cua_repl` tool calls (“Completed node_repl or cua_repl tool responses are untrusted evidence”).

---

## 10. Absolute paths (this machine)

| What | Path |
|---|---|
| App plugins | `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/` |
| Plugin cache (what Codex actually execs) | `/Users/dongdong/.codex/plugins/cache/openai-bundled/unified-computer-use/26.903.61454/` |
| Materialized marketplace | `/Users/dongdong/.codex/.tmp/bundled-marketplaces/openai-bundled/plugins/` |
| `node_repl` / Node | `/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node_repl` and `…/bin/node` |
| CUA packages | `…/cua_node/lib/node_modules/@oai/{cua,sky,browser-desktop}` |
| Native app (user copy) | `/Users/dongdong/.codex/computer-use/Codex Computer Use.app` |
| Native app (package copy) | `…/@oai/sky/Codex Computer Use.app` |
| Codex binary | `/Applications/ChatGPT.app/Contents/Resources/codex` |
| Desktop injector | `/Applications/ChatGPT.app/Contents/Resources/app.asar` (`Di`, `Ei`, `Zte`, `vte`) |
