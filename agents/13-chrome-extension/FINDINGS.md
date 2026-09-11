# FINDINGS — ChatGPT Chrome/Edge extension browser-use

**Verdict:** Chrome/Edge browser-use is a **family=extension** backend, not a second Playwright. The MV3 store extension `hehggadaopoacecdllhhajmbjkdcmajg` (Edge twin `odlomjlbamekndcpllcnffbgeohgkmjh`) talks Native Messaging to the Rust host `ChatGPT for Chrome` (`com.openai.codexextension`). That host plus ChatGPT.app share Unix sockets under `/tmp/codex-browser-use`. Model code reaches it through `@oai/browser-desktop` / the chrome plugin’s `browser-client.mjs`: `agent.browsers.get("chrome")` is a **family alias**, resolved to the first connected extension whose `family ?? "chrome"` matches; the live `browser.browserId` is an opaque list id; tab **mentions** use `metadata.extensionInstanceId` (a per-profile UUID in `chrome.storage.local`). Claiming is extension-only (`user.openTabs` + `user.claimTab` → native `claimUserTab` → tab lease `state=user`). IAB never claims: mentions and `cua.getTab` use `tabs.list` / `tabs.get`. `sessionName` becomes a Chrome **tab-group title**; `visibility` is advertised on Chrome and, unlike IAB’s hide-pane, maps to presenting/focusing a Chrome window (`focusTab` / `windows.update({focused:true})`). **Task-1 used IAB, not Chrome.** Every Chrome-only API below is `reversed_unused`. No live Chrome clicks, no debugger attach, no socket connect, no secrets dumped.

---

## 0. How this machine is wired (live, read-only)

| Layer | This Mac |
|---|---|
| Plugin (app) | `/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/chrome/` v`26.903.61454` |
| Plugin (cache `latest`) | `~/.codex/plugins/cache/openai-bundled/chrome/26.903.61454` (symlink `latest`) |
| Native host binary | `extension-host/macos/arm64/ChatGPT for Chrome` SHA-256 `90f99fbc…e13b` (app == cache). Codesign `Developer ID Application: OpenAI OpCo, LLC (2DC432GLL2)`, identifier `extension-host` |
| Running host PID 26871 | argv `…/ChatGPT for Chrome chrome-extension://hehggadaopoacecdllhhajmbjkdcmajg/`. **cwd still names deleted cache `26.901.51231`** (inode held). stdio pipes = Chrome Native Messaging. unix FD → `/tmp/codex-browser-use/e3a02578-8721-4839-8711-fd3185c765d6.sock` |
| Store extension | Chrome Default **and** Edge Default, unpacked `1.26.901.11451_0`, id **`hehggadaopoacecdllhhajmbjkdcmajg`** (Chrome Web Store id even on Edge). Enabled. Edge add-on id `odlomjlbamekndcpllcnffbgeohgkmjh` **not** installed here |
| Native Messaging manifest | `~/Library/Application Support/{Google/Chrome,Microsoft Edge,…}/NativeMessagingHosts/com.openai.codexextension.json` — `check-native-host-manifest.js --browser chrome --json` → `correct: true` |
| CUA REPL (task-1 path) | `NODE_REPL_TRUSTED_SERVICES.browser = "@oai/browser-desktop/service"` (desktop package), **not** the chrome plugin cwd. Plugin `browser-service.mjs` is a sibling copy (plugin 1 305 259 B / desktop 1 303 004 B) |
| Task-1 | `cua.getBrowser({ url: "https://ant.design/components/form" })` → IAB. `browserId`/`tab` id `"1"`. **No** `claimTab` / `openTabs` / `nameSession` / `"chrome"` |

`chrome-is-running.js --json`: Chrome running. `installed-browsers.js --json`: Chrome 152.0.7977.83 + Edge 152.0.4191.66. Brave/Opera/Vivaldi not installed.

Did **not**: `open-chrome-window.js` (would launch), connect to `*.sock`, `chrome.debugger` attach, click, or read `Local Extension Settings` LevelDB.

---

## 1. Two plugins, one Chromium backend

App plugins share docs + `browser-client.mjs` / `browser-service.mjs` (byte-identical). Diff:

| | `plugins/chrome` | `plugins/browser` |
|---|---|---|
| `plugin.json` `name` | `"chrome"` | `"browser"` |
| Mentions | `@Chrome` `plugin://chrome@openai-bundled` (+ `chrome-internal` / `chrome-dev`) | `@Browser` `plugin://browser@openai-bundled` (IAB) |
| Skill | `skills/control-chrome/SKILL.md` | `skills/control-in-app-browser/SKILL.md` |
| Extra | `extension-host/` + `scripts/installManifest.mjs` | no native-host binary |

SKILL bodies are the same bootstrap: `setupBrowserRuntime()` then `agent.browsers.get("chrome"|"edge"|"iab"|"extension")` / `getForUrl` / `getDefault`. Tool id in that skill is `mcp__node_repl__js`. **Traces used `mcp__cua_repl` `js` + tinysky `cua.*`**, not this skill’s import path.

Cache `chrome/26.903.61454/skills/` is **empty** (plugin.json still says `"./skills/"`). Live skill text is in the app bundle.

`installManifest.mjs` (model must **not** run it; troubleshooting says reinstall the plugin):

- Host name `com.openai.codexextension`
- Allowed origins both store ids
- Binary path `extension-host/{macos\|windows\|linux}/{arm64\|x64}/ChatGPT for Chrome` (Windows `extension-host.exe`, Linux `extension-host`)
- Writes `extension-host-config.json` next to the binary (`schemaVersion: 1`, `channel`, `browserClientPath`, `codexCliPath`, `nodePath`, `nodeReplPath`, `proxyHost=127.0.0.1`, `proxyPort=0`)
- Cache path rewrite: if cwd is `plugins/cache/…/<ver>`, manifests point at `…/latest`

Channels in the minified catalog: Chrome/Edge **prod** store ids; **beta** Codex id `lfkehkpjohcoelkpembgemeipeppanef`; **dev/internal** empty ids + `com.openai.codexextension.dev` / `.internal`.

---

## 2. Store extension (what Chrome actually runs)

Unpacked (do not treat `Local Extension Settings/` as source):

`~/Library/Application Support/Google/Chrome/Default/Extensions/hehggadaopoacecdllhhajmbjkdcmajg/1.26.901.11451_0/`

Same tree under Edge Default.

### `manifest.json` (MV3, min Chrome 116)

- **name** `ChatGPT`, description `Control your browser with ChatGPT.`
- **background** service worker `background.js` (356 KB)
- **host_permissions** `<all_urls>`
- **permissions:** `alarms`, `bookmarks`, `debugger`, `declarativeNetRequestWithHostAccess`, `downloads`, `favicon`, `history`, `nativeMessaging`, `notifications`, `scripting`, `sessions`, `storage`, `tabGroups`, `tabs`, `topSites`, `webNavigation`, `contextMenus`, `sidePanel`
- **optional:** `downloads.open`
- **action** `Ctrl/Command+Shift+Period`; command `open-codex-side-panel`
- **side_panel** `codex-sidepanel/index.html` (full Codex UI)
- **content_scripts (manifest):** `chatgpt-website.js` @ `https://chatgpt.com/*` (document_end); `codex-work-media-permission.js` MAIN world document_start
- **CSP** allows `127.0.0.1` / `localhost` ws+http and `https://chatgpt.com` / `api.openai.com` / `ab.chatgpt.com`
- **update_url** Chrome Web Store; **key** pins the public id `hehggadaopoacecdllhhajmbjkdcmajg`
- **version** `1.26.901.11451` — `codex/build-info.json` `{ build_flavor: "release", release_channel: "stable", sha: "834ab2c3159a7637c75db757ad053344da009e8b" }`

Injected at runtime (not in the manifest `content_scripts` array): `content-scripts/codex.js` (cursor overlay + favicon badge), `foreign-frame-monitor.js`. WebMCP filenames (`content-scripts/webmcp.js`, `webmcp-bridge.js`) appear as strings; those files are **not** in this unpacked tree (register/unregister at runtime).

### `background.js` roles

WXT-bundled worker. Family from `navigator.userAgent` (`vt(..., "brave" in navigator)`). JSON-RPC 2.0 over `chrome.runtime.connectNative("com.openai.codexextension")` with reconnect via `chrome.alarms`.

