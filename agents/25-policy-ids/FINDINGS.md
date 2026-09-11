# FINDINGS — sampled Computer Use allow/deny/forbidden bundle IDs

**This is NOT a complete allow / deny / forbidden table.**  
`isForbiddenComputerUseTarget` and org `denied` live in compiled Swift. This pass only samples C-strings, Swift type names, and adjacency in `SkyComputerUseService`. It does **not** prove which `ComputerUseIPCAppPolicyDecision` (`allowed` | `denied` | `forbidden`) a given bundle actually gets.

Local disk only. No disassembly of the classifier, no live `getAppPolicy` IPC, no TCC.db.

Catalog: [`../../native/policy-bundle-ids.md`](../../native/policy-bundle-ids.md)  
Earlier short sample: [`../../native/forbidden-bundle-id-samples.txt`](../../native/forbidden-bundle-id-samples.txt)

---

## Verdict

`SkyComputerUseService` (26.902.1000968, SHA-256 `905939bff849b072da68e8e23e97188ed7bf93173646ac1bd9f7b54f9a89ce35`) ships a `BundleIdentifiers` enum with **named clusters**:

| Swift case / member | Shape | Role (from name + neighbors, not from a decompiled switch) |
|---|---|---|
| `chromiumBrowser` | `[String]` | Chromium-family browsers |
| `computerUseHost` | `[String]` | Host apps that run Computer Use |
| `iPhoneMirroring.Identifier` | `String` | `com.apple.ScreenContinuity` |
| `elevatedRisk` | `[String]` | Password managers |
| `chatGPTBundle` | `[String]` | ChatGPT / Codex desktop variants |
| `systemSecurity` | `[String]` | SecurityAgent / LocalAuthentication / UNC |
| `finder.Identifier` | `String` | `com.apple.finder` |
| `browser` | `[String]` | Safari / Atlas / other browsers |
| `terminal` | `[String]` | Terminal emulators |

Helpers on the same type:

- `isForbiddenComputerUseTarget(_: String) -> Bool`
- `allowsForbiddenComputerUseTargets: Bool`
- `allowForbiddenComputerUseTargetsUserDefaultsKey: String` → **`ComputerUseAllowForbiddenTargets`**

The longest contiguous reverse-DNS run in `__cstring` is **42 bundle IDs** at `0x10a1e20`–`0x10a2360`. Product-category tags below are **sampled labels**, not proven `decision` values.

`com.google.Chrome` is **not** in that run. JS special-cases it as the Computer Use Chrome path (`codex/computerUseChrome`). Chromium detection also uses `NSPrincipalClass` / `BrowserCrApplication`, `isChromiumApp`, `isElectronApp`, and `isChromiumBrowserWindow(bundleIdentifier:title:)`.

A live Linear policy result (agent 10) was `decision: allowed`, `risk: high`, `warningSubtitle: null`, `allowPersistentApproval: true`. So **`high` is not unique to password managers**, and the prompt-injection sentence is not proven to fire for every `high` target.

---

## 0. Method / sources

| Item | Path |
|---|---|
| Clicker binary | `$HOME/.codex/computer-use/Codex Computer Use.app/Contents/MacOS/SkyComputerUseService` |
| Size / hash | 23 104 320 bytes, SHA-256 `905939bff849b072…` |
| JS policy wrap | `agents/02-sky-native/d.ts/targets/mac/client.d.ts` (`MacAppPolicyResult`) + agent 16 |
| Org TOML | `vendor/openai-codex/codex-rs_config_src/browser_computer_use_requirements.rs` |
| Prior samples | `native/forbidden-bundle-id-samples.txt`, `UNREVERSED.md`, `agents/{02,07,16}/FINDINGS.md` |

Extraction: printable C-strings with file offsets; Swift mangled names around `BundleIdentifiersO`; neighbor windows of ±8 strings. UTF-16LE scan added no extra reverse-DNS IDs.

