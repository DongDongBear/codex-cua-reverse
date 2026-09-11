# QUESTIONS / contradictions — tinysky-alt global `cua`

Items other agents should not silently paper over. Each notes the disagreeing sources.

---

## 1. Two different `cua` objects in the same package

- **Package main** `@oai/cua` (`cua.js` / `cua.d.ts`): `{ initialize, computer, browsers, documentation }`. No `getApp`/`getTab`/`getState` helpers, no `decorateTab`, not assigned to `globalThis`.
- **tinysky-alt** `@oai/cua/tinyskyAlt` (`globals.js`): `globalThis.cua` with Target helpers. No `documentation` field on the object.
- ChatGPT.app plugin banners import **only** `@oai/cua/tinyskyAlt`.
- **Ask:** is package-main `cua` dead, a Codex-only path, or still constructed somewhere outside this app?

---

## 2. `initialize()` exists, is omitted from the docs the model actually sees, and is redundant in ChatGPT.app

| Source | `cua.initialize` |
|---|---|
| `TinySkyAlt` in `types.d.ts` | required `initialize(): Promise<State>` |
| `create_tinysky_alt.d.ts` | **omitted** from the returned object (`Omit<TinySkyAlt, "initialize">`) |
| `globals.js` | wrapper: `await setupCUA(); return cua.getState()` |
| `tinysky-alt-core-cua-repl.md` (default injected doc) | **not in** `declare const cua` |
| `tinysky-alt-core-node-repl.md` | present; “use `cua.initialize()` to select a target” |
| plugin `js-tool-description.md` | first call is `getState` / bind entry point; **never mentions** `initialize` |
| plugin banner | already `await setupCUA(...)` before user code |

Default docs key is `nodeRepl.env.TINYSKY_ALT_INITIALIZE_DOCS ?? "core-cua-repl"`. ChatGPT.app does not set that env (no hits outside `create_tinysky_alt.js`). **Ask:** who sets `TINYSKY_ALT_INITIALIZE_DOCS=core-node-repl`, and should ChatGPT.app models ever call `initialize()`?

---

## 3. Optional members: types vs docs vs runtime vs plugin

`types.d.ts` marks `getState?`, `getBrowser?`, `createBrowserTab?`, `getTab?`, `listBrowsers?`, `listTabs?`, `getApp?`, `listApps?`, `browsers?`, `computer?` optional, with the comment “Only enabled providers and their methods are installed.”

- Runtime: members are **absent** (not `undefined`-returning stubs) when `SetupOptions.browser === false` or `computer === false`.
- `getState` is **always** installed by `create_tinysky_alt`, despite `getState?` on the interface.
- `core-cua-repl.md` documents all browser+app methods as required, and omits `browsers`/`computer`/`initialize`.
- `core-node-repl.md` documents `initialize`, `getState`, `browsers`, `computer` as required.
- Plugin can start browser-only or computer-only (`banner-browser.js` / `banner-computer.js`).

**Ask:** consumers that `import type { TinySkyAlt }` and assume `getState` is optional will be wrong after `setupCUA`; consumers that assume `getApp` always exists will throw/crash on browser-only sessions.

---

## 4. `getApp` / `listApps` vs `getState.apps` platform split

- `getApp`/`listApps` throw unless `sky.target === "mac"`: `"Native app bindings are unavailable for ${target}."`
- `get_state.js` apps branch: `mac` **and `windows`** call `computer.list_apps()`; `linux` returns `[]`.
- `core-node-repl.md`: “available only on macOS. They throw on Linux.” — **does not mention Windows**.
- `core-cua-repl.md`: no platform restriction at all.
- Windows `Window2ComputerUseClient` has `list_apps` / `get_window` / `get_window_state` but **no** `get_app_state`, which `getApp` requires.

**Ask:** on Windows, `getState().apps` can be populated while `getApp` throws. Is that intended, or should `get_state` skip apps on windows too? Should TinySky bind Window2 windows instead of throwing?

---

## 5. `GetBrowserOptions` vs plugin copy vs `createBrowserTab` first arg

