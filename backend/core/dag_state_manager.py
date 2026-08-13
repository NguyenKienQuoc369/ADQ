import asyncio
import json
import logging
import os
import time
from typing import Any, Callable, Dict, List, Optional
from rich.tree import Tree

try:
    import redis.asyncio as aioredis  # type: ignore
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False

logger = logging.getLogger("ADQ.DAGState")


class DAGStateManager:
    """
    In-Memory DAG State Manager & Real-Time Tree Graph Visualizer
    - Maintains the live state of all DAG nodes during scan execution
    - Formats rich.tree.Tree with semantic status colors (Running, Completed, Critical, Failed)
    - Thread/Async lock protected to prevent TUI rendering race conditions
    """

    def __init__(self, job_id: str = "job_core_1001", target: str = "https://target-bank.com"):
        self.job_id = job_id
        self.target = target
        self.nodes: Dict[str, Dict[str, Any]] = {}
        self._lock = asyncio.Lock()

    async def update_from_event(self, event: Dict[str, Any]):
        async with self._lock:
            node_id = event.get("node_id")
            if not node_id:
                return

            if node_id not in self.nodes:
                self.nodes[node_id] = {
                    "node_id": node_id,
                    "parent_id": event.get("parent_id", "ROOT"),
                    "label": event.get("label", node_id),
                    "status": event.get("status", "PENDING"),
                    "message": event.get("message", ""),
                    "timestamp": event.get("timestamp", time.time()),
                    "payload": event.get("payload", {}),
                    "children": [],
                }
            else:
                curr = self.nodes[node_id]
                curr["status"] = event.get("status", curr["status"])
                curr["message"] = event.get("message", curr["message"])
                curr["timestamp"] = event.get("timestamp", curr["timestamp"])
                if event.get("parent_id") and event.get("parent_id") != "ROOT":
                    curr["parent_id"] = event.get("parent_id")
                if event.get("label"):
                    curr["label"] = event.get("label")
                if event.get("payload"):
                    curr["payload"].update(event.get("payload", {}))

            # Maintain parent-child linkage
            pid = self.nodes[node_id]["parent_id"]
            if pid and pid != "ROOT" and pid in self.nodes:
                if node_id not in self.nodes[pid]["children"]:
                    self.nodes[pid]["children"].append(node_id)

    def sync_update_from_event(self, event: Dict[str, Any]):
        """Synchronous version for non-async event callbacks"""
        node_id = event.get("node_id")
        if not node_id:
            return

        if node_id not in self.nodes:
            self.nodes[node_id] = {
                "node_id": node_id,
                "parent_id": event.get("parent_id", "ROOT"),
                "label": event.get("label", node_id),
                "status": event.get("status", "PENDING"),
                "message": event.get("message", ""),
                "timestamp": event.get("timestamp", time.time()),
                "payload": event.get("payload", {}),
                "children": [],
            }
        else:
            curr = self.nodes[node_id]
            curr["status"] = event.get("status", curr["status"])
            curr["message"] = event.get("message", curr["message"])
            curr["timestamp"] = event.get("timestamp", curr["timestamp"])
            if event.get("parent_id") and event.get("parent_id") != "ROOT":
                curr["parent_id"] = event.get("parent_id")
            if event.get("label"):
                curr["label"] = event.get("label")
            if event.get("payload"):
                curr["payload"].update(event.get("payload", {}))

        pid = self.nodes[node_id]["parent_id"]
        if pid and pid != "ROOT" and pid in self.nodes:
            if node_id not in self.nodes[pid]["children"]:
                self.nodes[pid]["children"].append(node_id)

    def build_rich_tree(self) -> Tree:
        """
        Recursively builds a rich.tree.Tree object representing the dynamic live DAG execution.
        Semantic Styles:
        - PENDING: dim gray ⏳
        - RUNNING: bold cyan 🔄
        - COMPLETED: bold green ✅
        - SKIPPED: dim yellow ⏭️
        - FAILED: bold red ❌
        - CRITICAL: bold red blink 🚨
        """
        root_tree = Tree(
            f"[bold cyan]🎯 TARGET: {self.target}[/bold cyan] [dim]({self.job_id})[/dim]"
        )

        # Identify root nodes (parent_id == 'ROOT' or parent_id not in nodes)
        root_nodes = [
            nid for nid, data in self.nodes.items()
            if data["parent_id"] == "ROOT" or data["parent_id"] not in self.nodes
        ]

        def add_sub_branch(parent_tree_node: Tree, node_id: str):
            nd = self.nodes.get(node_id)
            if not nd:
                return

            status = nd.get("status", "PENDING").upper()
            label = nd.get("label", node_id)
            msg = nd.get("message", "")
            payload = nd.get("payload", {})

            if status == "RUNNING":
                node_label = f"[bold cyan]🔄 {label}[/bold cyan] [dim cyan]({msg})[/dim cyan]"
            elif status in ("COMPLETED", "SUCCESS"):
                node_label = f"[bold green]✅ {label}[/bold green]"
            elif status == "CRITICAL":
                node_label = f"[bold red blink]🚨 {label} [CRITICAL VULN FOUND!][/bold red blink]"
            elif status == "SKIPPED":
                node_label = f"[dim yellow]⏭️ {label} (Skipped)[/dim yellow]"
            elif status == "FAILED":
                node_label = f"[bold red]❌ {label} (Failed: {msg})[/bold red]"
            else:
                node_label = f"[dim gray]⏳ {label} (Pending)[/dim gray]"

            branch = parent_tree_node.add(node_label)

            # Render key findings in payload if available
            if payload and status in ("COMPLETED", "CRITICAL"):
                if "subdomains" in payload and isinstance(payload["subdomains"], list):
                    subs = payload["subdomains"]
                    branch.add(f"[dim green]• Found {len(subs)} subdomains[/dim green]")
                if "vulnerabilities" in payload and isinstance(payload["vulnerabilities"], list):
                    vulns = payload["vulnerabilities"]
                    for v in vulns[:3]:
                        if isinstance(v, dict):
                            sev = v.get("severity", "INFO")
                            color = "red" if sev in ("CRITICAL", "HIGH") else "yellow"
                            branch.add(f"[{color}]• [{sev}] {v.get('title')} ({v.get('endpoint')})[/{color}]")
                if "secrets" in payload and isinstance(payload["secrets"], list):
                    secrets = payload["secrets"]
                    branch.add(f"[bold red]• Discovered {len(secrets)} exposed secret tokens[/bold red]")

            # Recursively render children
            for child_id in nd.get("children", []):
                add_sub_branch(branch, child_id)

        for root_id in root_nodes:
            add_sub_branch(root_tree, root_id)

        return root_tree

    def to_dict(self) -> Dict[str, Any]:
        """Serializes complete DAG graph state for Copilot AI and database JSONb storage"""
        return {
            "job_id": self.job_id,
            "target": self.target,
            "nodes_count": len(self.nodes),
            "dag_graph": self.nodes,
        }


