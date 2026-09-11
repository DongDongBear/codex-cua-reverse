# Sampled Computer Use bundle IDs (SkyComputerUseService strings)

**This is NOT a complete allow / deny / forbidden table.**

Classification (`allowed` vs org `denied` vs safety `forbidden` vs action-time `systemSecurityTargetNotAllowed`) is compiled Swift. Rows are reverse-DNS strings found in:

```
$HOME/.codex/computer-use/Codex Computer Use.app/Contents/MacOS/SkyComputerUseService
```

version **26.902.1000968**, SHA-256 `905939bff849b072da68e8e23e97188ed7bf93173646ac1bd9f7b54f9a89ce35`.

Category is a **sampled label** from adjacency + `BundleIdentifiers` type names, one of:

`security-process cluster` | `password-manager` | `browser` | `terminal` | `openai-self` | `finder/system-ui` | `unknown`

Offsets are file offsets of the C-string. Confidence:

| | Meaning |
|---|---|
| **A** | Inside the 42-ID primary run at `0x10a1e20`–`0x10a2360` |
| **B** | Glued to `ComputerUseAllowForbiddenTargets` |
| **C** | After `ambiguousApp` copy (may be extra browsers **or** collision examples) |
| **D** | Next to URL-policy `include_application` / `exclude_application` |
| **E** | `skyBundleIdentifiers` / sender-looking host IDs |
| **F** | Isolated or clearly another feature (AX hint, Settings opener, codesign) |

Write-up: [`../agents/25-policy-ids/FINDINGS.md`](../agents/25-policy-ids/FINDINGS.md).  
Earlier 29-ID dump: [`forbidden-bundle-id-samples.txt`](forbidden-bundle-id-samples.txt).

Local disk only.

---

## 1. Primary run (confidence A)

Contiguous `__cstring` starting at `com.apple.ScreenContinuity`. Then localized Private Browsing titles, not more bundle IDs.

