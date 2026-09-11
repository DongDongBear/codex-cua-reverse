# CROSSCHECK — agents 01–07 × catalog × raw.json

Integrator: agent 08. Independent re-read of:

- `agents/01-cua-tinysky/FINDINGS.md` … `agents/07-native-app/FINDINGS.md`
- `CAPABILITIES.md`, `CAPABILITY-CATALOG.json`
- `/Users/dongdong/Desktop/codex拦截-两轮-raw.json` `tasks[].frames` (not `traces/*.json` as source of truth)

Do not invent. Quotes are from those files or from the raw capture. Unnamed protocol items are kept.

**Raw parse (this agent).** `tasks[0]` 1265 frames, `tasks[1]` 1624 frames. Function names taken from `response.output_item.done.item.name`. `response.function_call_arguments.done` has keys `{type, arguments, item_id, output_index, sequence_number}` only — no `name` / `call_id`.

| Source | `js` | `js_reset` | `request_user_input_async` | other |
|---|---:|---:|---:|---|
| raw `output_item.done` | 37 | 1 | 1 | 0 (`exec` = 0, `sky.*` in code = 0) |
| `CAPABILITY-CATALOG.json` `tools_in_raw` | 37 | 1 | 1 | — |
| `traces/*.json` | 37 | 0 named | 0 named | 2× `name: "js?"` |

---

## 1. Agreements

Claims made independently by **≥2** of agents 01–07, with a file:line or quote. (This agent counted as confirmation of the raw parse, not as a second reverse agent.)

### A1. Live model API is tinysky-alt `globalThis.cua`, not package-main `@oai/cua`

- **01** `FINDINGS.md:1–6`, `:28–31`: plugin banner `await (await import("@oai/cua/tinyskyAlt")).setupCUA({ browser: true, computer: true })`. Package-main `cua.js` is a stub (`initialize` / `computer` / `browsers` / `documentation`).
- **04** `FINDINGS.md:7`, `:345–358`: first `js` prepends `NODE_REPL_JS_BANNER` → `setupCUA(...)`.
- **06** `FINDINGS.md:5–7`: banner installs global `cua`; it does **not** collect inventory; traces’ first cell was `cua.getBrowser({url})`.

### A2. Model-facing tools `js` / `js_reset` / `turn_ended` are `node_repl` MCP tools; the plugin only wraps

- **04** `FINDINGS.md:3`: “not implemented by either plugin. They are the stock MCP tools of … `cua_node/bin/node_repl`.” Unified-computer-use is a hidden stdio wrapper (`mcpServers.cua_repl`).
- **06** `FINDINGS.md:1–3`: Rust MCP stdio server `node_repl@0.1.0`; unified Computer Use wraps it as MCP server `cua_repl`.
- **03** `FINDINGS.md:297–327`: intercept namespace `mcp__cua_repl` with nested tools `js`, `js_reset`.

### A3. Wire tool name is unprefixed `js`; namespace is `mcp__cua_repl`

- **03** `FINDINGS.md:336–337`: “Trace events record the inner tool as `"name": "js"`, not `mcp__cua_repl__js`. The outer namespace is `mcp__cua_repl`.”
- **04** `FINDINGS.md:378–379`: intercepted traces store `"name": "js"`; Codex special-cases server names `node_repl` and `cua_repl`.
- **05** `FINDINGS.md:5`, `:32–37`: every UI action is the `js` tool; schema `{code, timeout_ms, title}`, `timeout_ms` never set.
- Independent raw: 37× `item.name === "js"`; first `response.create` `input[0].tools[]` includes `{type:"namespace", name:"mcp__cua_repl", tools:[{name:"js"},{name:"js_reset"}]}`. `turn_ended` is **not** in that model-visible namespace (0 hits in create payloads).

### A4. `js_reset` discards JS bindings, not OS / browser state; next `js` re-runs the banner

- **04** `FINDINGS.md:336–338`, `:388–390`: override text “does not close browser tabs or native apps”; next `cua_repl.js` call initializes a fresh runtime.
- **05** `FINDINGS.md:215–218`: tool output `js kernel reset`; following `cua.getApp` re-emits first-use docs.
- **06** `FINDINGS.md:7`, `:168–169`: kills the Node kernel; banner runs again.
- Independent raw: `call_cz8IXBshRbd0EthRf9w7Y2xW` output `js kernel reset`; next cell `let linear = await cua.getApp('com.linear')` result starts with `## Computer Use`.

### A5. Native control in these captures is `cua.getApp` → `App extends Target`, not `sky.*`

