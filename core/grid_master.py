import uuid
import time
from queue import Queue
from typing import Any, Dict, List, Optional


SCAN_PROFILES = {
    "recon_infra": {
        "name": "Luồng Trinh Sát Hạ Tầng (Infrastructure Recon)",
        "description": "Thu thập Subdomain, phân giải IP, vẽ sơ đồ ASN. Tính chất ồn ào thấp.",
        "noise_level": "LOW",
        "modules": ["subfinder", "dnsx"],
        "required_capability": "recon_infra",
    },
    "web_mapping": {
        "name": "Luồng Khám Phá Bề Mặt Web & API (Web Surface Mapping)",
        "description": "HTTPX probing, nhãn Tech Stack, Deep JS Analysis, khôi phục Sourcemap & API/Params.",
        "noise_level": "PASSIVE_LIGHT",
        "modules": ["httpx", "js_analyzer"],
        "required_capability": "web_mapping",
    },
    "dast_active": {
        "name": "Luồng Quét Lỗ Hổng Bề Mặt (Automated DAST & CVEs)",
        "description": "Chạy Nuclei CVEs, FFuf directory fuzzing kèm Adaptive WAF Evasion.",
        "noise_level": "ACTIVE_HIGH",
        "modules": ["nuclei", "ffuf", "waf_evasion"],
        "required_capability": "dast_active",
    },
    "deep_logic": {
        "name": "Luồng Khai Thác Sâu & Lỗi Logic (Deep Logic & OAST)",
        "description": "Quản lý Session, Param Fuzzing, Chained IDOR, Race Condition & OAST testing.",
        "noise_level": "STEALTH_COMPLEX",
        "modules": ["session_manager", "param_fuzzer", "logic_chain", "oast_server", "payload_mutation"],
        "required_capability": "deep_logic",
    },
}


class MasterGridNode:
    """
    Distributed Master-Worker Task Broker (Master Node) with Scan Profiles
    - Manages specialized scan profiles (Infrastructure, Web Mapping, DAST, Deep Logic)
    - Matches worker capabilities with scan profile requirements
    - Enqueues profile-specific tasks & aggregates distributed scan results
    """

    def __init__(self):
        self.task_queue: List[Dict[str, Any]] = []
        self.active_workers: Dict[str, Dict[str, Any]] = {}
        self.job_results: Dict[str, Dict[str, Any]] = {}

    def register_worker(self, worker_id: str, capabilities: List[str]) -> Dict[str, Any]:
        """Register a new worker node with specific capabilities."""
        self.active_workers[worker_id] = {
            "worker_id": worker_id,
            "capabilities": capabilities,
            "last_heartbeat": time.time(),
            "status": "IDLE",
            "completed_tasks": 0,
        }
        return {"status": "REGISTERED", "worker_id": worker_id, "capabilities": capabilities}

    def heartbeat(self, worker_id: str, status: str = "IDLE") -> bool:
        """Update worker node heartbeat."""
        if worker_id in self.active_workers:
            self.active_workers[worker_id]["last_heartbeat"] = time.time()
            self.active_workers[worker_id]["status"] = status
            return True
        return False

    def enqueue_task(
        self,
        target: str,
        profile: str = "recon_infra",
        extra_params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """
        Enqueue a profile-specific task.
        Profiles: 'recon_infra', 'web_mapping', 'dast_active', 'deep_logic'
        """
        task_id = str(uuid.uuid4())
        profile_info = SCAN_PROFILES.get(profile, {
            "name": "Custom Profile",
            "required_capability": profile,
            "noise_level": "CUSTOM",
            "modules": [],
        })

        task_payload = {
            "task_id": task_id,
            "target": target,
            "profile": profile,
            "profile_info": profile_info,
            "params": extra_params or {},
            "created_at": time.time(),
            "status": "PENDING",
        }

        self.task_queue.append(task_payload)
        self.job_results[task_id] = {
            "task_id": task_id,
            "target": target,
            "profile": profile,
            "status": "PENDING",
            "result": None,
        }
        return task_payload

    def fetch_next_task(self, worker_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch next pending task compatible with worker capabilities.
        Light workers can fetch recon_infra/web_mapping; Elite workers can fetch dast_active/deep_logic.
        """
        worker = self.active_workers.get(worker_id)
        if not worker:
            return None

        capabilities = set(worker.get("capabilities", []))

        # Search for first task matching worker capabilities
        for idx, task in enumerate(self.task_queue):
            required_cap = task.get("profile_info", {}).get("required_capability", task.get("profile"))
            if "all" in capabilities or required_cap in capabilities:
                assigned_task = self.task_queue.pop(idx)
                assigned_task["status"] = "IN_PROGRESS"
                assigned_task["assigned_worker"] = worker_id

                self.heartbeat(worker_id, status="BUSY")
                self.job_results[assigned_task["task_id"]]["status"] = "IN_PROGRESS"
                self.job_results[assigned_task["task_id"]]["assigned_worker"] = worker_id
                return assigned_task

        return None

    def submit_task_result(self, task_id: str, worker_id: str, result_payload: Dict[str, Any]):
        """Submit completed task result from worker."""
        if task_id in self.job_results:
            self.job_results[task_id]["status"] = "COMPLETED"
            self.job_results[task_id]["completed_at"] = time.time()
            self.job_results[task_id]["result"] = result_payload
            if worker_id in self.active_workers:
                self.active_workers[worker_id]["completed_tasks"] += 1
                self.heartbeat(worker_id, status="IDLE")
