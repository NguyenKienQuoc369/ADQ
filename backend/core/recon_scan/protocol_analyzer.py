import json
import re
import urllib.parse
from typing import Any, Dict, List, Optional
import requests


GRAPHQL_INTROSPECTION_QUERY = """
query IntrospectionQuery {
  __schema {
    queryType { name }
    mutationType { name }
    subscriptionType { name }
    types {
      kind
      name
      fields {
        name
        args {
          name
          type { name kind }
        }
        type { name kind }
      }
    }
  }
}
"""

SENSITIVE_FIELD_PATTERNS = [
    r"password", r"pass", r"secret", r"token", r"ssn", r"card", r"auth", r"private", r"credit"
]


class GraphQLAnalyzer:
    """
    GraphQL Introspection & Schema Analysis Engine
    - Sends GraphQL Introspection queries to extract complete API Schema
    - Extracts Types, Queries, Mutations, Subscriptions, and Field Arguments
    - Identifies security misconfigurations (Introspection Enabled, Sensitive Fields Exposed)
    """

    def __init__(self, timeout: int = 8):
        self.timeout = timeout

    def probe_introspection(
        self,
        graphql_endpoint: str,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        headers = headers or {"Content-Type": "application/json"}
        payload = {"query": GRAPHQL_INTROSPECTION_QUERY}

        try:
            resp = requests.post(graphql_endpoint, json=payload, headers=headers, timeout=self.timeout)
            if resp.status_code != 200:
                return {
                    "endpoint": graphql_endpoint,
                    "introspection_enabled": False,
                    "status_code": resp.status_code,
                    "reason": f"HTTP {resp.status_code}",
                }

            data = resp.json()
            schema = data.get("data", {}).get("__schema")
            if not schema:
                return {
                    "endpoint": graphql_endpoint,
                    "introspection_enabled": False,
                    "status_code": resp.status_code,
                    "reason": "No __schema in response",
                }

            # Introspection Enabled! Parse complete schema
            queries: List[str] = []
            mutations: List[str] = []
            subscriptions: List[str] = []
            types: List[str] = []
            sensitive_fields_found: List[Dict[str, str]] = []

            for t in schema.get("types", []):
                t_name = t.get("name", "")
                if t_name.startswith("__"):
                    continue

                types.append(t_name)
                fields = t.get("fields") or []

                for f in fields:
                    field_name = f.get("name", "")
                    
                    # Check for sensitive fields
                    for pat in SENSITIVE_FIELD_PATTERNS:
                        if re.search(pat, field_name, re.IGNORECASE):
                            sensitive_fields_found.append({
                                "type": t_name,
                                "field": field_name,
                            })

                    if t_name.lower() == "query" or t_name == schema.get("queryType", {}).get("name"):
                        queries.append(field_name)
                    elif t_name.lower() == "mutation" or t_name == schema.get("mutationType", {}).get("name"):
                        mutations.append(field_name)
                    elif t_name.lower() == "subscription" or t_name == schema.get("subscriptionType", {}).get("name"):
                        subscriptions.append(field_name)

            return {
                "endpoint": graphql_endpoint,
                "introspection_enabled": True,
                "status_code": 200,
                "queries": sorted(list(set(queries))),
                "mutations": sorted(list(set(mutations))),
                "subscriptions": sorted(list(set(subscriptions))),
                "custom_types_count": len(types),
                "sensitive_fields_found": sensitive_fields_found,
                "security_findings": [
                    {
                        "severity": "medium",
                        "title": "GraphQL Introspection Enabled",
                        "description": "GraphQL Introspection is publicly accessible, leaking full API schema and mutation signatures.",
                    }
                ] if sensitive_fields_found or mutations else [],
            }

        except Exception as exc:
            return {
                "endpoint": graphql_endpoint,
                "introspection_enabled": False,
                "error": str(exc),
            }


class WebSocketAnalyzer:
    """
    WebSocket Connection & Real-time Channel Analyzer
    - Performs WebSocket Upgrade Handshake (101 Switching Protocols)
    - Inspects WebSocket response headers and frame formats
    - Maps real-time communication endpoints
    """

    def __init__(self, timeout: int = 6):
        self.timeout = timeout

    def analyze_websocket(
        self,
        target_url: str,
        headers: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        parsed = urllib.parse.urlparse(target_url)
        ws_scheme = "wss" if parsed.scheme in ("https", "wss") else "ws"
        http_scheme = "https" if ws_scheme == "wss" else "http"
        
        http_url = f"{http_scheme}://{parsed.netloc}{parsed.path}"
        if parsed.query:
            http_url += f"?{parsed.query}"

        ws_headers = {
            "Upgrade": "websocket",
            "Connection": "Upgrade",
            "Sec-WebSocket-Key": "dGhlIHNhbXBsZSBub25jZQ==",
            "Sec-WebSocket-Version": "13",
            "User-Agent": "ADQ-Protocol-Analyzer/1.0",
        }
        if headers:
            ws_headers.update(headers)

        try:
            resp = requests.get(http_url, headers=ws_headers, timeout=self.timeout)
            is_101 = resp.status_code == 101
            upgrade_header = resp.headers.get("Upgrade", "").lower()
            accept_key = resp.headers.get("Sec-WebSocket-Accept")

            ws_supported = is_101 or upgrade_header == "websocket" or accept_key is not None

            return {
                "target_url": target_url,
                "websocket_endpoint": f"{ws_scheme}://{parsed.netloc}{parsed.path}",
                "handshake_status_code": resp.status_code,
                "websocket_supported": ws_supported,
                "response_headers": dict(resp.headers),
                "security_findings": [
                    {
                        "severity": "info",
                        "title": "WebSocket Real-time Channel Discovered",
                        "description": f"Target exposes WebSocket interface at {target_url}",
                    }
                ] if ws_supported else [],
            }
        except Exception as exc:
            return {
                "target_url": target_url,
                "websocket_supported": False,
                "error": str(exc),
            }


class MultiProtocolAnalyzer:
    """
    Multi-Protocol Structure Analyzer Engine for ADQ
    - Wraps GraphQL Schema Extractor and WebSocket Analyzer
    """

    def __init__(self, timeout: int = 8):
        self.graphql_analyzer = GraphQLAnalyzer(timeout=timeout)
        self.websocket_analyzer = WebSocketAnalyzer(timeout=timeout)

    def analyze_protocol_surface(
        self,
        target_url: str,
        graphql_endpoint: Optional[str] = None,
        websocket_endpoint: Optional[str] = None,
    ) -> Dict[str, Any]:
        results: Dict[str, Any] = {
            "target_url": target_url,
            "graphql": None,
            "websocket": None,
        }

        # Probe GraphQL if specified or infer endpoint
        g_url = graphql_endpoint or f"{target_url.rstrip('/')}/graphql"
        results["graphql"] = self.graphql_analyzer.probe_introspection(g_url)

        # Probe WebSocket if specified or infer endpoint
        w_url = websocket_endpoint or target_url
        results["websocket"] = self.websocket_analyzer.analyze_websocket(w_url)

        return results
