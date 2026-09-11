# FINDINGS — SkyComputerUseService sender authentication

**Scope.** Local disk only: `strings` / `nm` / `codesign` on the shipped binaries, JS sources, parent code-requirement plists, and existing verify JSON. No disassembly of the predicate, no identity forging, no new live probes.

**Verdict.** `SkyComputerUseService` authenticates every IPC peer with `ComputerUseIPCSenderAuthorization` + `ComputerUseIPCSenderContextResolver`. It does **not** trust “same uid + `0600` socket” and does **not** trust OpenAI team `2DC432GLL2` alone. The connecting process’s **code signature** (signing identifier + team) **and** its **parent / responsible / ancestor** chain must match a trusted-process / allowed-relay requirement. JSON-RPC unix `ping` from Node fail-closes the socket with **zero JSON-RPC bytes**. MCP `tools/call` over XPC from signed `SkyComputerUseClient` under an untrusted parent returns structured **`-10000`**. Those are the same authorization family on two transports.

---

## 0. Sources

| Path | Role |
|---|---|
| `$HOME/.codex/computer-use/Codex Computer Use.app/Contents/MacOS/SkyComputerUseService` | Service. Identifier=`com.openai.sky.CUAService`, team `2DC432GLL2`, SHA-256 previously recorded as `905939bff849b072da68e8e23e97188ed7bf93173646ac1bd9f7b54f9a89ce35`. |
| `…/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient` | MCP/CLI helper. Identifier=`com.openai.sky.CUAService.cli`. Talks **XPC**, not `computeruse.sock`. |
| `SkyComputerUseClient_Parent.coderequirement` | Parent requirement: **team-identifier `2DC432GLL2` only**. |
| ChatGPT `@oai/sky` `native-pipe.js` / `errors.js` | JS unix JSON-RPC client + `ServerErrorCode` table. |
| `cua_node/bin/node` vs `node_repl` | Same team `2DC432GLL2`; signing identifiers **`node`** vs **`node_repl`**. |
| `LIVE-VERIFICATION.md`, `DEBUG-LIVE.md`, `verify/results/{native-ipc,sky-shim,mcp-ndjson}.json`, `verify/agents/v{1,2,7}-*/` | Already-run live outcomes. Not re-probed here. |
| `native/sender-auth-strings.txt` | Unique recovered strings from this pass. |

Imported Security / Darwin APIs in the **service** (cstring / dyld stubs):

- `LOCAL_PEERTOKEN` (`getsockopt` error `LOCAL_PEERTOKEN failed errno=`, `invalid peer token length: `)
- `audit_token_to_pid`
- `SecTaskCreateWithAuditToken`
- `SecCodeCopyGuestWithAttributes`, `SecCodeCopySelf`, `SecCodeCopySigningInformation`, `SecCodeCopyStaticCode`
- `kSecGuestAttributeAudit` (stub name; Apple’s public constant is `kSecGuestAttributeAuditToken`), `kSecGuestAttributePid`
- `kSecCodeInfoIdentifier`, `kSecCodeInfoTeamIdentifier`

That is how a unix-socket or XPC peer becomes a `ProcessIdentity`. This note does not reconstruct the comparison algorithm.

---

## 1. Type graph (service)

Swift types live next to each other in the binary (`ComputerUse/ComputerUseIPCServer.swift` is the only ComputerUse IPC `.swift` path string):

```
ComputerUseIPCServer
  senderAuthorization        : ComputerUseIPCSenderAuthorization
  senderContextResolver      : ComputerUseIPCSenderContextResolver
  jsonRPCSocketServer        : ComputerUseIPCJSONRPCSocketServer
  xpcSessions                : [UUID : ComputerUseIPCXPCSession]
  serviceLifecycleMode
  computerUsePolicyProvider
  shouldTerminateWhenNoClientsRemain
  onCodexTurnEnded
  clientExitSources
  socketPath / clientAPIVersion / listenerQueue

ComputerUseIPCSenderAuthorization
  ClientType
  CodeSignature              (identifier, teamIdentifier, …)
  ProcessIdentity
  trustedProcessRequirement
  allowedRelayRequirement

ComputerUseIPCSenderContext          // Equatable struct
  clientType                 : ClientType?
  mcpRuntime                 : ComputerUseMCPRuntime?
  parentIdentity             : ProcessIdentity?
  responsibleIdentity        : ProcessIdentity?
  allowsLockScreenAutoUnlock : Bool

ComputerUseIPCXPCSession
  server
  listener
  senderContext              // stored on the session
  onInvalidation
  listener:shouldAcceptNewConnection:
  sendRequestWithTypeName:requestData:codexMetadataData:fileDescriptors:withReply:
```