- **01** `FINDINGS.md:218–241`: `getApp` binds Target methods onto `sky.get_app_state` / `sky.click` / …
- **02** `FINDINGS.md:31–32`: unified-computer-use wraps Mac `sky` as `cua.getApp(name)` / `app.click(index)`.
- **05** `FINDINGS.md:12–13`: “`sky.*` is unused.” Native is the Target from `cua.getApp`.
- Independent raw: 0 matches of `\bsky.\w+` in any `js` `code`. Four `cua.getApp` calls (`"Linear"` then `'com.linear'`).

### A6. On this Mac, live `sky` is the **window** client (`target: "mac"`), not window2 / full-desktop

- **02** `FINDINGS.md:5–15`: three-way `SkyClient` union; darwin → `WindowComputerUseClient`. Window2 is Windows-only; full-desktop is Linux-only.
- **01** `FINDINGS.md:580–584`: live `sky` is that union; mac has `get_app_state` / `list_apps`; linux/windows differ.
- **07** does not restate the TS union, but the live clicker it names (`SkyComputerUseService` / `ComputerUseIPCAppGetSkyshotRequest`) is the Mac window IPC, not window2 `get_window_state` / linux `get_screenshot`.

### A7. JS `@oai/sky` talks Unix-socket JSON-RPC `CodexComputerUseIPC-5`; `SkyComputerUseClient` MCP is a different path (XPC) and is not the clicker

- **02** `FINDINGS.md:16–17`, `:580–590`: length-prefixed JSON-RPC, handshake `CodexComputerUseIPC-5`, socket under the app-group container.
- **04** `FINDINGS.md:441–447`: same socket; live `SkyComputerUseService` parent is ChatGPT.app; plugin MCP `SkyComputerUseClient mcp` unused (`[mcp_servers.computer-use] enabled = false`).
- **06** `FINDINGS.md:291–292`: `nodeRepl.nativePipe` to `computeruse.sock`.
- **07** `FINDINGS.md:5–23`: **SkyComputerUseService** clicks/types; Client is LSUIElement MCP helper over **XPC**; JS path “does **not** use XPC”.

### A8. `Tab` is `BrowserTab & Target`; tinysky `decorateTab` copies `tab.ax.*` onto the tab

- **01** `FINDINGS.md:155`, `:164–185`: `Object.assign(tab, { click: (t,o) => tab.ax.click(t,o), … })`; `undocumentedApiMembers: ["Tab.ax"]`.
- **03** `FINDINGS.md:66`: “Tinysky **decorates** the low-level tab so `tab.click(325)` is `tab.ax.click(325)`.”

### A9. `cua.getBrowser` selects a browser and dumps docs; it does **not** open a tab

- **01** `FINDINGS.md:261–278`: `id` wins over `url`; no tab open.
- **03** `FINDINGS.md:106–114`: “Does **not** open a tab.” Plugin copy: “Selecting a browser does not open a tab.”
- **05** `FINDINGS.md:236`: `getBrowser({url})` returns docs, not a tab; URL is a selector.
- Independent raw: call 1 code `let browser = await cua.getBrowser({ url: "https://ant.design/components/form" });` then call 2 `cua.listTabs` / call 3 `cua.getTab("1", …)` — no `createBrowserTab` / `tab.goto`.

### A10. Browser ids `"iab"` / `"chrome"` / `"edge"` are selector aliases; live ids in this capture were `"1"`

- **01** `FINDINGS.md:271`: `browsers.get(id)` “by id **or client type**”.
- **03** `FINDINGS.md:163–178`: matcher by type / Chromium family / exact instance id.
- **05** `FINDINGS.md:237`: `listTabs` → `browserId:"1"`, tab `id:"1"` — session-numeric, not the docs literals.
- Independent raw: `listTabs` output head `[{"id":"1","providerTabId":"e118c787-0c80-43ff-b884-63d7e1235315",…`; `getTab("1")` output `Browser tab: 1, Title: "Form - Ant Design", URL: "https://ant.design/components/form"`.

### A11. Playwright on `tab` / `pt` is a Codex injected subset, not stock `playwright.Page`

- **01** `FINDINGS.md:528–561`: `PlaywrightAPI` over CDP `__codexPlaywrightInjected`; “not stock `playwright` npm `Page`.”
- **03** `FINDINGS.md:200–218`: client class RPCs `playwright_*`; `evaluate` is read-only; no `locator.setInputFiles`.
- **06** `FINDINGS.md:116`: packages `playwright` / `playwright-core` **1.57.0** are present for `tab.playwright` — agrees the npm package exists, not that a Playwright browser process is launched (see C8).

### A12. Dual MCP servers: generic `node_repl` and plugin `cua_repl`; traces are the tinysky / `cua_repl` description