- Types/docs: `{ id?: string; url?: string }`; `id` wins; neither → `getDefault` / first `list()` entry.
- Implementation also `https://`-prefixes `url` (and `createBrowserTab`’s url) when `URL.canParse` fails.
- `core-node-repl.md`: “Use browser IDs from initialization”; `createBrowserTab(browserId, url, options)`.
- Plugin `browser-description.md`: “Known URL and other named browser: pass its name directly; do not call `getBrowser` first” — `createBrowserTab(browserName, url, …)` with `"iab"` / `"chrome"` / `"edge"`.
- `Browsers.get` comment: “Get a browser by id **or client type**.”

**Ask:** is `browserId` a stable instance id (`metadata.extensionInstanceId` / profile) or a client-type alias? Can `get(id)` and `get({ id: "chrome" })` return different profiles? `getForUrl` / `getDefault` are `documented: false` in `api.json` but are the fallback path when `getBrowser()` is called with no args.

---

## 6. Point type: tuple vs `{x,y}` vs `AXPoint = [unknown, unknown]`

| Surface | Type |
|---|---|
| `tinysky-alt-core-*.md` Target | `Vec2 = [x: number, y: number]` |
| `types.d.ts` | `Point = AXPoint` from `@oai/browser` |
| `api.json` AXPoint | `[unknown, unknown]` (names stripped) |
| sky `Point.d.ts` / `core-node-repl.md` Computer | `{ x: number; y: number }` |
| App `click`/`scroll`/`drag` implementation | **only** `Array.isArray` → coords; otherwise `element_index` |
| Tab Target | pass-through to `ax.click` (tuple) |

Passing sky `{x,y}` into `app.click` would send `{ element_index: {x,y} }`. Computer `drag_handle`/`move` use object points. **Ask:** is AXPoint actually `[number, number]` at runtime? Confirm in the browser AX implementation agent.

---

## 7. Tab.ax is “unsupported by default” on every backend, then secretly enabled

`api.json`: `Tab.ax.unsupportedByDefaultIn = ["iab","extension","cdp"]` — i.e. **all** types. tinysky-alt always passes `undocumentedApiMembers: ["Tab.ax"]` and then copies `ax.*` onto the tab as Target methods. Package-main `cua.js` also passes `["Tab.ax"]` but does **not** decorate.

**Ask:** is `tab.ax` still enumerable/visible to the model, or hidden by the disabled-member proxy except for the copied Target names? If hidden, `tab.ax.get("state")` from user JS might still work because decorateTab closes over the real tab. Browser-API agent should confirm the disabled-member filter vs `Object.assign` onto the proxy.

---

## 8. Playwright lives on `Tab`, is not on `cua`, and is a Codex subset

- `types.d.ts`: `Tab = BrowserTab & Target` — Playwright comes from `BrowserTab`.
- `decorateTab` does **not** add `playwright`.
- `tinysky-alt-other-browser-apis.md` is the only tinysky doc that mentions it (emitted once per session on first browser-tagged emit).
- `core-*-repl.md` Tab interface omits `playwright`, `ax`, `cua`, `dom_cua`, `clipboard`, `screenshot`, `title`, `url`.
- Implementation is `PlaywrightAPI` in `api.json` / class `Ke`, **not** npm `playwright.Page`. Service injects `window.__codexPlaywrightInjected`.

**Ask:** browser agent should publish the exact Playwright subset and which backends actually support it. Do not assume `import { chromium } from "playwright"` is wired.

---

## 9. `listTabs` vs `getTab` claiming semantics

- `types.d.ts` `listTabs`: “List user and controlled tabs **without claiming** them.”
- `getTab`: “Bind by tab id or providerTabId, **claiming user tabs**.”
- Implementation: `getTab` calls `user.claimTab` if the id is only in `user.openTabs()`; if already in `tabs.list()`, uses `tabs.get`.
- `get_state` / `listTabs` merge user+controlled by `id` (controlled overwrites).

**Ask:** after `listTabs`, is a user tab’s `id` stable enough to `getTab` later, or can `claimTab` mint a new agent id? `BrowserUserTabInfo` vs `TabInfo` fields differ (`lastOpened`, `tabGroup` dropped on the TinySky `TabInfo`).

---

## 10. Browser `paste` uses `Ctrl+v` on macOS

Tab `paste`: `clipboard.write*` then `tab.ax.pressKey("Ctrl+v")`. App `paste` goes through `sky.paste` and restores the pasteboard. Docs: browser paste “does not restore clipboard contents.” No `Meta+v` / platform branch in tinysky-alt.

