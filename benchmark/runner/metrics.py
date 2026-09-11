"""
Metrics calculations for DAST accuracy benchmark (Precision, Recall, F1, Severity Concordance).
"""
from dataclasses import dataclass, field
from typing import List, Dict, Any
from .matcher import MatchResult, FindingClassification


@dataclass
class BenchmarkMetrics:
    total_positive_gt: int
    total_negative_gt: int
    tp_count: int
    fp_count: int
    fn_count: int
    unknown_count: int
    duplicate_tp_count: int
    precision: Optional[float]
    recall: Optional[float]
    f1_score: Optional[float]
    severity_concordance_rate: Optional[float]
    category_breakdown: Dict[str, Dict[str, int]] = field(default_factory=dict)


def calculate_metrics(results: List[MatchResult], total_positive_gt: int, total_negative_gt: int) -> BenchmarkMetrics:
    """
    Calculate evaluation metrics from a list of MatchResult objects.
    Undefined metrics due to zero denominator return None (rendered as null in JSON, N/A in reports).
    """
    tp_count = sum(1 for r in results if r.classification == FindingClassification.TRUE_POSITIVE)
    fp_count = sum(1 for r in results if r.classification == FindingClassification.FALSE_POSITIVE)
    fn_count = sum(1 for r in results if r.classification == FindingClassification.FALSE_NEGATIVE)
    unknown_count = sum(1 for r in results if r.classification == FindingClassification.UNKNOWN)
    duplicate_tp_count = sum(1 for r in results if r.classification == FindingClassification.DUPLICATE_POSITIVE)

    # Precision = TP / (TP + FP)
    precision_denom = tp_count + fp_count
    precision = (tp_count / precision_denom) if precision_denom > 0 else None

    # Recall = TP / (TP + FN)
    recall_denom = tp_count + fn_count
    recall = (tp_count / recall_denom) if recall_denom > 0 else None

    # F1 = 2 * (Precision * Recall) / (Precision + Recall)
    if precision is None or recall is None or (precision + recall) == 0:
        f1_score = None
    else:
        f1_score = 2.0 * precision * recall / (precision + recall)

    # Severity Concordance on True Positives
    if tp_count > 0:
        tp_with_sev_match = sum(1 for r in results if r.classification == FindingClassification.TRUE_POSITIVE and r.severity_match)
        severity_concordance = tp_with_sev_match / tp_count
    else:
        severity_concordance = None

    # Category breakdown
    categories = set(r.category for r in results if r.category)
    category_breakdown: Dict[str, Dict[str, int]] = {}
    for cat in categories:
        category_breakdown[cat] = {
            "TP": sum(1 for r in results if r.category == cat and r.classification == FindingClassification.TRUE_POSITIVE),
            "FP": sum(1 for r in results if r.category == cat and r.classification == FindingClassification.FALSE_POSITIVE),
            "FN": sum(1 for r in results if r.category == cat and r.classification == FindingClassification.FALSE_NEGATIVE),
            "UNKNOWN": sum(1 for r in results if r.category == cat and r.classification == FindingClassification.UNKNOWN),
        }

    return BenchmarkMetrics(
        total_positive_gt=total_positive_gt,
        total_negative_gt=total_negative_gt,
        tp_count=tp_count,
        fp_count=fp_count,
        fn_count=fn_count,
        unknown_count=unknown_count,
        duplicate_tp_count=duplicate_tp_count,
        precision=round(precision, 4) if precision is not None else None,
        recall=round(recall, 4) if recall is not None else None,
        f1_score=round(f1_score, 4) if f1_score is not None else None,
        severity_concordance_rate=round(severity_concordance, 4) if severity_concordance is not None else None,
        category_breakdown=category_breakdown,
    )

