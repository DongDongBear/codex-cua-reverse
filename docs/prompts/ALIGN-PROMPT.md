用 cua_repl js 按逆向结论反向调试。不要问确认，不要 exec。每步单独一次 js，timeout_ms 60000，失败 write 错误后继续。

已知坑（不要再踩）：
- Finder 桌面 0 是 disabled scroll area，没有 Raise；scroll/drag 坐标打桌面会 noWindowsAvailable
- paste 在没人接剪贴板的桌面会超时
- goto 之后必须重新 getAXState 再 scroll，否则 detached
- 弹窗必须先点 Alert 才会有 getJsDialog

按这个做（要动界面）：

A. 文本 App
1. cua.getApp("TextEdit") 或 "备忘录" / "Notes"；getAXState 前 30 行
2. 对 settable 文本框 setValue 或 typeText 写入 "CUA-ALIGN-OK"
3. paste("align-paste", {format:"text"})
4. getScreenshot（应不是白图）

B. Finder 内容窗口（不要只打 Desktop 图标层）
5. getApp("Finder")；若只有 Desktop，click 或 open 打开文件夹「codex-cua-reverse」或任意文件夹窗口
6. 重新 getAXState；对带 Raise 的窗口节点 performSecondaryAction Raise；没有就 click Window 菜单
7. 在有 AXScrollArea 且非 disabled 的节点 scroll down 1

C. 本地 IAB http://127.0.0.1:8765/
8. getBrowser + createBrowserTab(id, "http://127.0.0.1:8765/", {visible:true})
9. playwright #name fill CUA-ALIGN；#bio fill reverse-debug；#btn-ok click
10. locator('#btn-alert').click() 然后 getJsDialog（有就 dismiss）
11. 重新 getAXState 再对 AXWebArea scroll down 1
12. url() write 最终地址

做完用条目列出每步 ok/fail 和屏幕上实际发生了什么。
