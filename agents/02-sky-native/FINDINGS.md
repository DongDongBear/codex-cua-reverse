# FINDINGS — `@oai/sky` native Mac Computer Use

## Verdict

On this ChatGPT.app Mac install, the live `sky` export is **only** the **window** client (`target: "mac"`). It is **not** window2 and **not** full-desktop.

`SkyClient` is a three-way TypeScript union discriminated by `target`:

| Union member | `target` | OS selected by `load_options()` | Binding unit | Observation | Launch |
|---|---|---|---|---|---|
| `WindowComputerUseClient` | `"mac"` | `process.platform === "darwin"` | **app** string (`AppIdentifier`) | AX **text** + **one** window screenshot (`file://` / data URL) | **implicit** in `get_app_state` |
| `Window2ComputerUseClient` | `"windows"` | `"win32"` | **window object** `{ app, id, title? }` | optional AX **struct** + **N** bounded screenshots with `id`/`zIndex` | **explicit** `launch_app` |
| `FullDesktopComputerUseClient` | `"linux"` | `"linux"` | **whole desktop** (no app/window) | JPEG bytes + filepath + data URL; **no AX** | N/A |

Window2 is **not** a second Mac window API. Its types, skill, and `create_client` path are Windows-only (`WindowsComputerUseClient` → `codex-computer-use.exe` / native pipe). Full-desktop is Linux-only (`sky_linux_*` binaries + `ActionSettler`).

Mac Computer Use is: JS `sky.*` (snake_case) → policy/elicitation → `MacComputerUseClient` (camelCase) → JSON-RPC native pipe (`CodexComputerUseIPC-5`) → `SkyComputerUseService` (`com.openai.sky.CUAService`) which reads the AX tree, captures a key-window “skyshot”, and synthesizes input.

Copied types live under [`d.ts/`](d.ts/).

---

## Scope

Local ChatGPT.app only. No remote probing, no exploits, no secrets used beyond what is already bundled (Statsig client key is in the JS; it is not reproduced here).

Package: `@oai/sky` **0.6.26**. Native app: **ChatGPT Computer Use** / `Codex Computer Use.app` version **26.902.1000968**, bundle `com.openai.sky.CUAService`, LSUIElement (no Dock icon), min OS 14.4.

Two ChatGPT plugins consume this:

1. **`computer-use` 1.0.1000968** — older/parallel surface. MCP launches `SkyComputerUseClient`. Skill + `.codex-plugin/computer-use-node-repl.md` tell the model to `import("@oai/sky")` and call `sky.*` with `app:`.
2. **`unified-computer-use` 26.903.61454** — current CUA REPL. Injects `NODE_REPL_TRUSTED_SERVICES.sky = "@oai/sky/service"`. Tinysky-alt wraps Mac `sky` as `cua.getApp(name)` / `app.click(index)`.

---

## How `sky` is constructed on Mac

```
process.platform === "darwin"
  → load_options() => { target: "mac" }
  → create_client(options) switch
  → targets/mac/create_client.js
  → WindowComputerUseClient { target: "mac", list_apps, get_app_state, click, ... }
```

Override: `OAI_SKY_CONFIG_PATH` pointing at JSON with `{ "target": "mac"|"windows"|"linux", ... }`.

When `globalThis.nodeRepl.rpc` exists (trusted CUA REPL), `sky.js` does **not** call native methods in-process. It RPCs `"sky"` to `@oai/sky/service` `handleRpc`, which owns the real client. Linux `drag_handle` is special-cased as `drag_start` / `drag_move` / `drag_end`. Screenshot/audio bytes are stripped on the wire (`filepath` + `data_url` only) and rehydrated in the REPL.

Audio methods are **omitted unless** `SKY_ENABLE_AUDIO=1`. Types mark them optional (`start_audio_recording?`).

---

## Field-by-field contrast of the three `SkyClient` members

### 1. Discriminator + construction options

