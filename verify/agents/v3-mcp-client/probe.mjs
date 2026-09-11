#!/usr/bin/env node
/**
 * Live MCP probe against signed SkyComputerUseClient `mcp`.
 * Read-only: initialize, tools/list, list_apps, get_app_state(Finder).
 * Never click, type, paste, send messages, or dump screenshot bytes.
 */
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CLIENT = path.join(
  os.homedir(),
  ".codex/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient",
);
const OUT_DIR = path.dirname(new URL(import.meta.url).pathname);

function summarize(obj, n = 4000) {
  const s = JSON.stringify(obj);
  return s.length <= n ? obj : JSON.parse(JSON.stringify(obj, (k, v) => {
    if (typeof v === "string" && v.length > 400) return v.slice(0, 400) + `…<${v.length} chars>`;
    if (k.toLowerCase().includes("screenshot") || k.toLowerCase().includes("image") || k === "data" || k === "blob") {
      if (typeof v === "string") return `<omitted ${v.length} chars>`;
      if (v && typeof v === "object") return { omitted: true, keys: Object.keys(v) };
    }
    return v;
  }));
}

function truncateText(s, n = 800) {
  if (s == null) return s;
  const t = String(s);
  return t.length <= n ? t : t.slice(0, n) + `…<${t.length} chars>`;
}

async function runSession({ name, encode, timeoutMs = 25000 }) {
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

  function deliver(msg, via) {
    parseEvents.push({ via, id: msg.id ?? null, method: msg.method ?? null, hasResult: msg.result != null, hasError: msg.error != null });
    if (msg.id != null && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      clearTimeout(p.timer);
      if (msg.error) p.reject(Object.assign(new Error(msg.error.message || JSON.stringify(msg.error)), { rpc: msg.error }));
      else p.resolve(msg.result);
    } else {
      notifications.push(msg);
    }
  }

  child.stdout.on("data", (chunk) => {
    stdoutRaw.push(chunk);
    buf = Buffer.concat([buf, chunk]);
    while (true) {
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
          try { deliver(JSON.parse(json), "content-length"); } catch (e) {
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
      try { deliver(JSON.parse(line), "ndjson"); } catch (e) {
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

  try {
    await record("initialize", () =>
      call("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: { elicitation: {}, roots: { listChanged: false } },
        clientInfo: { name: "codex-cua-reverse-v3", version: "0.0.1" },
      }),
    );
    notify("notifications/initialized", {});
    const listed = await record("tools/list", async () => {
      const r = await call("tools/list", {});
      const tools = r?.tools || [];
      return {
        count: tools.length,
        names: tools.map((t) => t.name),
        tools: tools.map((t) => ({
          name: t.name,
          description: truncateText(t.description, 400),
          inputSchema: t.inputSchema || null,
          annotations: t.annotations || null,
        })),
      };
    });
    const names = listed?.names || [];
    const READ_ONLY = new Set(["list_apps", "get_app_state", "computer_history_get_settings", "computer_history_status", "event_stream_status", "find_chats", "read_messages", "search_messages", "count_message_activity", "read_image"]);
    const BLOCKED = /click|type|press|scroll|drag|set_value|select_text|paste|send|commit|prepare|perform_|update_|start_|stop_|clear_|pause_|resume_/i;
    if (names.includes("list_apps")) {
      await record("tools/call:list_apps", async () => {
        const r = await call("tools/call", { name: "list_apps", arguments: {} }, 30000);
        return summarize(r, 8000);
      });
    }
    if (names.includes("get_app_state")) {
      await record("tools/call:get_app_state:Finder", async () => {
        const r = await call(
          "tools/call",
          { name: "get_app_state", arguments: { app: "Finder", disableDiff: true } },
          45000,
        );
        const clone = JSON.parse(JSON.stringify(r));
        const walk = (o) => {
          if (!o || typeof o !== "object") return;
          for (const [k, v] of Object.entries(o)) {
            if (typeof v === "string") {
              if (/screenshot|image|base64|data:image/i.test(k) || v.startsWith("data:image") || v.startsWith("file://")) {
                o[k] = `<omitted ${v.length} chars ${v.slice(0, 32)}>`;
              } else if (v.length > 600) {
                o[k] = v.slice(0, 600) + `…<${v.length} chars>`;
              }
            } else if (v && typeof v === "object") walk(v);
          }
        };
        walk(clone);
        return clone;
      });
    }
    // extra read-only only if they appeared AND are clearly inventory
    for (const n of names) {
      if (n === "list_apps" || n === "get_app_state") continue;
      if (BLOCKED.test(n) || !READ_ONLY.has(n)) continue;
    }
  } finally {
    try { child.stdin.end(); } catch {}
    child.kill("SIGTERM");
    setTimeout(() => child.kill("SIGKILL"), 800);
    await Promise.race([closed, new Promise((r) => setTimeout(r, 1500))]);
  }

  const stdout = Buffer.concat(stdoutRaw);
  return {
    name,
    client: CLIENT,
    clientExists: fs.existsSync(CLIENT),
    stderr: Buffer.concat(stderrChunks).toString("utf8").slice(0, 8000),
    stdoutBytes: stdout.length,
    stdoutHeadHex: stdout.subarray(0, 80).toString("hex"),
    stdoutHeadUtf8: stdout.subarray(0, 200).toString("utf8"),
    parseEvents: parseEvents.slice(0, 40),
    notificationCount: notifications.length,
    notificationMethods: notifications.map((n) => n.method).filter(Boolean),
    checks,
    passed: checks.filter((c) => c.ok).length,
    failed: checks.filter((c) => !c.ok).length,
  };
}

function encodeContentLength(msg) {
  const json = JSON.stringify(msg);
  return `Content-Length: ${Buffer.byteLength(json, "utf8")}\r\n\r\n${json}`;
}
function encodeNdjson(msg) {
  return JSON.stringify(msg) + "\n";
}

const reports = [];
reports.push(await runSession({ name: "ndjson", encode: encodeNdjson, timeoutMs: 25000 }));
if (reports[0].failed) {
  reports.push(await runSession({ name: "content-length-plus-newline", encode: (m) => encodeContentLength(m) + "\n", timeoutMs: 12000 }));
}

const dest = path.join(OUT_DIR, "probe.json");
fs.writeFileSync(dest, JSON.stringify({ ts: new Date().toISOString(), reports }, null, 2));
console.log(JSON.stringify({ dest, summary: reports.map((r) => ({ name: r.name, passed: r.passed, failed: r.failed, checks: r.checks.map((c) => ({ name: c.name, ok: c.ok, error: c.error || null })), stderr: r.stderr.slice(0, 400), stdoutBytes: r.stdoutBytes, stdoutHeadUtf8: r.stdoutHeadUtf8, parseEvents: r.parseEvents })) }, null, 2));
process.exit(reports.some((r) => r.passed > 0) ? 0 : 1);
