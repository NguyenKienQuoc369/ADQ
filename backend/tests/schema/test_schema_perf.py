import pytest
import time
from core.knowledge_graph import SecurityKnowledgeGraph, NodeType, EdgeType

def test_top_vulnerabilities_query_performance():
    target_domain = "perf-target.com"
    kg = SecurityKnowledgeGraph(target_domain=target_domain)
    root_id = f"domain:{target_domain}"
    
    # Populate graph with 500 endpoints and vulnerabilities
    for i in range(500):
        ep_url = f"https://perf-target.com/api/{i}"
        ep_id = f"endpoint:{ep_url}"
        kg.add_node(ep_id, label=ep_url, node_type=NodeType.API_ENDPOINT)
        kg.add_edge(root_id, ep_id, EdgeType.EXPOSES)
        
        if i % 10 == 0:
            vuln_id = f"vuln:CVE-2026-MOCK-{i}"
            kg.add_node(
                vuln_id,
                label=f"CVE-2026-MOCK-{i}",
                node_type=NodeType.VULNERABILITY,
                properties={"severity": "CRITICAL", "cvss": 9.8}
            )
            kg.add_edge(ep_id, vuln_id, EdgeType.HAS_VULNERABILITY)
            
    # Measure execution time for filtering critical vulnerabilities
    start_time = time.perf_counter()
    
    critical_vulns = [
        node for node in kg.nodes.values()
        if node.node_type == NodeType.VULNERABILITY and node.properties.get("severity") == "CRITICAL"
    ]
    
    elapsed_ms = (time.perf_counter() - start_time) * 1000.0
    
    assert len(critical_vulns) == 50
    # Schema query performance benchmark < 100ms threshold
    assert elapsed_ms < 100.0

