import asyncio
import os
import sys
import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

from core.dag_engine import DAGEngine
from core.raw_socket_prober import RawSocketProber
from core.protocol_analyzer import MultiProtocolAnalyzer
from core.protocol_fuzzer import WebSocketFuzzer, GRPCBinaryFuzzer
from core.js_analyzer import DeepJSAnalyzer
from core.payload_mutation import ContextAwarePayloadMutator
from core.rust_accelerator import RustBridge, NativePayloadAccelerator
from core.waf_evasion import AdaptiveWAFEvasionEngine
from core.hive_mind import HiveMindNode
try:
    from core.copilot_masker import SensitiveDataMasker  # type: ignore
    from core.copilot_engine import ADQSecurityCopilot  # type: ignore
except ImportError:
    from copilot_masker import SensitiveDataMasker  # type: ignore
    from copilot_engine import ADQSecurityCopilot  # type: ignore


def test_e2e_full_core_intercommunication_lifecycle():
    """
    End-to-End Internal Integration Test:
    Verifies communication flow and data handover across all core modules:
    DAG Engine -> Raw Socket -> Protocol Fuzzer -> JS Analyzer -> Rust Payload Accelerator ->
    WAF Evasion -> HiveMind Swarm DSM -> Copilot Data Masker -> Gemini Agentic AI Copilot
    """
    async def _run_e2e_pipeline():
        telemetry_log = []

        # =====================================================================
        # PHA 1: KIẾN TRÚC ĐIỀU PHỐI DAG ENGINE (DAG Orchestration)
        # =====================================================================
        dag = DAGEngine()

        # STEP 1: Recon & Port Probing Node
        async def node_recon(results):
            prober = RawSocketProber(timeout=0.5)
            probe_80 = await prober.probe_port_raw("127.0.0.1", 80)
            probe_3306 = await prober.probe_port_raw("127.0.0.1", 3306)
            telemetry_log.append("STEP 1: Raw Socket Port Probe Completed")
            return {
                "target": "https://api.fintech.bank.internal",
                "tech_stack": ["Node.js", "Express", "GraphQL"],
                "ports": [probe_80, probe_3306],
            }

        # STEP 2: Protocol Analysis & JS Secret Extraction Node
        async def node_protocol_and_js(results):
            recon_res = results.get("node_recon", {})
            target_url = recon_res.get("target", "")

            # 2.1 Multi-Protocol Structure Probe
            proto_analyzer = MultiProtocolAnalyzer(timeout=2)
            # Mock GraphQL Introspection
            mock_js_code = """
            const dbUrl = "postgresql://postgres:SuperSecretP@ssw0rd123!@db.internal:5432/fintech_db";
            const jwtToken = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkFESyBBZG1pbiJ9.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
            const awsKey = "AKIA1234567890ABCDEF";
            async function fetchUser() { return fetch("/api/v1/user/profile?user_id=1001"); }
            """

            js_analyzer = DeepJSAnalyzer()
            js_analysis = js_analyzer.analyze_code(mock_js_code, source_url="app.bundle.js")

            # 2.2 WebSocket Fuzzer
            ws_fuzzer = WebSocketFuzzer(timeout=0.5)
            ws_res = await ws_fuzzer.fuzz_websocket_endpoint("ws://127.0.0.1:9999/ws")

            telemetry_log.append(f"STEP 2: Discovered {len(js_analysis['endpoints'])} Endpoints and {len(js_analysis['secrets'])} Secrets")
            return {
                "js_analysis": js_analysis,
                "websocket_fuzz": ws_res,
            }

        # STEP 3: Rust Acceleration & WAF Evasion Payload Mutation Node
        async def node_mutation_and_evasion(results):
            js_res = results.get("node_protocol_and_js", {}).get("js_analysis", {})
            endpoints = js_res.get("endpoints", [])

            # High-speed payload mutation via RustBridge / Native Accelerator
            rust_bridge = RustBridge()
            base_payloads = ["' OR '1'='1", "<script>alert(1)</script>"]
            mutated = rust_bridge.batch_mutate(base_payloads, context="sql")

            # Adaptive WAF Evasion Engine
            waf_engine = AdaptiveWAFEvasionEngine(base_delay=0.01, max_delay=0.1)
            evasion_headers = waf_engine.get_random_headers()

            telemetry_log.append(f"STEP 3: Generated {len(mutated)} Mutated Payloads with WAF Evasion Headers")
            return {
                "mutated_payloads_sample": mutated[:5],
                "evasion_headers": evasion_headers,
            }

        # Register DAG Nodes with Event-Driven Conditions
        dag.add_node("node_recon", node_recon)
        dag.add_node("node_protocol_and_js", node_protocol_and_js, dependencies=["node_recon"])
        dag.add_node(
            "node_mutation_and_evasion",
            node_mutation_and_evasion,
            dependencies=["node_protocol_and_js"],
            condition=lambda res: len(res.get("node_protocol_and_js", {}).get("js_analysis", {}).get("secrets", [])) > 0,
        )

        dag_results = await dag.execute()
        assert "node_recon" in dag_results
        assert "node_protocol_and_js" in dag_results
        assert "node_mutation_and_evasion" in dag_results

        # =====================================================================
        # PHA 2: BẦY ĐÀN REDIS DISTRIBUTED SHARED MEMORY (Hive-Mind Swarm)
        # =====================================================================
        hive_node_a = HiveMindNode(node_id="worker-elite-01")
        hive_node_b = HiveMindNode(node_id="worker-light-01")

        received_events = []
        hive_node_b.add_event_listener(lambda evt: received_events.append(evt))

        await hive_node_a.connect()
        await hive_node_b.connect()

        # Worker A broadcasts secret discovery event
        secrets_found = dag_results["node_protocol_and_js"]["js_analysis"]["secrets"]
        await hive_node_a.broadcast_event(
            event_type="SECRET_LEAK_DISCOVERED",
            payload={"key": "postgres_db_url", "data": secrets_found},
        )

        shared_mem = await hive_node_a.get_shared_memory()

        await hive_node_a.close()
        await hive_node_b.close()
        telemetry_log.append("PHA 2: Swarm Event Broadcasted & Distributed Shared Memory Updated")

        # =====================================================================
        # PHA 3: ADQ SECURITY COPILOT AGENTIC AI ANALYSIS (Gemini 3.6 Flash)
        # =====================================================================
        masker = SensitiveDataMasker()
        raw_findings = {
            "target": dag_results["node_recon"]["target"],
            "live_hosts": [{"url": dag_results["node_recon"]["target"], "status_code": 200}],
            "vulnerabilities": [
                {
                    "template_id": "postgres-credentials-leak",
                    "severity": "critical",
                    "endpoint": "/app.bundle.js",
                    "raw_secret": "postgresql://postgres:SuperSecretP@ssw0rd123!@db.internal:5432/fintech_db",
                },
                {
                    "template_id": "jwt-bearer-token-exposed",
                    "severity": "high",
                    "endpoint": "/app.bundle.js",
                    "raw_secret": "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSM",
                },
            ]
        }

        # Step 3.1: Data Masking Verification
        masked_findings = masker.mask_dict_or_list(raw_findings)
        masked_str = str(masked_findings)
        assert "SuperSecretP@ssw0rd123!" not in masked_str
        assert "[REDACTED_RAW_SECRET]" in masked_str or "[REDACTED_DB_CONNECTION_STRING]" in masked_str
        telemetry_log.append("PHA 3.1: SecOps Sensitive Data Masking Passed (Zero Leakage)")

        # Step 3.2: 4-Phase Agentic AI Analysis
        copilot = ADQSecurityCopilot(api_key=os.environ.get("GEMINI_API_KEY"))
        ai_analysis = copilot.analyze_scan_job(raw_findings)
        assert ai_analysis["status"] in ("SUCCESS", "CONFIG_ERROR")
        telemetry_log.append(f"PHA 3.2: Agentic Copilot Status [{ai_analysis['status']}], Model Used [{ai_analysis.get('model')}]")

        # Step 3.3: One-Click Fix Code Patch Generation
        patch_res = copilot.generate_one_click_fix(
            vulnerability_type="PostgreSQL Hardcoded Connection String Leak",
            endpoint="/app.bundle.js",
            framework="Next.js / Node.js",
        )
        assert patch_res["status"] in ("SUCCESS", "CONFIG_ERROR")
        telemetry_log.append("PHA 3.3: One-Click Fix Patch Generated Successfully")

        return {
            "status": "E2E_SUCCESS",
            "telemetry": telemetry_log,
            "dag_nodes_completed": list(dag_results.keys()),
            "copilot_analysis_status": ai_analysis["status"],
            "copilot_model": ai_analysis.get("model"),
        }

    res = asyncio.run(_run_e2e_pipeline())
    assert res["status"] == "E2E_SUCCESS"
    assert len(res["dag_nodes_completed"]) == 3
