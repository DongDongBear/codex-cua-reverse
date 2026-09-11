# ChatGPT.app Computer Use + Browser Use — 完整能力清单

对照抓包：`/Users/dongdong/Desktop/codex拦截-两轮-raw.json`（两轮 desktop 主会话）。

## 完成判据

每一项能力必须同时有：(1) 本机源码/类型出处 (2) 与抓包或文档的对应 (3) 至少一名独立 Agent 交叉确认。
抓包里没出现的能力仍要逆向完，状态标 `reversed_unused`。

## 抓包工具名

`js`×37, `request_user_input_async`×1, `js_reset`×1

## 1. 模型工具 / REPL

| API | 抓包 | 出处 |
|---|---|---|
| `js` | YES | node_repl / unified-computer-use |
| `js_reset` | YES | node_repl / unified-computer-use |
| `turn_ended` | — | node_repl / unified-computer-use |
| `js_add_node_module_dir` | — | node_repl / unified-computer-use |
| `nodeRepl.write` | YES | node_repl / unified-computer-use |
| `nodeRepl.emitImage` | — | node_repl / unified-computer-use |
| `nodeRepl.emitAudio` | — | node_repl / unified-computer-use |
| `nodeRepl.createElicitation` | — | node_repl / unified-computer-use |

## 2. tinysky-alt `cua` / Target / Tab

| API | 抓包 |
|---|---|
| `cua.getState` | reversed_unused |
| `cua.getBrowser` | YES |
| `cua.createBrowserTab` | reversed_unused |
| `cua.getTab` | YES |
| `cua.listBrowsers` | reversed_unused |
| `cua.listTabs` | YES |
| `cua.getApp` | YES |
| `cua.listApps` | YES |
| `target.getAXState` | YES |
| `target.getScreenshot` | YES |
| `target.getAXStateAndScreenshot` | YES |
| `target.click` | YES |
| `target.typeText` | YES |
| `target.setValue` | YES |
| `target.pressKey` | YES |
| `target.scroll` | reversed_unused |
| `target.drag` | reversed_unused |
| `target.paste` | YES |
| `target.selectText` | reversed_unused |
| `target.performSecondaryAction` | YES |
| `tab.goto` | reversed_unused |
| `tab.back` | reversed_unused |
| `tab.forward` | reversed_unused |
| `tab.reload` | reversed_unused |
| `tab.close` | reversed_unused |
| `tab.markDeliverable` | reversed_unused |
| `tab.markHandoff` | reversed_unused |

## 3. `@oai/sky` window（Mac live）

抓包**没有**直接 `sky.*`，走的是 `cua.getApp` → Target。

| API | 抓包 |
|---|---|
| `sky.list_apps` | reversed_unused (wrapped by cua.App) |
| `sky.get_app_state` | reversed_unused (wrapped by cua.App) |
| `sky.click` | reversed_unused (wrapped by cua.App) |
| `sky.drag` | reversed_unused (wrapped by cua.App) |
| `sky.paste` | reversed_unused (wrapped by cua.App) |
| `sky.perform_secondary_action` | reversed_unused (wrapped by cua.App) |
| `sky.press_key` | reversed_unused (wrapped by cua.App) |
| `sky.scroll` | reversed_unused (wrapped by cua.App) |
| `sky.select_text` | reversed_unused (wrapped by cua.App) |
| `sky.set_value` | reversed_unused (wrapped by cua.App) |
| `sky.type_text` | reversed_unused (wrapped by cua.App) |
| `sky.start_audio_recording` | reversed_unused (wrapped by cua.App) |
| `sky.stop_audio_recording` | reversed_unused (wrapped by cua.App) |

## 4. `@oai/browser-desktop` Agent API（api.json 全量）

共 146 个成员，root=`Agent`。

