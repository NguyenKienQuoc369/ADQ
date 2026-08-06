import json
from enum import Enum
from typing import Any, Dict, List, Optional, Set, Tuple


class NodeType(str, Enum):
    DOMAIN = "DOMAIN"
    IP = "IP"
    WEB_SERVICE = "WEB_SERVICE"
    API_ENDPOINT = "API_ENDPOINT"
    PARAMETER = "PARAMETER"
    SECRET = "SECRET"
    VULNERABILITY = "VULNERABILITY"


class EdgeType(str, Enum):
    RESOLVES_TO = "RESOLVES_TO"
    HOSTS = "HOSTS"
    EXPOSES = "EXPOSES"
    HAS_PARAMETER = "HAS_PARAMETER"
    HAS_SECRET = "HAS_SECRET"
    HAS_VULNERABILITY = "HAS_VULNERABILITY"
    AUTHENTICATES_WITH = "AUTHENTICATES_WITH"


class SecurityNode:
    def __init__(self, node_id: str, label: str, node_type: NodeType, properties: Optional[Dict[str, Any]] = None):
        self.node_id = node_id
        self.label = label
        self.node_type = node_type
        self.properties = properties or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "node_id": self.node_id,
            "label": self.label,
            "node_type": self.node_type.value if isinstance(self.node_type, NodeType) else str(self.node_type),
            "properties": self.properties,
        }


class SecurityEdge:
    def __init__(self, source_id: str, target_id: str, edge_type: EdgeType, properties: Optional[Dict[str, Any]] = None):
        self.source_id = source_id
        self.target_id = target_id
        self.edge_type = edge_type
        self.properties = properties or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "source_id": self.source_id,
            "target_id": self.target_id,
            "edge_type": self.edge_type.value if isinstance(self.edge_type, EdgeType) else str(self.edge_type),
            "properties": self.properties,
        }


