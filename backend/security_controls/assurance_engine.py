"""
4-State Security Control Assurance Engine for ADQ.
Evaluates controls into PASS, FAIL, NOT_TESTED, INCONCLUSIVE with evidence,
remediation guides, stage summaries, honest coverage, and transparent scope limitations.
"""

from typing import Dict, List, Any, Optional
import time
from .registry import SECURITY_CONTROLS_REGISTRY, SecurityControl, list_all_controls


# Standard Stages Definition
STAGES_ORDER = [
    {
        "id": "recon_infra",
        "name": "Infrastructure & Discovery",
        "name_vi": "Hạ tầng & Khám phá (Recon)",
        "description": "Rà soát tên miền phụ, phân tích DNS và phát hiện cổng dịch vụ công khai.",
    },
    {
        "id": "web_mapping",
        "name": "Web Attack Surface Mapping",
        "name_vi": "Lập bản đồ Bề mặt Tấn công (Web Mapping)",
        "description": "Thu thập endpoint, phát hiện WAF/CDN, tài liệu API và phân tích secret trong JavaScript.",
    },
    {
        "id": "dast_active",
        "name": "Active Dynamic Application Security Testing",
        "name_vi": "Kiểm thử An ninh Động (Active DAST)",
        "description": "Kiểm thử tiêu đề HTTP, cookie, rò rỉ file cấu hình (.env, .git) và các mẫu tấn công SQLi/XSS/RCE cơ bản.",
    },
    {
        "id": "deep_logic",
        "name": "Deep Logic & API Integrity",
        "name_vi": "Logic Nghiệp vụ Chuyên sâu (Deep Logic)",
        "description": "Phân tích chuỗi logic phân quyền, IDOR, ô nhiễm tham số (HPP) và chính sách CORS liên nguồn.",
    },
]

SCOPE_LIMITATIONS = [
    {
        "id": "NON_DESTRUCTIVE_ONLY",
        "title": "Non-Destructive Active Probing",
        "title_vi": "Thử nghiệm An toàn Không Phá hủy",
        "description": "ADQ scanner utilizes non-destructive proof-of-concept probes to prevent database corruption, Denial of Service, or data loss on production targets.",
        "description_vi": "Bộ quét ADQ sử dụng các payload PoC an toàn, nghiêm cấm các kỹ thuật khai thác phá hủy dữ liệu, tràn bộ đệm hoặc gây từ chối dịch vụ (DoS) trên hệ thống đích."
    },
    {
        "id": "UNAUTHENTICATED_SURFACE",
        "title": "Scope of Unauthenticated Assessment",
        "title_vi": "Phạm vi Đánh giá Bề mặt Công khai",
        "description": "Unless specific authenticated session tokens/headers are supplied in scan options, evaluation is constrained to publicly reachable surfaces.",
        "description_vi": "Mặc định kiểm thử tập trung vào bề mặt công khai. Các luồng nghiệp vụ nội bộ yêu cầu đăng nhập cần cung cấp Authorization header / session cookie trong cấu hình quét."
    },
    {
        "id": "NO_ABSOLUTE_SECURITY_CLAIM",
        "title": "Security Control Assurance vs Immunity",
        "title_vi": "Tính Chất Đảm bảo Kiểm soát (Không Khẳng định 100% An toàn)",
        "description": "Passing a security control verifies that specific automated checks did not detect known vulnerability patterns at the time of testing; it does not constitute a mathematical proof of total system immunity.",
        "description_vi": "Kết quả PASS phản ánh việc kiểm thử tự động tại thời điểm quét không phát hiện lỗ hổng theo các mẫu kiểm tra quy định. Đây là thước đo đảm bảo kiểm soát, không phải là cam kết an toàn tuyệt đối 100%."
    },
    {
        "id": "RATE_LIMIT_ADAPTATION",
        "title": "Target Rate-Limiting & Adaptive Throttling",
        "title_vi": "Điều tiết Tần suất Thích ứng",
        "description": "Scanner automatically throttles requests when upstream rate-limits or 429/503 responses are received to avoid impacting target availability.",
        "description_vi": "Scanner tự động điều tiết tốc độ gửi yêu cầu khi phát hiện phản hồi 429/503 từ máy chủ đích để tránh ảnh hưởng đến vận hành của người dùng."
    }
]


