# CUA live regression

Captured 2026-09-11 after the ChatGPT desktop CUA regression prompt was pasted. Source: `/Users/dongdong/Desktop/codex-traffic/2026-09-11/1074_WS_backend-api_codex_responses`. Model `gpt-6-astra` on `wss://chatgpt.com/backend-api/codex/responses`. Every UI action is `mcp__cua_repl.js` with `timeout_ms: 60000`. `exec` / `osascript` were not called.

Machine parse of `websocket.jsonl`: **19** js calls, **13 ok / 3 fail / 3 skip**. Unnamed downlink function_calls: **0**. Structured dump: `verify/results/regression-live.json`. AX truncated; screenshot bytes omitted.

Model final: 19 步已跑完：1、2、4、7、11、14–19 调用 OK；5–6 返回白图；8–9 FAIL（noWindowsAvailable）、12 FAIL（剪贴板读取超时）；3、10、13 因无对应操作或文本框跳过。

| step | api | ok/fail | evidence |
| ---: | --- | --- | --- |
| 1 | `cua.listApps` | **ok** | 20 apps written; Finder isRunning true (also Ghostty/Chrome/ChatGPT/Linear); wall 0.2092s |
| 2 | `cua.getApp + app.getAXState` | **ok** | Finder AX Window: "Desktop"; 0 scroll area (disabled) desktop; images have Secondary Actions: open; wall 0.3054s |
| 3 | `app.performSecondaryAction` | **skip** | NO_RAISE; SKIP: Window 菜单未公开 secondary action，当前没有带 Raise 的窗口; wall 0.0077s |
| 4 | `app.click` | **ok** | click(2) youdesktop; AX still Finder Desktop; focused 1 container desktop; wall 1.0874s |
| 5 | `app.getScreenshot` | **ok** | js returned; input_image x1 (bytes omitted); model commentary: 白图; wall 0.1478s |
| 6 | `app.getAXStateAndScreenshot` | **ok** | AX Finder Desktop + input_image x1 (bytes omitted); model commentary: 白图; wall 0.1318s |
| 7 | `app.pressKey` | **ok** | pressKey("Down"); selected image 2026.7 动动报销; wall 0.5634s |
| 8 | `app.scroll` | **fail** | Error: Computer Use server error -10005: noWindowsAvailable; wall 0.0242s |
| 9 | `app.drag` | **fail** | Error: Computer Use server error -10005: noWindowsAvailable; wall 0.0148s |
| 10 | `app.setValue` | **skip** | SKIP: no settable text field; wall 0.1573s |
| 11 | `app.typeText` | **ok** | typeText("cua") no error; AX still Finder Desktop; selected vscode; wall 0.5146s |
| 12 | `app.paste` | **fail** | Error: Computer Use server error -10005: Timed out waiting for the application to read the clipboard; wall 2.1585s |
| 13 | `app.selectText` | **skip** | SKIP: no editable text node; wall 0.5424s |
| 14 | `cua.getBrowser + cua.listTabs` | **ok** | first-use browser docs then write { browserId: '1', tabs: [] }; wall 0.1827s |
| 15 | `cua.createBrowserTab` | **ok** | tab 1 Example Domain https://example.com/ AXWebArea; wall 3.42s |
| 16 | `tab.getAXState + tab.click + tab.typeText` | **ok** | getAXState/click(3)/typeText no error; still example.com AX; wall 0.476s |
| 17 | `tab.playwright.locator.evaluate` | **ok** | locator("h1").evaluate => "Example Domain"; wall 0.0501s |
| 18 | `tab.goto + tab.back` | **ok** | AX example.org then back to example.com; wall 1.0657s |
| 19 | `cua.listBrowsers + cua.getState` | **ok** | listBrowsers: edge/chrome/iab; getState includes iab tab example.com; wall 0.521s |

## 第二轮：本地测试页 `http://127.0.0.1:8765/`

同一 websocket `1074`，js **20–30**（`timeout_ms: 60000`）。助手收尾：1–8、11 OK；9 导航成功滚动 FAIL（detached accessibility element）；10 无弹窗；最终 URL `http://127.0.0.1:8765/`；未操作 Finder。

