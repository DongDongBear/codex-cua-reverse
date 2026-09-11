# V4 — Browser-side reconstruction vs LIVE ChatGPT.app session

**Agent:** verification V4 (browser surface)  
**When:** 2026-09-10, local disk + live process observation only  
**Verdict:** every task-1 `js` API maps onto the live `@oai/browser-desktop` contract (`docs/api.json` + tinysky-alt decoration + Node REPL RPC). The live CUA REPL is up with `browser` trusted service loaded. Importing the client/service **outside** that REPL fails exactly as the source requires (`nodeRepl.rpc` / `nodeRepl.config`). Live `listTabs` / `getTab` were **not** issued against the running kernel (would require attaching to ChatGPT’s `node_repl` stdio or standing up a second `handleRpc` session on the same native hosts). OS-level Chrome/IAB inventory is live and consistent with `BROWSER_USE_AVAILABLE_BACKENDS=chrome,iab`.

Hard constraints honored:

- Did **not** attach to live `node_repl` stdio (PIDs 5769 / 5746).
- Did **not** fill the Ant Design form or call `tab.click` / `typeText` / Playwright `fill` / `press` against a live tab.
- Did **not** connect to `/tmp/codex-browser-use/*.sock`.
- No tokens, cookies, or screenshot bytes dumped.

---

## 1. Live ChatGPT CUA graph (this machine)

Observed while ChatGPT.app was running.

```
ChatGPT.app  PID 3579
  Codex Framework renderers (IAB / in-app browser, user-data-dir
    /Users/dongdong/Library/Application Support/Codex)
  Resources/codex app-server  PID 3632
    ├─ node_repl PID 5746
    │     NODE_REPL_TRUSTED_SERVICES.browser =
    │       ~/.codex/plugins/cache/openai-bundled/browser/26.903.61454/scripts/browser-service.mjs
    │     no CUA_REPL_ENABLED_SURFACES / no tinysky banner
    └─ node launch.mjs PID 5748
          ~/.codex/plugins/cache/openai-bundled/unified-computer-use/26.903.61454/scripts/launch.mjs
          CUA_REPL_ENABLED_SURFACES=browser,computer
          CUA_REPL_NODE_REPL_PATH=.../cua_node/bin/node_repl
          spawn() overrides TRUSTED_SERVICES for the child:
            └─ node_repl PID 5769   ← live cua_repl
                  NODE_REPL_TRUSTED_SERVICES={"browser":"@oai/browser-desktop/service","sky":"@oai/sky/service"}
                  NODE_REPL_JS_BANNER=setupCUA({ browser: true, computer: true })
                  BROWSER_USE_TINYSKY_ENABLED=1
                  BROWSER_USE_AVAILABLE_BACKENDS=chrome,iab
                  ├─ kernel.js PID 56445
                  │     --session-id 93d6f09f52d74d719de7d5d1f9d5a6ca
                  │     --working-dir /Users/dongdong/Documents/ChatGPT/Desktop
                  │     NODE_REPL_TRUSTED_RPC_ENABLED=1
                  └─ trusted-worker.js PID 56446
                        NODE_REPL_TRUSTED_SERVICES={"sky":"@oai/sky/service","browser":"@oai/browser-desktop/service"}
                        loads module.handleRpc for service "browser"
```

Chrome extension host (separate, already running):

- PID 26871: `~/.codex/plugins/cache/openai-bundled/chrome/latest/extension-host/macos/arm64/ChatGPT for Chrome chrome-extension://hehggadaopoacecdllhhajmbjkdcmajg/`
- Holds unix socket `/tmp/codex-browser-use/e3a02578-8721-4839-8711-fd3185c765d6.sock`

ChatGPT.app itself holds IAB/app-tools sockets:

- `/tmp/codex-browser-use/c8842a5c-575f-442c-89f8-f93021cb2c0e.sock` (also `CODEX_APP_TOOLS_PIPE_PATH` on the app-server)
- `/tmp/codex-browser-use/f1a9a786-315f-4552-a739-d756ae156aec.sock`
- `/tmp/codex-browser-use/269127ad-db68-4257-8957-35dc6efb5457.sock`

`launch.mjs` (live copy) is the documented override:

```js
NODE_REPL_TRUSTED_SERVICES: JSON.stringify({
  ...setupOptions.browser ? { browser: "@oai/browser-desktop/service" } : {},
  ...setupOptions.computer ? { sky: "@oai/sky/service" } : {}
}),
NODE_REPL_JS_BANNER: banner,  // banner.js = setupCUA({ browser: true, computer: true })
```

