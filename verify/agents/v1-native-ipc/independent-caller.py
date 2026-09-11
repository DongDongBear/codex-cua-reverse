#!/usr/bin/env python3
"""Independent Computer Use native-pipe caller (uint32le + JSON-RPC 2.0)."""
from __future__ import annotations

import json
import os
import socket
import struct
import time
from pathlib import Path

MAX = 8 * 1024 * 1024
SOCK = os.environ.get(
    "SKY_CUA_SERVICE_NATIVE_PIPE_PATH",
    str(
        Path.home()
        / "Library/Group Containers/2DC432GLL2.com.openai.sky.CUAService/IPC/computeruse.sock"
    ),
)
OUT = Path(__file__).resolve().parent
API = "CodexComputerUseIPC-5"


def encode(obj: dict) -> bytes:
    body = json.dumps(obj, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    if len(body) > MAX:
        raise ValueError(f"frame too large: {len(body)}")
    return struct.pack("<I", len(body)) + body


def decode_one(buf: bytes) -> tuple[dict | None, bytes]:
    if len(buf) < 4:
        return None, buf
    (n,) = struct.unpack_from("<I", buf, 0)
    if n > MAX:
        raise ValueError(f"frame too large: {n}")
    if len(buf) < 4 + n:
        return None, buf
    msg = json.loads(buf[4 : 4 + n].decode("utf-8"))
    return msg, buf[4 + n :]


def rpc_once(method: str, params: dict, timeout_s: float = 2.0) -> dict:
    t0 = time.time()
    ev: list[dict] = []
    payload = {
        "jsonrpc": "2.0",
        "id": 1,
        "method": method,
        "params": params,
    }
    frame = encode(payload)
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.settimeout(timeout_s)
    try:
        s.connect(SOCK)
        ev.append({"t_ms": round((time.time() - t0) * 1000, 2), "type": "connect"})
        s.sendall(frame)
        ev.append(
            {
                "t_ms": round((time.time() - t0) * 1000, 2),
                "type": "wrote",
                "frame_len": len(frame),
                "body_len": len(frame) - 4,
            }
        )
        buf = b""
        while True:
            try:
                chunk = s.recv(65536)
            except socket.timeout:
                ev.append({"t_ms": round((time.time() - t0) * 1000, 2), "type": "timeout"})
                return {
                    "ok": False,
                    "error": f"recv timeout {timeout_s}s",
                    "rpc": None,
                    "events": ev,
                    "request": payload,
                    "frame_hex_head": frame[:48].hex(),
                    "frame_len": len(frame),
                }
            if not chunk:
                ev.append(
                    {
                        "t_ms": round((time.time() - t0) * 1000, 2),
                        "type": "eof",
                        "buffered": len(buf),
                    }
                )
                return {
                    "ok": False,
                    "error": "socket closed",
                    "rpc": None,
                    "events": ev,
                    "request": payload,
                    "frame_hex_head": frame[:48].hex(),
                    "frame_len": len(frame),
                    "recv_bytes": len(buf),
                    "recv_hex_head": buf[:32].hex() if buf else "",
                }
            buf += chunk
            ev.append(
                {
                    "t_ms": round((time.time() - t0) * 1000, 2),
                    "type": "data",
                    "bytes": len(chunk),
                }
            )
            msg, rest = decode_one(buf)
            if msg is not None:
                err = msg.get("error")
                return {
                    "ok": err is None,
                    "error": None if err is None else err.get("message"),
                    "rpc": err,
                    "result": msg.get("result"),
                    "response_keys": sorted(msg.keys()) if isinstance(msg, dict) else [],
                    "events": ev,
                    "request": payload,
                    "frame_hex_head": frame[:48].hex(),
                    "frame_len": len(frame),
                    "raw_response": msg,
                }
    except Exception as e:
        ev.append(
            {
                "t_ms": round((time.time() - t0) * 1000, 2),
                "type": "exception",
                "cls": type(e).__name__,
                "message": str(e),
            }
        )
        return {
            "ok": False,
            "error": f"{type(e).__name__}: {e}",
            "rpc": None,
            "events": ev,
            "request": payload,
            "frame_hex_head": frame[:48].hex(),
            "frame_len": len(frame),
        }
    finally:
        try:
            s.close()
        except Exception:
            pass


def connect_only(timeout_s: float = 1.0) -> dict:
    t0 = time.time()
    s = socket.socket(socket.AF_UNIX, socket.SOCK_STREAM)
    s.settimeout(timeout_s)
    try:
        s.connect(SOCK)
        connect_ms = round((time.time() - t0) * 1000, 2)
        try:
            data = s.recv(64)
            recv = "empty" if data == b"" else data[:32].hex()
        except socket.timeout:
            recv = "timeout_still_open"
            data = None
        return {
            "ok": True,
            "connect_ms": connect_ms,
            "recv": recv,
            "elapsed_ms": round((time.time() - t0) * 1000, 2),
        }
    except Exception as e:
        return {"ok": False, "error": f"{type(e).__name__}: {e}"}
    finally:
        try:
            s.close()
        except Exception:
            pass


deadline = int(time.time() * 1000) + 5000
meta = {"source": "v1-independent-python"}

report = {
    "impl": "independent-caller.py",
    "ts": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
    "sock": SOCK,
    "sock_exists": os.path.exists(SOCK),
    "api": API,
    "max_frame": MAX,
    "checks": {},
}

st = os.stat(SOCK) if report["sock_exists"] else None
if st:
    report["sock_stat"] = {
        "mode": oct(st.st_mode),
        "uid": st.st_uid,
        "gid": st.st_gid,
        "ino": st.st_ino,
    }

report["checks"]["connect_only"] = connect_only()
report["checks"]["ping"] = rpc_once("ping", {"clientApiVersion": API})
report["checks"]["list_apps"] = rpc_once(
    "request",
    {
        "clientApiVersion": API,
        "requestType": "ComputerUseIPCListAppsRequest",
        "request": {},
        "deadlineUnixMilliseconds": deadline,
        "codexTurnMetadata": meta,
    },
)
report["checks"]["get_app_state_finder"] = rpc_once(
    "request",
    {
        "clientApiVersion": API,
        "requestType": "ComputerUseIPCAppGetSkyshotRequest",
        "request": {"app": "Finder", "disableDiff": True},
        "deadlineUnixMilliseconds": deadline,
        "codexTurnMetadata": meta,
    },
)
report["checks"]["adversarial_wrong_version"] = rpc_once(
    "ping", {"clientApiVersion": "CodexComputerUseIPC-0"}
)

# Encoded-frame fixtures for cross-impl agreement (fixed JSON, no timestamps).
fixtures = {
    "ping_v5": {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "ping",
        "params": {"clientApiVersion": "CodexComputerUseIPC-5"},
    },
    "ping_v0": {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "ping",
        "params": {"clientApiVersion": "CodexComputerUseIPC-0"},
    },
    "list_apps": {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "request",
        "params": {
            "clientApiVersion": "CodexComputerUseIPC-5",
            "requestType": "ComputerUseIPCListAppsRequest",
            "request": {},
            "deadlineUnixMilliseconds": 0,
            "codexTurnMetadata": {"source": "v1-frame-fixture"},
        },
    },
    "get_skyshot_finder": {
        "jsonrpc": "2.0",
        "id": 1,
        "method": "request",
        "params": {
            "clientApiVersion": "CodexComputerUseIPC-5",
            "requestType": "ComputerUseIPCAppGetSkyshotRequest",
            "request": {"app": "Finder", "disableDiff": True},
            "deadlineUnixMilliseconds": 0,
            "codexTurnMetadata": {"source": "v1-frame-fixture"},
        },
    },
}
report["frame_fixtures"] = {
    name: {
        "json": obj,
        "frame_len": len(encode(obj)),
        "body_len": len(encode(obj)) - 4,
        "sha256_prefix": __import__("hashlib").sha256(encode(obj)).hexdigest()[:16],
        "hex_head": encode(obj)[:24].hex(),
        "prefix_u32le": struct.unpack_from("<I", encode(obj), 0)[0],
    }
    for name, obj in fixtures.items()
}

dest = OUT / "independent-python.json"
dest.write_text(json.dumps(report, indent=2))
print(json.dumps(report, indent=2))
