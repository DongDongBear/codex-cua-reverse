#!/usr/bin/env python3
"""Drive CUA through the real node_repl MCP (trusted sender), using reversed APIs."""
from __future__ import annotations

import json
import os
import select
import subprocess
import sys
import time
from pathlib import Path

HOME = Path.home()
CUA_NODE = Path("/Applications/ChatGPT.app/Contents/Resources/cua_node")
PLUGIN = Path(
    "/Applications/ChatGPT.app/Contents/Resources/plugins/openai-bundled/plugins/unified-computer-use"
)
REPL = CUA_NODE / "bin/node_repl"
OUT = Path("/Users/dongdong/Desktop/codex-cua-reverse/verify/results")
OUT.mkdir(parents=True, exist_ok=True)


def banner() -> str:
    return (PLUGIN / "resources/banner.js").read_text()


def env() -> dict[str, str]:
    e = os.environ.copy()
    e.pop("CODEX_CLI_PATH", None)  # avoid extra sandbox wrapping
    e.update(
        {
            "HOME": str(HOME),
            "CODEX_HOME": str(HOME / ".codex"),
            "CUA_REPL_ENABLED_SURFACES": "browser,computer",
            "CUA_REPL_NODE_REPL_PATH": str(REPL),
            "BROWSER_USE_TINYSKY_ENABLED": "1",
            "BROWSER_USE_AVAILABLE_BACKENDS": "chrome,iab",
            "NODE_REPL_TRUSTED_RPC_ENABLED": "1",
            "NODE_REPL_NODE_PATH": str(CUA_NODE / "bin/node"),
            "NODE_REPL_NODE_MODULE_DIRS": str(CUA_NODE / "lib/node_modules"),
            "NODE_REPL_TRUSTED_CODE_PATHS": f"{HOME / '.codex'}:{CUA_NODE / 'lib/node_modules'}",
            "NODE_REPL_TRUSTED_SERVICES": json.dumps(
                {
                    "browser": "@oai/browser-desktop/service",
                    "sky": "@oai/sky/service",
                }
            ),
            "NODE_REPL_JS_BANNER": banner(),
            "NODE_REPL_NATIVE_PIPE_CONNECT_TIMEOUT_MS": "5000",
            "NODE_REPL_SANDBOX_ALLOWED_UNIX_SOCKETS": ",".join(
                [
                    str(
                        HOME
                        / "Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock"
                    ),
                    "/tmp/codex-browser-use",
                ]
            ),
            "SKY_CUA_SERVICE_PATH": str(
                HOME / ".codex/computer-use/Codex Computer Use.app"
            ),
            "SKY_CUA_SERVICE_NATIVE_PIPE_PATH": str(
                HOME
                / "Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock"
            ),
            "NODE_REPL_INSTRUCTIONS_USE_CASE_BROWSER": "Control",
            "NODE_REPL_INSTRUCTIONS_USE_CASE_CHROME": "Control",
            "NODE_REPL_INSTRUCTIONS_USE_CASE_COMPUTER_USE": "Control",
            "NODE_REPL_REQUEST_META": json.dumps(
                {
                    "x-codex-turn-metadata": {
                        "session_id": "debug-cua-reverse",
                        "turn_id": "debug-turn-1",
                    }
                }
            ),
        }
    )
    return e


class Mcp:
    def __init__(self, proc: subprocess.Popen):
        self.proc = proc
        self.buf = b""
        self.mode = None  # "ndjson" | "lsp"
        self.next_id = 1

    def _read_raw(self, timeout: float) -> bytes | None:
        end = time.time() + timeout
        while time.time() < end:
            r, _, _ = select.select([self.proc.stdout], [], [], 0.2)
            if not r:
                if self.proc.poll() is not None:
                    return None
                continue
            chunk = os.read(self.proc.stdout.fileno(), 65536)
            if not chunk:
                return None
            self.buf += chunk
            return chunk
        return b""

    def read_msg(self, timeout: float = 20.0):
        end = time.time() + timeout
        while time.time() < end:
            if self.mode in (None, "lsp") and b"\r\n\r\n" in self.buf:
                header, rest = self.buf.split(b"\r\n\r\n", 1)
                m = None
                for line in header.decode("utf-8", "replace").split("\r\n"):
                    if line.lower().startswith("content-length:"):
                        m = int(line.split(":", 1)[1].strip())
                if m is not None:
                    if len(rest) < m:
                        self._read_raw(max(0.1, end - time.time()))
                        continue
                    body, self.buf = rest[:m], rest[m:]
                    self.mode = "lsp"
                    return json.loads(body)
            if b"\n" in self.buf:
                line, self.buf = self.buf.split(b"\n", 1)
                line = line.strip()
                if not line:
                    continue
                if line.lower().startswith(b"content-length"):
                    continue
                try:
                    msg = json.loads(line)
                    self.mode = self.mode or "ndjson"
                    return msg
                except json.JSONDecodeError:
                    continue
            got = self._read_raw(max(0.1, end - time.time()))
            if got is None:
                return None
        return None

    def send(self, obj: dict):
        raw = json.dumps(obj, separators=(",", ":")).encode()
        if self.mode == "lsp":
            self.proc.stdin.write(f"Content-Length: {len(raw)}\r\n\r\n".encode() + raw)
        else:
            self.proc.stdin.write(raw + b"\n")
        self.proc.stdin.flush()

    def call(self, method: str, params=None, timeout: float = 30.0):
        i = self.next_id
        self.next_id += 1
        msg = {"jsonrpc": "2.0", "id": i, "method": method}
        if params is not None:
            msg["params"] = params
        self.send(msg)
        deadline = time.time() + timeout
        while time.time() < deadline:
            m = self.read_msg(max(0.2, deadline - time.time()))
            if m is None:
                break
            if m.get("id") == i:
                return m
            # notifications
        return {"error": {"message": f"timeout waiting for {method}"}}