http.server 日志：`03:29:35 GET / 200`（与 `createBrowserTab` 对齐）。

| # | API | 结果 |
|---|---|---|
| 20 / 提示1 | `getBrowser` + `listTabs` | OK |
| 21 / 2 | `createBrowserTab(..., "http://127.0.0.1:8765/", {visible:true})` | OK，IAB 打到本地页 |
| 22 / 3 | `labTab.getAXState` 前 40 行 | OK |
| 23 / 4 | `playwright.locator('#name').fill('cua-lab')` | OK |
| 24 / 5 | `locator('#bio').fill('hello bio')` | OK |
| 25 / 6 | `locator('#btn-ok').click()` | OK |
| 26 / 7 | `locator('h1').evaluate` | OK |
| 27 / 8 | `locator('#more').click` + `back()` | OK |
| 28 / 9 | `goto` 同一 url + `scroll(AXWebArea index)` | **goto OK；scroll FAIL** `detached accessibility element`（导航后旧 AX 下标作废） |
| 29 / 10 | `getJsDialog` | SKIP `NO_DIALOG`（没点 Alert/Confirm） |
| 30 / 11 | 最终 AX + `url()` | OK，`http://127.0.0.1:8765/` |

对照还原：Playwright fill/click 在自建页上能跑（example.com 几乎没控件）。`tab.scroll` 用 **goto 之前的 AX index** 会 detached——要先重新 `getAXState` 再 scroll。弹窗 API 没测到是因为没点 `#btn-alert`。

## Protocol items (kept)

- unnamed/historical `historical_function_call_output` call_id `call_47p1TkAY44PM3HfrtAPgR650` chars=22831 — Unmatched uplink function_call_output on first response.create (prior thread js getApp Finder, call_47p1TkAY44PM3HfrtAPgR650). Kept as unnamed protocol item.

```
## Computer Use

Control native apps and browsers on the user’s computer by reading or operating UI. Prefer purpose-built connectors, APIs, or CLIs when available.

- Use `cua_repl` (JavaScript) for all UI actions.
- Do not use other technologies besides `cua_repl` for computer interactions, unless specifically requested by the user (e.g. AppleScript, `osascript`, JXA, System Events, CGEvent synthesis).
- Prefer a dedicated plugin or skill when it can complete the task; use Computer Use for inte…
```

- `reasoning` id `rs_0876293ec50593fb016aa3a985377c87d0813db0c7c085d466` (encrypted content not stored)

- No empty-name `js?`, no `js_reset`, no `request_user_input_async` in this websocket.

## js calls (code / title / error / AX head)

### 1. reg 1 listApps — `cua.listApps` — **ok**

- name `js` ns `mcp__cua_repl` call_id `call_QY7fm6YAOVm9zFi0qOM0uF9M` item_id `fc_0876293ec50593fb016aa3a932b4cc87d0af1629176097b6bd` timeout_ms `60000`

```js
try { const apps = await cua.listApps({emit:false}); nodeRepl.write(apps.slice(0,20).map(({id,displayName,isRunning})=>({id,displayName,isRunning}))); } catch(e) { nodeRepl.write(String(e)); }
```

AX / output head:

```
[
  {
    id: 'com.mitchellh.ghostty',
    displayName: 'Ghostty',
    isRunning: true
  },
  {
    id: 'com.google.Chrome',
    displayName: 'Google Chrome',
    isRunning: true
  },
  { id: 'com.openai.codex', displayName: 'ChatGPT', isRunning: true },
  {
    id: 'com.tencent.xinWeChat',
    displayName: 'WeChat',
    isRunning: true
  },
  { id: 'dev.zed.Zed', displayName: 'Zed', isRunning: true },
  { id: 'dev.warp.Warp-Stable', displayName: 'Warp', isRunning: true },
  {
```

### 2. reg 2 Finder AX — `cua.getApp + app.getAXState` — **ok**

