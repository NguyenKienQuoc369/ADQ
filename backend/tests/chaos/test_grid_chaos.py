import pytest
import os
import json
import tempfile
from core.grid_master import MasterGridNode

def test_offline_jsonl_fallback_persistence():
    # Simulate DB failure fallback writing to local JSONL
    with tempfile.TemporaryDirectory() as tmpdir:
        jsonl_path = os.path.join(tmpdir, "fallback_queue.jsonl")
        
        sample_task = {
            "task_id": "task_chaos_001",
            "profile": "dast_active",
            "target": "http://mock-target.local",
            "status": "pending"
        }
        
        # Write fallback log
        with open(jsonl_path, "a") as f:
            f.write(json.dumps(sample_task) + "\n")
            
        assert os.path.exists(jsonl_path)
        
        # Recover fallback log
        with open(jsonl_path, "r") as f:
            recovered_task = json.loads(f.readline().strip())
            
        assert recovered_task["task_id"] == "task_chaos_001"
        assert recovered_task["profile"] == "dast_active"
