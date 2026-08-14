"""
Core package for ADQ Enterprise Security Platform.

Cấu trúc module tính năng đồng nhất theo Terminal UI:
- recon_scan: Chức năng 1 - Rà quét & Trinh sát mạng (Recon & Vulnerability Scanning)
- mobile_audit: Chức năng 2 - Phân tích file APK (Mobile APK Audit)
- stress_test: Chức năng 3 - Tấn công chịu tải & Rate Limit (Stress Testing & WAF Evasion)
- ai_copilot: Chức năng 4 - Báo cáo & Trợ lý Copilot AI (Security Reports & AI Copilot)
- engine: Hạ tầng DAG & Distributed Master Node Engine
"""

import sys
import importlib

# Pre-register submodules in sys.modules so 'from core.xyz import ...' or 'from backend.core.xyz import ...' work seamlessly
_submodule_mapping = {
    # Chức năng 1: Recon & Scan
    "scanner": "backend.core.recon_scan.scanner",
    "js_analyzer": "backend.core.recon_scan.js_analyzer",
    "raw_socket_prober": "backend.core.recon_scan.raw_socket_prober",
    "asm_diff": "backend.core.recon_scan.asm_diff",
    "waf_detector": "backend.core.recon_scan.waf_detector",
    "param_fuzzer": "backend.core.recon_scan.param_fuzzer",
    "protocol_fuzzer": "backend.core.recon_scan.protocol_fuzzer",
    "protocol_analyzer": "backend.core.recon_scan.protocol_analyzer",
    "logic_chain": "backend.core.recon_scan.logic_chain",
    "payload_mutation": "backend.core.recon_scan.payload_mutation",

    # Chức năng 2: Mobile APK Audit
    "apk_analyzer": "backend.core.mobile_audit.apk_analyzer",

    # Chức năng 3: Stress Test & WAF Evasion
    "stress_orchestrator": "backend.core.stress_test.stress_orchestrator",
    "waf_evasion": "backend.core.stress_test.waf_evasion",

    # Chức năng 4: AI Copilot & Security Reports
    "ai_agent": "backend.core.ai_copilot.ai_agent",
    "copilot_engine": "backend.core.ai_copilot.copilot_engine",
    "copilot_masker": "backend.core.ai_copilot.copilot_masker",
    "knowledge_graph": "backend.core.ai_copilot.knowledge_graph",

    # Hạ tầng chung: Engine
    "dag_engine": "backend.core.engine.dag_engine",
    "dag_state_manager": "backend.core.engine.dag_state_manager",
    "dispatcher": "backend.core.engine.dispatcher",
    "grid_master": "backend.core.engine.grid_master",
    "hive_mind": "backend.core.engine.hive_mind",
    "oast_server": "backend.core.engine.oast_server",
    "session_manager": "backend.core.engine.session_manager",
    "rust_accelerator": "backend.core.engine.rust_accelerator",
    "db": "backend.core.engine.db",
    "parser": "backend.core.engine.parser",
}

for _short_name, _full_path in _submodule_mapping.items():
    _mod = importlib.import_module(_full_path)
    sys.modules[f"backend.core.{_short_name}"] = _mod
    sys.modules[f"core.{_short_name}"] = _mod

from .recon_scan import *
from .mobile_audit import *
from .stress_test import *
from .ai_copilot import *
from .engine import *
