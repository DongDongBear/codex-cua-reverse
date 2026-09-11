# FINDINGS — `@oai/cua` tinysky-alt global `cua`

**Verdict.** ChatGPT.app’s Computer Use surface is **not** the package-main `cua` from `@oai/cua` (`dist/lib/js/oai_js_cua/src/cua.js`, a stub with only `initialize` / `computer` / `browsers` / `documentation`). The live global is installed by `@oai/cua/tinyskyAlt` (`…/tinysky_alt/globals.js`): `Reflect.set(globalThis, "cua", …)` plus `export { setupCUA }`. The unified-computer-use plugin banner `await setupCUA({ browser, computer })` before the model runs. `create_tinysky_alt()` then optionally attaches browser methods (`getBrowser` / `createBrowserTab` / `getTab` / `listTabs` / `listBrowsers` / `browsers`) and computer methods (`getApp` / `listApps` / `computer`); those members are **missing** (not stubbed) when the matching `SetupOptions` flag is `false`. `Tab` is a decorated `@oai/browser` `BrowserTab` (`BrowserTab & Target`): Target methods (`click`, `typeText`, `getAXState`, …) are `Object.assign`’d onto each tab and forward to `tab.ax.*`; `tab.playwright` is a native `BrowserTab` field, not added by tinysky-alt. `App` is a Target-only façade over macOS `sky.get_app_state` / `sky.click` / `sky.type_text`. `GetBrowserOptions` is `{ id?: string; url?: string }` with `id` winning, URL `https://` prefixing, and **no tab open**. `initialize()` on the global is `await setupCUA(); return cua.getState()`; ChatGPT.app already ran `setupCUA` in the banner, so `initialize()` is just a second inventory.

---

## 0. Package, versions, two different `cua` objects

Source root: `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/`

`package.json` (`@oai/cua@0.2.4`, author `noahj`):

```json
"main": "dist/lib/js/oai_js_cua/src/index.js",
"exports": {
  ".": "./dist/lib/js/oai_js_cua/src/index.js",
  "./tinyskyAlt": "./dist/lib/js/oai_js_cua/src/tinysky_alt/globals.js"
},
"types": "dist/lib/js/oai_js_cua/src/index.d.ts"
```

| Import | Object | Members |
|---|---|---|
| `@oai/cua` (`index.js` → `cua.js`) | `export const cua` | `initialize()`, `computer`, `browsers`, `documentation` — **no** `getApp` / `getTab` / `getState` helpers, **no** `decorateTab`, **not** installed on `globalThis` |
| `@oai/cua/tinyskyAlt` (`globals.js`) | `globalThis.cua` + `setupCUA` | Full TinySkyAlt API documented below |

ChatGPT.app never uses the package-main object for the model REPL. The plugin at `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/unified-computer-use/resources/banner.js` does:

```javascript
await (await import("@oai/cua/tinyskyAlt")).setupCUA({ browser: true, computer: true });
```

Surfaces are selected by `CUA_REPL_ENABLED_SURFACES` in `scripts/launch.mjs` (`banner.js` / `banner-browser.js` / `banner-computer.js`). Trusted services: `NODE_REPL_TRUSTED_SERVICES` = `{ browser: "@oai/browser-desktop/service", sky: "@oai/sky/service" }`. Runtime: cua_node Node 24.20.0 (`/Applications/ChatGPT.app/Contents/Resources/cua_node/manifest.json`).

Related packages on disk:

- `@oai/browser-desktop@0.1.1` — `scripts/browser-client.mjs` + `./service`
- `@oai/sky@0.6.26` — `dist/project/cua/sky_js/src/index.js` + `./service`
- Bundled copy of the same browser client inside `@oai/cua/dist/lib/js/oai_js_browser/dist/skill/scripts/browser-client.js`

---

## 1. Complete API of global `cua` (`TinySkyAlt`)

Canonical types: `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_cua/src/tinysky_alt/types.d.ts`