def scrub(obj, limit=2500):
    """Drop huge base64 images; keep text."""
    if isinstance(obj, dict):
        out = {}
        for k, v in obj.items():
            if k in ("data", "image", "bytes") and isinstance(v, str) and len(v) > 200:
                out[k] = f"<omitted {len(v)} chars>"
            elif isinstance(v, str) and v.startswith("data:image"):
                out[k] = v[:32] + f"...<{len(v)}>"
            else:
                out[k] = scrub(v, limit)
        return out
    if isinstance(obj, list):
        return [scrub(x, limit) for x in obj[:40]]
    if isinstance(obj, str) and len(obj) > limit:
        return obj[:limit] + f"...<{len(obj)} chars>"
    return obj


def text_from_result(msg) -> str:
    result = (msg or {}).get("result") or {}
    parts = result.get("content") or []
    bits = []
    for p in parts:
        if isinstance(p, dict) and p.get("type") == "text":
            bits.append(p.get("text") or "")
        elif isinstance(p, dict) and p.get("type") in ("image", "image_url"):
            bits.append("[image]")
    return "\n".join(bits)


def main():
    stderr_path = OUT / "debug-live.stderr.log"
    errf = open(stderr_path, "wb")
    proc = subprocess.Popen(
        [str(REPL)],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=errf,
        env=env(),
        cwd=str(PLUGIN),
    )
    mcp = Mcp(proc)
    log = {"ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()), "steps": []}

    def step(name, fn):
        t0 = time.time()
        try:
            msg = fn()
        except Exception as e:
            rec = {"name": name, "ok": False, "error": str(e), "ms": int((time.time() - t0) * 1000)}
            log["steps"].append(rec)
            print("STEP", name, "EXC", e)
            return rec
        rec = {
            "name": name,
            "ok": "error" not in (msg or {}) and not ((msg or {}).get("result") or {}).get("isError"),
            "ms": int((time.time() - t0) * 1000),
            "mode": mcp.mode,
            "text": text_from_result(msg)[:4000],
            "raw": scrub(msg),
        }
        log["steps"].append(rec)
        print("====", name, "ok=", rec["ok"], "ms=", rec["ms"], "mode=", mcp.mode)
        print(rec["text"][:1500] or json.dumps(scrub(msg))[:1500])
        print()
        return rec

    try:
        # probe framing with initialize (ndjson first; if timeout, retry lsp)
        step(
            "initialize",
            lambda: mcp.call(
                "initialize",
                {
                    "protocolVersion": "2024-11-05",
                    "capabilities": {},
                    "clientInfo": {"name": "codex-cua-reverse-debug", "version": "0.1"},
                },
                timeout=15,
            ),
        )
        if mcp.mode is None:
            mcp.mode = "lsp"
            mcp.buf = b""
            step(
                "initialize-lsp",
                lambda: mcp.call(
                    "initialize",
                    {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {},
                        "clientInfo": {"name": "codex-cua-reverse-debug", "version": "0.1"},
                    },
                    timeout=15,
                ),
            )
        mcp.send({"jsonrpc": "2.0", "method": "notifications/initialized"})
        step("tools/list", lambda: mcp.call("tools/list", {}, timeout=15))

        def js(code: str, title: str, timeout_ms: int = 45000):
            return mcp.call(
                "tools/call",
                {
                    "name": "js",
                    "arguments": {"code": code, "title": title, "timeout_ms": timeout_ms},
                },
                timeout=timeout_ms / 1000 + 15,
            )

        step(
            "js:rpc-sky-setup",
            lambda: js(
                """
try {
  const r = await nodeRepl.rpc("sky", { type: "setup" });
  nodeRepl.write("SKY_SETUP " + JSON.stringify(r));
} catch (e) {
  nodeRepl.write("SKY_SETUP_ERR " + (e && e.message ? e.message : String(e)));
}
try {
  const r = await nodeRepl.rpc("browser", {
    method: "setup",
    params: { environment: "codex-app", undocumentedApiMembers: ["Tab.ax"] },
  });
  nodeRepl.write("BROWSER_SETUP keys=" + Object.keys(r||{}).join(",") + " disabled=" + JSON.stringify(r && r.disabledMemberIds));
} catch (e) {
  nodeRepl.write("BROWSER_SETUP_ERR " + (e && e.message ? e.message : String(e)));
}
try {
  const r = await nodeRepl.rpc("sky", { type: "execute", method: "list_apps", args: [] });
  const n = Array.isArray(r) ? r.length : (r && r.apps && r.apps.length);
  nodeRepl.write("SKY_LIST_APPS n=" + n + " sample=" + JSON.stringify(r).slice(0, 500));
} catch (e) {
  nodeRepl.write("SKY_LIST_APPS_ERR " + (e && e.message ? e.message : String(e)));
}
"rpc-probed";
""".strip(),
                "debug rpc setup",
            ),
        )
        step(
            "js:probe-nodeRepl",
            lambda: js(
                """
const names = Object.getOwnPropertyNames(nodeRepl);
const out = {
  names,
  nativePipe: nodeRepl.nativePipe && Object.getOwnPropertyNames(nodeRepl.nativePipe),
  launchServices: nodeRepl.launchServices && Object.getOwnPropertyNames(nodeRepl.launchServices),
  rpc: typeof nodeRepl.rpc,
  requestMeta: nodeRepl.requestMeta,
};
nodeRepl.write(JSON.stringify(out, null, 2));
"probed";
""".strip(),
                "debug probe nodeRepl",
            ),
        )
        step(
            "js:listApps",
            lambda: js(
                """
try {
  if (nodeRepl.launchServices?.openApplication) {
    await nodeRepl.launchServices.openApplication({
      bundleIdentifier: "com.openai.sky.CUAService",
    });
  }
} catch (e) {
  nodeRepl.write("launchServices: " + (e && e.message ? e.message : String(e)));
}
try {
  const apps = await cua.listApps();
  nodeRepl.write(JSON.stringify(apps.slice(0,15).map(a=>({id:a.id,displayName:a.displayName,isRunning:a.isRunning}))));
  apps.length;
} catch (e) {
  nodeRepl.write("listApps error: " + (e && e.message ? e.message : String(e)) + " cause=" + (e && e.cause && e.cause.message));
  throw e;
}
""".strip(),
                "debug listApps",
            ),
        )
        step(
            "js:getApp Finder Raise",
            lambda: js(
                """
let app = await cua.getApp("Finder");
await app.performSecondaryAction(0, "Raise");
const ax = await app.getAXState({ emit: false, disableDiffing: true });
nodeRepl.write(ax.split("\\n").slice(0, 25).join("\\n"));
"raised-finder";
""".strip(),
                "debug raise Finder",
                60000,
            ),
        )
        step(
            "js:getBrowser listTabs",
            lambda: js(
                """
const browser = await cua.getBrowser();
const tabs = await cua.listTabs({ browser: browser.browserId, emit: false });
nodeRepl.write(JSON.stringify({ browserId: browser.browserId, n: tabs.length, tabs: tabs.slice(0,8) }));
tabs.length;
""".strip(),
                "debug listTabs",
                60000,
            ),
        )
        step(
            "js:open visible IAB example.com",
            lambda: js(
                """
const tab = await cua.createBrowserTab("iab", "https://example.com", { visible: true });
const ax = await tab.getAXState({ emit: false, disableDiffing: true });
nodeRepl.write(ax.split("\\n").slice(0, 20).join("\\n"));
"opened-iab";
""".strip(),
                "debug open IAB example.com",
                90000,
            ),
        )
    finally:
        proc.kill()
        errf.close()
        stderr = stderr_path.read_text(errors="replace")[-4000:]
        log["stderr_tail"] = stderr
        dest = OUT / "debug-live.json"
        dest.write_text(json.dumps(log, ensure_ascii=False, indent=2))
        print("WROTE", dest)
        print("STDERR_TAIL:\n", stderr)


if __name__ == "__main__":
    main()
