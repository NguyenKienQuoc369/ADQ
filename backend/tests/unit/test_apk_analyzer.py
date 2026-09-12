import os
import zipfile
import tempfile
import subprocess
import pytest
from unittest.mock import patch, MagicMock

try:
    from backend.core.mobile_audit.apk_analyzer import (
        APKAnalyzer,
        redact_secret_evidence,
        MAX_ZIP_ENTRIES,
        MAX_DECLARED_UNCOMPRESSED_SIZE,
    )
except ImportError:
    from core.mobile_audit.apk_analyzer import (
        APKAnalyzer,
        redact_secret_evidence,
        MAX_ZIP_ENTRIES,
        MAX_DECLARED_UNCOMPRESSED_SIZE,
    )


def test_01_invalid_non_zip_file(tmp_path):
    # File exists with .apk extension but invalid magic bytes (e.g. plain text)
    bad_apk = tmp_path / "fake.apk"
    bad_apk.write_bytes(b"THIS_IS_NOT_A_ZIP_HEADER_CONTENT")

    analyzer = APKAnalyzer(str(bad_apk))
    res = analyzer.run_pipeline()
    assert res["ok"] is False
    assert res["status"] == "FAILED"
    assert "invalid magic header bytes" in res["error"]
    assert analyzer.output_dir is None


def test_02_malformed_zip(tmp_path):
    # Valid ZIP header magic but truncated / corrupt body
    corrupt_apk = tmp_path / "corrupt.apk"
    corrupt_apk.write_bytes(b"PK\x03\x04\x00\x00\x00\x00corrupt_truncated_bytes")

    analyzer = APKAnalyzer(str(corrupt_apk))
    res = analyzer.run_pipeline()
    assert res["ok"] is False
    assert res["status"] == "FAILED"
    assert "Malformed ZIP archive" in res["error"] or "not a valid ZIP" in res["error"]
    assert analyzer.output_dir is None


def test_03_traversal_entry_rejected(tmp_path):
    apk_file = tmp_path / "traversal.apk"
    with zipfile.ZipFile(apk_file, "w") as zf:
        # Write entry with ../ traversal path
        zf.writestr("../../etc/passwd", "root:x:0:0:root:/root:/bin/bash")

    analyzer = APKAnalyzer(str(apk_file))
    res = analyzer.run_pipeline()
    assert res["ok"] is False
    assert res["status"] == "FAILED"
    assert "path traversal sequence" in res["error"]
    assert analyzer.output_dir is None


def test_04_excessive_entry_count_rejected(tmp_path):
    apk_file = tmp_path / "many_entries.apk"
    with zipfile.ZipFile(apk_file, "w") as zf:
        zf.writestr("test.txt", "hello")

    analyzer = APKAnalyzer(str(apk_file))
    # Mock len(zf.infolist()) to exceed MAX_ZIP_ENTRIES
    with patch("zipfile.ZipFile.infolist", return_value=[MagicMock()] * (MAX_ZIP_ENTRIES + 1)):
        res = analyzer.run_pipeline()
        assert res["ok"] is False
        assert "Archive exceeds maximum entries limit" in res["error"]
        assert analyzer.output_dir is None


def test_05_oversized_declared_uncompressed_rejected(tmp_path):
    apk_file = tmp_path / "zip_bomb.apk"
    with zipfile.ZipFile(apk_file, "w") as zf:
        zf.writestr("file.txt", "small content")

    mock_info = MagicMock()
    mock_info.filename = "bomb.bin"
    mock_info.file_size = MAX_DECLARED_UNCOMPRESSED_SIZE + 1000
    mock_info.compress_size = 100

    analyzer = APKAnalyzer(str(apk_file))
    with patch("zipfile.ZipFile.infolist", return_value=[mock_info]):
        res = analyzer.run_pipeline()
        assert res["ok"] is False
        assert "Archive uncompressed size exceeds limit" in res["error"] or "exceeds single file limit" in res["error"]
        assert analyzer.output_dir is None


