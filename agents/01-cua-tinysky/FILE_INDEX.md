# FILE_INDEX — files opened for tinysky-alt global `cua`

Paths are absolute. One-line role each. Copies of key `.d.ts` / markdown live under `copies/`.

## `@oai/cua` package (required)

- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/package.json` — package name/version; `exports["."]` vs `exports["./tinyskyAlt"]`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_cua/src/index.d.ts` — package-main types: `export { cua } from "./cua"`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_cua/src/index.js` — package-main JS re-export of stub `cua`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_cua/src/cua.d.ts` — unused stub `cua` shape (`initialize` / `computer` / `browsers` / `documentation`).
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_cua/src/cua.js` — unused stub `initialize` via `setupBrowserRuntime` + `sky` without `decorateTab`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_cua/src/get_state.d.ts` — `get_state` / `get_browser_tabs` signatures; optional `browsers?` / `computer?`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_cua/src/get_state.js` — inventory: mac/windows `list_apps`, linux `[]`, merge user+controlled tabs, `allSettled` errors.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_cua/src/tinysky_alt/types.d.ts` — **canonical** `TinySkyAlt`, `Target`, `Tab`/`App`, `GetBrowserOptions`, `SetupOptions`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_cua/src/tinysky_alt/create_tinysky_alt.d.ts` — `create_tinysky_alt(options?): Promise<Omit<TinySkyAlt, "initialize">>`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_cua/src/tinysky_alt/create_tinysky_alt.js` — façade: providers, decorateTab, emit, getBrowser/getTab/createBrowserTab/getApp.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_cua/src/tinysky_alt/globals.d.ts` — `setupCUA` + re-export of types.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_cua/src/tinysky_alt/globals.js` — `globalThis.cua = { initialize }`; singleton `setupCUA` `Object.assign`s the façade.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_cua/src/tinysky_alt/documentation.d.ts` — `read_documentation` / `read_computer_use_confirmation_policy`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_cua/src/tinysky_alt/documentation.js` — reads `docs/tinysky-alt-*.md`; optional `requestMeta` confirmation override (≤12kB).

## `@oai/cua` docs (all four `tinysky-alt-*.md`)

- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/docs/tinysky-alt-core-cua-repl.md` — default injected API (no `initialize` / `browsers` / `computer`); `cua_repl` workflow.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/docs/tinysky-alt-core-node-repl.md` — node_repl variant with `initialize()`, `browsers`, `computer`; mac-only `getApp` note.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/docs/tinysky-alt-other-browser-apis.md` — when to leave AX for Playwright / other Tab APIs.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/docs/tinysky-alt-confirmations.md` — Computer Use confirmation taxonomy appended in `core-cua-repl` mode.

## `@oai/browser` client (bundled inside `@oai/cua`)

- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_browser/dist/skill/scripts/browser-client.js` — CJS copy imported by `create_tinysky_alt` / package-main `cua.js`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_browser/dist/skill/scripts/browser-client.mjs` — ESM: `setupBrowserRuntime`, Tab class (`re`), `playwright`/`ax`/`cua` construction, `decorateTab` proxy hook, `getDefault`/`getForUrl`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_browser/dist/skill/scripts/browser-service.mjs` — backend; Codex Playwright injection (`__codexPlaywrightInjected`).
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_browser/dist/skill/references/api.json` — generated Agent/Browsers/Browser/Tab/AXAPI/PlaywrightAPI contract.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_browser/dist/skill/references/documents.json` — which browser markdown is included vs lookup vs model-requested.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_browser/dist/skill/references/capabilities/browser/visibility.md` — `capabilities.get("visibility").set(boolean)` used by `createBrowserTab({ visible })`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_browser/dist/skill/references/capabilities/browser/management.md` — Chrome-like windows/tabs/bookmarks capability (raw `browser.capabilities`, not TinySky Target).

## `@oai/sky` (native computer), types bundled inside `@oai/cua/dist/project`

- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/sky/package.json` — `@oai/sky@0.6.26`; `"."` and `"./service"`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/sky/docs/sky-window-api.md` — human API reference for mac `WindowComputerUseClient`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/index.d.ts` — `export { sky }` / `SkyClient`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/index.js` — re-export `sky`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/sky.d.ts` — `export declare const sky: T.SkyClient`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/sky.js` — lazy `nodeRepl.rpc("sky", …)` proxy; linux `drag_handle` factory.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/create_client.js` — dispatch linux/mac/windows `create_client`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/load_options.js` — `darwin→mac` / `linux` / `win32→windows` or `OAI_SKY_CONFIG_PATH`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/index.d.ts` — Sky type barrel (`FullDesktop`/`Window`/`Window2`).
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/SkyClient.d.ts` — `SkyClient` union of the three clients.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/Point.d.ts` — `{ x, y }` desktop point (distinct from CUA `AXPoint` tuple).
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/Direction.d.ts` — `"up"|"down"|"left"|"right"|"u"|"d"|"l"|"r"`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/MouseButton.d.ts` — `"left"|"right"|"middle"|"l"|"r"|"m"`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/window/index.d.ts` — mac window API barrel.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/window/WindowComputerUseClient.d.ts` — mac `target:"mac"` method list (`get_app_state`, `click`, `type_text`, …).
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/window/GetAppState.d.ts` — `{ app, disableDiff? } → AppState`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/window/AppState.d.ts` — `{ app, screenshot, text }`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/window/ListApps.d.ts` — `App { id, displayName?, lastUsedDate?, useCount?, isRunning? }`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/window/AppIdentifier.d.ts` — `type AppIdentifier = string`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/window/Click.d.ts` — `element_index?` or `x,y` plus `mouse_button` / `click_count`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/window/TypeText.d.ts` — `{ app, text }`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/window/Paste.d.ts` — `{ app, text, format: "text"|"md"|"html" }`; restores clipboard.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/window/Scroll.d.ts` — direction + element or coords + optional `pages`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/window/SelectText.d.ts` — `prefix`/`suffix`/`selection_type`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/window/SetValue.d.ts` — `{ app, element_index, value }`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/window/PerformSecondaryAction.d.ts` — `{ app, element_index, action }`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/window/PressKey.d.ts` — xdotool-style `key` chords.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/window/Drag.d.ts` — `from_x/from_y/to_x/to_y`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/window/Screenshot.d.ts` — `{ url: string }` data-URL (or file URL at runtime).
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/window/Options.d.ts` — `{ target: "mac" }`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/full-desktop/index.d.ts` — linux full-desktop barrel.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/full-desktop/FullDesktopComputerUseClient.d.ts` — linux `target:"linux"` (`get_screenshot`, `drag_handle`, `move`; no apps).
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/full-desktop/GetScreenshot.d.ts` — `() => Promise<Screenshot[]>`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/full-desktop/DragHandle.d.ts` — `{ start, move_to, end }` with `{x,y}` points.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/types/window2/Window2ComputerUseClient.d.ts` — windows `target:"windows"` (`get_window` / `list_windows`, not `get_app_state`).
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/targets/mac/index.d.ts` — mac target barrel (`export * from "./create_client"`).
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/targets/mac/get_app_state.d.ts` — native `get_app_state` with instruction-set arg.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/targets/mac/get_app_state.js` — policy wrapper → `client.getAppState({ app, disableDiff })`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/project/cua/sky_js/src/targets/mac/list_apps.js` — maps bundleIdentifier/displayName into `AppInfo.id`.

## `@oai/browser-desktop` + cua_node runtime

- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/browser-desktop/package.json` — production browser runtime; `"."` client, `"./service"` backend.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/manifest.json` — darwin-arm64 Node 24.20.0, `node_repl_path: bin/node_repl`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/.package-map.json` — workspace map including `@oai/cua`, `@oai/sky`, `playwright`.

## ChatGPT.app plugin that installs global `cua`

- `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/unified-computer-use/.codex-plugin/plugin.json` — plugin metadata; Interrupt/Stop hooks call `cua_repl.turn_ended`.
- `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/unified-computer-use/.mcp.json` — MCP `cua_repl` → `scripts/launch.mjs`; tools `js`/`js_reset`/`turn_ended`.
- `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/unified-computer-use/scripts/launch.mjs` — picks banner by `CUA_REPL_ENABLED_SURFACES`; sets `NODE_REPL_JS_BANNER` + trusted services.
- `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/unified-computer-use/resources/banner.js` — `setupCUA({ browser: true, computer: true })`.
- `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/unified-computer-use/resources/banner-browser.js` — `setupCUA({ browser: true, computer: false })`.
- `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/unified-computer-use/resources/banner-computer.js` — `setupCUA({ browser: false, computer: true })`.
- `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/unified-computer-use/resources/js-tool-description.md` — first-call protocol: `getState` or a bind entry point, not `initialize`.
- `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/unified-computer-use/resources/browser-description.md` — ChatGPT-specific getTab/createBrowserTab/getBrowser routing.
- `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/unified-computer-use/resources/computer-description.md` — `cua.getApp("Example App")`.
- `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/unified-computer-use/resources/js-output-description.md` — `nodeRepl.write` / `emitImage`; do not double-wrap CUA emits.
- `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/unified-computer-use/resources/js-reset.md` — reset discards JS bindings, not OS/browser state.
- `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/unified-computer-use/resources/server-instructions.md` — one-line: persistent JS session, initialized CUA API.

## Shared JS helpers

- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_core/src/index.d.ts` — core util barrel (`UnreachableCaseError`, `sleep`, …).
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_core/src/UnreachableCaseError.d.ts` — used by `get_state` switch on `sky.target`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_types/src/index.d.ts` — generic TS helpers (not CUA-specific).

## Copies written under this agent dir

- `/Users/dongdong/Desktop/codex-cua-reverse/agents/01-cua-tinysky/copies/` — duplicates of every key `.d.ts`, tinysky-alt markdown, plugin banners, `api.json`, and a pretty-printed `create_tinysky_alt.pretty.js`.
