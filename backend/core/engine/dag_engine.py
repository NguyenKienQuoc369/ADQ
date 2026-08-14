import asyncio
import inspect
import json
import logging
import os
import time
from typing import Any, Callable, Dict, List, Optional, Set

try:
    import redis.asyncio as aioredis  # type: ignore
    HAS_REDIS = True
except ImportError:
    HAS_REDIS = False

logger = logging.getLogger("ADQ.DAG")


class DAGNode:
    """
    Represents an execution node in the Directed Acyclic Graph (DAG) Engine.
    Each node has:
    - node_id: Unique identifier
    - func: Async or sync executable function
    - dependencies: Set of node_ids that must finish before this node executes
    - condition: Optional predicate function(results) -> bool to evaluate if node should run
    - label: Human-readable label for TUI visualization
    - parent_id: Primary parent node identifier for tree graph representation
    """

    def __init__(
        self,
        node_id: str,
        func: Callable[..., Any],
        dependencies: Optional[List[str]] = None,
        condition: Optional[Callable[[Dict[str, Any]], bool]] = None,
        label: Optional[str] = None,
        parent_id: Optional[str] = None,
    ):
        self.node_id = node_id
        self.func = func
        self.dependencies: Set[str] = set(dependencies or [])
        self.condition = condition
        self.label = label or node_id
        self.parent_id = parent_id or (list(self.dependencies)[0] if self.dependencies else "ROOT")
        self.result: Any = None
        self.status: str = "PENDING"  # PENDING, RUNNING, COMPLETED, SKIPPED, FAILED, CRITICAL
        self.error: Optional[str] = None
        self.message: str = f"Node [{self.node_id}] queued"


