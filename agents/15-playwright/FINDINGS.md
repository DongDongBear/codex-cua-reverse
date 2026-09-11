# FINDINGS — injected Playwright subset on `Tab.playwright`

**Verdict.** Desktop CUA does **not** run a Playwright process or expose `playwright` npm `Page`. `tab.playwright` is class `Ke` (`PlaywrightAPI`) on `@oai/browser-desktop` `Tab`. Locator/frame/download/chooser objects RPC `playwright_*` commands into `@oai/browser-desktop/service`, which injects Playwright’s `InjectedScript` as `window.__codexPlaywrightInjected` in an isolated world named `browser-use-playwright`. `evaluate` (page and locator) is a **separate read-only sandbox** in world `browser-use-readonly-js`. Task-1 used only `pt.playwright.locator(css).fill` / `.press('ControlOrMeta+a'| 'Backspace')` / `.evaluate(el => …)` — four members. The rest of the 60 `api.json` members are shipped (`reversed_unused`). Client extras `goBack` / `goForward` exist on `Ke` but are **not** in `PlaywrightAPI` (undocumented; same RPC as `tab.back()` / `tab.forward()`). There is no `locator.setInputFiles`; uploads are `waitForEvent("filechooser")` then `chooser.setFiles([absolutePath])`.

Status key used below:

| Status | Meaning |
|---|---|
| `traces_used` | Appears in `traces/task-1-ant-design-form.json` `js` bodies |
| `reversed_unused` | In `api.json`, implemented (or schema-present) in client/service, **not** in either capture |
| `undocumented` | On the client class, **absent** from `api.json` `PlaywrightAPI` |

`documented: false` is a separate `api.json` flag (omitted from generated docs). Those members stay `reversed_unused` unless noted.

---

## 1. Object identity

`Tab` constructor (`re` in `browser-client.mjs`):

```js
this.playwright = new Ke({ browserId, tabId: this.id, transport });
```

Runtime class map `Xo.PlaywrightAPI === Ke`, `PlaywrightLocator === H`, `PlaywrightFrameLocator === Ur`, `PlaywrightDownload === Wr`, `PlaywrightFileChooser === Vr`.

tinysky-alt **does not** copy `playwright` onto Target. Task-1 bound a second handle:

```js
let pt = await browser.tabs.get("1");
await pt.playwright.locator('[id="validateOnly_name"]').fill('测试 Alice');
```

`pt` and `tab` (`cua.getTab("1")`) are the same IAB tab. The model never wrote `tab.playwright`; it used `pt.playwright`.

Policy docs (injected on first browser use, not on `Tab.playwright` itself):

- `tinysky-alt-other-browser-apis.md` / `docs/accessibility.md`: AX first; Playwright when AX is insufficient or when locators collapse several `getAXState()` round-trips (long/repetitive / known site structure).
- `docs/file-uploads.md` (`documents.json` mode `lookup`): filechooser flow; **do not** look for `locator.setInputFiles`.
- `docs/screenshots.md` (`lookup`): inline markdown images for **user-visible** screenshots. It is not a Playwright screenshot API. `playwright.elementScreenshot` is a different, `documented: false` member.

---

## 2. Not stock Playwright

| Layer | What it actually is |
|---|---|
| Client | Thin proxies. Selector composition is local (`>>` strings). Actions `transport.send({ command })`. |
| RPC | `playwright_*` Atlas commands over Node REPL `rpc("browser", { method: "execute" })`. |
| Service | Class `wm`. Ensures injection, resolves selectors via Playwright engine, clicks via `cua.clickPoint`, types via injected `fill` + virtual clipboard / CDP keypress. |
| Page JS | Isolated world `browser-use-playwright` (`Page.createIsolatedWorld`, `grantUniveralAccess: false` — Playwright’s typo kept). Constant `__codexPlaywrightInjected`. World name string `gK = "browser-use-playwright"`. |
| `evaluate` | Different world `browser-use-readonly-js`. Live DOM is wrapped; mutations throw `… is not available in playwright.evaluate because the DOM is read-only`. |

