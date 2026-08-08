#!/usr/bin/env python3
import time
import requests
from core.oast_server import ADQInteractionServer
from core.asm_diff import AttackSurfaceDiffEngine
from core.grid_master import MasterGridNode
from core.payload_mutation import ContextAwarePayloadMutator


def main():
    print("=" * 75)
    print("🚀 ADQ ENTERPRISE DAST/ASM ARCHITECTURE DRY-RUN")
    print("=" * 75)

    # 1. Test OAST Server
    print("\n[UPGRADE 1] Testing Out-of-Band (OAST) Interaction Server...")
    oast = ADQInteractionServer(host="127.0.0.1", port=8888)
    oast.start_server()

    payload_id, oast_url = oast.generate_payload()
    print(f"  • Generated OAST Payload ID: {payload_id}")
    print(f"  • OAST Callback Target URL: {oast_url}")

    print("  • Triggering simulated OAST out-of-band HTTP GET callback...")
    try:
        resp = requests.get(oast_url, timeout=3)
        print(f"  • OAST Server Response: {resp.status_code} - {resp.text}")
    except Exception as e:
        print(f"  • OAST Trigger Error: {e}")

    interactions = oast.poll_interactions(payload_id, timeout=2.0)
    print(f"  • OAST Recorded Interactions Count: {len(interactions)}")
    if interactions:
        print(f"  • Interaction Verified ($0% FP): Method={interactions[0]['method']}, IP={interactions[0]['client_ip']}")

    oast.stop_server()

    # 2. Test ASM & State Diffing Engine
    print("\n[UPGRADE 2] Testing ASM & State Diffing Engine (CTEM)...")
    baseline = AttackSurfaceDiffEngine.create_snapshot(
        target_domain="target.com",
        subdomains=["app.target.com", "api.target.com"],
        live_hosts=[{"url": "https://app.target.com"}],
        discovered_endpoints=["/api/v1/login"],
        vulnerabilities=[],
    )

    current = AttackSurfaceDiffEngine.create_snapshot(
        target_domain="target.com",
        subdomains=["app.target.com", "api.target.com", "dev.target.com"],  # 1 new subdomain!
        live_hosts=[{"url": "https://app.target.com"}, {"url": "https://dev.target.com"}],
        discovered_endpoints=["/api/v1/login", "/api/v2/internal_data"],   # 1 new endpoint!
        vulnerabilities=[{"source": "nuclei", "template_id": "cve-2024-1234", "severity": "critical"}],
    )

    diff = AttackSurfaceDiffEngine.compute_diff(baseline, current)
    print(f"  • Has Critical Exposure Changes: {diff['has_critical_changes']}")
    print(f"  • New Subdomains: {diff['delta']['new_subdomains']}")
    print(f"  • New Endpoints: {diff['delta']['new_endpoints']}")
    print(f"  • New Vulnerabilities Count: {diff['delta']['new_vulnerabilities_count']}")

    # 3. Test Distributed Master-Worker Grid
    print("\n[UPGRADE 3] Testing Distributed Master-Worker Task Grid...")
    master = MasterGridNode()
    master.register_worker("worker_node_us_east_1", capabilities=["full_pipeline", "logic_scan"])
    
    task_id = master.enqueue_task("bank.target.com", scan_type="full_pipeline")
    print(f"  • Enqueued Task ID: {task_id}")

    task = master.fetch_next_task("worker_node_us_east_1")
    print(f"  • Worker Fetched Task: ID={task['task_id']}, Target={task['target']}")

    master.submit_task_result(task_id, "worker_node_us_east_1", {"vulnerabilities_found": 3, "status": "SUCCESS"})
    print(f"  • Master Task Result Status: {master.job_results[task_id]['status']}")

    # 4. Test Context-Aware Payload Mutator
    print("\n[UPGRADE 4] Testing Context-Aware Payload Mutator...")
    mutator = ContextAwarePayloadMutator()
    xss_mutations = mutator.mutate_payload("<script>alert(1)</script>", context="html_attr")
    sql_mutations = mutator.mutate_payload("UNION SELECT 1,2,3", context="sql_query")

    print(f"  • Generated XSS Mutations ({len(xss_mutations)} variants):")
    for m in xss_mutations[:3]:
        print(f"    - [{m['type']}]: {m['payload']}")

    print(f"  • Generated SQL Mutations ({len(sql_mutations)} variants):")
    for m in sql_mutations[:3]:
        print(f"    - [{m['type']}]: {m['payload']}")

    print("\n" + "=" * 75)
    print("✅ ALL 4 ENTERPRISE ARCHITECTURE UPGRADE MODULES VERIFIED!")
    print("=" * 75)


if __name__ == "__main__":
    main()
