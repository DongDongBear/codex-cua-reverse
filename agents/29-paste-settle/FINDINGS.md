# FINDINGS — native paste formats (`text`/`md`/`html`) and UI settle timings

Date: 2026-09-11. Local disk only. **Did not live-paste into user apps.**

These two gaps were still listed as extractable-but-unanswered:

| Gap | Previous status |
|---|---|
| Native `format:'md'` — rendered rich text vs Markdown source | UNANSWERED (`agents/17-questions-resolved` #01-11; `UNREVERSED.md`) |
| Exact settle timings (`needsUISettleBeforeSkyshot`, `lockUISettleDelay`, `lockUIFallbackDelay`, plugin “~1 s + up to 5 s”) | UNANSWERED (`agents/17` #02-10) |

---

## Verdict

| Gap | Fact |
|---|---|
| **Native paste formats** | JS and IPC use the same three raw values: **`text` \| `md` \| `html`**. There is no native case named `markdown`. `md` is **rendered** onto the system pasteboard as rich types (HTML / RTF / RTFD / WebArchive / `NSAttributedString`) via SlimCore `MarkdownRichTextProvider` + cmark-gfm, then lazily served through `NSPasteboardItemDataProvider`. Markdown **source** is also offered as UTI `net.daringfireball.markdown`. Apps that prefer HTML/RTF therefore paste formatted text, not backticks. Browser `Tab.paste({format:'md'})` is the opposite: `text/plain` source + `Ctrl+v`. |
| **UI settle** | Three clocks were previously conflated. (1) **Mac post-action settle** is native `ApplicationUIElement.waitForUIToSettle(delay: Double?, notificationDelay: Double, includingScrollEvents: Bool)`. ARM immediates inside that function: **0.25 s** and **5.0 s** (the 5.0 appears on three async resume points). Plugin copy “about 1 second + up to 5 seconds on a loading indicator” is **not** a C string in the service; `AXProgressIndicator` is. `needsUISettleBeforeSkyshot` is a **Bool**, default **false**, not a millisecond field. (2) **`lockUISettleDelay` / `lockUIFallbackDelay` are `Swift.Duration` on the lock-screen monitor** — a different path. Values are not C strings. (3) **Linux** `ActionSettler` default **100 ms** lives in JS and is not used on this Mac. Mac `@oai/sky` wrappers do not `sleep`. |

Remaining (compiled, not a C string): the exact `delay:` Optional passed into `waitForUIToSettle` (plugin “~1 s” is still the only prose); which pasteboard type a given app actually consumes; the numeric `Duration` pair for lock-screen settle.

---

## 1. Native paste formats `text` / `md` / `html`

### 1.1 JS contract — format is forwarded, never remapped

Public sky (`Paste.d.ts`):

```ts
format: "text" | "md" | "html";  // required
// text: "Plain text, HTML, or Markdown content to insert into the current focus."
```

Files:

- `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/sky/dist/project/cua/sky_js/src/types/window/Paste.d.ts`
- wrapper `/…/targets/mac/paste.js` — policy then `client.paste({app, text, format})` with **no default and no rewrite**
- tinysky `PasteOptions.format?` defaults to **`"text"`** in `create_tinysky_alt`

`paste.js` (entire implementation):

```js
yield e.paste({ app: t.app, text: t.text, format: t.format })
```

`mac-client.js`:

```js
paste(e, t={}) {
  return this.performAction(e.app, { paste: { text: e.text, format: e.format } }, t)
}
```

Wire (undefined fields stripped):

```json
{
  "requestType": "ComputerUseIPCAppPerformActionRequest",
  "request": { "app": "…", "action": { "paste": { "text": "…", "format": "md" } } }
}
```

Traces (`task-2-linear-issue`) only sent `{format:'text'}`. No `md`/`html` sample on the wire.

### 1.2 Native enum is the same three strings, not `markdown`

`ComputerUseClient.ComputerUseIPCPasteFormat` is `String` / `RawRepresentable` / `Codable`.

Coding-key blob in `SkyComputerUseService` at `0x114fbb5`:

```
paste
text
md
html
```

A second interned table at `0x10c3ecb` is `md` then `html` (next to `cursor_before` / `cursor_after`).

ARM64 `rawValue` getter (`0x100ce51d8`) builds Swift small-strings:

| Immediate | ASCII |
|---|---|
| `movz w, #0x646d` | `md` |
| `movz`+`movk` `0x6c6d7468` | `html` |
| `movz`+`movk` `0x74786574` | `text` |

JS `"md"` is therefore the native raw value. There is **no** IPC case `markdown`. The word `markdown` in the binary is SlimCore’s **representation** name (see 1.4), plus AX-tree markdown rendering (`AXAttributedStringMarkdownWriter`, `flattenLinksIntoMarkdownText`) — those write accessibility text, not the pasteboard.

Entry point:

```
ComputerUse.ComputerUseAppController.performPaste(
  text: String,
  format: ComputerUseIPCPasteFormat,
  returnSkyshot: Bool
) async throws -> SkyshotCapture?
```

### 1.3 Pasteboard mechanism

Types / ObjC in `SkyComputerUseService`:

| Symbol | Role |
|---|---|
| `ComputerUse.PasteOperation` | paste action |
| `PasteOperation.PasteboardDataProvider` | `NSPasteboardItemDataProvider` |
| `pasteboard:item:provideDataForType:` | lazy type fill |
| `pasteboardFinishedWithDataProvider:` | done |
| `SlimCore.RichText.WebViewPasteboardProvider.copy(to: NSPasteboard)` | WebKit HTML/WebArchive write |
| `WebViewPasteboardProvider.operationCompletion(for: NSPasteboard) async -> Bool` | wait until the target app reads |
| `generalPasteboard` / `pasteboardWithUniqueName` / `writeObjects:` | AppKit pasteboard |

Human errors (C strings):

- `Could not write generated content to the clipboard` → `pasteboardWriteFailed`
- `Timed out waiting for the application to read the clipboard` → `pasteboardReadTimedOut`
- `The user may have conflicted with your paste operation. …` → `pasteboardChangedDuringPaste`

“**generated** content” is the conversion output, not the original JS string copied byte-for-byte (except for `format:'text'`).

Plugin / tinysky docs: native paste **restores** the previous clipboard. Browser paste does not.

### 1.4 SlimCore conversion graph — this is the renderer

`MarkdownRichTextProvider` (`_TtC8SlimCore24MarkdownRichTextProvider`):

```
SlimCore.MarkdownRichTextProvider.richText : NSAttributedString
updateRichText(from: Source) -> Bool
```

Parser is **cmark-gfm** (tables, strikethrough, task lists, footnotes) plus `cmark_html_renderer`.

`SlimCore.RichText.RepresentationFormat` AllCases (cstring block at `0x1152a52`):

```
markdown
document
plainText
rtf
flatRTFD
htmlString
webArchive
attributedString
```

Named conversions (all present as types):

| Conversion | Meaning |
|---|---|
| `MarkdownToAttributedStringConversion` | md → `NSAttributedString` |
| `MarkdownDocumentToAttributedStringConversion` | parsed doc → attributed |
| `MarkdownToHTMLStringConversion` | md → HTML |
| `MarkdownDocumentToHTMLStringConversion` | parsed doc → HTML |
| `MarkdownDocumentToMarkdownStringConversion` | doc → md source |
| `HTMLStringToAttributedStringConversion` | html → attributed (WebKit `loadHTMLString:baseURL:`) |
| `AttributedStringToRTFConversion` | attributed → RTF |
| `AttributedStringToRTFDConversion` | attributed → RTFD |
| `AttributedStringToWebArchiveConversion` | attributed → WebArchive |
| `WebKitConversion` / `WebViewPasteboardProvider` | HTML/WebArchive via WebKit |

`RichTextConverter.convert(_:to: RepresentationFormat)` is async. `inputTypeToPossibleConversions` is a graph: one input representation can emit several pasteboard types.

### 1.5 NSPasteboard / UTI surface

`public.html`, `public.utf8-plain-text`, `public.rtf` are **not** C strings in the service. They come from AppKit imported constants:

```
_NSPasteboardTypeHTML      → public.html
_NSPasteboardTypeRTF       → public.rtf
_NSPasteboardTypeString    → public.utf8-plain-text
_NSPasteboardTypeFileURL
_NSWebArchiveTextDocumentType
```

SlimCore extensions on `NSPasteboardType`:

```
legacyString
legacyRTF
legacyRTFD
flatRTFD
webArchive
```

Also linked:

- `UTType.pasteboardType` (SlimCore) — `UTType` → `NSPasteboardType`
- `UTType.webArchive`, `UTType.flatRTFD`
- **`net.daringfireball.markdown`** (C string at `0x10d29a0`) — Markdown source UTI
- `application/x-webarchive`
- `NSRTFDPboardType` / `NSStringPboardType` (legacy)

`NSPasteboardItemDataProvider` means types are declared up front and **materialized when the destination app requests a type**. An HTML-capable editor therefore gets `MarkdownToHTMLString` / attributed→HTML, not the original `## heading` source.

### 1.6 So is `format:'md'` rendered?

**Yes, on the native path.** Evidence chain:

1. IPC value is `md` (same as JS).
2. SlimCore treats `markdown` as a `RepresentationFormat` that converts **to** `htmlString` / `rtf` / `flatRTFD` / `webArchive` / `attributedString`.
3. `MarkdownRichTextProvider.richText` is `NSAttributedString` — that is a render.
4. cmark-gfm HTML renderer is linked.
5. Pasteboard provider implements `provideDataForType:` (lazy rich types).
6. Error copy says “generated content”.
7. Native docs say “prefer `paste` for **formatted** content”; they never say “md inserts source as plain text”.

**Browser `Tab.paste` is not this path.** `create_tinysky_alt.pretty.js`:

```js
const entries = format === "html"
  ? [{ mimeType: "text/html", text }, { mimeType: "text/plain", text }]
  : [{ mimeType: "text/plain", text }]; // md → text/plain source
await tab.clipboard.write([{ entries }]);
await tab.ax.pressKey("Ctrl+v");
```

tinysky-alt-core-cua-repl.md: “Browser `paste` does not restore clipboard contents, and its `md` format inserts Markdown source as plain text.” That sentence is **browser-only**.

What is still not a C string: the exact payload on `NSPasteboardTypeString` for `md` (rendered plaintext vs Markdown source). Rich types (HTML/RTF/WebArchive) are rendered either way. Live paste into Notes/TextEdit was not run.

### 1.7 `html` and `text`

| JS `format` | Native | Pasteboard |
|---|---|---|
| `text` | `text` | plain string (`NSPasteboardTypeString` / legacy string). No markdown parser. |
| `html` | `html` | `HTMLStringToAttributedStringConversion` + `NSPasteboardTypeHTML` (+ likely a plain-text fallback, same idea as browser `text/html`+`text/plain`). |
| `md` | `md` | markdown UTI + generated HTML/RTF/WebArchive/attributed (above). |

---

## 2. UI settle — three clocks, not one

Previous writeups cited `needsUISettleBeforeSkyshot`, `lockUISettleDelay`, and `lockUIFallbackDelay` as the home of the plugin’s “~1 s + up to 5 s”. They are **not** the same timer.

### 2.1 Plugin / tinysky copy (the 1 s + 5 s sentence)

Only in skill markdown, **not** in `SkyComputerUseService` C strings (`"1 second"`, `"5 second"`, `"about 1"`, `"loading indicator"` counts are 0 in the service):

`vendor/plugins/computer-use/computer-use-node-repl.md` (and installed `SKILL.installed-node-repl.md`):

> The runtime will automatically wait an appropriate amount of time before capturing the new state if an action was recently performed. (It waits about **1 second**, with additional delays of **up to 5 seconds** if the app has a loading indicator or other signs of state changes.)

tinysky-alt-core-cua-repl.md is vaguer: “automatically wait an appropriate amount of time … don’t `setTimeout`”.

That copy describes **Mac native GetSkyshot / post-action settle**, implemented in Swift, not in JS.

### 2.2 Mac post-action settle (the plugin clock)

**JS does not sleep.** `get_app_state.js` is policy → `getAppState` → `window_result`. `click.js` / `paste.js` / `type_text.js` have no `setTimeout`. Linux-only `ActionSettler` is not constructed on darwin.

Native:

```
AccessibilitySupport.ApplicationUIElement.waitForUIToSettle(
  delay: Double?,                 // Optional TimeInterval
  notificationDelay: Double,      // TimeInterval, required
  includingScrollEvents: Bool
) async throws -> TransformedUIElement.TreeCache?
```

Gated by AppController:

```
ComputerUseAppController.needsUISettleBeforeSkyshot : Bool
```

Field initializer at `0x1000181d8`:

```
mov w0, #0
ret
```

Default **false**. It is a flag (“do we wait before the next skyshot?”), not a duration. Nearby ivars: `_isActive`, `_lastWindow`, `_currentlyOpenedMenu`.

Keyboard path can opt out:

```
AppController.performKeyboardAction(
  _: KeyboardAction,
  text: String?,
  duration: Int?,
  waitForUIToSettle: Bool,    // explicit
  returnSkyshot: Bool
) async throws -> SkyshotCapture?
```

Skyshot capture after settle:

```
AppController.updateSkyshot(
  treeCache: TreeCache?,
  disableAXDiffing: Bool,
  skipScreenshot: Bool
) async throws -> SkyshotCapture
```

**Numeric immediates inside `waitForUIToSettle` (`0x1006f1f48`):**

| VA | Instruction | Value |
|---|---|---|
| `0x1006f2068` | `FMOV D1, #0.25` | 0.25 s |
| `0x1006f267c` | `FMOV D1, #5.0` | 5.0 s |
| `0x1006f2e64` | `FMOV D1, #5.0` | same (async resume) |
| `0x1006f35dc` | `FMOV D1, #5.0` | same (async resume) |

5.0 is **not** stored as a C string and **not** as IEEE `5.0` in `__const` (that bit pattern is absent from `__TEXT.__const`). It is an ARM `FMOV` immediate (`imm8=0x14` → `0x4014000000000000`). Three copies is the Swift async state machine, not three different caps.

`FMOV #0.25` also appears ~19 times in AppController action code between `0x1000720dc` and `0x10007d924` (including a site in the `performPaste` async body). That matches the non-optional `notificationDelay: Double` argument: a **250 ms** AX-notification quiet window.

Loading-indicator support: role string **`AXProgressIndicator`** (with `AXLevelIndicator` / `AXRelevanceIndicator`) in AccessibilitySupport. No “loading indicator” English sentence in the binary; the plugin supplies that gloss.

**The “about 1 second” base wait is still not a unique immediate.** `FMOV #1.0` occurs 269 times in `__text` (cursor motion, layout, etc.). ASCII `"1000"` in the binary is Messages SQL (`/ 1000000000`) and an oslog hash, not settle. IEEE `1000.0` / `5000.0` in `__const` sit next to `86400000.0` (ms/day) and color/layout tables — xrefs are not `waitForUIToSettle`. So:

| Number | Where it *is* | Role in settle |
|---|---|---|
| **5.0 s** | `waitForUIToSettle` FMOV ×3 | matches plugin “up to 5 seconds” |
| **0.25 s** | `waitForUIToSettle` + AppController actions | `notificationDelay` / poll quantum |
| **~1 s** | plugin markdown only | likely `delay:` Optional or a multiple of 0.25; not a unique C string / FMOV we can pin |

### 2.3 Lock-screen settle — `lockUISettleDelay` / `lockUIFallbackDelay`

These are **not** the plugin 1 s / 5 s clock.

`ComputerUse/SystemLockScreenMonitor.swift` (path string in the service):

```
SystemLockScreenMonitor.init(
  lockUISettleDelay: Duration,
  lockUIFallbackDelay: Duration
)
```

`SystemLockScreenSettleObservation` (private type `_90576DB4181ED9777FFF93EBE973C311`):

```
fallbackDelay
onSettled
fallbackTask
completionTask
hasObservedLockUI
hasCompleted
isCancelled
```

Darwin notifications next to it: `com.apple.screenLockUIIsShown`, `com.apple.screenIsLocked`, `com.apple.screenIsUnlocked` (and `sessionagent.*` variants).

Same field names exist in **CUALockScreenGuardian**. Related but separate: `relockOverlaySettleObservation` on `LockScreenGuardianCoordinator`; `pollInterval` / `submitDelay` / `verificationDelay` on `SystemLockScreenController` (login typing, not skyshot).

`Swift.Duration.seconds(Double) -> Duration` is linked. The actual `Duration` pair is **not** a C string (`"5000"` count in the service is 0). FMOV values in the lock-screen address range (`0x100219xxx`) are 0.5 / 12 / 14 / 15 / 18 / 19 — overlay layout, not this initializer.

Do not use `lockUISettleDelay` as the explanation for “wait ~1 s after click before `getAXState`”.

### 2.4 Other timers that are not Mac UI settle

**Linux JS `ActionSettler`** (`targets/linux/action_settler.js`), used only by `create_client` when `target:"linux"`:

```js
const i = Math.max(0, options.post_action_sleep_ms ?? 100);
// defer() sets deadline = now + i
// wait() sleeps until that deadline
```

Types: “Minimum milliseconds before the next action, screenshot, or audio operation after successful input. Set 0 to disable. **(default: 100)**”. Every linux click/drag/type calls `wait()` then `defer()`. **Not on this Mac.**

**Mac native-pipe timeouts** (`native-pipe.js`): `U = 5e3` is host `ensureService` / connect timeout; ping budget `min(1000, remaining)`; retry `sleep(100)`. Request timeout is `1000 * timeoutSeconds` (client default **120 s**). Transport, not UI.

**Unrelated “settle” strings:** `scootPositionSettleVelocity` (virtual cursor spring), `onSourceResizeSettled` (PIP), `userInteractionDebounceDuration` (on `ComputerUseAppInstanceManager`, interruption debounce), Swift `AsyncDebounceSequence`.

### 2.5 How GetSkyshot actually waits

```
sky.get_app_state
  → ComputerUseIPCAppGetSkyshotRequest
  → AppController
       if needsUISettleBeforeSkyshot:
            waitForUIToSettle(delay: ~plugin 1s?,
                              notificationDelay: 0.25,
                              includingScrollEvents: …)
            // extra wait up to 5.0 s while AX still changing
            // / AXProgressIndicator / similar
       updateSkyshot(...)
```

JS must not add its own `setTimeout` (plugin + tinysky docs). The 5 s cap is native. The 1 s base is documented for the model and is not a recoverable C string.

---

## 3. Catalog / QUESTIONS updates

| Item | Old | Now |
|---|---|---|
| 01-cua-tinysky #11 md paste | UNANSWERED | **Native `md` is rendered** to HTML/RTF/WebArchive/`NSAttributedString`; IPC raw value is `md`; source UTI `net.daringfireball.markdown` also offered. Browser `md` remains plain-text source. Live app-level check not run. |
| 02-sky-native #10 settle | UNANSWERED “values not in JS or as plain strings” | **Partially answered.** 5.0 s and 0.25 s are ARM immediates in `waitForUIToSettle`. Plugin 1 s is still not a unique constant. `needsUISettleBeforeSkyshot` is Bool default false. `lockUI*` is lock-screen `Duration`, not this clock. Linux JS default is 100 ms. |
| `UNREVERSED.md` “format md 倾向渲染” | tendency | Upgrade: conversion graph + `NSAttributedString` + pasteboard provider. Residual: `NSPasteboardTypeString` payload for `md`. |
| `UNREVERSED.md` “settle 毫秒” | field names only | 5.0 s cap + 0.25 s notificationDelay extracted from code immediates; 1 s base still plugin prose. |

---

## Sources

| Item | Path |
|---|---|
| JS paste wrapper | `/Applications/ChatGPT.app/Contents/Resources/cua_node/lib/node_modules/@oai/sky/dist/project/cua/sky_js/src/targets/mac/paste.js` |
| JS IPC client | `…/targets/mac/client.js` (`vendor/sky/js/mac-client.js`) |
| Paste types | `…/types/window/Paste.d.ts` |
| Tinysky App + Tab paste | `agents/01-cua-tinysky/copies/oai_js_cua/tinysky_alt/create_tinysky_alt.pretty.js` |
| Linux settler | `…/targets/linux/action_settler.js` (default 100) |
| Plugin 1 s / 5 s sentence | `vendor/plugins/computer-use/computer-use-node-repl.md` line 115 |
| Native service (byte-identical home copy) | `~/.codex/computer-use/Codex Computer Use.app/Contents/MacOS/SkyComputerUseService` SHA-256 `905939bff849b072da68e8e23e97188ed7bf93173646ac1bd9f7b54f9a89ce35` |
| Guardian (same lockUI field names) | `…/SharedSupport/CUALockScreenGuardian.app/Contents/MacOS/CUALockScreenGuardian` |