Injection snippet (service):

```js
if (!window.__codexPlaywrightInjected) {
  // PlaywrightInjected.InjectedScript bundle
  window.__codexPlaywrightInjected = new PlaywrightInjected.InjectedScript(window, {
    isUnderTest: false,
    sdkLanguage: "javascript",
    testIdAttributeName: "data-testid",
    stableRafCount: 1,
    browserName: "chromium",
    customEngines: [],
  });
}
```

Missing helper → `Browser Use Playwright injected helper is missing`. Selector wait → `Playwright selector deadline exceeded`. Default command timeout `Me()` = **3000 ms** (clamped; `waitForDownload` max **120000**; `pressSequentially` max **5000**).

Disabled API members come from env `BROWSER_USE_DISABLE_API_MEMBERS` (comma-separated `Interface.member`). The client `Proxy` hides only those ids. Extra methods on `Ke` that are **not** in `api.json` (and not in that set) stay callable — that is why `goBack` / `goForward` are not stripped.

---

## 3. Task-1 traces (only Playwright usage in either capture)

Task-2 (Linear) never touched `tab.playwright`. All Playwright is task-1 IAB on `https://ant.design/components/form`.

| js # | title | code |
|---|---|---|
| 10 | 测试填写后启用 Submit | `pt.playwright.locator('[id="validateOnly_name"]').fill('测试 Alice')`; `locator('[id="validateOnly_age"]').fill('28')` |
| 12 | 验证清空后禁用和实时值更新 | `locator('[id="validateOnly_name"]').fill('')`; `locator('[id="name"]').fill('中文测试 ABC 123')` |
| 13 | 核实清空后的按钮状态 | `locator('[id="validateOnly_name"]').evaluate(el => ({ value: el.value, buttons: …disabled }))` |
| 14 | 用键盘删除内容测试必填条件 | `locator('[id="validateOnly_name"]').press('ControlOrMeta+a')` then `.press('Backspace')` |

Counts: `locator` ×7 constructions, `fill` ×4, `press` ×2, `evaluate` ×1. CSS is always `[id="…"]` (stable Ant Design field ids). `fill('')` clears; later the model used select-all + Backspace instead of `fill('')` to re-test the required-field disable path. `evaluate` only **reads** `value` / `disabled` (allowed in the read-only sandbox).

---

## 4. Full method catalog

**60** members in `api.json` across `PlaywrightAPI` (16) / `PlaywrightFrameLocator` (7) / `PlaywrightLocator` (34) / `PlaywrightDownload` (1) / `PlaywrightFileChooser` (2), plus **2** undocumented client methods.

RPC column is the Atlas `commandType` string, or `—` if the client only rewrites the selector / wraps another call.

### 4.1 `PlaywrightAPI` (`tab.playwright` / class `Ke`)

