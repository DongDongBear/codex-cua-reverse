# FINDINGS — agent 08 cross-check

Independent integrator. Did **not** trust `traces/*.json` as ground truth. Re-read agents 01–07 FINDINGS, `CAPABILITIES.md`, `CAPABILITY-CATALOG.json`, and `/Users/dongdong/Desktop/codex拦截-两轮-raw.json` `tasks[].frames`.

Canonical write-up with the five required sections: [`/Users/dongdong/Desktop/codex-cua-reverse/CROSSCHECK.md`](../../CROSSCHECK.md). This file is the agent-local copy plus the independent parse.

**Verdict.** Used CUA path in the two-round capture is reversed and every `js` `code` body maps to a catalog API. The goal is **not** complete: `request_user_input_async` is used and has no catalog id; `traces/*.json` still labels two items `js?`; several catalog `in_traces` bits are false; unused shipped members are list-reversed, not proven.

---

## Independent raw parse

File: `/Users/dongdong/Desktop/codex拦截-两轮-raw.json` (15 473 033 bytes). Keys: `system_prompt`, `system_prompt_extras`, `tasks` (len 2). Each task has `frames: [{ts, dir, text}]`.

| task | session | frames | up / down | `output_item.done` function_call |
|---|---|---:|---|---|
| `task-1-ant-design-form` | `0127_WS_backend-api_codex_responses` | 1265 | 16 / 1249 | 14× `js` |
| `task-2-linear-issue` | `0223_WS_backend-api_codex_responses` | 1624 | 27 / 1597 | 23× `js` + 1× `request_user_input_async` + 1× `js_reset` |

`response.function_call_arguments.done` (39 events): **no `name`, no `call_id`**. Names below are from `response.output_item.done.item`.

`tasks[1].user` (last message) is `请你帮我打开，全权由你控制`. `users_all` also has the Form request and `操作我电脑上的 linear 应用建一个 issue 指给我`. Catalog copied `tasks[].user`; agent 05 titled the capture with the Linear request. Both strings are in the file.

First `response.create` model-visible tools (task 1 `input[0].tools`):

- namespace `functions`: `exec`, `wait`, `request_user_input`, `request_user_input_async`
- namespace `clock`: `sleep`
- namespace `collaboration`: `followup_task`, `interrupt_agent`, `list_agents`, `send_message`, `spawn_agent`, `wait_agent`
- namespace `mcp__cua_repl` description `UI automation through a persistent JavaScript session using the initialized CUA API.`: `js` (`code` required, `timeout_ms`, `title`), `js_reset` (empty object)

`turn_ended` / `js_add_node_module_dir` do not appear in create payloads. `js` description starts with the unified-computer-use concatenation (`await cua.getState();`, `createBrowserTab("iab", …)`, `cua.getApp("Example App")`, `nodeRepl.write` / `emitImage`). Trailing “This tool is part of plugin `unified-computer-use`.”

Every `js` call is `{code, title}` — `timeout_ms` absent (37/37). `exec` invocations: 0. `\bsky.\w+` in `code`: 0.

---

## 1. Agreements (≥2 agents)

See CROSSCHECK.md §1 for quotes. Short list:

| # | Claim | Agents |
|---|---|---|
| A1 | Live API is `@oai/cua/tinyskyAlt` `setupCUA` → `globalThis.cua`, not package-main `cua.js` | 01, 04, 06 |
| A2 | `js` / `js_reset` / `turn_ended` implemented by `node_repl`; plugin is a stdio wrapper | 03, 04, 06 |
| A3 | Wire name unprefixed `js`; namespace `mcp__cua_repl` | 03, 04, 05 |
| A4 | `js_reset` drops JS bindings only; next `js` re-runs banner | 04, 05, 06 |
| A5 | Traces use `cua.getApp` Target, not `sky.*` | 01, 02, 05 |
| A6 | Live Mac `sky` is window `target:"mac"` | 01, 02 |
| A7 | JS path = Unix JSON-RPC `CodexComputerUseIPC-5`; clicker = `SkyComputerUseService`; Client MCP = XPC, unused here | 02, 04, 06, 07 |
| A8 | `Tab = BrowserTab & Target`; `decorateTab` copies `ax.*` | 01, 03 |
| A9 | `getBrowser` does not open a tab | 01, 03, 05 |
| A10 | `"iab"`/`"chrome"`/`"edge"` are aliases; live ids here were `"1"` | 01, 03, 05 |
| A11 | Playwright is a Codex CDP subset | 01, 03 |
| A12 | Dual MCP `node_repl` + `cua_repl`; these traces match cua_repl / tinysky docs | 04, 06 |
| A13 | `enabled_tools` drops `js_add_node_module_dir`; `turn_ended` hook-only in intercept | 03, 04, 06 |
| A14 | `nodeRepl.write` / `emitImage`; `{emit:false}` | 01, 05, 06 |
| A15 | TinySky `getApp`/`listApps` Mac-only | 01, 02, 06 |
| A16 | `traces/*.json` `js?` ≠ raw names | 05 + this parse |

---

## 2. Contradictions

| # | Conflict | Status |
|---|---|---|
| C1 | `traces/*.json` `js?` vs raw `request_user_input_async` / `js_reset` | **RESOLVED** — raw `output_item.done` wins. Keep both items. |
| C2 | Result text `-10005: noWindowsAvailable` vs JS enum `unknownError: -10005` (`errors.d.ts:7`, 07 FINDINGS:156) | **OPEN** — same code, different names |
| C3 | Catalog `in_traces` vs raw callees (PlaywrightLocator.click true, fill false, AXAPI.write true, …) | **RESOLVED** — catalog flags wrong; see §3 |
| C4 | `cua.initialize` in types, omitted from ChatGPT.app docs and catalog `tinysky[]` | **RESOLVED** — unused here; banner already ran `setupCUA` |
| C5 | `js-reset.md` “cua_repl.js” vs wire `js` | **RESOLVED** — docs alias |
| C6 | Target `[x,y]` vs sky `{x,y}`; screenshot pixels vs points | **RESOLVED** at App façade (`Array.isArray`); **OPEN** for pixel/point space |
| C7 | Tab paste `Ctrl+v` on darwin | **OPEN** — 01 only; traces used App `paste` |
| C8 | npm `playwright@1.57.0` vs “not a Playwright process” | **RESOLVED** — package backs the injected subset |
| C9 | `globalThis.agent` | not a contradiction; undocumented extra; unused in raw |
| C10 | catalog `tasks[1].user` vs 05 Linear title | **RESOLVED** — last vs primary user string |
| C11 | which live `js` server | **RESOLVED** for API map (cua_repl description in create); dual unprefixed `js` still OPEN |

---

## 3. Trace coverage vs catalog

`vendor/browser-desktop/api.json` interface members = **146**. Catalog `browser_desktop` = **146**. Diff empty.

### 3.1 Every raw function_call → catalog

**37/37 `js` `code` bodies map** to `tinysky[]` + `repl[]` + `browser_desktop[]` (see CROSSCHECK.md §3.1 table).

**`js_reset` → `repl.js_reset`.**

**`request_user_input_async` → no catalog API id.** Namespace `functions`, args `{"questions":[{"title":"这个 issue 要记录什么？…"}]}`, output `{"accepted":true}`. `traces/*.json` called this `js?`. **Do not drop.**

### 3.2 Catalog `in_traces` vs this parse

Occurrence counts from raw `code` match `CAPABILITY-CATALOG.json` `trace_apis` (e.g. `app.click` 14, `tab.getAXState` 12, `tab.click` 11, `nodeRepl.write` 10). Agent 05 rollup is per-cell **presence** (`tab.click` in 7 cells). Name the aggregation.

False positives (`in_traces: true`, not in `code` as that API):

- `PlaywrightLocator.click` — `tab.click` is Target/AX
- `PlaywrightLocator.locator` — no nested locator
- `AXAPI.write` — model used `nodeRepl.write`
- `AXAPI.performSecondaryAction` / `pressKey` / `setValue` — App/sky Target only
- `Browsers.get` — not in `code` (internal possible)

