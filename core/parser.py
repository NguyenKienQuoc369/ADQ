import json
import re
from typing import Any, Dict, List, Optional

DOMAIN_RE = re.compile(r"^[A-Za-z0-9.-]+$")
HTTPX_JSON_KEYS = {"url", "status_code", "title", "method", "tech"}
NUCLEI_JSON_KEYS = {"templateID", "host", "severity", "matched", "info", "name"}


def _load_json_lines(raw_output: str) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    for line in raw_output.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
            if isinstance(obj, dict):
                results.append(obj)
        except json.JSONDecodeError:
            continue
    return results


def parse_subfinder(raw_output: str) -> List[str]:
    domains = []
    for line in raw_output.splitlines():
        line = line.strip()
        if not line or line.startswith("[") or line.lower().startswith("[*]"):
            continue
        if line.startswith("http://") or line.startswith("https://"):
            line = re.sub(r"^https?://", "", line)
            line = line.strip('"/\\ ')
        if DOMAIN_RE.match(line):
            domains.append(line)
    return sorted(set(domains))


def parse_httpx(raw_output: str, json_mode: bool = True) -> List[Dict[str, Any]]:
    results: List[Dict[str, Any]] = []
    if json_mode:
        for obj in _load_json_lines(raw_output):
            item = {
                "url": obj.get("url") or obj.get("target"),
                "status_code": obj.get("status_code") or obj.get("status"),
                "title": obj.get("title") or obj.get("name"),
                "tech": obj.get("tech") or obj.get("technologies") or [],
                "method": obj.get("method"),
            }
            if item["url"]:
                results.append(item)
        return results

    # Fallback parsing from raw HTTPX text output.
    for line in raw_output.splitlines():
        line = line.strip()
        if not line or line.startswith("["):
            continue
        parts = re.split(r"\s+\|\s+", line)
        if len(parts) >= 2 and parts[1].isdigit():
            results.append({
                "url": parts[0],
                "status_code": int(parts[1]),
                "title": parts[2] if len(parts) > 2 else None,
                "tech": parts[3].split(",") if len(parts) > 3 else [],
            })
    return results


def parse_nuclei(raw_output: str, json_mode: bool = True) -> List[Dict[str, Any]]:
    findings: List[Dict[str, Any]] = []
    if json_mode:
        for obj in _load_json_lines(raw_output):
            finding = {
                "template_id": obj.get("templateID") or obj.get("name"),
                "host": obj.get("host"),
                "severity": obj.get("severity"),
                "matched": obj.get("matched"),
                "info": obj.get("info"),
                "raw": obj,
            }
            findings.append(finding)
        return findings

    for line in raw_output.splitlines():
        line = line.strip()
        if not line or line.startswith("[") and "]" not in line:
            continue
        m = re.search(r"\[(?P<severity>info|low|medium|high|critical)\].*?\[(?P<template>[A-Za-z0-9_\-/]+)\].*? (?P<host>https?://[^\s]+)", line, re.IGNORECASE)
        if m:
            findings.append({
                "template_id": m.group("template"),
                "host": m.group("host"),
                "severity": m.group("severity").lower(),
                "raw": line,
            })
    return findings


def parse_ffuf(raw_output: str, json_mode: bool = True) -> List[Dict[str, Any]]:
    endpoints: List[Dict[str, Any]] = []
    if json_mode:
        for obj in _load_json_lines(raw_output):
            if not isinstance(obj, dict):
                continue
            endpoint = obj.get("input") or obj.get("url") or obj.get("path")
            status = obj.get("status_code") or obj.get("status")
            if endpoint:
                endpoints.append({
                    "endpoint": endpoint,
                    "status_code": status,
                    "length": obj.get("length"),
                    "raw": obj,
                })
        return endpoints

    for line in raw_output.splitlines():
        if "Status:" in line and "URL:" in line:
            parts = line.split()
            endpoint = None
            status = None
            for i, token in enumerate(parts):
                if token.startswith("http"):
                    endpoint = token
                if token.startswith("Status:"):
                    try:
                        status = int(parts[i + 1])
                    except (IndexError, ValueError):
                        status = None
            if endpoint:
                endpoints.append({"endpoint": endpoint, "status_code": status, "raw": line})
    return endpoints
