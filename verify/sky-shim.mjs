#!/usr/bin/env node
/**
 * Import the bundled @oai/sky Mac client with a nodeRepl.nativePipe shim
 * and call the same methods the traces used (list_apps / get_app_state).
 *
 * Live: listApps + getAppState("Finder") only.
 * Mutating click/type/setValue are encoded locally and never sent.
 */
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const CUA_NODE = "/Applications/ChatGPT.app/Contents/Resources/cua_node";
const MODULES = path.join(CUA_NODE, "lib/node_modules");
const MAC = path.join(MODULES, "@oai/sky/dist/project/cua/sky_js/src/targets/mac");
const SOCK = path.join(
  os.homedir(),
  "Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock",
);
const API = "CodexComputerUseIPC-5";
const MAX_FRAME = 8 * 1024 * 1024;

const frames = [];
const capturedRequests = [];
const socketEvents = [];

function errInfo(err) {
  if (!err || typeof err !== "object") return { message: String(err) };
  const info = {
    name: err.name,
    message: err.message,
    code: err.code,
    errorName: err.errorName,
    requestType: err.requestType,
  };
  if (err.cause) info.cause = errInfo(err.cause);
  return info;
}

function sanitize(value, depth = 0) {
  if (value == null || depth > 8) return value;
  if (typeof value === "string") {
    if (value.startsWith("data:")) return `[data-url omitted ${value.length} chars]`;
    if (/^file:\/\//.test(value)) {
      const scheme = value.split(":")[0];
      return `[${scheme} url omitted ${value.length} chars]`;
    }
    if (value.length > 240) return `${value.slice(0, 240)}…[${value.length} chars]`;
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 24).map((v) => sanitize(v, depth + 1));
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (/screenshot|bytes|image|png|jpeg|wav|audio/i.test(k)) {
        if (v && typeof v === "object") {
          out[k] = {
            keys: Object.keys(v),
            urlScheme:
              typeof v.url === "string" ? v.url.split(":")[0] : undefined,
            hasUrl: Boolean(v.url),
          };
        } else if (typeof v === "string") {
          out[k] = `[omitted ${v.length} chars]`;
        } else {
          out[k] = Boolean(v);
        }
        continue;
      }
      if (k === "text" && typeof v === "string") {
        out.textChars = v.length;
        out.textHead = v.split("\n").slice(0, 8).join("\n");
        continue;
      }
      out[k] = sanitize(v, depth + 1);
    }
    return out;
  }
  return String(typeof value);
}

function parseFrames(buf, remaining) {
  let data = remaining.length ? Buffer.concat([remaining, buf]) : Buffer.from(buf);
  const messages = [];
  let n = 0;
  while (data.length - n >= 4) {
    const len = data.readUInt32LE(n);
    if (len > MAX_FRAME) break;
    const end = 4 + len;
    if (data.length - n < end) break;
    messages.push(JSON.parse(data.subarray(n + 4, n + end).toString("utf8")));
    n += end;
  }
  return { messages, remaining: data.subarray(n) };
}

function summarizeRpc(msg) {
  const summary = {
    jsonrpc: msg.jsonrpc,
    id: msg.id,
    method: msg.method || null,
  };
  if (msg.params) {
    summary.params = {
      clientApiVersion: msg.params.clientApiVersion,
      requestType: msg.params.requestType || null,
      request: msg.params.request ? sanitize(msg.params.request) : undefined,
      hasDeadline: typeof msg.params.deadlineUnixMilliseconds === "number",
    };
  }
  if (msg.result) summary.result = sanitize(msg.result);
  if (msg.error) {
    summary.error = {
      code: msg.error.code,
      message: String(msg.error.message || "").slice(0, 400),
    };
  }
  return summary;
}

function wrapSocket(socket) {
  let inbound = Buffer.alloc(0);
  let inBytes = 0;
  const origWrite = socket.write.bind(socket);
  socket.write = (data, ...rest) => {
    try {
      const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
      const parsed = parseFrames(buf, Buffer.alloc(0));
      for (const msg of parsed.messages) {
        frames.push({ dir: "out", ...summarizeRpc(msg) });
      }
    } catch (err) {
      frames.push({ dir: "out", parseError: err.message });
    }
    return origWrite(data, ...rest);
  };
  socket.on("data", (chunk) => {
    inBytes += chunk.length;
    socketEvents.push({ t: Date.now(), ev: "data", bytes: chunk.length });
    try {
      const parsed = parseFrames(chunk, inbound);
      inbound = parsed.remaining;
      for (const msg of parsed.messages) {
        frames.push({ dir: "in", ...summarizeRpc(msg) });
      }
    } catch (err) {
      frames.push({ dir: "in", parseError: err.message });
    }
  });
  socket.on("end", () => socketEvents.push({ t: Date.now(), ev: "end", inBytes }));
  socket.on("close", (hadError) =>
    socketEvents.push({ t: Date.now(), ev: "close", hadError, inBytes }),
  );
  socket.on("error", (err) =>
    socketEvents.push({ t: Date.now(), ev: "error", message: err.message, code: err.code }),
  );
  return socket;
}

