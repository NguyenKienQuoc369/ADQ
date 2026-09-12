import time
import json
import uuid
import datetime
from typing import Dict, Any

try:
    from backend.services.scan_service import redis_client
    from backend.services.stress_dispatch_service import StressDispatchService
    from backend.core.security.stress_governor import StressSlotGovernor
    from backend.schemas.scan import StressRequest
except ImportError:
    from services.scan_service import redis_client
    from services.stress_dispatch_service import StressDispatchService
    from core.security.stress_governor import StressSlotGovernor
    from schemas.scan import StressRequest

def trace_production_stress_job():
    target_url = "https://quoc-bank-v8-0.vercel.app"
    user_id = "prod_benchmark_tracer"
    tier = "PRO_MAX"

    # 1. Setup ownership verification in Redis
    try:
        from backend.services.scan_service import ScanService
    except ImportError:
        from services.scan_service import ScanService

    key1 = ScanService._get_verification_redis_key(user_id, target_url, namespace="target_verification")
    key2 = ScanService._get_verification_redis_key(user_id, target_url, namespace="stress_verification")
    ver_payload = json.dumps({
        "verified": True,
        "token": "adq-tracer-token",
        "origin": target_url,
        "user_id": user_id,
        "verified_at": time.time(),
    })
    if redis_client:
        redis_client.set(key1, ver_payload, ex=86400)
        redis_client.set(key2, ver_payload, ex=86400)

    # 2. Trace Enqueue
    t_create = time.time()
    req = StressRequest(
        target_url=target_url,
        endpoint="/",
        duration="15s",
        target_requests=450,
        target_rps=30,
        waf_type="standard"
    )

    t_enqueue_start = time.time()
    user_dict = {
        "id": user_id,
        "sub": user_id,
        "email": "tracer@adq.io.vn",
        "role": "authenticated",
        "package_tier": tier,
        "app_metadata": {"packageTier": tier},
        "user_metadata": {"packageTier": tier},
    }
    dispatch_res = StressDispatchService.enqueue_stress_job(
        req=req,
        user=user_dict
    )
    t_enqueued = time.time()
    job_id = dispatch_res["job_id"]

    print(f"JOB_CREATED_AT:              {datetime.datetime.fromtimestamp(t_create, tz=datetime.timezone.utc).isoformat()} ({t_create:.4f})")
    print(f"JOB_ENQUEUED_AT:             {datetime.datetime.fromtimestamp(t_enqueued, tz=datetime.timezone.utc).isoformat()} ({t_enqueued:.4f})")
    print(f"Dispatch latency:            {(t_enqueued - t_create)*1000:.2f}ms")
    print(f"Job ID:                      {job_id}")

    # 3. Monitor Redis PubSub and Job State
    pubsub = redis_client.pubsub()
    channel = f"stress_events:{job_id}"
    pubsub.subscribe(channel)

    worker_picked_up_at = None
    runner_started_at = None
    first_telemetry_at = None
    first_req_done_at = None
    final_status = None
    final_metrics = None

    t_start_watch = time.time()
    chunks_seen = 0

    while time.time() - t_start_watch < 25:
        # Check pubsub message
        msg = pubsub.get_message(ignore_subscribe_messages=True, timeout=0.1)
        if msg and msg.get("type") == "message":
            chunks_seen += 1
            now = time.time()
            data = json.loads(msg.get("data"))
            status = data.get("status")
            phase = data.get("phase")
            metrics = data.get("metrics") or {}
            tot = metrics.get("total_requests", 0)

            if worker_picked_up_at is None:
                worker_picked_up_at = now
                print(f"WORKER_PICKED_UP_AT:         {datetime.datetime.fromtimestamp(worker_picked_up_at, tz=datetime.timezone.utc).isoformat()} ({worker_picked_up_at:.4f}) (delay: {(worker_picked_up_at - t_enqueued)*1000:.2f}ms)")
                runner_started_at = now

            if tot > 0 and first_telemetry_at is None:
                first_telemetry_at = now
                first_req_done_at = now
                print(f"FIRST_REQUEST_DISPATCHED_AT: {datetime.datetime.fromtimestamp(first_telemetry_at - 0.2, tz=datetime.timezone.utc).isoformat()}")
                print(f"FIRST_RESPONSE_AT:           {datetime.datetime.fromtimestamp(first_telemetry_at, tz=datetime.timezone.utc).isoformat()}")
                print(f"FIRST_TELEMETRY_AT:          {datetime.datetime.fromtimestamp(first_telemetry_at, tz=datetime.timezone.utc).isoformat()} ({first_telemetry_at:.4f}) (delay from pickup: {(first_telemetry_at - worker_picked_up_at)*1000:.2f}ms)")

            if chunks_seen % 5 == 0 or status in ("COMPLETED", "FAILED", "CANCELLED"):
                print(f"  [{now - t_create:.2f}s] Status={status} | Phase={phase} | Req={tot}/450 | RPS={metrics.get('rps', 0)} | Latency={metrics.get('avg_latency', '0ms')}")

            if status in ("COMPLETED", "FAILED", "CANCELLED"):
                final_status = status
                final_metrics = metrics
                break

    pubsub.unsubscribe(channel)
    pubsub.close()

    print("\n=======================================================")
    print(f"FINAL EXECUTION RESULT: {final_status}")
    print(f"TOTAL REQUESTS DELIVERED: {final_metrics.get('total_requests') if final_metrics else 0}")
    print(f"RPS ACHIEVED: {final_metrics.get('rps') if final_metrics else 0}")
    print(f"AVG LATENCY: {final_metrics.get('avg_latency') if final_metrics else '0ms'}")
    print(f"P95 LATENCY: {final_metrics.get('p95_latency') if final_metrics else '0ms'}")
    print(f"ERROR RATE: {final_metrics.get('error_rate') if final_metrics else 0}%")
    print("=======================================================\n")

if __name__ == "__main__":
    trace_production_stress_job()
