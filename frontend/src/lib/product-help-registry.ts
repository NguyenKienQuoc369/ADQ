/**
 * ADQ Platform - Product Help Registry
 * Authoritative static registry of real authenticated features, routes, and capabilities.
 */

export interface ProductFeatureHelp {
  id: string;
  displayName: string;
  route: string;
  purpose: string;
  requirements: string[];
  primaryActions: string[];
  commonQuestions: { q: string; a: string }[];
  relatedFeatures: string[];
}

export const PRODUCT_HELP_REGISTRY: Record<string, ProductFeatureHelp> = {
  projects: {
    id: "projects",
    displayName: "Dự án & Targets",
    route: "/dashboard",
    purpose: "Quản lý danh sách các dự án bảo mật, mục tiêu (domain/website) và theo dõi trạng thái xác minh quyền sở hữu.",
    requirements: ["Đăng nhập tài khoản ADQ."],
    primaryActions: [
      "Bấm nút '+ Thêm dự án' để tạo dự án mới.",
      "Nhập Tên dự án, Domain/URL mục tiêu và Mô tả.",
      "Mở dự án để truy cập Tổng quan, Scan, Stress Test và Lịch sử.",
    ],
    commonQuestions: [
      {
        q: "Làm sao tạo dự án mới?",
        a: "Truy cập mục 'Dự án & Targets' (/dashboard) từ thanh menu bên trái, sau đó bấm nút '+ Thêm dự án' ở góc trên bên phải.",
      },
      {
        q: "Một tài khoản tạo được bao nhiêu dự án?",
        a: "Bạn có thể tạo nhiều dự án tương ứng với các domain/mục tiêu khác nhau mà bạn quản lý.",
      },
    ],
    relatedFeatures: ["target_verification", "scan", "stress_test"],
  },

  target_verification: {
    id: "target_verification",
    displayName: "Xác minh quyền sở hữu Target",
    route: "/dashboard",
    purpose: "Bảo đảm chỉ chủ sở hữu hợp pháp của website/domain mới được thực hiện quét an ninh chuyên sâu và kiểm thử tải.",
    requirements: ["Quyền chỉnh sửa mã nguồn HTML hoặc thẻ <head> của trang chủ website mục tiêu."],
    primaryActions: [
      "Vào dự án hoặc trang Scan/Stress Test.",
      "Bấm 'Lấy mã xác minh' để nhận thẻ Meta.",
      "Dán thẻ <meta name=\"adq-verification\" content=\"...\"> vào trong thẻ <head> của trang chủ mục tiêu.",
      "Bấm 'Xác minh ngay' để hệ thống kiểm tra tự động.",
    ],
    commonQuestions: [
      {
        q: "Làm sao xác minh target?",
        a: "Tại trang Scan hoặc Stress Test của dự án, bấm nút 'Lấy mã xác minh'. Sau đó copy thẻ <meta name=\"adq-verification\" content=\"...\"> dán vào thẻ <head> trên trang chủ website của bạn, rồi quay lại bấm 'Xác minh ngay'.",
      },
      {
        q: "Mã xác minh có hiệu lực bao lâu?",
        a: "Mã xác minh sau khi kiểm tra thành công sẽ có hiệu lực trong 60 phút (3600 giây). Sau thời gian này bạn có thể bấm xác minh lại bất kỳ lúc nào.",
      },
    ],
    relatedFeatures: ["scan", "stress_test"],
  },

  scan: {
    id: "scan",
    displayName: "Scan An Ninh (DAST)",
    route: "/scan",
    purpose: "Rà quét an ninh tự động, thu thập bề mặt tấn công, phát hiện cổng/dịch vụ/endpoint và đánh giá 19 nhóm kiểm soát an ninh theo Assurance Matrix.",
    requirements: ["Mục tiêu đã hoàn tất xác minh quyền sở hữu.", "Gói tài khoản còn lượt quét (FREE: 2 lượt vĩnh viễn, PRO/PRO_MAX: không giới hạn)."],
    primaryActions: [
      "Nhập URL mục tiêu cần quét.",
      "Chọn các công cụ kích hoạt (Subfinder, Naabu, Katana, Nuclei...).",
      "Bấm 'Bắt đầu rà quét' để khởi chạy tiến trình trực tiếp.",
      "Theo dõi tiến trình chạy thời gian thực qua Live Telemetry và Ma trận 19 Nhóm Kiểm Soát.",
      "Xem Đánh giá rủi ro tự động từ AI Risk Assessment (gói PRO/PRO MAX).",
    ],
    commonQuestions: [
      {
        q: "Scan dùng để làm gì?",
        a: "Scan là bộ công cụ DAST giúp tự động rà quét các lỗ hổng bảo mật, phát hiện tài sản mạng (subdomain, port, URL) và đánh giá độ an toàn của hệ thống qua 19 nhóm kiểm soát an ninh chuẩn quốc tế.",
      },
      {
        q: "Ma trận Assurance Matrix là gì?",
        a: "Là bảng tổng hợp 19 nhóm kiểm soát an ninh cốt lõi (như CORS, HSTS, TLS, CSP, Open Ports, v.v.) được phân loại theo 4 trạng thái rõ ràng: PASS (An toàn), FAIL (Có lỗ hổng), WARNING (Cảnh báo) và INCONCLUSIVE (Chưa đủ bằng chứng).",
      },
    ],
    relatedFeatures: ["reports", "copilot", "target_verification"],
  },

  stress_test: {
    id: "stress_test",
    displayName: "Stress Test (Kiểm thử tải Layer 7)",
    route: "/stress-test",
    purpose: "Bắn tải Layer 7 kiểm tra sức chịu đựng và cơ chế phòng vệ của hạ tầng máy chủ dưới áp lực truy cập cao.",
    requirements: ["Mục tiêu đã xác minh quyền sở hữu.", "Tài khoản gói PRO (1 lượt/ngày) hoặc PRO_MAX (10 lượt/ngày)."],
    primaryActions: [
      "Nhập URL mục tiêu, số lượng request và thời gian chạy mong muốn.",
      "Chọn cấu hình kiểm tra WAF (Chuẩn hoặc Lách WAF Evasion).",
      "Bấm 'Khởi chạy Stress Test' để đẩy tải qua k6 engine chuyên dụng.",
      "Theo dõi biểu đồ RPS, độ trễ p95/p99 và tỉ lệ lỗi HTTP theo thời gian thực.",
    ],
    commonQuestions: [
      {
        q: "Stress Test khác Scan như thế nào?",
        a: "Scan tập trung tìm kiếm lỗ hổng bảo mật và cấu hình sai trên ứng dụng, trong khi Stress Test tạo áp lực tải thực tế (RPS cao) để đo lường độ trễ (latency), khả năng chịu tải của máy chủ và phản ứng của WAF.",
      },
      {
        q: "Tại sao tôi chưa chạy được Stress Test?",
        a: "Stress Test yêu cầu 2 điều kiện: 1) Target phải được xác minh quyền sở hữu qua thẻ Meta, và 2) Tài khoản phải thuộc gói PRO hoặc PRO MAX (gói FREE không hỗ trợ Stress Test).",
      },
    ],
    relatedFeatures: ["target_verification", "copilot", "billing"],
  },

  reports: {
    id: "reports",
    displayName: "Lịch sử & Báo cáo",
    route: "/reports",
    purpose: "Lưu trữ tập trung lịch sử toàn bộ các phiên Scan và Stress Test, cho phép xem lại chi tiết và xuất báo cáo an ninh.",
    requirements: ["Đăng nhập tài khoản."],
    primaryActions: [
      "Xem danh sách toàn bộ các phiên quét và kiểm thử tải của tài khoản.",
      "Bấm vào một phiên để mở xem chi tiết kết quả, bằng chứng PoC và ma trận kiểm soát.",
    ],
    commonQuestions: [
      {
        q: "Làm sao xem lại phiên scan cũ?",
        a: "Truy cập mục 'Lịch sử & Báo cáo' (/reports) từ thanh menu bên trái. Toàn bộ các phiên quét trước đây sẽ hiển thị kèm thời gian và kết quả chi tiết.",
      },
    ],
    relatedFeatures: ["scan", "stress_test", "copilot"],
  },

  apk_audit: {
    id: "apk_audit",
    displayName: "APK Audit",
    route: "/apk-audit",
    purpose: "Rà soát an ninh mã nguồn ứng dụng di động Android (file .apk), phát hiện secret, API keys và cấu hình không an toàn.",
    requirements: ["Tài khoản có quyền APK Audit.", "File APK hợp lệ dung lượng dưới 100MB."],
    primaryActions: [
      "Kéo thả hoặc tải lên file APK ứng dụng Android.",
      "Bấm bắt đầu phân tích để decompile và quét lỗ hổng mã nguồn.",
    ],
    commonQuestions: [
      {
        q: "APK Audit nằm ở đâu?",
        a: "Bạn có thể mở APK Audit trực tiếp từ thanh menu bên trái dưới nhóm 'CÔNG CỤ ĐỘC LẬP' (/apk-audit).",
      },
    ],
    relatedFeatures: ["projects", "copilot"],
  },

  copilot: {
    id: "copilot",
    displayName: "AI Copilot",
    route: "/copilot",
    purpose: "Trợ lý Trí tuệ Nhân tạo hỗ trợ hướng dẫn sử dụng nền tảng ADQ và phân tích chuyên sâu dữ liệu từ các phiên Scan hoặc Stress Test.",
    requirements: ["Gói PRO MAX."],
    primaryActions: [
      "Hỏi trực tiếp về cách sử dụng bất kỳ tính năng nào của ADQ (Chế độ Hướng dẫn ADQ).",
      "Bấm '+ Chọn dữ liệu phân tích' để đính kèm phiên Scan hoặc Stress Test cụ thể.",
      "Hỏi AI Copilot phân tích chuyên sâu về các finding, port, hoặc nguyên nhân tăng độ trễ.",
    ],
    commonQuestions: [
      {
        q: "AI Copilot có thể làm gì?",
        a: "AI Copilot có 2 chế độ: 1) Hướng dẫn sử dụng ADQ (trả lời cách dùng các tính năng), và 2) Phân tích dữ liệu phiên Scan/Stress Test đã chọn (giải thích lỗ hổng, nguyên nhân tăng latency, khuyến nghị bảo mật).",
      },
    ],
    relatedFeatures: ["scan", "stress_test", "reports", "billing"],
  },

  billing: {
    id: "billing",
    displayName: "Gói dịch vụ & License",
    route: "/dashboard/billing",
    purpose: "Theo dõi gói cước tài khoản hiện tại (FREE, PRO, PRO_MAX), hạn sử dụng và kích hoạt mã Redeem Code.",
    requirements: ["Đăng nhập tài khoản."],
    primaryActions: [
      "Xem thông tin hạn mức và tính năng của gói cước đang dùng.",
      "Nhập mã kích hoạt Redeem Code và bấm 'Kích hoạt ngay'.",
    ],
    commonQuestions: [
      {
        q: "Nhập Redeem Code ở đâu?",
        a: "Truy cập mục 'Gói dịch vụ' (/dashboard/billing) từ thanh menu bên trái, sau đó nhập mã vào ô 'Mã kích hoạt license' và bấm 'Kích hoạt ngay'.",
      },
      {
        q: "Sự khác biệt giữa các gói cước là gì?",
        a: "Gói FREE có 2 lượt scan dùng thử; gói PRO có scan không giới hạn + 1 lượt stress/ngày; gói PRO MAX có scan không giới hạn + 10 lượt stress/ngày + mở khóa toàn bộ AI Copilot và APK Audit.",
      },
    ],
    relatedFeatures: ["settings", "copilot"],
  },

  settings: {
    id: "settings",
    displayName: "Cài đặt tài khoản",
    route: "/settings",
    purpose: "Quản lý thông tin tài khoản, đổi mật khẩu, cấu hình bảo mật và liên kết thông báo.",
    requirements: ["Đăng nhập tài khoản."],
    primaryActions: [
      "Cập nhật tên hiển thị tài khoản.",
      "Đổi mật khẩu tài khoản.",
    ],
    commonQuestions: [
      {
        q: "Làm sao đổi mật khẩu?",
        a: "Vào mục 'Cài đặt tài khoản' (/settings) từ thanh menu bên trái, chuyển tới tab 'Bảo mật' để thực hiện đổi mật khẩu.",
      },
    ],
    relatedFeatures: ["billing"],
  },
};

