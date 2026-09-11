"""
Unit tests for Security Controls Registry and 4-State Assurance Engine.
"""

import pytest
from backend.security_controls.registry import (
    SECURITY_CONTROLS_REGISTRY,
    get_control_by_id,
    list_all_controls,
)
from backend.security_controls.assurance_engine import evaluate_scan_assurance


def test_controls_registry_loaded():
    controls = list_all_controls()
    assert len(controls) >= 15
    for c in controls:
        assert c.id
        assert c.code
        assert c.title
        assert c.stage_id in ("recon_infra", "web_mapping", "dast_active", "deep_logic")
        assert c.category
        assert c.remediation_guide


def test_get_control_by_id():
    control = get_control_by_id("SURFACE-OPEN-PORT")
    assert control is not None
    assert control.id == "SURFACE-OPEN-PORT"
    assert "Port" in control.title


def test_assurance_evaluation_clean_completed_scan():
    mock_scan = {
        "status": "COMPLETED",
        "target": "https://example.com",
        "vulnerabilities": [],
        "secrets": [],
        "logic_vulnerabilities": [],
    }

    result = evaluate_scan_assurance(mock_scan, user_tier="PRO")

    assert result["engine_version"]
    assert result["coverage_summary"]["tested_controls"] > 0
    assert result["coverage_summary"]["failed_controls"] == 0
    assert result["coverage_summary"]["passed_controls"] == result["coverage_summary"]["tested_controls"]
    assert result["coverage_summary"]["assurance_score"] == 100.0

    # Ensure all tested controls are PASS
    pass_controls = [c for c in result["controls"] if c["status"] == "PASS"]
    assert len(pass_controls) > 0


def test_assurance_evaluation_with_findings():
    mock_scan = {
        "status": "COMPLETED",
        "target": "https://example.com",
        "vulnerabilities": [
            {
                "title": "SQL Injection in /api/v1/user",
                "severity": "CRITICAL",
                "endpoint": "/api/v1/user",
                "cve": "CWE-89",
            },
            {
                "title": "Missing Security Headers (HSTS, CSP)",
                "severity": "LOW",
                "endpoint": "https://example.com",
                "cve": "CWE-693",
            }
        ],
        "secrets": [
            {
                "title": "AWS Secret Key leaked in bundle.js",
                "severity": "CRITICAL",
                "endpoint": "/static/bundle.js"
            }
        ],
        "logic_vulnerabilities": [],
    }

    result = evaluate_scan_assurance(mock_scan, user_tier="PRO")

    cov = result["coverage_summary"]
    assert cov["failed_controls"] >= 3  # SQLI, Headers, Secrets
    assert cov["passed_controls"] > 0
    assert cov["assurance_score"] < 100.0
    assert cov["assurance_score"] > 0.0

    # Verify control specific statuses
    ctrl_map = {c["id"]: c for c in result["controls"]}
    assert ctrl_map["INPUT-SQLI-BASIC"]["status"] == "FAIL"
    assert len(ctrl_map["INPUT-SQLI-BASIC"]["findings"]) >= 1

    assert ctrl_map["CLIENT-JS-SECRETS"]["status"] == "FAIL"
    assert ctrl_map["WEB-HEADERS-SECURITY"]["status"] == "FAIL"
    assert ctrl_map["SURFACE-OPEN-PORT"]["status"] == "PASS"


def test_assurance_evaluation_tier_skipping():
    mock_scan = {
        "status": "COMPLETED",
        "target": "https://example.com",
        "vulnerabilities": [],
    }

    # Free tier should skip deep_logic stage
    result = evaluate_scan_assurance(mock_scan, user_tier="FREE")
    ctrl_map = {c["id"]: c for c in result["controls"]}
    assert ctrl_map["LOGIC-AUTH-BYPASS"]["status"] == "NOT_TESTED"

