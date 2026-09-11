# Open questions

Items below are **not** established from the files and live processes this agent read. None of them change the verdict that `js` / `js_reset` / `turn_ended` are `node_repl` MCP tools redecorated by `unified-computer-use`.

## Dual `js` exposure

1. Both `mcp_servers.node_repl` (PID 5746, stock description) and `cua_repl` (PID 5769, CUA override) are running. Traces only show unprefixed `"name": "js"`. Does Codex:
   - hide generic `node_repl` tools when `cua_repl` is enabled,
   - emit both as `js` vs `mcp__node_repl__js`,
   - or last-writer-wins on the unprefixed name?
2. `js-reset.md` says “the next **cua_repl.js** call”. Intercepts say `js`. Is `cua_repl.js` a docs-only alias, a code-mode identifier, or a leftover from prefixed MCP names?
3. `enabled_tools` on `cua_repl` drops `js_add_node_module_dir`. Is that tool still on the generic `node_repl` server the model can see?

## `NODE_REPL_INSTRUCTIONS_USE_CASE_*`

4. cua_repl inherits filled Browser/Chrome/Computer Use use-case strings; generic `node_repl` has them cleared (`Ei()` + empty `config.toml`). Does `node_repl` **append** those strings to `js.description` even when `NODE_REPL_TOOL_OVERRIDES` already replaced the description? Live override JSON did **not** contain those sentences, which suggests append happens elsewhere (or not at all on the override path).
5. What is the exact format `node_repl` expects for those three vars (plain sentence vs markdown vs tool-instruction block)?

## `turn_ended` fan-out

6. On Stop/Interrupt, unified hooks hit `cua_repl.turn_ended` and browser/chrome hooks hit `node_repl.turn_ended`. Are both delivered every turn? Does each trusted-service set (`@oai/browser-desktop/service` vs plugin `browser-service.mjs`) get a hook, and is double-close of tabs a real risk?
7. What does `@oai/sky/service` / `@oai/browser-desktop/service` **do** with `turn_ended` (release claimed tabs, drop PiP, mark handoff, flush AX)? Only the envelope is visible: `{ hook_event_name, session_id, turn_id }` and “repeated notifications for the same session and turn are ignored.”
8. Codex `notify = [SkyComputerUseClient, "turn-ended"]` vs MCP `turn_ended` vs `browser.turn_ended` / `codex_turn_ended` in the Codex binary: which of these is required for native PiP / lock-screen guardian, and which is optional?
9. SubagentStop passes `session_id: "${agent_id}"`. Do trusted services treat `agent_id` as a session key, or do they ignore subagent notifications that do not match the parent session id?

## Computer-use plugin MCP vs skill

10. User `mcp_servers.computer-use.enabled = false` and no live `SkyComputerUseClient` MCP. Is that because user config wins the duplicate name, because `bundledContentVariant: "node-repl"` disables the native MCP, or because Codex skips plugin MCP when the name already exists?
11. If native `computer-use` MCP were enabled, would the model see SkyComputerUseClient tools **in addition to** `js`? Skill text forbids anything but `node_repl` for UI, but MCP tools would still be listed unless `enabled_tools` / `disabled_tools` say otherwise (plugin `.mcp.json` has neither).
12. `computerUseSkillVariant` values besides `"node-repl"` and `"legacy-mcp"` are not enumerated in the extracted `app.asar` slice. What is the default when the feature flag `computerUseNodeRepl` is off?

## Banner / kernel

13. `NODE_REPL_JS_BANNER` is prepended only until `__codexInternalMarkBannerExecuted`. Is that mark per-kernel (so `js_reset` re-runs `setupCUA`, which we believe) or process-global?
14. If the model’s first `js` `code` is already `await cua.getState()` as instructed, the banner still wraps `setupCUA` in an outer async IIFE **before** that code. Any failure mode if the user code also calls `setupCUA`? (`globals.js` caches the setup promise in `i`, so a second call should no-op — not confirmed from a live eval.)
15. `delete process.env.NODE_REPL_JS_BANNER` happens in the kernel. Does the parent `launch.mjs` process keep the original env (yes, it never deletes it)? Could a later spawn from the same wrapper reuse a banner-less child? `launch.mjs` spawns once.