Parent 5748 still has ChatGPT’s pre-override env (`browser` → plugin-cache `browser-service.mjs`). Child 5769 / trusted-worker 56446 have the launch override (`@oai/browser-desktop/service`). That is the CUA path task-1 used.

Live `NODE_REPL_JS_BANNER` (PID 5769, full string via `KERN_PROCARGS2`):

```javascript
await (
  await import("@oai/cua/tinyskyAlt")
).setupCUA({ browser: true, computer: true });
```

Live `NODE_REPL_TOOL_OVERRIDES.tools.js.description` (2505 chars) concatenates `js-tool-description.md` + `browser-description.md` + computer + output docs. It contains `cua.getBrowser({ url })`, `cua.getTab(...)`, `cua.createBrowserTab(...)`, and `nodeRepl.write`. First-use AX / Playwright / `dev.logs` are **not** in the tool text; they arrive from `browser.documentation()` after `getBrowser`.

Kernel 56445 has `NODE_REPL_TRUSTED_RPC_ENABLED=1` (untrusted VM may call `nodeRepl.rpc("browser"|"sky", …)`). Trusted-worker 56446 does **not** need that flag; it *is* the privileged side.

Live trusted-worker loader (temp copy of the node_repl kernel, read-only):

```js
const configuredServices = JSON.parse(process.env.NODE_REPL_TRUSTED_SERVICES);
// ...
handler = import(resolveTrustedService(configured)).then((module) => {
  if (typeof module.handleRpc !== "function") {
    throw new Error(`Trusted RPC service ${service} does not export handleRpc`);
  }
  return module.handleRpc;
});
```

For PID 56446, `configuredServices.browser === "@oai/browser-desktop/service"`, which the live package exports as `handleRpc`.

---

## 2. Packages on disk (live vs plugin-cache vs vendor)

| Path | Role | Notes |
|---|---|---|
| `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/browser-desktop` | **Production trusted service** for cua_repl 5769 | `package.json` name `@oai/browser-desktop` **0.1.1**, exports `"." → scripts/browser-client.mjs`, `"./service" → scripts/browser-service.mjs` |
| `~/.codex/plugins/cache/openai-bundled/browser/26.903.61454/` | Browser **plugin** tree (diagnostics + a second service copy) | No `package.json` at the cache root. Wired as absolute `browser-service.mjs` on node_repl 5746 / launch.mjs 5748 env |
| `codex-cua-reverse/vendor/browser-desktop/api.json` | Vendor copy | **SHA-256 identical** to both live `docs/api.json` files (`fc7966ff…e277f`) |

Hashes / sizes:

| File | SHA-256 | Bytes |
|---|---|---|
| App `scripts/browser-client.mjs` | `b9b9bc23…5d9037` | 150611 |
| Plugin-cache `scripts/browser-client.mjs` | `3fde147a…c7ccae` | 150615 |
| App `scripts/browser-service.mjs` | `c96dbf28…940e3e` | 1303004 |
| Plugin-cache `scripts/browser-service.mjs` | `25232ad9…8592d0c` | 1305259 |
| App / plugin-cache / vendor `docs/api.json` | `fc7966ff…e277f` | same |

Client/service are minified siblings (different minify names: app `export{s_ as setupBrowserRuntime}` / `export{MVe as handleRpc}`; plugin `l_` / `WVe`). Same RPC methods and the same two gate errors. `api.json` is the contract.

Node used for all import tests: `/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node` → **v24.20.0**.

---

## 3. Task-1 trace → live API map

Source trace: `/Users/dongdong/Desktop/codex-cua-reverse/traces/task-1-ant-design-form.json` (14 `js` cells).

Layer key:

- **Tinysky** = model-facing `cua.*` / decorated `tab.*` (`tinysky_alt.types.d.ts`, live `create_tinysky_alt.js`).
- **Agent** = `@oai/browser-desktop` `docs/api.json` (root `"Agent"`).
- **RPC** = client `transport.send({ command: <Type>.create(...) })` whose `commandType` strings live in `browser-client.mjs`; trusted service `handleRpc({ method, params })` then `executeAgentCommand`.
- **Live tool text** = PID 5769 `NODE_REPL_TOOL_OVERRIDES`.

