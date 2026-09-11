# Extra ComputerUseIPC surfaces (not the window-click API)

Local-disk reverse of every `ComputerUseIPC*` family that is **not** `AppPerformAction` / skyshot click-type, plus the five Swift MCP servers in `SkyComputerUseClient`. No Messages were sent. `tools/list` was called on the signed client; `tools/call` was attempted only for read-only tools and was rejected by sender auth (`-10000`).

## Verdict

`Codex Computer Use.app` is a **shared native bus**, not a single product. The same `SkyComputerUseService` (`com.openai.sky.CUAService`) implements window Computer Use **and** Messages, Calendar (stub), Record & Replay, Computer History (internal name **Skysight**), Appshot capture animation, menu-bar status-item state, frontmost-window lookup, loopback audio, and lock-screen auto-unlock.

The click/type path used by tinysky `cua.getApp` / `@oai/sky` is only:

```
ComputerUseIPCListAppsRequest
ComputerUseIPCAppPolicyRequest
ComputerUseIPCAppStartRequest
ComputerUseIPCAppGetSkyshotRequest
ComputerUseIPCAppPerformActionRequest
(+ optional Start/StopAudioRecordingRequest)
```

Everything below is extra. Four bundled plugins exec the **same** `SkyComputerUseClient` binary with different argv. A fifth MCP mode (`calendar`) is compiled in and has **no** shipped plugin.

| Family | Product vs CUA | Plugin | Client argv | Swift MCP server | Live MCP tools | Native IPC requests |
|---|---|---|---|---|---|---|
| **Messages\*** | **Separate product** | `messages@openai-bundled` | `messages mcp` | `MessagesMCPServer` | 6: `find_chats`, `read_messages`, `search_messages`, `send_message`, `count_message_activity`, `read_image` | `FindChats` / `ReadMessages` / `SearchMessages` / `PrepareSend`+`CommitSend` / `CountActivity` / `ReadImage` |
| **Calendar\*** | **Separate product (stub)** | **none shipped** | `calendar mcp` | `CalendarMCPServer` | 1: `placeholder` → `not_implemented` | `CalendarPlaceholderRequest/Response` |
| **EventStream\*** | **Separate product** | `record-and-replay@openai-bundled` | `event-stream mcp` | `EventStreamMCPServer` | 3: `event_stream_{start,status,stop}` | `EventStream{Start,Status,Stop}Request` |
| **Skysight\*** | **Separate product** | `computer-history@openai-bundled` | `computer-history mcp` | `ComputerHistoryMCPServer` | 5: `computer_history_{pause,resume,status,get_settings,update_settings}` | `Skysight{Start,Stop,Pause,Resume,Status,GetSettings,UpdateSettings,UpdateObservationPolicy,ClearHistory}*` |
| **CaptureAnimation\*** + Appshot | **CUA-adjacent** (ChatGPT composer / dual-⌘ screenshot, not agent click) | none | — | — | none | `AppStartCapture*` / `AppNextCaptureUpdate` / `CaptureUpdate*` |
| **StatusItem\*** | **CUA-adjacent host UI** (ChatGPT menu bar) | none (feeds Computer History + CUA chrome) | — | — | none | `CodexStatusItemMenuState{,Request}` / `CodexStatusItemStateNotification` |
| **FrontmostWindow\*** | **CUA-adjacent host API** | none | — | — | none | `FrontmostWindow` / `FrontmostWindowRequest` |
| **Audio\*** | **CUA-adjacent** (JS `sky.*` only, gated) | **not** on `computer-use` MCP | — | not listed by `ComputerUseMCPServer` | none on MCP | `StartAudioRecordingRequest` / `StopAudioRecordingRequest` / `Audio` |
| **LockScreen\*** | **CUA-adjacent infra** | none | — | — | none | protocol `RequestExemptFromLockScreenAutoUnlock`; Guardian XPC + `/tmp/.../LockScreenLoginAuthorization.sock` |
| Window click (contrast) | **CUA itself** | `computer-use@openai-bundled` **and** hidden `unified-computer-use` JS | `mcp` | `ComputerUseMCPServer` | 10 window tools, **no** paste/audio | `ListApps` / `AppPolicy` / `AppStart` / `GetSkyshot` / `PerformAction` |

