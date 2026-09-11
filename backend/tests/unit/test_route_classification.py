import pytest

def is_fastapi_backend_route(path: str) -> bool:
    if not path:
        return False
    clean_path = path.split("?")[0]
    
    def is_match(prefix: str) -> bool:
        return clean_path == prefix or clean_path.startswith(prefix + "/")
        
    if (
        clean_path == "/api/health"
        or is_match("/api/scan")
        or is_match("/api/copilot")
        or is_match("/api/stress")
        or is_match("/api/verification")
        or is_match("/api/c2")
        or is_match("/api/oast")
        or is_match("/api/apk-audit")
    ):
        return True
    return False

def test_fastapi_and_nextjs_route_separation():
    # 1. FastAPI Scan endpoints
    assert is_fastapi_backend_route("/api/scan") is True
    assert is_fastapi_backend_route("/api/scan/") is True
    assert is_fastapi_backend_route("/api/scan/scan-12345") is True
    assert is_fastapi_backend_route("/api/scan/scan-12345/stream") is True
    assert is_fastapi_backend_route("/api/scan/scan-12345/assurance") is True

    # 2. Next.js Scan endpoints (CRITICAL REGRESSION CHECK)
    assert is_fastapi_backend_route("/api/scans") is False
    assert is_fastapi_backend_route("/api/scans/") is False
    assert is_fastapi_backend_route("/api/scans/scan-123") is False

    # 3. Next.js Account & Admin endpoints
    assert is_fastapi_backend_route("/api/account") is False
    assert is_fastapi_backend_route("/api/account/me") is False
    assert is_fastapi_backend_route("/api/account/redeem") is False
    assert is_fastapi_backend_route("/api/admin/users") is False
    assert is_fastapi_backend_route("/api/admin/redeem-codes") is False

    # 4. FastAPI Other namespaces
    assert is_fastapi_backend_route("/api/health") is True
    assert is_fastapi_backend_route("/api/copilot/chat") is True
    assert is_fastapi_backend_route("/api/stress/detect-waf") is True
    assert is_fastapi_backend_route("/api/verification/start") is True
    assert is_fastapi_backend_route("/api/c2/fuzz") is True
    assert is_fastapi_backend_route("/api/oast/stream") is True
    assert is_fastapi_backend_route("/api/apk-audit/jobs") is True
