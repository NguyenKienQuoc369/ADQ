import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine


def _database_url() -> str:
    url = os.getenv("DATABASE_URL", "").strip()

    if not url:
        raise RuntimeError("DATABASE_URL is not configured")

    # psycopg2/SQLAlchemy không hiểu custom query param pgbouncer=true.
    # Prisma có thể dùng nó, nhưng Python DB layer thì bỏ param này.
    if "pgbouncer=true" in url:
        url = url.replace("?pgbouncer=true&", "?")
        url = url.replace("&pgbouncer=true", "")
        url = url.replace("?pgbouncer=true", "")

    return url


_ENGINE: Optional[Engine] = None


def get_supabase_client():
    """
    Compatibility shim.

    Backend DB layer hiện dùng PostgreSQL trực tiếp qua DATABASE_URL.
    Hàm này được giữ lại để các module cũ import không bị crash.
    """
    return None


def get_engine() -> Engine:
    global _ENGINE

    if _ENGINE is None:
        _ENGINE = create_engine(
            _database_url(),
            pool_pre_ping=True,
            future=True,
        )

    return _ENGINE


def _now():
    # Prisma PostgreSQL columns đang là timestamp without time zone.
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _normalize_domain(target: str) -> str:
    value = (target or "").strip()

    if value.startswith("http://"):
        value = value[len("http://"):]

    if value.startswith("https://"):
        value = value[len("https://"):]

    value = value.split("/", 1)[0].strip().strip("/")

    if not value:
        raise ValueError("Target domain is empty")

    return value


def _serialize(value: Any) -> Optional[str]:
    if value is None:
        return None

    if isinstance(value, str):
        return value

    return json.dumps(value, ensure_ascii=False)


def ensure_target(target: str) -> Dict[str, Any]:
    domain = _normalize_domain(target)
    now = _now()

    engine = get_engine()

    with engine.begin() as conn:
        existing = conn.execute(
            text("""
                SELECT id, domain
                FROM targets
                WHERE domain = :domain
                LIMIT 1
            """),
            {"domain": domain},
        ).mappings().first()

        if existing:
            conn.execute(
                text("""
                    UPDATE targets
                    SET updated_at = :updated_at
                    WHERE domain = :domain
                """),
                {
                    "updated_at": now,
                    "domain": domain,
                },
            )

            return {
                "id": existing["id"],
                "domain": existing["domain"],
            }

        target_id = str(uuid.uuid4())

        conn.execute(
            text("""
                INSERT INTO targets (
                    id,
                    domain,
                    created_at,
                    updated_at
                )
                VALUES (
                    :id,
                    :domain,
                    :created_at,
                    :updated_at
                )
            """),
            {
                "id": target_id,
                "domain": domain,
                "created_at": now,
                "updated_at": now,
            },
        )

        return {
            "id": target_id,
            "domain": domain,
        }


def save_scan_job(
    scan_id: str,
    target: str,
    status: str = "QUEUED",
    started_at: Optional[Any] = None,
    ended_at: Optional[Any] = None,
    score: int = 0,
) -> Dict[str, Any]:
    target_record = ensure_target(target)
    domain = target_record["domain"]
    now = _now()

    if isinstance(started_at, str):
        try:
            started_at = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
            started_at = started_at.replace(tzinfo=None)
        except Exception:
            started_at = now
    elif started_at is None:
        started_at = now

    if isinstance(ended_at, str):
        try:
            ended_at = datetime.fromisoformat(ended_at.replace("Z", "+00:00"))
            ended_at = ended_at.replace(tzinfo=None)
        except Exception:
            ended_at = None

    engine = get_engine()

    with engine.begin() as conn:
        existing = conn.execute(
            text("""
                SELECT scan_id
                FROM scan_jobs
                WHERE scan_id = :scan_id
                LIMIT 1
            """),
            {"scan_id": scan_id},
        ).first()

        if existing:
            conn.execute(
                text("""
                    UPDATE scan_jobs
                    SET
                        target_domain = :target_domain,
                        status = :status,
                        started_at = COALESCE(started_at, :started_at),
                        ended_at = :ended_at,
                        priority_score = :priority_score,
                        updated_at = :updated_at
                    WHERE scan_id = :scan_id
                """),
                {
                    "scan_id": scan_id,
                    "target_domain": domain,
                    "status": (status or "QUEUED").upper(),
                    "started_at": started_at,
                    "ended_at": ended_at,
                    "priority_score": int(score or 0),
                    "updated_at": now,
                },
            )
        else:
            conn.execute(
                text("""
                    INSERT INTO scan_jobs (
                        scan_id,
                        target_domain,
                        status,
                        started_at,
                        ended_at,
                        priority_score,
                        created_at,
                        updated_at
                    )
                    VALUES (
                        :scan_id,
                        :target_domain,
                        :status,
                        :started_at,
                        :ended_at,
                        :priority_score,
                        :created_at,
                        :updated_at
                    )
                """),
                {
                    "scan_id": scan_id,
                    "target_domain": domain,
                    "status": (status or "QUEUED").upper(),
                    "started_at": started_at,
                    "ended_at": ended_at,
                    "priority_score": int(score or 0),
                    "created_at": now,
                    "updated_at": now,
                },
            )

    return {
        "saved": True,
        "scan_id": scan_id,
        "target_domain": domain,
        "status": (status or "QUEUED").upper(),
    }


