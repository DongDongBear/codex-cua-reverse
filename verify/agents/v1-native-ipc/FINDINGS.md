# V1 — Native JSON-RPC pipe live call

## Verdict

**Overall: FAIL** for application-level native IPC (`ping` / `list_apps` / Finder `get_app_state`).

The reconstructed pipe **is a real listening Unix socket** on this machine, and two independent callers **agree bit-for-bit** on `uint32le` + JSON-RPC 2.0 frames. Live `connect()` from this agent succeeds. The service then **fail-closes the connection with 0 response bytes** before any JSON-RPC `result` or `error`. That happens even if we send nothing.

We did **not** observe:

- `result.serverApiVersion`
- `ComputerUseIPCListAppsRequest` apps
- Finder skyshot keys (`text` / `screenshot`)
- JSON-RPC `error.code` **`-10013`** (`incompatibleClientVersion`)
- JSON-RPC `error.code` **`-10000`** (`senderProcessNotAuthenticated`)

`SkyComputerUseService` **pid 3802** (ppid 3579 `ChatGPT.app`) is running. The signed helper `SkyComputerUseClient mcp` speaks **NDJSON MCP over stdio** and **XPC/mach_msg to the service**, not `computeruse.sock`. MCP `initialize` + `tools/list` PASS. MCP `list_apps` / `get_app_state` hang in `mach_msg` with no unix-socket attach.

No Linear / document clicks, typing, paste, or `pressKey`. No screenshot bytes dumped.

---

## Environment (measured)

| Item | Value |
|---|---|
| Socket | `/Users/dongdong/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock` |
| Mode | `srw-------` (`0o140600`), uid 501 gid 20 |
| Listener | `SkyComput` **pid 3802** fd 8 |
| Service exe | `/Users/dongdong/.codex/computer-use/Codex Computer Use.app/Contents/MacOS/SkyComputerUseService` |
| Service codesign | `com.openai.sky.CUAService`, team `2DC432GLL2` |
| Parent | ChatGPT.app pid **3579** (`com.openai.codex`) |
| API string used | `CodexComputerUseIPC-5` |
| Frame | `uint32le` length + UTF-8 JSON-RPC 2.0, max 8 MiB |

`lsof` on the named socket showed **only the service**. Idle `node_repl` / trusted-worker PIDs were **not** holding `computeruse.sock` (connect-on-demand).

---

## PASS / FAIL per check

| Check | Result | Error code | Response keys | Exact error / notes |
|---|---|---|---|---|
| Socket exists + service listen | **PASS** | — | — | `lsof` fd 8 on `computeruse.sock` |
| `connect()` | **PASS** | — | `connect_ms`, `recv` | python 0.03ms; node ~1–2ms |
| Two impls frame agreement | **PASS** | — | `frame_len`, `prefix_u32le`, `sha256_prefix` | see below |
| `ping` `CodexComputerUseIPC-5` | **FAIL** | *none* (`rpc: null`) | `[]` (no JSON-RPC object) | `socket closed`; 0 recv bytes; EOF ~4–30ms |
| `request` `ComputerUseIPCListAppsRequest` | **FAIL** | *none* | `[]` | `socket closed` |
| `request` `ComputerUseIPCAppGetSkyshotRequest` `{app:"Finder", disableDiff:true}` | **FAIL** | *none* | `[]` | `socket closed` |
| Adversarial `CodexComputerUseIPC-0` | **FAIL** | *none* (expected **-10013**) | `[]` | identical EOF to v5; **not** `incompatibleClientVersion` |
| Auth error `-10000` | **FAIL** to observe as RPC | expected **-10000** | `[]` | peer dropped at accept, no `error` object |
| Harness `verify/native-ipc.mjs` | **FAIL** 3/4 | ping/list/skyshot as above | adversarial falsely `ok: true` | list/skyshot `request timed out after 30000ms` because harness reused the dead socket |
| OpenAI-signed `cua_node/bin/node` (team `2DC432GLL2`) | **FAIL** same | `rpc: null` | `[]` | parent is this agent’s shell, not ChatGPT |
| Signed client MCP `initialize` | **PASS** | — | `id`, `jsonrpc`, `result` | `result` keys: `capabilities`, `protocolVersion`, `serverInfo` |
| Signed client MCP `tools/list` | **PASS** | — | `id`, `jsonrpc`, `result` | `result.tools` length **10** |
| Signed client MCP `list_apps` | **FAIL** | *none* | `[]` | timeout 25021ms; `pending=[]`; blocked in `mach_msg` |
| Signed client MCP `get_app_state` Finder | **FAIL** | *none* | `[]` | timeout 25008ms; same XPC hang |