| Method | Status | RPC | Implementation notes |
|---|---|---|---|
| `locator(selector)` | **traces_used** | — | Requires non-empty selector; returns `H`. |
| `getByRole(role, { exact?, name? })` | reversed_unused | — | Compiles to `internal:role=…[name=…]`. |
| `getByText(text, { exact? })` | reversed_unused | — | `internal:text=` + JSON string + `s`/`i`. |
| `getByLabel(text, { exact? })` | reversed_unused | — | `internal:label=`. |
| `getByPlaceholder(text, { exact? })` | reversed_unused | — | `internal:attr=[placeholder=…]`. |
| `getByTestId(testId)` | reversed_unused | — | `internal:testid=[data-testid=…]` (exact). |
| `frameLocator(frameSelector)` | reversed_unused | — | Returns `Ur`. Nested locators insert `internal:control=enter-frame`. |
| `evaluate(pageFunction, arg?, { timeoutMs? })` | reversed_unused | `playwright_evaluate` | **Read-only page scope.** No selector. See §5. |
| `expectNavigation(action, { timeoutMs?, url?, waitUntil? })` | reversed_unused | — (client) | `Promise.all([action(), url ? waitForURL : waitForLoadState])`. `waitUntil` forwarded; `networkidle` still rejected inside load-state. |
| `waitForURL(url, { timeoutMs?, waitUntil? })` | reversed_unused | `playwright_wait_for_url` | Glob: `*` = `[^/]*`, `**` = `.*`, then `RegExp`. Listens `Page.frameNavigated` / `navigatedWithinDocument`. |
| `waitForLoadState({ state?, timeoutMs? })` | reversed_unused | `playwright_wait_for_load_state` | Default `state` `"load"`. **`networkidle` throws** `playwright_wait_for_load_state does not support networkidle`. `domcontentloaded` matches `interactive` or `complete`. |
| `waitForTimeout(timeoutMs)` | reversed_unused | `playwright_wait_for_timeout` | Non-negative integer. Client RPC timeout is `timeoutMs+2000`. Service is `setTimeout`. |
| `waitForEvent("download"\|"filechooser", { timeoutMs? })` | reversed_unused | `playwright_wait_for_download` / `playwright_wait_for_file_chooser` | Any other event → `playwright.waitForEvent only supports 'download' and 'filechooser'`. |
| `domSnapshot()` | reversed_unused | `playwright_dom_snapshot` | Injected `incrementalAriaSnapshot({mode:"ai"})`, then expands visible iframe bodies. |
| `elementInfo({ x, y, includeNonInteractable? })` | reversed_unused, `documented: false` | `playwright_element_info` | Client + schema exist. **No JS handler in `xm`**. Execute falls through to native `executeUnhandledCommand`. Live IAB/Chrome behavior unverified. |
| `elementScreenshot({ x, y, includeNonInteractable? })` | reversed_unused, `documented: false` | `playwright_element_screenshot` | Same handler gap as `elementInfo`. Returns `Uint8Array` from `data` if a handler ever answers. |
| `goBack()` | **undocumented** | `navigate_tab_back` | Not in `PlaywrightAPI`. Same command as `tab.back()`. CDP `Page.getNavigationHistory` then previous entry. |
| `goForward()` | **undocumented** | `navigate_tab_forward` | Not in `PlaywrightAPI`. Same command as `tab.forward()`. |

Navigation the model is documented to use is `tab.goto` / `tab.back` / `tab.forward` / `tab.reload`, not Playwright.

### 4.2 `PlaywrightFrameLocator` (class `Ur`)

All `reversed_unused`. No RPC until a returned locator acts.

| Method | Status | Notes |
|---|---|---|
| `locator(selector)` | reversed_unused | `` `${frame} >> internal:control=enter-frame >> ${selector}` `` |
| `frameLocator(frameSelector)` | reversed_unused | Nested frame; same `enter-frame` glue |
| `getByRole` / `getByText` / `getByLabel` / `getByPlaceholder` / `getByTestId` | reversed_unused | `this.locator(<compiled>)` |

No `first`/`nth`/`owner`/`contentFrame` on this subset.

### 4.3 `PlaywrightLocator` (class `H`)