`@oai/sky` Mac JS (`mac-client.js`) never names Messages / Calendar / EventStream / Skysight / Capture / StatusItem / FrontmostWindow. Those families are reached by `SkyComputerUseClient` XPC or ChatGPT `sky.node`, not by tinysky.

---

## Shared plumbing

### One client, many MCP products

Binary (help banner `USAGE: cua <subcommand>`):

```
~/.codex/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient
bundle com.openai.sky.CUAService.cli
```

CLI (live `--help`):

```
mcp                 Runs the Computer Use client as an MCP server
event-stream mcp    Runs the Record & Replay client as an MCP server
computer-history mcp
                    Runs the Computer History client as an MCP server
calendar mcp        Runs the Calendar client as an MCP server
messages mcp        Runs the Messages client as an MCP server
turn-ended          Handles a Codex turn-ended notification
```

Four plugins ship an identical launcher that `exec`s that binary with plugin-specific args:

```sh
codex_home="${CODEX_HOME:-${HOME}/.codex}"
client="${codex_home}/computer-use/Codex Computer Use.app/.../SkyComputerUseClient"
exec "${client}" "$@"
```

| Plugin `.mcp.json` server name | args |
|---|---|
| `computer-use` | `["mcp"]` |
| `messages` | `["messages", "mcp"]` |
| `computer-history` | `["computer-history", "mcp"]` |
| `event-stream` (plugin id `record-and-replay`) | `["event-stream", "mcp"]` |

There is **no** `calendar` plugin under `plugins/openai-bundled`. Calendar is client-only.

Swift types (`native/swift-types.txt`, module `ComputerUseClient`):

```
ComputerUseMCPServer
MessagesMCPServer
CalendarMCPServer
EventStreamMCPServer
ComputerHistoryMCPServer
```

Transport to the service is **XPC** (`ComputerUseIPCXPCTransport` / `SAIComputerUseIPCXPCProtocol`), API version `CodexComputerUseIPC-5`. JS tinysky uses the Unix JSON-RPC socket instead. Same request-type strings either way.

Framing of the MCP stdio servers is **NDJSON JSON-RPC**. `initialize` returns `serverInfo.name`:

| argv | `serverInfo.name` | `serverInfo.version` (sha256 of tool surface) |
|---|---|---|
| `mcp` | `Computer Use` | `14e7d17f…` |
| `messages mcp` | `Messages` | `387913d3…` |
| `calendar mcp` | `Calendar` | `eec57ae6…` |
| `computer-history mcp` | `Computer History` | `60925a63…` |
| `event-stream mcp` | `Record & Replay` | `bb9a4422…` |

Live `tools/call` from this unsigned parent, including Calendar `placeholder`, returns:

```
Computer Use server error -10000: Sender process is not authenticated
```

So even the Calendar stub still **round-trips an IPC request** into `SkyComputerUseService`. `tools/list` does not.

This machine’s `~/.codex/config.toml` enables `computer-use@openai-bundled` and `unified-computer-use@openai-bundled`. It does **not** enable `messages`, `computer-history`, or `record-and-replay`. `[mcp_servers.computer-use] enabled = false`. Native CUA still runs because ChatGPT.app launches `SkyComputerUseService` and tinysky talks over `computeruse.sock`.

---

## 1. Messages\* — separate product

### Plugin

`/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/messages/`

- version `1.0.1000968`
- displayName **Messages**
- no skills directory
- MCP server name `messages`
- keywords: iMessage / SMS / RCS / macos
- entitlements on the **service** (not the plugin): Contacts (`addressbook`) + Apple Events; Info.plist `NSContactsUsageDescription` / `NSAppleEventsUsageDescription` talk about messaging

Native stack in the service: `MessagesOperationCoordinator`, `MessagesCore.MessagesSender`, `MessagesCore.SystemMessagesContactResolver`, `LiveMessagesDatabaseSession` (SQLite chat.db).

### MCP tools (live `tools/list`)