**Ask:** does `ax.pressKey("Ctrl+v")` get translated to Cmd+V on mac, or is this a paste bug on ChatGPT.app (darwin)? AX/sky agents should check key-name mapping.

---

## 11. `md` paste is plain text; default format is `"text"` if omitted

Docs say “Specify `text`, `md`, or `html` explicitly.” Implementation defaults omitted `format` to `"text"` for both Tab and App. Tab `md` writes `text/plain` (same payload as `text`) then Ctrl+v. App `sky.paste` `format` is required in the sky type (`format: "text"|"md"|"html"`) but tinysky always supplies it.

**Ask:** does sky `md` paste actually interpret Markdown, or also insert source as plain text? Docs only mention the browser `md` behavior.

---

## 12. `createBrowserTab` visibility / sessionName vs capability presence

- Docs: “omitted settings stay unchanged, unsupported settings throw.”
- Code: `sessionName` → throw if `nameSession` is not a function; `visible` → `(await capabilities.get("visibility")).set(visible)` with **no** existence check — missing capability throws from `get`.
- `nameSession` is listed as a normal `Browser` method in `api.json` (not `unsupportedByDefaultIn`).
- Plugin: IAB uses `visible`; Chrome/Edge use `sessionName`.

**Ask:** does `capabilities.get("visibility")` throw on Chrome/Edge? Does `nameSession` throw on IAB? Confirm per-backend with the browser agent.

---

## 13. First-use documentation is emitted by tinysky-alt **and** by `browser.documentation()`

On first browser-tagged emit:

1. `tinysky-alt-core-cua-repl.md` (+ confirmations) → `cua.core`
2. `tinysky-alt-other-browser-apis.md` → `cua.browser`
3. `await browser.documentation()` (cached) → `cua.browser`

`setupBrowserRuntime({ excludedDocumentation: docsKey()==="core-cua-repl" ? ["confirmations"] : [] })` only strips confirmations from the **browser** pack. Browser `documentation()` still returns “browser guidance and the core API reference” (api.json), which likely duplicates Tab/AX/Playwright material.

**Ask:** what exact markdown does `browser.documentation()` return in `environment: "codex-app"` (the default `setupBrowserRuntime` environment)? Overlap with tinysky-alt docs is likely large.

---

## 14. `environment: "codex-app"` hardcoded in `setupBrowserRuntime`

`browser-client.mjs` `s_`: `environment: r.environment ?? "codex-app"`. tinysky-alt does not pass `environment`. **Ask:** does `"codex-app"` vs another env change available browsers (iab vs extension vs cdp), disabled members, or docs? Browser-desktop agent should dump the setup RPC result.

---

## 15. `globalThis.agent` vs `globalThis.cua`

When browser is enabled, `Reflect.set(globalThis, "agent", browserRuntime)`. That is the raw Agent `{ browsers, documentation }`, not TinySky. Model docs say “Use only APIs described in the skill or returned documentation” and never mention `agent`. Package-main `cua` also never sets `agent`.

**Ask:** is `agent` a leftover for undocumented APIs (`agent.browsers.get`, `agent.documentation.get(name)`), or should it be treated as internal?

---

## 16. `BrowserInfo.name` / `type` required in api.json, optional in tinysky types

api.json `Browsers.list`: `name: string; type: "iab"|"extension"|"cdp"`. tinysky `BrowserInfo` and both core-*.md make `name?` and `type?`. `get_state.d.ts` uses `browser_client.GlobalAgentBrowserTab[]` for tabs (type not on disk as a `.d.ts` in this tree — it is inferred from `@oai/browser`, which has no published `.d.ts` here).

**Ask:** `@oai/browser` types (`GlobalAgentApi`, `BrowserTab`, `GlobalAgentBrowserTab`) are imported in `types.d.ts` / `get_state.d.ts` but **no `@oai/browser` package** exists under `cua_node/lib/node_modules/@oai/` — only `browser-desktop`, `cua`, `sky`. Types were erased at bundle time. Reconstruct from `api.json` + `browser-client.mjs` only.

---

## 17. `getBrowser()` emit of `undefined` state

