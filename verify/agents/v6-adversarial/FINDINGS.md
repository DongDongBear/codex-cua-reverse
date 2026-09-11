# V6 adversarial — try to break the reconstruction

Date: 2026-09-10. Socket: `~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock` (live, `SkyComputerUseService` pid 3802). Sources: `vendor/sky/js/native-pipe.js`, `vendor/sky/js/mac-client.js`, `vendor/cua/js/create_tinysky_alt.js` (readable twin: `agents/01-cua-tinysky/copies/oai_js_cua/tinysky_alt/create_tinysky_alt.pretty.js`). Safety: ping/list/types only in intent; no Linear mutation; no screenshot bytes; no tab open.

## Verdict

**PARTIAL.**

Claims 1–6 hold in the official JS codec and in the service binary’s strings. They are **not live-disproved**: every alternative *and* the reconstructed `uint32le`+`ping`/`CodexComputerUseIPC-5` path is dropped **before any JSON-RPC reply**. Claim 7 as written is **wrong**.

Exact disproof (claim 7): the two `js?` rows are not “empty-args protocol duplicates of `js`”. They are `response.function_call_arguments.done` frames (no `name`/`call_id`) for two other tools: `request_user_input_async` (non-empty `questions`) and `js_reset` (`{}`). `js_reset` is a real second MCP tool.

---

## Live socket (why wire attacks did not differentiate)

`net.createConnection(computeruse.sock)` succeeds, then the peer `FIN`s in ~15–40 ms with **zero bytes**, even with **no write**. Same for:

- system Node (Node.js Foundation `HX7739G8FX`)
- OpenAI-signed `/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node` (Team `2DC432GLL2`)

So “uint32be / newline / raw JSON should fail” is **not** a demonstrated contrast with “uint32le ping v5 should succeed”. Auth is in front of the codec (`senderProcessNotAuthenticated` family; parent-chain / `nodeRepl.nativePipe`, not raw `net`). This matches `LIVE-VERIFICATION.md`. I did **not** impersonate ChatGPT / `node_repl` to get past that gate.

Service strings contain only one IPC version literal: `CodexComputerUseIPC-5`. Also `ping`, `request`, `incompatibleClientVersion`, `ComputerUseJSONRPCPingParams` / `ComputerUseJSONRPCRequestParams`, and the exact `ComputerUseIPC*Request` type names.

Do not confuse transports: `SkyComputerUseClient` **MCP stdio** is newline JSON-RPC (`LIVE-VERIFICATION.md`). That is **not** `computeruse.sock`. Native-pipe JS never emits NDJSON on the unix socket.

---

## Claim 1 — Frame is uint32le + JSON (BE / newline / raw should fail)

**Not broken. Official codec is exclusive little-endian length-prefix. Live “should fail” is inconclusive.**

`encodeMessageFrame` / `decodeMessageFrames` in `vendor/sky/js/native-pipe.js`:

- write: `Buffer.writeUInt32LE(utf8.length, 0)` then body
- read: `buffer.readUInt32LE(n)`, reject if `len > 8 MiB` (`8388608`)
- body is UTF-8 JSON-RPC 2.0 (`{ id, jsonrpc:"2.0", method, params }`)
- host `ensureService` on `NODE_REPL_HOST_SERVICES_PIPE_PATH` uses the **same** `b()` encoder (different socket, method `ensureService`)

There is no BE path, no `\n` delimiter, no raw-JSON reader on this transport. A BE header for a ~90-byte ping is `00 00 00 5A`; interpreted as LE that is `0x5A000000` (> 8 MiB) and the JS decoder throws. Raw/`\n` JSON starts with `{` (`0x7B`); the LE decoder would treat that as a gigantic length.

Service binary also has `JSONRPCLineBuffer` / `CodexAppServerJSONRPCConnection` (ComputerUseClient module). That is the **other** JSON-RPC (app-server / MCP helper), not a second native-pipe codec.

**Attack result:** unsigned + OpenAI-signed node: LE ping, BE ping, newline ping, raw ping, and connect-with-no-write all close identically. Cannot show the server *parses* LE and *rejects* the others.

---

## Claim 2 — API version must be `CodexComputerUseIPC-5` (try 4, 6, empty)

**Not broken at the client + this binary. Live 4/6/empty replies were never observed.**

