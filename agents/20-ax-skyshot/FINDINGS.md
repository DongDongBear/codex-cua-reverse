# FINDINGS — AX tree + skyshot as the model actually sees it

Scope: local sources in ChatGPT.app / `codex-cua-reverse/vendor`, plus `function_call_output` items in `/Users/dongdong/Desktop/codex拦截-两轮-raw.json` (not just `function_call` arguments). Trees truncated. No screenshot binaries.

## Verdict

The model never sees a JSON accessibility tree, a `file://` PNG, or a `{url, detail}` image object.

It sees a **`js` tool result** whose `function_call_output.output` is an **array of Responses content parts**:

| Part | When |
|---|---|
| `input_text` `"Wall time: N.NNNN seconds\nOutput:"` | every `js` exec (Rust `node_repl` wrapper) |
| `input_text` AX / docs / `nodeRepl.write` blobs | one part per write / named output |
| `input_image` `{ image_url: "data:image/jpeg;base64,…" }` | every `nodeRepl.emitImage` after host recode |

AX is **tab-indented indexed text**. Element indices are the integers the model later passes to `click(n)` / `setValue(n, …)`. Screenshots are **always JPEG data URLs** on the wire the model reads, even when JS captured PNG.

Two renderers produce almost the same grammar:

1. **Browser / IAB** — JS snapshot → `browser-accessibility.wasm` `buildRevision` → header `Browser tab: …`.
2. **Native Mac** — `SkyComputerUseService` `AccessibilityTreePresentation` via IPC `ComputerUseIPCAppGetSkyshotRequest` → header `Window: "…", App: …`.

---

## 1. What the model greps (`getAXState` return text)

`getAXState()` returns a `string`. With default `{emit: true}` tinysky also `nodeRepl.write(text, "cua.state")`. The model greps that string (or a `nodeRepl.write` subset if `{emit:false}`).

### 1.1 Line grammar (full tree)

```
<HEADER>
<id><SP><role>[ <name>][, <ATTR>: <val>]…
<TAB-indented children>
The focused UI element is <same line grammar>
```

- Indentation is **literal `\t`**, one tab per depth. Root (`0` or the current menu root) has no tabs.
- Index is a **non-negative decimal integer**, then a single space, then a role token that may contain spaces (`text field`, `pop up button`, `standard window`, `AXWebArea`).
- Accessible name is the remainder before the first `, Attr:`.
- Attributes are comma-separated `Key: value` plus parenthetical flags.

Observed attribute tokens (browser Form page + native Linear):

| Token | Meaning |
|---|---|
| `Description:` | AX description / aria |
| `Value:` | current value (truncated with `…` when long) |
| `ID:` | DOM id **or** native action selector (`itemSelected:`, `performMiniaturize:`) |
| `URL:` | link / web area URL (often truncated) |
| `Help:` | native help text |
| `Secondary Actions:` | extra AX actions; **must be copied verbatim** into `performSecondaryAction` |
| `(settable)` | `setValue` allowed |
| `(settable, integer)` | numeric settable |
| `(disabled)` `(collapsed)` `(expanded)` `(selected)` | state flags |

Roles are **not** always ARIA names. Browser WASM emits mixed Chrome AX + ARIA (`AXWebArea`, `container`, `text field`, `combo box`, `heading`, `link`, `checkbox`, `button`, `image`, `menu`). Native emits AppKit-ish names (`standard window`, `menu bar`, `full screen button`, `HTML content`, `text entry area`, `pop up button`).

IDs are **session-monotonic**. Removed nodes are not reused; new widgets get 4521+ while 323 still exists. Actions must use an id from the **latest** tree/diff, not from an earlier full dump.

### 1.2 Headers (renderer-specific)

**Browser** (JS wraps WASM text):

```
Browser tab: ${tab.id}, Title: ${JSON.stringify(title??"Unknown")}, URL: ${JSON.stringify(url??"Unknown")}.
${wasmRevision.text}
```

`tab.id` in the IAB trace is `"1"` (same as tinysky `getTab("1")`). Title/URL are JSON-stringified, so they are quoted.

**Native**:

```
Window: "<key-window title>", App: <display name>.
```

Diffs **omit** that `Window:` line and name the window inside the diff sentence (below).

### 1.3 Diff (default after the first full tree)

WASM string (browser):

