# FINDINGS — captured traffic mapped to CUA APIs

## Verdict

Both websocket captures are **one Codex thread** (`prompt_cache_key` `01a08a67-…`) talking to `gpt-6-astra` over `wss://chatgpt.com/backend-api/codex/responses`. The model never called Codex `exec`. Every UI action is the **`js` tool** (`mcp__cua_repl`), whose `code` runs in a persistent tinysky-alt REPL (`cua` / `Target` / `nodeRepl`).

| Capture | User request | Surface | Function calls |
|---|---|---|---|
| `0127_WS_backend-api_codex_responses` | 我在右侧的浏览器打开了 ant design 的 form 页面，请你帮我测试一下这些组件的可用性（输入字符 按一下 submit 这些） 请你开始 | **browser** (in-app browser already on `https://ant.design/components/form`) | 14× `js` |
| `0223_WS_backend-api_codex_responses` | 操作我电脑上的 linear 应用建一个 issue 指给我 | **native** (`cua.getApp("Linear")` / `'com.linear'`) | 23× `js` + 1× `request_user_input_async` + 1× `js_reset` |

- **`sky.*` is unused.** Native control is the Target object from `cua.getApp`, not `sky.click({ app, element_index })`.
- **`exec` is advertised, never invoked.** Every `response.create` injects `functions.exec` (custom lark-grammar JS orchestrator) beside `mcp__cua_repl.js` / `js_reset`. Zero `function_call` items named `exec`.
- Pre-extracted `traces/*.json` matches **all 37 `js` bodies, titles, call_ids, item_ids**. It disagrees on the two non-js protocol items (labeled `js?`, `call_id` null). Full websocket `output_item.done` names them `request_user_input_async` and `js_reset`. See [Cross-check](#cross-check-vs-tracesjson).

The primary table is unique logical calls **with `code`** (37 `js` invocations). Protocol items without CUA code stay in [Appendix A](#appendix-a--protocol-items-no-cua-code) — not dropped.

Full records (args, ids, delta reconstruction, results): [calls.json](calls.json).

## Parse completeness

Parsed **every JSONL line**, not a sample.

| File | Lines | up / down | `response.create` | `function_call` added = done | `arguments.done` | deltas vs done |
|---|---:|---:|---:|---:|---:|---|
| 0127 `websocket.jsonl` | 1265 | 16 / 1249 | 16 | 14 = 14 | 14 | 14/14 exact JSON match |
| 0223 `websocket.jsonl` | 1624 | 27 / 1597 | 27 | 25 = 25 | 25 | 25/25 exact JSON match |

Each record is `{ts, dir, text}`. Downlink `text.type` inventory: `calls.json` → `parse.sessions.*.event_types`. No leftover `item_id` with deltas but no `arguments.done`. No unnamed function_call once `output_item.done` is joined.

0127 create #1 is a handshake (additional_tools + developer system prompt only): **no user request, no function call**. The Form task starts on create #2. 0223 create #1 already carries the Form-task history plus the Linear request (same thread).

`js` schema (both sessions):

```json
{"type":"object","properties":{"code":{"type":"string"},"timeout_ms":{"type":"integer"},"title":{"type":"string"}},"required":["code"],"additionalProperties":false}
```

`timeout_ms` was never set. Every `js` call is `{code, title}`. `js_reset` args are `{}`.

Advertised namespaces on every create: `functions` (`exec`, `wait`, `request_user_input`, `request_user_input_async`), `clock.sleep`, `collaboration.*`, `mcp__cua_repl` (`js`, `js_reset`).

## How the model maps onto CUA

Same `js` tool, two Target surfaces:

1. **Browser (0127).** Ambient IAB already open. The model does **not** call `cua.createBrowserTab`. It calls `cua.getBrowser({ url })` (selects a browser; first-use dumps ~50k of CUA + BrowserTab docs), `cua.listTabs({browser: browser.browserId})`, `cua.getTab("1", {browser})`. Runtime tab id and `browserId` are both `"1"` (not the docs literal `"iab"`). AX clicks/types go through `tab` from `cua.getTab`. Playwright and `dev.logs` go through a second handle `pt = await browser.tabs.get("1")`.
2. **Native (0223).** `cua.getApp("Linear")`, then `'com.linear'` after `cua.listApps()` (Linear `id=com.linear`, running). Window ops are `linearApp.*` / `linear.*` (`App extends Target`). Coordinate click `[119,35]` twice returns `Computer Use server error -10005: noWindowsAvailable`. Menu-index clicks work. Mid-task `js_reset` wipes REPL bindings; the next `cua.getApp` re-emits first-use docs.

`getAXState()` is batched in the same `js` call as the action (docs: batch deterministic actions and the resulting getAXState). `{emit:false}` is used when the model then `nodeRepl.write`s a filtered subset.

Canonical names in the tables: `tab.*` = bound `Tab` (browser Target); `app.*` = bound `App` (native Target). Live identifiers (`pt`, `linearApp`, `linear`) are in `calls.json` → `observed_apis`.

## Primary table — unique logical `js` calls (with code)

### Task 1 · Ant Design Form · surface=`browser` · 14 calls

| # | tool | title | surface | APIs | code |
|---|---|---|---|---|---|
| 1 | `js` | 查看 Ant Design 表单页面 | browser | `cua.getBrowser` | `let browser = await cua.getBrowser({ url: "https://ant.design/components/form" });` |
| 2 | `js` | 找到当前表单标签页 | browser | `cua.listTabs` | `await cua.listTabs({browser:browser.browserId});` |
| 3 | `js` | 读取表单控件 | browser | `cua.getTab` | `let tab = await cua.getTab("1", {browser:browser.browserId});` |
| 4 | `js` | 测试空表单提交校验 | browser | `tab.click`, `tab.getAXState` | `await tab.click(325); await tab.getAXState();` |
| 5 | `js` | 输入测试字符并提交基础表单 | browser | `tab.click`, `tab.typeText`, `tab.getAXState` | `await tab.click(4523); await tab.typeText("测试用户_Test123"); await tab.click(4528); await tab.typeText("DemoOnly!123"); await tab.click(323); await tab.click(325); await tab.getAXState();` |
| 6 | `js` | 确认提交回调并测试自动填充 | browser | `browser.tabs.get`, `nodeRepl.write`, `tab.dev.logs`, `tab.click`, `tab.getAXState` | `let pt = await browser.tabs.get("1"); nodeRepl.write(await pt.dev.logs({levels:["log"],limit:5})); await tab.click(349); await tab.getAXState();` |
| 7 | `js` | 测试下拉选择选项 | browser | `tab.click`, `tab.getAXState` | `await tab.click(344); await tab.getAXState();` |
| 8 | `js` | 确认选择性别后的输入联动 | browser | `tab.click`, `nodeRepl.write`, `tab.getAXState` | `await tab.click(4531); nodeRepl.write((await tab.getAXState({emit:false})).split('\\n').filter(x=>/Note\|hello\|Hello\|female\|Gender\|340/.test(x)).join('\\n'));` |
| 9 | `js` | 测试提交及 Reset 清空 | browser | `tab.click`, `nodeRepl.write`, `tab.getAXState` | `await tab.click(350); await tab.click(351); nodeRepl.write((await tab.getAXState({emit:false})).split('\\n').filter(x=>/Note\|option\|Gender\|340/.test(x)).join('\\n'));` |
| 10 | `js` | 测试填写后启用 Submit | browser | `tab.playwright.locator`, `tab.playwright.locator.fill`, `nodeRepl.write`, `tab.getAXState` | `await pt.playwright.locator('[id="validateOnly_name"]').fill('测试 Alice'); await pt.playwright.locator('[id="validateOnly_age"]').fill('28'); nodeRepl.write((await tab.getAXState({emit:false})).split('\\n').filter(x=>/validateOnly\|button.*Submit/.test(x)).join('\\n'));` |
| 11 | `js` | 点击已启用的提交按钮 | browser | `tab.click`, `nodeRepl.write`, `tab.getAXState` | `await tab.click(896); nodeRepl.write((await tab.getAXState({emit:false})).split('\\n').filter(x=>/validateOnly\|Reset\|Submit/.test(x)).join('\\n'));` |
| 12 | `js` | 验证清空后禁用和实时值更新 | browser | `tab.playwright.locator`, `tab.playwright.locator.fill`, `nodeRepl.write`, `tab.getAXState` | `await pt.playwright.locator('[id="validateOnly_name"]').fill(''); nodeRepl.write((await tab.getAXState({emit:false})).split('\\n').filter(x=>/validateOnly\|Submit/.test(x)).join('\\n')); await pt.playwright.locator('[id="name"]').fill('中文测试 ABC 123'); nodeRepl.write((await tab.getAXState({emit:false})).split('\\n').filter(x=>/Name Value\|Custom Value\|中文/.test(x)).join('\\n'));` |
| 13 | `js` | 核实清空后的按钮状态 | browser | `nodeRepl.write`, `tab.playwright.locator`, `tab.playwright.locator.evaluate`, `tab.getAXState` | `nodeRepl.write(await pt.playwright.locator('[id="validateOnly_name"]').evaluate(el=>({value:el.value,buttons:Array.from(el.closest('form').querySelectorAll('button')).map(b=>({text:b.textContent,disabled:b.disabled}))}))); nodeRepl.write((await tab.getAXState({emit:false})).split('\\n').filter(x=>/Add field\|dynamic_form_item\|button.*Reset/.test(x)).join('\\n'));` |
| 14 | `js` | 用键盘删除内容测试必填条件 | browser | `tab.playwright.locator`, `tab.playwright.locator.press`, `nodeRepl.write`, `tab.getAXState` | `await pt.playwright.locator('[id="validateOnly_name"]').press('ControlOrMeta+a'); await pt.playwright.locator('[id="validateOnly_name"]').press('Backspace'); nodeRepl.write((await tab.getAXState({emit:false})).split('\\n').filter(x=>/validateOnly\|Submit/.test(x)).join('\\n'));` |

**Task 1 API set:** `cua.getBrowser`, `cua.listTabs`, `cua.getTab`, `browser.tabs.get`, `tab.click`, `tab.typeText`, `tab.getAXState`, `tab.dev.logs`, `tab.playwright.locator` (`.fill` / `.evaluate` / `.press`), `nodeRepl.write`.

**Not used here:** `cua.createBrowserTab`, `tab.goto`, `sky.*`, `exec`.

Flow: bind IAB → empty-submit AX check → type username/password + Remember me + submit → `dev.logs` + Fill form → Gender dropdown + filtered AX → Reset → Playwright fill validateOnly → Submit → Playwright fill / evaluate / keyboard-clear to test enable/disable.

### Task 2 · Linear issue · surface=`native` · 23 `js` calls

Capture order in 0223 also contains protocol #2 (`request_user_input_async`) and #15 (`js_reset`); those are omitted here and listed in Appendix A. Numbering below is logical `js` order (1–23).

| # | tool | title | surface | APIs | code |
|---|---|---|---|---|---|
| 1 | `js` | 打开电脑上的 Linear | native | `cua.getApp` | `let linearApp = await cua.getApp("Linear");` |
| 2 | `js` | 查看 Linear 当前界面 | native | `app.getScreenshot` | `await linearApp.getScreenshot();` |
| 3 | `js` | 显示 Linear 窗口 | native | `app.performSecondaryAction`, `app.getAXState` | `await linearApp.performSecondaryAction(0,"Raise"); await linearApp.getAXState();` |
| 4 | `js` | 展开 Linear 以创建测试 issue | native | `app.performSecondaryAction`, `app.getAXStateAndScreenshot` | `await linearApp.performSecondaryAction(4,"zoom the window"); await linearApp.getAXStateAndScreenshot();` |
| 5 | `js` | 新建 Linear issue | native | `app.pressKey`, `app.getAXStateAndScreenshot` | `await linearApp.pressKey('c'); await linearApp.getAXStateAndScreenshot();` |
| 6 | `js` | 打开 issue 创建窗口 | native | `app.click`, `app.getAXStateAndScreenshot` | `await linearApp.click([119,35]); await linearApp.getAXStateAndScreenshot();` |
| 7 | `js` | 检查 Linear 窗口连接 | native | `cua.listApps` | `await cua.listApps();` |
| 8 | `js` | 重新连接 Linear 应用 | native | `cua.getApp` | `linearApp = await cua.getApp('com.linear');` |
| 9 | `js` | 点击新建 issue | native | `app.click`, `app.getAXStateAndScreenshot` | `await linearApp.click([119,35]); await linearApp.getAXStateAndScreenshot();` |
| 10 | `js` | 尝试通过菜单创建 issue | native | `app.click`, `app.getAXState` | `await linearApp.click(8); await linearApp.getAXState();` |
| 11 | `js` | 从菜单新建 issue | native | `app.click`, `app.getAXStateAndScreenshot` | `await linearApp.click(5); await linearApp.getAXStateAndScreenshot();` |
| 12 | `js` | 激活 Linear 应用 | native | `cua.getApp` | `linearApp = await cua.getApp('com.linear');` |
| 13 | `js` | 通过系统搜索打开 Linear | native | `app.pressKey`, `app.typeText`, `app.getAXStateAndScreenshot` | `await linearApp.pressKey('super+space'); await linearApp.typeText('Linear'); await linearApp.pressKey('Return'); await linearApp.getAXStateAndScreenshot();` |
| 14 | `js` | 重新初始化 Linear 控制连接 | native | `cua.getApp` | `let linear = await cua.getApp('com.linear');` |
| 15 | `js` | 打开 Linear 文件菜单 | native | `app.click`, `app.getAXState` | `await linear.click(8); await linear.getAXState();` |
| 16 | `js` | 新开 Linear 窗口恢复操作 | native | `app.click`, `app.getAXStateAndScreenshot` | `await linear.click(9); await linear.getAXStateAndScreenshot();` |
| 17 | `js` | 查看窗口恢复选项 | native | `app.click`, `app.getAXState` | `await linear.click(13); await linear.getAXState();` |
| 18 | `js` | 将 Linear 所有窗口置前 | native | `app.click`, `app.getAXStateAndScreenshot` | `await linear.click(5); await linear.getAXStateAndScreenshot();` |
| 19 | `js` | 创建补充测试 issue | native | `app.click`, `app.getAXState` | `await linear.click(20); await linear.getAXState();` |
| 20 | `js` | 填写测试范围并核对负责人 | native | `app.click`, `app.typeText`, `app.paste`, `app.getAXState` | `await linear.click(127); await linear.typeText('补充 Ant Design Form 组件交互测试'); await linear.click(128); await linear.paste('测试页面：https://ant.design/components/form\\n\\n已完成第一轮交互测试：\\n- 基础表单：空提交显示必填提示；输入中英文和测试密码后触发成功回调。\\n- Remember me 复选框可切换。\\n- Fill form 自动填充、Gender 选择联动 Note、Reset 清空正常。\\n- Validate Only：填写 Name、Age 后 Submit 启用；键盘删除 Name 后禁用。\\n- Watch Hooks：中英文和数字输入后，显示值同步更新。\\n\\n待补测范围：\\n- 动态表单项的新增、删除及嵌套输入。\\n- 日期、时间、数字、下拉等控件的输入与校验。\\n- 禁用状态、弹窗表单、字段依赖及错误定位。\\n\\n验收标准：记录各场景的操作步骤、预期与实际结果；如发现异常，附复现步骤。当前第一轮未发现组件功能异常，不代表整页已全部覆盖。',{format:'text'}); await linear.click(131); await linear.getAXState();` |
| 21 | `js` | 确认指派给 dongdong | native | `app.click`, `app.getAXState` | `await linear.click(257); await linear.getAXState();` |
| 22 | `js` | 修正并验证 issue 文本 | native | `app.setValue`, `app.getAXState` | `await linear.setValue(128,'补充 Ant Design Form 组件交互测试'); await linear.setValue(130,'测试页面：https://ant.design/components/form\\n\\n已测：基础表单空提交校验、中英文输入后成功回调、Remember me 切换、自动填充、下拉联动、Reset、提交按钮启用条件、Watch Hooks 实时更新。第一轮未发现功能异常。\\n\\n待补测：动态表单项增删及嵌套输入；日期、时间、数字及下拉控件；禁用状态；弹窗表单；字段依赖与错误定位。\\n\\n验收：记录操作步骤、预期与实际结果，异常附复现步骤。'); await linear.getAXState();` |
| 23 | `js` | 提交创建已指派的 issue | native | `app.click`, `app.getAXState` | `await linear.click(143); await linear.getAXState();` |

**Task 2 API set:** `cua.getApp`, `cua.listApps`, `app.getScreenshot`, `app.getAXState`, `app.getAXStateAndScreenshot`, `app.performSecondaryAction`, `app.pressKey`, `app.click` (element index **and** `[x,y]`), `app.typeText`, `app.paste({format:'text'})`, `app.setValue`.

**Not used here:** `sky.*`, `tab.*`, `exec`.

Flow: bind Linear → ask user for issue title → screenshot / Raise / zoom → `pressKey('c')` and coordinate click fail (`noWindowsAvailable`) → `listApps` + rebind `com.linear` → File menu New Issue (AX works, composer does not appear) → user: “请你帮我打开，全权由你控制” → Spotlight via `super+space` (no AX change) → **`js_reset`** → rebind as `linear` → Window menu → “New chat” window → fill title/body, assign, `setValue` rewrite, submit. Assistant close: [YOU-25626](https://linear.app/youmind/issue/f811adfe-18c8-4a8a-80f0-b9702666b187) assigned to DongDong.

## API rollup (primary `js` only)

| Canonical API | Task1 calls using it | Task2 calls using it | Surface |
|---|---:|---:|---|
| `cua.getBrowser` | 1 | 0 | browser |
| `cua.listTabs` | 1 | 0 | browser |
| `cua.getTab` | 1 | 0 | browser |
| `tab.click` | 7 | 0 | browser |
| `tab.getAXState` | 11 | 0 | browser |
| `tab.typeText` | 1 | 0 | browser |
| `browser.tabs.get` | 1 | 0 | browser |
| `nodeRepl.write` | 8 | 0 | browser (this capture) |
| `tab.dev.logs` | 1 | 0 | browser |
| `tab.playwright.locator` | 4 | 0 | browser |
| `tab.playwright.locator.fill` | 2 | 0 | browser |
| `tab.playwright.locator.evaluate` | 1 | 0 | browser |
| `tab.playwright.locator.press` | 1 | 0 | browser |
| `cua.getApp` | 0 | 4 | native |
| `app.getScreenshot` | 0 | 1 | native |
| `app.performSecondaryAction` | 0 | 2 | native |
| `app.getAXState` | 0 | 9 | native |
| `app.getAXStateAndScreenshot` | 0 | 8 | native |
| `app.pressKey` | 0 | 2 | native |
| `app.click` | 0 | 12 | native |
| `cua.listApps` | 0 | 1 | native |
| `app.typeText` | 0 | 2 | native |
| `app.paste` | 0 | 1 | native |
| `app.setValue` | 0 | 1 | native |

`nodeRepl.write` only appears in task 1. Native observations use Target’s own emit (`getAXState` / `getScreenshot` / `getAXStateAndScreenshot`) instead of filtering through `nodeRepl`.

### Observed vs canonical bindings

REPL state survives across `js` calls until `js_reset`:

| Binding | Source | Canonical |
|---|---|---|
| `browser` | `cua.getBrowser({url})` | Browser |
| `tab` | `cua.getTab("1", {browser})` | Tab & Target |
| `pt` | `browser.tabs.get("1")` | BrowserTab (`playwright`, `dev.logs`) |
| `linearApp` | `cua.getApp("Linear")` then `'com.linear'` | App & Target |
| `linear` | `cua.getApp('com.linear')` after `js_reset` | App & Target |

`tab` and `pt` refer to the same IAB tab. The model never called `tab.playwright`; it used `pt.playwright` from `browser.tabs.get`.

## Unused CUA APIs (documented, not in these traces)

From `vendor/cua/docs/tinysky-alt-core-cua-repl.md` / `tinysky_alt.types.d.ts`, **not** present in any `code`:

- `cua.getState`, `cua.initialize`, `cua.createBrowserTab`, `cua.listBrowsers`
- Tab navigation: `tab.goto` / `back` / `forward` / `reload` / `close` / `markDeliverable` / `markHandoff`
- Target extras: `scroll`, `drag`, `selectText`
- `nodeRepl.emitImage`
- entire `sky.*` computer-use plugin surface (`sky.click({app, element_index})`, `sky.get_app_state`, …)
- `js` optional `timeout_ms`

## Cross-check vs `traces/*.json`

Compared every `item_id` in:

- `traces/all-js-calls.json` (39)
- `traces/task-1-ant-design-form.json` (14)
- `traces/task-2-linear-issue.json` (25)

| Check | Result |
|---|---|
| item_id set | **equal** (39/39) |
| task-1 / task-2 files vs `all-js-calls.json` subsets | **identical splits** (`all == t1 + t2`) |
| 37× `js` `args.code` | **equal** |
| 37× `js` `args.title` | **equal** |
| 37× `js` `call_id` | **equal** |
| 37× `js` timestamps (`output_item.done`) | **equal** |
| 2 protocol items | **disagree on name, call_id, event** |

Disagreements (traces `js?` rows — **kept** in Appendix A):

| item_id | traces | full websocket `output_item.done` |
|---|---|---|
| `fc_05a61cc4349bad21016aa280a05f0487d081bb1e09838a7da0` | name=`js?`, call_id=`null`, event=`response.function_call_arguments.done`, args.questions present | name=`request_user_input_async`, call_id=`call_8ttSMORM5eSYvZywmZv8VPhP`, same args, same ts `2026-09-10T10:04:17.965Z` |
| `fc_05a61cc4349bad21016aa280f6cf9887d08fe9980781dc6353` | name=`js?`, call_id=`null`, event=`response.function_call_arguments.done`, args=`{}`, ts `2026-09-10T10:05:42.847Z` | name=`js_reset`, call_id=`call_cz8IXBshRbd0EthRf9w7Y2xW`, args=`{}`, ts `2026-09-10T10:05:42.848Z` (+1 ms; traces used args.done, this file uses item.done) |

Cause: `response.function_call_arguments.done` frames have `arguments` + `item_id` only — **no `name` / `call_id`**. Extractors that key off that event have to guess `js?`. `response.output_item.done.item` carries `name` and `call_id`.

## Appendix A — protocol items (no CUA code)

Do not drop these. They are not unique logical CUA calls with code, so they are not in the primary table.

| capture # | tool | call_id | traces label | args | surface |
|---:|---|---|---|---|---|
| 2 | `request_user_input_async` | `call_8ttSMORM5eSYvZywmZv8VPhP` | `js?` | `{"questions": [{"title": "这个 issue 要记录什么？请给我标题或一句话描述；如果是接着刚才的测试，我可以建「补充 Ant Design Form 组件交互测试」，并指派给你。"}]}` | — |
| 15 | `js_reset` | `call_cz8IXBshRbd0EthRf9w7Y2xW` | `js?` | `{}` | — |

1. **`request_user_input_async`** (`call_8ttSMORM5eSYvZywmZv8VPhP`)
   - Args: `{"questions":[{"title":"这个 issue 要记录什么？请给我标题或一句话描述；如果是接着刚才的测试，我可以建「补充 Ant Design Form 组件交互测试」，并指派给你。"}]}`
   - Tool output: `{"accepted":true}`
   - User reply later: `<send_user_message_question_reply>` … `"answer":"可以的"`
   - Surface: none. Namespace `functions`, not `mcp__cua_repl`.

2. **`js_reset`** (`call_cz8IXBshRbd0EthRf9w7Y2xW`)
   - Args: `{}`
   - Tool output: `js kernel reset`
   - Plugin doc: discards JavaScript bindings; does **not** close tabs/apps. Next `js` re-inits and re-dumps first-use docs (observed on the following `cua.getApp`).
   - Surface: REPL, not UI.

0127 has **no** `js_reset` and **no** `request_user_input*`.

## Appendix B — schema-only / unused protocol tools

Present on every `response.create` `additional_tools`, **never** a `function_call`:

`exec`, `wait`, `request_user_input` (sync), `sleep`, `followup_task`, `interrupt_agent`, `list_agents`, `send_message`, `spawn_agent`, `wait_agent`.

`exec` is a **custom** tool (lark grammar, `tools.*` nested calls inside a fresh V8 isolate). It is the Codex orchestrator, not CUA. These two tasks did not wrap `js` in `exec`.

Handshake-only: 0127 create #1 completed with empty `output` (no message, no tools).

## Appendix C — results that constrain the API map

| Observation | Implication |
|---|---|
| `cua.getBrowser({url})` returns docs, not a tab | Matches tinysky: “Select without opening a tab.” URL is a **selector**, not navigation. |
| `listTabs` → `browserId:"1"`, tab `id:"1"` | Live ids are session-numeric, not `"iab"` / `"chrome"` literals from API.md. |
| `getTab` dumps full AX; later `getAXState()` dumps diffs unless a big change (Gender dropdown) resets to a full tree | Default `{disableDiffing: false}`. |
| `getAXState({emit:false})` + `nodeRepl.write(filter)` | Observation APIs auto-`nodeRepl.write` unless `emit:false`. |
| Playwright `.fill` / `.press` / `.evaluate` on `pt.playwright.locator('[id=…]')` | BrowserTab Playwright fallback (`tinysky-alt-other-browser-apis.md`). |
| `pt.dev.logs({levels:["log"],limit:5})` | Console capability on the BrowserTab from `browser.tabs.get`, not on tinysky `Target`. |
| `app.performSecondaryAction(0,"Raise")` and `(4,"zoom the window")` | Action strings copied from AX “Secondary Actions: …” text (docs: do not guess names). |
| `app.click([119,35])` → `-10005 noWindowsAvailable` | Coordinate path needs a window; AX menu-bar indexes still worked. |
| `cua.getApp("Linear")` then `'com.linear'` | Matches docs: if display name is flaky, retry bundle id from `listApps`. |
| After `js_reset`, `getApp` re-emits full Computer Use markdown | First-use documentation is per REPL lifetime, not per OS app. |

## Appendix D — assistant / user text (task boundaries)

**0127 user:** 我在右侧的浏览器打开了 ant design 的 form 页面，请你帮我测试一下这些组件的可用性（输入字符 按一下 submit 这些） 请你开始  
Ambient: IAB open, 1 tab, URL `https://ant.design/components/form`.

**0127 final:** 已完成第一轮实际交互测试…尚未覆盖整页所有组件.

**0223 user:** 操作我电脑上的 linear 应用建一个 issue 指给我  
Then answer `可以的` to the clarifying question. Then `请你帮我打开，全权由你控制` after the model asked to bring Linear to the foreground.

**0223 final:** 已在 Linear 创建 YOU-25626：补充 Ant Design Form 组件交互测试，并指派给你（DongDong）.
