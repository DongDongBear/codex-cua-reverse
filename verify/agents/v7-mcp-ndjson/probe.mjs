#!/usr/bin/env node
/**
 * Live-verify SkyComputerUseClient MCP over newline-delimited JSON-RPC.
 * Read-only: initialize, tools/list, list_apps, get_app_state(Finder).
 * Never click / type / paste / setValue / pressKey. Never write screenshot bytes.
 */
import { spawn, spawnSync, execFileSync } from "node:child_process";
import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.join(
  os.homedir(),
  ".codex/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient",
);
const CUA_NODE = "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node";
const NODE_REPL = "/Applications/ChatGPT.app/Contents/Resources/cua_node/bin/node_repl";
const SOCK =
  process.env.SKY_CUA_SERVICE_NATIVE_PIPE_PATH ||
  path.join(
    os.homedir(),
    "Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock",
  );
const API = "CodexComputerUseIPC-5";
const MAX_FRAME = 8 * 1024 * 1024;
const BLOCKED = /^(click|type_text|press_key|set_value|select_text|scroll|drag|paste|perform_secondary_action)$/;

function encodeFrame(obj) {
  const body = Buffer.from(JSON.stringify(obj), "utf8");
  const buf = Buffer.alloc(4 + body.length);
  buf.writeUInt32LE(body.length, 0);
  body.copy(buf, 4);
  return buf;
}

function codesignSummary(p) {
  if (!fs.existsSync(p)) return { path: p, exists: false };
  const r = spawnSync("codesign", ["-dv", "--verbose=4", p], { encoding: "utf8" });
  const raw = `${r.stdout || ""}${r.stderr || ""}`;
  const grab = (re) => {
    const m = raw.match(re);
    return m ? m[1] : null;
  };
  return {
    path: p,
    exists: true,
    identifier: grab(/^Identifier=(.+)$/m),
    team: grab(/^TeamIdentifier=(.+)$/m),
    authority: [...raw.matchAll(/^Authority=(.+)$/gm)].map((m) => m[1]),
    format: grab(/^Format=(.+)$/m),
    runtime: grab(/^Runtime Version=(.+)$/m),
    timestamp: grab(/^Timestamp=(.+)$/m),
  };
}

