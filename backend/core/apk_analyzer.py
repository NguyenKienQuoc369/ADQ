import os
import re
import shutil
import tempfile
import subprocess
import json
import logging
import zipfile
from typing import Any, Dict, List, Optional, Set
try:
    from backend.core.js_analyzer import SECRET_PATTERNS, ENDPOINT_PATTERNS
except ImportError:
    from core.js_analyzer import SECRET_PATTERNS, ENDPOINT_PATTERNS

logger = logging.getLogger(__name__)

# Mobile specific secret & configuration patterns
MOBILE_SECRET_PATTERNS = {
    **SECRET_PATTERNS,
    "firebase_db_url": re.compile(r'https://[a-zA-Z0-9_\-]+\.firebaseio\.com', re.IGNORECASE),
    "firebase_api_key": re.compile(r'AIzaSy[A-Za-z0-9-_]{35}'),
    "s3_bucket_url": re.compile(r'https://[a-zA-Z0-9_\-]+\.s3\.amazonaws\.com', re.IGNORECASE),
    "connection_string": re.compile(r'(?:postgres|mysql|mongodb|redis)://[a-zA-Z0-9_]+:[^@\s]+@[a-zA-Z0-9_\-\.]+:[0-9]+', re.IGNORECASE),
}

# Android Manifest security check patterns
MANIFEST_SECURITY_PATTERNS = {
    "exported_components": re.compile(r'android:exported\s*=\s*["\']true["\']', re.IGNORECASE),
    "allow_backup": re.compile(r'android:allowBackup\s*=\s*["\']true["\']', re.IGNORECASE),
    "uses_cleartext_traffic": re.compile(r'android:usesCleartextTraffic\s*=\s*["\']true["\']', re.IGNORECASE),
    "debuggable": re.compile(r'android:debuggable\s*=\s*["\']true["\']', re.IGNORECASE),
}