`tab.click` / `tab.typeText` / `tab.getAXState` are **not** members of `api.json` `Tab`. Tinysky `decorateTab` copies `Target` onto the Agent tab:

```js
click:(e,i)=>t.ax.click(e,i)
typeText:e=>t.ax.typeText(e)
getAXState → t.ax.get("state", { disableDiffing })
```

and hides `Tab.ax` from first-use docs (`undocumentedApiMembers: ["Tab.ax"]`). Confirmed in live

`/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/dist/lib/js/oai_js_cua/src/tinysky_alt/create_tinysky_alt.js`.

`api.json` marks `Tab.ax` `unsupportedByDefaultIn: ["iab","extension","cdp"]`; the desktop service re-enables it via `apiSupportOverrides`. Tinysky still teaches `tab.click`, not `tab.ax.click`.

### 3.1 `cua.getBrowser({ url })`

Trace: `let browser = await cua.getBrowser({ url: "https://ant.design/components/form" });`

| Layer | Mapping |
|---|---|
| Tinysky | `getBrowser(options?: { id?: string; url?: string }): Promise<Browser>` — select, do **not** open a tab. `id` wins over `url`. Else `browsers.getForUrl(url)` (bare hostnames get `https://`), else `getDefault()`, else `list()[0]`. Then `browser.documentation()` (cached per `browserId`) emitted on `cua.browser`. |
| Agent | `Browsers.getForUrl(url)` (`documented: false`); `Browsers.get(id)`; `Browsers.getDefault()` (`documented: false`); `Browsers.list()`; `Browser.browserId: string`. |
| RPC | `get_browser_for_url` / `get_browser` / `get_default_browser` / `list_browsers` / `get_browser_documentation`. |
| Live tool | Exact snippet: `let browser = await cua.getBrowser({ url });` — “Selecting a browser does not open a tab.” |
| Docs | `tinysky-alt-core-cua-repl.md`; plugin `browser-description.md`. |

Task-1 then used `browser.browserId` with `listTabs` / `getTab`. That property is `api.json` `Browser.browserId` (“Browser id selected by `agent.browsers.get()`”).

### 3.2 `cua.listTabs({ browser: browser.browserId })`

| Layer | Mapping |
|---|---|
| Tinysky | `listTabs(options?: BrowserOptions & ObservationOptions): Promise<TabInfo[]>` — `g({ browser })` then `tabs.list()`, union `user.openTabs()` (errors → `[]`), stamp `browserId`. **Does not claim.** |
| Agent | `Tabs.list(): Promise<Array<TabInfo>>`. `TabInfo = { id, providerTabId?, title?, url? }`. Extension-only `Browser.user.openTabs()` (`Browser.user` unsupported on iab/cdp). |
| RPC | `list_tabs` (`browser_id`); optional `browser_user_open_tabs`. |
| Docs | tinysky types + `docs/tab-mentions-iab.md` (`Tabs.list` / `Tabs.get` required for IAB mentions). Not named in the short live tool text (`listTabs` string absent); first-use API reference after `getBrowser` includes it. |

### 3.3 `cua.getTab("1", { browser: browser.browserId })`

| Layer | Mapping |
|---|---|
| Tinysky | `getTab(id, { browser? })` — match `tabs.list()` on `id` **or** `providerTabId`; else extension `user.claimTab`. Then full AX (`getAXState({ disableDiffing: true, emit: false })` + emit). Trace id `"1"` is a session tab id, not a Chrome tab id. |
| Agent | `Tabs.get(id: string): Promise<Tab>`. |
| RPC | `get_tab` (`browser_id`, `tab_id`). Claim path: `browser_user_claim_tab`. |
| Live tool | `let tab = await cua.getTab(tabId, { browser: browserId });` |

IAB mentions (`docs/tab-mentions-iab.md`): all IAB tabs already in `tabs.list()` / `tabs.get`; no claim.

### 3.4 `tab.click(325)` / `tab.click(4523)` / …

| Layer | Mapping |
|---|---|
| Tinysky Target | `click(target: number \| Point, options?: ClickOptions)` |
| Agent | `AXAPI.click(target: number \| AXPoint, options?: AXClickOptions)` |
| RPC | `tab_ax_action` with `action.kind = "click"`, `target` = index or `[x,y]`, optional `mouse_button` / `click_count`. |

### 3.5 `tab.typeText("测试用户_Test123")`