function createConnection(sockPath) {
  return new Promise((resolve, reject) => {
    const s = net.createConnection(sockPath);
    s.once("connect", () => {
      socketEvents.push({ t: Date.now(), ev: "connect", path: sockPath });
      resolve(wrapSocket(s));
    });
    s.once("error", (err) => {
      socketEvents.push({ t: Date.now(), ev: "connect_error", message: err.message, code: err.code });
      reject(err);
    });
  });
}

globalThis.nodeRepl = {
  env: {
    ...process.env,
    CODEX_HOME: process.env.CODEX_HOME || path.join(os.homedir(), ".codex"),
    SKY_CUA_SERVICE_NATIVE_PIPE_PATH: SOCK,
    SKY_CUA_SERVICE_PATH: path.join(
      os.homedir(),
      ".codex/computer-use/Codex Computer Use.app",
    ),
  },
  nativePipe: { createConnection },
  write(value, channel) {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    process.stderr.write(`[nodeRepl.write ${channel || ""}] ${text.slice(0, 200)}\n`);
  },
  async emitImage() {},
  requestMeta: { "x-codex-turn-metadata": { source: "codex-cua-reverse-verify" } },
};

const clientUrl = pathToFileURL(path.join(MAC, "client.js")).href;
const errorsUrl = pathToFileURL(path.join(MAC, "errors.js")).href;
const windowClientDts = fs.readFileSync(
  path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "../vendor/sky/types/window/WindowComputerUseClient.d.ts",
  ),
  "utf8",
);
const tinyskyDts = fs.readFileSync(
  path.join(
    path.dirname(new URL(import.meta.url).pathname),
    "../vendor/cua/types/tinysky_alt.types.d.ts",
  ),
  "utf8",
);

const checks = [];
async function record(name, fn) {
  try {
    const detail = await fn();
    checks.push({ name, ok: true, detail });
    return detail;
  } catch (err) {
    checks.push({
      name,
      ok: false,
      error: err.message,
      nameErr: err.name,
      code: err.code,
      errorName: err.errorName,
      requestType: err.requestType,
      err: errInfo(err),
    });
    return null;
  }
}

const { MacComputerUseClient } = await import(clientUrl);
const { ServerErrorCode, SkyComputerUseError } = await import(errorsUrl);

const origRequest = MacComputerUseClient.prototype.request;
MacComputerUseClient.prototype.request = function wrappedRequest(requestType, request, options) {
  capturedRequests.push({
    requestType,
    request: sanitize(request),
    apiVersion: options?.apiVersion || this.apiVersion,
  });
  if (
    options &&
    options.__dryRun === true &&
    requestType === "ComputerUseIPCAppPerformActionRequest"
  ) {
    return Promise.resolve({ dryRun: true, requestType, request });
  }
  return origRequest.call(this, requestType, request, options);
};

const client = new MacComputerUseClient({
  apiVersion: API,
  timeoutSeconds: 30,
  codexMetadata: { source: "codex-cua-reverse-verify" },
});

const macMethods = Object.getOwnPropertyNames(MacComputerUseClient.prototype).filter(
  (n) => n !== "constructor" && typeof MacComputerUseClient.prototype[n] === "function",
);
const windowSnake = [...windowClientDts.matchAll(/^\s{4}([a-z_]+)\??:/gm)].map((m) => m[1]);
const tinyskyCamel = [...tinyskyDts.matchAll(/^\s{4}([a-zA-Z]+)\(/gm)].map((m) => m[1]);

function snakeToCamel(s) {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase());
}

const methodMap = windowSnake
  .filter((n) => n !== "target")
  .map((snake) => {
    const camel = snakeToCamel(snake);
    return {
      window: snake,
      macClient: camel,
      macHas: macMethods.includes(camel),
      tinyskyTarget: tinyskyCamel.includes(camel) ? camel : null,
    };
  });

await record("import_and_shim", async () => ({
  clientUrl,
  apiVersion: API,
  sock: SOCK,
  sockExists: fs.existsSync(SOCK),
  nodeReplHasNativePipe: typeof globalThis.nodeRepl.nativePipe.createConnection === "function",
  envPipe: globalThis.nodeRepl.env.SKY_CUA_SERVICE_NATIVE_PIPE_PATH,
  macMethods,
  serverErrorCode: ServerErrorCode,
}));

await record("method_name_mapping", async () => ({
  windowComputerUseClient: windowSnake,
  macComputerUseClient: macMethods,
  tinyskyTarget: tinyskyCamel,
  map: methodMap,
  extrasOnMacClient: macMethods.filter(
    (m) => !windowSnake.map(snakeToCamel).includes(m) && !["request", "getTransport", "transport", "performAction"].includes(m),
  ),
  allWindowMethodsPresentOnMac: methodMap.every((row) => row.macHas),
}));

