import json
import importlib
from typing import Any, Dict, List, Optional

try:
    from config import config
except ImportError:
    from backend.config import config

SupabaseClient = Any

def _get_supabase_client() -> SupabaseClient:
    try:
        supabase_module = importlib.import_module("supabase")
    except ImportError as exc:
        raise ImportError("supabase package not installed. Run 'pip install supabase' or update requirements.txt.")
    create_client = getattr(supabase_module, "create_client", None)
    if create_client is None:
        raise ImportError("supabase.create_client is unavailable in installed supabase package")
    if not config.SUPABASE_URL or not config.SUPABASE_KEY:
        raise ValueError("SUPABASE_URL and SUPABASE_KEY must be set in environment or .env")
    return create_client(config.SUPABASE_URL, config.SUPABASE_KEY)


_SUPABASE_CLIENT: Optional[SupabaseClient] = None


def get_supabase_client() -> SupabaseClient:
    global _SUPABASE_CLIENT
    if _SUPABASE_CLIENT is None:
        _SUPABASE_CLIENT = _get_supabase_client()
    return _SUPABASE_CLIENT


def save_scan_job(scan_id: str, target: str, status: str, started_at: str, ended_at: Optional[str], score: int) -> Dict[str, Any]:
    client = get_supabase_client()
    payload = {
        "scan_id": scan_id,
        "target_domain": target,
        "status": status,
        "started_at": started_at,
        "ended_at": ended_at,
        "priority_score": score,
    }
    response = client.table("scan_jobs").insert(payload).execute()
    return response


def save_live_hosts(scan_id: str, hosts_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    client = get_supabase_client()
    payloads = []
    for host in hosts_list:
        payloads.append({
            "scan_id": scan_id,
            "url": host.get("url") or host.get("target"),
            "status_code": host.get("status_code") or host.get("status"),
            "title": host.get("title"),
            "tech": json.dumps(host.get("tech") or []),
            "method": host.get("method"),
            "raw": json.dumps(host.get("raw")) if host.get("raw") is not None else None,
        })
    if not payloads:
        return {"saved_live_hosts": 0}
    response = client.table("live_hosts").insert(payloads).execute()
    return response


def save_vulnerabilities(scan_id: str, vulns_list: List[Dict[str, Any]]) -> Dict[str, Any]:
    client = get_supabase_client()
    payloads = []
    for vuln in vulns_list:
        base = {
            "scan_id": scan_id,
            "source": vuln.get("source"),
            "raw": json.dumps(vuln.get("raw")) if vuln.get("raw") is not None else None,
        }
        if vuln.get("source") == "nuclei":
            base.update({
                "template_id": vuln.get("template_id"),
                "host": vuln.get("host"),
                "severity": vuln.get("severity"),
                "matched": json.dumps(vuln.get("matched")) if vuln.get("matched") is not None else None,
            })
        elif vuln.get("source") == "ffuf":
            base.update({
                "endpoint": vuln.get("endpoint"),
                "status_code": vuln.get("status_code"),
                "length": vuln.get("length"),
            })
        payloads.append(base)
    if not payloads:
        return {"saved_vulnerabilities": 0}
    response = client.table("vulnerabilities").insert(payloads).execute()
    return response


def save_scan_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    save_scan_job(
        scan_id=payload["scan_id"],
        target=payload["target_domain"],
        status=payload["status"],
        started_at=payload["started_at"],
        ended_at=payload["ended_at"],
        score=payload["priority_score"],
    )
    save_live_hosts(payload["scan_id"], payload["results"].get("live_hosts", []))
    save_vulnerabilities(payload["scan_id"], payload["results"].get("vulnerabilities", []))
    return {"saved_scan_job": True, "saved_live_hosts": True, "saved_vulnerabilities": True}


def update_scan_status(scan_id: str, status: str) -> Dict[str, Any]:
    status_value = (status or "").strip().upper()
    if not status_value:
        return {
            "updated": False,
            "scan_id": scan_id,
            "status": status,
            "error": "empty status",
        }

    if not config.SUPABASE_URL or not config.SUPABASE_KEY:
        return {
            "updated": True,
            "simulated": True,
            "scan_id": scan_id,
            "status": status_value,
            "detail": "SUPABASE config missing, simulated update only",
        }

    try:
        client = get_supabase_client()
        response = (
            client.table("scan_jobs")
            .update({"status": status_value})
            .eq("scan_id", scan_id)
            .execute()
        )
        return {
            "updated": True,
            "scan_id": scan_id,
            "status": status_value,
            "detail": response,
        }
    except Exception as exc:
        message = str(exc)
        if "supabase package not installed" in message.lower():
            return {
                "updated": True,
                "simulated": True,
                "scan_id": scan_id,
                "status": status_value,
                "detail": message,
            }
        return {
            "updated": False,
            "scan_id": scan_id,
            "status": status_value,
            "error": message,
        }


def get_scan_target(scan_id: str) -> Dict[str, Any]:
    try:
        client = get_supabase_client()
        response = (
            client.table("scan_jobs")
            .select("scan_id,target_domain,status")
            .eq("scan_id", scan_id)
            .limit(1)
            .execute()
        )
        data = getattr(response, "data", None)
        if isinstance(data, list) and data:
            row = data[0]
            return {
                "found": True,
                "scan_id": row.get("scan_id") or scan_id,
                "target_domain": row.get("target_domain") or "",
                "status": row.get("status"),
            }
        return {"found": False, "scan_id": scan_id, "target_domain": ""}
    except Exception as exc:
        return {
            "found": False,
            "scan_id": scan_id,
            "target_domain": "",
            "error": str(exc),
        }
