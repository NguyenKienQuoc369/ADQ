#!/usr/bin/env python3
import time
import requests
from core.waf_evasion import AdaptiveWAFEvasionEngine
from core.session_manager import AuthenticatedSessionManager


def main():
    print("=" * 70)
    print("🛡️ ADQ WAF EVASION & AUTHENTICATED SESSION ENGINE DRY-RUN")
    print("=" * 70)

    # 1. Test Session Manager
    print("\n[1] Testing Authenticated Session Manager...")
    session_mgr = AuthenticatedSessionManager(
        token_a="eyJhbGciOiJIUzI1NiJ9.user_token_A_sample",
        token_b="eyJhbGciOiJIUzI1NiJ9.user_token_B_sample",
        auth_type="Bearer",
    )
    
    print(f"  • User A Valid: {session_mgr.is_token_valid('A')}")
    print(f"  • User A Auth Header: {session_mgr.get_auth_header('A')}")
    print(f"  • User B Auth Header: {session_mgr.get_auth_header('B')}")

    # Validate against public endpoint
    auth_val = session_mgr.validate_endpoint_auth("https://httpbin.org/bearer", user_key="A")
    print(f"  • Endpoint Auth Validation (httpbin): Status {auth_val.get('status_code')}, Authenticated: {auth_val.get('authenticated')}")

    # 2. Test WAF Evasion Engine
    print("\n[2] Testing Adaptive WAF Evasion Engine...")
    waf_engine = AdaptiveWAFEvasionEngine(base_delay=0.1, max_delay=3.0, max_retries=2)

    def sample_req():
        headers = waf_engine.get_random_headers()
        return requests.get("https://httpbin.org/headers", headers=headers, timeout=5)

    print("  • Executing WAF-safe request with Randomized User-Agent & Spoofed IPs...")
    res = waf_engine.execute_request_safe(sample_req)

    print(f"  • WAF Executed Success: {res.get('success')}")
    print(f"  • Status Code: {res.get('status_code')}")
    print(f"  • Delay Used: {res.get('delay_used')}s")

    print("\n" + "=" * 70)
    print("✅ WAF EVASION & SESSION MANAGER DRY-RUN COMPLETED SUCCESSFULLY!")
    print("=" * 70)


if __name__ == "__main__":
    main()
