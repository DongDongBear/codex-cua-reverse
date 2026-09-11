# FINDINGS — openai/codex (open source) vs ChatGPT.app Computer Use / Browser Use

**Verdict.** `github.com/openai/codex` at `968835997714baaff199cfed5f89a2c65d8ca77d` (2026-09-10, “Bound MCP descriptions separately from Guardian action JSON”) is the **host harness** for Computer Use / Browser Use. It knows MCP server names `cua_repl` / `node_repl`, tool names `js` / `js_reset` / `turn_ended`, plugin ids `unified-computer-use@openai-bundled` and `computer-use@openai-bundled`, Guardian ComputerUse scope, TUI “Using computer” grouping, and TOML policy schemas. It does **not** ship the CUA API, the Node REPL runtime, tinysky-alt, `@oai/sky`, `@oai/browser-desktop`, Playwright-on-tab, or `SkyComputerUseService`.

The desktop capture `/Users/dongdong/Desktop/codex拦截-两轮-raw.json` advertises **both**:

| Surface | Namespace | Tools | Where implemented |
|---|---|---|---|
| Code mode | `functions` | `exec` (custom/freeform), `wait`, `request_user_input`, `request_user_input_async` | **in_github** — `PUBLIC_TOOL_NAME = "exec"` |
| CUA REPL | `mcp__cua_repl` | `js`, `js_reset` | **github_harness_only** (name+wiring) / **desktop_only** (runtime+`cua.*`) |

Catalog rows classified: **202** (4 github_harness_only, 198 desktop_only, 0 in_github). No catalog CUA **API** is implemented in OSS.

---

## 0. Method

- Repo tree: `gh api repos/openai/codex/git/trees/968835997714baaff199cfed5f89a2c65d8ca77d?recursive=1` → 8578 paths.
- File bodies: `gh api -H "Accept: application/vnd.github.raw" repos/openai/codex/contents/<path>?ref=968835997714baaff199cfed5f89a2c65d8ca77d` (not `web_fetch`).
- Copies: `agents/23-github-codex/copies/` (no secrets).
- Local catalog: `CAPABILITIES.md` / `CAPABILITY-CATALOG.json`.
- Capture: `codex拦截-两轮-raw.json` tasks `task-1-ant-design-form` + `task-2-linear-issue`, model `gpt-6-astra`.

**Classes**

| class | meaning |
|---|---|
| `in_github` | OSS implements the capability (not just a name). |
| `github_harness_only` | OSS has plugin/MCP/Guardian/TUI wiring **without** the CUA API or runtime. |
| `desktop_only` | Only in this machine’s ChatGPT.app / cua_node / Codex Computer Use.app. |

---

## 1. Advertised tool names (capture vs GitHub)

First `tools` array in `tasks[0].frames[0].text.input[0].tools`:

```
namespace functions
  exec     type=custom  format=lark grammar  desc_len=53297
  wait     type=function
  request_user_input
  request_user_input_async
namespace clock
  sleep
namespace collaboration
  followup_task, interrupt_agent, list_agents, send_message, spawn_agent, wait_agent
namespace mcp__cua_repl
  description: "UI automation through a persistent JavaScript session using the initialized CUA API."
  js       type=function  params={code, timeout_ms?, title?}  desc_len=2556
  js_reset type=function  params={}  desc_len=286
```

### `exec` = GitHub `PUBLIC_TOOL_NAME`

`codex-rs/code-mode-protocol/src/lib.rs`:

```rust
pub const PUBLIC_TOOL_NAME: &str = "exec";
pub const WAIT_TOOL_NAME: &str = "wait";
```

`codex-rs/core/src/tools/code_mode/execute_spec.rs` builds a freeform tool named `PUBLIC_TOOL_NAME` with the same Lark grammar the capture ships:

```
start: pragma_source | plain_source
PRAGMA_LINE: /[ \t]*\/\/ @exec:[^\r\n]*/
SOURCE: /[\s\S]+/
```

