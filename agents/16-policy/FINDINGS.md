# FINDINGS — Computer Use policy, confirmations, elicitation

**Verdict.** Computer Use has **two policy layers that do not share an enforcement engine**.

1. **Machine-enforced app / URL gate** (this is what actually stops a click). Mac JS `withComputerUsePolicy` asks native `ComputerUseIPCAppPolicyRequest`. Native returns `allowed` / `denied` (org) / `forbidden` (safety). On `allowed`, JS blocks on `nodeRepl.createElicitation` (“Allow Computer Use to use "{displayName}"?”). The host (`node_repl` `ComputerUseElicitationInterceptor`) may auto-accept from persisted approvals and return `content.source = "computer-use-persisted-state"`. After accept, JS **rewrites `input.app` to `target.appPath` and freezes it**, then runs the native action. Browser windows can still abort later with `blockedURL` (−10015) via `ComputerUseURLBlocklistCache`. Native does **not** read the user’s chat text, SKILL.md, or “全权由你控制”.
2. **Model-facing confirmation taxonomy** (prompt only). First-use docs dump `tinysky-alt-confirmations.md` into `cua.core`; browser first-use dumps `browser-safety.md` + `confirmations.md`. Creating a Linear issue is category **[9] representational communication**, which the markdown says must be confirmed at action-time even if pre-approved. That rule is **not wired to the clicker**. The Linear traces could click because (a) Linear is not a forbidden/denied app, (b) the app elicitation had already succeeded (session persist; `ComputerUseAppApprovals.json` was never written on this machine), (c) the model had already asked via `request_user_input_async` and the user answered `可以的`, (d) the original task already named the issue+assign action, and (e) the system prompt tells the model that user instructions outrank skills and that authorization persists.

`request_user_input_async` is a **functions** tool, not CUA. It returns immediately (`{"accepted":true}`) and the answer arrives later as `<send_user_message_question_reply>`. It is not `nodeRepl.createElicitation`.

---

## 0. Sources (local disk)

| Layer | Path |
|---|---|
| Mac policy wrap | `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/sky/dist/project/cua/sky_js/src/targets/mac/computer-use-policy.js` (+ `.d.ts`) |
| Mac IPC client | `…/targets/mac/client.js` / `client.d.ts` / `native-pipe.js` |
| Telemetry | `…/targets/mac/computer-use-telemetry.js` / `.d.ts` |
| Errors | `…/targets/mac/errors.d.ts` (`blockedURL` −10015, `appNotAllowed` −10006) |
| Windows sibling elicitation | `…/targets/windows/internal/helper_transport.js` |
| Tinysky confirmations | `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/docs/tinysky-alt-confirmations.md` |
| Docs loader | `…/tinysky_alt/documentation.js` (`read_computer_use_confirmation_policy`) |
| Browser docs | `@oai/browser-desktop/docs/{confirmations,browser-safety}.md` + `documents.json` |
| Plugin skill | `plugins/openai-bundled/plugins/computer-use/skills/computer-use/SKILL.md` and `.codex-plugin/computer-use-node-repl.md` |
| Kernel elicitation | `codex-cua-reverse/_tmp/node_repl_js/{kernel.js,privileged-host-ops.js}` |
| Host interceptor | `/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node_repl` (`ComputerUseElicitationInterceptor`, `MacOSApprovals`) |
| Native service | `~/.codex/computer-use/Codex Computer Use.app/Contents/MacOS/SkyComputerUseService` |
| ChatGPT settings I/O | `codex-cua-reverse/_tmp/asar_slices/main-D87AK7lw.js` (`ComputerUseAppApprovals.json`) |
| Org/config TOML | `codex-cua-reverse/vendor/openai-codex/codex-rs_config_src/{computer_use,browser_computer_use_requirements}.rs` |
| MCP extensions | `vendor/openai-codex/codex-rs_protocol_src_mcp.rs` (`openai/elicitation`, `openai/confirmation_policies`) |
| Linear traces | `codex-traffic/2026-09-10/0223_WS_backend-api_codex_responses/` and `codex拦截-两轮-raw.json` |

Copied trees under `codex-cua-reverse/vendor/` and `agents/{01,02,03,07}/` match these files.

---

## 1. Two layers (do not collapse)

