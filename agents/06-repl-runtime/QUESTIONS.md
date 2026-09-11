# Open questions

## Launch / config

1. **When does Electron flip `cua_repl.enabled` to true?** `Di()` in `app.asar` rewrites the plugin `.mcp.json`. The copy under `~/.codex/.tmp/bundled-marketplaces/…/unified-computer-use/.mcp.json` was still `"enabled": false` while `[mcp_servers.node_repl]` was fully populated. Is cua_repl only enabled for a subset of threads / feature flags (`BROWSER_USE_TINYSKY_ENABLED`)?
2. **Two MCP servers at once.** Live config has `mcp_servers.node_repl` (direct binary, no banner) *and* the unified-computer-use plugin (banner + `cua`). Which one served the captured `js` traces? Traces use `cua.getBrowser` → tinysky → almost certainly cua_repl, but the tool name in the wire log is just `js`.
3. **`NODE_REPL_TOOL_OVERRIDES` merge rules.** Does override replace the entire default `js` description, or only listed fields? cua_repl sets `field_descriptions.code` and a long `description`; default still documents `timeout_ms` / `js_add_node_module_dir`. Is `timeout_ms` still in the schema the model sees?
4. **`js_add_node_module_dir` visibility.** Built into `node_repl`, omitted from cua_repl `enabled_tools`. Can the host still call it internally?

## Kernel

5. **Working directory / session-id.** Kernel requires `--working-dir` and `--session-id`. What path does ChatGPT pass (workspace vs `CODEX_HOME` vs tmp)? Session-id is also the salt for internal binding names.
6. **Does `js_reset` restart the trusted worker** or only the untrusted kernel? Bindings die; Sky/browser sessions are documented to survive. Worker `handlers` Map would drop if the worker dies.
7. **Exec timeout vs `withSuspendedTimeout`.** Default 30s. Trusted code can `nodeRepl.withSuspendedTimeout`. User JS cannot (method not on untrusted bridge). What happens on timeout (`js execution timed out; kernel reset`)?
8. **`named_outputs` presentation.** Kernel returns `{output, named_outputs: [...values]}` (values only, Map order). How does Codex/ChatGPT show `cua.core` vs `cua.state` vs default `write` to the model? Are item ids preserved?
9. **Redacted source.** Each exec sends `exec_redacted_source` (identifiers → `idN`, strings wiped). Who consumes it (auto-review, telemetry)? `NODE_REPL_DISABLE_STRICT_AUTO_REVIEW` suggests a reviewer model.

## Globals / API

10. **`globalThis.agent`.** Tinysky sets it to the raw browser runtime. Not in the skill docs. Intentional escape hatch or leftover?
11. **`tools` global.** Confirmed absent here. Is it injected only when `features.js_repl` or `code_mode` is on? cua_repl is `omit_tools_from: ["code_mode","deferred"]`.
12. **`cua.initialize` vs first-call policy.** Docs disagree. Does any production prompt still require `initialize()`? Traces did not.
13. **Older `@oai/cua` `cua.js` `initialize`.** Still exported as package main. Anything still imports `@oai/cua` instead of `@oai/cua/tinyskyAlt`?

## Trusted services

14. **`@oai/cdp-browser-backend` 0.4.2** is in `.package-map.json` but not extracted under `lib/node_modules/@oai/`. Dead reference?
15. **Browser service `environment`.** Client defaults `environment: "codex-app"`. Service rejects anything except `codex-app|training|cloud`. Is `training` used on-device?
16. **`NODE_REPL_TRUSTED_CODE_PATHS` includes `CODEX_HOME`.** That lets the trusted worker load cached plugin scripts (`…/plugins/cache/openai-bundled/browser/…/browser-service.mjs` in live config) in addition to `cua_node` modules. How is that cache invalidated vs app updates (`26.903.61454`)?
17. **Native pipe vs Computer Use.app process lifetime.** Who starts SkyComputerUseService — Electron, `SKY_CUA_SERVICE_PATH`, or first `sky` RPC? `notify = [SkyComputerUseClient, "turn-ended"]` in config.toml.

## Host binary

18. **`--disable-sandbox`.** Help text: start kernel directly even when `CODEX_CLI_PATH` is set. Desktop always sets `CODEX_CLI_PATH` to `Resources/codex`. Is the kernel landlocked via `codex` on Mac, or is sandbox mostly Linux/Windows?
19. **Sentry / Statsig.** Binary has a Sentry DSN (`NODE_REPL_DISABLE_ANALYTICS`) and sky has a Statsig client. What events fire per `js` call (`codex/nodeReplExecutionDurationMs`, `CodexComputerUseMcpServerLaunched`)?
20. **`node_repl is unavailable for this model`.** Which models are gated? `NODE_REPL_ENFORCE_MODEL_CHECK`.

## Not inspected (out of this agent’s attack surface, still relevant)

- Full `app.asar` module that builds `Yv()` / `Eo()` (runtime path resolution) — only string windows.
- `repl_manager.rs` control flow for kernel spawn (sandbox-exec argv).
- Playwright transport inside browser-service (1.3MB minified).
- Whether `fetch` in the **untrusted** context is the real Node fetch (it is installed on the vm) and whether the sandbox allows it.
