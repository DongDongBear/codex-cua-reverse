# FINDINGS — `native-pipe.js` startup (sock → ensureService → launch → ping)

**Scope:** local ChatGPT.app `@oai/sky` 0.6.26 + `cua_node/bin/node_repl` + Electron `app.asar`. No exploits. No live mutation.

**Why this note exists:** standalone `node_repl` (DEBUG-LIVE) returns **`Sky Computer Use native pipe startup failed`** even when `computeruse.sock` exists and `rpc("sky")` setup succeeds. That string is **not** “socket missing”. It is the **last** wrapper in `MacNativePipeTransport.create()` after connect+ping already failed, a host ensure/launch ran, and a **5 s** retry still failed.

---

## Verdict

1. Untrusted `js` never talks to `computeruse.sock`. `create_tinysky_alt` imports `sky.js`, which **RPCs** `"sky"` when `nodeRepl.rpc` exists. Native pipe runs only in the **trusted worker**.
2. Trusted `MacNativePipeTransport.create(apiVersion)`:
   1. Require `globalThis.nodeRepl.nativePipe.createConnection`.
   2. Connect that host-mediated pipe to `SKY_CUA_SERVICE_NATIVE_PIPE_PATH` or the Group Container sock.
   3. JSON-RPC `ping` `{ clientApiVersion }` (default **`CodexComputerUseIPC-5`**). First budget **250 ms**.
   4. On class `q` (retry-exhausted): if `NODE_REPL_HOST_SERVICES_PIPE_PATH` is set → same framing, method **`ensureService`**, params `{ service: "computer-use" }`, 5 s; else `nodeRepl.launchServices.openApplication(...)`.
   5. Connect+ping again, budget **5000 ms**. Still `q` → **`Sky Computer Use native pipe startup failed`**.
3. Sock existing is **not** enough. Unix connect can succeed and the service still **FIN**s with zero JSON-RPC bytes. JS then retries until the 250 ms + 5 s budgets expire. That is the DEBUG-LIVE ~5.4 s failure.
4. `NODE_REPL_HOST_SERVICES_PIPE_PATH` is an **Electron-internal** host pipe (`/tmp/codex-host-services-<uuid>.sock`). Production packaged ChatGPT **does not start it** (`a.i.isInternal(c)` gate). Live cua_repl children do not have the env (agent 04). Standalone debug-live did not set it either, so step 4 was `launchServices.openApplication`.
5. Launching/ensuring the service does **not** authenticate the sender. `ComputerUseIPCSenderAuthorization` still sees standalone `node_repl` (identifier `node_repl`, team `2DC432GLL2`) whose **parent is Python/shell**, not `com.openai.codex`. ChatGPT-spawned `node_repl` works (`cua.getApp("Finder")` on 2026-09-11).

---

## 1. Who actually calls `native-pipe.js`

```
untrusted kernel.js  (model js)
  globalThis.nodeRepl = { cwd, env, homeDir, tmpDir, requestMeta, write, emitImage, rpc }
  NO nativePipe, NO launchServices
        │
        │  banner → setupCUA → create_tinysky_alt.js
        │    import("…/sky_js/src/index.js") → sky.js Proxy
        │
        ├─ sky.js module load:  await nodeRepl.rpc("sky", { type: "setup" })
        └─ cua.listApps()     → sky.list_apps()
                               → rpc("sky", { type: "execute", method: "list_apps", args: [] })
        │
        ▼
trusted-worker.js  (NODE_REPL_TRUSTED_SERVICES.sky = "@oai/sky/service")
  globalThis.nodeRepl = privileged bridge (nativePipe, launchServices, createElicitation, …)
        │
        ▼
service.js handleRpc
  setup   → create_client(load_options())   // no socket
  execute → o.list_apps() / get_app_state / …
        │
        ▼
targets/mac/list_apps.js
  (yield getClient()).listApps()            // lazy singleton MacComputerUseClient
        │
        ▼
mac-client.js MacComputerUseClient.request
  getTransport(apiVersion) → MacNativePipeTransport.create(apiVersion)
        │
        ▼
native-pipe.js   ← this file
```

Sources:

- `/Users/dongdong/Desktop/codex-cua-reverse/vendor/cua/js/create_tinysky_alt.js` — `import("…/sky_js/src/index.js").then(({sky}) => sky)`, then `y.list_apps()` / `y.get_app_state`.
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/sky/dist/project/cua/sky_js/src/sky.js` — if `typeof nodeRepl.rpc === "function"`, methods are RPC stubs; in-process `create_client` only when `nodeRepl` is missing.
- `/Users/dongdong/Desktop/codex-cua-reverse/vendor/sky/js/service.js` — `handleRpc` `setup` / `execute`.
- `/Users/dongdong/Desktop/codex-cua-reverse/vendor/sky/js/mac-client.js` — `transport(apiVersion)` memoizes `MacNativePipeTransport.create(apiVersion)`.
- `/Users/dongdong/Desktop/codex-cua-reverse/_tmp/node_repl_js/kernel.js` — untrusted `rpc` is a JSONL `trusted_service_request`; `nativePipe` is **not** on this object.
- `/Users/dongdong/Desktop/codex-cua-reverse/_tmp/node_repl_js/trusted-worker.js` — `createPrivilegedWorkerRuntime` installs `nativePipe` / `launchServices` on worker `globalThis.nodeRepl`.

`list_apps` skips `withComputerUsePolicy`. The **first** native round-trip for `cua.listApps()` / `rpc sky list_apps` **is** `MacNativePipeTransport.create` + `ping` + `request` `ComputerUseIPCListAppsRequest`. `cua.getApp` additionally needs `createElicitation` (trusted-only) **after** the pipe is up.

`rpc("sky", { type: "setup" })` does **not** open the sock. It only `create_client({ target: "mac" })` and returns `{ target, methods }`. DEBUG-LIVE `SKY_SETUP` succeeding is expected even when the pipe is dead.

---

## 2. Exact `MacNativePipeTransport.create` flow

File (byte-identical to app copy):  
`/Users/dongdong/Desktop/codex-cua-reverse/vendor/sky/js/native-pipe.js`  
App: `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/sky/dist/project/cua/sky_js/src/targets/mac/native-pipe.js`  
Types: `/Users/dongdong/Desktop/codex-cua-reverse/agents/02-sky-native/d.ts/targets/mac/native-pipe.d.ts`

Constants:

| name (minified) | value | meaning |
|---|---:|---|
| `k` | `8388608` | max frame body (8 MiB) |
| `U` | `5000` | host-services connect + `ensureService` RPC timeout (ms) |
| first `connect` timeout | `250` | initial sock+ping budget |
| second `connect` timeout | `5000` | after ensure/launch |
| retry sleep | `100` | `R(100)` between attempts |
| ping timeout | `min(1000, max(1, remaining))` | per successful TCP/unix connect |
| JSON-RPC `id` | starts at **1** on a transport; ensureService uses **0** |

Decompiled control flow (names from `.d.ts` + minified `E` / `q` / `D` / `O` / `A` / `M` / `P` / `b`):

```
MacNativePipeTransport.create(apiVersion):
  nodeRepl = O()  // globalThis.nodeRepl; else throw
              // "Sky Computer Use requires the trusted nodeRepl runtime"

  nativePipe = nodeRepl.nativePipe
  if nativePipe == null OR typeof nativePipe.createConnection !== "function":
      throw SkyComputerUseTransportError(
        "Sky Computer Use native pipe is unavailable")

  path = A(nodeRepl.env.SKY_CUA_SERVICE_NATIVE_PIPE_PATH)
         ?? join(homedir(),
              "Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock")
         // A() = trim non-empty string, else undefined

  try:
      return connect(nativePipe.createConnection, path, apiVersion, 250)
  catch (e):
      if e is not class q: rethrow          // version mismatch D, etc.

  try:
      ensureOrLaunch(nodeRepl)              // see §3
  catch (e):
      throw SkyComputerUseTransportError(
        "Sky Computer Use service startup request failed", { cause: e })

  try:
      return connect(nativePipe.createConnection, path, apiVersion, 5000)
  catch (e):
      throw SkyComputerUseTransportError(
        "Sky Computer Use native pipe startup failed", { cause: e })
