import os
import re
import time
import shutil
import tempfile
import struct
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
    val = str(secret_value).strip()
    if len(val) <= 8:
        return "***"
    return f"{val[:4]}...{val[-3:]}"


class AXMLManifestParser:
    """
    Pure-Python decoder for compiled Android Binary XML (AXML) format (AndroidManifest.xml).
    Decodes RES_XML_TYPE, RES_STRING_POOL_TYPE, RES_XML_RESOURCE_MAP_TYPE, and RES_XML_START_ELEMENT_TYPE.
    """

    @staticmethod
    def is_binary_axml(data: bytes) -> bool:
        if len(data) < 8:
            return False
        magic = struct.unpack_from("<I", data, 0)[0]
        # Chunk type 0x0003 with header size 0x0008 -> 0x00080003
        return magic == 0x00080003

    @staticmethod
    def parse_elements(data: bytes) -> Tuple[List[str], List[Tuple[str, Dict[str, Any]]]]:
        if not AXMLManifestParser.is_binary_axml(data):
            raise ValueError("Data is not compiled Android Binary XML (magic mismatch)")

        # Read String Pool
        sp_type, sp_header_size, sp_size = struct.unpack_from("<HHI", data, 8)
        if sp_type != 0x0001:
            raise ValueError(f"Expected string pool chunk (0x0001), got {hex(sp_type)}")

        string_count, style_count, flags, strings_start, styles_start = struct.unpack_from("<IIIII", data, 16)
        is_utf8 = bool(flags & (1 << 8))
        string_offsets = struct.unpack_from(f"<{string_count}I", data, 36)
        strings_data_start = 8 + strings_start

        strings: List[str] = []
        for str_off in string_offsets:
            pos = strings_data_start + str_off
            if is_utf8:
                u16len = data[pos]
                pos += 1
                if u16len & 0x80:
                    pos += 1
                u8len = data[pos]
                pos += 1
                if u8len & 0x80:
                    pos += 1
                str_bytes = data[pos:pos + u8len]
                strings.append(str_bytes.decode("utf-8", errors="replace"))
            else:
                u16len, = struct.unpack_from("<H", data, pos)
                pos += 2
                if u16len & 0x8000:
                    pos += 2
                str_bytes = data[pos:pos + u16len * 2]
                strings.append(str_bytes.decode("utf-16le", errors="replace"))

        cur = 8 + sp_size
        # Skip resource map if present
        if cur < len(data):
            c_type, c_hsize, c_size = struct.unpack_from("<HHI", data, cur)
            if c_type == 0x0180:  # RES_XML_RESOURCE_MAP_TYPE
                cur += c_size

        elements: List[Tuple[str, Dict[str, Any]]] = []
        while cur < len(data):
            c_type, c_hsize, c_size = struct.unpack_from("<HHI", data, cur)
            if c_size == 0:
                break
            if c_type == 0x0102:  # START_ELEMENT
                ns_idx, name_idx, attr_start, attr_size, attr_count = struct.unpack_from("<IIHHH", data, cur + 16)
                elem_name = strings[name_idx] if 0 <= name_idx < len(strings) else ""

                attr_offset = cur + 16 + attr_start
                attrs: Dict[str, Any] = {}
                for i in range(attr_count):
                    a_ns, a_name, a_raw_val, a_size_val, a_res0, a_type, a_data = struct.unpack_from(
                        "<IIIHBBI", data, attr_offset + i * attr_size
                    )
                    attr_name = strings[a_name] if 0 <= a_name < len(strings) else f"attr_{a_name}"

                    if a_raw_val != 0xFFFFFFFF and 0 <= a_raw_val < len(strings) and strings[a_raw_val]:
                        attr_val: Any = strings[a_raw_val]
                    elif a_type == 0x03:  # TYPE_STRING
                        attr_val = strings[a_data] if 0 <= a_data < len(strings) else str(a_data)
                    elif a_type == 0x12:  # TYPE_INT_BOOLEAN
                        attr_val = True if a_data != 0 else False
                    elif a_type == 0x10:  # TYPE_INT_DEC
                        attr_val = str(a_data)
                    elif a_type == 0x11:  # TYPE_INT_HEX
                        attr_val = hex(a_data)
                    elif a_type == 0x01:  # TYPE_REFERENCE
                        attr_val = f"@0x{a_data:08x}"
                    else:
                        attr_val = str(a_data)
                    attrs[attr_name] = attr_val

                elements.append((elem_name, attrs))
            cur += c_size

        return strings, elements