- name `js` ns `mcp__cua_repl` call_id `call_Oi21Ik1RcHgcA7srSnR0tRVU` item_id `fc_0876293ec50593fb016aa3a937e89c87d0a27331f67b9122e0` timeout_ms `60000`

```js
var regAX = ''; try { app = await cua.getApp("Finder"); regAX = await app.getAXState({emit:false,disableDiffing:true}); nodeRepl.write(regAX.split('\n').slice(0,40).join('\n')); } catch(e) { nodeRepl.write(String(e)); }
```

AX / output head:

```
Window: "Desktop", App: Finder.
0 scroll area (disabled) desktop
	1 container desktop
		2 image youdesktop, Secondary Actions: open
		3 image youext, Secondary Actions: open
		4 image Agamemnon, Secondary Actions: open
		5 image Watch, Secondary Actions: open
		6 image 2026.7 动动报销, Secondary Actions: open
		7 image youbase, Secondary Actions: open
		8 image wellpaper, Secondary Actions: open
		9 image youniverse, Secondary Actions: open
		10 image vscode, Secondary Actions: open
```

### 3. reg 3 Raise — `app.performSecondaryAction` — **skip**

- name `js` ns `mcp__cua_repl` call_id `call_5C8jWtxTWayFTgbWxdardrRB` item_id `fc_0876293ec50593fb016aa3a941092887d0b27124bd3a443480` timeout_ms `60000`
- skip: `NO_RAISE`; `SKIP: Window 菜单未公开 secondary action，当前没有带 Raise 的窗口` (two `nodeRepl.write`s concatenated)

```js
try { const line = regAX.split('\n').find(l=> /Secondary Actions:.*\bRaise\b/.test(l)); if(line) { await app.performSecondaryAction(Number(line.trim().match(/^\d+/)[0]),'Raise'); regAX = await app.getAXState({disableDiffing:true}); } else { nodeRepl.write('NO_RAISE'); nodeRepl.write('SKIP: Window 菜单未公开 secondary action，当前没有带 Raise 的窗口'); } } catch(e) { nodeRepl.write(String(e)); }
```

AX / output head:

```
NO_RAISESKIP: Window 菜单未公开 secondary action，当前没有带 Raise 的窗口
```

### 4. reg 4 桌面图标 click — `app.click` — **ok**

- name `js` ns `mcp__cua_repl` call_id `call_MHA2KVrke7dGBIAYCnhNPBHY` item_id `fc_0876293ec50593fb016aa3a948cf3887d09fb3f8c4af6d6d61` timeout_ms `60000`

```js
try { await app.click(2); regAX = await app.getAXState({disableDiffing:true}); } catch(e) { nodeRepl.write(String(e)); }
```

AX / output head:

```
Window: "Desktop", App: Finder.
0 scroll area desktop
	1 container desktop
		2 image youdesktop, Secondary Actions: open
		3 image youext, Secondary Actions: open
		4 image Agamemnon, Secondary Actions: open
		5 image Watch, Secondary Actions: open
		6 image 2026.7 动动报销, Secondary Actions: open
		7 image youbase, Secondary Actions: open
		8 image wellpaper, Secondary Actions: open
		9 image youniverse, Secondary Actions: open
		10 image vscode, Secondary Actions: open
```

### 5. reg 5 screenshot — `app.getScreenshot` — **ok**

- name `js` ns `mcp__cua_repl` call_id `call_0JE2uoYDSNMOOKdPxpQqLH6X` item_id `fc_0876293ec50593fb016aa3a94edd7c87d0bd631180c9e0989b` timeout_ms `60000`
- images: 1 (bytes omitted)

```js
try { await app.getScreenshot(); } catch(e) { nodeRepl.write(String(e)); }
```

AX / output head:

```
(screenshot input_image omitted)
```

### 6. reg 6 AX and screenshot — `app.getAXStateAndScreenshot` — **ok**

- name `js` ns `mcp__cua_repl` call_id `call_Ldp9C7zUm0PURLENk4yDWDY7` item_id `fc_0876293ec50593fb016aa3a954075887d0a3f34e9ec3bc5eac` timeout_ms `60000`
- images: 1 (bytes omitted)

