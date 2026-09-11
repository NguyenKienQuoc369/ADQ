"""
Offline Scoring Harness for DAST Accuracy Benchmark.
"""
import csv
import json
import os
from typing import Dict, List, Any, Optional
from datetime import datetime, timezone

from .matcher import BenchmarkMatcher, MatchResult, FindingClassification
from .metrics import calculate_metrics, BenchmarkMetrics


class BenchmarkScorer:
    def __init__(self, ground_truth_path: str):
        with open(ground_truth_path, "r", encoding="utf-8") as f:
            self.ground_truth = json.load(f)
        self.matcher = BenchmarkMatcher(self.ground_truth)

    def score_findings(self, findings: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Score a list of findings against ground truth."""
        results = self.matcher.evaluate(findings)
        pos_gt = len(self.matcher.positive_controls)
        neg_gt = len(self.matcher.negative_controls)
        metrics = calculate_metrics(results, pos_gt, neg_gt)

        return {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "target_name": self.ground_truth.get("target_name"),
            "target_version": self.ground_truth.get("target_version"),
            "metrics": {
                "total_positive_ground_truth": metrics.total_positive_gt,
                "total_negative_ground_truth": metrics.total_negative_gt,
                "true_positives": metrics.tp_count,
                "false_positives": metrics.fp_count,
                "false_negatives": metrics.fn_count,
                "unknown_unscorable": metrics.unknown_count,
                "duplicate_positives": metrics.duplicate_tp_count,
                "precision": metrics.precision,
                "recall": metrics.recall,
                "f1_score": metrics.f1_score,
                "severity_concordance_rate": metrics.severity_concordance_rate,
            },
            "category_breakdown": metrics.category_breakdown,
            "detailed_matches": [
                {
                    "finding_id": r.finding_id,
                    "classification": r.classification.value,
                    "matched_gt_id": r.matched_gt_id,
                    "category": r.category,
                    "endpoint": r.endpoint,
                    "parameter": r.parameter,
                    "scanner_severity": r.scanner_severity,
                    "reference_severity": r.reference_severity,
                    "severity_match": r.severity_match,
                }
                for r in results
            ],
        }

    def export_results(self, score_output: Dict[str, Any], output_dir: str, run_id: str = "run_1") -> Dict[str, str]:
        """Save results to JSON and CSV formats."""
        os.makedirs(output_dir, exist_ok=True)
        target_slug = (score_output.get("target_name") or "target").lower().replace(" ", "_")
        json_path = os.path.join(output_dir, f"score_{target_slug}_{run_id}.json")
        csv_path = os.path.join(output_dir, f"score_{target_slug}_{run_id}.csv")

        # Write JSON
        with open(json_path, "w", encoding="utf-8") as f:
            json.dump(score_output, f, indent=2)

        # Write CSV
        with open(csv_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["Target", "Metric", "Value"])
            for k, v in score_output["metrics"].items():
                val_str = "N/A" if v is None else str(v)
                writer.writerow([score_output.get("target_name"), k, val_str])

        return {"json": json_path, "csv": csv_path}
