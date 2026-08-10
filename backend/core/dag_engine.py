import asyncio
import inspect
from typing import Any, Callable, Dict, List, Optional, Set
import logging

logger = logging.getLogger("ADQ.DAG")


class DAGNode:
    """
    Represents an execution node in the Directed Acyclic Graph (DAG) Engine.
    Each node has:
    - node_id: Unique identifier
    - func: Async or sync executable function
    - dependencies: Set of node_ids that must finish before this node executes
    - condition: Optional predicate function(results) -> bool to evaluate if node should run
    """

    def __init__(
        self,
        node_id: str,
        func: Callable[..., Any],
        dependencies: Optional[List[str]] = None,
        condition: Optional[Callable[[Dict[str, Any]], bool]] = None,
    ):
        self.node_id = node_id
        self.func = func
        self.dependencies: Set[str] = set(dependencies or [])
        self.condition = condition
        self.result: Any = None
        self.status: str = "PENDING"  # PENDING, RUNNING, COMPLETED, SKIPPED, FAILED
        self.error: Optional[str] = None


class DAGEngine:
    """
    Event-Driven Event Loop & Directed Acyclic Graph (DAG) Execution Orchestrator
    - Dynamic Workflow Routing: Decides next execution nodes dynamically based on real-time findings
    - Asynchronous Parallel Execution: Runs independent nodes concurrently
    - Event-Driven Branching: Toggles specific security modules (e.g. Node.js vs PHP/Java, WS, gRPC)
    """

    def __init__(self):
        self.nodes: Dict[str, DAGNode] = {}
        self.results: Dict[str, Any] = {}

    def add_node(
        self,
        node_id: str,
        func: Callable[..., Any],
        dependencies: Optional[List[str]] = None,
        condition: Optional[Callable[[Dict[str, Any]], bool]] = None,
    ):
        self.nodes[node_id] = DAGNode(
            node_id=node_id,
            func=func,
            dependencies=dependencies,
            condition=condition,
        )

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
        self._validate_dag()
        pending_nodes = set(self.nodes.keys())
        running_tasks: Dict[str, asyncio.Task] = {}

        while pending_nodes or running_tasks:
            # Check for nodes ready to execute
            ready_nodes = []
            for nid in list(pending_nodes):
                node = self.nodes[nid]
                deps_met = all(
                    dep in self.results and self.nodes[dep].status in ("COMPLETED", "SKIPPED")
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
                    continue

                node.status = "RUNNING"
                
                # Wrap execution
                async def run_wrapper(n: DAGNode):
                    try:
                        if inspect.iscoroutinefunction(n.func):
                            res = await n.func(self.results)
                        else:
                            res = await asyncio.to_thread(n.func, self.results)
                        n.result = res
                        n.status = "COMPLETED"
                        return res
                    except Exception as e:
                        n.status = "FAILED"
                        n.error = str(e)
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

        return self.results
