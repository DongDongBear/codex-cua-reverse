# File index — cua_node / node_repl / cua_repl

Inspected locally. No source for the Rust `node_repl` crate; JS kernel is embedded in the binary.

## This agent’s copies

| Path | What |
|---|---|
| `agents/06-repl-runtime/FINDINGS.md` | Verdict + runtime trace |
| `agents/06-repl-runtime/FILE_INDEX.md` | This list |
| `agents/06-repl-runtime/QUESTIONS.md` | Open items |
| `agents/06-repl-runtime/scripts/launch.mjs` | Copy of cua_repl launcher |
| `agents/06-repl-runtime/scripts/banner.js` | Both surfaces |
| `agents/06-repl-runtime/scripts/banner-browser.js` | Browser only |
| `agents/06-repl-runtime/scripts/banner-computer.js` | Computer only |

## Archive root

| Path | Role |
|---|---|
| `/Applications/ChatGPT.app/Contents/Resources/cua_node/manifest.json` | darwin-arm64, **node 24.20.0**, runtime `0.0.11/20260902191201-81d486bd9181`, `node_repl_path` |
| `/Applications/ChatGPT.app/Contents/Resources/cua_node/LICENSE` | Node.js license (the `bin/node` distribution) |
| `/Applications/ChatGPT.app/Contents/Resources/owl-electron-app.json` | packager metadata (`runtimeName: owl`) |

## `cua_node/bin`

| Path | Type | Notes |
|---|---|---|
| `…/cua_node/bin/node` | Mach-O arm64 116M | Node **v24.20.0** |
| `…/cua_node/bin/node_repl` | Mach-O arm64 18M | Rust MCP `node_repl@0.1.0`; embeds kernel JS |
| `…/cua_node/bin/npm` | sh | wrapper → archive `node` + `lib/node_modules/npm` |
| `…/cua_node/bin/npx` | sh | same |
| `…/cua_node/bin/corepack` | sh | same |
| `…/cua_node/bin/setup.sh` | bash | validates node version, `@oai/sky`, `node_repl --help` |
| `…/cua_node/bin/setup.ps1` | ps1 | Windows twin |

Embedded filenames inside `node_repl`: `kernel.js`, `trusted-worker.js`, `worker-runtime.js`, `privileged-node-repl.js`, `privileged-node-repl-config.js`, `diagnostics.js`, `tracing.js`, `realmChecks.js`, `meriyah.umd.min.js`. Rust: `src/mcp_server.rs`, `src/repl_manager.rs`, `src/trusted_process.rs`, `src/active_exec_registry.rs`, `src/native_pipe.rs`, `src/authenticated_fetch.rs`, `src/launch_services.rs`, `src/computer_use.rs`, `src/config_manager.rs`, `src/sandbox_state.rs`, `src/browser_gaas_config.rs`, `src/codex_app_server.rs`.

## `@oai/cua` (tinysky)

| Path | Role |
|---|---|
| `…/lib/node_modules/@oai/cua/package.json` | 0.2.4; exports `.` and `./tinyskyAlt` |
| `…/dist/lib/js/oai_js_cua/src/index.js` | re-exports older `cua` |
| `…/dist/lib/js/oai_js_cua/src/cua.js` | older `cua.initialize` (browser-client + sky + get_state) |
| `…/dist/lib/js/oai_js_cua/src/cua.d.ts` | types for older API |
| `…/dist/lib/js/oai_js_cua/src/get_state.js` | inventory: `list_apps` + browsers/tabs |
| `…/dist/lib/js/oai_js_cua/src/tinysky_alt/globals.js` | **`setupCUA` + global `cua` + `initialize()`** |
| `…/dist/lib/js/oai_js_cua/src/tinysky_alt/globals.d.ts` | `setupCUA(options?: {browser?, computer?})` |
| `…/dist/lib/js/oai_js_cua/src/tinysky_alt/create_tinysky_alt.js` | providers, `write`/`emitImage`, `globalThis.agent` |
| `…/dist/lib/js/oai_js_cua/src/tinysky_alt/create_tinysky_alt.d.ts` | `Omit<TinySkyAlt,"initialize">` |
| `…/dist/lib/js/oai_js_cua/src/tinysky_alt/types.d.ts` | full tinysky API |
| `…/dist/lib/js/oai_js_cua/src/tinysky_alt/documentation.js` | reads `docs/tinysky-alt-*.md`; confirmation policy from `nodeRepl.requestMeta` |
| `…/docs/tinysky-alt-core-node-repl.md` | skill: `node_repl`, `cua.initialize()`, write/emitImage |
| `…/docs/tinysky-alt-core-cua-repl.md` | skill: `cua_repl`, `getState()`, no initialize on type |
| `…/docs/tinysky-alt-confirmations.md` | CU confirmation policy |
| `…/docs/tinysky-alt-other-browser-apis.md` | extra browser APIs |

Copies also at `codex-cua-reverse/vendor/cua/`.

## `@oai/sky`

