import argparse
import os
import signal
import sys
import time

from core.grid_master import MasterGridNode
from core.oast_server import ADQInteractionServer


def run_oast(host: str, port: int) -> None:
    server = ADQInteractionServer(host=host, port=port)
    server.start_server()
    print(f"[runtime:oast] listening on {host}:{port}", flush=True)

    running = True

    def handle_stop(_sig, _frame):
        nonlocal running
        running = False

    signal.signal(signal.SIGTERM, handle_stop)
    signal.signal(signal.SIGINT, handle_stop)

    while running:
        time.sleep(1)

    server.stop_server()
    print("[runtime:oast] stopped", flush=True)


def run_master() -> None:
    node = MasterGridNode()
    print("[runtime:master] started", flush=True)

    running = True

    def handle_stop(_sig, _frame):
        nonlocal running
        running = False

    signal.signal(signal.SIGTERM, handle_stop)
    signal.signal(signal.SIGINT, handle_stop)

    while running:
        time.sleep(2)
        now = time.time()
        stale_workers = [
            worker_id
            for worker_id, info in node.active_workers.items()
            if now - info.get("last_heartbeat", 0) > 60
        ]
        for worker_id in stale_workers:
            node.active_workers.pop(worker_id, None)
            print(f"[runtime:master] dropped stale worker {worker_id}", flush=True)

    print("[runtime:master] stopped", flush=True)


def run_worker(worker_id: str, capability: str) -> None:
    print(f"[runtime:worker] started worker_id={worker_id} capability={capability}", flush=True)

    running = True

    def handle_stop(_sig, _frame):
        nonlocal running
        running = False

    signal.signal(signal.SIGTERM, handle_stop)
    signal.signal(signal.SIGINT, handle_stop)

    while running:
        time.sleep(5)
        print(f"[runtime:worker] heartbeat worker_id={worker_id} capability={capability}", flush=True)

    print(f"[runtime:worker] stopped worker_id={worker_id}", flush=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="ADQ runtime services")
    parser.add_argument("--role", choices=["oast", "master", "worker"], required=True)
    parser.add_argument("--host", default="0.0.0.0")
    parser.add_argument("--port", type=int, default=int(os.getenv("OAST_PORT", "8888")))
    parser.add_argument("--worker-id", default=os.getenv("WORKER_ID", "worker-unknown"))
    parser.add_argument("--capability", default=os.getenv("CAPABILITY", "unknown"))
    args = parser.parse_args()

    if args.role == "oast":
        run_oast(host=args.host, port=args.port)
        return 0
    if args.role == "master":
        run_master()
        return 0

    run_worker(worker_id=args.worker_id, capability=args.capability)
    return 0


if __name__ == "__main__":
    sys.exit(main())