```js
try { const result = await app.getAXStateAndScreenshot({disableDiffing:true}); regAX = result.state; } catch(e) { nodeRepl.write(String(e)); }
```

AX / output head:

```
Window: "Desktop", App: Finder.
0 scroll area desktop
	1 container desktop
		2 image youdesktop, Secondary Actions: open
		3 image youext, Secondary Actions: open
		4 image Agamemnon, Secondary Actions: open
		5 image Watch, Secondary Actions: open
		6 image 2026.7 动动报销, Secondary Actions: open
		7 image youbase, Secondary Actions: open
		8 image wellpaper, Secondary Actions: open
		9 image youniverse, Secondary Actions: open
		10 image vscode, Secondary Actions: open
```

### 7. reg 7 pressKey — `app.pressKey` — **ok**

- name `js` ns `mcp__cua_repl` call_id `call_QPyteXGCIfZg1lRw5jyk0NCJ` item_id `fc_0876293ec50593fb016aa3a95933d087d0a09b68280eea9244` timeout_ms `60000`

```js
try { await app.pressKey('Down'); regAX = await app.getAXState({disableDiffing:true}); } catch(e) { nodeRepl.write(String(e)); }
```

AX / output head:

```
Window: "Desktop", App: Finder.
0 scroll area desktop
	1 container desktop
		2 image youdesktop, Secondary Actions: open
		3 image youext, Secondary Actions: open
		4 image Agamemnon, Secondary Actions: open
		5 image Watch, Secondary Actions: open
		6 image youbase, Secondary Actions: open
		7 image wellpaper, Secondary Actions: open
		8 image youniverse, Secondary Actions: open
		9 image vscode, Secondary Actions: open
		10 image coralline, Secondary Actions: open
```

### 8. reg 8 scroll — `app.scroll` — **fail**

- name `js` ns `mcp__cua_repl` call_id `call_efCZ8zgJlW2NmtlN6uY7WfS2` item_id `fc_0876293ec50593fb016aa3a96072f487d0b8dbe37e96ecce81` timeout_ms `60000`
- error: `Error: Computer Use server error -10005: noWindowsAvailable`

```js
try { await app.scroll(0,'down',1); regAX = await app.getAXState({disableDiffing:true}); } catch(e) { nodeRepl.write(String(e)); }
```

AX / output head:

```
Error: Computer Use server error -10005: noWindowsAvailable
```

### 9. reg 9 drag — `app.drag` — **fail**

- name `js` ns `mcp__cua_repl` call_id `call_ICrwgERc1DNCKdpYt0AnLiuf` item_id `fc_0876293ec50593fb016aa3a966228887d0a5b547ce577d690c` timeout_ms `60000`
- error: `Error: Computer Use server error -10005: noWindowsAvailable`

```js
try { await app.drag([100,200],[120,220]); regAX = await app.getAXState({disableDiffing:true}); } catch(e) { nodeRepl.write(String(e)); }
```

AX / output head:

```
Error: Computer Use server error -10005: noWindowsAvailable
```

### 10. reg 10 setValue — `app.setValue` — **skip**

- name `js` ns `mcp__cua_repl` call_id `call_momYkF35NSkrDfG7SDF9ODbt` item_id `fc_0876293ec50593fb016aa3a96a370487d0976517e063929055` timeout_ms `60000`
- skip: `SKIP: no settable text field`

```js
try { regAX = await app.getAXState({emit:false,disableDiffing:true}); const line = regAX.split('\n').find(l=> /text (field|area)/i.test(l) && /settable/i.test(l)); if(line) { await app.setValue(Number(line.trim().match(/^\d+/)[0]),'cua-regression'); regAX = await app.getAXState({disableDiffing:true}); } else nodeRepl.write('SKIP: no settable text field'); } catch(e) { nodeRepl.write(String(e)); }
```

AX / output head:

```
SKIP: no settable text field
```

### 11. reg 11 typeText — `app.typeText` — **ok**

- name `js` ns `mcp__cua_repl` call_id `call_4yAhpA0fYgjQVGEl1OuT1bBG` item_id `fc_0876293ec50593fb016aa3a970c21887d0877e6e546368d8c8` timeout_ms `60000`