| Field | window (Mac) | window2 (Windows) | full-desktop (Linux) |
|---|---|---|---|
| `target` | `"mac"` (required literal) | `"windows"` | `"linux"` |
| Options type | `Window.MacOptions = { target: "mac" }` | `Window2.WindowsOptions = { target: "windows" }` | `FullDesktop.LinuxOptions = { target: "linux"; post_action_sleep_ms?: number; mouse_size_px?: number }` |
| Extra runtime | none in public options | helper path / native pipe | `ActionSettler` (default 100 ms post-action sleep; mouse overlay default 12 px) |

`create_client` is overloaded:

```ts
export declare function create_client(options: T.Window.Options): T.Window.Client;
export declare function create_client(options: T.Window2.Options): T.Window2.Client;
export declare function create_client(options: T.FullDesktop.Options): T.FullDesktop.Client;
export declare function create_client(options: T.Options): T.SkyClient;
```

### 2. Client method inventory (presence)

`✓` = required method. `?` = optional (audio, gated). `—` = absent.

| Method | window | window2 | full-desktop |
|---|---|---|---|
| `target` | ✓ `"mac"` | ✓ `"windows"` | ✓ `"linux"` |
| `list_apps` | ✓ | ✓ | — |
| `get_app_state` | ✓ | — | — |
| `get_window_state` | — | ✓ | — |
| `get_window` | — | ✓ | — |
| `list_windows` | — | ✓ | — |
| `launch_app` | — (implicit) | ✓ | — |
| `activate_window` | — | ✓ | — |
| `get_screenshot` | — | — | ✓ |
| `click` | ✓ | ✓ | ✓ |
| `drag` | ✓ | ✓ | ✓ |
| `drag_handle` | — | — | ✓ |
| `move` | — | — | ✓ |
| `press_key` | ✓ | ✓ | ✓ |
| `type_text` | ✓ | ✓ | ✓ |
| `scroll` | ✓ | ✓ | ✓ |
| `set_value` | ✓ | ✓ | — |
| `paste` | ✓ | — | — |
| `select_text` | ✓ | — | — |
| `perform_secondary_action` | ✓ | ✓ | — |
| `start_audio_recording` | ? | ? | ? |
| `stop_audio_recording` | ? | ? | ? |

Mac-only extras vs the other two: **`paste`**, **`select_text`**, **`get_app_state`**, app-string targeting, implicit launch.

Windows-only extras: **window objects**, **`launch_app`**, **`activate_window`**, **`list_windows`**, **`get_window`**, **`screenshotId`**, structured accessibility.

Linux-only extras: **`move`**, **`drag_handle`**, **`get_screenshot`**, hold-`key` chords on pointer ops, `duration` on click/key, pixel scroll.

### 3. Binding / identifier fields

| Concept | window | window2 | full-desktop |
|---|---|---|---|
| Handle passed into actions | `app: AppIdentifier` (`string`) | `window: Window` | none (desktop coords) |
| `AppIdentifier` | `export type AppIdentifier = string` (re-exported by window2) | same string type, but stored on `Window.app`; may be a full `.exe` path | N/A |
| List result | `{ id, displayName?, lastUsedDate?, useCount?, isRunning? }` — **no windows** | `{ id, displayName?, lastUsedDate?, useCount?, isRunning?, windows: Window[] }` | N/A |
| Window object | none (app’s **key window** is implicit) | `{ app: AppIdentifier; id: number; title?: string }` | N/A |
| Canonical `id` from `list_apps` | Mac JS: `bundleIdentifier ?? displayName ?? "unknown"` | helper-returned string (process path allowed) | N/A |

### 4. Observation types

| Field | window `AppState` | window2 `WindowState` | full-desktop `Screenshot` |
|---|---|---|---|
| identity | `app: AppIdentifier` | `window: Window` | none |
| image | `screenshot: { url: string } \| null` (single) | `screenshots: Array<Screenshot>` | `get_screenshot(): Promise<Screenshot[]>` each `{ filepath, bytes: Uint8Array, data_url }` JPEG |
| AX | `text: string` (always) | `accessibility: AccessibilityState \| null` | none |
| AX structure | one formatted tree string, optionally a **diff** | `{ tree; focused_element?; selected_text?; selected_elements?; document_text? }` | none |
| capture flags | `disableDiff?: boolean` | `include_text?: boolean` (default **false**); `include_screenshot?: boolean` (default **true**) | no flags |
| screenshot extras | URL only | `id`, `zIndex`, `url`, `originX?`, `originY?`, `width?`, `height?` | filepath + raw bytes + JPEG data URL |
| auto-emit | plugin: model must `nodeRepl.emitImage` / `write` | window2 skill: screenshots **auto-displayed**; do not re-emit | Linux skill: `nodeRepl.emitImage(screenshots[0].data_url)` |