`ProcessIdentity` field names recovered in one cluster:

| Field | Meaning |
|---|---|
| `senderPID` | Peer pid (`audit_token_to_pid` / XPC connection pid). |
| `codeSignature` / `identifier` / `teamIdentifier` | `kSecCodeInfoIdentifier` + `kSecCodeInfoTeamIdentifier`. |
| `bundleIdentifier` / `executableName` | Bundle + executable basename. |
| `parentIdentity` | Immediate parent process. |
| `responsibleIdentity` | Responsible process (macOS responsible pid, not always `ppid`). |
| `ancestorIdentities` | Walked chain. Analytics: `computer_use_ipc_ancestor_depth`. |
| `clientType` / `mcpRuntime` | Classified after identity. |
| `codexManaged` / `standalone` | Service lifecycle, not a client id. |

Plural allowlist-shaped names next to the requirements:

- `trustedProcessRequirement`, `allowedRelayRequirement`
- `teamIdentifiers`, `identifiers`, `executableNames`
- `senderParentResponsibleIdentity`, `senderAncestorIdentities`

`ComputerUseIPCSocketClient.SocketIdentity` / `boundSocketIdentity` (`device`, `inode`, `socket`, `task`) is the **bound socket file**, not the client. Separate from sender auth: `socket has unexpected owner path=`, `socket directory has unexpected owner path=`, `socket directory has unsafe permissions path=`, `socket lock has unexpected owner path=`.

Every `ComputerUseIPC*Request.handle(senderContext:)` in the service takes `ComputerUseIPCSenderContext?`. Authorization is per-request on the server object, not a JS concern.

---

## 2. `CODEX_COMPUTER_USE_IPC_*` enums

Present in **both** service and client (OAIProtobuf analytics). Swift case names sit in the same `AllCases` blob.

### Authorization failure reason (exactly four)

| Protobuf | Swift | Live reading |
|---|---|---|
| `CODEX_COMPUTER_USE_IPC_AUTHORIZATION_FAILURE_REASON_UNSPECIFIED` | `unspecified` | Default / unset. |
| `CODEX_COMPUTER_USE_IPC_AUTHORIZATION_FAILURE_REASON_MISSING_PARENT` | `missingParent` | No parent identity (pid 1 / gone / unreadable). |
| `CODEX_COMPUTER_USE_IPC_AUTHORIZATION_FAILURE_REASON_UNTRUSTED_PARENT` | `untrustedParent` | Parent signing/team not in the trusted set. |
| `CODEX_COMPUTER_USE_IPC_AUTHORIZATION_FAILURE_REASON_RELAY_WITHOUT_TRUSTED_ANCESTOR` | `relayWithoutTrustedAncestor` | Peer is an allowed **relay** (MCP CLI) but no trusted ancestor on the chain. |

There is **no** fifth `CODEX_COMPUTER_USE_IPC_AUTHORIZATION_*` string.

### Client type

| Protobuf | Swift |
|---|---|
| `CODEX_COMPUTER_USE_IPC_CLIENT_TYPE_UNSPECIFIED` | `unspecified` |
| `CODEX_COMPUTER_USE_IPC_CLIENT_TYPE_LEGACY_MCP` | `legacyMcp` |
| `CODEX_COMPUTER_USE_IPC_CLIENT_TYPE_NODE_REPL` | `nodeRepl` |
| `CODEX_COMPUTER_USE_IPC_CLIENT_TYPE_NATIVE_BRIDGE` | `nativeBridge` |

### Transport