**What adjacency is not.** Two IDs 32 bytes apart may share a static `[String]` **or** just sit in the same `__cstring` page. Tags are therefore `sampled category`, with a confidence letter.

---

## 1. Policy IPC (JS contract)

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

Swift names in the binary match:

- `ComputerUseIPCAppPolicyRequest` / `Result` / `Decision`
- `ComputerUseIPCTargetDescriptor` / `ComputerUseIPCTargetRisk`
- Constructor fragment: `displayName:appPath:risk:warningSubtitle:`
- Result fragment: `target:allowPersistentApproval:`

JSON coding keys (contiguous at `0x114fac1` and again at `0x10c3ea4`):

```
allowed  denied  forbidden  low  high  risk  warningSubtitle  decision  target  allowPersistentApproval
```

JS mapping (`computer-use-policy.js`):

| `decision` | JS throw (no elicitation) |
|---|---|
| `allowed` | elicit “Allow Computer Use to use "{displayName}"?” |
| `denied` | `Computer Use is blocked from using the app '${bundleIdentifier}' by your organization's policy.` |
| `forbidden` | `Computer Use is not allowed to use the app '${bundleIdentifier}' for safety reasons.` |

`persist` is `["session","always"]` iff `allowPersistentApproval`, else `["session"]` only. `meta.riskLevel` = `target.risk`. `meta.subtitle` = `warningSubtitle` when non-null.

Org/config layer (native `CodexAppServerComputerUsePolicyProvider` field names):

```
configRequirements/read
featureRequirements
allowBrowserAndComputerUse
allowComputerUse
allowPersistentApproval
defaultAppAccess          // coding keys: allow | deny
default_app_access        // snake_case wire/TOML
macos / configuredMacOS
bundleIDs
```

Rust TOML sibling (`ComputerUseRequirementsToml`): `allow_locked_computer_use`, `allow_persistent_approval`, `default_app_access`, `[computer_use.macos.bundle_ids]`.

A second action-time error is **not** the JS `forbidden` string:

```
Computer use actions are not allowed for system security process: 
systemSecurityTargetNotAllowed
```

So system-security apps may fail inside `PerformAction` even if a caller somehow skipped the policy RPC.

---

## 2. `ComputerUseAllowForbiddenTargets`

| Offset | String |
|---|---|
| `0x10a37a0` | `ComputerUseAllowForbiddenTargets` |
| `0x14f1f5f` | `isForbiddenComputerUseTargetySbSSFZ` → `isForbiddenComputerUseTarget(_:)` |
| `0x14f1f88` | `allowsForbiddenComputerUseTargetsSbv` |
| `0x14f1fb2` | `allowForbiddenComputerUseTargetsUserDefaultsKeySSv` |

Immediate `__cstring` neighbors of the user-default key:

```
CFBundleURLTypes
CFBundleURLSchemes
NSPrincipalClass
BrowserCrApplication
ComputerUseAllowForbiddenTargets
com.apple.finder
```

`finder.Identifier` is a **singular** `String`, not `[String]`. Finder is the only ID glued to the override key.

`@oai/sky` `publishConfig` lists `bin/mac/normal/` and `bin/mac/relaxed/`. This ChatGPT tree ships one unlabeled app. The user-default name is the relaxed-looking override: if `allowsForbiddenComputerUseTargets` is true, `isForbiddenComputerUseTarget` can return false for otherwise-listed targets. **Which clusters the Bool actually ignores is compiled.**

`JS_NORMAL` in this binary is a **protobuf `jstype` enum** (`JS_NORMAL` / `JS_STRING` / `JS_NUMBER`), not the mac build flavor. There is no `JS_RELAXED` string.

---

## 3. `risk` / `warningSubtitle` / `allowPersistentApproval`

### 3.1 Risk

`ComputerUseIPCTargetRisk` raw values are the coding keys **`low`** and **`high`**.

