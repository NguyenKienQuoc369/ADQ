import shlex
import subprocess
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Union

try:
    from config import config
except ImportError:
    class DummyConfig:
        DEFAULT_TIMEOUT = 30
        WORDLIST_PATH = "wordlist.txt"
    config = DummyConfig()


@dataclass
class ToolResult:
    name: str
    command: List[str]
    stdout: str
    stderr: str
    returncode: int
    duration_seconds: float

    def to_dict(self) -> Dict[str, Union[str, int, float, List[str]]]:
        return {
            "name": self.name,
            "command": self.command,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "returncode": self.returncode,
            "duration_seconds": self.duration_seconds,
        }


def run_command(
    name: str,
    args: List[str],
    timeout: int = None,
    retries: int = 0,
    backoff: float = 2.0,
    input_text: Optional[str] = None,
    input_file: Optional[str] = None,
) -> ToolResult:
    timeout = timeout or config.DEFAULT_TIMEOUT
    attempt = 0
    stdout_lines: List[str] = []
    stderr_lines: List[str] = []
    start_time = time.time()

    while True:
        attempt += 1
        stdin_handle = None
        try:
            if input_file:
                stdin_handle = open(input_file, "r")
            process = subprocess.Popen(
                args,
                stdin=subprocess.PIPE if input_text is not None else stdin_handle,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )

            if input_text is not None and process.stdin:
                process.stdin.write(input_text)
                process.stdin.close()

            out, err = process.communicate(timeout=timeout)
            stdout_lines.extend(out.splitlines())
            stderr_lines.extend(err.splitlines())

            if process.returncode == 0 or attempt > retries:
                break

            time.sleep(backoff * attempt)
        finally:
            if stdin_handle:
                stdin_handle.close()

    duration = time.time() - start_time
    return ToolResult(
        name=name,
        command=args,
        stdout="\n".join(stdout_lines),
        stderr="\n".join(stderr_lines),
        returncode=process.returncode,
        duration_seconds=round(duration, 2),
    )


def run_subfinder(target: str) -> ToolResult:
    args = ["subfinder", "-d", target, "-silent"]
    return run_command("Subfinder", args)


def run_httpx(targets: List[str], scan_type: str = "httpx-toolkit", json_mode: bool = True, input_text: Optional[str] = None) -> ToolResult:
    args = [scan_type, "-l", "-", "-silent", "-mc", "200,301,302,403"]
    if json_mode:
        args.append("-json")
    return run_command("HTTPX", args, input_text=input_text)


def run_nuclei(targets: List[str], tags: Optional[List[str]] = None, json_mode: bool = True, input_text: Optional[str] = None) -> ToolResult:
    args = ["nuclei", "-l", "-", "-silent"]
    if json_mode:
        args.append("-json")
    if tags:
        args += ["-tags", ",".join(tags)]
    return run_command("Nuclei", args, input_text=input_text)


def run_ffuf(url: str, wordlist: Optional[str] = None, json_mode: bool = True, input_text: Optional[str] = None) -> ToolResult:
    args = ["ffuf", "-u", f"{url}/FUZZ", "-w", wordlist or config.WORDLIST_PATH, "-mc", "200"]
    if json_mode:
        args += ["-of", "json"]
    return run_command("FFuf", args, input_text=input_text)


def collect_tool_result(tool_result: ToolResult) -> Dict[str, object]:
    return {
        "tool": tool_result.name,
        "command": tool_result.command,
        "stdout": tool_result.stdout,
        "stderr": tool_result.stderr,
        "returncode": tool_result.returncode,
        "duration_seconds": tool_result.duration_seconds,
    }


