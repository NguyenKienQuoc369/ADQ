import pytest
import asyncio
from core.waf_evasion import AdaptiveWAFEvasionEngine
from core.session_manager import AuthenticatedSessionManager

def test_waf_evasion_jitter():
    waf = AdaptiveWAFEvasionEngine(base_delay=0.1)
    waf.apply_jitter_delay()
    assert waf.current_delay >= 0.1

def test_waf_spoof_headers():
    waf = AdaptiveWAFEvasionEngine()
    headers = waf.get_random_headers()
    assert "User-Agent" in headers
    assert "X-Forwarded-For" in headers

def test_session_manager_tenant_tokens():
    session_mgr = AuthenticatedSessionManager()
    session_mgr.set_token("A", "access_a_123")
    auth_header = session_mgr.get_auth_header("A")
    assert auth_header == {"Authorization": "Bearer access_a_123"}