class RedisDAGListener:
    """
    Async Redis Pub/Sub Subscriber that receives real-time node events
    from channel:dag_events:<job_id> and updates DAGStateManager.
    """

    def __init__(self, state_manager: DAGStateManager, redis_url: Optional[str] = None):
        self.state_manager = state_manager
        self.redis_url = redis_url or os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        self.channel_name = f"channel:dag_events:{self.state_manager.job_id}"
        self.redis_client = None
        self.pubsub = None
        self.running = False

    async def start(self):
        if not HAS_REDIS:
            return

        try:
            self.redis_client = aioredis.from_url(self.redis_url, decode_responses=True)
            await self.redis_client.ping()
            self.pubsub = self.redis_client.pubsub()
            await self.pubsub.subscribe(self.channel_name)
            self.running = True
            asyncio.create_task(self._listen_loop())
        except Exception as exc:
            logger.debug(f"Redis DAG Listener offline ({exc}). Using local state events.")

    async def _listen_loop(self):
        while self.running and self.pubsub:
            try:
                msg = await self.pubsub.get_message(ignore_subscribe_messages=True, timeout=0.2)
                if msg and msg.get("type") == "message":
                    raw_data = msg.get("data")
                    if raw_data:
                        event = json.loads(raw_data)
                        await self.state_manager.update_from_event(event)
            except Exception as e:
                logger.debug(f"Listener loop message error: {e}")
                await asyncio.sleep(0.1)

    async def stop(self):
        self.running = False
        if self.pubsub:
            try:
                await self.pubsub.unsubscribe(self.channel_name)
                await self.pubsub.close()
            except Exception:
                pass
        if self.redis_client:
            try:
                await self.redis_client.close()
            except Exception:
                pass
