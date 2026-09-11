# FINDINGS — paste vs MCP, audio gating, ServerErrorCode

Date: 2026-09-10. Local disk only. No Linear clicks.

These three gaps affect catalog completeness: traces used `app.paste` while live MCP `tools/list` has no `paste`; audio IPC exists but is env-gated; traces and live MCP returned Computer Use server errors whose **message** is not the JS enum name.

---

## Verdict

| Gap | Fact |
|---|---|
| **Paste** | Two native-app paths, one browser path. Traces used tinysky `linear.paste(..., {format:'text'})` → JS `@oai/sky` `MacComputerUseClient.paste` → IPC `ComputerUseIPCAppPerformActionRequest` `{ action: { paste: { text, format } } }`. Live `SkyComputerUseClient mcp` `tools/list` is **exactly 10 tools and does not include `paste`**. Browser `Tab.paste` is a different implementation: clipboard write then **`tab.ax.pressKey("Ctrl+v")`** with no `Meta+v` / darwin branch (tinysky QUESTIONS #10, confirmed). |
| **Audio** | **In this Mac app, yes** (`ComputerUseAudioRecorder`, `ComputerUseIPCStartAudioRecordingRequest` / `Stop…`, AVFoundation). **Not on the model-facing surface of this install.** Public `sky.start_audio_recording` / `stop_audio_recording` are omitted unless `SKY_ENABLE_AUDIO=1`. Tinysky `Target` never wraps them. MCP `tools/list` has no audio tools. ChatGPT.app only injects the skill appendix when **both** `SKY_ENABLE_AUDIO=1` **and** `NODE_REPL_ENABLE_AUDIO=1`; live plugin variant is `node-repl`, not `node-repl-audio`. |
| **Errors** | JS `ServerErrorCode` is a 21-entry table **−10000…−10020**. Live MCP hit **−10000** `senderProcessNotAuthenticated` (“Sender process is not authenticated”). Traces hit **−10005** with message **`noWindowsAvailable`** on `app.click([119,35])`. JS maps −10005 → **`unknownError`**. Native has a larger Swift case set; operational names such as `noWindowsAvailable` ride on −10005 while `SkyComputerUseError.errorName` stays `unknownError`. |

`CAPABILITIES.md` currently marks `sky.start_audio_recording` as “wrapped by cua.App”. That is **wrong**: tinysky `App`/`Target` has `paste` but **no** audio methods.

---

## 1. Paste — three paths

### 1.1 What traces actually called (native App, not MCP)

Task 2 call (session `task-2-linear-issue`, `call_yorCS7HChcmH1XcOnOJjxS3U`, title “填写测试范围并核对负责人”):

```js
await linear.click(127);
await linear.typeText('补充 Ant Design Form 组件交互测试');
await linear.click(128);
await linear.paste('测试页面：https://ant.design/components/form\n\n…', {format:'text'});
await linear.click(131);
await linear.getAXState();
```

Source: `traces/task-2-linear-issue.json`, `agents/05-traces/calls.json` n=20 / logical js #20. Later `setValue` rewrote title (128) and body (130); that is copy editing, not a second paste.

This is **tinysky `App.paste`**, not `sky.paste({app,…})` and not MCP `tools/call paste`.

### 1.2 Path A — traces / tinysky App → JS Mac client → IPC (the working paste)

`create_tinysky_alt.js` binds App methods after `sky.get_app_state`. Paste is:

```js
paste(text, opts) {
  return sky.paste({
    app: boundAppId,
    text,
    format: opts?.format ?? "text",
  });
}
```

Pretty source: `agents/01-cua-tinysky/copies/oai_js_cua/tinysky_alt/create_tinysky_alt.pretty.js` (App `paste` around lines 183–187). Default format is **`"text"`** if omitted; traces passed it explicitly.

Then:

| Layer | File | Call |
|---|---|---|
| Public `sky` | `targets/mac/paste.js` | `withComputerUsePolicy("paste", input, …)` then `client.paste({app, text, format})` |
| IPC client | `vendor/sky/js/mac-client.js` (= ChatGPT `@oai/sky` `targets/mac/client.js`) | `performAction(app, { paste: { text, format } })` |
| Request type | same | `ComputerUseIPCAppPerformActionRequest` |
| Native | `SkyComputerUseService` | `PasteOperation` / `ComputerUseIPCPasteFormat` / `NSPasteboard`; restore previous clipboard |

Wire body (undefined fields stripped by `A()` in `mac-client.js`):

```json
{
  "requestType": "ComputerUseIPCAppPerformActionRequest",
  "request": {
    "app": "<policy-rewritten appPath>",
    "action": { "paste": { "text": "…", "format": "text" } }
  }
}
```

JS / tinysky / sky types: `format: "text" | "md" | "html"` (required on `sky.paste`, optional on tinysky `PasteOptions` because tinysky always fills `"text"`).

Native strings in `SkyComputerUseService`: `ComputerUseIPCPasteFormat`, `text`, `html`, **`markdown`** (not `md`), plus pasteboard errors `pasteboardWriteFailed`, `pasteboardReadTimedOut`, `pasteboardChangedDuringPaste`. Human copy: “The user may have conflicted with your paste operation. Check the app's state to ensure the user's content did not paste instead of your intended content before continuing.”

Docs (`tinysky-alt-core-cua-repl.md`, `computer-use-node-repl.md`): native paste uses the system pasteboard **then restores** the user’s previous clipboard. Prefer paste for formatted / multiline text.

`sky-window-api.md` documents `paste`. macos `SKILL.md` inside `@oai/sky/docs` **omits** paste (stale). The computer-use plugin node-repl skill **includes** it.

Policy: paste is an app-targeted method, so it goes through `withComputerUsePolicy` (same elicitation as click/type).

### 1.3 Path B — `SkyComputerUseClient mcp` (no paste tool)

Live `tools/list` (`verify/results/mcp-ndjson.json`):

```
list_apps
get_app_state
click
perform_secondary_action
set_value
select_text
scroll
drag
press_key
type_text
```

Server name `Computer Use`. **No `paste`. No `start_audio_recording`. No `stop_audio_recording`.**

The same 10 snake_case names appear consecutively in `SkyComputerUseClient`. The binary still contains the IPC action key `paste` and type `ComputerUseIPCPasteFormat` (it speaks the same perform-action protocol over XPC). That is **not** an MCP tool.

Consequence: a model talking only to `computer-use` MCP cannot paste except by `type_text` (or a user-level Cmd+V via `press_key`, which is not the native pasteboard restore path). The captured Linear session used **unified-computer-use `js` / tinysky**, which does have paste.

`~/.codex/config.toml` has `[mcp_servers.computer-use] enabled = false`. Traces never called this MCP.

### 1.4 Path C — browser `Tab.paste` uses `Ctrl+v` (QUESTIONS #10, confirmed)

`create_tinysky_alt` `decorateTab` (`create_tinysky_alt.pretty.js` lines 273–294):

```js
paste(text, opts) {
  const format = opts?.format ?? "text";
  if (format === "text" && tab.clipboard?.writeText) {
    await tab.clipboard.writeText(text);
  } else if (!tab.clipboard?.write) {
    if (format === "text") return tab.ax.typeText(text);
    throw new Error(`Browser clipboard does not support ${format} paste.`);
  } else {
    const entries = format === "html"
      ? [{ mimeType: "text/html", text }, { mimeType: "text/plain", text }]
      : [{ mimeType: "text/plain", text }]; // md → text/plain source
    await tab.clipboard.write([{ entries }]);
  }
  await tab.ax.pressKey("Ctrl+v");
}
```

Confirmed facts:

- Literal key string is **`"Ctrl+v"`**.
- No `process.platform` branch, no `"Meta+v"`, no `"super+v"`, no `"Command+v"`.
- `md` is written as `text/plain` (docs: “md format inserts Markdown source as plain text”).
- Browser paste **does not restore** the previous clipboard (docs + code).
- Fallback when clipboard write is missing: `typeText` for `"text"` only.

Browser AX docs (`vendor/browser-desktop/docs/accessibility.md`) describe `pressKey` as xdotool-style and give **`"super+c"`** as the Command-ish example, not `Ctrl+c`. Tinysky still sends **`Ctrl+v`**. Whether `ax.pressKey` remaps Ctrl→Cmd on darwin is **not** decided in `create_tinysky_alt.js`; the tinysky layer itself does not remap. Task 1 (Ant Design) never called `tab.paste`.

### 1.5 Paste surface matrix

| Surface | Has paste? | Mechanism | Clipboard restore |
|---|---|---|---|
| tinysky `App` (traces) | **yes** | `sky.paste` → IPC `action.paste` | yes (native) |
| public `sky.paste` (Mac window) | **yes** | same | yes |
| `MacComputerUseClient.paste` | **yes** (always, not env-gated) | same | yes |
| `SkyComputerUseClient` MCP `tools/list` | **no** | — | — |
| tinysky `Tab` | **yes** | clipboard + `Ctrl+v` | **no** |
| window2 / linux sky | **no** | — | — |

---

## 2. Audio — IPC and native app exist; this install does not expose it

### 2.1 Is it in this Mac app?

**Yes, in `SkyComputerUseService` / Codex Computer Use.app**, independent of JS env:

| Evidence | Where |
|---|---|
| Swift type `ComputerUseAudioRecorder` | `native/swift-types.txt`, service binary `_TtC11ComputerUse24ComputerUseAudioRecorder` |
| IPC `ComputerUseIPCStartAudioRecordingRequest` | `native/ipc-request-types.txt` |
| IPC `ComputerUseIPCStopAudioRecordingRequest` | same |
| IPC `ComputerUseIPCAudio` | same |
| `maxDurationMilliseconds` | service strings; JS sends this field |
| AVFoundation | linked by the service (agent 07) |
| Native cases `noActiveRecording`, `invalidDuration` | service strings |
| `cachedAudioRecordingHeadingBounds` | service strings (UI while recording) |

CUA entitlements (`agents/07-native-app/copies/CUAService.entitlements.xml`) have **no** microphone / audio-capture entitlement. TCC for loopback/mic would be a runtime prompt, not an entitlement. Unresolved: Microphone vs System Audio / AudioCapture (agent 07 QUESTIONS #10).

`SkyComputerUseClient` also embeds the Start/Stop IPC type names (it can serialize the requests) but **does not register MCP tools** for them.

### 2.2 JS layers: client always, public sky gated, tinysky never

**`MacComputerUseClient` always has audio methods** (`vendor/sky/js/mac-client.js`):

```js
const o = "ComputerUseIPCStartAudioRecordingRequest";
const n = "ComputerUseIPCStopAudioRecordingRequest";
startAudioRecording(args, opts) { return this.request(o, args, opts); }
stopAudioRecording(opts) { return this.request(n, {}, opts); }
```

Live sky-shim listed those camelCase methods on the class (`verify/results/sky-shim.json`).

**Public `sky` omits them unless `SKY_ENABLE_AUDIO === "1"`.** `targets/mac/create_client.js`:

```js
Object.assign(
  { target: "mac", list_apps, get_app_state, click, drag, paste, /* … */, type_text },
  process.env.SKY_ENABLE_AUDIO === "1"
    ? { start_audio_recording, stop_audio_recording }
    : {}
)
```

Same gate on linux `create_client.js`. Types mark both methods **optional** (`WindowComputerUseClient.start_audio_recording?`).

Wrapper `audio_recording.js` (only attached when the gate is on):

- `max_duration_ms` default **60000**, clamp integer **100…300000**
- `requestComputerAudioApproval()` elicitation: “Allow Computer Use to record computer audio?”, `riskLevel: "high"`, persist **session only**, `tool_name: "start_audio_recording"` — **not** `withComputerUsePolicy` (no `app`)
- Stop requires a `file:` URL, reads bytes, returns `{ filepath, bytes, data_url }` with `audio/wav` (24 kHz stereo WAV per `Audio.d.ts`)

**Tinysky `Target` / `App` / `Tab` do not wrap audio.** `create_tinysky_alt` App object has paste/click/… and stops at `performSecondaryAction`. `verify/results/sky-shim.json` map: `start_audio_recording` → `tinyskyTarget: null`.

`nodeRepl.emitAudio` is a **separate** gate: `NODE_REPL_ENABLE_AUDIO=1` (`agents/06-repl-runtime/FINDINGS.md`). Skill appendix uses both:

```js
await sky.start_audio_recording({ max_duration_ms: 5000 });
var audio = await sky.stop_audio_recording();
await nodeRepl.emitAudio(audio.data_url);
```

### 2.3 This ChatGPT.app install does not enable audio for the model

Electron (`_tmp/asar_slices/windows/computerUseSkillVariant.txt`):

```js
function Da() {
  return process.env.SKY_ENABLE_AUDIO === "1"
      && process.env.NODE_REPL_ENABLE_AUDIO === "1";
}
```

If `Da()` is true, computer-use skill description is prefixed “Record computer audio. ” and the appendix above is appended; `bundledContentVariant` becomes `{variant}-audio` (e.g. `node-repl-audio`).

On this machine:

- Installed plugin `bundledContentVariant` is **`"node-repl"`** (no `-audio`) — `agents/04-plugin-wiring/copies/computer-use/plugin.installed.json`
- `unified-computer-use` `launch.mjs` does **not** set `SKY_ENABLE_AUDIO` or `NODE_REPL_ENABLE_AUDIO`
- Live cua_repl child had `NODE_REPL_ENABLE_AUDIO` **unset** (agent 04)
- Live MCP `tools/list` has no audio tools
- Traces never called audio

So: **the native recorder is in Codex Computer Use.app; the model on this Mac cannot call it** through tinysky, through ungated `sky.*`, or through MCP.

---

## 3. Errors — `ServerErrorCode` −10000…−10020 vs observed

### 3.1 JS table (`errors.js`)

File: `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/sky/dist/project/cua/sky_js/src/targets/mac/errors.js`  
Types: `agents/02-sky-native/d.ts/targets/mac/errors.d.ts`  
(Not copied into `vendor/sky/js/`; `mac-client.js` still `export { SkyComputerUseError, SkyComputerUseTransportError } from "./errors.js"`.)

```js
const ServerErrorCode = {
  senderProcessNotAuthenticated: -10000,  // written -1e4
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

- `message` = JSON-RPC `error.message` (native string, **not** rewritten in JS)
- `code` = JSON-RPC `error.code`
- `errorName` = reverse map of the 21 names, else **`"jsonRPCError"`**
- `name` = `"SkyComputerUseError"`

`native-pipe.js` constructs that error from `{ code, message }` on JSON-RPC `error`. `computer-use-policy.js` treats `userStoppedSession` (−10012) and `userIntervened` (−10016) as telemetry `cancelled`.

node_repl `formatErrorMessage` returns **`error.message` only** (`_tmp/node_repl_js/kernel.js`). Trace tool results are therefore the native message string.

Prefix **`"Computer Use server error "`** is a C string in **both** `SkyComputerUseService` and `SkyComputerUseClient`, **not** in JS `errors.js`. Observed shape:

```
Computer Use server error <code>: <detail>
```

### 3.2 Observed

| Event | Code | JS `errorName` | Detail | Path |
|---|---:|---|---|---|
| Live MCP `tools/call list_apps` (unsigned parent) | **−10000** | `senderProcessNotAuthenticated` | `Sender process is not authenticated` | `verify/results/mcp-ndjson.json` id 3; `LIVE-VERIFICATION.md` |
| Live MCP `get_app_state` without `app` | *(not a ServerErrorCode)* | — | `Missing required argument: app` | MCP schema reject, same file id 4 |
| Trace `linearApp.click([119,35])` twice | **−10005** | **`unknownError`** | **`noWindowsAvailable`** | task-2 js #6 and #9; `agents/05-traces/calls.json` |

Unsigned / Foundation Node and even OpenAI-signed `cua_node/bin/node` connecting to `computeruse.sock` are **not** authenticated. Trusted paths: `nodeRepl.nativePipe` from the host-side privileged bridge, or `SkyComputerUseClient` under a team-`2DC432GLL2` parent. Failure reasons in native: `MISSING_PARENT`, `UNTRUSTED_PARENT`, `RELAY_WITHOUT_TRUSTED_ANCESTOR`.

Live native-pipe from the sky-shim did **not** return −10000 on the wire: the service accepted the socket then FIN with zero JSON-RPC bytes (`verify/results/sky-shim.json`). MCP (XPC via the CLI) **did** return the formatted −10000 string. Same auth family, different transport presentation.

### 3.3 Why `click([119,35])` is −10005 `noWindowsAvailable`

Tinysky App click (`create_tinysky_alt.pretty.js`):

```js
Array.isArray(target) ? { x: target[0], y: target[1] } : { element_index: target }
```

`[119, 35]` → `sky.click({ app, x: 119, y: 35 })` → `MacComputerUseClient.click`:

```js
at: { coordinate: { _0: [119, 35] } },
clickCount: 1,
mouseButton: 0  // left
```

Coordinate clicks are **screenshot-space**. Native needs a capturable / key window (`noWindowsAvailable`, also nearby `noCapturableWindow`, `windowNotFound`, `matchingWindowNotFound`). AX **elementID** clicks in the same session **worked** (`click(8)` File menu, etc.) because they do not require mapping screenshot pixels.

MCP `click` description: “Click an element by index or **pixel coordinates from screenshot**.” Schema `x`/`y`: “coordinate in screenshot pixel coordinates.” Same constraint.

`pressKey('c')` in that session did **not** throw −10005; it returned with no AX change. Keyboard is not on the coordinate-window path.

JS `errorName` for that failure is **`unknownError`**, not `noWindowsAvailable`. Cataloging −10005 as only “unknown” loses the native case that traces actually showed.

### 3.4 Full −10000…−10020 map (JS name + native detail + observed)

Native human strings are from `SkyComputerUseService`. “enum only” means the Swift/JS case name is in the binary but no separate sentence was found. Extra Swift cases listed under −10005 are **not** in `errors.js`; they showed up as the **message** while the **code** stayed −10005 in the one live/trace sample we have.

| Code | JS `ServerErrorCode` | Native / human detail | Observed here |
|---:|---|---|---|
| −10000 | `senderProcessNotAuthenticated` | `Sender process is not authenticated` | **Live MCP** `list_apps` |
| −10001 | `couldNotGetRequestData` | `Could not get request data` (Apple Event path) | — |
| −10002 | `couldNotGetRequestTypeName` | `Could not get request type name from Apple event` | — |
| −10003 | `couldNotResolveRequestType` | enum only | — |
| −10004 | `unhandledEvent` | enum only | — |
| −10005 | **`unknownError`** | Catch-all. Trace detail **`noWindowsAvailable`**. Other native cases in the same binary that are *not* in the 21-name table and likely collapse here: `noCapturableWindow`, `windowNotFound`, `matchingWindowNotFound`, `noMatchingWindow`, `cgWindowNotFound`, `windowNotFoundAtPosition`, `windowNotFoundForID`, `failedToGetWindowIDForElement`, `cannotClickOffscreenElement`, `invalidElementID`, `invalidScrollPages`, `invalidSecondaryActionForElement`, `screenshotCaptureFailed`, `pasteboardWriteFailed`, `pasteboardReadTimedOut`, `pasteboardChangedDuringPaste`, `noActiveRecording`, `invalidDuration`, … | **Traces** coordinate click |
| −10006 | `appNotAllowed` | `Computer Use is not allowed to use the app '` … `for safety reasons.`; also `Computer use actions are not allowed for system security process:` | — |
| −10007 | `runningApplicationNotFound` | enum only | — |
| −10008 | `accessibilityError` | `Accessibility error: ` | — |
| −10009 | `permissionsNotGranted` | `Computer Use permissions are not granted` | — |
| −10010 | `invalidApp` | enum only | — |
| −10011 | `noActiveSession` | enum only | — |
| −10012 | `userStoppedSession` | enum only; JS telemetry `cancelled` | — |
| −10013 | `incompatibleClientVersion` | `The Computer Use server and client have a version mismatch. To use Computer Use, ask the user to relaunch their ChatGPT app so that the client will be updated to the latest version.` Also JS ping mismatch → `SkyComputerUseTransportError` (not this code) if `serverApiVersion !== CodexComputerUseIPC-5` | — |
| −10014 | `permissionsPending` | `Computer Use permissions are still pending` | — |
| −10015 | `blockedURL` | enum only; JS comment: ends the session if CU hits a disallowed browser URL | — |
| −10016 | `userIntervened` | enum only; JS telemetry `cancelled` | — |
| −10017 | `couldNotGetSenderPID` | `Could not get sender PID from Apple event` | — |
| −10018 | `ambiguousApp` | `Ambiguous app identifier '` … `Multiple apps share this bundle identifier` | — |
| −10019 | `couldNotGetBootstrapPort` | `Could not get XPC bootstrap mach port from Apple event` | — |
| −10020 | `screenLocked` | `The Mac is locked and automatic unlock could not unlock it. …` (several lock-screen variants) | — |

−10001 / −10002 / −10017 / −10019 match **Apple Event** copy (legacy / host bootstrap), not the JS unix-socket happy path.

Anything outside −10000…−10020 becomes `errorName: "jsonRPCError"` in JS.

MCP schema errors (`Missing required argument: app`, `Invalid message format` / −32700 on Content-Length framing) are **client-side MCP**, not `ServerErrorCode`.

### 3.5 Do not confuse `unknownError` with “no information”

For catalog / CROSSCHECK:

- **Code −10005** = JS `unknownError`.
- **Message** may be a specific native case (`noWindowsAvailable` in traces).
- Coordinate `click([x,y])` / `drag` / coordinate `scroll` can fail this way when the app has AX (menus) but no capturable content window.
- Element-index actions in the same app can still succeed.

---

## Catalog corrections

| Row | Current | Correction |
|---|---|---|
| `target.paste` / `app.paste` | YES in traces | Keep YES. Path is tinysky App → `sky.paste` → IPC `action.paste`. **Not** MCP. |
| `sky.paste` | reversed_unused (wrapped by cua.App) | Wrapped, **and used** via `app.paste` in task 2. Direct `sky.paste({app})` unused. MCP does not list it. |
| `sky.start_audio_recording` / `stop_audio_recording` | reversed_unused (**wrapped by cua.App**) | **Not wrapped by cua.App.** Gated on `SKY_ENABLE_AUDIO=1`. Native IPC + `ComputerUseAudioRecorder` **are** in this Mac app. MCP and tinysky omit them. This install’s skill variant is `node-repl`, not `*-audio`. |
| MCP native tools | 10 | Confirmed: no paste, no audio. |
| Errors | −10000 mentioned live | Add **−10005 / `noWindowsAvailable`** from traces; map the rest of −10000…−10020 as above. |

---

## Sources

| Item | Path |
|---|---|
| JS Mac IPC client | `vendor/sky/js/mac-client.js` (= ChatGPT `…/@oai/sky/…/targets/mac/client.js`) |
| JS paste wrapper | ChatGPT `…/targets/mac/paste.js` |
| JS audio wrapper + gate | ChatGPT `…/targets/mac/audio_recording.js`, `create_client.js` |
| `ServerErrorCode` | ChatGPT `…/targets/mac/errors.js`; `agents/02-sky-native/d.ts/targets/mac/errors.d.ts` |
| Tinysky App + Tab paste | `vendor/cua/js/create_tinysky_alt.js`; pretty `agents/01-cua-tinysky/copies/oai_js_cua/tinysky_alt/create_tinysky_alt.pretty.js` |
| QUESTIONS #10 | `agents/01-cua-tinysky/QUESTIONS.md` |
| Traces paste + −10005 | `traces/task-2-linear-issue.json`; `agents/05-traces/calls.json` |
| Live MCP tools + −10000 | `verify/results/mcp-ndjson.json` |
| Sky shim method lists | `verify/results/sky-shim.json` |
| Native IPC / Swift types | `native/ipc-request-types.txt`, `native/swift-types.txt`; binaries under `~/.codex/computer-use/Codex Computer Use.app/` |
| Audio skill gate | `_tmp/asar_slices/windows/computerUseSkillVariant.txt`; installed `plugin.json` `bundledContentVariant: "node-repl"` |
| node_repl error formatting | `_tmp/node_repl_js/kernel.js` `formatErrorMessage` |
