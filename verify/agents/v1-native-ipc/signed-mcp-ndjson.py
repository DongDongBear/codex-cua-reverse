#!/usr/bin/env python3
"""NDJSON MCP client for SkyComputerUseClient. Read-only list_apps + Finder get_app_state."""
from __future__ import annotations

import json
import os
import subprocess
import threading
import time
from pathlib import Path

CLIENT = Path.home() / (
    ".codex/computer-use/Codex Computer Use.app/Contents/SharedSupport/"
    "SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient"
)
OUT = Path(__file__).resolve().parent


def redact(value, depth=0):
    if value is None or depth > 8:
        return value
    if isinstance(value, str):
        if value.startswith("data:image/") or value.startswith("file://"):
            return f"<redacted {value.split(':', 1)[0]} url, {len(value)} chars>"
        if len(value) > 1200:
            return value[:400] + f"\n…<truncated {len(value)} chars>"
        return value
    if isinstance(value, list):
        return [redact(v, depth + 1) for v in value[:25]]
    if isinstance(value, dict):
        out = {}
        for k, v in value.items():
            if isinstance(v, str) and len(v) > 80 and any(
                x in k.lower() for x in ("screenshot", "image", "bytes", "png", "jpeg", "base64")
            ):
                out[k] = f"<redacted {k}, {len(v)} chars>"
            else:
                out[k] = redact(v, depth + 1)
        return out
    return value


class NdjsonMcp:
    def __init__(self):
        env = os.environ.copy()
        env["CODEX_HOME"] = str(Path.home() / ".codex")
        self.proc = subprocess.Popen(
            [str(CLIENT), "mcp"],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=env,
        )
        self.buf = b""
        self.msgs = []
        self.stderr = b""
        self.lock = threading.Lock()
        self._alive = True
        threading.Thread(target=self._read_out, daemon=True).start()
        threading.Thread(target=self._read_err, daemon=True).start()

    def _read_out(self):
        while self._alive:
            b = self.proc.stdout.read(1)
            if not b:
                break
            self.buf += b
            while b"\n" in self.buf:
                line, self.buf = self.buf.split(b"\n", 1)
                line = line.strip()
                if not line:
                    continue
                try:
                    msg = json.loads(line.decode("utf-8"))
                except Exception as e:
                    msg = {"parseError": str(e), "line": line[:200].decode("utf-8", "replace")}
                with self.lock:
                    self.msgs.append(msg)

    def _read_err(self):
        while self._alive:
            b = self.proc.stderr.read(4096)
            if not b:
                break
            self.stderr += b

    def send(self, obj: dict):
        line = json.dumps(obj, separators=(",", ":")).encode("utf-8") + b"\n"
        self.proc.stdin.write(line)
        self.proc.stdin.flush()

    def wait_id(self, id_, timeout=20.0):
        t0 = time.time()
        while time.time() - t0 < timeout:
            with self.lock:
                for i, m in enumerate(self.msgs):
                    if m.get("id") == id_:
                        self.msgs.pop(i)
                        return m
            time.sleep(0.02)
        with self.lock:
            pending = list(self.msgs)
        raise TimeoutError(f"id={id_} timeout; pending={pending[:5]}")

    def call(self, id_, method, params=None, timeout=20.0):
        req = {"jsonrpc": "2.0", "id": id_, "method": method}
        if params is not None:
            req["params"] = params
        self.send(req)
        return self.wait_id(id_, timeout)

    def close(self):
        self._alive = False
        try:
            self.proc.kill()
        except Exception:
            pass


def summarize_apps(result):
    # MCP tool result is typically {content:[{type:text,text:...}], isError?}
    text = ""
    if isinstance(result, dict):
        content = result.get("content")
        if isinstance(content, list):
            for c in content:
                if isinstance(c, dict) and c.get("type") == "text":
                    text += str(c.get("text") or "")
        if not text:
            text = json.dumps(result)[:2000]
    apps = None
    parsed = None
    try:
        parsed = json.loads(text) if text.strip().startswith(("{", "[")) else None
    except Exception:
        parsed = None
    src = parsed if parsed is not None else result
    if isinstance(src, dict):
        apps = src.get("apps") or src.get("discoveredApps") or src.get("items")
    if isinstance(src, list):
        apps = src
    sample = []
    finder = None
    if isinstance(apps, list):
        for a in apps[:12]:
            if not isinstance(a, dict):
                continue
            sample.append(
                {
                    "id": a.get("bundleIdentifier") or a.get("id") or a.get("app"),
                    "displayName": a.get("displayName") or a.get("name"),
                    "isRunning": a.get("isRunning"),
                }
            )
        for a in apps:
            if not isinstance(a, dict):
                continue
            bid = str(a.get("bundleIdentifier") or a.get("id") or "")
            name = str(a.get("displayName") or a.get("name") or "")
            if bid == "com.apple.finder" or name == "Finder":
                finder = {"bundleIdentifier": bid, "displayName": name, "isRunning": a.get("isRunning")}
                break
    return {
        "result_keys": list(result.keys()) if isinstance(result, dict) else [],
        "isError": bool(isinstance(result, dict) and result.get("isError")),
        "app_count": len(apps) if isinstance(apps, list) else None,
        "sample": sample,
        "finder": finder,
        "text_head": text[:800],
    }