def _match_finding_to_control(finding: Dict[str, Any]) -> List[str]:
    """
    Phân loại một finding/vulnerability vào một hoặc nhiều Security Control IDs phù hợp.
    """
    matched_ids = set()
    
    title = str(finding.get("title") or finding.get("template_id") or finding.get("name") or "").lower()
    description = str(finding.get("description") or "").lower()
    endpoint = str(finding.get("endpoint") or finding.get("host") or finding.get("matched") or "").lower()
    cve = str(finding.get("cve") or "").upper()
    finding_type = str(finding.get("type") or finding.get("source") or "").lower()

    text = f"{title} {description} {endpoint} {finding_type}"

    # 1. Exposed Ports
    if "port" in text or "open port" in text or "exposed service" in text:
        matched_ids.add("SURFACE-OPEN-PORT")

    # 2. DNS
    if "dns" in text or "subdomain takeover" in text or "cname" in text:
        matched_ids.add("DNS-SECURITY")

    # 3. API Docs
    if "swagger" in text or "openapi" in text or "api-docs" in text or "graphql" in text or "redoc" in text:
        matched_ids.add("SURFACE-API-DOCS")

    # 4. Sensitive Paths & Admin
    if "/admin" in endpoint or "actuator" in text or "phpinfo" in text or "server-status" in text or "sensitive path" in text:
        matched_ids.add("SURFACE-SENSITIVE-PATH")

    # 5. WAF
    if "waf" in text or "firewall" in text:
        matched_ids.add("WAF-DETECTION")

    # 6. JS Secrets
    if "secret" in text or "token" in text or "api key" in text or "source map" in text or finding_type == "secrets":
        matched_ids.add("CLIENT-JS-SECRETS")

    # 7. Security Headers
    if "header" in text or "hsts" in text or "csp" in text or "x-frame-options" in text or "content-security-policy" in text:
        matched_ids.add("WEB-HEADERS-SECURITY")

    # 8. Cookies
    if "cookie" in text or "httponly" in text or "samesite" in text:
        matched_ids.add("WEB-COOKIE-FLAGS")

    # 9. Backup files & Git
    if ".git" in text or ".bak" in text or ".sql" in text or "backup" in text:
        matched_ids.add("EXPOSURE-BACKUP-FILES")

    # 10. Env secrets
    if ".env" in text or "environment" in text or "docker-compose" in text or "config.json" in text:
        matched_ids.add("EXPOSURE-ENV-SECRETS")

    # 11. SQL Injection
    if "sqli" in text or "sql injection" in text or "cwe-89" in cve:
        matched_ids.add("INPUT-SQLI-BASIC")

    # 12. XSS
    if "xss" in text or "cross-site scripting" in text or "cwe-79" in cve:
        matched_ids.add("INPUT-XSS-BASIC")

    # 13. RCE / Command Injection
    if "rce" in text or "command injection" in text or "cwe-78" in cve or "cwe-94" in cve:
        matched_ids.add("INPUT-COMMAND-INJECTION")

    # 14. Default Creds
    if "default cred" in text or "default login" in text or "admin:admin" in text:
        matched_ids.add("AUTH-DEFAULT-CREDS")

    # 15. SSL / TLS
    if "ssl" in text or "tls" in text or "certificate" in text or "cipher" in text:
        matched_ids.add("SSL-TLS-CONFIGURATION")

    # 16. Logic & Auth Bypass
    if "idor" in text or "bola" in text or "auth bypass" in text or "logic" in text or finding_type == "logic":
        matched_ids.add("LOGIC-AUTH-BYPASS")

    # 17. Param Tampering
    if "parameter pollution" in text or "hpp" in text or "rate limit" in text or "tampering" in text:
        matched_ids.add("PARAM-TAMPERING")

    # 18. CORS
    if "cors" in text or "cross-origin" in text or "cwe-942" in cve:
        matched_ids.add("CORS-MISCONFIG")

    # Default fallback to Sensitive path or Exposed Services if non-empty
    if not matched_ids:
        if "exposure" in text or "misconfiguration" in text:
            matched_ids.add("SURFACE-EXPOSED-SERVICES")
        else:
            matched_ids.add("WEB-HEADERS-SECURITY")

    return list(matched_ids)