| Protobuf | Swift | Path |
|---|---|---|
| `CODEX_COMPUTER_USE_IPC_TRANSPORT_UNSPECIFIED` | `unspecified` | |
| `CODEX_COMPUTER_USE_IPC_TRANSPORT_APPLE_EVENT` | `appleEvent` | Legacy. Errors `-10001/-10002/-10017/-10019`. |
| `CODEX_COMPUTER_USE_IPC_TRANSPORT_XPC` | `xpc` | `SkyComputerUseClient`, ChatGPT `sky.node`. |
| `CODEX_COMPUTER_USE_IPC_TRANSPORT_JSON_RPC_SOCKET` | `jsonRpcSocket` | `@oai/sky` `native-pipe.js` → `computeruse.sock`. |

### MCP runtime / service lifecycle (same blob)

| Protobuf | Swift / cstring |
|---|---|
| `CODEX_COMPUTER_USE_MCP_RUNTIME_UNSPECIFIED` | |
| `CODEX_COMPUTER_USE_MCP_RUNTIME_LEGACY_MCP` | `legacy_mcp` |
| `CODEX_COMPUTER_USE_MCP_RUNTIME_NODE_REPL` | `node_repl` |
| `CODEX_COMPUTER_USE_SERVICE_LIFECYCLE_UNSPECIFIED` | |
| `CODEX_COMPUTER_USE_SERVICE_LIFECYCLE_DESKTOP_MANAGED` | `desktopManaged` / `codexManaged` |
| `CODEX_COMPUTER_USE_SERVICE_LIFECYCLE_STANDALONE` | `standalone` |

---

## 3. Field names — `cua_ipc_sender_*` / `_senderParent*` / `_senderResponsible*`

Three parallel namings of the same analytics event `CodexComputerUseIpcRequestFailed`:

### Protobuf snake (`cua_ipc_sender_*`) — **service only**

Parent (no bundle id):

- `cua_ipc_sender_parent_team_id`
- `cua_ipc_sender_parent_signing_id`
- `cua_ipc_sender_parent_executable`

Responsible (includes bundle id):

- `cua_ipc_sender_responsible_team_id`
- `cua_ipc_sender_responsible_signing_id`
- `cua_ipc_sender_responsible_bundle_id`
- `cua_ipc_sender_responsible_executable`

There is **no** `cua_ipc_sender_parent_bundle_id`.

### Protobuf snake without `cua_ipc_` prefix — **service + client**

- `sender_parent_team_id` / `sender_parent_signing_id` / `sender_parent_executable`
- `sender_responsible_team_id` / `sender_responsible_signing_id` / `sender_responsible_bundle_id` / `sender_responsible_executable`
- `has_trusted_ancestor`
- `relay_without_trusted_ancestor`
- `untrusted_parent`

### ObjC storage (`_senderParent*` / `_senderResponsible*`) — **service + client**

```
_senderParentTeamID
_senderParentSigningID
_senderParentExecutable          // no _senderParentBundleID
_senderResponsibleTeamID
_senderResponsibleSigningID
_senderResponsibleBundleID
_senderResponsibleExecutable
_authorizationFailureReason
_clientType
_hasTrustedAncestor_p
_ancestorDepth
_transport
_errorCode
_requestType
```

Service-only analytics keys wrapping those:

- `computer_use_ipc_authorization_failure_reason`
- `computer_use_ipc_transport`
- `computer_use_ipc_has_trusted_ancestor`
- `computer_use_ipc_ancestor_depth`
- `computer_use_ipc_service_lifecycle`
- `computer_use_ipc_request_failed`
- `computer_use_ipc_request_type`
- `computer_use_ipc_error_code`

Human fail-closed copy (both binaries): **`Sender process is not authenticated`**. JS name `senderProcessNotAuthenticated` = **`-10000`**. Prefix string **`Computer Use server error `** (trailing space) is native, not JS.

---

## 4. `parentProcessIsCodex`

Literal in **both** service and client, **not** in the `ServerErrorCode` list.

Neighborhood (same in both binaries):

```
screenLocked
serverError
couldNotFindServiceApp
processIdentifier
parentProcessIsCodex
RawValue / Response / notImplemented
```

So it is a recovered **property / diagnostic field** next to `processIdentifier` and `couldNotFindServiceApp`, not an IPC error code. Combined with `CODEX_COMPUTER_USE_IPC_CLIENT_TYPE_NODE_REPL` and host bundle ids `com.openai.codex{,.alpha,.beta,.dev,.nightly}`, the intended parent of the JS pipe is ChatGPT/Codex, not a random `node`. The exact boolean expression was **not** decompiled.

