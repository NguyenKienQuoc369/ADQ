from unittest.mock import patch, MagicMock
from backend.core.stress_test.stress_orchestrator import (
    StressOrchestrator,
    GlobalRatePacer,
    _parse_duration_sec,
)


def test_stress_orchestrator_request_config_preparation():
    orchestrator = StressOrchestrator()

    # 1. Bearer Token Bypass
    url, headers, cookies = orchestrator._prepare_request_config(
        target_url="api.target.com/v1/auth",
        bypass_code="Bearer secret_token_123",
        waf_type="standard"
    )
    assert url == "https://api.target.com/v1/auth"
    assert headers.get("Authorization") == "Bearer secret_token_123"

    # 2. Cloudflare / Cookie Token Bypass
    url_cf, headers_cf, cookies_cf = orchestrator._prepare_request_config(
        target_url="https://cf.target.com/api",
        bypass_code="cf_clearance=token_abc123",
        waf_type="cloudflare"
    )
    assert cookies_cf.get("cf_clearance") == "token_abc123"

    # 3. Custom Header Bypass
    url_hdr, headers_hdr, cookies_hdr = orchestrator._prepare_request_config(
        target_url="https://aws.target.com/api",
        bypass_code="x-api-key: aws_api_key_789",
        waf_type="awswaf"
    )
    assert headers_hdr.get("x-api-key") == "aws_api_key_789"


def test_stress_orchestrator_verify_bypass():
    orchestrator = StressOrchestrator()

    mock_resp_raw = MagicMock()
    mock_resp_raw.status_code = 403

    mock_resp_bypass = MagicMock()
    mock_resp_bypass.status_code = 200

    mock_session_raw = MagicMock()
    mock_session_raw.get.return_value = mock_resp_raw

    mock_session_bypass = MagicMock()
    mock_session_bypass.get.return_value = mock_resp_bypass

    with patch("backend.core.stress_test.stress_orchestrator.resolve_and_validate_target", return_value=("https://example.com", ["93.184.216.34"])), \
         patch.object(orchestrator, "_get_client_session", side_effect=[(mock_session_raw, False), (mock_session_bypass, False)]):

        res = orchestrator.verify_bypass("https://example.com", bypass_code="x-api-key: valid_key")
        assert res["ok"] is True
        assert res["is_valid"] is True
        assert res["status_no_bypass"] == 403
        assert res["status_with_bypass"] == 200


def test_global_rate_pacer():
    pacer = GlobalRatePacer(target_rps=100.0)
    assert pacer.interval == 0.01
    # Pacing acquire does not crash
    pacer.acquire()


def test_parse_duration_sec():
    assert _parse_duration_sec("10s") == 10
    assert _parse_duration_sec(20) == 20
    assert _parse_duration_sec("invalid", default=15) == 15

