"""
Canonical Security Controls Registry for ADQ Scanner.
Defines all 19 auditable security controls, mapping each to its engine stage, OWASP category, CWEs,
and clear Vietnamese terminology.
"""

from typing import Dict, List, Optional, Any
from pydantic import BaseModel, Field


class SecurityControl(BaseModel):
    id: str
    code: str
    title: str
    title_vi: str
    category: str
    stage_id: str
    stage_name: str
    description: str
    description_vi: str
    severity_if_failed: str
    owasp_category: str
    cwe_ids: List[str] = Field(default_factory=list)
    minimum_tier: str = "FREE"  # FREE, PRO, PRO_MAX
    remediation_guide: str
    remediation_code_snippet: Optional[str] = None


SECURITY_CONTROLS_REGISTRY: Dict[str, SecurityControl] = {
    # =========================================================================
    # STAGE 1: RECON & INFRASTRUCTURE (recon_infra)
    # =========================================================================
    "SURFACE-OPEN-PORT": SecurityControl(
        id="SURFACE-OPEN-PORT",
        code="SEC-INFRA-01",
        title="Unnecessary Exposed Open Ports",
        title_vi="Kiểm tra Port công khai",
        category="INFRASTRUCTURE",
        stage_id="recon_infra",
        stage_name="Khám phá mục tiêu (RECON)",
        description="Scans for non-essential ports exposed to the public internet (e.g. database, caching, SSH, remote management).",
        description_vi="Quét và phát hiện các port dịch vụ không cần thiết mở ra internet như Database, Redis, SSH.",
        severity_if_failed="HIGH",
        owasp_category="A05:2021-Security Misconfiguration",
        cwe_ids=["CWE-200", "CWE-1188"],
        minimum_tier="FREE",
        remediation_guide="Đóng các cổng dịch vụ nội bộ khỏi internet công cộng qua tường lửa.",
    ),
    "SURFACE-EXPOSED-SERVICES": SecurityControl(
        id="SURFACE-EXPOSED-SERVICES",
        code="SEC-INFRA-02",
        title="Exposed Management & Internal Services",
        title_vi="Kiểm tra dịch vụ quản trị & Banner",
        category="INFRASTRUCTURE",
        stage_id="recon_infra",
        stage_name="Khám phá mục tiêu (RECON)",
        description="Verifies that internal daemon banners, debug ports, or management interfaces are not directly reachable.",
        description_vi="Kiểm tra các dịch vụ nội bộ, cổng debug hoặc thông tin phiên bản máy chủ bị lộ.",
        severity_if_failed="MEDIUM",
        owasp_category="A05:2021-Security Misconfiguration",
        cwe_ids=["CWE-200"],
        minimum_tier="FREE",
        remediation_guide="Ẩn banner Server/X-Powered-By trên web server và proxy.",
    ),
    "DNS-SECURITY": SecurityControl(
        id="DNS-SECURITY",
        code="SEC-INFRA-03",
        title="DNS Zone & Subdomain Hygiene",
        title_vi="Kiểm tra cấu hình DNS & Subdomain",
        category="INFRASTRUCTURE",
        stage_id="recon_infra",
        stage_name="Khám phá mục tiêu (RECON)",
        description="Analyzes DNS records, dangling CNAMEs (Subdomain Takeover risk), and subdomain enumeration posture.",
        description_vi="Kiểm tra bản ghi DNS và subdomain để tìm cấu hình bất thường hoặc nguy cơ chiếm quyền subdomain.",
        severity_if_failed="HIGH",
        owasp_category="A05:2021-Security Misconfiguration",
        cwe_ids=["CWE-1035", "CWE-284"],
        minimum_tier="FREE",
        remediation_guide="Xóa các bản ghi CNAME trỏ về dịch vụ SaaS/S3 bucket đã ngưng sử dụng.",
    ),

    # =========================================================================
    # STAGE 2: WEB ATTACK SURFACE MAPPING (web_mapping)
    # =========================================================================
    "SURFACE-API-DOCS": SecurityControl(
        id="SURFACE-API-DOCS",
        code="SEC-SURF-01",
        title="Exposed API Documentation & Schemas",
        title_vi="Kiểm tra API Docs / OpenAPI",
        category="ATTACK_SURFACE",
        stage_id="web_mapping",
        stage_name="Lập bản đồ website (WEB MAPPING)",
        description="Checks for public exposure of interactive Swagger UI, OpenAPI JSON, Redoc, or GraphQL introspection schemas.",
        description_vi="Kiểm tra tài liệu Swagger, OpenAPI spec hoặc GraphQL schema có bị công khai trên production.",
        severity_if_failed="MEDIUM",
        owasp_category="A01:2021-Broken Access Control",
        cwe_ids=["CWE-200", "CWE-651"],
        minimum_tier="FREE",
        remediation_guide="Vô hiệu hóa Swagger UI và GraphQL Introspection trên môi trường production.",
    ),
    "SURFACE-SENSITIVE-PATH": SecurityControl(
        id="SURFACE-SENSITIVE-PATH",
        code="SEC-SURF-02",
        title="Exposed Admin & Sensitive System Paths",
        title_vi="Kiểm tra đường dẫn nhạy cảm / Admin",
        category="ATTACK_SURFACE",
        stage_id="web_mapping",
        stage_name="Lập bản đồ website (WEB MAPPING)",
        description="Detects public reachability of administrator consoles, debug endpoints, phpinfo, or internal status dashboards.",
        description_vi="Phát hiện các endpoint quản trị hoặc debug như /admin, /actuator, /server-status mở không cần xác thực.",
        severity_if_failed="HIGH",
        owasp_category="A01:2021-Broken Access Control",
        cwe_ids=["CWE-284", "CWE-200"],
        minimum_tier="FREE",
        remediation_guide="Chặn truy cập vào đường dẫn quản trị từ internet công cộng qua Reverse Proxy.",
    ),
    "WAF-DETECTION": SecurityControl(
        id="WAF-DETECTION",
        code="SEC-SURF-03",
        title="WAF & Edge Defense Posture",
        title_vi="Kiểm tra WAF",
        category="ATTACK_SURFACE",
        stage_id="web_mapping",
        stage_name="Lập bản đồ website (WEB MAPPING)",
        description="Identifies fronting WAF/CDN layers (Cloudflare, AWS WAF, Vercel, Akamai) and evaluates standard inspection behavior.",
        description_vi="Nhận diện lớp tường lửa WAF/CDN bảo vệ website và kiểm tra hành vi phản hồi.",
        severity_if_failed="INFO",
        owasp_category="A05:2021-Security Misconfiguration",
        cwe_ids=["CWE-693"],
        minimum_tier="FREE",
        remediation_guide="Kích hoạt Managed Rulesets trên WAF và chặn lưu lượng trỏ trực tiếp vào Origin IP.",
    ),
    "CLIENT-JS-SECRETS": SecurityControl(
        id="CLIENT-JS-SECRETS",
        code="SEC-SURF-04",
        title="Client-side JS Secrets & Token Exposure",
        title_vi="Kiểm tra Secret / API Token trong Frontend",
        category="ATTACK_SURFACE",
        stage_id="web_mapping",
        stage_name="Lập bản đồ website (WEB MAPPING)",
        description="Deep-analyzes client JavaScript bundles for leaked private API keys, cloud tokens, database URLs, and unstripped source maps.",
        description_vi="Phân tích mã JavaScript frontend để tìm API key, token bí mật hoặc source map bị lộ.",
        severity_if_failed="CRITICAL",
        owasp_category="A05:2021-Security Misconfiguration",
        cwe_ids=["CWE-798", "CWE-540"],
        minimum_tier="FREE",
        remediation_guide="Tuyệt đối không lưu trữ Secret Keys trong client bundle.",
    ),

    # =========================================================================
    # STAGE 3: ACTIVE DAST (dast_active)
    # =========================================================================
    "WEB-HEADERS-SECURITY": SecurityControl(
        id="WEB-HEADERS-SECURITY",
        code="SEC-DAST-01",
        title="HTTP Security Headers Configuration",
        title_vi="Kiểm tra Security Headers",
        category="ACTIVE_DAST",
        stage_id="dast_active",
        stage_name="Kiểm thử chủ động (ACTIVE DAST)",
        description="Validates presence and correct policies for Strict-Transport-Security (HSTS), Content-Security-Policy (CSP), X-Frame-Options, and X-Content-Type-Options.",
        description_vi="Kiểm tra các tiêu đề bảo mật HTTP như HSTS, CSP, X-Frame-Options, X-Content-Type-Options.",
        severity_if_failed="LOW",
        owasp_category="A05:2021-Security Misconfiguration",
        cwe_ids=["CWE-693", "CWE-1021"],
        minimum_tier="FREE",
        remediation_guide="Thiết lập đầy đủ các security headers trên web server hoặc API gateway.",
    ),
    "WEB-COOKIE-FLAGS": SecurityControl(
        id="WEB-COOKIE-FLAGS",
        code="SEC-DAST-02",
        title="Session & Cookie Security Flags",
        title_vi="Kiểm tra cờ bảo mật Cookie",
        category="ACTIVE_DAST",
        stage_id="dast_active",
        stage_name="Kiểm thử chủ động (ACTIVE DAST)",
        description="Checks whether session and authentication cookies enforce HttpOnly, Secure, and SameSite attributes to prevent cookie theft via XSS/CSRF.",
        description_vi="Kiểm tra các cookie phiên có thiết lập đủ cờ HttpOnly, Secure và SameSite hay không.",
        severity_if_failed="MEDIUM",
        owasp_category="A07:2021-Identification and Authentication Failures",
        cwe_ids=["CWE-614", "CWE-1004", "CWE-1275"],
        minimum_tier="FREE",
        remediation_guide="Cấu hình framework phát hành cookie với đầy đủ các thuộc tính HttpOnly, Secure, và SameSite.",
    ),
    "EXPOSURE-BACKUP-FILES": SecurityControl(
        id="EXPOSURE-BACKUP-FILES",
        code="SEC-DAST-03",
        title="Sensitive Backup & Source Repository Leaks",
        title_vi="Kiểm tra lộ file sao lưu & Git",
        category="ACTIVE_DAST",
        stage_id="dast_active",
        stage_name="Kiểm thử chủ động (ACTIVE DAST)",
        description="Probes for unauthenticated access to .git repository folders, backup archives (.zip, .tar.gz), database dumps (.sql), and temporary editor files.",
        description_vi="Rà quét các file sao lưu như .git, .bak, .sql bị lưu công khai trên web server.",
        severity_if_failed="CRITICAL",
        owasp_category="A05:2021-Security Misconfiguration",
        cwe_ids=["CWE-538", "CWE-530"],
        minimum_tier="FREE",
        remediation_guide="Chặn truy cập vào các file/folder ẩn (.git, .env) và file sao lưu (.bak, .sql).",
    ),
    "EXPOSURE-ENV-SECRETS": SecurityControl(
        id="EXPOSURE-ENV-SECRETS",
        code="SEC-DAST-04",
        title="Environment Variables & Configuration File Leaks",
        title_vi="Kiểm tra file cấu hình .env",
        category="ACTIVE_DAST",
        stage_id="dast_active",
        stage_name="Kiểm thử chủ động (ACTIVE DAST)",
        description="Tests for direct exposure of .env, .env.local, config.json, settings.py, or Docker compose configs containing database credentials or cloud master keys.",
        description_vi="Kiểm tra truy cập trực tiếp vào các file cấu hình chứa thông tin đăng nhập như .env, docker-compose.",
        severity_if_failed="CRITICAL",
        owasp_category="A05:2021-Security Misconfiguration",
        cwe_ids=["CWE-526", "CWE-552"],
        minimum_tier="FREE",
        remediation_guide="Đảm bảo file .env nằm ngoài webroot và không bao giờ được phục vụ tĩnh.",
    ),
    "INPUT-SQLI-BASIC": SecurityControl(
        id="INPUT-SQLI-BASIC",
        code="SEC-DAST-05",
        title="SQL Injection Vulnerability Detection",
        title_vi="Kiểm tra SQL Injection",
        category="ACTIVE_DAST",
        stage_id="dast_active",
        stage_name="Kiểm thử chủ động (ACTIVE DAST)",
        description="Fuzzes input parameters and URL query strings with SQL payloads to detect database error reflection, boolean blind, or time-based injection vulnerabilities.",
        description_vi="Kiểm thử các tham số đầu vào và URL query để phát hiện lỗ hổng cơ sở dữ liệu SQL Injection.",
        severity_if_failed="CRITICAL",
        owasp_category="A03:2021-Injection",
        cwe_ids=["CWE-89"],
        minimum_tier="FREE",
        remediation_guide="Luôn sử dụng Parameterized Queries hoặc ORM chuẩn.",
    ),
    "INPUT-XSS-BASIC": SecurityControl(
        id="INPUT-XSS-BASIC",
        code="SEC-DAST-06",
        title="Cross-Site Scripting (XSS) Posture",
        title_vi="Kiểm tra XSS",
        category="ACTIVE_DAST",
        stage_id="dast_active",
        stage_name="Kiểm thử chủ động (ACTIVE DAST)",
        description="Probes reflected input parameters and responses for unescaped HTML/JavaScript injection, verifying context-aware output encoding.",
        description_vi="Kiểm thử các tham số phản hồi để phát hiện mã HTML/JS không được lọc hoặc mã hóa an toàn.",
        severity_if_failed="HIGH",
        owasp_category="A03:2021-Injection",
        cwe_ids=["CWE-79"],
        minimum_tier="FREE",
        remediation_guide="Thực hiện Context-aware Output Encoding trên mọi dữ liệu người dùng render trên HTML/DOM.",
    ),
    "INPUT-COMMAND-INJECTION": SecurityControl(
        id="INPUT-COMMAND-INJECTION",
        code="SEC-DAST-07",
        title="OS Command & Remote Code Execution Patterns",
        title_vi="Kiểm tra Command Injection (RCE)",
        category="ACTIVE_DAST",
        stage_id="dast_active",
        stage_name="Kiểm thử chủ động (ACTIVE DAST)",
        description="Tests endpoint inputs for shell metacharacters and command separator patterns that could lead to server command execution.",
        description_vi="Kiểm thử các tham số đầu vào với các ký tự shell để ngăn chặn nguy cơ thực thi lệnh từ xa.",
        severity_if_failed="CRITICAL",
        owasp_category="A03:2021-Injection",
        cwe_ids=["CWE-78", "CWE-94"],
        minimum_tier="FREE",
        remediation_guide="Tránh sử dụng shell execution trực tiếp và whitelist đầu vào nghiêm ngặt.",
    ),
    "AUTH-DEFAULT-CREDS": SecurityControl(
        id="AUTH-DEFAULT-CREDS",
        code="SEC-DAST-08",
        title="Default Credentials & Well-Known Logins",
        title_vi="Kiểm tra tài khoản mặc định",
        category="ACTIVE_DAST",
        stage_id="dast_active",
        stage_name="Kiểm thử chủ động (ACTIVE DAST)",
        description="Verifies that administrative portals, databases, or API consoles do not use default manufacturer credentials (admin/admin, root/root).",
        description_vi="Kiểm tra các trang đăng nhập quản trị có sử dụng cặp tài khoản mặc định như admin/admin, root/root.",
        severity_if_failed="CRITICAL",
        owasp_category="A07:2021-Identification and Authentication Failures",
        cwe_ids=["CWE-1392", "CWE-798"],
        minimum_tier="FREE",
        remediation_guide="Bắt buộc đổi mật khẩu mặc định ngay khi khởi tạo hệ thống.",
    ),
    "SSL-TLS-CONFIGURATION": SecurityControl(
        id="SSL-TLS-CONFIGURATION",
        code="SEC-DAST-09",
        title="SSL/TLS Configuration & Certificate Validity",
        title_vi="Kiểm tra cấu hình SSL/TLS",
        category="ACTIVE_DAST",
        stage_id="dast_active",
        stage_name="Kiểm thử chủ động (ACTIVE DAST)",
        description="Checks SSL/TLS certificate validity, expiration date, self-signed status, and ensures TLS 1.2+ minimum enforcement.",
        description_vi="Kiểm tra chứng chỉ SSL/TLS có hợp lệ, còn hạn và bắt buộc phiên bản TLS 1.2 trở lên.",
        severity_if_failed="HIGH",
        owasp_category="A02:2021-Cryptographic Failures",
        cwe_ids=["CWE-295", "CWE-326"],
        minimum_tier="FREE",
        remediation_guide="Sử dụng chứng chỉ CA hợp lệ và chỉ cho phép TLS 1.2 và TLS 1.3.",
    ),

    # =========================================================================
    # STAGE 4: DEEP LOGIC & API INTEGRITY (deep_logic - PRO / PRO_MAX)
    # =========================================================================
    "LOGIC-AUTH-BYPASS": SecurityControl(
        id="LOGIC-AUTH-BYPASS",
        code="SEC-LOGIC-01",
        title="Business Logic & Auth State Tampering",
        title_vi="Kiểm tra Logic & IDOR",
        category="DEEP_LOGIC",
        stage_id="deep_logic",
        stage_name="Kiểm tra logic & API (DEEP LOGIC)",
        description="Evaluates session token replay, privilege escalation vectors, IDOR/BOLA patterns across stateful multi-step API flows.",
        description_vi="Đánh giá nguy cơ leo thang đặc quyền, giả mạo IDOR/BOLA và vượt quyền trong các API nhiều bước.",
        severity_if_failed="CRITICAL",
        owasp_category="A01:2021-Broken Access Control",
        cwe_ids=["CWE-639", "CWE-285", "CWE-862"],
        minimum_tier="PRO",
        remediation_guide="Xác thực quyền sở hữu tài nguyên ở mọi tầng backend dựa trên session identity.",
    ),
    "PARAM-TAMPERING": SecurityControl(
        id="PARAM-TAMPERING",
        code="SEC-LOGIC-02",
        title="Parameter Pollution & Rate-Limit Resistance",
        title_vi="Kiểm tra ô nhiễm tham số & Rate Limit",
        category="DEEP_LOGIC",
        stage_id="deep_logic",
        stage_name="Kiểm tra logic & API (DEEP LOGIC)",
        description="Tests parameter pollution (HTTP Parameter Pollution), array wrapping anomalies, and endpoint rate-limiting mechanisms under concurrent stress.",
        description_vi="Kiểm thử lỗi ô nhiễm tham số (HPP) và cơ chế giới hạn tần suất (Rate Limiting) trên các endpoint.",
        severity_if_failed="MEDIUM",
        owasp_category="A04:2021-Insecure Design",
        cwe_ids=["CWE-235", "CWE-770"],
        minimum_tier="PRO",
        remediation_guide="Chuẩn hóa bộ xử lý tham số và kích hoạt Rate Limiting theo IP / Token.",
    ),
    "CORS-MISCONFIG": SecurityControl(
        id="CORS-MISCONFIG",
        code="SEC-LOGIC-03",
        title="Cross-Origin Resource Sharing (CORS) Policy",
        title_vi="Kiểm tra cấu hình CORS",
        category="DEEP_LOGIC",
        stage_id="deep_logic",
        stage_name="Kiểm tra logic & API (DEEP LOGIC)",
        description="Checks for overly permissive CORS headers (Access-Control-Allow-Origin: * or null with Allow-Credentials: true) enabling data exfiltration.",
        description_vi="Kiểm tra chính sách CORS có cho phép origin bất kỳ hoặc phản chiếu tùy ý kèm credentials.",
        severity_if_failed="HIGH",
        owasp_category="A05:2021-Security Misconfiguration",
        cwe_ids=["CWE-942"],
        minimum_tier="FREE",
        remediation_guide="Chỉ định danh sách origin được phép (Whitelist) tường minh.",
    ),
}


def get_control_by_id(control_id: str) -> Optional[SecurityControl]:
    return SECURITY_CONTROLS_REGISTRY.get(control_id)


def list_all_controls() -> List[SecurityControl]:
    return list(SECURITY_CONTROLS_REGISTRY.values())