def test_06_apktool_timeout_handling(tmp_path):
    apk_file = tmp_path / "timeout_test.apk"
    with zipfile.ZipFile(apk_file, "w") as zf:
        zf.writestr("AndroidManifest.xml", '<manifest package="com.timeout.app"></manifest>')

    analyzer = APKAnalyzer(str(apk_file))

    def mock_subprocess_run(cmd, *args, **kwargs):
        if "apktool" in cmd:
            raise subprocess.TimeoutExpired(cmd=cmd, timeout=120)
        return MagicMock(returncode=1, stderr="jadx failed", stdout="")

    with patch("subprocess.run", side_effect=mock_subprocess_run):
        res = analyzer.run_pipeline()
        assert res["ok"] is True
        assert res["partial"] is True
        assert "Timeout after 120s" in res["toolFailures"].get("apktool", "")
        assert res["analysisMode"] == "zip_fallback"
        assert analyzer.output_dir is None


def test_07_jadx_failure_fallback_partial(tmp_path):
    apk_file = tmp_path / "jadx_fail.apk"
    with zipfile.ZipFile(apk_file, "w") as zf:
        zf.writestr("AndroidManifest.xml", '<manifest package="com.jadxfail.app" android:allowBackup="true"></manifest>')
        zf.writestr("sources/com/example/Config.java", 'class Config { String key = "AIzaSy' + 'B' * 35 + '"; }')

    analyzer = APKAnalyzer(str(apk_file))

    def mock_subprocess_run(cmd, *args, **kwargs):
        if "apktool" in cmd:
            return MagicMock(returncode=1, stderr="apktool missing", stdout="")
        if "jadx" in cmd:
            return MagicMock(returncode=1, stderr="jadx syntax error", stdout="")
        return MagicMock(returncode=0)

    with patch("subprocess.run", side_effect=mock_subprocess_run):
        res = analyzer.run_pipeline()
        assert res["ok"] is True
        assert res["partial"] is True
        assert res["analysisMode"] == "zip_fallback"
        assert res["package"] == "com.jadxfail.app"
        assert len(res["findings"]) > 0
        assert analyzer.output_dir is None


def test_08_cleanup_after_success(tmp_path):
    apk_file = tmp_path / "success.apk"
    with zipfile.ZipFile(apk_file, "w") as zf:
        zf.writestr("AndroidManifest.xml", '<manifest package="com.clean.app"></manifest>')

    analyzer = APKAnalyzer(str(apk_file))
    res = analyzer.run_pipeline()
    assert res["ok"] is True
    assert analyzer.output_dir is None


def test_09_cleanup_after_failure(tmp_path):
    apk_file = tmp_path / "fail_cleanup.apk"
    with zipfile.ZipFile(apk_file, "w") as zf:
        zf.writestr("AndroidManifest.xml", '<manifest package="com.fail.app"></manifest>')

    analyzer = APKAnalyzer(str(apk_file))
    with patch.object(analyzer, "_scan_decompiled_files", side_effect=RuntimeError("Unexpected scan explosion")):
        res = analyzer.run_pipeline()
        assert res["ok"] is False
        assert res["status"] == "FAILED"
        assert "Unexpected scan explosion" in res["error"]
        assert analyzer.output_dir is None


def test_10_secret_evidence_redacted(tmp_path):
    raw_secret = "AIzaSyTestApiKeyForVerification1234567"
    redacted = redact_secret_evidence(raw_secret)
    assert redacted == "AIza...567"
    assert raw_secret not in redacted

    apk_file = tmp_path / "secret_redact.apk"
    with zipfile.ZipFile(apk_file, "w") as zf:
        zf.writestr("AndroidManifest.xml", '<manifest package="com.redact.test"></manifest>')
        zf.writestr("sources/com/test/Auth.java", f'class Auth {{ String apiKey = "{raw_secret}"; }}')

    analyzer = APKAnalyzer(str(apk_file))
    res = analyzer.run_pipeline()
    assert res["ok"] is True

    # Ensure findings evidence is redacted
    for finding in res["findings"]:
        if finding["category"] == "HARDCODED_SECRET":
            assert raw_secret not in finding["evidence"]
            assert "AIza...567" in finding["evidence"]

    # Ensure legacy secrets match is also redacted
    for sec in res["results"]["secrets"]:
        assert raw_secret not in sec["match"]