```

`connect(createConnection, path, apiVersion, timeoutMs)`:

```
deadline = now + timeoutMs
lastError = undefined
loop:
  remaining = deadline - now
  if remaining <= 0: throw q(lastError)
      // q.message = "Sky Computer Use native pipe is unavailable: " + lastError.message

  pending = createConnection(path)          // Promise<NativePipeConnection>
  try:
      socket = await race(pending, remaining,
                 "Sky Computer Use native pipe connection timed out")
  catch (e):
      pending.then(s => s.end(), () => {})
      lastError = e
      socket = undefined

  if socket:
      transport = new MacNativePipeTransport(socket, apiVersion)
      try:
          await transport.ping(min(1000, max(1, deadline - now)))
          return transport
      catch (e):
          transport.#close()                // socket.end()
          if e instanceof D: throw e        // API version mismatch (TransportError)
          if e instanceof SkyComputerUseError
             && e.code === ServerErrorCode.incompatibleClientVersion (-10013):
              throw e
          lastError = e                     // close / timeout / other → retry

  if now >= deadline: throw q(lastError)
  await sleep(100)
```

`ping`:

```
result = RPC method "ping", params { clientApiVersion: apiVersion }
if result.serverApiVersion !== apiVersion:
    throw D(`Sky Computer Use API version mismatch: client=${apiVersion} server=${…}`)
```

`request` (after create succeeds) serializes one in-flight RPC via a promise chain:

```
params = {
  clientApiVersion,
  codexTurnMetadata,            // from options / client / nodeRepl.requestMeta["x-codex-turn-metadata"]
  deadlineUnixMilliseconds: Date.now() + timeoutSeconds * 1000,
  request,                      // IPC body (undefined fields stripped in mac-client)
  requestType,                  // e.g. ComputerUseIPCListAppsRequest
}
```

Framing (`encodeMessageFrame` / `decodeMessageFrames`):

```
[uint32le length][utf8 JSON]
JSON-RPC 2.0 { id, jsonrpc: "2.0", method, params }
max length 8 MiB; oversize → SkyComputerUseTransportError("… frame is too large: N")
```

Socket events on the transport: `data` → decode frames → match `id`; `error` / `close` reject all pending with `Sky Computer Use native pipe closed before response`.

`mac-client.js` default `apiVersion` is **`CodexComputerUseIPC-5`**, default `timeoutSeconds` **120**.

---

## 3. `ensureOrLaunch(nodeRepl)` — HOST_SERVICES then LaunchServices

This runs **only** when the first 250 ms connect+ping threw class `q`. Sock-present + ping-FIN **does** take this branch. It is not “socket missing” exclusively.

### 3.1 `NODE_REPL_HOST_SERVICES_PIPE_PATH` set

```
path = A(nodeRepl.env.NODE_REPL_HOST_SERVICES_PIPE_PATH)
create = nodeRepl.nativePipe.createConnection
if typeof create !== "function":
    throw Error("Sky Computer Use requires nodeRepl.nativePipe support")

connPromise = create(path)
try:
    sock = await race(connPromise, 5000,
              "Sky Computer Use host service connection timed out")
catch:
    connPromise.then(s => s.end(), () => {}); throw

try:
    write one frame:
      { id: 0, jsonrpc: "2.0", method: "ensureService",
        params: { service: "computer-use" } }
    wait ≤ 5000 ms for JSON-RPC response with id === 0
    error  → Error(error.message || "Sky Computer Use host service ensure failed")
    no result → Error("Sky Computer Use host service returned an invalid response")
    close  → Error("Sky Computer Use host service connection closed before response")
    timeout → Error("Sky Computer Use host service ensure timed out")
finally:
    sock.end()
return
```

Same uint32le framing as CUA IPC. **Different socket.** Method `ensureService` is **host-pipe only**; sending it to `computeruse.sock` is not a valid CUA method (v6: same silent FIN as `ping`).

### 3.2 HOST_SERVICES unset → `launchServices.openApplication`

```
open = nodeRepl.launchServices?.openApplication
if typeof open !== "function":
    throw Error("Sky Computer Use requires nodeRepl.launchServices support")

await open(launchTarget(nodeRepl.env))
```

`launchTarget(env)` **exactly one** of:

| priority | condition | argument |
|---|---|---|
| 1 | `A(env.SKY_CUA_SERVICE_PATH)` | `{ applicationPath }` |
| 2 | `A(env.CODEX_HOME)` and `$CODEX_HOME/computer-use/Codex Computer Use.app` exists (`fs.existsSync`) | `{ applicationPath }` that path |
| 3 | else | `{ bundleIdentifier: "com.openai.sky.CUAService" }` |

Trusted-worker forwards this as host JSONL:

```
{ type: "launch_services_action",
  action: "open_application",
  application_path?: string,
  bundle_identifier?: string,
  id, exec_id }