Window2 `AccessibilityState`:

```ts
{
  tree: string;
  focused_element?: string;
  selected_text?: string;
  selected_elements?: Array<string>;
  document_text?: string;
}
```

### 5. Shared-looking methods — input fields

Common enums:

```ts
type MouseButton = "left" | "right" | "middle" | "l" | "r" | "m";
type Direction   = "up" | "down" | "left" | "right" | "u" | "d" | "l" | "r";
type Point       = { x: number; y: number }; // documented as desktop-screenshot coords
```

#### `click`

| Field | window | window2 | full-desktop |
|---|---|---|---|
| binding | `app: AppIdentifier` | `window: Window` | — |
| AX target | `element_index?: number` | `element_index?: number` | — |
| coords | `x?: number; y?: number` (app-window screenshot) | `x?: number; y?: number` (window-relative) | `x: number; y: number` (**required**) |
| `mouse_button?` | yes | yes | yes |
| `click_count?` | yes | yes | yes |
| `screenshotId?` | — | yes (must be cached for that window) | — |
| `key?` | — | — | hold chord during click |
| `duration?` | — | — | ms hold per click |
| Mac IPC | `elementID` XOR `coordinate:[x,y]`; `mouseButton` 0/1/2; default clickCount 1 | `click` vs `click_element` RPC | xdotool-style via `sky_linux` |

Mac JS: if `elementIndex` is present it wins; otherwise both `x` and `y` must be finite. Window2: same XOR, plus `screenshotId` for coordinate clicks.

#### `drag`

| Field | window | window2 | full-desktop |
|---|---|---|---|
| binding | `app` | `window` | — |
| geometry | `from_x, from_y, to_x, to_y` (all required) | same + `screenshotId?` | `path: Point[]` (**≥ 2** points) |
| `key?` | — | — | hold chord |
| extra | — | — | `drag_handle(): { start(point); move_to(point); end() }` |

#### `press_key`

| Field | window | window2 | full-desktop |
|---|---|---|---|
| binding | `app` | `window` | — |
| `key` | X11 keysym-style `+` chord | same, extra aliases (`period`, `greater`, `Numpad_0`, `KP_0`) | same as window + `duration?: number` (hold ms) |
| scope | **app-targeted**; cannot fire global shortcuts | window-targeted; skill: input methods auto-activate the window | whole desktop |

#### `type_text`

| Field | window | window2 | full-desktop |
|---|---|---|---|
| binding | `app` | `window` | — |
| `text` | required | required | required |
| note | `\n`/`\r` simulate Return (can send Slack/messages) | same idea | current focus anywhere |

#### `scroll`

| Field | window | window2 | full-desktop |
|---|---|---|---|
| binding | `app` | `window` | — |
| model | `direction` + `pages?` (default 1, must be `> 0`) | **deltas** `scrollX`, `scrollY` (required) | `direction` + `pixels?` |
| origin | `element_index?` **or** `x?, y?` | `x, y` **required** + `screenshotId?` | `x?, y?` |
| `key?` | — | — | hold chord |

#### `set_value` / `perform_secondary_action`

Present on window and window2 only.

| Field | window | window2 |
|---|---|---|
| binding | `app` | `window` |
| `element_index` | required | required |
| `value` / `action` | required | required; window2 action matching is **case-insensitive**; examples `Raise`, `Scroll Up/Down/Left/Right`, `Expand`, `Collapse` |

#### `paste` (window only)

```ts
{ app: AppIdentifier; text: string; format: "text" | "md" | "html" }
```

Pasteboard is restored after insert. Mac native also surfaces `pasteboardChangedDuringPaste` (“The user may have conflicted with your paste operation…”).

