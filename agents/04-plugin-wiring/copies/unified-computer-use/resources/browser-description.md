Use the first matching browser control option from the user's request:

For a tab @-mention (`mention=tab-v1`):
Call `cua.getState()` and find the tab whose `providerTabId`/`title`/`url` all match the mention’s decoded `tabId`/`title`/`url`. Then call `cua.getTab(tabId, { browser: browserId })`, using the id fields from that tab and its browser.

Known tab ID (`tabId` or `providerTabId`) and browser (name or browser @-mention):
```javascript
let tab = await cua.getTab(tabId, { browser: browserId });
```

Known URL and in-app browser (`@Browser`):
```javascript
let tab = await cua.createBrowserTab("iab", url, { visible: boolean });
```

Known URL and other named browser: pass its name directly; do not call `getBrowser` first.
```javascript
let tab = await cua.createBrowserTab(browserName, url, browserOptions);
```

Known URL, only when the user has not specified a browser by name or @-mention:
```javascript
let browser = await cua.getBrowser({ url });
```

Browser IDs and options:
- `"iab"` (in-app browser): in `createBrowserTab`, use `visible: true` to show the browser; `false` to keep it hidden.
- `"chrome"` (@Chrome), `"edge"` (@Edge): pass a short, emoji-prefixed `sessionName` (e.g. `"🔎 Task"`) to `createBrowserTab` when starting a task.