- **04** `FINDINGS.md:16`, `:525–542`: two live `node_repl` processes; traces use `cua.getBrowser` / `tab.click` / `cua.getApp` = cua_repl description, not the computer-use skill’s `sky.*` bootstrap.
- **06** `FINDINGS.md:61–63`: parallel path without banner vs unified tinysky path with global `cua`.

### A13. `enabled_tools` on `cua_repl` is `js`, `js_reset`, `turn_ended` — drops `js_add_node_module_dir`; `turn_ended` is hook-facing, omitted from the intercept namespace

- **04** `FINDINGS.md:87`, `:101`, `:368–373`.
- **03** `FINDINGS.md:307–339`: `enabled_tools` same three; `turn_ended` in hooks, omitted from intercepted namespace tools array.
- **06** `FINDINGS.md:390–392`.
- Independent raw: model-visible `mcp__cua_repl.tools` = `js` + `js_reset` only. `js_add_node_module_dir` count in create payloads = 0. `turn_ended` count = 0.

### A14. `nodeRepl.write` / `emitImage` are the observation channels; `{emit:false}` suppresses state, not first-use docs

- **01** `FINDINGS.md:397–410`, `:614–616`.
- **06** `FINDINGS.md:394–407`.
- **05** `FINDINGS.md:240`: `getAXState({emit:false})` + `nodeRepl.write(filter)`.
- Independent raw: 10× `nodeRepl.write(` in task-1 code; 0 in task-2 (native Target auto-emit). `getScreenshot` result is an image part (internal `emitImage`).

### A15. `cua.getApp` / `listApps` are Mac-only at the TinySky layer

- **01** `FINDINGS.md:115–120`: throw `Native app bindings are unavailable for ${target}` unless `sky.target === "mac"`.
- **02** `FINDINGS.md:619`: tinysky binds only if `sky.target === "mac"`.
- **06** `FINDINGS.md:280`.

### A16. Pre-extracted `traces/*.json` mislabels two non-`js` items as `js?`

- **05** `FINDINGS.md:14`, `:191–196` (joined `output_item.done`).
- Independent raw: same two `item_id`s (see §2 C1 and §3). Agent 05 used websocket JSONL; this agent used `codex拦截-两轮-raw.json`. Counts and names match.

---

## 2. Contradictions

Each item: the disagreeing claims, evidence, then **resolved** or **OPEN**.

### C1. `traces/*.json` `js?` vs raw `request_user_input_async` / `js_reset` — RESOLVED (raw wins)

| item_id | `traces/*.json` | raw `output_item.done` |
|---|---|---|
| `fc_05a61cc4349bad21016aa280a05f0487d081bb1e09838a7da0` | `name="js?"`, `call_id=null`, event `function_call_arguments.done`, args.questions | `name="request_user_input_async"`, `call_id="call_8ttSMORM5eSYvZywmZv8VPhP"`, same args, ts `2026-09-10T10:04:17.965Z` |
| `fc_05a61cc4349bad21016aa280f6cf9887d08fe9980781dc6353` | `name="js?"`, `call_id=null`, args `{}`, ts `…42.847Z` | `name="js_reset"`, `call_id="call_cz8IXBshRbd0EthRf9w7Y2xW"`, args `{}`, ts `…42.848Z` |

Cause (05 `FINDINGS.md:197–198`, independently confirmed): `arguments.done` has no `name`/`call_id`. **Keep both protocol items.** Do not treat `js?` as a CUA API.

`CAPABILITY-CATALOG.json` `tools_in_raw` already uses the raw names. `js_call_count: 39` counts all function_call items (37+1+1), which is easy to misread as “39 js calls”.

### C2. Native error `-10005: noWindowsAvailable` vs JS enum `unknownError: -10005` — OPEN (layers)

- Raw tool results for both `linearApp.click([119,35])` cells: `Computer Use server error -10005: noWindowsAvailable`.
- **07** `FINDINGS.md:156` and **02** `d.ts/targets/mac/errors.d.ts:7`: `-10005` = `unknownError`. No `noWindowsAvailable` in that enum (`-10000…-10020`).

**Not a capture error.** The wire message name is `noWindowsAvailable`; the JS `ServerErrorCode` name for the same numeric code is `unknownError`. Whether native Swift added a new name on `-10005` or JS is stale is **OPEN**. Code number agrees.

### C3. Catalog / `CAPABILITIES.md` `in_traces` flags vs raw JS callees — RESOLVED (catalog wrong on several rows)

Model-visible callees in the 37 `js` bodies (occurrence counts):