| offset | bundle id | sampled category | Swift neighborhood |
|---|---|---|---|
| `0x10a1e20` | `com.apple.ScreenContinuity` | finder/system-ui | `iPhoneMirroring.Identifier` (iPhone Mirroring) |
| `0x10a1e40` | `com.1password.1password` | password-manager | `elevatedRisk` |
| `0x10a1e60` | `com.1password.safari` | password-manager | `elevatedRisk` |
| `0x10a1e80` | `com.bitwarden.desktop` | password-manager | `elevatedRisk` |
| `0x10a1ea0` | `com.dashlane.dashlanephonefinal` | password-manager | `elevatedRisk` |
| `0x10a1ec0` | `com.lastpass.LastPass` | password-manager | `elevatedRisk` |
| `0x10a1ee0` | `com.nordsec.nordpass` | password-manager | `elevatedRisk` |
| `0x10a1f00` | `me.proton.pass.electron` | password-manager | `elevatedRisk` |
| `0x10a1f20` | `me.proton.pass.catalyst` | password-manager | `elevatedRisk` |
| `0x10a1f40` | `com.apple.Terminal` | terminal | `terminal` |
| `0x10a1f60` | `com.googlecode.iterm2` | terminal | `terminal` |
| `0x10a1f80` | `dev.warp.Warp-Stable` | terminal | `terminal` |
| `0x10a1fa0` | `net.kovidgoyal.kitty` | terminal | `terminal` |
| `0x10a1fc0` | `com.github.wez.wezterm` | terminal | `terminal` |
| `0x10a1fe0` | `com.mitchellh.ghostty` | terminal | `terminal` |
| `0x10a2000` | `com.raphaelamorim.rio` | terminal | `terminal` |
| `0x10a2020` | `dev.commandline.waveterm` | terminal | `terminal` |
| `0x10a2040` | `com.openai.codex` | openai-self | `chatGPTBundle` |
| `0x10a2060` | `com.openai.codex.alpha` | openai-self | `chatGPTBundle` |
| `0x10a2080` | `com.openai.codex.beta` | openai-self | `chatGPTBundle` |
| `0x10a20a0` | `com.openai.codex.dev` | openai-self | `chatGPTBundle` |
| `0x10a20c0` | `com.openai.codex.nightly` | openai-self | `chatGPTBundle` |
| `0x10a20e0` | `com.openai.chat.alpha` | openai-self | `chatGPTBundle` (stable `com.openai.chat` **not** in this run) |
| `0x10a2100` | `com.openai.chat.beta` | openai-self | `chatGPTBundle` |
| `0x10a2120` | `com.openai.chat.nightly` | openai-self | `chatGPTBundle` |
| `0x10a2140` | `com.openai.chat.mac-debug` | openai-self | `chatGPTBundle` |
| `0x10a2160` | `com.apple.Safari` | browser | `browser` |
| `0x10a2180` | `com.openai.atlas` | openai-self | in the browser run (Atlas is an OpenAI browser) |
| `0x10a21a0` | `com.openai.atlas.alpha` | openai-self | browser run |
| `0x10a21c0` | `com.openai.atlas.beta` | openai-self | browser run |
| `0x10a21e0` | `ai.perplexity.comet` | browser | `browser` / `chromiumBrowser` |
| `0x10a2200` | `com.brave.Browser` | browser | |
| `0x10a2220` | `com.microsoft.edgemac` | browser | |
| `0x10a2240` | `com.operasoftware.Opera` | browser | |
| `0x10a2260` | `com.vivaldi.Vivaldi` | browser | |
| `0x10a2280` | `company.thebrowser.Browser` | browser | Arc |
| `0x10a22a0` | `company.thebrowser.browser` | browser | Arc (alt capitalization) |
| `0x10a22c0` | `company.thebrowser.dia` | browser | Dia |
| `0x10a22e0` | `org.chromium.Chromium` | browser | ends the browser run |
| `0x10a2300` | `com.apple.UserNotificationCenter` | security-process cluster | `systemSecurity` |
| `0x10a2330` | `com.apple.LocalAuthenticationRemoteService` | security-process cluster | `systemSecurity` |
| `0x10a2360` | `com.apple.SecurityAgent` | security-process cluster | `systemSecurity` |

`com.google.Chrome` is **absent** here. Chromium apps can also be detected via `NSPrincipalClass` = `BrowserCrApplication`.

---

## 2. Finder + `ComputerUseAllowForbiddenTargets` (confidence B)

```
0x10a3720  CFBundleURLTypes
0x10a3740  CFBundleURLSchemes
0x10a3760  NSPrincipalClass
0x10a3780  BrowserCrApplication
0x10a37a0  ComputerUseAllowForbiddenTargets
0x10a37d0  com.apple.finder
```

| offset | bundle id | sampled category | note |
|---|---|---|---|
| `0x10a37d0` | `com.apple.finder` | finder/system-ui | Swift `finder.Identifier` (singular). User-default key `ComputerUseAllowForbiddenTargets` is the string immediately before it. |

---

## 3. After `ambiguousApp` copy (confidence C)

```
Ambiguous app identifier '
'. Multiple apps share this bundle identifier: 
. Use an app name or full app path instead.
com.apple.SafariTechnologyPreview
org.mozilla.firefox
org.mozilla.nightly
com.duckduckgo.macos.browser
```

| offset | bundle id | sampled category | note |
|---|---|---|---|
| `0x10a3970` | `com.apple.SafariTechnologyPreview` | browser | Not in the primary run. May be extra `browser` **or** −10018 example. |
| `0x10a39a0` | `org.mozilla.firefox` | browser | same |
| `0x10a39c0` | `org.mozilla.nightly` | browser | same |
| `0x10a39e0` | `com.duckduckgo.macos.browser` | browser | same |

---

## 4. URL-policy / system-chrome cluster (confidence D)

