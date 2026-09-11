# File index

Paths are absolute. Copies live under `copies/`.

## This agent’s outputs

| File | What it is |
|---|---|
| `/Users/dongdong/Desktop/codex-cua-reverse/agents/04-plugin-wiring/FINDINGS.md` | Verdict, env-var trace, tool wiring, sequence diagram |
| `/Users/dongdong/Desktop/codex-cua-reverse/agents/04-plugin-wiring/FILE_INDEX.md` | This list |
| `/Users/dongdong/Desktop/codex-cua-reverse/agents/04-plugin-wiring/QUESTIONS.md` | Open questions |

## Copies (required)

### unified-computer-use

| Copy | Source |
|---|---|
| `copies/unified-computer-use/launch.mjs` | `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/unified-computer-use/scripts/launch.mjs` |
| `copies/unified-computer-use/.mcp.json` | same plugin, **shipped** `.mcp.json` (`enabled: false`, `command: "node"`) |
| `copies/unified-computer-use/.mcp.rewritten.json` | `/Users/dongdong/.codex/plugins/cache/openai-bundled/unified-computer-use/26.903.61454/.mcp.json` (ChatGPT.app `Di()` rewrite, `enabled: true`) |
| `copies/unified-computer-use/plugin.json` | `…/unified-computer-use/.codex-plugin/plugin.json` |
| `copies/unified-computer-use/resources/*.md` | `js-tool-description.md`, `browser-description.md`, `computer-description.md`, `js-output-description.md`, `js-reset.md`, `server-instructions.md` |
| `copies/unified-computer-use/resources/banner*.js` | `banner.js`, `banner-browser.js`, `banner-computer.js` (not in the “\*.md” requirement; needed to explain `NODE_REPL_JS_BANNER`) |

### computer-use

| Copy | Source |
|---|---|
| `copies/computer-use/.mcp.json` | `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/.mcp.json` |
| `copies/computer-use/plugin.json` | `…/computer-use/.codex-plugin/plugin.json` (app-bundle original) |
| `copies/computer-use/plugin.installed.json` | `~/.codex/.tmp/bundled-marketplaces/…/computer-use/.codex-plugin/plugin.json` (`bundledContentVariant: "node-repl"`) |
| `copies/computer-use/SKILL.md` | app-bundle skill (confirmation policy only) |
| `copies/computer-use/SKILL.installed-node-repl.md` | materialized skill after desktop copy of `computer-use-node-repl.md` |
| `copies/computer-use/computer-use-node-repl.md` | `…/computer-use/.codex-plugin/computer-use-node-repl.md` |
| `copies/computer-use/computer-use-client-launcher` | `…/computer-use/bin/computer-use-client-launcher` |

---

## Read: unified-computer-use (every file)

| Path | Why |
|---|---|
| `…/unified-computer-use/.mcp.json` | shipped MCP server `cua_repl`; `enabled_tools` / `omit_tools_from` / `output_token_limit` |
| `…/unified-computer-use/.codex-plugin/plugin.json` | hooks → `cua_repl.turn_ended`; `mcpServers` pointer; hidden plugin metadata |
| `…/unified-computer-use/scripts/launch.mjs` | **only** `CUA_REPL_*` reader; builds `NODE_REPL_TOOL_OVERRIDES` / `JS_BANNER` / `TRUSTED_SERVICES` |
| `…/resources/banner.js` | `setupCUA({ browser: true, computer: true })` |
| `…/resources/banner-browser.js` | browser-only banner |
| `…/resources/banner-computer.js` | computer-only banner |
| `…/resources/js-tool-description.md` | first slice of `js.description` |
| `…/resources/browser-description.md` | second slice (`getTab` / `createBrowserTab` / `getBrowser`) |
| `…/resources/computer-description.md` | third slice (`cua.getApp`) |
| `…/resources/js-output-description.md` | fourth slice (`nodeRepl.write` / `emitImage`) |
| `…/resources/js-reset.md` | `js_reset` override; names `cua_repl.js` |
| `…/resources/server-instructions.md` | MCP `server_instructions` |

Cache twin: `/Users/dongdong/.codex/plugins/cache/openai-bundled/unified-computer-use/26.903.61454/` (same files; `.mcp.json` rewritten).

Marketplace twin: `/Users/dongdong/.codex/.tmp/bundled-marketplaces/openai-bundled/plugins/unified-computer-use/` (still shipped `.mcp.json`).

Vendor copies already in-tree: `/Users/dongdong/Desktop/codex-cua-reverse/vendor/plugins/unified-computer-use/` (pre-rewrite; `plugin.json` + `launch.mjs` match the app bundle).

---

## Read: computer-use plugin