function lsofPreview(pid, n = 80) {
  try {
    const out = execFileSync("lsof", ["-nP", "-p", String(pid)], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return out
      .split("\n")
      .filter((line) => /unix|computeruse|CUAService|IPCXPC|sock/i.test(line))
      .slice(0, n);
  } catch (err) {
    return [`lsof failed: ${err.message}`];
  }
}

function psLine(pid) {
  try {
    return execFileSync("ps", ["-p", String(pid), "-o", "pid=,ppid=,user=,comm="], {
      encoding: "utf8",
    }).trim();
  } catch {
    return null;
  }
}

function sanitize(value, key = "") {
  if (typeof value === "string") {
    const k = String(key);
    if (
      /screenshot|image|base64|blob|bytes|data_url|mime/i.test(k) ||
      value.startsWith("data:image") ||
      /^[A-Za-z0-9+/]{200,}={0,2}$/.test(value)
    ) {
      return `<omitted ${value.length} chars ${value.slice(0, 24)}>`;
    }
    if (value.startsWith("file://") && /png|jpe?g|heic|screenshot|skyshot/i.test(value)) {
      return `<omitted file-url ${value.length} chars>`;
    }
    if (value.length > 700) return `${value.slice(0, 700)}…<${value.length} chars>`;
    return value;
  }
  if (Array.isArray(value)) {
    if (key === "content") {
      return value.map((item) => {
        if (item && typeof item === "object" && (item.type === "image" || item.mimeType)) {
          return {
            type: item.type,
            mimeType: item.mimeType || null,
            data: typeof item.data === "string" ? `<omitted ${item.data.length} chars>` : null,
          };
        }
        return sanitize(item, key);
      });
    }
    return value.slice(0, 40).map((v) => sanitize(v, key));
  }
  if (value && typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = sanitize(v, k);
    return out;
  }
  return value;
}

function summarizeApps(detail) {
  const raw = JSON.stringify(detail);
  const apps =
    detail?.apps ||
    detail?.discoveredApps ||
    (Array.isArray(detail) ? detail : null);
  const list = Array.isArray(apps) ? apps : [];
  const compact = list.slice(0, 20).map((a) => ({
    id: a?.bundleIdentifier || a?.id || a?.app || null,
    displayName: a?.displayName || a?.name || null,
    isRunning: a?.isRunning ?? null,
  }));
  const text = typeof detail?.content?.[0]?.text === "string" ? detail.content[0].text : "";
  return {
    isError: detail?.isError === true,
    errorText: text && /error|not authenticated|not allowed/i.test(text) ? text.slice(0, 400) : null,
    listedCount: list.length,
    sample: compact,
    finder: list.find(
      (a) =>
        a?.bundleIdentifier === "com.apple.finder" ||
        a?.id === "com.apple.finder" ||
        String(a?.displayName || "") === "Finder",
    ) || (/\bFinder\b/.test(text) ? "mentioned-in-text" : null),
    linear:
      list.find(
        (a) =>
          String(a?.bundleIdentifier || a?.id || "").toLowerCase().includes("linear") ||
          String(a?.displayName || "").toLowerCase() === "linear",
      ) || null,
    textHead: text ? text.slice(0, 500) : null,
    rawChars: raw.length,
  };
}

async function pingSocket({ label, nodePath }) {
  const script = `
const net = require("node:net");
const sock = process.env.SOCK;
const api = process.env.API;
const started = Date.now();
const events = [];
function mark(e, extra) { events.push(Object.assign({ t: Date.now() - started, e }, extra || {})); }
const socket = net.createConnection(sock);
let buf = Buffer.alloc(0);
let resolved = false;
function done(result) {
  if (resolved) return;
  resolved = true;
  try { socket.destroy(); } catch {}
  result.ms = Date.now() - started;
  result.events = events;
  process.stdout.write(JSON.stringify(result));
}
const timer = setTimeout(() => done({ ok: false, error: "timeout", bytes: buf.length }), 4000);
socket.on("connect", () => {
  mark("connect");
  const body = Buffer.from(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "ping", params: { clientApiVersion: api } }));
  const frame = Buffer.alloc(4 + body.length);
  frame.writeUInt32LE(body.length, 0);
  body.copy(frame, 4);
  socket.write(frame);
  mark("write", { bytes: frame.length });
});
socket.on("data", (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  mark("data", { n: chunk.length, headHex: chunk.subarray(0, 16).toString("hex") });
  if (buf.length >= 4) {
    const len = buf.readUInt32LE(0);
    if (len > 0 && len < 8388608 && buf.length >= 4 + len) {
      let parsed = null;
      try { parsed = JSON.parse(buf.subarray(4, 4 + len).toString("utf8")); } catch {}
      clearTimeout(timer);
      done({ ok: true, parsed, bytes: buf.length });
    }
  }
});
socket.on("error", (err) => { mark("error", { message: err.message, code: err.code }); });
socket.on("close", (hadError) => {
  mark("close", { hadError, bytes: buf.length });
  clearTimeout(timer);
  done({
    ok: false,
    error: buf.length ? "closed-after-data" : "socket closed",
    hadError,
    bytes: buf.length,
    headHex: buf.subarray(0, 32).toString("hex"),
  });
});
`;
  if (nodePath) {
    return await new Promise((resolve) => {
      const child = spawn(nodePath, ["-e", script], {
        env: { ...process.env, SOCK, API },
        stdio: ["ignore", "pipe", "pipe"],
      });
      let stdout = "";
      let stderr = "";
      child.stdout.on("data", (d) => (stdout += d.toString("utf8")));
      child.stderr.on("data", (d) => (stderr += d.toString("utf8").slice(0, 500)));
      const t = setTimeout(() => {
        child.kill("SIGKILL");
        resolve({
          label,
          nodePath,
          ok: false,
          error: "child timeout",
          stdout: stdout.slice(0, 1000),
          stderr,
        });
      }, 6000);
      child.on("close", () => {
        clearTimeout(t);
        try {
          resolve({ label, nodePath, codesign: codesignSummary(nodePath), ...JSON.parse(stdout) });
        } catch {
          resolve({
            label,
            nodePath,
            codesign: codesignSummary(nodePath),
            ok: false,
            error: "unparseable child stdout",
            stdout: stdout.slice(0, 1000),
            stderr,
          });
        }
      });
    });
  }
  return await new Promise((resolve) => {
    const started = Date.now();
    const events = [];
    const mark = (e, extra) => events.push({ t: Date.now() - started, e, ...extra });
    const socket = net.createConnection(SOCK);
    let buf = Buffer.alloc(0);
    let done = false;
    const finish = (result) => {
      if (done) return;
      done = true;
      try {
        socket.destroy();
      } catch {}
      resolve({
        label,
        nodePath: process.execPath,
        codesign: codesignSummary(process.execPath),
        ms: Date.now() - started,
        events,
        ...result,
      });
    };
    const timer = setTimeout(() => finish({ ok: false, error: "timeout", bytes: buf.length }), 4000);
    socket.on("connect", () => {
      mark("connect");
      socket.write(encodeFrame({ jsonrpc: "2.0", id: 1, method: "ping", params: { clientApiVersion: API } }));
      mark("write");
    });
    socket.on("data", (chunk) => {
      buf = Buffer.concat([buf, chunk]);
      mark("data", { n: chunk.length, headHex: chunk.subarray(0, 16).toString("hex") });
      if (buf.length >= 4) {
        const len = buf.readUInt32LE(0);
        if (len > 0 && len < MAX_FRAME && buf.length >= 4 + len) {
          let parsed = null;
          try {
            parsed = JSON.parse(buf.subarray(4, 4 + len).toString("utf8"));
          } catch {}
          clearTimeout(timer);
          finish({ ok: true, parsed, bytes: buf.length });
        }
      }
    });
    socket.on("error", (err) => mark("error", { message: err.message, code: err.code }));
    socket.on("close", (hadError) => {
      clearTimeout(timer);
      finish({
        ok: false,
        error: buf.length ? "closed-after-data" : "socket closed",
        hadError,
        bytes: buf.length,
        headHex: buf.subarray(0, 32).toString("hex"),
      });
    });
  });
}

function encodeNdjson(msg) {
  return JSON.stringify(msg) + "\n";
}
function encodeContentLength(msg) {
  const json = JSON.stringify(msg);
  return `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`;
}

async function runMcpSession({ name, encode, timeoutMs = 25000, callTools = true }) {
  const child = spawn(CLIENT, ["mcp"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, CODEX_HOME: path.join(os.homedir(), ".codex") },
  });
  const stderrChunks = [];
  const stdoutRaw = [];
  child.stderr.on("data", (d) => stderrChunks.push(d));
  let buf = Buffer.alloc(0);
  const pending = new Map();
  const notifications = [];
  const parseEvents = [];
  const lsofSnapshots = [];

  function deliver(msg, via) {
    parseEvents.push({
      via,
      id: msg.id ?? null,
      method: msg.method ?? null,
      hasResult: msg.result != null,
      hasError: msg.error != null,
    });
    if (msg.id != null && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.error) {
        p.reject(Object.assign(new Error(msg.error.message || JSON.stringify(msg.error)), { rpc: msg.error }));
      } else p.resolve(msg.result);
    } else {
      notifications.push({ id: msg.id ?? null, method: msg.method ?? null, keys: Object.keys(msg) });
    }
  }

  child.stdout.on("data", (chunk) => {
    stdoutRaw.push(chunk);
    buf = Buffer.concat([buf, chunk]);
    for (;;) {
      const headerEnd = buf.indexOf("\r\n\r\n");
      if (headerEnd !== -1) {
        const header = buf.subarray(0, headerEnd).toString("utf8");
        const m = /Content-Length:\s*(\d+)/i.exec(header);
        if (m) {
          const len = Number(m[1]);
          const start = headerEnd + 4;
          if (buf.length < start + len) return;
          const json = buf.subarray(start, start + len).toString("utf8");
          buf = buf.subarray(start + len);
          try {
            deliver(JSON.parse(json), "content-length");
          } catch (e) {
            parseEvents.push({ via: "content-length", parseError: String(e), preview: json.slice(0, 200) });
          }
          continue;
        }
      }
      const nl = buf.indexOf("\n");
      if (nl === -1) return;
      const line = buf.subarray(0, nl).toString("utf8").replace(/\r$/, "").trim();
      buf = buf.subarray(nl + 1);
      if (!line || line.toLowerCase().startsWith("content-length")) continue;
      try {
        deliver(JSON.parse(line), "ndjson");
      } catch (e) {
        parseEvents.push({ via: "ndjson", parseError: String(e), preview: line.slice(0, 200) });
      }
    }
  });

  const closed = new Promise((resolve) => child.on("close", (code, signal) => resolve({ code, signal })));
  let nextId = 1;
  function call(method, params, ms = timeoutMs) {
    const id = nextId++;
    const msg = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`${method} timed out after ${ms}ms`));
      }, ms);
      pending.set(id, { resolve, reject, timer });
      child.stdin.write(encode(msg));
    });
  }
  function notify(method, params) {
    child.stdin.write(encode({ jsonrpc: "2.0", method, params }));
  }

  const checks = [];
  async function record(checkName, fn) {
    try {
      const detail = await fn();
      checks.push({ name: checkName, ok: true, detail });
      return detail;
    } catch (err) {
      checks.push({ name: checkName, ok: false, error: err.message, rpc: err.rpc || null });
      return null;
    }
  }

  const snap = (tag) => {
    lsofSnapshots.push({
      tag,
      pid: child.pid,
      ps: psLine(child.pid),
      parent: psLine(process.pid),
      lsof: lsofPreview(child.pid),
    });
  };

  try {
    const init = await record("initialize", () =>
      call("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: { elicitation: {}, roots: { listChanged: false } },
        clientInfo: { name: "codex-cua-reverse-v7-mcp-ndjson", version: "0.0.1" },
      }),
    );
    snap("after-initialize");
    notify("notifications/initialized", {});
    const listed = await record("tools/list", async () => {
      const r = await call("tools/list", {});
      const tools = r?.tools || [];
      return {
        count: tools.length,
        names: tools.map((t) => t.name),
        tools: tools.map((t) => ({
          name: t.name,
          description: typeof t.description === "string" ? t.description.slice(0, 400) : t.description,
          inputSchema: t.inputSchema || null,
          annotations: t.annotations || null,
        })),
      };
    });
    if (callTools) {
      const names = listed?.names || [];
      if (names.includes("list_apps")) {
        await record("tools/call:list_apps", async () => {
          const r = await call("tools/call", { name: "list_apps", arguments: {} }, 30000);
          snap("after-list_apps");
          const sanitized = sanitize(r);
          return { sanitized, summary: summarizeApps(r) };
        });
      }
      if (names.includes("get_app_state")) {
        await record("tools/call:get_app_state:Finder", async () => {
          const r = await call(
            "tools/call",
            { name: "get_app_state", arguments: { app: "Finder" } },
            45000,
          );
          snap("after-get_app_state");
          return sanitize(r);
        });
      }
      const attempted = names.filter((n) => BLOCKED.test(n));
      checks.push({
        name: "safety:skipped-mutating-tools",
        ok: true,
        detail: { skipped: attempted, note: "never invoked click/type/paste/set_value/press_key/scroll/drag/select_text/perform_secondary_action" },
      });
    }
    void init;
  } finally {
    try {
      child.stdin.end();
    } catch {}
    child.kill("SIGTERM");
    setTimeout(() => child.kill("SIGKILL"), 800);
    await Promise.race([closed, new Promise((r) => setTimeout(r, 1500))]);
  }

  const stdout = Buffer.concat(stdoutRaw);
  return {
    name,
    client: CLIENT,
    clientExists: fs.existsSync(CLIENT),
    pid: child.pid ?? null,
    parentPid: process.pid,
    parentExec: process.execPath,
    stderr: Buffer.concat(stderrChunks).toString("utf8").slice(0, 4000),
    stdoutBytes: stdout.length,
    stdoutHeadHex: stdout.subarray(0, 80).toString("hex"),
    stdoutHeadUtf8: stdout.subarray(0, 180).toString("utf8"),
    framing:
      stdout.length && stdout[0] === 0x7b
        ? "ndjson-starts-with-brace"
        : stdout.toString("utf8", 0, 16).toLowerCase().startsWith("content-length")
          ? "content-length"
          : "unknown",
    parseEvents: parseEvents.slice(0, 40),
    notificationCount: notifications.length,
    notifications: notifications.slice(0, 10),
    lsofSnapshots,
    checks,
    passed: checks.filter((c) => c.ok).length,
    failed: checks.filter((c) => !c.ok).length,
  };
}

