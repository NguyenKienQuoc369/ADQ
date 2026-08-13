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