```
js cell (cua.getApp / app.click / sky.*)
  │
  ├─ tinysky first-use markdown (confirmations taxonomy)     ← model only
  │
  └─ sky.* public method
        withComputerUsePolicy(toolName, input, op)            ← JS, Mac
          getAppPolicy({ app })  →  ComputerUseIPCAppPolicyRequest
          switch decision
            denied    → throw org-policy error (no elicit)
            forbidden → throw safety error (no elicit)
            allowed   → nodeRepl.createElicitation(...)
                          │
                          host ComputerUseElicitationInterceptor.maybe_auto_answer
                          │  persisted? → { action:"accept", content:{ source:"computer-use-persisted-state", scope } }
                          │  else MCP form elicitation UI
                          │
          freeze input; rewrite app → target.appPath
          nodeRepl.withSuspendedTimeout(op)
            native ComputerUseIPCAppGetSkyshotRequest | AppPerformActionRequest
              optional isURLBlocked → -10015 ends session
```

`list_apps` skips the app elicitation. It still sets response meta (`app: null`) and logs `CodexComputerUseMcpToolCalled`. Audio start skips app policy and has its own high-risk elicitation (persist `session` only).

The confirmation markdown is injected here, not in the native service:

```javascript
// documentation.js
const override = nodeRepl.requestMeta?.["openai/confirmation_policies"]?.computer_use;
return (string, non-empty, ≤ 12000 UTF-8 bytes) ? override : readFile("tinysky-alt-confirmations.md");
```

`create_tinysky_alt` appends that string to `cua.core` only in `core-cua-repl` mode (ChatGPT.app default). Browser `setupBrowserRuntime` then passes `excludedDocumentation: ["confirmations"]` so the browser pack does not dump a second copy of `confirmations.md`. `browser-safety.md` still always-includes.

Protocol constant: `CONFIRMATION_POLICIES_META_KEY = "openai/confirmation_policies"` in `codex-rs_protocol_src_mcp.rs`. Host-supplied override; not observed as a non-empty string in the Linear capture.

---

## 2. `withComputerUsePolicy` (`computer-use-policy.js`)

Public exports:

```ts
withComputerUsePolicy<Input extends { app: string }, Result>(
  toolName: ComputerUseToolName,  // keyof Window.Client
  input: Input,
  operation: (approvedInput: Readonly<Input>) => Promise<Result>,
): Promise<Result>

requestComputerAudioApproval(): Promise<void>
withComputerUseToolTelemetry<Result>(toolName, bundleIdentifier, operation): Promise<Result>
setComputerUseResponseMeta(bundleIdentifier: string | null): void
```

Wrapped Mac methods: `get_app_state`, `click`, `drag`, `paste`, `perform_secondary_action`, `press_key`, `scroll`, `select_text`, `set_value`, `type_text`. Tinysky `cua.getApp` / `app.*` all go through these (`getApp` → `sky.get_app_state({ disableDiff: true })`).

### 2.1 Control flow (decompiled from the one-line file)

1. `setComputerUseResponseMeta(null)` — clear chrome/app meta before the policy RPC.
2. Snapshot `input` through `freezeAppInput(input)` (plain data properties only; `app` must be a non-empty string). Getters/setters throw `Computer Use app approval requires ${key} to be a plain data property`.
3. Require `nodeRepl.createElicitation` and `nodeRepl.withSuspendedTimeout`.
4. `client.getAppPolicy(app)` → IPC below.
5. `setComputerUseResponseMeta(result.target.bundleIdentifier)`. If the bundle is `com.google.Chrome`, also set `codex/computerUseChrome: true`.
6. Branch on `decision`:
   - `"allowed"` → continue with `target`.
   - `"denied"` → `Computer Use is blocked from using the app '${bundleIdentifier}' by your organization's policy.`
   - `"forbidden"` → `Computer Use is not allowed to use the app '${bundleIdentifier}' for safety reasons.`
7. **Always elicit on `allowed`.** There is no JS-side “already approved” cache. Persistence is the host interceptor returning a synthetic accept (see §4).
8. Elicitation request:

```js
{
  message: `Allow Computer Use to use "${target.displayName}"?`,
  meta: {
    codex_approval_kind: "mcp_tool_call",
    connector_id: "computer-use",
    connector_name: "Computer Use",
    persist: result.allowPersistentApproval ? ["session", "always"] : ["session"],
    riskLevel: target.risk,                 // "high" | "low"
    subtitle?: target.warningSubtitle,      // omitted if null
    tool_call_id?: call_id || item_id,      // from x-codex-turn-metadata
    tool_name: toolName,                    // e.g. "get_app_state" | "click"
    tool_params: { app: target.bundleIdentifier },
    tool_params_display: [{ name: "app", display_name: "App", value: target.displayName }],
  }
}
```

