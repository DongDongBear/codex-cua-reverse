# 第 4 段 — 抓包没走到、但 app 里有的能力

**验证方式：** 不是 traces（本来就没用），而是「源码/类型/MCP/GitHub 配置是否存在」。  
GitHub 仍然 **没有** 这些 JS API，只有策略字段。

## 原生 Target（sky window）未在 traces 出现

| API | 出处 | Live MCP |
|---|---|---|
| `scroll(target, direction, pages?)` | tinysky + sky + MCP | YES |
| `drag(from, to)` | tinysky + sky + MCP | YES |
| `selectText(index, text, {prefix,suffix,selectionType})` | tinysky + sky + MCP | YES |
| `start_audio_recording` / `stop_audio_recording` | sky 可选 | MCP 无 |
| `sky.*` 直接调用 | 旧 computer-use 技能 | 本会话走 `cua.getApp` |

## 浏览器 Tab 未在 traces 出现（api.json 有签名）

导航：`goto` `back` `forward` `reload` `close`  
交付：`markDeliverable` `markHandoff` `requestManualHandoff`  
开页：`cua.createBrowserTab(browserId, url, {visible, sessionName})`  
库存：`cua.listBrowsers` `cua.getState`  
用户标签：`browser.user.openTabs` `claimTab`  
Playwright 其余：`getByRole/Text/Label/...`、`waitForEvent(download|filechooser)`、`expectNavigation`  
坐标 CUAAPI：`tab.cua.click/drag/type/scroll`（与 AX Target 不同）  
DomCUAAPI：`get_visible_dom` + node_id 点击  
ContentAPI 导出、clipboard、dialogs、history、`nameSession`

## Capabilities 文档（desktop 包 docs/capabilities）

| id | 文档 | GitHub 策略字段 |
|---|---|---|
| visibility | browser/visibility.md | — |
| viewport | browser/viewport.md | — |
| management | browser/management.md | — |
| cdp | tab/cdp.md | `full_cdp_access` |
| botDetection | tab/botDetection.md | — |
| browserAuth | tab/browserAuth.md | — |
| pageAssets | tab/pageAssets.md | downloads/uploads |
| webmcp | webmcp.md | `allow_webmcp` |

## 本段验证

- MCP `tools/list` 含 scroll/drag/select_text → 原生未用 API 不是编的。
- `api.json` 22 个 interface / 146 members → 浏览器未用 API 不是编的。
- GitHub `BrowserUseRequirementsToml` 对得上 webmcp / history / cdp / downloads / uploads。
