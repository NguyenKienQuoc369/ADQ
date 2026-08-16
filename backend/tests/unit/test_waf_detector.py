from backend.core.waf_detector import WAFFingerprintDetector, detect_target_waf

def test_waf_detector_passive_and_active():
    detector = WAFFingerprintDetector()
    res = detector.detect_waf("https://httpbin.org/get")
    assert "target" in res
    assert "detected_wafs" in res
    assert isinstance(res["detected_wafs"], list)

def test_waf_detector_helper():
    res = detect_target_waf("https://example.com")
    assert res["target"] == "https://example.com"
    assert "has_waf" in res
