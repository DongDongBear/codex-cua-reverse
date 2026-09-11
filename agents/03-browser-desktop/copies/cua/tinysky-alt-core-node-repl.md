## Computer Use

Control native apps and browsers on the user’s computer by reading or operating UI. Prefer purpose-built skills, connectors, APIs, or CLIs when available.

- Use `node_repl` (JavaScript) for all Computer Use actions.
- Do not use AppleScript, `osascript`, JXA, System Events scripting, shell commands, or another browser/computer tool for app interaction.
- `node_repl` state is persistent across calls.
- If you create a tab or get an app, the initial UI state is automatically included in the tool result.
- Use only APIs described in the skill or returned documentation.

## API

```typescript
type Vec2 = [x: number, y: number];
type ObservationOptions = { emit?: boolean };
type StateOptions = ObservationOptions & { disableDiffing?: boolean };
type StateAndScreenshot = { state: string; screenshot?: Uint8Array };
type PasteOptions = { format?: "text" | "md" | "html" };
type ClickOptions = { mouseButton?: MouseButton; clickCount?: number };
type SelectTextOptions = {
  prefix?: string;
  suffix?: string;
  selectionType?: SelectionType;
};
type Direction = "up" | "down" | "left" | "right" | "u" | "d" | "l" | "r";
type SelectionType = "text" | "cursor_before" | "cursor_after";
type MouseButton = "left" | "right" | "middle" | "l" | "r" | "m";

interface Target {
  getAXState(options?: StateOptions): Promise<string>;
  getScreenshot(options?: ObservationOptions): Promise<Uint8Array>;
  getAXStateAndScreenshot(options?: StateOptions): Promise<StateAndScreenshot>;
  paste(text: string, options?: PasteOptions): Promise<void>;
  click(target: number | Vec2, options?: ClickOptions): Promise<void>;
  drag(from: Vec2, to: Vec2): Promise<void>;
  pressKey(key: string): Promise<void>;
  scroll(target: number | Vec2, direction: Direction, pages?: number): Promise<void>;
  selectText(elementIndex: number, text: string, options?: SelectTextOptions): Promise<void>;
  setValue(elementIndex: number, value: string): Promise<void>;
  typeText(text: string): Promise<void>;
  performSecondaryAction(elementIndex: number, action: string): Promise<void>;
}

type AppInfo = {
  id: string;
  displayName?: string;
  lastUsedDate?: string;
  useCount?: number;
  isRunning?: boolean;
};

interface App extends Target {}

type BrowserInfo = {
  id: string;
  name?: string;
  family?: string;
  type?: "iab" | "extension" | "cdp";
  profileName?: string;
  metadata?: { extensionInstanceId?: string; codexSessionId?: string };
};

type BrowserTabInfo = {
  id: string;
  providerTabId?: string;
  title?: string;
  url?: string;
};

interface Browser {
  readonly browserId: string;
  documentation(): Promise<string>;
}

interface BrowserProvider {
  list(): Promise<Array<BrowserInfo>>;
  get(id: string): Promise<Browser>;
}

interface BrowserState extends BrowserInfo {
  tabs: Array<BrowserTabInfo>;
}

type TabInfo = {
  id: string;
  providerTabId?: string;
  browserId: string;
  title?: string;
  url?: string;
};

type State = {
  apps: Array<AppInfo>;
  browsers: Array<BrowserState>;
  errors?: string[]; // Inventory failures; the other inventory remains usable.
};

type Point = { x: number; y: number };

type Screenshot = {
  bytes: Uint8Array;
  data_url: string;
  filepath: string;
};

interface DragHandle {
  start(point: Point): Promise<void>;
  move_to(point: Point): Promise<void>;
  end(): Promise<void>;
}

interface Computer {
  target: "linux" | "mac" | "windows";
  drag_handle?(): DragHandle;
  get_screenshot?(): Promise<Array<Screenshot>>;
  move?(point: Point): Promise<void>;
}

type BrowserOptions = { browser?: string };
type GetBrowserOptions = { id?: string; url?: string };
type CreateBrowserTabOptions = { visible?: boolean; sessionName?: string };

interface Tab extends Target {
  readonly id: string;
  goto(url: string): Promise<void>;
  back(): Promise<void>;
  forward(): Promise<void>;
  reload(): Promise<void>;
  close(): Promise<void>;
  markDeliverable(): Promise<void>;
  markHandoff(): Promise<void>;
}

declare const cua: {
  initialize(): Promise<State>;
  getState(options?: ObservationOptions): Promise<State>;
  browsers: BrowserProvider;
  computer: Computer;

  getApp(app: string): Promise<App>;
  listApps(options?: ObservationOptions): Promise<Array<AppInfo>>;

  /** Select without opening a tab. Use the returned browserId with createBrowserTab. */
  getBrowser(options?: GetBrowserOptions): Promise<Browser>;
  /** Apply options before opening the tab; omitted settings stay unchanged, unsupported settings throw. */
  createBrowserTab(
    browserId: string,
    url?: string,
    options?: CreateBrowserTabOptions,
  ): Promise<Tab>;
  getTab(id: string, options?: BrowserOptions): Promise<Tab>;
  listBrowsers(options?: ObservationOptions): Promise<Array<BrowserInfo>>;
  listTabs(options?: BrowserOptions & ObservationOptions): Promise<Array<TabInfo>>;
};
```

