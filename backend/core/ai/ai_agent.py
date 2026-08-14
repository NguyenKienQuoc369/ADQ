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
    if not config.AI_API_URL or not config.AI_API_KEY:
        return None

    headers = {
        "Authorization": f"Bearer {config.AI_API_KEY}",
        "Content-Type": "application/json",
    }
    payload = {
        "model": config.AI_MODEL,
        "temperature": 0.1,
        "messages": _build_messages(target, vulnerabilities, live_hosts),
        "response_format": {"type": "json_object"},
    }

    response = requests.post(
        config.AI_API_URL,
        headers=headers,
        json=payload,
        timeout=config.AI_TIMEOUT,
    )
    response.raise_for_status()
    data = response.json()
    content = (
        data.get("choices", [{}])[0]
        .get("message", {})
        .get("content", "")
    )
    parsed = json.loads(content)
    parsed["engine"] = "llm"
    parsed["target"] = target
    return parsed


def build_telegram_review_message(scan_id: str, analysis: Dict[str, Any]) -> Dict[str, Any]:
    risk = str(analysis.get("risk_level", "unknown")).upper()
    confidence = analysis.get("confidence", "N/A")
    summary = analysis.get("summary", "Không có tóm tắt")
    text = (
        f"🤖 <b>AI Security Review</b>\n"
        f"• Scan: <code>{scan_id}</code>\n"
        f"• Risk: <b>{risk}</b>\n"
        f"• Confidence: <b>{confidence}</b>\n\n"
        f"{summary}"
    )

    callback_vuln_type = "config_leak"
    top_findings = analysis.get("top_findings") or []
    if isinstance(top_findings, list) and top_findings:
        first = top_findings[0] or {}
        source = str(first.get("source") or "").lower()
        endpoint = str(first.get("endpoint") or "").lower()
        if source == "ffuf" and any(word in endpoint for word in ["admin", "dir", "listing"]):
            callback_vuln_type = "directory_listing"
        elif source == "nuclei" and "port" in str(first.get("template_id") or "").lower():
            callback_vuln_type = "open_port"

    return {
        "text": text,
        "parse_mode": "HTML",
        "reply_markup": {
            "inline_keyboard": [
                [
                    {"text": "✅ Approve Escalation", "callback_data": f"approve:{scan_id}:{callback_vuln_type}"},
                    {"text": "❌ Reject / Needs Review", "callback_data": f"reject:{scan_id}:{callback_vuln_type}"},
                ]
            ]
        },
    }


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

    analysis["telegram_review"] = build_telegram_review_message(scan_id=scan_id, analysis=analysis)
    return analysis