9. If the response is **not** persisted-state, log `CodexComputerUseMcpAppApprovalRequested` (timestamp captured *before* the prompt) and `CodexComputerUseMcpAppApprovalResolved` (`accepted` / `canceled` / `declined`, plus `approvalPersistence: "always"|"session"` when accepted).
10. Persisted-state skip: `content` is a plain object with `content.source === "computer-use-persisted-state"`. No approval telemetry.
11. Any `action !== "accept"` → `Computer Use was not approved to use ${displayName}`.
12. Re-freeze input, replacing `app` with **`target.appPath`**. Native action RPCs therefore see a path, not the original `"Linear"` / `"com.linear"`. Telemetry and response meta keep the bundle id.
13. `withSuspendedTimeout(() => operation(frozenInput))` so the MCP `js` timeout does not fire while the user stares at the prompt. Native call still has its own 120 s IPC deadline.
14. Telemetry `CodexComputerUseMcpToolCalled`: `terminalStatus` `completed` / `failed` / `cancelled` (`cancelled` only for native −10012 `userStoppedSession` and −10016 `userIntervened`). Fields include `invocationSource: "code_mode"`, `transport: "native_pipe"`, `pluginId: "computer-use@openai-bundled"`, `mcpServerName: "node_repl"`.

Audio elicitation (`requestComputerAudioApproval`):

```js
message: "Allow Computer Use to record computer audio?"
meta.codex_request_type = "approval_request"
meta.persist = ["session"]          // never "always"
meta.riskLevel = "high"
meta.tool_name = "start_audio_recording"
```

### 2.2 Response meta

```js
nodeRepl.setResponseMeta({
  "codex/toolSurface": {
    kind: "computerUse",
    app: bundleIdentifier == null ? null : { appId: bundleIdentifier, kind: "appId" },
  },
  ...(bundleIdentifier === "com.google.Chrome" ? { "codex/computerUseChrome": true } : {}),
});
```

`list_apps` and the pre-policy clear both pass `null`.

---

## 3. Native IPC: Request / Decision / Result

JS request envelope (`native-pipe.js`):

```json
{
  "jsonrpc": "2.0",
  "method": "request",
  "params": {
    "clientApiVersion": "CodexComputerUseIPC-5",
    "codexTurnMetadata": { ... } | null,
    "deadlineUnixMilliseconds": 0,
    "requestType": "ComputerUseIPCAppPolicyRequest",
    "request": { "app": "<identifier>" }
  }
}
```

`getAppPolicy` accepts a bare string or `{ app }`. Empty/whitespace throws `TypeError("app is required")` in JS before IPC.

### 3.1 Types (JS `MacAppPolicyResult` + Swift names)

| Swift type | Role |
|---|---|
| `ComputerUseIPCAppPolicyRequest` | `{ app }` |
| `ComputerUseIPCAppPolicyDecision` | enum `allowed` \| `denied` \| `forbidden` |
| `ComputerUseIPCTargetRisk` | enum `high` \| `low` (JS field `target.risk`) |
| `ComputerUseIPCTargetDescriptor` | resolved app |
| `ComputerUseIPCAppPolicyResult` | decision + target + persist flag |

```ts
type MacAppPolicyTarget = {
  appPath: string;
  bundleIdentifier: string;
  displayName: string;
  risk: "high" | "low";
  warningSubtitle?: string | null;
};
type MacAppPolicyResult = {
  allowPersistentApproval: boolean;
  decision: "allowed" | "denied" | "forbidden";
  target: MacAppPolicyTarget;
};
```

Swift constructor fragments in the service binary match those fields: `displayName`, `appPath`, `risk`, `warningSubtitle`; result `target` + `allowPersistentApproval`.

### 3.2 Who decides `decision`

Native types (not JS):

- `ComputerUsePolicyProviding` / `CodexAppServerComputerUsePolicyProvider` / `ComputerUsePolicy` / `AppAccess.MacOS` — org + config allow/deny.
- `isForbiddenComputerUseTarget` / `allowsForbiddenComputerUseTargets` / user-default `ComputerUseAllowForbiddenTargets`.
- `BundleIdentifiers` categories in the same binary: `systemSecurity`, `terminal`, `finder`, `browser` / `chromiumBrowser`, `elevatedRisk`, `computerUseHost`, `chatGPTBundle`, `iPhoneMirroring`.

Observed compiled bundle-id **clusters** (not a complete deny list; classification is compiled Swift):

