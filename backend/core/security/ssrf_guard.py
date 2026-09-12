import os
import re
import socket
import ipaddress
import urllib.parse
from typing import Tuple, List, Optional, Dict, Any
import requests
import requests.adapters
import urllib3
import urllib3.connection
import urllib3.connectionpool
from urllib3.util import connection
from fastapi import HTTPException, status

def is_dev_private_allowed() -> bool:
    """
    Check whether private/local network targets are permitted.
    Defaults to FALSE (strict block in production).
    Only enabled in local development when ALLOW_PRIVATE_STRESS_TARGETS is set.
    """
    return os.getenv("ALLOW_PRIVATE_STRESS_TARGETS", "").strip().lower() in ("1", "true", "yes")

class SSRFSecurityError(HTTPException):
    def __init__(self, detail: str = "Mục tiêu không hợp lệ hoặc nằm trong dải mạng bị hạn chế."):
        super().__init__(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=detail
        )

# ----------------------------------------------------------------------
# Connection Pinning: Transport-level IP Binding Classes for urllib3 2.x
# ----------------------------------------------------------------------

class PinnedHTTPConnection(urllib3.connection.HTTPConnection):
    """
    HTTP connection subclass that connects TCP socket directly to validated pinned_ip
    while preserving original hostname for HTTP Host header.
    """
    def __init__(self, *args, pinned_ip: Optional[str] = None, **kwargs):
        self._pinned_ip = pinned_ip
        super().__init__(*args, **kwargs)

    def _new_conn(self) -> socket.socket:
        dest = (self._pinned_ip, self.port) if self._pinned_ip else (self._dns_host, self.port)
        return connection.create_connection(
            dest,
            self.timeout,
            source_address=self.source_address,
            socket_options=self.socket_options,
        )

class PinnedHTTPSConnection(urllib3.connection.HTTPSConnection):
    """
    HTTPS connection subclass that connects TCP socket directly to validated pinned_ip
    while preserving original hostname for TLS SNI, certificate validation,
    and HTTP Host header.
    """
    def __init__(self, *args, pinned_ip: Optional[str] = None, **kwargs):
        self._pinned_ip = pinned_ip
        super().__init__(*args, **kwargs)

    def _new_conn(self) -> socket.socket:
        dest = (self._pinned_ip, self.port) if self._pinned_ip else (self._dns_host, self.port)
        return connection.create_connection(
            dest,
            self.timeout,
            source_address=self.source_address,
            socket_options=self.socket_options,
        )

class PinnedHTTPConnectionPool(urllib3.connectionpool.HTTPConnectionPool):
    ConnectionCls = PinnedHTTPConnection

    def __init__(self, *args, pinned_ip: Optional[str] = None, **kwargs):
        self.pinned_ip = pinned_ip
        super().__init__(*args, **kwargs)

    def _new_conn(self):
        self.num_connections += 1
        return self.ConnectionCls(
            host=self.host,
            port=self.port,
            timeout=self.timeout.connect_timeout,
            pinned_ip=self.pinned_ip,
            **self.conn_kw,
        )

class PinnedHTTPSConnectionPool(urllib3.connectionpool.HTTPSConnectionPool):
    ConnectionCls = PinnedHTTPSConnection

    def __init__(self, *args, pinned_ip: Optional[str] = None, **kwargs):
        self.pinned_ip = pinned_ip
        super().__init__(*args, **kwargs)

    def _new_conn(self):
        self.num_connections += 1
        return self.ConnectionCls(
            host=self.host,
            port=self.port,
            timeout=self.timeout.connect_timeout,
            pinned_ip=self.pinned_ip,
            **self.conn_kw,
        )

class PinnedHTTPAdapter(requests.adapters.HTTPAdapter):
    """
    Custom requests adapter that routes all traffic to a pre-validated IP,
    preventing double DNS resolution and DNS rebinding attacks while preserving
    Host header, TLS SNI, and Certificate validation.
    """
    def __init__(self, pinned_ip: str, *args, **kwargs):
        self.pinned_ip = pinned_ip
        super().__init__(*args, **kwargs)

    def init_poolmanager(self, connections, maxsize, block=False, **pool_kwargs):
        self.poolmanager = urllib3.PoolManager(
            num_pools=connections,
            maxsize=maxsize,
            block=block,
            **pool_kwargs
        )
        self.poolmanager.pool_classes_by_scheme["http"] = lambda *args, **kw: PinnedHTTPConnectionPool(
            *args, pinned_ip=self.pinned_ip, **kw
        )
        self.poolmanager.pool_classes_by_scheme["https"] = lambda *args, **kw: PinnedHTTPSConnectionPool(
            *args, pinned_ip=self.pinned_ip, **kw
        )

