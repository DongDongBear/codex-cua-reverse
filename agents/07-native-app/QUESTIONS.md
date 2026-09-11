# Open questions — Native Computer Use.app

## IPC

1. **When is XPC used vs JSON-RPC socket vs Apple Events?**  
   JS `@oai/sky` is clearly the Unix socket. `SkyComputerUseClient` and ChatGPT `sky.node` look XPC. Apple Event strings still exist (`Could not get XPC bootstrap mach port from Apple event`, error codes -10001/-10002/-10017/-10019). Is AE still a live path from ChatGPT.app, or dead leftover used only to ferry a Mach bootstrap port into XPC?

2. **What is `SAIMachBootstrapRendezvous` exactly?**  
   Guardian spawn uses “register / look up Guardian Mach bootstrap rendezvous port” then “XPC pipe from mach port” → `NSXPCListenerEndpoint`. Is this `bootstrap_register` in the per-user namespace, a private SAI helper, or `xpc_pipe_create` on a received port?

3. **Socket peer authorization for `computeruse.sock`.**  
   JS connects as whatever `nodeRepl.nativePipe` is (likely a ChatGPT-hosted Node with the user’s uid). Native `ComputerUseIPCSenderAuthorization` checks parent/responsible team + signing ids. Does a random same-uid process that can open the 0600 socket still fail `senderProcessNotAuthenticated`? Codes -10000 path vs socket-owner checks (`socket has unexpected owner path=`) — which fires first?

4. **File-handle passing.**  
   Types `ComputerUseIPCRequestWithFileHandles` / `ExecutableComputerUseIPCRequestWithFileHandles` and XPC `sendRequest(...fileHandles:)`. Does JSON-RPC ever send SCM_RIGHTS, or is that XPC-only (screenshots as fds)?

5. **`com.openai.sky.computer-use-json-rpc-socket-readiness`.**  
   Dispatch queue name or Darwin notification? Who waits on it besides the service?

## TCC / permissions

6. **Why no `NSAccessibilityUsageDescription` / `NSScreenCaptureUsageDescription` in CUA Info.plist?**  
   The in-app window is clearly the intended UX. Does `AXIsProcessTrustedWithOptions` still show a system sheet with only the app name “ChatGPT Computer Use”?

7. **Input Monitoring.**  
   `EventTap` / `CGEventTap` / `clickEventTap` / `keyboardEventTap` are in `AccessibilitySupport`. On current macOS, posting/listening often needs ListenEvent TCC. No `Privacy_ListenEvent` string. Is tapping covered by Accessibility, or is Input Monitoring granted silently / unused at runtime?

8. **Who holds the TCC identity — service, ChatGPT, or both?**  
   Service is a separate bundle id (`com.openai.sky.CUAService`) spawned by `com.openai.codex`. Accessibility grants are per-client. Does the permission window call `AXIsProcessTrusted` in the service process (expected), or does ChatGPT proxy?

9. **`NSAppleEventsUsageDescription` in CUA Info.plist is Messages copy.**  
   Dead code, shared SlimCore plist, or a real AE path for Messages/Calendar MCP?

10. **Audio recording TCC.**  
    JS exposes `start_audio_recording` only if `SKY_ENABLE_AUDIO=1`. Service links AVFoundation. Which TCC service (Microphone vs AudioCapture / System Audio) is requested?

## Process model

11. **`SERVICE_AGENT_LABEL=com.openai.sky.CUAService.agent` is in BUILD.bazel but no LaunchAgent and no `SMAppService` strings.**  
    Unused define, stripped, or registered only after a first-run we did not see?

12. **Lifetime.**  
    Live pid is a child of ChatGPT.app (ppid 3579). If ChatGPT quits, does the service exit, or is there a keep-alive we missed?

13. **`normal` vs `relaxed` builds.**  
    `@oai/sky` package.json lists `bin/mac/normal/` and `bin/mac/relaxed/`. This tree has one nested app. What does “relaxed” change (`ComputerUseAllowForbiddenTargets`)? Who ships it?

## Lock screen / auth plugin

14. **Installed plugin is older than the bundled one** (1000366 / Jul 8 vs 1000968 / Sep 2).  
    Who is supposed to upgrade it? ChatGPT first-run? Sparkle? Manual installer?

15. **`system.login.screensaver` was not dumpable here** (authorizationdb read returned no CUA match / unreadable).  
    Confirm the evaluate-mechanisms insertion and the mechanism name (`CodexComputerUseAuthorizationPlugin:allow` vs bundle id).

16. **Lock-screen socket is 0666 under `/tmp/com.openai.sky.CUAService/`.**  
    Plugin verifies peer signing id + team via audit token. Is that check always on? What is the on-wire protocol (single line `allowed=true/false`)?

17. **Auto-unlock.**  
    Strings: `LockScreenAutoUnlockCoordinator`, “automatic unlock could not unlock it”, “paused because physical input was detected”. Does Computer Use actually submit the login password via the authorization plugin, or only skip the screensaver UI when a turn is active? (Do not test this.)

18. **Guardian has no entitlements.**  
    How does it do AX/ScreenCapture at the lock screen? Inherited TCC from the service? Separate TCC client? loginwindow special case?

## Policy

19. **Where does org `denied` vs safety `forbidden` live?**  
    Native `CodexAppServerComputerUsePolicyProvider` / `ComputerUsePolicyProviding`. Statsig? MDM? Hardcoded bundle-id list? `ComputerUseAllowForbiddenTargets` looks like an override flag.

20. **URL blocklist.**  
    `ComputerUseURLBlocklist` / `blockedURL` (-10015). Applied only to browser windows, or any AX-visible URL?

21. **“system security process” block.**  
    Which bundle ids / PIDs? loginwindow, SecurityAgent, `com.apple.systempreferences`?

## Client surface

22. **Does unified-computer-use ever exec `SkyComputerUseClient`?**  
    Current JS path does not. Is the MCP plugin still used in ChatGPT desktop, or only Codex CLI?

23. **Messages/Calendar/History/Record-and-Replay MCP servers are inside `SkyComputerUseClient`.**  
    Same process, same XPC session, same TCC identity as click/type? Or separate permission gates (`MessagesAppleEventsPermission`, `CalendarAppleEventsPermission`)?

24. **Skysight** (passive observation / memory) is compiled into the service and guardian.  
    Is it enabled in this ChatGPT build, or only behind a flag / separate MCP?

## Misc

25. **Sparkle feed is `.../mac/cua/alpha/appcast.xml`.**  
    Does the nested app self-update independently of ChatGPT.app? That would explain a home copy drifting from the bundle (it has not drifted yet).

26. **`sky.node` vs `@oai/sky`.**  
    Confirm the Electron addon never injects events itself and only shows the PIP cursor + spawns the service.

27. **TCC.db unreadable** under SIP. A later pass with `tccutil` / Full Disk Access could list `kTCCServiceAccessibility` / `ScreenCapture` / `ListenEvent` clients for `com.openai.sky.CUAService` vs `com.openai.codex`.

28. **x86_64.**  
    All CUA binaries are arm64-thin. What happens on Intel Macs — different slice in another package, Rosetta, or Computer Use arm-only?