```
app.click 14, tab.getAXState 12, tab.click 11, nodeRepl.write 10,
app.getAXState 9, app.getAXStateAndScreenshot 8, tab.playwright.locator 7,
cua.getApp 4, app.pressKey 3, browser.browserId 2, tab.typeText 2,
app.performSecondaryAction 2, app.typeText 2, app.setValue 2,
cua.getBrowser 1, cua.listTabs 1, cua.getTab 1, browser.tabs.get 1,
tab.dev.logs 1, app.getScreenshot 1, cua.listApps 1, app.paste 1
+ locator.fill 4, locator.press 2, locator.evaluate 1
```

These match `CAPABILITY-CATALOG.json` `trace_apis` **except** `trace_apis` omits `locator.fill` / `.evaluate` / `.press` as their own rows (they are folded into `tab.playwright.locator` ×7).

**False positives** (`in_traces: true` in catalog, not a model-visible callee in raw):

| Catalog id | Why it is not in raw `code` |
|---|---|
| `PlaywrightLocator.click` | Clicks are `tab.click(n)` (Target/AX), never `locator.click` |
| `PlaywrightLocator.locator` | Nested `locator().locator()` never used; used `PlaywrightAPI.locator` |
| `AXAPI.write` | Model called `nodeRepl.write`, not `tab.ax.write`. Tinysky `getAXState` internally `write`s via `nodeRepl`, not AXAPI.write |
| `AXAPI.performSecondaryAction` | Only `linearApp.performSecondaryAction` (sky Target), never `tab.ax.*` |
| `AXAPI.pressKey` | Only `app.pressKey` |
| `AXAPI.setValue` | Only `app.setValue` |
| `Browsers.get` | Model called `cua.getBrowser({url})` / `cua.getTab` / `cua.listTabs`. `Browsers.get` may run **inside** tinysky when `browserId` is `"1"`; it is not in `code` |

**False negatives** (`in_traces: false` but present in raw `code` or as the object the model used):

| Catalog id | Evidence |
|---|---|
| `PlaywrightLocator.fill` | `pt.playwright.locator('[id="validateOnly_name"]').fill(...)` (4×) |
| `PlaywrightLocator.evaluate` | `.evaluate(el=>({value:el.value,…}))` (1×) |
| `PlaywrightLocator.press` | `.press('ControlOrMeta+a')` / `.press('Backspace')` (2×) |
| `Tab.playwright` | `pt.playwright.locator` — property used, flagged false |
| `Browser.tabs` | `browser.tabs.get("1")` — property used, flagged false (`Tabs.get` is true) |
| `Browsers.getForUrl` | Implementation of `getBrowser({url})` (01 `:271–272`, 03 `:111`). Internal, not in `code` — same class as `Browsers.get` |

`CAPABILITIES.md` §4 copies those YES/— marks (`AXAPI.write` YES, `PlaywrightLocator.click` YES, `PlaywrightLocator.fill` —). Treat §4 YES as **not** independently verified.

Agent 05’s rollup is **per-`js`-call presence** (`tab.click` in 7 cells). Catalog `trace_apis` is **occurrence** count (`tab.click` 11). Both are consistent with the same source if the aggregation is named.

### C4. `cua.initialize` exists, is omitted from the docs the model saw, and is absent from the catalog tinysky list — RESOLVED as “dead for ChatGPT.app”

- **01** `FINDINGS.md:348–354`: `js-tool-description.md` never mentions `initialize()`; default docs key `core-cua-repl` omits it; `core-node-repl.md` includes it only if `TINYSKY_ALT_INITIALIZE_DOCS=core-node-repl` (unset here).
- **06** `FINDINGS.md:5–7`, `:217–226`: after the banner, `initialize()` ≡ `getState()`; traces never call it.
- Catalog tinysky list has no `cua.initialize`. Independent raw: 0 `cua.initialize`.

Not a runtime contradiction. Catalog gap if the goal is “every TinySky member”, not if the goal is “what ChatGPT.app teaches”.

### C5. Tool-description name `cua_repl.js` vs wire `js` — RESOLVED (docs alias)

- **04** `FINDINGS.md:336–338`: `js-reset.md` “next **cua_repl.js** call”.
- **03** `FINDINGS.md:332`: “product name for the next `js` invocation, not a third tool.”
- Raw / intercept: tool `name` is `js`.

### C6. Point type: Target `Vec2 = [x,y]` vs sky `{x,y}` — RESOLVED at the App façade; OPEN for screenshot pixels vs points

