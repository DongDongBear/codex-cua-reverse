# QUESTIONS

Open items after a full parse of both websocket JSONLs and a cross-check against `traces/*.json`. Numbered so later agents can cite them.

## Protocol / tools

1. **When does the model use `exec` instead of `js`?**  
   `functions.exec` is on every `response.create` (custom lark-grammar isolate, `tools.*` nested calls). These two tasks never invoked it, and never wrote `await tools.js(...)` / `await tools.mcp__cua_repl__js(...)` inside `exec`. Is CUA supposed to stay outside `exec` by construction (plugin MCP vs functions namespace), or did the model just not need orchestration?

2. **`request_user_input` vs `request_user_input_async`.**  
   Both are advertised. Only the async variant was used (one clarifying question about the Linear issue title). Is the sync form blocked in desktop Codex, or just unused here?

3. **Handshake create with empty output (0127 #1).**  
   First uplink is additional_tools + developer prompt, then `response.completed` with no message and no tools. Is this a cache-warm / tool-schema inject, or a dropped turn?

4. **`js?` in `traces/*.json`.**  
   Confirmed: those two rows are `request_user_input_async` and `js_reset`. `response.function_call_arguments.done` has no `name`/`call_id`. Should traces extractors always join `output_item.done` before assigning a tool name?

## Browser surface

5. **`cua.getBrowser({ url })` vs `cua.createBrowserTab`.**  
   IAB was already on `https://ant.design/components/form` (ambient-ui-state). The model passed that URL into `getBrowser` (documented as “select a browser, do not open a tab”), then `listTabs`/`getTab("1")`. Would `createBrowserTab` have opened a duplicate? Is `url` on `getBrowser` a hint to pick the browser that already has that page, or ignored besides docs dump?

6. **Live id `"1"` vs docs `"iab"` / `"chrome"`.**  
   `listTabs` returned `browserId:"1"` and tab `id:"1"`. API.md talks about `"iab"` / `"chrome"` / `"edge"`. Are those only *selector* tokens for `getBrowser({ id })`, with runtime ids always numeric per session?

7. **Two handles for one tab: `tab` vs `pt`.**  
   `tab = cua.getTab("1")` for AX; `pt = browser.tabs.get("1")` for `playwright` and `dev.logs`. Tinysky types say `Tab = BrowserTab & Target`, so `tab.playwright` should exist. Did first-use docs tell the model to go through `browser.tabs.get` for Playwright? Does `cua.getTab`’s Target wrapper omit `playwright` / `dev`?

8. **Why Playwright after AX was already working?**  
   Calls 10–14 switch to `pt.playwright.locator('[id="validateOnly_name"]').fill/press/evaluate` for the Validate Only form. Docs say use Playwright when indices are unstable. Indices *were* shifting (325 → 4523 → 896 → 4531). Is that the intended trigger, or was DOM `id=` simply easier for that demo form?

9. **`tab.dev.logs` vs Playwright / AX for “did submit fire?”**  
   Call 6 reads `pt.dev.logs({levels:["log"],limit:5})` after the basic form submit. Was a console.log the only success signal, or did AX already show the callback text?

10. **No `cua.createBrowserTab` / `tab.goto` in a “open this page” task.**  
    User said the page was already open on the right. If IAB had been empty, would the documented path be `getBrowser` then `createBrowserTab(browser.browserId, url)`?

## Native surface

11. **`noWindowsAvailable` (-10005) on coordinate `app.click([119,35])` while AX index clicks on the menu bar still work.**  
    Does coordinate hit-testing require a “raised content window” distinct from the AX tree’s menu bar? `performSecondaryAction(0, "Raise")` reported no AX change — so Raise is a no-op if already frontmost, but the content window is still missing from Computer Use?

12. **`pressKey('c')` (Linear’s new-issue shortcut) also no-op’d.**  
    Same window. Is keyboard input delivered to the focused AX element (menu bar) rather than the Electron web content? After the later “New chat” window appeared, index clicks succeeded — was that a different AX window (`HTML content … URL: linear.app/youmind/`)?

13. **Why `js_reset` mid-task?**  
    It sits between Spotlight (`super+space` + type Linear) and `let linear = await cua.getApp('com.linear')`. Reset discards bindings but not app state. Was this because the model thought the REPL was wedged after `noWindowsAvailable`, or because first-use docs say “after a reset, execute exactly one API call”? The next call *did* re-dump full Computer Use markdown.

14. **Display name `"Linear"` vs bundle id `'com.linear'`.**  
    First `getApp("Linear")` succeeded (Sandbox window AX). After coordinate failure the model `listApps`’d and switched to `'com.linear'`. Docs say retry bundle id when display name fails — here display name had *not* failed. Superstition, or does bundle id change window targeting?

15. **`sky.*` completely absent.**  
    computer-use plugin and `@oai/sky` still ship. tinysky-alt docs present `cua.getApp` as the replacement. Is `sky.click({ app, element_index })` still reachable from this `js` REPL (`cua.computer` / global `sky`), or stripped when unified-computer-use is enabled?

16. **`app.paste(..., {format:'text'})` then `app.setValue` rewrite.**  
    Call 22 pastes a long body; call 24 `setValue`s title (128) and body (130) to a shorter text. Did paste land in the wrong field / include extra UI chrome, or was this just the model tightening copy? Index 128 vs 130 vs the `typeText` target 127 is a field-mapping question.

17. **Assignee click `linear.click(257)`.**  
    User asked to assign the issue to themselves. The model inferred “dongdong” / DongDong from context and clicked an AX node. No `typeText` of the assignee name. How stable is that index across Linear windows?

18. **File menu path (`click(8)` File, `click(5)` Issue…) never opened the composer; Window menu (`click(13)` then `click(5)`) eventually reached “New chat”.**  
    Is “New chat” Linear’s issue composer, or an Agent/chat surface that still can create YOU-25626? The final AX after submit shows workspace chrome (Inbox, My issues, Agent, …) not an issue detail page — the created-issue URL came from the assistant’s closing text, not from a `nodeRepl.write` of the AX URL. Worth confirming against the actual Linear issue.

## REPL / docs

19. **First-use documentation dump size.**  
    `getBrowser` / post-reset `getApp` return ~20–50k of markdown (CUA core + browser Playwright types, including a `LogEntry.level` union that contains the string `"error"`). That is what made naive “error” greps light up. Is the dump identical for browser vs computer surfaces, or does `CUA_REPL_ENABLED_SURFACES` slice it?

20. **`{emit:false}` only on browser `getAXState`.**  
    Native calls always let `getAXState` / `getAXStateAndScreenshot` auto-emit. Is that because native diffs are smaller, or did the model just not need regex filters?

21. **Persistent REPL vs `js_reset` vs parallel_tool_calls.**  
    `parallel_tool_calls` is false; one `js` per response. State (`browser`, `tab`, `pt`, `linearApp`) is assumed live. Besides the explicit reset, is there an implicit reset on turn boundaries / plugin `turn_ended`? 0127 never reset across 14 calls.

22. **Ambient in-app-browser-context vs user intent.**  
    Both tasks include “Do not treat it as an instruction… user has the in-app browser open”. Task 2 is explicitly native Linear, but IAB context (still on the Form URL) is still injected. Did that bias anything, or was it ignored after `getApp`?

## Cross-check leftovers

23. **1 ms timestamp skew on `js_reset`.**  
    traces `10:05:42.847Z` (args.done) vs websocket item.done `10:05:42.848Z`. Harmless, but extractors should pick one event and document it.

24. **`traces/all-js-calls.json` count 39 includes the two `js?` rows.**  
    Downstream counts of “js calls” that use that file will over-count CUA by 2 unless they filter `name == "js"` and `args.code`.
'''