| Cluster (adjacent C strings) | Examples |
|---|---|
| Password managers (`elevatedRisk`) | `com.1password.1password`, `com.1password.safari`, `com.bitwarden.desktop`, `com.dashlane.dashlanephonefinal`, `com.lastpass.LastPass`, `com.nordsec.nordpass`, `me.proton.pass.electron`, `me.proton.pass.catalyst` |
| Terminals | `com.apple.Terminal`, `com.googlecode.iterm2`, `dev.warp.Warp-Stable`, `net.kovidgoyal.kitty`, `com.github.wez.wezterm`, `com.mitchellh.ghostty`, `com.raphaelamorim.rio`, `dev.commandline.waveterm` |
| Codex / ChatGPT / Atlas hosts | `com.openai.codex{,.alpha,.beta,.dev,.nightly}`, `com.openai.chat{,.alpha,.beta,.nightly,.mac-debug}`, `com.openai.atlas{,.alpha,.beta}` |
| Other browsers | `com.apple.Safari`, `ai.perplexity.comet`, `com.brave.Browser`, `com.microsoft.edgemac`, `com.operasoftware.Opera`, `com.vivaldi.Vivaldi`, `company.thebrowser.{Browser,browser,dia}`, `org.chromium.Chromium`, plus later `com.apple.SafariTechnologyPreview`, `org.mozilla.firefox`, `org.mozilla.nightly` |
| System security | `com.apple.UserNotificationCenter`, `com.apple.LocalAuthenticationRemoteService`, `com.apple.SecurityAgent` (also `WindowManager`, `controlcenter`, `notificationcenterui` elsewhere) |
| Finder | `com.apple.finder` next to `ComputerUseAllowForbiddenTargets` |

Human strings:

- `Computer use actions are not allowed for system security process: `
- `Computer Use is disabled by your configuration.`
- `Computer Use is blocked from using the app '…' by your organization's policy.` (JS `denied`)
- `Computer Use is not allowed to use the app '…' for safety reasons.` (JS `forbidden`)
- `Computer Use approval denied via MCP elicitation for app '` (legacy MCP / client path)

`com.linear` is **not** in those clusters. Linear is a normal `allowed` target with a user elicitation.

Config / org TOML (Rust, `ComputerUseRequirementsToml` / `ComputerUseConfigToml`):

```toml
[computer_use]
default_app_access = "allow" | "deny"
allow_persistent_approval = true | false
allow_locked_computer_use = true | false

[computer_use.macos.bundle_ids]
"com.example.app" = "allow" | "deny"
```

Windows uses `aumids` / `exes` and `config.toml` `[computer_use.windows.always_allowed_app_ids]`. That TOML path is not used on darwin.

`allowPersistentApproval` on the IPC result is the AND of native policy (org `allow_persistent_approval`, app risk, etc.). JS only copies the boolean into `meta.persist`.

---

## 4. `nodeRepl.createElicitation`

### 4.1 Kernel (trusted worker)

`createPrivilegedHostOperations` in `kernel.js` / `privileged-host-ops.js`. Exposed on the **trusted** `nodeRepl`, not the untrusted user VM.

Gate: `execState.formElicitationSupported` from the host exec frame `form_elicitation_supported === true`. Otherwise:

`nodeRepl.createElicitation is unavailable because the MCP client does not support form elicitation`

Request shape (only these keys):

```ts
{
  message: string,            // non-empty after trim
  meta?: object,
  requestedSchema?: object,   // default { type: "object", properties: {} }
}
```

Any other key → `received an unsupported value`.

JSONL to the host:

```json
{
  "type": "elicit",
  "id": "<execId>-elicitation-<n>",
  "exec_id": "<execId>",
  "message": "Allow Computer Use to use \"Linear\"?",
  "requested_schema": { "type": "object", "properties": {} },
  "meta": { "codex_approval_kind": "mcp_tool_call", "...": "..." }
}
```

The kernel then `pendingRequests.set(id, cb)`. Host reply is any JSONL object with the same `id`; `runtime.settle` delivers it:

```js
{ ok: true,  action: "accept" | "cancel" | "decline", content?: object | null, _meta?: object | null }
{ ok: false, error: string }
```

JS maps `action` to telemetry `accepted` / `canceled` / `declined`. Policy only accepts `"accept"`.

MCP capability advertised by the rust host: `FormElicitationCapability` under `openai/elicitation` / `openai/form`. `CreateElicitationResult` / `ElicitationAction`. Independent `v3-mcp-client` probe of `cua_repl` initialize did **not** advertise elicitation to an external MCP client; the ChatGPT.app host does, via `form_elicitation_supported` on exec.

### 4.2 Host interceptor (`node_repl` rust)

Symbols in `/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node_repl`:

- `node_repl::computer_use::ComputerUseElicitationInterceptor`
- `ElicitationInterceptor::maybe_auto_answer`
- `ElicitationInterceptor::on_result`
- `node_repl::computer_use::macos_approvals::MacOSApprovals` + `persist`
- `js_elicitation_result`, `handle_elicitation_request`
- `merge_exec_metadata_into_elicitation_meta`

