# FINDINGS — IAB / Chrome unix-socket handshake (JS only)

**Question.** Why a standalone `cua_node/bin/node_repl` can `rpc("browser",{method:"setup"})` and still throw `No browser is available` / `Browser is not available: iab` when `/tmp/codex-browser-use/*.sock` files exist.

**Method.** Read-only: `@oai/browser-desktop` `browser-service.mjs` / `browser-client.mjs`, Chrome plugin copies, ChatGPT.app Electron main (`browser-use-iab-api`, `browser-use-native-pipe-server`), MV3 `background.js`, `node_repl` kernel `nativePipe`, `browser-use-peer-authorization.node` strings. Did **not** connect to live socks, did not inject into the user’s browser, did not dump secrets.

**Verdict.** Socks on disk are **not a registry**. ChatGPT.app **listens** (one IAB sock per conversation, plus app-tools / host-services). The trusted browser service **scans** with `readdir` (`nM`) + `getInfo`. There is **no handshake token**. Auth is (1) `nodeRepl.nativePipe.createConnection` in the Rust host, then (2) macOS `LOCAL_PEERTOKEN` peer-code-signing of the connecting process / parent / grandparent, then (3) JSON-RPC `session_id`+`turn_id` on every session call. IAB `getInfo` additionally requires a ChatGPT **session route** for that `session_id`. Standalone REPL injects a fake `debug-cua-reverse` turn meta, is not parented by `com.openai.codex`, and never gets a route — so every sock fails at connect or `getInfo`, `list()` is empty, tinysky throws `No browser is available`.

---

## 0. Two RPC planes (do not mix)

| Plane | Transport | Who | Methods |
|---|---|---|---|
| A. Trusted service | `nodeRepl.rpc("browser", {method, params})` | untrusted JS → privileged worker | **`setup`**, **`execute`** only |
| B. Backend sock | unix `/tmp/codex-browser-use/<uuid>.sock` (win32 `\\.\pipe\codex-browser-use-<uuid>`) | privileged worker → ChatGPT.app / extension host | JSON-RPC 2.0 names below |

`setupBrowserRuntime` in `browser-client.mjs`:

```js
e.rpc("browser", { method: "setup", params: c })
e.rpc("browser", { method: "execute", params: c })
```

Service export:

```js
dne = { async setup(...), async execute(...) }
export { MVe as handleRpc }  // handleRpc({method, params})
```

`setup` only builds `of` (browser context) + API manifest. **It does not connect to socks.** That is why debug-live `BROWSER_SETUP` succeeded (`apiManifest`, `disabledMemberIds=[]`) and the next `cua.getBrowser()` still died.

Tinysky `No browser is available` is **not** a sock error string. It is thrown when `browsers.getDefault()` / `getForUrl()` / `list()[0]` is empty after `refresh()`:

```js
async getDefault() {
  let t = cM(await this.getBrowsers(), this.browserPreference);
  if (t == null) throw new Error("No browser is available");
  return t;
}
async get(t) {
  let r = uM(await this.getBrowsers(), t);
  if (r == null) throw new Error(`Browser is not available: ${t}`);
  return r;
}
```

`createBrowserTab("iab", …)` → `get("iab")` → `Browser is not available: iab`. Same empty list.

---

## 1. Why standalone `node_repl` fails (layered)

Live debug (`verify/debug-live.py`, 2026-09-11): `NODE_REPL_REQUEST_META` had `session_id: "debug-cua-reverse"`, `turn_id: "debug-turn-1"`. Model-side `nodeRepl` keys: `cwd, env, homeDir, tmpDir, requestMeta, write, emitImage, rpc` — **no** `nativePipe`. `getBrowser` failed in **27 ms**. Sky native pipe (different sock) existed and waited ~5 s. So browser discovery ran, did not wait for the 5 s `getInfo` timeout, and produced zero backends.

### Gate 0 — privileged `nativePipe` (service process, not the model VM)

The service **never** calls `net.connect`. `Jm.create(pipe)`:

```js
function n0() {
  let e = globalThis.nodeRepl?.nativePipe;
  return e == null || typeof e.createConnection != "function" ? null : e;
}
Jm.create(t) {
  let r = n0();
  if (r == null) throw new Error("privileged native pipe bridge is not available; browser-client is not trusted");
  return new Jm(await r.createConnection(t));
}
```

