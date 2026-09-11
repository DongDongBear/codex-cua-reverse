#!/usr/bin/env node
/**
 * Talk the reconstructed Sky Computer Use native-pipe protocol.
 * Frame: uint32le length + UTF-8 JSON-RPC 2.0. Max 8 MiB.
 * Methods: ping, request. API version: CodexComputerUseIPC-5.
 */
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const API = process.env.CUA_IPC_API_VERSION || "CodexComputerUseIPC-5";
const SOCK =
  process.env.SKY_CUA_SERVICE_NATIVE_PIPE_PATH ||
  path.join(
    os.homedir(),
    "Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock",
  );
const MAX = 8 * 1024 * 1024;

function encode(obj) {
  const body = Buffer.from(JSON.stringify(obj), "utf8");
  if (body.length > MAX) throw new Error(`frame too large: ${body.length}`);
  const buf = Buffer.alloc(4 + body.length);
  buf.writeUInt32LE(body.length, 0);
  body.copy(buf, 4);
  return buf;
}

function decode(buf) {
  const messages = [];
  let n = 0;
  while (buf.length - n >= 4) {
    const len = buf.readUInt32LE(n);
    if (len > MAX) throw new Error(`frame too large: ${len}`);
    const end = 4 + len;
    if (buf.length - n < end) break;
    messages.push(JSON.parse(buf.subarray(n + 4, n + end).toString("utf8")));
    n += end;
  }
  return { messages, remaining: buf.subarray(n) };
}

function connect(sockPath, timeoutMs) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => {
      socket.destroy();
      reject(new Error(`connect timeout ${timeoutMs}ms`));
    }, timeoutMs);
    const socket = net.createConnection(sockPath);
    socket.once("connect", () => {
      clearTimeout(t);
      resolve(socket);
    });
    socket.once("error", (err) => {
      clearTimeout(t);
      reject(err);
    });
  });
}

class Rpc {
  constructor(socket) {
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.pending = new Map();
    this.nextId = 1;
    socket.on("data", (chunk) => {
      this.buf = Buffer.concat([this.buf, chunk]);
      const { messages, remaining } = decode(this.buf);
      this.buf = remaining;
      for (const msg of messages) {
        const p = this.pending.get(msg.id);
        if (!p) continue;
        this.pending.delete(msg.id);
        clearTimeout(p.timer);
        if (msg.error) p.reject(Object.assign(new Error(msg.error.message), { rpc: msg.error }));
        else p.resolve(msg.result);
      }
    });
    socket.on("error", (err) => this.failAll(err));
    socket.on("close", () => this.failAll(new Error("socket closed")));
  }
  failAll(err) {
    for (const p of this.pending.values()) {
      clearTimeout(p.timer);
      p.reject(err);
    }
    this.pending.clear();
  }
  call(method, params, timeoutMs = 15000) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.socket.write(encode({ jsonrpc: "2.0", id, method, params }));
    });
  }
  ping() {
    return this.call("ping", { clientApiVersion: API }, 5000);
  }
  request(requestType, request = {}, timeoutSeconds = 30) {
    return this.call(
      "request",
      {
        clientApiVersion: API,
        requestType,
        request,
        deadlineUnixMilliseconds: Date.now() + timeoutSeconds * 1000,
        codexTurnMetadata: { source: "codex-cua-reverse-verify" },
      },
      timeoutSeconds * 1000,
    );
  }
  close() {
    this.socket.end();
  }
}

function summarizeApps(result) {
  const apps = result?.apps || result?.discoveredApps || result;
  const list = Array.isArray(apps) ? apps : [];
  return {
    count: list.length,
    sample: list.slice(0, 12).map((a) => ({
      id: a.bundleIdentifier || a.id || a.app,
      displayName: a.displayName || a.name,
      isRunning: a.isRunning,
    })),
    linear: list.find(
      (a) =>
        String(a.bundleIdentifier || a.id || "").includes("linear") ||
        String(a.displayName || "").toLowerCase() === "linear",
    ),
    finder: list.find(
      (a) =>
        a.bundleIdentifier === "com.apple.finder" ||
        String(a.displayName || "") === "Finder",
    ),
  };
}

function summarizeSkyshot(result) {
  const shot = result?.skyshot || result;
  const text = String(shot?.text || result?.text || "");
  const url = shot?.screenshot?.url || result?.screenshot?.url || null;
  return {
    keys: result && typeof result === "object" ? Object.keys(result) : [],
    skyshotKeys: shot && typeof shot === "object" ? Object.keys(shot) : [],
    textChars: text.length,
    textHead: text.split("\n").slice(0, 12).join("\n"),
    hasScreenshot: Boolean(url),
    screenshotScheme: url ? String(url).split(":")[0] : null,
  };
}

const checks = [];
function record(name, fn) {
  return fn()
    .then((detail) => {
      checks.push({ name, ok: true, detail });
      return detail;
    })
    .catch((err) => {
      checks.push({
        name,
        ok: false,
        error: err.message,
        rpc: err.rpc || null,
      });
      return null;
    });
}

const outDir = path.join(path.dirname(new URL(import.meta.url).pathname), "results");
fs.mkdirSync(outDir, { recursive: true });

const report = {
  ts: new Date().toISOString(),
  sock: SOCK,
  sockExists: fs.existsSync(SOCK),
  apiVersion: API,
  checks,
};

if (!report.sockExists) {
  report.error = "computeruse.sock missing";
  fs.writeFileSync(path.join(outDir, "native-ipc.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exit(2);
}

const socket = await connect(SOCK, 3000);
const rpc = new Rpc(socket);

await record("ping", () => rpc.ping());
await record("list_apps", () =>
  rpc.request("ComputerUseIPCListAppsRequest", {}).then(summarizeApps),
);
await record("get_app_state_finder", () =>
  rpc
    .request("ComputerUseIPCAppGetSkyshotRequest", {
      app: "Finder",
      disableDiff: true,
    })
    .then(summarizeSkyshot),
);
await record("adversarial_wrong_version", async () => {
  const sock2 = await connect(SOCK, 3000);
  const rpc2 = new Rpc(sock2);
  try {
    await rpc2.call("ping", { clientApiVersion: "CodexComputerUseIPC-0" }, 5000);
    rpc2.close();
    return { unexpected: "wrong version was accepted" };
  } catch (err) {
    rpc2.close();
    return {
      rejected: true,
      message: err.message,
      rpc: err.rpc || null,
    };
  }
});

rpc.close();
report.passed = checks.filter((c) => c.ok).length;
report.failed = checks.filter((c) => !c.ok).length;
const dest = path.join(outDir, "native-ipc.json");
fs.writeFileSync(dest, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.failed ? 1 : 0);