Neighbors: `change_default_application_behavior`, `include_application`, `exclude_application`, `include_url`, `exclude_url`.

| offset | bundle id | sampled category | note |
|---|---|---|---|
| `0x1099f50` | `com.apple.WindowManager` | finder/system-ui | May be capture/event-stream exclude, not `systemSecurity` |
| `0x1099f70` | `com.apple.controlcenter` | finder/system-ui | same |
| `0x1099f90` | `com.apple.notificationcenterui` | finder/system-ui | same |
| `0x1099fb0` | `com.apple.LocalAuthentication.UIAgent` | security-process cluster | Same four-ID run as WindowManager; LA UI is a security agent |

---

## 5. OpenAI / Sky host IDs (confidence E)

`skyBundleIdentifiers: [String]` in Swift metadata. Not the CUA target table.

| offset | bundle id | sampled category | note |
|---|---|---|---|
| `0x109a190` | `inc.software.app` | openai-self | Historical Sky production host |
| `0x109a1b0` | `inc.software.development.app` | openai-self | |
| `0x109a1d0` | `com.openai.sky.app` | openai-self | |
| `0x109a1f0` | `com.openai.sky.development.app` | openai-self | |
| `0x109a520` | `inc.software.unknown` | unknown | `AppUsageCatalog` sentinel next to the Spotlight predicate |
| `0x10c6500` | `com.openai.sky.CUAService` | openai-self | This service’s own bundle (also in entitlements / errors) |

Stable ChatGPT (`com.openai.chat`) is **not** in §1. It appears at `0x1360aa0` (see §6) and in the sender-allowlist notes (agent 07).

---

## 6. Secondary terminals + stable chat (confidence F)

Offsets `0x1360970`–`0x1360aa0` sit in a noisy region (neighbors are non-strings). Treat as extra samples, not a proven `terminal` array.

| offset | bundle id | sampled category | note |
|---|---|---|---|
| `0x1360970` | `org.alacritty` | terminal | Not in §1 |
| `0x13609a0` | `co.zeit.hyper` | terminal | |
| `0x13609c0` | `org.tabby` | terminal | |
| `0x1360aa0` | `com.openai.chat` | openai-self | Stable ChatGPT desktop; missing from §1 |
| `0x10aec90` | `com.kishanbagaria.jack` | unknown | Next to Swift Algorithms, not policy types. Jack is a terminal product; **do not** treat as a proven policy member. |

---

## 7. Other reverse-DNS strings (not policy lists)

These are in the binary and were in older notes. They are **not** adjacent to `BundleIdentifiers` / `isForbiddenComputerUseTarget`.

| offset | bundle id | sampled category | actual neighborhood |
|---|---|---|---|
| `0x1095eb0` | `com.google.Chrome` | browser | Permission-window / Chrome extension copy. JS sets `codex/computerUseChrome`. **Intended CU browser, not in §1.** |
| `0x10960b0` | `com.apple.MobileSMS` | unknown | Messages TCC copy |
| `0x1096170` | `com.apple.AddressBook` | unknown | Contacts TCC copy |
| `0x1097120` | `com.apple.settings.PrivacySecurity.extension` | finder/system-ui | Opens Privacy & Security |
| `0x109c3e0` | `com.tinyspeck.slackmacgap` | unknown | Slack AppInstructions / event-stream |
| `0x10a15c0` | `com.spotify.client` | unknown | Spotify AppInstructions |
| `0x10af380` | `com.apple.VoiceOver` | finder/system-ui | AX VoiceOver |
| `0x10af3a0` | `com.apple.universalaccess` | finder/system-ui | same |
| `0x10af420` | `com.microsoft.Excel` | unknown | Excel AX (`macos-mac-parity-spinner`) |
| `0x10d17c0` | `com.omnigroup.OmniFocus4` | unknown | Next to `Privacy_Automation` / Apple Events |
| `0x10d1960` | `com.apple.Notifications-Settings.extension` | finder/system-ui | System Settings deep link |
| `0x10d1a20` | `com.apple.Settings.extension.ui` | finder/system-ui | same |
| `0x10d25f0` | `com.apple.systempreferences` | finder/system-ui | SlimCore `SystemSettingsApp` (permission UI), **not** proven `isForbidden` |
| `0x10d3fb0` | `com.apple.wallpaper` | unknown | wallpaper capture |
| `0x13563f0` | `com.apple.dock` | finder/system-ui | Codesign / CLI neighborhood, **not** the policy run |

