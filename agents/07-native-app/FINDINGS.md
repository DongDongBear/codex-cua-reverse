# Native Codex Computer Use.app — the process that actually clicks/types

## Verdict

**`SkyComputerUseService` inside `Codex Computer Use.app` is the process that actually clicks, types, reads the AX tree, and takes screenshots.** It is not ChatGPT.app, not `cua_node`, and not `SkyComputerUseClient`.

On this machine the live clicker is:

```
pid 3802  ppid 3579 (ChatGPT.app / com.openai.codex)
/Users/dongdong/.codex/computer-use/Codex Computer Use.app/Contents/MacOS/SkyComputerUseService
```

It listens on a **Unix domain socket** in the app-group container:

```
~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock
mode 0600, owner = user
```

The JS `@oai/sky` Mac client (`native-pipe.js`) talks to that socket with **length-prefixed JSON-RPC 2.0**, API version **`CodexComputerUseIPC-5`**. It does **not** use XPC for this path. If the socket is missing, JS asks the host (`ensureService` over `NODE_REPL_HOST_SERVICES_PIPE_PATH`) or launches the app by bundle id `com.openai.sky.CUAService`.

`SkyComputerUseClient` is a **separate LSUIElement helper** (`com.openai.sky.CUAService.cli`) that plugin launchers exec as an MCP server (`args: ["mcp"]`). That helper talks to the same service over **XPC** (`ComputerUseIPCXPCTransport` / `SAIComputerUseIPCXPCProtocol`), with leftover **Apple Event** strings for bootstrap-port / PID / request-type. It is not the clicker.

TCC Accessibility and Screen Recording are **not** granted by entitlements. The service has no `com.apple.security.accessibility` entitlement (that is not how macOS TCC works). It prompts via an in-app “ChatGPT Computer Use” permission window and System Settings panes `Privacy_Accessibility` / `Privacy_ScreenCapture`. Entitlements only cover App Group, Apple Events, Contacts, and keychain.

`~/.codex/computer-use/Codex Computer Use.app` is a **byte-identical copy** of the ChatGPT-bundled app (`diff -rq` empty; SHA-256 of `SkyComputerUseService` matches). The running binary is the home copy.

---

## 1. What actually performs UI actions

| Process | Bundle id | Does it click/type? |
|---|---|---|
| **SkyComputerUseService** | `com.openai.sky.CUAService` | **Yes.** AX tree, ScreenCaptureKit, CGEvent/EventTap, AXPress/AXConfirm, synthetic focus. |
| SkyComputerUseClient | `com.openai.sky.CUAService.cli` | No. MCP/CLI client; XPC to the service. |
| CUALockScreenGuardian | `com.openai.sky.CUAService.guardian` | Lock-screen companion (overlay, AX at loginwindow, XPC back to service). Not the normal clicker. |
| ChatGPT.app | `com.openai.codex` | Parent that launches the service; PIP cursor overlay via `sky.node`. |
| `cua_node` + `@oai/sky` | n/a | JS policy + JSON-RPC client. |

Native implementation evidence (strings / linked frameworks, not a disassembly of event posting):

- Frameworks: `ApplicationServices`, `CoreGraphics`, `ScreenCaptureKit`, `AppKit`, `Carbon`, `IOKit`, `libswiftXPC`, `Network`, `ScriptingBridge`, `AVFoundation`.
- Types: `AccessibilitySupport.EventTap`, `clickEventTap`, `keyboardEventTap`, `mouseEventTaps`, `CGEventAPI`, `CGEventSource`, `AXPress`, `AXConfirm`, `AXUIElement`, `SyntheticAppFocusEnforcer`, `SkyshotCapture`, `SCShareableContent`, `SCContentFilter`, `SCStream`.
- Policy gate before actions: JS `withComputerUsePolicy` → native `ComputerUseIPCAppPolicyRequest` → user elicitation.

JS action mapping (`client.js` → request type `ComputerUseIPCAppPerformActionRequest`):

- `click` / `drag` / `paste` / `pressKey` / `scroll` / `setValue` / `selectText` / `type` / `performSecondaryAction`