```
The following is a diff from the previous accessibility tree with ~ and + representing changed and added elements, respectively. Removed elements are summarized by ID range.
Removed element IDs: 314-315, 317-321, 338, …
+				4521 text * Username :
~				339 text field (settable) * Note :, Value: Hello world!, ID: control-hooks_note
```

Native string (interpolated):

```
The following is a diff from the previous accessibility tree for Window: "New chat" with ~ and + representing changed and added elements, respectively. Removed elements are summarized by ID range.
Removed element IDs: 5-106
+				118 container Create issue
```

Markers:

- `+` + tabs + id — **added**
- `~` + tabs + id — **changed** (same index, new name/value/flags)
- Removals are **not** `-` lines in this build. `feature/axTreeDiffingRemovedElementIDRanges` is on: `Removed element IDs: a-b, c, d-e`.

A third native string exists but was **not** observed in the two-turn capture:

```
The following is a cumulative diff from the initial accessibility tree
```

### 1.4 No-change

| Surface | Exact text |
|---|---|
| Browser WASM | `There has been no change in the accessibility tree.` |
| Native | `There has been no change in the accessibility tree for Window: "<title>".` |

Docs tell the model not to immediately re-call `getAXState()` in this case. Observed: native `getAXStateAndScreenshot` after a no-op still returns this sentence **plus** a JPEG.

### 1.5 Focus footer

Both renderers append:

```
The focused UI element is <id> <role> …
```

This is **inside the same `input_text` blob** as the tree/diff. `{emit:false}` + `filter()` only keeps it if the regex matches that line.

Native multiline values can embed **U+200B** (zero-width space) as a newline stand-in inside `Value:` so the tree stays one-record-per-line.

### 1.6 Redacted samples from `function_call_output` (not arguments)

Source: `codex拦截-两轮-raw.json` task frames, `response.create.input[]` items with `type: "function_call_output"`.

**Browser full tree** (`cua.getTab` initial dump, ~119k chars / 3058 tree lines). Truncated:

```
Browser tab: 1, Title: "Form - Ant Design", URL: "https://ant.design/components/form".
0 AXWebArea Form - Ant Design, URL: ant.design/componen…
	1 container root
		2 container
			3 heading logo Ant Design, Value: 1
				4 link Description: logo Ant Design, Value: ant.design/
			5 container
				6 image Search
				7 text field (settable) form
			8 menu
				9 Design
…
The focused UI element is 82 link Description: Form, URL: ant.design/componen…
```

**Browser diff** after empty Submit (indices the model then typed into):

```
Browser tab: 1, Title: "Form - Ant Design", URL: "https://ant.design/components/form".
The following is a diff from the previous accessibility tree with ~ and + representing changed and added elements, respectively. Removed elements are summarized by ID range.
Removed element IDs: 314-315, 317-321, …
+				4521 text * Username :
+				4522 container
+					4523 text field (settable) * Username : * Username :
+					4524 text Please input your username!
…
The focused UI element is 325 button Submit
```

**Filtered `{emit:false}` write** (model grepped its own subset; header stripped):

```
+					4535 text * Note :
~				340 text field (settable) * Note :, Value: Hi, lady!, ID: control-hooks_note
+					4536 text * Gender :
+					4538 text female
The focused UI element is 4541 combo box (collapsed) * Gender :, Secondary Actions: Expand
```

**Native full tree** (`cua.getApp("Linear")` / later rebind). Truncated:

```
Window: "YOU-24844 Sandbox", App: Linear.
0 standard window YOU-24844 Sandbox, Secondary Actions: Raise
	1 container YOU-24844 Sandbox
		2 container
	3 close button
	4 full screen button Help: this button also has an action to zoom the window, Secondary Actions: zoom the window
	5 minimize button
6 menu bar
	7 Linear
	8 File
```

The model copied `Raise` and `zoom the window` into `performSecondaryAction(0, "Raise")` / `(4, "zoom the window")`.

**Native no-change + screenshot** (`getAXStateAndScreenshot` with unchanged tree):

```
There has been no change in the accessibility tree for Window: "YOU-24844 Sandbox".
```

plus an `input_image` JPEG.

**Native diff** (issue composer). Truncated; title/body values redacted in spirit — keep structure only:

```
The following is a diff from the previous accessibility tree for Window: "New chat" with ~ and + representing changed and added elements, respectively. Removed elements are summarized by ID range.
Removed element IDs: 129, 131
~			128 text field (settable) Description: Issue title, Value: <title>
+				144 text <title>
~			130 text entry area (settable) Description: Issue description, Value: <body…>
```

No `<app_specific_instructions>` in this capture (Linear has no `AppInstructions/*.md`).

---

## 2. How that text is produced

### 2.1 Browser / IAB

```
tab.ax.get("state"|"both", {disableDiffing?})
  → command tab_ax_get_state
      { browser_id, tab_id,
        content: "axState" | "screenshot" | "axStateAndScreenshot",
        disable_diffing? }
  → service t.ax.capture(tabId, content, {disableDiffing}, screenshotFn)
  → captureAX:
       Page.getFrameTree
       DOMSnapshot.captureSnapshot
       iframe walk (deadline; warning: "Iframe in ${frame} accessibility unavailable…")
       nodes[] + warnings[]
       accessibilityCore.buildRevision(prev, snapshot, {mode: disableDiffing?"full":"auto"})
  → rendered = `Browser tab: ${id}, Title: ${JSON.stringify(title)}, URL: ${JSON.stringify(url)}.\n${revision.text}`
```

WASM: `scripts/browser-accessibility.wasm.br` (brotli, ~4.0 MB → ~20 MB). Exports:

- `computer_use_browser_wasm_allocate` / `_deallocate`
- `computer_use_browser_wasm_revision_create` / `_release`
- `computer_use_browser_wasm_revision_text_length` / `_copy_text`
- `computer_use_browser_wasm_revision_identity_length` / `_copy_identity`
- `computer_use_browser_wasm_revision_is_value_settable`

JS JSON.stringifies the snapshot (tab + nodes + warnings) into WASM. Mode is only `"auto"` | `"full"`. Env knobs `TINYSKY_AX_TREE_DIFF_MIN_SAVED_RATIO` / `TINYSKY_AX_TREE_DIFF_MIN_SAVED_BYTES` decide when auto falls back to a full tree.

`tab_ax_get_state` retries once with **forced** `disableDiffing` if capture throws the stale-page error (`xs` / “Accessibility capture belongs to a previous page”).

Screenshot-only (`content: "screenshot"`) **does not** call `captureAX` and **does not** advance `accessibilityRevision`. Docs: “without advancing accessibility state.” After a screenshot-only observation, indices from the last tree remain valid; the next `getAXState()` may still diff.

`captureCandidate` runs AX and screenshot **in parallel** for `"both"`. JS dialogs: screenshot becomes `screenshot_unavailable` string; AX switches to a synthetic dialog tree. `"both"` then returns `{state}` without bytes.

Client `AXAPI` (`browser-client.mjs` class `et`):

```js
async get(mode = "state", options) { … }
async write(mode = "state", options) {
  // write displays; get does not
  mode !== "screenshot" && display(state)
  mode !== "state" && screenshot && display(screenshot)
}
```

`disableDiffing` is omitted from the RPC unless the caller set it (so default is server `"auto"`, not an explicit `false`).

Screenshot bytes: CDP `Page.captureScreenshot({ format: "jpeg", fromSurface: true, optimizeForSpeed: true, quality: 80 })`. Result `data` is raw base64; client `ee()` does `atob` → `Uint8Array`.

### 2.2 Native Mac (skyshot)

```
sky.get_app_state({ app, disableDiff? })
  → withComputerUsePolicy
  → MacComputerUseClient.getAppState
       requestType: "ComputerUseIPCAppGetSkyshotRequest"
       request: { app, disableDiff? }   // undefined fields stripped
  → SkyComputerUseService
       start app session if needed
       settle (~1s, up to 5s on loading)
       key-window SkyshotCapture + RefetchableSkyshotAXTree
       AccessibilityTreePresentation + NextAvailableElementIDIterator
  → MacWindowAppState {
       app, appSpecificInstructions?,
       skyshot: { text, screenshot?: { url?, mimeType? } }
     }
  → window_result(app, result, appsWithDeliveredInstructions) → AppState
```

Native docstring (binary):

> Start an app use session if needed, then get the state of the app's key window and return a screenshot and accessibility tree. This must be called once per assistant turn before interacting with the app

IPC types (binary): `ComputerUseIPCAppGetSkyshotRequest`, `ComputerUseIPCSkyshot`, `ComputerUseIPCSkyshotResult`, `ComputerUseIPCScreenshot`, `ComputerUseIPCAppState`.