| Tool | Side effect | Maps to IPC |
|---|---|---|
| `find_chats` | read | `ComputerUseIPCMessagesFindChatsRequest` |
| `read_messages` | read | `ComputerUseIPCMessagesReadMessagesRequest` |
| `search_messages` | read | `ComputerUseIPCMessagesSearchMessagesRequest` |
| `send_message` | write (user-approved) | `PrepareSendRequest` then `CommitSendRequest` |
| `count_message_activity` | read | `ComputerUseIPCMessagesCountActivityRequest` |
| `read_image` | read (+ file handles) | `ComputerUseIPCMessagesReadImageRequest` |

`send_message` is the only destructive Messages tool (`openWorldHint: true`). Description: provide **exactly one of** `chat_guid` **or** `recipients`; text and/or up to 10 local file attachments; user may edit before approve (`user_edited`); reactions/edits/unsends are **unsupported** — “use the Computer Use plugin for those UI operations.”

Send is two-phase **inside** the client, not two MCP tools. There is no `prepare_send` / `commit_send` MCP name. IPC types:

```
ComputerUseIPCMessagesSendDestinationKind
ComputerUseIPCMessagesSendAttachment
ComputerUseIPCMessagesPreparedSend
ComputerUseIPCMessagesPrepareSendRequest
ComputerUseIPCMessagesSendResult
ComputerUseIPCMessagesSendPlanUnavailableReason
ComputerUseIPCMessagesCommitSendRequest
```

Elicitation copy in the client: `For this conversation`, `Always allow sending to this chat`. Service keeps `SendPlan` / `SendPlanTombstone`. Errors: rate limit, send-completion unverified, DB query timeout, permissions not granted / setup still open.

Read path uses `chat_guid` as the stable id; per-page `local_ref` for chats/senders is **not** reusable across responses. `read_image` takes attachment `id` from a prior read/search page; response may be resized. `ComputerUseIPCRequestWithFileHandles` is the protocol for image bytes.

Activity enums: interval `total|day|week|month|year`, breakdown `overall|chat`, chat_type `direct|group`, rank_by `total|sent|received`. “Calendar interval” in that schema is **date bucketing**, not the Calendar product.

### IPC types (full family)

Requests: `FindChats`, `ReadMessages`, `SearchMessages`, `PrepareSend`, `CommitSend`, `CountActivity`, `ReadImage`.

Payload/result structs: `Chat`, `ChatMetadata`, `ChatReference`, `ChatSearchPage`, `ChatsPage`, `Message`, `MessageAttachment`, `MessagesPage`, `Image`, `Participant`, `ParticipantReference`, `ChatActivity`, `OverallActivity`, `Activity{Breakdown,ChatType,Count,Interval,Range,Rank,Result}`, `Service`.

Not CUA. Same process, same auth, different MCP server.

---

## 2. Calendar\* — separate product, stub only

Swift: `CalendarMCPServer`, `CalendarOperationCoordinator`.

IPC:

```
ComputerUseIPCCalendarPlaceholderRequest
ComputerUseIPCCalendarPlaceholderResponse
```

Live MCP tool:

| Tool | Schema | Description |
|---|---|---|
| `placeholder` | `{}` | “Placeholder for the planned Calendar plugin. Returns `not_implemented` without accessing or changing calendar data.” |

No plugin directory, no skill, no EventKit usage strings in the CUA Info.plist (`Privacy_Calendars` appears only as a System Settings deep-link token in the permission UI). Analytics type `CodexCalendarMcpServerLaunched` is already wired.

`tools/call placeholder` from this process still hits the service and dies with `-10000`, i.e. the stub is a real IPC request, not a client-local constant.

Outlook/Teams calendar plugins under `openai-curated` are **unrelated** remote connectors.

---

## 3. EventStream\* — Record & Replay (separate product)

### Plugin

`record-and-replay@openai-bundled` version `1.0.1000968`

- `.mcp.json` server name **`event-stream`** (not `record-and-replay`)
- args `["event-stream", "mcp"]`
- skill `skills/record-and-replay/SKILL.md`
- UI overlay types live in the **service** process: `RecordAndReplayOverlayController`, `RecordAndReplayRecordingControlsController`, `RecordAndReplayWarningPopoverController`

User-facing: record mouse/keyboard/AX for **up to 30 minutes**, then turn the JSONL into a skill. One active recording at a time. Starting **elicits** (“ChatGPT will start recording your mouse clicks…”). Cancel → `endReason: recording_controls_cancelled`; do not call `event_stream_stop` again.

