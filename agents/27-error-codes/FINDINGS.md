# FINDINGS — complete `ServerErrorCode` table

Date: 2026-09-11. Local disk only. No Linear clicks, no trusted-pipe impersonation.

**Verdict.** JS `@oai/sky` `ServerErrorCode` is **21 names, −10000…−10020**. Native `ComputerUseClient.ComputerUseIPCClient.ServerError.Code` is **30 empty cases, Int32 raw values −10000…−10029** (`rawValue = −10000 − discriminator`). The nine extra codes (−10021…−10029) are `turnEnded` plus the Messages MCP family. They are **not** in `errors.js`; JS would label them `errorName: "jsonRPCError"`.

Observed on this machine:

| Where | Code | JS `errorName` | `error.message` / model text |
|---|---:|---|---|
| Live MCP `tools/call list_apps` (unsigned parent) | **−10000** | `senderProcessNotAuthenticated` | `Computer Use server error -10000: Sender process is not authenticated` |
| Traces `linearApp.click([119,35])` ×2 | **−10005** | **`unknownError`** | `Computer Use server error -10005: noWindowsAvailable` |

`noWindowsAvailable` is **not** a `ServerError.Code` case. It is an AccessibilitySupport window-resolution case. The JSON-RPC **code** stays −10005; the **message** is the inner case name.

Unix-socket ping from this process never returns a `ServerErrorCode`: the service accepts `computeruse.sock` then FIN with **zero JSON-RPC bytes** (`SkyComputerUseTransportError`). Auth for the socket path runs **before** JSON-RPC, so −10013 was not live-proven here.

---

## 0. Method

| Source | Path |
|---|---|
| JS table | `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/sky/dist/project/cua/sky_js/src/targets/mac/errors.js` (sha256 `9dd27e4c…0cfd43`, 1049 bytes) |
| JS types | same dir `errors.d.ts`; copy `agents/02-sky-native/d.ts/targets/mac/errors.d.ts` |
| Pipe / policy | `native-pipe.js`, `computer-use-policy.js` |
| Native enum | `SkyComputerUseService` Swift metadata `ComputerUseIPCClient.ServerError.Code` (30 empty cases) + `init(rawValue:)` / `rawValue` ARM64 |
| Native copy | `strings` on service + client |
| Traces | `agents/05-traces/calls.json` n=21, n=24; `traces/task-2-linear-issue.json` |
| Live MCP | `verify/results/mcp-ndjson.json` id 3 / id 4; agent 21 extra MCP servers |

Service binary (byte-identical to the ChatGPT-bundled copy):

`~/.codex/computer-use/Codex Computer Use.app/Contents/MacOS/SkyComputerUseService`  
SHA-256 `905939bff849b072da68e8e23e97188ed7bf93173646ac1bd9f7b54f9a89ce35`

`vendor/sky/js/` does **not** ship `errors.js` (mac-client still `export { … } from "./errors.js"` against the ChatGPT tree).

`errors.d.ts` declares `formatOSStatus(status: number): string`. That helper is **not** in the shipped `errors.js` (tree-shaken).

---

## 1. JS `ServerErrorCode` (−10000…−10020)

Pretty form of the object in `errors.js` (`senderProcessNotAuthenticated` is written `-1e4`):

```js
const ServerErrorCode = {
  senderProcessNotAuthenticated: -10000,
  couldNotGetRequestData:        -10001,
  couldNotGetRequestTypeName:    -10002,
  couldNotResolveRequestType:    -10003,
  unhandledEvent:                -10004,
  unknownError:                  -10005,
  appNotAllowed:                 -10006,
  runningApplicationNotFound:    -10007,
  accessibilityError:            -10008,
  permissionsNotGranted:         -10009,
  invalidApp:                    -10010,
  noActiveSession:               -10011,
  userStoppedSession:            -10012,
  incompatibleClientVersion:     -10013,
  permissionsPending:            -10014,
  blockedURL:                    -10015,
  userIntervened:                -10016,
  couldNotGetSenderPID:          -10017,
  ambiguousApp:                  -10018,
  couldNotGetBootstrapPort:      -10019,
  screenLocked:                  -10020,
};
```

`SkyComputerUseError`:

| Field | Value |
|---|---|
| `name` | `"SkyComputerUseError"` |
| `message` | JSON-RPC `error.message` (**not** rewritten; not the JS enum name) |
| `code` | JSON-RPC `error.code` |
| `errorName` | reverse map of the 21 names, else **`"jsonRPCError"`** |
| `request` / `requestType` | attached by `native-pipe.js` (`request: null`, `requestType: "jsonRPC"` on the socket path) |

