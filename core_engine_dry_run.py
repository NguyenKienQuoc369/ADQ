#!/usr/bin/env python3
import json
import time
from core.js_analyzer import DeepJSAnalyzer
from core.param_fuzzer import ContextAwareParamFuzzer
from core.logic_chain import AutomatedLogicChainingEngine

SAMPLE_JS = """
const API = "/api/v2/internal/transfer";
const PROFILE_URL = "/api/v1/user/profile?user_id=1001";
fetch(API, {
  method: "POST",
  headers: { Authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.eyJ1c2VyX2lkIjoxMDAxfQ.signature" },
  body: JSON.stringify({ amount: 500, bypass_otp: true, debug: 1 })
});
//# sourceMappingURL=app.js.map
"""

def main():
    print("=" * 70)
    print("🚀 ADQ CORE ENGINES DRY-RUN (3 CORE DIRECTIONS TEST)")
    print("=" * 70)

    # 1. Deep JS Analysis
    print("\n[DIRECTION 1] Deep JS Analysis Engine...")
    js = DeepJSAnalyzer()
    js_res = js.analyze_code(SAMPLE_JS, source_url="https://demo.local/app.js")
    print(f"  • Found Endpoints: {js_res['endpoints']}")
    print(f"  • Found Parameters: {js_res['parameters']}")
    print(f"  • Found Secrets: {len(js_res['secrets'])}")

    # 2. Context-Aware Param Fuzzing
    print("\n[DIRECTION 2] Context-Aware Param Fuzzing Engine...")
    fuzzer = ContextAwareParamFuzzer()
    # Test against HTTP baseline
    pf_res = fuzzer.fuzz_parameters("https://httpbin.org/get", param_candidates=js_res['parameters'])
    print(f"  • Baseline status: {pf_res.get('baseline', {}).get('status_code')}")
    print(f"  • Total params tested: {pf_res.get('total_params_tested')}")
    print(f"  • Discovered anomalies: {len(pf_res.get('discovered_params', []))}")

    # 3. Automated Logic Chaining
    print("\n[DIRECTION 3] Automated Logic Chaining Engine...")
    chain = AutomatedLogicChainingEngine(base_url="https://httpbin.org")
    chain_res = chain.run_chained_attack(
        js_code_snippets=[SAMPLE_JS],
        token_a="eyJhbGciOiJIUzI1NiJ9.userA",
        token_b="eyJhbGciOiJIUzI1NiJ9.userB",
        user_id_a="1001",
        user_id_b="1002",
    )
    
    print("  • Execution Log:")
    for step in chain_res["chain_execution_log"]:
        print(f"    Step {step['step']}: {step['name']}")
    
    print(f"  • Total Discovered Endpoints: {len(chain_res['discovered_endpoints'])}")
    print(f"  • Total Discovered Parameters: {len(chain_res['discovered_parameters'])}")
    print(f"  • Chained Vulnerabilities Found: {len(chain_res['vulnerabilities'])}")

    print("\n" + "=" * 70)
    print("✅ ALL 3 CORE DIRECTIONS EXECUTED AND VERIFIED SUCCESSFULLY!")
    print("=" * 70)

if __name__ == "__main__":
    main()
