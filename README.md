# ADQ Enterprise DAST / ASM & Cyber Orchestration Platform 🛡️⚡

**ADQ** is an Enterprise-Grade Open-Source **Dynamic Application Security Testing (DAST)**, **Continuous Threat Exposure Management (CTEM)**, **Attack Surface Management (ASM)**, and **High-Throughput Load Testing** platform designed for modern Red Teams, Bug Hunters, and DevSecOps Engineers.

> ⚠️ **LEGAL NOTICE**: Please read our [DISCLAIMER.md](DISCLAIMER.md) before operating this platform. ADQ is strictly intended for authorized security assessments and ethical penetration testing.

---

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
|  - ADQ Security Copilot AI Engine          - CTEM & Knowledge Graph Visualizer   |
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

### 1. Real Dynamic Target Security Scanner (`backend/core/scanner.py`)
- **Live DNS & Socket Probing**: Performs real IP resolution, TCP socket connect probing (80, 443, 8080, 8443, 3000, 5000, 22, 3306, 5432, 6379, etc.).
- **Live HTTP Banner & Security Header Audit**: Inspects live Web Server banners (`Cloudflare`, `Nginx`, `GWS`, `Vercel`), verifies HSTS, CSP, and X-Content-Type-Options.
- **CORS Permissive Origin Probing**: Tests CORS headers with custom origins (`evil-attacker-adq.com`).
- **Exposed Files & Path Probing**: Checks for exposed `.git/HEAD`, `.env`, `/swagger-ui.html`, `/robots.txt`.
- **Dynamic Context Risk Scoring**: Calculates target priority risk scores (0–100) dynamically based on actual findings.

### 2. Directed Acyclic Graph (DAG) Engine (`backend/core/dag_engine.py` & `dag_state_manager.py`)
- Executes multi-stage security pipelines with dependency tracking.
- Real-time pub/sub event broadcasting to Redis and Rich TUI tree view rendering.

### 3. High-Throughput Layer 7 Stress Orchestrator (`backend/core/stress_orchestrator.py`)
- **Unthrottled Thread Fleet**: Parallel worker pool supporting up to 1,000 threads.
- **TLS Browser Impersonation**: Uses `curl_cffi` (`chrome120`) to emulate real browser TLS JA3/JA4 fingerprints and bypass WAF anti-bot protections.
- **Vercel & WAF Bypass**: Supports `x-vercel-protection-bypass` and custom Bearer Tokens with persistent HTTP Keep-Alive session pooling.
- **Safety Safeguards**: Features an explicit confirmation step and severe high-volume warning panel for requests exceeding 1,000,000.

### 4. Mobile Audit APK Analyzer (`backend/core/apk_analyzer.py`)
- **Decompilation Pipeline**: Utilizes Apktool and JADX to decompile Android APK bytecode.
- **AndroidManifest Risk Analysis**: Audits `android:allowBackup`, exported components, debuggable flags, and dangerous permissions.
- **Hardcoded Secrets & API Key Extraction**: Scans decompiled Java/Kotlin source code for embedded JWT tokens, Firebase URLs, AWS keys, and private tokens.

### 5. Kernel Bypass Raw Socket SYN Prober (`backend/core/raw_socket_prober.py`)
- Assembles raw IPv4 TCP SYN frames at the byte level with Internet Checksum calculation (RFC 1071).
- Bypasses standard OS TCP handshake overhead with automatic fallback to async connect when root privileges (`CAP_NET_RAW`) are absent.

### 6. WAF Evasion & Payload Mutation Engine (`backend/core/payload_mutation.py` & `protocol_fuzzer.py`)
- Applies dynamic payload mutation (URL encoding, case-variation, SQL/XSS/Command Injection mutation) and HTTP header spoofing (`X-Forwarded-For`, `X-Originating-IP`).