| Concern | Mechanism |
|---|---|
| Identity | `chrome.storage.local.extensionInstanceId` — UUID minted once (`crypto.randomUUID`). Tab-mention generation UUID in `chrome.storage.session` |
| `getInfo` | `{ type: "extension", family, name: "Chrome"\|"Edge"\|…, version, agentRequestHeaderEnabled, capabilities: { browser: [visibility, management?], tab: [pageAssets, webmcp?] }, metadata: { extensionId, extensionInstanceId } }` |
| Tab leases | `TAB_LEASES` in local storage. `claimTab(sessionId, turnId, tabId, "agent"\|"user", requestHeaderEnabled)`. Cross-session claim throws `Tab N is already part of browser session …` |
| Agent tabs | `chrome.tabs.create` → mute → `tabGroups.ensureAgentTabGroup` → lease `"agent"` → overlay + DNR |
| User claim | `chrome.tabs.get` → reject `chrome://` / internal URLs → lease `"user"` → **no** agent tab group (docs: “without moving it into an agent tab group”) |
| `nameSession` | `tabGroups.setSessionGroupTitle(sessionId, name, activeAgentTabIds)` — emoji-prefixed title on the **managed tab group** |
| Cleanup | `finalizeTabs({ keep })` / `turnEnded`. Unmarked **agent** tabs close; unmarked **user** leases released, tabs left open |
| CDP | `chrome.debugger.attach` / `onDetach`; `executeCdp` |
| Agent request headers | DNR session rules: header `x-browser-agent: ChatGPT/<version>` on leased tabs. Stale extension → service error `This browser requires agent request headers. Update the Chrome extension before continuing.` |
| Overlay | inject `codex.js`: cursor (`images/cursor-chat.png`) + favicon badges `active` / `deliverable` (green) / `handoff` (yellow) |
| Management | Chrome-like `windows` / `tabs` / `tabGroups` / `bookmarks` subset + `getAuditTrail()` (`BROWSER_MANAGEMENT_AUDIT_TRAIL`) |
| Mentions | `getUserTabs` → `chrome.tabs.query`, http(s) only, no incognito; objects `{ id: chromeTabId, browserId: profileInstanceId, providerTabId, title, url, lastOpened, faviconUrl }` |
| Side panel | Codex UI; `codexRuntime/openLocalFile` via native host if `supportedMethods` includes it |
| chatgpt.com bridge | `search_browser_tab_mentions`, `GET_CHATGPT_BROWSER_TAB_CONTEXT`, `GET_CHATGPT_EXTENSION_STATUS`, `OPEN_CODEX_SIDE_PANEL` |

Native JSON-RPC: `{ jsonrpc: "2.0", id, method, params }`. Host methods include `ping`, session commands listed in §5, plus `codexRuntime/openLocalFile` and tab-context asset create/append/finish/abort/remove.

---

## 3. Native host (`ChatGPT for Chrome`)

Rust crate `extension_host` (~1.0 MB Mach-O arm64). Not Node.

**stdio (Chrome Native Messaging):** 4-byte length-prefixed JSON-RPC. `stdin read failed; exiting` / `stdout write failed; exiting`. `message too large for 4-byte length prefix`.

**Unix sockets:** `/tmp/codex-browser-use` (Windows `\\.\pipe\codex-browser-use`). Strings: `unix socket directory path is not a directory`, `UnixSocketTransport`, `run_with_routing_platform_transport`. Live: host **connected** to `e3a02578-….sock`. ChatGPT.app PID 3579 **listens/holds** `c8842a5c-…` (`CODEX_APP_TOOLS_PIPE_PATH`), `f1a9a786-…`, `269127ad-…`. Stale UUID sockets from earlier days remain in the directory.

**App-server proxy:** binds a local HTTP/WebSocket proxy (`127.0.0.1`, `Failed to bind Codex app-server proxy`, `Upgrade: websocket`). Side panel talks to Codex through this, not through CUA `js`.

**Install matching (`chrome-native-hosts-v2.json`, schemaVersion 2):** `requiredNativeHostProtocolVersion`, `requiredAppServerProtocolVersion`, `extensionId`, `nativeHostName`, `extensionBuildChannel`. Errors: `chrome_extension_update_required`, `codex_app_update_required`, `no_matching_codex_install`, `manifest_invalid`, `Codex Chrome native host v2 manifest is missing`.

**Peer audit:** host checks the calling browser’s code signature team id:

| Team ID | Bundle |
|---|---|
| `EQHXZ8M8AV` | `com.google.Chrome` |
| `UBF8T346G9` | `com.microsoft.edgemac` |
| `KL8N8XSYF4` | `com.brave.Browser` |
| `A2P9LX4JPN` | `com.operasoftware.Opera` |
| `4XF3XNRN6Y` | `com.vivaldi.Vivaldi` |

