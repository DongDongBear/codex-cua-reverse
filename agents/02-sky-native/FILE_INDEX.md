# FILE_INDEX — `@oai/sky` native Computer Use

Copied `.d.ts` for this agent: [`d.ts/`](d.ts/). Originals remain in ChatGPT.app.

Legend: **req** = assignment-required; **copy** = duplicated under `d.ts/`.

---

## 1. Package entry (`@oai/sky` 0.6.26)

| Path | Role |
|---|---|
| `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/sky/package.json` | name/version, `exports["."]`, `exports["./service"]`, mac `executableFiles` (normal + relaxed Codex Computer Use.app) |
| `.../src/sky.d.ts` **req copy** | `export declare const sky: T.SkyClient` |
| `.../src/sky.js` | Proxy: in-process `create_client(load_options())` **or** `nodeRepl.rpc("sky", …)` |
| `.../src/index.d.ts` **copy** | re-exports `sky`, `SkyClient` |
| `.../src/index.js` | `export { sky } from "./sky.js"` |
| `.../src/create_client.d.ts` **req copy** | overloads window / window2 / full-desktop |
| `.../src/create_client.js` | `switch (options.target)` → `targets/{linux,mac,windows}/create_client.js` |
| `.../src/load_options.d.ts` **copy** | `load_options(): T.Options` |
| `.../src/load_options.js` | `OAI_SKY_CONFIG_PATH` JSON, else darwin→mac, linux→linux, win32→windows |
| `.../src/service.d.ts` **copy** | `handleRpc` setup/execute/drag_* |
| `.../src/service.js` | trusted-service side; strips screenshot/audio bytes |

Incomplete earlier copy: `codex-cua-reverse/vendor/sky/` (window types only; `SkyClient.d.ts` imports missing window2/full-desktop).

---

## 2. Union + shared types

| Path | Role |
|---|---|
| `types/SkyClient.d.ts` **req copy** | `SkyClient = FullDesktop \| Window \| Window2`; `Options` union |
| `types/index.d.ts` **copy** | namespaces `FullDesktop`, `Window`, `Window2` |
| `types/Direction.d.ts` **copy** | `"up"\|"down"\|"left"\|"right"\|"u"\|"d"\|"l"\|"r"` |
| `types/MouseButton.d.ts` **copy** | `"left"\|"right"\|"middle"\|"l"\|"r"\|"m"` |
| `types/Point.d.ts` **copy** | `{ x, y }` desktop-screenshot coords |

---

## 3. `types/window/` — Mac client (live `sky` here)

All **req**. Copied.

| File | Exports |
|---|---|
| `WindowComputerUseClient.d.ts` | client object: `target:"mac"` + methods |
| `index.d.ts` | re-exports; `Client` alias |
| `Options.d.ts` | `{ target: "mac" }` |
| `AppIdentifier.d.ts` | `type AppIdentifier = string` |
| `AppState.d.ts` | `{ app, screenshot, text }` |
| `Screenshot.d.ts` | `{ url }` |
| `Audio.d.ts` | `{ filepath, bytes, data_url }` |
| `ListApps.d.ts` | `App`, `Function = () => Promise<App[]>` |
| `GetAppState.d.ts` | `{ app, disableDiff? }` |
| `Click.d.ts` | `{ app, element_index?, x?, y?, mouse_button?, click_count? }` |
| `Drag.d.ts` | `{ app, from_x, from_y, to_x, to_y }` |
| `Paste.d.ts` | `{ app, text, format: "text"\|"md"\|"html" }` |
| `PerformSecondaryAction.d.ts` | `{ app, element_index, action }` |
| `PressKey.d.ts` | `{ app, key }` |
| `Scroll.d.ts` | `{ app, direction, pages?, element_index?, x?, y? }` |
| `SelectText.d.ts` | `{ app, element_index, text, prefix?, suffix?, selection_type? }` |
| `SetValue.d.ts` | `{ app, element_index, value }` |
| `TypeText.d.ts` | `{ app, text }` |
| `StartAudioRecording.d.ts` | `{ max_duration_ms? }` |
| `StopAudioRecording.d.ts` | `() => Promise<Audio>` |

Generated doc: `docs/sky-window-api.md` (omits audio). Skill: `docs/skills/oai_sky_lib/macos/SKILL.md` (omits paste).

---

## 4. `types/window2/` — Windows client

All **req**. Copied.