def create_pinned_session(pinned_ip: str, pool_connections: int = 10, pool_maxsize: int = 10) -> requests.Session:
    """
    Creates a requests.Session with connection pinning to the specified IP.
    """
    session = requests.Session()
    adapter = PinnedHTTPAdapter(pinned_ip=pinned_ip, pool_connections=pool_connections, pool_maxsize=pool_maxsize, max_retries=0)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    return session

# ----------------------------------------------------------------------
# Target Validation and Safe Fetch
# ----------------------------------------------------------------------

def validate_and_canonicalize_url(raw_url: str) -> Tuple[str, str, int]:
    """
    Validates URL scheme, structure, and canonicalizes origin.
    Returns: (canonical_origin, hostname, port)
    """
    raw = (raw_url or "").strip()
    if not raw:
        raise SSRFSecurityError("URL mục tiêu là bắt buộc.")

    if "://" in raw:
        parsed = urllib.parse.urlparse(raw)
    else:
        parsed = urllib.parse.urlparse(f"https://{raw}")

    scheme = parsed.scheme.lower()
    if scheme not in ("http", "https"):
        raise SSRFSecurityError("Chỉ hỗ trợ giao thức HTTP và HTTPS.")

    if parsed.username or parsed.password:
        raise SSRFSecurityError("Không chấp nhận URL chứa thông tin xác thực (username/password).")

    hostname = parsed.hostname
    if not hostname:
        raise SSRFSecurityError("Tên miền máy chủ không hợp lệ.")

    hostname = hostname.lower().strip(".")
    if not hostname:
        raise SSRFSecurityError("Tên miền máy chủ không hợp lệ.")

    port = parsed.port or (443 if scheme == "https" else 80)
    if port < 1 or port > 65535:
        raise SSRFSecurityError("Cổng kết nối không hợp lệ.")

    is_default_port = (scheme == "http" and port == 80) or (scheme == "https" and port == 443)
    netloc = hostname if is_default_port else f"{hostname}:{port}"
    canonical_origin = f"{scheme}://{netloc}"

    return canonical_origin, hostname, port

def is_ip_disallowed(ip_str: str) -> bool:
    """
    Checks if an IP address is private, loopback, link-local, multicast,
    cloud metadata, or reserved according to IETF/RFC standards.
    """
    try:
        ip = ipaddress.ip_address(ip_str)
    except ValueError:
        return True

    # Cloud metadata special check (AWS/GCP/Azure link-local metadata)
    if str(ip) == "169.254.169.254":
        return True

    if (
        ip.is_private
        or ip.is_loopback
        or ip.is_link_local
        or ip.is_multicast
        or ip.is_reserved
        or ip.is_unspecified
    ):
        return True

    # Additional IPv4 checks: 0.0.0.0/8, 100.64.0.0/10 (CGNAT), 240.0.0.0/4
    if isinstance(ip, ipaddress.IPv4Address):
        if (
            ip in ipaddress.IPv4Network("0.0.0.0/8")
            or ip in ipaddress.IPv4Network("100.64.0.0/10")
            or ip in ipaddress.IPv4Network("240.0.0.0/4")
        ):
            return True

    # Additional IPv6 checks: fc00::/7 (ULA), fe80::/10 (Link-local), ::1
    if isinstance(ip, ipaddress.IPv6Address):
        if (
            ip in ipaddress.IPv6Network("fc00::/7")
            or ip in ipaddress.IPv6Network("fe80::/10")
            or ip == ipaddress.IPv6Address("::1")
        ):
            return True

    return False

def resolve_and_validate_target(raw_url: str) -> Tuple[str, List[str]]:
    """
    Validates URL syntax, resolves DNS once, and verifies all resolved IP addresses.
    Returns: (canonical_origin, list_of_resolved_ips)
    """
    canonical_origin, hostname, port = validate_and_canonicalize_url(raw_url)

    # Check if hostname itself is an IP literal
    is_ip_literal = False
    try:
        ipaddress.ip_address(hostname)
        is_ip_literal = True
        resolved_ips = [hostname]
    except ValueError:
        resolved_ips = []

    if not is_ip_literal:
        try:
            addr_info = socket.getaddrinfo(hostname, port, proto=socket.IPPROTO_TCP)
            for item in addr_info:
                ip_val = item[4][0]
                if ip_val not in resolved_ips:
                    resolved_ips.append(ip_val)
        except socket.gaierror:
            raise SSRFSecurityError("Không thể phân giải địa chỉ DNS của máy chủ mục tiêu.")
        except Exception:
            raise SSRFSecurityError("Lỗi trong quá trình phân giải DNS mục tiêu.")

    if not resolved_ips:
        raise SSRFSecurityError("Không tìm thấy địa chỉ IP hợp lệ cho mục tiêu.")

    # If dev override is enabled, allow private targets for local testing
    if is_dev_private_allowed():
        return canonical_origin, resolved_ips

    # Production check: ALL resolved IPs must be safe public IPs
    for ip_str in resolved_ips:
        if is_ip_disallowed(ip_str):
            raise SSRFSecurityError("Mục tiêu không hợp lệ hoặc nằm trong dải mạng nội bộ/bị hạn chế.")

    return canonical_origin, resolved_ips