Trusted worker injects `nativePipe.createConnection` → host message `{type:"native_pipe_request", op:"connect", path}`. Frames on the sock are **not** NDJSON: 4-byte **native-endian** `uint32` length + UTF-8 JSON (`$u` / `Km` in `browser-service.mjs`; same codec as Electron `oae`). Default max frame 8 MiB incoming; IAB CDP notifications allow 64 MiB outgoing.

Rust host (`src/native_pipe.rs`) then `validate_native_pipe_path`: must be absolute, must be a socket, parent/name length checks. Env `NODE_REPL_SANDBOX_ALLOWED_UNIX_SOCKETS` extends the allowlist. Debug-live passed the **directory** `/tmp/codex-browser-use` plus the CUA `computeruse.sock`. Prefix-vs-exact matching is compiled in the host (not JS). Electron’s cua_repl `extraEnv` (function around `availableBrowserUseBackends`) sets `BROWSER_USE_*` and `NODE_REPL_TRUSTED_SERVICES`; the only `NODE_REPL_SANDBOX_ALLOWED_UNIX_SOCKETS` assignment in main is the **artifact-session** daemon, not IAB. ChatGPT-spawned CUA still works, so the host either implicitly allows this dir or is not landlocked the same way as the JS kernel.

### Gate 1 — peer code-signing on **accept** (why socks exist but handshake dies)

ChatGPT.app `Uve` / `dd` / `oae` **listen** on each UUID sock with `socketPeerAuthorizer: gd()`:

```js
function gd() {  // darwin
  // packaged + missing package metadata → {authorized:false, reason:"missing-package-build-flavor"}
  // else load Resources/native/browser-use-peer-authorization.node
  return socket => addon.authorizeSocketPeer(socket._handle.fd, isDev);
}
```

Addon (`peer-authorization.mm`) strings:

- `getsockopt(LOCAL_PEERTOKEN)`
- `missing-code-signing-identity` / `untrusted-code-signing-identity`
- `peer parent` / `peer grandparent` + `code signing identity`
- Team `2DC432GLL2`
- Allowed signing ids: `com.openai.codex`, `.nightly`, `.alpha`, `.beta`, `.runtime`, `.agent`, `.dev`, and `codex`

`cua_node/bin/node_repl` is OpenAI-signed **but** `Identifier=node_repl` — **not** in that list. ChatGPT.app is `com.openai.codex`. The addon therefore has to accept **parent/grandparent**. ChatGPT-spawned REPL: parent is Codex → authorized. Standalone Python/zsh parent: rejected, socket `destroy()`’d. Same class of door as Sky `−10000 Sender process is not authenticated`. Reject is immediate → matches 27 ms.

Unauthorized result is **not** a JSON-RPC error. The listener never answers `getInfo`. Service `LY` records `pipe-connect/<error>` and continues. Empty `browsers` → tinysky’s `No browser is available`.

### Gate 2 — IAB session **route** (would still kill IAB if Gate 1 passed)

IAB `Sve.getInfo(params)`:

```js
getBrowserUseSession(e) {
  let t = e?.session_id;
  if (typeof t != "string") throw Error("Missing required browser session_id");
  return { conversationId: t };
}
ensureBrowserUseSessionRoute(e) {
  if (this.options.ensureSessionRoute?.(e) !== true)
    throw Error(`No ChatGPT browser route is available for browser session ${e.conversationId}`);
}
```

`ensureSessionRoute` is `FX.canServeSession`: the sock was created for **one** Codex `conversationId`. Fake `debug-cua-reverse` is not a captured UI route (`captureSessionRoute` / `prepareLocalWorkSessionRoute`). `getInfo` throws. Service treats it as `backend-info-request/...`.

### Gate 3 — post-`getInfo` IAB filter (`DY` / `BY`)

Even a successful IAB `getInfo` is dropped unless:

```
metadata.codexSessionId === fr(turnMeta)   // session_id, or thread_id if thread_source==="subagent"
&& (no BROWSER_USE_CODEX_APP_BUILD_FLAVOR || metadata.codexAppBuildFlavor matches)
```

Mismatched IAB apis are `close()`’d. **Extension backends are not filtered here.** If Gate 1 had passed, standalone `getDefault()` would have returned Chrome, not thrown. It threw → Chrome socks failed Gate 0/1 (or were not `type:"extension"` `getInfo` targets).

### Gate 4 — `BROWSER_USE_AVAILABLE_BACKENDS`

`tx` parses env, `hv` keeps only `chrome|iab|cdp`. `OY`/`Ch` drop the rest. Debug-live set `chrome,iab`. Not the empty-list cause.

