# QUESTIONS — remaining unknowns after reading local `@oai/browser-desktop`

Did not attach to a live browser, dump REPL globals, or reverse the native-host protocol beyond string-level service code.

## IDs and selection

1. After `cua.getBrowser({ id: "iab" })`, is `browser.browserId` the literal `"iab"` or an opaque instance id (`codexSessionId` / uuid) that later `createBrowserTab`/`getTab` should reuse? Matcher accepts both aliases and exact ids.
2. Can two extension browsers of the same family exist (two Chrome profiles)? `get("chrome")` is `find(...)` — first match. Preferred instance uses `metadata.extensionInstanceId === browserPreference.extensionInstanceId`. How is that preference set from ChatGPT.app (`BROWSER_USE_PREFERRED_EXTENSION_INSTANCE_ID`)?
3. Are `brave` / `opera` / `vivaldi` actually advertised to the model on this Mac, or only used by diagnostics? Plugin text only names iab/chrome/edge.
4. What does `getForUrl` return when no tab already has that host — default iab even for public https, or the user’s Chrome if the extension is connected?
5. `cdp` type: when does a desktop ChatGPT.app session ever list a `type: "cdp"` browser (GaaS / cloud)? `Tab.requestManualHandoff` is documented as Cloud Browser.

## Claiming / IAB tabs

6. For IAB, `tabs.list()` vs user-opened vs agent-created: is there a `providerTabId` that stays stable across turns after `markHandoff`?
7. `getTabContext` is `documented: false` and `unsupportedByDefaultIn` all three types. Dead code, or gated by an override we did not see advertised?
8. `Tabs.content` (background extract) is unsupported on iab/extension/cdp. Same question.
9. After `claimTab`, does the Chrome tab stay in the user’s tab strip (docs say yes, no agent tab group)? Any visual badge besides `nameSession`?

## Visibility / sessionName

10. Does IAB `nameSession` no-op, throw at the native layer, or name something in the ChatGPT UI?
11. Does `{ visible: true }` on Chrome/Edge focus the OS window, or only an in-extension side panel / agent tab group?
12. Viewport `set` vs OS window resize vs CSS viewport — which actually changes?

## Playwright / AX

13. Confirmed in service `readBrowser`: `undocumentedApiMembers` are added to `disabledApiMembers` before `documents.json` include filtering, so `accessibility.md` is dropped under tinysky. Live `tab.ax` remains if `apiSupportOverrides["Tab.ax"]` is set. Still unverified at runtime that the override is always present on desktop IAB/Chrome.
14. Client Playwright class has `goBack`/`goForward` not listed in `api.json` PlaywrightAPI. Callable, or stripped by the disabled-member proxy?
15. `playwright.evaluate` is read-only. Is there any supported write-eval besides CDP `send` (which is confirmation-gated and origin-scoped)?
16. AX `unsupportedByDefaultIn: ["iab","extension","cdp"]` but iab/extension re-enable via `apiSupportOverrides["Tab.ax"]`. If an override is missing, tinysky `tab.click` would call `tab.ax.click` and fail — is that override guaranteed on desktop?

## mcp__cua_repl

17. Exact model-visible tool name: intercept namespace is `mcp__cua_repl` with nested `js`; traces log `"name": "js"`. Is the wire name `js`, `mcp__cua_repl.js`, or `mcp__cua_repl__js` depending on the client?
18. `js_reset` text says “next cua_repl.js call”. Is that leftover naming from an older single-tool server?
19. `turn_ended` is in `enabled_tools` and plugin Stop hooks, but not in the intercepted namespace tools array. Model-hidden on purpose?
20. `omit_tools_from: ["code_mode", "deferred"]` — does code mode lose browser control entirely?

## Packaging split

21. Why does tinysky import `oai_js_browser/.../browser-client.js` while `NODE_REPL_TRUSTED_SERVICES` points at `@oai/browser-desktop/service`? Client hashes match; service hashes do not (~31KB). Which documents.json does `handleRpc` actually read (desktop package next to the service)?
22. `oai_js_browser` references still have `browser-safety-training.md` and a smaller `documents.json`. Dead, or used when `environment !== "codex-app"`?

## Native host / extension

23. `chrome-troubleshooting.md` tells the model to run `scripts/chrome-is-running.js` from “the plugin root”. That plugin is not `@oai/browser-desktop` (no such scripts there). Which plugin directory is cwd for those commands?
24. Native-host pipe names (`/tmp/codex-browser-use`, `\\.\pipe\codex-browser-use`) — session auth, required headers (“This browser requires agent request headers. Update the Chrome extension…”): not documented for the model. What breaks if the extension is stale?

## Auth / CDP / WebMCP gates

25. `assertRequiredDocumentationRead` throws unless `confirmations` and `capabilities/tab/cdp` (or webmcp/browserAuth) were `documentation.get`’d. Tinysky excludes `confirmations` from browser first-use because it already printed computer-use confirmations. Does the service still demand `agent.documentation.get("confirmations")` before `tab_cdp_call`?
26. `full_cdp_access` / enterprise policy strings exist. Default for ChatGPT.app desktop: permitted CDP allowlist vs full CDP?

## Trace vs docs mismatch

27. Task 1 called `getBrowser({ url: "https://ant.design/..." })` then `getTab("1")` instead of `createBrowserTab("iab", url, { visible: true })`. Did that reuse an already-open IAB tab, and is tab id `"1"` an IAB provider id that happens to be stable?
28. Same trace used `browser.tabs.get("1")` in parallel with `cua.getTab` — is `globalThis.agent` / the `browser` handle from getBrowser the supported long-lived binding (“Reuse this browser binding across later turns”)?