Also references `2DC432GLL2.com.openai.codex.notifications` and `2DC432GLL2.com.openai.sky.CUAService`.

**Env the host understands:** `CODEX_CLI_PATH`, `CODEX_EXTENSION_ID`, `CODEX_BROWSER_USE_NODE_PATH`, `CODEX_BROWSER_CLIENT_PATH`, `CODEX_HOME`, `CODEX_NODE_REPL_PATH`, `CODEX_APP_SERVER_PROXY_HOST`, `CODEX_APP_SERVER_PROXY_PORT`.

---

## 4. `browserId` `"chrome"` → `extensionInstanceId`

Three different identifiers. Do not collapse them.

### A. Family / type aliases (selection keys)

Service matcher (`cv` in plugin `browser-service.mjs`):

```js
cv({ browserId: e, clientInfo: t, requestedBrowserId: r }) {
  return Ah(r) ? Eh(t.type) === r                         // "extension" | "iab" | "cdp"
       : yh(r) ? t.type === "extension" && (t.family ?? "chrome") === r  // catalog key
       : e === r;                                         // opaque list id
}
```

`yh(r)` = `r` is a key of the Chromium catalog: **`chrome`, `edge`, `brave`, `opera`, `vivaldi`**. `backendCompatibilityKey` for all of them is `"chrome"` (same extension protocol).

So:

| Call | Matches |
|---|---|
| `browsers.get("chrome")` / `cua.getBrowser({ id: "chrome" })` / `createBrowserTab("chrome", …)` | first `type==="extension"` with `family??"chrome"==="chrome"` |
| `get("edge")` | first extension with family `edge` |
| `get("extension")` | first `type==="extension"` (skill: unnamed “external browser”) |
| `get("iab")` | first IAB |
| `get(<opaque>)` | `list()[].id === opaque` |

`getDefault`: IAB → preferred extension instance → any extension → first. `getForUrl`: `file:` / localhost / `127.0.0.1` / `::1` prefer **iab**; else score open tabs (exact → origin+path → host → host hierarchy), then iab / preferred extension / any extension.

Preferred instance:

```js
sv(env) {
  const id = env.BROWSER_USE_PREFERRED_EXTENSION_INSTANCE_ID
          ?? env.BROWSER_USE_PREFERRED_CHROME_EXTENSION_INSTANCE_ID;
  const win = env.BROWSER_USE_PREFERRED_WINDOW_ID
           ?? env.BROWSER_USE_PREFERRED_CHROME_WINDOW_ID;
  return id == null ? null : { extensionInstanceId: id, preferredWindowId? };
}
of(clientInfo, pref) {
  return pref != null && clientInfo.type === "extension"
      && clientInfo.metadata?.extensionInstanceId === pref.extensionInstanceId;
}
```

Two Chrome profiles ⇒ two extension instances (two UUIDs). `get("chrome")` is `find`, not `filter` — **first match**, unless the preferred-id env is set.

Telemetry: `GU = { cdp: "cdp", extension: "chrome", iab: "iab" }`.

### B. Opaque `list()[].id` / `browser.browserId`

Assigned by the Node service when it discovers a backend socket and calls native `getInfo`. **Not** the string `"chrome"`. Task-1 IAB: `browser.browserId === "1"`. Extension instances get their own list id (numeric or uuid — not observed in traces). After `get("chrome")`, later `tabs.*` / `createBrowserTab` must reuse **that** `browser.browserId` (or keep the handle). Passing `"chrome"` again re-runs family `find`.

### C. `metadata.extensionInstanceId` (mention `browserId`)

Minted in the extension:

```js
Zn = "extensionInstanceId"
s = existing || crypto.randomUUID()
chrome.storage.local.set({ extensionInstanceId: s })
```

`getInfo().metadata.extensionInstanceId` is this UUID. **Tab-mention URLs put this UUID in `browserId=`**, not the family alias and not the list id.

Chrome mention (from `tab-claiming-chrome.md`):

```
plugin://browser@openai-bundled?mention=tab-v1&source=extension&browserId=<extensionInstanceId>&tabId=<chromeTabId>&title=…&url=…
plugin://chrome@openai-bundled?mention=tab-v1&browserId=…&tabId=…
plugin://chrome-internal@openai-bundled?…
plugin://chrome-dev@openai-bundled?…
```

Resolve:

1. `browsers.list()`
2. `type==="extension"` **and** `metadata.extensionInstanceId === decoded.browserId`
3. `browsers.get(match.id)` — `match.id` is the opaque list id
4. `user.openTabs()`, exact `{ providerTabId, title, url }`
5. `user.claimTab(thatObject)`

IAB mention (`tab-mentions-iab.md`): **no** `source=extension`. `browserId` is `metadata.codexSessionId`. Then `tabs.list()` + `tabs.get(id)` — **no claim**.

Fail closed if title/url drifted (tab-id reuse after Chrome restart).

chatgpt.com composer `@` mentions: content script `search_browser_tab_mentions` → `getUserTabs`; `browserId` in those objects is the **profileInstanceId** (= `extensionInstanceId`).

---

## 5. `claimTab` vs IAB `tabs.get`

### IAB (task-1)

```js
let browser = await cua.getBrowser({ url });          // selected IAB, browserId "1"
await cua.listTabs({ browser: browser.browserId });   // tabs.list ∪ (no user.openTabs)
let tab = await cua.getTab("1", { browser: browser.browserId }); // tabs.get
let pt  = await browser.tabs.get("1");                // same tab, Playwright/dev
```

`Browser.user` is `unsupportedByDefaultIn: ["iab","cdp"]`. Tinysky `getTab` only claims if `browser.user.openTabs` and `claimTab` **exist**. On IAB they do not. User-opened IAB tabs are already in `tabs.list()`. Cleanup: agent-created IAB tabs ephemeral; **user-opened IAB tabs stay**.

### Chrome/Edge (shipped, unused in traces)

Tinysky `getTab` / skill claiming:

1. `tabs.list()` match `id` **or** `providerTabId`
2. Else `user.openTabs()` same match
3. If already in agent list → `tabs.get`
4. Else **`user.claimTab(userTab)`**

Client RPC: `browser_user_open_tabs` / `browser_user_claim_tab`. Service: `sendSessionRequest("getUserTabs")` / `claimUserTab({ tabId })`.

Extension `claimUserTab`:

- `chrome.tabs.get(tabId)`
- Rewrite pending internal new-tab URLs; **throw** if URL is a Chrome-internal page (`chrome://`, family internal schemes)
- If already leased by **this** session → overlay only
- If leased by **another** session → throw
- Else `tabLeases.claimTab(..., "user", requestHeaderEnabled)` + overlay + DNR headers
- **Does not** `tabs.group` into the agent group

`createTab` (agent-created, `tabs.new()`): `chrome.tabs.create` → mute → **does** `ensureAgentTabGroup` → lease `"agent"`.

`providerTabId` = Chrome’s numeric tab id (stringified in the Agent API). Do not guess; only claim ids from the current `openTabs()` snapshot.

Turn end (`plugin.json` Interrupt/Stop/SubagentStop → MCP `turn_ended` on `node_repl`):

| Kind | Unmarked | Marked (`markDeliverable` / `markHandoff`) |
|---|---|---|
| Agent-created Chrome tab | **closed** | survives the turn (re-mark next turn) |
| Claimed user tab | **released**, left open | stays claimed |
| IAB user-opened | left open | n/a |
| IAB agent-created | closed | survives |

---

## 6. `sessionName` / visibility on Chrome

### `sessionName` → `browser.nameSession`

- `api.json`: `Browser.nameSession(name: string)` on all types; empty name throws `browser.nameSession requires a name`.
- `documents.json` includes `session-naming.md` only when `browserTypes: ["extension"]` and member present.
- Plugin `browser-description.md` (cua_repl tool text): `"chrome"` / `"edge"` → pass emoji-prefixed `sessionName` (e.g. `"🔎 Task"`) into `createBrowserTab`. IAB uses `{ visible }` instead.
- Tinysky: `createBrowserTab(..., { sessionName })` calls `nameSession` **before** `tabs.new()`; throws if the method is missing.
- Extension implementation: **`chrome.tabGroups.update` title** on the session’s managed group (`setSessionGroupTitle`). That is the visible “session name” in the user’s Chrome tab strip. Not a window title, not IAB chrome.

RPC: client `name_session` → service `sendSessionRequest("nameSession", { name })`.

**Task-1:** no `createBrowserTab`, no `nameSession`. `reversed_unused`.

### `visibility`