def save_live_hosts(
    scan_id: str,
    hosts_list: List[Dict[str, Any]],
) -> Dict[str, Any]:
    if not hosts_list:
        return {"saved_live_hosts": 0}

    engine = get_engine()
    payloads = []

    for host in hosts_list:
        status_code = host.get("status_code")

        if status_code is None:
            raw_status = host.get("status")
            try:
                status_code = int(raw_status) if raw_status is not None else None
            except Exception:
                status_code = None

        payloads.append({
            "scan_id": scan_id,
            "url": host.get("url") or host.get("target"),
            "status_code": status_code,
            "title": host.get("title"),
            "tech": _serialize(host.get("tech") or []),
            "method": host.get("method"),
            "raw": _serialize(host.get("raw")),
        })

    with engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO live_hosts (
                    scan_id,
                    url,
                    status_code,
                    title,
                    tech,
                    method,
                    raw
                )
                VALUES (
                    :scan_id,
                    :url,
                    :status_code,
                    :title,
                    :tech,
                    :method,
                    :raw
                )
            """),
            payloads,
        )

    return {"saved_live_hosts": len(payloads)}


def save_scan_endpoints(
    scan_id: str,
    endpoints_list: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """
    Persist discovered URLs/endpoints separately from vulnerabilities.

    Worker currently writes the complete endpoint snapshot once a scan
    finishes, so existing rows for the same scan are replaced atomically.
    """
    engine = get_engine()

    # Deduplicate by source + URL.
    seen = set()
    payloads = []

    for endpoint in endpoints_list or []:
        url = str(endpoint.get("url") or "").strip()
        source = str(endpoint.get("source") or "unknown").strip().lower()

        if not url:
            continue

        dedupe_key = (source, url)
        if dedupe_key in seen:
            continue

        seen.add(dedupe_key)

        status_code = endpoint.get("status_code")
        try:
            status_code = int(status_code) if status_code is not None else None
        except (TypeError, ValueError):
            status_code = None

        content_length = endpoint.get("content_length")
        if content_length is None:
            content_length = endpoint.get("length")

        try:
            content_length = int(content_length) if content_length is not None else None
        except (TypeError, ValueError):
            content_length = None

        payloads.append({
            "scan_id": scan_id,
            "url": url,
            "source": source,
            "method": endpoint.get("method"),
            "status_code": status_code,
            "content_length": content_length,
            "raw": _serialize(endpoint.get("raw")),
        })

    with engine.begin() as conn:
        # Worker persists one complete snapshot per completed scan.
        conn.execute(
            text("""
                DELETE FROM scan_endpoints
                WHERE scan_id = :scan_id
            """),
            {"scan_id": scan_id},
        )

        if payloads:
            conn.execute(
                text("""
                    INSERT INTO scan_endpoints (
                        scan_id,
                        url,
                        source,
                        method,
                        status_code,
                        content_length,
                        raw
                    )
                    VALUES (
                        :scan_id,
                        :url,
                        :source,
                        :method,
                        :status_code,
                        :content_length,
                        :raw
                    )
                """),
                payloads,
            )

    return {"saved_endpoints": len(payloads)}


def save_vulnerabilities(
    scan_id: str,
    vulns_list: List[Dict[str, Any]],
) -> Dict[str, Any]:
    if not vulns_list:
        return {"saved_vulnerabilities": 0}

    engine = get_engine()
    payloads = []

    for vuln in vulns_list:
        source = str(vuln.get("source") or "nuclei")

        row = {
            "scan_id": scan_id,
            "source": source,
            "template_id": vuln.get("template_id"),
            "host": vuln.get("host"),
            "severity": vuln.get("severity"),
            "matched": _serialize(vuln.get("matched")),
            "endpoint": vuln.get("endpoint"),
            "status_code": vuln.get("status_code"),
            "length": vuln.get("length"),
            "raw": _serialize(vuln.get("raw")),
        }

        payloads.append(row)

    with engine.begin() as conn:
        conn.execute(
            text("""
                INSERT INTO vulnerabilities (
                    scan_id,
                    source,
                    template_id,
                    host,
                    severity,
                    matched,
                    endpoint,
                    status_code,
                    length,
                    raw
                )
                VALUES (
                    :scan_id,
                    :source,
                    :template_id,
                    :host,
                    :severity,
                    :matched,
                    :endpoint,
                    :status_code,
                    :length,
                    :raw
                )
            """),
            payloads,
        )

    return {"saved_vulnerabilities": len(payloads)}


def update_scan_status(scan_id: str, status: str) -> Dict[str, Any]:
    status_value = (status or "").strip().upper()

    if not status_value:
        return {
            "updated": False,
            "scan_id": scan_id,
            "error": "empty status",
        }

    now = _now()
    ended_at = now if status_value in {"COMPLETED", "FAILED"} else None

    engine = get_engine()

    with engine.begin() as conn:
        result = conn.execute(
            text("""
                UPDATE scan_jobs
                SET
                    status = :status,
                    ended_at = CASE
                        WHEN :ended_at IS NULL THEN ended_at
                        ELSE :ended_at
                    END,
                    updated_at = :updated_at
                WHERE scan_id = :scan_id
            """),
            {
                "scan_id": scan_id,
                "status": status_value,
                "ended_at": ended_at,
                "updated_at": now,
            },
        )

    return {
        "updated": result.rowcount > 0,
        "scan_id": scan_id,
        "status": status_value,
    }


def save_scan_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    save_scan_job(
        scan_id=payload["scan_id"],
        target=payload["target_domain"],
        status=payload.get("status", "QUEUED"),
        started_at=payload.get("started_at"),
        ended_at=payload.get("ended_at"),
        score=int(payload.get("priority_score", 0)),
    )

    results = payload.get("results") or {}

    save_live_hosts(
        payload["scan_id"],
        results.get("live_hosts", []),
    )

    save_vulnerabilities(
        payload["scan_id"],
        results.get("vulnerabilities", []),
    )

    save_scan_endpoints(
        payload["scan_id"],
        results.get("endpoints", []),
    )

    return {
        "saved_scan_job": True,
        "saved_live_hosts": True,
        "saved_vulnerabilities": True,
        "saved_endpoints": True,
    }


def get_scan_endpoints(
    scan_id: str,
    limit: int = 500,
) -> List[Dict[str, Any]]:
    engine = get_engine()

    safe_limit = max(1, min(int(limit or 500), 2000))

    with engine.connect() as conn:
        rows = conn.execute(
            text("""
                SELECT
                    id,
                    scan_id,
                    url,
                    source,
                    method,
                    status_code,
                    content_length,
                    raw,
                    created_at
                FROM scan_endpoints
                WHERE scan_id = :scan_id
                ORDER BY id ASC
                LIMIT :limit
            """),
            {
                "scan_id": scan_id,
                "limit": safe_limit,
            },
        ).mappings().all()

    return [dict(row) for row in rows]


def get_scan_target(scan_id: str) -> Dict[str, Any]:
    engine = get_engine()

    with engine.connect() as conn:
        row = conn.execute(
            text("""
                SELECT scan_id, target_domain, status
                FROM scan_jobs
                WHERE scan_id = :scan_id
                LIMIT 1
            """),
            {"scan_id": scan_id},
        ).mappings().first()

    if not row:
        return {
            "found": False,
            "scan_id": scan_id,
            "target_domain": "",
        }

    return {
        "found": True,
        "scan_id": row["scan_id"],
        "target_domain": row["target_domain"],
        "status": row["status"],
    }
