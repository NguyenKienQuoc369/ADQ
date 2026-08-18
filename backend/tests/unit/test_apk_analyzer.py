import os
import zipfile
import tempfile
import pytest

try:
    from backend.core.mobile_audit.apk_analyzer import APKAnalyzer
except ImportError:
    from core.mobile_audit.apk_analyzer import APKAnalyzer

def test_apk_analyzer_invalid_file():
    analyzer = APKAnalyzer("/non/existent/path.apk")
    res = analyzer.run_pipeline()
    assert res["ok"] is False
    assert "Invalid APK file path" in res["error"]

def test_apk_analyzer_zip_fallback_scan(tmp_path):
    # Create a mock APK (which is a ZIP file) containing an AndroidManifest.xml and a Java file with a fake secret
    apk_file = tmp_path / "test_sample.apk"
    valid_google_key = "AIzaSy" + "A" * 35
    with zipfile.ZipFile(apk_file, 'w') as zipf:
        zipf.writestr("AndroidManifest.xml", '<manifest android:allowBackup="true" android:usesCleartextTraffic="true"></manifest>')
        zipf.writestr("sources/com/example/App.java", f'class App {{ String key = "{valid_google_key}"; String db = "https://myapp-db.firebaseio.com"; }}')

    analyzer = APKAnalyzer(str(apk_file))
    res = analyzer.run_pipeline()

    assert res["ok"] is True
    assert res["apk_name"] == "test_sample.apk"
    assert res["results"]["scanned_files_count"] >= 1
    
    # Verify secret found
    secrets = res["results"]["secrets"]
    types_found = [s["type"] for s in secrets]
    assert "firebase_api_key" in types_found or "google_api_key" in types_found or "firebase_db_url" in types_found

    # Verify manifest risks found
    manifest_risks = res["results"]["manifest_risks"]
    risk_types = [m["type"] for m in manifest_risks]
    assert "allow_backup" in risk_types
    assert "uses_cleartext_traffic" in risk_types

    # Ensure output_dir was cleaned up
    assert analyzer.output_dir is None
