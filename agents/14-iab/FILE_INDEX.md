# FILE_INDEX — IAB / CodexBrowser

Absolute paths. No copies of minified 1.2M service or asar blobs were duplicated into this agent dir.

## Traces (re-read)

| Path | What |
|---|---|
| `/Users/dongdong/Desktop/codex拦截-两轮-raw.json` | Two-round websocket dump. Task 1 `function_call_output` for `getBrowser` / `listTabs` / `getTab`. |
| `/Users/dongdong/Desktop/codex-cua-reverse/traces/task-1-ant-design-form.json` | 14 `js` calls only (args, no outputs). |
| `/Users/dongdong/Desktop/codex-cua-reverse/traces/all-js-calls.json` | Union of both tasks. |
| `/Users/dongdong/Desktop/codex-cua-reverse/agents/05-traces/calls.json` | Parsed outputs: listTabs JSON, first-use ~50k docs, `browserId`/`tab.id` `"1"`. |
| `/Users/dongdong/Desktop/codex-cua-reverse/agents/05-traces/FINDINGS.md` | Task 1 mapping; user already had the page on the right. |
| `/Users/dongdong/Desktop/codex-traffic/2026-09-10/0127_WS_backend-api_codex_responses/websocket.jsonl` | Source capture for Task 1. |

## Tinysky wrapper (why getBrowser does not open a tab)

| Path | What |
|---|---|
| `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_cua/src/tinysky_alt/create_tinysky_alt.js` | Production `getBrowser` / `createBrowserTab` / `getTab` / `listTabs` / `decorateTab`. |
| `/Users/dongdong/Desktop/codex-cua-reverse/vendor/cua/js/create_tinysky_alt.js` | Vendored copy. |
| `/Users/dongdong/Desktop/codex-cua-reverse/agents/01-cua-tinysky/copies/oai_js_cua/tinysky_alt/create_tinysky_alt.pretty.js` | Pretty-printed. |
| `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_cua/src/get_state.js` | `listTabs` union of `tabs.list` + `user.openTabs`. |
| `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_cua/src/tinysky_alt/types.d.ts` | `GetBrowserOptions`, `CreateBrowserTabOptions.visible`. |
| `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/docs/tinysky-alt-core-cua-repl.md` | Model API; getBrowser “select without opening a tab”. |
| `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/docs/tinysky-alt-core-node-repl.md` | IAB `visible` vs Chrome `sessionName`. |

## `@oai/browser-desktop` 0.1.1 (trusted service)

Root: `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/browser-desktop/`

| Path | What |
|---|---|
| `package.json` | Exports `.` → `scripts/browser-client.mjs`, `./service` → `scripts/browser-service.mjs`. |
| `scripts/browser-client.mjs` | `setupBrowserRuntime`; `tab.markDeliverable` / `markHandoff`; visibility RPCs. |
| `scripts/browser-service.mjs` | `handleRpc`. Pipe discover `/tmp/codex-browser-use`. `kY=1` sequential browser ids. `getForUrl` ranking `dM`/`ZY`. `isIabBackend`. `turnEnded`. |
| `docs/api.json` | Agent/Browsers/Tab; `unsupportedByDefaultIn` iab for `user`/`history`/`Tabs.content`/… |
| `docs/documents.json` | Include filters: `tab-mentions-iab`, `tab-cleanup-iab`, `visibility`. |
| `docs/tab-mentions-iab.md` | Mention URL; match `metadata.codexSessionId`; `tabs.get`; no claim. |
| `docs/tab-cleanup-iab.md` | Agent tabs close; user tabs stay; `markDeliverable` / `markHandoff`. |
| `docs/tab-claiming-chrome.md` | Extension-only claim (contrast). |
| `docs/tab-cleanup-chrome.md` | Extension cleanup (contrast). |
| `docs/visibility.md` | Background default; `capabilities.get("visibility").set(true)`. |
| `docs/capabilities/browser/visibility.md` | `get()` / `set(boolean)`. |
| `docs/capabilities/browser/viewport.md` | `set({width,height})` / `reset()`. |
| `docs/local-web-development.md` | localhost / `tab.reload()`. |

Vendored near-copy: `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_browser/dist/skill/` (client hash matches; service hash differs).

Reverse copies of the docs tree: `/Users/dongdong/Desktop/codex-cua-reverse/vendor/browser-desktop/docs/` and `/Users/dongdong/Desktop/codex-cua-reverse/agents/03-browser-desktop/copies/`.

## Plugin `browser` (in-app skill)

`/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/browser/`

| Path | What |
|---|---|
| `.codex-plugin/plugin.json` | name `browser`; aliases `@browser`, in-app browser; keywords include `iab`; Stop → `node_repl.turn_ended`. |
| `skills/control-in-app-browser/SKILL.md` | `agent.browsers.get("iab")`; `getForUrl`; `getDefault` prefers IAB. |
| `scripts/browser-client.mjs` / `browser-service.mjs` | Same API as desktop package (plugin-local). |
| `docs/tab-mentions-iab.md` / `tab-cleanup-iab.md` / `visibility.md` | Same markdown as desktop. |

## Plugin `chrome` (extension backend, contrast)

`/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/chrome/`