def test_11_normalized_severity_values_only(tmp_path):
    valid_severities = {"CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"}

    apk_file = tmp_path / "severity_test.apk"
    with zipfile.ZipFile(apk_file, "w") as zf:
        zf.writestr(
            "AndroidManifest.xml",
            '<manifest package="com.sev.test" android:debuggable="true" android:allowBackup="true" android:usesCleartextTraffic="true">'
            '<uses-permission android:name="android.permission.CAMERA" />'
            '</manifest>'
        )

    analyzer = APKAnalyzer(str(apk_file))
    res = analyzer.run_pipeline()
    assert res["ok"] is True
    assert len(res["findings"]) > 0

    for finding in res["findings"]:
        assert finding["severity"] in valid_severities
        assert "id" in finding
        assert "title" in finding
        assert "description" in finding
        assert "evidence" in finding
        assert "remediation" in finding


def test_12_no_raw_filesystem_paths_in_result(tmp_path):
    apk_file = tmp_path / "path_leak_test.apk"
    with zipfile.ZipFile(apk_file, "w") as zf:
        zf.writestr("AndroidManifest.xml", '<manifest package="com.paths.test" android:debuggable="true"></manifest>')
        zf.writestr("assets/config.json", '{"key": "AIzaSy' + 'C' * 35 + '"}')

    analyzer = APKAnalyzer(str(apk_file))
    res = analyzer.run_pipeline()
    assert res["ok"] is True

    # Verify no /tmp/ or /home/ sandbox directory paths are leaked in findings or results
    for finding in res["findings"]:
        assert not finding["file"].startswith("/tmp/")
        assert not finding["file"].startswith("/home/")
        assert "adq_apk_" not in finding["file"]

    for sec in res["results"]["secrets"]:
        assert not sec["file"].startswith("/tmp/")
        assert not sec["file"].startswith("/home/")
        assert "adq_apk_" not in sec["file"]


def test_13_coverage_matrix_contract(tmp_path):
    apk_file = tmp_path / "coverage_test.apk"
    with zipfile.ZipFile(apk_file, "w") as zf:
        zf.writestr("AndroidManifest.xml", '<manifest package="com.coverage.test"><application android:debuggable="true"/></manifest>')
        zf.writestr("classes.dex", b"DEX_CONTENT_HTTPS_URL_https://api.example.com/v1/auth")

    analyzer = APKAnalyzer(str(apk_file))
    res = analyzer.run_pipeline()
    assert res["ok"] is True
    assert "coverage" in res
    assert res["coverage"]["manifest"] == "FULL"
    assert res["coverage"]["permissions"] == "FULL"
    assert res["coverage"]["source"] in ("FULL", "PARTIAL", "NONE")
    assert "https://api.example.com/v1/auth" in res["endpoints"]


def test_14_mstg_binary_apk_if_available():
    fixture_path = "/home/sisiniki123/Downloads/MSTG-Android-Java.apk"
    if not os.path.exists(fixture_path):
        pytest.skip("MSTG-Android-Java.apk fixture not found locally")

    analyzer = APKAnalyzer(fixture_path)
    res = analyzer.run_pipeline()
    assert res["ok"] is True
    assert res["package"] == "sg.vp.owasp_mobile.omtg_android"
    assert res["version"] == "1.0"
    assert res["sdk"]["minSdkVersion"] == "21"
    assert res["sdk"]["targetSdkVersion"] == "28"
    assert any(p["name"] == "android.permission.WRITE_EXTERNAL_STORAGE" for p in res["permissions"])
    assert any(f["title"] == "Hardcoded Sensitive Credential in Manifest (io.fabric.ApiKey)" for f in res["findings"])
    assert res["coverage"]["manifest"] == "FULL"
    assert res["coverage"]["permissions"] == "FULL"


