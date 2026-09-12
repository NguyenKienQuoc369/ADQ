"""
ADQ Security Copilot - Product Help Registry (Python Server-Side)
Authoritative static registry of actual authenticated features and UX guidance.
Zero-hallucination source for Product Help queries.
"""

from typing import Dict, Any, List, Optional

PRODUCT_HELP_REGISTRY: Dict[str, Dict[str, Any]] = {
    "projects": {
        "id": "projects",
        "display_name": "Dự án & Targets",
        "route": "/dashboard",
        "purpose": "Quản lý danh sách các dự án bảo mật, mục tiêu (domain/website) và theo dõi trạng thái xác minh quyền sở hữu.",
        "requirements": ["Đăng nhập tài khoản ADQ."],
        "primary_actions": [
            "Bấm nút '+ Thêm dự án' để tạo dự án mới.",
            "Nhập Tên dự án, Domain/URL mục tiêu và Mô tả.",
            "Mở dự án để truy cập Tổng quan, Scan, Stress Test và Lịch sử.",
        ],
        "common_questions": {
            "tạo dự án": "Truy cập mục 'Dự án & Targets' (/dashboard) từ thanh menu bên trái, sau đó bấm nút '+ Thêm dự án' ở góc trên bên phải.",
            "dự án": "Vào /dashboard để quản lý toàn bộ các dự án và mục tiêu domain của bạn.",
        },
        "related_features": ["target_verification", "scan", "stress_test"],
    },
    "target_verification": {
        "id": "target_verification",
        "display_name": "Xác minh quyền sở hữu Target",
        "route": "/dashboard",
        "purpose": "Bảo đảm chỉ chủ sở hữu hợp pháp của website/domain mới được thực hiện quét an ninh chuyên sâu và kiểm thử tải.",
        "requirements": ["Quyền chỉnh sửa mã nguồn HTML hoặc thẻ <head> của trang chủ website mục tiêu."],
        "primary_actions": [
            "Vào dự án hoặc trang Scan/Stress Test.",
            "Bấm 'Lấy mã xác minh' để nhận thẻ Meta.",
            "Dán thẻ <meta name=\"adq-verification\" content=\"...\"> vào trong thẻ <head> của trang chủ mục tiêu.",
            "Bấm 'Xác minh ngay' để hệ thống kiểm tra tự động.",
        ],
        "common_questions": {
            "xác minh": "Tại trang Scan hoặc Stress Test của dự án, bấm nút 'Lấy mã xác minh'. Sau đó copy thẻ <meta name=\"adq-verification\" content=\"...\"> dán vào thẻ <head> trên trang chủ website của bạn, rồi quay lại bấm 'Xác minh ngay'.",
            "meta tag": "Dán thẻ <meta name=\"adq-verification\" content=\"...\"> vào thẻ <head> trang chủ mục tiêu.",
        },
        "related_features": ["scan", "stress_test"],
    },
    "scan": {
        "id": "scan",
        "display_name": "Scan An Ninh (DAST)",
        "route": "/scan",
        "purpose": "Rà quét an ninh tự động, thu thập bề mặt tấn công, phát hiện cổng/dịch vụ/endpoint và đánh giá 19 nhóm kiểm soát an ninh theo Assurance Matrix.",
        "requirements": [
            "Mục tiêu đã hoàn tất xác minh quyền sở hữu.",
            "Gói tài khoản còn lượt quét (FREE: 2 lượt vĩnh viễn, PRO/PRO_MAX: không giới hạn).",
        ],
        "primary_actions": [
            "Nhập URL mục tiêu cần quét.",
            "Chọn các công cụ kích hoạt (Subfinder, Naabu, Katana, Nuclei...).",
            "Bấm 'Bắt đầu rà quét' để khởi chạy tiến trình trực tiếp.",
            "Theo dõi tiến trình chạy thời gian thực qua Live Telemetry và Ma trận 19 Nhóm Kiểm Soát.",
            "Xem Đánh giá rủi ro tự động từ AI Risk Assessment (gói PRO/PRO MAX).",
        ],
        "common_questions": {
            "scan": "Scan là bộ công cụ DAST giúp tự động rà quét các lỗ hổng bảo mật, phát hiện tài sản mạng (subdomain, port, URL) và đánh giá độ an toàn của hệ thống qua 19 nhóm kiểm soát an ninh.",
            "assurance matrix": "Assurance Matrix là bảng tổng hợp 19 nhóm kiểm soát an ninh cốt lõi (CORS, HSTS, TLS, CSP, Open Ports...) phân loại theo 4 trạng thái: PASS, FAIL, WARNING, INCONCLUSIVE.",
        },
        "related_features": ["reports", "copilot", "target_verification"],
    },
    "stress_test": {
        "id": "stress_test",
        "display_name": "Stress Test (Kiểm thử tải Layer 7)",
        "route": "/stress-test",
        "purpose": "Bắn tải Layer 7 kiểm tra sức chịu đựng và cơ chế phòng vệ của hạ tầng máy chủ dưới áp lực truy cập cao.",
        "requirements": [
            "Mục tiêu đã xác minh quyền sở hữu.",
            "Tài khoản gói PRO (1 lượt/ngày) hoặc PRO_MAX (10 lượt/ngày).",
        ],
        "primary_actions": [
            "Nhập URL mục tiêu, số lượng request và thời gian chạy mong muốn.",
            "Chọn cấu hình kiểm tra WAF (Chuẩn hoặc Lách WAF Evasion).",
            "Bấm 'Khởi chạy Stress Test' để đẩy tải qua k6 engine chuyên dụng.",
            "Theo dõi biểu đồ RPS, độ trễ p95/p99 và tỉ lệ lỗi HTTP theo thời gian thực.",
        ],
        "common_questions": {
            "stress test": "Stress Test tạo áp lực tải thực tế (RPS cao) bằng k6 engine để đo lường độ trễ (latency), khả năng chịu tải của máy chủ và phản ứng của WAF.",
            "chưa chạy được": "Stress Test yêu cầu 2 điều kiện: 1) Target phải được xác minh quyền sở hữu qua thẻ Meta, và 2) Tài khoản phải thuộc gói PRO hoặc PRO MAX (gói FREE không hỗ trợ Stress Test).",
        },
        "related_features": ["target_verification", "copilot", "billing"],
    },
    "reports": {
        "id": "reports",
        "display_name": "Lịch sử & Báo cáo",
        "route": "/reports",
        "purpose": "Lưu trữ tập trung lịch sử toàn bộ các phiên Scan và Stress Test, cho phép xem lại chi tiết và xuất báo cáo an ninh.",
        "requirements": ["Đăng nhập tài khoản."],
        "primary_actions": [
            "Xem danh sách toàn bộ các phiên quét và kiểm thử tải của tài khoản.",
            "Bấm vào một phiên để mở xem chi tiết kết quả, bằng chứng PoC và ma trận kiểm soát.",
        ],
        "common_questions": {
            "lịch sử": "Truy cập mục 'Lịch sử & Báo cáo' (/reports) từ thanh menu bên trái để xem lại toàn bộ phiên scan và stress test cũ.",
            "báo cáo": "Mở phiên scan bất kỳ từ /reports để xem và xuất chi tiết báo cáo an ninh.",
        },
        "related_features": ["scan", "stress_test", "copilot"],
    },
    "apk_audit": {
        "id": "apk_audit",
        "display_name": "APK Audit",
        "route": "/apk-audit",
        "purpose": "Rà soát an ninh mã nguồn ứng dụng di động Android (file .apk), phát hiện secret, API keys và cấu hình không an toàn.",
        "requirements": ["Tài khoản có quyền APK Audit (gói PRO MAX).", "File APK hợp lệ dung lượng dưới 100MB."],
        "primary_actions": [
            "Kéo thả hoặc tải lên file APK ứng dụng Android.",
            "Bấm bắt đầu phân tích để decompile và quét lỗ hổng mã nguồn.",
        ],
        "common_questions": {
            "apk audit": "Bạn có thể mở APK Audit trực tiếp từ thanh menu bên trái dưới nhóm 'CÔNG CỤ ĐỘC LẬP' (/apk-audit).",
            "ở đâu": "APK Audit nằm ở thanh menu bên trái tại đường dẫn /apk-audit.",
        },
        "related_features": ["projects", "copilot"],
    },
    "copilot": {
        "id": "copilot",
        "display_name": "AI Copilot",
        "route": "/copilot",
        "purpose": "Trợ lý Trí tuệ Nhân tạo hỗ trợ hướng dẫn sử dụng nền tảng ADQ và phân tích chuyên sâu dữ liệu từ các phiên Scan hoặc Stress Test.",
        "requirements": ["Gói PRO MAX."],
        "primary_actions": [
            "Hỏi trực tiếp về cách sử dụng bất kỳ tính năng nào của ADQ (Chế độ Hướng dẫn ADQ).",
            "Bấm '+ Chọn dữ liệu phân tích' để đính kèm phiên Scan hoặc Stress Test cụ thể.",
            "Hỏi AI Copilot phân tích chuyên sâu về các finding, port, hoặc nguyên nhân tăng độ trễ.",
        ],
        "common_questions": {
            "copilot": "AI Copilot có 2 chế độ: 1) Hướng dẫn sử dụng ADQ, và 2) Phân tích dữ liệu phiên Scan/Stress Test cụ thể khi được đính kèm.",
        },
        "related_features": ["scan", "stress_test", "reports", "billing"],
    },
    "billing": {
        "id": "billing",
        "display_name": "Gói dịch vụ & License",
        "route": "/dashboard/billing",
        "purpose": "Theo dõi gói cước tài khoản hiện tại (FREE, PRO, PRO_MAX), hạn sử dụng và kích hoạt mã Redeem Code.",
        "requirements": ["Đăng nhập tài khoản."],
        "primary_actions": [
            "Xem thông tin hạn mức và tính năng của gói cước đang dùng.",
            "Nhập mã kích hoạt Redeem Code và bấm 'Kích hoạt ngay'.",
        ],
        "common_questions": {
            "redeem": "Truy cập mục 'Gói dịch vụ' (/dashboard/billing) từ thanh menu bên trái, sau đó nhập mã vào ô 'Mã kích hoạt license' và bấm 'Kích hoạt ngay'.",
            "mã kích hoạt": "Nhập mã Redeem Code tại /dashboard/billing để nâng cấp gói tài khoản.",
            "gói cước": "FREE: 2 lượt scan dùng thử; PRO: scan không giới hạn + 1 stress/ngày; PRO MAX: scan không giới hạn + 10 stress/ngày + AI Copilot + APK Audit.",
        },
        "related_features": ["settings", "copilot"],
    },
    "settings": {
        "id": "settings",
        "display_name": "Cài đặt tài khoản",
        "route": "/settings",
        "purpose": "Quản lý thông tin tài khoản, đổi mật khẩu, cấu hình bảo mật và liên kết thông báo.",
        "requirements": ["Đăng nhập tài khoản."],
        "primary_actions": [
            "Cập nhật tên hiển thị tài khoản.",
            "Đổi mật khẩu tài khoản.",
        ],
        "common_questions": {
            "đổi mật khẩu": "Vào mục 'Cài đặt tài khoản' (/settings) từ thanh menu bên trái, chuyển tới tab 'Bảo mật' để thực hiện đổi mật khẩu.",
            "cài đặt": "Truy cập /settings để quản lý hồ sơ và bảo mật tài khoản.",
        },
        "related_features": ["billing"],
    },
}


def get_product_help_summary() -> str:
    """Generates a compact, structured product help knowledge base for the system prompt."""
    lines = [
        "ADQ PLATFORM PRODUCT REGISTRY (Authoritative features and routes):"
    ]
    for key, feat in PRODUCT_HELP_REGISTRY.items():
        lines.append(f"- {feat['display_name']} ({feat['route']}):")
        lines.append(f"  Mục đích: {feat['purpose']}")
        lines.append(f"  Yêu cầu: {', '.join(feat['requirements'])}")
        lines.append(f"  Hành động chính: {'; '.join(feat['primary_actions'])}")
    return "\n".join(lines)


def query_product_help(query_text: str) -> Optional[str]:
    """Keyword/intent resolver matching most specific keyword first."""
    q = query_text.lower().strip()
    all_pairs = []
    for feat in PRODUCT_HELP_REGISTRY.values():
        for keyword, answer in feat.get("common_questions", {}).items():
            all_pairs.append((keyword, answer))
    # Sort by keyword length descending to match specific keywords first
    all_pairs.sort(key=lambda x: len(x[0]), reverse=True)
    for keyword, answer in all_pairs:
        if keyword in q:
            return answer
    return None

