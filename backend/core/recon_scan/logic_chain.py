import asyncio
from typing import Any, Dict, List, Optional

try:
    from backend.core.recon_scan.js_analyzer import DeepJSAnalyzer
    from backend.core.recon_scan.param_fuzzer import ContextAwareParamFuzzer
    from backend.core.engine.session_manager import AuthenticatedSessionManager
    from backend.core.stress_test.waf_evasion import AdaptiveWAFEvasionEngine
except ImportError:
    try:
        from backend.core.js_analyzer import DeepJSAnalyzer
        from backend.core.param_fuzzer import ContextAwareParamFuzzer
        from backend.core.session_manager import AuthenticatedSessionManager
        from backend.core.waf_evasion import AdaptiveWAFEvasionEngine
    except ImportError:
        from core.js_analyzer import DeepJSAnalyzer
        from core.param_fuzzer import ContextAwareParamFuzzer
        from core.session_manager import AuthenticatedSessionManager
        from core.waf_evasion import AdaptiveWAFEvasionEngine
try:
    from backend.modules.logic.idor_scanner import IDORScanner
    from backend.modules.logic.race_condition import RaceConditionScanner
    from backend.modules.logic.workflow_bypass import WorkflowBypassScanner
except ImportError:
    from modules.logic.idor_scanner import IDORScanner
    from modules.logic.race_condition import RaceConditionScanner
    from modules.logic.workflow_bypass import WorkflowBypassScanner


class AutomatedLogicChainingEngine:
    """
    Automated Logic Chaining Engine for ADQ
    - Chains Recon Assets -> JS Deep Analysis -> Parameter Discovery -> Logic Vulnerability Exploitation
    - Data Flow Graph:
      1. JS Extraction -> Discovered APIs & Parameters
      2. IDOR Fuzzing across discovered endpoints using User A / User B sessions
      3. Workflow Bypass on forbidden endpoints
      4. Concurrency / Race Condition testing on sensitive state-changing endpoints
    """

    def __init__(self, base_url: str, timeout: int = 10, token_a: Optional[str] = None, token_b: Optional[str] = None):
        self.base_url = base_url.rstrip("/")
        self.timeout = timeout
        self.js_analyzer = DeepJSAnalyzer(timeout=timeout)
        self.param_fuzzer = ContextAwareParamFuzzer(timeout=timeout)
        self.session_mgr = AuthenticatedSessionManager(token_a=token_a, token_b=token_b)
        self.waf_engine = AdaptiveWAFEvasionEngine(base_delay=0.1, max_delay=3.0)

    def run_chained_attack(
        self,
        js_code_snippets: List[str],
        token_a: Optional[str] = None,
        token_b: Optional[str] = None,
        user_id_a: str = "1001",
        user_id_b: str = "1002",
        race_concurrency: int = 20,
    ) -> Dict[str, Any]:
        chain_log: List[Dict[str, Any]] = []
        all_discovered_endpoints: List[str] = []
        all_discovered_params: List[str] = []
        vulnerabilities_found: List[Dict[str, Any]] = []

        # STEP 1: Deep JS Analysis
        step1_res = []
        for idx, snippet in enumerate(js_code_snippets):
            analysis = self.js_analyzer.analyze_code(snippet, source_url=f"snippet_{idx}.js")
            all_discovered_endpoints.extend(analysis["endpoints"])
            all_discovered_params.extend(analysis["parameters"])
            step1_res.append(analysis)

        chain_log.append({
            "step": 1,
            "name": "Deep JS Analysis",
            "extracted_endpoints_count": len(all_discovered_endpoints),
            "extracted_params_count": len(all_discovered_params),
        })

        # STEP 2: Context-Aware Param Fuzzing on discovered endpoints
        param_fuzz_results = []
        for ep in all_discovered_endpoints[:5]:  # Top 5 endpoints
            target_endpoint_url = f"{self.base_url}{ep}" if ep.startswith("/") else ep
            if target_endpoint_url.startswith("http"):
                pf_res = self.param_fuzzer.fuzz_parameters(
                    url=target_endpoint_url,
                    param_candidates=all_discovered_params,
                )
                if pf_res.get("discovered_params"):
                    param_fuzz_results.extend(pf_res["discovered_params"])
                    for dp in pf_res["discovered_params"]:
                        vulnerabilities_found.append({
                            "source": "param_fuzzer",
                            "severity": dp["severity"],
                            "template_id": f"hidden-param-{dp['parameter']}",
                            "endpoint": target_endpoint_url,
                            "reason": f"Discovered parameter '{dp['parameter']}' via HTTP diffing",
                            "raw": dp,
                        })

        chain_log.append({
            "step": 2,
            "name": "Context-Aware Param Fuzzing",
            "discovered_anomalies_count": len(param_fuzz_results),
        })

        # STEP 3: Automated IDOR Chaining on Discovered Endpoints
        idor_results = []
        if token_a and token_b:
            idor_scanner = IDORScanner(base_url=self.base_url, timeout=self.timeout)
            for ep in all_discovered_endpoints:
                if "{user_id}" in ep or "user" in ep or "account" in ep or "profile" in ep:
                    template = ep if "{user_id}" in ep else f"{ep}?user_id={{user_id}}"
                    res = idor_scanner.scan(
                        endpoint_template=template,
                        token_a=token_a,
                        token_b=token_b,
                        user_id_a=user_id_a,
                        user_id_b=user_id_b,
                    )
                    idor_results.append(res)
                    if res.get("flagged"):
                        vulnerabilities_found.append({
                            "source": "idor_scanner",
                            "severity": res.get("severity", "high"),
                            "template_id": "idor-bola-cross-tenant",
                            "endpoint": ep,
                            "reason": res.get("reason"),
                            "raw": res,
                        })

        chain_log.append({
            "step": 3,
            "name": "Automated IDOR Chaining",
            "scanned_endpoints_count": len(idor_results),
        })

        # STEP 4: Race Condition on State-Changing Endpoints
        race_results = []
        race_scanner = RaceConditionScanner(base_url=self.base_url, timeout=self.timeout)
        state_changing_eps = [
            ep for ep in all_discovered_endpoints
            if any(k in ep.lower() for k in ["update", "transfer", "coupon", "pay", "order", "withdraw", "reset"])
        ]

        for ep in state_changing_eps[:3]:
            try:
                responses = asyncio.run(
                    race_scanner.send_concurrent_requests(
                        endpoint=ep,
                        method="POST",
                        concurrency=race_concurrency,
                    )
                )
                analysis = race_scanner.analyze_race_outcome(responses)
                race_results.append(analysis)
                if analysis.get("flagged"):
                    vulnerabilities_found.append({
                        "source": "race_condition",
                        "severity": analysis.get("severity", "high"),
                        "template_id": "concurrency-race-condition",
                        "endpoint": ep,
                        "reason": analysis.get("reason"),
                        "raw": analysis,
                    })
            except Exception:
                continue

        chain_log.append({
            "step": 4,
            "name": "Race Condition Concurrency Chaining",
            "tested_endpoints_count": len(state_changing_eps),
        })

        return {
            "target_base_url": self.base_url,
            "chain_execution_log": chain_log,
            "discovered_endpoints": sorted(list(set(all_discovered_endpoints))),
            "discovered_parameters": sorted(list(set(all_discovered_params))),
            "vulnerabilities": vulnerabilities_found,
        }
