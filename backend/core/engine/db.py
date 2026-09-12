import json
import os
import time
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


def ensure_stress_jobs_table() -> bool:
    """
    Tạo bảng stress_jobs nếu chưa tồn tại trong PostgreSQL.
    """
    try:
        engine = get_engine()
        with engine.begin() as conn:
            conn.execute(text("""
                CREATE TABLE IF NOT EXISTS stress_jobs (
                    job_id VARCHAR(64) PRIMARY KEY,
                    user_id VARCHAR(128) NOT NULL,
                    tier VARCHAR(32) DEFAULT 'FREE',
                    target_url TEXT NOT NULL,
                    target_requests INT DEFAULT 0,
                    duration_sec INT DEFAULT 0,
                    target_rps INT DEFAULT 0,
                    waf_type VARCHAR(64) DEFAULT 'standard',
                    status VARCHAR(32) DEFAULT 'QUEUED',
                    phase VARCHAR(32) DEFAULT 'PREPARE',
                    progress INT DEFAULT 0,
                    metrics JSONB,
                    events JSONB,
                    sample_logs JSONB,
                    verdict VARCHAR(128),
                    error_safe TEXT,
                    started_at TIMESTAMP WITHOUT TIME ZONE,
                    finished_at TIMESTAMP WITHOUT TIME ZONE,
                    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'UTC'),
                    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT (NOW() AT TIME ZONE 'UTC')
                );
                CREATE INDEX IF NOT EXISTS idx_stress_jobs_user_id ON stress_jobs (user_id);
                CREATE INDEX IF NOT EXISTS idx_stress_jobs_status ON stress_jobs (status);
                CREATE INDEX IF NOT EXISTS idx_stress_jobs_created_at ON stress_jobs (created_at DESC);
            """))
        return True
    except Exception as exc:
        print(f"[DB] ensure_stress_jobs_table warning: {exc}", flush=True)
        return False


def _to_dt(val: Any) -> Optional[datetime]:
    if val is None:
        return None
    if isinstance(val, (int, float)):
        try:
            return datetime.fromtimestamp(val, tz=timezone.utc).replace(tzinfo=None)
        except Exception:
            return None
    if isinstance(val, str):
        val = val.strip()
        if not val:
            return None
        try:
            dt = datetime.fromisoformat(val.replace("Z", "+00:00"))
            return dt.replace(tzinfo=None)
        except Exception:
            return None
    if isinstance(val, datetime):
        return val.replace(tzinfo=None)
    return None