```typescript
export interface SetupOptions {
    browser?: boolean;
    computer?: boolean;
}

export type Browsers = GlobalAgentApi<Tab>["browsers"];
export type Browser = Awaited<ReturnType<Browsers["get"]>>;
export type BrowserInfo = Awaited<ReturnType<Browsers["list"]>>[number];
export type TabInfo = Awaited<ReturnType<Browser["tabs"]["list"]>>[number] & { browserId: string };
export type Computer = typeof sky;           // SkyClient = FullDesktop | Window | Window2
export type MacComputer = Extract<Computer, { target: "mac" }>;

export interface ObservationOptions { emit?: boolean }          // default emit = true
export interface StateOptions extends ObservationOptions { disableDiffing?: boolean }
export interface ClickOptions { mouseButton?: MouseButton; clickCount?: number }
export interface SelectTextOptions { prefix?: string; suffix?: string; selectionType?: SelectionType }
export interface PasteOptions { format?: "text" | "md" | "html" }
export interface BrowserOptions { browser?: string }
export interface GetBrowserOptions { id?: string; url?: string }
export interface CreateBrowserTabOptions { visible?: boolean; sessionName?: string }
export interface StateAndScreenshot { state: string; screenshot?: Uint8Array }

export interface AppInfo {
    id: string;
    displayName?: string;
    isRunning?: boolean;
    lastUsedDate?: string;
    useCount?: number;
}
export interface State {
    apps: AppInfo[];
    browsers: Array<BrowserInfo & { tabs: Awaited<ReturnType<Browser["tabs"]["list"]>> }>;
    errors?: string[];   // inventory failures; the other inventory remains usable
}

/** Only enabled providers and their methods are installed. */
export interface TinySkyAlt {
    initialize(): Promise<State>;
    getState?(options?: ObservationOptions): Promise<State>;
    browsers?: Browsers;
    computer?: Computer;
    getBrowser?(options?: GetBrowserOptions): Promise<Browser>;
    createBrowserTab?(browserId: string, url?: string, options?: CreateBrowserTabOptions): Promise<Tab>;
    getTab?(id: string, options?: BrowserOptions): Promise<Tab>;
    listBrowsers?(options?: ObservationOptions): Promise<BrowserInfo[]>;
    listTabs?(options?: BrowserOptions & ObservationOptions): Promise<TabInfo[]>;
    getApp?(target: string): Promise<App>;
    listApps?(options?: ObservationOptions): Promise<AppInfo[]>;
}
```

`create_tinysky_alt.d.ts`: `create_tinysky_alt(options?: SetupOptions): Promise<Omit<TinySkyAlt, "initialize">>`.  
`globals.d.ts`: `setupCUA(options?: SetupOptions): Promise<void>` plus `export type * from "./types"`.

### 1.1 When optional members are **missing**

`create_tinysky_alt.js` gates with `options.browser !== false` and `options.computer !== false` (default **both on**). It does not install stubs.

| `SetupOptions` | Installed on `cua` | Missing |
|---|---|---|
| `{ browser: true, computer: true }` (plugin `banner.js`) | `getState`, `browsers`, `getBrowser`, `createBrowserTab`, `getTab`, `listBrowsers`, `listTabs`, `computer`, `getApp`, `listApps` | — |
| `{ browser: true, computer: false }` (`banner-browser.js`) | browser members + `getState` | `computer`, `getApp`, `listApps` |
| `{ browser: false, computer: true }` (`banner-computer.js`) | `computer`, `getApp`, `listApps`, `getState` | `browsers`, `getBrowser`, `createBrowserTab`, `getTab`, `listBrowsers`, `listTabs` |
| Before `setupCUA()` resolves | only `initialize` (seed object in `globals.js`) | everything else, including `getState` |

`getState` is **not** optional in the implementation: `create_tinysky_alt` always returns `{ getState }` even if both providers are disabled (then `apps: []`, `browsers: []`).

`getApp` / `listApps` are installed whenever `computer !== false`, but they **throw** unless `sky.target === "mac"`:

```text
Native app bindings are unavailable for ${y.target}.
```

On Linux, `get_state` returns `apps: []` (does not throw). On Windows, `get_state` **does** call `sky.list_apps()`, but `cua.getApp` / `cua.listApps` still throw the mac-only error. See QUESTIONS.md.

`browsers?` / `computer?` on the interface are the raw provider objects (`GlobalAgentApi["browsers"]` and `typeof sky`), not Target wrappers.

`initialize` exists only on the `globals.js` wrapper, not on the object `create_tinysky_alt` returns. After `Object.assign(globalCua, created)`, both live on `globalThis.cua`.

Package-main `cua.d.ts` has a **different** shape (`documentation: null | BrowserAgentApi["documentation"]`) that tinysky-alt never copies onto the global.

### 1.2 Side globals `create_tinysky_alt` also installs

When browser is enabled: `Reflect.set(globalThis, "agent", setupBrowserRuntimeResult)` — the raw `@oai/browser` Agent (`{ browsers, documentation }`), **not** the TinySky façade.

`setupCUA` is a singleton: a module-level promise `i`; later calls reuse the first `SetupOptions`.

---

## 2. `Target` / `App` / `Tab`