#### `select_text` (window only)

```ts
{
  app: AppIdentifier;
  element_index: number;
  text: string;
  prefix?: string;
  suffix?: string;
  selection_type?: "text" | "cursor_before" | "cursor_after";
}
```

Native: “Provide text exactly as it appears in the accessibility tree, including any Markdown formatting.”

#### Audio (all three, optional)

```ts
start_audio_recording?(input?: { max_duration_ms?: number }): Promise<void>
// default 60000, max 300000; Mac JS also enforces min 100
stop_audio_recording?(): Promise<Audio>
```

`Audio` is `{ filepath: string; bytes: Uint8Array; data_url: string }` (24 kHz stereo WAV). Full-desktop comments omit “stereo” on `bytes` but the stop-function docstring still says 24 kHz stereo WAV.

---

## Every `sky.*` method (Mac window client — this machine)

Public type: `WindowComputerUseClient`. Source: `types/window/*.d.ts`. Live object built in `targets/mac/create_client.js`.

```ts
import { sky } from "@oai/sky";
// sky.target === "mac"
```

### `sky.target`

Literal `"mac"`.

### `sky.list_apps(): Promise<Array<App>>`

No input (`Input = never`).

```ts
type App = {
  id: string;              // Canonical app id to pass as `app`
  displayName?: string;
  lastUsedDate?: string;   // ISO 8601
  useCount?: number;
  isRunning?: boolean;
};
```

JS mapping from native `SkyDiscoveredApp`:

- `id` ← `bundleIdentifier ?? displayName ?? "unknown"`
- drops native `appPath`, `isFrontmost`

Native discovery uses Spotlight (`kMDItemContentType == "com.apple.application-bundle" && kMDItemFSName == "*.app" && kMDItemLastUsedDate_Ranking >= $time.today(-…)`) plus `NSRunningApplication` / `NSWorkspace`. Nearby copy: “apps used in the last 14 days, including details on usage frequency.” Native discovered-app fields: `displayName`, `bundleIdentifier`, `appPath`, `lastUsedDate`, `useCount`, `isRunning`, `isFrontmost`.

Does **not** go through `withComputerUsePolicy` (no `app` field). Sets response meta app to null.

### `sky.get_app_state(input): Promise<AppState>`

```ts
input: {
  app: AppIdentifier;     // display name, bundle id, full path, process name, or list_apps id
  disableDiff?: boolean;  // full AX tree instead of diff from previous
}
returns: {
  app: AppIdentifier;     // echo of the **caller's** app string, not rewritten bundle id
  screenshot: { url: string } | null;
  text: string;           // AX tree, optionally prefixed with <app_specific_instructions>
}
```

Native IPC: `ComputerUseIPCAppGetSkyshotRequest`. Native docstring: **“Start an app use session if needed, then get the state of the app's key window and return a screenshot and accessibility tree.”**

JS `window_result`:

- throws if native omitted `skyshot` or non-string `text`
- screenshot URL empty → `screenshot: null`
- first successful observation per app prepends native `appSpecificInstructions` as `<app_specific_instructions>…</app_specific_instructions>`
- **exception:** bundle `com.apple.iWork.Numbers` never gets that JS prefix (Set in `window_result.js`)

### `sky.click(input): Promise<void>`

```ts
{
  app: AppIdentifier;
  element_index?: number;          // from latest get_app_state() text
  x?: number; y?: number;          // app-window screenshot coords
  mouse_button?: MouseButton;      // default left
  click_count?: number;            // default 1
}
```

IPC action: `{ click: { at: { elementID | coordinate }, clickCount, mouseButton: 0|1|2 } }`.

### `sky.drag(input): Promise<void>`

```ts
{ app: AppIdentifier; from_x: number; from_y: number; to_x: number; to_y: number }
```

IPC: `{ drag: { from:[x,y], to:[x,y] } }`. CamelCase on the wire (`fromX`… in `MacComputerUseClient.drag`).

### `sky.paste(input): Promise<void>`

```ts
{ app: AppIdentifier; text: string; format: "text" | "md" | "html" }
```

### `sky.perform_secondary_action(input): Promise<void>`

