# FINDINGS — independent reparse of Desktop two-turn raw capture

Source (local disk only): `/Users/dongdong/Desktop/codex拦截-两轮-raw.json` (15 MB).

Counts, ids, tool catalogs, and JS bodies below were recomputed from that raw file only. `traces/*.json` and `agents/05-traces` were not used as inputs. Full records: [calls.json](calls.json).

Desktop main session only. One Codex thread (`prompt_cache_key` / `thread_id` / `session_id` `01a08a67-c480-7392-b35d-24c7150359e8`) talking to `gpt-6-astra`. Two websocket captures in `tasks[]`:

| Task | `tasks[].session` | User turns in capture | Surface |
|---|---|---|---|
| `task-1-ant-design-form` | `0127_WS_backend-api_codex_responses` | 我在右侧的浏览器打开了 ant design 的 form 页面… | in-app browser already on `https://ant.design/components/form` |
| `task-2-linear-issue` | `0223_WS_backend-api_codex_responses` | (1) form task history + 操作我电脑上的 linear 应用建一个 issue 指给我 (2) reply to async question (3) 请你帮我打开，全权由你控制 | native Linear (`cua.getApp`) |

`tasks[1].user` in the raw file is the **last** user line (`请你帮我打开，全权由你控制`). `users_all` has all three.

## Verdict

UI control is **not** `functions.exec` and **not** `sky.*`. Every computer/browser action is `mcp__cua_repl.js` (`code` + `title`) running in a persistent tinysky-alt REPL (`cua` / `Target` / `nodeRepl`).

- **39** `response.output_item.done` function calls: **37× `js`**, **1× `request_user_input_async`**, **1× `js_reset`**.
- **`functions.exec` is advertised on every tool-bearing create and echoed on every `response.completed`, and is never invoked.**
- **`sky.*` never appears** in any `code`.
- `timeout_ms` is advertised on `js` and never set. Every `js` body is `{code, title}`. `js_reset` args are `{}`.
- `parallel_tool_calls` is `false` on every create.

`additional_tools` is **not** inlined on every `response.create`. Only the three full-context creates carry the catalog. The other 40 creates are `previous_response_id` continuations (almost always a single `function_call_output`). The same four namespaces still come back on **every** `response.completed.response.tools`.

## Parse completeness

Loaded the whole JSON (`system_prompt`, `system_prompt_extras[3]`, `tasks[2]`). Walked **every** `frames[]` item (`{ts, dir, text}`).

| Capture | Frames | up / down | `response.create` | `function_call` added = done | `arguments.done` | deltas vs done |
|---|---:|---:|---:|---:|---:|---|
| 0127 form | 1265 | 16 / 1249 | 16 | 14 = 14 | 14 | 14/14 exact |
| 0223 linear | 1624 | 27 / 1597 | 27 | 25 = 25 | 25 | 25/25 exact |
| **sum** | **2889** | **43 / 2846** | **43** | **39 = 39** | **39** | **39/39** |

Event types match the raw counters (no leftover `item_id` with deltas but no `arguments.done`). Every `call_id` has a later `function_call_output` (joined from subsequent `response.create` `input[]`).

0127 **create #0** is a handshake: `additional_tools` + developer `system_prompt` only, **no user text, no function call**, `response.completed.output` empty. The Form task starts on create #1. 0223 create #0 already carries Form-task history plus the Linear request (same thread).

## Advertised tools on every `response.create`

Catalog lives at `input[]` item `type=additional_tools`, `id=at_ef9dee31-7b6e-597f-9dc7-ece849132946`. SHA-256 of `tools` is identical on all three payloads that include it (`0b501836e339fd8ac89d317516edd95ab4479d2fde90eb1c5ef561e8e28c30ca`).

### When it is actually sent