Capture `exec` description starts: “Run JavaScript code to orchestrate/compose tool calls … Evaluates the provided JavaScript code in a **fresh V8 isolate** as an async module … **no Node, no file system, no network access, no console** … nested tools on `tools.exec_command(...)`.”

That is **code mode**, not CUA. Class: **in_github**.

### `js` / `js_reset` = MCP `cua_repl` (not GitHub `PUBLIC_TOOL_NAME`)

Capture `mcp__cua_repl.js` description is the desktop plugin string (matches `vendor/plugins/unified-computer-use/js-tool-description.md`): “Control native apps or browsers … `await cua.getState()` … `cua.getTab` … `cua.createBrowserTab` … `cua.getBrowser({ url })` … `cua.getApp` … `nodeRepl.write` / `nodeRepl.emitImage` … This tool is part of plugin `unified-computer-use`.”

Capture `js_reset`: “Reset the persistent CUA JavaScript session … The next cua_repl.js call initializes a fresh runtime … This tool is part of plugin `unified-computer-use`.”

GitHub protocol (`codex-rs/protocol/src/mcp.rs`):

```rust
pub fn is_node_repl_backed_server(server: &str) -> bool {
    matches!(server, "node_repl" | "cua_repl")
}
```

Tests recognize `mcp__cua_repl__js`, `cua_repl__js`, namespace `mcp__cua_repl`. There is **no** `cua.getBrowser` / tinysky implementation behind that name.

Built-in `Feature::JsRepl` / `js_repl` is **Removed** (`features/src/lib.rs`). Desktop CUA is a **plugin MCP server**, not that deleted flag.

`turn_ended` is **not** in the capture tools list. OSS `bundled_hooks.rs` still allowlists it as a cleanup MCP call.

`js_add_node_module_dir` is **not** advertised (desktop `enabled_tools: ["js","js_reset","turn_ended"]`). OSS test stub in `app-server/tests/suite/v2/mcp_tool.rs` short-circuits `js_reset | js_add_node_module_dir`.

---

## 2. What OSS actually contains (harness)

### 2.1 MCP / plugin names

| OSS file | What it does |
|---|---|
| `protocol/src/mcp.rs` | `node_repl` \| `cua_repl` are Node-REPL-backed servers; `mcp__cua_repl__js` is a ComputerUse Guardian tool. |
| `plugin/src/bundled_hooks.rs` | Unsigned cleanup allowlist: `unified-computer-use@openai-bundled` → `cua_repl.turn_ended`; `computer-use` / `browser` / `chrome*` → `node_repl.turn_ended`. |
| `core-plugins/src/discoverable.rs` | Tool-suggest allowlist includes `chrome@openai-bundled`, `computer-use@openai-bundled`. **No** `unified-computer-use` in that list. |
| `core-plugins/src/executor_hooks_tests.rs` | Discovers allowlisted Stop hooks for those plugin ids. |
| `app-server/tests/suite/v2/hooks_list.rs` | Hides builtin cleanup for `("unified-computer-use","cua_repl")` and `("browser","node_repl")`. |
| `core/tests/suite/hooks.rs` | Same plugin/server pairs. |

**No plugin payload in the repo.** Tree has zero `plugin.json` / `.mcp.json` / `launch.mjs` / `banner.js` for unified-computer-use, computer-use, chrome, or browser. OSS will honor those hooks **if** a desktop/bundled plugin is installed.

### 2.2 TUI