`SkyComputerUseTransportError` is a separate class (`cause` optional). Pipe framing, missing `nodeRepl`, silent FIN, and **JS ping version mismatch** all use this class — not `ServerErrorCode`.

`native-pipe.js` ping: if `serverApiVersion !== clientApiVersion` (`CodexComputerUseIPC-5`), throw transport error `Sky Computer Use API version mismatch: client=… server=…`. Connect loop **does not retry** that transport error **or** a `SkyComputerUseError` whose `code === ServerErrorCode.incompatibleClientVersion` (−10013). Those are two different types for the same mismatch family.

`computer-use-policy.js` `withComputerUseToolTelemetry`: `terminalStatus = "cancelled"` if the thrown error is `SkyComputerUseError` with code **−10012 or −10016**; otherwise `"failed"`.

`node_repl` `formatErrorMessage` returns **`error.message` only** (`_tmp/node_repl_js/kernel.js`). Trace `js` tool results are therefore the native (or MCP-formatted) string, not `errorName`.

---

## 2. Native `ServerError.Code` (−10000…−10029)

Swift:

```
ComputerUseClient.ComputerUseIPCClient.ServerError.Code
  : RawRepresentable where RawValue == Int32
  : Hashable, Equatable
```

Nominal type descriptor: **0 payload cases, 30 empty cases**.

`rawValue` getter (ARM64 at `0x100cbeccc`):

```
mov w8, #-0x2710      ; -10000
sub w0, w8, w0, uxtb  ; -10000 - discriminator
ret
```

`init(rawValue:)` (`0x100cc1dfc`):

```
add w8, w0, #10029
cmp w8, #30           ; unsigned
csel  caseIndex = (-10000 - rawValue)  if (rawValue + 10029) < 30
      else invalid (30)
```

Valid raw values: **−10000 through −10029 inclusive**. Field-descriptor order **is** discriminator order **is** JS order for the first 21, then nine extras:

| i | rawValue | `Code` case |
|--:|---:|---|
| 0 | −10000 | `senderProcessNotAuthenticated` |
| 1 | −10001 | `couldNotGetRequestData` |
| 2 | −10002 | `couldNotGetRequestTypeName` |
| 3 | −10003 | `couldNotResolveRequestType` |
| 4 | −10004 | `unhandledEvent` |
| 5 | −10005 | `unknownError` |
| 6 | −10006 | `appNotAllowed` |
| 7 | −10007 | `runningApplicationNotFound` |
| 8 | −10008 | `accessibilityError` |
| 9 | −10009 | `permissionsNotGranted` |
| 10 | −10010 | `invalidApp` |
| 11 | −10011 | `noActiveSession` |
| 12 | −10012 | `userStoppedSession` |
| 13 | −10013 | `incompatibleClientVersion` |
| 14 | −10014 | `permissionsPending` |
| 15 | −10015 | `blockedURL` |
| 16 | −10016 | `userIntervened` |
| 17 | −10017 | `couldNotGetSenderPID` |
| 18 | −10018 | `ambiguousApp` |
| 19 | −10019 | `couldNotGetBootstrapPort` |
| 20 | −10020 | `screenLocked` |
| 21 | **−10021** | **`turnEnded`** |
| 22 | **−10022** | **`messagesPermissionsPending`** |
| 23 | **−10023** | **`messagesPermissionsDenied`** |
| 24 | **−10024** | **`messagesQueryTimedOut`** |
| 25 | **−10025** | **`messagesInvalidRequest`** |
| 26 | **−10026** | **`messagesAmbiguousDestination`** |
| 27 | **−10027** | **`messagesSendPlanUnavailable`** |
| 28 | **−10028** | **`messagesSendOutcomeUncertain`** |
| 29 | **−10029** | **`messagesSendRateLimited`** |

There is a sibling associated-value enum `ComputerUseIPCClient.ServerError` (8 payload + 12 empty = 20 cases). It is **not** 1:1 with `Code`: it omits the ten app/session codes (`appNotAllowed` … `screenLocked`) and holds associated values for `unknownError(String)`, `incompatibleClientVersion`, `messagesSendRateLimited(retryAfterSeconds:)`, etc. `.code` maps those 20 cases onto the `Code` table above.