- **01** `FINDINGS.md:161–162`, QUESTIONS §6: App `click`/`scroll`/`drag` uses `Array.isArray` → coords, else `element_index`. Passing sky `{x,y}` would be treated as `element_index`.
- **02** `FINDINGS.md:149`: `Point = { x: number; y: number }` for sky.
- Independent raw: `linearApp.click([119,35])` — tuple, as Target docs. Both coordinate clicks returned `-10005 noWindowsAvailable` (so the conversion was attempted; the failure is window availability, not parse).

**OPEN** (02 QUESTIONS §9, not contradicted by another agent): screenshot **pixels** vs logical **points** (`should_normalize_screenshot_to_point_resolution` unwired in JS).

### C7. Tab `paste` always `Ctrl+v` on darwin — OPEN

- **01** `FINDINGS.md:247–256` and QUESTIONS §10: Tab paste writes clipboard then `tab.ax.pressKey("Ctrl+v")` with no `Meta+v` branch. App paste goes through `sky.paste` and restores the pasteboard.
- No other agent confirmed AX key translation. Independent raw used **App** `linear.paste(..., {format:'text'})`, not Tab paste.

### C8. `playwright` npm 1.57.0 vs “not a Playwright process” — RESOLVED

- **06** lists the package under `lib/node_modules`.
- **01** / **03**: the object on `Tab` is a Codex subset over CDP inject, not `chromium.launch()`.

Coexist: the npm package is a dependency of the injected subset; ChatGPT.app does not expose stock Playwright browser contexts to the model.

### C9. `globalThis.agent` undocumented extra — not a contradiction

- **01** `:129–131`, **03** `:68`, **06** `:16`, `:296–298`: when browser is enabled, `Reflect.set(globalThis, "agent", runtime)`. Model docs never mention it. Traces never used `agent.*` (independent raw: 0). Leftover / escape hatch; **OPEN** as product intent (01 Q15, 06 Q10).

### C10. Catalog `tasks[1].user` vs agent 05’s “Linear request” string — RESOLVED (different fields)

- Raw `tasks[1].user` = last user message `请你帮我打开，全权由你控制`; `users_all` has three strings, including `操作我电脑上的 linear 应用建一个 issue 指给我`.
- Catalog copied `tasks[].user` (last).
- **05** labeled the capture with the Linear request (`FINDINGS.md:10`, `calls.json` parse.sessions.user).

Both are in the file. Catalog is not wrong vs `tasks[].user`; it is a poor title for the native task.

### C11. Which MCP server served the captured `js`? — RESOLVED enough for the API map

- **04** Q1 / **06** Q2: both `node_repl` and `cua_repl` were live; wire name is unprefixed `js`.
- API in `code` is tinysky (`cua.getBrowser` / `cua.getApp`) and the `js` description in the first create is the concatenated CUA markdown (`await cua.getState();` / `createBrowserTab("iab", …)` / `cua.getApp("Example App")`). That text is `NODE_REPL_TOOL_OVERRIDES` from `launch.mjs` (**04** `:312–334`). Generic `node_repl` keeps the stock REPL blurb (**04** `:536`).

**Resolved:** these two tasks used the **cua_repl / tinysky** tool description. Whether Codex also registered a second unprefixed `js` is OPEN and does not change the callee map.

---

## 3. Trace coverage vs catalog

Criterion: **every function_call in raw.json maps to a catalog API**. Protocol items without CUA `code` are not dropped.

### 3.1 Wire inventory (raw `output_item.done`)

Task 1 `task-1-ant-design-form` — 14× `js`:

| # | call_id | title | `code` callees → catalog ids |
|---|---|---|---|
| 1 | `call_L5p0JtR28cUwYwLPKIq1YonC` | 查看 Ant Design 表单页面 | `cua.getBrowser` → `cua.getBrowser` (internal `Browsers.getForUrl`) |
| 2 | `call_ZadPs7v59UMruvLQA0CdL4sE` | 找到当前表单标签页 | `cua.listTabs` + `browser.browserId` → `cua.listTabs`, `Browser.browserId` |
| 3 | `call_ubx0Uvj0gW7qFmrNzSMmo1Uv` | 读取表单控件 | `cua.getTab` → `cua.getTab` |
| 4 | `call_F4uUYfYoeP8bXeqe7xj85KEG` | 测试空表单提交校验 | `tab.click`, `tab.getAXState` → `target.click`, `target.getAXState`, `AXAPI.click`, `AXAPI.get` |
| 5 | `call_kXnXtlEF9NJEgbv99e5MyCKK` | 输入测试字符并提交基础表单 | `tab.click`, `tab.typeText`, `tab.getAXState` → `target.click` / `typeText` / `getAXState`, `AXAPI.click` / `typeText` / `get` |
| 6 | `call_dEw4JndQkLuX8yqvU36cDC8v` | 确认提交回调并测试自动填充 | `browser.tabs.get`, `nodeRepl.write`, `pt.dev.logs`, `tab.click`, `tab.getAXState` → `Tabs.get`, `nodeRepl.write`, `TabDevAPI.logs`, Target/AX click+get |
| 7 | `call_UPYTMdKeN0YhnKPtPqFNxIPt` | 测试下拉选择选项 | `tab.click`, `tab.getAXState` |
| 8 | `call_XPsviJ0LZNLTllylvqVzcG4Z` | 确认选择性别后的输入联动 | `tab.click`, `nodeRepl.write`, `tab.getAXState({emit:false})` |
| 9 | `call_vUY0Vx1Re12kkEztNnBv3AFJ` | 测试提交及 Reset 清空 | `tab.click` ×2, `nodeRepl.write`, `tab.getAXState` |
| 10 | `call_VfRcedGPXnBSz9YHs5dNJwUG` | 测试填写后启用 Submit | `pt.playwright.locator.fill` ×2, `nodeRepl.write`, `tab.getAXState` → `Tab.playwright`, `PlaywrightAPI.locator`, `PlaywrightLocator.fill` |
| 11 | `call_9y2Jy5aafnIMSuG9aR2193J4` | 点击已启用的提交按钮 | `tab.click`, `nodeRepl.write`, `tab.getAXState` |
| 12 | `call_aMAHRSl7rlFLxj0z0yihBxbG` | 验证清空后禁用和实时值更新 | `locator.fill` ×2, `nodeRepl.write`, `tab.getAXState` |
| 13 | `call_pAbvIYk9ixeXc49nqJjFNtVD` | 核实清空后的按钮状态 | `locator.evaluate`, `nodeRepl.write`, `tab.getAXState` → `PlaywrightLocator.evaluate` |
| 14 | `call_S9eGWGThQGrAu2YaPmyinWmX` | 用键盘删除内容测试必填条件 | `locator.press` ×2, `nodeRepl.write`, `tab.getAXState` → `PlaywrightLocator.press` |

Task 2 `task-2-linear-issue` — 23× `js` + 2 protocol:

| # | name | call_id | title / args | catalog |
|---|---|---|---|---|
| 1 | `js` | `call_7eBgRNiEijToCfzJrdbXJ9D1` | `cua.getApp("Linear")` | `cua.getApp` |
| 2 | **`request_user_input_async`** | `call_8ttSMORM5eSYvZywmZv8VPhP` | `questions[0].title` = issue-title prompt | **no catalog id** (functions namespace, not `mcp__cua_repl`) |
| 3 | `js` | `call_mt4bGWYajFh94z9LU7AimQbC` | `linearApp.getScreenshot()` | `target.getScreenshot` (internal `nodeRepl.emitImage`) |
| 4 | `js` | `call_SrK5LaMSBriPmXtBBFYoQk6m` | `performSecondaryAction(0,"Raise")` + `getAXState` | `target.performSecondaryAction`, `target.getAXState` |
| 5 | `js` | `call_Q06vVWljqx4MxysBQMvceR8M` | `performSecondaryAction(4,"zoom the window")` + `getAXStateAndScreenshot` | `target.performSecondaryAction`, `target.getAXStateAndScreenshot` |
| 6 | `js` | `call_gY3Vatk5iFOXqVFyHuXUHWlh` | `pressKey('c')` + `getAXStateAndScreenshot` | `target.pressKey`, `target.getAXStateAndScreenshot` |
| 7 | `js` | `call_jNO6ISaArW8EX2vLUddBELFC` | `click([119,35])` + `getAXStateAndScreenshot` | `target.click` — result `-10005 noWindowsAvailable` |
| 8 | `js` | `call_M6fCCal3FCFs5n2PRLBpNqy5` | `cua.listApps()` | `cua.listApps` |
| 9 | `js` | `call_SbcPbm4TDMO7ZJOS6TuwQsIx` | `cua.getApp('com.linear')` | `cua.getApp` |
| 10 | `js` | `call_DloWqijxmEuYTXFSyAtBK8q0` | `click([119,35])` again | `target.click` — same `-10005` |
| 11–13 | `js` | … | index `click` + `getAXState` / `getAXStateAndScreenshot` | `target.click` + observe |
| 14 | `js` | `call_cp5Wcq4ysY9lqLBlf3Gcq6wK` | `cua.getApp('com.linear')` | `cua.getApp` |
| 15 | `js` | `call_41BKTBgXLBC0csekKrQOOZzW` | `pressKey('super+space')`, `typeText('Linear')`, `pressKey('Return')` | `target.pressKey`, `target.typeText` |
| 16 | **`js_reset`** | `call_cz8IXBshRbd0EthRf9w7Y2xW` | `{}` | `js_reset` |
| 17 | `js` | `call_Q1P3YByOoYEqROmEqTr5gfot` | `cua.getApp('com.linear')` as `linear` | `cua.getApp` |
| 18–23 | `js` | … | `linear.click` / `typeText` / `paste({format:'text'})` / `setValue` / `getAXState` | `target.click` / `typeText` / `paste` / `setValue` / `getAXState` |