| Session | create # | `previous_response_id` | `additional_tools` | `input` |
|---|---:|---|---|---|
| 0127 | 0 | none | **yes** (4 namespaces) | handshake: tools + developer system prompt |
| 0127 | 1 | none | **yes** (same id, same hash) | tools + 4 developer msgs + user (plugins/env + IAB + form request) |
| 0127 | 2–15 | yes | **no** | 1× `function_call_output` |
| 0223 | 0 | none | **yes** (same id, same hash) | full history (43 items) including Form `js` pairs + Linear request |
| 0223 | 1–12, 14–26 | yes | **no** | 1× `function_call_output` (create #4 also appends the async-question reply) |
| 0223 | 13 | yes | **no** | 1× user message (`请你帮我打开，全权由你控制` + IAB context) |

So: **3 / 43 creates advertise tools in the uplink.** The other 40 inherit tools via `previous_response_id`. Downlink `response.created` / `response.completed` still echo `response.tools` with the same four namespaces on all 43 turns.

### Namespaces + function names (create payload order)

| Namespace | Type | Description (short) | Functions |
|---|---|---|---|
| `functions` | namespace | (empty) | `exec` (custom/lark), `wait`, `request_user_input`, `request_user_input_async` |
| `clock` | namespace | Tools for reading and waiting on time. | `sleep` |
| `collaboration` | namespace | Tools for spawning and managing sub-agents. | `followup_task`, `interrupt_agent`, `list_agents`, `send_message`, `spawn_agent`, `wait_agent` |
| `mcp__cua_repl` | namespace | UI automation through a persistent JavaScript session using the initialized CUA API. | `js`, `js_reset` |

`response.completed.tools` echoes the same names but **reorders** `functions.*` to `wait`, `request_user_input`, `request_user_input_async`, `exec`.

### CUA tool schemas (as advertised)

`mcp__cua_repl.js`:

```json
{
  "type": "object",
  "properties": {
    "code": {"type": "string", "description": "JavaScript to execute using the initialized CUA runtime."},
    "timeout_ms": {"type": "integer", "description": "Optional execution timeout in milliseconds. Defaults to 30000 (30 seconds) when omitted."},
    "title": {"type": "string", "description": "Short user-facing description of what the code does."}
  },
  "required": ["code"],
  "additionalProperties": false
}
```

`mcp__cua_repl.js_reset`: `{"type":"object","properties":{},"additionalProperties":false}`.

Both descriptions end with `This tool is part of plugin unified-computer-use`.

`functions.request_user_input` description says it is **only available in Plan mode**. This capture is Default mode (`<collaboration_mode>`). Sync `request_user_input` is advertised and unused. Async is advertised and used once.

Developer extra also says: collaboration tools cannot be called from inside `functions.exec`; `spawn_agent` etc. must be direct calls. Extra `<multi_agent_mode>` then **forbids spawning** unless the user / AGENTS.md / skill explicitly asks. Collaboration tools are advertised anyway and unused.

## `exec` advertised, unused

`functions.exec` type=`custom`, format:

```
type: grammar
syntax: lark
definition:
  start: pragma_source | plain_source
  pragma_source: PRAGMA_LINE NEWLINE SOURCE
  plain_source: SOURCE
  PRAGMA_LINE: /[ \t]*\/\/ @exec:[^\r\n]*/
```

Description (53 297 chars): evaluate JS in a **fresh V8 isolate** as an async module; nested tools on global `tools` (`await tools.exec_command(...)`); no Node, no FS, no network, no console. Optional first-line pragma `// @exec: {"yield_time_ms":..., "max_output_tokens":...}`.

Nested tools listed as `### \`name\`` in that description (45): `apply_patch`, `create_goal`, `exec_command`, `get_goal`, `list_mcp_resource_templates`, `list_mcp_resources`, `read_mcp_resource`, `request_plugin_install`, `update_goal`, `view_image`, `write_stdin`, `clock__curr_time`, `image_gen__imagegen`, 31× `mcp__codex_app__*` (including `capture_screen_context`), `web__run`.

**Zero** `output_item.done` items named `exec`. CUA is **not** nested under `exec`; it is a separate MCP namespace. `functions.wait` exists only to resume a yielded exec cell and is also unused.

## Every `function_call` `output_item.done`

Kept: all 37 `js` **and** the two non-js protocol items.

Item shape: `{id, type:function_call, status:completed, arguments, call_id, name, namespace?, metadata}`.

- `js` / `js_reset`: `namespace="mcp__cua_repl"`.
- `request_user_input_async`: **`namespace` is null** on the item (advertised path is still `functions.request_user_input_async`).

### Task 1 · Ant Design Form · 14× `js` · surface=`browser`

Ambient IAB (not a tab @-mention). Model does **not** call `cua.createBrowserTab`. It follows the js-tool “known URL, browser not named” branch: `cua.getBrowser({ url })`. Runtime ids: `browserId="1"`, tab `id="1"` (not the docs literal `"iab"`). Selected-browser docs: Name `Codex In-app Browser`, Type `iab`, ID `1`.

`listTabs` result:

```json
[{"id":"1","providerTabId":"e118c787-0c80-43ff-b884-63d7e1235315","title":"Form - Ant Design","url":"https://ant.design/components/form","browserId":"1"}]
```

| # | name | title | call_id | item_id | APIs | code |
|---|---|---|---|---|---|---|
| 1 | `js` | 查看 Ant Design 表单页面 | `call_L5p0JtR28cUwYwLPKIq1YonC` | `fc_05a61cc4349bad21016aa26890d22c87d0ab3d38bdb9180aa6` | `cua.getBrowser` | `let browser = await cua.getBrowser({ url: "https://ant.design/components/form" });` |
| 2 | `js` | 找到当前表单标签页 | `call_ZadPs7v59UMruvLQA0CdL4sE` | `fc_05a61cc4349bad21016aa26897c03887d0b56f59c2200da5cb` | `cua.listTabs` | `await cua.listTabs({browser:browser.browserId});` |
| 3 | `js` | 读取表单控件 | `call_ubx0Uvj0gW7qFmrNzSMmo1Uv` | `fc_05a61cc4349bad21016aa2689cf7d487d096868e5885cf68d9` | `cua.getTab` | `let tab = await cua.getTab("1", {browser:browser.browserId});` |
| 4 | `js` | 测试空表单提交校验 | `call_F4uUYfYoeP8bXeqe7xj85KEG` | `fc_05a61cc4349bad21016aa268a3e55487d097df55ed6a06100b` | `tab.click`, `tab.getAXState` | `await tab.click(325); await tab.getAXState();` |
| 5 | `js` | 输入测试字符并提交基础表单 | `call_kXnXtlEF9NJEgbv99e5MyCKK` | `fc_05a61cc4349bad21016aa268aa980087d0ad52b2f88720cd6e` | `tab.click`, `tab.typeText`, `tab.getAXState` | `await tab.click(4523); await tab.typeText("测试用户_Test123"); await tab.click(4528); await tab.typeText("DemoOnly!123"); await tab.click(323); await tab.click(325); await tab.getAXState();` |
| 6 | `js` | 确认提交回调并测试自动填充 | `call_dEw4JndQkLuX8yqvU36cDC8v` | `fc_05a61cc4349bad21016aa268b25f8887d0854b7abab9b8f4f0` | `browser.tabs.get`, `tab.dev.logs`, `nodeRepl.write`, `tab.click`, `tab.getAXState` | `let pt = await browser.tabs.get("1"); nodeRepl.write(await pt.dev.logs({levels:["log"],limit:5})); await tab.click(349); await tab.getAXState();` |
| 7 | `js` | 测试下拉选择选项 | `call_UPYTMdKeN0YhnKPtPqFNxIPt` | `fc_05a61cc4349bad21016aa268b9031887d08eea3d971f8207e0` | `tab.click`, `tab.getAXState` | `await tab.click(344); await tab.getAXState();` |
| 8 | `js` | 确认选择性别后的输入联动 | `call_XPsviJ0LZNLTllylvqVzcG4Z` | `fc_05a61cc4349bad21016aa268c496bc87d0962d294112409c15` | `tab.click`, `nodeRepl.write`, `tab.getAXState` | `await tab.click(4531); nodeRepl.write((await tab.getAXState({emit:false})).split('\n').filter(...).join('\n'));` |
| 9 | `js` | 测试提交及 Reset 清空 | `call_vUY0Vx1Re12kkEztNnBv3AFJ` | `fc_05a61cc4349bad21016aa268cbb8b487d09b5715a5a6af62ad` | `tab.click`, `nodeRepl.write`, `tab.getAXState` | `await tab.click(350); await tab.click(351); nodeRepl.write((await tab.getAXState({emit:false})).split('\n').filter(...).join('\n'));` |
| 10 | `js` | 测试填写后启用 Submit | `call_VfRcedGPXnBSz9YHs5dNJwUG` | `fc_05a61cc4349bad21016aa268d3aca487d08c6ff8a0eb87d3dd` | `playwright.locator.fill`, `nodeRepl.write`, `tab.getAXState` | `await pt.playwright.locator('[id="validateOnly_name"]').fill('测试 Alice'); await pt.playwright.locator('[id="validateOnly_age"]').fill('28'); nodeRepl.write((await tab.getAXState({emit:false})).split('\n').filter(...).join('\n'));` |
| 11 | `js` | 点击已启用的提交按钮 | `call_9y2Jy5aafnIMSuG9aR2193J4` | `fc_05a61cc4349bad21016aa268da2e6087d081002e350f51c219` | `tab.click`, `nodeRepl.write`, `tab.getAXState` | `await tab.click(896); nodeRepl.write((await tab.getAXState({emit:false})).split('\n').filter(...).join('\n'));` |
| 12 | `js` | 验证清空后禁用和实时值更新 | `call_aMAHRSl7rlFLxj0z0yihBxbG` | `fc_05a61cc4349bad21016aa268e171b487d0ada191cf45b69ea2` | `playwright.locator.fill`, `nodeRepl.write`, `tab.getAXState` | `await pt.playwright.locator('[id="validateOnly_name"]').fill(''); … await pt.playwright.locator('[id="name"]').fill('中文测试 ABC 123'); …` |
| 13 | `js` | 核实清空后的按钮状态 | `call_pAbvIYk9ixeXc49nqJjFNtVD` | `fc_05a61cc4349bad21016aa268ec3bec87d0a5300d8a28204403` | `playwright.locator.evaluate`, `nodeRepl.write`, `tab.getAXState` | `nodeRepl.write(await pt.playwright.locator('[id="validateOnly_name"]').evaluate(el=>({value,buttons}))); nodeRepl.write((await tab.getAXState({emit:false})).split('\n').filter(...).join('\n'));` |
| 14 | `js` | 用键盘删除内容测试必填条件 | `call_S9eGWGThQGrAu2YaPmyinWmX` | `fc_05a61cc4349bad21016aa268f4766487d09f920f73079e6dfc` | `playwright.locator.press`, `nodeRepl.write`, `tab.getAXState` | `await pt.playwright.locator('[id="validateOnly_name"]').press('ControlOrMeta+a'); await pt.playwright.locator('[id="validateOnly_name"]').press('Backspace'); nodeRepl.write((await tab.getAXState({emit:false})).split('\n').filter(...).join('\n'));` |

Call 1 result is first-use docs (~50 690 chars): `## Computer Use` Target/App/Tab/`cua.*` API + `# Other Browser APIs` / Playwright `# API Reference`. Call 3 dumps the full AX tree (~119 k). Later AX calls often return diffs.

### Task 2 · Linear issue · 23× `js` + protocol · surface=`native`

Capture order (not “js-only numbering”): protocol items are **#2** and **#15**.

| # | name | title | call_id | item_id | APIs | code / args |
|---|---|---|---|---|---|---|
| 1 | `js` | 打开电脑上的 Linear | `call_7eBgRNiEijToCfzJrdbXJ9D1` | `fc_05a61cc4349bad21016aa2809ae54487d09c55530ca5dfc4e7` | `cua.getApp` | `let linearApp = await cua.getApp("Linear");` |
| 2 | `request_user_input_async` | — | `call_8ttSMORM5eSYvZywmZv8VPhP` | `fc_05a61cc4349bad21016aa280a05f0487d081bb1e09838a7da0` | (protocol) | `{"questions":[{"title":"这个 issue 要记录什么？…「补充 Ant Design Form 组件交互测试」，并指派给你。"}]}` |
| 3 | `js` | 查看 Linear 当前界面 | `call_mt4bGWYajFh94z9LU7AimQbC` | `fc_05a61cc4349bad21016aa280a4096487d0b582bc385781d06e` | `app.getScreenshot` | `await linearApp.getScreenshot();` |
| 4 | `js` | 显示 Linear 窗口 | `call_SrK5LaMSBriPmXtBBFYoQk6m` | `fc_05a61cc4349bad21016aa280a7983887d0bf0c2cc2fa55723b` | `app.performSecondaryAction`, `app.getAXState` | `await linearApp.performSecondaryAction(0,"Raise"); await linearApp.getAXState();` |
| 5 | `js` | 展开 Linear 以创建测试 issue | `call_Q06vVWljqx4MxysBQMvceR8M` | `fc_05a61cc4349bad21016aa280ac58b087d0a1f750d7be17f662` | `app.performSecondaryAction`, `app.getAXStateAndScreenshot` | `await linearApp.performSecondaryAction(4,"zoom the window"); await linearApp.getAXStateAndScreenshot();` |
| 6 | `js` | 新建 Linear issue | `call_gY3Vatk5iFOXqVFyHuXUHWlh` | `fc_05a61cc4349bad21016aa280b1390c87d0a84a379cd24fb9db` | `app.pressKey`, `app.getAXStateAndScreenshot` | `await linearApp.pressKey('c'); await linearApp.getAXStateAndScreenshot();` |
| 7 | `js` | 打开 issue 创建窗口 | `call_jNO6ISaArW8EX2vLUddBELFC` | `fc_05a61cc4349bad21016aa280b82d8887d0ab4f2046e13b6a21` | `app.click` (coords), `app.getAXStateAndScreenshot` | `await linearApp.click([119,35]); await linearApp.getAXStateAndScreenshot();` |
| 8 | `js` | 检查 Linear 窗口连接 | `call_M6fCCal3FCFs5n2PRLBpNqy5` | `fc_05a61cc4349bad21016aa280bb5e2087d09196a6552454068c` | `cua.listApps` | `await cua.listApps();` |
| 9 | `js` | 重新连接 Linear 应用 | `call_SbcPbm4TDMO7ZJOS6TuwQsIx` | `fc_05a61cc4349bad21016aa280bf097887d0835f4aa5e584c072` | `cua.getApp` | `linearApp = await cua.getApp('com.linear');` |
| 10 | `js` | 点击新建 issue | `call_DloWqijxmEuYTXFSyAtBK8q0` | `fc_05a61cc4349bad21016aa280c517d087d0ac6d323415a73f13` | `app.click` (coords), `app.getAXStateAndScreenshot` | `await linearApp.click([119,35]); await linearApp.getAXStateAndScreenshot();` |
| 11 | `js` | 尝试通过菜单创建 issue | `call_Kd9nkInvYJm2Wp60om43K6bM` | `fc_05a61cc4349bad21016aa280ca1a0c87d0ae59fbe174ab8674` | `app.click` (index 8 File), `app.getAXState` | `await linearApp.click(8); await linearApp.getAXState();` |
| 12 | `js` | 从菜单新建 issue | `call_d6XADtQa7FGZWXlSdMnSmWde` | `fc_05a61cc4349bad21016aa280cd7c1c87d095ebba607e111ead` | `app.click` (index 5), `app.getAXStateAndScreenshot` | `await linearApp.click(5); await linearApp.getAXStateAndScreenshot();` |
| 13 | `js` | 激活 Linear 应用 | `call_cp5Wcq4ysY9lqLBlf3Gcq6wK` | `fc_05a61cc4349bad21016aa280ec521487d0a9e3e5c502184f89` | `cua.getApp` | `linearApp = await cua.getApp('com.linear');` |
| 14 | `js` | 通过系统搜索打开 Linear | `call_41BKTBgXLBC0csekKrQOOZzW` | `fc_05a61cc4349bad21016aa280f16f4887d0a909dc2fdf752f98` | `app.pressKey`, `app.typeText`, `app.getAXStateAndScreenshot` | `await linearApp.pressKey('super+space'); await linearApp.typeText('Linear'); await linearApp.pressKey('Return'); await linearApp.getAXStateAndScreenshot();` |
| 15 | `js_reset` | — | `call_cz8IXBshRbd0EthRf9w7Y2xW` | `fc_05a61cc4349bad21016aa280f6cf9887d08fe9980781dc6353` | (protocol) | `{}` |
| 16 | `js` | 重新初始化 Linear 控制连接 | `call_Q1P3YByOoYEqROmEqTr5gfot` | `fc_05a61cc4349bad21016aa280f9902887d0b62e7d58493d8d36` | `cua.getApp` | `let linear = await cua.getApp('com.linear');` |
| 17 | `js` | 打开 Linear 文件菜单 | `call_nO3ToU1svBVvnVR92nYg3znt` | `fc_05a61cc4349bad21016aa280fe0d4c87d0b294e311f22bd13d` | `app.click`, `app.getAXState` | `await linear.click(8); await linear.getAXState();` |
| 18 | `js` | 新开 Linear 窗口恢复操作 | `call_cAbK6EdSIPBwjxE4Y0jQMAbD` | `fc_05a61cc4349bad21016aa28102a8c887d0b3e055fa0e495a19` | `app.click`, `app.getAXStateAndScreenshot` | `await linear.click(9); await linear.getAXStateAndScreenshot();` |
| 19 | `js` | 查看窗口恢复选项 | `call_vgbQWSmNMVuv8QNuM18iPcR1` | `fc_05a61cc4349bad21016aa2810759bc87d09e025b74799cb490` | `app.click`, `app.getAXState` | `await linear.click(13); await linear.getAXState();` |
| 20 | `js` | 将 Linear 所有窗口置前 | `call_fhvjE5QfiRqMHCc7TlYN9FaR` | `fc_05a61cc4349bad21016aa2810bffa487d08a6d2e7f0c6c169d` | `app.click`, `app.getAXStateAndScreenshot` | `await linear.click(5); await linear.getAXStateAndScreenshot();` |
| 21 | `js` | 创建补充测试 issue | `call_aRM4Jbb8FQZiZA9eGukzAB3f` | `fc_05a61cc4349bad21016aa281117f7087d08ec9b12e02d4e676` | `app.click`, `app.getAXState` | `await linear.click(20); await linear.getAXState();` |
| 22 | `js` | 填写测试范围并核对负责人 | `call_yorCS7HChcmH1XcOnOJjxS3U` | `fc_05a61cc4349bad21016aa2811603e887d0ab15f402aab13300` | `app.click`, `app.typeText`, `app.paste`, `app.getAXState` | `await linear.click(127); await linear.typeText('补充 Ant Design Form 组件交互测试'); await linear.click(128); await linear.paste('…',{format:'text'}); await linear.click(131); await linear.getAXState();` |
| 23 | `js` | 确认指派给 dongdong | `call_HyEN1RdCCBRdydrhBX6McuJu` | `fc_05a61cc4349bad21016aa2812519e887d09ecac032dbcbb828` | `app.click`, `app.getAXState` | `await linear.click(257); await linear.getAXState();` |
| 24 | `js` | 修正并验证 issue 文本 | `call_L5WAgfsqif9hAaczRsv4V7gv` | `fc_05a61cc4349bad21016aa2812b26c887d0bcf4be580012b3ba` | `app.setValue`, `app.getAXState` | `await linear.setValue(128,'补充 Ant Design Form 组件交互测试'); await linear.setValue(130,'…'); await linear.getAXState();` |
| 25 | `js` | 提交创建已指派的 issue | `call_6EEHYZP9REsbAOblfm0sQqhi` | `fc_05a61cc4349bad21016aa28134280487d0913c0e9da13c6287` | `app.click`, `app.getAXState` | `await linear.click(143); await linear.getAXState();` |

Protocol results:

- `request_user_input_async` output is a **JSON string** `{"accepted":true}` (not a content-part list). The human answer arrives later as a user message `<send_user_message_question_reply>… "answer":"可以的"`.
- `js_reset` output: `Wall time: 0.0129 seconds` + `js kernel reset`. Bindings dropped. Next `cua.getApp('com.linear')` re-emits first-use `## Computer Use` docs (21 246 chars) plus AX (first `getApp("Linear")` in this thread did **not**, because the REPL had already been initialized by Form-task `getBrowser`).

`cua.listApps()` includes `{"displayName":"Linear","id":"com.linear","isRunning":true,"useCount":11}`. After two coordinate clicks fail, the model switches to that bundle id.

Errors (exact tool text):

```
Computer Use server error -10005: noWindowsAvailable
```

on Linear #7 and #10 (`click([119,35])`). Menu-index clicks work. Seven `input_image` parts are screenshots from `getScreenshot` / `getAXStateAndScreenshot`.

Final assistant text (task 2): created Linear issue `YOU-25626` at `https://linear.app/youmind/issue/f811adfe-18c8-4a8a-80f0-b9702666b187`, assigned to DongDong.

## JS `code` → cua / tab / app / playwright / nodeRepl

Persistent REPL bindings observed:

| Handle | Bound by | Kind | Used as |
|---|---|---|---|
| `browser` | `cua.getBrowser({url})` | `Browser` | `.browserId`, `.tabs.get` |
| `tab` | `cua.getTab("1", {browser: browser.browserId})` | `Tab extends Target` | AX `click` / `typeText` / `getAXState` |
| `pt` | `browser.tabs.get("1")` | other-browser `Tab` (Playwright + `dev`) | `pt.dev.logs`, `pt.playwright.locator…` |
| `linearApp` | `cua.getApp("Linear")` then `'com.linear'` | `App extends Target` | native AX / screenshot / keys |
| `linear` | `cua.getApp('com.linear')` after `js_reset` | `App extends Target` | same, new binding name |

`tab` (CUA Target from `getTab`) and `pt` (from `browser.tabs.get`) are **two handles on the same tab id `"1"`**. AX goes through `tab`; Playwright/`dev` go through `pt`. Docs: `getAXState()` is batched in the same `js` call as the action; `{emit:false}` when the model then `nodeRepl.write`s a filtered subset.

### Inventory actually called

**cua.** `getBrowser`, `listTabs`, `getTab`, `getApp`, `listApps`

**tab.** (AX Target) `click` (element index), `typeText`, `getAXState` (`{emit:false}` on 8/9/10/11/12/13/14)

**browser.** `tabs.get`

**playwright.** `locator.fill`, `locator.press`, `locator.evaluate` on `pt`; plus `pt.dev.logs({levels:["log"], limit:5})`

**nodeRepl.** `write` only (`emitImage` unused; screenshots come from Target `getScreenshot` / `getAXStateAndScreenshot` auto-emit)

**app.** `getScreenshot`, `getAXState`, `getAXStateAndScreenshot`, `performSecondaryAction`, `pressKey`, `click` (coords `[119,35]` **and** element index), `typeText`, `paste({format:'text'})`, `setValue`

### Advertised in first-use Target/`cua` docs but **not** used in this capture

`cua.getState`, `cua.createBrowserTab`, `cua.listBrowsers`

Target: `drag`, `scroll`, `selectText`, `goto`, `back`, `forward`, `reload`, `close`, `markDeliverable`, `markHandoff`

`nodeRepl.emitImage`, `sky.*`

Playwright locators used: `[id="validateOnly_name"]`, `[id="validateOnly_age"]`, `[id="name"]`. Methods: `fill`, `press('ControlOrMeta+a'|'Backspace')`, `evaluate`.

## System prompt: earliest Codex computer / browser instructions

Top-level `system_prompt` (21 260 chars) is **also** the first developer message on `response.create` (plus one trailing newline → 21 261). Headings: permission, autonomy, personality, working with the user, commentary/final, rules for getting work done, skills, apps, plugins.

**There is no Computer Use / browser / CUA / tinysky / playwright section in `system_prompt`.** Keyword scan: `computer` 0, `browser` 0, `cua` 0, `desktop` 0. The hits that exist are unrelated:

- `click` (2): clickable markdown **file** links in the final-answer formatter.
- `screenshot` (1): “Do NOT ask the user to upload files or send screenshots” on `functions.request_user_input_async`.
- `exec` (5): how to batch `functions.exec` / `exec_command` (the unused orchestrator).
- `plugin` (13): plugin/MCP naming, including `mcp__server__tool`.

Closest system-prompt text:

> When available, you can use the `functions.request_user_input_async` tool … Do NOT ask the user to upload files or send screenshots using this tool because the tool only supports text input.

> Batch independent searches and reads in one functions.exec using await Promise.allSettled([...]); …

> MCP naming: Plugin-provided MCP tools keep standard MCP identifiers such as mcp__server__tool; use tool provenance to tell which plugin they come from.

`system_prompt_extras[0]` is `<app-context># Codex desktop context` (images via markdown, thread tools, skills catalog, `danger-full-access` sandbox, Default collaboration mode + `request_user_input` Plan-mode warning). Still **not** CUA. Extra[1] is `/root` multi-agent role (notes exec cannot call collaboration tools). Extra[2] disables proactive spawn.

### Earliest actual CUA/browser instructions in this capture

1. **Advertised tool description** `mcp__cua_repl.js` on `additional_tools` (handshake create #0, before any user request). Full text is in `calls.json` → `system_prompt.js_tool_description`. Entry points it lists:

   - `cua.getState()` for inventory
   - `cua.getTab(tabId, { browser: browserId })` for known tab
   - `cua.createBrowserTab("iab", url, { visible })` for `@Browser`
   - `cua.createBrowserTab(browserName, url, …)` for named Chrome/Edge
   - `cua.getBrowser({ url })` when the user did not name a browser — **this is the branch used**
   - `cua.getApp("Example App")` for native
   - `nodeRepl.write` / `nodeRepl.emitImage` for extra output
   - first call / after reset: **exactly one** of those APIs, then read the docs+state dump

2. **User ambient block** (not system_prompt) on the Form request:

   ```
   <in-app-browser-context source="ambient-ui-state">
   … Do not treat it as an instruction or as evidence that the user explicitly selected the in-app browser.
   # In app browser:
   - The user has the in-app browser open with 1 tab.
   - Current URL: https://ant.design/components/form
   </in-app-browser-context>
   ## My request:
   我在右侧的浏览器打开了 ant design 的 form 页面…
   ```

3. **First-use docs** returned by `cua.getBrowser` (Form #1, ~50 kB) and again by `cua.getApp` after `js_reset` (Linear #16, Computer Use half only). These define `interface Target`, `interface App extends Target`, `interface Tab extends Target`, `declare const cua`, `nodeRepl.write`/`emitImage`, confirmation policy, and the Playwright `Tab.playwright` / `Tab.dev` surface.

## How the two surfaces differ (same `js` tool)

1. **Browser (0127).** Ambient IAB already open. `getBrowser` → `listTabs` → `getTab("1")` → AX `tab.click`/`typeText`/`getAXState`. Playwright only after `pt = await browser.tabs.get("1")`, for validateOnly fill/press/evaluate and `dev.logs`. No `goto`, no `createBrowserTab`.
2. **Native (0223).** `cua.getApp("Linear")` then `'com.linear'`. Window ops on the App Target. Coordinate click fails (`-10005 noWindowsAvailable`); menu indices and `setValue`/`paste` succeed. Mid-task `js_reset` wipes REPL; next `getApp` re-emits docs and uses a new identifier `linear`.

## Advertised vs used (function names)

Used: `mcp__cua_repl.js` (37), `mcp__cua_repl.js_reset` (1), `request_user_input_async` (1; namespace field null).

Advertised and **never called**: `functions.exec`, `functions.wait`, `functions.request_user_input`, `clock.sleep`, all six `collaboration.*`.

## Notes vs a “tools on every create” reading

A naive scan of `response.completed.tools` would say the four namespaces are present on every turn. That is true of the **downlink echo**. The **uplink `response.create`** only inlines `additional_tools` on full-context turns (handshake, first user turn, new user turn with history). Continuations send `previous_response_id` + `function_call_output`.
