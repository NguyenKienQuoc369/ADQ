import os
import pytest
from backend.core.stress_orchestrator import StressOrchestrator

def test_stress_orchestrator_js_generator():
    orchestrator = StressOrchestrator()
    script = orchestrator.generate_k6_script(
        target_url="https://api.target.com/v1/auth",
        bearer_token="secret_token_123",
        vus=100,
        duration="45s",
        ramp_up=True
    )
    
    assert "https://api.target.com/v1/auth" in script
    assert "Bearer secret_token_123" in script
    assert "vus: 100" in script or "target: 100" in script
    assert "X-Forwarded-For" in script
    assert "status is 200" in script
    assert "rate limited (429)" in script

def test_stress_orchestrator_universal_bypass_generator():
    orchestrator = StressOrchestrator()
    
    # Cloudflare Zero Trust Profile
    cf_config = {
        "platform": "Cloudflare Zero Trust API",
        "headers": {
            "CF-Access-Client-Id": "cf-client-123.access.cloudflare.com",
            "CF-Access-Client-Secret": "cf-secret-456"
        },
        "cookies": {
            "cf_clearance": "token_abc123"
        }
    }
    cf_script = orchestrator.generate_k6_script(
        target_url="https://cf.target.com/api",
        bypass_config=cf_config
    )
    assert "CF-Access-Client-Id" in cf_script
    assert "cf-client-123.access.cloudflare.com" in cf_script
    assert "cf_clearance=token_abc123" in cf_script

    # AWS WAF Profile
    aws_config = {
        "platform": "AWS API Gateway",
        "headers": {
            "x-api-key": "aws_api_key_789"
        }
    }
    aws_script = orchestrator.generate_k6_script(
        target_url="https://aws.target.com/api",
        bypass_config=aws_config
    )
    assert "x-api-key" in aws_script
    assert "aws_api_key_789" in aws_script

def test_stress_orchestrator_native_execution():
    orchestrator = StressOrchestrator(k6_path="/non/existent/k6_binary")
    res = orchestrator.execute_stress_test(
        target_url="https://httpbin.org/get",
        vus=2,
        duration="1s"
    )

    assert res["ok"] is True
    assert res["simulated"] is False
    assert res["engine"] == "ADQ-Native-Python-HTTP-Thread-Fleet"
    assert res["metrics"]["total_requests"] >= 0