| OSS file | What it does |
|---|---|
| `tui/src/history_cell/mcp.rs` | `McpInvocation::is_computer_activity()` ⇔ `server == "cua_repl"`. `js` on any node_repl-backed server uses `McpResultKind::NodeRepl`. Compact UI uses `arguments.title`. |
| `tui/src/history_cell/computer_activity.rs` | Groups adjacent cua_repl calls into “Using computer / Used computer · N actions”. |
| `tui/src/history_cell/computer_activity_tests.rs` | Fixture: `server: "cua_repl", tool: "js", arguments: {title, code: "await cua.getState()"}`. **String only** — no `cua` runtime. |
| `tui/src/chatwidget/tool_lifecycle.rs` | Routes cua_repl start/complete into `ComputerActivityCell`. |
| `tui/src/history_cell/mcp_result.rs` | Extra top-level `text` retention for node_repl/cua_repl, including malformed blocks. |

### 2.3 Guardian / model metadata

| OSS file | What it does |
|---|---|
| `protocol/src/openai_models/guardian.rs` | `GuardianScope::for_mcp_server`: node_repl/cua_repl → **ComputerUse** (not generic MCP). `for_tool("exec")` → **CodeMode**. |
| `protocol/src/openai_models.rs` | `node_repl_auto_review_required`, `node_repl_disabled`, `confirmation_policies.{browser_use,computer_use}`, `auto_review.node_repl_policy`. |
| `core/assets/guardian/node_repl_policy.md` | Extra reviewer rules for “computer and browser use via `node_repl` or `cua_repl`”. |
| `core/src/context/guardian_node_repl_policy.rs` | Injects that markdown (or model override) as developer context. |
| `core/src/mcp_tool_call.rs` | Forwards confirmation-policy Markdown **only** to node_repl/cua_repl (not Guardian sessions). |
| `core/src/tools/handlers/mcp.rs` | Captures nested code-mode results from those servers into Guardian evidence. |
| `ext/guardian-v2/src/async_scorer/coverage.rs` | `computer_use_only` default true; `initial_cua_call` adaptive scoring. |
| `features/src/feature_configs.rs` | `GuardianV2ReviewScopeConfigToml.computer_use_only`. |
| `core/src/session/step_activation.rs` | Model switch blocked if `computer_use_review_required` / `node_repl_disabled` / node_repl policy change. |
| `core/src/turn_metadata.rs` | Pins `node_repl_auto_review_required` / `node_repl_disabled` on MCP requests. |

### 2.4 Feature flags (requirements-only; no runtime)

`features/src/lib.rs`:

- `Feature::ComputerUse` key `computer_use` — “Allow Codex Computer Use. Requirements-only gate.”
- `Feature::BrowserUse` / `BrowserUseFullCdpAccess` / `BrowserUseExternal`
- `Feature::InAppBrowser` — “Allow the in-app browser pane in desktop apps.”
- `Feature::JsRepl` / `JsReplToolsOnly` — **Removed** compatibility no-ops.

These flags are **github_harness_only**. They do not implement IAB, CDP, or AX.

### 2.5 Config schemas (policy, not clicker)

**in_github** as *schema + merge*, **desktop_only** as *enforcement on AX/CDP*.

`[computer_use]` (`config/src/computer_use.rs`, app-server-protocol `ComputerUseConfig`):

- `default_app_access` allow/deny
- `macos.bundle_ids`
- `windows.aumids` / `windows.exes` (publisher_name, product_name, binary_name, access)

`[browser_use]` (`config/src/browser_use.rs`):

- `allow_history_access`
- origin policy: `access`, `downloads`, `uploads`, `full_cdp_access`

Requirements (`browser_computer_use_requirements.rs`, `config_requirements.rs`):

- `allow_browser_and_computer_use`
- `allow_webmcp`, `allow_history_access`, `disable_auto_review`, `allow_global_persistent_approval`
- `allow_locked_computer_use`, `allow_persistent_approval`
- per-origin `auto_review`, `persistent_approval`, `access_approval_lifetime` (turn/thread)

OSS parses and merges these. The process that *applies* them to clicks is `SkyComputerUseService` / `@oai/browser-desktop` on desktop.

### 2.6 Absences (tree + fetched bodies)