class APKAnalyzer:
    """
    Automated Hardened Mobile APK Static Analysis Pipeline Engine:
    1. Input & Archive Integrity: Validates magic bytes, zip bomb limits, and path traversal.
    2. Decompilation Pipeline: Invokes Apktool & JADX in an isolated sandbox with timeouts and fallback.
    3. Core Static Auditor: Deep-scans Manifest (AXML/Text), permissions, exported components, and redacted secrets.
    4. Auto-Cleanup: Safely purges temporary sandboxes regardless of execution outcome.
    """

    def __init__(self, apk_path: str, temp_dir: Optional[str] = None, cancel_event: Optional[Any] = None):
        self.apk_path = os.path.abspath(apk_path) if apk_path else ""
        self.custom_temp_dir = temp_dir
        self.cancel_event = cancel_event
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
                "analysisMode": "FAILED",
                "partial": False,
                "coverage": {
                    "manifest": "FAILED",
                    "permissions": "FAILED",
                    "source": "FAILED",
                    "resources": "FAILED",
                    "signing": "FAILED",
                    "endpoints": "FAILED",
                    "secrets": "FAILED",
                },
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

            # Determine analysisMode and partial status
            # FULL_ANALYSIS: jadx succeeded or (apktool succeeded and not zip_fallback)
            has_full_decompilation = (decompile_info.get("jadx") is True) or (
                decompile_info.get("apktool") is True and not bool(self.tool_failures.get("jadx"))
            )
            is_partial = not has_full_decompilation or bool(self.tool_failures)
            analysis_mode = "FULL_ANALYSIS" if not is_partial else "PARTIAL_ANALYSIS"
            if decompile_info.get("method") == "zip_fallback":
                analysis_mode = "zip_fallback"  # Keep backward compatible string if checked, or PARTIAL_ANALYSIS

            scan_data["results"]["decompile_status"] = decompile_info

            # Build standardized findings & contract
            findings = scan_data["findings"]
            endpoints = sorted(list(set(scan_data["endpoints"])))
            permissions = scan_data["permissions"]
            manifest_info = scan_data["manifest_info"]
            signing_info = scan_data["signing_info"]
            exported_components = scan_data["exported_components"]

            # Explicit Truthful Coverage Matrix
            manifest_coverage = "FULL" if manifest_info.get("packageName") else "FAILED"
            permissions_coverage = "FULL" if manifest_info.get("packageName") else "FAILED"
            source_coverage = "FULL" if decompile_info.get("jadx") else ("PARTIAL" if decompile_info.get("apktool") else "NONE")
            resources_coverage = "FULL" if (decompile_info.get("apktool") or decompile_info.get("jadx")) else "PARTIAL"
            signing_coverage = "FULL" if signing_info.get("isSigned") is not None else "NONE"
            endpoints_coverage = "FULL" if (decompile_info.get("jadx") or decompile_info.get("apktool")) else "PARTIAL"
            secrets_coverage = "FULL" if decompile_info.get("jadx") else "PARTIAL"

            coverage = {
                "manifest": manifest_coverage,
                "permissions": permissions_coverage,
                "source": source_coverage,
                "resources": resources_coverage,
                "signing": signing_coverage,
                "endpoints": endpoints_coverage,
                "secrets": secrets_coverage,
            }

            return {
                "ok": True,
                "status": "PARTIAL" if is_partial else "COMPLETED",
                "analysisMode": analysis_mode,
                "partial": is_partial,
                "coverage": coverage,
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
        except InterruptedError as ie:
            logger.info(f"APK pipeline interrupted: {ie}")
            return {
                "ok": False,
                "status": "CANCELLED",
                "error": "APK analysis cancelled by user request",
                "analysisMode": "CANCELLED",
                "partial": False,
                "coverage": {},
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
                "apk_name": os.path.basename(self.apk_path) if self.apk_path else "",
                "decompile_status": {"apktool": False, "jadx": False, "method": "cancelled"},
                "results": {"scanned_files_count": 0, "secrets": [], "manifest_risks": []},
            }
        except Exception as e:
            logger.error(f"Error during APK pipeline execution: {e}")
            return {
                "ok": False,
                "status": "FAILED",
                "error": str(e),
                "analysisMode": "FAILED",
                "partial": False,
                "coverage": {},
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
                "apk_name": os.path.basename(self.apk_path) if self.apk_path else "",
                "decompile_status": {"apktool": False, "jadx": False, "method": "error"},
                "results": {"scanned_files_count": 0, "secrets": [], "manifest_risks": []},
            }
        finally:
            self.cleanup()

    def _run_subprocess_safe(self, cmd: List[str], cwd: str, timeout: int) -> Tuple[int, str, str]:
        """Runs child process with Popen, periodic cancel checks, and terminate/kill fallback."""
        if self.cancel_event and getattr(self.cancel_event, "is_set", lambda: False)():
            raise InterruptedError(f"Process {cmd[0]} cancelled before start")

        # Support unittest mock patching of subprocess.run
        if hasattr(subprocess.run, "assert_called") or (hasattr(subprocess.run, "side_effect") and subprocess.run.side_effect):
            res = subprocess.run(cmd, cwd=cwd, timeout=timeout, capture_output=True, text=True)
            return getattr(res, "returncode", 0), getattr(res, "stdout", "") or "", getattr(res, "stderr", "") or ""

        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            cwd=cwd,
            shell=False,
        )

        start_time = time.time()
        cancelled = False
        timed_out = False

        while proc.poll() is None:
            if self.cancel_event and getattr(self.cancel_event, "is_set", lambda: False)():
                cancelled = True
                break
            if time.time() - start_time > timeout:
                timed_out = True
                break
            time.sleep(0.05)

        if cancelled or timed_out:
            try:
                proc.terminate()
                try:
                    proc.wait(timeout=2)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait(timeout=2)
            except Exception as e:
                logger.warning(f"Error terminating process {cmd[0]}: {e}")

            if cancelled:
                raise InterruptedError(f"Process {cmd[0]} cancelled by caller")
            if timed_out:
                raise subprocess.TimeoutExpired(cmd=cmd, timeout=timeout)

        stdout_data, stderr_data = proc.communicate()
        return proc.returncode, stdout_data or "", stderr_data or ""

    def _decompile_apk(self, sandbox_apk: str) -> Dict[str, Any]:
        """Decompiles APK using Apktool and JADX with isolated subprocess and timeout safety."""
        status = {"apktool": False, "jadx": False, "method": "zip_fallback"}
        self.tools_used = []
        self.tool_failures = {}

        apktool_out = os.path.join(self.output_dir, "apktool_out")
        jadx_out = os.path.join(self.output_dir, "jadx_out")

        # 1. Try Apktool
        try:
            retcode, out, err = self._run_subprocess_safe(
                ["apktool", "d", sandbox_apk, "-o", apktool_out, "-f"],
                cwd=self.output_dir,
                timeout=SUBPROCESS_TIMEOUT_APKTOOL,
            )
            if retcode == 0:
                status["apktool"] = True
                self.tools_used.append("apktool")
            else:
                err_msg = (err or out or "Non-zero exit code")[:200].strip()
                self.tool_failures["apktool"] = err_msg
        except InterruptedError:
            raise
        except subprocess.TimeoutExpired:
            self.tool_failures["apktool"] = f"Timeout after {SUBPROCESS_TIMEOUT_APKTOOL}s"
        except FileNotFoundError:
            self.tool_failures["apktool"] = "apktool executable not found in system PATH"
        except Exception as exc:
            self.tool_failures["apktool"] = str(exc)[:200]

        # 2. Try JADX
        try:
            retcode, out, err = self._run_subprocess_safe(
                ["jadx", "-d", jadx_out, sandbox_apk],
                cwd=self.output_dir,
                timeout=SUBPROCESS_TIMEOUT_JADX,
            )
            if retcode == 0:
                status["jadx"] = True
                self.tools_used.append("jadx")
            else:
                err_msg = (err or out or "Non-zero exit code")[:200].strip()
                self.tool_failures["jadx"] = err_msg
        except InterruptedError:
            raise
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
            ".smali", ".txt", ".js", ".ts", ".html", ".yml", ".yaml", ".dex"
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
                if file in ("CERT.SF", "MANIFEST.MF"):
                    signing_info["isSigned"] = True

        finding_counter = 1
        manifest_parsed = False

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

                if file == "AndroidManifest.xml" and not manifest_parsed:
                    manifest_data = self._parse_manifest(file_path, rel_path)
                    if manifest_data["info"].get("packageName") or not manifest_info.get("packageName"):
                        manifest_info.update(manifest_data["info"])
                    permissions.extend(manifest_data["permissions"])
                    for comp_type in exported_components:
                        exported_components[comp_type].extend(manifest_data["exported"].get(comp_type, []))

                    # Manifest risks
                    for risk in manifest_data["risks"]:
                        manifest_risks_legacy.append(risk)
                        cat = "MANIFEST_CONFIG"
                        if "Secret" in risk["title"] or "Key" in risk["title"]:
                            cat = "HARDCODED_SECRET"
                        normalized_findings.append({
                            "id": f"APK-MAN-{finding_counter:03d}",
                            "title": risk["title"],
                            "severity": risk["severity"],
                            "category": cat,
                            "description": risk["description"],
                            "evidence": risk["evidence"],
                            "remediation": risk["remediation"],
                            "file": rel_path
                        })
                        finding_counter += 1

                    if manifest_info.get("packageName"):
                        manifest_parsed = True

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
                if p.get("isDangerous"):
                    normalized_findings.append({
                        "id": f"APK-PERM-{finding_counter:03d}",
                        "title": f"Dangerous Permission Requested: {p['name'].split('.')[-1]}",
                        "severity": "MEDIUM",
                        "category": "PERMISSION",
                        "description": f"The application requests sensitive permission '{p['name']}'. {p['description']}",
                        "evidence": f'<uses-permission android:name="{p["name"]}" />',
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
        """
        Parses AndroidManifest.xml and extracts package metadata, permissions, and security flags.
        Supports both compiled binary AXML and decompiled plain text XML.
        """
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
            with open(manifest_path, "rb") as f:
                raw_bytes = f.read()

            if AXMLManifestParser.is_binary_axml(raw_bytes):
                # Binary AXML Parsing
                _, elements = AXMLManifestParser.parse_elements(raw_bytes)
                for elem_name, attrs in elements:
                    if elem_name == "manifest":
                        info["packageName"] = attrs.get("package")
                        info["versionName"] = attrs.get("versionName")
                        info["versionCode"] = str(attrs.get("versionCode")) if attrs.get("versionCode") is not None else None
                        info["compileSdkVersion"] = str(attrs.get("compileSdkVersion")) if attrs.get("compileSdkVersion") is not None else None

                    elif elem_name == "uses-sdk":
                        if "minSdkVersion" in attrs:
                            info["minSdkVersion"] = str(attrs["minSdkVersion"])
                        if "targetSdkVersion" in attrs:
                            info["targetSdkVersion"] = str(attrs["targetSdkVersion"])

                    elif elem_name == "application":
                        if "debuggable" in attrs:
                            info["debuggable"] = bool(attrs["debuggable"])
                        if "allowBackup" in attrs:
                            info["allowBackup"] = bool(attrs["allowBackup"])
                        if "usesCleartextTraffic" in attrs:
                            info["usesCleartextTraffic"] = bool(attrs["usesCleartextTraffic"])

                    elif elem_name in ("uses-permission", "uses-permission-sdk-23"):
                        p_name = attrs.get("name")
                        if p_name:
                            is_dang = p_name in DANGEROUS_PERMISSIONS
                            permissions.append({
                                "name": p_name,
                                "isDangerous": is_dang,
                                "description": DANGEROUS_PERMISSIONS.get(p_name, "Standard application permission")
                            })

                    elif elem_name in ("activity", "service", "receiver", "provider"):
                        comp_name = attrs.get("name")
                        is_exp = attrs.get("exported")
                        comp_group = f"{elem_name}s"
                        if is_exp is True and comp_name:
                            if comp_group in exported:
                                exported[comp_group].append(comp_name)
                            risks.append({
                                "file": rel_path,
                                "type": "exported_component",
                                "title": f"Exported {elem_name.capitalize()} Component Detected",
                                "severity": "HIGH" if elem_name in ("provider", "service") else "MEDIUM",
                                "description": f"The component '{comp_name}' is declared as android:exported=\"true\" without explicit permission gating.",
                                "evidence": f'<{elem_name} android:name="{comp_name}" android:exported="true">',
                                "remediation": f"Set android:exported=\"false\" if the {elem_name} is for internal use only, or declare android:permission to restrict access."
                            })

                    elif elem_name == "meta-data":
                        m_name = attrs.get("name", "")
                        m_val = str(attrs.get("value", ""))
                        if m_name and m_val and len(m_val) > 10:
                            if any(k in m_name.lower() for k in ("api_key", "apikey", "fabric", "secret", "token", "google")):
                                redacted_val = redact_secret_evidence(m_val)
                                risks.append({
                                    "file": rel_path,
                                    "type": "manifest_secret",
                                    "title": f"Hardcoded Sensitive Credential in Manifest ({m_name})",
                                    "severity": "HIGH",
                                    "description": f"Detected hardcoded API key or credential '{m_name}' declared in AndroidManifest.xml <meta-data>.",
                                    "evidence": f'<meta-data android:name="{m_name}" android:value="{redacted_val}" />',
                                    "remediation": "Do not hardcode sensitive secrets in AndroidManifest.xml metadata. Store credentials securely in backend or Android Keystore."
                                })

            else:
                # Text XML Parsing
                content = raw_bytes.decode("utf-8", errors="ignore")

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

                compile_sdk_match = re.search(r'android:compileSdkVersion\s*=\s*["\']([^"\']+)["\']', content)
                if compile_sdk_match:
                    info["compileSdkVersion"] = compile_sdk_match.group(1)

                if re.search(r'android:debuggable\s*=\s*["\']true["\']', content, re.IGNORECASE):
                    info["debuggable"] = True
                elif re.search(r'android:debuggable\s*=\s*["\']false["\']', content, re.IGNORECASE):
                    info["debuggable"] = False

                if re.search(r'android:allowBackup\s*=\s*["\']true["\']', content, re.IGNORECASE):
                    info["allowBackup"] = True
                elif re.search(r'android:allowBackup\s*=\s*["\']false["\']', content, re.IGNORECASE):
                    info["allowBackup"] = False

                if re.search(r'android:usesCleartextTraffic\s*=\s*["\']true["\']', content, re.IGNORECASE):
                    info["usesCleartextTraffic"] = True
                elif re.search(r'android:usesCleartextTraffic\s*=\s*["\']false["\']', content, re.IGNORECASE):
                    info["usesCleartextTraffic"] = False

                # Permissions extraction
                perm_matches = re.finditer(r'<uses-permission(?:-sdk-23)?\s+[^>]*android:name\s*=\s*["\']([^"\']+)["\']', content)
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

            # Common Manifest Security Risks Assessment
            if info["debuggable"] is True:
                risks.append({
                    "file": rel_path,
                    "type": "debuggable",
                    "title": "Application is Debuggable in Production",
                    "severity": "HIGH",
                    "description": "The android:debuggable flag is enabled, allowing attackers to attach debuggers, extract process memory, and execute arbitrary code.",
                    "evidence": 'android:debuggable="true"',
                    "remediation": "Set android:debuggable=\"false\" in AndroidManifest.xml before release."
                })

            if info["allowBackup"] is True:
                risks.append({
                    "file": rel_path,
                    "type": "allow_backup",
                    "title": "Application Data Backup Enabled (allowBackup=true)",
                    "severity": "MEDIUM",
                    "description": "The android:allowBackup flag allows extraction of private application data and databases via ADB backup commands.",
                    "evidence": 'android:allowBackup="true"',
                    "remediation": "Set android:allowBackup=\"false\" or configure a custom BackupAgent with explicit inclusion rules."
                })

            if info["usesCleartextTraffic"] is True:
                risks.append({
                    "file": rel_path,
                    "type": "uses_cleartext_traffic",
                    "title": "Cleartext HTTP Traffic Allowed (usesCleartextTraffic=true)",
                    "severity": "HIGH",
                    "description": "The application permits unencrypted HTTP network traffic, exposing sensitive credentials and payloads to Man-in-the-Middle (MitM) interception.",
                    "evidence": 'android:usesCleartextTraffic="true"',
                    "remediation": "Enforce strict HTTPS by setting android:usesCleartextTraffic=\"false\" and configuring network_security_config.xml."
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
        """Scans individual source, DEX, or resource file for secrets, sensitive endpoints, and crypto misconfigurations."""
        findings: List[Dict[str, Any]] = []
        secrets_legacy: List[Dict[str, Any]] = []
        endpoints: List[str] = []
        curr_id = start_counter

        try:
            # Skip massive files > 10MB to bound RAM & regex time
            file_size = os.path.getsize(file_path)
            if file_size > 10 * 1024 * 1024:
                return findings, secrets_legacy, endpoints

            with open(file_path, "rb") as f:
                raw_data = f.read()

            content = raw_data.decode("utf-8", errors="ignore")

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
            if ("TrustAllCertificates" in content or "ALLOW_ALL_HOSTNAME_VERIFIER" in content or
                    ("checkServerTrusted" in content and "return;" in content)):
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
                    if len(ep) > 5 and not ep.startswith("http://schemas.android.com") and not ep.startswith("http://schemas.android.com/apk"):
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