const mapping = {
  note: "MCP snake_case tools are the plugin/CLI surface. Unified-computer-use REPL uses tinysky `cua.*` → `@oai/sky` snake_case → MacComputerUseClient camelCase → ComputerUseIPC* on CodexComputerUseIPC-5.",
  live_mcp_tools_expected: [
    "list_apps",
    "get_app_state",
    "click",
    "perform_secondary_action",
    "set_value",
    "select_text",
    "scroll",
    "drag",
    "press_key",
    "type_text",
  ],
  rows: [
    {
      mcp: "list_apps",
      tinysky: "cua.listApps()",
      sky: "sky.list_apps()",
      macClient: "MacComputerUseClient.listApps()",
      ipc: "ComputerUseIPCListAppsRequest",
      ipcResult: "ComputerUseIPCDiscoveredApp[]",
      mutating: false,
    },
    {
      mcp: "get_app_state",
      tinysky: "cua.getApp(name)  // internally sky.get_app_state({app, disableDiff:true}); App.getAXState/getScreenshot/getAXStateAndScreenshot also call get_app_state",
      sky: "sky.get_app_state({ app, disableDiff? })  // implicit session start",
      macClient: "startApp + getAppState",
      ipc: "ComputerUseIPCAppStartRequest then ComputerUseIPCAppGetSkyshotRequest",
      ipcResult: "ComputerUseIPCAppState / ComputerUseIPCSkyshot (AX text + screenshot URL)",
      mutating: false,
      mcpArg: { app: "string (required)" },
    },
    {
      mcp: "click",
      tinysky: "app.click(index | [x,y], {mouseButton, clickCount})",
      sky: "sky.click({ app, element_index|x,y, mouse_button, click_count })",
      macClient: "click → performAction",
      ipc: "ComputerUseIPCAppPerformActionRequest { action: { click: { at: elementID|coordinate, clickCount, mouseButton } } }",
      mutating: true,
    },
    {
      mcp: "perform_secondary_action",
      tinysky: "app.performSecondaryAction(index, action)",
      sky: "sky.perform_secondary_action({ app, element_index, action })",
      macClient: "performSecondaryAction",
      ipc: "ComputerUseIPCAppPerformActionRequest { action: { performSecondaryAction: { action, elementID } } }",
      mutating: true,
    },
    {
      mcp: "set_value",
      tinysky: "app.setValue(index, value)",
      sky: "sky.set_value({ app, element_index, value })",
      macClient: "setValue",
      ipc: "ComputerUseIPCAppPerformActionRequest { action: { setValue } }",
      mutating: true,
    },
    {
      mcp: "select_text",
      tinysky: "app.selectText(index, text, {prefix,suffix,selectionType})",
      sky: "sky.select_text({ app, element_index, text, prefix, suffix, selection_type })",
      macClient: "selectText",
      ipc: "ComputerUseIPCAppPerformActionRequest { action: { selectText } }",
      mutating: true,
    },
    {
      mcp: "scroll",
      tinysky: "app.scroll(index | [x,y], direction, pages?)",
      sky: "sky.scroll({ app, element_index|x,y, direction, pages })",
      macClient: "scroll",
      ipc: "ComputerUseIPCAppPerformActionRequest { action: { scroll } }",
      mutating: true,
    },
    {
      mcp: "drag",
      tinysky: "app.drag([x1,y1],[x2,y2])",
      sky: "sky.drag({ app, from_x, from_y, to_x, to_y })",
      macClient: "drag",
      ipc: "ComputerUseIPCAppPerformActionRequest { action: { drag } }",
      mutating: true,
    },
    {
      mcp: "press_key",
      tinysky: "app.pressKey(key)",
      sky: "sky.press_key({ app, key })",
      macClient: "pressKey",
      ipc: "ComputerUseIPCAppPerformActionRequest { action: { pressKey: { _0: key } } }",
      mutating: true,
    },
    {
      mcp: "type_text",
      tinysky: "app.typeText(text)",
      sky: "sky.type_text({ app, text })",
      macClient: "typeText",
      ipc: "ComputerUseIPCAppPerformActionRequest { action: { type: { _0: text } } }",
      mutating: true,
    },
  ],
  present_in_sky_tinysky_absent_from_mcp: [
    {
      tinysky: "app.paste(text, {format})",
      sky: "sky.paste({ app, text, format })",
      ipc: "ComputerUseIPCAppPerformActionRequest { action: { paste } }",
    },
    {
      tinysky: null,
      sky: "sky.start_audio_recording / stop_audio_recording (SKY_ENABLE_AUDIO=1)",
      ipc: "ComputerUseIPCStartAudioRecordingRequest / ComputerUseIPCStopAudioRecordingRequest",
    },
  ],
  senderAuthorization: {
    type: "ComputerUseIPCSenderAuthorization",
    failClosed: "Sender process is not authenticated",
    jsonRpcCode: -10000,
    jsonRpcName: "senderProcessNotAuthenticated",
    analyticsFields: ["parent/responsible team id", "signing id", "bundle id", "executable"],
    failureReasons: [
      "CODEX_COMPUTER_USE_IPC_AUTHORIZATION_FAILURE_REASON_MISSING_PARENT",
      "CODEX_COMPUTER_USE_IPC_AUTHORIZATION_FAILURE_REASON_UNTRUSTED_PARENT",
      "CODEX_COMPUTER_USE_IPC_AUTHORIZATION_FAILURE_REASON_RELAY_WITHOUT_TRUSTED_ANCESTOR",
    ],
    validLivePaths: [
      "node_repl.nativePipe.createConnection (host-side privileged bridge; NativePipeRequestOp::Connect)",
      "signed SkyComputerUseClient mcp (com.openai.sky.CUAService.cli) launched under a trusted 2DC432GLL2 parent",
    ],
    invalidLivePaths: [
      "unsigned / Node.js Foundation node connecting to computeruse.sock",
      "OpenAI-signed cua_node/bin/node (Identifier=node, Team=2DC432GLL2) connecting to computeruse.sock",
    ],
  },
};

