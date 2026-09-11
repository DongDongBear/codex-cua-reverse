用 Computer Use（cua_repl / js）做全量回归。不要问确认，不要用 exec / osascript。每一步单独一次 js 调用；失败就 nodeRepl.write 错误信息然后继续下一步。timeout_ms 用 60000。

按这个顺序：

1. `await cua.listApps()`，write 前 20 个 {id,displayName,isRunning}

2. `let app = await cua.getApp("Finder")`，write AX 前 40 行（getAXState emit false disableDiffing true）

3. 在 AX 文本里找 `Secondary Actions: Raise` 的节点 index；找到就 `performSecondaryAction(index, "Raise")`。找不到就 write "NO_RAISE" 并 `performSecondaryAction` 菜单栏 Window 或 click 一个带 Raise 的窗口。没有窗口就 skip。

4. 桌面图标：对带 `Secondary Actions: open` 的一个 image（不要选随机重要文档；优先名字含 Desktop 或随便一个 image）执行 `performSecondaryAction(index, "open")` 或 `click(index)`。

5. `await app.getScreenshot()`（会出图，正常）

6. `await app.getAXStateAndScreenshot()`

7. `pressKey("super+down")` 或 `pressKey("Down")` 一次（Finder）

8. `scroll(0, "down", 1)` 一次；失败 write 错误

9. `drag([100,200],[120,220])` 一次；失败 write 错误

10. 若有 settable 文本框 index：`setValue(i, "cua-regression")`；否则 skip

11. `typeText("cua")` 一次

12. `paste("hello-cua-regression", {format:"text"})`

13. `selectText` 若有文本节点则试，失败 skip

14. 浏览器：`const b = await cua.getBrowser(); const tabs = await cua.listTabs({browser:b.browserId});` write browserId 和 tabs

15. `await cua.createBrowserTab(b.browserId || "iab", "https://example.com", {visible:true})`

16. 对该 tab：`getAXState`、`click` 一个链接或正文、`typeText` 不必填表

17. `tab.playwright.locator("h1").evaluate(el => el.textContent)`（只读）

18. `tab.goto("https://example.org")` 然后 `back()`

19. `cua.listBrowsers()` / `cua.getState()` 若存在就调

每步 title 写成 `reg N ...`。全部做完用一句话总结哪些 ok / fail。