| Path | What |
|---|---|
| `.codex-plugin/plugin.json` | `turn_ended` hooks. |
| `skills/control-chrome/SKILL.md` | Byte-similar selection policy; `@Chrome` / `@Edge`. |
| `extension-host/macos/arm64/ChatGPT for Chrome` | Native messaging host. Not IAB. |

## Plugin `unified-computer-use`

`/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/unified-computer-use/`

| Path | What |
|---|---|
| `scripts/launch.mjs` | `NODE_REPL_TRUSTED_SERVICES.browser = "@oai/browser-desktop/service"`. |
| `resources/browser-description.md` | `createBrowserTab("iab", url, { visible })`; getBrowser only when browser unnamed. |
| `resources/js-tool-description.md` | “Selecting a browser does not open a tab.” |
| `resources/banner.js` | `setupCUA({ browser: true, computer: true })`. |
| `.mcp.json` | tools `js` / `js_reset` / `turn_ended`. |

Vendor copies: `/Users/dongdong/Desktop/codex-cua-reverse/vendor/plugins/unified-computer-use/`.

## Plugin `sites` (not IAB)

`/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/sites/`

Website builder + webmcp templates. IAB is the intended localhost preview surface, not this plugin’s runtime.

## ChatGPT.app Electron (IAB host)

App: `/Applications/ChatGPT.app`

| Path | What |
|---|---|
| `Contents/Resources/owl-app.ini` | `[Owl] UserDataDirectoryName=Codex` version `26.903.61454`. |
| `Contents/Resources/owl-electron-app.json` | runtimeName `owl`. |
| `Contents/Resources/app.asar` | Packaged main/renderer. |
| asar `.vite/build/early-bootstrap.js` | Requires bootstrap. |
| asar `.vite/build/bootstrap-CVEIInaq.js` | `owl-scoped-user-agent-prefix=CodexBrowser`; additional hosts openai.com,chatgpt.com,chatgpt.site,chatgpt-team.site. |
| asar `.vite/build/main-D87AK7lw.js` | IAB backend class `Sve` (`browser-use-iab-api`); `IAB_LIFECYCLE` logs; `getInfo` name `Codex In-app Browser`; `turnEnded` / `markTab` / `createTabForBrowserUse`; visibility/viewport; `/tmp/codex-browser-use`; `persist:codex-browser-app-route:`. |
| asar `.vite/build/src-J2PvP4xj.js` | `persist:codex-browser-app`; `/settings/browser-use/*`; feature keys `inAppBrowserUse*`. |
| asar `.vite/build/browser-page-preload.js` | IAB **guest** preload. |
| asar `.vite/build/preload.js` | Codex UI preload (`Codex Desktop/…` UA). |
| asar `webview/assets/hidden-browser-use-webview-host-1403c794424a.js` | Hidden IAB host: `hostKind: "hidden-browser-use"`, `isVisible: false`, `shouldPaint: false`. |
| asar `webview/assets/hidden-background-webview-host-6ec20dc61fe2.js` | Background adopted webviews (non-browser-use). |
| asar `webview/assets/browser-session-queries-89752209f7b2.js` | ChatGPT-session lookup eligibility (signed-in IAB profile). |
| asar `webview/assets/browser-use-origin-state-queries-d307f4d92bea.js` | Workspace policy: `in_app_browser` / origin allow-deny. |
| asar `webview/assets/browser-use-settings-6cbd2811a0d7.js` | Settings UI. |
| asar `webview/assets/browser-use-settings-visibility-34b33f7890f3.js` | Visibility settings chunk. |
| asar `webview/assets/browser-address-shortcut-5aff49db7304.js` | `browserTabMention` composer; mention path encode. |
| asar `webview/assets/open-in-codex-7afc3491bea2.js` | `windows.tabs.open` `type: "browser"`. |
| asar `package.json` | `openai-codex-electron`, deps `browser-api` / `browser-backend-common` / `browser-common`. |

Scratch extracts used while reversing (not source of truth): `/tmp/chatgpt-asar-iab/` and `/tmp/chatgpt-asar-iab/slices/`.

## Native helpers

| Path | What |
|---|---|
| `/Applications/ChatGPT.app/Contents/Resources/native/browser-use-peer-authorization.node` | Peer auth for browser-use. |
| `/tmp/codex-browser-use` | Runtime JSON-RPC socket dir (macOS). Created by the app, not shipped. |

## Prior reverse notes (IAB-adjacent)

| Path | What |
|---|---|
| `/Users/dongdong/Desktop/codex-cua-reverse/agents/03-browser-desktop/FINDINGS.md` | Full Agent API; IAB vs extension vs cdp. |
| `/Users/dongdong/Desktop/codex-cua-reverse/agents/03-browser-desktop/QUESTIONS.md` | Q27–Q28 are the Task 1 id/`getBrowser` questions this agent answers. |
| `/Users/dongdong/Desktop/codex-cua-reverse/agents/01-cua-tinysky/FINDINGS.md` | tinysky global `cua`. |
| `/Users/dongdong/Desktop/codex-cua-reverse/ARCHITECTURE.md` | Process diagram. |
| `/Users/dongdong/Desktop/codex-cua-reverse/vendor/SOURCE.txt` | Copied-from ChatGPT.app versions. |
