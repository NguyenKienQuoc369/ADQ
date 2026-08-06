# ADQ Enterprise DAST/ASM Platform 🛡️⚡

**ADQ** is an Enterprise-Grade Open-Source **Dynamic Application Security Testing (DAST)**, **Continuous Threat Exposure Management (CTEM)**, and **Attack Surface Management (ASM)** platform designed for modern Red Teams, Bug Hunters, and DevSecOps Engineers.

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

* **Deep JavaScript & Sourcemap Analysis (`core/js_analyzer.py`):**
  * Automatically extracts hidden API routes, Next.js chunk paths, query/body parameters, and hardcoded secrets (JWT, Google API Keys, Bearer Tokens) from minified JS & `.map` files.
* **Context-Aware Parameter Discovery & Diffing (`core/param_fuzzer.py`):**
  * Discovers unadvertised parameters using HTTP Response Diffing (Content-Length delta, Status Code shift, reflection analysis).
* **Automated Logic Chaining Engine (`core/logic_chain.py`):**
  * Chains Recon -> JS Analysis -> Param Fuzzing -> Session Mapping -> Concurrency Race Condition & Cross-tenant IDOR/BOLA attacks.
* **Adaptive WAF Evasion & Dynamic Rate-Limiting (`core/waf_evasion.py`):**
  * Detects WAF blocks (Cloudflare, AWS WAF, Akamai, Imperva), applies randomized Jitter (`0.1s - 0.8s`), Exponential Backoff, and User-Agent/IP Header spoofing.
* **4 Specialized Scan Profiles (`core/grid_master.py`):**
  * `recon_infra`: Low-noise Subdomain & DNS discovery.
  * `web_mapping`: HTTP probing, Tech stack tagging, Deep JS analysis.
  * `dast_active`: Active Nuclei CVE scans & FFuf directory fuzzing.
  * `deep_logic`: Multi-tenant session attacks, Param Fuzzing, Race Condition & OAST testing.
* **Security Knowledge Graph Engine (`core/knowledge_graph.py`):**
  * Models assets into Nodes & Edges, calculates topology-based Contextual Risk Scores, and traverses impact paths from leaked secrets.
* **Multi-Protocol Structure Analyzer (`core/protocol_analyzer.py`):**
  * Parses GraphQL Introspection Schemas and performs WebSocket Handshake probes.
* **Out-of-Band Interaction Server (`core/oast_server.py`):**
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
$ python quoc_omni.py target.com \
  --ctf-mode \
  --nuclei-auto-tags \
  --nuclei-ctf-pack \
  --nuclei-two-pass

# Tắt Telegram
$ python quoc_omni.py target.com --no-telegram --ctf-mode

# Với custom wordlist
$ python quoc_omni.py target.com --wordlist /path/to/wordlist.txt
```

---

## 📁 Cấu trúc Tệp

```
quoc_omni/
├── quoc_omni.py              # Script chính
├── .env.example              # Template cấu hình (copy thành .env)
├── .gitignore                # Ignore .env và outputs
├── SECURITY.md               # Hướng dẫn bảo mật chi tiết
└── README.md                 # File này
```

---

## ⚙️ Thông số Chính

### Arguments
```bash
# Target
python quoc_omni.py <target>

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