| Path | Why |
|---|---|
| `…/computer-use/.mcp.json` | native MCP `SkyComputerUseClient mcp`; `env_vars: ["CODEX_HOME"]` |
| `…/computer-use/.codex-plugin/plugin.json` | user-facing plugin; skills + MCP |
| `…/computer-use/.codex-plugin/computer-use-node-repl.md` | skill variant: `node_repl` + `sky.*` |
| `…/computer-use/skills/computer-use/SKILL.md` | shipped confirmation-policy skill |
| `…/computer-use/bin/computer-use-client-launcher` | `exec` wrapper onto `~/.codex/computer-use/…/SkyComputerUseClient` |
| cache `plugin.json` | `bundledContentVariant: "node-repl"` |
| tmp-marketplace `SKILL.md` | post-copy node-repl skill actually on disk |

Related sibling plugins (same launcher pattern, not `js` tools):

| Path | MCP server / args |
|---|---|
| `…/computer-history/.mcp.json` | `computer-history` → launcher `computer-history mcp` |
| `…/messages/.mcp.json` | `messages` → launcher `messages mcp` |
| `…/record-and-replay/.mcp.json` | `event-stream` → launcher `event-stream mcp` |

Browser/Chrome plugins have **no** `.mcp.json`. They only hook `node_repl.turn_ended`:

- `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/browser/.codex-plugin/plugin.json`
- `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/chrome/.codex-plugin/plugin.json`

---

## Read: config / live runtime

| Path | Why |
|---|---|
| `/Users/dongdong/.codex/config.toml` | `mcp_servers.node_repl`, `mcp_servers.computer-use enabled=false`, plugin enables, `features.js_repl=false`, `notify` turn-ended |
| `/Users/dongdong/.codex/computer-use/config.json` | PiP strings only |
| Live PIDs 3579, 3632, 3802, 5746, 5748, 5769, 7250 | process tree + `KERN_PROCARGS2` env (Sentry id redacted) |

---

## Read: `node_repl` / CUA packages / desktop injector

| Path | Why |
|---|---|
| `/Applications/ChatGPT.app/Contents/Resources/cua_node/manifest.json` | `node_repl_path`, Node 24.20.0, runtime archive |
| `/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node_repl` | strings: tool schemas, `NODE_REPL_*`, banner prepend, trusted `handleRpc`, `turn_ended` |
| `/Applications/ChatGPT.app/Contents/Resources/codex` | strings: plugin MCP merge, `omit_tools_from`, `non_prefixed_mcp_tool_names`, `cua_repl` policy text; **no** `CUA_REPL_*` |
| `/Applications/ChatGPT.app/Contents/Resources/app.asar` | `Di()` rewrite, `Ei()` use-case clear, `Zte()` tinysky gate, `vte()` skill-variant copy, hidden plugin table |
| `…/@oai/cua/package.json` | export `./tinyskyAlt` |
| `…/@oai/cua/dist/.../tinysky_alt/globals.js` | `setupCUA` / global `cua` |
| `…/@oai/cua/dist/.../tinysky_alt/create_tinysky_alt.js` | browser vs sky wiring, docs emit |
| `…/@oai/cua/dist/.../tinysky_alt/documentation.js` | reads `docs/tinysky-alt-*.md` |
| `…/@oai/cua/docs/tinysky-alt-core-cua-repl.md` | cua_repl-oriented API doc |
| `…/@oai/cua/docs/tinysky-alt-core-node-repl.md` | node_repl-oriented API doc (`cua.initialize`, `sky` leftover types) |
| `…/@oai/sky/package.json` | export `./service` |
| `…/@oai/sky/dist/.../service.js` | `handleRpc` setup/execute |
| `…/@oai/sky/dist/.../mac/native-pipe.js` | sock path, `ensureService`, `SKY_CUA_SERVICE_PATH` |
| `…/@oai/browser-desktop/package.json` | export `./service` → `scripts/browser-service.mjs` |

---

## Context already in the reverse repo (not re-copied)

| Path | Use |
|---|---|
| `/Users/dongdong/Desktop/codex-cua-reverse/ARCHITECTURE.md` | high-level process picture; this agent adds the desktop rewrite + dual MCP |
| `/Users/dongdong/Desktop/codex-cua-reverse/API.md` | `cua.*` / `sky.*` method table |
| `/Users/dongdong/Desktop/codex-cua-reverse/TRACES.md` + `traces/*.json` | intercepted tool name is unprefixed `js` |
| `/Users/dongdong/Desktop/codex-cua-reverse/vendor/SOURCE.txt` | package versions |

---

## `node_repl` binary: embedded / rust paths (strings only)

From `/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node_repl`:

- `src/mcp_server.rs`, `src/mcp_server/strict_auto_review.rs`
- `src/repl_manager.rs`, `src/trusted_process.rs`, `src/native_pipe.rs`
- `src/computer_use.rs`, `src/kernel.js` (embedded), `trusted-worker.js`
- `src/active_exec_registry.rs`, `src/codex_app_server.rs`

No JS/Rust sources for those paths ship in the app; only the Mach-O.