| File | Exports |
|---|---|
| `Window2ComputerUseClient.d.ts` | `target:"windows"` + methods |
| `index.d.ts` | re-exports `AppIdentifier` from window |
| `Options.d.ts` | `{ target: "windows" }` |
| `Window.d.ts` | `{ app, id, title? }` |
| `WindowState.d.ts` | `{ window, screenshots[], accessibility }` + `AccessibilityState` |
| `Screenshot.d.ts` | `{ id, zIndex, url, originX?, originY?, width?, height? }` |
| `Audio.d.ts` | same shape as window |
| `ListApps.d.ts` | `App` **with** `windows: Window[]` |
| `ListWindows.d.ts` | `() => Promise<Window[]>` |
| `GetWindow.d.ts` | `{ id, app? }` |
| `GetWindowState.d.ts` | `{ window, include_text?, include_screenshot? }` |
| `LaunchApp.d.ts` | `{ app }` — id or `.exe` path |
| `ActivateWindow.d.ts` | `{ window }` |
| `Click.d.ts` | `{ window, element_index?, x?, y?, screenshotId?, mouse_button?, click_count? }` |
| `Drag.d.ts` | `{ window, from_x, from_y, to_x, to_y, screenshotId? }` |
| `PressKey.d.ts` | `{ window, key }` |
| `TypeText.d.ts` | `{ window, text }` |
| `Scroll.d.ts` | `{ window, x, y, screenshotId?, scrollX, scrollY }` |
| `SetValue.d.ts` | `{ window, element_index, value }` |
| `PerformSecondaryAction.d.ts` | `{ window, element_index, action }` |
| `StartAudioRecording.d.ts` / `StopAudioRecording.d.ts` | same as window |

No `Paste.d.ts`, no `SelectText.d.ts`. Doc: `docs/sky-window2-api.md`. Skill: `docs/skills/oai_sky_lib/windows/SKILL.md`.

---

## 5. `types/full-desktop/` — Linux client

All **req**. Copied.

| File | Exports |
|---|---|
| `FullDesktopComputerUseClient.d.ts` | `target:"linux"` + methods |
| `index.d.ts` | re-exports; `Client` alias |
| `Options.d.ts` | `{ target:"linux"; post_action_sleep_ms?; mouse_size_px? }` + `LinuxRuntimeOptions` |
| `Screenshot.d.ts` | `{ filepath, bytes, data_url }` JPEG |
| `Audio.d.ts` | WAV `{ filepath, bytes, data_url }` |
| `GetScreenshot.d.ts` | `() => Promise<Screenshot[]>` |
| `Click.d.ts` | `{ x, y, mouse_button?, click_count?, key?, duration? }` |
| `Drag.d.ts` | `{ path: Point[]; key? }` |
| `DragHandle.d.ts` | `{ start, move_to, end }` |
| `Move.d.ts` | `{ x, y, key? }` |
| `PressKey.d.ts` | `{ key, duration? }` |
| `Scroll.d.ts` | `{ direction, pixels?, x?, y?, key? }` |
| `TypeText.d.ts` | `{ text }` |
| `StartAudioRecording.d.ts` / `StopAudioRecording.d.ts` | same pattern |

No apps, no AX, no `set_value`/`paste`/`select_text`. Doc: `docs/sky-full-desktop-api.md`. Skill: `docs/skills/oai_sky_lib/linux/SKILL.md`.

---

## 6. Mac JS implementation (`targets/mac/`) — **req**

| File | Role |
|---|---|
| `create_client.d.ts` / `.js` **req** | builds `WindowComputerUseClient`; audio if `SKY_ENABLE_AUDIO=1`; per-client `Set` of apps that already got instructions |
| `client.d.ts` / `.js` **req** | `MacComputerUseClient` IPC wrapper; request type names; `SkyDiscoveredApp`; `MacAppPolicyResult`; action encoding |
| `computer-use-policy.d.ts` / `.js` **req** | `withComputerUsePolicy`, audio elicitation, freeze+rewrite `app`→`appPath`, response meta |
| `computer-use-telemetry.d.ts` / `.js` **req** | Statsig `CodexComputerUseMcp*` events |
| `native-pipe.d.ts` / `.js` | JSON-RPC framed socket; `ensureService`; launch CUAService |
| `errors.d.ts` / `.js` | `ServerErrorCode` −10000…−10020 |
| `lazy-client.d.ts` / `.js` | `getClient()` dynamic import of `client.js` |
| `window_result.d.ts` / `.js` | skyshot → `AppState`; instruction prefix; Numbers skip |
| `get_app_state.d.ts` / `.js` | policy + `getAppState` + `window_result` |
| `list_apps.d.ts` / `.js` | `listApps` → public `App` |
| `click.js` `drag.js` `paste.js` `perform_secondary_action.js` `press_key.js` `scroll.js` `select_text.js` `set_value.js` `type_text.js` | snake_case → camelCase IPC |
| `audio_recording.d.ts` / `.js` | duration clamp; WAV read |
| `index.d.ts` | `export * from "./create_client"` |