class SecurityKnowledgeGraph:
    """
    Security Knowledge Graph Engine for ADQ
    - Models targets, subdomains, IPs, services, API endpoints, parameters, secrets, and vulns as Nodes & Edges
    - Enables Graph Traversal (finding impact paths from leaked secrets to exposed endpoints)
    - Computes Contextual Risk Scores based on graph topology and connected threat density
    """

    def __init__(self, target_domain: str):
        self.target_domain = target_domain
        self.nodes: Dict[str, SecurityNode] = {}
        self.edges: List[SecurityEdge] = []
        self.adj_list: Dict[str, List[Tuple[str, EdgeType]]] = {}
        self.rev_adj_list: Dict[str, List[Tuple[str, EdgeType]]] = {}

        # Initialize Root Target Domain Node
        root_id = f"domain:{target_domain}"
        self.add_node(root_id, label=target_domain, node_type=NodeType.DOMAIN)

    def add_node(self, node_id: str, label: str, node_type: NodeType, properties: Optional[Dict[str, Any]] = None) -> SecurityNode:
        if node_id not in self.nodes:
            node = SecurityNode(node_id=node_id, label=label, node_type=node_type, properties=properties)
            self.nodes[node_id] = node
            self.adj_list[node_id] = []
            self.rev_adj_list[node_id] = []
        else:
            # Update properties if existing
            if properties:
                self.nodes[node_id].properties.update(properties)
        return self.nodes[node_id]

    def add_edge(self, source_id: str, target_id: str, edge_type: EdgeType, properties: Optional[Dict[str, Any]] = None):
        if source_id in self.nodes and target_id in self.nodes:
            edge = SecurityEdge(source_id=source_id, target_id=target_id, edge_type=edge_type, properties=properties)
            self.edges.append(edge)
            self.adj_list[source_id].append((target_id, edge_type))
            self.rev_adj_list[target_id].append((source_id, edge_type))

    def ingest_scan_payload(self, scan_data: Dict[str, Any]):
        """Ingests flat scan payload (subdomains, live_hosts, endpoints, secrets, vulns) into Graph."""
        root_id = f"domain:{self.target_domain}"

        # 1. Subdomains & Hosts
        for sub in scan_data.get("subdomains", []):
            sub_id = f"domain:{sub}"
            self.add_node(sub_id, label=sub, node_type=NodeType.DOMAIN)
            if sub != self.target_domain:
                self.add_edge(root_id, sub_id, EdgeType.HOSTS)

        # 2. Live Web Services
        for host in scan_data.get("live_hosts", []):
            url = host.get("url")
            if url:
                svc_id = f"service:{url}"
                self.add_node(
                    svc_id,
                    label=url,
                    node_type=NodeType.WEB_SERVICE,
                    properties={
                        "status_code": host.get("status_code"),
                        "title": host.get("title"),
                        "tech": host.get("tech"),
                    },
                )
                # Link domain to web service
                domain_id = f"domain:{self.target_domain}"
                for s in scan_data.get("subdomains", []):
                    if s in url:
                        domain_id = f"domain:{s}"
                        break
                self.add_edge(domain_id, svc_id, EdgeType.EXPOSES)

        # 3. Discovered API Endpoints & Parameters
        for ep in scan_data.get("discovered_endpoints", []):
            ep_id = f"endpoint:{ep}"
            self.add_node(ep_id, label=ep, node_type=NodeType.API_ENDPOINT)
            self.add_edge(root_id, ep_id, EdgeType.EXPOSES)

        for param in scan_data.get("discovered_parameters", []):
            param_id = f"param:{param}"
            self.add_node(param_id, label=param, node_type=NodeType.PARAMETER)

        # 4. Leaked Secrets
        for sec in scan_data.get("secrets", []):
            sec_type = sec.get("type", "generic_secret")
            sec_val = sec.get("value", "")
            sec_id = f"secret:{sec_type}:{hash(sec_val) % 10000}"
            self.add_node(
                sec_id,
                label=f"Secret [{sec_type}]",
                node_type=NodeType.SECRET,
                properties={"type": sec_type, "sample": sec_val[:30]},
            )
            self.add_edge(root_id, sec_id, EdgeType.HAS_SECRET)

        # 5. Vulnerabilities
        for vuln in scan_data.get("vulnerabilities", []):
            vuln_src = vuln.get("source", "scan")
            template_id = vuln.get("template_id") or vuln.get("endpoint") or "vuln"
            severity = (vuln.get("severity") or "medium").lower()
            vuln_id = f"vuln:{vuln_src}:{template_id}"

            self.add_node(
                vuln_id,
                label=f"Vuln [{severity.upper()}]: {template_id}",
                node_type=NodeType.VULNERABILITY,
                properties={
                    "severity": severity,
                    "source": vuln_src,
                    "reason": vuln.get("matched") or vuln.get("reason"),
                },
            )

            # Link vulnerability to host/endpoint/root
            host_url = vuln.get("host") or vuln.get("endpoint")
            linked = False
            if host_url:
                target_svc_id = f"service:{host_url}"
                target_ep_id = f"endpoint:{host_url}"
                if target_svc_id in self.nodes:
                    self.add_edge(target_svc_id, vuln_id, EdgeType.HAS_VULNERABILITY)
                    linked = True
                elif target_ep_id in self.nodes:
                    self.add_edge(target_ep_id, vuln_id, EdgeType.HAS_VULNERABILITY)
                    linked = True

            if not linked:
                self.add_edge(root_id, vuln_id, EdgeType.HAS_VULNERABILITY)

    def find_impact_paths(self, start_node_id: str, max_depth: int = 4) -> List[List[Dict[str, Any]]]:
        """
        Graph Traversal BFS: Finds all downstream impact paths originating from a start node (e.g. Secret or Vulnerability).
        """
        if start_node_id not in self.nodes:
            return []

        paths: List[List[Dict[str, Any]]] = []
        queue: List[List[Tuple[str, Optional[EdgeType]]]] = [[(start_node_id, None)]]

        while queue:
            current_path = queue.pop(0)
            last_node_id, _ = current_path[-1]

            if len(current_path) >= max_depth:
                paths.append([
                    {"node": self.nodes[nid].to_dict(), "via_edge": etype.value if etype else None}
                    for nid, etype in current_path
                ])
                continue

            neighbors = self.adj_list.get(last_node_id, [])
            if not neighbors:
                if len(current_path) > 1:
                    paths.append([
                        {"node": self.nodes[nid].to_dict(), "via_edge": etype.value if etype else None}
                        for nid, etype in current_path
                    ])
                continue

            for next_node_id, edge_type in neighbors:
                # Avoid cycles
                if not any(nid == next_node_id for nid, _ in current_path):
                    queue.append(current_path + [(next_node_id, edge_type)])

        return paths

    def calculate_contextual_risk_score(self) -> Dict[str, Any]:
        """
        Calculates Graph Topology Contextual Risk Score (0 - 100).
        Evaluates vulnerability density, secret exposure degree, and asset connectivity.
        """
        score = 0
        weights = {"critical": 35, "high": 20, "medium": 10, "low": 3, "info": 1}

        vuln_nodes = [n for n in self.nodes.values() if n.node_type == NodeType.VULNERABILITY]
        secret_nodes = [n for n in self.nodes.values() if n.node_type == NodeType.SECRET]
        ep_nodes = [n for n in self.nodes.values() if n.node_type == NodeType.API_ENDPOINT]

        for vn in vuln_nodes:
            sev = (vn.properties.get("severity") or "medium").lower()
            score += weights.get(sev, 5)

        # Secrets add 15 points per hardcoded credential
        score += len(secret_nodes) * 15

        # Exposed API endpoints add 2 points each
        score += min(30, len(ep_nodes) * 2)

        final_score = min(100, score)
        risk_level = "CRITICAL" if final_score >= 80 else ("HIGH" if final_score >= 50 else ("MEDIUM" if final_score >= 25 else "LOW"))

        return {
            "target_domain": self.target_domain,
            "contextual_risk_score": final_score,
            "risk_level": risk_level,
            "metrics": {
                "total_nodes": len(self.nodes),
                "total_edges": len(self.edges),
                "vulnerabilities_count": len(vuln_nodes),
                "secrets_count": len(secret_nodes),
                "api_endpoints_count": len(ep_nodes),
            },
        }

    def get_summary(self) -> Dict[str, Any]:
        risk_data = self.calculate_contextual_risk_score()
        return {
            "target_domain": self.target_domain,
            "risk": risk_data,
            "node_distribution": {
                nt.value: len([n for n in self.nodes.values() if n.node_type == nt])
                for nt in NodeType
            },
            "total_edges": len(self.edges),
            "sample_nodes": [n.to_dict() for n in list(self.nodes.values())[:10]],
        }