- `MacComputerUseClient` default: `"CodexComputerUseIPC-5"` (`vendor/sky/js/mac-client.js`).
- Every `ping` / `request` carries `params.clientApiVersion`.
- After `ping`, JS **requires** `result.serverApiVersion === clientApiVersion` or throws transport error `Sky Computer Use API version mismatch…`.
- Connect loop also bails on JSON-RPC error code `-10013` (`incompatibleClientVersion`) without retry.
- `strings SkyComputerUseService | grep CodexComputerUseIPC-` → **only** `CodexComputerUseIPC-5`. No `-4`, `-6`, no empty sentinel.

Tried on the wire (all dropped, no body): `CodexComputerUseIPC-4`, `-6`, `""`, `CodexComputerUseNativeBridge-1`, `"5"`, missing/`null` `clientApiVersion`.

Caveat (untested live): if a server echoed `serverApiVersion: ""` for an empty client version, the JS equality check would pass. This build does not contain that literal. NativeBridge is a different name, not a second `CodexComputerUseIPC-N`.

---

## Claim 3 — `ping` vs `request` method names

**Not broken.**

Native-pipe private send:

```js
JSON.stringify({ id, jsonrpc: "2.0", method, params })
```

- Handshake: `method: "ping"`, params `{ clientApiVersion }` → result `{ serverApiVersion }`.
- Calls: `method: "request"`, params `{ clientApiVersion, codexTurnMetadata, deadlineUnixMilliseconds, request, requestType }`. Requests are serialized (one in-flight via a promise chain).

These are not interchangeable in the JS:

- `ping()` never sends `requestType`; it only checks `serverApiVersion`.
- `request()` never calls `ping` again on an existing transport.
- Extra fields on ping (e.g. stuffing `requestType`) are ignored by `ping()` itself.

JSON-RPC method strings in the service: `ping` and `request` (plus Swift type names `Ping` / `Request`). A third method, `ensureService`, is **host-pipe only**.

Tried `Ping` / `PING` / `Request` / `ensureService` / `listApps` / `""` on `computeruse.sock`: same silent close as correct `ping`. No evidence the unix server accepts case variants; no evidence it does, either.

---

## Claim 4 — Request type strings must match exactly (`ComputerUseIPCListAppsRequest` etc.)

**Not broken for the JS client. Server likely resolves Swift type names; live wrong-name errors were not obtained.**

`mac-client.js` constants (only these are sent by `@oai/sky` Mac):

| JS | `requestType` |
|---|---|
| `listApps` | `ComputerUseIPCListAppsRequest` |
| `getAppPolicy` | `ComputerUseIPCAppPolicyRequest` |
| `startApp` | `ComputerUseIPCAppStartRequest` |
| `getAppState` | `ComputerUseIPCAppGetSkyshotRequest` |
| actions | `ComputerUseIPCAppPerformActionRequest` |
| audio | `ComputerUseIPCStartAudioRecordingRequest` / `ComputerUseIPCStopAudioRecordingRequest` |

Observation is **not** `ComputerUseIPCGetAppStateRequest`. It is `ComputerUseIPCAppGetSkyshotRequest`.

Service strings include those names plus siblings (FrontmostWindow, Messages, Skysight, …). Error names `couldNotGetRequestTypeName` (`-10002`) / `couldNotResolveRequestType` (`-10003`) imply exact type-name lookup, not a fuzzy alias.

Tried `ListAppsRequest`, `ComputerUseIPCListApps`, case/space variants, `""`: no RPC body. Binary also has `requestTypeURL` / `request_type_url`; JS never sends a URL. Unproven whether that is an alternate wire key.

---

## Claim 5 — tinysky `Target.click(index | [x,y])` vs `sky.click({app, element_index, x, y})`

**Confirmed for App. Not a sky mapping for Tab.**

App wrapper in `create_tinysky_alt.js` / pretty.js:

```js
click: (e, o) => t.click(Object.assign(
  { app: i },
  Array.isArray(e) ? { x: e[0], y: e[1] } : { element_index: e },
  o?.mouseButton == null ? {} : { mouse_button: o.mouseButton },
  o?.clickCount == null ? {} : { click_count: o.clickCount },
))
```

Then `targets/mac/click.js` snake→camel:

```js
o.click({ app, clickCount: t.click_count, elementIndex: t.element_index, mouseButton: t.mouse_button, x: t.x, y: t.y })
```

Then `mac-client.js` XOR: if `elementIndex == null` → `click.at.coordinate._0 = [x,y]`; else `click.at.elementID._0 = String(elementIndex)` (must be an integer). Mouse button becomes 0/1/2.

Traces used both shapes: `tab.click(325)` and `linearApp.click([119,35])`.

Caveats that do **not** refute the mapping:

- **Tab** `Target.click` is `t.ax.click(e, i)` — same positional API, **not** `sky.click`.
- `types.d.ts` says `Point = AXPoint`; `api.json` has `type AXPoint = [unknown, unknown]`; docs use `Vec2 = [x,y]`. A sky `{x,y}` object would take the `element_index` branch (`Array.isArray` false) and later fail `Number.isInteger`.
- Public sky is snake_case; `MacComputerUseClient` is camelCase. The claim is the tinysky→sky boundary.

---

## Claim 6 — `getBrowser({url})` does **not** open a tab. Traces still called `getBrowser({ url: ant.design })`. Misuse or does `getForUrl` open a tab?

**Does not open a tab. Trace call is selector misuse (page was already open), not a hidden `tabs.new`.**

Docs (`vendor/cua/docs/tinysky-alt-core-cua-repl.md`): “Select without opening a tab. Use the returned browserId with createBrowserTab.” Plugin `browser-description.md`: `getBrowser({ url })` only when the user did not name a browser.

Tinysky `getBrowser`:

1. Rewrite `url` with `https://` if `!URL.canParse`.
2. Helper `g({ browser: options.id }, url)`:
   - `id` set → `browsers.get(id)` (**id wins**)
   - else if url and `getForUrl` → `browsers.getForUrl(url)`
   - else `getDefault()` / first of `list()`
3. `browser.documentation()` + emit docs. **No** `tabs.new`, **no** `goto`, **no** AX emit.

`createBrowserTab` is the opener: `r.tabs.new()` then optional `n.goto(e)`.

`getForUrl` (read-only; I did not invoke it):

- Client: RPC `GetBrowserForUrl` `{ url }` (`browser-client.mjs`).
- Service: `dM` / `ZY` in `@oai/browser-desktop/scripts/browser-service.mjs`:
  - `file:` / localhost → prefer iab
  - else score **already-open** tab URLs (`eZ` → `getTabs()` / `getUserTabs()`), exact → origin+pathname → hostname → hostname hierarchy
  - tie-break iab → preferred extension → first
- No `tabs.new` / `goto` on this path.

Task-1: `cua.getBrowser({ url: "https://ant.design/components/form" })` then `listTabs` then `getTab("1")`. That binds an existing tab. Ambient IAB already had that URL; `getForUrl` would pick that browser **because a tab is already there**, not by creating one.

---

## Claim 7 — Unnamed `js?` events with empty args are protocol duplicates, not a second tool

**Wrong as stated.**

`traces/all-js-calls.json` has exactly two `name: "js?"` rows, both `response.function_call_arguments.done`, `call_id: null`:

| item_id | args | `output_item.done` name | call_id |
|---|---|---|---|
| `fc_…a05f0487…` | `{ questions: [{ title: "这个 issue 要记录什么？…" }] }` **not empty** | `request_user_input_async` | `call_8ttSMORM5eSYvZywmZv8VPhP` |
| `fc_…f6cf9887…` | `{}` | `js_reset` | `call_cz8IXBshRbd0EthRf9w7Y2xW` |

Cause: `function_call_arguments.done` has `arguments` + `item_id` only. Extractors guessed `js?`. That **is** a protocol-level incomplete frame of a later `output_item.done` — but:

1. **Not both empty.** The first carries `questions`.
2. **Not duplicates of `js`.** They are other tools.
3. **`js_reset` is a second tool** (`unified-computer-use` enabled_tools: `js`, `js_reset`, `turn_ended`). Empty `{}` is the correct schema, and it ran (`js kernel reset`).
4. `request_user_input_async` is a third namespace (`functions`), not `mcp__cua_repl`.

`LIVE-VERIFICATION.md` “two `js?` empties” repeats the same error.

---

## What would have counted as WRONG (and did not)

- Server answering a BE / NDJSON / raw-JSON ping with a JSON-RPC result.
- `ping` with `CodexComputerUseIPC-4`/`-6`/empty returning `serverApiVersion` equal to that string **and** subsequent `request` succeeding.
- `method: "listApps"` or `"Ping"` performing list/ping.
- `requestType: "ListAppsRequest"` listing apps.
- `getForUrl` calling `tabs.new` / `goto`.
- App `click([x,y])` mapping to `element_index` instead of `x,y`.

None of those fired. The only clean refutation is claim 7.

## Verdict (repeat)

**PARTIAL.** Native-pipe reconstruction (LE frames, `ping`/`request`, `CodexComputerUseIPC-5`, exact `ComputerUseIPC*Request` names, tinysky App click mapping, `getBrowser` does not open tabs) is consistent with JS + binary strings and was **not** live-broken. Wire-level negative tests are **blocked by sender auth**. `js?` is **not** “empty-args duplicate js”.
