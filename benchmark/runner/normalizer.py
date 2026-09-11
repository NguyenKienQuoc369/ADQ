"""
Canonical normalization utilities for categories, endpoints, and parameters.
"""
import re
from urllib.parse import urlparse
from typing import Optional

CATEGORY_MAP = {
    # SQLi
    "sqli": "SQL Injection",
    "sql injection": "SQL Injection",
    "sql_injection": "SQL Injection",
    "blind_sqli": "SQL Injection",
    "blind sqli": "SQL Injection",
    # XSS
    "xss": "Cross-Site Scripting",
    "cross-site scripting": "Cross-Site Scripting",
    "cross site scripting": "Cross-Site Scripting",
    "reflected_xss": "Cross-Site Scripting",
    "stored_xss": "Cross-Site Scripting",
    "dom_xss": "Cross-Site Scripting",
    # Secrets
    "exposed secrets": "Exposed Secrets",
    "exposed_secrets": "Exposed Secrets",
    "secret_exposure": "Exposed Secrets",
    "secret": "Exposed Secrets",
    "hardcoded_secret": "Exposed Secrets",
    # Misconfig
    "security misconfiguration": "Security Misconfiguration",
    "security_misconfiguration": "Security Misconfiguration",
    "misconfiguration": "Security Misconfiguration",
    "missing_headers": "Security Misconfiguration",
    "cors_misconfiguration": "Security Misconfiguration",
    "directory_listing": "Security Misconfiguration",
    # Endpoints
    "sensitive endpoint exposure": "Sensitive Endpoint Exposure",
    "sensitive_endpoint": "Sensitive Endpoint Exposure",
    "endpoint_exposure": "Sensitive Endpoint Exposure",
    "swagger_exposure": "Sensitive Endpoint Exposure",
    "swagger-api": "Sensitive Endpoint Exposure",
    "swagger_api": "Sensitive Endpoint Exposure",
    "swagger": "Sensitive Endpoint Exposure",
    "openapi": "Sensitive Endpoint Exposure",
    "prometheus-metrics": "Sensitive Endpoint Exposure",
    "prometheus_metrics": "Sensitive Endpoint Exposure",
    "prometheus": "Sensitive Endpoint Exposure",
    # Service / Port
    "open service": "Open Service",
    "open_service": "Open Service",
    "open_port": "Open Service",
    "port_scan": "Open Service",
    # Command Injection
    "command injection": "Command Injection",
    "command_injection": "Command Injection",
    "cmdi": "Command Injection",
    # LFI / Path Traversal
    "local file inclusion": "Local File Inclusion",
    "file inclusion": "Local File Inclusion",
    "lfi": "Local File Inclusion",
    "path traversal": "Local File Inclusion",
    "path_traversal": "Local File Inclusion",
    # CVE
    "known cve": "Known CVE",
    "known_cve": "Known CVE",
    "cve": "Known CVE",
}

def normalize_category(category: Optional[str]) -> str:
    """Normalize raw category string into standard canonical representation."""
    if not category:
        return "UNKNOWN"
    cleaned = category.strip().lower()
    return CATEGORY_MAP.get(cleaned, category.strip())

def normalize_endpoint(endpoint: Optional[str]) -> str:
    """
    Normalize URL or path to a canonical relative path.
    Example: 'http://127.0.0.1:3000/rest/products/search?q=test#top' -> '/rest/products/search'
    """
    if not endpoint:
        return "/"
    
    endpoint = endpoint.strip()
    if endpoint.startswith("http://") or endpoint.startswith("https://"):
        parsed = urlparse(endpoint)
        path = parsed.path
        if not path:
            path = "/"
        # Clean trailing slash unless path is root '/'
        if len(path) > 1 and path.endswith("/"):
            path = path.rstrip("/")
        return path
    
    # If given path directly, strip query and fragment if present
    if "?" in endpoint:
        endpoint = endpoint.split("?")[0]
    if "#" in endpoint:
        endpoint = endpoint.split("#")[0]
    
    if not endpoint.startswith("/"):
        endpoint = "/" + endpoint
        
    if len(endpoint) > 1 and endpoint.endswith("/"):
        endpoint = endpoint.rstrip("/")
        
    return endpoint

def normalize_parameter(param: Optional[str]) -> Optional[str]:
    """Normalize parameter name (lowercased, stripped)."""
    if param is None:
        return None
    cleaned = str(param).strip().lower()
    return cleaned if cleaned else None