```ts
{ app: AppIdentifier; element_index: number; action: string }
```

IPC: `{ performSecondaryAction: { action, elementID: String(index) } }`. Do not invent action names; they must appear in AX text.

### `sky.press_key(input): Promise<void>`

```ts
{ app: AppIdentifier; key: string }
```

`key` is `+`-separated X11 keysym-style (`a`, `space`, `Return`, `Tab`, `Control_L+a`, `Super_L+d`). Whitespace around `+` ignored. Aliases: `Control`, `Ctrl`, `Alt`, `Shift`. Plugin also shows `super+c`, `Up`, `KP_0`. Empty/whitespace `key` throws in JS. IPC: `{ pressKey: { _0: key } }`.

### `sky.scroll(input): Promise<void>`

```ts
{
  app: AppIdentifier;
  direction: Direction;
  pages?: number;                  // default 1; JS requires finite > 0
  element_index?: number;
  x?: number; y?: number;
}
```

IPC: `{ scroll: { at: elementID|coordinate, direction: up|down|left|right, pages } }`.

### `sky.select_text(input): Promise<void>`

```ts
{
  app: AppIdentifier;
  element_index: number;
  text: string;
  prefix?: string;
  suffix?: string;
  selection_type?: "text" | "cursor_before" | "cursor_after";  // default "text"
}
```

Wire field is `selection` (not `selection_type`).

### `sky.set_value(input): Promise<void>`

```ts
{ app: AppIdentifier; element_index: number; value: string }
```

IPC: `{ setValue: { elementID, value } }`.

### `sky.type_text(input): Promise<void>`

```ts
{ app: AppIdentifier; text: string }
```

IPC: `{ type: { _0: text } }` (not `typeText`).

### `sky.start_audio_recording?(input?): Promise<void>`

```ts
input?: { max_duration_ms?: number }  // default 60000, clamp 100..300000
```

Separate elicitation: “Allow Computer Use to record computer audio?” (`riskLevel: "high"`, persist session only). IPC: `ComputerUseIPCStartAudioRecordingRequest` with `maxDurationMilliseconds`.

### `sky.stop_audio_recording?(): Promise<Audio>`

IPC: `ComputerUseIPCStopAudioRecordingRequest`. Requires `file:` URL; JS reads bytes and builds `audio/wav` data URL.

---

## Window2 `sky.*` (Windows — not live here)

```ts
sky.target === "windows"

sky.list_windows(): Promise<Window[]>
sky.get_window({ id: number; app?: AppIdentifier }): Promise<Window>
sky.list_apps(): Promise<Array<{ id; displayName?; windows: Window[]; lastUsedDate?; useCount?; isRunning? }>>
sky.launch_app({ app: AppIdentifier }): Promise<void>
  // App id from list_apps(), or explicit .exe path if not listed
sky.get_window_state({ window; include_screenshot?: boolean; include_text?: boolean }): Promise<WindowState>
sky.click({ window; element_index?; x?; y?; screenshotId?; mouse_button?; click_count? }): Promise<void>
sky.press_key({ window; key }): Promise<void>
sky.type_text({ window; text }): Promise<void>
sky.scroll({ window; x; y; screenshotId?; scrollX; scrollY }): Promise<void>
sky.set_value({ window; element_index; value }): Promise<void>
sky.drag({ window; from_x; from_y; to_x; to_y; screenshotId? }): Promise<void>
sky.perform_secondary_action({ window; element_index; action }): Promise<void>
sky.activate_window({ window }): Promise<void>  // escape hatch; other inputs auto-activate
sky.start_audio_recording?(…); sky.stop_audio_recording?(…)
```

Skill rule: if the app has no open window, **`launch_app` then re-`list_apps`**. `get_window_state` does **not** launch. `get_window_state` must request screenshot and/or text (JS throws if both false).

---

## Full-desktop `sky.*` (Linux — not live here)