JS copies `target.risk` to elicitation `meta.riskLevel`. Audio start **hard-codes** `riskLevel: "high"` and `persist: ["session"]` (never `always`) in JS, bypassing app policy.

The only live native result on this machine (Linear, agent 10):

```json
{
  "allowPersistentApproval": true,
  "decision": "allowed",
  "target": {
    "appPath": "/Applications/Linear.app",
    "bundleIdentifier": "com.linear",
    "displayName": "Linear",
    "risk": "high",
    "warningSubtitle": null
  }
}
```

`com.linear` is **not** in any sampled cluster. Therefore default risk for ordinary apps can be `high`. Mapping from `elevatedRisk` / `terminal` / `browser` → `high` vs `low` is **not** recovered.

### 3.2 `warningSubtitle`

IPC field: `ComputerUseIPCTargetDescriptor.warningSubtitle: String?`.

The only user-facing sentence in the binary that matches a policy subtitle (offset `0x109e240`, immediately before “Computer Use is disabled by your configuration.”):

> Allowing ChatGPT to use this app introduces new risks, including those related to prompt injection attacks, such as data theft or loss. Carefully monitor ChatGPT while it uses this app.

Linear’s `warningSubtitle` was `null`, so this sentence is **not** attached to every `high` target. Whether it is the subtitle for `elevatedRisk` / terminals / browsers is compiled.

### 3.3 `allowPersistentApproval`

Native `ComputerUseIPCAppPolicyResult.allowPersistentApproval: Bool`.

Provider fields next to it: `allowBrowserAndComputerUse`, `allowComputerUse`, `defaultAppAccess`, `bundleIDs`.

Related strings (MCP client path, not the JS socket wrap):

```
Computer Use could not persist the approval permanently for app '
Computer Use permission request canceled for app '
Computer Use approval denied via MCP elicitation for app '
```

In-memory / on-disk approval names:

```
approvedBundleIdentifiers
sessionApprovedBundleIdentifiers
persistentApprovals
persistentApprovalsModificationDate
```

On-disk always-file (ChatGPT asar, not native):  
`~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/Library/Application Support/Software/ComputerUseAppApprovals.json`  
schema `{ "approvedBundleIdentifiers": string[] }`. **Absent on this machine.**

Criteria (org `allow_persistent_approval` AND/OR per-app risk AND/OR MDM) are compiled. Linear got `true`. JS does not re-check the boolean after the interceptor returns `computer-use-persisted-state`.

---

## 4. Primary `__cstring` run (`0x10a1e20`)

42 IDs, then localized **Private Browsing** title fragments (`PrivateBrowsingIndicators`), then AXError names, then the Finder / override block.

Order in the file (product-category tag in parentheses):

1. `com.apple.ScreenContinuity` — finder/system-ui (`iPhoneMirroring`)
2. eight password managers — password-manager (`elevatedRisk`)
3. eight terminals — terminal
4. nine ChatGPT/Codex variants — openai-self (`chatGPTBundle`; **stable `com.openai.chat` is missing here**)
5. `com.apple.Safari` then Atlas variants then other browsers — browser / openai-self
6. `org.chromium.Chromium` ends the browser run
7. `com.apple.UserNotificationCenter`, `com.apple.LocalAuthenticationRemoteService`, `com.apple.SecurityAgent` — security-process cluster (`systemSecurity`)

Exact rows: [`../../native/policy-bundle-ids.md`](../../native/policy-bundle-ids.md) §1.

Safari Technology Preview / Firefox / Nightly / DuckDuckGo are **not** in this run. They sit later next to the `ambiguousApp` (−10018) copy.

---

## 5. Other sampled IDs (not the primary run)