### 7. ADQ Security Copilot AI Engine (`backend/core/copilot_engine.py` & `copilot_masker.py`)
- Context-aware LLM security assistant for threat analysis, attack chain correlation, and one-click code patch generation.
- **Automatic Masking**: Masker utility obfuscates sensitive API keys, JWT tokens, and credentials before sending prompts to external AI endpoints.

### 8. Out-of-Band (OAST) Listener (`backend/core/oast_server.py`)
- Standalone HTTP/DNS interaction server providing unique correlation callback URLs for zero false-positive Blind SSRF testing.

---

## 💻 User Interfaces

### 1. Next.js Web Command Center Console (`frontend/src/app/c2/page.tsx`)
- **Interactive Web Terminal**: Full state machine emulation accepting step-by-step commands (`1` Recon & Scan, `2` APK Audit, `3` Stress Test, `4` Reports, AI Chat) connected directly to live backend REST endpoints (`/api/c2/dispatch`, `/api/stress`, `/api/apk`, `/api/copilot/chat`).
- **CTEM Threat Exposure Matrix & Knowledge Graph**: Real-time asset relationship graph and vulnerability export tools.

### 2. Rich Terminal UI (`adq_cli.py`)
- Command-line TUI powered by `rich` featuring interactive SaaS tier selection (Starter, DevSec Pro, Fintech Ultimate), live Rich Tree DAG execution, Telegram-style report rendering, and interactive AI Copilot chat session.

---

## 🚀 Quickstart Guide

### 1. Clone Repository & Setup Environment
```bash
git clone https://github.com/NguyenKienQuoc369/ADQ.git
cd ADQ
cp .env.example .env
```

### 2. Configure Environment Variables (`.env`)
```dotenv
DATABASE_URL="postgresql://postgres:adq_secure_password@localhost:5432/adq_db"
REDIS_URL="redis://localhost:6379/0"
BACKEND_API_URL="http://127.0.0.1:8000"
TELEGRAM_TOKEN="your_telegram_bot_token"
TELEGRAM_CHAT_ID="your_telegram_chat_id"
```

### 3. Launch via Docker Compose
```bash
# Local Development Stack
docker compose up -d --build

# Production Multi-Worker Stack
docker compose -f docker-compose.prod.yml up -d --build
```

Access Services:
- **Next.js Web C2 Dashboard:** `http://localhost:3000`
- **FastAPI REST Backend API:** `http://localhost:8000/docs`
- **OAST Interaction Server:** `http://localhost:8888`

### 4. Run Interactive Terminal CLI
```bash
# Run CLI TUI
python adq_cli.py

# Or via virtualenv
.venv/bin/python adq_cli.py
```

---

## 🧪 Testing & Verification

Run the full Pytest unit test suite across core engines:
```bash
PYTHONPATH=. .venv/bin/python -m pytest backend/tests/unit/
```

Test Next.js frontend production build:
```bash
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

## ⚖️ Legal Disclaimer

> ⚠️ **ADQ is designed strictly for authorized security testing, ethical red teaming, and educational research.**
> 
> Unlawful use against targets without prior written consent is strictly prohibited. Developers and contributors bear no liability for misuse, service disruption, or illegal activities. Please read the full terms in [DISCLAIMER.md](DISCLAIMER.md).

---

**Version:** 2.0 (Enterprise Grid Architecture)  
**Author:** Nguyễn Kiến Quốc  
**License:** MIT License

---

## 🏗️ System Architecture

ADQ utilizes a microservice-based **Distributed Master-Worker Grid** with real-time graph topology modeling, OAST out-of-band testing, and AI-driven false-positive reduction.

```
+-----------------------------------------------------------------------------------+
|                                  USER / RED TEAM                                  |
|                      Next.js Web Dashboard  |  Telegram Bot                       |
+------------------------------------------+----------------------------------------+
                                           |
                                           v
+-----------------------------------------------------------------------------------+
|                               ADQ MASTER GRID NODE                                |
|  - REST API (FastAPI)                     - Security Knowledge Graph Engine       |
|  - Scan Profile Dispatcher (4 Profiles)   - CTEM Attack Surface Diffing Engine    |
+------------------------------------------+----------------------------------------+
                                           |
                    +----------------------+----------------------+
                    |                                             |
                    v                                             v