class DAGEngine:
    """
    Event-Driven Event Loop & Directed Acyclic Graph (DAG) Execution Orchestrator
    - Dynamic Workflow Routing: Decides next execution nodes dynamically based on real-time findings
    - Asynchronous Parallel Execution: Runs independent nodes concurrently
    - Redis Pub/Sub Event Emitter: Emits live state JSON events to channel:dag_events:<job_id>
    """

    def __init__(
        self,
        job_id: str = "job_core_1001",
        redis_url: Optional[str] = None,
        redis_client: Any = None,
        event_callback: Optional[Callable[[Dict[str, Any]], None]] = None,
    ):
        self.job_id = job_id
        self.nodes: Dict[str, DAGNode] = {}
        self.results: Dict[str, Any] = {}
        self.redis_url = redis_url or os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        self.redis_client = redis_client
        self.event_callback = event_callback
        self.channel_name = f"channel:dag_events:{self.job_id}"
        self._own_redis = False

    async def _init_redis(self):
        if self.redis_client is None and HAS_REDIS:
            try:
                client = aioredis.from_url(self.redis_url, decode_responses=True)
                await client.ping()
                self.redis_client = client
                self._own_redis = True
            except Exception as exc:
                logger.debug(f"DAG Redis connection not available ({exc}), running in local event mode.")
                self.redis_client = None

    async def close(self):
        if self._own_redis and self.redis_client:
            try:
                await self.redis_client.close()
            except Exception:
                pass
            self.redis_client = None

    async def publish_event(
        self,
        node_id: str,
        status: str,
        message: str,
        parent_id: Optional[str] = None,
        payload: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Emits standardized JSON payload over Redis Pub/Sub and invokes local callback.
        Standard JSON Schema:
        {
            "job_id": "job_core_1001",
            "node_id": "node_recon",
            "parent_id": "ROOT",
            "label": "Subdomain & Live Host Discovery",
            "status": "RUNNING", // PENDING, RUNNING, COMPLETED, SKIPPED, FAILED, CRITICAL
            "message": "Finding active subdomains...",
            "timestamp": 1723500000.123,
            "payload": {...}
        }
        """
        node = self.nodes.get(node_id)
        pid = parent_id or (node.parent_id if node else "ROOT")
        label = node.label if node else node_id

        event_data = {
            "job_id": self.job_id,
            "node_id": node_id,
            "parent_id": pid,
            "label": label,
            "status": status.upper(),
            "message": message,
            "timestamp": time.time(),
            "payload": payload or {},
        }

        # 1. Local Event Callback hook
        if self.event_callback:
            try:
                if inspect.iscoroutinefunction(self.event_callback):
                    await self.event_callback(event_data)
                else:
                    self.event_callback(event_data)
            except Exception as cb_err:
                logger.debug(f"Local DAG event callback error: {cb_err}")

        # 2. Redis Pub/Sub broadcast
        if self.redis_client:
            try:
                await self.redis_client.publish(self.channel_name, json.dumps(event_data, ensure_ascii=False))
            except Exception as pub_err:
                logger.debug(f"Redis PubSub publish error on {self.channel_name}: {pub_err}")

        return event_data

    def add_node(
        self,
        node_id: str,
        func: Callable[..., Any],
        dependencies: Optional[List[str]] = None,
        condition: Optional[Callable[[Dict[str, Any]], bool]] = None,
        label: Optional[str] = None,
        parent_id: Optional[str] = None,
    ):
        if not parent_id and dependencies:
            parent_id = dependencies[0]

        node = DAGNode(
            node_id=node_id,
            func=func,
            dependencies=dependencies,
            condition=condition,
            label=label,
            parent_id=parent_id,
        )
        self.nodes[node_id] = node

    def _validate_dag(self):
        # Topological check for cyclic dependencies
        visited: Dict[str, int] = {nid: 0 for nid in self.nodes}  # 0: unvisited, 1: visiting, 2: visited

        def dfs(node_id: str):
            visited[node_id] = 1
            node = self.nodes[node_id]
            for dep in node.dependencies:
                if dep not in self.nodes:
                    raise ValueError(f"Node '{node_id}' depends on non-existent node '{dep}'")
                if visited[dep] == 1:
                    raise ValueError(f"Cyclic dependency detected involving node '{node_id}' -> '{dep}'")
                if visited[dep] == 0:
                    dfs(dep)
            visited[node_id] = 2

        for nid in self.nodes:
            if visited[nid] == 0:
                dfs(nid)

    async def execute(self) -> Dict[str, Any]:
        await self._init_redis()
        self._validate_dag()

        # Emit initial PENDING events for all registered nodes
        for nid, node in self.nodes.items():
            await self.publish_event(
                node_id=nid,
                status="PENDING",
                message=f"Node [{node.label}] queued",
                parent_id=node.parent_id,
            )

        pending_nodes = set(self.nodes.keys())
        running_tasks: Dict[str, asyncio.Task] = {}

        while pending_nodes or running_tasks:
            # Check for nodes ready to execute
            ready_nodes = []
            for nid in list(pending_nodes):
                node = self.nodes[nid]
                deps_met = all(
                    dep in self.results and self.nodes[dep].status in ("COMPLETED", "CRITICAL", "SKIPPED")
                    for dep in node.dependencies
                )
                if deps_met:
                    ready_nodes.append(nid)

            # Schedule ready nodes
            for nid in ready_nodes:
                pending_nodes.remove(nid)
                node = self.nodes[nid]

                # Check dynamic condition
                if node.condition and not node.condition(self.results):
                    node.status = "SKIPPED"
                    self.results[nid] = {"status": "SKIPPED", "reason": "Condition not met"}
                    await self.publish_event(
                        node_id=nid,
                        status="SKIPPED",
                        message=f"Skipped {node.label} (Condition not met)",
                        parent_id=node.parent_id,
                        payload={"reason": "Condition not met"},
                    )
                    continue

                node.status = "RUNNING"
                await self.publish_event(
                    node_id=nid,
                    status="RUNNING",
                    message=f"Executing {node.label}...",
                    parent_id=node.parent_id,
                )

                # Wrap execution
                async def run_wrapper(n: DAGNode):
                    try:
                        if inspect.iscoroutinefunction(n.func):
                            res = await n.func(self.results)
                        else:
                            res = await asyncio.to_thread(n.func, self.results)
                        
                        n.result = res
                        
                        # Determine if critical findings exist in payload
                        is_critical = False
                        if isinstance(res, dict):
                            vulns = res.get("vulnerabilities") or res.get("vulns") or []
                            if any(v.get("severity") in ("CRITICAL", "HIGH") for v in vulns if isinstance(v, dict)):
                                is_critical = True
                            elif res.get("critical_count", 0) > 0 or res.get("is_critical"):
                                is_critical = True

                        n.status = "CRITICAL" if is_critical else "COMPLETED"
                        
                        await self.publish_event(
                            node_id=n.node_id,
                            status=n.status,
                            message=f"Finished {n.label}",
                            parent_id=n.parent_id,
                            payload=res if isinstance(res, dict) else {"result": str(res)},
                        )
                        return res
                    except Exception as e:
                        n.status = "FAILED"
                        n.error = str(e)
                        await self.publish_event(
                            node_id=n.node_id,
                            status="FAILED",
                            message=f"Error in {n.label}: {str(e)}",
                            parent_id=n.parent_id,
                            payload={"error": str(e)},
                        )
                        return {"status": "FAILED", "error": str(e)}

                running_tasks[nid] = asyncio.create_task(run_wrapper(node))

            if not running_tasks:
                if pending_nodes:
                    raise RuntimeError(f"Deadlock detected in DAG execution. Remaining nodes: {pending_nodes}")
                break

            # Wait for at least one running task to complete
            done, _ = await asyncio.wait(
                running_tasks.values(), return_when=asyncio.FIRST_COMPLETED
            )

            # Process completed tasks
            completed_nids = []
            for nid, task in list(running_tasks.items()):
                if task in done:
                    res = await task
                    self.results[nid] = res
                    completed_nids.append(nid)

            for nid in completed_nids:
                del running_tasks[nid]

        await self.close()
        return self.results