| Layer | Mapping |
|---|---|
| Tinysky Target | `typeText(text: string)` |
| Agent | `AXAPI.typeText(text: string)` — “Type text into the currently focused element.” |
| RPC | `tab_ax_action` `kind: "type_text"`. |

Trace clicked an index first (focus), then typed. Matches AX “currently focused element”.

### 3.6 `tab.getAXState()` / `tab.getAXState({ emit: false })`

| Layer | Mapping |
|---|---|
| Tinysky Target | `getAXState(options?: { emit?: boolean; disableDiffing?: boolean }): Promise<string>` — default `emit: true` → `nodeRepl.write(state, "cua.state")`. `{ emit: false }` returns the string for JS filtering (what task-1 did with `.split('\\n').filter(...)`). |
| Agent | `AXAPI.get(mode?: "state", options?: AXStateOptions): Promise<string>` plus `"screenshot"` / `"both"` overloads. `AXStateOptions = { disableDiffing?: boolean }`. Tinysky `write()` is **not** taught; `get` + optional emit replaces `tab.ax.write()`. |
| RPC | `tab_ax_get_state` (`content: "axState" \| "screenshot" \| "axStateAndScreenshot"`, `disable_diffing?`). |
| Docs | `docs/accessibility.md` documents `tab.ax.write()` / `tab.ax.get()`. Tinysky excludes that file from first-use because `Tab.ax` is undocumented. |

### 3.7 `browser.tabs.get("1")`

Trace: `let pt = await browser.tabs.get("1");` then `pt.playwright…` / `pt.dev.logs`.

| Layer | Mapping |
|---|---|
| Agent | `Browser.tabs: Tabs`; `Tabs.get(id: string): Promise<Tab>`. Same RPC as tinysky `getTab`, but returns the **undecorated** Agent `Tab` (still has `playwright`, `dev`, `ax`). Task-1 kept both `tab` (tinysky Target) and `pt` (Agent Tab). |
| RPC | `get_tab`. |
| Client class | `He.get` → `we.create({ browser_id, tab_id })` (`commandType: "get_tab"`). |

### 3.8 `tab.playwright.locator(sel).fill` / `.press` / `.evaluate`

Trace examples:

- `pt.playwright.locator('[id="validateOnly_name"]').fill('测试 Alice')`
- `.press('ControlOrMeta+a')` / `.press('Backspace')`
- `.evaluate(el => ({ value: el.value, buttons: ... }))`

| Layer | Mapping |
|---|---|
| Agent `PlaywrightAPI` | `locator(selector: string): PlaywrightLocator` |
| Agent `PlaywrightLocator` | `fill(value: string, options: { timeoutMs?: number }): Promise<void>` — “Replace the element's value”. `press(value: string, options: { timeoutMs?: number })`. `evaluate<TResult,TArg>(pageFunction, arg?, options?): Promise<TResult>` — “Evaluate JavaScript in a read-only scope; the locator must resolve unambiguously to one element.” |
| Agent `PlaywrightAPI.evaluate` | page-level evaluate, also “read-only page scope”. |
| RPC | `playwright_locator_fill` (`selector`, `value`, `replace`); `playwright_locator_press` (`selector`, `value`); `playwright_evaluate` (`script`, optional `selector`). |
| Docs | `tinysky-alt-other-browser-apis.md` (injected on first browser use): Playwright is the verbose fallback when AX indices are unstable. Not a Playwright process — injected `browser-use-playwright` / `__codexPlaywrightInjected` via CDP. |

`fill`/`press` live on **PlaywrightLocator**, not `PlaywrightAPI`. Trace `tab.playwright.locator` is therefore the correct hop.

### 3.9 `tab.dev.logs({ levels: ["log"], limit: 5 })`

| Layer | Mapping |
|---|---|
| Agent | `Tab.dev: TabDevAPI`; `TabDevAPI.logs(options: TabDevLogsOptions): Promise<Array<TabDevLogEntry>>`. |
| Types | `TabDevLogsOptions = { filter?: string; levels?: Array<"debug"\|"info"\|"log"\|"warn"\|"error"\|"warning">; limit?: number }`. Entry: `{ level, message, timestamp, url? }`. |
| RPC | `tab_dev_logs` (`browser_id`, `tab_id`, `filter?`, `levels?`, `limit?`). |
| Trace | Combined with `nodeRepl.write(...)` because `dev.logs` does **not** auto-emit (unlike `getAXState`). |

### 3.10 `nodeRepl.write(...)`

Not a browser-desktop method. Kernel global on the untrusted VM.

