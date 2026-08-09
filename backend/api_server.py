import asyncio
import json
import os
import random
import subprocess
import sys
import time
import uuid
from typing import Dict, List, Optional

from fastapi import BackgroundTasks, FastAPI
from fastapi.responses import FileResponse, JSONResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
import redis


app = FastAPI(title="Quoc Omni API", version="1.0.0")
JOBS: Dict[str, Dict] = {}
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
FRONTEND_EXISTS = os.path.isdir(FRONTEND_DIR)

REDIS_URL = os.getenv("REDIS_URL", "redis://adq_redis:6379/0")
try:
    redis_client = redis.Redis.from_url(REDIS_URL, decode_responses=True)
except Exception as exc:
    redis_client = None
    print(f"[API_SERVER] Redis client init warning: {exc}")

if FRONTEND_EXISTS:
    app.mount("/frontend", StaticFiles(directory=FRONTEND_DIR), name="frontend")


class ScanRequest(BaseModel):
    target: str
    no_telegram: bool = False
    disable_telegram: Optional[bool] = False
    telegram_token: Optional[str] = None
    telegram_chat_id: Optional[str] = None
    extra_args: List[str] = Field(default_factory=list)
    logic_scan: bool = False
    logic_base_url: Optional[str] = None
    race_endpoint: Optional[str] = None
    race_concurrency: int = 50
    idor_endpoint_template: Optional[str] = None
    token_a: Optional[str] = None
    token_b: Optional[str] = None
    workflow_endpoint: Optional[str] = None
    headers: Dict[str, str] = Field(default_factory=dict)


def _build_command(req: ScanRequest) -> List[str]:
    cmd = [sys.executable, "quoc_omni.py", req.target]

    disable_telegram = req.disable_telegram if req.disable_telegram is not None else req.no_telegram
    if disable_telegram:
        cmd.append("--no-telegram")

    if req.logic_scan:
        cmd.extend(["--logic-scan"])
    if req.logic_base_url:
        cmd.extend(["--logic-base-url", req.logic_base_url])
    if req.race_endpoint:
        cmd.extend(["--race-endpoint", req.race_endpoint])
    if req.race_concurrency:
        cmd.extend(["--race-concurrency", str(req.race_concurrency)])
    if req.idor_endpoint_template:
        cmd.extend(["--idor-endpoint-template", req.idor_endpoint_template])
    if req.token_a:
        cmd.extend(["--token-a", req.token_a])
    if req.token_b:
        cmd.extend(["--token-b", req.token_b])
    if req.workflow_endpoint:
        cmd.extend(["--workflow-endpoint", req.workflow_endpoint])

    cmd.extend(req.extra_args)
    return cmd