```

Host `src/launch_services.rs` strings:

- `LaunchServices application path does not exist`
- `LaunchServices application path must reference an .app bundle`
- `LaunchServices open application expected exactly one of application_path or bundle_identifier`

JS `normalizeLaunchServicesTarget` rejects extra keys and requires exactly one of `applicationPath` / `bundleIdentifier`.

If this throw happens, `create()` wraps it as **`Sky Computer Use service startup request failed`** (sky-shim path). If it **returns**, `create()` still does the 5 s retry and may then throw **`… native pipe startup failed`** (DEBUG-LIVE path).

---

## 4. Host `nativePipe.createConnection` (not `net.connect`)

Trusted worker (`createNativePipeBridge` in `kernel.js` / `privileged-host-ops.js` / `privileged-node-repl.js`):

```
createConnection(pipePath):
  send { type: "native_pipe_request", id: "native-pipe-N", op: "connect", path }
  wait native_pipe_response { ok, result.connection_id, error }
  return frozen { write, on("data"|"close"|"error"), off, end }

write(data) → { op: "write", connection_id, data_base64 }
end()      → { op: "close", connection_id }
inbound    → native_pipe_data { connection_id, data_base64 }
             native_pipe_closed { connection_id, error? }
```

The **Unix connect is done by the `node_repl` Rust host** (`src/native_pipe.rs`), identifier **`node_repl`**, team **`2DC432GLL2`**. The Node worker never calls `net.createConnection`.

Host errors (binary strings):

| string | role |
|---|---|
| `native pipe path must be absolute` | path check |
| `native pipe path is not a socket` | `stat` not `S_IFSOCK` |
| `native pipe path has no parent directory` / `no file name` / `file name is too long` | path shape |
| `native pipe path unavailable:` / `native pipe stat failed:` | `stat` |
| `failed to connect native pipe:` / `failed while connecting native pipe:` | `connect(2)` |
| `native pipe initial connect timed out` | `NODE_REPL_NATIVE_PIPE_CONNECT_TIMEOUT_MS` |
| `native pipe initial connect cancelled` | exec cancelled |
| `native pipe connect limiter closed` | host limiter |
| `native pipe connection not found` | write/close unknown id |
| `failed to inspect native pipe connection:` / `failed to register native pipe:` | kqueue/select |
| `native pipe write failed:` / `native pipe write cancelled` | write |
| `native pipe data decode failed:` | inbound |
| `NODE_REPL_SANDBOX_ALLOWED_UNIX_SOCKETS` | extra `--allow-unix-socket` |
| hardcoded `Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/` | default sandbox allow |

`node_repl --disable-sandbox`: start the Node kernel directly even when `CODEX_CLI_PATH` is set. DEBUG-LIVE **deleted** `CODEX_CLI_PATH`, so sandbox wrapping was off. Sock connect is not the sandbox gate in that run.

Host connect timeout is **independent** of the JS 250/5000 budgets. Live cua_repl had `NODE_REPL_NATIVE_PIPE_CONNECT_TIMEOUT_MS=1000` (agent 04). DEBUG-LIVE set `5000`. If the unix connect itself is fast, this env does not change the 5.4 s JS retry.

---

## 5. Electron `HOST_SERVICES` pipe (asar) — not production

`app.asar` `main-D87AK7lw.js`:

```
ds = "NODE_REPL_HOST_SERVICES_PIPE_PATH"
fs() = `/tmp/codex-host-services-${uuid}.sock`
```

Server `Soe({ services, pipePath = fs(), socketPeerAuthorizer = gd() })`:

- Same 8 MiB uint32le JSON-RPC.
- `chmod` 384 = **0600**.
- Zod: `{ id, jsonrpc: "2.0", method: "ensureService", params: { service: string(1..128) } }`.
- Known service: **`computer-use`** → `ManagedComputerUseService.ensureServicePid()`.
- Replies:
  - success `{ id, jsonrpc: "2.0", result: {} }`
  - `-32602` `Invalid host service request`
  - `-32602` `Unsupported host service: ${name}`
  - `-32000` `Host service ensure failed`
- Logs: `node_repl_host_services_listening` / `_peer_authorization_failed` / `_peer_rejected`.
- Peer authorizer `gd()` is the same Darwin socket-fd addon used for browser-use native pipes (`authorizeSocketPeer`). Packaged + missing flavor → **reject all**.

**Startup gate:** the pipe is created only inside `if (a.i.isInternal(c)) { … Soe(…) ; process.env[ds] = e.pipePath }`. Production flavor `BROWSER_USE_CODEX_APP_BUILD_FLAVOR=prod` does **not** run this. Failure log: `Failed to start node_repl host services native pipe`.

Child env injection (`xs` / `lte`):

```
extraEnv += lte({
  nativePipeDirectory, nativePipeEnabled,     // Windows named pipe
  serviceAppPath: darwin ? computerUsePaths.serviceAppPath : null,   // SKY_CUA_SERVICE_PATH
  serviceNativePipePath: darwin && includePrivateProcessEnv
      ? process.env.SKY_CUA_SERVICE_NATIVE_PIPE_PATH : null,
})
extraEnv += (computerUse && darwin && hostServicesPipePath)
      ? { NODE_REPL_HOST_SERVICES_PIPE_PATH: hostServicesPipePath }
      : {}
