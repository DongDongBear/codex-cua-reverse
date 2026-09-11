# FILE_INDEX — Chrome/Edge extension browser-use

Absolute paths. No copies made. Do not treat `Local Extension Settings/` as source (profile state).

## Plugin (ChatGPT.app)

| Path | Role |
|---|---|
| `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/chrome/` | Chrome plugin root v`26.903.61454` |
| `…/chrome/.codex-plugin/plugin.json` | name `chrome`; Stop/Interrupt/SubagentStop → `node_repl.turn_ended`; skills `./skills/` |
| `…/chrome/skills/control-chrome/SKILL.md` | Model bootstrap: `setupBrowserRuntime` + `get("chrome"|"edge"|"iab"|"extension")` |
| `…/chrome/docs/api.json` | Agent API contract (same SHA as desktop `api.json`) |
| `…/chrome/docs/documents.json` | include/lookup/model doc filters (claiming, session-naming, chrome-troubleshooting) |
| `…/chrome/docs/tab-claiming-chrome.md` | mention URL → `extensionInstanceId` → `openTabs` + `claimTab` |
| `…/chrome/docs/tab-cleanup-chrome.md` | agent tabs close; claimed user tabs released |
| `…/chrome/docs/tab-mentions-iab.md` | IAB mention → `codexSessionId` → `tabs.get` (no claim) |
| `…/chrome/docs/tab-cleanup-iab.md` | IAB cleanup (contrast) |
| `…/chrome/docs/session-naming.md` | `nameSession` emoji title; extension only |
| `…/chrome/docs/visibility.md` | when to `capabilities.get("visibility").set` |
| `…/chrome/docs/chrome-troubleshooting.md` | diagnostic scripts; do not run `installManifest.mjs` |
| `…/chrome/docs/chrome-file-upload-troubleshooting.md` | “Allow access to file URLs” copy |
| `…/chrome/docs/bootstrap-troubleshooting.md` | `browsers.list()` when selection fails |
| `…/chrome/docs/capabilities/browser/{visibility,viewport,management}.md` | capability APIs |
| `…/chrome/docs/capabilities/tab/{cdp,botDetection,browserAuth,pageAssets}.md` | tab capabilities |
| `…/chrome/docs/{webmcp,file-uploads,screenshots,confirmations,browser-safety,api-use-behavior,browser-control-interruption,accessibility,local-web-development,browser-troubleshooting}.md` | shared docs (also on IAB plugin) |
| `…/chrome/scripts/browser-client.mjs` | `setupBrowserRuntime`; RPC `setup`/`execute` |
| `…/chrome/scripts/browser-service.mjs` | `handleRpc`; SHA `25232ad906a2df73…` 1 305 259 B — **identical** to `plugins/browser` copy |
| `…/chrome/scripts/installManifest.mjs` | writes Native Messaging manifests + `extension-host-config.json` |
| `…/chrome/scripts/extension-ids.json` | families, store ids, host name, OS paths |
| `…/chrome/scripts/chromium-browser-diagnostics.mjs` | `--browser` parsing, user-data-dir |
| `…/chrome/scripts/check-extension-installed.js` | Preferences/Secure Preferences + `Extensions/<id>` |
| `…/chrome/scripts/check-native-host-manifest.js` | `com.openai.codexextension.json` |
| `…/chrome/scripts/chrome-is-running.js` | process list / SingletonLock |
| `…/chrome/scripts/open-chrome-window.js` | `open -na "Google Chrome" --args --profile-directory=… about:blank` (**do not run live**) |
| `…/chrome/scripts/installed-browsers.js` | LaunchServices + known Chromium apps |
| `…/chrome/scripts/browser-accessibility.wasm.br` | AX helper (shared) |
| `…/chrome/scripts/zxing_reader.wasm` | `browserAuth` QR |
| `…/chrome/extension-host/macos/arm64/ChatGPT for Chrome` | native host Mach-O; SHA `90f99fbc…e13b` |
| `…/chrome/assets/{google-chrome.png,google-chrome-composer.png,microsoft-edge.svg,brave.svg,opera.svg,vivaldi.svg}` | plugin UI |
| `…/chrome/node_modules/classic-level/` | LevelDB (service persistence) |