String blob (one C-string):

`acceptdeclineconversationglobalcomputer-use-persisted-state`

Plus: `approvedBundleIdentifiers`, `unable to locate CODEX_HOME or HOME for computer-use state persistence`, `computer-audio`, `allowed`/`denied`.

So auto-answer scopes are **`conversation`** (session) and **`global`** (always). When the interceptor short-circuits, JS sees:

```json
{ "action": "accept", "content": { "source": "computer-use-persisted-state", "scope": "conversation" | "global" } }
```

(`scope` is what the Windows helper inspects; Mac JS only checks `source`.)

Windows `helper_transport.js` is the sibling path. Helper can return an `approvalRequest`; JS then elicits. It **rejects** a persist-always result when `allowPersistentApproval` is false (treats `content.persist === "always"` or `source === "computer-use-persisted-state" && scope === "global"` as not approved). Mac JS does **not** have that extra reject.

### 4.3 What this is not

- Not `request_user_input` / `request_user_input_async` (model tools).
- Not the `js` auto-review elicitation (`JavaScript execution requires an approval`, `codex_strict_auto_review`) — that is a host gate on running the cell at all.
- Not TCC Accessibility / Screen Recording prompts (native permission window).
- Untrusted `js` code cannot call `createElicitation`; it lives on the trusted bridge. The model reaches it only because `@oai/sky` runs in the trusted worker.

---

## 5. Confirmation markdown (model-facing)

Three documents, same taxonomy numbers, different scope.

| File | When the model sees it | Scope sentence |
|---|---|---|
| `tinysky-alt-confirmations.md` | Appended to `cua.core` on first `js` in `core-cua-repl` | Computer Use UI actions **or** browser navigation through CU **or WebMCP** |
| `computer-use` `SKILL.md` / `computer-use-node-repl.md` | Skill overlay | CU UI actions or browser via CU; **no WebMCP** in the node-repl copy |
| `@oai/browser-desktop/docs/confirmations.md` | Browser first-use (`documents.json` `mode: "included"`, `requiredFor` CDP + WebMCP). **Excluded** in tinysky `core-cua-repl` because CU already dumped confirmations | Browser actions only |
| `docs/browser-safety.md` | Always included in browser first-use | Short untrusted-content + “apply the confirmation policy” checklist |
| `browser-safety-training.md` (cua copy) | Training pack | Even shorter; hard-bans CAPTCHA / paywall / password-change instead of pointing at the taxonomy |

### 5.1 Modes (shared)

1. **Hand-off** — user must do it: `[2.4]` submit change-password; `[15]` HTTPS interstitial / paywall bypass.
2. **Always confirm at action-time, even if pre-approved** — delete; account/permission/API-key/password-save; CAPTCHA; install software/extensions; **[9] representational communication (create/modify)**; subscribe; financial; OS settings; medical.
3. **Pre-approval works** — login/permission prompts; age verification; third-party “are you sure?”; uploads; file move/rename; (CU only) transmit sensitive data **if** the initial prompt named specific data + destination.
4. **No confirmation** — cookie/ToS; inbound download; anything outside the taxonomy.

Hygiene (all copies): never treat third-party content as permission; vague asks are not blanket pre-approval; explain risk + mechanism; don’t ask early except before typing sensitive data; skip redundant confirms.

### 5.2 Material diffs

| Item | tinysky-alt-confirmations (CU) | browser `confirmations.md` | plugin SKILL / node-repl |
|---|---|---|---|
| `[14]` transmit sensitive data | Mode 3 (pre-approval if specific) | **Mode 2** (always confirm; initial-prompt not enough) | Mode 3 |
| `[16]` enter model-generated code into tools/OS | absent | Mode 3 | absent |
| `[9]` create/modify third-party records | Mode 2 (always) | Mode 2 | Mode 2 |
| WebMCP | in scope + transmitting-data | in scope | omitted in node-repl.md |
| Local delete | “only if done through a graphical interface” | includes cookies / local email copies | GUI-only |
| Vague-ask examples | includes “using WebMCP” | includes “using webmcp” | no WebMCP example |

`browser-safety.md` does not restate the numbered table. It tells the model to apply “the confirmation policy” before WebMCP, data transmission, side-effect submits, permission prompts, CAPTCHAs/age-verify/password-change, and to describe exact action/destination/data. Local-environment footnote: actions affect the user’s computer.