State capture is `ComputerUseIPCAppGetSkyshotRequest` (“skyshot” = screenshot + accessibility text).

---

## 2. Bundle identities

All signed **Developer ID Application: OpenAI OpCo, LLC (2DC432GLL2)**, notarized, hardened runtime (`flags=0x10000`), team `2DC432GLL2`. Version **26.902.1000968** (Xcode 17B100 / macOS 26.1 SDK). Min OS 14.4.

| App / binary | CFBundleIdentifier | Executable | LSUIElement |
|---|---|---|---|
| Codex Computer Use.app (display name “ChatGPT Computer Use”) | `com.openai.sky.CUAService` | SkyComputerUseService | true |
| SkyComputerUseClient.app | `com.openai.sky.CUAService.cli` | SkyComputerUseClient | true |
| CUALockScreenGuardian.app | `com.openai.sky.CUAService.guardian` | CUALockScreenGuardian | true |
| Codex Computer Use Installer.app | `com.openai.sky.CUAService.AuthorizationPluginInstaller` | Codex Computer Use Installer | — |
| CodexComputerUseAuthorizationPlugin.bundle | `com.openai.sky.CUAService.AuthorizationPlugin` | CodexComputerUseAuthorizationPlugin | n/a |
| Installer tool (unbound Info.plist) | codesign id `CodexComputerUseAuthorizationPluginInstallerTool-55554944…` | CodexComputerUseAuthorizationPluginInstallerTool | n/a |

Resource bundles: `package.ComputerUse.resources`, `package.Appshot.resources`, `package.SlimCore.resources`, `swift-protobuf.SwiftProtobuf.resources`.

Bazel defines baked into the service (`Contents/Resources/BUILD.bazel`):

```
APP_BUNDLE_IDENTIFIER=com.openai.sky.CUAService
APP_GROUP_IDENTIFIER=2DC432GLL2.com.openai.sky.CUAService
CUA_SERVICE_APP_GROUP_IDENTIFIER=2DC432GLL2.com.openai.sky.CUAService
SERVICE_AGENT_LABEL=com.openai.sky.CUAService.agent
SERVICE_BUNDLE_IDENTIFIER=com.openai.sky.CUAService
```

No LaunchAgent/LaunchDaemon with that label is installed. The service is an **unmanaged** child of ChatGPT (`com.apple.xpc.launchd.unmanaged.SkyComputerUseS.3802`). `SMAppService` strings were not found in the binary.

Parent ChatGPT.app: `com.openai.codex` / version 26.903.61454 / same team `2DC432GLL2`.

Allowed-looking host bundle ids in client/service strings (sender authorization allowlist, not a claim they all work):

```
com.openai.codex{,.alpha,.beta,.dev,.nightly}
com.openai.chat{,.alpha,.beta,.nightly,.mac-debug}
com.openai.atlas{,.alpha,.beta}
com.openai.sky.app
com.openai.sky.development.app
```

IPC authorization failure reasons: `MISSING_PARENT`, `UNTRUSTED_PARENT`, `RELAY_WITHOUT_TRUSTED_ANCESTOR`. Client/guardian parent code-requirement files only require **team-identifier `2DC432GLL2`**.

---

## 3. How JS `@oai/sky` talks to native

Source:  
`/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/sky/dist/project/cua/sky_js/src/targets/mac/{native-pipe.js,client.js,computer-use-policy.js}`

### Transport: Unix socket JSON-RPC (not XPC)

1. Path, in order:
   - env `SKY_CUA_SERVICE_NATIVE_PIPE_PATH`
   - else `~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock`
2. Connect via trusted-runtime `globalThis.nodeRepl.nativePipe.createConnection(path)`.
3. Framing: **uint32 little-endian length + UTF-8 JSON**, max frame **8 MiB**.
4. JSON-RPC 2.0 methods:
   - `ping` params `{ clientApiVersion }` → result `{ serverApiVersion }`; mismatch → `incompatibleClientVersion` (-10013).
   - `request` params `{ clientApiVersion, codexTurnMetadata, deadlineUnixMilliseconds, request, requestType }`.
5. Default `clientApiVersion`: **`CodexComputerUseIPC-5`**. Timeout default 120s.