## Tool-override parser

16. Binary strings mention `omit` next to `server_instructions` / `description` / `field_descriptions`. Can `NODE_REPL_TOOL_OVERRIDES` omit stock tools, or is omission only via MCP `enabled_tools`?
17. Does override merge or replace nested maps? Live JSON replaces `js.description` entirely (no leftover “top-level await / playwright” stock text). Unclear whether `title` / `timeout_ms` field descriptions can be overridden; `launch.mjs` only sets `code`.
18. `unknown node_repl tool override` — exact allowed tool names besides `js`, `js_reset`, `js_add_node_module_dir`, `turn_ended`?

## Code mode / deferred

19. `omit_tools_from: ["code_mode", "deferred"]` on `cua_repl`. In code-mode, `tne()` attributes computer-use to `mcpServerName: "node_repl"`. Does that mean code-mode JS is the **generic** `node_repl` (no `setupCUA` banner, skill says `import("@oai/sky")`), while the outer agent uses tinysky `cua_repl`?
20. What is `deferred` as an omit target (deferred tool world-state / tool_search)? Are `js` results then only reachable via tool-search?

## Desktop rewrite durability

21. `Di()` atomically rewrites **plugin cache** `.mcp.json`. The app-bundle and `.tmp/bundled-marketplaces` copies stay `enabled: false`. If Codex starts without ChatGPT.app (CLI), does `cua_repl` stay disabled unless the cache was left enabled from a previous GUI session? The cache on this machine is currently `enabled: true`.
22. `c.command = e.nodeRepl.env.NODE_REPL_NODE_PATH` (bundled Node), not `process.execPath`. Is there a Windows/WSL branch that keeps `command: "node"`?

## Prefixing / features

23. `features.js_repl = false` — confirm this only gates the first-party js_repl feature and never the MCP servers (live processes say MCP still starts; want the exact feature-flag table).
24. `non_prefixed_mcp_tool_names` is a Codex feature flag. Is it on in desktop `code_mode_host` app-server, or is unprefixed `js` a separate hard-coded special case for `node_repl`/`cua_repl` (`Yg`)?
25. Guardian `node_repl_policy` text treats `node_repl` and `cua_repl` as equivalent nested-tool sandboxes. Does auto-review attach to unprefixed `js` or to the MCP server name?

## Trusted RPC / nested app-server

26. cua_repl `node_repl` spawns `codex app-server --listen stdio://` (PID 7250). Is that always-on for approvals (`JavaScript execution requires an approval elicitation`) or only when `NODE_REPL_TRUSTED_RPC_ENABLED=1` (unset on the child)?
27. `SKY_CUA_SERVICE_NATIVE_PIPE_PATH` / `NODE_REPL_HOST_SERVICES_PIPE_PATH` were unset; sky fell through to the Group Container sock + `SKY_CUA_SERVICE_PATH`. Is that the production path on macOS desktop, or did we miss a pipe ChatGPT.app sets on a different process?

## Surfaces

28. Who computes `e.surfaces` for `Di()` (`browser`, `computer`)? Likely desktop features `inAppBrowserUse` / `externalBrowserUse` / `computerUse` / `browserUseTinysky`, but the call site was not fully decompiled.
29. If the user disables Computer Use in settings but leaves Browser on, does `CUA_REPL_ENABLED_SURFACES` become `browser` only (computer stub sentence in `js.description`, `banner-browser.js`, no `sky` trusted service)? Inverse for computer-only?

## Not in scope / not pursued

- Contents of `SkyComputerUseClient mcp` tool list (process not running; would require spawning the native MCP).
- Full `kernel.js` / `trusted-worker.js` sources (embedded in the Mach-O; only strings extracted).
- Whether `omit_tools_from` is honored by the current desktop `features.code_mode_host=true` app-server.