```ts
sky.target === "linux"

sky.get_screenshot(): Promise<Screenshot[]>
sky.click({ x; y; mouse_button?; click_count?; key?; duration? }): Promise<void>
sky.drag({ path: Point[]; key? }): Promise<void>
sky.drag_handle(): { start(point: Point): Promise<void>; move_to(point: Point): Promise<void>; end(): Promise<void> }
sky.move({ x; y; key? }): Promise<void>
sky.press_key({ key; duration? }): Promise<void>
sky.scroll({ direction; pixels?; x?; y?; key? }): Promise<void>
sky.type_text({ text }): Promise<void>
sky.start_audio_recording?(…); sky.stop_audio_recording?(…)
```

---

## App identifier rules (Mac)

`AppIdentifier` is an unbranded `string`. Resolution is **native**, not JS.

Accepted forms (union of `.d.ts` comments, plugin skill, and native UI strings):

1. **Bundle identifier** — e.g. `com.google.Chrome`
2. **Display name** — e.g. `Google Chrome` (`CFBundleDisplayName` / `localizedName`)
3. **Full `.app` path**
4. **`list_apps()[].id`** — which JS sets to bundle id when present
5. **Process name** — mentioned in `GetAppState`/`Click` JSDoc (“process name, or other supported app identifier”)

Plugin rules:

- Prefer the name the user said; **do not** `list_apps` solely to resolve a known app.
- If display-name targeting fails, **immediately retry with bundle id** from `list_apps()`.
- `press_key` / `type_text` cannot invoke **global** shortcuts; they are app-scoped.

Policy rewrite (critical): after `getAppPolicy`, JS **replaces** `input.app` with `target.appPath` and freezes the object. Native action RPCs therefore see a **path**, not the original display name. Telemetry/response meta still use `bundleIdentifier`. Chrome (`com.google.Chrome`) additionally sets `codex/computerUseChrome: true` on REPL response meta.

Ambiguity: native error `ambiguousApp` (−10018). Message pattern: `Ambiguous app identifier '…'. Multiple apps share this bundle identifier: …. Use an app name or full app path instead.` Nearby strings include `com.apple.SafariTechnologyPreview`, `org.mozilla.firefox`, `org.mozilla.nightly`, `com.duckduckgo.*`.

Native policy target:

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

- `allowed` → elicit “Allow Computer Use to use "{displayName}"?” (`persist: session|always` if `allowPersistentApproval`, else session only).
- `denied` → org policy block.
- `forbidden` → “not allowed … for safety reasons.” Native also: “Computer use actions are not allowed for system security process: …”. Visible bundle strings include `com.apple.SecurityAgent`, `com.apple.LocalAuthentication.UIAgent`, `com.apple.WindowManager`, `com.apple.controlcenter`, `com.apple.notificationcenterui`, `com.apple.UserNotificationCenter`, plus product apps `com.apple.Terminal`, `com.googlecode.iterm2`, `com.1password.1password`, `com.apple.Safari`, `com.apple.finder`, `com.apple.systempreferences`, `com.apple.dock`. Classification logic is compiled Swift; this is **not** a complete allow/deny list.

`MacComputerUseClient` also accepts `app` as a bare string **or** `{ app?: string }` for policy/start/get-state.

---

## Launch-if-not-running

**Window (Mac): implicit.** Skills: “No need to open or launch apps; `get_app_state` transparently launches the app in the background if it's not already running.” Native GetSkyshot description: “Start an app use session if needed.” Symbols: `NSWorkspace.openApplicationAtURL:configuration:completionHandler:`, `runningApplicationsWithBundleIdentifier:`, `URLForApplicationWithBundleIdentifier:`, `activateIgnoringOtherApps:`.

`MacComputerUseClient.startApp` → `ComputerUseIPCAppStartRequest` exists but **is not called** by public `sky.get_app_state` / action wrappers. Launch is inside GetSkyshot / the app-session controller (`ComputerUseAppController`, `_isActive`, `needsUISettleBeforeSkyshot`).

**Window2: explicit.** `launch_app({ app })`. Skill: if `windows` is empty, launch, refresh `list_apps`, pick a window, optionally `activate_window`. Helper timeout for `launch_app` is 15 s vs 10 s default.

**Full-desktop: none.**

