import asyncio
from core.dag_engine import DAGEngine
from core.protocol_fuzzer import WebSocketFuzzer, GRPCBinaryFuzzer


def test_dag_engine_execution_flow():
    async def _run():
        dag = DAGEngine()

        # Step 1: Recon node
        def recon_step(results):
            return {"target": "api.test.local", "tech": ["Node.js", "Express"]}

        dag.add_node("recon", recon_step)

        # Step 2: Conditional Node.js attack branch (should execute)
        def node_attack(results):
            return {"vulnerabilities": ["Prototype Pollution"]}

        dag.add_node(
            "node_fuzz",
            node_attack,
            dependencies=["recon"],
            condition=lambda res: "Node.js" in res.get("recon", {}).get("tech", []),
        )

        # Step 3: Conditional PHP attack branch (should be SKIPPED)
        def php_attack(results):
            return {"vulnerabilities": ["PHP Unserialize"]}

        dag.add_node(
            "php_fuzz",
            php_attack,
            dependencies=["recon"],
            condition=lambda res: "PHP" in res.get("recon", {}).get("tech", []),
        )

        res = await dag.execute()

        assert res["recon"]["target"] == "api.test.local"
        assert res["node_fuzz"]["vulnerabilities"] == ["Prototype Pollution"]
        assert res["php_fuzz"]["status"] == "SKIPPED"

    asyncio.run(_run())


def test_protocol_fuzzer_dry_run():
    async def _run():
        ws_fuzzer = WebSocketFuzzer(timeout=1.0)
        # Test fallback / gracefully handling invalid WS target
        ws_res = await ws_fuzzer.fuzz_websocket_endpoint("ws://127.0.0.1:9999/ws_invalid")
        assert "status" in ws_res

        grpc_fuzzer = GRPCBinaryFuzzer(timeout=1.0)
        grpc_res = await grpc_fuzzer.probe_grpc_service("127.0.0.1:9998", ssl=False)
        assert "status" in grpc_res

    asyncio.run(_run())
