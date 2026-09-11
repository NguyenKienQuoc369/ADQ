"""
Focused regression tests for FFuf scheme preservation (HTTP vs HTTPS).
"""
import os
import tempfile
import pytest

from quoc_omni import select_ffuf_target_url


def test_http_target_preserves_http_from_raw_target():
    base = select_ffuf_target_url(live_file=None, default_target_url="", raw_target="http://127.0.0.1:3000")
    assert base == "http://127.0.0.1:3000"
    assert f"{base}/FUZZ" == "http://127.0.0.1:3000/FUZZ"


def test_https_target_preserves_https_from_raw_target():
    base = select_ffuf_target_url(live_file=None, default_target_url="", raw_target="https://example.com")
    assert base == "https://example.com"
    assert f"{base}/FUZZ" == "https://example.com/FUZZ"


def test_http_target_preserves_http_from_live_file():
    with tempfile.NamedTemporaryFile(mode="w", delete=False) as f:
        f.write("http://127.0.0.1:8081\n")
        live_path = f.name

    try:
        base = select_ffuf_target_url(live_file=live_path, default_target_url="https://127.0.0.1:8081", raw_target="127.0.0.1:8081")
        assert base == "http://127.0.0.1:8081"
        assert f"{base}/FUZZ" == "http://127.0.0.1:8081/FUZZ"
    finally:
        if os.path.exists(live_path):
            os.remove(live_path)


def test_https_target_preserves_https_from_live_file():
    with tempfile.NamedTemporaryFile(mode="w", delete=False) as f:
        f.write("https://secure.target.com\n")
        live_path = f.name

    try:
        base = select_ffuf_target_url(live_file=live_path, default_target_url="https://secure.target.com", raw_target="secure.target.com")
        assert base == "https://secure.target.com"
        assert f"{base}/FUZZ" == "https://secure.target.com/FUZZ"
    finally:
        if os.path.exists(live_path):
            os.remove(live_path)