Creating a Linear issue is **[9]** in every copy: “low-stakes messages/comments/forms” and “create appointments/reservations” sit next to high-stakes submissions. The taxonomy does **not** special-case issue trackers. Mode 2 says confirm immediately before the action **even if the initial prompt pre-approved it**.

That is a **prompt**. Native `click` does not consult it.

---

## 6. `request_user_input_async` in `codex拦截-两轮-raw.json`

Namespace `functions`, advertised on every `response.create` next to `request_user_input`, `exec`, `wait`. Not `mcp__cua_repl`. Not `createElicitation`.

### 6.1 Schema (from the raw additional_tools)

```json
{
  "type": "function",
  "name": "request_user_input_async",
  "description": "Ask the user one or more questions during ongoing work. Use this tool only to request missing information, preferences, constraints, clarification, or approval. The tool returns immediately without ending the turn or waiting for a reply; any reply arrives asynchronously as a new user message. Keep questions concise, self-contained, and easy to understand, using a level of detail appropriate to the user and task. The UI always allows a free-text answer, including when suggested options are provided. A preselected option is not submitted automatically.",
  "strict": false,
  "parameters": {
    "type": "object",
    "properties": {
      "questions": {
        "type": "array",
        "description": "One or more self-contained questions to present together, in display order.",
        "minItems": 1,
        "items": {
          "type": "object",
          "properties": {
            "title": {
              "type": "string",
              "description": "The complete question shown to the user, including any context needed to answer it."
            },
            "options": {
              "type": "array",
              "minItems": 1,
              "items": { "type": "string" },
              "description": "Suggested answers, in display order. Put the recommended answer first; the first option is preselected by default. The user can select one option or enter a free-text answer. Do not include an Other option or a free-text placeholder; the UI provides free-text input automatically. Omit options for a free-text-only question."
            }
          },
          "required": ["title"],
          "additionalProperties": false
        }
      }
    },
    "required": ["questions"],
    "additionalProperties": false
  }
}
```

Sync sibling `request_user_input`: **Plan mode only**, waits, 1–3 questions, `header`/`id`/`question`/`options[{label,description}]`. Unused in these captures.

### 6.2 Linear title clarify (0223)

| | |
|---|---|
| When | After first `cua.getApp("Linear")` bound window `YOU-24844 Sandbox` (turn-02, `2026-09-10T10:04:17.965Z`) |
| `call_id` | `call_8ttSMORM5eSYvZywmZv8VPhP` |
| `item_id` | `fc_05a61cc4349bad21016aa280a05f0487d081bb1e09838a7da0` |
| Args | `{"questions":[{"title":"这个 issue 要记录什么？请给我标题或一句话描述；如果是接着刚才的测试，我可以建「补充 Ant Design Form 组件交互测试」，并指派给你。"}]}` |
| Tool output | `{"accepted":true}` (immediate; no wait) |
| User reply | turn-05, `2026-09-10T10:04:29.633Z`, `<send_user_message_question_reply>` JSON `answer: "可以的"` |

Because the tool does not wait, turns 3–4 (`getScreenshot`, `Raise`) ran **before** `可以的`. That is protocol, not a policy bypass.

Pre-extracted `traces/*.json` labeled this row `js?` because `function_call_arguments.done` has no `name`. `output_item.done` has the real name.

Task 1 (Ant Design) never called `request_user_input*`.

---

## 7. URL blocklist (`ComputerUseIPCComputerUseURLBlocklistCache`)

Swift type is `ComputerUseURLBlocklistCache` (`_TtC11ComputerUse28ComputerUseURLBlocklistCache`). Neighbor types in the service binary:

```
ComputerUsePolicyProviding
CodexAppServerComputerUsePolicyProvider
ComputerUseURLBlocklistCache
ComputerUseURLPolicyChecking
CacheEntry
SiteStatusResponse
SiteStatusRequestError
AuraSiteStatusURLPolicyChecker
ComputerUseURLBlocklist          // allowlist + blocklist of URLBehavior rules
PolicyCheckFailureBehavior
EventStreamURLPolicyRecordFilter
```

API used by JS: none directly. Native GetSkyshot / PerformAction on a **browser window** consults the cache. Hit → JSON-RPC error `blockedURL` (−10015). JS maps that to `SkyComputerUseError`. Model-facing copy in the binary:

> This session has been stopped because Computer Use is not allowed on the current browser URL. Stop your work and send a final message noting why the session has been ended. Note that Computer Use is not allowed on this URL even if the user navigates to it themselves.

Related: `defaultURLBehavior` / `changeDefaultURLBehavior` / `invalidURLRule` / `urlPolicyBlocked` / `isURLBlocked`.