```typescript
export interface Target {
    getAXState(options?: StateOptions): Promise<string>;
    getScreenshot(options?: ObservationOptions): Promise<Uint8Array>;
    getAXStateAndScreenshot(options?: StateOptions): Promise<StateAndScreenshot>;
    paste(text: string, options?: PasteOptions): Promise<void>;
    click(target: number | Point, options?: ClickOptions): Promise<void>;
    drag(from: Point, to: Point): Promise<void>;
    pressKey(key: string): Promise<void>;
    scroll(target: number | Point, direction: Direction, pages?: number): Promise<void>;
    selectText(elementIndex: number, text: string, options?: SelectTextOptions): Promise<void>;
    setValue(elementIndex: number, value: string): Promise<void>;
    typeText(text: string): Promise<void>;
    performSecondaryAction(elementIndex: number, action: string): Promise<void>;
}
export interface App extends Target {}
export type Tab = BrowserTab & Target;
export type Point = AXPoint;                 // from @oai/browser; api.json: type AXPoint = [unknown, unknown]
export type Direction = AXDirection;         // "up"|"down"|"left"|"right"|"u"|"d"|"l"|"r"
export type MouseButton = AXMouseButton;     // "left"|"right"|"middle"|"l"|"r"|"m"
export type SelectionType = AXSelectionType; // "text"|"cursor_before"|"cursor_after"
```

Model-facing docs (`tinysky-alt-core-*.md`) spell Point as `Vec2 = [x: number, y: number]`. Implementation for **App** `click`/`scroll`/`drag` requires a real `Array` (`Array.isArray(e) ? {x:e[0], y:e[1]} : {element_index: e}`). Passing `{x,y}` (sky `Point`) would be treated as `element_index`. **Tab** Target methods pass the value through to `tab.ax.*` unchanged.

### 2.1 How Tab gets Target methods (`decorateTab`)

`create_tinysky_alt` passes `decorateTab: l` into `setupBrowserRuntime`. In `browser-client.mjs`, every proxied object `instanceof Tab` (`re`) is passed to `decorateTab`. `l(tab)` is:

```javascript
Object.assign(tab, {
  getAXState(opts) { const s = await tab.ax.get("state", diffOpts(opts)); emitText(s, opts); return s; },
  getScreenshot(opts) { const bytes = await tab.ax.get("screenshot"); emitImage(bytes, opts); return bytes; },
  getAXStateAndScreenshot(opts) { const both = await tab.ax.get("both", diffOpts(opts)); ...; return both; },
  paste(text, opts) { /* clipboard.writeText / clipboard.write then tab.ax.pressKey("Ctrl+v") */ },
  click: (t, o) => tab.ax.click(t, o),
  drag: (a, b) => tab.ax.drag(a, b),
  pressKey: (k) => tab.ax.pressKey(k),
  scroll: (t, d, p) => tab.ax.scroll(t, d, p),
  selectText: (i, t, o) => tab.ax.selectText(i, t, o),
  setValue: (i, v) => tab.ax.setValue(i, v),
  typeText: (t) => tab.ax.typeText(t),
  performSecondaryAction: (i, a) => tab.ax.performSecondaryAction(i, a),
})
```

`Tab.ax` is **undocumented / disabled by default** for every backend (`unsupportedByDefaultIn: ["iab","extension","cdp"]` in `api.json`). tinysky-alt re-enables it with `undocumentedApiMembers: ["Tab.ax"]`. The Target methods exist so the model uses `tab.click(42)` instead of `tab.ax.click(42)`.

### 2.2 Native `BrowserTab` fields that remain on `Tab` (not Target)

From `api.json` interface `Tab` and the `re=class` constructor in `browser-client.mjs`:

```text
tab.id: string
tab.playwright: PlaywrightAPI
tab.ax: AXAPI                         // enabled via undocumentedApiMembers
tab.cua: CUAAPI                       // coordinate CUA (click/type/scroll/drag/keypress/move)
tab.dom_cua: DomCUAAPI
tab.clipboard: TabClipboardAPI        // read/readText/write/writeText
tab.content: ContentAPI
tab.dev: TabDevAPI
tab.capabilities: TabCapabilityCollection
tab.goto(url): Promise<void>
tab.back(): Promise<void>
tab.forward(): Promise<void>
tab.reload(): Promise<void>
tab.close(): Promise<void>
tab.markDeliverable(): Promise<void>  // unsupported on cdp
tab.markHandoff(): Promise<void>      // unsupported on cdp
tab.requestManualHandoff(): Promise<void>  // cloud-only
tab.screenshot(options?: ScreenshotOptions): Promise<Uint8Array>
tab.title(): Promise<string | undefined>
tab.url(): Promise<string | undefined>
tab.getJsDialog(): Promise<Dialog | undefined>
```

Model docs (`tinysky-alt-core-*.md`) only list Target + `id` / `goto` / `back` / `forward` / `reload` / `close` / `markDeliverable` / `markHandoff`. Playwright and the rest are pushed via `tinysky-alt-other-browser-apis.md` on first browser use.

### 2.3 How App gets Target methods