### What `setup` needing `session_id` is **not**

`iI(runtime)` at the start of `iM` (refresh) throws `Missing required Codex turn metadata: session_id, turn_id` if `requestMeta["x-codex-turn-metadata"]` lacks those strings. Debug-live **had** them. That is why discovery ran at all.

Turn meta is **not** a sock capability token. It is copied onto JSON-RPC params.

---

## 2. Scan vs register (`HY` / `nM` / `readdir`)

### Scan (service, every `refresh` / `get` / `getDefault` / `getForUrl`)

```js
ma = platform => platform === "win32" ? "\\\\.\\pipe\\codex-browser-use" : "/tmp/codex-browser-use"
import { readdir as nM } from "node:fs/promises"
WY = e => e.platform === "win32" ? zY(e) : HY(e)
HY = async e => (await nM(ma(e.platform))).map(n => path.resolve(dir, n))
```

**No** `.sock` suffix filter, **no** uid/`isSocket()` filter (the ChatGPT **tab-mention** client `$ie` does both). Every directory entry is a connect candidate. App-tools / host-services socks in the same dir fail `getInfo` and show up in `failures[]`.

Per candidate `LY`:

1. `Jm.create(path)` (Gate 0–1)
2. `getInfo` with 5 s timeout (`RY=5000`)
3. `rM`: if `type==="extension"`, fill `metadata.profileName` from Chromium `Local State`
4. inject CDP / WebMCP / tinysky `Tab.ax` overrides
5. assign opaque list id `String(kY++)` (`kY` starts at `1`)

There is **no** `registerBrowser` JSON-RPC. Discovery is connect + `getInfo`.

Telemetry if zero IAB survive: `browser_use_backend_discovery_failed` with `reason`:

| `VY` | when |
|---|---|
| `missing-session-metadata` | `fr(ze(runtime))` is null |
| `no-iab-backends` | no IAB `getInfo` succeeded |
| `no-session-match` | IAB `getInfo` succeeded but `DY` dropped all |

This log does **not** throw. Empty list after `OY` is what the Agent API throws on.

### Register (ChatGPT.app, not the REPL)

`FX.ensureBackendForSession(conversationId)` (only if `browserUseNativePipeEnabled`):

1. `new Sve(hostLookup, …, { ensureSessionRoute: e => this.canServeSession(e, backendState), appSessionId, buildFlavor })`
2. `Uve({ apiImpl })` → `dd({ nativePipeDirectory: /tmp/codex-browser-use, socketPeerAuthorizer: gd() })`
3. `fae`: `mkdir` dir; path = `join(dir, randomUUID() + ".sock")`; `listen`
4. JSON-RPC wrapper `en` `registerRequestHandlerObject(Sve)` — **every** function on the prototype becomes a sock method
5. notifications: `onCDPEvent`, `onCDPDetach`, `onDownloadChange`, `onPageEvent`

**One IAB listener per conversation**, created when a session route is captured from the UI webContents (`captureSessionRoute`), not when the model calls `setup`. Extra UUID files from earlier days are stale listeners or other ChatGPT pipes (`CODEX_APP_TOOLS_PIPE_PATH`, `node_repl_host_services`).

Chrome/Edge: MV3 `connectNative("com.openai.codexextension")` → Rust `ChatGPT for Chrome` stdio JSON-RPC → that host attaches to a sock under the same directory (`UnixSocketTransport` / `run_with_routing_platform_transport`). Service still **scans**; `getInfo.type === "extension"` is how it is classified. The service does not spawn the host.

---

## 3. JSON-RPC on the sock

**Frame:** `[u32 LE|BE length][utf8 jsonrpc 2.0]`. Same as Sky computer-use pipe. Not MCP NDJSON.

**Every session method** (client `Qm.sendSessionRequest`) merges:

```js
getSessionParams() -> {
  session_id,          // fr(turnMeta): session_id, or thread_id if subagent
  turn_id,
  session_context: "live" | "cached",  // cached if turn meta gone, last params reused
  agent_request_header_enabled?: boolean  // extension only, see §4
}
```

`getInfo` and `getUserTabs` still **send** these fields; they just do not refresh `lastSessionParams`.

Missing ids throw in JS **before** write: `Missing required browser session_id` / `Missing required browser turn_id`.

### Client → backend (`Qm`)