class APKAnalyzer:
    """
    Automated Mobile APK Pipeline Engine
    1. Ingestion & Decompilation: Decompiles APK with Apktool and JADX (with zip fallback).
    2. Core Scanner: Deep-scans decompiled Java/Kotlin source, XML configs, and Manifest for hardcoded secrets, API keys, and misconfigurations.
    3. Auto-Cleanup: Automatically purges unpacked directories to prevent storage exhaustion.
    """

    def __init__(self, apk_path: str, temp_dir: Optional[str] = None):
        self.apk_path = os.path.abspath(apk_path)
        self.custom_temp_dir = temp_dir
        self.output_dir: Optional[str] = None

    def decompile() -> Dict[str, Any]:
        pass

    def run_pipeline(self) -> Dict[str, Any]:
        """Runs full 3-step pipeline with auto-cleanup."""
        if not os.path.exists(self.apk_path) or not self.apk_path.endswith('.apk'):
            return {
                "ok": False,
                "error": f"Invalid APK file path: {self.apk_path}",
                "secrets_found": [],
                "manifest_findings": [],
            }

        self.output_dir = tempfile.mkdtemp(prefix="adq_apk_sandbox_", dir=self.custom_temp_dir)
        try:
            logger.info(f"Starting APK Pipeline for {self.apk_path} in sandbox {self.output_dir}")
            
            # Step 1: Decompile
            decompile_info = self._decompile_apk()
            
            # Step 2: Core Secret & Manifest Scan
            scan_results = self._scan_decompiled_files()
            scan_results["decompile_status"] = decompile_info

            return {
                "ok": True,
                "apk_name": os.path.basename(self.apk_path),
                "decompile_status": decompile_info,
                "results": scan_results,
            }
        except Exception as e:
            logger.error(f"Error during APK pipeline execution: {e}")
            return {
                "ok": False,
                "error": str(e),
                "secrets_found": [],
                "manifest_findings": [],
            }
        finally:
            # Step 3: Cleanup Sandbox
            self.cleanup()

    def _decompile_apk(self) -> Dict[str, Any]:
        """Decompiles APK using Apktool and JADX with fallback extraction."""
        status = {"apktool": False, "jadx": False, "method": "fallback_unzip"}

        # 1. Try Apktool
        try:
            res = subprocess.run(
                ['apktool', 'd', self.apk_path, '-o', os.path.join(self.output_dir, "apktool_out"), '-f'],
                capture_output=True, text=True, timeout=120
            )
            if res.returncode == 0:
                status["apktool"] = True
                status["method"] = "apktool"
        except Exception as exc:
            logger.warning(f"Apktool unavailable or failed: {exc}")

        # 2. Try JADX for decompiling .dex bytecode to Java source
        sources_dir = os.path.join(self.output_dir, "jadx_out")
        try:
            res_jadx = subprocess.run(
                ['jadx', '-d', sources_dir, self.apk_path],
                capture_output=True, text=True, timeout=180
            )
            if res_jadx.returncode == 0:
                status["jadx"] = True
                status["method"] = "apktool+jadx" if status["apktool"] else "jadx"
        except Exception as exc:
            logger.warning(f"JADX unavailable or failed: {exc}")

        # 3. Fallback: Standard ZIP Unpacking if CLI tools are not installed
        if not status["apktool"] and not status["jadx"]:
            try:
                unzip_dir = os.path.join(self.output_dir, "zip_out")
                os.makedirs(unzip_dir, exist_ok=True)
                with zipfile.ZipFile(self.apk_path, 'r') as zip_ref:
                    zip_ref.extractall(unzip_dir)
                status["method"] = "zip_fallback"
            except Exception as exc:
                logger.error(f"ZIP extraction fallback failed: {exc}")

        return status

    def _scan_decompiled_files(self) -> Dict[str, Any]:
        """Recursively scans all extracted source files for hardcoded secrets & manifest risks."""
        secrets: List[Dict[str, Any]] = []
        manifest_risks: List[Dict[str, Any]] = []
        scanned_files_count = 0
        target_extensions = ('.xml', '.java', '.kt', '.json', '.properties', '.smali', '.txt', '.js', '.ts', '.html')

        for root, _, files in os.walk(self.output_dir):
            for file in files:
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, self.output_dir)

                if file.endswith("AndroidManifest.xml"):
                    manifest_risks.extend(self._scan_manifest(file_path, rel_path))

                if file.endswith(target_extensions):
                    scanned_files_count += 1
                    file_secrets = self._scan_single_file(file_path, rel_path)
                    secrets.extend(file_secrets)

        return {
            "scanned_files_count": scanned_files_count,
            "secrets": secrets,
            "manifest_risks": manifest_risks,
        }

    def _scan_manifest(self, manifest_path: str, rel_path: str) -> List[Dict[str, Any]]:
        risks = []
        try:
            with open(manifest_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                for risk_type, pattern in MANIFEST_SECURITY_PATTERNS.items():
                    matches = pattern.findall(content)
                    if matches:
                        risks.append({
                            "file": rel_path,
                            "type": risk_type,
                            "count": len(matches),
                            "detail": f"Manifest setting '{risk_type}' detected as true.",
                        })
        except Exception as e:
            logger.warning(f"Error scanning AndroidManifest.xml: {e}")
        return risks

    def _scan_single_file(self, file_path: str, rel_path: str) -> List[Dict[str, Any]]:
        found_secrets = []
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

                for secret_type, pattern in MOBILE_SECRET_PATTERNS.items():
                    for match in pattern.finditer(content):
                        matched_val = match.group(0)
                        if len(matched_val) > 6 and "example" not in matched_val.lower():
                            found_secrets.append({
                                "file": rel_path,
                                "type": secret_type,
                                "match": matched_val[:100],  # Truncated
                            })
        except Exception as e:
            logger.debug(f"Error reading file {file_path}: {e}")

        return found_secrets

    def cleanup(self):
        """Purges unpacked sandbox directory to prevent server storage exhaustion."""
        if self.output_dir and os.path.exists(self.output_dir):
            try:
                shutil.rmtree(self.output_dir)
                logger.info(f"Cleaned up APK sandbox directory: {self.output_dir}")
            except Exception as e:
                logger.error(f"Failed to cleanup APK sandbox directory {self.output_dir}: {e}")
            finally:
                self.output_dir = None