`getApp(name)` requires `sky.target === "mac"`, then:

1. `sky.get_app_state({ app: name, disableDiff: true })`
2. Bind Target methods to the **resolved** `state.app` identifier (not the original display name)
3. Emit `state.text` as the initial full AX tree (`nodeRepl.write(..., "cua.state")`)
4. Return the Target object (no extra fields)

App method → sky mapping (camelCase Target → snake_case sky window API):

| Target | sky call |
|---|---|
| `getAXState(opts)` | `sky.get_app_state({ app, disableDiff: opts.disableDiffing })` → emit+return `.text` |
| `getScreenshot(opts)` | `sky.get_app_state({ app })`; if `.screenshot === null` throw; else load `.screenshot.url` (data: or file:) as `Uint8Array`, emit PNG |
| `getAXStateAndScreenshot` | one `get_app_state`; `{ state }` if no screenshot, else `{ state, screenshot }` |
| `paste(text, {format})` | `sky.paste({ app, text, format: format ?? "text" })` — restores clipboard |
| `click(i \| [x,y], {mouseButton, clickCount})` | `sky.click({ app, element_index \| x,y, mouse_button, click_count })` |
| `drag([x1,y1],[x2,y2])` | `sky.drag({ app, from_x, from_y, to_x, to_y })` |
| `pressKey(key)` | `sky.press_key({ app, key })` |
| `scroll(i \| [x,y], dir, pages?)` | `sky.scroll({ app, element_index \| x,y, direction, pages })` |
| `selectText(i, text, {prefix,suffix,selectionType})` | `sky.select_text({ app, element_index, text, prefix, suffix, selection_type })` |
| `setValue(i, value)` | `sky.set_value({ app, element_index, value })` |
| `typeText(text)` | `sky.type_text({ app, text })` |
| `performSecondaryAction(i, action)` | `sky.perform_secondary_action({ app, element_index, action })` |

Sky `GetAppState.Input.app` comment: “App id, display name, process name, or other supported app identifier from `list_apps()`.” `list_apps.js` canonical `id` is `bundleIdentifier ?? displayName ?? "unknown"`.

### 2.4 Tab `paste` vs App `paste`

Tab:

- `format` default `"text"`
- if `format==="text"` and `tab.clipboard.writeText`: `writeText(text)` then `tab.ax.pressKey("Ctrl+v")`
- else if `tab.clipboard.write` missing: `format==="text"` → `tab.ax.typeText(text)`; otherwise throw `Browser clipboard does not support ${format} paste.`
- else `clipboard.write([{ entries: html ? [text/html + text/plain] : [text/plain] }])` then `Ctrl+v`
- **`md` is written as `text/plain`** (matches docs: “md format inserts Markdown source as plain text”)
- **does not restore** the previous clipboard
- always `Ctrl+v`, including on macOS (see QUESTIONS.md)

App: `sky.paste` “then restore the previous clipboard contents.”

---

## 3. `GetBrowserOptions`

```typescript
export interface GetBrowserOptions { id?: string; url?: string }
```

Runtime (`create_tinysky_alt.js` `getBrowser` + helper `g`):

1. `url` is rewritten: `url === undefined || URL.canParse(url) ? url : "https://" + url`
2. Browser selection, **in this order**:
   - if `options.id` is defined → `browsers.get(id)` (`Browsers.get(id: string): Promise<Browser>` — “by id **or client type**”, so `"iab"` / `"chrome"` / `"edge"` work)
   - else if rewritten `url` is defined **and** `browsers.getForUrl` exists → `browsers.getForUrl(url)` (api.json: `documented: false`)
   - else if `browsers.getDefault` exists → `browsers.getDefault()` (`documented: false`)
   - else `browsers.list()[0]`; if none, throw `"No browser is available."`; then `browsers.get(first.id)`
3. `id` **takes precedence over `url`** (docs and code agree). If `id` is set, `url` is ignored for selection.
4. If `nodeRepl.write` exists, await `browser.documentation()` (cached per `browserId`; cache entry deleted if the promise rejects).
5. Emit first-use docs (`cua.core` / `cua.browser`) with `{ browser }` and **no state payload**.
6. **Does not open a tab.** Caller is supposed to keep `browser.browserId` for `createBrowserTab`.

`Browser` (from api.json, the object `getBrowser` returns) is **not** a Target:

```text
browser.browserId: string
browser.capabilities: BrowserCapabilityCollection   // get(id), list()
browser.tabs: Tabs                                  // get/list/new/selected[/content]
browser.user?: BrowserUser                          // openTabs/claimTab; unsupported on iab, cdp
browser.documentation(): Promise<string>
browser.history(options): Promise<BrowserHistoryEntry[]>   // unsupported iab, cdp
browser.nameSession(name: string): Promise<void>
```