## Plugin (browser / IAB twin)

| Path | Role |
|---|---|
| `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/browser/` | IAB plugin; same docs/scripts minus `extension-host` + `installManifest.mjs` |
| `…/browser/.codex-plugin/plugin.json` | name `browser`; @Browser |
| `…/browser/skills/control-in-app-browser/SKILL.md` | same selection scenarios as control-chrome |

## Plugin cache (`~/.codex`)

| Path | Role |
|---|---|
| `/Users/dongdong/.codex/plugins/cache/openai-bundled/chrome/26.903.61454/` | cache copy; `latest` → this dir |
| `…/chrome/latest/extension-host/macos/arm64/ChatGPT for Chrome` | path written into Native Messaging manifests |
| `…/chrome/26.903.61454/skills/` | **empty** (app bundle has the skill) |
| `…/chrome/26.901.51231/` | **gone**; running PID 26871 still has this cwd/inode |
| `/Users/dongdong/.codex/plugins/cache/openai-bundled/browser/26.903.61454/` | IAB plugin cache; same `browser-service.mjs` hash as chrome plugin |

## Production CUA service (what traces actually imported)

| Path | Role |
|---|---|
| `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/browser-desktop/` | trusted service `@oai/browser-desktop/service` (1 303 004 B, hash ≠ plugin copy) |
| `…/scripts/browser-client.mjs` | tinysky imports a vendored sibling; hashes in v4 FINDINGS |
| `/Users/dongdong/.codex/plugins/cache/openai-bundled/unified-computer-use/26.903.61454/scripts/launch.mjs` | cua_repl launcher; `BROWSER_USE_AVAILABLE_BACKENDS=chrome,iab` |
| `/Users/dongdong/Desktop/codex-cua-reverse/vendor/plugins/unified-computer-use/browser-description.md` | tool text: `"chrome"`/`"edge"` + `sessionName`; `"iab"` + `visible` |
| `/Users/dongdong/Desktop/codex-cua-reverse/vendor/browser-desktop/` | vendored docs/api.json |

## Native Messaging manifests (generated)

All `com.openai.codexextension.json`, same body: origins both store ids; `path` = cache `latest` binary; `type: stdio`.

| Path |
|---|
| `/Users/dongdong/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.openai.codexextension.json` |
| `…/Google/Chrome for Testing/NativeMessagingHosts/com.openai.codexextension.json` |
| `…/Google/ChromeForTesting/NativeMessagingHosts/com.openai.codexextension.json` |
| `…/Chromium/NativeMessagingHosts/com.openai.codexextension.json` |
| `…/Microsoft Edge/NativeMessagingHosts/com.openai.codexextension.json` |
| `…/BraveSoftware/Brave-Browser/NativeMessagingHosts/com.openai.codexextension.json` |
| `…/com.operasoftware.Opera/NativeMessagingHosts/com.openai.codexextension.json` |
| `…/Vivaldi/NativeMessagingHosts/com.openai.codexextension.json` |

## Unpacked store extension (Chrome + Edge Default)

Root: `/Users/dongdong/Library/Application Support/Google/Chrome/Default/Extensions/hehggadaopoacecdllhhajmbjkdcmajg/1.26.901.11451_0/`  
Mirror: `/Users/dongdong/Library/Application Support/Microsoft Edge/Default/Extensions/hehggadaopoacecdllhhajmbjkdcmajg/1.26.901.11451_0/`