`cua.getApp(...)` and `cua.listApps()` are available only on macOS. They throw on Linux.
`cua.browsers` and `cua.computer` expose additional browser and platform-specific computer APIs.

## Selecting a target

Use the app/browser inventory returned by `cua.initialize()` to select a target. If the target is unclear and you need a fresh inventory later, call `cua.getState()`; do not immediately repeat the inventory returned by initialization.

Known URL, unknown browser:

```javascript
let browser = await cua.getBrowser({ url });
```

Known URL and browser (specified by the user by name or already selected):

```javascript
let tab = await cua.createBrowserTab(browserId, url, options);
```

Use browser IDs from initialization or a previous selection. Browser-specific options:

- IAB: `visible: true` to show the browser; `false` to keep it hidden.
- Chrome/Edge: `sessionName: "🔎 Task"` — use a short, emoji-prefixed task name when starting a task.

Known tab and browser (`tabId` or `providerTabId`):

```javascript
let tab = await cua.getTab(tabId, { browser: browserId });
```

`getBrowser()` selects the default browser; `getBrowser({ id: browserId })` selects a specific browser, with `id` taking precedence over `url`.

All three entry points emit first-use browser documentation. On first use, make the chosen entry-point call in its own invocation and read the returned documentation and any initial state before continuing.

On macOS, if the user specifies an app, get it by name, bundle ID, or path:

```javascript
let app = await cua.getApp("Example App");
```

Read any returned documentation and initial UI state before continuing.

## Workflow

After performing one or more UI actions, call `getAXState()` before deciding what to do next. This keeps you in the current UI state and forces you to re-derive fresh element indices from the latest accessibility text instead of reusing stale ones.
For token efficiency, when appropriate, the accessibility tree will be returned as a diff from the most previous accessibility tree, listing only the elements that were removed, added, or changed. Prefer this default diff output; pass `{ disableDiffing: true }` only when you need a fresh full accessibility tree. After a screenshot-only observation, request a full tree before relying on accessibility indexes again.
Minimize model and tool round trips while retaining fresh UI state:

- Batch deterministic actions and the resulting `getAXState()` into one call. You may interact with the UI and return the updated state in that same call, so this does not require a separate tool call.
- Calling `cua.getApp(...)`, `cua.getTab(...)`, and `cua.createBrowserTab(...)` returns app or tab bindings and automatically displays the latest AX state after they run.
- If a standalone `getAXState()` reports no accessibility-tree change, do not immediately repeat it without an intervening action. Use `getScreenshot()`, `getAXStateAndScreenshot()`, or `{ disableDiffing: true }` only when you can identify missing context that representation should provide.
- Prefer a directly relevant result already visible in the current state over opening broader intermediate UI such as “Show All.”
- Once the requested result is visibly present, stop exploring and respond.
  Perform one or more actions, and then fetch the latest state:

```typescript
await target.click(42);
await target.setValue(42, "openai.com");
await target.pressKey("Return");
await target.typeText("hello");
await target.scroll(42, "down", 1);
await target.scroll([640, 480], "down", 1);
await target.selectText(42, "hello");
await target.performSecondaryAction(42, "Expand");
await target.getAXState();
```

## Output

- For text output, use `nodeRepl.write(...)`. The API accepts strings and other values. Use `JSON.stringify(...)` when you want JSON.
- For image output, use `nodeRepl.emitImage(...)`. The API accepts data or file URLs, PNG/JPEG/WebP bytes, or `{ bytes, mimeType }`.
- The following APIs output their result internally, calling `nodeRepl.write(...)` and/or `nodeRepl.emitImage(...)` will duplicate the output: `getAXState()`, `getScreenshot()`, `getAXStateAndScreenshot()`, `cua.initialize()`, `cua.getState()`, `cua.getApp(...)`, `cua.getTab(...)`, `cua.createBrowserTab(...)`, `cua.listApps()`, `cua.listBrowsers()`, and `cua.listTabs()`. Pass `{ emit: false }` to observation and discovery methods to disable their result output. First-use documentation is still displayed. `cua.getBrowser()` automatically displays its first-use documentation; do not write the returned browser object or reread its documentation.

## Notes

- For efficiency, prefer element index based actions over coordinate actions whenever an accessibility element is available. If AX actions are not available or not working, fall back to using screenshots and coordinate actions. You can also get a screenshot if you need visual context.
- Native app `paste` uses the system pasteboard then restores the user's previous clipboard contents. Browser `paste` does not restore clipboard contents, and its `md` format inserts Markdown source as plain text. Specify `text`, `md`, or `html` explicitly. Prefer `paste` for formatted content and multiline text.
- If the UI is not behaving as expected, try fetching the latest `getAXState()` to make sure you have the latest context.
- `performSecondaryAction()` is for invoking an accessibility action that an element exposes besides a normal click, such as expanding a disclosure row, showing a menu, incrementing a control, or cancelling something. It requires an action actually exposed for that element in the accessibility text. Do not guess action names.
- `selectText()` selects matching text in an editable element. Use `prefix` and `suffix` to disambiguate repeated matches, and `selectionType` to choose whether to select the text itself or place the cursor before or after it.
- `pressKey()` presses a key or key combination, including modifier and navigation keys. It supports xdotool-style key syntax. Examples: `"a"`, `"Return"`, `"Tab"`, `"super+c"`, `"Up"`, and `"KP_0"` for numpad `0`.
- No need to open or launch apps; Apps transparently launches the app in the background if they are not already running.
- The `cua.getApp(...)` parameter may be either an app's display name, full app path, or bundle identifier.
- If `cua.getApp(...)` fails to resolve an app by display name, immediately retry `cua.getApp(...)` with that app's bundle identifier from `cua.listApps()` before pursuing other debugging paths.
- `getAXState()`, `getScreenshot()` and `getAXStateAndScreenshot()` automatically wait an appropriate amount of time before capturing new state. In order to complete the task as quickly as possible, don’t pause or delay (ex: `setTimeout(...)`) before getting UI state. Instead, rely on the internal wait.

Persist until the request is fully completed end-to-end. Attempting an action is not completion: verify that the returned UI state visibly shows the requested result. If an action leaves the state unchanged, produces no results, or only reaches an intermediate page, try another approach. Respond only after the requested page, information, or state is visibly present, or explain a concrete blocker you cannot resolve.