def summarize_state(result):
    text = ""
    if isinstance(result, dict):
        content = result.get("content")
        if isinstance(content, list):
            for c in content:
                if isinstance(c, dict) and c.get("type") == "text":
                    text += str(c.get("text") or "")
    lines = text.splitlines()[:12]
    return {
        "result_keys": list(result.keys()) if isinstance(result, dict) else [],
        "isError": bool(isinstance(result, dict) and result.get("isError")),
        "content_types": [
            c.get("type")
            for c in (result.get("content") if isinstance(result, dict) else []) or []
            if isinstance(c, dict)
        ],
        "text_chars": len(text),
        "text_head": "\n".join(lines),
        "has_image_content": any(
            isinstance(c, dict) and c.get("type") in ("image", "resource")
            for c in (result.get("content") if isinstance(result, dict) else []) or []
        ),
    }


mcp = NdjsonMcp()
checks = []
lsof_mid = ""


def record(name, fn):
    t0 = time.time()
    try:
        detail = fn()
        checks.append({"name": name, "ok": True, "ms": round((time.time() - t0) * 1000), "detail": redact(detail)})
        return detail
    except Exception as e:
        checks.append(
            {
                "name": name,
                "ok": False,
                "ms": round((time.time() - t0) * 1000),
                "error": str(e),
                "rpc": getattr(e, "rpc", None),
            }
        )
        return None


try:
    record(
        "initialize",
        lambda: mcp.call(
            1,
            "initialize",
            {
                "protocolVersion": "2024-11-05",
                "capabilities": {},
                "clientInfo": {"name": "v1-native-ipc", "version": "0.0.1"},
            },
            timeout=8,
        ),
    )
    mcp.send({"jsonrpc": "2.0", "method": "notifications/initialized"})
    listed = record("tools/list", lambda: mcp.call(2, "tools/list", {}, timeout=8))
    names = []
    if listed and listed.get("result"):
        names = [t.get("name") for t in listed["result"].get("tools") or []]
        checks[-1]["detail"] = {
            "response_keys": list(listed.keys()),
            "result_keys": list(listed["result"].keys()),
            "count": len(names),
            "names": names,
            "schemas": [
                {
                    "name": t.get("name"),
                    "required": (t.get("inputSchema") or {}).get("required") or [],
                    "keys": list(((t.get("inputSchema") or {}).get("properties") or {}).keys()),
                }
                for t in listed["result"].get("tools") or []
            ],
        }
    list_tool = "list_apps" if "list_apps" in names else next((n for n in names if "list_app" in n), None)
    state_tool = "get_app_state" if "get_app_state" in names else next((n for n in names if "get_app_state" in n or "skyshot" in n), None)

    def lsof_client():
        try:
            return subprocess.check_output(
                ["bash", "-lc", f"lsof -p {mcp.proc.pid} 2>/dev/null | grep -i -E 'computeruse|unix' | head -40"],
                text=True,
            )
        except Exception as e:
            return str(e)

    global_lsof = lsof_client()

    if list_tool:
        def do_list():
            msg = mcp.call(3, "tools/call", {"name": list_tool, "arguments": {}}, timeout=25)
            if "error" in msg:
                return {"jsonrpc_error": msg["error"], "response_keys": list(msg.keys())}
            return {
                "response_keys": list(msg.keys()),
                "summary": summarize_apps(msg.get("result")),
            }

        record(f"tools/call:{list_tool}", do_list)
    else:
        checks.append({"name": "tools/call:list_apps", "ok": False, "error": "tool missing", "rpc": None})

    if state_tool:
        def do_state():
            msg = mcp.call(
                4,
                "tools/call",
                {"name": state_tool, "arguments": {"app": "Finder", "disableDiff": True}},
                timeout=25,
            )
            if "error" in msg:
                return {"jsonrpc_error": msg["error"], "response_keys": list(msg.keys())}
            return {
                "response_keys": list(msg.keys()),
                "summary": summarize_state(msg.get("result")),
            }

        record(f"tools/call:{state_tool}:Finder", do_state)
    else:
        checks.append({"name": "tools/call:get_app_state", "ok": False, "error": "tool missing", "rpc": None})

    lsof_mid = lsof_client()
finally:
    mcp.close()

report = {
    "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "client": str(CLIENT),
    "clientExists": CLIENT.exists(),
    "childPid": mcp.proc.pid,
    "framing": "ndjson",
    "stderr": mcp.stderr.decode("utf-8", "replace")[:2000],
    "lsof": lsof_mid,
    "checks": checks,
    "passed": sum(1 for c in checks if c.get("ok")),
    "failed": sum(1 for c in checks if not c.get("ok")),
}
(OUT / "signed-mcp-ndjson.json").write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
