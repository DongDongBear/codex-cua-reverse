# QUESTIONS — unresolved after local `@oai/sky` read

No exploits, no live IPC against the service. These are gaps in the **types + JS + string dump**.

## Identifier resolution

1. Exact match order for `app: string` in Swift (`localizedName` vs `CFBundleName` vs path vs bundle id vs process name). JS only forwards the string.
2. Spotlight predicate is truncated in the binary (`kMDItemLastUsedDate_Ranking >= $time.today(-`). Nearby copy says “used in the last **14 days**” — not confirmed as the query bound.
3. Are **running-but-never-used** apps always in `list_apps` via `NSWorkspace.runningApplications`, or only Spotlight hits + running?
4. Native `isFrontmost` / `appPath` are dropped by JS `list_apps`. Any caller besides telemetry that needed them?
5. When policy rewrites `app` → `appPath`, does a later `get_app_state({ app: "Chrome" })` still hit the same session, or is the session keyed by path/bundle?

## Launch-if-not-running

6. Public JS never calls `MacComputerUseClient.startApp` / `ComputerUseIPCAppStartRequest`. Is that RPC only for the MCP CLI / older tool schema whose docstring is still in the binary (“This must be called once per assistant turn…”)?
7. Launch configuration: hidden vs `activateIgnoringOtherApps`. Plugin says “background”; binary has `activateIgnoringOtherApps:`.
8. Which process is launched if two `.app` bundles share a name? (`ambiguousApp` covers shared **bundle id**; name collisions are unspecified.)

## AX + screenshot + diffs

9. Coordinate space: screenshot **pixels** vs logical **points**. Native flag `should_normalize_screenshot_to_point_resolution` is not wired in JS.
10. Exact settle timings. Plugin: ~1 s + up to 5 s on loading indicators. Native: `needsUISettleBeforeSkyshot`, `lockUISettleDelay`, `lockUIFallbackDelay` — numeric values not in JS.
11. When `feature/axTreeDiffing` is off server-side, does `disableDiff: false` still return a full tree?
12. Diff marker dialect: one string uses `~ + -`; another uses `~ +` plus “Removed element IDs” ranges. Which ships in this 26.902.1000968 build by default?
13. Cumulative-vs-previous diff: when does the service emit “cumulative diff from the initial accessibility tree” vs “diff from the previous”?
14. Why does JS suppress `<app_specific_instructions>` for `com.apple.iWork.Numbers` while still shipping `Numbers.md` in the bundle?
15. Does GetSkyshot always include a screenshot file even when the classifier says the frame has no useful image (`feature/skyshotClassifier`)? JS throws if `skyshot` is missing, but allows null/empty URL.

## Policy / safety

16. Full `forbidden` / `denied` / `high` vs `low` tables. Only a handful of bundle ids appear as C strings (`SecurityAgent`, Terminal, iTerm, 1Password, Safari, Finder, System Settings, Dock, …). Logic is compiled.
17. `allowPersistentApproval` criteria (org MDM vs per-app risk).
18. `blockedURL` (−10015): which URL patterns? Binary mentions Google Docs-ish regex nearby; not mapped.
19. Does org-policy `denied` skip elicitation entirely? JS throws before `createElicitation` on `denied`/`forbidden`.

## Window2 vs window on Mac

20. Will window2 ever be a Mac target, or is the name only “second window API” for Windows? Types hard-code `target: "windows"`.
21. Window2 `screenshotId` cache lifetime / invalidation when the window resizes or a modal appears.
22. Window2 `include_text` default **false** vs Mac always-on AX: intentional token savings, or Windows UIA cost?

## Transport / product surface

23. `CodexComputerUseNativeBridge-1` vs `CodexComputerUseIPC-5` — who speaks the bridge protocol? (`sky.node` in Electron? SkyComputerUseClient?)
24. Unused JS-visible RPCs: `ComputerUseIPCFrontmostWindowRequest`, `AppStop`, `AppModify`, Skysight/event-stream, Messages, Calendar. Separate MCP tools in the same service, or dead?
25. `SKY_ENABLE_AUDIO`: is ChatGPT.app’s cua_node ever started with this set? Types keep audio optional.
26. Relaxed vs normal `bin/mac/{normal,relaxed}/Codex Computer Use.app` in `publishConfig.executableFiles` — the cua_node copy at `Codex Computer Use.app/` looks like **one** variant. Which?
27. `vendor/sky/types/SkyClient.d.ts` imports window2/full-desktop files that were **not** copied into `vendor/sky`. Was that an incomplete extract, or an older package layout?

## Tinysky-alt vs raw `sky`

28. Unified plugin tells the model `cua.getApp`; computer-use plugin tells it `sky.get_app_state`. Which plugin is actually enabled in current ChatGPT.app sessions? `unified-computer-use` `.mcp.json` has `"enabled": false` with tools still listed — host may ignore that flag.
29. macos `docs/skills/oai_sky_lib/macos/SKILL.md` omits `paste` and marks scroll `element_index` required; types do not. Which document does the REPL inject, if any, when using raw `@oai/sky`?

## Linux/Windows (out of this Mac assignment, still union members)

30. Linux `get_screenshot` return count: one per monitor? `Promise<Array<Screenshot>>` with no schema for screen id.
31. Windows `launch_app` with a raw `.exe` that `list_apps` never returns: how is `Window.app` then populated (full path vs short name)?