```

Windows-only extras from `lte`: `SKY_CUA_NATIVE_PIPE=1`, `SKY_CUA_NATIVE_PIPE_DIRECTORY=\\.\pipe\codex-computer-use-<uuid>`.

Production macOS desktop therefore:

- Electron `sie` (`managed-computer-use-service`) spawns `SkyComputerUseService` as a child of ChatGPT.app.
- Copies the app with `/usr/bin/ditto --noqtn` to `$CODEX_HOME/computer-use/Codex Computer Use.app`.
- Injects `SKY_CUA_SERVICE_PATH`. Does **not** inject `SKY_CUA_SERVICE_NATIVE_PIPE_PATH` or `NODE_REPL_HOST_SERVICES_PIPE_PATH`.
- JS uses the **hardcoded Group Container sock**.

That matches agent 17 Q27 and the live cua_repl env dump (04): `SKY_CUA_SERVICE_PATH` set, the two pipe envs unset.

---

## 6. Error taxonomy (exact strings)

| message | thrown where | typical cause |
|---|---|---|
| `Sky Computer Use requires the trusted nodeRepl runtime` | `O()` | `globalThis.nodeRepl` missing (plain Node import) |
| `Sky Computer Use native pipe is unavailable` | `create()` before connect | untrusted `nodeRepl` has no `nativePipe.createConnection` |
| `Sky Computer Use native pipe is unavailable: …` | class `q` | 250 ms or 5 s loop exhausted; suffix is last inner message |
| `Sky Computer Use native pipe connection timed out` | `M()` in `connect` | `createConnection` promise slower than remaining budget |
| `Sky Computer Use native pipe closed before response` | socket `close` | peer FIN after connect (auth kick, no JSON) |
| `Sky Computer Use ping timed out` / `request timed out` | pending map | no matching `id` before timeout |
| `Sky Computer Use API version mismatch: client=… server=…` | class `D` | **not** retried; not wrapped as startup failed |
| `Sky Computer Use requires nodeRepl.nativePipe support` | ensure branch | HOST_SERVICES set but `createConnection` missing |
| `Sky Computer Use host service connection timed out` | ensure connect | 5 s |
| `Sky Computer Use host service ensure timed out` | ensure RPC | 5 s |
| `Sky Computer Use host service ensure failed` | ensure JSON-RPC `error` without message | |
| `Sky Computer Use host service returned an invalid response` | ensure reply has neither result nor error | |
| `Sky Computer Use host service connection closed before response` | ensure sock closed | peer authorizer / crash |
| `Sky Computer Use requires nodeRepl.launchServices support` | launch branch | HOST_SERVICES unset, trusted `openApplication` missing |
| **`Sky Computer Use service startup request failed`** | `create()` wrapping ensure/launch | sky-shim: missing `launchServices`; or ensure/launch threw |
| **`Sky Computer Use native pipe startup failed`** | `create()` after ensure/launch | **DEBUG-LIVE.** Launch returned; 5 s ping still dead |
| `native pipe request failed` / `native pipe connect returned an invalid connection id` | worker bridge | host `ok: false` / bad result |
| `Computer Use requires a trusted Node REPL Sky service` | `sky.js` `l()` | `rpc` disappeared mid-call |
| `sky requires node_repl; configure NODE_REPL_TRUSTED_SERVICES` | `sky.js` `c()` | `nodeRepl` present but no `rpc` |

JSON-RPC application errors (`SkyComputerUseError`, codes −10000…−10020) only appear **after** a completed `ping`. Silent FIN never becomes −10000 on this transport. XPC/`SkyComputerUseClient mcp` **does** format `Computer Use server error -10000: Sender process is not authenticated`.

Trusted RPC **strips** `Error.cause`. Worker:

```js
sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) })
```

Kernel:

```js
reject(new Error(response.error || "Trusted RPC request failed"))
```

DEBUG-LIVE `cause=undefined` is this strip, not a missing `cause` in `native-pipe.js`. In-process (sky-shim) still has `cause`.

---

## 7. Env vars (complete for this path)

### Read by `native-pipe.js` (`nodeRepl.env` on the **trusted** worker = full `process.env`)

| var | reader | production ChatGPT cua_repl | DEBUG-LIVE.py |
|---|---|---|---|
| `SKY_CUA_SERVICE_NATIVE_PIPE_PATH` | sock path override | **unset** (default Group Container) | **set** to the Group Container sock |
| `NODE_REPL_HOST_SERVICES_PIPE_PATH` | ensureService pipe | **unset** (internal-build only) | **unset** |
| `SKY_CUA_SERVICE_PATH` | launch `{ applicationPath }` | `~/.codex/computer-use/Codex Computer Use.app` | same, set by the script |
| `CODEX_HOME` | launch fallback app path | `~/.codex` | `~/.codex` |

Default sock if the override is empty/whitespace:

```
~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock
```

Live on this machine (2026-09-11): exists, `srw-------`, owner user. `SkyComputerUseService` running from the home copy.

### Read by `node_repl` host (`native_pipe.rs` / sandbox / kernel)

| var | role |
|---|---|
| `NODE_REPL_NATIVE_PIPE_CONNECT_TIMEOUT_MS` | host unix-connect timeout. Live cua_repl **`1000`**. DEBUG-LIVE **`5000`**. |
| `NODE_REPL_SANDBOX_ALLOWED_UNIX_SOCKETS` | extra `--allow-unix-socket` when `CODEX_CLI_PATH` sandbox is on. DEBUG-LIVE set the sock path (redundant: sandbox off). |
| `CODEX_CLI_PATH` | enables kernel sandbox wrapping unless `--disable-sandbox`. DEBUG-LIVE **popped** it. Live cua_repl **set**. |
| `NODE_REPL_TRUSTED_RPC_ENABLED` | kernel defines `nodeRepl.rpc` iff `"1"`. Rust injects this for kernel+worker even when the parent dump omits it. DEBUG-LIVE set `"1"`. |
| `NODE_REPL_TRUSTED_SERVICES` | JSON `{ sky: "@oai/sky/service", browser?: … }`. |
| `NODE_REPL_TRUSTED_CODE_PATHS` | worker import realpath allowlist. |
| `NODE_REPL_NODE_MODULE_DIRS` | resolve `@oai/sky/service`. |
| `NODE_REPL_NODE_PATH` | kernel Node. |
| `NODE_REPL_JS_BANNER` | `setupCUA({browser,computer})`. |
| `NODE_REPL_UNTRUSTED_ENV_ALLOWLIST` | **untrusted** `nodeRepl.env` is this allowlist only. Trusted `native-pipe.js` does **not** use that snapshot. |
| `NODE_REPL_REQUEST_META` | becomes `nodeRepl.requestMeta`; mac-client pulls `x-codex-turn-metadata` into `codexTurnMetadata`. |
| `NODE_REPL_ENABLE_AUDIO` + `SKY_ENABLE_AUDIO` | both `"1"` to expose audio methods (not required for list_apps). |
| `OAI_SKY_CONFIG_PATH` | `load_options.js` JSON override of `{ target }`. Else `darwin→mac`. |

### Windows-only (asar `lte`, not this Mac failure)

`SKY_CUA_NATIVE_PIPE`, `SKY_CUA_NATIVE_PIPE_DIRECTORY`.

### Not an env var, but a launch key

Bundle id **`com.openai.sky.CUAService`** if `SKY_CUA_SERVICE_PATH` unset and `$CODEX_HOME/computer-use/Codex Computer Use.app` missing.

---

## 8. Why standalone `node_repl` fails **even when sock exists**

DEBUG-LIVE (`/Users/dongdong/Desktop/codex-cua-reverse/verify/results/debug-live.json`, `/Users/dongdong/Desktop/codex-cua-reverse/DEBUG-LIVE.md`):

| step | ms | result |
|---|---:|---|
| `rpc("sky", setup)` | (same cell) | `{ target:"mac", methods:[ list_apps, get_app_state, click, drag, paste, … ] }` |
| `rpc("sky", execute list_apps)` | cell **5512** | `SKY_LIST_APPS_ERR Sky Computer Use native pipe startup failed` |
| probe `Object.getOwnPropertyNames(nodeRepl)` | 6 | `cwd, env, homeDir, tmpDir, requestMeta, write, emitImage, rpc` — **no nativePipe / launchServices** |
| `cua.listApps()` | **5418** | same message, `cause=undefined` |
| `cua.getApp("Finder")` | **5446** | same |

~5415 ms ≈ **250 + 5000** (+ launch + 100 ms sleeps). That is `create()`’s two `connect` budgets, not an immediate `unavailable`.

Sequence actually executed in the trusted worker:

1. `nativePipe.createConnection` **exists** (privileged `nodeRepl`). Untrusted probe is a red herring for this error string.
2. Path = DEBUG-LIVE’s `SKY_CUA_SERVICE_NATIVE_PIPE_PATH` = the Group Container sock (**exists**).
3. Host `connect(2)` can succeed (sandbox off; sock is `0600` user-owned).
4. JS writes framed `ping` `{ clientApiVersion: "CodexComputerUseIPC-5" }`.
5. Service **FINs, 0 bytes** (same as `verify/results/native-ipc.json` / `sky-shim.json`: `socket closed`, `jsonRpcErrorCode: null`, peer FIN ~15–40 ms). Inner error: `Sky Computer Use native pipe closed before response`.
6. Retry until 250 ms → class `q`.
7. `NODE_REPL_HOST_SERVICES_PIPE_PATH` unset → `launchServices.openApplication({ applicationPath: SKY_CUA_SERVICE_PATH })`. Service already running (pid 67533). Launch returns. **Not** `service startup request failed`.
8. 5 s of the same connect+ping+FIN. Throw **`Sky Computer Use native pipe startup failed`**.
9. RPC to untrusted: message only.

Sender auth (`ComputerUseIPCSenderAuthorization`; agent 07 / 19):

- Fail closed: `MISSING_PARENT`, `UNTRUSTED_PARENT`, `RELAY_WITHOUT_TRUSTED_ANCESTOR`.
- Analytics: parent/responsible **team id, signing id, bundle id, executable**.
- Parent code-requirement for the native client/guardian: team **`2DC432GLL2`**.
- Unix presentation: silent FIN. XPC/MCP: **−10000** `Sender process is not authenticated`.

Identities:

| binary | codesign Identifier | team |
|---|---|---|
| `cua_node/bin/node` | `node` | `2DC432GLL2` |
| `cua_node/bin/node_repl` | **`node_repl`** | `2DC432GLL2` |
| ChatGPT.app | `com.openai.codex` | `2DC432GLL2` |
| SkyComputerUseService | `com.openai.sky.CUAService` | `2DC432GLL2` |

Raw `net.createConnection` from signed `node` is kicked (v7). `nativePipe` makes **`node_repl`** the connecting process, which is the production trusted path **only when ChatGPT (or another team-`2DC432GLL2` app) is parent/responsible**. DEBUG-LIVE’s parent is the Python harness. Launching CUAService again does not reparent `node_repl`. HOST_SERVICES, if it existed, would only `ensureServicePid()` — also not a reparent.

ChatGPT-hosted `js` on 2026-09-11: `await cua.getApp("Finder")` **succeeded** (same sock, same service). That is the same JS stack with a trusted ancestor.

### Contrast: sky-shim vs DEBUG-LIVE

| | sky-shim (`verify/sky-shim.mjs`) | standalone `node_repl` (DEBUG-LIVE) |
|---|---|---|
| `nativePipe.createConnection` | shim → raw `net.Socket` in `node` | host `native_pipe.rs` in `node_repl` |
| `launchServices` | **absent** | present on trusted worker |
| HOST_SERVICES | unset | unset |
| sock | exists | exists |
| wire | ping then FIN, 0 bytes | same family |
| JS error | **`service startup request failed`** cause `requires nodeRepl.launchServices support` | **`native pipe startup failed`** cause stripped |

Both prove: **existence of the sock is not the success criterion.** `create()` treats “connected but ping died” the same as “nothing listening”, then ensure/launch, then 5 s, then `startup failed` if launch existed.

### What would *not* match this error

- Missing `nativePipe` on the process that runs `native-pipe.js` → **`native pipe is unavailable`** in ~0 ms.
- Missing `nodeRepl` → **`requires the trusted nodeRepl runtime`**.
- Missing `rpc` in tinysky’s `sky.js` → **`sky requires node_repl; configure NODE_REPL_TRUSTED_SERVICES`**.
- Version mismatch → **`API version mismatch`** / −10013, no 5 s retry.
- HOST_SERVICES set + ensure throw → **`service startup request failed`**.

DEBUG-LIVE hit none of those.

---

## 9. Function-level map (files)

| fn | file | does |
|---|---|---|
| `create_tinysky_alt` | `vendor/cua/js/create_tinysky_alt.js` | `sky.list_apps` / `get_app_state` |
| `sky` Proxy | app `sky_js/src/sky.js` | `rpc("sky", {type, method, args})` |
| `nodeRepl.rpc` | `_tmp/node_repl_js/kernel.js` | `trusted_service_request` |
| `handleServiceRequest` | `_tmp/node_repl_js/trusted-worker.js` | `import("@oai/sky/service").handleRpc` |
| `handleRpc` | `vendor/sky/js/service.js` | `setup` / `execute` |
| `create_client` (mac) | app `targets/mac/create_client.js` | snake_case wrappers + `target:"mac"` |
| `list_apps` | app `targets/mac/list_apps.js` | telemetry; **no** policy; `client.listApps()` |
| `get_app_state` | app `targets/mac/get_app_state.js` | `withComputerUsePolicy` then `getAppState` |
| `getClient` | app `targets/mac/lazy-client.js` | singleton `MacComputerUseClient` |
| `MacComputerUseClient.request` | `vendor/sky/js/mac-client.js` | `getTransport` → `transport.request` |
| **`MacNativePipeTransport.create`** | **`vendor/sky/js/native-pipe.js`** | sock → ensure/launch → ping |
| `nativePipe.createConnection` | `_tmp/node_repl_js/kernel.js` `createNativePipeBridge` | host `op:"connect"` |
| host connect | `node_repl` `src/native_pipe.rs` | unix/named pipe |
| `ensureService` server | asar `Soe` / `Coe` | internal Electron only |
| `launchServices.openApplication` | privileged bridge | host `launch_services_action` |
| `ManagedComputerUseService` (`sie`) | asar | ChatGPT spawns `SkyComputerUseService` |

---

## 10. Wire shapes

CUA sock `ping` (what `create()` must complete):

```
uint32le | {"id":1,"jsonrpc":"2.0","method":"ping",
            "params":{"clientApiVersion":"CodexComputerUseIPC-5"}}