8578-file tree contains **no** path matching: `tinysky`, `getBrowser`, `cua_node`, `@oai/cua`, `@oai/sky`, `browser-desktop`, `playwright.locator`, `create_tinysky`, `ComputerUseIPC`, `SkyComputerUse*`.

Content search of fetched CUA-related sources:

| Symbol | OSS |
|---|---|
| `tinysky` | **0** |
| `cua.getBrowser` / `getTab` / `getApp` | only the **test string** `await cua.getState()` in TUI snapshots |
| `tab.playwright` | **0** (unrelated `connector_id: "playwright"` fixture in mcp_tool_call_tests) |
| `SkyComputerUse` | **only** `.github/workflows/issue-labeler.yml` labeler prompt: “computer-use - Issues involving agentic computer use or SkyComputerUseService.” |
| `@oai/cua` / `@oai/sky` / `@oai/browser-desktop` | **0** |

---

## 3. What the desktop app has (this machine)

Architecture from local reverse (`ARCHITECTURE.md`, agents 01–07):

```
ChatGPT.app
  unified-computer-use plugin  (hidden; mcpServerName=cua_repl)
    scripts/launch.mjs → cua_node/bin/node_repl
      NODE_REPL_TRUSTED_SERVICES = { browser: @oai/browser-desktop/service,
                                     sky:     @oai/sky/service }
      banner: setupCUA({ browser, computer })  // tinysky-alt global `cua`
        Tab = BrowserTab & Target   (tab.ax.*, tab.playwright)
        App = Target over sky.*
          @oai/sky native-pipe → SkyComputerUseService
            Codex Computer Use.app  (AX / CGEvent / ScreenCaptureKit)
```

Capture actually invoked (not advertised as tools — they are JS inside `js.code`):

`app.click`×14, `tab.getAXState`×12, `tab.click`×11, `nodeRepl.write`×10, `app.getAXState`×9, `app.getAXStateAndScreenshot`×8, `tab.playwright.locator`×7, `cua.getApp`×4, plus `cua.getBrowser` / `cua.getTab` / `cua.listTabs` / `cua.listApps` / `tab.dev.logs` / `app.paste` / …

None of those symbols exist as implementations in OSS.

---

## 4. Catalog classification

Every row from `CAPABILITIES.md` / `CAPABILITY-CATALOG.json`.

### 4.1 Model tools / REPL (8)

| ID | class | in capture | GitHub evidence |
|---|---|---|---|
| `js` | github_harness_only | YES | MCP tool name on cua_repl/node_repl. OSS special-cases the server (`is_node_repl_backed_server`), TUI groups cua_repl.js as ComputerActivity, Guardian treats it as ComputerUse. No node_repl binary, no kernel, no global `cua`. |
| `js_reset` | github_harness_only | YES | Advertised on desktop cua_repl. OSS app-server test stub lists `js_reset` next to `js_add_node_module_dir`. No reset implementation, no CUA kernel. |
| `turn_ended` | github_harness_only | — | OSS bundled_hooks allowlist: unified-computer-use@openai-bundled → cua_repl.turn_ended; browser/chrome/computer-use → node_repl.turn_ended. Plugin payload not in repo. Not advertised to the model in the capture. |
| `js_add_node_module_dir` | github_harness_only | — | OSS mcp_tool.rs test stub; desktop node_repl implements it, cua_repl enabled_tools strips it. Not in capture tools list. |
| `nodeRepl.write` | desktop_only | YES | JS host API on cua_node kernel. OSS TUI only renders MCP text blocks from cua_repl/node_repl results. |
| `nodeRepl.emitImage` | desktop_only | — | JS host API. OSS TUI/Guardian can retain MCP image content from node_repl/cua_repl results; no emitImage API. |
| `nodeRepl.emitAudio` | desktop_only | — | JS host API. OSS TUI summarizes MCP audio as `<audio content>`; no emitAudio API. |
| `nodeRepl.createElicitation` | desktop_only | — | Trusted-worker JS API. OSS has generic MCP elicitation + Guardian approval elicitations, not this CUA helper. |

