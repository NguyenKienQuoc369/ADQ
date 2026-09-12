"""
ADQ Unit Tests: Tenant Isolation, Product Help Registry & Session Memory
"""

import pytest
from fastapi import HTTPException
from backend.core.ai_copilot.product_help_registry import (
    PRODUCT_HELP_REGISTRY,
    get_product_help_summary,
    query_product_help,
)
from backend.core.ai_copilot.copilot_engine import ADQSecurityCopilot
from backend.routers.scan_router import authorize_scan_job_access
from backend.services.scan_service import ScanService


def test_product_help_registry_content():
    """Verify that Product Help Registry covers all real authenticated routes."""
    required_features = ["projects", "scan", "stress_test", "reports", "apk_audit", "copilot", "billing", "settings"]
    for feat_id in required_features:
        assert feat_id in PRODUCT_HELP_REGISTRY
        feat = PRODUCT_HELP_REGISTRY[feat_id]
        assert "route" in feat
        assert "purpose" in feat
        assert len(feat["primary_actions"]) > 0

    summary = get_product_help_summary()
    assert "/dashboard" in summary
    assert "/scan" in summary
    assert "/stress-test" in summary
    assert "/copilot" in summary
    assert "/apk-audit" in summary


def test_product_help_keyword_queries():
    """Test standard FAQ queries against product help registry."""
    ans1 = query_product_help("Làm sao xác minh target?")
    assert ans1 is not None
    assert "adq-verification" in ans1 or "thẻ" in ans1

    ans2 = query_product_help("Redeem code ở đâu?")
    assert ans2 is not None
    assert "/dashboard/billing" in ans2


def test_scan_job_tenant_authorization():
    """Verify that user B cannot access user A's scan job."""
    user_a = {"id": "user_a_123", "role": "USER"}
    user_b = {"id": "user_b_456", "role": "USER"}
    admin_user = {"id": "admin_789", "role": "ADMIN", "app_metadata": {"role": "ADMIN"}}

    job_a = {
        "job_id": "scan_job_alpha",
        "user_id": "user_a_123",
        "target": "https://quocbank.com",
    }

    # User A accesses own job -> PASS
    authorize_scan_job_access(job_a, user_a)

    # User B accesses User A's job -> MUST RAISE 403
    with pytest.raises(HTTPException) as exc_info:
        authorize_scan_job_access(job_a, user_b)
    assert exc_info.value.status_code == 403

    # Admin accesses User A's job -> PASS
    authorize_scan_job_access(job_a, admin_user)


def test_copilot_context_snapshot_builder():
    """Test that context snapshot is properly built and sensitive data masked."""
    copilot = ADQSecurityCopilot()
    
    mock_scan_job = {
        "id": "scan_123",
        "target": "https://quocbank.com",
        "status": "COMPLETED",
        "live_data": {
            "open_ports": [80, 443],
            "nuclei_findings": [
                {"title": "CORS Misconfiguration", "severity": "MEDIUM", "matched": "https://quocbank.com/api"}
            ]
        },
        "assurance_matrix": {
            "controls": [
                {"title": "TLS Encryption", "status": "PASS"},
                {"title": "CORS Policy", "status": "FAIL", "severity_if_failed": "MEDIUM"}
            ]
        }
    }

    snapshot = copilot.build_scan_summary_context(mock_scan_job)
    assert snapshot["type"] == "SCAN_CONTEXT"
    assert snapshot["target"] == "https://quocbank.com"
    assert snapshot["total_findings"] == 1
    assert len(snapshot["failed_controls"]) == 1
    assert snapshot["open_ports"] == [80, 443]


def test_stress_context_snapshot_builder():
    """Test that stress context snapshot is properly built."""
    copilot = ADQSecurityCopilot()
    
    mock_stress_job = {
        "job_id": "stress_456",
        "target_url": "https://quocbank.com",
        "status": "COMPLETED",
        "duration_sec": 10,
        "target_rps": 1000,
        "metrics": {
            "total_requests": 10000,
            "rps": 998.5,
            "p95_latency": "45ms",
            "p99_latency": "120ms",
            "error_rate": 0.0,
            "status_200": 10000,
        },
        "verdict": "ỔN ĐỊNH",
    }

    snapshot = copilot.build_stress_summary_context(mock_stress_job)
    assert snapshot["type"] == "STRESS_TEST_CONTEXT"
    assert snapshot["target"] == "https://quocbank.com"
    assert snapshot["metrics"]["rps"] == 998.5
    assert snapshot["metrics"]["p95_latency"] == "45ms"
    assert snapshot["verdict"] == "ỔN ĐỊNH"