---

## Two implementations agree

Callers (neither is a copy of the other):

- Harness: `/Users/dongdong/Desktop/codex-cua-reverse/verify/native-ipc.mjs`
- Independent Node: `independent-caller.mjs`
- Independent Python: `independent-caller.py`

Fixed JSON fixtures (no timestamps) hashed identically:

| Fixture | `prefix_u32le` | `frame_len` | `sha256_prefix` | `hex_head` |
|---|---:|---:|---|---|
| `ping` v5 | 94 | 98 | `730ec1b6a3e42f2f` | `5e0000007b226a736f6e727063223a22322e30222c226964` |
| `ping` v0 | 94 | 98 | `3d0d7b8080897470` | `5e0000007b226a736f6e727063223a22322e30222c226964` |
| `list_apps` | 235 | 239 | `cf5acf4912993935` | `eb0000007b226a736f6e727063223a22322e30222c226964` |
| Finder skyshot | 273 | 277 | `697e48e8f113fb3f` | `110100007b226a736f6e727063223a22322e30222c226964` |

`5e000000` is little-endian 94, then `{` (`7b`) — this is the reconstructed frame on the wire.

Runtime: both impls, every RPC, `error="socket closed"`, `rpc=null`, `recv_bytes=0`. `compare-impls.json`: `all_fixtures_agree=true`, `all_runtime_agree=true`.

Ping request actually sent:

```json
{"jsonrpc":"2.0","id":1,"method":"ping","params":{"clientApiVersion":"CodexComputerUseIPC-5"}}
```

