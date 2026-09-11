# CUA live verification — goal / loop

**Goal:** every API observed in the captured desktop `js` traces is proven against the live local CUA stack, using the reconstructed protocol (not guesses).

**Live stack (this machine, already running):**

- `ChatGPT.app` + `cua_node/bin/node_repl`
- `unified-computer-use` `launch.mjs`
- `SkyComputerUseService` (`com.openai.sky.CUAService`)
- Unix socket `~/Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock`

## Safety (hard)

- Do **not** replay Linear `click` / `typeText` / `setValue` / `paste` / `pressKey` (would mutate the user's issue).
- Do **not** dump tokens, cookies, or full screenshots to disk (truncate AX text; drop image bytes).
- Native observation only: `ping`, `list_apps`, `get_app_state` on **Finder** (and Linear only if already running, read-only).
- Browser: inventory / bind only (`getBrowser`, `listTabs`, `listBrowsers`). No form fill.

## Loop

Each round writes `verify/rounds/round-N.json`.

1. **Static contract** — trace APIs ⊆ tinysky / sky / browser-desktop types.
2. **Native transport** — reconstructed length-prefixed JSON-RPC `ping` (`CodexComputerUseIPC-5`).
3. **Native inventory** — `ComputerUseIPCListAppsRequest`.
4. **Native observation** — `ComputerUseIPCAppGetSkyshotRequest` for Finder (this is `cua.getApp` + `getAXState` / `getScreenshot` / `getAXStateAndScreenshot`).
5. **JS wrapper** — `@oai/sky` `MacComputerUseClient` with a `nodeRepl.nativePipe` shim.
6. **Official client** — `SkyComputerUseClient mcp` `tools/list` + a read tool.
7. **Browser surface** — `@oai/browser-desktop` or live `NODE_REPL_TRUSTED_SERVICES`.
8. **Adversarial** — wrong API version must yield `incompatibleClientVersion` (`-10013`) or a clean transport error; proves we are on the real protocol.

Stop when every **required** check is `pass`. Mutating APIs from traces are `shape_ok` (types + IPC request type present) unless a disposable surface exists.

## Required vs shape-only

| Trace API | Live proof |
|---|---|
| `cua.getApp` / `cua.listApps` | list_apps + get_app_state |
| `app.getAXState` / `getScreenshot` / `getAXStateAndScreenshot` | GetSkyshot |
| `app.click` / `typeText` / `setValue` / `paste` / `pressKey` / `performSecondaryAction` | IPC `ComputerUseIPCAppPerformActionRequest` exists + JS wrapper encodes the same action keys as traces |
| `cua.getBrowser` / `listTabs` / `getTab` | live browser inventory if IAB/extension is up |
| `tab.click` / `typeText` / `getAXState` / `playwright` / `dev.logs` | browser-desktop api.json + traces; live bind only |
| `nodeRepl.write` | node_repl strings + plugin wiring |
| unnamed `js?` duplicates | kept in traces; not executable (empty args) |
