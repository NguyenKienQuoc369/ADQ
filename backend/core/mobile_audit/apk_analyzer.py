import os
import re
import shutil
import tempfile
import subprocess
import json
import logging
import zipfile
import xml.etree.ElementTree as ET
from typing import Any, Dict, List, Optional, Set, Tuple

logger = logging.getLogger(__name__)

# Resource and decompression security limits
MAX_APK_FILE_SIZE = 100 * 1024 * 1024  # 100 MB max APK upload
MAX_ZIP_ENTRIES = 10_000               # Max 10,000 files in archive
MAX_DECLARED_UNCOMPRESSED_SIZE = 500 * 1024 * 1024  # 500 MB max uncompressed
MAX_SINGLE_ENTRY_SIZE = 100 * 1024 * 1024           # 100 MB max per single file
MAX_COMPRESSION_RATIO = 100.0                       # Max 100:1 ratio for files > 1MB
SUBPROCESS_TIMEOUT_APKTOOL = 120                    # 120s
SUBPROCESS_TIMEOUT_JADX = 180                       # 180s

# Mobile secret regex patterns
MOBILE_SECRET_PATTERNS = {
    "google_api_key": re.compile(r'AIzaSy[A-Za-z0-9-_]{35}'),
    "firebase_api_key": re.compile(r'AIzaSy[A-Za-z0-9-_]{35}'),
    "aws_access_key": re.compile(r'AKIA[0-9A-Z]{16}'),
    "jwt_token": re.compile(r'eyJ[A-Za-z0-9-_=]{10,}\.eyJ[A-Za-z0-9-_=]{10,}\.[A-Za-z0-9-_.+/=]{10,}'),
    "bearer_token": re.compile(r'bearer\s+[a-zA-Z0-9_\-\.]{20,}', re.IGNORECASE),
    "firebase_db_url": re.compile(r'https://[a-zA-Z0-9_\-]+\.firebaseio\.com', re.IGNORECASE),
    "s3_bucket_url": re.compile(r'https://[a-zA-Z0-9_\-]+\.s3\.amazonaws\.com', re.IGNORECASE),
    "connection_string": re.compile(r'(?:postgres|postgresql|mysql|mongodb|redis)://[a-zA-Z0-9_]+:[^@\s]+@[a-zA-Z0-9_\-\.]+:[0-9]+', re.IGNORECASE),
    "private_key_marker": re.compile(r'-----BEGIN (?:RSA |EC |DSA |OPENSSH )?PRIVATE KEY-----'),
}

# Mobile API route patterns
MOBILE_ENDPOINT_PATTERNS = [
    re.compile(r'["\'](/(?:api|v[0-9]|internal|admin|auth|user|v1|v2|graphql|rest|service)[a-zA-Z0-9_\-/\?=&%.]*)["\']'),
    re.compile(r'https?://[a-zA-Z0-9_\-\.]+(?::[0-9]+)?(?:/[a-zA-Z0-9_\-/\?=&%.]*)?', re.IGNORECASE),
]

# Manifest security check patterns
MANIFEST_SECURITY_PATTERNS = {
    "exported_components": re.compile(r'android:exported\s*=\s*["\']true["\']', re.IGNORECASE),
    "allow_backup": re.compile(r'android:allowBackup\s*=\s*["\']true["\']', re.IGNORECASE),
    "uses_cleartext_traffic": re.compile(r'android:usesCleartextTraffic\s*=\s*["\']true["\']', re.IGNORECASE),
    "debuggable": re.compile(r'android:debuggable\s*=\s*["\']true["\']', re.IGNORECASE),
}