List request shape (deadline/metadata vary by call):

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "request",
  "params": {
    "clientApiVersion": "CodexComputerUseIPC-5",
    "requestType": "ComputerUseIPCListAppsRequest",
    "request": {},
    "deadlineUnixMilliseconds": 0,
    "codexTurnMetadata": {"source": "v1-frame-fixture"}
  }
}
```

---

## Auth: close-on-accept, not `-10000`

Connect-only (no bytes written): python `recv=empty` at **7.47ms**. Ping v5: EOF at **30.5ms** python / **21ms** node. Raw `hello`: same EOF.

So `ComputerUseIPCSenderAuthorization` runs **before JSON-RPC parse**. Wrong version can never produce `-10013` for this peer.

Tried connecting processes:

| Process | Team / id | Parent | Result |
|---|---|---|---|
| fnm `node` v24.15.0 | `HX7739G8FX` / `node` | zsh/agent | connect + EOF |
| Homebrew `node` v22.23.1 | team not set | (identity snapshot only) | not used for RPC |
| `cua_node/bin/node` v24.20.0 | **`2DC432GLL2` / `node`** | zsh/agent | connect + EOF (same) |
| CPython 3.14.6 | Apple/unsigned | zsh/agent | connect + EOF |
| `SkyComputerUseClient` | `2DC432GLL2` / `com.openai.sky.CUAService.cli` | python | **does not open** `computeruse.sock`; XPC `mach_msg` hang on `list_apps` |

Team id on the connecting `node` binary is **not sufficient**. Parent/responsible process is ChatGPT (`com.openai.codex`) in the live stack (`node_repl` ppid chain → `codex` app-server → ChatGPT). This agent is not that ancestor. Binary strings include `Sender process is not authenticated`, `CODEX_COMPUTER_USE_IPC_AUTHORIZATION_FAILURE_REASON_UNTRUSTED_PARENT`, `MISSING_PARENT`. Those strings were **not** returned on the socket.

`log stream --predicate 'process == "SkyComputerUseService"'` during connect wrote **0 lines**.

---

## Signed client (required fallback)

Path:

`$HOME/.codex/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient`

Codesign: `com.openai.sky.CUAService.cli`, team `2DC432GLL2`.

**Framing:** MCP is **newline JSON**, not `Content-Length`. Content-Length initialize → JSON-RPC **`-32700`** `Parse error: Invalid JSON: Invalid message format` with a UUID `id` (not our numeric id). That is why `verify/mcp-client.mjs` timed out.

NDJSON `initialize` **PASS**:

```json
{
  "id": 1,
  "jsonrpc": "2.0",
  "result": {
    "capabilities": {"tools": {"listChanged": false}},
    "protocolVersion": "2024-11-05",
    "serverInfo": {
      "name": "Computer Use",
      "version": "14e7d17f1f59e77ca541a15071e980628cd08977a4dda111c96e0564d337056b"
    }
  }
}
```

`tools/list` **PASS** — names: `list_apps`, `get_app_state`, `click`, `perform_secondary_action`, `set_value`, `select_text`, `scroll`, `drag`, `press_key`, `type_text`.

`get_app_state` schema: required `["app"]`, properties `{app}` (no `disableDiff` on MCP). Annotations: `readOnlyHint: true` for `list_apps` and `get_app_state`.

`tools/call list_apps` and `get_app_state` `{app:"Finder"}`: **FAIL**, no MCP response. `sample` of the client: all threads in `mach_msg2_trap` / `libswiftXPC`. `lsof` of the client: **no** `computeruse.sock`. Service `lsof` of that socket: still only pid 3802.

So the signed client does **not** prove the native JSON-RPC pipe. It proves a **different** IPC (XPC) that also refuses this agent as sender/parent.

Mutating MCP tools were **not** called.

---

## Harness vs independent callers

`verify/native-ipc.mjs` (fnm node):

| check | harness |
|---|---|
| ping | `ok: false`, `error: "socket closed"`, `rpc: null` |
| list_apps | `ok: false`, `error: "request timed out after 30000ms"`, `rpc: null` |
| get_app_state_finder | `ok: false`, `error: "request timed out after 30000ms"`, `rpc: null` |
| adversarial_wrong_version | `ok: true`, `detail.rejected: true`, `message: "socket closed"`, `rpc: null` |

Independent callers use a **new socket per call**, so list/skyshot fail in ~4–22ms with `socket closed` instead of a 30s timeout. Same root cause.

Harness adversarial PASS is **invalid**: v5 ping is also `socket closed`.

---

## What this does prove

1. The path `~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock` is a live `AF_UNIX` server owned by `SkyComputerUseService` pid 3802.
2. The reconstructed frame (`uint32le` length + compact UTF-8 JSON-RPC 2.0) is well-formed; two languages emit identical bytes.
3. The service **accepts** then **immediately closes** unauthenticated peers, including OpenAI-team-signed `node` when the parent is not a trusted ChatGPT ancestor.
4. JSON-RPC application errors `-10000` / `-10013` are **not** delivered on this unauthenticated path.
5. Official `SkyComputerUseClient mcp` is NDJSON MCP + XPC, not this unix pipe.

A successful `ping` → `{serverApiVersion:"CodexComputerUseIPC-5"}` requires a sender the service will authenticate (ChatGPT-hosted `node_repl` nativePipe / trusted worker). This agent did not impersonate that process.

---

## Evidence files

| File | What |
|---|---|
| `checks-summary.json` | machine-readable PASS/FAIL |
| `identity.json` | pid/socket/codesign snapshot |
| `harness-native-ipc.json` | `verify/native-ipc.mjs` output |
| `independent-python.json` | python caller |
| `independent-node.json` | node caller (fnm) |
| `cua-signed-node.json` | same caller via `cua_node/bin/node` |
| `compare-impls.json` | fixture + runtime agreement |
| `signed-mcp.json` | Content-Length MCP (wrong framing) |
| `signed-mcp-ndjson.json` | NDJSON initialize/tools/list + hung tools/call |
| `signed-mcp-hang.json` | raw stdout, lsof, sample during `list_apps` |
| `mcp-raw-*.json` | framing trials including `-32700` |
| `independent-caller.py` / `.mjs` / `signed-mcp-ndjson.py` | the callers |

---

## Safety

Read-only native attempts only: `ping`, `ComputerUseIPCListAppsRequest`, Finder `ComputerUseIPCAppGetSkyshotRequest`. MCP: `initialize`, `tools/list`, `list_apps`, `get_app_state` Finder. No `click` / `type_text` / `set_value` / `paste` / `press_key`. No screenshot or secret material written.