`static throwMappedServerError(errorNumber: Int32, errorString: String) throws` is how the **client** turns a JSON-RPC `{code, message}` into a Swift `Error`. MCP then formats the model-visible line.

**Not** `ServerError.Code` (nearby Swift Error, 23 cases, includes local spawn failure):

| Case | Role |
|---|---|
| `serverError` | client wrapper around a mapped server failure |
| `couldNotFindServiceApp` | local: Codex Computer Use.app missing |
| plus the app/session/Messages cases already in `Code` | same names, different type |

Human string for the local spawn case: `Computer Use could not start because its runtime app is missing. Try again, and if it fails after 2 more tries, suggest that the user relaunch ChatGPT.`

`legacyMCP` / `nodeRepl` in the same string dump are a **client-type** enum (`ComputerUseIPC` runtime), not error codes.

---

## 3. Presentation

Prefix **`"Computer Use server error "`** is a C string in **both** `SkyComputerUseService` and `SkyComputerUseClient`. It is **not** in JS `errors.js`. Observed shape (traces + live MCP):

```
Computer Use server error <code>: <detail>
```

`<detail>` is a native string: a human sentence when the binary has one, otherwise the Swift case name (`noWindowsAvailable`).

JS does not add the prefix. `native-pipe.js` copies JSON-RPC `error.message` onto `SkyComputerUseError`. Trace `js` output is that message, so the **service** JSON-RPC `error.message` on the unix path already includes the prefix (or an equivalent native formatter does before it hits the REPL). MCP `isError` text is the same format from `throwMappedServerError`.

---

## 4. Full table (JS name + native copy + observed)

“enum only” = case name in the binary, no dedicated English sentence found next to it. Apple Event copy is leftover / host-bootstrap, not the JS unix-socket happy path.