| Path | Role |
|---|---|
| `…/@oai/sky/package.json` | 0.6.26; `./service` |
| `…/dist/project/cua/sky_js/src/index.js` | `export { sky }` |
| `…/dist/project/cua/sky_js/src/sky.js` | Proxy: `nodeRepl.rpc("sky", …)` or local client |
| `…/dist/project/cua/sky_js/src/service.js` | **`export { handleRpc }`** trusted worker |
| `…/dist/project/cua/sky_js/src/service.d.ts` | `setup` / `execute` / `drag_*` |
| `…/dist/project/cua/sky_js/src/create_client.js` | mac/linux/windows dispatch |
| `…/dist/project/cua/sky_js/src/load_options.js` | `OAI_SKY_CONFIG_PATH` or `process.platform` |
| `…/targets/mac/native-pipe.js` | `nodeRepl.nativePipe` → CUAService socket |
| `…/targets/mac/computer-use-telemetry.js` | Statsig (client key not copied) |
| `…/targets/windows/internal/codex_turn_metadata.js` | `NODE_REPL_REQUEST_META` |
| `…/@oai/sky/Codex Computer Use.app/` | native AX / screenshot host |
| `…/@oai/sky/docs/skills/oai_sky_lib/macos/SKILL.md` | `globalThis.sky = (await import("@oai/sky")).sky` |

## `@oai/browser-desktop`

| Path | Role |
|---|---|
| `…/@oai/browser-desktop/package.json` | 0.1.1; `.` = client, `./service` = service |
| `…/scripts/browser-client.mjs` | `setupBrowserRuntime`; uses `nodeRepl.rpc("browser",{method,params})` |
| `…/scripts/browser-service.mjs` | **`export { handleRpc }`**; setup/execute; privileged nodeRepl required |
| `…/docs/*.md` | browser-use skill docs (also duplicated under plugins/browser, plugins/chrome) |

## Unified Computer Use plugin (cua_repl)

| Path | Role |
|---|---|
| `…/plugins/openai-bundled/plugins/unified-computer-use/.mcp.json` | MCP server `cua_repl`; tools js/js_reset/turn_ended; `enabled: false` in the shipped file |
| `…/unified-computer-use/.codex-plugin/plugin.json` | hooks Interrupt/Stop/SubagentStop → `turn_ended`; version `26.903.61454` |
| `…/unified-computer-use/scripts/launch.mjs` | **cua_repl entry**; source comment `project/cua/cua_repl/src/launch.ts` |
| `…/resources/banner.js` | `setupCUA({browser:true, computer:true})` |
| `…/resources/banner-browser.js` | browser only |
| `…/resources/banner-computer.js` | computer only |
| `…/resources/js-tool-description.md` | first-call protocol (`getState` / entry points) |
| `…/resources/browser-description.md` | getBrowser / getTab / createBrowserTab |
| `…/resources/computer-description.md` | getApp |
| `…/resources/js-output-description.md` | write / emitImage; don’t double-wrap |
| `…/resources/js-reset.md` | reset semantics (`cua_repl.js`) |
| `…/resources/server-instructions.md` | one-line MCP server instructions |

Vendor copies: `codex-cua-reverse/vendor/plugins/unified-computer-use/`.

## Computer-use plugin (legacy / parallel)

| Path | Role |
|---|---|
| `…/plugins/computer-use/skills/computer-use/SKILL.md` | confirmations; no JS banner |
| `codex-cua-reverse/vendor/plugins/computer-use/computer-use-node-repl.md` | **`globalThis.sky = (await import("@oai/sky")).sky`**; `nodeRepl.write` / `emitImage` |

## Electron / Codex host

| Path | Role |
|---|---|
| `/Applications/ChatGPT.app/Contents/Resources/app.asar` | writes `mcp_servers.node_repl` env; patches cua_repl `.mcp.json` with `CUA_REPL_NODE_REPL_PATH`, `CUA_REPL_ENABLED_SURFACES`; resolves `cua_node` + Computer Use.app |
| `/Applications/ChatGPT.app/Contents/Resources/codex` | 220M rust CLI; strings about untrusted `node_repl`/`cua_repl` tool results |
| `/Applications/ChatGPT.app/Contents/MacOS/ChatGPT` | tiny stub; no CUA strings |

## Live user config (read, not copied)

| Path | Role |
|---|---|
| `/Users/dongdong/.codex/config.toml` | `[mcp_servers.node_repl]` + plugin enablement. **Do not copy secrets.** |
| `/Users/dongdong/.codex/.tmp/bundled-marketplaces/openai-bundled/plugins/unified-computer-use/.mcp.json` | Electron-managed copy; still `enabled: false` on disk at inspect time |

## Traces / prior notes

| Path | Role |
|---|---|
| `codex-cua-reverse/ARCHITECTURE.md` | high-level wiring (matches this agent) |
| `codex-cua-reverse/API.md` | `cua.*` / `sky.*` / `js` schema |
| `codex-cua-reverse/TRACES.md` | task mapping |
| `codex-cua-reverse/traces/all-js-calls.json` | first call = `cua.getBrowser`, later cells reuse `browser`/`tab` |

## Temp extracts (not in repo)

Kernel JS was dumped to `/tmp/node_repl_kernel.js` (~88KB before meriyah) and `/tmp/node_repl_trusted_worker.js` during this pass. Not copied (large, concatenated). Re-extract from `bin/node_repl` if needed: search for `// vm contexts start with very few globals` and `const configuredServices = JSON.parse(process.env.NODE_REPL_TRUSTED_SERVICES)`.
