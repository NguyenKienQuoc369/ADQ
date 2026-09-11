"""
Matcher engine evaluating scanner findings against Positive and Negative Ground Truth controls.
"""
from dataclasses import dataclass, field
from enum import Enum
from typing import Dict, List, Any, Optional, Set

from .normalizer import normalize_category, normalize_endpoint, normalize_parameter


class FindingClassification(str, Enum):
    TRUE_POSITIVE = "TRUE_POSITIVE"
    DUPLICATE_POSITIVE = "DUPLICATE_POSITIVE"
    FALSE_POSITIVE = "FALSE_POSITIVE"
    UNKNOWN = "UNKNOWN"
    FALSE_NEGATIVE = "FALSE_NEGATIVE"


@dataclass
class MatchResult:
    finding_id: Optional[str]
    classification: FindingClassification
    matched_gt_id: Optional[str]
    category: str
    endpoint: Optional[str]
    parameter: Optional[str]
    scanner_severity: Optional[str]
    reference_severity: Optional[str]
    severity_match: bool
    details: Dict[str, Any] = field(default_factory=dict)


class BenchmarkMatcher:
    def __init__(self, ground_truth: Dict[str, Any]):
        self.ground_truth = ground_truth
        self.entries = ground_truth.get("entries", [])
        self.positive_controls = [e for e in self.entries if e.get("expected") == "POSITIVE"]
        self.negative_controls = [e for e in self.entries if e.get("expected") == "NEGATIVE"]

    def _entry_matches_finding(self, gt_entry: Dict[str, Any], finding: Dict[str, Any]) -> bool:
        """Check if a ground truth entry matches a finding."""
        gt_cat = normalize_category(gt_entry.get("category"))
        f_cat = normalize_category(finding.get("category") or finding.get("type") or finding.get("name"))

        if gt_cat != f_cat:
            return False

        # Category-specific match logic
        if gt_cat in ("SQL Injection", "Cross-Site Scripting", "Command Injection", "Local File Inclusion"):
            gt_ep = normalize_endpoint(gt_entry.get("endpoint"))
            f_ep = normalize_endpoint(finding.get("endpoint") or finding.get("url") or finding.get("path"))
            if gt_ep != f_ep:
                return False

            gt_param = normalize_parameter(gt_entry.get("parameter"))
            f_param = normalize_parameter(finding.get("parameter") or finding.get("param"))
            if gt_param is not None:
                if f_param is None or gt_param != f_param:
                    return False
            return True

        if gt_cat == "Open Service":
            gt_port = gt_entry.get("port")
            f_port = finding.get("port")
            if f_port is not None and gt_port is not None:
                try:
                    if int(gt_port) != int(f_port):
                        return False
                except (ValueError, TypeError):
                    return False
            return True

        if gt_cat == "Exposed Secrets":
            gt_res = gt_entry.get("resource") or gt_entry.get("endpoint")
            f_res = finding.get("resource") or finding.get("endpoint") or finding.get("url") or finding.get("file")
            if gt_res and f_res:
                if gt_res not in f_res and normalize_endpoint(gt_res) != normalize_endpoint(f_res):
                    return False
            gt_sec_type = gt_entry.get("secret_type")
            f_sec_type = finding.get("secret_type") or finding.get("type")
            if gt_sec_type and f_sec_type:
                if gt_sec_type.lower() not in f_sec_type.lower():
                    return False
            return True

        if gt_cat == "Known CVE":
            gt_cve = (gt_entry.get("cve") or gt_entry.get("cve_id") or "").strip().upper()
            f_cve = (finding.get("cve") or finding.get("cve_id") or finding.get("name") or "").strip().upper()
            if gt_cve and f_cve:
                if gt_cve not in f_cve:
                    return False
            return True

        if gt_cat == "Sensitive Endpoint Exposure":
            gt_ep = normalize_endpoint(gt_entry.get("endpoint"))
            f_ep = normalize_endpoint(finding.get("endpoint") or finding.get("url") or finding.get("path"))
            return gt_ep == f_ep or f_ep.startswith(gt_ep)

        # Misconfigurations & Other Endpoints
        gt_ep = normalize_endpoint(gt_entry.get("endpoint"))
        f_ep = normalize_endpoint(finding.get("endpoint") or finding.get("url") or finding.get("path"))
        return gt_ep == f_ep

    def evaluate(self, findings: List[Dict[str, Any]]) -> List[MatchResult]:
        """
        Evaluate a list of scanner findings against positive and negative controls.
        Produces a list of MatchResults for all findings plus unmatched positive controls (FN).
        """
        results: List[MatchResult] = []
        matched_positive_gt_ids: Set[str] = set()

        for idx, finding in enumerate(findings):
            f_id = str(finding.get("id") or f"finding-{idx+1}")
            f_cat = normalize_category(finding.get("category") or finding.get("type") or finding.get("name"))
            f_ep = finding.get("endpoint") or finding.get("url") or finding.get("path")
            f_param = finding.get("parameter") or finding.get("param")
            f_sev = (finding.get("severity") or "UNKNOWN").upper()

            # 1. Test Positive Controls
            matched_pos = None
            for pos_entry in self.positive_controls:
                if self._entry_matches_finding(pos_entry, finding):
                    matched_pos = pos_entry
                    break

            if matched_pos:
                gt_id = matched_pos["id"]
                ref_sev = (matched_pos.get("severity_reference") or "").upper()
                sev_match = bool(ref_sev and f_sev == ref_sev)

                if gt_id not in matched_positive_gt_ids:
                    matched_positive_gt_ids.add(gt_id)
                    results.append(MatchResult(
                        finding_id=f_id,
                        classification=FindingClassification.TRUE_POSITIVE,
                        matched_gt_id=gt_id,
                        category=f_cat,
                        endpoint=f_ep,
                        parameter=f_param,
                        scanner_severity=f_sev,
                        reference_severity=ref_sev,
                        severity_match=sev_match,
                        details={"ground_truth": matched_pos, "raw_finding": finding}
                    ))
                else:
                    results.append(MatchResult(
                        finding_id=f_id,
                        classification=FindingClassification.DUPLICATE_POSITIVE,
                        matched_gt_id=gt_id,
                        category=f_cat,
                        endpoint=f_ep,
                        parameter=f_param,
                        scanner_severity=f_sev,
                        reference_severity=ref_sev,
                        severity_match=sev_match,
                        details={"ground_truth": matched_pos, "raw_finding": finding}
                    ))
                continue

            # 2. Test Negative Controls (Explicit FP)
            matched_neg = None
            for neg_entry in self.negative_controls:
                if self._entry_matches_finding(neg_entry, finding):
                    matched_neg = neg_entry
                    break

            if matched_neg:
                gt_id = matched_neg["id"]
                results.append(MatchResult(
                    finding_id=f_id,
                    classification=FindingClassification.FALSE_POSITIVE,
                    matched_gt_id=gt_id,
                    category=f_cat,
                    endpoint=f_ep,
                    parameter=f_param,
                    scanner_severity=f_sev,
                    reference_severity=None,
                    severity_match=False,
                    details={"ground_truth": matched_neg, "raw_finding": finding}
                ))
                continue

            # 3. Uncovered finding (Unknown / Unscorable)
            results.append(MatchResult(
                finding_id=f_id,
                classification=FindingClassification.UNKNOWN,
                matched_gt_id=None,
                category=f_cat,
                endpoint=f_ep,
                parameter=f_param,
                scanner_severity=f_sev,
                reference_severity=None,
                severity_match=False,
                details={"raw_finding": finding}
            ))

        # 4. Identify False Negatives (Unmatched Positive Controls)
        for pos_entry in self.positive_controls:
            gt_id = pos_entry["id"]
            if gt_id not in matched_positive_gt_ids:
                results.append(MatchResult(
                    finding_id=None,
                    classification=FindingClassification.FALSE_NEGATIVE,
                    matched_gt_id=gt_id,
                    category=normalize_category(pos_entry.get("category")),
                    endpoint=pos_entry.get("endpoint"),
                    parameter=pos_entry.get("parameter"),
                    scanner_severity=None,
                    reference_severity=pos_entry.get("severity_reference"),
                    severity_match=False,
                    details={"ground_truth": pos_entry}
                ))

        return results