+----------------------------------------+   +--------------------------------------+
|          REDIS MESSAGE BROKER          |   |          POSTGRESQL / PRISMA         |
|  - Task Queues (Recon / DAST / Logic)  |   |  - Historical Asset Snapshots        |
+----------------------------------------+   +--------------------------------------+
                    |                                             |
        +-----------+-----------+                                 |
        |                       |                                 |
        v                       v                                 v
+---------------+     +------------------+           +------------------------------+
| LIGHT WORKERS |     |  ELITE WORKERS   | <-------- | OAST INTERACTION SERVER      |
| Subfinder     |     | Nuclei / FFuf    |           | Blind SSRF / OAST Testing    |
| HTTPX / JS    |     | IDOR / Race / OAST           +------------------------------+
+---------------+     +------------------+
```

---

## ⚡ Core Enterprise Capabilities

* **Deep JavaScript & Sourcemap Analysis (`backend/core/js_analyzer.py`):**
  * Automatically extracts hidden API routes, Next.js chunk paths, query/body parameters, and hardcoded secrets (JWT, Google API Keys, Bearer Tokens) from minified JS & `.map` files.
* **Context-Aware Parameter Discovery & Diffing (`backend/core/param_fuzzer.py`):**
  * Discovers unadvertised parameters using HTTP Response Diffing (Content-Length delta, Status Code shift, reflection analysis).
* **Automated Logic Chaining Engine (`backend/core/logic_chain.py`):**
  * Chains Recon -> JS Analysis -> Param Fuzzing -> Session Mapping -> Concurrency Race Condition & Cross-tenant IDOR/BOLA attacks.
* **Adaptive WAF Evasion & Dynamic Rate-Limiting (`backend/core/waf_evasion.py`):**
  * Detects WAF blocks (Cloudflare, AWS WAF, Akamai, Imperva), applies randomized Jitter (`0.1s - 0.8s`), Exponential Backoff, and User-Agent/IP Header spoofing.
* **4 Specialized Scan Profiles (`backend/core/grid_master.py`):**
  * `recon_infra`: Low-noise Subdomain & DNS discovery.
  * `web_mapping`: HTTP probing, Tech stack tagging, Deep JS analysis.
  * `dast_active`: Active Nuclei CVE scans & FFuf directory fuzzing.
  * `deep_logic`: Multi-tenant session attacks, Param Fuzzing, Race Condition & OAST testing.
* **Security Knowledge Graph Engine (`backend/core/knowledge_graph.py`):**
  * Models assets into Nodes & Edges, calculates topology-based Contextual Risk Scores, and traverses impact paths from leaked secrets.
* **Multi-Protocol Structure Analyzer (`backend/core/protocol_analyzer.py`):**
  * Parses GraphQL Introspection Schemas and performs WebSocket Handshake probes.
* **Out-of-Band Interaction Server (`backend/core/oast_server.py`):**
  * Generates unique correlation URLs to verify Blind SSRF and OAST vulnerabilities with 0% False Positive rate.

---

## 🚀 Quickstart Guide (3 Steps)

### Step 1: Clone Repository & Create `.env`
```bash
git clone https://github.com/your-username/ADQ.git
cd ADQ
cp .env.example .env
```

### Step 2: Configure Environment Variables
Edit `.env` file with your credentials:
```dotenv
DATABASE_URL=postgresql://postgres:adq_secure_password@db:5432/adq_db
REDIS_URL=redis://redis:6379/0
TELEGRAM_TOKEN=your_telegram_bot_token
TELEGRAM_CHAT_ID=your_chat_id
```

### Step 3: Launch Enterprise Cluster with Docker Compose
```bash
docker compose up -d --build
```

Access the systems:
* **Next.js Web Dashboard:** `http://localhost:3000`
* **FastAPI Backend Server:** `http://localhost:8000/docs`
* **OAST Interaction Server:** `http://localhost:8888`

