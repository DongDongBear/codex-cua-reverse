# native-pipe 启动链（JS 源码）

出处：`vendor/sky/js/native-pipe.js`（与 app 内 `targets/mac/native-pipe.js` 相同）。

`MacNativePipeTransport.create()`：

1. 必须有 `globalThis.nodeRepl.nativePipe.createConnection`。没有 → `Sky Computer Use native pipe is unavailable`（旁路 **untrusted** `js` 侧没有这个对象；trusted-worker 才有）。
2. 路径：`SKY_CUA_SERVICE_NATIVE_PIPE_PATH`，否则  
   `~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock`
3. `connect` + `ping`（版本 `CodexComputerUseIPC-5`）。第一次只等 **250ms**。
4. 连不上（类型 `q` / unavailable）：
   - 若有 `NODE_REPL_HOST_SERVICES_PIPE_PATH`：同一套长度前缀 JSON-RPC，`method: "ensureService"`, `params: { service: "computer-use" }`，超时 5s
   - 否则必须有 `nodeRepl.launchServices.openApplication`：  
     `SKY_CUA_SERVICE_PATH` → 否则 `CODEX_HOME/computer-use/Codex Computer Use.app` → 否则 bundle `com.openai.sky.CUAService`
   - launch/ensure 失败 → `Sky Computer Use service startup request failed`
5. 再 `connect` **5s**。仍失败 → **`Sky Computer Use native pipe startup failed`**

旁路调试看到的就是第 5 步：sock 在、trusted `rpc("sky")` 能 `setup`，但 `createConnection` 连上后 `ping` 被踢（和未认证 Node 一样），没有 HOST_SERVICES pipe。

帧：uint32le + UTF-8 JSON-RPC，最大 8MiB。方法 `ping` / `request`。