```

Expected result: `{ id, jsonrpc:"2.0", result:{ serverApiVersion:"CodexComputerUseIPC-5" } }`.

Host services (if env set):

```
uint32le | {"id":0,"jsonrpc":"2.0","method":"ensureService",
            "params":{"service":"computer-use"}}
```

`list_apps` after a live transport:

```
method: "request"
params.requestType: "ComputerUseIPCListAppsRequest"
params.request: {}
```

---

## Sources

- `/Users/dongdong/Desktop/codex-cua-reverse/vendor/sky/js/native-pipe.js`
- `/Users/dongdong/Desktop/codex-cua-reverse/vendor/sky/js/mac-client.js`
- `/Users/dongdong/Desktop/codex-cua-reverse/vendor/sky/js/service.js`
- `/Users/dongdong/Desktop/codex-cua-reverse/vendor/cua/js/create_tinysky_alt.js`
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/sky/dist/project/cua/sky_js/src/{sky.js,service.js,load_options.js,targets/mac/*}`
- `/Users/dongdong/Desktop/codex-cua-reverse/_tmp/node_repl_js/{kernel.js,trusted-worker.js,privileged-host-ops.js,privileged-node-repl.js}`
- `/Users/dongdong/Desktop/codex-cua-reverse/_tmp/asar_slices/main-D87AK7lw.js` (`Soe`, `xs`/`lte`, `sie`, `ds`)
- `/Users/dongdong/Desktop/codex-cua-reverse/verify/results/debug-live.json`
- `/Users/dongdong/Desktop/codex-cua-reverse/verify/results/{sky-shim.json,native-ipc.json}`
- `/Users/dongdong/Desktop/codex-cua-reverse/verify/debug-live.py`
- `strings` of `/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node_repl`
- `codesign -dv` of `node_repl` / `node` / ChatGPT.app