| Layer | Mapping |
|---|---|
| Kernel tools | `/Users/dongdong/Desktop/codex-cua-reverse/native/node-repl-tools.txt` lists `nodeRepl.write`. |
| Tinysky docs | `tinysky-alt-core-cua-repl.md` / `tinysky-alt-core-node-repl.md`: “For text output, use `nodeRepl.write(...)`.” Observation APIs already write; wrapping them duplicates. `{ emit: false }` disables auto-write. |
| Live tool | `js-output-description.md` is appended to the js tool: “To add other content to the tool result, use `nodeRepl.write(value)` … The APIs listed above already display their documentation or UI state; do not wrap their results in `write`.” |
| Tinysky emit | `nodeRepl.write(docs, "cua.core" \| "cua.browser")` and `nodeRepl.write(state, "cua.state")`. |
| Trace | Used for `pt.dev.logs(...)`, filtered `getAXState({emit:false})` lines, and Playwright `evaluate` JSON. |

### 3.11 RPC command types actually present in the live client

Confirmed by string count in app `browser-client.mjs`:

| commandType | count | Task-1 use |
|---|---|---|
| `list_browsers` | 1 | `cua.getBrowser` fallback / `listBrowsers` |
| `get_browser` | 3 | `browsers.get` / aliases `iab`/`chrome`/`edge` |
| `get_browser_for_url` | 1 | `cua.getBrowser({ url })` |
| `get_default_browser` | 1 | `getBrowser()` with no id/url |
| `list_tabs` | 1 | `cua.listTabs` / `tabs.list` |
| `get_tab` | 2 | `cua.getTab` / `browser.tabs.get` |
| `tab_ax_action` | 1 | `tab.click` / `tab.typeText` |
| `tab_ax_get_state` | 1 | `tab.getAXState` |
| `tab_dev_logs` | 1 | `pt.dev.logs` |
| `playwright_locator_fill` | 1 | `.fill(...)` |
| `playwright_locator_press` | 2 | `.press(...)` |
| `playwright_evaluate` | 1 | `.evaluate(...)` |

Client `setupBrowserRuntime` (de-minified from live file):

```js
async function setupBrowserRuntime(r = {}) {
  let e = globalThis.nodeRepl;
  if (e == null || typeof e.rpc != "function")
    throw new Error("Browser use requires a trusted Node REPL browser service");
  let o = e.rpc;
  let a = {
    setup: c => o("browser", { method: "setup", params: c }),
    execute: c => o("browser", { method: "execute", params: c }),
  };
  let { apiManifest: n, disabledMemberIds: s } = await a.setup({
    environment: r.environment ?? "codex-app",
    undocumentedApiMembers: r.undocumentedApiMembers,
    excludedDocumentation: r.excludedDocumentation,
  });
  return /* Agent { documentation, browsers } */;
}
```

Service `handleRpc` (live tail of `browser-service.mjs`):

```js
dne = {
  async setup({ environment, undocumentedApiMembers, excludedDocumentation }) {
    if (environment !== "codex-app" && environment !== "training" && environment !== "cloud")
      throw new Error("Invalid browser service environment");
    Xf = W2().then(/* build browserContext */);
    let { apiManifest, disabledMemberIds } = await Xf;
    return { apiManifest, disabledMemberIds: [...disabledMemberIds] };
  },
  async execute(e) {
    if (Xf == null) throw new Error("Browser runtime has not been initialized");
    return await (await Xf).executeAgentCommand(e);
  },
};
async function handleRpc(e) {
  let t = Object.getOwnPropertyDescriptor(dne, e.method)?.value;
  if (typeof t != "function") throw new Error("Unsupported browser service request");
  return await t(e.params);
}
```

Privileged gate inside `W2()`:

```js
function mM() {
  let e = globalThis.nodeRepl;
  return e?.config == null ? void 0 : e;  // trusted worker nodeRepl only
}
if (mM() == null) throw new Error("Browser use requires privileged Node REPL capabilities");
```

Tinysky first-use passes `undocumentedApiMembers: ["Tab.ax"]` and (for `core-cua-repl`) `excludedDocumentation: ["confirmations"]` — matches the stub-RPC payload recorded below.

---

## 4. Import proof (no trusted nodeRepl)

All runs used ChatGPT’s Node v24.20.0. **Never** pointed at live kernel stdio.

### 4.1 Bare specifier from Desktop cwd

