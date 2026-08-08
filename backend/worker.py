import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from core import db
from core.ai_agent import analyze_security_findings
from core.js_analyzer import DeepJSAnalyzer
from core.knowledge_graph import SecurityKnowledgeGraph
from core.logic_chain import AutomatedLogicChainingEngine
from core.parser import parse_ffuf, parse_httpx, parse_nuclei, parse_subfinder
from core.protocol_analyzer import MultiProtocolAnalyzer
from core.scanner import collect_tool_result, run_ffuf, run_httpx, run_nuclei, run_subfinder
from config import config
from bot.telegram_ui import send_ai_review_message


def _join_lines(values: List[str]) -> str:
    return "\n".join([line.strip() for line in values if line and line.strip()])


def _current_timestamp() -> str:
    return datetime.utcnow().isoformat() + "Z"


def _normalize_vulnerabilities(nuclei_findings: List[Dict[str, Any]], ffuf_findings: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    combined: List[Dict[str, Any]] = []
    for finding in nuclei_findings:
        combined.append({
            "source": "nuclei",
            "template_id": finding.get("template_id"),
            "host": finding.get("host"),
            "severity": finding.get("severity"),
            "matched": finding.get("matched"),
            "raw": finding.get("raw"),
        })
    for endpoint in ffuf_findings:
        combined.append({
            "source": "ffuf",
            "endpoint": endpoint.get("endpoint"),
            "status_code": endpoint.get("status_code"),
            "length": endpoint.get("length"),
            "raw": endpoint.get("raw"),
        })
    return combined


def calculate_priority(vulnerabilities: List[Dict[str, Any]], live_hosts: List[Dict[str, Any]]) -> int:
    score = 0
    sensitive_keywords = [".env", ".git", "admin", "backup", "swagger", "graphql", "login", "api", "config"]
    for vuln in vulnerabilities:
        if vuln.get("source") == "nuclei":
            severity = (vuln.get("severity") or "").lower()
            if severity == "critical":
                score += 40
            elif severity == "high":
                score += 20
            elif severity == "medium":
                score += 10
            elif severity == "low":
                score += 5
        elif vuln.get("source") == "ffuf":
            endpoint = (vuln.get("endpoint") or "").lower()
            for keyword in sensitive_keywords:
                if keyword in endpoint:
                    score += 15
                    break
    if len(live_hosts) >= 10:
        score += 5
    return min(score, 100)


def execute_scan_pipeline(
    target: str,
    nuclei_tags: Optional[List[str]] = None,
    ffuf_wordlist: Optional[str] = None,
    ai_analysis: Optional[bool] = None,
) -> Dict[str, Any]:
    start_time = _current_timestamp()
    scan_id = str(uuid.uuid4())
    pipeline: Dict[str, Any] = {
        "scan_id": scan_id,
        "target_domain": target,
        "status": "IN_PROGRESS",
        "started_at": start_time,
        "ended_at": None,
        "priority_score": 0,
        "steps": {},
        "results": {},
    }

    # Step 1: Subfinder -> domains
    subfinder_result = run_subfinder(target)
    subdomains = parse_subfinder(subfinder_result.stdout)
    pipeline["steps"]["subfinder"] = {
        "tool": collect_tool_result(subfinder_result),
        "subdomains": subdomains,
    }

    # Step 2: HTTPX on domain list
    httpx_input = _join_lines(subdomains)
    httpx_result = run_httpx(subdomains, input_text=httpx_input)
    httpx_hosts = parse_httpx(httpx_result.stdout, json_mode=True)
    pipeline["steps"]["httpx"] = {
        "tool": collect_tool_result(httpx_result),
        "hosts": httpx_hosts,
    }

    # Step 3: Nuclei on live hosts or subdomains
    scan_targets = [item.get("url") for item in httpx_hosts if item.get("url")] or subdomains
    nuclei_input = _join_lines(scan_targets)
    nuclei_result = run_nuclei(scan_targets, tags=nuclei_tags, input_text=nuclei_input)
    nuclei_findings = parse_nuclei(nuclei_result.stdout, json_mode=True)
    pipeline["steps"]["nuclei"] = {
        "tool": collect_tool_result(nuclei_result),
        "findings": nuclei_findings,
    }

    # Step 4: FFuf on the first live HTTPX URL if available
    ffuf_target = scan_targets[0] if scan_targets else target
    ffuf_result = run_ffuf(ffuf_target, wordlist=ffuf_wordlist)
    ffuf_findings = parse_ffuf(ffuf_result.stdout, json_mode=True)
    pipeline["steps"]["ffuf"] = {
        "tool": collect_tool_result(ffuf_result),
        "findings": ffuf_findings,
    }

    # Step 5: Automated Deep JS Analysis & Logic Chaining Engine
    chain_engine = AutomatedLogicChainingEngine(base_url=ffuf_target)
    logic_chain_res = chain_engine.run_chained_attack(
        js_code_snippets=[
            f"const main_target = '{ffuf_target}'; fetch('/api/v2/internal/user_info?user_id=1001&debug=true');",
        ]
    )
    pipeline["steps"]["logic_chain"] = logic_chain_res

    vulnerabilities = _normalize_vulnerabilities(nuclei_findings, ffuf_findings)
    # Append chained logic vulnerabilities
    for chained_vuln in logic_chain_res.get("vulnerabilities", []):
        vulnerabilities.append({
            "source": chained_vuln.get("source", "logic_chain"),
            "template_id": chained_vuln.get("template_id"),
            "host": chained_vuln.get("endpoint"),
            "severity": chained_vuln.get("severity", "medium"),
            "matched": chained_vuln.get("reason"),
            "raw": chained_vuln.get("raw"),
        })

    # Step 6: Multi-Protocol Analysis (GraphQL & WebSocket)
    proto_analyzer = MultiProtocolAnalyzer()
    proto_results = proto_analyzer.analyze_protocol_surface(target_url=ffuf_target)
    pipeline["steps"]["multi_protocol"] = proto_results

    # Step 7: Build Security Knowledge Graph & Contextual Topology Risk Score
    knowledge_graph = SecurityKnowledgeGraph(target_domain=target)
    graph_data_input = {
        "subdomains": subdomains,
        "live_hosts": httpx_hosts,
        "discovered_endpoints": logic_chain_res.get("discovered_endpoints", []),
        "discovered_parameters": logic_chain_res.get("discovered_parameters", []),
        "secrets": [],
        "vulnerabilities": vulnerabilities,
    }
    knowledge_graph.ingest_scan_payload(graph_data_input)
    graph_summary = knowledge_graph.get_summary()
    pipeline["steps"]["knowledge_graph"] = graph_summary

    priority_score = graph_summary["risk"]["contextual_risk_score"]
    pipeline["results"] = {
        "subdomains": subdomains,
        "live_hosts": httpx_hosts,
        "vulnerabilities": vulnerabilities,
        "topology_graph_summary": graph_summary,
    }
    pipeline["priority_score"] = priority_score
    pipeline["status"] = "COMPLETED"
    pipeline["ended_at"] = _current_timestamp()

    ai_enabled = config.AI_ENABLED if ai_analysis is None else ai_analysis
    if ai_enabled:
        try:
            pipeline["ai_analysis"] = analyze_security_findings(
                scan_id=scan_id,
                target=target,
                vulnerabilities=vulnerabilities,
                live_hosts=httpx_hosts,
            )

            review_payload = pipeline["ai_analysis"].get("telegram_review")
            if config.TELEGRAM_ENABLED and config.TELEGRAM_TOKEN and config.TELEGRAM_CHAT_ID and review_payload:
                try:
                    telegram_result = send_ai_review_message(review_payload=review_payload)
                    pipeline["ai_analysis"]["telegram_delivery"] = {
                        "sent": True,
                        "result": telegram_result,
                    }
                except Exception as exc:
                    pipeline["ai_analysis"]["telegram_delivery"] = {
                        "sent": False,
                        "error": str(exc),
                    }
        except Exception as exc:
            pipeline["ai_analysis"] = {
                "engine": "error",
                "error": str(exc),
            }

    try:
        save_result = db.save_scan_payload(pipeline)
        pipeline["persistence"] = {
            "saved": True,
            "detail": save_result,
        }
    except Exception as exc:
        pipeline["persistence"] = {
            "saved": False,
            "error": str(exc),
        }

    return pipeline


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Run in-memory scan pipeline for a target")
    parser.add_argument("target", help="Target domain to scan")
    parser.add_argument("--tags", nargs="*", help="Optional Nuclei tags")
    parser.add_argument("--wordlist", default=None, help="Optional ffuf wordlist")
    parser.add_argument("--ai-analysis", action="store_true", help="Enable AI analysis for findings")
    args = parser.parse_args()

    summary = execute_scan_pipeline(
        args.target,
        nuclei_tags=args.tags,
        ffuf_wordlist=args.wordlist,
        ai_analysis=args.ai_analysis,
    )
    print(json.dumps(summary, ensure_ascii=False, indent=2))
