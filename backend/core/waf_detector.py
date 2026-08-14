import re
import urllib.parse
from typing import Any, Dict, List, Optional
import requests
import urllib3

urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

class WAFFingerprintDetector:
    """
    WAF Fingerprinting Engine (Khứu giác Trinh sát WAF)
    - Passive Analysis: Inspects HTTP Headers (Server, x-vercel-id, cf-ray, x-amz-cf-id, etc.) & Cookies.
    - Active Provocation: Sends harmless benign attack payloads (e.g. /?id=<script>alert(1)</script>) to provoke WAF block pages and analyze signatures.
    - Multi-WAF Stacking: Detects when targets are behind multiple layered WAFs (e.g., Cloudflare + Vercel).
    """

    SIGNATURES = {
        "Cloudflare": {
            "headers": ["cf-ray", "cf-cache-status", "cf-request-id"],
            "server": ["cloudflare"],
            "cookies": ["__cf_bm", "cf_clearance"],
            "body": ["attention required! | cloudflare", "ray id:", "cloudflare ray id"],
        },
        "Vercel Edge": {
            "headers": ["x-vercel-id", "x-vercel-cache", "x-vercel-mitigated", "x-vercel-protection-bypass"],
            "server": ["vercel"],
            "cookies": ["__vercel"],
            "body": ["vercel security checkpoint", "x-vercel-challenge-token"],
        },
        "AWS WAF / CloudFront": {
            "headers": ["x-amz-cf-id", "x-amz-cf-pop", "x-amzn-requestid", "x-amzn-errortype"],
            "server": ["cloudfront", "aws"],
            "cookies": ["awsalb", "awsalbcors"],
            "body": ['{"message":"forbidden"}', "awswaf"],
        },
        "Akamai": {
            "headers": ["x-akamai-transformed", "x-akamai-request-id", "akamai-grn"],
            "server": ["akamai"],
            "cookies": ["ak_bmsc", "aka_debug"],
            "body": ["access denied - akamai", "reference #"],
        },
        "Imperva / Incapsula": {
            "headers": ["x-cdn", "x-iinfo", "incap_ses"],
            "server": ["incapsula", "imperva"],
            "cookies": ["visid_incap", "incap_ses"],
            "body": ["incapsula_incident", "_incapsula_resource"],
        },
        "F5 BIG-IP ASM": {
            "headers": ["x-cnection", "x-wa-info"],
            "server": ["big-ip", "bigip"],
            "cookies": ["TS01", "BIGipServer"],
            "body": ["the requested url was rejected. please consult with your administrator"],
        },
        "Sucuri": {
            "headers": ["x-sucuri-id", "x-sucuri-cache"],
            "server": ["sucuri"],
            "cookies": ["sucuri_cloudproxy"],
            "body": ["sucuri website firewall", "access denied - sucuri website firewall"],
        },
        "Fortinet FortiWeb": {
            "headers": ["x-forti-web"],
            "server": ["fortiweb"],
            "cookies": ["FORTIWAFSID"],
            "body": ["fortiguard web filtering"],
        }
    }

    def __init__(self, timeout: int = 5):
        self.timeout = timeout

    def detect_waf(self, target_url: str) -> Dict[str, Any]:
        """
        Runs 2-phase WAF Fingerprint detection:
        Phase 1: Passive Header & Cookie Analysis
        Phase 2: Active Provocation (Harmless XSS/SQLi payload to trigger block page)
        Returns dictionary with detected WAF platforms and bypass recommendations.
        """
        detected_wafs = []
        evidence = {}

        raw_target = target_url.strip()
        if not raw_target.startswith(("http://", "https://")):
            clean_url = f"https://{raw_target}"
        else:
            clean_url = raw_target

        headers_default = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) ADQ-WAF-Detector/2.0",
            "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        }

        # ---------------------------------------------------------------------
        # Phase 1: Passive Analysis
        # ---------------------------------------------------------------------
        try:
            r_passive = requests.get(clean_url, headers=headers_default, timeout=self.timeout, verify=False)
            self._analyze_response(r_passive, detected_wafs, evidence, phase="Passive")
        except Exception as e:
            evidence["passive_error"] = str(e)

        # ---------------------------------------------------------------------
        # Phase 2: Active Provocation (Trigger WAF Block Page)
        # ---------------------------------------------------------------------
        provoke_url = f"{clean_url.rstrip('/')}/?adq_probe=<script>alert('ADQ_WAF_PROBE')</script>&sqli=' OR 1=1--"
        try:
            r_active = requests.get(provoke_url, headers=headers_default, timeout=self.timeout, verify=False)
            if r_active.status_code in (403, 406, 429, 503):
                self._analyze_response(r_active, detected_wafs, evidence, phase="Active (HTTP 403 Block Page)")
        except Exception as e:
            evidence["active_error"] = str(e)

        # Deduplicate detected WAFs
        unique_wafs = list(dict.fromkeys(detected_wafs))

        return {
            "target": clean_url,
            "has_waf": len(unique_wafs) > 0,
            "detected_wafs": unique_wafs if unique_wafs else ["No WAF / Generic Server"],
            "is_multi_waf": len(unique_wafs) > 1,
            "evidence": evidence,
        }

    def _analyze_response(self, resp: requests.Response, detected_wafs: List[str], evidence: Dict[str, Any], phase: str):
        headers_lower = {k.lower(): v.lower() for k, v in resp.headers.items()}
        cookies_str = "; ".join([f"{k}={v}" for k, v in resp.cookies.items()])
        body_sample = resp.text[:4000].lower()
        server_val = headers_lower.get("server", "")

        for waf_name, sigs in self.SIGNATURES.items():
            found_reasons = []

            # 1. Header signatures
            for h in sigs.get("headers", []):
                if h in headers_lower:
                    found_reasons.append(f"Header: '{h}'")

            # 2. Server header signatures
            for s in sigs.get("server", []):
                if s in server_val:
                    found_reasons.append(f"Server Header: '{server_val}'")

            # 3. Cookie signatures
            for c in sigs.get("cookies", []):
                if c.lower() in cookies_str.lower():
                    found_reasons.append(f"Cookie: '{c}'")

            # 4. Body signatures
            for b in sigs.get("body", []):
                if b in body_sample:
                    found_reasons.append(f"Body Signature: '{b}'")

            if found_reasons:
                if waf_name not in detected_wafs:
                    detected_wafs.append(waf_name)
                evidence[f"{phase} - {waf_name}"] = found_reasons


def detect_target_waf(target_url: str) -> Dict[str, Any]:
    """Convenience helper function for rapid WAF fingerprinting."""
    detector = WAFFingerprintDetector()
    return detector.detect_waf(target_url)
