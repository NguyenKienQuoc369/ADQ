"""
Canonical Security Controls Registry for ADQ Scanner.
Defines all auditable security controls, mapping each to its engine stage, OWASP category, CWEs,
and actionable remediation guides.
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
        title_vi="Kiểm soát Cổng Dịch vụ Công khai",
        category="INFRASTRUCTURE",
        stage_id="recon_infra",
        stage_name="Hạ tầng & Khám phá (Recon)",
        description="Scans for non-essential ports exposed to the public internet (e.g. database, caching, SSH, remote management).",
        description_vi="Quét và phát hiện các cổng dịch vụ nhạy cảm không cần thiết mở ra internet công cộng (DB, Redis, SSH, Telnet).",
        severity_if_failed="HIGH",
        owasp_category="A05:2021-Security Misconfiguration",
        cwe_ids=["CWE-200", "CWE-1188"],
        minimum_tier="FREE",
        remediation_guide="Đóng các cổng dịch vụ nội bộ (như 5432, 6379, 3306, 27017, 22) khỏi public internet. Sử dụng tường lửa (UFW/AWS Security Groups) và thiết lập VPN/Tailscale để truy cập quản trị.",
        remediation_code_snippet="""# UFW Firewall Rule Example
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw allow from <TRUSTED_IP> to any port 22 proto tcp
sudo ufw enable"""
    ),
    "SURFACE-EXPOSED-SERVICES": SecurityControl(
        id="SURFACE-EXPOSED-SERVICES",
        code="SEC-INFRA-02",
        title="Exposed Management & Internal Services",
        title_vi="Bảo vệ Dịch vụ Quản trị & Hạ tầng Nội bộ",
        category="INFRASTRUCTURE",
        stage_id="recon_infra",
        stage_name="Hạ tầng & Khám phá (Recon)",
        description="Verifies that internal daemon banners, debug ports, or management interfaces are not directly reachable.",
        description_vi="Xác thực các dịch vụ quản trị, daemon nội bộ và thông tin banner máy chủ không bị lộ ra bên ngoài.",
        severity_if_failed="MEDIUM",
        owasp_category="A05:2021-Security Misconfiguration",
        cwe_ids=["CWE-200"],
        minimum_tier="FREE",
        remediation_guide="Ẩn banner Server/X-Powered-By trên web server và proxy. Đặt các trang quản trị nội bộ sau lớp xác thực Gateway hoặc VPN.",
        remediation_code_snippet="""# Nginx - Hide Server Tokens
server_tokens off;
proxy_hide_header X-Powered-By;"""
    ),
    "DNS-SECURITY": SecurityControl(
        id="DNS-SECURITY",
        code="SEC-INFRA-03",
        title="DNS Zone & Subdomain Hygiene",
        title_vi="Vệ sinh Cấu hình DNS & Tên miền phụ",
        category="INFRASTRUCTURE",
        stage_id="recon_infra",
        stage_name="Hạ tầng & Khám phá (Recon)",
        description="Analyzes DNS records, dangling CNAMEs (Subdomain Takeover risk), and subdomain enumeration posture.",
        description_vi="Phân tích bản ghi DNS, phát hiện tên miền phụ mồ côi (nguy cơ Subdomain Takeover) và rà soát các hostname phụ.",
        severity_if_failed="HIGH",
        owasp_category="A05:2021-Security Misconfiguration",
        cwe_ids=["CWE-1035", "CWE-284"],
        minimum_tier="FREE",
        remediation_guide="Xóa các bản ghi CNAME trỏ về dịch vụ SaaS/S3 bucket đã ngưng sử dụng để ngăn chặn rủi ro Subdomain Takeover. Kích hoạt DNSSEC.",
        remediation_code_snippet="""# Kiểm tra định kỳ bản ghi CNAME và xóa các CNAME trỏ về host không còn active:
dig +trace subdomain.example.com CNAME"""
    ),

    # =========================================================================
    # STAGE 2: WEB ATTACK SURFACE MAPPING (web_mapping)
    # =========================================================================
    "SURFACE-API-DOCS": SecurityControl(
        id="SURFACE-API-DOCS",
        code="SEC-SURF-01",
        title="Exposed API Documentation & Schemas",
        title_vi="Kiểm soát Tài liệu API & OpenAPI Schema",
        category="ATTACK_SURFACE",
        stage_id="web_mapping",
        stage_name="Lập bản đồ Bề mặt Tấn công (Web Mapping)",
        description="Checks for public exposure of interactive Swagger UI, OpenAPI JSON, Redoc, or GraphQL introspection schemas.",
        description_vi="Kiểm tra xem các tài liệu API tương tác (Swagger, OpenAPI spec, GraphQL Playground) có bị công khai trên môi trường production hay không.",
        severity_if_failed="MEDIUM",
        owasp_category="A01:2021-Broken Access Control",
        cwe_ids=["CWE-200", "CWE-651"],
        minimum_tier="FREE",
        remediation_guide="Vô hiệu hóa Swagger UI và GraphQL Introspection trên production, hoặc yêu cầu xác thực vai trò Admin/Developer trước khi truy cập.",
        remediation_code_snippet="""# FastAPI - Disable docs in production
import os
from fastapi import FastAPI

is_prod = os.getenv("ENVIRONMENT") == "production"
app = FastAPI(
    docs_url=None if is_prod else "/docs",
    redoc_url=None if is_prod else "/redoc",
    openapi_url=None if is_prod else "/openapi.json"
)"""
    ),
    "SURFACE-SENSITIVE-PATH": SecurityControl(
        id="SURFACE-SENSITIVE-PATH",
        code="SEC-SURF-02",
        title="Exposed Admin & Sensitive System Paths",
        title_vi="Bảo vệ Đường dẫn Quản trị & Hệ thống Nhạy cảm",
        category="ATTACK_SURFACE",
        stage_id="web_mapping",
        stage_name="Lập bản đồ Bề mặt Tấn công (Web Mapping)",
        description="Detects public reachability of administrator consoles, debug endpoints, phpinfo, or internal status dashboards.",
        description_vi="Phát hiện các endpoint quản trị (/admin, /wp-admin, /actuator, /server-status, /debug) có thể truy cập không cần xác thực.",
        severity_if_failed="HIGH",
        owasp_category="A01:2021-Broken Access Control",
        cwe_ids=["CWE-284", "CWE-200"],
        minimum_tier="FREE",
        remediation_guide="Chặn truy cập vào đường dẫn quản trị từ internet công cộng qua Reverse Proxy hoặc áp dụng xác thực 2 lớp (MFA/IP Whitelisting).",
        remediation_code_snippet="""# Nginx - Restrict /admin access to internal IP only
location /admin {
    allow 192.168.1.0/24;
    allow 10.0.0.0/8;
    deny all;
    proxy_pass http://backend_upstream;
}"""
    ),
    "WAF-DETECTION": SecurityControl(
        id="WAF-DETECTION",
        code="SEC-SURF-03",
        title="WAF & Edge Defense Posture",
        title_vi="Nhận diện & Tư thế Tường lửa Ứng dụng Web (WAF)",
        category="ATTACK_SURFACE",
        stage_id="web_mapping",
        stage_name="Lập bản đồ Bề mặt Tấn công (Web Mapping)",
        description="Identifies fronting WAF/CDN layers (Cloudflare, AWS WAF, Vercel, Akamai) and evaluates standard inspection behavior.",
        description_vi="Nhận diện lớp WAF/CDN bảo vệ biên và đánh giá cấu hình phản hồi để đảm bảo lưu lượng độc hại bị chặn đúng cách.",
        severity_if_failed="INFO",
        owasp_category="A05:2021-Security Misconfiguration",
        cwe_ids=["CWE-693"],
        minimum_tier="FREE",
        remediation_guide="Kích hoạt Managed Rulesets trên WAF (OWASP Core Rule Set, SQLi/XSS prevention, Bot Protection) và chặn lưu lượng trỏ trực tiếp vào Origin IP.",
        remediation_code_snippet="""# Đảm bảo Origin Server chỉ chấp nhận traffic từ CDN/WAF IPs