| Neighborhood | IDs | Tag | Why it may not be `isForbidden` |
|---|---|---|---|
| `exclude_application` / URL-policy verbs `0x1099f50` | WindowManager, controlcenter, notificationcenterui, LocalAuthentication.UIAgent | finder/system-ui + security-process | Could be event-stream default excludes, not the app-policy table |
| After IPC `abandoned` `0x109a190` | `inc.software.{app,development.app}`, `com.openai.sky.{app,development.app}` | openai-self | `skyBundleIdentifiers` / sender host allowlist |
| `AppUsageCatalog` | `inc.software.unknown` | unknown | Spotlight sentinel, not a real app |
| After `ambiguousApp` copy `0x10a3970` | SafariTechnologyPreview, firefox, nightly, duckduckgo.macos.browser | browser | May be extra browsers **or** apps that commonly collide |
| `0x1360970` (noisy `__const`) | `org.alacritty`, `co.zeit.hyper`, `org.tabby`, `com.openai.chat` | terminal / openai-self | Not adjacent to `BundleIdentifiers` strings |
| Swift Algorithms `0x10aec90` | `com.kishanbagaria.jack` | unknown | Wrong neighborhood for a policy array |
| Permission UI | `com.google.Chrome` | browser | Intended CU browser; Chrome extension copy |
| SlimCore Settings | `com.apple.systempreferences`, Settings extension IDs | finder/system-ui | Opens Privacy panes; not proven forbidden |
| Codesign / CLI `0x13563f0` | `com.apple.dock` | finder/system-ui | Not next to policy types |
| AppInstructions / AX | Slack, Spotify, Excel, OmniFocus, VoiceOver, MobileSMS, AddressBook | unknown | Feature hints, not policy |

Sender-looking OpenAI IDs also appear as `com.openai.codex{,.alpha,.beta,.dev,.nightly}`, `com.openai.chat{,.alpha,.beta,.nightly,.mac-debug}`, `com.openai.atlas{,.alpha,.beta}` (agent 07). That list is **who may talk to the service**, overlapping but not identical to the CUA **target** table (stable `com.openai.chat` is in the sender list and at `0x1360aa0`, not in the 42-ID run).

---

## 6. Human-readable policy strings (complete set sampled)

```
Computer use actions are not allowed for system security process: 
Computer Use is disabled by your configuration.
Allowing ChatGPT to use this app introduces new risks, including those related to prompt injection attacks, such as data theft or loss. Carefully monitor ChatGPT while it uses this app.
Computer Use is not allowed to use the app '
' for safety reasons.
Computer Use is blocked from using the app '
' by your organization's policy.
Computer Use approval denied via MCP elicitation for app '
Computer Use permission request canceled for app '
Computer Use could not persist the approval permanently for app '
Computer Use stopped due to encountering a disallowed URL: 
This session has been stopped because Computer Use is not allowed on the current browser URL. …
```

URL policy is a **different** gate (`ComputerUseURLBlocklist` / `isURLBlocked` / `blockedURL` −10015 / `AuraSiteStatusURLPolicyChecker`). Not a bundle-id table.

Statsig key `ax_prefetch_disabled_bundle_ids` sits next to `ax_prefetch_enabled`. Values are not a static C-string list.

---

## 7. Not claimed / still compiled

- Exhaustive contents of any `BundleIdentifiers` array (more IDs can live as computed values, prefixes, or Statsig).
- Which clusters `isForbiddenComputerUseTarget` unions, and whether `ComputerUseAllowForbiddenTargets` bypasses all of them or only Finder.
- `decision` for any ID except the Linear live sample (`allowed`).
- `risk` assignment table (`high`/`low`) and when `warningSubtitle` is non-null.
- AND/OR tree for `allowPersistentApproval`.
- Whether STP/Firefox/DuckDuckGo are forbidden browsers or `ambiguousApp` fixtures.
- Whether WindowManager / Control Center are `systemSecurity` or capture excludes.
- Org `bundle_ids` payload for this account (`CodexAppServerComputerUsePolicyProvider.cachedPolicy`).

Do not treat [`../../native/policy-bundle-ids.md`](../../native/policy-bundle-ids.md) as an allowlist or a denylist.