```js
try { await app.typeText('cua'); regAX = await app.getAXState({disableDiffing:true}); } catch(e) { nodeRepl.write(String(e)); }
```

AX / output head:

```
Window: "Desktop", App: Finder.
0 scroll area desktop
	1 container desktop
		2 image youdesktop, Secondary Actions: open
		3 image youext, Secondary Actions: open
		4 image Agamemnon, Secondary Actions: open
		5 image Watch, Secondary Actions: open
		6 image youbase, Secondary Actions: open
		7 image wellpaper, Secondary Actions: open
		8 image youniverse, Secondary Actions: open
		9 image coralline, Secondary Actions: open
		10 image youniverse1-cleanup-pr-11527, Secondary Actions: open
```

### 12. reg 12 paste — `app.paste` — **fail**

- name `js` ns `mcp__cua_repl` call_id `call_BeN9eZ897SSgfPZRrNXhaDv4` item_id `fc_0876293ec50593fb016aa3a97536a487d0bd7f0dfc9d4e27e9` timeout_ms `60000`
- error: `Error: Computer Use server error -10005: Timed out waiting for the application to read the clipboard`

```js
try { await app.paste('hello-cua-regression',{format:'text'}); regAX = await app.getAXState({disableDiffing:true}); } catch(e) { nodeRepl.write(String(e)); }
```

AX / output head:

```
Error: Computer Use server error -10005: Timed out waiting for the application to read the clipboard
```

### 13. reg 13 selectText — `app.selectText` — **skip**

- name `js` ns `mcp__cua_repl` call_id `call_JET1U8gvdQO18kJkIpHO5DTJ` item_id `fc_0876293ec50593fb016aa3a97c531487d0ae7a10b6f88c9436` timeout_ms `60000`
- skip: `SKIP: no editable text node`

```js
try { regAX = await app.getAXState({emit:false,disableDiffing:true}); const line = regAX.split('\n').find(l=> /text field|text area|editable text/i.test(l)); if(line) { await app.selectText(Number(line.trim().match(/^\d+/)[0]),'cua'); regAX = await app.getAXState({disableDiffing:true}); } else nodeRepl.write('SKIP: no editable text node'); } catch(e) { nodeRepl.write(String(e)); nodeRepl.write('SKIP'); }
```

AX / output head:

```
SKIP: no editable text node
```

### 14. reg 14 browser and tabs — `cua.getBrowser + cua.listTabs` — **ok**

- name `js` ns `mcp__cua_repl` call_id `call_r5QdsB6oRotA8cwgyGP3AmwK` item_id `fc_0876293ec50593fb016aa3a9881dd887d089b2d3ce5d0c147d` timeout_ms `60000`

```js
var b; var regTabs; try { b = await cua.getBrowser({}); regTabs = await cua.listTabs({browser:b.browserId}); nodeRepl.write({browserId:b.browserId,tabs:regTabs}); } catch(e) { nodeRepl.write(String(e)); }
```

AX / output head:

```
```

[]
{ browserId: '1', tabs: [] }
```

### 15. reg 15 createBrowserTab — `cua.createBrowserTab` — **ok**

- name `js` ns `mcp__cua_repl` call_id `call_7lBcTo4Z90gOLItW6Gpp1JqO` item_id `fc_0876293ec50593fb016aa3a98ce0f087d096982c55c0236dd3` timeout_ms `60000`

```js
var tab; try { tab = await cua.createBrowserTab(b.browserId || 'iab','https://example.com',{visible:true}); } catch(e) { nodeRepl.write(String(e)); }
```

AX / output head:

```
Browser tab: 1, Title: "Example Domain", URL: "https://example.com/".
0 AXWebArea Example Domain, URL: example.com/
	1 heading Example Domain, Value: 1
		2 text Example Domain
	3 text This domain is for use in documentation examples without needing permission. Avoid use in operations.
	4 link Description: Learn more, Value: iana.org/domains/example
