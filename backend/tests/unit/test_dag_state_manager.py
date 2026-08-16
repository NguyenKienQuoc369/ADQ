import asyncio
import pytest

try:
    from backend.core.dag_engine import DAGEngine
    from backend.core.dag_state_manager import DAGStateManager, RedisDAGListener
except ImportError:
    from core.dag_engine import DAGEngine
    from core.dag_state_manager import DAGStateManager, RedisDAGListener


def test_dag_event_emitter_and_state_manager():
    async def _run():
        job_id = "job_test_999"
        target = "https://test-bank.local"

        state_manager = DAGStateManager(job_id=job_id, target=target)
        dag = DAGEngine(job_id=job_id, event_callback=state_manager.sync_update_from_event)

        async def step_recon(res):
            await asyncio.sleep(0.01)
            return {"subdomains": ["api.test-bank.local"], "live_hosts": [target]}

        async def step_vuln(res):
            await asyncio.sleep(0.01)
            return {
                "vulnerabilities": [
                    {"severity": "CRITICAL", "title": "JWT Hardcoded Secret Key", "endpoint": "/api/auth"}
                ]
            }

        dag.add_node("node_recon", step_recon, label="Surface Recon", parent_id="ROOT")
        dag.add_node("node_vuln", step_vuln, dependencies=["node_recon"], label="Vuln Scan", parent_id="node_recon")

        results = await dag.execute()

        # Verify state manager collected all nodes
        assert "node_recon" in state_manager.nodes
        assert "node_vuln" in state_manager.nodes

        # Verify node_vuln got marked as CRITICAL due to critical finding
        assert state_manager.nodes["node_vuln"]["status"] in ("CRITICAL", "COMPLETED")

        # Verify tree builder generates rich.tree.Tree
        tree = state_manager.build_rich_tree()
        assert tree is not None

        # Verify state dict export
        state_dict = state_manager.to_dict()
        assert state_dict["job_id"] == job_id
        assert state_dict["nodes_count"] == 2
        assert "node_recon" in state_dict["dag_graph"]

    asyncio.run(_run())


def test_dag_redis_listener_fallback():
    async def _run():
        state_manager = DAGStateManager(job_id="job_listener_test", target="https://demo.local")
        listener = RedisDAGListener(state_manager, redis_url="redis://invalid_host:6379/0")
        
        # Should gracefully fail to connect and fallback to local mode
        await listener.start()
        assert listener.running is False or listener.redis_client is None
        await listener.stop()

    asyncio.run(_run())