---

## 7. Windows / Linux targets (contrast)

| Path | Role |
|---|---|
| `targets/windows/create_client.d.ts` **copy** | `create_client(_options: WindowsOptions): Window2.Client` |
| `targets/windows/internal/computer_use_client_base.d.ts` **copy** | implements `T.Window2.Client` |
| `targets/windows/internal/computer_use_client.d.ts` **copy** | helper exe vs `SKY_CUA_NATIVE_PIPE` |
| `targets/windows/internal/helper_transport.d.ts` **copy** | spawn `bin/windows/codex-computer-use.exe` |
| `targets/linux/create_client.d.ts` **copy** | wires click/drag/move/screenshot + `ActionSettler` |
| `targets/linux/action_settler.d.ts` **copy** | default 100 ms post-action sleep |
| `targets/linux/sky_linux.d.ts` | CLI to `sky_linux_{arm64,x64}` |

---

## 8. Native Mac binaries (no source)

| Path | Role |
|---|---|
| `.../@oai/sky/Codex Computer Use.app/Contents/MacOS/SkyComputerUseService` | AX + skyshot + input; IPC server; ~23 MB |
| `.../Contents/Info.plist` | bundle `com.openai.sky.CUAService`, display name “ChatGPT Computer Use”, LSUIElement, Sparkle feed |
| `.../SharedSupport/SkyComputerUseClient.app/.../SkyComputerUseClient` | CLI/MCP client (`com.openai.sky.CUAService.cli`) |
| `.../SharedSupport/CUALockScreenGuardian.app` | lock-screen guardian |
| `.../SharedSupport/Codex Computer Use Installer.app` | TCC / authorization plugin installer |
| `Package_ComputerUse.bundle/.../AppInstructions/*.md` | Slack, Spotify, Numbers, Notion, Clock, AppleMusic, iPhone Mirroring |
| `Package_ComputerUse.bundle/.../SkysightMemoryInstructions.md` | unrelated memory feature in same bundle |
| `Package_ComputerUse.bundle/.../SkysightSummarizer.md` | same |
| Group container socket | `~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock` |
| `/Applications/ChatGPT.app/Contents/Resources/native/sky.node` | Electron native addon (separate from cua_node `@oai/sky`) |

IPC version string: `CodexComputerUseIPC-5`. Also `CodexComputerUseNativeBridge-1`.

---

## 9. Plugins / skills (ChatGPT.app)

| Path | Role |
|---|---|
| `.../plugins/openai-bundled/plugins/computer-use/.codex-plugin/computer-use-node-repl.md` **req** | model-facing Mac `sky.*` API + workflow + confirmations |
| `.../computer-use/.codex-plugin/plugin.json` | plugin 1.0.1000968 |
| `.../computer-use/.mcp.json` | MCP command `./bin/computer-use-client-launcher` |
| `.../computer-use/bin/computer-use-client-launcher` | exec `$CODEX_HOME/computer-use/.../SkyComputerUseClient` |
| `.../computer-use/skills/computer-use/SKILL.md` **req if present** | confirmations policy only |
| `codex-cua-reverse/vendor/plugins/computer-use/*` | earlier copy of the same plugin docs |
| `.../plugins/unified-computer-use/.mcp.json` | `cua_repl` / `js` tool |
| `.../unified-computer-use/scripts/launch.mjs` | sets `NODE_REPL_TRUSTED_SERVICES.sky=@oai/sky/service` |
| `.../unified-computer-use/resources/computer-description.md` | `cua.getApp("Example App")` |
| `@oai/cua/.../tinysky_alt/create_tinysky_alt.js` | Mac-only `getApp` / `listApps` wrapping `sky` |
| `@oai/cua/.../tinysky_alt.types.d.ts` | `Computer = typeof sky`; `MacComputer = Extract<Computer,{target:"mac"}>` |
| `vendor/cua/docs/tinysky-alt-core-cua-repl.md` | unified Target API |

---

## 10. Copied tree for this agent

Root: `/Users/dongdong/Desktop/codex-cua-reverse/agents/02-sky-native/`

- `FINDINGS.md` — verdict + signatures + contrast
- `FILE_INDEX.md` — this file
- `QUESTIONS.md`
- `d.ts/` — 96 `.d.ts` files mirroring the required public/mac/windows/linux types
