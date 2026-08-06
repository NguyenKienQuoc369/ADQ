import shlex
import subprocess
import time
from typing import Any, Dict, List, Tuple
from urllib.parse import urlparse


def _normalize_target(target: str) -> str:
    value = (target or "").strip()
    if not value:
        return ""
    if value.startswith("http://") or value.startswith("https://"):
        return value
    return f"https://{value}"


def _extract_host(target: str) -> str:
    normalized = _normalize_target(target)
    if not normalized:
        return ""
    parsed = urlparse(normalized)
    return parsed.hostname or ""


def _build_command(target: str, vuln_type: str) -> Tuple[List[str], str]:
    normalized_target = _normalize_target(target)
    host = _extract_host(target)
    kind = (vuln_type or "").lower()

    if kind.startswith("open_port"):
        port = "80"
        for token in kind.replace(":", "_").split("_"):
            if token.isdigit():
                port = token
                break
        return ["nc", "-zv", "-w", "5", host, port], f"open_port:{port}"

    if kind == "directory_listing":
        return ["curl", "-I", "--max-time", "20", normalized_target], "directory_listing"

    if kind == "config_leak":
        return ["curl", "-sS", "--max-time", "20", f"{normalized_target.rstrip('/')}/.env"], "config_leak"

    return ["curl", "-I", "--max-time", "20", normalized_target], "generic_http"


def run_validation_task(scan_id: str, target: str, vuln_type: str, timeout: int = 60) -> Dict[str, Any]:
    started = time.time()
    command, resolved_type = _build_command(target=target, vuln_type=vuln_type)
    safe_command = " ".join(shlex.quote(part) for part in command)

    if not target:
        return {
            "scan_id": scan_id,
            "status": "FAILED",
            "target": target,
            "vuln_type": resolved_type,
            "command": safe_command,
            "raw_output": "Missing target",
            "return_code": None,
            "duration_seconds": round(time.time() - started, 3),
        }

    try:
        result = subprocess.run(
            command,
            capture_output=True,
            text=True,
            timeout=timeout,
            check=False,
        )
        output = "\n".join([result.stdout.strip(), result.stderr.strip()]).strip()
        status = "SUCCESS" if result.returncode == 0 else "FAILED"
        return {
            "scan_id": scan_id,
            "status": status,
            "target": target,
            "vuln_type": resolved_type,
            "command": safe_command,
            "raw_output": output,
            "return_code": result.returncode,
            "duration_seconds": round(time.time() - started, 3),
        }
    except subprocess.TimeoutExpired as exc:
        timeout_output = "\n".join([
            (exc.stdout or "").strip() if isinstance(exc.stdout, str) else "",
            (exc.stderr or "").strip() if isinstance(exc.stderr, str) else "",
        ]).strip()
        return {
            "scan_id": scan_id,
            "status": "TIMEOUT",
            "target": target,
            "vuln_type": resolved_type,
            "command": safe_command,
            "raw_output": timeout_output or f"Timeout after {timeout}s",
            "return_code": None,
            "duration_seconds": round(time.time() - started, 3),
        }
    except Exception as exc:
        return {
            "scan_id": scan_id,
            "status": "FAILED",
            "target": target,
            "vuln_type": resolved_type,
            "command": safe_command,
            "raw_output": str(exc),
            "return_code": None,
            "duration_seconds": round(time.time() - started, 3),
        }
