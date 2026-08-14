"""Core package for Quoc Omni scanning logic."""

import sys
import importlib

# Pre-register submodules in sys.modules so 'from core.xyz import ...' or 'from backend.core.xyz import ...' work seamlessly
_submodule_mapping = {
    "scanner": "backend.core.recon.scanner",
    "js_analyzer": "backend.core.recon.js_analyzer",
    "apk_analyzer": "backend.core.recon.apk_analyzer",
    "raw_socket_prober": "backend.core.recon.raw_socket_prober",
    "asm_diff": "backend.core.recon.asm_diff",
    "waf_detector": "backend.core.security.waf_detector",
    "waf_evasion": "backend.core.security.waf_evasion",
    "stress_orchestrator": "backend.core.security.stress_orchestrator",
    "param_fuzzer": "backend.core.fuzzing.param_fuzzer",
    "protocol_fuzzer": "backend.core.fuzzing.protocol_fuzzer",
    "protocol_analyzer": "backend.core.fuzzing.protocol_analyzer",
    "logic_chain": "backend.core.fuzzing.logic_chain",
    "payload_mutation": "backend.core.fuzzing.payload_mutation",
    "ai_agent": "backend.core.ai.ai_agent",
    "copilot_engine": "backend.core.ai.copilot_engine",
    "copilot_masker": "backend.core.ai.copilot_masker",
    "knowledge_graph": "backend.core.ai.knowledge_graph",
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

from .recon import *
from .security import *
from .fuzzing import *
from .ai import *
from .engine import *