---

## 5. Trusted team / signing ids / allowed-looking identifiers

### Team ids in the Swift constant pool (file `0x13564b8`–`0x13566b0`)

Co-located 10-character team-id-shaped strings and signing identifiers:

| String | What we know |
|---|---|
| `2DC432GLL2` | OpenAI OpCo. Service, client, `node_repl`, `cua_node`, ChatGPT. **Required** on trusted peers. **Not sufficient** by itself (`cua_node` Identifier=`node` still CLOSE). |
| `HX7739G8FX` | Node.js Foundation. Live fnm `node` team. Untrusted. Sitting next to `2DC432GLL2` as a comparison constant, not an allow. |
| `MQ55VZLNZQ` | Unknown 10-char team-id-shaped string next to `codex-acp`. **Not** claimed trusted. |
| `codex-acp` | Signing/executable-shaped literal next to `MQ55VZLNZQ`. Not live-tested. |
| `node` | Signing identifier of both Foundation Node and OpenAI `cua_node`. **Rejected** on the unix socket. |
| `node_repl` | Signing identifier of ChatGPT `cua_node/bin/node_repl`. Intended JS peer (host-side `nativePipe`). |

`node` and `node_repl` appear **twice** as a pair. That matches live: team-signed `node` ≠ `node_repl`.

Parent code-requirement plists (`SkyComputerUseClient_Parent.coderequirement`, guardian equivalent) contain only:

```xml
<key>team-identifier</key>
<string>2DC432GLL2</string>
```

No identifier list in those files. Identifier policy is compiled into the service (`trustedProcessRequirement` / `allowedRelayRequirement` / `identifiers` / `executableNames`).

### Host bundle ids (allowlist-looking, **not** the whole nearby table)

Consecutive OpenAI host literals in the service:

```
com.openai.codex
com.openai.codex.alpha
com.openai.codex.beta
com.openai.codex.dev
com.openai.codex.nightly
com.openai.chat
com.openai.chat.alpha
com.openai.chat.beta
com.openai.chat.nightly
com.openai.chat.mac-debug
com.openai.atlas
com.openai.atlas.alpha
com.openai.atlas.beta
com.openai.sky.app
com.openai.sky.development.app
```

Live parent of the clicker on this machine: ChatGPT.app **`com.openai.codex`**, same team.

**Do not** treat the surrounding bundle-id table as sender-auth. Immediately before `com.openai.codex` are terminals/password managers; immediately after are Safari and other browsers. That larger table is policy/special-app inventory (`native/bundle-ids.txt` already listed the OpenAI slice).

### CUA identities (peers, not hosts)

| Identifier | Binary | Notes |
|---|---|---|
| `com.openai.sky.CUAService` | service | The listener. |
| `com.openai.sky.CUAService.cli` | client | MCP/XPC relay. String is in the **client**, not as a C string in the service. Accepted as a relay only with a trusted ancestor (`allowedRelayRequirement`). |
| `node_repl` | `cua_node/bin/node_repl` | JS unix-socket peer when ChatGPT hosts `nativePipe`. |
| `CodexComputerUseNativeBridge-1` | ChatGPT `sky.node` | Native-bridge client type / API string, XPC overlay. |

`com.openai.codex.computer-use.status-item-state-changed` is a Darwin notify name, not a sender id.

### What is **not** enough (already measured; not re-tested)

| Peer | Team | Identifier | Unix `computeruse.sock` |
|---|---|---|---|
| fnm Node | `HX7739G8FX` | `node` | CONNECT then **CLOSE**, 0 bytes |
| OpenAI `cua_node/bin/node` | `2DC432GLL2` | `node` | same CLOSE |
| CPython | Apple/unsigned | — | same CLOSE |
| Raw `net.connect` shim pretending to be `nodeRepl.nativePipe` | (caller’s Node) | `node` | same CLOSE |

Trusted JS path: host-side `nodeRepl.nativePipe.createConnection` (`NativePipeRequestOp::Connect` in `node_repl`). JS `@oai/sky` throws `Sky Computer Use requires the trusted nodeRepl runtime` if `globalThis.nodeRepl.nativePipe.createConnection` is missing. The unix connect is performed by **`node_repl` / ChatGPT**, whose parent is `com.openai.codex`.

