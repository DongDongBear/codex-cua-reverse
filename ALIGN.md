# 1161 抓包对齐（不再开 ChatGPT）

**拦截到了。** `codex-tap` 会话：

`codex-traffic/2026-09-11/1161_WS_backend-api_codex_responses`

- `websocket.jsonl` 约 4.0MB
- proxy：`1161-01` … `1161-12` 每次 `tool_calls=1`，`1161-13` 收尾无工具
- 模型 `gpt-6-astra`，工具名全是 **`js`**（没有 `exec`）
- 12 段 `js` 的 `title` 就是 `reg 1` … `reg 12`，`timeout_ms: 60000`

下面用 **你列的结果** × **抓包里的 code** × **逆向文档**。不再触发新会话。

| 你报的 | 抓包里实际调用 | 逆向对齐 |
|---|---|---|
| 1 OK Untitled | `cua.getApp('TextEdit')` + `getAXState({emit:false,disableDiffing:true})`；文中有 `Untitled` | `cua.getApp` 按显示名绑定，和 Linear/`Finder` 同一入口。`disableDiffing` 要整树 |
| 2 OK 写入 CUA-ALIGN-OK | `alignApp.setValue(2,'CUA-ALIGN-OK')`；抓包出现 `CUA-ALIGN-OK` ×14 | Target.`setValue(index, value)` → IPC `action.setValue`。index 2 是 settable 文本框，不是桌面图标 |
| 3 OK 变成 CUA-ALIGN-OKalign-paste | `paste('align-paste',{format:'text'})`；字面量 `CUA-ALIGN-OKalign-paste` ×5 | native paste 会进文档；1074 在 Finder **桌面** 是 `pasteboardReadTimedOut`。有接剪贴板的控件才成功。`format:'text'` 与 sky `Paste` 一致 |
| 4 OK 截图非白 | `getScreenshot()` | GetSkyshot；桌面无内容窗口会白图（1074），TextEdit 有窗口就有正文 |
| 5 OK 已有文件夹窗口 | `getApp('Finder')`；若没有 `standard window` 就对 `codex-cua-reverse` 图标 `performSecondaryAction(...,'open')` | 和 1074 桌面层不同。`open` 是图标的 Secondary Action（AX 里写过），不是 Raise |
| 6 OK Raise | 在 AX 里找 `window` + `Secondary Actions:.*Raise` 再 `performSecondaryAction`；有 `RAISE OK` | 1074 对桌面 0 没有 Raise。必须打在 **窗口** 节点。IPC `performSecondaryAction` |
| 7 OK 滚动 0→~0.77 | `scroll(34,'down',1)`；抓包 `0.77` ×8 | 非 disabled 的 scroll 节点。1074 `scroll(0)` → −10005 `noWindowsAvailable`。sky `scroll` `{element_index, direction, pages}` |
| 8 OK IAB 本地页 | `getBrowser({})` + `createBrowserTab(b.browserId,'http://127.0.0.1:8765/',{visible:true})`；http `GET / 200` | `getBrowser` 不开页；`createBrowserTab` + `visible` 才开。IAB `browserId` 是 `'1'` 这类运行时 id |
| 9 OK ok:CUA-ALIGN | `#name`.fill / `#bio`.fill / `#btn-ok`.click；`ok:CUA-ALIGN` ×4 | Playwright 子集 fill/click。测试页 `btn-ok` 会 `log("ok:"+name)` |
| 10 FAIL Alert CDP 超时，无弹窗 | `#btn-alert`.click + `getJsDialog()`；有 `NO_DIALOG` | API 在：`Tab.getJsDialog`。失败是 **CDP click 超时 / 没挂上 dialog**，不是目录里没有这个方法。回归没点 Alert 时也是 NO_DIALOG |
| 11 FAIL 重新 AX 超时 | `getAXState` 再对 `AXWebArea` `scroll` | 形状对（导航后要新 AX）。这次是 **getAXState 超时**，没滚到。和「旧 index detached」是两类问题 |
| 12 OK 最终 8765 | `alignTab.url()` | `Tab.url()` 在 api.json |

## 和 1074 对照（同一套 API，目标不同）

| API | 1074 桌面 | 1161 有窗口/IAB |
|---|---|---|
| paste | 超时 | OK，正文拼接 |
| getScreenshot | 白图 | 能看到字 |
| Raise | 0 号没有该 action | 窗口节点 OK |
| scroll | −10005 | index 34，条 0→0.77 |

所以：**逆向的方法名、参数、错误语义是稳的**；不稳的是目标 AX 和偶发超时（Alert CDP、IAB 再取 AX），不是 IPC 猜错。