| Code | JS `ServerErrorCode` | Native `Code` (same name unless noted) | Native / human detail | Observed here |
|---:|---|---|---|---|
| −10000 | `senderProcessNotAuthenticated` | yes | `Sender process is not authenticated`. Analytics reasons (protobuf, not the JSON-RPC message): `CODEX_COMPUTER_USE_IPC_AUTHORIZATION_FAILURE_REASON_{MISSING_PARENT,UNTRUSTED_PARENT,RELAY_WITHOUT_TRUSTED_ANCESTOR}` | **Live MCP** `list_apps` / `get_app_state(Finder)` / Messages / Calendar / EventStream / Computer History `tools/call` from an untrusted parent. Unix ping: **no code on the wire** (FIN, 0 bytes) |
| −10001 | `couldNotGetRequestData` | yes | `Could not get request data` (Apple Event) | — |
| −10002 | `couldNotGetRequestTypeName` | yes | `Could not get request type name from Apple event` | — |
| −10003 | `couldNotResolveRequestType` | yes | `Could not resolve request type: ` | — |
| −10004 | `unhandledEvent` | yes | `Unhandled event: ` | — |
| −10005 | **`unknownError`** | yes | Catch-all. Trace detail **`noWindowsAvailable`** (inner case, not a `Code`). Other operational cases collapse here as message — §5 | **Traces** coordinate click ×2 |
| −10006 | `appNotAllowed` | yes | `Computer Use is not allowed to use the app '` … `' for safety reasons.` Also `Computer use actions are not allowed for system security process: ` (`systemSecurityTargetNotAllowed`). JS policy `forbidden` throws the same “not allowed…safety” sentence **without** this code | — |
| −10007 | `runningApplicationNotFound` | yes | `Running application not found: ` | — |
| −10008 | `accessibilityError` | yes | prefix `Accessibility error: ` | — |
| −10009 | `permissionsNotGranted` | yes | `Computer Use permissions are not granted` | — |
| −10010 | `invalidApp` | yes | enum only (identifier resolution) | — |
| −10011 | `noActiveSession` | yes | `Computer Use is not active for '` … `'. You first must call \`get_app_state\` to get the latest state before doing other Computer Use actions. If \`get_app_state\` is not available in your environment, use \`tool_search\` to surface it.` | — |
| −10012 | `userStoppedSession` | yes | `This application session has been explicitly stopped by the user for this turn. Stop your work and send a final message noting they stopped the session and you're ready to continue if they want you to. Computer Use can be used again in the next assistant turn.` Native session case name `appStoppedByUser`. JS telemetry `cancelled` | — |
| −10013 | `incompatibleClientVersion` | yes | `The Computer Use server and client have a version mismatch. To use Computer Use, ask the user to relaunch their ChatGPT app so that the client will be updated to the latest version.` JS ping mismatch is a **transport** error, not this code. Unauthenticated unix peers never reach version check | **not live-proven** |
| −10014 | `permissionsPending` | yes | Short: `Computer Use permissions are still pending`. Long: `Computer Use permissions are still pending. The user has not finished granting Accessibility and Screen Recording permissions in the ChatGPT Computer Use window. Call this tool again, as the user is almost done finishing granting permissions. Do not end your turn yet, just call this tool again.` | — |
| −10015 | `blockedURL` | yes | `Computer Use stopped due to encountering a disallowed URL: ` and `This session has been stopped because Computer Use is not allowed on the current browser URL. Stop your work and send a final message noting why the session has been ended. Note that Computer Use is not allowed on this URL even if the user navigates to it themselves.` JS comment: ends the session if CU hits a disallowed browser URL | — |
| −10016 | `userIntervened` | yes | enum only as a sentence; companion `'. Re-query the latest state with \`get_app_state\` before sending more actions.` Session enum sibling of `appNotAllowed` / `noActiveSession` / `appStoppedByUser`. Nearby: `userInterruptedControlledApp`. JS telemetry `cancelled` | — |
| −10017 | `couldNotGetSenderPID` | yes | `Could not get sender PID from Apple event` | — |
| −10018 | `ambiguousApp` | yes | `Ambiguous app identifier '` … `'. Multiple apps share this bundle identifier: ` … `. Use an app name or full app path instead.` | — |
| −10019 | `couldNotGetBootstrapPort` | yes | `Could not get XPC bootstrap mach port from Apple event` | — |
| −10020 | `screenLocked` | yes | Three variants: (1) `The Mac is locked and automatic unlock could not unlock it. Ask the user to unlock the Mac manually before continuing.` (2) `…automatic unlock is paused because physical input was detected. …` (3) `…this Computer Use request cannot be associated with a ChatGPT thread. …` | — |
| −10021 | **(absent → `jsonRPCError`)** | `turnEnded` | `Computer Use is unavailable because the current turn ended. It will work again after the next user message.` Client argv `turn-ended` | — |
| −10022 | **(absent)** | `messagesPermissionsPending` | `Messages permission setup is still open` / `….` | — |
| −10023 | **(absent)** | `messagesPermissionsDenied` | `Required Messages permissions were not granted` / `….` | — |
| −10024 | **(absent)** | `messagesQueryTimedOut` | `The Messages database query exceeded its time limit` / `….` | — |
| −10025 | **(absent)** | `messagesInvalidRequest` | `Invalid Messages request: ` | — |
| −10026 | **(absent)** | `messagesAmbiguousDestination` | `Ambiguous Messages destination: ` | — |
| −10027 | **(absent)** | `messagesSendPlanUnavailable` | `Messages send plan is unavailable (` … `Messages send plan was already consumed. Delivery may already have occurred.` | — |
| −10028 | **(absent)** | `messagesSendOutcomeUncertain` | `Messages could not verify whether the send completed` / `…. Sending again could duplicate the message.` | — |
| −10029 | **(absent)** | `messagesSendRateLimited` | `Messages sending is temporarily rate limited. Try again in ` + associated `retryAfterSeconds` | — |

Anything outside −10000…−10020 is `errorName: "jsonRPCError"` in JS, including the proven native extras −10021…−10029 if the unix path ever returned them.

---

## 5. Inner cases that ride on −10005

JS has **no** symbol `noWindowsAvailable`. Native JSON-RPC still sends **code −10005**. The **message** is the inner case name or a human sentence.

Proven: traces `Computer Use server error -10005: noWindowsAvailable`.

`noWindowsAvailable` sits in AccessibilitySupport next to `windowNotFoundAtPosition`, `windowNotFoundForID`, `failedToGetWindowIDForElement`, `elementPresumedOOPAndNotFound`, `elementIsOOPButExpectedToTargetAppAndNoEligibleParentElementWasFound`, and (nearby) `noAppNameMatch`, `noFrontmostApp`, `cgWindowNotFound`, `invalidProcessIdentifier`. Separate one-case enums: `matchingWindowNotFound`, `noMatchingWindow`. Stage-Manager pair: `stageManagerProcessNotRunning`, `windowNotFound`.

Coordinate `click([x,y])` / coordinate `drag` / coordinate `scroll` need a capturable / key window (screenshot space). AX **elementID** clicks in the same Linear session **worked** (`click(8)` File menu, …). `pressKey('c')` did not throw −10005.

