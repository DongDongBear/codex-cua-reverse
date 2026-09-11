继续用 cua_repl js，不要问确认。打开本地测试页（IAB visible）：

http://127.0.0.1:8765/

每步单独一次 js，失败 write 错误后继续，timeout_ms 60000。

1. getBrowser + listTabs
2. createBrowserTab(browserId 或 "iab", "http://127.0.0.1:8765/", {visible:true})
3. tab.getAXState（write 前 40 行）
4. playwright locator('#name').fill('cua-lab')
5. locator('#bio').fill('hello bio')
6. locator('#btn-ok').click 或 tab.click 对应 AX index
7. locator('h1').evaluate(el => el.textContent) 只读
8. locator('#more').click 然后 back()
9. goto 同一 url，scroll 页面
10. 若有 dialog：getJsDialog / handle
11. write 最后 AX 前 20 行和 url()

不要去点 Finder。只打这个本地页。