| File | Role |
|---|---|
| `manifest.json` | MV3; permissions; sidePanel; nativeMessaging |
| `background.js` | worker: native JSON-RPC, leases, CDP, DNR, claiming, groups |
| `codex/build-info.json` | `{release,stable,sha:834ab2c3…}` |
| `content-scripts/chatgpt-website.js` | chatgpt.com @-mentions / installer / side panel |
| `content-scripts/codex.js` | injected overlay cursor + favicon badges |
| `content-scripts/foreign-frame-monitor.js` | foreign-extension frame watch |
| `content-scripts/codex-work-media-permission.js` | MAIN-world media permission on chatgpt.com |
| `codex-sidepanel/index.html` + `assets/*` | Codex side panel UI (large) |
| `codex-work-sidepanel.html` + `chunks/codex-work-sidepanel-*.js` | work side panel |
| `microphone-permission.html` + `chunks/microphone-permission-*.js` | mic prompt |
| `chunks/src-D-D8mhOs.js` | shared chunk |
| `images/{icon16,icon32,icon48,icon128,app-icon,cursor-chat}.png` | toolbar + overlay cursor |
| `_metadata/{computed_hashes,verified_contents}.json` | Chrome CRX verify |

**Do not index as API source:**  
`…/Default/Local Extension Settings/hehggadaopoacecdllhhajmbjkdcmajg/` (LevelDB).

## Pipes / processes (observed, not connected)

| Path / PID | Role |
|---|---|
| `/tmp/codex-browser-use/` | socket dir (macOS); Windows `\\.\pipe\codex-browser-use` |
| `/tmp/codex-browser-use/e3a02578-8721-4839-8711-fd3185c765d6.sock` | native host PID **26871** connected |
| `/tmp/codex-browser-use/c8842a5c-575f-442c-89f8-f93021cb2c0e.sock` | ChatGPT 3579; also `CODEX_APP_TOOLS_PIPE_PATH` |
| `/tmp/codex-browser-use/f1a9a786-315f-4552-a739-d756ae156aec.sock` | ChatGPT 3579 |
| `/tmp/codex-browser-use/269127ad-db68-4257-8957-35dc6efb5457.sock` | ChatGPT 3579 |
| PID 26871 | `ChatGPT for Chrome chrome-extension://hehggadaopoacecdllhhajmbjkdcmajg/` |
| PID 3579 | ChatGPT.app |
| PID 5769 / 56446 | cua_repl node_repl + trusted-worker (`@oai/browser-desktop/service`) |

## Traces / prior reverse

| Path | Role |
|---|---|
| `/Users/dongdong/Desktop/codex-cua-reverse/traces/task-1-ant-design-form.json` | IAB-only `js` calls — **no Chrome APIs** |
| `/Users/dongdong/Desktop/codex-cua-reverse/traces/task-2-linear-issue.json` | native Linear |
| `/Users/dongdong/Desktop/codex-cua-reverse/agents/03-browser-desktop/FINDINGS.md` | Agent API / tinysky wrapping |
| `/Users/dongdong/Desktop/codex-cua-reverse/agents/05-traces/FINDINGS.md` | call table |
| `/Users/dongdong/Desktop/codex-cua-reverse/verify/agents/v4-browser/FINDINGS.md` | live process graph + socket owners |
| `/Users/dongdong/Desktop/codex-cua-reverse/vendor/browser-desktop/docs/api.json` | same contract |

## Store / ids (from `extension-ids.json` + `installManifest.mjs`)

| Id | Channel |
|---|---|
| `hehggadaopoacecdllhhajmbjkdcmajg` | Chrome Web Store ChatGPT (also what Edge has installed here) |
| `odlomjlbamekndcpllcnffbgeohgkmjh` | Edge Add-ons ChatGPT (allowed origin; **not** installed here) |
| `lfkehkpjohcoelkpembgemeipeppanef` | Chrome Web Store **Codex** beta |
| Host `com.openai.codexextension` | prod native messaging name (`.dev` / `.internal` for other channels) |
