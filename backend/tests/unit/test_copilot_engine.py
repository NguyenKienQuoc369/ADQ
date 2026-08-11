import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "../../")))

try:
    from core.copilot_masker import SensitiveDataMasker  # type: ignore
    from core.copilot_engine import ADQSecurityCopilot  # type: ignore
except ImportError:
    from copilot_masker import SensitiveDataMasker  # type: ignore
    from copilot_engine import ADQSecurityCopilot  # type: ignore


def test_sensitive_data_masker():
    masker = SensitiveDataMasker()

    raw_text = (
        "Found AWS Key AKIA1234567890ABCDEF and Postgres URL postgresql://admin:P@ssw0rd123!@db.internal:5432/production "
        "and JWT eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c"
    )

    masked = masker.mask_text(raw_text)

    assert "AKIA1234567890ABCDEF" not in masked
    assert "[REDACTED_AWS_KEY]" in masked
    assert "P@ssw0rd123!" not in masked
    assert "[REDACTED_DB_CONNECTION_STRING]" in masked
    assert "[REDACTED_JWT_TOKEN]" in masked

    raw_dict = {
        "user_password": "supersecretpassword123",
        "nested": {
            "api_key": "sb_123456789012345678901234",
            "normal_field": "public_data",
        }
    }

    masked_dict = masker.mask_dict_or_list(raw_dict)
    assert masked_dict["user_password"] == "[REDACTED_USER_PASSWORD]"
    assert masked_dict["nested"]["normal_field"] == "public_data"


def test_copilot_token_compression():
    copilot = ADQSecurityCopilot()

    mock_scan_results = {
        "target": "api.fintech.bank.com",
        "live_hosts": [{"url": "https://api.fintech.bank.com", "status_code": 200}],
        "vulnerabilities": [
            {
                "template_id": "cve-2024-9999",
                "severity": "critical",
                "endpoint": "/api/v1/transfer",
                "raw_secret": "AKIA1234567890ABCDEF",
            },
            {
                "template_id": "cve-2024-9999",
                "severity": "critical",
                "endpoint": "/api/v1/withdraw",
            },
            {
                "template_id": "tech-detect-express",
                "severity": "info",
                "endpoint": "/",
            },
        ],
    }

    compressed = copilot._compress_scan_findings(mock_scan_results)

    assert compressed["target"] == "api.fintech.bank.com"
    assert len(compressed["anomalies_summary"]) > 0
    # Verify masking applied in compression
    for anomaly in compressed["anomalies_summary"]:
        if anomaly["template_id"] == "cve-2024-9999":
            assert "AKIA1234567890ABCDEF" not in anomaly["raw_sample"]


def test_copilot_one_click_fix_generator():
    copilot = ADQSecurityCopilot(api_key="")  # Graceful missing key mode
    res = copilot.generate_one_click_fix("SQL Injection", "/api/v1/user", framework="Next.js")

    assert res["status"] in ("SUCCESS", "CONFIG_ERROR", "API_ERROR", "EXCEPTION")


def test_copilot_analyze_scan_job():
    copilot = ADQSecurityCopilot(api_key="")  # Graceful missing key mode
    mock_job = {
        "target": "target.com",
        "vulnerabilities": [{"template_id": "idor-bola", "severity": "high"}],
        "live_hosts": ["https://target.com"],
    }
    analysis = copilot.analyze_scan_job(mock_job)

    assert "compressed_findings" in analysis


def test_copilot_log_correlation_escalation():
    copilot = ADQSecurityCopilot()

    mock_scan_results = {
        "target": "db.fintech.bank.internal",
        "ports": [{"port": 5432, "is_open": True}],
        "vulnerabilities": [
            {
                "template_id": "postgres-connection-leak",
                "raw_secret": "postgresql://admin:SecretPass@127.0.0.1:5432/db",
            }
        ]
    }

    compressed = copilot._compress_scan_findings(mock_scan_results)

    assert compressed["correlated_attack_chains_count"] == 1
    first_anomaly = compressed["anomalies_summary"][0]
    assert first_anomaly["severity"] == "critical"
    assert "postgresql" in first_anomaly["template_id"]


def test_copilot_function_call_dispatch():
    copilot = ADQSecurityCopilot()

    func_call_sample = {
        "name": "trigger_deep_scan",
        "args": {
            "target_path": "/api/v1/admin/debug",
            "bypass_waf": True,
            "reason": "Found 403 Forbidden with Express headers"
        }
    }

    dispatch_res = copilot.dispatch_agent_function_call(func_call_sample)

    assert dispatch_res["function"] == "trigger_deep_scan"
    assert dispatch_res["args"]["target_path"] == "/api/v1/admin/debug"
    assert dispatch_res["dispatched"] is True