Not present as C-strings (sampled): Chrome Canary/Beta/Dev, KeePass/Keeper/Enpass/RoboForm, Orion, SigmaOS, Cool-Retro-Term, `loginwindow`, `tccd`, `WindowServer` as a bundle id.

`com.linear` is **not** in this binary. Live policy for Linear was `allowed` / `risk: high` / `warningSubtitle: null` / `allowPersistentApproval: true`.

---

## 8. Flat index (unique IDs tagged)

Sorted. Duplicates across sections keep the **stronger** confidence (A > B > C > D > E > F).

| bundle id | sampled category | conf | section |
|---|---|---|---|
| `ai.perplexity.comet` | browser | A | 1 |
| `co.zeit.hyper` | terminal | F | 6 |
| `com.1password.1password` | password-manager | A | 1 |
| `com.1password.safari` | password-manager | A | 1 |
| `com.apple.AddressBook` | unknown | F | 7 |
| `com.apple.LocalAuthentication.UIAgent` | security-process cluster | D | 4 |
| `com.apple.LocalAuthenticationRemoteService` | security-process cluster | A | 1 |
| `com.apple.MobileSMS` | unknown | F | 7 |
| `com.apple.Notifications-Settings.extension` | finder/system-ui | F | 7 |
| `com.apple.Safari` | browser | A | 1 |
| `com.apple.SafariTechnologyPreview` | browser | C | 3 |
| `com.apple.ScreenContinuity` | finder/system-ui | A | 1 |
| `com.apple.SecurityAgent` | security-process cluster | A | 1 |
| `com.apple.Settings.extension.ui` | finder/system-ui | F | 7 |
| `com.apple.Terminal` | terminal | A | 1 |
| `com.apple.UserNotificationCenter` | security-process cluster | A | 1 |
| `com.apple.VoiceOver` | finder/system-ui | F | 7 |
| `com.apple.WindowManager` | finder/system-ui | D | 4 |
| `com.apple.controlcenter` | finder/system-ui | D | 4 |
| `com.apple.dock` | finder/system-ui | F | 7 |
| `com.apple.finder` | finder/system-ui | B | 2 |
| `com.apple.notificationcenterui` | finder/system-ui | D | 4 |
| `com.apple.settings.PrivacySecurity.extension` | finder/system-ui | F | 7 |
| `com.apple.systempreferences` | finder/system-ui | F | 7 |
| `com.apple.universalaccess` | finder/system-ui | F | 7 |
| `com.apple.wallpaper` | unknown | F | 7 |
| `com.bitwarden.desktop` | password-manager | A | 1 |
| `com.brave.Browser` | browser | A | 1 |
| `com.dashlane.dashlanephonefinal` | password-manager | A | 1 |
| `com.duckduckgo.macos.browser` | browser | C | 3 |
| `com.github.wez.wezterm` | terminal | A | 1 |
| `com.google.Chrome` | browser | F | 7 (intended CU browser) |
| `com.googlecode.iterm2` | terminal | A | 1 |
| `com.kishanbagaria.jack` | unknown | F | 6 |
| `com.lastpass.LastPass` | password-manager | A | 1 |
| `com.microsoft.Excel` | unknown | F | 7 |
| `com.microsoft.edgemac` | browser | A | 1 |
| `com.mitchellh.ghostty` | terminal | A | 1 |
| `com.nordsec.nordpass` | password-manager | A | 1 |
| `com.omnigroup.OmniFocus4` | unknown | F | 7 |
| `com.openai.atlas` | openai-self | A | 1 |
| `com.openai.atlas.alpha` | openai-self | A | 1 |
| `com.openai.atlas.beta` | openai-self | A | 1 |
| `com.openai.chat` | openai-self | F | 6 |
| `com.openai.chat.alpha` | openai-self | A | 1 |
| `com.openai.chat.beta` | openai-self | A | 1 |
| `com.openai.chat.mac-debug` | openai-self | A | 1 |
| `com.openai.chat.nightly` | openai-self | A | 1 |
| `com.openai.codex` | openai-self | A | 1 |
| `com.openai.codex.alpha` | openai-self | A | 1 |
| `com.openai.codex.beta` | openai-self | A | 1 |
| `com.openai.codex.dev` | openai-self | A | 1 |
| `com.openai.codex.nightly` | openai-self | A | 1 |
| `com.openai.sky.CUAService` | openai-self | E | 5 |
| `com.openai.sky.app` | openai-self | E | 5 |
| `com.openai.sky.development.app` | openai-self | E | 5 |
| `com.operasoftware.Opera` | browser | A | 1 |
| `com.raphaelamorim.rio` | terminal | A | 1 |
| `com.spotify.client` | unknown | F | 7 |
| `com.tinyspeck.slackmacgap` | unknown | F | 7 |
| `com.vivaldi.Vivaldi` | browser | A | 1 |
| `company.thebrowser.Browser` | browser | A | 1 |
| `company.thebrowser.browser` | browser | A | 1 |
| `company.thebrowser.dia` | browser | A | 1 |
| `dev.commandline.waveterm` | terminal | A | 1 |
| `dev.warp.Warp-Stable` | terminal | A | 1 |
| `inc.software.app` | openai-self | E | 5 |
| `inc.software.development.app` | openai-self | E | 5 |
| `inc.software.unknown` | unknown | E | 5 |
| `me.proton.pass.catalyst` | password-manager | A | 1 |
| `me.proton.pass.electron` | password-manager | A | 1 |
| `net.kovidgoyal.kitty` | terminal | A | 1 |
| `org.alacritty` | terminal | F | 6 |
| `org.chromium.Chromium` | browser | A | 1 |
| `org.mozilla.firefox` | browser | C | 3 |
| `org.mozilla.nightly` | browser | C | 3 |
| `org.tabby` | terminal | F | 6 |

