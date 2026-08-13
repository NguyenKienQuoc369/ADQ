import os
import sys
import time
import json
import uuid
import logging
import asyncio
import argparse
from typing import Dict, Any

# Ensure core backend imports work
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from core.stress_orchestrator import StressOrchestrator
from core.hive_mind import HiveMindNode, HIVE_MIND_CHANNEL

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("ADQ.DistributedWorker")


class ADQSwarmWorkerNode:
    """
    ADQ Standalone Swarm Worker Daemon
    - Connects to HiveMind Redis Cluster / Master Node
    - Registers as active stress_worker
    - Receives distributed stress test sub-jobs
    - Executes local high-concurrency attack engine (Go-k6 or Python Async Fleet)
    - Streams live metrics back to C2 Master Node
    """

    def __init__(self, node_id: str, region: str = "Cloud-Node", redis_url: str = "redis://localhost:6379/0"):
        self.node_id = node_id
        self.region = region
        self.hive_mind = HiveMindNode(node_id=self.node_id, redis_url=redis_url)
        self.orchestrator = StressOrchestrator()
        self.is_busy = False

    async def start(self):
        logger.info(f"🚀 Initializing ADQ Swarm Worker Node [{self.node_id}] in region [{self.region}]...")
        connected = await self.hive_mind.connect()
        if not connected:
            logger.warning("⚠️ Could not connect to Redis HiveMind. Running in standalone worker mode.")

        # Register event listener for distributed attack jobs
        self.hive_mind.add_event_listener(self.handle_swarm_event)
        
        # Start heartbeat loop and listener loop
        asyncio.create_task(self.heartbeat_loop())
        await self.hive_mind.start_listening()

    async def heartbeat_loop(self):
        while True:
            status = "BUSY" if self.is_busy else "IDLE"
            heartbeat_payload = {
                "worker_id": self.node_id,
                "region": self.region,
                "status": status,
                "capabilities": ["stress_worker", "dast_active"],
                "k6_available": self.orchestrator.is_k6_available(),
                "timestamp": time.time()
            }
            await self.hive_mind.broadcast_event(event_type="WORKER_HEARTBEAT", payload=heartbeat_payload)
            await asyncio.sleep(10)

    async def handle_swarm_event(self, event: Dict[str, Any]):
        event_type = event.get("event_type")
        payload = event.get("payload", {})

        if event_type == "EXECUTE_STRESS_SUBJOB":
            assigned_worker = payload.get("worker_id")
            if assigned_worker and assigned_worker != self.node_id:
                return  # Task assigned to another worker node

            target_url = payload.get("target_url")
            sub_requests = payload.get("target_requests", 10000)
            duration_sec = payload.get("duration_sec", 10)
            sub_vus = payload.get("vus", 100)
            bearer_token = payload.get("bearer_token", "")

            logger.info(f"💥 Worker [{self.node_id}] Executing Distributed Sub-Job against {target_url} ({sub_requests:,} reqs / {duration_sec}s)")
            self.is_busy = True

            def live_stats_callback(stat):
                # Broadcast sub-job progress metrics to HiveMind channel
                asyncio.create_task(self.hive_mind.broadcast_event(
                    event_type="SWARM_METRIC_TICK",
                    payload={
                        "worker_id": self.node_id,
                        "status": stat.get("status"),
                        "latency": stat.get("latency"),
                        "ip": stat.get("ip")
                    }
                ))

            res = await asyncio.to_thread(
                self.orchestrator.execute_python_http_stress_test,
                target_url=target_url,
                bearer_token=bearer_token,
                vus=sub_vus,
                duration_sec=duration_sec,
                stats_callback=live_stats_callback
            )

            self.is_busy = False
            logger.info(f"✅ Worker [{self.node_id}] Sub-Job Complete! Total Reqs: {res['metrics']['total_requests']:,}, RPS: {res['metrics']['rps']}")

            # Broadcast final completion summary
            await self.hive_mind.broadcast_event(
                event_type="SWARM_SUBJOB_COMPLETE",
                payload={
                    "worker_id": self.node_id,
                    "target_url": target_url,
                    "metrics": res["metrics"]
                }
            )


def main():
    parser = argparse.ArgumentParser(description="ADQ Distributed Swarm Worker Node Daemon")
    parser.add_argument("--id", type=str, default=f"Worker-{uuid.uuid4().hex[:6]}", help="Unique Worker Node ID")
    parser.add_argument("--region", type=str, default="Asia-Singapore", help="Cloud Region / Geographic Location")
    parser.add_argument("--redis", type=str, default=os.getenv("REDIS_URL", "redis://localhost:6379/0"), help="Redis HiveMind URL")
    args = parser.parse_args()

    worker = ADQSwarmWorkerNode(node_id=args.id, region=args.region, redis_url=args.redis)
    try:
        asyncio.run(worker.start())
    except KeyboardInterrupt:
        logger.info(f"Stopped Worker Node [{args.id}].")


if __name__ == "__main__":
    main()
