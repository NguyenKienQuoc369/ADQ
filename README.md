# ADQ Enterprise DAST / ASM & Cyber Orchestration Platform 🛡️⚡

**ADQ** is an Enterprise-Grade Open-Source **Dynamic Application Security Testing (DAST)**, **Continuous Threat Exposure Management (CTEM)**, **Attack Surface Management (ASM)**, and **High-Throughput Load Testing** platform designed for modern Red Teams, Bug Hunters, and DevSecOps Engineers.

> 🌐 **Language / Ngôn ngữ**: [English](#-english-version) | [Tiếng Việt](#-phiên-bản-tiếng-việt)  
> ⚠️ **LEGAL NOTICE**: Please read our [DISCLAIMER.md](DISCLAIMER.md) before operating this platform. ADQ is strictly intended for authorized security assessments and ethical penetration testing.

---

# 🇬🇧 English Version

## 🏗️ System Architecture & Grid Topology

ADQ features a microservice-based **Distributed Master-Worker Grid** with DAG-driven execution pipelines, real-time graph topology modeling, OAST out-of-band interaction testing, AI agentic copilot integration, and high-concurrency worker fleets.

```
+-----------------------------------------------------------------------------------+
|                                  USER / RED TEAM                                  |
|     Next.js Web Console (Real Terminal C2)   |   Rich TUI CLI (`adq_cli.py`)          |
+------------------------------------------+----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                               ADQ MASTER GRID NODE                                |
|  - REST API (FastAPI backend/api_server.py) - Directed Acyclic Graph (DAG Engine) |
|  - ADQ Security Copilot AI Engine          - CTEM & Knowledge Graph Visualizer    |
+------------------------------------------+----------------------------------------+
                                           |
                    +----------------------+----------------------+
                    |                                             |
                    v                                             v
+----------------------------------------+   +--------------------------------------+
|          REDIS MESSAGE BROKER          |   |          POSTGRESQL / PRISMA         |
|  - Task Queues (Recon/DAST/Stress/APK) |   |  - Historical Asset Snapshots        |
+----------------------------------------+   +--------------------------------------+
                    |                                             |
        +-----------+-----------+-----------+                     |
        |                       |           |                     |
        v                       v           v                     v
+---------------+     +------------------+  +----------------+  +------------------------+
| LIGHT WORKERS |     |  ELITE WORKERS   |  | MOBILE WORKERS |  | OAST INTERACTION SERVER|
| Subfinder     |     | Nuclei / FFuf    |  | Apktool / JADX |  | Blind SSRF / Callback  |
| HTTPX / JS    |     | IDOR / Race / OAST|  | Android Audit  |  +------------------------+
+---------------+     +------------------+  +----------------+
```

---

## ⚡ Core Engine Capabilities

1. **Real Dynamic Target Security Scanner (`backend/core/scanner.py`)**: Live DNS & Socket Probing, HTTP Banner & Security Header Audit, Permissive CORS Probing, Exposed Path Probing, Dynamic Risk Scoring.
2. **Directed Acyclic Graph (DAG) Engine (`backend/core/dag_engine.py` & `dag_state_manager.py`)**: Multi-stage security pipelines with dependency tracking and Redis pub/sub broadcasting.
3. **High-Throughput Layer 7 Stress Orchestrator (`backend/core/stress_orchestrator.py`)**: Unthrottled 1,000 parallel worker threads, TLS JA3/JA4 browser impersonation (`curl_cffi chrome120`), Vercel & WAF protection bypass, safety safeguards & high-volume warning panel (>1M requests).
4. **Mobile Audit APK Analyzer (`backend/core/apk_analyzer.py`)**: Apktool + JADX decompilation pipeline, AndroidManifest risk analysis, and hardcoded secret extraction.
5. **Kernel Bypass Raw Socket SYN Prober (`backend/core/raw_socket_prober.py`)**: Byte-level raw TCP SYN frame assembly with RFC 1071 checksum calculation.
6. **WAF Evasion & Payload Mutation Engine (`backend/core/payload_mutation.py`)**: Dynamic encoding, case-variation, injection mutation, and IP header spoofing.
7. **ADQ Security Copilot AI Engine (`backend/core/copilot_engine.py`)**: Agentic AI assistant with secret masking (`copilot_masker.py`) for threat analysis and one-click patch generation.
8. **Out-of-Band (OAST) Listener (`backend/core/oast_server.py`)**: Standalone callback server for zero false-positive Blind SSRF testing.

---

## 💻 User Interfaces

- **Next.js Web Command Center Console (`frontend/src/app/c2/page.tsx`)**: Interactive Web Terminal state machine connected to live REST endpoints (`/api/c2/dispatch`, `/api/stress`, `/api/apk`, `/api/copilot/chat`).
- **Rich Terminal UI (`adq_cli.py`)**: Interactive TUI CLI powered by `rich` with SaaS tier selection, live Rich Tree DAG execution, and Telegram-style report rendering.

---

## 🚀 Quickstart Guide

```bash
# 1. Clone & Environment Setup
git clone https://github.com/NguyenKienQuoc369/ADQ.git
cd ADQ
cp .env.example .env

# 2. Launch Stack via Docker Compose
docker compose up -d --build

# 3. Access Services
# Web C2 Dashboard: http://localhost:3000
# REST API Docs: http://localhost:8000/docs
# OAST Listener: http://localhost:8888

# 4. Run Interactive Terminal CLI
python adq_cli.py
```

---

## 🧪 Testing & Verification
```bash
# Backend Pytest Unit Tests (27 Cases)
PYTHONPATH=. .venv/bin/python -m pytest backend/tests/unit/

# Frontend Production Build
npm --prefix frontend run build
```

---

## 📁 Repository Structure

```
ADQ/
├── adq_cli.py                   # Rich Terminal CLI (TUI Command Center)
├── DISCLAIMER.md                # Legal Disclaimer & Terms of Use
├── docker-compose.yml           # Local Multi-Container Docker Stack
├── docker-compose.prod.yml      # Production Multi-Worker Docker Stack
├── Dockerfile.mobile-worker     # Dockerfile for APK Decompiler Worker
├── backend/
│   ├── api_server.py            # FastAPI REST API Server
│   ├── quoc_omni.py             # CLI Automation & Scan Pipeline Engine
│   ├── core/
│   │   ├── scanner.py           # Real Dynamic Target Security Scanner
│   │   ├── dag_engine.py        # Directed Acyclic Graph Execution Engine
│   │   ├── dag_state_manager.py # Redis State Sync & Rich Tree Builder
│   │   ├── stress_orchestrator.py # High-Throughput L7 Stress Engine
│   │   ├── apk_analyzer.py      # Android APK Decompiler & Source Auditor
│   │   ├── raw_socket_prober.py # Kernel Bypass TCP SYN Socket Prober
│   │   ├── payload_mutation.py  # Context-Aware WAF Mutation Engine
│   │   ├── copilot_engine.py    # ADQ Security Copilot AI Engine
│   │   ├── copilot_masker.py    # Sensitive Secret Obfuscation Engine
│   │   ├── js_analyzer.py       # Deep JavaScript & Sourcemap Secret Extractor
│   │   ├── oast_server.py       # Out-of-Band Callback Server
│   │   └── hive_mind.py         # Distributed Swarm Shared Memory
│   └── tests/
│       └── unit/                # Pytest Unit Test Suites (27 Test Cases)
└── frontend/                    # Next.js 16 (Turbopack) Web Command Center
    └── src/app/
        ├── c2/page.tsx          # Real Interactive Web Terminal Console
        └── api/                 # Next.js Serverless Route Handlers
```

---

# 🇻🇳 Phiên bản Tiếng Việt

## 🏗️ Kiến trúc Hệ thống & Sơ đồ Cụm Grid Node

ADQ vận hành trên kiến trúc microservice **Cụm Master-Worker Phân tán** điều khiển bởi Đồ thị Hướng không Chu trình (DAG Engine), mô hình hóa bản đồ hạ tầng theo thời gian thực, máy chủ OAST tương tác ngoại băng, kết hợp Trợ lý AI Agentic Copilot.

```
+-----------------------------------------------------------------------------------+
|                                 NGƯỜI DÙNG / RED TEAM                             |
|     Next.js Web Console (Terminal C2 Thực)    |   Rich TUI CLI (`adq_cli.py`)         |
+------------------------------------------+----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                               ADQ MASTER GRID NODE                                |
|  - REST API (FastAPI backend/api_server.py) - Đồ thị Hướng không Chu trình (DAG)   |
|  - Trợ lý AI ADQ Security Copilot           - Trực quan hóa CTEM & Knowledge Graph|
+------------------------------------------+----------------------------------------+
                                           |
                    +----------------------+----------------------+
                    |                                             |
                    v                                             v
+----------------------------------------+   +--------------------------------------+
|          REDIS MESSAGE BROKER          |   |          POSTGRESQL / PRISMA         |
|  - Hàng đợi (Recon/DAST/Stress/APK)    |   |  - Lưu trữ Lịch sử Assets/Vulnerabilities|
+----------------------------------------+   +--------------------------------------+
                    |                                             |
        +-----------+-----------+-----------+                     |
        |                       |           |                     |
        v                       v           v                     v
+---------------+     +------------------+  +----------------+  +------------------------+
| LIGHT WORKERS |     |  ELITE WORKERS   |  | MOBILE WORKERS |  | OAST INTERACTION SERVER|
| Subfinder     |     | Nuclei / FFuf    |  | Apktool / JADX |  | Blind SSRF / Callback  |
| HTTPX / JS    |     | IDOR / Race / OAST|  | Phân tích APK  |  +------------------------+
+---------------+     +------------------+  +----------------+
```

---

## ⚡ Các Tính năng Nòng cốt

1. **Bộ Rà quét Bảo mật Thực tế (`backend/core/scanner.py`)**: Phân giải IP thực tế, quét cổng kết nối TCP socket (80, 443, 8080, 8443, 3000, 5000, 22, 3306, 5432, 6379,...), kiểm tra Server Banner, Header an toàn, CORS, dò tìm file nhạy cảm phơi nhiễm (`.git/HEAD`, `.env`, `/swagger-ui.html`) và tự động tính điểm rủi ro Risk Score (0-100).
2. **Động cơ Đồ thị DAG (`backend/core/dag_engine.py`)**: Thực thi quy trình kiểm thử đa bước có phụ thuộc dữ liệu và phát sự kiện đồng bộ qua Redis Pub/Sub.
3. **Động cơ Kiểm thử Chịu tải Tốc độ cao Layer 7 (`backend/core/stress_orchestrator.py`)**: Mở rộng tới 1.000 worker threads song song, giả lập TLS JA3/JA4 trình duyệt thực (`curl_cffi chrome120`), tự động vượt qua WAF/Vercel Protection Bypass, tích hợp bảng cảnh báo an toàn ngưỡng tải siêu lớn (>1 triệu request).
4. **Bộ Phân tích Mã nguồn Mobile APK (`backend/core/apk_analyzer.py`)**: Tự động giải mã APK bằng Apktool/JADX, phân tích nguy cơ trong `AndroidManifest.xml` và trích xuất API Keys/Tokens ẩn trong mã nguồn Java/Kotlin.
5. **Động cơ SYN Prober Raw Socket (`backend/core/raw_socket_prober.py`)**: Đóng gói khung TCP SYN ở cấp độ byte bypass qua giao thức mạng hệ điều hành với thuật toán tính Internet Checksum (RFC 1071).
6. **Động cơ Biến đổi Payload & Vượt WAF (`backend/core/payload_mutation.py`)**: Mã hóa URL động, thay đổi hoa/thường, biến đổi injection payload và giả mạo IP headers.
7. **Trợ lý Trí tuệ Nhân tạo ADQ Security Copilot (`backend/core/copilot_engine.py`)**: Phân tích tương quan chuỗi tấn công, đề xuất mã vá lỗi một chạm (One-Click Fix) và tự động che giấu dữ liệu nhạy cảm (`copilot_masker.py`).
8. **Máy chủ Tương tác Ngoại băng OAST (`backend/core/oast_server.py`)**: Lắng nghe và xác minh lỗ hổng Blind SSRF chính xác 100%.

---

## 💻 Giao diện Tương tác

- **Next.js Web Command Center (`frontend/src/app/c2/page.tsx`)**: Terminal giả lập dạng State Machine kết nối trực tiếp các endpoint REST backend real-time (`/api/c2/dispatch`, `/api/stress`, `/api/apk`, `/api/copilot/chat`).
- **Giao diện Rich Terminal TUI (`adq_cli.py`)**: TUI dòng lệnh tương tác mạnh mẽ với tùy chọn gói dịch vụ SaaS, cây DAG tĩnh/động và xuất báo cáo phong cách Telegram.

---

## 🚀 Hướng dẫn Khởi chạy Nhanh

```bash
# 1. Clone Repo & Cấu hình Môi trường
git clone https://github.com/NguyenKienQuoc369/ADQ.git
cd ADQ
cp .env.example .env

# 2. Khởi chạy Cụm Docker Container
docker compose up -d --build

# 3. Cổng Dịch vụ
# Dashboard Web C2: http://localhost:3000
# REST Backend API: http://localhost:8000/docs
# OAST Listener: http://localhost:8888

# 4. Chạy Terminal TUI Cổ điển
python adq_cli.py
```

---

## 🧪 Kiểm thử Hệ thống
```bash
# Chạy Unit Test Backend Pytest (27 Cases)
PYTHONPATH=. .venv/bin/python -m pytest backend/tests/unit/

# Kiểm tra Biên dịch Frontend Next.js
npm --prefix frontend run build
```

---

## 📁 Cấu trúc Dự án (Repository Structure)

```
ADQ/
├── adq_cli.py                   # Rich Terminal CLI (Giao diện dòng lệnh TUI)
├── DISCLAIMER.md                # Tuyên bố Bảo vệ Pháp lý & Điều khoản
├── docker-compose.yml           # Cấu hình Docker Compose Local Stack
├── docker-compose.prod.yml      # Cấu hình Docker Compose Production Cluster
├── Dockerfile.mobile-worker     # Dockerfile cho Worker phân tích APK
├── backend/
│   ├── api_server.py            # Máy chủ FastAPI REST API
│   ├── quoc_omni.py             # Động cơ tự động hóa đường ống kiểm thử
│   ├── core/
│   │   ├── scanner.py           # Bộ Rà quét Bảo mật Thực tế
│   │   ├── dag_engine.py        # Động cơ Thực thi Đồ thị DAG
│   │   ├── dag_state_manager.py # Đồng bộ Trạng thái Redis & Rich Tree Builder
│   │   ├── stress_orchestrator.py # Động cơ Tấn công Chịu tải L7 Tốc độ cao
│   │   ├── apk_analyzer.py      # Bộ Dịch ngược & Phân tích APK Mobile
│   │   ├── raw_socket_prober.py # Bộ Probing SYN Raw Socket
│   │   ├── payload_mutation.py  # Động cơ Biến đổi Payload Vượt WAF
│   │   ├── copilot_engine.py    # Trợ lý AI ADQ Security Copilot Engine
│   │   ├── copilot_masker.py    # Bộ Khử dữ liệu Nhạy cảm cho AI Prompt
│   │   ├── js_analyzer.py       # Bộ Trích xuất Secret trong JavaScript
│   │   ├── oast_server.py       # Máy chủ Lắng nghe Callback Ngoại băng OAST
│   │   └── hive_mind.py         # Bộ nhớ Chia sẻ Cụm Swarm
│   └── tests/
│       └── unit/                # Bộ Kiểm thử Đơn vị Pytest (27 Test Cases)
└── frontend/                    # Next.js 16 (Turbopack) Web Command Center
    └── src/app/
        ├── c2/page.tsx          # Terminal Tương tác Thực trên Web Console
        └── api/                 # Next.js Serverless Route Handlers
```

---

## ⚖️ Tuyên Bố Bảo Vệ Pháp Lý

> ⚠️ **ADQ được thiết kế duy nhất phục vụ kiểm thử an toàn thông tin có ủy quyền, hoạt động Red Teaming hợp pháp và nghiên cứu giáo dục.**
> 
> Mọi hành vi rà quét hoặc tấn công trái phép không có sự đồng ý bằng văn bản của chủ sở hữu hệ thống đều là vi phạm pháp luật nghiêm trọng. Tác giả và các bên phát triển không chịu bất kỳ trách nhiệm nào đối với các hành vi sử dụng sai mục đích. Chi tiết xem tại [DISCLAIMER.md](DISCLAIMER.md).

---

**Version:** 2.0 (Enterprise Grid Architecture)  
**Author:** Nguyễn Kiến Quốc  
**License:** MIT License
