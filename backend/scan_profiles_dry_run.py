#!/usr/bin/env python3
import time
from core.grid_master import MasterGridNode, SCAN_PROFILES


def main():
    print("=" * 75)
    print("🌐 TESTING ADQ SCAN PROFILES & MASTER GRID DISPATCHER")
    print("=" * 75)

    master = MasterGridNode()

    # 1. Register 2 Specialized Worker Nodes
    print("\n[1] Registering Specialized Distributed Worker Nodes...")
    # Worker 1: Light Recon Node (Subfinder, HTTPX, JS)
    w1_res = master.register_worker("worker_recon_node_01", capabilities=["recon_infra", "web_mapping"])
    print(f"  • Worker 1 (Light Recon Node): ID={w1_res['worker_id']}, Capabilities={w1_res['capabilities']}")

    # Worker 2: Elite Exploit Node (Active DAST, Deep Logic, Session, Race, OAST)
    w2_res = master.register_worker("worker_elite_exploit_01", capabilities=["dast_active", "deep_logic"])
    print(f"  • Worker 2 (Elite Exploit Node): ID={w2_res['worker_id']}, Capabilities={w2_res['capabilities']}")

    # 2. Enqueue Tasks across 4 Specialized Profiles
    print("\n[2] Enqueuing Tasks across 4 Scan Profiles...")
    task1 = master.enqueue_task("bank.target.com", profile="recon_infra")
    task2 = master.enqueue_task("bank.target.com", profile="web_mapping")
    task3 = master.enqueue_task("bank.target.com", profile="dast_active")
    task4 = master.enqueue_task("bank.target.com", profile="deep_logic")

    print(f"  • Enqueued Profile 1: {task1['profile_info']['name']} [Noise: {task1['profile_info']['noise_level']}]")
    print(f"  • Enqueued Profile 2: {task2['profile_info']['name']} [Noise: {task2['profile_info']['noise_level']}]")
    print(f"  • Enqueued Profile 3: {task3['profile_info']['name']} [Noise: {task3['profile_info']['noise_level']}]")
    print(f"  • Enqueued Profile 4: {task4['profile_info']['name']} [Noise: {task4['profile_info']['noise_level']}]")

    # 3. Test Capability Matching during Dispatch
    print("\n[3] Dispatching Tasks with Capability Matching...")
    
    # Light Recon Worker fetches task
    fetched1 = master.fetch_next_task("worker_recon_node_01")
    print(f"  • Worker 1 Fetched Task: ID={fetched1['task_id']}, Profile={fetched1['profile']} ({fetched1['profile_info']['name']})")

    fetched2 = master.fetch_next_task("worker_recon_node_01")
    print(f"  • Worker 1 Fetched Task: ID={fetched2['task_id']}, Profile={fetched2['profile']} ({fetched2['profile_info']['name']})")

    # Attempting to give DAST task to Light Worker (should be skipped or None if no light tasks remain)
    fetched_none = master.fetch_next_task("worker_recon_node_01")
    print(f"  • Worker 1 Fetched Remaining Light Tasks: {fetched_none}")

    # Elite Worker fetches DAST & Deep Logic tasks
    fetched3 = master.fetch_next_task("worker_elite_exploit_01")
    print(f"  • Worker 2 Fetched Task: ID={fetched3['task_id']}, Profile={fetched3['profile']} ({fetched3['profile_info']['name']})")

    fetched4 = master.fetch_next_task("worker_elite_exploit_01")
    print(f"  • Worker 2 Fetched Task: ID={fetched4['task_id']}, Profile={fetched4['profile']} ({fetched4['profile_info']['name']})")

    # 4. Submit Results
    print("\n[4] Submitting Distributed Results to Master...")
    master.submit_task_result(task1['task_id'], "worker_recon_node_01", {"subdomains_found": 12})
    master.submit_task_result(task4['task_id'], "worker_elite_exploit_01", {"vulnerabilities_found": 2, "idor_flagged": True})

    print(f"  • Task 1 Result Status: {master.job_results[task1['task_id']]['status']}")
    print(f"  • Task 4 Result Status: {master.job_results[task4['task_id']]['status']}")

    print("\n" + "=" * 75)
    print("✅ SCAN PROFILES & DISPATCHER TEST COMPLETED SUCCESSFULLY!")
    print("=" * 75)


if __name__ == "__main__":
    main()
