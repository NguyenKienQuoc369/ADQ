"""
ADQ Unit Economics & Cost Calculation Engine
Phase C1.1 — Strict Classification & Formula Integrity
"""

import json
from pathlib import Path
from typing import Dict, Any, Optional


def load_json_file(path: Path) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


class UnitEconomicsEngine:
    def __init__(self, base_dir: Path, config_path: Optional[Path] = None):
        self.base_dir = base_dir
        self.config_path = config_path or (base_dir / "config" / "cost_inputs.example.json")
        self.config = load_json_file(self.config_path)
        self.bounds = load_json_file(base_dir / "analysis" / "theoretical_tier_bounds.json")
        self.dast_wl = load_json_file(base_dir / "workloads" / "dast_workload.json")
        self.stress_wl = load_json_file(base_dir / "workloads" / "stress_workload.json")
        self.copilot_wl = load_json_file(base_dir / "workloads" / "copilot_workload.json")

    def get_fixed_platform_cost_monthly_vnd(self) -> Optional[float]:
        """Calculates total fixed platform cost. Returns None if any required field is null."""
        costs = self.config.get("fixed_infrastructure_monthly_vnd", {})
        if not costs or any(v is None for v in costs.values()):
            return None
        return sum(costs.values())

    def calculate_dast_unit_cost_vnd(
        self,
        include_ai: bool = True,
        cpu_seconds: Optional[float] = None,
        egress_mb: Optional[float] = None,
        prompt_tokens: Optional[int] = None,
        candidate_tokens: Optional[int] = None
    ) -> Dict[str, Any]:
        """Calculates marginal variable cost of 1 DAST scan. Returns nulls if inputs are unmeasured."""
        vc_config = self.config.get("variable_resource_unit_costs_vnd", {})
        ai_config = self.config.get("ai_api_token_pricing_vnd", {})

        vcpu_hour_rate = vc_config.get("vps_vcpu_hour")
        egress_gb_rate = vc_config.get("network_egress_per_gb")
        p_in = ai_config.get("ai_input_cost_per_million_tokens_vnd")
        p_out = ai_config.get("ai_output_cost_per_million_tokens_vnd")

        if vcpu_hour_rate is None or cpu_seconds is None:
            cpu_cost = None
        else:
            cpu_cost = round((cpu_seconds / 3600.0) * vcpu_hour_rate, 4)

        if egress_gb_rate is None or egress_mb is None:
            egress_cost = None
        else:
            egress_cost = round((egress_mb / 1024.0) * egress_gb_rate, 4)

        if not include_ai:
            ai_cost = 0.0
        elif p_in is None or p_out is None or prompt_tokens is None or candidate_tokens is None:
            ai_cost = None
        else:
            ai_cost = round((prompt_tokens / 1_000_000 * p_in) + (candidate_tokens / 1_000_000 * p_out), 4)

        if cpu_cost is None or egress_cost is None or (include_ai and ai_cost is None):
            total_unit_cost = None
            classification = "UNMEASURED"
        else:
            total_unit_cost = round(cpu_cost + egress_cost + ai_cost, 4)
            classification = "DERIVED_FROM_MEASURED"

        return {
            "compute_cpu_vnd": cpu_cost,
            "network_egress_vnd": egress_cost,
            "ai_token_vnd": ai_cost,
            "total_unit_cost_vnd": total_unit_cost,
            "classification": classification
        }

    def calculate_stress_unit_cost_vnd(
        self,
        tier: str = "PRO",
        cpu_seconds: Optional[float] = None,
        egress_mb: Optional[float] = None
    ) -> Dict[str, Any]:
        """Calculates marginal variable cost of 1 L7 Stress Test. Returns nulls if inputs are unmeasured."""
        vc_config = self.config.get("variable_resource_unit_costs_vnd", {})
        vcpu_hour_rate = vc_config.get("vps_vcpu_hour")
        egress_gb_rate = vc_config.get("network_egress_per_gb")

        if vcpu_hour_rate is None or cpu_seconds is None:
            cpu_cost = None
        else:
            cpu_cost = round((cpu_seconds / 3600.0) * vcpu_hour_rate, 4)

        if egress_gb_rate is None or egress_mb is None:
            egress_cost = None
        else:
            egress_cost = round((egress_mb / 1024.0) * egress_gb_rate, 4)

        if cpu_cost is None or egress_cost is None:
            total_unit_cost = None
            classification = "UNMEASURED"
        else:
            total_unit_cost = round(cpu_cost + egress_cost, 4)
            classification = "DERIVED_FROM_MEASURED"

        return {
            "tier": tier,
            "compute_cpu_vnd": cpu_cost,
            "network_egress_vnd": egress_cost,
            "total_unit_cost_vnd": total_unit_cost,
            "classification": classification
        }

    def calculate_copilot_unit_cost_vnd(
        self,
        prompt_tokens: Optional[int] = None,
        candidate_tokens: Optional[int] = None
    ) -> Dict[str, Any]:
        """Calculates marginal AI token cost of 1 Copilot interaction."""
        ai_config = self.config.get("ai_api_token_pricing_vnd", {})
        p_in = ai_config.get("ai_input_cost_per_million_tokens_vnd")
        p_out = ai_config.get("ai_output_cost_per_million_tokens_vnd")

        if p_in is None or p_out is None or prompt_tokens is None or candidate_tokens is None:
            ai_cost = None
            classification = "UNMEASURED"
        else:
            ai_cost = round((prompt_tokens / 1_000_000 * p_in) + (candidate_tokens / 1_000_000 * p_out), 4)
            classification = "DERIVED_FROM_MEASURED"

        return {
            "prompt_tokens": prompt_tokens,
            "candidate_tokens": candidate_tokens,
            "total_unit_cost_vnd": ai_cost,
            "classification": classification
        }

    def evaluate_empirical_state_report(self) -> Dict[str, Any]:
        """Generates report based strictly on measured/configured state without assuming unmeasured values."""
        fixed_cost = self.get_fixed_platform_cost_monthly_vnd()
        dast_unit = self.calculate_dast_unit_cost_vnd(True)
        stress_unit_pro = self.calculate_stress_unit_cost_vnd("PRO")
        stress_unit_promax = self.calculate_stress_unit_cost_vnd("PRO_MAX")

        return {
            "fixed_infrastructure_monthly_vnd": fixed_cost,
            "dast_unit_cost_vnd": dast_unit["total_unit_cost_vnd"],
            "stress_unit_cost_pro_vnd": stress_unit_pro["total_unit_cost_vnd"],
            "stress_unit_cost_promax_vnd": stress_unit_promax["total_unit_cost_vnd"],
            "contribution_margin_pro_vnd": None,
            "contribution_margin_pro_max_vnd": None,
            "gross_margin_pro_percent": None,
            "gross_margin_pro_max_percent": None,
            "break_even_subscribers_pro": None,
            "break_even_subscribers_pro_max": None,
            "data_classification": "MEASURED_OR_CONFIG_ONLY",
            "unmeasured_monetary_fields": [
                "fixed_infrastructure_monthly_vnd.*",
                "variable_resource_unit_costs_vnd.*",
                "ai_api_token_pricing_vnd.*"
            ]
        }


def main():
    base_dir = Path(__file__).resolve().parent.parent
    engine = UnitEconomicsEngine(base_dir)
    report = engine.evaluate_empirical_state_report()
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