### AppController / action enum (18 cases)

First-class `Code` siblings in this enum should **not** be catalogued as −10005: `runningApplicationNotFound` → −10007. The rest are the −10005 wrapping pattern (message = case name or sentence):

| Case | Human string (if any) |
|---|---|
| `noCapturableWindow` | `No capturable window found: ` |
| `invalidSecondaryActionForElement` | ` is not a valid secondary action for ` |
| `systemSecurityTargetNotAllowed` | `Computer use actions are not allowed for system security process: ` (also −10006 family) |
| `menuClickFailed` | enum only |
| `menuMouseActionNotSupported` | enum only |
| `appQuit` | enum only (field name; no standalone C string) |
| `noTextToType` | enum only |
| `pasteboardWriteFailed` | `Could not write generated content to the clipboard` |
| `pasteboardReadTimedOut` | `Timed out waiting for the application to read the clipboard` |
| `pasteboardChangedDuringPaste` | `The user may have conflicted with your paste operation. Check the app's state to ensure the user's content did not paste instead of your intended content before continuing.` |
| `invalidDuration` | also on the audio enum |
| `noScrollDirection` | `Missing scroll direction` |
| `noScrollAmount` | `Missing scroll amount` |
| `noAXTree` | `AX tree unexpectedly missing.` |
| `cannotSetValueForNonSettableElement` | `Cannot set a value for an element that is not settable` |
| `cannotSelectTextForElement` | `Cannot select text for an element that does not support a settable selected text range` |
| `textToSelectNotFound` | `Could not find the requested text to select in the element` |

### Other action / capture enums (same wrapping pattern)

| Enum | Cases | Human string |
|---|---|---|
| scroll/element | `invalidElementID`, `invalidScrollPages` | ` is an invalid element ID`; `The element ID is no longer valid. Try to get the on-screen content again and see if that resolves the issue.`; `Invalid scroll direction: ` |
| click/offscreen | `invalidParameter`, `failedToCreateSource`, `failedToTranslateKeyCodes`, `cannotClickOffscreenElement` | `Could not find key code for character: %C`; `Unable to get current keyboard layout.` / `…data.` / `…pointer.` |
| audio | `invalidDuration`, `noActiveRecording`, `noDisplay`, `recordingAlreadyActive`, `recordingNotOwned` | enum only (IPC `ComputerUseIPCStart/StopAudioRecordingRequest`) |
| nearby names | `blockedByPolicy`, `screenshotCaptureFailed` | `The screen capture failed.`; `UI tree capture failed.`; `Failed to capture AX payload: ` |
| AX capture | `failedToFindTextToReplace` | (near `noWindowsAvailable` in AccessibilitySupport) |

Session enum (**first-class codes**, not −10005): `appNotAllowed` (−10006), `noActiveSession` (−10011), `appStoppedByUser` (−10012), `userIntervened` (−10016).

---

## 6. Live / trace map

### 6.1 Traces — −10005 `noWindowsAvailable`

Task 2 Linear, tinysky `App.click([x,y])` → `sky.click({ app, x, y })` → IPC `at: { coordinate: { _0: [119, 35] } }`.

| js # (logical) | `call_id` | `item_id` | ts | result |
|---|---|---|---|---|
| 6 | `call_jNO6ISaArW8EX2vLUddBELFC` | `fc_05a61cc4349bad21016aa280b82d8887d0ab4f2046e13b6a21` | 2026-09-10T10:04:41.122Z | `Computer Use server error -10005: noWindowsAvailable` |
| 9 | `call_DloWqijxmEuYTXFSyAtBK8q0` | `fc_05a61cc4349bad21016aa280c517d087d0ac6d323415a73f13` | 2026-09-10T10:04:53.892Z | same |

Wall time ~0.01 s (`agents/11-raw-reparse/calls.json`). Same session: AX index clicks, `paste`, `setValue` succeeded. Not policy (`agents/16-policy`).

### 6.2 Live MCP — −10000 (XPC)

`SkyComputerUseClient mcp` under fnm / unsigned Node. `initialize` + `tools/list` succeed (server name `Computer Use`, 10 tools, no paste/audio). `tools/call` hits `ComputerUseIPCSenderAuthorization` and returns MCP `isError`:

```
Computer Use server error -10000: Sender process is not authenticated
```

