import json

from core.ai_agent import analyze_security_findings


def main() -> None:
    scan_id = "scan-demo-001"
    target = "example.com"
    live_hosts = [
        {"url": "https://example.com", "status_code": 200},
        {"url": "https://admin.example.com", "status_code": 403},
    ]
    vulnerabilities = [
        {
            "source": "nuclei",
            "template_id": "cves/2021/CVE-2021-41773",
            "host": "https://example.com",
            "severity": "high",
            "matched": "https://example.com/cgi-bin/.%2e/.%2e/.%2e/.%2e/etc/passwd",
        },
        {
            "source": "nuclei",
            "template_id": "tech-detect/apache",
            "host": "https://example.com",
            "severity": "info",
            "matched": "Apache",
        },
        {
            "source": "ffuf",
            "endpoint": "https://example.com/.git/config",
            "status_code": 200,
            "length": 321,
        },
    ]

    result = analyze_security_findings(
        scan_id=scan_id,
        target=target,
        vulnerabilities=vulnerabilities,
        live_hosts=live_hosts,
    )
    print(json.dumps(result, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()