### 4.2 tinysky-alt `cua` / Target / Tab (27)

All **desktop_only**. OSS TUI fixture mentions `cua.getState()` as sample `js` source text only.

| ID | class | in capture | GitHub evidence |
|---|---|---|---|
| `cua.getState` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `cua.getBrowser` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `cua.createBrowserTab` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `cua.getTab` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `cua.listBrowsers` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `cua.listTabs` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `cua.getApp` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `cua.listApps` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `target.getAXState` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `target.getScreenshot` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `target.getAXStateAndScreenshot` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `target.click` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `target.typeText` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `target.setValue` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `target.pressKey` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `target.scroll` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `target.drag` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `target.paste` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `target.selectText` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `target.performSecondaryAction` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `tab.goto` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `tab.back` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `tab.forward` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `tab.reload` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `tab.close` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `tab.markDeliverable` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `tab.markHandoff` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |

### 4.3 `@oai/sky` window (13)

All **desktop_only**. Capture never called `sky.*` directly; it used `cua.getApp` → Target. OSS has no sky client.

| ID | class | in capture | GitHub evidence |
|---|---|---|---|
| `sky.list_apps` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `sky.get_app_state` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `sky.click` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `sky.drag` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `sky.paste` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `sky.perform_secondary_action` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `sky.press_key` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `sky.scroll` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `sky.select_text` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `sky.set_value` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `sky.type_text` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `sky.start_audio_recording` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `sky.stop_audio_recording` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |

### 4.4 `@oai/browser-desktop` Agent API (146)

All **desktop_only**. `api.json` lives under ChatGPT.app `cua_node/.../@oai/browser-desktop`, not github.com/openai/codex.

| ID | class | in capture | GitHub evidence |
|---|---|---|---|
| `Agent.browsers` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Agent.documentation` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Browsers.get` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Browsers.getDefault` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Browsers.getForUrl` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Browsers.list` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Browser.browserId` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Browser.capabilities` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Browser.tabs` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Browser.user` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Browser.documentation` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Browser.history` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Browser.nameSession` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `BrowserUser.claimTab` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `BrowserUser.getTabContext` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `BrowserUser.openTabs` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tabs.content` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tabs.get` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tabs.list` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tabs.new` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tabs.selected` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tab.ax` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tab.capabilities` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tab.clipboard` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tab.content` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tab.cua` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tab.dev` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tab.dom_cua` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tab.id` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tab.playwright` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tab.back` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tab.close` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tab.forward` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tab.getJsDialog` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tab.goto` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tab.markDeliverable` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tab.markHandoff` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tab.reload` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tab.requestManualHandoff` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tab.screenshot` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tab.title` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Tab.url` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `AXAPI.click` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `AXAPI.drag` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `AXAPI.get` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `AXAPI.performSecondaryAction` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `AXAPI.pressKey` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `AXAPI.scroll` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `AXAPI.selectText` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `AXAPI.setValue` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `AXAPI.typeText` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `AXAPI.write` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `ContentAPI.export` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `ContentAPI.exportGsuite` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `ContentAPI.exportYouTubeTranscript` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `CUAAPI.click` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `CUAAPI.double_click` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `CUAAPI.downloadMedia` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `CUAAPI.drag` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `CUAAPI.keypress` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `CUAAPI.move` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `CUAAPI.scroll` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `CUAAPI.type` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `DomCUAAPI.click` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `DomCUAAPI.double_click` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `DomCUAAPI.downloadMedia` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `DomCUAAPI.get_visible_dom` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `DomCUAAPI.keypress` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `DomCUAAPI.scroll` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `DomCUAAPI.type` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightAPI.domSnapshot` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightAPI.elementInfo` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightAPI.elementScreenshot` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightAPI.evaluate` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightAPI.expectNavigation` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightAPI.frameLocator` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightAPI.getByLabel` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightAPI.getByPlaceholder` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightAPI.getByRole` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightAPI.getByTestId` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightAPI.getByText` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightAPI.locator` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightAPI.waitForEvent` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightAPI.waitForLoadState` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightAPI.waitForTimeout` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightAPI.waitForURL` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightFrameLocator.frameLocator` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightFrameLocator.getByLabel` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightFrameLocator.getByPlaceholder` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightFrameLocator.getByRole` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightFrameLocator.getByTestId` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightFrameLocator.getByText` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightFrameLocator.locator` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.all` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.allTextContents` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.and` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.check` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.click` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.count` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.dblclick` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.downloadMedia` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.evaluate` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.evaluateAll` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.fill` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.filter` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.first` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.getAttribute` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.getByLabel` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.getByPlaceholder` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.getByRole` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.getByTestId` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.getByText` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.innerText` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.isEnabled` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.isVisible` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.last` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.locator` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.nth` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.or` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.press` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.pressSequentially` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.selectOption` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.setChecked` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.textContent` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.type` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.uncheck` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightLocator.waitFor` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightDownload.path` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightFileChooser.isMultiple` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PlaywrightFileChooser.setFiles` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `TabClipboardAPI.read` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `TabClipboardAPI.readText` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `TabClipboardAPI.write` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `TabClipboardAPI.writeText` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `TabDevAPI.logs` | desktop_only | YES | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `AlertDialog.type` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `AlertDialog.dismiss` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `BeforeUnloadDialog.type` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `BeforeUnloadDialog.dismiss` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `ConfirmDialog.type` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `ConfirmDialog.accept` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `ConfirmDialog.dismiss` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `Documentation.get` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PromptDialog.type` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PromptDialog.accept` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |
| `PromptDialog.dismiss` | desktop_only | — | No tinysky / @oai/cua / @oai/sky / @oai/browser-desktop / SkyComputerUse* / cua_node in openai/codex (8578-file tree). OSS only has MCP server name + policy/TUI harness. |