| Method | Status | RPC | Notes |
|---|---|---|---|
| `locator(selector, filterOpts?)` | reversed_unused | — | Descendant: `` `${this} >> ${selector}` `` then `.filter(opts)`. |
| `getByRole` / `getByText` / `getByLabel` / `getByPlaceholder` / `getByTestId` | reversed_unused | — | `` `${this} >> ${internal:…}` `` |
| `filter({ has?, hasNot?, hasText?, hasNotText?, visible? })` | reversed_unused | — | `internal:has-text` / `has-not-text` / `has` / `has-not` / `visible=` |
| `and(locator)` / `or(locator)` | reversed_unused | — | Same tab required. `internal:and=` / `internal:or=` + JSON.stringify of other selector. |
| `first()` / `last()` / `nth(i)` | reversed_unused | — | `>> nth=0` / `nth=-1` / `nth=${i}` |
| `all()` | reversed_unused | `playwright_locator_count` then local `nth` | Builds a `Fo` read cache for later `textContent` / `innerText` / `getAttribute`. |
| `count()` | reversed_unused | `playwright_locator_count` | `evaluateSelectorAll` → `length`. |
| `click({ button?, force?, modifiers?, timeoutMs? })` | reversed_unused | `playwright_locator_click` | **Not** used in traces (`tab.click(index)` was AX). Hit-target + `cua.clickPoint`. `force` skips visible/enabled. Modifiers include `ControlOrMeta`. |
| `dblclick(same)` | reversed_unused | `playwright_locator_dblclick` | `clickLocator(…, 2)`. |
| `fill(value, { timeoutMs? })` | **traces_used** | `playwright_locator_fill` (`replace: true`) | Replaces value. See §6. **Payload has no `timeout_ms`** even though api.json documents it; service selector wait uses default 3000 unless transport aborts. |
| `type(value, { timeoutMs? })` | reversed_unused | `playwright_locator_fill` (`replace: false`) | Append; focus without select-all. Same timeout quirk. |
| `press(value, { timeoutMs? })` | **traces_used** | `playwright_locator_press` | Focus then CDP/virtual keypress. Payload **no** `timeout_ms`. `ControlOrMeta` → Meta on darwin, Control elsewhere. |
| `pressSequentially(value, { timeoutMs? })` | reversed_unused | `playwright_locator_press_sequentially` | Per-character; default/max 5s. Does **not** clear existing value. |
| `check(opts)` / `uncheck(opts)` | reversed_unused | — | `setChecked(true/false)`. |
| `setChecked(checked, { force?, timeoutMs? })` | reversed_unused | `playwright_locator_set_checked` | No-op if already in state. Cannot uncheck a radio. Otherwise `clickLocator` and re-read. |
| `selectOption(value\|{value?,label?,index?}\|array, { timeoutMs? })` | reversed_unused | `playwright_locator_select_option` | Injected `selectOptions`. Native `<select>` only. |
| `waitFor({ state, timeoutMs? })` | reversed_unused | `playwright_locator_wait_for` | `state` required: `attached` \| `detached` \| `visible` \| `hidden`. |
| `isVisible()` / `isEnabled()` | reversed_unused | `playwright_locator_is_visible` / `_is_enabled` | Injected `elementState`. |
| `textContent({ timeoutMs? })` | reversed_unused | `playwright_locator_text_content` or cache | Cache via `playwright_locator_read_all` after `all()`. |
| `innerText({ timeoutMs? })` | reversed_unused | `playwright_locator_inner_text` or cache | |
| `getAttribute(name, { timeoutMs? })` | reversed_unused | `playwright_locator_get_attribute` or cache | Credential `value` attributes stripped when protected. |
| `allTextContents({ timeoutMs? })` | reversed_unused | `playwright_locator_all_text_contents` | |
| `evaluate(fn, arg?, { timeoutMs? })` | **traces_used** | `playwright_evaluate` | **Read-only.** Locator must resolve to **one** element. Fn signature `(element, arg)`. |
| `evaluateAll(fn, arg?, { timeoutMs? })` | reversed_unused | `playwright_evaluate` (`selector_mode: "all"`) | **Read-only.** Fn signature `(elements, arg)`. Also used internally for action-error diagnostics. |
| `downloadMedia({ timeoutMs? })` | reversed_unused | `playwright_locator_download_media` | In the **mutable** injected world: find `img/video/source/a[href]`, synthesize `<a download>` click. Not the readonly evaluate path. |