**Counts (this sample, not the compiled table):** 77 unique IDs. Primary run only: 42. Password-manager A: 8. Terminal A: 8. openai-self A: 12 (9 chat/codex + 3 atlas). Browser A: 10. security-process A: 3. finder/system-ui A: 1 (`ScreenContinuity`) + Finder B.

---

## 9. Policy-related strings (same binary)

### 9.1 Override / classifier

| offset | string |
|---|---|
| `0x10a37a0` | `ComputerUseAllowForbiddenTargets` |
| `0x14f1f5f` | `isForbiddenComputerUseTarget` (mangled `…ySbSSFZ`) |
| `0x14f1f88` | `allowsForbiddenComputerUseTargets` |
| `0x14f1fb2` | `allowForbiddenComputerUseTargetsUserDefaultsKey` |
| `0x14f20c6` | `BundleIdentifiers` |
| `0x14f1cfa` | `chromiumBrowser` (`[String]`) |
| `0x14f1d15` | `computerUseHost` (`[String]`) |
| `0x14f1d6e` | `iPhoneMirroring.Identifier` |
| `0x14f1d94` | `elevatedRisk` (`[String]`) |
| `0x14f1dae` | `chatGPTBundle` (`[String]`) |
| `0x14f1dc9` | `systemSecurity` (`[String]`) |
| `0x14f1e94` | `finder.Identifier` |
| `0x14f1eaf` | `browser` (`[String]`) |
| `0x14f1ec5` | `terminal` (`[String]`) |