### 4.5 Browser capabilities docs (8)

| ID | class | in capture | GitHub evidence |
|---|---|---|---|
| `browser.management` | desktop_only | — | browser-desktop docs only. OSS has no management API. |
| `browser.viewport` | desktop_only | — | browser-desktop docs only. |
| `browser.visibility` | desktop_only | — | browser-desktop docs only. |
| `tab.botDetection` | desktop_only | — | browser-desktop docs only. |
| `tab.browserAuth` | desktop_only | — | browser-desktop docs only. |
| `tab.cdp` | desktop_only | — | browser-desktop CDP surface. OSS has BrowserUseFullCdpAccess feature + full_cdp_access origin policy schema only. |
| `tab.pageAssets` | desktop_only | — | browser-desktop docs only. |
| `webmcp` | desktop_only | — | browser-desktop webmcp.md. OSS has allow_webmcp in BrowserUseRequirementsToml only. |

---

## 5. Related advertised tools that are *not* CUA APIs

| Tool | Capture | GitHub | class |
|---|---|---|---|
| `exec` | `functions.exec` custom/lark, 53k-char nested-tool description | `PUBLIC_TOOL_NAME = "exec"` | **in_github** |
| `wait` | wait on yielded exec cell | `WAIT_TOOL_NAME = "wait"` | **in_github** |
| `request_user_input` / `_async` | functions namespace | collaboration / plan tools in OSS | **in_github** (not CUA) |
| `sleep` | clock namespace | `Feature::SleepTool` | **in_github** (not CUA) |
| `spawn_agent` etc. | collaboration | multi-agent v2 | **in_github** (not CUA) |
| `mcp__cua_repl` namespace | present | recognized as node-repl-backed | **github_harness_only** |

---

## 6. Copies

Fetched at `agents/23-github-codex/copies/` from ref `968835997714baaff199cfed5f89a2c65d8ca77d`. See `copies/SOURCE.txt`.
