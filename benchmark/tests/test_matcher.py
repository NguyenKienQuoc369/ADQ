"""
Unit tests for the Benchmark Matcher, Normalizer, and Metrics engines.
"""
import os
import json
import pytest

from benchmark.runner.normalizer import normalize_category, normalize_endpoint, normalize_parameter
from benchmark.runner.matcher import BenchmarkMatcher, FindingClassification
from benchmark.runner.metrics import calculate_metrics
from benchmark.runner.scorer import BenchmarkScorer


@pytest.fixture
def synthetic_manifest():
    fixture_path = os.path.join(os.path.dirname(__file__), "fixtures", "synthetic_manifest.json")
    with open(fixture_path, "r", encoding="utf-8") as f:
        return json.load(f)


def test_normalizer():
    assert normalize_category("sqli") == "SQL Injection"
    assert normalize_category("reflected_xss") == "Cross-Site Scripting"
    assert normalize_category("secret") == "Exposed Secrets"
    assert normalize_category("port_scan") == "Open Service"
    assert normalize_category("swagger-api") == "Sensitive Endpoint Exposure"
    assert normalize_category("prometheus-metrics") == "Sensitive Endpoint Exposure"
    assert normalize_category("unknown_xyz") == "unknown_xyz"

    assert normalize_endpoint("http://127.0.0.1:8000/api/users?search=1#ref") == "/api/users"
    assert normalize_endpoint("/api/users/") == "/api/users"
    assert normalize_endpoint("profile") == "/profile"
    assert normalize_endpoint("") == "/"

    assert normalize_parameter(" Search ") == "search"
    assert normalize_parameter(None) is None


def test_exact_true_positive(synthetic_manifest):
    matcher = BenchmarkMatcher(synthetic_manifest)
    findings = [
        {
            "id": "f1",
            "category": "SQL Injection",
            "endpoint": "http://127.0.0.1:8000/api/users",
            "parameter": "search",
            "severity": "HIGH",
        }
    ]
    results = matcher.evaluate(findings)
    tp_results = [r for r in results if r.classification == FindingClassification.TRUE_POSITIVE]
    assert len(tp_results) == 1
    assert tp_results[0].matched_gt_id == "SYN-SQLI-01"
    assert tp_results[0].severity_match is True


def test_sensitive_endpoint_exposure_matcher():
    manifest = {
        "manifest_version": "2.0.0",
        "target_name": "API Target",
        "entries": [
            {
                "id": "EP-SWAGGER",
                "expected": "POSITIVE",
                "category": "Sensitive Endpoint Exposure",
                "endpoint": "/api-docs",
                "severity_reference": "LOW"
            },
            {
                "id": "EP-METRICS",
                "expected": "POSITIVE",
                "category": "Sensitive Endpoint Exposure",
                "endpoint": "/metrics",
                "severity_reference": "LOW"
            }
        ]
    }
    matcher = BenchmarkMatcher(manifest)
    findings = [
        {
            "id": "f1",
            "category": "swagger-api",
            "endpoint": "http://127.0.0.1:3000/api-docs/swagger.yaml",
            "severity": "INFO"
        },
        {
            "id": "f2",
            "category": "prometheus-metrics",
            "endpoint": "http://127.0.0.1:3000/metrics",
            "severity": "MEDIUM"
        }
    ]
    results = matcher.evaluate(findings)
    tps = [r for r in results if r.classification == FindingClassification.TRUE_POSITIVE]
    assert len(tps) == 2
    matched_ids = {r.matched_gt_id for r in tps}
    assert matched_ids == {"EP-SWAGGER", "EP-METRICS"}


def test_parameter_mismatch_becomes_unknown(synthetic_manifest):
    matcher = BenchmarkMatcher(synthetic_manifest)
    findings = [
        {
            "id": "f1",
            "category": "SQL Injection",
            "endpoint": "/api/users",
            "parameter": "other_param",  # Manifest expects 'search'
            "severity": "HIGH",
        }
    ]
    results = matcher.evaluate(findings)
    unknowns = [r for r in results if r.classification == FindingClassification.UNKNOWN]
    assert len(unknowns) == 1
    assert unknowns[0].finding_id == "f1"


def test_explicit_false_positive(synthetic_manifest):
    matcher = BenchmarkMatcher(synthetic_manifest)
    findings = [
        {
            "id": "f2",
            "category": "SQL Injection",
            "endpoint": "/api/health",
            "severity": "HIGH",
        }
    ]
    results = matcher.evaluate(findings)
    fps = [r for r in results if r.classification == FindingClassification.FALSE_POSITIVE]
    assert len(fps) == 1
    assert fps[0].matched_gt_id == "SYN-NEG-01"


def test_uncovered_finding_does_not_count_as_fp(synthetic_manifest):
    matcher = BenchmarkMatcher(synthetic_manifest)
    findings = [
        {
            "id": "f_uncovered",
            "category": "SQL Injection",
            "endpoint": "/api/uncovered_endpoint",
            "parameter": "foo",
            "severity": "LOW",
        }
    ]
    results = matcher.evaluate(findings)
    fps = [r for r in results if r.classification == FindingClassification.FALSE_POSITIVE]
    unknowns = [r for r in results if r.classification == FindingClassification.UNKNOWN]
    assert len(fps) == 0
    assert len(unknowns) == 1


