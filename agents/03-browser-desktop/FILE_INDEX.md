# FILE_INDEX — `@oai/browser-desktop` and related CUA browser files

Absolute paths unless noted. Copies of important docs: `copies/` next to this file.

## `@oai/browser-desktop` 0.1.1

Root: `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/browser-desktop/`

| Path | What it is |
|---|---|
| `package.json` | Exports `.` → `scripts/browser-client.mjs`, `./service` → `scripts/browser-service.mjs`. classic-level only. |
| `scripts/browser-client.mjs` | Minified client. `setupBrowserRuntime` → Node REPL `rpc("browser", {setup\|execute})`. Classes for Agent/Browsers/Browser/Tabs/Tab/Playwright/capabilities. SHA256 matches vendored copy. |
| `scripts/browser-service.mjs` | Minified trusted service. `export { handleRpc }`. Embeds `api.json`+`documents.json`, CDP/Playwright injectors, IAB vs extension backends, family catalog chrome/edge/brave/opera/vivaldi. ~1.2M. |
| `scripts/browser-accessibility.wasm.br` | AX helper (not read). |
| `scripts/zxing_reader.wasm` | QR reader for browserAuth (not read). |

### `docs/` (all read)

| Path | Mode in `documents.json` | Contents |
|---|---|---|
| `docs/api.json` | (manifest, not a named doc) | Full Agent/Browsers/Browser/Tab/Playwright/AX/CUA/DomCUA type dump. `unsupportedByDefaultIn` per backend. |
| `docs/documents.json` | (catalog) | Include/lookup/model filters + `requiredFor` gates. |
| `docs/accessibility.md` | included if `Tab.ax` | `tab.ax.write/get/click/...` workflow. Playwright as fallback. |
| `docs/api-use-behavior.md` | included | REPL `const` handles, cheapest state check, no speculative `history()`, no URL-grid guessing. |
| `docs/bootstrap-troubleshooting.md` | model | Don’t reset REPL; `agent.browsers.list()`; don’t swap backends. |
| `docs/browser-control-interruption.md` | included | Paraphrase extension takeover; no `turn_id`. |
| `docs/browser-safety.md` | included | Untrusted content; transmission; CAPTCHA/paywall/permissions. |
| `docs/browser-troubleshooting.md` | lookup | Stale tabs ≠ disconnect; don’t reselect browser. |
| `docs/chrome-file-upload-troubleshooting.md` | lookup (extension) | Enable “Allow access to file URLs.” |
| `docs/chrome-troubleshooting.md` | model | chrome-is-running / extension / native-host checks. Family `chrome` vs `edge`. |
| `docs/confirmations.md` | included; requiredFor cdp+webmcp | Hand-off / always-confirm / pre-approval taxonomy. |
| `docs/file-uploads.md` | lookup | `waitForEvent("filechooser")` + `setFiles`. |
| `docs/local-web-development.md` | lookup | `tab.reload()` after local builds. |
| `docs/screenshots.md` | lookup | Inline markdown images. |
| `docs/session-naming.md` | included (extension + nameSession) | Emoji-prefixed `browser.nameSession`. |
| `docs/tab-claiming-chrome.md` | included (extension + claimTab) | Mention URL decode; `openTabs` + `claimTab`. |
| `docs/tab-cleanup-chrome.md` | included (extension + marks) | Ephemeral agent tabs; claimed tabs released if unmarked. |
| `docs/tab-cleanup-iab.md` | included (iab + marks) | Agent tabs close; user tabs stay. |
| `docs/tab-mentions-iab.md` | included (iab + Tabs.list/get) | `codexSessionId`; `tabs.get`; no claim. |
| `docs/visibility.md` | included if capability | Background default; `capabilities.get("visibility").set(true)`. |
| `docs/webmcp.md` | included if tab cap webmcp; requiredFor list/invoke | `tab.capabilities.get("webmcp").fetchTools()`. |

### `docs/capabilities/` (all read)

| Path | Documents |
|---|---|
| `capabilities/browser/management.md` | `windows/tabs/tabGroups/bookmarks` + `getAuditTrail` |
| `capabilities/browser/viewport.md` | `set({width,height})` / `reset()` |
| `capabilities/browser/visibility.md` | `get()` / `set(boolean)` |
| `capabilities/tab/botDetection.md` | `report({reason})` |
| `capabilities/tab/browserAuth.md` | `request({origin,fields,options,submit})` |
| `capabilities/tab/cdp.md` | `send` / `readEvents` |
| `capabilities/tab/pageAssets.md` | `list` / `bundle` |

## `@oai/cua` 0.2.4 — tinysky + vendored browser skill

Root: `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/`

