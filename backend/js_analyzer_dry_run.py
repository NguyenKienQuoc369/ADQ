#!/usr/bin/env python3
import json
from core.js_analyzer import DeepJSAnalyzer

# Sample minified JS chunk simulating a React/Next.js bundle
SAMPLE_MINIFIED_JS = """
(self.webpackChunk_N_E=self.webpackChunk_N_E||[]).push([[823],{
  7482: function(e, t, r) {
    "use strict";
    const API_URL = "/api/v2/internal/user_data";
    const SECRET_KEY = "AIzaSyDfakeGoogleKeyForTestingPurpose12";
    const BEARER = "bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
    
    function fetchUserData(userId) {
      return fetch("/api/v1/auth/session?user_id=" + userId + "&debug=true", {
        headers: { Authorization: BEARER }
      });
    }

    async function updateProfile(data) {
      return axios.post("/internal/admin/update_role", {
        account_id: data.accountId,
        role: "admin",
        is_internal: true
      }, { params: { bypass_otp: 1, trace_id: "9981" } });
    }
  }
}]);
//# sourceMappingURL=bundle.js.map
"""

SAMPLE_SOURCEMAP_JSON = json.dumps({
  "version": 3,
  "file": "bundle.js",
  "sources": ["src/api/auth.ts", "src/services/admin.ts"],
  "sourcesContent": [
    "export const login = (email, pass) => fetch('/api/v2/auth/login_with_otp', { method: 'POST', body: JSON.stringify({ email, pass, captcha_token: 'xyz' }) });",
    "export const resetDb = () => axios.get('/internal/debug/reset_db?confirm=true&token=ghp_123456789012345678901234567890123456');"
  ]
})


def main():
  print("=" * 60)
  print("🔥 RUNNING DEEP JS ANALYZER DRY-RUN TEST")
  print("=" * 60)

  analyzer = DeepJSAnalyzer()

  # 1. Test Static JS Analysis
  print("\n[1] Testing Static Code Analysis (JS Bundle)...")
  result = analyzer.analyze_code(SAMPLE_MINIFIED_JS, source_url="https://target.com/static/js/bundle.js")

  print(f"-> Source URL: {result['source_url']}")
  print(f"-> Sourcemap Found: {result['sourcemap_found']} ({result['sourcemap_url']})")
  print(f"-> Endpoints Extracted ({len(result['endpoints'])}):")
  for ep in result["endpoints"]:
      print(f"   • {ep}")

  print(f"\n-> Secrets Found ({len(result['secrets'])}):")
  for sec in result["secrets"]:
      print(f"   • [{sec['type']}] {sec['value']}")

  print(f"\n-> Parameters Extracted ({len(result['parameters'])}):")
  for param in result["parameters"]:
      print(f"   • {param}")

  # 2. Test Sourcemap Parsing
  print("\n[2] Testing Sourcemap (.map) Parsing...")
  sm_result = analyzer.analyze_sourcemap_content(SAMPLE_SOURCEMAP_JSON)
  print(f"-> Valid Sourcemap: {sm_result['valid_sourcemap']}")
  print(f"-> Sources Count: {sm_result['sources_count']}")
  print(f"-> Recovered Endpoints ({len(sm_result['recovered_endpoints'])}):")
  for ep in sm_result["recovered_endpoints"]:
      print(f"   • {ep}")

  print(f"\n-> Recovered Secrets ({len(sm_result['recovered_secrets'])}):")
  for sec in sm_result["recovered_secrets"]:
      print(f"   • [{sec['type']}] {sec['value']}")

  print("\n" + "=" * 60)
  print("✅ DEEP JS ANALYZER DRY-RUN COMPLETED SUCCESSFULLY!")
  print("=" * 60)


if __name__ == "__main__":
    main()