- Capability id `visibility`. Chrome `getInfo` **always** advertises it (`capabilities.browser: [visibility, management?]`).
- Docs (`visibility.md` + `capabilities/browser/visibility.md`): `get(): Promise<boolean>`, `set(visible: boolean)`. Default: keep work in the background.
- Tinysky `{ visible }` on `createBrowserTab` is `(await browser.capabilities.get("visibility")).set(visible)` **before** `tabs.new()`. No existence check — missing capability throws.
- RPC: `browser_visibility_get` / `browser_visibility_set`.
- IAB: show/hide the in-app browser pane.
- Chrome: cannot unmap the user’s Chrome. Backend exposes `focusTab` → `chrome.tabs.update({active:true})` + `chrome.windows.update({focused:true})`. Overlay `isVisible` only hides the **agent cursor**, not the window. `set(true)` is “present Chrome”; `set(false)` is not IAB-style hide.

**Task-1:** no `visible` / no capability. `reversed_unused` on the Chrome path.

### Viewport (related, also unused)

Chrome handles `browser_viewport_set` / `_reset` via `executeUnhandledCommand` → `tabLeases.setViewportSize` + CDP/emulation on the active session tab. Advertised as capability `viewport` in docs (`mode: "model"`). Do not set during normal setup.

---

## 7. Pipe / RPC map (extension backend)

`browser-service.mjs`:

```js
fa = platform => platform === "win32" ? "\\\\.\\pipe\\codex-browser-use" : "/tmp/codex-browser-use"
```

Discovers sockets, connects, `getInfo()`, builds `list()`.

`sendSessionRequest` methods (extension native protocol):

`allowDownload`, `attach`, `attachTarget`, `claimUserTab`, `createTab`, `detach`, `detachTarget`, `executeCdp`, `executeTabRead`, `executeUnhandledCommand`, `getInfo`, `getTabs`, `getUserHistory`, `getUserTabs`, `markTab`, `moveMouse`, `nameSession`

Plus `sendRequest("ping"|"turnEnded")`, `sendNotification("webMcpToolInvoked")`.

Client RPCs the model never used in traces (Chrome-relevant): `browser_user_claim_tab`, `browser_user_open_tabs`, `browser_user_history`, `browser_user_get_tab_context`, `name_session`, `browser_visibility_{get,set}`, `browser_viewport_{set,reset}`, `browser_management_call`, `browser_management_get_audit_trail`, `tab_cdp_call`, `tab_cdp_events`, `tab_page_assets_*`, `webmcp_*`, `tab_bot_detection_report`, `tab_browser_auth_handoff`.

---

## 8. Chrome-only API catalog vs traces

**Trace fact:** `traces/task-1-ant-design-form.json` and `traces/task-2-linear-issue.json` contain **zero** of `claimTab`, `openTabs`, `nameSession`, `createBrowserTab`, `"chrome"`, `"edge"`, `capabilities.get`, `browser.history`, `management`. Task-1 APIs are IAB Target + Playwright. Task-2 is native Linear.

Status key: **`reversed_unused`** = shipped on this disk, reversed here, **not** in either capture.

### A. `api.json` members that are extension-only by `unsupportedByDefaultIn`

| API | IAB | Chrome extension | Traces | Status |
|---|---|---|---|---|
| `Browser.user` / `openTabs` / `claimTab` | unsupported | yes | no | **reversed_unused** |
| `Browser.history` | unsupported | yes (confirmation-gated) | no | **reversed_unused** |
| `BrowserUser.getTabContext` | unsupported + `documented:false` | same in api.json; chatgpt.com script still calls `GET_CHATGPT_BROWSER_TAB_CONTEXT` | no | **reversed_unused** (dead on Agent API; live as website bridge) |
| `Tabs.content` | unsupported all types | unsupported | no | reversed_unused (all backends) |
| `Tab.requestManualHandoff` | unsupported | unsupported | no | cloud-only |
| `CUAAPI.downloadMedia` / `DomCUAAPI.downloadMedia` | unsupported | allowed (`documented:false`) | no | **reversed_unused** |
| `Tab.markDeliverable` / `markHandoff` | yes (IAB cleanup docs) | yes (Chrome cleanup: close vs release) | no | shipped both; **Chrome semantics unused** |
| `Browser.nameSession` | method exists; docs **not** included | docs included; tab-group title | no | **reversed_unused** on Chrome |

### B. Capabilities Chrome `getInfo` actually advertises