### MCP tools

| Tool | Maps to IPC | Notes |
|---|---|---|
| `event_stream_start` | `ComputerUseIPCEventStreamStartRequest` | empty args; if already active, return that session |
| `event_stream_status` | `ComputerUseIPCEventStreamStatusRequest` | current **or most recent**; paths to metadata + events |
| `event_stream_stop` | `ComputerUseIPCEventStreamStopRequest` | returns `metadataPath` / `eventsPath` |

The MCP server **does not** stream event contents. The model reads `session.json` + `events.jsonl` from disk with ordinary filesystem tools.

Skill-documented on-disk layout (after stop): `metadataPath`, `eventsPath`; cancel confirmed via `session.json` `endReason`. Observed end-reason tokens: `recording_controls_stopped`, `recording_controls_cancelled`. IPC enum `ComputerUseIPCEventStreamEndReason`; session blob `ComputerUseIPCEventStreamSessionStatus`.

### Native capture (shared with Skysight)

Service types: `EventStreamService`, `EventStreamRecorder`, `EventStreamCaptureCoordinator`, `EventStreamJSONLWriter`, `EventStreamCodexEvaluator`, `EventStreamURLPolicyRecordFilter`.

Record shape (type names, not a live JSON sample): `EventStreamRecord` with `EventStreamEventKind`, `EventStreamApp`, `EventStreamWindow`, `EventStreamMouseInteraction` (+ drag endpoint), `EventStreamKeyboardInteraction`, `EventStreamAXElement`, `EventStreamSelection`, `EventStreamTextRange`, `EventStreamAXTree` (`Mode` = full tree vs diff), `EventStreamDiagnostic`. AX diffs use `~` / `+` / `-`. `window.changed` is a concrete event name string.

This is **not** Computer Use replay of CGEvents. The skill tells the model to *author a new skill* that may call Computer Use later. Overlay copy: “Record & Replay is recording your actions”.

---

## 4. Skysight\* — Computer History (separate product)

Internal name **Skysight**; user-facing **Computer History**. Same EventStream recorder, different product: rolling background capture + 10-minute / 6-hour memory summaries, not a 30-minute skill recording.

### Plugin

`computer-history@openai-bundled` version `1.0.1000968`

- MCP server name `computer-history`
- args `["computer-history", "mcp"]`
- skill documents status states `running | paused | stopped`, `eventStreamRootPath`, and `~/.codex/memories/extensions/skysight/`
- ChatGPT.app ships `computer-history.svg` / `computer-history-pause.svg` / `computer-history-resume.svg` for the host status item

Bundled prompts in the service:

- `Package_ComputerUse.bundle/.../SkysightSummarizer.md`
- `Package_ComputerUse.bundle/.../SkysightMemoryInstructions.md`

Memory files: `YYYY-MM-DDTHH-MM-SS-{4_alpha}-10min-{slug}.md` and `...-6h-...`. Tag `[skysight memory]`. Private browsing is always excluded.

### MCP tools vs IPC (mismatch is real)

| MCP tool | IPC | In MCP? |
|---|---|---|
| `computer_history_pause` | `ComputerUseIPCSkysightPauseRequest` | yes |
| `computer_history_resume` | `ComputerUseIPCSkysightResumeRequest` | yes |
| `computer_history_status` | `ComputerUseIPCSkysightStatusRequest` → `SkysightStatus` / `SkysightState` | yes; returns `eventStreamRootPath` |
| `computer_history_get_settings` | `ComputerUseIPCSkysightGetSettingsRequest` → `SkysightSettings` | yes |
| `computer_history_update_settings` | `UpdateSettingsRequest` / `UpdateObservationPolicyRequest` | yes; **replace-all** observation document |
| *(status item / Codex Settings)* | `SkysightStartRequest` / `StopRequest` | **no MCP start/stop** |
| *(status item Clear History)* | `SkysightClearHistoryRequest` + `ClearHistoryScope` + `HistoryInterval` | **no MCP clear** |

Skill: “If Computer History is stopped … offer to start it.” There is no `computer_history_start` tool. Enablement is Codex Settings / menu bar. Stopped copy: “Computer History is stopped. Enable Computer History in Codex Settings first.”