Model docs shrink this to `{ readonly browserId: string; documentation(): Promise<string> }`. The extra members are on the live object.

---

## 4. `initialize()`

Three different `initialize` functions exist. Only one is the global.

### 4.1 Global tinysky-alt (`globals.js`) — this is `cua.initialize`

```javascript
const cua = {
  initialize() {
    return (async () => {
      await setupCUA();          // singleton create_tinysky_alt
      return cua.getState();     // now assigned onto cua
    })();
  }
};
function setupCUA(options = {}) {
  if (setupPromise == null)
    setupPromise = create_tinysky_alt(options).then(api => { Object.assign(cua, api); });
  return setupPromise;
}
Reflect.set(globalThis, "cua", cua);
export { setupCUA };
```

Effects of `initialize()`:

1. Ensure providers are created (no-op if banner already `await setupCUA(...)`).
2. Return and emit a fresh `State` inventory (same as `getState()`).

`create_tinysky_alt` itself **emits core docs on construction** (`yield p.emit()` with empty payload) **before** returning. So:

- Plugin banner `setupCUA` already dumped `tinysky-alt-core-cua-repl.md` (+ confirmations) into `cua.core`.
- A later `cua.initialize()` / `cua.getState()` only dumps inventory (`cua.state`), not core docs again (`i` first-use flag).

### 4.2 `create_tinysky_alt` does **not** return `initialize`

Typed as `Promise<Omit<TinySkyAlt, "initialize">>`. Inventory is **not** collected at construction time except for the empty first `emit()` of docs.

### 4.3 Package-main `cua.initialize` (`cua.js`) — unused by the plugin

```javascript
initialize: async () => {
  const runtime = await setupBrowserRuntime({ undocumentedApiMembers: ["Tab.ax"] });
  cua.computer = sky;
  cua.browsers = runtime.browsers;
  cua.documentation = runtime.documentation;
  return get_state({ browsers: runtime.browsers, computer: sky });
}
```

Differences vs tinysky-alt: no `decorateTab`, no `excludedDocumentation`, no Target helpers, no `getApp`/`getTab`, assigns `documentation`, always enables both providers, does not set `globalThis.cua`.

### 4.4 What ChatGPT.app actually tells the model to call first

`unified-computer-use/resources/js-tool-description.md`: first call (or after reset) should be **exactly one** of `cua.getState()` or a bind entry point (`getApp` / `getTab` / `createBrowserTab` / `getBrowser`). It never mentions `initialize()`.

`tinysky-alt-core-cua-repl.md` (the doc `create_tinysky_alt` injects by default) also **omits** `initialize()`, `browsers`, and `computer` from the `declare const cua` block.

`tinysky-alt-core-node-repl.md` **includes** `initialize(): Promise<State>` and tells the model to use `cua.initialize()` to pick a target. That file is only loaded if `nodeRepl.env.TINYSKY_ALT_INITIALIZE_DOCS === "core-node-repl"`. ChatGPT.app does not set that env; default is `"core-cua-repl"`.

---

## 5. `create_tinysky_alt.js` behavior (full wiring)

File: `…/tinysky_alt/create_tinysky_alt.js` (9304 bytes, one line). Pretty copy: `copies/oai_js_cua/tinysky_alt/create_tinysky_alt.pretty.js`.

### 5.1 Docs source

```javascript
function docsKey() {
  return globalThis.nodeRepl?.env?.TINYSKY_ALT_INITIALIZE_DOCS ?? "core-cua-repl";
}
```

`documentation.js` resolves `@oai/cua/docs/` by walking up from `import.meta.url` until `package.json`, then `readFile(docs/tinysky-alt-${source}.md)`. Confirmation policy: `nodeRepl.requestMeta["openai/confirmation_policies"].computer_use` if it is a non-empty string ≤ 12000 UTF-8 bytes; else `tinysky-alt-confirmations.md`.

### 5.2 Parallel provider load

```javascript
[browserRuntime, sky] = await Promise.all([
  options.browser !== false
    ? import(".../browser-client.js").then(({ setupBrowserRuntime }) =>
        setupBrowserRuntime({
          decorateTab,
          undocumentedApiMembers: ["Tab.ax"],
          excludedDocumentation: docsKey() === "core-cua-repl" ? ["confirmations"] : [],
        }))
    : undefined,
  options.computer !== false
    ? import(".../sky_js/src/index.js").then(({ sky }) => sky)
    : undefined,
]);
await emitter.emit(); // first-use core docs
```

`setupBrowserRuntime` (from `browser-client.mjs`):