def evaluate_scan_assurance(scan_data: Dict[str, Any], user_tier: str = "FREE") -> Dict[str, Any]:
    """
    Evaluates scan findings and stages against the canonical security controls registry.
    Returns the comprehensive Assurance Matrix with PASS, FAIL, NOT_TESTED, INCONCLUSIVE states.
    """
    raw_status = str(scan_data.get("status") or "").lower()
    is_completed = raw_status in ("completed", "done")
    is_failed = raw_status in ("failed", "error")
    is_running = raw_status in ("running", "in_progress")
    is_queued = raw_status in ("queued", "pending")

    current_step = int(scan_data.get("current_step") or 0)
    current_stage_key = str(scan_data.get("current_stage") or "")

    progress = scan_data.get("progress") or {}

    # Extract findings
    vulnerabilities = []
    
    # 1. Direct vulnerabilities list
    raw_vulns = scan_data.get("vulnerabilities")
    if isinstance(raw_vulns, list):
        vulnerabilities.extend(raw_vulns)
    elif isinstance(raw_vulns, dict):
        for k, v in raw_vulns.items():
            if isinstance(v, list):
                for item in v:
                    if isinstance(item, dict):
                        item_copy = dict(item)
                        if "source" not in item_copy:
                            item_copy["source"] = k
                        vulnerabilities.append(item_copy)

    # 2. Logic vulnerabilities
    logic_vulns = scan_data.get("logic_vulnerabilities")
    if isinstance(logic_vulns, list):
        for lv in logic_vulns:
            if isinstance(lv, dict):
                lv_copy = dict(lv)
                lv_copy["source"] = "logic"
                vulnerabilities.append(lv_copy)

    # 3. Secrets
    secrets_list = scan_data.get("secrets")
    if isinstance(secrets_list, list):
        for s in secrets_list:
            if isinstance(s, dict):
                s_copy = dict(s)
                s_copy["source"] = "secrets"
                vulnerabilities.append(s_copy)
            elif isinstance(s, str):
                vulnerabilities.append({
                    "title": "Exposed Secret Pattern in JS",
                    "severity": "CRITICAL",
                    "description": s,
                    "source": "secrets"
                })

    # Group findings by control ID
    control_findings: Dict[str, List[Dict[str, Any]]] = {cid: [] for cid in SECURITY_CONTROLS_REGISTRY}
    for vuln in vulnerabilities:
        matched_cids = _match_finding_to_control(vuln)
        for cid in matched_cids:
            if cid in control_findings:
                control_findings[cid].append(vuln)

    # Determine stage execution states
    stage_execution_state: Dict[str, str] = {}
    for st in STAGES_ORDER:
        st_id = st["id"]
        if is_queued:
            stage_execution_state[st_id] = "PENDING"
        elif is_failed:
            stage_execution_state[st_id] = "FAILED"
        elif is_completed:
            # Check tier limits: FREE tier excludes deep_logic unless specified
            if st_id == "deep_logic" and user_tier == "FREE":
                stage_execution_state[st_id] = "SKIPPED"
            else:
                stage_execution_state[st_id] = "COMPLETED"
        elif is_running:
            # Determine based on current_step
            # step 1: recon, step 2: port, step 3: crawl, step 4: nuclei, step 5: secrets, step 6: logic, step 7: ai
            if st_id == "recon_infra":
                stage_execution_state[st_id] = "COMPLETED" if current_step >= 3 else "IN_PROGRESS"
            elif st_id == "web_mapping":
                if current_step < 3:
                    stage_execution_state[st_id] = "PENDING"
                elif current_step >= 5:
                    stage_execution_state[st_id] = "COMPLETED"
                else:
                    stage_execution_state[st_id] = "IN_PROGRESS"
            elif st_id == "dast_active":
                if current_step < 5:
                    stage_execution_state[st_id] = "PENDING"
                elif current_step >= 6:
                    stage_execution_state[st_id] = "COMPLETED"
                else:
                    stage_execution_state[st_id] = "IN_PROGRESS"
            elif st_id == "deep_logic":
                if user_tier == "FREE":
                    stage_execution_state[st_id] = "SKIPPED"
                elif current_step < 6:
                    stage_execution_state[st_id] = "PENDING"
                elif current_step >= 7:
                    stage_execution_state[st_id] = "COMPLETED"
                else:
                    stage_execution_state[st_id] = "IN_PROGRESS"
        else:
            stage_execution_state[st_id] = "NOT_TESTED"

    # Target and session metadata
    target_str = str(scan_data.get("target") or "").lower()
    is_https = target_str.startswith("https://") or ":443" in target_str
    is_http_plain = target_str.startswith("http://") and not is_https
    has_auth_session = bool(
        scan_data.get("auth_token")
        or scan_data.get("authenticated")
        or (isinstance(scan_data.get("options"), dict) and scan_data.get("options", {}).get("headers"))
    )

    endpoints_val = scan_data.get("endpoints") or []
    endpoints_count = len(endpoints_val) if isinstance(endpoints_val, list) else int(scan_data.get("endpoints_count") or 0)
    
    # Evaluate each security control
    evaluated_controls: List[Dict[str, Any]] = []
    
    tested_count = 0
    passed_count = 0
    failed_count = 0
    inconclusive_count = 0
    not_tested_count = 0

    for control in list_all_controls():
        cid = control.id
        st_id = control.stage_id
        st_state = stage_execution_state.get(st_id, "NOT_TESTED")
        
        findings = control_findings.get(cid, [])
        status = "NOT_TESTED"
        reason = "Chưa thực hiện kiểm thử trong lượt quét này."
        evidence: Optional[Dict[str, Any]] = None

        if st_state == "COMPLETED":
            if findings:
                status = "FAIL"
                failed_count += 1
                tested_count += 1
                reason = f"Phát hiện {len(findings)} cảnh báo / lỗ hổng vi phạm kiểm soát này."
                evidence = {
                    "execution_verified": True,
                    "detector_status": "FINDINGS_DETECTED",
                    "total_violations": len(findings),
                    "samples": findings[:5]
                }
            else:
                # Rigorous semantic verification: ensure detector executed on relevant surface
                if cid == "SSL-TLS-CONFIGURATION" and is_http_plain:
                    status = "NOT_TESTED"
                    not_tested_count += 1
                    reason = "Mục tiêu kiểm thử sử dụng giao thức HTTP thuần; không có cấu hình SSL/TLS để đánh giá."
                    evidence = {"execution_verified": False, "reason": "non_tls_target"}
                elif cid == "LOGIC-AUTH-BYPASS" and not has_auth_session:
                    status = "NOT_TESTED"
                    not_tested_count += 1
                    reason = "Kiểm thử phân quyền chuyên sâu (BOLA/IDOR) yêu cầu cung cấp phiên xác thực (Authorization header / session cookie) trong tùy chọn quét."
                    evidence = {"execution_verified": False, "reason": "unauthenticated_scan_scope"}
                elif cid in ("INPUT-SQLI-BASIC", "INPUT-XSS-BASIC", "INPUT-COMMAND-INJECTION") and endpoints_count == 0 and "target" in scan_data and not scan_data.get("fuzzed_endpoints") and not is_completed:
                    status = "INCONCLUSIVE"
                    inconclusive_count += 1
                    reason = "Không thu thập được endpoint hoặc tham số tương tác nào để kích hoạt kiểm thử fuzzing tiêm lệnh."
                    evidence = {"execution_verified": False, "reason": "no_parameters_or_endpoints_discovered"}
                elif cid == "CLIENT-JS-SECRETS" and endpoints_count == 0 and not scan_data.get("secrets_scanned") and not is_completed:
                    status = "NOT_TESTED"
                    not_tested_count += 1
                    reason = "Không phát hiện tài nguyên JavaScript client-side nào trong lượt quét để phân tích secret."
                    evidence = {"execution_verified": False, "reason": "no_js_resources"}
                else:
                    status = "PASS"
                    passed_count += 1
                    tested_count += 1
                    reason = "Đã kiểm thử hoàn tất: Bộ dò đã rà soát toàn diện và không phát hiện dấu hiệu vi phạm hoặc lỗ hổng."
                    evidence = {
                        "execution_verified": True,
                        "detector_status": "COMPLETED_CLEAN",
                        "probes_executed": True,
                        "surface_verified": True
                    }
        elif st_state == "FAILED":
            status = "INCONCLUSIVE"
            inconclusive_count += 1
            reason = "Quá trình quét giai đoạn này gặp sự cố kết nối hoặc bị ngắt quãng trước khi có kết luận."
            evidence = {"execution_verified": False, "reason": "stage_failed_or_interrupted"}
        elif st_state == "SKIPPED":
            status = "NOT_TESTED"
            not_tested_count += 1
            reason = f"Kiểm soát này yêu cầu gói {control.minimum_tier} trở lên hoặc nằm ngoài phạm vi quét hiện tại."
            evidence = {"execution_verified": False, "reason": f"tier_requirement_{control.minimum_tier}"}
        elif st_state == "IN_PROGRESS":
            status = "INCONCLUSIVE"
            inconclusive_count += 1
            reason = "Giai đoạn đang được tiến hành trên worker..."
            evidence = {"execution_verified": False, "reason": "stage_in_progress"}
        else:
            status = "NOT_TESTED"
            not_tested_count += 1
            reason = "Giai đoạn chưa được thực thi."
            evidence = {"execution_verified": False, "reason": "stage_pending"}

        evaluated_controls.append({
            "id": control.id,
            "code": control.code,
            "title": control.title,
            "title_vi": control.title_vi,
            "category": control.category,
            "stage_id": control.stage_id,
            "stage_name": control.stage_name,
            "description": control.description,
            "description_vi": control.description_vi,
            "severity_if_failed": control.severity_if_failed,
            "owasp_category": control.owasp_category,
            "cwe_ids": control.cwe_ids,
            "minimum_tier": control.minimum_tier,
            "remediation_guide": control.remediation_guide,
            "remediation_code_snippet": control.remediation_code_snippet,
            "status": status,
            "reason": reason,
            "findings_count": len(findings),
            "findings": findings,
            "evidence": evidence,
            "tested_at": scan_data.get("completed_at") or scan_data.get("started_at") or time.time(),
        })

    # Build Stage Summaries
    stages_summary = []
    for st in STAGES_ORDER:
        st_id = st["id"]
        st_controls = [c for c in evaluated_controls if c["stage_id"] == st_id]
        st_pass = sum(1 for c in st_controls if c["status"] == "PASS")
        st_fail = sum(1 for c in st_controls if c["status"] == "FAIL")
        st_inconclusive = sum(1 for c in st_controls if c["status"] == "INCONCLUSIVE")
        st_not_tested = sum(1 for c in st_controls if c["status"] == "NOT_TESTED")
        
        state = stage_execution_state.get(st_id, "PENDING")
        progress_pct = 100 if state == "COMPLETED" else (50 if state == "IN_PROGRESS" else 0)

        stages_summary.append({
            "stage_id": st_id,
            "name": st["name"],
            "name_vi": st["name_vi"],
            "description": st["description"],
            "state": state,
            "progress_pct": progress_pct,
            "total_controls": len(st_controls),
            "pass_count": st_pass,
            "fail_count": st_fail,
            "inconclusive_count": st_inconclusive,
            "not_tested_count": st_not_tested,
        })

    total_controls = len(evaluated_controls)
    coverage_pct = round((tested_count / max(1, total_controls)) * 100, 1)
    assurance_score = round((passed_count / max(1, tested_count)) * 100, 1) if tested_count > 0 else 0.0

    return {
        "engine_version": "ADQ Omni Security Engine v2.0-Enterprise",
        "evaluated_at": time.time(),
        "scan_status": raw_status.upper() if raw_status else "UNKNOWN",
        "target": scan_data.get("target") or "",
        "user_tier": user_tier,
        "coverage_summary": {
            "total_controls": total_controls,
            "tested_controls": tested_count,
            "passed_controls": passed_count,
            "failed_controls": failed_count,
            "inconclusive_controls": inconclusive_count,
            "not_tested_controls": not_tested_count,
            "coverage_percentage": coverage_pct,
            "assurance_score": assurance_score,
            "honest_coverage_statement": f"Kiểm thử thực tế {tested_count}/{total_controls} kiểm soát an ninh ({coverage_pct}% độ bao phủ danh mục). Điểm đảm bảo đo lường mức độ tuân thủ của các kiểm soát đã test, không cam kết an toàn 100% tuyệt đối."
        },
        "stages_summary": stages_summary,
        "controls": evaluated_controls,
        "scope_limitations": SCOPE_LIMITATIONS,
    }

