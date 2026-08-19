import json
from collections import Counter
from typing import Any, Dict, List, Optional

import requests

try:
    from config import config
except ImportError:
    from backend.config import config


def _severity_score(severity: str) -> int:
    normalized = (severity or "").lower()
    mapping = {
        "critical": 5,
        "high": 4,
        "medium": 3,
        "low": 2,
        "info": 1,
    }
    return mapping.get(normalized, 1)


def _risk_level_from_counts(counts: Counter) -> str:
    if counts.get("critical", 0) > 0:
        return "critical"
    if counts.get("high", 0) >= 2:
        return "high"
    if counts.get("high", 0) >= 1 or counts.get("medium", 0) >= 3:
        return "medium"
    return "low"


def _heuristic_analysis(target: str, vulnerabilities: List[Dict[str, Any]], live_hosts: List[Dict[str, Any]]) -> Dict[str, Any]:
    severity_counts: Counter = Counter()
    false_positive_candidates: List[Dict[str, Any]] = []
    top_findings: List[Dict[str, Any]] = []

    sorted_vulns = sorted(
        vulnerabilities,
        key=lambda item: _severity_score(str(item.get("severity") or "info")),
        reverse=True,
    )

    for vuln in vulnerabilities:
        if vuln.get("source") == "nuclei":
            severity = str(vuln.get("severity") or "info").lower()
            severity_counts[severity] += 1
            template_id = str(vuln.get("template_id") or "")
            if template_id.startswith("tech-detect") or severity in {"info", "low"}:
                false_positive_candidates.append(
                    {
                        "source": "nuclei",
                        "template_id": template_id,
                        "reason": "Mẫu severity thấp hoặc thiên về fingerprinting.",
                    }
                )
        elif vuln.get("source") == "ffuf":
            status_code = int(vuln.get("status_code") or 0)
            if status_code in {301, 302, 403, 404}:
                false_positive_candidates.append(
                    {
                        "source": "ffuf",
                        "endpoint": vuln.get("endpoint"),
                        "reason": "Mã phản hồi thường gặp, cần xác minh thủ công.",
                    }
                )

    for item in sorted_vulns[:5]:
        top_findings.append(
            {
                "source": item.get("source"),
                "template_id": item.get("template_id"),
                "endpoint": item.get("endpoint"),
                "host": item.get("host"),
                "severity": item.get("severity") or "info",
            }
        )

    risk_level = _risk_level_from_counts(severity_counts)
    confidence = min(95, 55 + len(vulnerabilities) + (severity_counts.get("high", 0) * 8) + (severity_counts.get("critical", 0) * 10))

    recommended_actions = [
        "Xác minh thủ công tất cả finding mức HIGH/CRITICAL bằng PoC an toàn.",
        "Rà soát endpoint nhạy cảm (.env/.git/admin/swagger/graphql) với xác thực đầy đủ.",
        "Áp dụng rate-limit, WAF rule, và tắt endpoint debug/public không cần thiết.",
    ]

    return {
        "engine": "heuristic",
        "target": target,
        "risk_level": risk_level,
        "confidence": confidence,
        "summary": (
            f"Phân tích heuristic cho {target}: {len(vulnerabilities)} findings trên "
            f"{len(live_hosts)} live hosts; mức rủi ro tổng quan {risk_level.upper()}."
        ),
        "severity_counts": dict(severity_counts),
        "false_positive_candidates": false_positive_candidates[:10],
        "top_findings": top_findings,
        "recommended_actions": recommended_actions,
    }


