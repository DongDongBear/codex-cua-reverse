# File index — Native Codex Computer Use.app

Inspected 2026-09-10. Trees: ChatGPT-bundled app, `~/.codex/computer-use` copy, JS client, plugin launchers. 232 paths / 167 files in the app bundle.

## Canonical locations

| What | Path |
|---|---|
| Bundled app | `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/sky/Codex Computer Use.app` |
| Installed/running copy | `/Users/dongdong/.codex/computer-use/Codex Computer Use.app` |
| Home config | `/Users/dongdong/.codex/computer-use/config.json` |
| App group IPC | `~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock` |
| Lock-screen auth socket | `/tmp/com.openai.sky.CUAService/LockScreenLoginAuthorization.sock` |
| Installed SecurityAgent plugin | `/Library/Security/SecurityAgentPlugins/CodexComputerUseAuthorizationPlugin.bundle` |
| JS Mac client | `.../@oai/sky/dist/project/cua/sky_js/src/targets/mac/` |
| This writeup | `/Users/dongdong/Desktop/codex-cua-reverse/agents/07-native-app/` |

`diff -rq` of bundled vs `~/.codex` app: **identical**. Running pid 3802 uses the home copy.

---

## Bundle tree (executables and control files)

```
Codex Computer Use.app/
  Contents/
    Info.plist                          com.openai.sky.CUAService
    embedded.provisionprofile           “CUA Service”
    PkgInfo
    _CodeSignature/CodeResources
    MacOS/
      SkyComputerUseService             22 104 320  arm64  THE CLICKER
    Resources/
      BUILD.bazel                       AppConstants / bundle ids / agent label
      CUAAppIcon.icns
      Assets.car
      Package_ComputerUse.bundle/       AX app hints, Skysight md, lens PNG sequence
      Package_Appshot.bundle/           Appshot.wav
      Package_SlimCore.bundle/          Assets.car
      SwiftProtobuf_SwiftProtobuf.bundle/ PrivacyInfo.xcprivacy
    SharedSupport/
      SkyComputerUseClient.app/         MCP/CLI client
      CUALockScreenGuardian.app/        lock-screen helper
      Codex Computer Use Installer.app/ auth-plugin installer
```

### SkyComputerUseClient.app

```
Contents/Info.plist                     com.openai.sky.CUAService.cli
Contents/embedded.provisionprofile      “CUA Service CLI”
Contents/MacOS/SkyComputerUseClient     14 167 776  arm64
Contents/Resources/BUILD.bazel
Contents/Resources/SkyComputerUseClient_Parent.coderequirement   team 2DC432GLL2
Contents/Resources/SwiftProtobuf_SwiftProtobuf.bundle/
```

### CUALockScreenGuardian.app

```
Contents/Info.plist                     com.openai.sky.CUAService.guardian
Contents/MacOS/CUALockScreenGuardian    22 734 688  arm64
Contents/Resources/CUALockScreenGuardian_Parent.coderequirement
Contents/Resources/{CUAAppIcon.icns,Assets.car}
Contents/Resources/Package_{ComputerUse,Appshot,SlimCore,SwiftProtobuf}_*.bundle/
  (ComputerUse bundle duplicated: same AppInstructions + LensSequence)
```

No entitlements blob.

### Codex Computer Use Installer.app

```
Contents/Info.plist                     com.openai.sky.CUAService.AuthorizationPluginInstaller
Contents/MacOS/Codex Computer Use Installer   90 480
Contents/Resources/
  CodexComputerUseAuthorizationPluginInstallerTool   109 776
  CodexComputerUseAuthorizationPlugin.bundle/
    Contents/Info.plist                 com.openai.sky.CUAService.AuthorizationPlugin
    Contents/MacOS/CodexComputerUseAuthorizationPlugin   67 872  bundle
  CUAAppIcon.icns
  Assets.car
```

---

## Binaries (hashes)

| File | SHA-256 | Size |
|---|---|---:|
| SkyComputerUseService | `905939bff849b072da68e8e23e97188ed7bf93173646ac1bd9f7b54f9a89ce35` | 23104320 |
| SkyComputerUseClient | `b759a59f0d35f82eb771c5d7ff6e5139d294e714c2f5313e2f75fe85c99156d6` | 14167776 |
| CUALockScreenGuardian | (not hashed; 22734688 bytes) | 22734688 |
| Codex Computer Use Installer | | 90480 |
| CodexComputerUseAuthorizationPluginInstallerTool | | 109776 |
| CodexComputerUseAuthorizationPlugin (bundled) | CDHash `a70658f8…` | 67872 |
| CodexComputerUseAuthorizationPlugin (installed) | CDHash `4ccae2e8…` **different, older** | |

All Mach-O 64-bit **arm64**, hardened runtime, Developer ID `2DC432GLL2`.

---

## JS that talks to the native app

`/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/sky/dist/project/cua/sky_js/src/`