await record("listApps", async () => {
  const apps = await client.listApps();
  const list = Array.isArray(apps) ? apps : apps?.apps || apps?.discoveredApps || [];
  const sample = (Array.isArray(list) ? list : []).slice(0, 8).map((a) => ({
    id: a.bundleIdentifier || a.id || null,
    displayName: a.displayName || a.name || null,
    isRunning: a.isRunning,
  }));
  return {
    type: typeof apps,
    isArray: Array.isArray(apps),
    keys: apps && typeof apps === "object" && !Array.isArray(apps) ? Object.keys(apps) : null,
    count: Array.isArray(list) ? list.length : 0,
    sample,
    finder: (Array.isArray(list) ? list : []).find(
      (a) => a.bundleIdentifier === "com.apple.finder" || a.displayName === "Finder" || a.id === "Finder",
    ) || null,
    captured: capturedRequests.filter((r) => r.requestType === "ComputerUseIPCListAppsRequest").slice(-1),
  };
});

await record("getAppState_Finder", async () => {
  const state = await client.getAppState({ app: "Finder", disableDiff: true });
  const text = String(state?.text || state?.skyshot?.text || "");
  const shot = state?.skyshot || state;
  const url = shot?.screenshot?.url || state?.screenshot?.url || null;
  return {
    keys: state && typeof state === "object" ? Object.keys(state) : [],
    skyshotKeys: state?.skyshot && typeof state.skyshot === "object" ? Object.keys(state.skyshot) : [],
    textChars: text.length,
    textHead: text.split("\n").slice(0, 10).join("\n"),
    hasScreenshot: Boolean(url),
    screenshotScheme: url ? String(url).split(":")[0] : null,
    captured: capturedRequests.filter((r) => r.requestType === "ComputerUseIPCAppGetSkyshotRequest").slice(-1),
  };
});

const dryOpts = { __dryRun: true };
await record("encode_click_coord_like_trace", async () => {
  await client.click({ app: "Finder", x: 119, y: 35 }, dryOpts);
  return capturedRequests.filter((r) => r.requestType === "ComputerUseIPCAppPerformActionRequest" && r.request?.action?.click).at(-1);
});
await record("encode_click_element_like_trace", async () => {
  await client.click({ app: "Finder", elementIndex: 0 }, dryOpts);
  return capturedRequests.filter((r) => r.requestType === "ComputerUseIPCAppPerformActionRequest" && r.request?.action?.click?.at?.elementID).at(-1);
});
await record("encode_typeText_like_trace", async () => {
  await client.typeText({ app: "Finder", text: "Linear" }, dryOpts);
  return capturedRequests.filter((r) => r.requestType === "ComputerUseIPCAppPerformActionRequest" && r.request?.action?.type).at(-1);
});
await record("encode_setValue_like_trace", async () => {
  await client.setValue({ app: "Finder", elementIndex: 128, value: "shape-only" }, dryOpts);
  return capturedRequests.filter((r) => r.requestType === "ComputerUseIPCAppPerformActionRequest" && r.request?.action?.setValue).at(-1);
});

const destDir = path.join(path.dirname(new URL(import.meta.url).pathname), "results");
fs.mkdirSync(destDir, { recursive: true });
const report = {
  ts: new Date().toISOString(),
  clientUrl,
  apiVersion: API,
  sock: SOCK,
  sockExists: fs.existsSync(SOCK),
  checks,
  socketEvents,
  auth: {
    connected: socketEvents.some((e) => e.ev === "close" || e.ev === "end"),
    inboundBytes: socketEvents.reduce((n, e) => Math.max(n, e.inBytes || 0), 0),
    inboundRpc: frames.filter((f) => f.dir === "in").length,
    outboundPing: frames.filter((f) => f.dir === "out" && f.method === "ping").length,
    jsonRpcErrorCode: frames.find((f) => f.error)?.error?.code ?? null,
    mappedIfJsonRpcAuth: {
      name: "senderProcessNotAuthenticated",
      code: ServerErrorCode.senderProcessNotAuthenticated,
    },
    observedJsError: checks.find((c) => c.name === "listApps" && !c.ok)?.err || null,
    note: "Service accepted the Unix socket then FIN with zero JSON-RPC bytes. No ServerErrorCode on the wire.",
  },
  frames: frames.map((f) => ({
    dir: f.dir,
    id: f.id,
    method: f.method,
    params: f.params,
    error: f.error || null,
    resultKeys: f.result && typeof f.result === "object" ? Object.keys(f.result) : null,
    result: f.result && f.method !== "ping" ? f.result : f.result,
    parseError: f.parseError || null,
  })),
  capturedRequests,
  serverErrorCode: ServerErrorCode,
  skyComputerUseErrorName: SkyComputerUseError.name,
  passed: checks.filter((c) => c.ok).length,
  failed: checks.filter((c) => c.ok === false).length,
};
const dest = path.join(destDir, "sky-shim.json");
fs.writeFileSync(dest, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.failed ? 1 : 0);