`computer_history_update_settings` input (live schema) matches IPC observation types:

```
observation.defaultApplicationBehavior: observe | do_not_observe
observation.defaultURLBehavior:        observe | do_not_observe
observation.allowlist[] / blocklist[]:
  scope: app | url
  bundleID?   (app rules)
  urlDomain?  (bare domain, no scheme/path; subdomains match)
```

IPC names: `SkysightObservationDefaultBehavior`, `ObservationRule`, `ObservationRuleScope`, `ObservationSettings`. A matching block rule wins within its scope. Browser records with a URL must pass **both** app and URL policy.

Client field `computerHistoryState` / tokens `running`, `paused`, `stopped`.

Analytics: `CodexSkysightMcpServerLaunched`, `McpToolCalled`, `Service{Started,Stopped,Paused,Resumed}`, `ObservationSettingsUpdated`, `StatusItemActionClicked`, `HistoryCleared`, `MemorySummaryFinished`. Stop reasons: `REQUESTED`, `SERVICE_TERMINATED`.

Not CUA. Shares AX + ScreenCaptureKit + URL blocklist with CUA/Record & Replay.

---

## 5. CaptureAnimation\* / Appshot — CUA-adjacent, not an agent tool

IPC:

```
ComputerUseIPCAppStartCaptureRequest          (+ nested Version)
ComputerUseIPCAppStartCaptureResponse         (+ Result)
ComputerUseIPCAppStartCapturePermissionGrantState
ComputerUseIPCAppStartCaptureAnimationTarget
ComputerUseIPCAppStartCaptureAnimationPresentationStyle
ComputerUseIPCAppStartCaptureAnimationColor
ComputerUseIPCAppStartCaptureAnimationDisplay
ComputerUseIPCAppStartCaptureAnimationRect
ComputerUseIPCAppNextCaptureUpdateRequest
ComputerUseIPCCaptureUpdateType
ComputerUseIPCCaptureFailureReason
ComputerUseIPCCaptureUpdate
```

This is **Appshot**, the ChatGPT-composer screenshot, not `GetSkyshot` (the per-action AX+screenshot used by click). Copy in the service:

> ChatGPT needs these permissions to take appshots. Appshots are captured when you attach from the + menu or press both command keys simultaneously.

Implementation types: `AppshotCaptureStore`, `AppshotCaptureSound`, `AppshotCaptureTransition`, `AppshotCaptureTransitionOverlayWindow`, `FogCursorStyle` / `FogCursorViewModel` (the capture fog overlay). Bundle `Package_Appshot.bundle`.

Permission-grant tokens: `none_granted`, `accessibility_granted`, `screen_recording_granted`, `both_granted`, plus `abandoned` (`abandonedAppshotPermissionGrantStates`). Capture is a **session**: `StartCapture` then poll `NextCaptureUpdate` until a `CaptureUpdate` completes or fails.

No plugin, no MCP tool, not in `@oai/sky`. Caller is ChatGPT.app (composer + shortcut), talking to the same service. CUA-adjacent because it reuses ScreenCaptureKit / permission window / CUAService.

`GetSkyshot` remains the window-click observation path and is **out of scope** here.

---

## 6. StatusItem\* — CUA-adjacent host chrome

IPC:

```
ComputerUseIPCCodexStatusItemMenuState
  nested: Application, ComputerUse, HistoryAvailability,
          RecentDomain, ApplicationSession, RecentApplication, ComputerHistory
ComputerUseIPCCodexStatusItemMenuStateRequest
ComputerUseIPCCodexStatusItemStateNotification
```

Darwin notify: `com.openai.codex.computer-use.status-item-state-changed` (also in `native/bundle-ids.txt`).

The **menu bar extra is drawn by ChatGPT.app**, not by the plugins:

`/Applications/ChatGPT.app/Contents/Resources/native/sky.node`  
module `SkyNative`, files `StatusItemController.swift` / `CGWindow.swift`.

JS-facing methods on the addon: `createStatusItem`, `updateStatusItemMenuState`, `updateStatusItemState`, `destroyStatusItem`.

Menu-state JSON keys from the notify payload strings:

```
computerUse, computerHistory, state,
canClearHistory, domains, domain, isExcluded,
lastSession, lastDay, lastHour, lastTenMinutes,
activeApplications, recentApplications,
unread, pinned, labels,
target, scope, duration, applicationId, path, type, bundleURL
```

SkyNative enums: `StatusItemObservationScope`, `StatusItemPauseDuration`, `StatusItemClearHistoryScope`, `StatusItemRecorderState`, `StatusItemFeatureIcon`. Clear-history / pause-duration / start-stop of Skysight are **status-item actions**, which is why those IPC requests exist without MCP tools.

The service also has `CUAServiceStatusItemView` + `CodexStatusItemStateNotificationPublisher` — it publishes state; ChatGPT renders the extra.

CUA-adjacent UI over two products (Computer Use activity + Computer History recorder). Not a plugin MCP server.

---

## 7. FrontmostWindow\* — CUA-adjacent host API

IPC:

```
ComputerUseIPCFrontmostWindow
ComputerUseIPCFrontmostWindowRequest
```

`sky.node` exports `frontmostWindow` next to `spawnComputerUseService` and the status-item methods. Types: `SkyNative.FrontmostWindow` + `CGWindowListOption` / `ActivationPolicy`. Service has `SystemFrontmostApplicationTracker` (AccessibilitySupport) used by EventStream attribution and PIP.

No MCP tool. Not in `@oai/sky` window client. Used by ChatGPT for overlay / PIP targeting (`RemoteHostedPIP*`, `setComputerUseCursorLocation`) and likely by Skysight/EventStream window attribution. CUA-adjacent.

---

## 8. Audio\* — CUA-adjacent, JS-only, gated

IPC:

```
ComputerUseIPCStartAudioRecordingRequest   # body includes maxDurationMilliseconds
ComputerUseIPCStopAudioRecordingRequest
ComputerUseIPCAudio                        # { url: file://... } WAV
```

JS (`audio_recording.js`):

- `start_audio_recording({ max_duration_ms? })` default **60000**, clamp **100..300000**
- IPC field `maxDurationMilliseconds`
- elicitation: “Allow Computer Use to record computer audio?” (`riskLevel: high`, `tool_name: start_audio_recording`)
- `stop_audio_recording()` → `{ filepath, bytes, data_url }` 24 kHz stereo WAV (`types/window/Audio.d.ts`)
- **omitted unless** `SKY_ENABLE_AUDIO=1` (`create_client.js`)

Native: `ComputerUseAudioRecorder` + `AVAudioFile` + ScreenCaptureKit. **Not** on `ComputerUseMCPServer`’s live 10-tool list (same omission as `paste`). Unified-computer-use `js` can see the methods only when the env gate is on.

CUA-adjacent (same policy/elicitation/session as window actions). Not a separate plugin.

---

## 9. LockScreen\* — CUA-adjacent infrastructure

There is **no** `ComputerUseIPCLockScreen*Request`. The listed extra is a **protocol** that request types can conform to:

```
ComputerUseIPCRequestExemptFromLockScreenAutoUnlock
ComputerUseIPCRequestRequiringSystemPermissions
ComputerUseIPCRequestWithFileHandles
```

Purpose: keep an in-flight Computer Use turn working across screensaver/loginwindow.

Pieces (all in Computer Use.app, documented in agent 07, confirmed here):

| Piece | Role |
|---|---|
| `CUALockScreenGuardian` (`com.openai.sky.CUAService.guardian`) | overlay + AX at loginwindow; Mach bootstrap + `SAILockScreenGuardianXPCProtocol` |
| `LockScreenAutoUnlockCoordinator` / `LoginAuthorizationBroker` | auto-unlock while a CUA thread is active |
| `/tmp/com.openai.sky.CUAService/LockScreenLoginAuthorization.sock` | SecurityAgent plugin ↔ service |
| `CodexComputerUseAuthorizationPlugin` | patches `system.login.screensaver` `evaluate-mechanisms` |
| Darwin | `com.apple.sessionagent.screenIsLocked` / `screenIsUnlocked` / `screenLockUIIsShown` |

User-facing errors: automatic unlock paused because **physical input** was detected; Mac locked and unlock failed — ask the user to unlock. IPC error `-10020 screenLocked`.

No plugin MCP. Not Messages/History. Strictly CUA session continuity.