| File | Role |
|---|---|
| `targets/mac/native-pipe.js` | Unix socket JSON-RPC; path, framing, `ensureService`, launch |
| `targets/mac/client.js` | `MacComputerUseClient`; request type names; click/type/… |
| `targets/mac/computer-use-policy.js` | `getAppPolicy` + elicitation + telemetry wrap |
| `targets/mac/computer-use-telemetry.js` | Statsig events, `transport: native_pipe` |
| `targets/mac/errors.js` | ServerErrorCode -10000…-10020 |
| `targets/mac/lazy-client.js` | lazy import of `client.js` |
| `targets/mac/create_client.js` | `sky` object: list_apps, get_app_state, click, … |
| `targets/mac/{click,drag,paste,press_key,scroll,set_value,select_text,type_text,perform_secondary_action,get_app_state,list_apps,audio_recording}.js` | thin wrappers through policy |
| `service.js` | RPC dispatcher for `@oai/sky/service` (NODE_REPL_TRUSTED_SERVICES) |
| `scripts/install-computer-use-package.d.ts` | `SKY_CUA_SERVICE_PATH`, `CODEX_COMPUTER_USE_PLUGIN_ROOT` |

`package.json` version `@oai/sky` **0.6.26**. Mentions `bin/mac/normal/` and `bin/mac/relaxed/` apps (not present as extra copies in this ChatGPT tree; one app is nested at package root).

Related ChatGPT native addon (PIP overlay, not `@oai/sky`):

`/Applications/ChatGPT.app/Contents/Resources/native/sky.node`  
strings: `spawnComputerUseService`, `CodexComputerUseNativeBridge-1`, `SAIRemoteHostedPIPContentHostXPCProtocol`.

---

## Plugin launchers

Identical `computer-use-client-launcher` (339 bytes) in:

```
/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/computer-use/bin/
/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/computer-history/bin/
/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/messages/bin/
/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/record-and-replay/bin/
~/.codex/plugins/cache/openai-bundled/computer-use/1.0.1000968/bin/
~/.codex/.tmp/bundled-marketplaces/openai-bundled/plugins/{computer-use,computer-history,messages,record-and-replay}/bin/
```

computer-use plugin metadata:

```
.../computer-use/.codex-plugin/plugin.json     v1.0.1000968
.../computer-use/.mcp.json                     args ["mcp"], env CODEX_HOME
.../computer-use/skills/computer-use/SKILL.md
.../computer-use/.codex-plugin/computer-use-node-repl.md
```

Docs inside `@oai/sky`:

```
docs/skills/oai_sky_lib/macos/SKILL.md
docs/sky-window-api.md
docs/sky-window2-api.md
docs/sky-full-desktop-api.md
```

---

## Runtime / OS artifacts (this machine)

| Path | Notes |
|---|---|
| `~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock` | live listen, 0600 |
| `.../IPC/computeruse.sock.lock` | lock file |
| `.../Library/Application Support/Software/Analytics.db` | Statsig/analytics |
| `~/Library/Caches/com.openai.sky.CUAService/` | |
| `~/Library/HTTPStorages/com.openai.sky.CUAService/` | Sparkle/network |
| `/tmp/com.openai.sky.CUAService/LockScreenLoginAuthorization.sock` | live listen, **0666** |
| `/Library/Security/SecurityAgentPlugins/CodexComputerUseAuthorizationPlugin.bundle` | installed, older build 1000366 |
| `~/Library/Preferences` defaults domain `com.openai.sky.CUAService` | status item + Statsig cache |
| No `~/Library/LaunchAgents` / `/Library/LaunchDaemons` CUA entries | service is child of ChatGPT |

---

## Copies written under this agent dir

```
agents/07-native-app/
  FINDINGS.md
  FILE_INDEX.md
  QUESTIONS.md
  copies/
    CUAService.Info.plist.xml
    CUAService.entitlements.xml
    CUAService.embedded.provisionprofile.xml
    CUAService.BUILD.bazel
    SkyComputerUseClient.Info.plist.xml
    SkyComputerUseClient.entitlements.xml
    SkyComputerUseClient.embedded.provisionprofile.xml
    SkyComputerUseClient.BUILD.bazel
    SkyComputerUseClient_Parent.coderequirement
    CUALockScreenGuardian.Info.plist.xml
    CUALockScreenGuardian.entitlements.NOTE.txt
    CUALockScreenGuardian_Parent.coderequirement
    Installer.Info.plist.xml
    Installer.entitlements.xml
    InstallerTool.entitlements.xml
    AuthorizationPlugin.Info.plist.xml
    AuthorizationPlugin.entitlements.NOTE.txt
    Package_ComputerUse.Info.plist.xml
    computer-use-client-launcher.sh
    computer-use.mcp.json
    home-computer-use-config.json
```

---

## Package_ComputerUse.bundle resources

```
Resources/AppInstructions/
  AppleMusic.md  Clock.md  iPhone Mirroring.md  Notion.md  Numbers.md  Slack.md  Spotify.md
Resources/SkysightSummarizer.md
Resources/SkysightMemoryInstructions.md
Resources/LensSequence/Lens_frame_00.png … Lens_frame_44.png
Resources/Assets.car
```

---

## Linked frameworks (service, abbreviated)

AppKit, ApplicationServices, AVFoundation, AVFAudio, Carbon, Combine, Contacts, CoreGraphics, CoreMedia, CryptoKit, EventKit, IOKit, ImageIO, Intents, Network, OSLog, OpenDirectory, QuartzCore, ScreenCaptureKit, ScriptingBridge, Security, SwiftUI, VideoToolbox, WebKit, libbsm, libswiftXPC.

Client: subset (no AVFoundation/WebKit/EventKit); still ScreenCaptureKit + Network + AppKit.

Guardian: same stack as service.

Installer/tool/plugin: Foundation + Security (+ CoreFoundation on plugin).