Internal (not in `api.json`, not catalogued as undocumented model API): `actionError`, `cachedRead`, `assertCompatibleLocator`, static `browserAuthSelector` (browserAuth capability hands a locator to the native host).

Action failures wrap the original error with JSON diagnostics (`kind`: `multiple_matches` from strict-mode, `intercepted`, `no_matches`, `no_visible_match`, `action_failed`) plus up to 5 match previews.

### 4.4 `PlaywrightDownload` (class `Wr`)

| Method | Status | RPC | Notes |
|---|---|---|---|
| `path({ timeoutMs? })` | reversed_unused, `documented: false` | `playwright_download_path` | Returned from `waitForEvent("download")`. Handler **is** registered. `null` if the file is not on disk yet. |

No `saveAs` / `failure` / `url` / `cancel`.

`waitForEvent("download")` enables the download interceptor, waits, then disables it. Default timeout cap 120s.

### 4.5 `PlaywrightFileChooser` (class `Vr`)

| Method | Status | RPC | Notes |
|---|---|---|---|
| `isMultiple()` | reversed_unused | — | Sync boolean from `Page.fileChooserOpened` `mode === "selectMultiple"`. |
| `setFiles(files, { timeoutMs? })` | reversed_unused | `playwright_file_chooser_set_files` | `string \| string[]`, at least one, **absolute paths**. Rejects multiple files when `!isMultiple`. CDP `DOM.setFileInputFiles`. Then drops the chooser id. |

`waitForEvent("filechooser")` does `Page.setInterceptFileChooserDialog({enabled:true})`, waits `Page.fileChooserOpened`, then disables intercept in `finally`. OOPIF (`sessionId`/`targetId` on the event) → `File uploads in out-of-process frames are not supported.` Chrome/Edge “Not allowed” is rewritten to the canned `chrome://extensions` / `edge://extensions` “Allow access to file URLs” message (`docs/chrome-file-upload-troubleshooting.md`).

Canonical model snippet (`docs/file-uploads.md`):

```js
const chooserPromise = tab.playwright.waitForEvent("filechooser", { timeoutMs: 10000 });
await tab.playwright.locator('input[type="file"]').click();
const chooser = await chooserPromise;
await chooser.setFiles(["/absolute/path/to/file.txt"]);
```

---

## 5. `evaluate` is read-only

Applies to `playwright.evaluate`, `locator.evaluate`, `locator.evaluateAll`.

Pipeline:

1. Client serializes `pageFunction` + JSON `arg` (`playwright.evaluate arg must be JSON-serializable`). String form `return (expr);`; function form `toString()` then `await __playwrightEvaluate(arg)` or `(element, arg)` / `(elements, arg)`.
2. Rejects `import(` in the script: `module loading is not available in playwright.evaluate`.
3. Service creates isolated world `browser-use-readonly-js`, injects a wrapper (`kw` / `NK`) that exposes frozen node/window/document facades.
4. Mutations throw `name is not available in playwright.evaluate because the DOM is read-only` (constructors and assignment traps on Node, CSSOM, Range, Selection, …).
5. Password/protected credential fields: `value` attribute omitted from readonly attribute lists and HTML snapshots.
6. Result caps: depth **8**, array length **2000**, object keys **200**, string **200000**.
7. Locator path resolves the element, aliases it as `globalThis.__browserUseReadonlyElementN` in the sandbox, runs the user script, deletes the alias.

Task-1’s `evaluate(el => ({ value: el.value, buttons: … }))` is the intended use: inspect, don’t write. Writes go through `fill` / `press` / `click` / `setChecked` / chooser — those run in `browser-use-playwright`, not the readonly world.

There is **no** supported write-eval on this subset. CDP `tab.capabilities.get("cdp").send` is a different, confirmation-gated API.

---

## 6. `fill` / `type` / `press` (what task-1 actually hit)

### `fill` (`replace: true`)