---

## Plugin map (what the model actually gets)

### `computer-use` — window click MCP (contrast only)

Live 10 tools: `list_apps`, `get_app_state`, `click`, `perform_secondary_action`, `set_value`, `select_text`, `scroll`, `drag`, `press_key`, `type_text`.

**Missing vs JS `@oai/sky`:** `paste`, `start_audio_recording`, `stop_audio_recording`. Tinysky `cua.*` is the current agent path (`unified-computer-use` → `cua_repl` → native pipe). This MCP is the older parallel surface; on this machine the server is disabled in `config.toml`.

Turn-end for native sessions is **not** an MCP tool on this server. Codex `notify = [SkyComputerUseClient, "turn-ended"]` sends `ComputerUseIPCCodexTurnEndedRequest` (payload `agent-turn-complete`). Separate from `cua_repl.turn_ended`.

### `messages` — Messages family only

Six tools above. No Computer Use actions, no Calendar.

### `computer-history` — Skysight subset

Five control/settings tools. No event JSON over MCP. Start/stop/clear are status-item / Settings.

### `record-and-replay` — EventStream family only

Three session tools. Event payload is files on disk.

### Calendar — not a plugin

`SkyComputerUseClient calendar mcp` only.

---

## CUA-adjacent vs separate products

**Separate products** (own plugin tile, own MCP server name, own Statsig `*McpServerLaunched`, own confirmation UX):

1. Messages  
2. Computer History / Skysight  
3. Record & Replay / EventStream  
4. Calendar (planned; stub MCP)

They piggy-back on Computer Use.app because they need the same TCC (Accessibility, Screen Recording, Contacts), the same sender-auth, and (for History/Replay) the same AX event recorder.

**CUA-adjacent** (no extra plugin; exist to make Computer Use or ChatGPT-host chrome work):

1. Audio recording (optional `sky.*`)  
2. Appshot CaptureAnimation (composer / dual-⌘)  
3. Status item (ChatGPT `sky.node` menu extra)  
4. FrontmostWindow (host + PIP + attribution)  
5. LockScreen auto-unlock / Guardian  
6. `CodexTurnEnded` notify (session teardown for the clicker)

**Not extra, for orientation:** `AppPerformAction` / `GetSkyshot` / `ListApps` / `AppPolicy` / `AppStart|Stop|Modify|Usage` are the window Computer Use API (agents 02 / 07).

---

## What was and was not executed

Done, local-only:

- Read plugin manifests, skills, `ipc-request-types.txt`, `swift-types.txt`
- `strings` on `SkyComputerUseService`, `SkyComputerUseClient`, `sky.node`
- `SkyComputerUseClient --help` and subcommand help
- NDJSON `initialize` + `tools/list` for all five MCP modes (signed client; no extra IPC)
- Sequential `tools/call` for `placeholder`, `computer_history_status`, `event_stream_status` — all `-10000` (auth wall; response shape not retrieved)

Not done (by design):

- No `send_message` / `PrepareSend` / `CommitSend`
- No `event_stream_start`
- No Computer History start/clear
- No unsigned socket traffic beyond the already-known auth failure

Evidence files: `agents/21-ipc-extras/copies/` (`mcp-tools.json`, `*.tools-list.ndjson`, `callseq-*.ndjson`, plugin json/md, `client-cli-help.txt`).

---

## Sources

| Artifact | Path |
|---|---|
| IPC type dump | `codex-cua-reverse/native/ipc-request-types.txt` |
| Swift types | `codex-cua-reverse/native/swift-types.txt` |
| Service / client binaries | `~/.codex/computer-use/Codex Computer Use.app` |
| ChatGPT host addon | `/Applications/ChatGPT.app/Contents/Resources/native/sky.node` |
| Plugins | `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/{messages,computer-history,record-and-replay,computer-use}/` |
| JS audio/click client | `cua_node/.../@oai/sky/dist/project/cua/sky_js/src/targets/mac/{client,audio_recording,create_client}.js` |
| Skysight prompts | `Codex Computer Use.app/Contents/Resources/Package_ComputerUse.bundle/.../Skysight{Summarizer,MemoryInstructions}.md` |
| Prior native reverse | `agents/07-native-app/FINDINGS.md` |