If connect/ping fails:

- If `NODE_REPL_HOST_SERVICES_PIPE_PATH` is set: JSON-RPC `ensureService` `{ service: "computer-use" }` on the host pipe, then retry.
- Else `nodeRepl.launchServices.openApplication`:
  - `SKY_CUA_SERVICE_PATH`, or
  - `$CODEX_HOME/computer-use/Codex Computer Use.app` if it exists, or
  - `{ bundleIdentifier: "com.openai.sky.CUAService" }`.

JS request type names (must match native Swift types):

```
ComputerUseIPCAppPolicyRequest
ComputerUseIPCListAppsRequest
ComputerUseIPCAppStartRequest
ComputerUseIPCAppGetSkyshotRequest
ComputerUseIPCAppPerformActionRequest
ComputerUseIPCStartAudioRecordingRequest
ComputerUseIPCStopAudioRecordingRequest
```

Native has many more IPC types (Messages, Calendar, Skysight, capture animation, event stream, status item) that this JS client does not call.

### Policy layer (JS, before native actions)

`computer-use-policy.js`:

1. `getAppPolicy(app)` → native.
2. Decision `allowed` / `denied` (org policy) / `forbidden` (safety).
3. User elicitation: “Allow Computer Use to use \<displayName\>?” with persist `session`/`always`, `riskLevel` from native (`high`/`low`).
4. Chrome special-case: response meta `codex/computerUseChrome` when bundle is `com.google.Chrome`.
5. Telemetry via Statsig (`pluginId: computer-use@openai-bundled`, `transport: native_pipe`).

Server error codes from `errors.js` (native JSON-RPC `error.code`):

| code | name |
|---:|---|
| -10000 | senderProcessNotAuthenticated |
| -10001 | couldNotGetRequestData |
| -10002 | couldNotGetRequestTypeName |
| -10003 | couldNotResolveRequestType |
| -10004 | unhandledEvent |
| -10005 | unknownError |
| -10006 | appNotAllowed |
| -10007 | runningApplicationNotFound |
| -10008 | accessibilityError |
| -10009 | permissionsNotGranted |
| -10010 | invalidApp |
| -10011 | noActiveSession |
| -10012 | userStoppedSession |
| -10013 | incompatibleClientVersion |
| -10014 | permissionsPending |
| -10015 | blockedURL |
| -10016 | userIntervened |
| -10017 | couldNotGetSenderPID |
| -10018 | ambiguousApp |
| -10019 | couldNotGetBootstrapPort |
| -10020 | screenLocked |

Codes -10001/-10002/-10017/-10019 match **Apple Event** error strings, i.e. a second/legacy native IPC, not the JS socket path.

### Native-client / ChatGPT-host IPC (not JS)

Visible in the same binaries:

| Channel | Evidence | Role |
|---|---|---|
| **Unix JSON-RPC socket** | `computeruse.sock`, `ComputerUseIPCJSONRPCSocketServer`, queue `com.openai.sky.computer-use-json-rpc-socket` | JS `@oai/sky` |
| **XPC** | `ComputerUseIPCXPCSession`, `ComputerUseIPCXPCTransport`, `SAIComputerUseIPCXPCProtocol`, `NSXPCListenerEndpoint`, “XPC pipe from mach port” | SkyComputerUseClient ↔ service; ChatGPT `sky.node` PIP |
| **Mach bootstrap rendezvous** | `SAIMachBootstrapRendezvous` | Guardian spawn / endpoint handoff |
| **Apple Events** | “Could not get XPC bootstrap mach port from Apple event”, `NSAppleEventDescriptor` | bootstrap port + PID + request type (legacy / host) |
| **Lock-screen Unix socket** | `/tmp/com.openai.sky.CUAService/LockScreenLoginAuthorization.sock` | SecurityAgent plugin ↔ service |

ChatGPT.app `sky.node` (`CodexComputerUseNativeBridge-1`) is an Electron native addon: `spawnComputerUseService`, XPC to CUAService, remote-hosted PIP cursor (`setComputerUseCursorLocation`). That is the **overlay**, not the JS sky library.

---