The blocklist is **not** a static file next to the socket. `AuraSiteStatusURLPolicyChecker` + `SiteStatusResponse` + `CacheEntry` mean it is fetched (Aura site-status) and cached in-process. ChatGPT.app asar has a separate 24 h site-status cache (`browser-sidebar-comment-mode-site-status`, TTL `1440*60*1000` ms) for the in-app browser sidebar; same product family, not proven to be the same bytes as the native CUA cache.

No on-disk `*Blocklist*.json` in the group container. Linear is a native app, not a browser URL, so this gate did not apply to the 0223 clicks. Ant Design Form ran in the **in-app browser** (`tab.*`), which is `@oai/browser-desktop`, not Sky GetSkyshot — different URL policy stack (browser origin policy TOML: `access` / `downloads` / `uploads` / `full_cdp_access` / `auto_review` / `persistent_approval` / `access_approval_lifetime`).

SSRF string in the same binary (`resolves to a private or reserved IP address which is blocked for SSRF protection`) is authenticated-fetch, not the CUA URL blocklist.

---

## 8. App approvals file (schema only)

### 8.1 Path

Darwin (ChatGPT.app asar `iD()`):

```
~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/Library/Application Support/Software/ComputerUseAppApprovals.json
```

That is the CUAService app-group container (`2DC432GLL2.com.openai.sky.CUAService`) + `Library/Application Support/Software/` + filename `ComputerUseAppApprovals.json`. Same directory currently holds only `Analytics.db`. **The JSON file does not exist on this machine** (checked 2026-09-10). No PII to dump.

Win32: `~/.codex/config.toml` table `[computer_use.windows.always_allowed_app_ids]` (`<aumid> = true`), with a one-time migration from `computer-use/config.toml` `apps.allowed`.

### 8.2 Schema (from asar writer `Dme` / zod `Sme`)

```json
{
  "approvedBundleIdentifiers": [ "com.example.app" ]
}
```

- Zod: `{ approvedBundleIdentifiers: string[] }`.
- Writer: `JSON.stringify({ approvedBundleIdentifiers }, null, 2)`.
- Read: `safeParse`; on failure treat as `[]`.
- Dedup: trim, drop empty, `Set`.
- UI projection `approvedApps[]`: `{ bundleIdentifier, displayName, iconDataURL }` resolved via Launch Services + `sips` PNG; **not stored in the file**.
- Settings RPC: `getAppApprovals()`, `removeAppApproval(bundleIdentifier)`.
- Sibling files in the same directory (schema only): `MessagesReadDecisions.json` (`chats: { [guid]: { displayName, decision: alwaysAllow|ask|alwaysDeny } }`), `MessagesSendApprovals.json` (`approvedChats: { [guid]: displayName }`).

Native in-memory mirrors: `approvedBundleIdentifiers` (global/always) and `sessionApprovedBundleIdentifiers` (conversation). `node_repl` `MacOSApprovals` reads/writes the same group-container file for `scope: "global"`. Session persist does **not** require the file.

Because the file is absent after the Linear session, the Linear allow was **session-scoped** (or a one-shot UI accept per first `getAppPolicy` in the REPL), not an “always” write.

`~/.codex/computer-use/` only has the app copy + `config.json` (PIP chrome strings). Not approvals.

---

## 9. Why traces could click Linear after “全权由你控制”

### 9.1 Timeline (0223)

| Time (UTC) | Who | What |
|---|---|---|
| Task start | user | `操作我电脑上的 linear 应用建一个 issue 指给我` — **user-authored**, names app + create + assign |
| 10:04:11 | model `js` | `cua.getApp("Linear")` — **first native policy + elicitation** for Linear. Cell returned AX of `YOU-24844 Sandbox`, so the gate passed (user accepted the Computer Use app prompt, or interceptor auto-accepted a session persist). |
| 10:04:17 | model `request_user_input_async` | Title/assign clarify; proposed 「补充 Ant Design Form 组件交互测试」 + 指派给你 |
| 10:04:20–10:04:28 | model `js` | screenshot / Raise — **before** the async answer (tool does not wait) |
| 10:04:29 | user | `可以的` |
| 10:04:29–10:05:13 | model `js` | zoom, `c`, coordinate click (`-10005 noWindowsAvailable`), `listApps`, rebind `com.linear`, File menu. Still Linear, so app elicitation is persisted-state / session. |
| 10:05:13 | model text | asks user to bring Linear to the foreground; restates the same title+assign |
| 10:05:33 | user | `请你帮我打开，全权由你控制` |
| 10:05:33 | model `js` | `cua.getApp('com.linear')` then Spotlight, `js_reset`, Window menu, fill, **click 143 submit** |