Feature flags: `feature/screenshot`, `feature/skyshotClassifier`, `feature/axTreeDiffing`, `feature/axTreeDiffingRemovedElementIDRanges`.

Tinysky `App` Target:

| Method | sky call | emit |
|---|---|---|
| `getAXState(opts)` | `get_app_state({app, disableDiff: opts.disableDiffing})` | `write(text, "cua.state")` |
| `getScreenshot(opts)` | `get_app_state({app})` — **no disableDiff** | `emitImage({bytes, mimeType:"image/png"})` |
| `getAXStateAndScreenshot(opts)` | same as getAXState | text then image |

`cua.getApp` always uses `disableDiff: true` for the first dump.

---

## 3. `disableDiffing` vs `disableDiff`

**Different names. Silent ignore if you mix them.**

| Layer | Flag | Default |
|---|---|---|
| TinySky `StateOptions` / IAB `AXStateOptions` | `disableDiffing?: boolean` | omitted → auto/diff |
| sky `GetAppState.Input` / IPC | `disableDiff?: boolean` | omitted → diff |
| IAB wire `tab_ax_get_state` | `disable_diffing?: boolean` | omitted |
| WASM `buildRevision` | `mode: "auto" \| "full"` | `"auto"` |

Mapper in `create_tinysky_alt.js`:

```js
// tabs
function d(e) {
  return e?.disableDiffing === undefined ? undefined : { disableDiffing: e.disableDiffing };
}
// apps
function a(app, t) {
  return Object.assign({ app }, t?.disableDiffing === undefined ? {} : { disableDiff: t.disableDiffing });
}
```

Passing sky’s `disableDiff` into `tab.getAXState({disableDiff: true})` does **nothing**. Passing CUA’s `disableDiffing` into raw `sky.get_app_state({disableDiffing: true})` does **nothing**.

When to force full:

- first bind: `getApp` / `getTab` / `createBrowserTab` always full
- after screenshot-only observation, before trusting indices
- when the diff is missing context
- `tab_ax_get_state` retry after a navigation invalidates the previous revision

---

## 4. `window_result.js` and `<app_specific_instructions>`

Path: `@oai/sky/dist/project/cua/sky_js/src/targets/mac/window_result.js`.

```js
const SKIP = new Set(["com.apple.iWork.Numbers"]);

export async function window_result(app, result, appsWithDeliveredInstructions) {
  const skyshot = result.skyshot;
  if (skyshot == null) throw new Error("computer-use service did not return a screenshot");
  const url = skyshot.screenshot?.url; // missing / empty → screenshot: null
  if (typeof url === "string" && url.length === 0) { /* null */ }
  return { app, screenshot: url ? { url } : null, text: prefix(app, result, skyshot, appsWithDeliveredInstructions) };
}
```

Prefix rules:

1. `skyshot.text` must be a string (else throw “did not return screenshot text”).
2. `result.appSpecificInstructions` empty/null → return text as-is.
3. If native `result.app.bundleIdentifier` is `com.apple.iWork.Numbers` → **never** prefix (JS skip set). `Numbers.md` still ships in the bundle.
4. Instruction key = bundle id, else native `app` string, else caller `app`.
5. First successful observation per key:

```
<app_specific_instructions>
${nativeMarkdown}
</app_specific_instructions>
${skyshot.text}
```

6. Later observations: raw AX only. The `Set` lives on the JS sky client, so `js_reset` re-delivers instructions (observed: Linear rebind after reset re-emits CUA docs; Linear has no app-instruction file).

Shipped markdown (`Package_ComputerUse.bundle/.../AppInstructions/`): `AppleMusic.md`, `Clock.md`, `iPhone Mirroring.md`, `Notion.md`, `Numbers.md`, `Slack.md`, `Spotify.md`.

`get_app_state.js` is only policy + client + `window_result`. It does not serialize AX.

---

## 5. Screenshot URL: `file://` vs `data:`

Three layers, three representations.

### 5.1 Native → JS (`AppState.screenshot.url`)

- Plugin skill: “in this environment they are always `file://` URLs.”
- `Screenshot.d.ts`: “Screenshot image as a **data URL**.”
- `window_result` accepts any non-empty string; empty → `null`.
- Tinysky reader:

```js
async function v(url) {
  if (url.startsWith("data:")) return Uint8Array.from(Buffer.from(url.split(",")[1] ?? "", "base64"));
  return (await import("node:fs/promises")).readFile((await import("node:url")).fileURLToPath(url));
}
```

So JS is dual-path. The model-facing plugin tells the model to `fs.readFile(fileURLToPath(state.screenshot.url))` **only** on the raw `sky` skill, not on tinysky `getScreenshot()` (that already returns bytes).

### 5.2 Browser → JS

No URL. `tab_ax_get_state.data` is **bare base64** of a **JPEG**. Client `ee()` → `Uint8Array`. `getScreenshot` / `ax.get("screenshot")` return those bytes.

### 5.3 JS → model (`function_call_output`)

`nodeRepl.emitImage` **normalizes to a data URL** in the kernel:

| Input | Kernel `image_url` |
|---|---|
| `data:…` | passed through |
| `file:…` | read file, sniff PNG/JPEG/WebP, wrap `data:${mime};base64,…` |
| `Uint8Array` / Buffer | sniff mime, wrap |
| `{ bytes, mimeType }` | wrap with given mime (tinysky always `"image/png"`) |

Kernel JSONL: `{ type:"emit_image", id, exec_id, image_url }`.

**What the model actually received in this capture:** every image part is

```json
{ "type": "input_image", "image_url": "data:image/jpeg;base64,/9j/4AAQ…" }
```

- `image_url` is a **string**, not `{ url, detail }`.
- MIME is **jpeg**, including native `getScreenshot` which emitted PNG bytes. Host recode happens after `emit_image`.
- No `file://` appears in any `function_call_output`.
- No `detail` field.

Observed JPEG payload sizes (base64 length, not decoded): ~11k (tiny Linear chrome), ~71k, ~110k.

Task 1 (Ant Design IAB) **never** emitted an image. Task 2 used `getScreenshot` once (image only) and `getAXStateAndScreenshot` several times (text then image).

---

## 6. IAB `tab.ax.get("state"|"screenshot"|"both")`

Public API (`api.json`):

```ts
get(mode?: "state", options?: AXStateOptions): Promise<string>
get(mode: "screenshot"): Promise<Uint8Array>
get(mode: "both", options?: AXStateOptions): Promise<{ screenshot?: Uint8Array; state: string }>
write(mode?: "state" | "screenshot" | "both", options?: AXStateOptions): Promise<void>
type AXStateOptions = { disableDiffing?: boolean }
```

Tinysky hides `Tab.ax` from docs (`undocumentedApiMembers: ["Tab.ax"]`) and copies the same three observations onto `Tab` as `getAXState` / `getScreenshot` / `getAXStateAndScreenshot`. Direct `tab.ax.get` still works because `decorateTab` closes over the real tab.

Mapping:

| JS | RPC `content` | Returns | Advances AX revision? |
|---|---|---|---|
| `"state"` (default) | `axState` | string | yes |
| `"screenshot"` | `screenshot` | bytes | **no** |
| `"both"` | `axStateAndScreenshot` | `{state, screenshot?}` | yes |

`write("screenshot")` displays the image and does not write AX. `write("both")` displays **state then image** (same order tinysky uses, same as FCO parts).

If screenshot is missing on `"both"` and `screenshot_unavailable` is set, `get` returns `{state}` without throwing.

---

## 7. Native IPC types vs public `AppState`

```ts
// wire (client.d.ts)
type MacWindowSkyshot = {
  text: string;
  screenshot?: { url?: string | null; mimeType?: string | null } | null;
};
type MacWindowAppState = {
  app: AppIdentifier | { bundleIdentifier?: string; pid?: number };
  appSpecificInstructions?: string | null;
  skyshot?: MacWindowSkyshot;
};

// public (@oai/sky)
type AppState = {
  app: AppIdentifier;          // echo of CALLER string, not rewritten bundle id
  screenshot: { url: string } | null;
  text: string;                // possibly prefixed
};
```

`window_result` **throws** if `skyshot` is missing (“did not return a screenshot”) even for text-only use. Screenshot URL may still be null.

`elementID` on actions is `String(elementIndex)` (decimal). Coordinates are app-window screenshot space.

---

## 8. How FCO parts are assembled (model-visible)

Kernel `exec_result` has `output`, `named_outputs` (`write(value, itemId)`), `content_items` (images). Codex packs them as:

```
function_call_output: {
  type, id, call_id,
  output: [ input_text | input_image, ... ],
  internal_chat_message_metadata_passthrough
}
```

Typical shapes from the two-turn capture:

| Call | Parts |
|---|---|
| first `getBrowser` | wall, `## Computer Use` (cua.core), `# Other Browser APIs` (cua.browser) |
| `listTabs` | wall, JSON array |
| `getTab` / `getAXState` full | wall, AX blob (~119k) |
| `getAXState` diff | wall, short AX diff |
| `{emit:false}` + `nodeRepl.write(filter)` | wall, filtered lines only |
| extra `nodeRepl.write(dev.logs)` | wall, AX, logs JSON (3 texts) |
| `getScreenshot` | wall, **image only** |
| `getAXStateAndScreenshot` | wall, AX (or no-change sentence), image |
| `js_reset` | wall, `js kernel reset` |
| `getApp` after reset | wall, Computer Use docs, AX |

`itemId` values `"cua.core" | "cua.browser" | "cua.state"` are **not** visible in the model-facing parts; they only group writes on the host.

---

## 9. Name map (so a later agent does not mix APIs)

```
model:  tab.getAXState({disableDiffing})
     →  tab.ax.get("state", {disableDiffing})
     →  tab_ax_get_state { content:"axState", disable_diffing }
     →  WASM buildRevision mode full|auto
     →  string  "Browser tab: …"

model:  app.getAXState({disableDiffing})
     →  sky.get_app_state({app, disableDiff})
     →  ComputerUseIPCAppGetSkyshotRequest {app, disableDiff}
     →  window_result  AppState.text
     →  string  "Window: …"  or diff/no-change

model:  getAXStateAndScreenshot
     →  same capture + emitImage
     →  FCO  [wall, ax text, jpeg]

model:  getScreenshot
     →  capture without AX (browser) / get_app_state without disableDiff (native)
     →  FCO  [wall, jpeg]
```

---

## 10. Source index

| Path | Role |
|---|---|
| `/Applications/ChatGPT.app/.../@oai/browser-desktop/scripts/browser-client.mjs` | `AXAPI` get/write; `tab_ax_get_state` schema; `ee()` base64→bytes |
| `.../browser-desktop/scripts/browser-service.mjs` | `capture` / `captureAX` / `captureCandidate` / JPEG `Page.captureScreenshot` / WASM loader |
| `.../browser-desktop/scripts/browser-accessibility.wasm.br` | tree + diff + focus footer |
| `.../@oai/cua/.../tinysky_alt/create_tinysky_alt.js` | `disableDiffing`→`disableDiff`; emit `cua.state` + `emitImage` |
| `.../@oai/sky/.../targets/mac/client.js` | `ComputerUseIPCAppGetSkyshotRequest` |
| `.../@oai/sky/.../targets/mac/window_result.js` | skyshot → AppState; instruction prefix; Numbers skip |
| `.../@oai/sky/.../targets/mac/get_app_state.js` | policy wrapper |
| `.../Codex Computer Use.app/.../SkyComputerUseService` | native AX presentation + skyshot |
| `.../AppInstructions/*.md` | native first-use prefix body |
| `codex-cua-reverse/vendor/plugins/computer-use/computer-use-node-repl.md` | model-facing `file://` screenshot recipe |
| `codex-cua-reverse/_tmp/node_repl_js/worker-runtime.js` | `emitImage` data/file/bytes → data URL |
| `/Users/dongdong/Desktop/codex拦截-两轮-raw.json` | model-visible FCO parts |

---

## 11. Open / unresolved

- Host JPEG recode of PNG `emit_image` is observed in FCO but the recoder is in the Rust `node_repl` binary, not in kernel JS.
- Whether native `skyshot.screenshot.url` is `file://` or `data:` on this machine was not dumped (live GetSkyshot failed in earlier verify). Plugin text says `file://`; public type comment says data URL. Model never sees either.
- WASM attribute spelling (`Secondary Actions:`, `(settable)`) is **not** a C string in the wasm (likely UTF-16 / built). Grammar is taken from traces + native C strings.
- Coordinate space (pixels vs points) still unresolved (`agents/02-sky-native/QUESTIONS.md`).
- `disableDiff: false` when `feature/axTreeDiffing` is off: still unanswered; this build has the flag and traces clearly diff.