Independent `node_repl` without that host bridge (`DEBUG-LIVE.md`): `Sky Computer Use native pipe startup failed`. Same door.

---

## 6. Why unsigned Node gets socket CLOSE vs MCP `-10000`

Same `ComputerUseIPCSenderAuthorization`. Different transport presentation.

### JSON-RPC unix socket (`CODEX_COMPUTER_USE_IPC_TRANSPORT_JSON_RPC_SOCKET`)

Listener: `ComputerUseIPCJSONRPCSocketServer` on

`~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock` (`srw-------`).

On accept the service takes **`LOCAL_PEERTOKEN`** (audit token of the connecting process) **before JSON-RPC parse**. v1 already showed: connect with **no bytes written** still EOF in ~7 ms. Ping/request/wrong-version all get `rpc: null`, 0 inbound bytes.

So:

- Untrusted peer never reaches `ComputerUseJSONRPCPingParams` / version check.
- **`-10013 incompatibleClientVersion` is unreachable** without passing sender auth.
- **`-10000` is not written on this socket** for these peers. The socket is dropped (`onClose`).
- JS maps that to `SkyComputerUseTransportError` (`Sky Computer Use native pipe closed before response` / `service startup request failed`), not `SkyComputerUseError`.

`native-pipe.js` handshake (only after a live connection):

1. `method: "ping"` params `{ clientApiVersion: "CodexComputerUseIPC-5" }` → `{ serverApiVersion }`.
2. JSON-RPC methods recovered as a triple: `close`, `ping`, `request` (then `unsupported`).
3. `request` params: `{ clientApiVersion, codexTurnMetadata, deadlineUnixMilliseconds, request, requestType }`.
4. Ping mismatch in JS throws transport error `Sky Computer Use API version mismatch` **without retry**. Native `-10013` is the same family if the server ever answered.

Live ping frame (already hashed in v1): uint32le `0x0000005e` + JSON, 98 bytes. Service FIN, 0 recv.

### MCP / XPC (`CODEX_COMPUTER_USE_IPC_TRANSPORT_XPC`)

`SkyComputerUseClient mcp` does **not** open `computeruse.sock`. Stdio is NDJSON JSON-RPC. `initialize` / `tools/list` succeed **locally** (no CUAService round-trip).

Tool dispatch: `ComputerUseIPCXPCTransport.sendRequest(requestTypeName:requestData:codexMetadataData:fileHandles:)` → service `ComputerUseIPCXPCSession.sendRequestWithTypeName:…withReply:`. Session keeps `senderContext`. `listener:shouldAcceptNewConnection:` can accept the **CLI identity** (`com.openai.sky.CUAService.cli`, team `2DC432GLL2`, app group) as an **allowed relay**.

Then `ComputerUseIPCSenderAuthorization` still walks **parent / responsible / ancestors**. Probe parent was fnm `node` (`HX7739G8FX`) → `UNTRUSTED_PARENT` / `RELAY_WITHOUT_TRUSTED_ANCESTOR`. XPC is request/reply, so the service **returns** a structured error instead of dropping a byte stream:

```
Computer Use server error -10000: Sender process is not authenticated
```

MCP wraps that as `isError: true` text. JS table: `senderProcessNotAuthenticated = -10000`.

Official launch (not forged): Codex → `computer-use-client-launcher` → `SkyComputerUseClient mcp` under a `2DC432GLL2` parent. Parent requirement file is team-only; the service still wants a trusted ancestor, not just a signed CLI binary.

v1’s `SkyComputerUseClient` under Python hung in `mach_msg` on `list_apps` (no `-10000` yet). v3/v7 under Node got `-10000` promptly. Timing/UX of the XPC error vs hang is not fully mapped; the **code and message** on the successful error path are.

### Apple Event leftover

Not the JS or MCP path. Same authorization object can be missing a pid/port:

- `-10017` `couldNotGetSenderPID` — `Could not get sender PID from Apple event`
- `-10019` `couldNotGetBootstrapPort` — `Could not get XPC bootstrap mach port from Apple event`

---

## 7. JSON-RPC ping vs XPC — auth difference (compact)