## 4. Plugin launchers

Identical 339-byte scripts in:

- `.../plugins/computer-use/bin/computer-use-client-launcher`
- `.../plugins/computer-history/bin/computer-use-client-launcher`
- `.../plugins/messages/bin/computer-use-client-launcher`
- `.../plugins/record-and-replay/bin/computer-use-client-launcher`

```sh
#!/bin/sh
set -eu
codex_home="${CODEX_HOME:-${HOME}/.codex}"
client="${codex_home}/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient"
exec "${client}" "$@"
```

computer-use `.mcp.json`:

```json
{
  "mcpServers": {
    "computer-use": {
      "command": "./bin/computer-use-client-launcher",
      "args": ["mcp"],
      "cwd": ".",
      "env_vars": ["CODEX_HOME"]
    }
  }
}
```

`SkyComputerUseClient` strings: “Runs the Computer Use / Messages / Calendar / Computer History / Record & Replay client as an MCP server”. Unified-computer-use (JS `js` tool) does **not** go through this launcher; it uses `@oai/sky` → socket.

---

## 5. TCC / Accessibility / Screen Recording

### Entitlements vs TCC

**Entitlements do not grant Accessibility or Screen Recording.** Observed signed entitlements on the clicker:

- `com.apple.application-identifier` = `2DC432GLL2.com.openai.sky.CUAService`
- `com.apple.developer.team-identifier` = `2DC432GLL2`
- `com.apple.security.application-groups` = `2DC432GLL2.com.openai.sky.CUAService`
- `com.apple.security.automation.apple-events` = true
- `com.apple.security.personal-information.addressbook` = true
- `keychain-access-groups` = `2DC432GLL2.*`

CUA `Info.plist` usage strings:

- `NSAppleEventsUsageDescription` — copy that talks about **messages/recipients** (looks misplaced).
- `NSContactsUsageDescription` — Contacts for messaging.

**Missing from CUA Info.plist:** `NSAccessibilityUsageDescription`, `NSScreenCaptureUsageDescription`, `NSAudioCaptureUsageDescription`, `NSMicrophoneUsageDescription`. TCC prompts therefore use the in-app permission UI, not standard Info.plist purpose strings.

Prompt copy from the service binary:

- “ChatGPT Computer Use needs these permissions to use apps on your Mac.”
- “These permissions are used when you ask ChatGPT to perform tasks.”
- “Computer Use permissions are still pending. The user has not finished granting **Accessibility and Screen Recording** permissions in the ChatGPT Computer Use window.”
- Appshot/Skysight variants for capture-on-command-keys and activity capture.

System Settings deep links: `com.apple.settings.PrivacySecurity.extension` plus `Privacy_Accessibility`, `Privacy_ScreenCapture`, `Privacy_Automation`, `Privacy_AllFiles`, `Privacy_Contacts`, `Privacy_Calendars`, `Privacy_Reminders`, `Privacy_Camera`, `Privacy_Location`.

`_isAccessibilityGranted` / `AccessibilityPermission` / `AppleEventsPermission` types present.

User TCC.db is SIP-protected; not readable here. Live evidence that permissions were granted at some point: the service is running and holding ScreenCaptureKit / AX-related frameworks.

CGEventTap (`EventTap`, `clickEventTap`, `keyboardEventTap`) may also require **Input Monitoring** (`ListenEvent`) on modern macOS; no `Privacy_ListenEvent` string was found.

### Sender authentication (IPC, not TCC)

JSON-RPC/XPC callers are checked (`ComputerUseIPCSenderAuthorization`). Analytics fields: parent/responsible team id, signing id, bundle id, executable. Fail closed: “Sender process is not authenticated”. Socket path checks: unexpected owner, unsafe directory permissions, stale socket, lock file.

JS depends on `nodeRepl` being a **trusted** host (`Sky Computer Use requires the trusted nodeRepl runtime`).

---

## 6. Helpers

### SkyComputerUseClient (`com.openai.sky.CUAService.cli`)