DANGEROUS_PERMISSIONS = {
    "android.permission.READ_CALENDAR": "Read user calendar events",
    "android.permission.WRITE_CALENDAR": "Modify user calendar events",
    "android.permission.CAMERA": "Take photos and record videos",
    "android.permission.READ_CONTACTS": "Read user contacts",
    "android.permission.WRITE_CONTACTS": "Modify user contacts",
    "android.permission.GET_ACCOUNTS": "Access the list of accounts",
    "android.permission.ACCESS_FINE_LOCATION": "Access precise device location",
    "android.permission.ACCESS_COARSE_LOCATION": "Access approximate device location",
    "android.permission.ACCESS_BACKGROUND_LOCATION": "Access device location in the background",
    "android.permission.RECORD_AUDIO": "Record audio/microphone stream",
    "android.permission.READ_PHONE_STATE": "Read phone state and identity",
    "android.permission.READ_PHONE_NUMBERS": "Read phone numbers",
    "android.permission.CALL_PHONE": "Initiate phone calls without user intervention",
    "android.permission.ANSWER_PHONE_CALLS": "Answer incoming phone calls",
    "android.permission.READ_CALL_LOG": "Read user call history",
    "android.permission.WRITE_CALL_LOG": "Write/delete call history",
    "android.permission.ADD_VOICEMAIL": "Add voicemail records",
    "android.permission.USE_SIP": "Use SIP service",
    "android.permission.BODY_SENSORS": "Access body sensors (heart rate, etc.)",
    "android.permission.SEND_SMS": "Send SMS messages (potential premium SMS charges)",
    "android.permission.RECEIVE_SMS": "Receive SMS messages (potential OTP interception)",
    "android.permission.READ_SMS": "Read SMS message history",
    "android.permission.RECEIVE_WAP_PUSH": "Receive WAP push messages",
    "android.permission.RECEIVE_MMS": "Receive MMS messages",
    "android.permission.READ_EXTERNAL_STORAGE": "Read shared external storage files",
    "android.permission.WRITE_EXTERNAL_STORAGE": "Write to shared external storage files",
    "android.permission.ACCESS_MEDIA_LOCATION": "Access geographic location of media files",
    "android.permission.SYSTEM_ALERT_WINDOW": "Display overlay windows on top of other apps",
    "android.permission.REQUEST_INSTALL_PACKAGES": "Request package installation (sideloading)",
}

def redact_secret_evidence(secret_value: str) -> str:
    """Masks secret value for safe reporting without exposing sensitive keys."""
    val = secret_value.strip()
    if len(val) <= 8:
        return "***"
    return f"{val[:4]}...{val[-3:]}"


