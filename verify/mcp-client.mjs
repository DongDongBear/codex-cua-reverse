#!/usr/bin/env node
/**
 * Speak MCP to the signed SkyComputerUseClient (official native client).
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CLIENT = path.join(
  os.homedir(),
  ".codex/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient",
);

function encode(msg) {
  const json = JSON.stringify(msg);
  return `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`;
}

function createReader(stream, onMsg) {
  let buf = Buffer.alloc(0);
  stream.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (true) {
      const headerEnd = buf.indexOf("\r\n\r\n");
      if (headerEnd === -1) {
        // maybe newline-delimited JSON
        const nl = buf.indexOf("\n");
        if (nl === -1) return;
        const line = buf.subarray(0, nl).toString("utf8").trim();
        buf = buf.subarray(nl + 1);
        if (!line || line.toLowerCase().startsWith("content-length")) continue;
        try {
          onMsg(JSON.parse(line));
        } catch {
          return;
        }
        continue;
      }
      const header = buf.subarray(0, headerEnd).toString("utf8");
      const m = /Content-Length:\s*(\d+)/i.exec(header);
      if (!m) {
        buf = buf.subarray(headerEnd + 4);
        continue;
      }
      const len = Number(m[1]);
      const start = headerEnd + 4;
      if (buf.length < start + len) return;
      const json = buf.subarray(start, start + len).toString("utf8");
      buf = buf.subarray(start + len);
      onMsg(JSON.parse(json));
    }
  });
}

const child = spawn(CLIENT, ["mcp"], {
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, CODEX_HOME: path.join(os.homedir(), ".codex") },
});

const pending = new Map();
let nextId = 1;
const stderr = [];
child.stderr.on("data", (d) => {
  stderr.push(d.toString("utf8").slice(0, 500));
});

createReader(child.stdout, (msg) => {
  if (msg.id != null && pending.has(msg.id)) {
    const p = pending.get(msg.id);
    pending.delete(msg.id);
    clearTimeout(p.timer);
    if (msg.error) p.reject(Object.assign(new Error(msg.error.message || JSON.stringify(msg.error)), { rpc: msg.error }));
    else p.resolve(msg.result);
  }
});

function call(method, params, timeoutMs = 20000) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    child.stdin.write(encode({ jsonrpc: "2.0", id, method, params }));
  });
}

const checks = [];
async function record(name, fn) {
  try {
    checks.push({ name, ok: true, detail: await fn() });
  } catch (err) {
    checks.push({ name, ok: false, error: err.message, rpc: err.rpc || null });
  }
}

try {
  await record("initialize", () =>
    call("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "codex-cua-reverse-verify", version: "0.0.1" },
    }),
  );
  child.stdin.write(encode({ jsonrpc: "2.0", method: "notifications/initialized" }));
  await record("tools/list", async () => {
    const r = await call("tools/list", {});
    const tools = r?.tools || [];
    return {
      count: tools.length,
      names: tools.map((t) => t.name),
      schemas: tools.map((t) => ({
        name: t.name,
        keys: t.inputSchema?.properties ? Object.keys(t.inputSchema.properties) : [],
      })),
    };
  });
  const listed = checks.find((c) => c.name === "tools/list" && c.ok);
  const names = listed?.detail?.names || [];
  const listTool = names.find((n) => /list_app/i.test(n)) || names.find((n) => /list/i.test(n));
  if (listTool) {
    await record(`tools/call:${listTool}`, async () => {
      const r = await call("tools/call", { name: listTool, arguments: {} }, 30000);
      const text = JSON.stringify(r).slice(0, 1500);
      return { preview: text };
    });
  }
} finally {
  child.kill("SIGTERM");
  setTimeout(() => child.kill("SIGKILL"), 1000);
}

const report = {
  ts: new Date().toISOString(),
  client: CLIENT,
  clientExists: fs.existsSync(CLIENT),
  stderr: stderr.join("").slice(0, 2000),
  checks,
  passed: checks.filter((c) => c.ok).length,
  failed: checks.filter((c) => !c.ok).length,
};
const dest = path.join(path.dirname(new URL(import.meta.url).pathname), "results/mcp-client.json");
fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.failed ? 1 : 0);