1. Require visible + enabled + editable.
2. Injected `InjectedScript.fill(node, value)` (Playwright’s fill: input type allowlist, number/color special cases, `input`/`change` events). May return `"done"` or `"needsinput"`.
3. If `"needsinput"`, service types via virtual clipboard / CDP with `replaceInputValue: true` (IAB uses `__codexIabInputTargetToken`).

`fill('')` in js #12 is a supported clear.

### `type` (`replace: false`)

`focusLocator({ selectText: false, requireEditable: true })` then type **without** replacing. Not used in traces.

### `press`

`focusLocator({ requireEditable: false })` then key dispatcher `ec`.

Key string split on `+` (`Ql`). `ControlOrMeta` → `Meta` on `darwin`, `Control` otherwise (`Ah`). Aliases: `ctrl` → `ControlOrMeta`, `cmd`/`command`/`meta`/`super`/`win` → `Meta`, `backspace` → `Backspace`, `return`/`enter` → `Enter`.

Special case: `Meta+a` / `Control+a` (the resolved `ControlOrMeta+a`) is **selectAll**, not a native clipboard chord. Native copy/cut/paste chords throw `Native clipboard shortcuts are disabled; use Browser Use virtual clipboard commands instead.` Task-1’s `'ControlOrMeta+a'` then `'Backspace'` is select-all + delete — the portable way to clear after `fill`.

---

## 7. Selector engine (compiled `getBy*` / `filter` / frames)

Playwright selector language, chained with ` >> `:

| Client helper | Selector |
|---|---|
| `getByRole('button', { name: 'Submit', exact: true })` | `internal:role=button[name="Submit"s]` |
| `getByText('Hello')` | `internal:text="Hello"i` |
| `getByLabel` | `internal:label=…` |
| `getByPlaceholder` | `internal:attr=[placeholder=…]` |
| `getByTestId('x')` | `internal:testid=[data-testid="x"s]` |
| `nth(2)` | `nth=2` |
| `filter({ visible: true })` | `visible=true` |
| `frameLocator('iframe#app').locator('input')` | `iframe#app >> internal:control=enter-frame >> input` |

`TextMatcher` = `string | RegExp`. Exact flag appends `s` vs `i` on the quoted string. Actions are **strict** (one match); `strict mode violation` → diagnostic `multiple_matches`. OOPIF frames: service walks `enter-frame` and auto-attaches targets when the CDP backend supports it. File choosers in OOPIFs are explicitly unsupported.

---

## 8. Hard limits vs stock Playwright `Page` / `Locator`

Shipped subset is closed. Not present (do not invent):

**Page-like:** `goto` / `reload` / `close` / `screenshot` / `title` / `url` / `content` / `setContent` / `waitForSelector` / `waitForFunction` / `waitForEvent` except download+filechooser / `keyboard` / `mouse` / `viewport` / cookies / routing / `addInitScript` / `$` / `$$` / `evaluateHandle` / `exposeFunction` / listeners.

**Locator:** `hover` / `tap` / `focus` / `blur` / `clear` / `screenshot` / `boundingBox` / **`setInputFiles`** / `dragTo` / `highlight` / `inputValue` / `isChecked` / `isDisabled` / `isEditable` / `isHidden` / `innerHTML` / `allInnerTexts` / `contentFrame` / `elementHandle` / `dispatchEvent` / `scrollIntoViewIfNeeded` / `selectText`.

**Download / FileChooser:** only `path` and `isMultiple`+`setFiles`.

`LoadState` in `api.json` still lists `"networkidle"`; the service **rejects** it on `waitForLoadState` (and therefore on `waitForURL({ waitUntil: "networkidle" })` / `expectNavigation`).

`fill` / `type` / `press` documented `timeoutMs` is **not** copied into the protobuf payload (unlike `click`). Treat 3s as the real selector budget unless the REPL `js` `timeout_ms` kills the whole call.

---

## 9. Related docs (lookup, not auto-dumped)