def perform_real_dynamic_scan(target: str, tier_choice: int = 2) -> Dict[str, Any]:
    """
    Real Dynamic Target Security Scanner for ADQ Engine.
    Performs live DNS resolution, real TCP socket port probing, real HTTP/HTTPS request inspecting,
    CORS testing, missing security headers checks, exposed endpoint/directory probing,
    and JS Secret analysis on the provided target.
    """
    import re
    import socket
    import urllib.parse
    import requests
    import urllib3

    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    raw_target = target.strip()
    if not raw_target.startswith(("http://", "https://")):
        target_url = f"https://{raw_target}"
    else:
        target_url = raw_target

    parsed = urllib.parse.urlparse(target_url)
    domain = parsed.netloc.split(":")[0]
    scheme = parsed.scheme or "https"

    # 1. Real IP Address Resolution
    ip_addr = "N/A"
    try:
        ip_addr = socket.gethostbyname(domain)
    except Exception:
        pass

    # 2. Real TCP Port Probing (Only reports ports that are ACTUALLY open)
    ports_to_check = [80, 443, 8080, 8443, 3000, 8000, 5000]
    if tier_choice >= 2:
        ports_to_check.extend([21, 22, 25, 53, 3306, 5432, 6379, 8888, 27017])

    open_ports = []
    if ip_addr != "N/A":
        for p in ports_to_check:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(0.5)
            res = s.connect_ex((ip_addr, p))
            if res == 0:
                open_ports.append(p)
            s.close()

    # 3. Real HTTP Response & Security Banner / Header Inspection
    live_hosts = [target_url]
    server_banner = "Unknown"
    title = ""
    status_code = 0
    missing_headers = []
    cors_vuln = False
    vulns = []
    resp_text = ""

    # Realistic browser headers to bypass automated bot checks (Cloudflare, Akamai, AWS WAF, etc.)
    browser_headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Accept-Encoding": "gzip, deflate, br",
        "Sec-Ch-Ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
        "Sec-Ch-Ua-Mobile": "?0",
        "Sec-Ch-Ua-Platform": '"Windows"',
        "Sec-Fetch-Dest": "document",
        "Sec-Fetch-Mode": "navigate",
        "Sec-Fetch-Site": "none",
        "Sec-Fetch-User": "?1",
        "Upgrade-Insecure-Requests": "1"
    }

    try:
        resp = requests.get(
            target_url,
            timeout=5,
            headers=browser_headers,
            verify=False
        )
        status_code = resp.status_code
        resp_text = resp.text
        server_banner = resp.headers.get("Server", resp.headers.get("X-Powered-By", "Web Server"))

        # Extract Title
        match_title = re.search(r"<title>(.*?)</title>", resp_text, re.IGNORECASE)
        if match_title:
            title = match_title.group(1).strip()

        # Security Headers Check
        if "Strict-Transport-Security" not in resp.headers and scheme == "https":
            missing_headers.append("HSTS")
        if "Content-Security-Policy" not in resp.headers:
            missing_headers.append("CSP")
        if "X-Content-Type-Options" not in resp.headers:
            missing_headers.append("X-Content-Type-Options")

        # CORS Testing
        try:
            cors_headers = dict(browser_headers)
            cors_headers["Origin"] = "https://evil-attacker-adq.com"
            cors_resp = requests.options(
                target_url,
                headers=cors_headers,
                timeout=3,
                verify=False
            )
            allow_origin = cors_resp.headers.get("Access-Control-Allow-Origin", "")
            allow_cred = cors_resp.headers.get("Access-Control-Allow-Credentials", "")
            if allow_origin in ("*", "https://evil-attacker-adq.com"):
                if allow_origin == "*" or allow_cred.lower() == "true":
                    cors_vuln = True
        except Exception:
            pass

    except Exception:
        status_code = 0

    # 4. Probing Real Sensitive Endpoints
    endpoints_to_probe = [
        "/.git/HEAD",
        "/.env",
        "/robots.txt",
        "/sitemap.xml",
        "/admin",
        "/swagger-ui.html",
        "/openapi.json",
        "/config.json",
        "/api/v1/health"
    ]
    exposed_paths = []

    for ep in endpoints_to_probe:
        test_url = f"{scheme}://{domain}{ep}"
        try:
            r = requests.get(
                test_url,
                timeout=3,
                headers=browser_headers,
                verify=False
            )
            if r.status_code == 200:
                if ep == "/.git/HEAD" and "refs/heads/" in r.text:
                    exposed_paths.append(f"{test_url} (HTTP 200 | GIT REPO EXPOSED)")
                    vulns.append({"severity": "CRITICAL", "title": "Exposed .git Source Directory", "endpoint": test_url, "cve": "CWE-538"})
                elif ep == "/.env" and ("DB_" in r.text or "SECRET" in r.text or "KEY" in r.text):
                    exposed_paths.append(f"{test_url} (HTTP 200 | ENV SECRETS EXPOSED)")
                    vulns.append({"severity": "CRITICAL", "title": "Exposed Environment Configuration (.env)", "endpoint": test_url, "cve": "CWE-526"})
                elif ep in ("/swagger-ui.html", "/openapi.json"):
                    exposed_paths.append(f"{test_url} (HTTP 200 | API DOCS)")
                    vulns.append({"severity": "MEDIUM", "title": "Exposed API Documentation Endpoint", "endpoint": test_url, "cve": "CWE-200"})
                elif ep in ("/robots.txt", "/sitemap.xml"):
                    exposed_paths.append(f"{test_url} (HTTP 200)")
        except Exception:
            pass

    if cors_vuln:
        vulns.append({"severity": "MEDIUM", "title": "CORS Misconfiguration (Permissive Origin Allowed)", "endpoint": target_url, "cve": "CWE-942"})
    if missing_headers:
        vulns.append({"severity": "LOW", "title": f"Missing Security Headers ({', '.join(missing_headers)})", "endpoint": target_url, "cve": "CWE-693"})

    # 5. Real JS Code Secret Analysis
    secrets = []
    if resp_text:
        try:
            from core.js_analyzer import DeepJSAnalyzer
            analyzer = DeepJSAnalyzer()
            js_res = analyzer.analyze_code(resp_text, source_url=target_url)
            secrets = js_res.get("secrets", [])
        except Exception:
            pass

    # 6. Real Subdomain Probing
    subdomains = []
    sub_prefixes = ["www", "api", "app", "dev", "admin", "mail", "cdn", "staging"]
    for sub in sub_prefixes:
        sub_dom = f"{sub}.{domain}"
        try:
            socket.gethostbyname(sub_dom)
            subdomains.append(sub_dom)
            if f"{scheme}://{sub_dom}" not in live_hosts and len(live_hosts) < 5:
                live_hosts.append(f"{scheme}://{sub_dom}")
        except Exception:
            pass

    # 7. Priority Risk Score Calculation
    score = 10
    if not vulns and not missing_headers:
        score = 15  # Secure target
    else:
        for v in vulns:
            if v.get("severity") == "CRITICAL":
                score += 35
            elif v.get("severity") == "HIGH":
                score += 20
            elif v.get("severity") == "MEDIUM":
                score += 10
            elif v.get("severity") == "LOW":
                score += 5
    score = min(score, 100)

    # Format open ports strings
    port_strings = []
    port_descriptions = {
        80: "HTTP Web",
        443: "HTTPS Web",
        8080: "HTTP Proxy/Alt",
        8443: "HTTPS Alt",
        3000: "Node/React Web",
        8000: "Python/API Web",
        5000: "Flask/Web",
        22: "SSH Service",
        21: "FTP Service",
        3306: "MySQL DB",
        5432: "PostgreSQL DB",
        6379: "Redis Cache",
        27017: "MongoDB",
        8888: "ADQ Listener"
    }
    for p in open_ports:
        desc = port_descriptions.get(p, "Open Service")
        port_strings.append(f"{p}/tcp ({desc})")

    if not port_strings:
        port_strings = ["No common open ports detected"]

    return {
        "target": target_url,
        "domain": domain,
        "ip_address": ip_addr,
        "status_code": status_code,
        "server_banner": server_banner,
        "title": title,
        "counts": {
            "subdomains": len(subdomains),
            "live_hosts": len(live_hosts),
            "crawled_urls": 1 + len(endpoints_to_probe) + len(subdomains),
            "open_ports": len(open_ports),
            "vulns": len(vulns),
        },
        "subdomains": subdomains,
        "live_hosts": live_hosts,
        "ports": port_strings,
        "open_ports_raw": open_ports,
        "vulnerabilities": vulns,
        "secrets": secrets,
        "exposed_paths": exposed_paths,
        "priority_score": score,
    }

