# GitHub openai/codex vs this machine’s ChatGPT.app Computer Use / Browser Use

Map of **every** local CUA catalog row (`CAPABILITIES.md`) onto open-source Codex (`github.com/openai/codex` @ `968835997714baaff199cfed5f89a2c65d8ca77d`).

Evidence: `agents/23-github-codex/FINDINGS.md` + fetched sources in `agents/23-github-codex/copies/`. Capture: `/Users/dongdong/Desktop/codex拦截-两轮-raw.json`.

## One-line split

| Layer | Open source | ChatGPT.app on this Mac |
|---|---|---|
| Code-mode JS | **`exec` / `wait`** (`PUBLIC_TOOL_NAME = "exec"`). Fresh V8 isolate, `tools.*`, no Node. | Same tool advertised as `functions.exec`. |
| CUA model tools | Names only: MCP servers `cua_repl` / `node_repl`, tools `js` / `js_reset` / `turn_ended`. | Live MCP: namespace `mcp__cua_repl` tools **`js`**, **`js_reset`**. Runtime is `cua_node/bin/node_repl`. |
| CUA API (`cua.*`, `tab.playwright`, `sky.*`) | **Absent** (no tinysky, no `@oai/*`, no SkyComputerUse except issue-labeler text). | Full tinysky-alt + browser-desktop + SkyComputerUseService. |
| Plugins | Hook **allowlists** for `unified-computer-use@openai-bundled` / `computer-use@openai-bundled` / chrome / browser. No plugin files. | Bundled plugin payloads + `launch.mjs` + banners + `Codex Computer Use.app`. |
| Policy | TOML `[computer_use]` / `[browser_use]`, Guardian ComputerUse scope, confirmation_policies. | Same host code path **plus** native/JS enforcement. |

**Counts (202 catalog rows):** github_harness_only=4, desktop_only=198, in_github=0.

`in_github` CUA **APIs**: none. The only `in_github` **advertised tool that is not CUA** is code-mode `exec`.

---

## Advertised tools: capture vs GitHub

From `codex拦截-两轮-raw.json` first request `input[0].tools`:

```
functions
  exec                      ← GitHub PUBLIC_TOOL_NAME "exec"     in_github
  wait                      ← GitHub WAIT_TOOL_NAME "wait"       in_github
  request_user_input        ← not CUA
  request_user_input_async  ← appears in capture tool *calls* (1×)
clock.sleep                 ← not CUA
collaboration.*             ← not CUA
mcp__cua_repl
  js                        ← GitHub recognizes mcp__cua_repl__js; no implementation
  js_reset                  ← GitHub test stub only
```

Not advertised to the model, but wired in both places as MCP cleanup:

- `turn_ended` on `cua_repl` (unified-computer-use) or `node_repl` (computer-use / browser / chrome)

GitHub does **not** use `PUBLIC_TOOL_NAME` for CUA. `exec` ≠ `js`.

| | `exec` (code mode) | `js` (CUA REPL) |
|---|---|---|
| Capture namespace | `functions` | `mcp__cua_repl` |
| GitHub constant | `PUBLIC_TOOL_NAME = "exec"` | no constant; server name `cua_repl` |
| Runtime | fresh V8 isolate, no Node | persistent Node 24 kernel (`cua_node`) |
| Globals | `tools.exec_command`, `text()`, `image()` | `cua`, `nodeRepl`, `tmpDir` |
| Persistence | isolate dies at end of script | bindings survive until `js_reset` |
| OSS feature | `Feature::CodeMode` (exists) | `Feature::JsRepl` **Removed**; plugin MCP instead |

---

## Catalog map

class = `in_github` | `desktop_only` | `github_harness_only` (plugin/MCP wiring without the CUA API).

### 1. Model tools / REPL

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

### 2. tinysky-alt `cua` / Target / Tab

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

### 3. `@oai/sky` window (Mac live)

Capture used `cua.getApp` → Target, not `sky.*`. OSS still has **zero** sky client.

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

### 4. `@oai/browser-desktop` Agent API (146 members, root `Agent`)

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

### 5. Browser capabilities (docs)

OSS counterpart is **policy only** (`allow_webmcp`, `full_cdp_access`, `allow_history_access`). The capability objects (`browser.capabilities.get`, `tab.cdp`, webmcp runtime) are desktop.

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

## Harness vs runtime (non-catalog but CUA-related)

| Item | class | Notes |
|---|---|---|
| MCP server name `cua_repl` / `node_repl` | github_harness_only | `is_node_repl_backed_server` |
| Plugin ids `unified-computer-use@openai-bundled`, `computer-use@openai-bundled`, `chrome@openai-bundled`, `browser@openai-bundled` | github_harness_only | bundled_hooks + discoverable allowlists; **no plugin files in repo** |
| `cua_repl.turn_ended` / `node_repl.turn_ended` hooks | github_harness_only | Stop / Interrupt / SubagentStop |
| TUI ComputerActivityCell (“Using computer”) | github_harness_only | `server == "cua_repl"` |
| Guardian ComputerUse scope for those servers | github_harness_only | plus `node_repl_policy.md` |
| `Feature::ComputerUse` / `BrowserUse` / `InAppBrowser` / `BrowserUseFullCdpAccess` / `BrowserUseExternal` | github_harness_only | “Requirements-only gate … desktop apps” |
| `[computer_use]` / `[browser_use]` TOML schema | in_github | parse/merge in OSS; **enforcement** desktop_only |
| `confirmation_policies.browser_use` / `.computer_use` forwarded to actor MCP | github_harness_only | `mcp_tool_call.rs` |
| `Feature::JsRepl` | n/a (Removed) | not the desktop CUA path |
| `PUBLIC_TOOL_NAME exec` | in_github | not CUA |
| `@oai/cua` tinysky-alt | desktop_only | |
| `@oai/browser-desktop` | desktop_only | |
| `@oai/sky` + native pipe `CodexComputerUseIPC-5` | desktop_only | |
| `SkyComputerUseService` / `SkyComputerUseClient` / `CUALockScreenGuardian` | desktop_only | issue-labeler mentions the service name only |
| `cua_node` / `node_repl` binary | desktop_only | crate name `node_repl@0.1.0` is not in the public repo tree |
| unified-computer-use `launch.mjs` / banners / js-tool-description.md | desktop_only | capture `js` description is this file |

---

## OSS file index (fetched)

See `agents/23-github-codex/copies/SOURCE.txt`. Key paths:

- `codex-rs/config/src/computer_use.rs`
- `codex-rs/config/src/browser_use.rs`
- `codex-rs/config/src/browser_computer_use_requirements.rs`
- `codex-rs/plugin/src/bundled_hooks.rs`
- `codex-rs/protocol/src/mcp.rs`
- `codex-rs/protocol/src/openai_models/guardian.rs`
- `codex-rs/features/src/lib.rs`
- `codex-rs/tui/src/history_cell/computer_activity.rs`
- `codex-rs/code-mode-protocol/src/lib.rs` (`PUBLIC_TOOL_NAME`)
- `codex-rs/core/src/tools/code_mode/execute_spec.rs`
- `.github/workflows/issue-labeler.yml` (only `SkyComputerUseService` hit)

---

## Bottom line

Open-source Codex can **host, review, and render** Computer Use if a `cua_repl` / `node_repl` MCP server is attached. It cannot **drive the computer**. Driving the computer is ChatGPT.app proprietary: tinysky-alt `cua.*`, `tab.playwright`, `@oai/sky`, and `SkyComputerUseService`.

The capture’s CUA tool is **`js`** under namespace **`mcp__cua_repl`**, not GitHub **`exec`**.