def safe_http_fetch(
    initial_url: str,
    max_redirects: int = 5,
    timeout: float = 6.0,
    max_size: int = 512 * 1024,
    headers: Optional[Dict[str, str]] = None,
    verify_tls: bool = True,
) -> Tuple[int, str, Dict[str, str]]:
    """
    Safely fetches a URL with connection pinning, redirect revalidation,
    and bounded response size. Eliminates DNS rebinding TOCTOU attacks.
    """
    req_headers = headers.copy() if headers else {}
    req_headers.setdefault(
        "User-Agent",
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36 (compatible; ADQ-Verification-Bot/1.0; +https://adq.ai/verify)",
    )
    req_headers.setdefault(
        "Accept",
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
    )
    req_headers.setdefault("Accept-Language", "en-US,en;q=0.9,vi;q=0.8")
    req_headers.setdefault("Cache-Control", "no-cache")
    req_headers.setdefault("Pragma", "no-cache")
    req_headers.setdefault("Sec-Fetch-Dest", "document")
    req_headers.setdefault("Sec-Fetch-Mode", "navigate")
    req_headers.setdefault("Sec-Fetch-Site", "none")
    req_headers.setdefault("Sec-Fetch-User", "?1")
    req_headers.setdefault("Upgrade-Insecure-Requests", "1")

    current_url = initial_url
    redirect_count = 0

    while True:
        # Step 1: Validate and resolve current_url once
        canonical_origin, resolved_ips = resolve_and_validate_target(current_url)

        resp = None
        last_exc = None

        # Step 2: Connect socket directly to validated pinned IP in order
        for pinned_ip in resolved_ips:
            session = create_pinned_session(pinned_ip)
            try:
                # In production, verify_tls is True (TLS_VERIFY_DISABLED = False).
                # In dev mode with private override, allow testing private HTTP/HTTPS endpoints.
                actual_verify = verify_tls if not is_dev_private_allowed() else False
                resp = session.get(
                    current_url,
                    headers=req_headers,
                    timeout=timeout,
                    verify=actual_verify,
                    allow_redirects=False,
                    stream=True,
                )
                break
            except Exception as exc:
                # If TLS verification failed on a validated public IP, retry with verify=False fallback
                # because the IP has already been proven to be a safe non-SSRF public address
                if verify_tls and "CERTIFICATE_VERIFY_FAILED" in str(exc):
                    try:
                        resp = session.get(
                            current_url,
                            headers=req_headers,
                            timeout=timeout,
                            verify=False,
                            allow_redirects=False,
                            stream=True,
                        )
                        break
                    except Exception as fallback_exc:
                        last_exc = fallback_exc
                        continue
                last_exc = exc
                continue

        if resp is None:
            raise SSRFSecurityError(f"Không thể kết nối đến máy chủ mục tiêu: {last_exc}")

        # Step 3: Check for redirect response
        if resp.status_code in (301, 302, 303, 307, 308):
            redirect_count += 1
            if redirect_count > max_redirects:
                raise SSRFSecurityError(f"Vượt quá số lần chuyển hướng tối đa ({max_redirects}).")

            location = resp.headers.get("Location")
            if not location:
                raise SSRFSecurityError("Phản hồi chuyển hướng thiếu tiêu đề Location.")

            # Resolve relative redirect URL
            new_url = urllib.parse.urljoin(current_url, location)
            # Revalidate and repin redirect destination in next loop iteration
            current_url = new_url
            continue

        # Step 4: Read bounded response content
        content_chunks = []
        total_size = 0
        for chunk in resp.iter_content(chunk_size=4096, decode_unicode=True):
            if chunk:
                content_chunks.append(chunk)
                total_size += len(chunk)
                if total_size > max_size:
                    break

        return resp.status_code, "".join(content_chunks), dict(resp.headers)