def save_stress_job(job_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Lưu bền vững (durable) kết quả Stress Test vào PostgreSQL.
    """
    job_id = str(job_data.get("job_id", "")).strip()
    if not job_id:
        return {"saved": False, "error": "Missing job_id"}

    user_id = str(job_data.get("user_id", "anonymous"))
    tier = str(job_data.get("tier", "FREE"))
    target_url = str(job_data.get("target_url", ""))
    target_requests = int(job_data.get("target_requests", 0) or 0)
    duration_sec = int(job_data.get("duration_sec", 0) or 0)
    target_rps = int(job_data.get("target_rps", 0) or 0)
    waf_type = str(job_data.get("waf_type", "standard"))
    status_val = str(job_data.get("status", "QUEUED")).upper()
    phase = str(job_data.get("phase", "PREPARE"))
    progress = int(job_data.get("progress", 0) or 0)
    
    metrics = json.dumps(job_data.get("metrics")) if job_data.get("metrics") is not None else None
    events = json.dumps(job_data.get("events")) if job_data.get("events") is not None else None
    sample_logs = json.dumps(job_data.get("sample_logs")) if job_data.get("sample_logs") is not None else None
    
    verdict = job_data.get("verdict")
    error_safe = job_data.get("error_safe")

    started_at = _to_dt(job_data.get("started_at"))
    finished_at = _to_dt(job_data.get("finished_at"))
    created_at = _to_dt(job_data.get("created_at")) or _now()
    updated_at = _now()

    try:
        engine = get_engine()
        with engine.begin() as conn:
            conn.execute(
                text("""
                    INSERT INTO stress_jobs (
                        job_id, user_id, tier, target_url, target_requests, duration_sec, target_rps,
                        waf_type, status, phase, progress, metrics, events, sample_logs, verdict,
                        error_safe, started_at, finished_at, created_at, updated_at
                    ) VALUES (
                        :job_id, :user_id, :tier, :target_url, :target_requests, :duration_sec, :target_rps,
                        :waf_type, :status, :phase, :progress, CAST(:metrics AS jsonb), CAST(:events AS jsonb), CAST(:sample_logs AS jsonb), :verdict,
                        :error_safe, :started_at, :finished_at, :created_at, :updated_at
                    )
                    ON CONFLICT (job_id) DO UPDATE SET
                        user_id = EXCLUDED.user_id,
                        tier = EXCLUDED.tier,
                        target_url = EXCLUDED.target_url,
                        target_requests = EXCLUDED.target_requests,
                        duration_sec = EXCLUDED.duration_sec,
                        target_rps = EXCLUDED.target_rps,
                        waf_type = EXCLUDED.waf_type,
                        status = EXCLUDED.status,
                        phase = EXCLUDED.phase,
                        progress = EXCLUDED.progress,
                        metrics = COALESCE(EXCLUDED.metrics, stress_jobs.metrics),
                        events = COALESCE(EXCLUDED.events, stress_jobs.events),
                        sample_logs = COALESCE(EXCLUDED.sample_logs, stress_jobs.sample_logs),
                        verdict = COALESCE(EXCLUDED.verdict, stress_jobs.verdict),
                        error_safe = COALESCE(EXCLUDED.error_safe, stress_jobs.error_safe),
                        started_at = COALESCE(EXCLUDED.started_at, stress_jobs.started_at),
                        finished_at = COALESCE(EXCLUDED.finished_at, stress_jobs.finished_at),
                        updated_at = EXCLUDED.updated_at
                """),
                {
                    "job_id": job_id,
                    "user_id": user_id,
                    "tier": tier,
                    "target_url": target_url,
                    "target_requests": target_requests,
                    "duration_sec": duration_sec,
                    "target_rps": target_rps,
                    "waf_type": waf_type,
                    "status": status_val,
                    "phase": phase,
                    "progress": progress,
                    "metrics": metrics,
                    "events": events,
                    "sample_logs": sample_logs,
                    "verdict": verdict,
                    "error_safe": error_safe,
                    "started_at": started_at,
                    "finished_at": finished_at,
                    "created_at": created_at,
                    "updated_at": updated_at,
                },
            )
        return {"saved": True, "job_id": job_id}
    except Exception as exc:
        print(f"[DB] Error saving stress job {job_id}: {exc}", flush=True)
        # Attempt self-healing table creation
        ensure_stress_jobs_table()
        return {"saved": False, "error": str(exc)}


def _format_stress_row(row: Dict[str, Any]) -> Dict[str, Any]:
    def _parse_json(val: Any, default: Any):
        if val is None:
            return default
        if isinstance(val, (dict, list)):
            return val
        if isinstance(val, str):
            try:
                return json.loads(val)
            except Exception:
                return default
        return default

    started_at_ts = row["started_at"].replace(tzinfo=timezone.utc).timestamp() if row.get("started_at") else None
    finished_at_ts = row["finished_at"].replace(tzinfo=timezone.utc).timestamp() if row.get("finished_at") else None
    created_at_ts = row["created_at"].replace(tzinfo=timezone.utc).timestamp() if row.get("created_at") else None

    return {
        "job_id": row["job_id"],
        "user_id": row["user_id"],
        "tier": row.get("tier", "FREE"),
        "target_url": row.get("target_url", ""),
        "target_requests": row.get("target_requests", 0),
        "duration_sec": row.get("duration_sec", 0),
        "target_rps": row.get("target_rps", 0),
        "waf_type": row.get("waf_type", "standard"),
        "status": row.get("status", "QUEUED"),
        "phase": row.get("phase", "PREPARE"),
        "progress": row.get("progress", 0),
        "metrics": _parse_json(row.get("metrics"), {}),
        "events": _parse_json(row.get("events"), []),
        "sample_logs": _parse_json(row.get("sample_logs"), []),
        "verdict": row.get("verdict"),
        "error_safe": row.get("error_safe"),
        "started_at": started_at_ts,
        "finished_at": finished_at_ts,
        "created_at": created_at_ts or time.time(),
    }


def get_stress_job(job_id: str) -> Optional[Dict[str, Any]]:
    """
    Truy vấn thông tin Stress Test từ PostgreSQL theo job_id.
    """
    if not job_id:
        return None
    try:
        engine = get_engine()
        with engine.connect() as conn:
            row = conn.execute(
                text("""
                    SELECT
                        job_id, user_id, tier, target_url, target_requests, duration_sec, target_rps,
                        waf_type, status, phase, progress, metrics, events, sample_logs, verdict,
                        error_safe, started_at, finished_at, created_at, updated_at
                    FROM stress_jobs
                    WHERE job_id = :job_id
                    LIMIT 1
                """),
                {"job_id": job_id},
            ).mappings().first()

        if not row:
            return None

        return _format_stress_row(dict(row))
    except Exception as exc:
        print(f"[DB] Error querying stress job {job_id}: {exc}", flush=True)
        return None


def get_stress_jobs_by_user(user_id: str, limit: int = 30) -> List[Dict[str, Any]]:
    """
    Truy vấn danh sách lịch sử Stress Test bền vững theo user_id từ PostgreSQL.
    """
    if not user_id:
        return []
    safe_limit = max(1, min(int(limit or 30), 100))
    try:
        engine = get_engine()
        with engine.connect() as conn:
            rows = conn.execute(
                text("""
                    SELECT
                        job_id, user_id, tier, target_url, target_requests, duration_sec, target_rps,
                        waf_type, status, phase, progress, metrics, events, sample_logs, verdict,
                        error_safe, started_at, finished_at, created_at, updated_at
                    FROM stress_jobs
                    WHERE user_id = :user_id
                    ORDER BY created_at DESC
                    LIMIT :limit
                """),
                {"user_id": user_id, "limit": safe_limit},
            ).mappings().all()

        return [_format_stress_row(dict(r)) for r in rows]
    except Exception as exc:
        print(f"[DB] Error querying user stress jobs for {user_id}: {exc}", flush=True)
        return []