def test_false_negatives_identified(synthetic_manifest):
    matcher = BenchmarkMatcher(synthetic_manifest)
    # No findings provided -> all 3 positive controls must be false negatives
    results = matcher.evaluate([])
    fns = [r for r in results if r.classification == FindingClassification.FALSE_NEGATIVE]
    assert len(fns) == 3
    fn_ids = {r.matched_gt_id for r in fns}
    assert fn_ids == {"SYN-SQLI-01", "SYN-XSS-01", "SYN-PORT-01"}


def test_true_positive_deduplication(synthetic_manifest):
    matcher = BenchmarkMatcher(synthetic_manifest)
    findings = [
        {
            "id": "f1",
            "category": "SQL Injection",
            "endpoint": "/api/users",
            "parameter": "search",
            "severity": "HIGH",
        },
        {
            "id": "f2",
            "category": "SQL Injection",
            "endpoint": "/api/users",
            "parameter": "search",
            "severity": "HIGH",
        },
    ]
    results = matcher.evaluate(findings)
    tps = [r for r in results if r.classification == FindingClassification.TRUE_POSITIVE]
    dup_tps = [r for r in results if r.classification == FindingClassification.DUPLICATE_POSITIVE]
    assert len(tps) == 1
    assert len(dup_tps) == 1
    assert tps[0].matched_gt_id == "SYN-SQLI-01"
    assert dup_tps[0].matched_gt_id == "SYN-SQLI-01"


def test_metrics_calculation_and_division_safety(synthetic_manifest):
    matcher = BenchmarkMatcher(synthetic_manifest)
    findings = [
        # 1 TP
        {
            "id": "f1",
            "category": "SQL Injection",
            "endpoint": "/api/users",
            "parameter": "search",
            "severity": "HIGH",
        },
        # 1 FP (explicit negative match)
        {
            "id": "f2",
            "category": "SQL Injection",
            "endpoint": "/api/health",
            "severity": "HIGH",
        },
        # 1 UNKNOWN
        {
            "id": "f3",
            "category": "Cross-Site Scripting",
            "endpoint": "/random",
            "parameter": "x",
            "severity": "LOW",
        }
    ]
    results = matcher.evaluate(findings)
    metrics = calculate_metrics(results, total_positive_gt=3, total_negative_gt=2)
    
    assert metrics.tp_count == 1
    assert metrics.fp_count == 1
    assert metrics.fn_count == 2
    assert metrics.unknown_count == 1
    # Precision = 1 / (1 + 1) = 0.50
    assert metrics.precision == 0.50
    # Recall = 1 / (1 + 2) = 0.3333
    assert metrics.recall == pytest.approx(0.3333, abs=0.001)
    # Severity concordance = 1.0 (f1 matched HIGH)
    assert metrics.severity_concordance_rate == 1.0


def test_zero_precision_denominator_is_none(synthetic_manifest):
    matcher = BenchmarkMatcher(synthetic_manifest)
    # Empty findings -> TP = 0, FP = 0 -> Precision = None
    empty_results = matcher.evaluate([])
    empty_metrics = calculate_metrics(empty_results, total_positive_gt=3, total_negative_gt=2)
    assert empty_metrics.precision is None
    assert empty_metrics.recall == 0.0  # 0 TP / (0 TP + 3 FN) = 0.0
    assert empty_metrics.f1_score is None
    assert empty_metrics.severity_concordance_rate is None


def test_zero_recall_denominator_is_none():
    # Empty ground truth -> total_positive_gt = 0, findings = []
    # TP = 0, FN = 0 -> Recall = None
    empty_manifest = {
        "manifest_version": "2.0.0",
        "target_name": "Empty Target",
        "entries": []
    }
    matcher = BenchmarkMatcher(empty_manifest)
    results = matcher.evaluate([])
    metrics = calculate_metrics(results, total_positive_gt=0, total_negative_gt=0)
    assert metrics.precision is None
    assert metrics.recall is None
    assert metrics.f1_score is None


def test_scorer_full_pipeline(synthetic_manifest, tmp_path):
    fixture_path = os.path.join(os.path.dirname(__file__), "fixtures", "synthetic_manifest.json")
    scorer = BenchmarkScorer(fixture_path)
    score_out = scorer.score_findings([
        {
            "id": "f1",
            "category": "Cross-Site Scripting",
            "endpoint": "/profile",
            "parameter": "bio",
            "severity": "MEDIUM",
        }
    ])
    assert score_out["metrics"]["true_positives"] == 1
    assert score_out["metrics"]["false_positives"] == 0
    assert score_out["metrics"]["precision"] == 1.0

    # Export test
    exported = scorer.export_results(score_out, str(tmp_path), "test_run")
    assert os.path.exists(exported["json"])
    assert os.path.exists(exported["csv"])

    # Verify CSV contains string values and N/A where appropriate
    with open(exported["csv"], "r", encoding="utf-8") as f:
        csv_content = f.read()
        assert "Synthetic Test Target,true_positives,1" in csv_content