| method | session-merged | IAB `Sve` | Chrome extension `background.js` |
|---|---|---|---|
| `ping` | no (`sendRequest`) | `"pong"` | `"pong"` |
| `getInfo` | yes | requires route; `type:"iab"` | `type:"extension"`; ignores conversation |
| `turnEnded` | no (`sendRequest` with `{session_id,turn_id}`) | cleanup marks | `endTurn` |
| `getTabs` | yes | all IAB tabs for that route | leased/session tabs |
| `getUserTabs` | yes | **no handler** | user http(s) tabs |
| `getUserHistory` | yes | gated `inAppBrowserUseHistory` | yes |
| `createTab` | yes | `createTabForBrowserUse` | `chrome.tabs.create` + agent group |
| `claimUserTab` | yes | **no** (`Browser.user` forced off) | lease `state=user` |
| `attach` / `attachTarget` / `detach` / `detachTarget` | yes | webContents.debugger | `chrome.debugger` |
| `executeCdp` | yes | `executeCdpForBrowserUse` | `executeCdp` |
| `executeCdpWithCachedExpression` | yes | IAB cache | may ‑1 if missing |
| `allowDownload` | yes | grant map | (not in this MV3 facade) |
| `executeTabRead` | yes | (Playwright read path) | — |
| `markTab` | yes | `handoff` \| `deliverable` + `turn_id` | same |
| `nameSession` | yes | no-op after require session | tab-group title |
| `executeUnhandledCommand` | yes | visibility/viewport intents; `tabs_content` throws | management / viewport |
| `moveMouse` | yes | cursor overlay | cursor overlay |
| `focusTab` | yes | IAB pane | `tabs.update` + `windows.update` |
| `webMcpToolInvoked` | notification + session | host notify | — |

Chrome facade extras (management / unhandled): `getBookmarks`, `createNotification`, `getRecentlyClosedSessions`, `getTopSites`, `finalizeTabs`.

Unknown method → `{jsonrpc:"2.0", id, error:{code:-1, message:"No handler registered for method: …"}}`. Thrown exceptions → `code:1`.

### Backend → client notifications

`onCDPEvent`, `onCDPDetach`, `onDownloadChange`, `onPageEvent`, `onBrowserTabMentionsInvalidated` (mention client). Multi-client mux on the Electron server prefixes ids `__native_pipe_request_<clientId>:<json id>`.

### `getInfo` payloads

IAB:

```js
{
  apiSupportOverrides: {
    "Browser.user": false,
    // "Browser.history": true  if inAppBrowserUseHistory
    "Tab.markDeliverable": true,
    "Tab.markHandoff": true,
  },
  name: "Codex In-app Browser",
  version: <app version>,
  type: "iab",
  capabilities: { browser: [visibility, viewport], tab: [pageAssets, webmcp?] },
  metadata: {
    codexSessionId: <conversationId from request>,
    codexAppSessionId?,   // Electron app session
    codexAppBuildFlavor?, // vs env BROWSER_USE_CODEX_APP_BUILD_FLAVOR
  },
}
```

Extension:

```js
{
  type: "extension",
  family: "chrome" | "edge" | …,  // UA; default "chrome"
  name: "Chrome" | …,
  version: chrome.runtime.getVersion(),
  agentRequestHeaderEnabled: boolean,  // must be boolean or Gate 4 header error
  capabilities: { browser: [visibility, management?], tab: [pageAssets, webmcp?] },
  metadata: { extensionId, extensionInstanceId },  // profileName filled later by rM
  browserTabMentions: { protocolVersion: 1, buildChannel, generation },
}
```

Matcher `ux`: `"iab"|"extension"|"cdp"` → type; `"chrome"|"edge"|…` → extension family; else exact opaque `id` (`"1"`).

---

## 4. “This browser requires agent request headers…”

**Not unix auth.** Chrome-only, after a successful `getInfo`.

```js
// Qm.sendSessionRequest, skip getInfo
if (clientInfo.type === "extension"
    && clientInfo.agentRequestHeaderEnabled !== undefined
    && readRequestHeaderEnabled != null) {
  let i = requestHeaderEnabled
        || clientInfo.agentRequestHeaderEnabled === true
        || await readRequestHeaderEnabled(); // eD → Statsig gate
  if (i && typeof clientInfo.agentRequestHeaderEnabled != "boolean")
    throw new Error("This browser requires agent request headers. Update the Chrome extension before continuing.");
  o.agent_request_header_enabled = i;
}
```

`eD`:

```js
async function eD() {
  if (fm == null) throw new Error("Browser request-header policy requires caller identity.");
  await fm;
  return ak("codex_browser_use_agent_request_header"); // Statsig feature gate
}
```