```

### 16. reg 16 tab AX click typeText — `tab.getAXState + tab.click + tab.typeText` — **ok**

- name `js` ns `mcp__cua_repl` call_id `call_DJFVB3fSL1HiDC5c6FQuxmDW` item_id `fc_0876293ec50593fb016aa3a99471d087d0ad431fde4308e84c` timeout_ms `60000`

```js
try { await tab.getAXState(); } catch(e) { nodeRepl.write(String(e)); } try { await tab.click(3); await tab.getAXState(); } catch(e) { nodeRepl.write(String(e)); } try { await tab.typeText('cua'); await tab.getAXState(); } catch(e) { nodeRepl.write(String(e)); }
```

AX / output head:

```
Browser tab: 1, Title: "Example Domain", URL: "https://example.com/".
0 AXWebArea Example Domain, URL: example.com/
	1 heading Example Domain, Value: 1
		2 text Example Domain
	3 text This domain is for use in documentation examples without needing permission. Avoid use in operations.
	4 link Description: Learn more, Value: iana.org/domains/example
Browser tab: 1, Title: "Example Domain", URL: "https://example.com/".
0 AXWebArea Example Domain, URL: example.com/
	1 heading Example Domain, Value: 1
		2 text Example Domain
	3 text This domain is for use in documentation examples without needing permission. Avoid use in operations.
	4 link Description: Learn more, Value: iana.org/domains/example
```

### 17. reg 17 locator evaluate — `tab.playwright.locator.evaluate` — **ok**

- name `js` ns `mcp__cua_repl` call_id `call_JP3OZFHhjrqqCTsWEeCJIIEl` item_id `fc_0876293ec50593fb016aa3a99a564887d0a2aa543ab7c2deb0` timeout_ms `60000`

```js
try { nodeRepl.write(await tab.playwright.locator('h1').evaluate(el => el.textContent)); } catch(e) { nodeRepl.write(String(e)); }
```

AX / output head:

```
Example Domain
```

### 18. reg 18 goto back — `tab.goto + tab.back` — **ok**

- name `js` ns `mcp__cua_repl` call_id `call_gcsNzLdzg71fLJG2OFH230vO` item_id `fc_0876293ec50593fb016aa3a99ec13087d0a850ffefa5037430` timeout_ms `60000`

```js
try { await tab.goto('https://example.org'); await tab.getAXState(); } catch(e) { nodeRepl.write(String(e)); } try { await tab.back(); await tab.getAXState(); } catch(e) { nodeRepl.write(String(e)); }
```

AX / output head:

```
Browser tab: 1, Title: "Example Domain", URL: "https://example.org/".
1 AXWebArea Example Domain, URL: example.org/
	2 heading Example Domain, Value: 1
		3 text Example Domain
	4 text This domain is for use in documentation examples without needing permission. Avoid use in operations.
	5 link Description: Learn more, Value: iana.org/domains/example

The focused UI element is 1 AXWebArea Example Domain, URL: example.org/Browser tab: 1, Title: "Example Domain", URL: "https://example.com/".
1 AXWebArea Example Domain, URL: example.com/
	2 heading Example Domain, Value: 1
		3 text Example Domain
	4 text This domain is for use in documentation examples without needing permission. Avoid use in operations.
```

### 19. reg 19 listBrowsers getState — `cua.listBrowsers + cua.getState` — **ok**

- name `js` ns `mcp__cua_repl` call_id `call_1fNwQTDCzu5nSOEdPje52aPS` item_id `fc_0876293ec50593fb016aa3a9a4ac0c87d0aa967224fcfb79a2` timeout_ms `60000`

```js
try { await cua.listBrowsers(); } catch(e) { nodeRepl.write(String(e)); } try { await cua.getState(); } catch(e) { nodeRepl.write(String(e)); }
```

AX / output head:

```
1","metadata":{"codexSessionId":"01a08ef5-0b1d-7d62-90b2-e342712f337d"},"name":"Codex In-app Browser","type":"iab"}]{"apps":[{"displayName":"Google Chrome","id":"com.google.Chrome","isRunning":true,"lastUsedDate":810777600,"useCount":3012},{"displayName":"Chat
```