- 14 MB arm64, LSUIElement.
- App group `2DC432GLL2.com.openai.sky.CUAService` (can see `computeruse.sock`).
- Provision profile also lists `group.com.openai.sky.Service` and `group.com.openai.sky.CUAService` (signed entitlements only have the `2DC432GLL2.com.openai.sky.CUAService` group).
- Parent requirement: team `2DC432GLL2`.
- MCP entrypoint for computer-use / messages / calendar / history / record-and-replay.
- XPC transport: `ComputerUseIPCXPCTransport.MachReceivePort`.

### CUALockScreenGuardian (`com.openai.sky.CUAService.guardian`)

- 22 MB — essentially the ComputerUse stack again (AX, ScreenCaptureKit, overlay).
- **No entitlements blob.**
- Spawned by the service; Mach bootstrap rendezvous + `SAILockScreenGuardianXPCProtocol`.
- Types: `SystemLockScreenAXInteractor`, `LockScreenOverlayPresenter`, `LockScreenPhysicalInputMonitor`, `LockScreenAutoUnlockCoordinator`, `LockScreenLoginAuthorizationBroker`.
- Darwin notify: `com.apple.sessionagent.screenIsLocked` / `screenIsUnlocked` / `screenLockUIIsShown`.
- Purpose (from strings): keep Computer Use able to work across lock; auto-unlock path; abort if physical input detected.

### Codex Computer Use Installer + Authorization Plugin

Installer is a thin wrapper. Tool usage:

```
CodexComputerUseAuthorizationPluginInstallerTool install|uninstall|status RESOURCE_DIR
```

It:

- Copies plugin to `/Library/Security/SecurityAgentPlugins/CodexComputerUseAuthorizationPlugin.bundle`
- Backs up / patches **`system.login.screensaver`** via `security authorizationdb` (`evaluate-mechanisms`)
- Right comment: “Screen-unlock branch that asks SkyComputerUseClient whether an active Computer Use login authorization is pending.”
- Extra right name string: `CodexComputerUseAuthorizationPlugin:allow`
- Mechanism class: `CodexComputerUseMechanism`
- Privilege to install: `system.privilege.admin`
- Flag: `use-login-window-ui`

**Installed on this Mac** (older than the ChatGPT bundle):

- Path: `/Library/Security/SecurityAgentPlugins/CodexComputerUseAuthorizationPlugin.bundle`
- Version **26.708.1000366** (bundled copy is **26.902.1000968**)
- Signed Jul 8, 2026 vs bundled Sep 2, 2026
- Binaries **differ** (`diff -q`)

Plugin behavior (strings only):

- Connects to `/tmp/com.openai.sky.CUAService/LockScreenLoginAuthorization.sock`
- Checks peer audit token, signing identifier `com.openai.sky.CUAService`, team `2DC432GLL2`
- Returns Allow/Deny to SecurityAgent

Live: that socket **exists**, mode **0666**, owned by the user; service fd 11 is bound to it. Identity is supposed to be enforced by code-signing of the peer, not by socket mode.

### Sparkle

CUA Info.plist:

- `SUFeedURL` = `https://oaisidekickupdates.blob.core.windows.net/mac/cua/alpha/appcast.xml`
- `SUPublicEDKey` = `5Yw9jMXMH6O3mJZmpFuQT6ECfC3ZKBfVjWUVMNrElRo=`
- automatic updates enabled, verify before extraction.

---

## 7. `~/.codex/computer-use`

Present:

```
~/.codex/computer-use/Codex Computer Use.app   # identical to ChatGPT-bundled app
~/.codex/computer-use/config.json
```

`config.json` is UI chrome only:

```json
{
  "accentColor": "#0169cc",
  "direction": "ltr",
  "locale": "en-US",
  "strings": {
    "usingComputer": "ChatGPT is using your computer",
    "escToCancel": "Esc to cancel"
  }
}
```

SHA-256 `SkyComputerUseService`:

`905939bff849b072da68e8e23e97188ed7bf93173646ac1bd9f7b54f9a89ce35` (bundled = home).

`@oai/sky` package.json also mentions `bin/mac/normal/` vs `bin/mac/relaxed/` variants; this ChatGPT tree ships one app (strings include `JS_NORMAL` and `ComputerUseAllowForbiddenTargets`).