| 接口 | 成员 | 抓包 | 签名 |
|---|---|---|---|
| Agent | `browsers` | — | `browsers: Browsers; // API for finding and selecting browsers.` |
| Agent | `documentation` | — | `documentation: Documentation; // API for reading packaged browser-use documentation by nam` |
| Browsers | `get` | YES | `get(id: string): Promise<Browser>; // Get a browser by id or client type.` |
| Browsers | `getDefault` | — undocumented | `getDefault(): Promise<Browser>; // Get the default browser from those currently available.` |
| Browsers | `getForUrl` | — undocumented | `getForUrl(url: string): Promise<Browser>; // Get the browser best suited to interact with ` |
| Browsers | `list` | — | `list(): Promise<Array<{ family?: string; id: string; metadata?: { codexSessionId?: string;` |
| Browser | `browserId` | YES | `browserId: string; // Browser id selected by `agent.browsers.get()`.` |
| Browser | `capabilities` | — | `capabilities: BrowserCapabilityCollection; // Browser-scoped optional capabilities adverti` |
| Browser | `tabs` | — | `tabs: Tabs; // API for interacting with browser tabs.` |
| Browser | `user` | — unsupported=['iab', 'cdp'] | `user: BrowserUser; // Context for user-owned browser tabs.` |
| Browser | `documentation` | — | `documentation(): Promise<string>; // Read browser guidance and the core API reference.` |
| Browser | `history` | — unsupported=['iab', 'cdp'] | `history(options: BrowserHistoryOptions): Promise<Array<BrowserHistoryEntry>>; // List rece` |
| Browser | `nameSession` | — | `nameSession(name: string): Promise<void>; // Name the current browser automation session.` |
| BrowserUser | `claimTab` | — | `claimTab(tab: string \| BrowserUserTabInfo): Promise<Tab>; // Claim a user tab returned by` |
| BrowserUser | `getTabContext` | — undocumented unsupported=['extension', 'iab', 'cdp'] | `getTabContext(tab: string \| BrowserUserTabInfo): Promise<BrowserUserTabContext>; // Read ` |
| BrowserUser | `openTabs` | — | `openTabs(): Promise<Array<BrowserUserTabInfo>>; // List open top-level tabs across the use` |
| Tabs | `content` | — unsupported=['iab', 'extension', 'cdp'] | `content(options: TabsContentOptions): Promise<Array<TabsContentResult>>; // Load one or mo` |
| Tabs | `get` | YES | `get(id: string): Promise<Tab>; // Get a tab by id.` |
| Tabs | `list` | — | `list(): Promise<Array<TabInfo>>; // List open tabs in the browser.` |
| Tabs | `new` | — | `new(): Promise<Tab>; // Create and return a new tab in the browser.` |
| Tabs | `selected` | — | `selected(): Promise<undefined \| Tab>; // Return the currently selected tab, if any.` |
| Tab | `ax` | — unsupported=['iab', 'extension', 'cdp'] | `ax: AXAPI; // API for interacting with accessibility state and accessibility elements.` |
| Tab | `capabilities` | — | `capabilities: TabCapabilityCollection; // Tab-scoped optional capabilities advertised by t` |
| Tab | `clipboard` | — | `clipboard: TabClipboardAPI; // API for interacting with the browser session's clipboard.` |
| Tab | `content` | — | `content: ContentAPI; // API for exporting tab content.` |
| Tab | `cua` | — | `cua: CUAAPI; // API for interacting with the tab via the cua api` |
| Tab | `dev` | — | `dev: TabDevAPI; // API for developer-oriented tab inspection.` |
| Tab | `dom_cua` | — | `dom_cua: DomCUAAPI; // API for interacting with the tab via the dom based cua api` |
| Tab | `id` | — | `id: string; // A tab's unique identifier` |
| Tab | `playwright` | — | `playwright: PlaywrightAPI; // API for interacting with the tab via the playwright api` |
| Tab | `back` | — | `back(): Promise<void>; // Navigate this tab back in history.` |
| Tab | `close` | — | `close(): Promise<void>; // Close this tab.` |
| Tab | `forward` | — | `forward(): Promise<void>; // Navigate this tab forward in history.` |
| Tab | `getJsDialog` | — | `getJsDialog(): Promise<undefined \| Dialog>; // Get the active JavaScript dialog for this ` |
| Tab | `goto` | — | `goto(url: string): Promise<void>; // Open a URL in this tab.` |
| Tab | `markDeliverable` | — unsupported=['cdp'] | `markDeliverable(): Promise<void>; // Keep this tab as a deliverable after the turn complet` |
| Tab | `markHandoff` | — unsupported=['cdp'] | `markHandoff(): Promise<void>; // Keep this tab available for a later turn after the curren` |
| Tab | `reload` | — | `reload(): Promise<void>; // Reload this tab.` |
| Tab | `requestManualHandoff` | — unsupported=['extension', 'iab', 'cdp'] | `requestManualHandoff(): Promise<void>; // Request manual user control of this Cloud Browse` |
| Tab | `screenshot` | — | `screenshot(options: ScreenshotOptions): Promise<Uint8Array>; // Capture a screenshot of th` |
| Tab | `title` | — | `title(): Promise<undefined \| string>; // Get the current title for this tab.` |
| Tab | `url` | — | `url(): Promise<undefined \| string>; // Get the current URL for this tab.` |
| AXAPI | `click` | YES | `click(target: number \| AXPoint, options?: AXClickOptions): Promise<void>; // Click an acc` |
| AXAPI | `drag` | — | `drag(from: AXPoint, to: AXPoint): Promise<void>; // Drag between two viewport coordinates.` |
| AXAPI | `get` | YES | `get(mode?: "state", options?: AXStateOptions): Promise<string>; // Return accessibility st` |
| AXAPI | `performSecondaryAction` | YES | `performSecondaryAction(elementIndex: number, action: string): Promise<void>; // Invoke an ` |
| AXAPI | `pressKey` | YES | `pressKey(key: string): Promise<void>; // Press a key or key combination in the current tab` |
| AXAPI | `scroll` | — | `scroll(target: number \| AXPoint, direction: AXDirection, pages?: number): Promise<void>; ` |
| AXAPI | `selectText` | — | `selectText(elementIndex: number, text: string, options?: AXSelectTextOptions): Promise<voi` |
| AXAPI | `setValue` | YES | `setValue(elementIndex: number, value: string): Promise<void>; // Set the value of an acces` |
| AXAPI | `typeText` | YES | `typeText(text: string): Promise<void>; // Type text into the currently focused element.` |
| AXAPI | `write` | YES | `write(mode?: "state", options?: AXStateOptions): Promise<void>; // Prefer this method to d` |
| ContentAPI | `export` | — | `export(): Promise<string>; // Export the tab's content to a file on disk using the default` |
| ContentAPI | `exportGsuite` | — | `exportGsuite(type: "pdf" \| "md" \| "xlsx" \| "csv" \| "docx" \| "pptx"): Promise<string>;` |
| ContentAPI | `exportYouTubeTranscript` | — | `exportYouTubeTranscript(): Promise<string>; // Export an HTTPS youtube.com or www.youtube.` |
| CUAAPI | `click` | — | `click(options: ClickOptions): Promise<void>; // Click at a coordinate in the current viewp` |
| CUAAPI | `double_click` | — | `double_click(options: DoubleClickOptions): Promise<void>; // Double click at a coordinate ` |
| CUAAPI | `downloadMedia` | — undocumented unsupported=['iab'] | `downloadMedia(options: CuaDownloadMediaOptions): Promise<void>; // Trigger a media downloa` |
| CUAAPI | `drag` | — | `drag(options: DragOptions): Promise<void>; // Drag from a point to a point by the provided` |
| CUAAPI | `keypress` | — | `keypress(options: KeypressOptions): Promise<void>; // Press control characters at the curr` |
| CUAAPI | `move` | — | `move(options: MoveOptions): Promise<void>; // Move the mouse to a point by the provided x ` |
| CUAAPI | `scroll` | — | `scroll(options: ScrollOptions): Promise<void>; // Scroll by a delta from a specific viewpo` |
| CUAAPI | `type` | — | `type(options: TypeOptions): Promise<void>; // Type text at the current focus.` |
| DomCUAAPI | `click` | — | `click(options: DomClickOptions): Promise<void>; // Click a DOM node by its id from the vis` |
| DomCUAAPI | `double_click` | — | `double_click(options: DomClickOptions): Promise<void>; // Double-click a DOM node by its i` |
| DomCUAAPI | `downloadMedia` | — undocumented unsupported=['iab'] | `downloadMedia(options: DomDownloadMediaOptions): Promise<void>; // Trigger a media downloa` |
| DomCUAAPI | `get_visible_dom` | — | `get_visible_dom(): Promise<unknown>; // Return a filtered DOM with node ids for interactab` |
| DomCUAAPI | `keypress` | — | `keypress(options: DomKeypressOptions): Promise<void>; // Press control characters at the c` |
| DomCUAAPI | `scroll` | — | `scroll(options: DomScrollOptions): Promise<void>; // Scroll either the page or a specific ` |
| DomCUAAPI | `type` | — | `type(options: DomTypeOptions): Promise<void>; // Type text into the currently focused elem` |
| PlaywrightAPI | `domSnapshot` | — | `domSnapshot(): Promise<string>; // Return a snapshot of the current DOM as a string, inclu` |
| PlaywrightAPI | `elementInfo` | — undocumented | `elementInfo(options: ElementInfoOptions): Promise<Array<ElementInfo>>; // Return locator-o` |
| PlaywrightAPI | `elementScreenshot` | — undocumented | `elementScreenshot(options: ElementScreenshotOptions): Promise<Uint8Array>; // Capture a sc` |
| PlaywrightAPI | `evaluate` | — | `evaluate<TResult, TArg>(pageFunction: PlaywrightEvaluateFunction<TArg, TResult>, arg?: TAr` |
| PlaywrightAPI | `expectNavigation` | — | `expectNavigation<T>(action: () => Promise<T>, options: { timeoutMs?: number; url?: string;` |
| PlaywrightAPI | `frameLocator` | — | `frameLocator(frameSelector: string): PlaywrightFrameLocator; // Create a frame-scoped loca` |
| PlaywrightAPI | `getByLabel` | — | `getByLabel(text: TextMatcher, options: { exact?: boolean }): PlaywrightLocator; // Find el` |
| PlaywrightAPI | `getByPlaceholder` | — | `getByPlaceholder(text: TextMatcher, options: { exact?: boolean }): PlaywrightLocator; // F` |
| PlaywrightAPI | `getByRole` | — | `getByRole(role: string, options: { exact?: boolean; name?: TextMatcher }): PlaywrightLocat` |
| PlaywrightAPI | `getByTestId` | — | `getByTestId(testId: string): PlaywrightLocator; // Find elements by test id within the pag` |
| PlaywrightAPI | `getByText` | — | `getByText(text: TextMatcher, options: { exact?: boolean }): PlaywrightLocator; // Find ele` |
| PlaywrightAPI | `locator` | YES | `locator(selector: string): PlaywrightLocator; // Create a locator scoped to this tab.` |
| PlaywrightAPI | `waitForEvent` | — | `waitForEvent(event: "download", options?: WaitForEventOptions): Promise<PlaywrightDownload` |
| PlaywrightAPI | `waitForLoadState` | — | `waitForLoadState(options: PageWaitForLoadStateOptions): Promise<void>; // Wait for the pag` |
| PlaywrightAPI | `waitForTimeout` | — | `waitForTimeout(timeoutMs: number): Promise<void>; // Wait for a fixed duration.` |
| PlaywrightAPI | `waitForURL` | — | `waitForURL(url: string, options: PageWaitForURLOptions): Promise<void>; // Wait for the pa` |
| PlaywrightFrameLocator | `frameLocator` | — | `frameLocator(frameSelector: string): PlaywrightFrameLocator; // Create a locator scoped to` |
| PlaywrightFrameLocator | `getByLabel` | — | `getByLabel(text: TextMatcher, options: { exact?: boolean }): PlaywrightLocator; // Find el` |
| PlaywrightFrameLocator | `getByPlaceholder` | — | `getByPlaceholder(text: TextMatcher, options: { exact?: boolean }): PlaywrightLocator; // F` |
| PlaywrightFrameLocator | `getByRole` | — | `getByRole(role: string, options: { exact?: boolean; name?: TextMatcher }): PlaywrightLocat` |
| PlaywrightFrameLocator | `getByTestId` | — | `getByTestId(testId: string): PlaywrightLocator; // Find elements by test id within this fr` |
| PlaywrightFrameLocator | `getByText` | — | `getByText(text: TextMatcher, options: { exact?: boolean }): PlaywrightLocator; // Find ele` |
| PlaywrightFrameLocator | `locator` | — | `locator(selector: string): PlaywrightLocator; // Create a locator scoped to this frame.` |
| PlaywrightLocator | `all` | — | `all(): Promise<Array<PlaywrightLocator>>; // Resolve to a list of locators for each matche` |
| PlaywrightLocator | `allTextContents` | — | `allTextContents(options: { timeoutMs?: number }): Promise<Array<string>>; // Return `textC` |
| PlaywrightLocator | `and` | — | `and(locator: PlaywrightLocator): PlaywrightLocator; // Return a locator matching elements ` |
| PlaywrightLocator | `check` | — | `check(options: LocatorCheckOptions): Promise<void>; // Check a checkbox or switch-like con` |
| PlaywrightLocator | `click` | YES | `click(options: LocatorClickOptions): Promise<void>; // Click the element matched by this l` |
| PlaywrightLocator | `count` | — | `count(): Promise<number>; // Number of elements matching this locator.` |
| PlaywrightLocator | `dblclick` | — | `dblclick(options: LocatorClickOptions): Promise<void>; // Double-click the element matched` |
| PlaywrightLocator | `downloadMedia` | — | `downloadMedia(options: LocatorDownloadMediaOptions): Promise<void>; // Trigger a download ` |
| PlaywrightLocator | `evaluate` | — | `evaluate<TResult, TArg>(pageFunction: LocatorEvaluateFunction<TArg, TResult>, arg?: TArg, ` |
| PlaywrightLocator | `evaluateAll` | — | `evaluateAll<TResult, TArg>(pageFunction: LocatorEvaluateAllFunction<TArg, TResult>, arg?: ` |
| PlaywrightLocator | `fill` | — | `fill(value: string, options: { timeoutMs?: number }): Promise<void>; // Replace the elemen` |
| PlaywrightLocator | `filter` | — | `filter(options: LocatorFilterOptions): PlaywrightLocator; // Narrow this locator by additi` |
| PlaywrightLocator | `first` | — | `first(): PlaywrightLocator; // Return a locator pointing at the first matched element.` |
| PlaywrightLocator | `getAttribute` | — | `getAttribute(name: string, options: { timeoutMs?: number }): Promise<null \| string>; // R` |
| PlaywrightLocator | `getByLabel` | — | `getByLabel(text: TextMatcher, options: { exact?: boolean }): PlaywrightLocator; // Find el` |
| PlaywrightLocator | `getByPlaceholder` | — | `getByPlaceholder(text: TextMatcher, options: { exact?: boolean }): PlaywrightLocator; // F` |
| PlaywrightLocator | `getByRole` | — | `getByRole(role: string, options: { exact?: boolean; name?: TextMatcher }): PlaywrightLocat` |
| PlaywrightLocator | `getByTestId` | — | `getByTestId(testId: string): PlaywrightLocator; // Find elements by test id, scoped to thi` |
| PlaywrightLocator | `getByText` | — | `getByText(text: TextMatcher, options: { exact?: boolean }): PlaywrightLocator; // Find ele` |
| PlaywrightLocator | `innerText` | — | `innerText(options: { timeoutMs?: number }): Promise<string>; // Return the rendered (visib` |
| PlaywrightLocator | `isEnabled` | — | `isEnabled(): Promise<boolean>; // Whether the first matched element is currently enabled.` |
| PlaywrightLocator | `isVisible` | — | `isVisible(): Promise<boolean>; // Whether the first matched element is currently visible.` |
| PlaywrightLocator | `last` | — | `last(): PlaywrightLocator; // Return a locator pointing at the last matched element.` |
| PlaywrightLocator | `locator` | YES | `locator(selector: string, options: LocatorLocatorOptions): PlaywrightLocator; // Create a ` |
| PlaywrightLocator | `nth` | — | `nth(index: number): PlaywrightLocator; // Return a locator pointing at the Nth matched ele` |
| PlaywrightLocator | `or` | — | `or(locator: PlaywrightLocator): PlaywrightLocator; // Return a locator matching elements t` |
| PlaywrightLocator | `press` | — | `press(value: string, options: { timeoutMs?: number }): Promise<void>; // Press a keyboard ` |
| PlaywrightLocator | `pressSequentially` | — | `pressSequentially(value: string, options: LocatorPressSequentiallyOptions): Promise<void>;` |
| PlaywrightLocator | `selectOption` | — | `selectOption(value: SelectOptionInput \| Array<SelectOptionInput>, options: { timeoutMs?: ` |
| PlaywrightLocator | `setChecked` | — | `setChecked(checked: boolean, options: LocatorCheckOptions): Promise<void>; // Set a checkb` |
| PlaywrightLocator | `textContent` | — | `textContent(options: { timeoutMs?: number }): Promise<null \| string>; // Return the raw t` |
| PlaywrightLocator | `type` | — | `type(value: string, options: { timeoutMs?: number }): Promise<void>; // Type text into the` |
| PlaywrightLocator | `uncheck` | — | `uncheck(options: LocatorCheckOptions): Promise<void>; // Uncheck a checkbox or switch-like` |
| PlaywrightLocator | `waitFor` | — | `waitFor(options: LocatorWaitForOptions): Promise<void>; // Wait for the element to reach a` |
| PlaywrightDownload | `path` | — undocumented | `path(options: { timeoutMs?: number }): Promise<null \| string>; // Return the local path t` |
| PlaywrightFileChooser | `isMultiple` | — | `isMultiple(): boolean; // Whether the input allows selecting multiple files.` |
| PlaywrightFileChooser | `setFiles` | — | `setFiles(files: FileChooserFiles, options: { timeoutMs?: number }): Promise<void>; // Set ` |
| TabClipboardAPI | `read` | — | `read(): Promise<Array<TabClipboardItem>>; // Read clipboard items, including text and bina` |
| TabClipboardAPI | `readText` | — | `readText(): Promise<string>; // Read plain text from the browser clipboard.` |
| TabClipboardAPI | `write` | — | `write(items: Array<TabClipboardItem>): Promise<void>; // Write clipboard items.` |
| TabClipboardAPI | `writeText` | — | `writeText(text: string): Promise<void>; // Write plain text to the browser clipboard.` |
| TabDevAPI | `logs` | YES | `logs(options: TabDevLogsOptions): Promise<Array<TabDevLogEntry>>; // Read console log mess` |
| AlertDialog | `type` | — | `type: "alert";` |
| AlertDialog | `dismiss` | — | `dismiss(): Promise<void>;` |
| BeforeUnloadDialog | `type` | — | `type: "beforeunload";` |
| BeforeUnloadDialog | `dismiss` | — | `dismiss(): Promise<void>;` |
| ConfirmDialog | `type` | — | `type: "confirm";` |
| ConfirmDialog | `accept` | — | `accept(): Promise<void>;` |
| ConfirmDialog | `dismiss` | — | `dismiss(): Promise<void>;` |
| Documentation | `get` | — | `get(name: string): Promise<string>; // Read packaged documentation by its extensionless re` |
| PromptDialog | `type` | — | `type: "prompt";` |
| PromptDialog | `accept` | — | `accept(text: string): Promise<void>;` |
| PromptDialog | `dismiss` | — | `dismiss(): Promise<void>;` |