const identity = {
  ts: new Date().toISOString(),
  sock: SOCK,
  sockExists: fs.existsSync(SOCK),
  servicePid: (() => {
    try {
      return execFileSync("pgrep", ["-f", "SkyComputerUseService"], { encoding: "utf8" }).trim().split("\n")[0];
    } catch {
      return null;
    }
  })(),
  client: codesignSummary(CLIENT),
  fnmNode: codesignSummary(process.execPath),
  cuaNode: codesignSummary(CUA_NODE),
  nodeRepl: codesignSummary(NODE_REPL),
  cuaServiceApp: codesignSummary(
    path.join(os.homedir(), ".codex/computer-use/Codex Computer Use.app/Contents/MacOS/SkyComputerUseService"),
  ),
};

const pings = [];
pings.push(await pingSocket({ label: "fnm-node-HX7739G8FX" }));
pings.push(await pingSocket({ label: "cua_node-OpenAI-2DC432GLL2-identifier-node", nodePath: CUA_NODE }));

const sessions = [];
sessions.push(await runMcpSession({ name: "ndjson", encode: encodeNdjson, timeoutMs: 25000, callTools: true }));
sessions.push(
  await runMcpSession({
    name: "content-length-control",
    encode: encodeContentLength,
    timeoutMs: 4000,
    callTools: false,
  }),
);