- Requires `globalThis.nodeRepl.rpc`.
- `rpc("browser", { method: "setup", params: { environment: options.environment ?? "codex-app", undocumentedApiMembers, excludedDocumentation } })`
- Builds an Agent whose Tab proxies call `decorateTab`.
- Display bridge: `displayImage → nodeRepl.emitImage`, `displayValue → console.log`.

### 5.3 Emitter channels (`nodeRepl.write`)

Serial promise chain. Three channels:

| Channel | When | Payload |
|---|---|---|
| `"cua.core"` | first emit only | `tinysky-alt-${docsKey}.md` plus, if `core-cua-repl`, confirmation policy |
| `"cua.browser"` | first time a `{ browser }` is passed to emit | `tinysky-alt-other-browser-apis.md` (once) + `browser.documentation()` (once per `browserId`) |
| `"cua.state"` | if `options.emit !== false` and payload is non-empty | string as-is, else `JSON.stringify(value)` |

`{ emit: false }` suppresses **state** only. First-use docs still write. If `nodeRepl.write` is missing, emit is a no-op.

Images: `nodeRepl.emitImage({ bytes, mimeType: "image/png" })` when `emit !== false`.

### 5.4 `selectBrowser` helper used by getBrowser / getTab / createBrowserTab / scoped listTabs

See §3. Also prefetches `browser.documentation()` into a `Map<browserId, Promise<string>>` so the later emit can dump it.

### 5.5 `bindTabAndDumpFullAX(tab, browser)`

Used by `createBrowserTab` and `getTab`:

```javascript
const text = await tab.getAXState({ disableDiffing: true, emit: false });
await emitter.emit(text, { browser });
return tab;
```

That is why “create a tab or get an app, the initial UI state is automatically included.”

---

## 6. Method map (required)

### `cua.getState(options?: ObservationOptions): Promise<State>`

Always installed. Implementation: `get_state({ browsers: runtime?.browsers, computer: sky })` then emit JSON.

`get_state.js`:

- Apps: if no computer → `[]`; `target "mac"|"windows"` → `computer.list_apps()`; `target "linux"` → `[]`; else `UnreachableCaseError`.
- Browsers: if no provider → `[]`; else `browsers.list()` then for each id `browsers.get` + `get_browser_tabs`.
- `Promise.allSettled`; failed side becomes `[]` plus `errors: ["Native apps: …" | "Browsers: …"]`.

`get_browser_tabs(browser)`: union of `browser.user.openTabs()` (errors → `[]`) and `browser.tabs.list()`, keyed by `id` (controlled tabs overwrite user tabs).

Does **not** claim tabs. Does **not** dump per-tab AX.

### `cua.getBrowser(options?: GetBrowserOptions): Promise<Browser>`

Missing if `browser: false`. See §3. Emits docs, returns Browser, no tab.

### `cua.createBrowserTab(browserId, url?, options?: CreateBrowserTabOptions): Promise<Tab>`

Missing if `browser: false`.

```text
createBrowserTab(browserId: string, url?: string, options?: { visible?: boolean; sessionName?: string }): Promise<Tab>
```

1. `browserId` must be a non-empty trimmed string, else throw `"createBrowserTab requires a browser ID. Select one with cua.getBrowser()."`
2. URL `https://` prefix if not `URL.canParse`.
3. `selectBrowser({ browser: browserId })` — so names like `"iab"` / `"chrome"` work (plugin `browser-description.md` says pass the name directly; do not call `getBrowser` first).
4. If `options.sessionName` is defined: require `typeof browser.nameSession === "function"`, else throw `Browser ${id} does not support sessionName.`; then `nameSession(sessionName)`.
5. If `options.visible` is defined: `(await browser.capabilities.get("visibility")).set(visible)` (capability API: `get(): Promise<boolean>; set(visible: boolean): Promise<void>`). Omitted `visible` leaves current visibility. Unsupported capability throws (docs: “omitted settings stay unchanged, unsupported settings throw”).
6. `tab = await browser.tabs.new()`.
7. If url defined: `await tab.goto(url)`.
8. Full AX dump via `bindTabAndDumpFullAX`.

IAB: `{ visible: true|false }`. Chrome/Edge: `{ sessionName: "🔎 Task" }`.

### `cua.getTab(id: string, options?: BrowserOptions): Promise<Tab>`

Missing if `browser: false`. `BrowserOptions = { browser?: string }`.

1. Falsy `id` → `"getTab requires a tab id"`.
2. `selectBrowser(options)` — if `options.browser` omitted, falls through to getDefault / first listed (can pick the wrong browser).
3. Search `browser.tabs.list()` for `t.id === id || t.providerTabId === id`. If hit: `tabs.get(hit.id)` then full AX dump.
4. Else if `browser.user.openTabs` and `browser.user.claimTab` exist: search user tabs the same way. If already in the controlled list, `tabs.get`; else `user.claimTab(userTab)` (claims a user tab into the agent session). Then full AX dump.
5. Else throw ``Tab not found: ${id} in browser ${browser.browserId}``.