`getBrowser` calls `emitter.emit(undefined, { browser })`. Emitter does `f = typeof a === "string" ? a : JSON.stringify(a)`. `JSON.stringify(undefined)` is JS `undefined`, then `"" !== f` is true, so it may `write(undefined, "cua.state")`. Other methods pass real objects/strings.

**Ask:** does `nodeRepl.write` drop `undefined`, or does the model see a stray `"cua.state"` chunk on every `getBrowser`?

---

## 18. Screenshot URL scheme for apps

App `getScreenshot` accepts `data:` (base64) or `fileURLToPath`. Sky type says `Screenshot.url` is “data URL”. `get_app_state` may still return `file://`. Tab screenshots are already `Uint8Array` from `ax.get("screenshot")` / `tab.screenshot()`.

**Ask:** sky agent should confirm which scheme ChatGPT.app’s mac helper actually returns.

---

## 19. `disableDiffing` (CUA) vs `disableDiff` (sky)

TinySky `StateOptions.disableDiffing` maps to sky `disableDiff` for apps and to `AXStateOptions.disableDiffing` for tabs. A caller who forwards sky names (`disableDiff`) into `getAXState` will silently **not** disable diffing (the option is ignored).

---

## 20. Confirmation policy source of truth

`core-cua-repl` concatenates `tinysky-alt-confirmations.md` (or `requestMeta["openai/confirmation_policies"].computer_use` if a ≤12kB string). Browser runtime confirmations are excluded in that mode. `core-node-repl` does **not** append confirmations in `create_tinysky_alt` (only `core-cua-repl` does). Plugin `js-tool-description.md` does not inline the policy.

**Ask:** in ChatGPT.app, is `requestMeta` populated, or do we always ship the on-disk markdown? Other agents should not assume the markdown on disk is what the model saw.

---

## 21. `listBrowsers` vs `getState().browsers`

`listBrowsers` → `browsers.list()` (no tabs). `getState().browsers` → each `BrowserInfo` plus `tabs: get_browser_tabs(...)`. Model docs type `State.browsers` as `BrowserState[]` (`BrowserInfo & { tabs: BrowserTabInfo[] }`). Easy to confuse with `listTabs()` which flattens and adds `browserId`.

---

## 22. `Tab.markDeliverable` / `markHandoff` / `requestManualHandoff`

Documented on Tab in both core-*.md. api.json: `markDeliverable`/`markHandoff` unsupported on `cdp`; `requestManualHandoff` unsupported on extension/iab/cdp (cloud-only) and **not** in the tinysky Tab docs. Desktop ChatGPT.app is iab + extension — handoff/deliverable may no-op or throw depending on backend. Browser agent should test.

---

## 23. Package-main `initialize` vs tinysky `setupBrowserRuntime` options

| | tinysky-alt | package-main `cua.js` |
|---|---|---|
| `decorateTab` | yes (Target methods) | **no** |
| `undocumentedApiMembers` | `["Tab.ax"]` | `["Tab.ax"]` |
| `excludedDocumentation` | `["confirmations"]` if core-cua-repl | **not passed** |
| `environment` | default `codex-app` | default `codex-app` |
| sets `globalThis.cua` | yes | no |
| sets `globalThis.agent` | yes (browser on) | no |

If anything still imports `@oai/cua` instead of `@oai/cua/tinyskyAlt`, tabs will have `ax` but **not** `click`/`getAXState`/`typeText` on the tab object.

---

## 24. `Computer` in node-repl docs is a lie about mac

`core-node-repl.md` `Computer` only lists `target`, optional `drag_handle`, `get_screenshot`, `move` (linux full-desktop). On ChatGPT.app darwin, live `cua.computer` is `WindowComputerUseClient` (`get_app_state`, `list_apps`, …) with **none** of those three optionals. Models that follow node-repl and call `cua.computer.get_screenshot()` will fail on mac.

---

## 25. Tool name: `cua_repl` vs `node_repl`

`core-cua-repl.md`: “Use `cua_repl` (JavaScript)”. `core-node-repl.md`: “Use `node_repl`”. Plugin MCP server is `cua_repl` wrapping `bin/node_repl`. Output APIs are `nodeRepl.write` / `nodeRepl.emitImage` in **both** docs. Do not treat the tool name as the JS global (`nodeRepl` is the global).