HTTP header is applied **in Chrome** via DNR session rules, not on the sock:

```
x-browser-agent: ChatGPT/<extension version>
```

Stale extension: `agentRequestHeaderEnabled` missing/non-boolean while the gate is on → that error. Standalone empty-list failure never reaches this.

---

## 5. IAB vs extension (handshake only)

| | IAB | Extension |
|---|---|---|
| Who `listen()`s | ChatGPT.app `FX.ensureBackendForSession` | ChatGPT routing + Rust host (host **connects**; file is still under the same dir) |
| Peer auth | `gd()` / `authorizeSocketPeer` | same if the file is an Electron `oae` listener |
| `getInfo` key | ChatGPT **conversation** route | `extensionInstanceId` UUID in `chrome.storage.local` |
| `DY` session filter | yes | no (kept if `getInfo` works) |
| `Browser.user` / `claimUserTab` | off | on |
| Agent HTTP header | n/a | DNR `x-browser-agent` |
| `nameSession` | no-op | tab group title |
| `visible` | show/hide IAB pane | focus Chrome window |
| Opaque `browser.browserId` | `kY` (`"1"` in task-1) | another `kY` id, **not** `"chrome"` |
| Mention `browserId=` | `codexSessionId` | `extensionInstanceId` |

---

## 6. Tokens / session_id — what exists, what does not

| Field | Role |
|---|---|
| `requestMeta["x-codex-turn-metadata"].session_id` | Codex conversation (or subagent `thread_id`). Required to **scan**. Sent on session RPCs. IAB route key. |
| `turn_id` | Turn cleanup / `markTab` / `turnEndedTracker` |
| `session_context` | `"live"` vs `"cached"` after meta drops |
| `agent_request_header_enabled` | Chrome DNR flag, not a secret |
| `metadata.extensionInstanceId` | Chrome profile instance; mention URL |
| `metadata.codexAppSessionId` / `codexAppBuildFlavor` | IAB flavor pin |
| **Bearer / sock token / HMAC** | **None in JS.** Auth is unix peer credential + code sign. |
| `ARTIFACT_SESSION_HOST_MCP_TOKEN` | **Different product** (sites daemon). Not IAB. |

Forging `NODE_REPL_REQUEST_META.session_id` to a live conversation id would still fail Gate 1 (parent not Codex) and, if that were bypassed, would be talking to the user’s real IAB — out of scope and not done.

---

## 7. End-to-end (ChatGPT-spawned, working)

```
Electron FX.captureSessionRoute(conversationId)
  → ensureBackendForSession
  → listen /tmp/codex-browser-use/<uuid>.sock  (gd peer auth)
        ▲
cua_repl trusted worker  (parent = ChatGPT.app = com.openai.codex)
  nativePipe.connect(each readdir entry)
  getInfo({session_id: conversationId, turn_id})
  DY keep IAB whose metadata.codexSessionId matches
  extension socks kept if getInfo.type==="extension"
        ▲
untrusted js  setupBrowserRuntime / tinysky cua.getBrowser
  rpc("browser",{method:"execute"}) only
```

Standalone REPL is the same JS, wrong parent, fake `session_id`, no `FX` route.

---

## 8. Sources

| Path | Role |
|---|---|
| `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/browser-desktop/scripts/browser-service.mjs` | `iM`/`HY`/`nM`/`DY`/`Jm`/`Qm`/`handleRpc` |
| `…/browser-client.mjs` | `setupBrowserRuntime` → `rpc("browser")` |
| `…/plugins/openai-bundled/plugins/{browser,chrome}/scripts/browser-service.mjs` | same protocol; chrome plugin hash ≠ desktop 0.1.1 but handshake identical |
| ChatGPT.app asar main (`browser-use-iab-api`, `Sve`, `FX`, `Uve`, `oae`, `gd`) | listen + IAB methods + peer auth |
| `Contents/Resources/native/browser-use-peer-authorization.node` | `LOCAL_PEERTOKEN` allowlist |
| Chrome MV3 `…/hehggadaopoacecdllhhajmbjkdcmajg/1.26.901.11451_0/background.js` | extension `getInfo`, DNR header |
| `_tmp/node_repl_js/kernel.js` `createNativePipeBridge` | `native_pipe_request` ops `connect/write/close` |
| `verify/results/debug-live.json` | setup OK, `getBrowser` 27 ms `No browser is available` |

Did not: attach to `*.sock`, send `getInfo` to the live IAB, or drive Chrome.