`listTabs` does **not** claim. `getTab` does.

### `cua.listTabs(options?: BrowserOptions & ObservationOptions): Promise<TabInfo[]>`

Missing if `browser: false`.

- No `options.browser`: `browsers.list()`, then `browsers.get(each.id)` + `get_browser_tabs`, stamp `browserId`.
- With `options.browser`: `selectBrowser(options)` (also prefetches that browser’s docs), then tabs for that one browser.
- Emit the flat array. Scoped calls also pass `{ browser }` into the emitter so first-use browser docs appear.

Each row is `TabInfo` (`id`, `providerTabId?`, `title?`, `url?`) plus `browserId: string`.

### `cua.listBrowsers(options?: ObservationOptions): Promise<BrowserInfo[]>`

Missing if `browser: false`. `browsers.list()` then emit. `BrowserInfo`:

```text
{ id: string; name?: string; family?: string; type?: "iab"|"extension"|"cdp";
  profileName?: string; metadata?: { extensionInstanceId?: string; codexSessionId?: string } }
```

(api.json `list()` types `name` and `type` as required; tinysky `BrowserInfo` and the model docs make them optional.)

### `cua.getApp(target: string): Promise<App>`

Missing if `computer: false`. Throws if `sky.target !== "mac"`. See §2.3. Emits initial full AX (`disableDiff: true`). Auto-launches the app in the background if needed (model docs; sky `get_app_state` side effect).

### `cua.listApps(options?: ObservationOptions): Promise<AppInfo[]>`

Missing if `computer: false`. Throws if not mac. `sky.list_apps()` then emit.

### `target.click` / `target.typeText` / `target.getAXState`

| | Tab | App |
|---|---|---|
| `click(n \| [x,y], {mouseButton?, clickCount?})` | `tab.ax.click` (`AXAPI.click(target: number \| AXPoint, options?: AXClickOptions)`) | `sky.click` with `element_index` or `x,y` + `mouse_button` / `click_count` |
| `typeText(text)` | `tab.ax.typeText(text)` — “into the currently focused element” | `sky.type_text({ app, text })` |
| `getAXState({emit?, disableDiffing?})` | `tab.ax.get("state", {disableDiffing}? )` then `write(text, "cua.state")` unless `emit===false` | `sky.get_app_state({ app, disableDiff: disableDiffing })` → `.text` |

AXAPI `get` overloads (api.json):

```text
get(mode?: "state", options?: AXStateOptions): Promise<string>
get(mode: "screenshot"): Promise<Uint8Array>
get(mode: "both", options?: AXStateOptions): Promise<{ screenshot?: Uint8Array; state: string }>
```

`AXStateOptions = { disableDiffing?: boolean }`. Default is a **diff** against the previous tree. `{ disableDiffing: true }` forces a full tree. `createBrowserTab` / `getTab` / `getApp` always request a full tree for the initial dump.

### `tab.playwright` — **not** on `cua`, **not** copied by `decorateTab`

Constructor of `Tab` (`re=class` in `browser-client.mjs`):

```javascript
this.playwright = new Ke({ browserId, tabId: this.id, transport });
this.dom_cua = new Ye(...);
this.cua = new Qe(...);
this.ax = new et(...);
```

`PlaywrightAPI` (api.json) — this is the “other browser API” tinysky-alt-other-browser-apis.md points at:

```text
domSnapshot(): Promise<string>
elementInfo(options: ElementInfoOptions): Promise<ElementInfo[]>          // documented: false
elementScreenshot(options: ElementScreenshotOptions): Promise<Uint8Array> // documented: false
evaluate<TResult, TArg>(pageFunction, arg?, options?): Promise<TResult>
expectNavigation<T>(action, { timeoutMs?, url?, waitUntil? }): Promise<T>
frameLocator(frameSelector: string): PlaywrightFrameLocator
getByLabel(text, { exact? }): PlaywrightLocator
getByPlaceholder(text, { exact? }): PlaywrightLocator
getByRole(role, { exact?, name? }): PlaywrightLocator
getByTestId(testId: string): PlaywrightLocator
getByText(text, { exact? }): PlaywrightLocator
locator(selector: string): PlaywrightLocator
waitForEvent("download", options?): Promise<PlaywrightDownload>
waitForEvent("filechooser", options?): Promise<PlaywrightFileChooser>
waitForLoadState(options: { state?: LoadState; timeoutMs? }): Promise<void>
waitForTimeout(timeoutMs: number): Promise<void>
waitForURL(url: string, options: { timeoutMs?; waitUntil? }): Promise<void>
```