Same string from Calendar `placeholder`, Messages, EventStream, Computer History (`agents/21-ipc-extras/copies/callseq-*.ndjson`). Team id `2DC432GLL2` on `cua_node` is **not** enough; parent must be ChatGPT / `computer-use-client-launcher` under that team.

`get_app_state` without `app`: MCP schema reject `Missing required argument: app` — **not** a `ServerErrorCode`.

Content-Length framing: JSON-RPC **−32700** `Parse error: Invalid JSON: Invalid message format` — MCP stdio parse, **not** `ServerErrorCode`.

### 6.3 Live unix socket — no code

`computeruse.sock` connect + `ping` `{ clientApiVersion: "CodexComputerUseIPC-5" }` → FIN, 0 inbound bytes. `jsonRpcErrorCode: null`. Wrapped as `SkyComputerUseTransportError: Sky Computer Use service startup request failed`. Wrong version (`CodexComputerUseIPC-0`) is the **same** EOF, not −10013. Auth runs before JSON-RPC parse on this path.

Trusted paths (not exercised by this process): `nodeRepl.nativePipe` from the host-side privileged bridge, or `SkyComputerUseClient` under a team-`2DC432GLL2` parent.

---

## 7. Not `ServerErrorCode`

| Kind | Example | Code |
|---|---|---|
| JS transport | `Sky Computer Use native pipe is unavailable` / `…startup request failed` / `…frame is too large` / `…invalid JSON-RPC response` / `…requires the trusted nodeRepl runtime` / `…timed out` / `…closed before response` / `Sky Computer Use API version mismatch: client=… server=…` | `SkyComputerUseTransportError` |
| JS policy (org) | `Computer Use is blocked from using the app '{bundle}' by your organization's policy.` | thrown `Error`, decision `denied` |
| JS policy (safety, pre-IPC) | `Computer Use is not allowed to use the app '{bundle}' for safety reasons.` | thrown `Error`, decision `forbidden` (same sentence as −10006) |
| JS elicitation | `Computer Use was not approved to use {displayName}` / `…to record computer audio` | thrown `Error` |
| MCP schema | `Missing required argument: app` | MCP `isError` text |
| MCP parse | `Parse error: Invalid JSON: Invalid message format` | JSON-RPC **−32700** |
| Native config | `Computer Use is disabled by your configuration.` | not in `Code` |
| Native transport | `Computer Use IPC server is unavailable.` / `Computer Use XPC session is unavailable.` / `The protected Computer Use app-group container is unavailable.` | not in `Code` |
| Native spawn | `Computer Use could not start because its runtime app is missing. …` | `couldNotFindServiceApp` (client-local) |
| Client-type enum | `legacyMCP`, `nodeRepl` | not errors |

---

## 8. Do not confuse `unknownError` with “no information”

- **Code −10005** = JS `unknownError` = native `Code.unknownError`.
- **Message** may be a specific inner case (`noWindowsAvailable` in traces).
- Cataloging −10005 as only “unknown” loses the native case the model actually saw.
- Coordinate actions can fail this way when the app has AX (menus) but no capturable content window; element-index actions in the same app can still succeed.

Agent 07’s 21-row table is the **JS** map. Agent 10 listed extra Swift names without numeric codes. This agent assigns **−10021…−10029** from the native `Code` metadata + `init(rawValue:)`.

---

## Sources

| Item | Path |
|---|---|
| JS enum + classes | ChatGPT `…/targets/mac/errors.js` |
| Types | `agents/02-sky-native/d.ts/targets/mac/errors.d.ts` |
| Pipe | `vendor/sky/js/native-pipe.js` (= ChatGPT `native-pipe.js`) |
| Policy / telemetry | ChatGPT `computer-use-policy.js` |
| Native `Code` | `SkyComputerUseService` fieldmd + ARM64 `rawValue` / `init(rawValue:)` / `throwMappedServerError` |
| Native copy | `strings` on service + `SkyComputerUseClient` |
| Traces −10005 | `agents/05-traces/calls.json`; `agents/11-raw-reparse/calls.json` |
| Live −10000 | `verify/results/mcp-ndjson.json`; `LIVE-VERIFICATION.md`; `verify/agents/v3-mcp-client`, `v7-mcp-ndjson` |
| Unix silent close | `verify/results/sky-shim.json`; `verify/agents/v1-native-ipc`, `v2-sky-shim`, `v6-adversarial` |
| Prior tables | `agents/07-native-app/FINDINGS.md`; `agents/10-native-actions/FINDINGS.md` §6; `agents/19-paste-audio-errors/FINDINGS.md` §3 |