### 9.2 Risk / subtitle / persist (IPC)

| offset | string |
|---|---|
| `0x1072620` | `ComputerUseIPCTargetRisk` |
| `0x1072600` | `ComputerUseIPCAppPolicyDecision` |
| `0x1072640` | `ComputerUseIPCTargetDescriptor` |
| `0x1072660` | `ComputerUseIPCAppPolicyResult` |
| `0x1072680` | `ComputerUseIPCAppPolicyRequest` |
| `0x114fac1` | `allowed` |
| `0x114fac9` | `denied` |
| `0x114fad0` | `forbidden` |
| `0x114fada` | `low` |
| `0x114fade` | `high` |
| `0x114fae3` | `risk` |
| `0x114fae8` | `warningSubtitle` |
| `0x114faf8` | `decision` |
| `0x114fb01` | `target` |
| `0x114fb10` | `allowPersistentApproval` |
| `0x150324b` | ctor `displayName:appPath:risk:warningSubtitle:` |
| `0x15021bf` | ctor `target:allowPersistentApproval:` |

Same coding keys also at `0x10c3ea4` (`allowed`…`high`).

### 9.3 Org / config provider

| offset | string |
|---|---|
| `0xfdb9b0` | `ComputerUsePolicyProviding` |
| `0xfdb9f0` | `CodexAppServerComputerUsePolicyProvider` |
| `0xfdba50` | `ComputerUsePolicy` |
| `0xfdbaf0` | `AppAccess` / `MacOS` |
| `0x109b8d0` | `_TtC11ComputerUse39CodexAppServerComputerUsePolicyProvider` |
| `0x109b930` | `configRequirements/read` |
| `0x109b950` | `featureRequirements` |
| `0x109b970` | `allowBrowserAndComputerUse` |
| `0x109b990` | `allowPersistentApproval` |
| `0x109b9b0` | `defaultAppAccess` |
| `0x109b9d0` | `default_app_access` |
| `0x1137fa0` | `allowComputerUse` |
| `0x1137fd8` | `macos` |
| `0x1137fde` | `configuredMacOS` |
| `0x1138001` | `bundleIDs` |
| `0x113800b` | `allow` |
| `0x1138011` | `deny` |

### 9.4 User-facing copy

| offset | string |
|---|---|
| `0x109ac70` | `Computer use actions are not allowed for system security process: ` |
| `0x109e240` | `Allowing ChatGPT to use this app introduces new risks, including those related to prompt injection attacks, such as data theft or loss. Carefully monitor ChatGPT while it uses this app.` |
| `0x109e300` | `Computer Use is disabled by your configuration.` |
| `0x10c63f0` + `0x10c6420` | `Computer Use is not allowed to use the app '` + `' for safety reasons.` |
| `0x10c7410` + `0x10c7440` | `Computer Use is blocked from using the app '` + `' by your organization's policy.` |
| `0x10c73d0` | `Computer Use approval denied via MCP elicitation for app '` |
| `0x10c7390` | `Computer Use permission request canceled for app '` |
| `0x10c7340` | `Computer Use could not persist the approval permanently for app '` |
| `0x1137480` | `systemSecurityTargetNotAllowed` |
| `0x10c5030` | `sessionApprovedBundleIdentifiers` |
| `0x10c50b0` | `approvedBundleIdentifiers` |
| `0x10c5060` | `persistentApprovals` |

`0x109e240` is the only sampled sentence that looks like a `warningSubtitle`. Linear’s live `warningSubtitle` was `null`, so it is **not** attached to every `high` app.

---

Do not ship this file as an enforcement list. More bundle IDs can exist as computed prefixes, Statsig (`ax_prefetch_disabled_bundle_ids`), or org TOML `[computer_use.macos.bundle_ids]`.
