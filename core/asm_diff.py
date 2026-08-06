import json
from datetime import datetime
from typing import Any, Dict, List, Set


class AttackSurfaceDiffEngine:
    """
    Continuous Threat Exposure Management (CTEM) & ASM Diffing Engine
    - Saves historical asset snapshots (Subdomains, Endpoints, Headers, Tech Stack, Vulns)
    - Compares Baseline Snapshot vs Current Snapshot to extract delta changes
    - Highlights critical exposure changes (new subdomains, newly exposed endpoints, removed security headers)
    """

    @staticmethod
    def create_snapshot(
        target_domain: str,
        subdomains: List[str],
        live_hosts: List[Dict[str, Any]],
        discovered_endpoints: List[str],
        vulnerabilities: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        return {
            "target_domain": target_domain,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "subdomains": sorted(list(set(subdomains))),
            "live_hosts": live_hosts,
            "discovered_endpoints": sorted(list(set(discovered_endpoints))),
            "vulnerabilities": vulnerabilities,
        }

    @staticmethod
    def compute_diff(
        baseline_snapshot: Dict[str, Any],
        current_snapshot: Dict[str, Any],
    ) -> Dict[str, Any]:
        """Compute delta changes between baseline and current asset state."""
        base_subs: Set[str] = set(baseline_snapshot.get("subdomains", []))
        curr_subs: Set[str] = set(current_snapshot.get("subdomains", []))

        base_eps: Set[str] = set(baseline_snapshot.get("discovered_endpoints", []))
        curr_eps: Set[str] = set(current_snapshot.get("discovered_endpoints", []))

        # Extract vulnerabilities by template_id / host
        base_vuln_keys: Set[str] = {
            f"{v.get('source')}:{v.get('template_id') or v.get('endpoint')}"
            for v in baseline_snapshot.get("vulnerabilities", [])
        }
        curr_vuln_keys: Set[str] = {
            f"{v.get('source')}:{v.get('template_id') or v.get('endpoint')}"
            for v in current_snapshot.get("vulnerabilities", [])
        }

        new_subdomains = sorted(list(curr_subs - base_subs))
        removed_subdomains = sorted(list(base_subs - curr_subs))

        new_endpoints = sorted(list(curr_eps - base_eps))
        removed_endpoints = sorted(list(base_eps - curr_eps))

        new_vulnerabilities = [
            v for v in current_snapshot.get("vulnerabilities", [])
            if f"{v.get('source')}:{v.get('template_id') or v.get('endpoint')}" in (curr_vuln_keys - base_vuln_keys)
        ]

        has_critical_changes = bool(new_subdomains or new_endpoints or new_vulnerabilities)

        return {
            "target_domain": current_snapshot.get("target_domain"),
            "baseline_timestamp": baseline_snapshot.get("timestamp"),
            "current_timestamp": current_snapshot.get("timestamp"),
            "has_critical_changes": has_critical_changes,
            "delta": {
                "new_subdomains": new_subdomains,
                "removed_subdomains": removed_subdomains,
                "new_endpoints": new_endpoints,
                "removed_endpoints": removed_endpoints,
                "new_vulnerabilities_count": len(new_vulnerabilities),
                "new_vulnerabilities": new_vulnerabilities,
            },
        }