Settle after launch/action (Mac, documented in plugin, implemented natively): ~**1 second** before capturing new state, extra delays **up to 5 seconds** if a loading indicator / other change signs are present. Native fields: `needsUISettleBeforeSkyshot`, `lockUISettleDelay`, `lockUIFallbackDelay` (lock-screen path). JS does not sleep.

---

## AX tree + screenshot (Mac)

Pipeline:

1. Policy + optional elicitation.
2. Native captures **key window** skyshot (`ComputerUseIPCAppGetSkyshotRequest`).
3. AX tree is rendered to **indexed text** (`NextAvailableElementIDIterator`, `AccessibilityTreePresentation`).
4. Screenshot written to a file; JS gets `skyshot.screenshot.url` (plugin: always `file://` PNG in this environment).
5. Model prefers **element_index** actions; falls back to screenshot coordinates.

`elementID` is sent as a **string** of the integer index.

Coordinate space: plugin/docs say “X/Y coordinate in the app-window screenshot.” Native also has `should_normalize_screenshot_to_point_resolution` (unresolved whether JS coords are pixels or points — see QUESTIONS).

App-specific instruction files shipped in `Package_ComputerUse.bundle/.../AppInstructions/`:

- `AppleMusic.md`, `Clock.md`, `iPhone Mirroring.md`, `Notion.md`, `Numbers.md`, `Slack.md`, `Spotify.md`

Injected once per app into `AppState.text`. Numbers is skipped at the JS prefix layer.

Feature flags in the binary: `feature/screenshot`, `feature/skyshotClassifier` (image vs no-image), `feature/axTreeDiffing`, `feature/axTreeDiffingRemovedElementIDRanges`, `feature/computerUseCursor`, `feature/computerUsePIP`.

Permissions: Accessibility + Screen Recording. Errors: `permissionsNotGranted` (−10009), `permissionsPending` (−10014) with “call this tool again… user is almost done”, `accessibilityError` (−10008), `screenLocked` (−10020).

---

## Diffs

Default `get_app_state` **diffs** the AX tree against the previous tree for that app session. Pass `disableDiff: true` for a full tree.

Tinysky-alt maps `{ disableDiffing: true }` → `sky.get_app_state({ disableDiff: true })`. `cua.getApp` always fetches the **first** state with `disableDiff: true`.

Native copy:

- “The following is a diff from the previous accessibility tree”
- markers: `~` changed, `+` added, `-` removed — **or**, when `feature/axTreeDiffingRemovedElementIDRanges` is on: `~`/`+` only, “Removed elements are summarized by ID range” / “Removed element IDs:”
- “The following is a cumulative diff from the initial accessibility tree”
- “There has been no change in the accessibility tree for …”

Plugin: if you only looked at the screenshot and ignored AX text, request a **full** tree next time before using indexes. Indexes are valid **only** for the tree that produced them.

Window2 has **no** `disableDiff`; AX is on/off via `include_text` (default off). Full-desktop has no tree.

Linux has a different “settling” concept (`ActionSettler.post_action_sleep_ms`, default 100), not AX diffs.

---

## Policy, elicitation, telemetry (Mac JS)

Every app-targeted public method (`get_app_state`, `click`, `drag`, `paste`, `perform_secondary_action`, `press_key`, `scroll`, `select_text`, `set_value`, `type_text`) is wrapped in `withComputerUsePolicy(toolName, input, op)`:

1. `getAppPolicy({ app })` via IPC `ComputerUseIPCAppPolicyRequest`
2. Branch on `decision`
3. `nodeRepl.createElicitation` MCP approval (`codex_approval_kind: mcp_tool_call`, connector `computer-use`)
4. Freeze input, rewrite `app` → `appPath`
5. `nodeRepl.withSuspendedTimeout` around the native call
6. Statsig event `CodexComputerUseMcpToolCalled` (`pluginId: computer-use@openai-bundled`, `transport: native_pipe`, `invocationSource: code_mode`)

`list_apps` and audio start/stop skip app policy; audio start has its own elicitation.

Errors mapped to telemetry `cancelled` when native code is `userStoppedSession` (−10012) or `userIntervened` (−10016).