`PlaywrightLocator` includes `click/fill/type/press/locator/getBy*/filter/first/last/nth/and/or/waitFor/evaluate/…` (full list in `copies/browser/references/api.json`). This is a **Codex Playwright subset** over CDP (`browser-service.mjs` injects `__codexPlaywrightInjected`), not stock `playwright` npm `Page`.

tinysky-alt-other-browser-apis.md: use Playwright when AX is insufficient or for long/repetitive tasks where element indices go stale; locators are more verbose, so only when they collapse several `getAXState()` round-trips.

---

## 7. `cua.browsers` and `cua.computer` (raw providers)

Installed only when the matching flag is on. Model-facing `core-node-repl.md` documents a reduced `BrowserProvider { list(); get(id) }` and:

```typescript
interface Computer {
  target: "linux" | "mac" | "windows";
  drag_handle?(): DragHandle;
  get_screenshot?(): Promise<Screenshot[]>;
  move?(point: Point): Promise<void>;
}
```

Live `sky` is a `SkyClient` union:

- mac `WindowComputerUseClient`: `list_apps`, `get_app_state`, `click`, `drag`, `paste`, `press_key`, `scroll`, `select_text`, `set_value`, `type_text`, `perform_secondary_action`, optional audio
- linux `FullDesktopComputerUseClient`: `click`, `drag`, `drag_handle`, `get_screenshot`, `move`, `press_key`, `scroll`, `type_text` — **no** `get_app_state` / `list_apps`
- windows `Window2ComputerUseClient`: `list_apps`, `list_windows`, `get_window`, `get_window_state`, `launch_app`, `activate_window`, … — **no** `get_app_state`

`sky.js` is a lazy RPC proxy: `nodeRepl.rpc("sky", { type: "setup"|"execute", method, args })`. `load_options.js`: `darwin→mac`, `linux→linux`, `win32→windows`, or `OAI_SKY_CONFIG_PATH` JSON.

`cua.browsers` is the full `Browsers` object (`get` / `getDefault` / `getForUrl` / `list`), not the two-method docs shape.

---

## 8. ChatGPT.app plugin wiring (how the model meets this API)

`/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/unified-computer-use/`

- MCP server `cua_repl` → `scripts/launch.mjs` → `CUA_REPL_NODE_REPL_PATH` (`cua_node/bin/node_repl`)
- `NODE_REPL_JS_BANNER` = `setupCUA({ browser, computer })` so `globalThis.cua` is fully assigned before user JS
- Tool description concatenates `js-tool-description.md` + `browser-description.md` + `computer-description.md` + `js-output-description.md`
- First-use CUA docs still come from `create_tinysky_alt`’s emitter (`core-cua-repl` + confirmations + other-browser-apis)
- `js_reset` discards JS bindings, not OS/browser state; next call re-runs the banner
- Output: `nodeRepl.write` / `nodeRepl.emitImage`; observation methods already emit — wrapping them duplicates

`browser-description.md` entry-point order (ChatGPT.app specific, slightly different from `core-node-repl.md`):

1. Tab @-mention → `getState` then `getTab(tabId, { browser: browserId })`
2. Known tab id + browser → `getTab`
3. Known URL + in-app browser → `createBrowserTab("iab", url, { visible })`
4. Known URL + named browser → `createBrowserTab(browserName, url, options)` **without** `getBrowser`
5. Known URL, unspecified browser → `getBrowser({ url })`

---

## 9. AX / screenshot emit contract (shared)

- Default `emit: true` writes to the tool result. `{ emit: false }` returns the value without writing.
- `getAXState` / `getScreenshot` / `getAXStateAndScreenshot` internally wait; model docs forbid `setTimeout` before observing.
- After a screenshot-only observation, indices are stale until a full tree (`disableDiffing: true` or a mutating action + `getAXState`).
- `cua.getApp` / `getTab` / `createBrowserTab` auto-dump a **full** tree (`disableDiffing: true`).
- Standalone `getAXState` with no tree change should not be repeated without an intervening action.

---

## 10. File map (implementation)

```
@oai/cua
├── package.json                          exports "." and "./tinyskyAlt"
├── docs/tinysky-alt-*.md                 injected first-use docs
└── dist/lib/js/oai_js_cua/src/
    ├── index.js / index.d.ts             re-export package-main cua
    ├── cua.js / cua.d.ts                 UNUSED stub initialize API
    ├── get_state.js / get_state.d.ts     inventory helper
    └── tinysky_alt/
        ├── globals.js / .d.ts            globalThis.cua + setupCUA
        ├── create_tinysky_alt.js / .d.ts façade + decorateTab + emit
        ├── types.d.ts                    TinySkyAlt / Target / options
        └── documentation.js / .d.ts      read docs/*.md + confirmation override
```