## 5. Browser capabilities（docs）

| 能力 | 文档 |
|---|---|
| browser.management | capabilities/browser/management.md |
| browser.viewport | capabilities/browser/viewport.md |
| browser.visibility | capabilities/browser/visibility.md |
| tab.botDetection | capabilities/tab/botDetection.md |
| tab.browserAuth | capabilities/tab/browserAuth.md |
| tab.cdp | capabilities/tab/cdp.md |
| tab.pageAssets | capabilities/tab/pageAssets.md |
| webmcp | webmcp.md |

## 6. 抓包实际调用的 API

- `app.click` ×14
- `tab.getAXState` ×12
- `tab.click` ×11
- `nodeRepl.write` ×10
- `app.getAXState` ×9
- `app.getAXStateAndScreenshot` ×8
- `tab.playwright.locator` ×7
- `cua.getApp` ×4
- `app.pressKey` ×3
- `browser.browserId` ×2
- `tab.typeText` ×2
- `app.performSecondaryAction` ×2
- `app.typeText` ×2
- `app.setValue` ×2
- `cua.getBrowser` ×1
- `cua.listTabs` ×1
- `cua.getTab` ×1
- `browser.tabs.get` ×1
- `tab.dev.logs` ×1
- `app.getScreenshot` ×1
- `cua.listApps` ×1
- `app.paste` ×1