Statsig client talks to `ab.chatgpt.com` / `chatgpt.com/ces` unless `NODE_REPL_DISABLE_ANALYTICS` or `BROWSER_USE_DISABLE_AMBIENT_NETWORK` is `1`.

---

## Native IPC (Mac)

`MacNativePipeTransport`:

- Socket default: `~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock` (override `SKY_CUA_SERVICE_NATIVE_PIPE_PATH`)
- Framing: little-endian u32 length + UTF-8 JSON-RPC 2.0, max 8 MiB
- Handshake `ping` must return same `clientApiVersion` (`CodexComputerUseIPC-5`)
- Request params: `{ clientApiVersion, codexTurnMetadata, deadlineUnixMilliseconds, request, requestType }`
- Default timeout 120 s
- If the socket is missing: `nodeRepl.rpc`-less host path calls `ensureService` on `NODE_REPL_HOST_SERVICES_PIPE_PATH`, else `nodeRepl.launchServices.openApplication` with `SKY_CUA_SERVICE_PATH` / `$CODEX_HOME/computer-use/Codex Computer Use.app` / bundle `com.openai.sky.CUAService`

Public request types used by JS:

| JS method | `requestType` |
|---|---|
| `listApps` | `ComputerUseIPCListAppsRequest` |
| `getAppPolicy` | `ComputerUseIPCAppPolicyRequest` |
| `startApp` | `ComputerUseIPCAppStartRequest` |
| `getAppState` | `ComputerUseIPCAppGetSkyshotRequest` |
| actions | `ComputerUseIPCAppPerformActionRequest` |
| audio start/stop | `ComputerUseIPCStartAudioRecordingRequest` / `Stop…` |

Other types in the binary (not used by `@oai/sky` JS): FrontmostWindow, AppStop/Modify, EventStream/Skysight, Messages, Calendar, CodexTurnEnded, capture-animation, etc. Those are sibling product surfaces in the same service.

Server error codes (`targets/mac/errors.d.ts`): −10000 … −10020 (`senderProcessNotAuthenticated` … `screenLocked`). `blockedURL` (−10015) ends the session if Computer Use hits a disallowed browser URL.

---

## Plugin / skill overlay vs types

| Source | What it adds |
|---|---|
| `types/window/*.d.ts` | Canonical public Mac API |
| `docs/sky-window-api.md` | Same, generated; omits optional audio |
| `docs/skills/oai_sky_lib/macos/SKILL.md` | Model workflow; **omits `paste` and `target`**; scroll `element_index` required in the skill snippet (types make it optional) |
| `plugins/.../computer-use/.codex-plugin/computer-use-node-repl.md` | Full Mac API including paste; identifier = display name **or path or bundle id**; implicit launch; AX diff; screenshot `file://`; confirmations policy |
| `plugins/.../computer-use/skills/computer-use/SKILL.md` | Confirmations policy only (no API) |
| `docs/skills/oai_sky_lib/windows/SKILL.md` | Window2 workflow + API |
| `docs/skills/oai_sky_lib/linux/SKILL.md` | Full-desktop workflow + API |
| tinysky-alt | Binds `app` once; `getAXState` / `click(index|[x,y])` etc. Only if `sky.target === "mac"` |

macos SKILL.md in `@oai/sky/docs` is slightly stale vs types (no paste). Trust **types + computer-use-node-repl.md** for Mac.

---

## Two Mac client layers (do not confuse)

| Layer | Names | Extra |
|---|---|---|
| Public `sky` | snake_case, `element_index`, `from_x` | policy, instruction prefix, list_apps reshape |
| `MacComputerUseClient` | camelCase, `elementIndex`, `fromX` | `getAppPolicy`, `startApp`, `apiVersion`, `timeoutSeconds`, numeric mouse buttons 0/1/2 |

`cua.getApp` (tinysky-alt) is a third layer on top of public `sky`, Mac-only.

---

## `vendor/sky` vs the real package

`codex-cua-reverse/vendor/sky` only copied **window** types + `SkyClient.d.ts` (which still *mentions* window2/full-desktop imports that are **missing** in that vendor tree). The complete union lives in ChatGPT.app `@oai/sky` and is copied here under `d.ts/`.
