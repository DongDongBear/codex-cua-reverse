# QUESTIONS — remaining IAB unknowns

Local disk + Task 1 intercept only. Did not attach to `/tmp/codex-browser-use`, dump a live `getInfo`, or watch `will-attach-webview`.

## IDs

1. `kY` (service browser id) and `nextCdpTabId` (IAB tab id) both start at `1` and are process-global. After `js_reset` or a second conversation in the same `cua_node`, is the next IAB still `"1"` (pipe reused) or `"2"`? Task 1 was a fresh REPL.

2. Tab-mention `browserId=` is `metadata.codexSessionId` (conversation id). Live `cua` handles use `browser.browserId` `"1"`. Does any model-facing mention ever put `"1"` or `"iab"` in `browserId=`?

3. Agent-created `providerTabId` is branded `browser-use:${uuid}`. User tabs look like raw UUIDs (`e118c787-…`). Is that brand stripped before mention encoding, or do agent-tab mentions include the prefix?

## Visibility / layout

4. `setBrowserVisibleForBrowserUse(true)` — does it always open the **right** pane, restore the last side, or follow `windows.tabs.open` placement? Task 1 never called it; the user already had the right pane open.

5. Hidden host (`hostKind: "hidden-browser-use"`, `shouldPaint: false`) vs visible sidebar: does AX/screenshot still work purely via `setPageCapturePaintLeaseEnabled`, or must the guest paint at least once?

6. Subagent throw `IAB visibility is not supported in a subagent thread` — can a subagent still drive a hidden IAB tab?

## Cleanup

7. `turnEnded` + `markHandoff` + `lifetime === "temporary"`: implementation **keeps** the tab and only deletes the mark. Next turn must re-mark or the following `turnEnded` will `closeTab`. Confirm this matches product intent (docs say “marked tabs survive the turn and are available in later turns”).

8. `markDeliverable` on a temporary tab calls `releaseTab` (leave open, drop session control), not `closeTab`. Is the released tab then indistinguishable from a user-opened persistent tab in `tabs.list()`?

9. Unmarked **user** tabs that became `sessionControlled` via `getTab` are `releaseTab`’d because `lifetime === "persistent"`. Is `sessionControlled` cleared on the host (`isBrowserUsePage`)?

## UA / partition

10. Owl prefix `CodexBrowser` applies only to openai.com / chatgpt.com / chatgpt.site / chatgpt-team.site. What UA does `ant.design` actually see (Task 1)? Likely stock Chromium + Codex Desktop product tokens, but not verified with `navigator.userAgent`.

11. Do per-tab partitions `persist:codex-browser-app-route:{conversation}\0{tab}` share cookies with `persist:codex-browser-app` (settings / password manager)? `browser-session-queries` probes a ChatGPT login profile — which partition?

12. `setInAppBrowserFeatureEnabled` “Failed to clear Sites authentication cookies” — does enabling IAB wipe Sites cookies, or the reverse?

## getForUrl / default

13. If Chrome is connected **and** IAB has no matching tab, does public `https://ant.design/...` still pick IAB (`$o` prefers iab after hostname miss)? Code: after hierarchy miss → `$o(n)?.id ?? $o(o)?.id` so **yes, IAB wins**. Confirm against a machine with both backends.

14. `getBrowser({ url })` with a URL already open in **Chrome** but not IAB: ranking would select Chrome. Task 1 had the page in IAB. Not observed.

## CDP / Playwright

15. Live first-use advertised tab `cdp` and `webmcp`. `$Y` injects `cdp` only when full-CDP is enabled; `jY` strips webmcp if disabled. Which Statsig/config bits were on for Task 1 (`browser_use_full_cdp_access`, `webMcp`)?

16. `playwright.evaluate` is read-only. IAB `iabInputTargetToken` is required for locator press/type. Any other IAB-only Playwright forks besides scroll=`mouseWheel` and that token?

17. `Tab.ax` is `unsupportedByDefaultIn` all types and re-enabled via `apiSupportOverrides["Tab.ax"]` for iab/extension (per agent 03). IAB `getInfo` snippet we extracted did **not** list `Tab.ax: true`. tinysky still calls `tab.ax.click`. Is AX enabled by the service after `getInfo` (`qY` tinysky flag `codex-browser-use-tinysky`) rather than in `getInfo`?

## Socket / multi-window

18. `/tmp/codex-browser-use` listing: one socket per window? per conversation? per app lifetime? `DY` closes IAB backends whose `codexSessionId` ≠ current conversation, so extra sockets are expected.

19. `ensureBrowserUseSessionRoute` throws `No ChatGPT browser route is available for browser session ${conversationId}` if the renderer never captured a route. What user-visible action creates the route (`browser-use session route capture` IPC)? Opening the right pane? First `getBrowser`?

20. `windows.tabs.open` `type: "page"` throws `Page tabs are unavailable`; `type: "browser"` works. Dead API or cloud-only?

## Sites

21. How tightly is `plugins/sites` bound to IAB? Skill text for browser says use IAB for localhost after frontend changes. Does Sites deploy preview automatically `createBrowserTab("iab", url)` or only when the model chooses to?

## History / nameSession

22. Live IAB API dump listed `browser.history()` and `nameSession`. `getUserHistory` throws unless `inAppBrowserUseHistory`. Was that flag on (dump listed the method) or does doc generation ignore `unsupportedByDefaultIn` when the override is absent?

23. IAB `nameSessionForBrowserUse` is a no-op besides validating `name`. Does calling it from `createBrowserTab(..., { sessionName })` succeed on IAB (method exists) and silently do nothing — i.e. Chrome-style `sessionName` on IAB does **not** throw?

## Task 1 leftovers

24. `browser.tabs.get("1")` vs `cua.getTab("1")`: same `cdpTabId`. Does `tabs.get` skip the tinysky AX emit (yes — Task 1 used it to grab `playwright`/`dev` without a second 119k dump)? Intended long-lived binding is the `browser` from `getBrowser` (“Reuse this browser binding across later turns”).

25. First-use included WebMCP even though no page tools were used. Are WebMCP docs included whenever the **backend** advertises the cap, independent of the current document?
