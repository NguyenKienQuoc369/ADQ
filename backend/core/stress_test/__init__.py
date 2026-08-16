"""
Chức năng 3: Tấn công chịu tải & Rate Limit (Stress Testing & WAF Evasion)
Bao gồm:
- stress_orchestrator: Bộ điều phối kiểm thử chịu tải k6 / Go / Python L7 native engine
- waf_evasion: Kỹ thuật xoay vòng Header, IP spoofing và bypass WAF
"""

from .stress_orchestrator import StressOrchestrator
from .waf_evasion import AdaptiveWAFEvasionEngine

WAFEvasionEngine = AdaptiveWAFEvasionEngine

__all__ = [
    "StressOrchestrator",
    "AdaptiveWAFEvasionEngine",
    "WAFEvasionEngine",
]