---

## 8. Policy / safety (native)

Strings:

- “Computer Use is disabled by your configuration.”
- “Computer use actions are not allowed for system security process:”
- `ComputerUseURLBlocklist` / `isURLBlocked` / `blockedURL` (-10015)
- `ComputerUseAllowForbiddenTargets`
- per-app `forbidden` vs org `denied`
- session must call `get_app_state` before other actions
- user-stop / user-intervened ends the turn
- screen-locked errors if request cannot be tied to a ChatGPT thread

App-specific AX hints shipped in `Package_ComputerUse.bundle/.../AppInstructions/`: AppleMusic, Clock, iPhone Mirroring, Notion, Numbers, Slack, Spotify. Plus `SkysightSummarizer.md` / `SkysightMemoryInstructions.md` (passive activity memory; out of scope for click/type).

---

## 9. Codesign snapshot

| Target | CDHash (sha256 prefix) | Timestamp |
|---|---|---|
| CUAService app | 62fee5dd8a6f42c76398831557157971df48dabc | Sep 2, 2026 17:53:50 |
| SkyComputerUseClient | 16ebdae6ed70f766222673cc21894565117b9c56 | Sep 2, 2026 17:53:47 |
| CUALockScreenGuardian | 6ab0ae31f39d734efac38a3045fc9a918650c483 | Sep 2, 2026 17:53:48 |
| Installer | b52aa7606e2e985f76bd60eb22172e0bc4fa14b4 | Sep 2, 2026 17:53:46 |
| Auth plugin (bundled) | a70658f871f8bedaf83957e01420ca692688d21e | Sep 2, 2026 17:53:44 |
| Installer tool | 680f5c193faecca9b8263ceb68962be1525a0460 | Sep 2, 2026 17:53:45 |
| Auth plugin (installed) | 4ccae2e82a38315535c00ec68a87c0d1145bd417 | Jul 8, 2026 23:43:35 |

`spctl`: **accepted, Notarized Developer ID**.

Binary sizes: service 22 104 320; guardian 22 734 688; client 14 167 776; installer 90 480; tool 109 776; plugin 67 872. All **arm64 thin** (no x86_64).

---

## 10. Info.plist / entitlements (copied)

Full XML copies live in `copies/`. Inlined:

### CUAService Info.plist (keys of interest)

```
CFBundleDisplayName          ChatGPT Computer Use
CFBundleExecutable           SkyComputerUseService
CFBundleIdentifier           com.openai.sky.CUAService
CFBundleName                 Codex Computer Use
CFBundleShortVersionString   26.902.1000968
CFBundleVersion              1000968
LSMinimumSystemVersion       14.4
LSUIElement                  true
NSAppleEventsUsageDescription
  By default, ChatGPT sends messages only after you approve the message and its recipients.
NSContactsUsageDescription
  ChatGPT uses Contacts to show names and find phone numbers or email addresses for people you ask to message.
SUFeedURL  https://oaisidekickupdates.blob.core.windows.net/mac/cua/alpha/appcast.xml
SUPublicEDKey  5Yw9jMXMH6O3mJZmpFuQT6ECfC3ZKBfVjWUVMNrElRo=
```

### CUAService entitlements

```xml
<?xml version="1.0" encoding="UTF-8"?>
<plist version="1.0"><dict>
  <key>com.apple.application-identifier</key>
  <string>2DC432GLL2.com.openai.sky.CUAService</string>
  <key>com.apple.developer.team-identifier</key>
  <string>2DC432GLL2</string>
  <key>com.apple.security.application-groups</key>
  <array><string>2DC432GLL2.com.openai.sky.CUAService</string></array>
  <key>com.apple.security.automation.apple-events</key><true/>
  <key>com.apple.security.personal-information.addressbook</key><true/>
  <key>keychain-access-groups</key>
  <array><string>2DC432GLL2.*</string></array>
</dict></plist>
```

### SkyComputerUseClient entitlements