# (Ví dụ: cấu hình Cloudflare Authenticated Origin Pulls)"""
    ),
    "CLIENT-JS-SECRETS": SecurityControl(
        id="CLIENT-JS-SECRETS",
        code="SEC-SURF-04",
        title="Client-side JS Secrets & Token Exposure",
        title_vi="Kiểm tra Lộ Secret & API Token trong Frontend JS",
        category="ATTACK_SURFACE",
        stage_id="web_mapping",
        stage_name="Lập bản đồ Bề mặt Tấn công (Web Mapping)",
        description="Deep-analyzes client JavaScript bundles for leaked private API keys, cloud tokens, database URLs, and unstripped source maps.",
        description_vi="Phân tích sâu mã nguồn JS phía client để phát hiện API key bí mật, token private, chuỗi kết nối DB và source map chưa gỡ bỏ.",
        severity_if_failed="CRITICAL",
        owasp_category="A05:2021-Security Misconfiguration",
        cwe_ids=["CWE-798", "CWE-540"],
        minimum_tier="FREE",
        remediation_guide="Tuyệt đối không lưu trữ Secret Keys (DB passwords, Stripe Private Key, AWS Secret) trong client bundle. Chỉ dùng biến môi trường server-side và tắt source map trên production build.",
        remediation_code_snippet="""// next.config.js - Production Source Map Hygiene
module.exports = {
  productionBrowserSourceMaps: false,
  // Đảm bảo không expose biến môi trường bí mật qua NEXT_PUBLIC_
};"""
    ),

    # =========================================================================
    # STAGE 3: ACTIVE DAST (dast_active)
    # =========================================================================
    "WEB-HEADERS-SECURITY": SecurityControl(
        id="WEB-HEADERS-SECURITY",
        code="SEC-DAST-01",
        title="HTTP Security Headers Configuration",
        title_vi="Cấu hình Tiêu đề Bảo mật HTTP (HSTS, CSP, XFO)",
        category="ACTIVE_DAST",
        stage_id="dast_active",
        stage_name="Kiểm thử Động (Active DAST)",
        description="Validates presence and correct policies for Strict-Transport-Security (HSTS), Content-Security-Policy (CSP), X-Frame-Options, and X-Content-Type-Options.",
        description_vi="Xác thực các tiêu đề bảo mật HTTP thiết yếu: HSTS, CSP chống XSS/data injection, X-Frame-Options chống Clickjacking, X-Content-Type-Options chống MIME-sniffing.",
        severity_if_failed="LOW",
        owasp_category="A05:2021-Security Misconfiguration",
        cwe_ids=["CWE-693", "CWE-1021"],
        minimum_tier="FREE",
        remediation_guide="Thiết lập đầy đủ các security headers trên web server hoặc API gateway.",
        remediation_code_snippet="""# Nginx Security Headers
add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
add_header X-Frame-Options "SAMEORIGIN" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self'; object-src 'none';" always;"""
    ),
    "WEB-COOKIE-FLAGS": SecurityControl(
        id="WEB-COOKIE-FLAGS",
        code="SEC-DAST-02",
        title="Session & Cookie Security Flags",
        title_vi="Cờ Bảo mật Cookie & Phiên Đăng nhập (Secure, HttpOnly, SameSite)",
        category="ACTIVE_DAST",
        stage_id="dast_active",
        stage_name="Kiểm thử Động (Active DAST)",
        description="Checks whether session and authentication cookies enforce HttpOnly, Secure, and SameSite attributes to prevent cookie theft via XSS/CSRF.",
        description_vi="Kiểm tra các cookie phiên đăng nhập có áp dụng đầy đủ cờ HttpOnly (chống đọc qua JS), Secure (chỉ gửi qua HTTPS), và SameSite=Lax/Strict (chống CSRF).",
        severity_if_failed="MEDIUM",
        owasp_category="A07:2021-Identification and Authentication Failures",
        cwe_ids=["CWE-614", "CWE-1004", "CWE-1275"],
        minimum_tier="FREE",
        remediation_guide="Cấu hình framework phát hành cookie với đầy đủ các thuộc tính HttpOnly=True, Secure=True, SameSite='Lax' hoặc 'Strict'.",
        remediation_code_snippet="""# FastAPI / Starlette Cookie Example
response.set_cookie(
    key="session_token",
    value=token,
    httponly=True,
    secure=True,
    samesite="lax",
    max_age=3600
)"""
    ),
    "EXPOSURE-BACKUP-FILES": SecurityControl(
        id="EXPOSURE-BACKUP-FILES",
        code="SEC-DAST-03",
        title="Sensitive Backup & Source Repository Leaks",
        title_vi="Lộ File Sao lưu (.bak, .sql) & Kho Mã nguồn (.git)",
        category="ACTIVE_DAST",
        stage_id="dast_active",
        stage_name="Kiểm thử Động (Active DAST)",
        description="Probes for unauthenticated access to .git repository folders, backup archives (.zip, .tar.gz), database dumps (.sql), and temporary editor files.",
        description_vi="Rà quét các file sao lưu nguy hiểm (.git/HEAD, database.sql, backup.zip, web.config.bak) bị lộ công khai trên webroot.",
        severity_if_failed="CRITICAL",
        owasp_category="A05:2021-Security Misconfiguration",
        cwe_ids=["CWE-538", "CWE-530"],
        minimum_tier="FREE",
        remediation_guide="Chặn truy cập vào các file/folder ẩn (.git, .env, .svn) và các định dạng file sao lưu (.bak, .sql, .dump, .old) trên Web Server.",
        remediation_code_snippet=r"""# Nginx - Deny access to hidden files and backup archives
location ~* /\.(?!well-known) {
    deny all;
    return 404;
}
location ~* \.(bak|config|sql|fla|psd|ini|log|sh|inc|swp|dist|env)$ {
    deny all;
    return 404;
}"""
    ),
    "EXPOSURE-ENV-SECRETS": SecurityControl(
        id="EXPOSURE-ENV-SECRETS",
        code="SEC-DAST-04",
        title="Environment Variables & Configuration File Leaks",
        title_vi="Lộ Biến Môi trường & File Cấu hình Hệ thống (.env)",
        category="ACTIVE_DAST",
        stage_id="dast_active",
        stage_name="Kiểm thử Động (Active DAST)",
        description="Tests for direct exposure of .env, .env.local, config.json, settings.py, or Docker compose configs containing database credentials or cloud master keys.",
        description_vi="Kiểm thử truy cập trực tiếp các file chứa thông tin đăng nhập tối mật: .env, .env.production, docker-compose.yml, server.conf.",
        severity_if_failed="CRITICAL",
        owasp_category="A05:2021-Security Misconfiguration",
        cwe_ids=["CWE-526", "CWE-552"],
        minimum_tier="FREE",
        remediation_guide="Đảm bảo file .env nằm ngoài webroot và không bao giờ được phục vụ tĩnh. Thêm rule từ chối tuyệt đối trên reverse proxy.",
        remediation_code_snippet="""# Caddyfile Example
@denied_files {
    path */.env*
    path */*.sql
    path */.git*
}
error @denied_files 404"""
    ),
    "INPUT-SQLI-BASIC": SecurityControl(
        id="INPUT-SQLI-BASIC",
        code="SEC-DAST-05",
        title="SQL Injection Vulnerability Detection",
        title_vi="Kiểm tra Lỗ hổng Tiêm lệnh Cơ sở Dữ liệu (SQL Injection)",
        category="ACTIVE_DAST",
        stage_id="dast_active",
        stage_name="Kiểm thử Động (Active DAST)",
        description="Fuzzes input parameters and URL query strings with SQL payloads to detect database error reflection, boolean blind, or time-based injection vulnerabilities.",
        description_vi="Kiểm thử tham số đầu vào và chuỗi truy vấn với các mẫu SQL Injection (Error-based, Boolean-based, Time-based) để phát hiện lỗ hổng cơ sở dữ liệu.",
        severity_if_failed="CRITICAL",
        owasp_category="A03:2021-Injection",
        cwe_ids=["CWE-89"],
        minimum_tier="FREE",
        remediation_guide="Luôn sử dụng Parameterized Queries (Prepared Statements) hoặc ORM chuẩn (Prisma, SQLAlchemy, Hibernate). Không bao giờ ghép chuỗi SQL trực tiếp từ user input.",
        remediation_code_snippet="""# SQLAlchemy Parameterized Query (Secure)
stmt = select(User).where(User.username == username_param)
result = db.session.execute(stmt).scalars().first()"""
    ),
    "INPUT-XSS-BASIC": SecurityControl(
        id="INPUT-XSS-BASIC",
        code="SEC-DAST-06",
        title="Cross-Site Scripting (XSS) Posture",
        title_vi="Kiểm thử Chống Tấn công Kịch bản Liên trang (XSS)",
        category="ACTIVE_DAST",
        stage_id="dast_active",
        stage_name="Kiểm thử Động (Active DAST)",
        description="Probes reflected input parameters and responses for unescaped HTML/JavaScript injection, verifying context-aware output encoding.",
        description_vi="Kiểm thử các tham số phản hồi để phát hiện mã HTML/JavaScript không được escape hoặc sanitize, ngăn chặn đánh cắp phiên đăng nhập.",
        severity_if_failed="HIGH",
        owasp_category="A03:2021-Injection",
        cwe_ids=["CWE-79"],
        minimum_tier="FREE",
        remediation_guide="Thực hiện Context-aware Output Encoding trên mọi dữ liệu người dùng render trên HTML/DOM. Sử dụng Content Security Policy (CSP) chặt chẽ và thư viện DOMPurify.",
        remediation_code_snippet="""// Frontend Sanitization Example (React / DOMPurify)
import DOMPurify from 'dompurify';

export function SafeHTML({ content }: { content: string }) {
  const clean = DOMPurify.sanitize(content);
  return <div dangerouslySetInnerHTML={{ __html: clean }} />;
}"""
    ),
    "INPUT-COMMAND-INJECTION": SecurityControl(
        id="INPUT-COMMAND-INJECTION",
        code="SEC-DAST-07",
        title="OS Command & Remote Code Execution Patterns",
        title_vi="Kiểm tra Lỗ hổng Thực thi Lệnh Hệ điều hành (RCE)",
        category="ACTIVE_DAST",
        stage_id="dast_active",
        stage_name="Kiểm thử Động (Active DAST)",
        description="Tests endpoint inputs for shell metacharacters and command separator patterns that could lead to server command execution.",
        description_vi="Kiểm tra các endpoint nhận tham số hệ thống để ngăn ngừa việc thực thi lệnh tùy ý trên máy chủ qua shell metacharacters.",
        severity_if_failed="CRITICAL",
        owasp_category="A03:2021-Injection",
        cwe_ids=["CWE-78", "CWE-94"],
        minimum_tier="FREE",
        remediation_guide="Tránh sử dụng shell execution (exec, system, eval, popen). Nếu bắt buộc, sử dụng API nhận danh sách đối số trực tiếp không qua shell và whitelist đầu vào nghiêm ngặt.",
        remediation_code_snippet="""# Python Secure Subprocess (No shell=True)
import subprocess

# Secure: Pass arguments as a list, never string concatenation with shell=True
subprocess.run(["ping", "-c", "1", validated_host], shell=False, check=True)"""
    ),
    "AUTH-DEFAULT-CREDS": SecurityControl(
        id="AUTH-DEFAULT-CREDS",
        code="SEC-DAST-08",
        title="Default Credentials & Well-Known Logins",
        title_vi="Kiểm tra Tài khoản & Mật khẩu Mặc định Hệ thống",
        category="ACTIVE_DAST",
        stage_id="dast_active",
        stage_name="Kiểm thử Động (Active DAST)",
        description="Verifies that administrative portals, databases, or API consoles do not use default manufacturer credentials (admin/admin, root/root).",
        description_vi="Xác thực các cổng đăng nhập quản trị và cơ sở dữ liệu không dùng cặp tài khoản mặc định nguy hiểm.",
        severity_if_failed="CRITICAL",
        owasp_category="A07:2021-Identification and Authentication Failures",
        cwe_ids=["CWE-1392", "CWE-798"],
        minimum_tier="FREE",
        remediation_guide="Bắt buộc đổi mật khẩu mặc định ngay khi khởi tạo hệ thống. Áp dụng chính sách mật khẩu mạnh và khóa tài khoản khi nhập sai nhiều lần.",
        remediation_code_snippet="""# Đảm bảo tắt tài khoản test/mặc định trong cơ sở dữ liệu production"""
    ),
    "SSL-TLS-CONFIGURATION": SecurityControl(
        id="SSL-TLS-CONFIGURATION",
        code="SEC-DAST-09",
        title="SSL/TLS Configuration & Certificate Validity",
        title_vi="Cấu hình Mã hóa SSL/TLS & Tính hợp lệ Chứng chỉ",
        category="ACTIVE_DAST",
        stage_id="dast_active",
        stage_name="Kiểm thử Động (Active DAST)",
        description="Checks SSL/TLS certificate validity, expiration date, self-signed status, and ensures TLS 1.2+ minimum enforcement.",
        description_vi="Kiểm tra chứng chỉ SSL/TLS có hợp lệ, còn hạn, không phải self-signed và bắt buộc giao thức TLS 1.2 trở lên.",
        severity_if_failed="HIGH",
        owasp_category="A02:2021-Cryptographic Failures",
        cwe_ids=["CWE-295", "CWE-326"],
        minimum_tier="FREE",
        remediation_guide="Sử dụng chứng chỉ CA hợp lệ (Let's Encrypt / DigiCert), cấu hình chuyển hướng HTTP sang HTTPS và chỉ cho phép TLS 1.2 và TLS 1.3.",
        remediation_code_snippet="""# Nginx Modern TLS Configuration
ssl_protocols TLSv1.2 TLSv1.3;
ssl_prefer_server_ciphers on;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;"""
    ),

    # =========================================================================
    # STAGE 4: DEEP LOGIC & API INTEGRITY (deep_logic - PRO / PRO_MAX)
    # =========================================================================
    "LOGIC-AUTH-BYPASS": SecurityControl(
        id="LOGIC-AUTH-BYPASS",
        code="SEC-LOGIC-01",
        title="Business Logic & Auth State Tampering",
        title_vi="Kiểm thử Logic Nghiệp vụ & Bẻ khóa Phiên Xác thực",
        category="DEEP_LOGIC",
        stage_id="deep_logic",
        stage_name="Logic Chuyên sâu & API (Deep Logic)",
        description="Evaluates session token replay, privilege escalation vectors, IDOR/BOLA patterns across stateful multi-step API flows.",
        description_vi="Đánh giá khả năng leo thang đặc quyền, giả mạo IDOR/BOLA và vượt qua kiểm soát phân quyền trong luồng nghiệp vụ nhiều bước.",
        severity_if_failed="CRITICAL",
        owasp_category="A01:2021-Broken Access Control",
        cwe_ids=["CWE-639", "CWE-285", "CWE-862"],
        minimum_tier="PRO",
        remediation_guide="Xác thực quyền sở hữu tài nguyên ở mọi tầng backend dựa trên session identity của người dùng hiện tại, không tin tưởng ID truyền từ client.",
        remediation_code_snippet="""# FastAPI - Authoritative Resource Ownership Check
@app.get("/api/documents/{doc_id}")
def get_document(doc_id: str, current_user: User = Depends(get_current_user)):
    doc = db.query(Document).filter(Document.id == doc_id).first()
    if not doc or doc.owner_id != current_user.id:
        raise HTTPException(status_code=404, detail="Document not found")
    return doc"""
    ),
    "PARAM-TAMPERING": SecurityControl(
        id="PARAM-TAMPERING",
        code="SEC-LOGIC-02",
        title="Parameter Pollution & Rate-Limit Resistance",
        title_vi="Kiểm soát Ô nhiễm Tham số (HPP) & Khả năng Chống tràn Tải",
        category="DEEP_LOGIC",
        stage_id="deep_logic",
        stage_name="Logic Chuyên sâu & API (Deep Logic)",
        description="Tests parameter pollution (HTTP Parameter Pollution), array wrapping anomalies, and endpoint rate-limiting mechanisms under concurrent stress.",
        description_vi="Kiểm thử lỗi ô nhiễm tham số (HPP), bất thường cấu trúc JSON/Array và cơ chế giới hạn tần suất (Rate Limiting) trên các endpoint trọng yếu.",
        severity_if_failed="MEDIUM",
        owasp_category="A04:2021-Insecure Design",
        cwe_ids=["CWE-235", "CWE-770"],
        minimum_tier="PRO",
        remediation_guide="Chuẩn hóa bộ xử lý tham số trên web framework, từ chối tham số trùng lặp và kích hoạt Rate Limiting theo IP / User Token.",
        remediation_code_snippet="""# Cấu hình Rate Limiting với Redis Token Bucket (e.g. slowapi / Redis)
from slowapi import Limiter
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)
@app.post("/api/auth/login")
@limiter.limit("5/minute")
def login_route():
    ..."""
    ),
    "CORS-MISCONFIG": SecurityControl(
        id="CORS-MISCONFIG",
        code="SEC-LOGIC-03",
        title="Cross-Origin Resource Sharing (CORS) Policy",
        title_vi="Chính sách Chia sẻ Tài nguyên Liên nguồn (CORS)",
        category="DEEP_LOGIC",
        stage_id="deep_logic",
        stage_name="Logic Chuyên sâu & API (Deep Logic)",
        description="Checks for overly permissive CORS headers (Access-Control-Allow-Origin: * or null with Allow-Credentials: true) enabling data exfiltration.",
        description_vi="Kiểm tra chính sách CORS có cho phép origin bất kỳ hoặc phản chiếu tùy ý (reflection) kèm thông tin chứng thực (credentials) hay không.",
        severity_if_failed="HIGH",
        owasp_category="A05:2021-Security Misconfiguration",
        cwe_ids=["CWE-942"],
        minimum_tier="FREE",
        remediation_guide="Chỉ định danh sách origin được phép (Whitelist) tường minh. Không bao giờ cấu hình Allow-Credentials: true cùng với Access-Control-Allow-Origin: *.",
        remediation_code_snippet="""# FastAPI CORS Whitelist Example
from fastapi.middleware.cors import CORSMiddleware

ALLOWED_ORIGINS = [
    "https://adq.io.vn",
    "https://app.adq.io.vn",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)"""
    ),
}


def get_control_by_id(control_id: str) -> Optional[SecurityControl]:
    return SECURITY_CONTROLS_REGISTRY.get(control_id)


def list_all_controls() -> List[SecurityControl]:
    return list(SECURITY_CONTROLS_REGISTRY.values())