| | JSON-RPC `ping` (`native-pipe.js`) | XPC (`SkyComputerUseClient`) |
|---|---|---|
| Transport enum | `JSON_RPC_SOCKET` / `jsonRpcSocket` | `XPC` / `xpc` |
| Wire | unix `computeruse.sock`, uint32le + JSON | `SAIComputerUseIPCXPCProtocol` `sendRequest` |
| Peer token | `LOCAL_PEERTOKEN` on the socket | `NSXPCConnection` audit token → same resolver |
| Handshake | **`ping` `{clientApiVersion}` → `{serverApiVersion}`**. API `CodexComputerUseIPC-5`. | **No ping.** First call is a typed request. |
| When auth runs | **Accept / first peer-token**, even with 0-byte connect. | Session accept + `handle(senderContext:)` on `sendRequest`. |
| Untrusted Node | **CLOSE**, 0 JSON-RPC bytes, no `-10000` | N/A (Node does not speak this XPC). |
| Signed CLI, untrusted parent | Does not use this socket | MCP stdio works; **`tools/call` → `-10000`**. |
| Trusted `node_repl` host pipe | Intended. Peer is `node_repl` under Codex. | Not this path. |
| Version mismatch | Would be `-10013` **after** auth. Unreachable from unsigned Node. | N/A (no ping). |

`ComputerUseJSONRPCPingParams` / `ComputerUseJSONRPCPingResult` exist only on the socket path. XPC carries `requestTypeName` + `requestData` + `codexMetadataData` + optional file handles. Ping is not an XPC selector.

---

## 8. `native-pipe.js` / `errors.js` (JS side of the same door)

`errors.js` (`ServerErrorCode`):

```
senderProcessNotAuthenticated: -10000
…
incompatibleClientVersion:     -10013
couldNotGetSenderPID:          -10017
couldNotGetBootstrapPort:      -10019
```

`native-pipe.js`:

- Requires `globalThis.nodeRepl.nativePipe.createConnection` (not `net.connect`).
- Socket: `SKY_CUA_SERVICE_NATIVE_PIPE_PATH` else `~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock`.
- After connect, **must `ping`**. Close/error → retry / `ensureService` / `launchServices`. `-10013` aborts retry.
- JSON-RPC `error.code` becomes `SkyComputerUseError`; a dropped socket becomes `SkyComputerUseTransportError`.

That is why LIVE-VERIFICATION and DEBUG-LIVE disagree in **shape** (CLOSE vs `-10000` vs `native pipe startup failed`) but agree in **cause**: this process is not a trusted sender.

---

## 9. Live evidence (already on disk)

| Check | File | Result |
|---|---|---|
| fnm Node ping | `verify/agents/v7-mcp-ndjson/ping.json` | CLOSE, 0 bytes, ~59 ms |
| `cua_node` Identifier=`node` ping | same | CLOSE, 0 bytes, write 98, ~32 ms |
| sky-shim ping ×5 | `verify/results/sky-shim.json` `auth` | `inboundBytes: 0`, `jsonRpcErrorCode: null`, note: FIN with zero JSON-RPC bytes |
| native-ipc ping / list / skyshot / v0 | `verify/results/native-ipc.json`, v1 FINDINGS | all CLOSE; v0 is **not** `-10013` |
| Connect with no write | v1 FINDINGS | EOF ~7 ms |
| MCP `list_apps` under Node parent | `verify/results/mcp-ndjson.json` id 3 | `Computer Use server error -10000: Sender process is not authenticated` |
| ChatGPT-hosted `cua.getApp("Finder")` | `DEBUG-LIVE.md` | **works** (trusted `cua_repl`) |
| Independent `node_repl` | `DEBUG-LIVE.md` | `native pipe startup failed` |

---

## 10. Intentionally not recovered

- The compiled `SecRequirement` / boolean that maps `(identifier, team, parent, responsible, ancestors)` → allow. Strings name `trustedProcessRequirement` and `allowedRelayRequirement`; the predicates were not disassembled.
- Whether `responsibleIdentity` is `responsibility` (TCC/responsible process) or something else. Field exists; walk not proven.
- Whether `MQ55VZLNZQ` / `codex-acp` are allow, deny, or leftover.
- How to satisfy the check from an unsigned process. **Out of scope.**

Raw unique strings: [`native/sender-auth-strings.txt`](../../native/sender-auth-strings.txt).