| Path | What it is |
|---|---|
| `package.json` | Exports `.` and `./tinyskyAlt` → `dist/lib/js/oai_js_cua/src/tinysky_alt/globals.js`. |
| `docs/tinysky-alt-core-cua-repl.md` | Model API: `cua.getBrowser/createBrowserTab/getTab`, Target, persist, emit rules. |
| `docs/tinysky-alt-core-node-repl.md` | Same + `cua.initialize`, `cua.browsers`, selection examples, IAB `visible` / Chrome `sessionName`. |
| `docs/tinysky-alt-other-browser-apis.md` | When to leave AX for Playwright. Injected on first browser use. |
| `docs/tinysky-alt-confirmations.md` | Computer-use confirmation policy (tinysky prepends this). |
| `dist/lib/js/oai_js_cua/src/tinysky_alt/types.d.ts` | `TinySkyAlt`, `Tab = BrowserTab & Target`, option types. Imports `@oai/browser`. |
| `dist/lib/js/oai_js_cua/src/tinysky_alt/create_tinysky_alt.d.ts` | `create_tinysky_alt(options?)`. |
| `dist/lib/js/oai_js_cua/src/tinysky_alt/create_tinysky_alt.js` | **The wrapper.** Implements getBrowser/createBrowserTab/getTab; decorateTab AX; sets `globalThis.agent`. |
| `dist/lib/js/oai_js_cua/src/tinysky_alt/globals.js` | `setupCUA`; `Reflect.set(globalThis,"cua",…)`. |
| `dist/lib/js/oai_js_cua/src/tinysky_alt/documentation.js` | Reads `docs/tinysky-alt-*.md`; confirmation override from `nodeRepl.requestMeta`. |
| `dist/lib/js/oai_js_cua/src/get_state.js` | Inventory: `list_apps` + `browsers.list` + union of `openTabs` and `tabs.list`. |
| `dist/lib/js/oai_js_cua/src/cua.js` | Legacy `cua.initialize` via `setupBrowserRuntime({undocumentedApiMembers:["Tab.ax"]})`. |
| `dist/lib/js/oai_js_cua/src/index.js` | `export { cua }`. |
| `dist/lib/js/oai_js_browser/dist/skill/scripts/browser-client.mjs` | Identical to desktop client. |
| `dist/lib/js/oai_js_browser/dist/skill/scripts/browser-client.js` | CJS twin (tinysky imports this). |
| `dist/lib/js/oai_js_browser/dist/skill/scripts/browser-service.mjs` | Older/smaller service bundle (hash differs). |
| `dist/lib/js/oai_js_browser/dist/skill/references/documents.json` | Smaller catalog (no claiming/session/webmcp includes). |
| `dist/lib/js/oai_js_browser/dist/skill/references/browser-safety-training.md` | Shorter safety doc (training variant). |
| `dist/lib/js/oai_js_browser/dist/skill/references/api.json` | Byte-identical to desktop `docs/api.json`. |
| `dist/lib/js/oai_js_browser/dist/skill/references/capabilities/**` | Same capability markdowns as desktop. |

No other `.d.ts` for the browser client besides tinysky’s `@oai/browser` import (resolved to this skill).

## Plugin `unified-computer-use` 26.903.61454

App: `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/unified-computer-use/`

Vendor copies also at `/Users/dongdong/Desktop/codex-cua-reverse/vendor/plugins/unified-computer-use/`.

| Path | What it is |
|---|---|
| `plugin.json` | MCP hooks → `cua_repl.turn_ended`. |
| `.mcp.json` | Server `cua_repl`, tools `js` / `js_reset` / `turn_ended`. |
| `scripts/launch.mjs` | Spawns `CUA_REPL_NODE_REPL_PATH`; sets `NODE_REPL_TRUSTED_SERVICES.browser = "@oai/browser-desktop/service"`; concatenates tool descriptions. |
| `resources/browser-description.md` | Model selection policy: iab/chrome/edge, visible, sessionName, getTab vs createBrowserTab vs getBrowser. |
| `resources/js-tool-description.md` | First-call: one entry point; `cua.getState()`. |
| `resources/js-output-description.md` | `nodeRepl.write` / `emitImage`. |
| `resources/js-reset.md` | Mentions next `cua_repl.js` call. |
| `resources/banner.js` | `setupCUA({ browser: true, computer: true })`. |
| `resources/banner-browser.js` | browser-only. |
| `resources/banner-computer.js` | computer-only. |
| `resources/server-instructions.md` | One-liner: persistent JS CUA session. |
| `resources/computer-description.md` | `cua.getApp`. |

## Traces / intercepts (for mcp__cua_repl and live usage)

| Path | What it is |
|---|---|
| `/Users/dongdong/Desktop/codex-cua-reverse/traces/task-1-ant-design-form.json` | Live `js` calls: `getBrowser({url})`, `listTabs`, `getTab("1")`, `tab.click`, `tab.playwright.locator().fill`, `browser.tabs.get`, `dev.logs`. |
| `/Users/dongdong/Desktop/codex-cua-reverse/TRACES.md` | Maps those calls to APIs. |
| `/Users/dongdong/Desktop/codex-cua-reverse/API.md` | Prior extraction of cua/sky. |
| `/Users/dongdong/Desktop/codex-cua-reverse/ARCHITECTURE.md` | Process diagram; trusted services. |
| `/Users/dongdong/Desktop/codex-cua-reverse/README.md` | Scope: ChatGPT.app only. |
| `/Users/dongdong/Desktop/codex拦截-0127-raw.json` | Responses payload: namespace `"mcp__cua_repl"` with tools `js`/`js_reset` and the concatenated description. Sampled around the namespace object only. |

## This agent’s copies

Under `/Users/dongdong/Desktop/codex-cua-reverse/agents/03-browser-desktop/copies/`:

- `browser-desktop/docs/**` — full docs tree + `package.json`
- `cua/` — tinysky-alt core/other-browser docs, older documents.json, training safety
- `tinysky/*.d.ts`
- `unified-computer-use/` — plugin descriptions, mcp.json, plugin.json

Not copied: wasm, minified 1.2M service, Chromium native-host binaries, extension IDs.
