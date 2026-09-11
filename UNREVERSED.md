# 没能逆向出来的东西

**原则：** JS / `.d.ts` / 抓包 / live MCP 能对上的算还原完。下面这些 **没有** 完整实现或无法从本机证明。不要把目录里的 API 名当成这些也已经看清。

完整问答表：`agents/17-questions-resolved/FINDINGS.md`（185 题：156 已答 / **26 未答** / 3 范围外）。

---

## 1. `SkyComputerUseService` 编译体（最大缺口）

~22MB arm64 Swift，没有源码。GitHub openai/codex 也没有。

**刻意没做：** 反汇编、写 PoC、读 TCC.db（SIP）。

因此不知道：

| 缺口 | 备注 |
|---|---|
| `getApp("Finder")` 在 native 里怎么解析名字 | JS 只转发字符串；匹配顺序是编译的 |
| 启动 App 是隐藏还是 `activateIgnoringOtherApps` | 字符串有，行为未知 |
| 同名两个 `.app` 选谁 | 只有 `ambiguousApp` −10018 |
| 截图像素 vs 点 | `should_normalize_screenshot_to_point_resolution` 是 flag |
| settle 毫秒 | Mac `waitForUIToSettle` 里 ARM immediate **0.25 s** 和 **5.0 s**。插件文案「~1s + 最多 5s loading」的 1s **还不是** C 字符串。`needsUISettleBeforeSkyshot` 是 Bool 默认 false。锁屏 delay 是 `Duration`，值不在 C 字符串里 |
| AX diff 关了之后 `disableDiff:false` 是否仍全树 | Statsig `feature/axTreeDiffing` |
| 累加 diff vs 相对上一棵 | 两套文案都在二进制里 |
| skyshot 分类器会不会丢掉图 | `feature/skyshotClassifier` |
| **完整** forbidden / denied / 风险表 | 分类逻辑仍是编译的。`BundleIdentifiers` 有 named cluster（terminal / elevatedRisk / browser / chatGPTBundle / systemSecurity）。主 `__cstring` 连续 **42 个** bundle id：`native/policy-bundle-ids.md`。`com.google.Chrome` **不在** 这串里（走 `isChromiumApp`）。Linear 现场 policy：`allowed` + `risk: high` + `allowPersistentApproval: true`（high ≠ 只给密码管理器） |
| `allowPersistentApproval` 何时为 true | MDM vs 风险，编译 |
| URL 黑名单正则 | −10015 `blockedURL` |
| `format:'md'` 粘贴是渲染还是当源码 | **已从 JS+二进制定论：native `md` 会渲染**（SlimCore `MarkdownRichTextProvider` → NSAttributedString / HTML / RTF）。源码 UTI `net.daringfireball.markdown` 也会放上剪贴板。浏览器 `tab.paste({format:'md'})` 相反：纯 `text/plain` + Ctrl+v。live md 粘贴仍未跑。详见 `agents/29-paste-settle/` |
| EventTap 走 Accessibility 还是 Input Monitoring | |
| 录音走 Microphone 还是 AudioCapture | 本机 audio env 未开 |
| Guardian 无 entitlements 怎么在锁屏 AX | |
| 谁把 auth plugin 1000366 升到捆绑 1000968 | |
| CGEvent 怎么合成每一次点击 | 只知道链接了 CGEvent / AXPress |

Windows window2、Linux 整桌面：**这台 Mac 不跑**，标范围外（截图张数、`.exe` 如何填 `Window.app`）。

---

## 2. 鉴权：旁路进程点不了屏

独立 `node_repl` / 未签名 Node / 连 OpenAI 签过的 `cua_node`：

- unix `ping` → 对端掐线
- MCP `list_apps` → **−10000 Sender process is not authenticated**
- `cua.listApps()` → `Sky Computer Use native pipe startup failed`

鉴权枚举（二进制恰好四个）：`UNSPECIFIED` / `MISSING_PARENT` / `UNTRUSTED_PARENT` / `RELAY_WITHOUT_TRUSTED_ANCESTOR`。

看 parent 的 team + signing id + executable；responsible 再加 bundle id。Team `2DC432GLL2` **不够**：Identifier=`node` 即使用 OpenAI 签过也会被拒。JS 对端 signing id 是 `node_repl`；宿主像 `com.openai.codex*`。

- unix `ping`：accept 时 `LOCAL_PEERTOKEN`，未认证直接 **FIN、0 字节**，所以看不到 −10000 / −10013
- MCP `SkyComputerUseClient`：stdio 本地、XPC 转发，client 签名过所以能 `tools/list`，`list_apps` 才回 **−10000**（relay 没有可信祖先）

细节：`agents/24-sender-auth/FINDINGS.md`。

**没逆向出** 怎样伪造这个发送方（也不该伪造）。

---

## 3. IAB / Chrome 原生宿主内部

JS 知道 `/tmp/codex-browser-use/*.sock` 和 Native Messaging。旁路 REPL `browser setup` 成功但 **`No browser is available`**：登记协议 / 握手 token 不在 JS 包里。

JS 结论（`agents/26-iab-handshake`）：sock **不是登记表**。ChatGPT 按会话 **listen**；browser-service **readdir + getInfo**。没有 handshake token。鉴权是 `nativePipe` + `LOCAL_PEERTOKEN` + 每次 RPC 带 `session_id`/`turn_id`。IAB `getInfo` 还要这条 `session_id` 在 ChatGPT 里有 **session route**。旁路假 meta（`debug-cua-reverse`）没有 route，list 为空。

- IAB `nameSession`：**校验名字后 no-op**（不改 ChatGPT 标题）
- Chrome `nameSession`：标签组标题
- Chrome `{visible:true}`：扩展侧会 `focusTab` 系统窗口（agent 13）

---

## 4. 产品 / 运行时黑盒

| 缺口 | |
|---|---|
| `omit_tools_from: deferred` 的执行器 | 和 `code_mode` 并列，未反编译 |
| SubagentStop 的 `session_id=${agent_id}` 服务端是否当会话键 | |
| `NODE_REPL_TRUSTED_CODE_PATHS` 升级后怎么失效 | |
| `node_repl is unavailable for this model` 的模型白名单 | 这两轮 `gpt-6-astra` 可用 |
| Linear 抓包里 paste 后再 `setValue` 是贴错栏还是改文案 | 没有完整 AX 对照 |
| assignee 点击 index `257` 稳不稳 | 只出现一次 |

---

## 5. 现场调试已证明、但「Raise 0」不是 native 黑盒

2026-09-11 ChatGPT 桌面执行（抓包 `codex-traffic/2026-09-11/0999_WS_…`）：

```js
let app = await cua.getApp("Finder");  // 成功
await app.performSecondaryAction(0, "Raise");  // 模型未再发 js：AX 上 0 不能 Raise
```

`getApp` 返回的树：

```
App: Finder.
0 scroll area (disabled) desktop
  1 container desktop
    2…21 image … Secondary Actions: open
22 menu bar
```

**0 是禁用的桌面滚动区，Secondary Actions 没有 Raise。** 图标只有 `open`。  
Linear 那次 `Raise` 打在 **窗口** 节点上，不是 Finder 桌面的 0。这是 API 用对、参数选错，不是服务没还原。

正确 Raise 要先在 AX 里找带 `Raise` 的窗口节点，或走 `click` 菜单 **Window**。不要对桌面 `scroll area` 调 Raise。