const evidence = {
  ts: new Date().toISOString(),
  goal: "Live-verify SkyComputerUseClient mcp over NDJSON JSON-RPC; map tools; document SenderAuthorization.",
  safety: {
    mutatingToolsInvoked: false,
    linearMutations: false,
    screenshotBytesWritten: false,
    axTextTruncated: true,
  },
  identity,
  pings,
  sessions: sessions.map((s) => ({
    name: s.name,
    framing: s.framing,
    stdoutHeadHex: s.stdoutHeadHex,
    stdoutHeadUtf8: s.stdoutHeadUtf8,
    stdoutBytes: s.stdoutBytes,
    parseEvents: s.parseEvents,
    passed: s.passed,
    failed: s.failed,
    checks: s.checks.map((c) => ({
      name: c.name,
      ok: c.ok,
      error: c.error || null,
      rpc: c.rpc || null,
      detail: c.detail,
    })),
    lsofSnapshots: s.lsofSnapshots,
    stderr: s.stderr,
    pid: s.pid,
    parentPid: s.parentPid,
    parentExec: s.parentExec,
  })),
  mapping,
};

fs.writeFileSync(path.join(HERE, "evidence.json"), JSON.stringify(evidence, null, 2));
fs.writeFileSync(
  path.join(HERE, "mcp-session.json"),
  JSON.stringify(
    {
      ts: evidence.ts,
      ndjson: sessions[0],
      contentLengthControl: {
        name: sessions[1].name,
        framing: sessions[1].framing,
        stdoutBytes: sessions[1].stdoutBytes,
        stdoutHeadUtf8: sessions[1].stdoutHeadUtf8,
        parseEvents: sessions[1].parseEvents,
        checks: sessions[1].checks.map((c) => ({ name: c.name, ok: c.ok, error: c.error || null })),
      },
    },
    null,
    2,
  ),
);
fs.writeFileSync(path.join(HERE, "ping.json"), JSON.stringify({ ts: evidence.ts, pings }, null, 2));
const listed = sessions[0].checks.find((c) => c.name === "tools/list");
fs.writeFileSync(
  path.join(HERE, "tools-list.json"),
  JSON.stringify({ ts: evidence.ts, tools: listed?.detail || null, initialize: sessions[0].checks.find((c) => c.name === "initialize")?.detail || null }, null, 2),
);
fs.writeFileSync(path.join(HERE, "mapping.json"), JSON.stringify(mapping, null, 2));
fs.writeFileSync(path.join(HERE, "identity.json"), JSON.stringify(identity, null, 2));

const summary = {
  dest: HERE,
  initialize: sessions[0].checks.find((c) => c.name === "initialize")?.ok || false,
  toolsList: listed?.ok || false,
  toolNames: listed?.detail?.names || [],
  listApps: sessions[0].checks.find((c) => c.name === "tools/call:list_apps") || null,
  getAppState: sessions[0].checks.find((c) => c.name === "tools/call:get_app_state:Finder") || null,
  framing: sessions[0].framing,
  contentLengthInit: sessions[1].checks.find((c) => c.name === "initialize") || null,
  pings: pings.map((p) => ({ label: p.label, error: p.error, ok: p.ok, identifier: p.codesign?.identifier, team: p.codesign?.team })),
};
console.log(JSON.stringify(summary, null, 2));
process.exit(sessions[0].checks.some((c) => c.name === "initialize" && c.ok) ? 0 : 1);