From `documents.json`:

| Doc | Mode | When |
|---|---|---|
| `file-uploads` | lookup | members `PlaywrightAPI.waitForEvent` + `PlaywrightFileChooser.setFiles` |
| `chrome-file-upload-troubleshooting` | lookup | `browserTypes: ["extension"]` |
| `screenshots` | lookup | “user asks for screenshots” — markdown `![screenshot](IMAGE_LINK)`, **not** `playwright.elementScreenshot` |

`api-use-behavior.md` (included): prefer a DOM snapshot for locator ground truth; don’t `goto` a URL the tab is already on.

---

## 10. Command map (service `xm` handlers)

Registered Playwright handlers (JS, not native fallback):

`playwright_evaluate`, `playwright_locator_{click,dblclick,fill,press,press_sequentially,wait_for,count,select_option,set_checked,is_visible,is_enabled,all_text_contents,text_content,inner_text,get_attribute,read_all,download_media}`, `playwright_wait_for_{url,load_state,timeout,download,file_chooser}`, `playwright_dom_snapshot`, `playwright_download_path`, `playwright_file_chooser_set_files`.

**Schema-only (no `xm` handler):** `playwright_element_info`, `playwright_element_screenshot`. Client still sends them; execute uses `executeUnhandledCommand` (native-host session request).

Read-ish commands in the CDP response-meta set `YJ`: `playwright_evaluate`, `playwright_dom_snapshot`, locator count/text/attribute/visible/enabled/read_all.

---

## 11. Sources

| Path | Used for |
|---|---|
| `/Users/dongdong/Desktop/codex-cua-reverse/vendor/browser-desktop/api.json` | 60-member contract + `documented: false` + option types |
| `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/browser-desktop/scripts/browser-client.mjs` | `Ke` / `H` / `Ur` / `Wr` / `Vr`; `goBack`/`goForward`; selector compilers; RPC payloads |
| `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/browser-desktop/scripts/browser-service.mjs` | injection, readonly evaluate, handlers, `networkidle` reject, filechooser, key map |
| `/Users/dongdong/Desktop/codex-cua-reverse/vendor/browser-desktop/docs/file-uploads.md` | chooser flow; no `setInputFiles` |
| `/Users/dongdong/Desktop/codex-cua-reverse/vendor/browser-desktop/docs/screenshots.md` | user-facing screenshot markdown |
| `/Users/dongdong/Desktop/codex-cua-reverse/vendor/browser-desktop/docs/chrome-file-upload-troubleshooting.md` | extension file-URL permission |
| `/Users/dongdong/Desktop/codex-cua-reverse/agents/03-browser-desktop/copies/cua/tinysky-alt-other-browser-apis.md` | when to leave AX |
| `/Users/dongdong/Desktop/codex-cua-reverse/agents/03-browser-desktop/FINDINGS.md` | prior Playwright paragraph; `Tab.playwright` wiring |
| `/Users/dongdong/Desktop/codex-cua-reverse/traces/task-1-ant-design-form.json` | live `pt.playwright.locator` usage |
| `/Users/dongdong/Desktop/codex-cua-reverse/agents/05-traces/FINDINGS.md` | call table / API rollup |

Did not attach to a live tab or execute Playwright RPCs from this process.

---

## 12. Rollup

| Bucket | Count | Members |
|---|---|---|
| `traces_used` | 4 | `PlaywrightAPI.locator`, `PlaywrightLocator.fill`, `.press`, `.evaluate` |
| `reversed_unused` (api.json, not in traces) | 56 | everything else in the 60, including `documented: false` `elementInfo` / `elementScreenshot` / `Download.path` |
| `undocumented` (client, not api.json) | 2 | `PlaywrightAPI.goBack`, `PlaywrightAPI.goForward` |

`evaluate` (page + locator + evaluateAll) is **read-only**. Task-1 honored that. Writes in traces were `fill` and `press` only.