def _build_messages(target: str, vulnerabilities: List[Dict[str, Any]], live_hosts: List[Dict[str, Any]]) -> List[Dict[str, str]]:
    compact_vulns = vulnerabilities[:25]
    compact_hosts = [{"url": h.get("url"), "status_code": h.get("status_code")} for h in live_hosts[:25]]
    system_prompt = (
        "Bạn là Security Triage AI trong môi trường pentest có ủy quyền. "
        "Nhiệm vụ: phân tích kết quả quét tự động, xếp hạng mức độ nguy hiểm, lọc cảnh báo giả, "
        "và đề xuất hành động xử lý. Chỉ trả JSON hợp lệ, không markdown, không giải thích thêm."
    )
    user_prompt = {
        "target": target,
        "instruction": [
            "Đánh giá rủi ro tổng thể (critical/high/medium/low)",
            "Ước lượng confidence 0-100",
            "Liệt kê false_positive_candidates ngắn gọn",
            "Chọn tối đa 5 top_findings quan trọng nhất",
            "Đề xuất 3-5 hành động khắc phục ưu tiên",
        ],
        "live_hosts": compact_hosts,
        "vulnerabilities": compact_vulns,
        "output_schema": {
            "risk_level": "critical|high|medium|low",
            "confidence": "number",
            "summary": "string",
            "false_positive_candidates": [{"source": "string", "reason": "string", "ref": "string"}],
            "top_findings": [{"source": "string", "severity": "string", "host": "string", "endpoint": "string", "template_id": "string"}],
            "recommended_actions": ["string"],
        },
    }
    return [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": json.dumps(user_prompt, ensure_ascii=False)},
    ]


def _call_llm_analysis(target: str, vulnerabilities: List[Dict[str, Any]], live_hosts: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    api_key = getattr(config, "GEMINI_API_KEY", None) or getattr(config, "AI_API_KEY", None)
    if not api_key:
        return None

    model = getattr(config, "GEMINI_MODEL", None) or getattr(config, "AI_MODEL", "gemini-3.5-flash-lite")
    url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key}"

    system_prompt = (
        "Bạn là Security Triage AI trong môi trường pentest có ủy quyền. "
        "Nhiệm vụ: phân tích kết quả quét tự động, xếp hạng mức độ nguy hiểm, lọc cảnh báo giả, "
        "và đề xuất hành động xử lý. Bắt buộc chỉ trả về định dạng JSON hợp lệ."
    )

    user_data = {
        "target": target,
        "live_hosts": [{"url": h.get("url"), "status_code": h.get("status_code")} for h in live_hosts[:25]],
        "vulnerabilities": vulnerabilities[:25],
        "schema_output": {
            "risk_level": "critical|high|medium|low",
            "confidence": "number (0-100)",
            "summary": "string",
            "false_positive_candidates": [{"source": "string", "reason": "string", "ref": "string"}],
            "top_findings": [{"source": "string", "severity": "string", "host": "string", "endpoint": "string", "template_id": "string"}],
            "recommended_actions": ["string"],
        },
    }

    payload = {
        "systemInstruction": {"parts": [{"text": system_prompt}]},
        "contents": [{"role": "user", "parts": [{"text": json.dumps(user_data, ensure_ascii=False)}]}],
        "generationConfig": {
            "responseMimeType": "application/json",
            "temperature": 0.1,
            "maxOutputTokens": 2048,
        },
    }

    response = requests.post(
        url,
        headers={"Content-Type": "application/json"},
        json=payload,
        timeout=getattr(config, "AI_TIMEOUT", 30),
    )
    response.raise_for_status()
    data = response.json()

    candidates = data.get("candidates", [])
    if not candidates:
        return None

    content = candidates[0].get("content", {}).get("parts", [{}])[0].get("text", "")
    if not content:
        return None

    parsed = json.loads(content)
    parsed["engine"] = "gemini_native"
    parsed["target"] = target
    return parsed

def analyze_security_findings(
    scan_id: str,
    target: str,
    vulnerabilities: List[Dict[str, Any]],
    live_hosts: List[Dict[str, Any]],
) -> Dict[str, Any]:
    try:
        llm_result = _call_llm_analysis(target, vulnerabilities, live_hosts)
    except Exception as exc:
        llm_result = {
            "engine": "llm_error",
            "error": str(exc),
        }

    if llm_result and llm_result.get("engine") == "llm":
        analysis = llm_result
    else:
        analysis = _heuristic_analysis(target, vulnerabilities, live_hosts)
        if llm_result and llm_result.get("engine") == "llm_error":
            analysis["llm_error"] = llm_result.get("error")

    return analysis