---

## ⚙️ Scaling Worker Nodes

For large-scale enterprise targets, dynamically scale worker instances:
```bash
docker compose up -d --scale worker-light=5 --scale worker-elite=3
```

---

## 🧪 Local Dry-Run Verification Commands

Run offline dry-run test suites to verify system engines locally:
```bash
cd backend
python3 core_engine_dry_run.py        # Test JS Analyzer, Param Fuzzer, Logic Chain
python3 waf_session_dry_run.py        # Test WAF Evasion & Session Manager
python3 enterprise_dry_run.py         # Test OAST, CTEM Diffing, Master Grid, Mutation
python3 scan_profiles_dry_run.py      # Test 4 Scan Profiles & Worker Capability Dispatch
python3 graph_protocol_dry_run.py     # Test Security Knowledge Graph & GraphQL/WS Analyzer
```

---

## 🤝 Contributing & License

We welcome open-source contributions! Please review our [CONTRIBUTING.md](CONTRIBUTING.md) guide.

Distributed under the **MIT License**. Created with ❤️ by **Nguyen Kien Quoc**.

---

## 🚀 Cách Sử dụng

### Yêu cầu
- Python 3.6+
- Các công cụ: subfinder, httpx, nuclei, gau, ffuf, naabu, etc.

### Cài đặt

1. **Clone/Download repo**
```bash
$ git clone https://github.com/your-repo/quoc_omni.git
$ cd quoc_omni
```

2. **Thiết lập Credentials**
```bash
# Cách 1: File .env (KHUYẾN CÁO)
$ cp .env.example .env
$ nano .env
$ source .env

# Cách 2: Trực tiếp trên shell
$ export TELEGRAM_TOKEN="your_token"
$ export TELEGRAM_CHAT_ID="your_chat_id"
```

3. **Chạy Script**
```bash
# Mode CTF đầy đủ
$ python backend/quoc_omni.py target.com \
  --ctf-mode \
  --nuclei-auto-tags \
  --nuclei-ctf-pack \
  --nuclei-two-pass

# Tắt Telegram
$ python backend/quoc_omni.py target.com --no-telegram --ctf-mode

# Với custom wordlist
$ python backend/quoc_omni.py target.com --wordlist /path/to/wordlist.txt
```

---

## 📁 Cấu trúc Tệp

```
ADQ/
├── backend/                  # FastAPI, worker, core engines, tests
├── frontend/                 # Next.js dashboard (Vercel root)
├── docker-compose.yml        # Local full-stack compose
├── docker-compose.prod.yml   # VPS backend compose
└── README.md
```

---

## ⚙️ Thông số Chính

### Arguments
```bash
# Target
python backend/quoc_omni.py <target>

# Tùy chọn quan trọng
--ctf-mode                     # Tối ưu cho CTF
--nuclei-auto-tags            # Tự động chọn tags theo tech
--nuclei-ctf-pack             # Thêm tags CTF (exposures/misconfig)
--nuclei-two-pass             # Chạy 2 lượt Nuclei
--nuclei-group-by-tech        # Ưu tiên target theo tech stack
--no-telegram                 # Tắt Telegram notifications
--retries N                   # Số lần retry
--auto-throttle               # Tự giảm tốc khi timeout
```

### Biến Môi trường
```bash
# Bắt buộc cho Telegram:
TELEGRAM_TOKEN                # Token từ BotFather
TELEGRAM_CHAT_ID              # Chat ID để gửi tin nhắn

# Tùy chọn:
WORDLIST_PATH                 # Đường dẫn wordlist FFuf (mặc định: common.txt)
```

---

## 🔐 Bảo Mật

### ✅ LÀM
- Lưu credentials trong **file .env cục bộ**
- **Thêm .env vào .gitignore**
- Sử dụng **biến môi trường** cho tất cả secrets
- **Không commit .env** lên Git

