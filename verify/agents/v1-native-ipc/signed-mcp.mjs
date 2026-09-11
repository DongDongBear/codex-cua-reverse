#!/usr/bin/env node
/**
 * Official SkyComputerUseClient MCP (signed helper). Read-only: list + Finder state.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CLIENT = path.join(
  os.homedir(),
  ".codex/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient",
);

function encode(msg) {
  const json = JSON.stringify(msg);
  return `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`;
}

function redact(value, depth = 0) {
  if (value == null || depth > 8) return value;
  if (typeof value === "string") {
    if (/^data:image\//i.test(value) || value.startsWith("file://")) {
      return `<redacted ${value.split(":")[0]} url, ${value.length} chars>`;
    }
    if (value.length > 1200) return `${value.slice(0, 400)}\n…<truncated ${value.length} chars>`;
    return value;
  }
  if (Array.isArray(value)) return value.slice(0, 20).map((v) => redact(v, depth + 1));
  if (typeof value === "object") {
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (/screenshot|image|bytes|png|jpeg|base64/i.test(k) && typeof v === "string" && v.length > 80) {
        out[k] = `<redacted ${k}, ${v.length} chars>`;
      } else {
        out[k] = redact(v, depth + 1);
      }
    }
    return out;
  }
  return value;
}

function createReader(stream, onMsg, onRaw) {
  let buf = Buffer.alloc(0);
  stream.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    onRaw?.(chunk);
    while (true) {
      const headerEnd = buf.indexOf("\r\n\r\n");
      if (headerEnd !== -1) {
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
        try {
          onMsg(JSON.parse(json), "content-length");
        } catch (e) {
          onMsg({ parseError: String(e), jsonHead: json.slice(0, 200) }, "content-length-parse-error");
        }
        continue;
      }
      const nl = buf.indexOf("\n");
      if (nl === -1) return;
      const line = buf.subarray(0, nl).toString("utf8").trim();
      buf = buf.subarray(nl + 1);
      if (!line || line.toLowerCase().startsWith("content-length")) continue;
      try {
        onMsg(JSON.parse(line), "ndjson");
      } catch {
        return;
      }
    }
  });
}

const child = spawn(CLIENT, ["mcp"], {
  stdio: ["pipe", "pipe", "pipe"],
  env: { ...process.env, CODEX_HOME: path.join(os.homedir(), ".codex") },
});

const pending = new Map();
let nextId = 1;
const stderrChunks = [];
const stdoutHead = [];
let stdoutBytes = 0;
child.stderr.on("data", (d) => {
  const t = d.toString("utf8");
  if (stderrChunks.join("").length < 4000) stderrChunks.push(t.slice(0, 1000));
});

createReader(
  child.stdout,
  (msg, framing) => {
    if (stdoutHead.length < 8) stdoutHead.push({ framing, keys: msg && typeof msg === "object" ? Object.keys(msg) : [], id: msg?.id, method: msg?.method });
    if (msg && msg.id != null && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.error) p.reject(Object.assign(new Error(msg.error.message || JSON.stringify(msg.error)), { rpc: msg.error }));
      else p.resolve({ result: msg.result, framing, response_keys: Object.keys(msg) });
    }
  },
  (chunk) => {
    stdoutBytes += chunk.length;
  },
);

function call(method, params, timeoutMs = 20000) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error(`${method} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    pending.set(id, { resolve, reject, timer });
    try {
      child.stdin.write(encode({ jsonrpc: "2.0", id, method, params }));
    } catch (e) {
      pending.delete(id);
      clearTimeout(timer);
      reject(e);
    }
  });
}

const checks = [];
async function record(name, fn) {
  const t0 = Date.now();
  try {
    const detail = await fn();
    checks.push({ name, ok: true, ms: Date.now() - t0, detail: redact(detail) });
  } catch (err) {
    checks.push({
      name,
      ok: false,
      ms: Date.now() - t0,
      error: err.message,
      rpc: err.rpc || null,
    });
  }
}

const lsofBefore = [];
try {
  const { execSync } = await import("node:child_process");
  lsofBefore.push(
    execSync("lsof -p " + child.pid + " 2>/dev/null | grep -i computeruse || true", {
      encoding: "utf8",
    }).trim(),
  );
} catch {}

try {
  await record("initialize", () =>
    call("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: {},
      clientInfo: { name: "v1-native-ipc", version: "0.0.1" },
    }),
  );
  try {
    child.stdin.write(encode({ jsonrpc: "2.0", method: "notifications/initialized" }));
  } catch {}
  await record("tools/list", async () => {
    const r = await call("tools/list", {});
    const tools = r.result?.tools || [];
    return {
      framing: r.framing,
      response_keys: r.response_keys,
      count: tools.length,
      names: tools.map((t) => t.name),
      schemas: tools.map((t) => ({
        name: t.name,
        required: t.inputSchema?.required || [],
        keys: t.inputSchema?.properties ? Object.keys(t.inputSchema.properties) : [],
      })),
    };
  });
  const listed = checks.find((c) => c.name === "tools/list" && c.ok);
  const names = listed?.detail?.names || [];
  const listTool = names.find((n) => n === "list_apps") || names.find((n) => /list_app/i.test(n));
  const stateTool =
    names.find((n) => n === "get_app_state") || names.find((n) => /get_app_state|skyshot/i.test(n));
  if (listTool) {
    await record(`tools/call:${listTool}`, async () => {
      const r = await call("tools/call", { name: listTool, arguments: {} }, 30000);
      const result = r.result;
      const content = result?.content;
      return {
        framing: r.framing,
        response_keys: r.response_keys,
        result_keys: result && typeof result === "object" ? Object.keys(result) : [],
        isError: result?.isError || false,
        contentTypes: Array.isArray(content) ? content.map((c) => c.type) : null,
        preview: result,
      };
    });
  } else {
    checks.push({ name: "tools/call:list_apps", ok: false, error: "list_apps tool not in tools/list", rpc: null });
  }
  if (stateTool) {
    await record(`tools/call:${stateTool}:Finder`, async () => {
      const r = await call(
        "tools/call",
        { name: stateTool, arguments: { app: "Finder", disableDiff: true } },
        30000,
      );
      const result = r.result;
      return {
        framing: r.framing,
        response_keys: r.response_keys,
        result_keys: result && typeof result === "object" ? Object.keys(result) : [],
        isError: result?.isError || false,
        preview: result,
      };
    });
  }
} finally {
  try {
    child.kill("SIGTERM");
  } catch {}
  setTimeout(() => {
    try {
      child.kill("SIGKILL");
    } catch {}
  }, 800);
}

const report = {
  ts: new Date().toISOString(),
  client: CLIENT,
  clientExists: fs.existsSync(CLIENT),
  childPid: child.pid,
  stdoutBytes,
  stdoutHead,
  stderr: stderrChunks.join("").slice(0, 2500),
  lsofBefore,
  checks,
  passed: checks.filter((c) => c.ok).length,
  failed: checks.filter((c) => !c.ok).length,
};
const dest = path.join(HERE, "signed-mcp.json");
fs.writeFileSync(dest, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
process.exit(report.failed ? 1 : 0);