```
import("@oai/browser-desktop")
import("@oai/browser-desktop/service")
```

→ `ERR_MODULE_NOT_FOUND: Cannot find package '@oai/browser-desktop' imported from /Users/dongdong/Desktop/[eval1]`

`NODE_PATH=.../cua_node/lib/node_modules` does **not** fix ESM package exports (Node suggests `@oai/browser-desktop/scripts/browser-client.mjs` but still fails). Live kernel resolution uses `NODE_REPL_NODE_MODULE_DIRS` inside node_repl, not plain `NODE_PATH`.

### 4.2 Package resolves when cwd is the live `node_modules` parent

```
cwd=/Applications/ChatGPT.app/Contents/Resources/cua_node/lib
import("@oai/browser-desktop")        → { setupBrowserRuntime }
import("@oai/browser-desktop/service") → { handleRpc }
import("@oai/cua/tinyskyAlt")          → { setupCUA }
```

### 4.3 File-URL imports (no package name needed)

| Specifier | Export | `setup` / `setupBrowserRuntime` without nodeRepl |
|---|---|---|
| `file:///Applications/ChatGPT.app/.../scripts/browser-client.mjs` | `setupBrowserRuntime` | **`Browser use requires a trusted Node REPL browser service`** |
| `file:///Applications/ChatGPT.app/.../scripts/browser-service.mjs` | `handleRpc` | **`Browser use requires privileged Node REPL capabilities`** |
| `file:///~/.codex/plugins/cache/openai-bundled/browser/26.903.61454/scripts/browser-client.mjs` | `setupBrowserRuntime` | same trusted-REPL error |
| `file:///~/.codex/plugins/cache/.../scripts/browser-service.mjs` | `handleRpc` | same privileged error |

### 4.4 `handleRpc` method table (fresh isolates, no live session)

| Call | Result |
|---|---|
| `{ method: "setup", params: { environment: "codex-app" } }` no `nodeRepl.config` | `Browser use requires privileged Node REPL capabilities` |
| `{ method: "execute", params: { type: "list_browsers" } }` never setup | `Browser runtime has not been initialized` |
| `{ method: "setup", params: { environment: "not-a-real-env" } }` | `Invalid browser service environment` |
| `{ method: "nope", params: {} }` | `Unsupported browser service request` |
| `setup` then `execute` in the **same** isolate after failed setup | still privileged error (`Xf` was assigned the rejected `W2()` promise) |
| `nodeRepl = { config: {}, env }` (config present, no `createElicitation`) | `Cannot read properties of undefined (reading 'bind')` inside `lne` (`createElicitation.bind`) — still not a live browser session |

Plugin-cache service: **same four messages**.

### 4.5 Stub `nodeRepl.rpc` (records the wire shape, does not talk to ChatGPT)

From `cwd=.../cua_node/lib`, `nodeRepl.rpc` stub returning a dummy `{ apiManifest, disabledMemberIds }`:

```
setupBrowserRuntime({
  environment: "codex-app",
  undocumentedApiMembers: ["Tab.ax"],
  excludedDocumentation: ["confirmations"],
})
→ Agent object keys [ 'documentation', 'browsers' ]
  browsers methods [ 'constructor', 'list', 'get', 'getDefault', 'getForUrl' ]
```

Recorded RPC:

```json
[{
  "svc": "browser",
  "req": {
    "method": "setup",
    "params": {
      "environment": "codex-app",
      "undocumentedApiMembers": ["Tab.ax"],
      "excludedDocumentation": ["confirmations"]
    }
  }
}]
```

That is the exact tinysky → trusted-worker call the live banner makes. `environment` default `"codex-app"` matches the service allow-list (`codex-app` \| `training` \| `cloud`).

### 4.6 `setupCUA({ browser: true })` without nodeRepl

```
import("@oai/cua/tinyskyAlt") → setupCUA
setupCUA({ browser: true, computer: false })
→ Browser use requires a trusted Node REPL browser service
```

Tinysky imports the **vendored** client (`oai_js_browser/dist/skill/scripts/browser-client.js`) and calls `setupBrowserRuntime({ decorateTab, undocumentedApiMembers: ["Tab.ax"], ... })`, which hits the same `nodeRepl.rpc` gate. Production **service** is still `@oai/browser-desktop/service` via trusted RPC.

**Finding:** reconstruction of the client/service is real and importable from the live app + plugin-cache trees, but a working Agent/CUA object **requires** the ChatGPT node_repl trusted worker (`rpc` + `config` + `createElicitation`). That is expected, not a gap in the map.

