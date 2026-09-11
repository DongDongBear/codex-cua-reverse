# QUESTIONS — Chrome/Edge extension (after local reverse)

Did not attach to live Chrome, connect `/tmp/codex-browser-use/*.sock`, or dump REPL `browsers.list()`.

## IDs

1. After `cua.getBrowser({ id: "chrome" })` / `agent.browsers.get("chrome")`, is live `browser.browserId` a small integer (IAB used `"1"`), a UUID, or the socket filename? Matcher accepts family alias **and** exact id — need one `list()` dump.
2. When Chrome Default **and** Edge Default both run the same store id, does `list()` show two `type:"extension"` rows (`family:"chrome"` and `family:"edge"`) with **distinct** `extensionInstanceId`s? `get("chrome")` must not return Edge.
3. Two Chrome profiles: this machine has Default (extension on) and Profile 1 (off). If Profile 1 enabled the extension, would `get("chrome")` pick Default or last-used? Preferred-id env is the only documented tie-break.
4. Who sets `BROWSER_USE_PREFERRED_EXTENSION_INSTANCE_ID` / `_CHROME_EXTENSION_INSTANCE_ID` and `PREFERRED_WINDOW_ID`? ChatGPT.app? Not in cua_repl env snapshot from v4.
5. Mention `browserId` is `extensionInstanceId`. Tinysky `cua.getTab(tabId, { browser: browserId })` feeds that into `browsers.get(id)` which tries family/type/exact-id — **not** `metadata.extensionInstanceId`. Does tinysky special-case mentions, or does the skill path (`list` + match metadata) exist only in the chrome plugin docs?

## Claiming

6. After `claimTab`, `Tab.id` vs Chrome `providerTabId`: same string or a new agent id? Tinysky `getTab` later uses whichever `listTabs` stamped.
7. Child tabs from `webNavigation.onCreatedNavigationTarget`: `claimChildTab` auto-leases if the opener is leased. Does that steal popups the user did not mention?
8. `claimTab` of a tab already in an **agent** group: docs say claimed tabs stay out of the agent group. Does an already-grouped user tab get ungrouped?
9. Incognito: `getUserTabs` sets `includeIncognito:!1`. Can agent `tabs.new()` open incognito? Management `windows.create` docs say non-incognito only.

## Visibility / sessionName / viewport

10. Exact native handler for `browser_visibility_set` on Chrome. `focusTab` focuses a window; overlay `isVisible` only hides the cursor. Does `set(false)` no-op, minimize, or only hide overlays?
11. Does `nameSession` run on IAB (no-op / throw / ChatGPT UI title)? Docs omit it for type iab.
12. Viewport `set` on Chrome: CDP `Emulation.setDeviceMetricsOverride`, OS `windows.update` bounds, or both? `setViewportSize` is stored on the tab lease.

## Native host / sockets

13. Who **listens** on `e3a02578-….sock` — ChatGPT.app or the host? lsof shows the host connected; ChatGPT holds other names. Is that socket the **extension backend** `browser-service` should connect to, or only the app-server proxy?
14. Session auth on the unix socket: any required headers besides `agent_request_header_enabled` / `x-browser-agent`? Error string: `This browser requires agent request headers. Update the Chrome extension…`
15. Host still running from deleted `26.901.51231` while manifests point at `latest` (`26.903.61454`). Same binary hash — does a protocol bump require Chrome to relaunch the host?
16. `chrome-native-hosts-v2.json` location (`Codex Chrome native host v2 manifest`). Not next to the binary. Under `~/.codex` / ChatGPT Application Support?
17. JSON-RPC method list **from host → extension** (not only `sendSessionRequest` names). `supportedMethods` is used for `openLocalFile`.

## Capabilities

18. Is `management` always on (`browserManagementEnabled` default `Promise.resolve(true)`) or gated by a Statsig / desktop flag (`codex-app-chrome-extension-browser-management`)?
19. `pageAssets` advertised on every extension tab — does IAB advertise it too?
20. WebMCP files `content-scripts/webmcp.js` are **not** in the unpacked CRX. Registered from the side panel / a later extension version?
21. `getTabContext` is `unsupportedByDefaultIn` all types in `api.json` but chatgpt.com still calls `GET_CHATGPT_BROWSER_TAB_CONTEXT`. Can CUA `browser.user.getTabContext` ever enable via `apiSupportOverrides`?

## Traces / product

22. Confirm with a `browsers.list()` in the live cua_repl that Chrome was listed during task-1 and the model still chose IAB via `getForUrl`. Inventory says backends `chrome,iab`; we did not list.
23. Edge installed the **Chrome Web Store** id, not `odlomjlbamekndcpllcnffbgeohgkmjh`. Is `family` still `"edge"` (UA `Edg/`) so `get("edge")` works?
24. Brave/Opera/Vivaldi: diagnostics and native-host team ids exist; plugin tool text only names iab/chrome/edge. Would `get("brave")` work if Brave + extension were installed?

## Safety / leftovers

25. DNR `x-browser-agent: ChatGPT/<ver>` on leased tabs — sites can fingerprint agent traffic. Intended?
26. `chrome.debugger` on claimed **user** tabs: same attach as agent tabs? User-visible “ChatGPT started debugging this browser” banner?
27. Side-panel Codex UI vs CUA: can the side panel control tabs the REPL also claimed (lease collision `already part of browser session`)?
