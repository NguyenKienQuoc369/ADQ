import pytest
import tracemalloc
from core.knowledge_graph import SecurityKnowledgeGraph, NodeType, EdgeType

def test_pipeline_memory_leak_and_graph_scale():
    tracemalloc.start()
    
    # 1. Instantiate Security Knowledge Graph
    target_domain = "target-enterprise.com"
    kg = SecurityKnowledgeGraph(target_domain=target_domain)
    root_id = f"domain:{target_domain}"
    
    # 2. Inject 1,000 Synthetic Subdomains and Endpoints
    for i in range(1000):
        sub = f"sub{i}.target-enterprise.com"
        sub_id = f"domain:{sub}"
        kg.add_node(sub_id, label=sub, node_type=NodeType.DOMAIN)
        kg.add_edge(root_id, sub_id, EdgeType.HOSTS)
        
        ep_id = f"endpoint:https://{sub}/api/v1/user"
        kg.add_node(ep_id, label=f"https://{sub}/api/v1/user", node_type=NodeType.API_ENDPOINT)
        kg.add_edge(sub_id, ep_id, EdgeType.EXPOSES)

    # Measure memory usage
    current, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    
    # Verify graph scale (1 root domain + 1000 subdomains + 1000 endpoints = 2001 nodes)
    assert len(kg.nodes) == 2001
    # Assert peak memory is within acceptable enterprise bounds (< 50MB for 2000 nodes)
    assert peak / 1024 / 1024 < 50.0