---

## 5. Why live `listTabs` was not executed (and what we listed instead)

`GOAL.md` allows browser inventory/bind only. Doing it **through the live session** means one of:

1. Write a `js` cell on node_repl 5769 stdio (forbidden — that stdio belongs to ChatGPT).
2. Call `handleRpc({ method: "setup" })` in a new Node process with a forged privileged `nodeRepl`, which constructs `browserContext` against the same IAB/extension native hosts (second session / possible claim — hijack).

We did neither.

Read-only substitutes that do **not** enter the CUA tab-control path:

### 5.1 Plugin diagnostic scripts (live, inventory only)

Run with ChatGPT Node against `~/.codex/plugins/cache/openai-bundled/browser/26.903.61454/scripts/`:

`installed-browsers.js --json`

- default http(s) handler: `com.google.chrome`
- installed: Google Chrome `152.0.7977.83` (`/Applications/Google Chrome.app`), Microsoft Edge `152.0.4191.66`

`chrome-is-running.js --json`

- Chrome **running** (PID 683 + helpers)
- Edge **running** (PID 723 + helpers)

`check-extension-installed.js --json`

- Chrome Default: extension `hehggadaopoacecdllhhajmbjkdcmajg` **installed + enabled**, version `1.26.901.11451_0`
- Edge Default: same id **installed + enabled**, same version

`check-native-host-manifest.js --json`

- `com.openai.codexextension` manifests **correct** for Chrome, Edge, Brave, Opera (and the script’s other families)
- Chrome manifest path: `~/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.openai.codexextension.json`
- host binary: `~/.codex/plugins/cache/openai-bundled/chrome/latest/extension-host/macos/arm64/ChatGPT for Chrome`
- allowed origins: `chrome-extension://hehggadaopoacecdllhhajmbjkdcmajg/`, `chrome-extension://odlomjlbamekndcpllcnffbgeohgkmjh/`

This matches live env `BROWSER_USE_AVAILABLE_BACKENDS=chrome,iab` and the extension host process 26871.

### 5.2 IAB (in-app browser)

Not a separate “Chrome” binary. It is ChatGPT’s Codex Framework (`--owl-scoped-user-agent-prefix=CodexBrowser`, `--user-data-dir=/Users/dongdong/Library/Application Support/Codex`). Sockets under `/tmp/codex-browser-use/` are owned by ChatGPT 3579. Listing IAB tabs would be `browsers.list()` type `"iab"` then `tabs.list()` inside the trusted service — not done.

### 5.3 CUA tab inventory

**Not obtained.** No `list_browsers` / `list_tabs` RPC was sent on the live worker. Static+import+env is the live evidence for the browser surface, as allowed by the task when bind-without-hijack is impossible.

---

## 6. Trace vs recommended plugin flow (still a valid path)

Plugin `browser-description.md` (also the live js tool text) prefers:

- named `@Browser` → `createBrowserTab("iab", url, { visible })`
- unnamed URL → `getBrowser({ url })` only to **select**

Task-1 did `getBrowser({ url })` → `listTabs` → `getTab("1")` and never `createBrowserTab`. That is the “page already open” path: `getForUrl` scores existing tabs (exact URL / origin+path / hostname). It does not navigate. Traces match the implementation, even if they skip the advertised `createBrowserTab` shortcut.

Playwright + `dev.logs` appear only after first-use docs (`tinysky-alt-other-browser-apis.md` + generated API reference). That is why they are absent from `NODE_REPL_TOOL_OVERRIDES` but present in the later trace cells.

---

## 7. Check matrix (browser surface)