| id | Surface | When | Traces |
|---|---|---|---|
| `visibility` | `browser.capabilities` | always on extension `getInfo` | **reversed_unused** |
| `management` | `browser.capabilities` | if `browserManagementEnabled` (default true) | **reversed_unused** |
| `viewport` | `browser.capabilities` | unhandled-command path; docs `mode:model` | **reversed_unused** |
| `pageAssets` | `tab.capabilities` | always on extension | **reversed_unused** |
| `webmcp` | `tab.capabilities` | if `webMcpConfig.enabled()` | **reversed_unused** |
| `cdp` | `tab.capabilities` | debugger permission; `requiredFor` `tab_cdp_*` | **reversed_unused** |
| `botDetection` / `browserAuth` | tab | cloud/docs | **reversed_unused** |

### C. Chrome-only docs / skill paths

| Doc / script | When included | Traces |
|---|---|---|
| `session-naming.md` | type extension + `nameSession` | unused |
| `tab-claiming-chrome.md` | type extension + `openTabs`/`claimTab` | unused |
| `tab-cleanup-chrome.md` | type extension + marks | unused (IAB cleanup doc would apply to task-1 if first-use assembled it) |
| `chrome-troubleshooting.md` | `mode: model` (lookup when setup fails) | unused |
| `chrome-file-upload-troubleshooting.md` | lookup, extension only | unused |
| `scripts/chrome-is-running.js` etc. | troubleshooting only | unused by model |
| Skill `agent.browsers.get("chrome")` | chrome plugin | unused (cua_repl used tinysky) |

### D. APIs task-1 **did** use — IAB, not Chrome

`cua.getBrowser`, `cua.listTabs`, `cua.getTab`, `browser.tabs.get`, `tab.click`, `tab.typeText`, `tab.getAXState`, `tab.dev.logs`, `tab.playwright.locator.{fill,evaluate,press}`, `nodeRepl.write`.

These exist on the extension backend too (same Agent API minus `user`). **Not live-verified on Chrome.** Do not relabel them Chrome-used.

### E. Shared env that proves Chrome was *available* but unused

Live cua_repl: `BROWSER_USE_AVAILABLE_BACKENDS=chrome,iab`. Extension installed+enabled, native host correct, host process up. Model still selected IAB because the user had ant.design open in the in-app browser and called `getBrowser({ url })` (`getForUrl` scores existing tabs; IAB wins that page).

---

## 9. chatgpt.com content script vs CUA

`content-scripts/chatgpt-website.js` is **not** the CUA path. It:

- Stamps `data-chatgpt-extension-status` / side-panel availability on `chatgpt.com`
- On `@` / `+` in the composer, dispatches `search_browser_tab_mentions` and writes candidates onto `documentElement`
- Can request `GET_CHATGPT_BROWSER_TAB_CONTEXT` (the unsupported-by-default `getTabContext`)
- Handles `show-codex-installer` / `open-side-panel` clicks

That is how ChatGPT web @-mentions Chrome tabs. Codex desktop CUA uses the plugin mention URLs in §4.C instead.

---

## 10. What this is not

- Not driving Chrome via `@oai/sky` / Accessibility (that would be `cua.getApp("Google Chrome")`).
- Not launching Playwright Chromium.
- Not the IAB Codex Framework (`--owl-scoped-user-agent-prefix=CodexBrowser`, user-data-dir `~/Library/Application Support/Codex`).
- Not permission to click the user’s live Chrome (not done).
- Native-host protocol beyond strings + method names: length-prefixed JSON-RPC + unix sockets; no full protobuf schema extracted.

---

## 11. Source split (who runs what)

```
Chrome/Edge
  MV3 hehggadaopoacecdllhhajmbjkdcmajg
    connectNative(com.openai.codexextension)
      → ChatGPT for Chrome  (stdio JSON-RPC)
           ↳ unix /tmp/codex-browser-use/<uuid>.sock
           ↳ optional app-server HTTP/WS proxy (side panel)

ChatGPT.app
  listens on other /tmp/codex-browser-use/*.sock (IAB + app-tools)
  cua_repl trusted-worker
    handleRpc @oai/browser-desktop/service
      connects to /tmp/codex-browser-use/*
      getInfo() distinguishes type iab vs extension
```

Model entry (traces): tinysky `cua.getBrowser` / `getTab`. Model entry (chrome plugin skill, unused here): `setupBrowserRuntime()` + `agent.browsers.get("chrome")`.