**37/37 `js` bodies map to catalog tinysky + repl + browser-desktop members.**

**1/2 protocol items map** (`js_reset`). **`request_user_input_async` does not** — it is listed in `tools_in_raw` but has no row under `repl` / `tinysky` / `sky` / `browser_desktop`.

### 3.2 Advertised but never a `function_call` (keep; not CUA catalog)

From first `response.create` `input[0].tools` (independent):

- `functions`: `exec` (custom lark), `wait`, `request_user_input`, `request_user_input_async` (used once)
- `clock.sleep`
- `collaboration.*`: `followup_task`, `interrupt_agent`, `list_agents`, `send_message`, `spawn_agent`, `wait_agent`
- `mcp__cua_repl`: `js`, `js_reset`

`timeout_ms` is in the `js` schema; never sent. `turn_ended` / `js_add_node_module_dir` are catalog `repl` rows with `in_traces: false` — correct (not model-invoked here).

### 3.3 `api.json` vs catalog `browser_desktop`

Independent count: `vendor/browser-desktop/api.json` 22 interfaces, **146** members. Catalog `browser_desktop` = 146. Symmetric diff empty. Completeness of **membership** is DONE. Completeness of **`in_traces`** is not (C3).

### 3.4 Sky catalog vs traces

All 13 `sky.*` rows `in_traces: false`. Correct for model-visible `code`. CAPABILITIES.md marks them `reversed_unused (wrapped by cua.App)` — that wrapping is documented by 01/02, not observed as `sky.*` calls.

---

## 4. Remaining UNREVERSED

Definition used here: a **catalog item** with no FINDINGS coverage of the member (not even a grouped list), or a **used raw tool** with no catalog id.

### 4.1 Used in raw, missing from catalog API tables — NOT DONE

| Item | Evidence | Catalog |
|---|---|---|
| `request_user_input_async` | 1× function_call, output `{"accepted":true}` | only `tools_in_raw`; **no** `repl[]` / other id |
| `cua.initialize` | types + globals.js (01, 06); unused in traces | **not** in `tinysky[]` |
| `cua.browsers` / `cua.computer` | installed by `create_tinysky_alt` (01 `:567–588`, 06 `:17`) | **not** in `tinysky[]` |
| `PlaywrightLocator.fill` / `.evaluate` / `.press` as first-class `in_traces` | used in task 1 | ids exist, flags false |

### 4.2 Catalog items with FINDINGS coverage (grouped or field-level) — treat as reversed-as-shipped, unused

Tinysky unused (01 types + docs; `in_traces: false`): `cua.getState`, `cua.createBrowserTab`, `cua.listBrowsers`, `target.scroll`, `target.drag`, `target.selectText`, `tab.goto` / `back` / `forward` / `reload` / `close` / `markDeliverable` / `markHandoff`.

Sky unused as direct calls: all 13 rows; Mac methods are field-reversed by 02; audio gated (`SKY_ENABLE_AUDIO`, 02 `:50`).

Repl unused: `turn_ended` (04/06: real MCP tool + hooks, not in these creates), `js_add_node_module_dir`, `nodeRepl.emitImage` (used **internally** by `getScreenshot`; model never called it), `nodeRepl.emitAudio`, `nodeRepl.createElicitation`.

Browser-desktop: agent 03 lists every `api.json` interface. **Field-level** behavior (options, RPC name, backend support) is written up for the tinysky entry points, AX Target, Playwright subset limits, claiming, visibility, `sessionName`, and the seven capability markdowns (`FINDINGS.md` §10). Remaining members are **named in a list**, not exercised:

- `BrowserUser.getTabContext` — `documented: false`, `unsupportedByDefaultIn` all three types. In 03 **QUESTIONS.md** §7, **not** in FINDINGS. Closest to UNREVERSED.
- Dialog methods (`AlertDialog.dismiss`, `ConfirmDialog.accept` / `dismiss`, `PromptDialog.accept` / `dismiss`, `BeforeUnloadDialog.dismiss`) — 03 mentions `getJsDialog()` → alert/confirm/prompt/beforeunload; accept/dismiss not specified per type.
- `PlaywrightDownload.path` (`documented: false`).
- `PlaywrightFileChooser.isMultiple` (`setFiles` is in 03 `:217`).
- Locator text getters by name (`allTextContents`, `innerText`, `textContent`) — 03 says “text getters”.
- `CUAAPI.downloadMedia` / `DomCUAAPI.downloadMedia` (`documented: false`, unsupported on iab).
- `Tabs.content` — 03 `:427`: unsupported on iab/extension/cdp, “dead on this desktop runtime.”

CAPABILITIES.md §5 capabilities (`management`, `viewport`, `visibility`, `botDetection`, `browserAuth`, `cdp`, `pageAssets`, `webmcp`) are **not** rows in `CAPABILITY-CATALOG.json`. Agent 03 §10 tables them from `docs/capabilities/**`. Unused in these traces. Reverse = documentation + RPC names, not live calls.

### 4.3 Out of catalog, reversed by agents, not in these traces

- Window2 / full-desktop `sky.*` (02) — not live on this Mac.
- Native IPC types unused by `@oai/sky` JS (FrontmostWindow, AppStop, Skysight, Messages, Calendar, lock-screen socket) — 02 `:602`, 07 `:135`. Sibling product surfaces.
- `SkyComputerUseClient mcp` tool list — process not running (04, 07).

### 4.4 Open questions that block calling those rows “proven”

From agent QUESTIONS.md files, still OPEN after this cross-check (not silently closed):

- Tab paste `Ctrl+v` on macOS (01 Q10).
- Screenshot coordinate space (02 Q9).
- `-10005` native name vs JS `unknownError` (C2).
- Whether `cua.getTab`’s object includes `playwright` / `dev` (05 Q7). Types say `Tab = BrowserTab & Target` (01); model used a second handle `pt = browser.tabs.get("1")` for Playwright/`dev.logs` anyway. Not disproved.
- Dual unprefixed `js` servers (04 Q1) — API map still tinysky.
- `getTabContext` liveness (03 Q7).

---

## 5. Verdict

Goal: reverse **ALL** ChatGPT.app computer-use + browser-use capabilities and prove them against `/Users/dongdong/Desktop/codex拦截-两轮-raw.json`.

### DONE

- Process / package map: Electron `Di()` → `cua_repl` `launch.mjs` → `node_repl` → banner `setupCUA` → tinysky `cua` → `@oai/browser-desktop/service` and `@oai/sky/service` → `computeruse.sock` / `SkyComputerUseService` (01, 02, 03, 04, 06, 07).
- Model-used path in the two captures: 37 `js` cells map onto catalog tinysky Target + `cua.getBrowser` / `getTab` / `listTabs` / `getApp` / `listApps` + `Tabs.get` + `Tab.playwright` + `PlaywrightLocator.{fill,evaluate,press}` + `TabDevAPI.logs` + `nodeRepl.write` + `js_reset`.
- Mac `sky` window API (types + IPC request types + policy) reversed even though traces never spell `sky.*`.
- `api.json` 146-member catalog membership matches the on-disk contract.
- `js?` in `traces/*.json` identified and must not be trusted; raw names are `request_user_input_async` and `js_reset`.

### NOT DONE

1. **`request_user_input_async` is used in raw.json and is not a catalog API id.** GOAL-STATUS criterion “every js call maps … including `request_user_input_async`” fails as written.
2. **Catalog `in_traces` / CAPABILITIES.md §4 YES flags are wrong** for `PlaywrightLocator.click` / `.locator`, `AXAPI.write`, App-only Target methods attributed to `AXAPI`, and the missing fill/evaluate/press flags (`Tab.playwright` false).
3. **`traces/*.json` still contains `js?`** — downstream counts of “js calls” over-count CUA by 2 if they do not join `output_item.done`.
4. **Unused shipped surface** is listed (api.json, capabilities markdown, sky audio, window2/linux types) but not field-proven or live-proven. `BrowserUser.getTabContext` has essentially no FINDINGS coverage.
5. **Open naming / platform items** (C2, C6 coordinate space, C7 Ctrl+v) are not closed.
6. **Live mutating proof** of click/type/paste/setValue was correctly refused; those rows are shape-reversed, not replay-proven.

**Bottom line:** the **used CUA path** in the two-round capture is reversed and mapped. The **full shipped capability catalog** is not clean enough to call the goal complete: one used protocol tool is unnamed in the catalog, several catalog `in_traces` bits are false, and unused browser/native members remain list-reversed rather than proven.