### ❌ KHÔNG LÀM
- Không truyền token qua **CLI arguments**
- Không viết credentials trong **code/comments**
- Không commit **credential files** lên Git
- Không chia sẻ **credentials** qua email/chat

### Nếu Credentials Bị Leak
```bash
# 1. Xóa token cũ (BotFather → /revoke)
# 2. Tạo token mới
# 3. Xoá khỏi Git history:
$ git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch .env' \
  --prune-empty --tag-name-filter cat -- --all
$ git push origin --force --all

# 4. Scan: grep -r "TELEGRAM_TOKEN" .git/
```

---

## 📊 Outputs

Script tạo folder `recon_<target>/` chứa:
```
recon_example_com/
├── subdomains.txt            # Danh sách subdomains
├── live_sites.txt            # Hosts đang hoạt động
├── nuclei_results.txt        # Kết quả scan lỗ hổng
├── ffuf_main.txt             # Kết quả dò thư mục
├── combined_urls.txt         # Tất cả URLs
├── report.html               # Report HTML
├── report.md                 # Report Markdown
├── summary.json              # JSON summary
└── screenshots/              # Screenshots gowitness
```

---

## 🐛 Troubleshooting

### Error: "Thiếu công cụ..."
```bash
# Cài đặt công cụ còn thiếu
$ brew install subfinder httpx nuclei  # macOS
$ apt-get install subfinder httpx nuclei  # Ubuntu
```

### Error: "TELEGRAM_TOKEN chưa thiết lập"
```bash
# Thiết lập biến môi trường
$ export TELEGRAM_TOKEN="your_token"
$ export TELEGRAM_CHAT_ID="your_id"

# Hoặc dùng --no-telegram
$ python quoc_omni.py target.com --no-telegram
```

### Timeout hoặc lỗi khi chạy Nuclei
```bash
# Sử dụng auto-throttle
$ python quoc_omni.py target.com --auto-throttle --nuclei-auto-tune
```

---

## 📚 Tham khảo Thêm

- **SECURITY.md** - Hướng dẫn bảo mật chi tiết
- **OWASP Secrets Management** - https://cheatsheetseries.owasp.org/
- **GitHub Removing Sensitive Data** - https://docs.github.com/en/authentication/

---

## 🤖 Giai đoạn 2: Telegram Human-in-the-Loop

Luồng mới hoạt động như sau:

1. `worker.py` gửi AI review kèm nút `Approve/Reject`.
2. `telegram_polling_daemon.py` nhận callback từ Telegram và ghi vào JSONL queue.
3. `telegram_queue_consumer.py` đọc queue, cập nhật status DB, và chạy validation dispatcher.

### Dry-run offline (không cần mạng)

```bash
/home/sisiniki123/ADQ/.venv/bin/python telegram_callback_dry_run.py
/home/sisiniki123/ADQ/.venv/bin/python telegram_queue_consumer.py \
  --queue-path /tmp/telegram_approvals_test.jsonl \
  --cursor-path /tmp/telegram_approvals_test.cursor \
  --max-cycles 1 --interval 0
```

### Polling daemon thực tế

```bash
/home/sisiniki123/ADQ/.venv/bin/python telegram_polling_daemon.py
```

Theo dõi queue thời gian thực:

```bash
tail -f /home/sisiniki123/ADQ/runtime/telegram_approvals.jsonl
```

---

## ⚖️ Từ Chối Trách Nhiệm

> ⚠️ **Công cụ này chỉ được sử dụng cho mục đích kiểm thử xâm nhập (pentesting) có ủy quyền.**
> - Không được phép sử dụng cho mục đích xấu hoặc trái phép
> - Người dùng chịu trách nhiệm toàn bộ về việc sử dụng công cụ này
> - Xin phép trước khi quét hệ thống không phải của bạn

---

**Phiên bản:** 1.1 (Security Hardened)  
**Cập nhật:** 2026-06-08  
**Tác giả:** Nguyễn Kiến Quốc