```xml
<dict>
  <key>com.apple.application-identifier</key>
  <string>2DC432GLL2.com.openai.sky.CUAService.cli</string>
  <key>com.apple.developer.team-identifier</key>
  <string>2DC432GLL2</string>
  <key>com.apple.security.application-groups</key>
  <array><string>2DC432GLL2.com.openai.sky.CUAService</string></array>
  <key>keychain-access-groups</key>
  <array><string>2DC432GLL2.*</string></array>
</dict>
```

### Installer entitlements

Empty dict.

### Installer tool entitlements

```xml
<key>com.apple.application-identifier</key>
<string>2DC432GLL2.com.openai.sky.app.CodexComputerUseAuthorizationPluginInstallerTool</string>
```

### Guardian / AuthorizationPlugin entitlements

None embedded.

### Provision profile (service) entitlements (superset of signed)

`com.apple.security.application-groups` includes `group.com.openai.sky.CUAService` and `2DC432GLL2.*`. Profile name “CUA Service”, `ProvisionsAllDevices` true, expires 2044-05-07. Client profile “CUA Service CLI” also lists `group.com.openai.sky.Service`.

---

## 11. Interesting strings (excerpts only)

### IPC / sockets

```
computeruse.sock
SKY_CUA_SERVICE_NATIVE_PIPE_PATH
CodexComputerUseIPC-5
clientApiVersion
serverApiVersion
ComputerUseIPCJSONRPCSocketServer
ComputerUseIPCJSONRPCSocketConnection
ComputerUseIPCXPCSession
ComputerUseIPCXPCTransport
SAIComputerUseIPCXPCProtocol
com.openai.sky.computer-use-json-rpc-socket
com.openai.sky.computer-use-json-rpc-socket-readiness
/tmp/com.openai.sky.CUAService/LockScreenLoginAuthorization.sock
SAIMachBootstrapRendezvous
Could not get XPC bootstrap mach port from Apple event
Could not get sender PID from Apple event
socket directory has unsafe permissions path=
The protected Computer Use app-group container is unavailable.
```

### Click / AX / capture

```
AXPress
AXConfirm
AXUIElement
EventTap
clickEventTap
keyboardEventTap
CGEventAPI
SkyshotCapture
SCShareableContent
ScreenCaptureKit
AccessibilityPermission
Privacy_Accessibility
Privacy_ScreenCapture
_isAccessibilityGranted
SyntheticAppFocusEnforcer
enableElectronAccessibility
```

### Auth / lock screen

```
Sender process is not authenticated
CODEX_COMPUTER_USE_IPC_AUTHORIZATION_FAILURE_REASON_UNTRUSTED_PARENT
CUALockScreenGuardian
LockScreenLoginAuthorizationSocketServer
CodexComputerUseMechanism
system.login.screensaver
evaluate-mechanisms
Login authorization socket peer identity mismatch
```

### User-facing errors

```
ChatGPT Computer Use needs these permissions to use apps on your Mac.
Computer Use permissions are still pending. ... Accessibility and Screen Recording ...
Computer Use is not allowed to use the app '
Computer Use is blocked from using the app '
Computer Use is disabled by your configuration.
Computer use actions are not allowed for system security process:
The Mac is locked and automatic unlock is paused because physical input was detected.
```

### Telemetry transports

```
CODEX_COMPUTER_USE_IPC_TRANSPORT_XPC
CODEX_COMPUTER_USE_IPC_TRANSPORT_JSON_RPC_SOCKET
```

No full `strings` dump is included (29k+ strings in the service alone).

---

## 12. Data flow (JS computer-use surface)

```
model js tool
  → cua_node + @oai/sky Mac client
      → withComputerUsePolicy (elicitation)
      → MacNativePipeTransport
          → unix socket computeruse.sock   [JSON-RPC CodexComputerUseIPC-5]
              → SkyComputerUseService
                  → AX + ScreenCaptureKit + CGEvent/EventTap
                  → (optional) CUALockScreenGuardian via Mach/XPC
                  → (optional) SecurityAgent plugin via /tmp/...LockScreenLoginAuthorization.sock
```

Parallel MCP path:

```
plugin computer-use-client-launcher
  → ~/.codex/.../SkyComputerUseClient mcp
      → XPC ComputerUseIPCXPCTransport
          → same SkyComputerUseService
```