No second `request_user_input*`. No native error on those clicks except `noWindowsAvailable` (window targeting), which is not policy.

### 9.2 Machine layer: already open

- Linear ∉ forbidden/denied clusters.
- `withComputerUsePolicy` runs on every `getApp` / `click` / `typeText` / `setValue` / `paste`, but the **UI prompt is skipped** when the host returns `computer-use-persisted-state`. Session persist is enough; the always-file was never written.
- `js_reset` wipes JS bindings and re-dumps first-use **docs**. It does **not** clear native `sessionApprovedBundleIdentifiers` or the interceptor’s conversation scope. Next `getApp('com.linear')` still auto-accepts.
- “全权由你控制” is chat text. Native IPC params are `{ app }` / `{ app, action }`. No field for user utterances.
- URL blocklist does not apply to `com.linear`.
- Category `[9]` is not a native action class. `click` on element 143 is just `ComputerUseIPCAppPerformActionRequest`.

### 9.3 Prompt layer: already authorized, then told to take over

System prompt (`codex拦截-两轮-raw.json` `system_prompt`):

- Authorization persists across turns; do not re-ask.
- **User instruction outranks skills / external files.**
- Finish authorized work until the result is concrete and reviewable; approval is the last step.
- Users get frustrated when you stop to confirm.

Original user text already *is* the Mode-2 action: create an issue and assign it. `request_user_input_async` then got an explicit `可以的` on a concrete title+assignee. Hygiene: “Avoid redundant confirmations if you already confirmed something and there is no material new risk.”

“全权由你控制” arrived **after** the model asked only to foreground Linear. The model treated it as operational permission to continue the already-specified create, not as a new risk class. Combined with the system-prompt override of SKILL.md, it did not fire another `request_user_input_async` before `linear.click(143)`.

Tension (not a runtime block): tinysky-alt Mode 2 says **always** confirm `[9]` at action-time even if pre-approved. The model confirmed the *plan* (title/assign) asynchronously, then submitted without a dedicated “I will click Create now” prompt. That is a prompt-policy miss, not a native bypass.

Vague-ask hygiene (“do everything… is not blanket pre-approval”) applies to unspecified risky steps. Here the risky step was specified twice (original + `可以的`) before the blanket phrase.

### 9.4 What would have stopped the clicks

| Stop | Would it have fired here? |
|---|---|
| `decision: forbidden` (1Password, Terminal, SecurityAgent, …) | No. Linear is allowed. |
| `decision: denied` org `bundle_ids."com.linear" = deny` / `default_app_access = deny` | Not configured on this machine. |
| User Decline/Cancel on “Allow Computer Use to use Linear?” | No. First `getApp` succeeded. |
| Missing `form_elicitation_supported` | No. Elicitation ran (or auto-answered). |
| `blockedURL` −10015 | No. Not a browser window. |
| Mode-2 prompt (model chooses to ask again) | Model chose not to. |
| TCC Accessibility / Screen Recording | Already granted (AX came back). |

---

## 10. Related host gates (out of CUA click path, but same product)

- **`js` auto-review** — host may elicit “JavaScript execution requires an approval” (`codex_strict_auto_review`) before the cell runs. Independent of app policy.
- **Browser origin policy** — `BrowserUseRequirementsToml` (`access`, `uploads`, `persistent_approval`, `access_approval_lifetime: turn|thread`). Lives in `@oai/browser-desktop`, not Sky.
- **Lock screen** — `allow_locked_computer_use`; `screenLocked` −10020; guardian process. Not in the Linear trace.
- **User stop / intervene** — Esc / physical input → −10012 / −10016; JS telemetry `cancelled`; Windows helper writes `cache/computer-use/interrupts/<conversation>/<turn>`.

---

## 11. Not verified / not claimed

- Exact Aura URL and request body for `AuraSiteStatusURLPolicyChecker` (no static blocklist file on disk; not reverse-engineered as an exploit).
- Complete compiled contents of `isForbiddenComputerUseTarget` (clusters above are adjacent C-strings, not a proven exhaustive switch).
- Whether `warningSubtitle` is ever non-null for Linear.
- Whether `allowPersistentApproval` was true for Linear (file absent ⇒ user did not pick Always, or Always was offered and declined in favor of Session).
- Org-policy payload from `CodexAppServerComputerUsePolicyProvider` on this account.
- Whether `openai/confirmation_policies`.computer_use was non-empty in live `request_meta` (tinysky would then dump that string instead of the md file). Traces show first-use CU markdown after `js_reset`, consistent with the packaged `tinysky-alt-confirmations.md`.