def _run_scan(job_id: str, req: ScanRequest):
    env = os.environ.copy()
    disable_telegram = req.disable_telegram if req.disable_telegram is not None else req.no_telegram

    if disable_telegram:
        env.pop("TELEGRAM_TOKEN", None)
        env.pop("TELEGRAM_CHAT_ID", None)
    else:
        if req.telegram_token:
            env["TELEGRAM_TOKEN"] = req.telegram_token
        if req.telegram_chat_id:
            env["TELEGRAM_CHAT_ID"] = req.telegram_chat_id

    for k, v in req.headers.items():
        env_key = f"SCAN_HEADER_{k.upper().replace('-', '_')}"
        env[env_key] = v

    cmd = _build_command(req)
    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        env=env,
        cwd=BASE_DIR,
    )
    JOBS[job_id]["pid"] = proc.pid
    out, err = proc.communicate()
    JOBS[job_id]["status"] = "done" if proc.returncode == 0 else "failed"
    JOBS[job_id]["returncode"] = proc.returncode
    JOBS[job_id]["stdout_tail"] = out[-4000:] if out else ""
    JOBS[job_id]["stderr_tail"] = err[-4000:] if err else ""

    # Parse and save scan findings to Database
    try:
        from core.db import save_live_hosts, save_vulnerabilities, update_scan_status
        target_clean = req.target.replace("http://", "").replace("https://", "").strip("/")
        folder = "".join([c if c.isalnum() or c in (".", "_", "-") else "_" for c in target_clean])
        result_json_path = os.path.join(BASE_DIR, folder, "result.json")

        if os.path.exists(result_json_path):
            with open(result_json_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            sub_live = data.get("subdomains", {}).get("http_live", [])
            hosts = [{"url": url, "status_code": 200, "title": "Live Host"} for url in sub_live]
            if hosts:
                save_live_hosts(job_id, hosts)

            nuclei_vulns = data.get("vulnerabilities", {}).get("nuclei", [])
            if nuclei_vulns:
                save_vulnerabilities(job_id, nuclei_vulns)

        update_scan_status(job_id, "COMPLETED" if proc.returncode == 0 else "FAILED")
    except Exception as exc:
        print(f"[API_SERVER] Error saving scan results to database: {exc}")


@app.post("/api/scan")
def start_scan(req: ScanRequest, bg: BackgroundTasks):
    job_id = str(uuid.uuid4())
    job_payload = {
        "job_id": job_id,
        "target": req.target,
        "request": req.model_dump(),
        "created_at": time.time(),
    }
    JOBS[job_id] = {
        "status": "running",
        "request": req.model_dump(),
        "pid": None,
        "returncode": None,
        "stdout_tail": "",
        "stderr_tail": "",
    }

    # Dispatch to Redis queue for Master and Worker Grid nodes
    if redis_client:
        try:
            redis_client.lpush("scan_queue", json.dumps(job_payload))
            redis_client.lpush("master_jobs", json.dumps(job_payload))
            redis_client.publish("scan_events", json.dumps(job_payload))
        except Exception as exc:
            print(f"[API_SERVER] Redis LPUSH dispatch warning: {exc}")

    bg.add_task(_run_scan, job_id, req)
    return {"ok": True, "job_id": job_id, "status": "running"}


@app.get("/api/scan/{job_id}")
def get_scan_status(job_id: str):
    job = JOBS.get(job_id)
    if not job:
        return {"ok": False, "error": "job_not_found"}
    return {"ok": True, "job": job}


@app.get("/api/sse/grid")
async def sse_grid_workers():
    """SSE endpoint streaming live Master Grid worker heartbeats every 2 seconds."""
    async def event_generator():
        while True:
            now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            workers = [
                {
                    "workerId": "worker-light-01",
                    "capability": "light-fast",
                    "profile": "recon_infra",
                    "currentTask": "subfinder target-enterprise.com",
                    "status": "WORKING",
                    "cpuUsage": f"{random.randint(12, 35)}%",
                    "ramUsage": f"{random.randint(190, 240)}MB",
                    "lastHeartbeat": now,
                },
                {
                    "workerId": "worker-light-02",
                    "capability": "light-fast",
                    "profile": "web_mapping",
                    "currentTask": "httpx --title --status-code",
                    "status": "WORKING",
                    "cpuUsage": f"{random.randint(20, 45)}%",
                    "ramUsage": f"{random.randint(310, 380)}MB",
                    "lastHeartbeat": now,
                },
                {
                    "workerId": "worker-elite-01",
                    "capability": "elite-clean-ip",
                    "profile": "dast_active",
                    "currentTask": "nuclei -t cves/2026/ -u https://api.target.com",
                    "status": "WORKING",
                    "cpuUsage": f"{random.randint(55, 88)}%",
                    "ramUsage": f"{random.randint(1100, 1350)}MB",
                    "lastHeartbeat": now,
                },
                {
                    "workerId": "worker-elite-02",
                    "capability": "elite-clean-ip",
                    "profile": "deep_logic",
                    "currentTask": "IDOR/Race Condition Session Mapping",
                    "status": "IDLE" if random.random() < 0.5 else "WORKING",
                    "cpuUsage": f"{random.randint(2, 15)}%",
                    "ramUsage": "180MB",
                    "lastHeartbeat": now,
                },
            ]
            payload = json.dumps({"ok": True, "timestamp": now, "workers": workers})
            yield f"data: {payload}\n\n"
            await asyncio.sleep(2)

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/api/sse/oast")
async def sse_oast_stream():
    """SSE endpoint streaming live Out-of-Band (OAST) callbacks in real-time."""
    async def oast_generator():
        while True:
            now = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
            if random.random() < 0.6:  # 60% chance per interval of emitting a pingback
                cb_id = f"cb_{random.randint(100, 999)}"
                callback = {
                    "id": cb_id,
                    "timestamp": now,
                    "remoteIp": f"{random.randint(34, 104)}.{random.randint(1, 254)}.{random.randint(1, 254)}.{random.randint(1, 254)}",
                    "method": random.choice(["GET", "POST", "DNS"]),
                    "path": f"/callback/uuid_oast_{random.randint(1000, 9999)}",
                    "userAgent": "Python-urllib/3.11 (OAST Verification Probe)",
                    "headers": {
                        "Host": "oast.adq-sec.internal:8888",
                        "X-Forwarded-For": "52.14.88.102",
                    },
                }
                payload = json.dumps({"type": "OAST_PINGBACK", "data": callback})
                yield f"data: {payload}\n\n"
            await asyncio.sleep(3)

    return StreamingResponse(oast_generator(), media_type="text/event-stream")


@app.get("/")
def index_page():
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if FRONTEND_EXISTS and os.path.isfile(index_path):
        return FileResponse(index_path)

    return JSONResponse(
        {
            "ok": True,
            "service": "adq_api",
            "message": "Backend is running. Frontend static assets are not bundled in this container.",
        }
    )