| Trace API | Contract | Live env | Live call | Result |
|---|---|---|---|---|
| `cua.getBrowser` | tinysky + `Browsers.getForUrl/get/list` + RPC `get_browser_for_url` | tool text + banner `setupCUA({browser:true})` | not issued | **shape_ok + env_ok**; live bind skipped |
| `cua.listTabs` | tinysky + `Tabs.list` + RPC `list_tabs` | service loaded in trusted-worker | not issued | **shape_ok + env_ok** |
| `cua.getTab` | tinysky + `Tabs.get` + RPC `get_tab` | tool text | not issued | **shape_ok + env_ok** |
| `browser.browserId` | `Browser.browserId` | — | property | **ok** |
| `browser.tabs.get` | `Tabs.get` | client class `He.get` | not issued | **shape_ok** |
| `tab.click` | decorateTab → `AXAPI.click` → `tab_ax_action` | — | **not issued** (mutating) | **shape_ok** |
| `tab.typeText` | decorateTab → `AXAPI.typeText` | — | **not issued** (mutating) | **shape_ok** |
| `tab.getAXState` | decorateTab → `AXAPI.get("state")` → `tab_ax_get_state` | docs + `{emit:false}` path | not issued | **shape_ok** |
| `tab.playwright.locator.fill/press/evaluate` | `PlaywrightAPI`/`PlaywrightLocator` + RPCs | api.json | **not issued** (mutating / page inspect) | **shape_ok** |
| `tab.dev.logs` | `TabDevAPI.logs` + `tab_dev_logs` | api.json | not issued | **shape_ok** |
| `nodeRepl.write` | kernel + tinysky emit + live js-output-description | PID 5769 tool overrides | not issued | **shape_ok + env_ok** |
| client/service import | package exports | app + plugin-cache | **executed** | **pass** (gates as specified) |
| `setupBrowserRuntime` without rpc | source throw | — | **executed** | **pass** (`trusted Node REPL browser service`) |
| `handleRpc setup` without `nodeRepl.config` | source throw | — | **executed** | **pass** (`privileged Node REPL capabilities`) |
| stub rpc setup payload | tinysky options | — | **executed** | **pass** (`codex-app` + `Tab.ax` + `confirmations`) |
| Chrome/IAB backends | `BROWSER_USE_AVAILABLE_BACKENDS` | chrome running, extension enabled, native host correct, IAB Codex processes up | diagnostics only | **pass** (inventory, not CUA tab list) |

Required GOAL.md line *“`cua.getBrowser` / `listTabs` / `getTab` — live browser inventory if IAB/extension is up”*: extension + IAB **are** up; CUA `list()` was not called. Inventory proof is process/env/diagnostics, not `tabs.list()` rows.

---

## 8. What this does not prove

- Did not observe a live `list_browsers` JSON from the running trusted-worker.
- Did not confirm which backend (`iab` vs `extension`/`chrome`) task-1 actually bound — traces never print `browser.type`. `getBrowser({ url: "https://ant.design/..." })` prefers an existing tab match; non-localhost URLs prefer extension over iab in the service scorer, but IAB wins if it already has the page.
- Did not execute Playwright/AX against ant.design (forbidden replay).
- Did not treat plugin-cache `browser-service.mjs` as the cua_repl service; launch.mjs **replaces** it with `@oai/browser-desktop/service` for PID 5769. PID 5746 still points at the cache copy (parallel `node_repl` MCP, no tinysky banner).

---

## 9. Absolute paths touched (read-only)

- `/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node`
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node_repl` (process list / env only)
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/browser-desktop/{package.json,docs/api.json,docs/documents.json,docs/tab-mentions-iab.md,scripts/browser-client.mjs,scripts/browser-service.mjs}`
- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/cua/{package.json,dist/lib/js/oai_js_cua/src/tinysky_alt/globals.js,dist/lib/js/oai_js_cua/src/tinysky_alt/create_tinysky_alt.js}`
- `/Users/dongdong/.codex/plugins/cache/openai-bundled/unified-computer-use/26.903.61454/scripts/launch.mjs`
- `/Users/dongdong/.codex/plugins/cache/openai-bundled/unified-computer-use/26.903.61454/resources/{banner.js,browser-description.md}`
- `/Users/dongdong/.codex/plugins/cache/openai-bundled/browser/26.903.61454/scripts/{browser-client.mjs,browser-service.mjs,installed-browsers.js,chrome-is-running.js,check-extension-installed.js,check-native-host-manifest.js,extension-ids.json}`
- `/Users/dongdong/.codex/plugins/cache/openai-bundled/browser/26.903.61454/docs/api.json`
- `/Users/dongdong/Library/Application Support/Google/Chrome/NativeMessagingHosts/com.openai.codexextension.json`
- `/Users/dongdong/Desktop/codex-cua-reverse/traces/task-1-ant-design-form.json`
- `/Users/dongdong/Desktop/codex-cua-reverse/vendor/browser-desktop/docs/api.json` (hash-equal)
- Live kernel temp (read-only): `/var/folders/sz/2jf5mk0n3fj161vq1tjphn_40000gn/T/.tmpRm51mH/trusted-worker.js`