class APKAnalyzer:
    """
    Automated Hardened Mobile APK Static Analysis Pipeline Engine:
    1. Input & Archive Integrity: Validates magic bytes, zip bomb limits, and path traversal.
    2. Decompilation Pipeline: Invokes Apktool & JADX in an isolated sandbox with timeouts and fallback.
    3. Core Static Auditor: Deep-scans Manifest, dangerous permissions, exported components, and redacted secrets.
    4. Auto-Cleanup: Safely purges temporary sandboxes regardless of execution outcome.
    """

    def __init__(self, apk_path: str, temp_dir: Optional[str] = None):
        self.apk_path = os.path.abspath(apk_path) if apk_path else ""
        self.custom_temp_dir = temp_dir
        self.output_dir: Optional[str] = None
        self.tools_used: List[str] = []
        self.tool_failures: Dict[str, str] = {}

    def _validate_input_archive(self) -> Tuple[bool, Optional[str]]:
        """Strict validation of input file existence, magic bytes, and archive structure."""
        if not self.apk_path or not os.path.exists(self.apk_path):
            return False, f"Invalid APK file path: {self.apk_path}"

        if not os.path.isfile(self.apk_path):
            return False, f"Target path is not a regular file: {self.apk_path}"

        if not self.apk_path.lower().endswith(".apk"):
            return False, f"Target file must have .apk extension: {self.apk_path}"

        file_size = os.path.getsize(self.apk_path)
        if file_size == 0:
            return False, "APK file is empty (0 bytes)"

        if file_size > MAX_APK_FILE_SIZE:
            return False, f"APK file size exceeds maximum limit ({file_size} > {MAX_APK_FILE_SIZE} bytes)"

        # Magic bytes check for ZIP/APK (PK\x03\x04 or PK\x05\x06)
        try:
            with open(self.apk_path, "rb") as f:
                header = f.read(4)
                if len(header) < 4 or header not in (b"PK\x03\x04", b"PK\x05\x06", b"PK\x07\x08"):
                    return False, "Invalid APK file: invalid magic header bytes (not a ZIP/APK archive)"
        except Exception as e:
            return False, f"Failed to read APK file header: {e}"

        # Test ZIP structure and entries
        try:
            if not zipfile.is_zipfile(self.apk_path):
                return False, "Target is not a valid ZIP/APK archive"

            with zipfile.ZipFile(self.apk_path, "r") as zf:
                infolist = zf.infolist()
                if not infolist:
                    return False, "APK archive contains no entries"

                if len(infolist) > MAX_ZIP_ENTRIES:
                    return False, f"Archive exceeds maximum entries limit ({len(infolist)} > {MAX_ZIP_ENTRIES})"

                total_uncompressed = 0
                for info in infolist:
                    # Path traversal checks
                    name = info.filename
                    if name.startswith("/") or name.startswith("\\"):
                        return False, f"Archive contains unsafe absolute path entry: {name}"
                    
                    parts = name.replace("\\", "/").split("/")
                    if ".." in parts:
                        return False, f"Archive contains path traversal sequence: {name}"

                    if info.file_size > MAX_SINGLE_ENTRY_SIZE:
                        return False, f"Archive entry exceeds single file limit: {name}"

                    # Zip bomb compression ratio check
                    if info.file_size > 1024 * 1024 and info.compress_size > 0:
                        ratio = info.file_size / info.compress_size
                        if ratio > MAX_COMPRESSION_RATIO:
                            return False, f"Abnormal compression ratio detected in entry: {name} (ratio: {ratio:.1f})"

                    total_uncompressed += info.file_size
                    if total_uncompressed > MAX_DECLARED_UNCOMPRESSED_SIZE:
                        return False, f"Archive uncompressed size exceeds limit ({total_uncompressed} > {MAX_DECLARED_UNCOMPRESSED_SIZE} bytes)"

        except zipfile.BadZipFile as e:
            return False, f"Malformed ZIP archive: {e}"
        except Exception as e:
            return False, f"Archive validation error: {e}"

        return True, None

    def run_pipeline(self) -> Dict[str, Any]:
        """Runs the hardened APK static analysis pipeline with auto-cleanup."""
        is_valid, validation_err = self._validate_input_archive()
        if not is_valid:
            return {
                "ok": False,
                "status": "FAILED",
                "error": validation_err,
                "analysisMode": "none",
                "partial": False,
                "package": None,
                "version": None,
                "sdk": {"minSdkVersion": None, "targetSdkVersion": None, "compileSdkVersion": None},
                "manifest": {"debuggable": None, "allowBackup": None, "usesCleartextTraffic": None},
                "permissions": [],
                "exportedComponents": {"activities": [], "services": [], "receivers": [], "providers": []},
                "signing": {"isSigned": False, "scheme": None, "debugCert": None, "certificate": None},
                "endpoints": [],
                "findings": [],
                "toolsUsed": [],
                "toolFailures": {},
                # Backward compatibility:
                "apk_name": os.path.basename(self.apk_path) if self.apk_path else "",
                "decompile_status": {"apktool": False, "jadx": False, "method": "none"},
                "results": {"scanned_files_count": 0, "secrets": [], "manifest_risks": []},
            }

        try:
            self.output_dir = tempfile.mkdtemp(prefix="adq_apk_", dir=self.custom_temp_dir)
            try:
                os.chmod(self.output_dir, 0o700)
            except Exception:
                pass

            logger.info(f"Starting APK Pipeline for {self.apk_path} in sandbox {self.output_dir}")

            # Step 1: Copy APK safely into sandbox with normalized name
            sandbox_apk = os.path.join(self.output_dir, "input.apk")
            shutil.copyfile(self.apk_path, sandbox_apk)

            # Step 2: Decompile / Unpack
            decompile_info = self._decompile_apk(sandbox_apk)

            # Step 3: Scan Manifest, Permissions, Signatures, and Secrets
            scan_data = self._scan_decompiled_files()

            # Determine partial state and analysisMode
            is_partial = False
            if decompile_info.get("method") == "zip_fallback" or bool(self.tool_failures):
                is_partial = True

            analysis_mode = decompile_info.get("method", "zip_fallback")
            scan_data["results"]["decompile_status"] = decompile_info

            # Build standardized findings & contract
            findings = scan_data["findings"]
            endpoints = sorted(list(set(scan_data["endpoints"])))
            permissions = scan_data["permissions"]
            manifest_info = scan_data["manifest_info"]
            signing_info = scan_data["signing_info"]
            exported_components = scan_data["exported_components"]

            return {
                "ok": True,
                "status": "PARTIAL" if is_partial else "COMPLETED",
                "analysisMode": analysis_mode,
                "partial": is_partial,
                "package": manifest_info.get("packageName"),
                "version": manifest_info.get("versionName"),
                "sdk": {
                    "minSdkVersion": manifest_info.get("minSdkVersion"),
                    "targetSdkVersion": manifest_info.get("targetSdkVersion"),
                    "compileSdkVersion": manifest_info.get("compileSdkVersion"),
                },
                "manifest": {
                    "debuggable": manifest_info.get("debuggable"),
                    "allowBackup": manifest_info.get("allowBackup"),
                    "usesCleartextTraffic": manifest_info.get("usesCleartextTraffic"),
                },
                "permissions": permissions,
                "exportedComponents": exported_components,
                "signing": signing_info,
                "endpoints": endpoints[:50],  # Bounded
                "findings": findings,
                "toolsUsed": self.tools_used,
                "toolFailures": self.tool_failures,
                # Backward compatibility:
                "apk_name": os.path.basename(self.apk_path),
                "decompile_status": decompile_info,
                "results": scan_data["results"],
            }
        except Exception as e:
            logger.error(f"Error during APK pipeline execution: {e}")
            return {
                "ok": False,
                "status": "FAILED",
                "error": str(e),
                "analysisMode": "none",
                "partial": False,
                "package": None,
                "version": None,
                "sdk": {"minSdkVersion": None, "targetSdkVersion": None, "compileSdkVersion": None},
                "manifest": {"debuggable": None, "allowBackup": None, "usesCleartextTraffic": None},
                "permissions": [],
                "exportedComponents": {"activities": [], "services": [], "receivers": [], "providers": []},
                "signing": {"isSigned": False, "scheme": None, "debugCert": None, "certificate": None},
                "endpoints": [],
                "findings": [],
                "toolsUsed": self.tools_used,
                "toolFailures": self.tool_failures,
                # Backward compatibility:
                "apk_name": os.path.basename(self.apk_path),
                "decompile_status": {"apktool": False, "jadx": False, "method": "error"},
                "results": {"scanned_files_count": 0, "secrets": [], "manifest_risks": []},
            }
        finally:
            self.cleanup()

    def _decompile_apk(self, sandbox_apk: str) -> Dict[str, Any]:
        """Decompiles APK using Apktool and JADX with isolated subprocess and timeout safety."""
        status = {"apktool": False, "jadx": False, "method": "zip_fallback"}
        self.tools_used = []
        self.tool_failures = {}

        apktool_out = os.path.join(self.output_dir, "apktool_out")
        jadx_out = os.path.join(self.output_dir, "jadx_out")

        # 1. Try Apktool
        try:
            res_apktool = subprocess.run(
                ["apktool", "d", sandbox_apk, "-o", apktool_out, "-f"],
                capture_output=True,
                text=True,
                timeout=SUBPROCESS_TIMEOUT_APKTOOL,
                cwd=self.output_dir,
                check=False
            )
            if res_apktool.returncode == 0:
                status["apktool"] = True
                self.tools_used.append("apktool")
            else:
                err_msg = (res_apktool.stderr or res_apktool.stdout or "Non-zero exit code")[:200].strip()
                self.tool_failures["apktool"] = err_msg
        except subprocess.TimeoutExpired:
            self.tool_failures["apktool"] = f"Timeout after {SUBPROCESS_TIMEOUT_APKTOOL}s"
        except FileNotFoundError:
            self.tool_failures["apktool"] = "apktool executable not found in system PATH"
        except Exception as exc:
            self.tool_failures["apktool"] = str(exc)[:200]

        # 2. Try JADX
        try:
            res_jadx = subprocess.run(
                ["jadx", "-d", jadx_out, sandbox_apk],
                capture_output=True,
                text=True,
                timeout=SUBPROCESS_TIMEOUT_JADX,
                cwd=self.output_dir,
                check=False
            )
            if res_jadx.returncode == 0:
                status["jadx"] = True
                self.tools_used.append("jadx")
            else:
                err_msg = (res_jadx.stderr or res_jadx.stdout or "Non-zero exit code")[:200].strip()
                self.tool_failures["jadx"] = err_msg
        except subprocess.TimeoutExpired:
            self.tool_failures["jadx"] = f"Timeout after {SUBPROCESS_TIMEOUT_JADX}s"
        except FileNotFoundError:
            self.tool_failures["jadx"] = "jadx executable not found in system PATH"
        except Exception as exc:
            self.tool_failures["jadx"] = str(exc)[:200]

        # Determine method
        if status["apktool"] and status["jadx"]:
            status["method"] = "apktool+jadx"
        elif status["apktool"]:
            status["method"] = "apktool"
        elif status["jadx"]:
            status["method"] = "jadx"
        else:
            # 3. Fallback: Safe ZIP Unpacking
            self._safe_extract_zip(sandbox_apk)
            status["method"] = "zip_fallback"
            self.tools_used.append("zip_fallback")

        return status

    def _safe_extract_zip(self, sandbox_apk: str):
        """Extracts ZIP entries file-by-file with strict path traversal & byte limits."""
        zip_out = os.path.join(self.output_dir, "zip_out")
        os.makedirs(zip_out, exist_ok=True)
        extracted_bytes = 0

        with zipfile.ZipFile(sandbox_apk, "r") as zf:
            for info in zf.infolist():
                name = info.filename
                # Skip directory entries
                if name.endswith("/") or name.endswith("\\"):
                    continue

                target_path = os.path.abspath(os.path.join(zip_out, name))
                # Canonical sandbox containment verification
                if not target_path.startswith(os.path.abspath(zip_out) + os.sep):
                    continue

                os.makedirs(os.path.dirname(target_path), exist_ok=True)
                with zf.open(info, "r") as src_file, open(target_path, "wb") as dst_file:
                    chunk = src_file.read(64 * 1024)
                    while chunk:
                        extracted_bytes += len(chunk)
                        if extracted_bytes > MAX_DECLARED_UNCOMPRESSED_SIZE:
                            raise ValueError(f"Extracted byte limit exceeded during fallback: {extracted_bytes}")
                        dst_file.write(chunk)
                        chunk = src_file.read(64 * 1024)

    def _scan_decompiled_files(self) -> Dict[str, Any]:
        """Scans extracted source, config, and manifest files for security risks."""
        scanned_files_count = 0
        target_extensions = (
            ".xml", ".java", ".kt", ".json", ".properties",
            ".smali", ".txt", ".js", ".ts", ".html", ".yml", ".yaml"
        )

        secrets_legacy: List[Dict[str, Any]] = []
        manifest_risks_legacy: List[Dict[str, Any]] = []
        normalized_findings: List[Dict[str, Any]] = []
        endpoints: Set[str] = set()

        manifest_info: Dict[str, Any] = {
            "packageName": None,
            "versionName": None,
            "versionCode": None,
            "minSdkVersion": None,
            "targetSdkVersion": None,
            "compileSdkVersion": None,
            "debuggable": None,
            "allowBackup": None,
            "usesCleartextTraffic": None,
        }
        permissions: List[Dict[str, Any]] = []
        exported_components: Dict[str, List[str]] = {
            "activities": [],
            "services": [],
            "receivers": [],
            "providers": []
        }
        signing_info: Dict[str, Any] = {
            "isSigned": False,
            "scheme": None,
            "debugCert": None,
            "certificate": None
        }

        # Check signature presence from META-INF
        for root, _, files in os.walk(self.output_dir):
            for file in files:
                if file.endswith((".RSA", ".DSA", ".EC")):
                    signing_info["isSigned"] = True
                    signing_info["scheme"] = "v1"
                if file == "CERT.SF" or file == "MANIFEST.MF":
                    signing_info["isSigned"] = True

        finding_counter = 1

        for root, _, files in os.walk(self.output_dir):
            for file in files:
                file_path = os.path.join(root, file)
                # Compute sanitized relative path to avoid leaking local sandbox directory
                rel_path = os.path.relpath(file_path, self.output_dir).replace("\\", "/")
                # Strip internal sub-folder prefixes (apktool_out/, jadx_out/, zip_out/)
                for prefix in ("apktool_out/", "jadx_out/", "zip_out/"):
                    if rel_path.startswith(prefix):
                        rel_path = rel_path[len(prefix):]
                        break

                if file == "AndroidManifest.xml":
                    manifest_data = self._parse_manifest(file_path, rel_path)
                    manifest_info.update(manifest_data["info"])
                    permissions.extend(manifest_data["permissions"])
                    for comp_type in exported_components:
                        exported_components[comp_type].extend(manifest_data["exported"].get(comp_type, []))

                    # Manifest risks
                    for risk in manifest_data["risks"]:
                        manifest_risks_legacy.append(risk)
                        normalized_findings.append({
                            "id": f"APK-MAN-{finding_counter:03d}",
                            "title": risk["title"],
                            "severity": risk["severity"],
                            "category": "MANIFEST_CONFIG",
                            "description": risk["description"],
                            "evidence": risk["evidence"],
                            "remediation": risk["remediation"],
                            "file": rel_path
                        })
                        finding_counter += 1

                if file.endswith(target_extensions):
                    scanned_files_count += 1
                    file_findings, file_secrets, file_endpoints = self._scan_single_file(file_path, rel_path, finding_counter)
                    finding_counter += len(file_findings)
                    normalized_findings.extend(file_findings)
                    secrets_legacy.extend(file_secrets)
                    endpoints.update(file_endpoints)

        # Deduplicate permissions and exported components
        unique_permissions = []
        seen_perm_names = set()
        for p in permissions:
            if p["name"] not in seen_perm_names:
                seen_perm_names.add(p["name"])
                unique_permissions.append(p)
                # If dangerous permission, create finding
                if p["isDangerous"]:
                    normalized_findings.append({
                        "id": f"APK-PERM-{finding_counter:03d}",
                        "title": f"Dangerous Permission Requested: {p['name'].split('.')[-1]}",
                        "severity": "MEDIUM",
                        "category": "PERMISSION",
                        "description": f"The application requests sensitive permission '{p['name']}'. {p['description']}",
                        "evidence": f"<uses-permission android:name=\"{p['name']}\" />",
                        "remediation": "Audit if this permission is strictly required for core application functionality. Enforce runtime permission checks.",
                        "file": "AndroidManifest.xml"
                    })
                    finding_counter += 1

        for comp_type in exported_components:
            exported_components[comp_type] = sorted(list(set(exported_components[comp_type])))

        # Check debug cert flag
        if manifest_info.get("debuggable") is True:
            signing_info["debugCert"] = True

        return {
            "results": {
                "scanned_files_count": scanned_files_count,
                "secrets": secrets_legacy,
                "manifest_risks": manifest_risks_legacy,
            },
            "findings": normalized_findings,
            "endpoints": list(endpoints),
            "manifest_info": manifest_info,
            "permissions": unique_permissions,
            "exported_components": exported_components,
            "signing_info": signing_info,
        }

    def _parse_manifest(self, manifest_path: str, rel_path: str) -> Dict[str, Any]:
        """Parses AndroidManifest.xml and extracts package metadata, permissions, and security flags."""
        info: Dict[str, Any] = {
            "packageName": None,
            "versionName": None,
            "versionCode": None,
            "minSdkVersion": None,
            "targetSdkVersion": None,
            "compileSdkVersion": None,
            "debuggable": None,
            "allowBackup": None,
            "usesCleartextTraffic": None,
        }
        permissions: List[Dict[str, Any]] = []
        exported = {"activities": [], "services": [], "receivers": [], "providers": []}
        risks: List[Dict[str, Any]] = []

        try:
            with open(manifest_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            # 1. Regex extractions for attributes
            pkg_match = re.search(r'package\s*=\s*["\']([^"\']+)["\']', content)
            if pkg_match:
                info["packageName"] = pkg_match.group(1)

            ver_name_match = re.search(r'android:versionName\s*=\s*["\']([^"\']+)["\']', content)
            if ver_name_match:
                info["versionName"] = ver_name_match.group(1)

            ver_code_match = re.search(r'android:versionCode\s*=\s*["\']([^"\']+)["\']', content)
            if ver_code_match:
                info["versionCode"] = ver_code_match.group(1)

            min_sdk_match = re.search(r'android:minSdkVersion\s*=\s*["\']([^"\']+)["\']', content)
            if min_sdk_match:
                info["minSdkVersion"] = min_sdk_match.group(1)

            target_sdk_match = re.search(r'android:targetSdkVersion\s*=\s*["\']([^"\']+)["\']', content)
            if target_sdk_match:
                info["targetSdkVersion"] = target_sdk_match.group(1)

            # Security flags
            if re.search(r'android:debuggable\s*=\s*["\']true["\']', content, re.IGNORECASE):
                info["debuggable"] = True
                risks.append({
                    "file": rel_path,
                    "type": "debuggable",
                    "title": "Application is Debuggable in Production",
                    "severity": "HIGH",
                    "description": "The android:debuggable flag is enabled, allowing attackers to attach debuggers, extract process memory, and execute arbitrary code.",
                    "evidence": 'android:debuggable="true"',
                    "remediation": "Set android:debuggable=\"false\" in AndroidManifest.xml before release."
                })
            elif re.search(r'android:debuggable\s*=\s*["\']false["\']', content, re.IGNORECASE):
                info["debuggable"] = False

            if re.search(r'android:allowBackup\s*=\s*["\']true["\']', content, re.IGNORECASE):
                info["allowBackup"] = True
                risks.append({
                    "file": rel_path,
                    "type": "allow_backup",
                    "title": "Application Data Backup Enabled (allowBackup=true)",
                    "severity": "MEDIUM",
                    "description": "The android:allowBackup flag allows extraction of private application data and databases via ADB backup commands.",
                    "evidence": 'android:allowBackup="true"',
                    "remediation": "Set android:allowBackup=\"false\" or configure a custom BackupAgent with explicit inclusion rules."
                })
            elif re.search(r'android:allowBackup\s*=\s*["\']false["\']', content, re.IGNORECASE):
                info["allowBackup"] = False

            if re.search(r'android:usesCleartextTraffic\s*=\s*["\']true["\']', content, re.IGNORECASE):
                info["usesCleartextTraffic"] = True
                risks.append({
                    "file": rel_path,
                    "type": "uses_cleartext_traffic",
                    "title": "Cleartext HTTP Traffic Allowed (usesCleartextTraffic=true)",
                    "severity": "HIGH",
                    "description": "The application permits unencrypted HTTP network traffic, exposing sensitive credentials and payloads to Man-in-the-Middle (MitM) interception.",
                    "evidence": 'android:usesCleartextTraffic="true"',
                    "remediation": "Enforce strict HTTPS by setting android:usesCleartextTraffic=\"false\" and configuring network_security_config.xml."
                })
            elif re.search(r'android:usesCleartextTraffic\s*=\s*["\']false["\']', content, re.IGNORECASE):
                info["usesCleartextTraffic"] = False

            # Permissions extraction
            perm_matches = re.finditer(r'<uses-permission\s+[^>]*android:name\s*=\s*["\']([^"\']+)["\']', content)
            for m in perm_matches:
                perm_name = m.group(1)
                is_dangerous = perm_name in DANGEROUS_PERMISSIONS
                desc = DANGEROUS_PERMISSIONS.get(perm_name, "Standard application permission")
                permissions.append({
                    "name": perm_name,
                    "isDangerous": is_dangerous,
                    "description": desc
                })

            # Exported components extraction
            comp_patterns = {
                "activities": r'<activity\s+[^>]*android:name\s*=\s*["\']([^"\']+)["\'][^>]*android:exported\s*=\s*["\']true["\']',
                "services": r'<service\s+[^>]*android:name\s*=\s*["\']([^"\']+)["\'][^>]*android:exported\s*=\s*["\']true["\']',
                "receivers": r'<receiver\s+[^>]*android:name\s*=\s*["\']([^"\']+)["\'][^>]*android:exported\s*=\s*["\']true["\']',
                "providers": r'<provider\s+[^>]*android:name\s*=\s*["\']([^"\']+)["\'][^>]*android:exported\s*=\s*["\']true["\']',
            }
            for comp_type, pattern in comp_patterns.items():
                for cm in re.finditer(pattern, content, re.IGNORECASE):
                    comp_name = cm.group(1)
                    exported[comp_type].append(comp_name)
                    risks.append({
                        "file": rel_path,
                        "type": "exported_component",
                        "title": f"Exported {comp_type[:-1].capitalize()} Component Detected",
                        "severity": "HIGH" if comp_type in ("providers", "services") else "MEDIUM",
                        "description": f"The component '{comp_name}' is declared as android:exported=\"true\" without explicit permission gating.",
                        "evidence": f'<{comp_type[:-1]} android:name="{comp_name}" android:exported="true">',
                        "remediation": f"Set android:exported=\"false\" if the {comp_type[:-1]} is for internal use only, or declare android:permission to restrict access."
                    })

        except Exception as e:
            logger.warning(f"Error parsing AndroidManifest.xml: {e}")

        return {
            "info": info,
            "permissions": permissions,
            "exported": exported,
            "risks": risks,
        }

    def _scan_single_file(self, file_path: str, rel_path: str, start_counter: int) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[str]]:
        """Scans individual source or resource file for secrets, sensitive endpoints, and crypto misconfigurations."""
        findings: List[Dict[str, Any]] = []
        secrets_legacy: List[Dict[str, Any]] = []
        endpoints: List[str] = []
        curr_id = start_counter

        try:
            # Skip massive files > 5MB to bound RAM & regex time
            if os.path.getsize(file_path) > 5 * 1024 * 1024:
                return findings, secrets_legacy, endpoints

            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()

            # Secret Regex Scanning
            for secret_type, pattern in MOBILE_SECRET_PATTERNS.items():
                for match in pattern.finditer(content):
                    matched_val = match.group(0)
                    if len(matched_val) > 6 and "example" not in matched_val.lower():
                        redacted = redact_secret_evidence(matched_val)
                        secrets_legacy.append({
                            "file": rel_path,
                            "type": secret_type,
                            "match": redacted,  # Masked for safety
                        })

                        severity = "CRITICAL"
                        if secret_type in ("firebase_db_url", "s3_bucket_url"):
                            severity = "MEDIUM"
                        elif secret_type in ("jwt_token", "bearer_token"):
                            severity = "HIGH"

                        findings.append({
                            "id": f"APK-SEC-{curr_id:03d}",
                            "title": f"Hardcoded Sensitive Credential ({secret_type})",
                            "severity": severity,
                            "category": "HARDCODED_SECRET",
                            "description": f"Detected hardcoded credential or secret pattern ({secret_type}) in source/config files.",
                            "evidence": f"Pattern: {secret_type} -> {redacted}",
                            "remediation": "Remove hardcoded secrets and tokens from source code. Retrieve sensitive keys at runtime via a secure backend or Android Keystore.",
                            "file": rel_path
                        })
                        curr_id += 1

            # Insecure TrustManager / SSL bypass detection
            if "TrustAllCertificates" in content or "ALLOW_ALL_HOSTNAME_VERIFIER" in content or "checkServerTrusted" in content and "return;" in content:
                findings.append({
                    "id": f"APK-CRYPTO-{curr_id:03d}",
                    "title": "Insecure TLS/SSL TrustManager Implementation",
                    "severity": "CRITICAL",
                    "category": "NETWORK_SECURITY",
                    "description": "Source code contains custom TrustManager or HostnameVerifier that disables X.509 certificate validation, enabling MitM attacks.",
                    "evidence": "Insecure TrustManager / HostnameVerifier bypass pattern detected.",
                    "remediation": "Use system-default X509TrustManager and configure certificate pinning in res/xml/network_security_config.xml.",
                    "file": rel_path
                })
                curr_id += 1

            # Endpoint / URL scanning
            for endp_pattern in MOBILE_ENDPOINT_PATTERNS:
                for match in endp_pattern.finditer(content):
                    ep = match.group(0).strip("\"' ")
                    if len(ep) > 5 and not ep.startswith("http://schemas.android.com"):
                        endpoints.append(ep)

        except Exception as e:
            logger.debug(f"Error scanning file {file_path}: {e}")

        return findings, secrets_legacy, endpoints

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