False negatives:

- `PlaywrightLocator.fill` (4), `.evaluate` (1), `.press` (2)
- `Tab.playwright` (used as `pt.playwright`)
- `Browser.tabs` (used as `browser.tabs.get`; `Tabs.get` is already true)

`sky.*` all `in_traces: false`: correct for `code`. They are wrapped by `cua.getApp`.

### 3.3 Protocol / schema-only

Advertised, never `function_call`: `exec`, `wait`, `request_user_input`, `sleep`, collaboration six, `js.timeout_ms`. Keep as schema-only (05 Appendix B; independently confirmed).

Results that constrain the map (from `function_call_output` in later creates, all 39 call_ids present):

- `getBrowser` output starts with `## Computer Use` (docs dump).
- `listTabs` JSON includes `id:"1"` and a UUID `providerTabId`.
- Coordinate `click([119,35])` twice: `Computer Use server error -10005: noWindowsAvailable` (wall time ~0.01s).
- `js_reset` output: `js kernel reset`.
- Next `getApp` re-dumps `## Computer Use`.
- `request_user_input_async` output: `{"accepted":true}`.
- `getScreenshot` output includes an image part.

---

## 4. Remaining UNREVERSED

### Used, not in catalog API tables

- `request_user_input_async`
- `cua.initialize`, `cua.browsers`, `cua.computer` (reversed by 01/06, unused in traces, omitted from `tinysky[]`)

### Catalog rows with no real FINDINGS (not even a grouped list)

- `BrowserUser.getTabContext` — 03 QUESTIONS only; `documented: false`, unsupported on iab/extension/cdp.

### Catalog rows list-reversed only (named in 03 §5 / §12, not field-proven)

Dialog accept/dismiss per type; `PlaywrightDownload.path`; `PlaywrightFileChooser.isMultiple`; locator `allTextContents` / `innerText` / `textContent` (03: “text getters”); `CUAAPI.downloadMedia` / `DomCUAAPI.downloadMedia`.

CAPABILITIES.md §5 capabilities are **not** in `CAPABILITY-CATALOG.json`. 03 §10 documents them from markdown. Unused in traces.

Tinysky unused (`in_traces: false`) still have 01 type+impl coverage: `getState`, `createBrowserTab`, `listBrowsers`, `scroll`/`drag`/`selectText`, tab navigation / markDeliverable / markHandoff.

Sky audio, window2, linux: 02 reversed as types; not live on this Mac.

### Still OPEN (do not paper over)

- `-10005` name (C2)
- Tab `Ctrl+v` on Mac (01 Q10)
- Screenshot pixel vs point (02 Q9)
- Whether `cua.getTab` object has `playwright`/`dev` (05 Q7) — types say yes; model used `browser.tabs.get` for those
- Dual unprefixed `js` servers (04 Q1)

---

## 5. Verdict — DONE vs NOT DONE

| Goal slice | Status |
|---|---|
| Reverse the **used** computer-use + browser-use path in the two-round raw capture | **DONE** |
| Map every raw `js` body to a catalog API | **DONE** |
| Keep unnamed protocol items | **DONE** (`request_user_input_async`, `js_reset`; traces `js?` rejected) |
| Catalog id for every used tool | **NOT DONE** (`request_user_input_async`) |
| Catalog `in_traces` / CAPABILITIES.md §4 accurate vs raw | **NOT DONE** |
| Update `traces/*.json` off `js?` | **NOT DONE** (still `js?` as of this read) |
| Reverse **all** shipped members to field-level + live proof | **NOT DONE** (unused browser/native listed; mutating APIs shape-only) |
| Close OPEN naming/platform questions | **NOT DONE** |

Agents 01–07 do not contradict each other on the architecture. They disagree with **pre-extracted traces** and with **catalog flags**, not with each other on tinysky / sky window / node_repl / SkyComputerUseService.
