#!/usr/bin/env node
/**
 * Independent native-pipe caller (not the verify/native-ipc.mjs harness).
 * Frame: uint32le length + UTF-8 JSON-RPC 2.0. Max 8 MiB.
 */
import net from "node:net";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";

const MAX = 8 * 1024 * 1024;
const API = "CodexComputerUseIPC-5";
const SOCK =
  process.env.SKY_CUA_SERVICE_NATIVE_PIPE_PATH ||
  path.join(
    os.homedir(),
    "Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock",
  );
const HERE = path.dirname(fileURLToPath(import.meta.url));

function encode(obj) {
  const body = Buffer.from(JSON.stringify(obj), "utf8");
  if (body.length > MAX) throw new Error(`frame too large: ${body.length}`);
  const buf = Buffer.alloc(4 + body.length);
  buf.writeUInt32LE(body.length, 0);
  body.copy(buf, 4);
  return buf;
}

function rpcOnce(method, params, timeoutMs = 2000) {
  const payload = { jsonrpc: "2.0", id: 1, method, params };
  const frame = encode(payload);
  const t0 = Date.now();
  const events = [];
  return new Promise((resolve) => {
    const sock = net.createConnection(SOCK);
    let buf = Buffer.alloc(0);
    let settled = false;
    const finish = (detail) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        sock.destroy();
      } catch {}
      resolve({
        ...detail,
        request: payload,
        frame_hex_head: frame.subarray(0, 48).toString("hex"),
        frame_len: frame.length,
        events,
      });
    };
    const timer = setTimeout(() => finish({ ok: false, error: `recv timeout ${timeoutMs}ms`, rpc: null }), timeoutMs);
    sock.once("connect", () => {
      events.push({ t_ms: Date.now() - t0, type: "connect" });
      sock.write(frame);
      events.push({ t_ms: Date.now() - t0, type: "wrote", frame_len: frame.length, body_len: frame.length - 4 });
    });
    sock.on("data", (chunk) => {
      events.push({ t_ms: Date.now() - t0, type: "data", bytes: chunk.length });
      buf = Buffer.concat([buf, chunk]);
      if (buf.length >= 4) {
        const n = buf.readUInt32LE(0);
        if (n > MAX) return finish({ ok: false, error: `frame too large: ${n}`, rpc: null });
        if (buf.length >= 4 + n) {
          const msg = JSON.parse(buf.subarray(4, 4 + n).toString("utf8"));
          finish({
            ok: !msg.error,
            error: msg.error?.message || null,
            rpc: msg.error || null,
            result: msg.result,
            response_keys: msg && typeof msg === "object" ? Object.keys(msg) : [],
            raw_response: msg,
          });
        }
      }
    });
    sock.on("error", (err) => finish({ ok: false, error: err.message, code: err.code, rpc: null }));
    sock.on("close", () => {
      if (!settled) {
        events.push({ t_ms: Date.now() - t0, type: "eof", buffered: buf.length });
        finish({
          ok: false,
          error: "socket closed",
          rpc: null,
          recv_bytes: buf.length,
          recv_hex_head: buf.subarray(0, 32).toString("hex"),
        });
      }
    });
  });
}

function connectOnly(timeoutMs = 1000) {
  const t0 = Date.now();
  return new Promise((resolve) => {
    const sock = net.createConnection(SOCK);
    let done = false;
    const finish = (d) => {
      if (done) return;
      done = true;
      try {
        sock.destroy();
      } catch {}
      resolve(d);
    };
    setTimeout(() => finish({ ok: true, connect_ms: Date.now() - t0, recv: "timeout_still_open" }), timeoutMs);
    sock.once("connect", () => {
      const connect_ms = Date.now() - t0;
      sock.once("data", (d) => finish({ ok: true, connect_ms, recv: d.subarray(0, 32).toString("hex") }));
      sock.once("close", () => finish({ ok: true, connect_ms, recv: "empty", elapsed_ms: Date.now() - t0 }));
    });
    sock.once("error", (e) => finish({ ok: false, error: e.message, code: e.code }));
  });
}

const deadline = Date.now() + 5000;
const meta = { source: "v1-independent-node" };
const report = {
  impl: "independent-caller.mjs",
  ts: new Date().toISOString(),
  sock: SOCK,
  sock_exists: fs.existsSync(SOCK),
  api: API,
  exe: process.execPath,
  pid: process.pid,
  ppid: process.ppid,
  checks: {},
};

report.checks.connect_only = await connectOnly();
report.checks.ping = await rpcOnce("ping", { clientApiVersion: API });
report.checks.list_apps = await rpcOnce("request", {
  clientApiVersion: API,
  requestType: "ComputerUseIPCListAppsRequest",
  request: {},
  deadlineUnixMilliseconds: deadline,
  codexTurnMetadata: meta,
});
report.checks.get_app_state_finder = await rpcOnce("request", {
  clientApiVersion: API,
  requestType: "ComputerUseIPCAppGetSkyshotRequest",
  request: { app: "Finder", disableDiff: true },
  deadlineUnixMilliseconds: deadline,
  codexTurnMetadata: meta,
});
report.checks.adversarial_wrong_version = await rpcOnce("ping", {
  clientApiVersion: "CodexComputerUseIPC-0",
});

const fixtures = {
  ping_v5: {
    jsonrpc: "2.0",
    id: 1,
    method: "ping",
    params: { clientApiVersion: "CodexComputerUseIPC-5" },
  },
  ping_v0: {
    jsonrpc: "2.0",
    id: 1,
    method: "ping",
    params: { clientApiVersion: "CodexComputerUseIPC-0" },
  },
  list_apps: {
    jsonrpc: "2.0",
    id: 1,
    method: "request",
    params: {
      clientApiVersion: "CodexComputerUseIPC-5",
      requestType: "ComputerUseIPCListAppsRequest",
      request: {},
      deadlineUnixMilliseconds: 0,
      codexTurnMetadata: { source: "v1-frame-fixture" },
    },
  },
  get_skyshot_finder: {
    jsonrpc: "2.0",
    id: 1,
    method: "request",
    params: {
      clientApiVersion: "CodexComputerUseIPC-5",
      requestType: "ComputerUseIPCAppGetSkyshotRequest",
      request: { app: "Finder", disableDiff: true },
      deadlineUnixMilliseconds: 0,
      codexTurnMetadata: { source: "v1-frame-fixture" },
    },
  },
};

report.frame_fixtures = Object.fromEntries(
  Object.entries(fixtures).map(([name, obj]) => {
    const frame = encode(obj);
    return [
      name,
      {
        json: obj,
        frame_len: frame.length,
        body_len: frame.length - 4,
        sha256_prefix: crypto.createHash("sha256").update(frame).digest("hex").slice(0, 16),
        hex_head: frame.subarray(0, 24).toString("hex"),
        prefix_u32le: frame.readUInt32LE(0),
      },
    ];
  }),
);

const dest = path.join(HERE, "independent-node.json");
fs.writeFileSync(dest, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
