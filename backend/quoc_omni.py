#!/usr/bin/env python3
import argparse
import asyncio
import base64
import json
import os
import re
import shutil
import subprocess
import sys
import time
import requests
from threading import Thread, Lock
from queue import Queue
from io import StringIO
from functools import lru_cache

for extra_path in ["/root/go/bin", "/usr/local/bin", "/usr/local/go/bin", os.path.expanduser("~/go/bin")]:
    if extra_path not in os.environ.get("PATH", ""):
        os.environ["PATH"] = f"{extra_path}{os.pathsep}{os.environ.get('PATH', '')}"

# =================================================================
# CẤU HÌNH HỆ THỐNG & HIỆU SUẤT
# =================================================================
TELEGRAM_TOKEN = os.environ.get("TELEGRAM_TOKEN", "")
TELEGRAM_CHAT_ID = os.environ.get("TELEGRAM_CHAT_ID", "")
TELEGRAM_ENABLED = True
WORDLIST_PATH = os.environ.get("WORDLIST_PATH", "/usr/share/seclists/Discovery/Web-Content/common.txt")
DEFAULT_MAX_URLS = 5000
DEFAULT_TIMEOUT = 900
DEFAULT_BATCH_SIZE = 500  # Batch processing size
DEFAULT_QUEUE_MAXSIZE = 10000  # In-memory buffer max
DEFAULT_THREAD_POOL = 4  # Workers for async tasks
DEFAULT_THROTTLE_ENABLED = False
DEFAULT_THROTTLE_BASE = 0.0
DEFAULT_THROTTLE_STEP = 0.5
DEFAULT_THROTTLE_MAX = 5.0
DEFAULT_NUCLEI_RL = 150
DEFAULT_NUCLEI_C = 50
DEFAULT_NUCLEI_RL_MIN = 50
DEFAULT_NUCLEI_C_MIN = 10
DEFAULT_NUCLEI_RL_STEP = 25
DEFAULT_NUCLEI_C_STEP = 10
EXTRA_TOOLS = ["naabu", "katana", "waybackurls", "dnsx", "httpx-toolkit", "arjun"]
INTERESTING_KEYWORDS = [
    "admin", "login", "swagger", "graphql", "api", "debug", "backup", "test", "staging", "dev",
    ".env", ".git", ".zip", ".tar", ".gz", ".bak", ".sql", ".old"
]

SECRET_PATTERNS = {
    "Prisma / Postgres Connection String": r"postgres(?:ql)?://[a-zA-Z0-9_]+:[^@\s]+@[a-zA-Z0-9.-]+:\d+/[a-zA-Z0-9_]+",
    "JWT Bearer Token": r"eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+",
    "AWS Access Key ID": r"AKIA[0-9A-Z]{16}",
    "Generic Private Key / Secret": r"(?i)(?:api_key|secret|token|password|private_key)[\s]*[=:]\s*['\"]([a-zA-Z0-9_\-]{16,})['\"]",
    "Supabase Secret / Key": r"sb_[a-zA-Z0-9_-]{20,}",
    "Stripe Secret Key": r"sk_live_[0-9a-zA-Z]{24}",
}
TECH_TAG_MAP = {
    "wordpress": "wordpress",
    "drupal": "drupal",
    "joomla": "joomla",
    "laravel": "laravel",
    "symfony": "symfony",
    "django": "django",
    "flask": "flask",
    "rails": "ruby-on-rails",
    "spring": "spring",
    "struts": "struts",
    "tomcat": "tomcat",
    "apache": "apache",
    "nginx": "nginx",
    "iis": "iis",
    "php": "php",
    "node.js": "node",
    "express": "express",
    "graphql": "graphql",
    "swagger": "swagger",
    "jira": "jira",
    "confluence": "confluence",
    "jenkins": "jenkins",
    "gitlab": "gitlab",
    "grafana": "grafana",
    "kibana": "kibana",
    "elastic": "elasticsearch",
    "prometheus": "prometheus",
    "mongodb": "mongodb",
    "redis": "redis",
    "postgresql": "postgresql",
    "mysql": "mysql",
    "mssql": "mssql",
}
RISK_KEYWORDS = {
    "rce": "Có thể dẫn tới thực thi mã từ xa nếu cấu hình yếu hoặc lỗ hổng tồn tại.",
    "sqli": "Có thể dẫn tới đọc/ghi dữ liệu trái phép trong cơ sở dữ liệu.",
    "xss": "Có thể ảnh hưởng người dùng qua script độc hại, gây rò rỉ thông tin phiên.",
    "lfi": "Có thể đọc file nhạy cảm nếu máy chủ cấu hình kém.",
    "ssrf": "Có thể truy cập nội bộ nếu điểm vào không được bảo vệ.",
    "open-redirect": "Có thể bị lợi dụng để điều hướng người dùng tới trang giả mạo.",
    "exposed": "Có thể lộ dữ liệu nhạy cảm hoặc cấu hình hệ thống.",
    "takeover": "Có nguy cơ chiếm quyền subdomain nếu cấu hình sai.",
    "default": "Có thể tạo rủi ro bảo mật nếu không kiểm soát truy cập.",
}

# Optional DB integration (SQLAlchemy). If `DATABASE_URL` is set, the
# `db` and `models` modules will be used. If not available, the script
# will continue to use file-based buffering.
DB_AVAILABLE = False
DB_ERROR = None
try:
    from db import init_db, get_session
    from models import Base, Target, ToolRun, Finding
    # Defer calling init_db until models are imported successfully
    init_db(Base)
    DB_AVAILABLE = True
except Exception as _e:
    DB_AVAILABLE = False
    DB_ERROR = str(_e)

class Colors:
    G = '\033[92m'; Y = '\033[93m'; B = '\033[94m'; R = '\033[91m'; C = '\033[96m'; W = '\033[0m'

# =================================================================
# OPTIMIZATION: IN-MEMORY BUFFERING
# =================================================================

class DataBuffer:
    """In-memory buffer thay vì ghi file liên tục"""
    def __init__(self):
        self.buffer = StringIO()
        self.lines = set()
        self.lock = Lock()
        self.size = 0
    
    def add(self, line):
        line = line.strip()
        if not line or line in self.lines:
            return False
        with self.lock:
            self.lines.add(line)
            self.buffer.write(line + "\n")
            self.size += 1
            return True
    
    def get_content(self):
        with self.lock:
            return self.buffer.getvalue()
    
    def get_lines(self):
        with self.lock:
            return sorted(list(self.lines))
    
    def dump_to_file(self, filepath):
        with self.lock:
            with open(filepath, "w") as f:
                f.write(self.buffer.getvalue())

    def dump_to_db(self, target_name: str, tool_name: str, meta: str = None):
        """Dump buffered lines into the database using SQLAlchemy models.
        If DB is not available, raise RuntimeError so caller can fallback.
        """
        if not DB_AVAILABLE:
            raise RuntimeError(f"DB not available: {DB_ERROR}")

        # Lazy import session helper
        session = get_session()
        try:
            # Get or create target
            target = session.query(Target).filter_by(name=target_name).first()
            if not target:
                target = Target(name=target_name)
                session.add(target)
                session.flush()

            # Create a tool run record
            run = ToolRun(tool=tool_name, target_id=target.id, meta=meta)
            session.add(run)
            session.flush()

            # Insert all findings (deduping via unique constraint)
            to_insert = []
            for line in sorted(self.lines):
                f = Finding(run_id=run.id, item=line, item_type=None)
                to_insert.append(f)

            if to_insert:
                session.add_all(to_insert)

            session.commit()
        except Exception:
            session.rollback()
            raise
        finally:
            session.close()

# =================================================================
# OPTIMIZATION: ASYNC EXECUTOR
# =================================================================

class AsyncExecutor:
    """Chạy công cụ độc lập song song"""
    def __init__(self, max_workers=DEFAULT_THREAD_POOL):
        self.max_workers = max_workers
    
    def run_async(self, tasks):
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            return loop.run_until_complete(self._run_all_tasks(tasks))
        finally:
            loop.close()
    
    async def _run_all_tasks(self, tasks):
        semaphore = asyncio.Semaphore(self.max_workers)
        async def run_with_semaphore(task):
            async with semaphore:
                name, func, args, kwargs = task
                try:
                    result = await asyncio.to_thread(func, *args, **kwargs)
                    return (name, result, None)
                except Exception as e:
                    return (name, None, str(e))
        
        results = await asyncio.gather(*[
            run_with_semaphore((name, func, args, kwargs))
            for name, func, args, kwargs in tasks
        ])
        return {name: (result, error) for name, result, error in results}

# =================================================================
# OPTIMIZATION: BATCH PROCESSING
# =================================================================

def batch_list(items, batch_size=DEFAULT_BATCH_SIZE):
    """Chia list thành các batch"""
    for i in range(0, len(items), batch_size):
        yield items[i:i + batch_size]

def log(msg, color=Colors.W):
    print(f"{color}{msg}{Colors.W}")

def send_telegram(message):
    token = TELEGRAM_TOKEN or os.environ.get("TELEGRAM_TOKEN", "")
    chat_id = TELEGRAM_CHAT_ID or os.environ.get("TELEGRAM_CHAT_ID", "")
    if not TELEGRAM_ENABLED or not token or not chat_id:
        return

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    MAX_LEN = 4000

    if len(message) > MAX_LEN:
        text_to_send = message[:MAX_LEN] + "\n\n... (Báo cáo đã bị cắt ngắn do giới hạn của Telegram) ..."
    else:
        text_to_send = message

    payload = {
        "chat_id": chat_id,
        "text": text_to_send,
        "parse_mode": "HTML"
    }

    try:
        response = requests.post(url, json=payload, timeout=10)
        if response.status_code == 200:
            log("[v] Đã gửi báo cáo Telegram thành công!", Colors.G)
        else:
            # Fallback plain text nếu HTML tag bị lỗi parse
            fallback_payload = {
                "chat_id": chat_id,
                "text": text_to_send,
            }
            res_fb = requests.post(url, json=fallback_payload, timeout=10)
            if res_fb.status_code != 200:
                log(f"[!] Lỗi gửi Telegram: {res_fb.status_code} - {res_fb.text}", Colors.Y)
            else:
                log("[v] Đã gửi báo cáo Telegram thành công (Plain Text)!", Colors.G)
    except Exception as e:
        log(f"[!] Ngoại lệ khi gửi Telegram: {str(e)}", Colors.Y)

def analyze_js_secrets_deep(js_links_file, folder):
    """Phân tích tĩnh các file JavaScript để tìm secret/credentials hardcoded"""
    if not os.path.exists(js_links_file):
        return []

    log("\n⚙️ [*] Đang phân tích JS Secrets & Hardcoded Credentials...", Colors.C)
    js_urls = _read_txt_lines(js_links_file)[:30]
    found_secrets = []

    def fetch_and_scan(url):
        try:
            res = requests.get(url, timeout=7, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
            if res.status_code == 200 and res.text:
                for name, pattern in SECRET_PATTERNS.items():
                    matches = re.findall(pattern, res.text)
                    for match in matches:
                        secret_val = match if isinstance(match, str) else match[0]
                        found_secrets.append({
                            "type": name,
                            "url": url,
                            "secret_snippet": secret_val[:120]
                        })
        except Exception:
            pass

    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(max_workers=10) as executor:
        executor.map(fetch_and_scan, js_urls)

    out_file = os.path.join(folder, "js_secrets.json")
    with open(out_file, "w", encoding="utf-8") as f:
        json.dump(found_secrets, f, indent=2, ensure_ascii=False)

    if found_secrets:
        log(f"[+] Tìm thấy {len(found_secrets)} Secret(s) nhạy cảm trong các file JS!", Colors.G)
    return found_secrets

def run_arjun_idor_scan(combined_urls_file, folder, timeout=300):
    """Săn tham số ẩn và nguy cơ IDOR bằng Arjun"""
    if not tool_available("arjun") or not os.path.exists(combined_urls_file):
        return {}

    urls = _read_txt_lines(combined_urls_file)
    api_urls = [u for u in urls if "/api/" in u or "id=" in u or "user=" in u][:10]
    if not api_urls:
        return {}

    log("\n⚙️ [*] Đang chạy Arjun Parameter & IDOR Discovery...", Colors.C)
    targets_file = os.path.join(folder, "arjun_targets.txt")
    out_file = os.path.join(folder, "arjun_params.json")
    with open(targets_file, "w") as f:
        f.write("\n".join(api_urls) + "\n")

    run_command("Arjun", ["arjun", "-oJ", out_file, "-i", targets_file, "-t", "5", "--stable"], timeout=timeout)

    results = {}
    if os.path.exists(out_file):
        try:
            with open(out_file, "r", encoding="utf-8") as f:
                results = json.load(f)
        except Exception:
            pass
    return results

def send_telegram_file(file_path, caption=""):
    if not TELEGRAM_ENABLED or not TELEGRAM_TOKEN or not TELEGRAM_CHAT_ID:
        return
    if not os.path.exists(file_path) or os.path.getsize(file_path) == 0:
        return 
    
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendDocument"
    try:
        with open(file_path, 'rb') as f:
            requests.post(url, data={'chat_id': TELEGRAM_CHAT_ID, 'caption': caption}, files={'document': f}, timeout=20)
    except requests.RequestException as e:
        log(f"[!] Lỗi gửi file {file_path}: {e}", Colors.R)

THROTTLE_STATE = {
    "enabled": DEFAULT_THROTTLE_ENABLED,
    "current_delay": DEFAULT_THROTTLE_BASE,
    "base": DEFAULT_THROTTLE_BASE,
    "step": DEFAULT_THROTTLE_STEP,
    "max": DEFAULT_THROTTLE_MAX,
}

NUCLEI_TUNE = {
    "enabled": False,
    "rl": DEFAULT_NUCLEI_RL,
    "c": DEFAULT_NUCLEI_C,
    "rl_min": DEFAULT_NUCLEI_RL_MIN,
    "c_min": DEFAULT_NUCLEI_C_MIN,
    "rl_step": DEFAULT_NUCLEI_RL_STEP,
    "c_step": DEFAULT_NUCLEI_C_STEP,
}

def run_command(
    name,
    args,
    output_file=None,
    input_file=None,
    input_text=None,
    timeout=DEFAULT_TIMEOUT,
    retries=0,
    backoff=2.0,
):
    log(f"\n⚙️ [*] Đang chạy: {name}...", Colors.C)
    output_content = []
    stdin_handle = None
    attempt = 0
    while True:
        try:
            if THROTTLE_STATE["enabled"] and THROTTLE_STATE["current_delay"] > 0:
                time.sleep(THROTTLE_STATE["current_delay"])
            if input_file:
                stdin_handle = open(input_file, "r")
            process = subprocess.Popen(
                args,
                stdin=stdin_handle if input_file else subprocess.PIPE if input_text is not None else None,
                stdout=subprocess.PIPE,
                stderr=subprocess.STDOUT,
                text=True
            )
            if input_text is not None and process.stdin:
                process.stdin.write(input_text)
                process.stdin.close()
            for line in process.stdout:
                print(f"    {line.strip()}")
                output_content.append(line)
            process.wait(timeout=timeout)
            if process.returncode == 0:
                if THROTTLE_STATE["enabled"]:
                    THROTTLE_STATE["current_delay"] = max(
                        THROTTLE_STATE["base"], THROTTLE_STATE["current_delay"] - THROTTLE_STATE["step"]
                    )
                break
            raise subprocess.CalledProcessError(process.returncode, args)
        except Exception as e:
            attempt += 1
            log(f"[!] Lỗi chạy lệnh {name}: {e}", Colors.R)
            if NUCLEI_TUNE["enabled"] and name.lower().startswith("nuclei"):
                NUCLEI_TUNE["rl"] = max(NUCLEI_TUNE["rl_min"], NUCLEI_TUNE["rl"] - NUCLEI_TUNE["rl_step"])
                NUCLEI_TUNE["c"] = max(NUCLEI_TUNE["c_min"], NUCLEI_TUNE["c"] - NUCLEI_TUNE["c_step"])
                log(f"[!] Auto-tune Nuclei: rl={NUCLEI_TUNE['rl']} c={NUCLEI_TUNE['c']}", Colors.Y)
            if THROTTLE_STATE["enabled"]:
                THROTTLE_STATE["current_delay"] = min(
                    THROTTLE_STATE["max"], THROTTLE_STATE["current_delay"] + THROTTLE_STATE["step"]
                )
            if attempt > retries:
                break
            sleep_time = backoff * attempt
            log(f"[!] Thử lại sau {sleep_time}s...", Colors.Y)
            time.sleep(sleep_time)
        finally:
            if stdin_handle:
                stdin_handle.close()
                stdin_handle = None
    full_output = "".join(output_content)
    if output_file:
        with open(output_file, "w") as f:
            f.write(full_output)
    return full_output

def normalize_target(raw_target):
    """Cached normalize_target"""
    cleaned = raw_target.strip()
    cleaned = re.sub(r"^https?://", "", cleaned)
    cleaned = cleaned.strip("/")
    if not re.fullmatch(r"[A-Za-z0-9.:-]+", cleaned):
        raise ValueError("Target không hợp lệ. Vui lòng nhập domain hoặc IP (không kèm path).")
    return cleaned

def sanitize_folder_name(target):
    """
    Sanitize folder name từ target domain.
    Giới hạn độ dài và loại bỏ ký tự không an toàn để tránh filesystem errors.
    
    Args:
        target: Domain hoặc hostname đã được validate
        
    Returns:
        str: Tên folder an toàn để sử dụng
    """
    # Thay dấu chấm và hai chấm bằng underscore
    safe_name = target.replace(".", "_").replace(":", "_")
    # Loại bỏ các ký tự không phải alphanumeric và underscore
    safe_name = re.sub(r"[^a-zA-Z0-9_-]", "", safe_name)
    # Giới hạn độ dài để tránh lỗi filesystem (filesystem limit thường là 255)
    # Sử dụng 150 để còn chỗ cho prefix "recon_" và timestamp nếu cần
    safe_name = safe_name[:150]
    # Đảm bảo tên không rỗng
    if not safe_name:
        safe_name = "recon_output"
    return f"recon_{safe_name}"

def read_buffer_to_lines(buffer):
    """Lấy lines từ buffer"""
    return buffer.get_lines() if isinstance(buffer, DataBuffer) else []

def buffer_to_file(buffer, filepath, target_name=None, tool_name=None):
    """Ghi buffer vào file or DB if available.

    If `DB_AVAILABLE` is True and `target_name` is provided, attempt to
    write to DB via `dump_to_db`. Otherwise fallback to writing a file.
    """
    if isinstance(buffer, DataBuffer):
        if DB_AVAILABLE and target_name:
            try:
                buffer.dump_to_db(target_name=target_name, tool_name=(tool_name or "import"))
                return
            except Exception as e:
                # If DB write fails, fallback to file write
                try:
                    with open(filepath, "w") as f:
                        f.write(buffer.get_content())
                except Exception:
                    raise
        else:
            buffer.dump_to_file(filepath)

def count_lines(file_path):
    if not os.path.exists(file_path):
        return 0
    with open(file_path, "r") as f:
        return len(f.readlines())

def cleanup_temp_files(folder):
    """Xóa các file tạm sinh ra trong quá trình quét, giải phóng dung lượng ổ cứng cho Worker."""
    temp_files = [
        "subdomains.txt", "dnsx_live.txt", "httpx_tech.txt", "history_urls.txt",
        "wayback_urls.txt", "crawl_urls.txt", "js_links.txt", "combined_urls.txt",
        "open_ports.txt", "ffuf_main.txt", "live_sites.txt", "nuclei_results.txt"
    ]
    for filename in temp_files:
        filepath = os.path.join(folder, filename)
        if os.path.exists(filepath):
            try:
                os.remove(filepath)
            except Exception:
                pass

    if os.path.isdir(folder):
        for f in os.listdir(folder):
            if (f.startswith("tech_") or f.startswith("nuclei_pass") or f.startswith("nuclei_tech_")) and f.endswith(".txt"):
                try:
                    os.remove(os.path.join(folder, f))
                except Exception:
                    pass

def ensure_file(file_path):
    if not os.path.exists(file_path):
        with open(file_path, "w"):
            pass

def dedupe_file(file_path):
    if not os.path.exists(file_path):
        return
    with open(file_path, "r") as f:
        lines = [line.strip() for line in f if line.strip()]
    unique = sorted(set(lines))
    with open(file_path, "w") as f:
        f.write("\n".join(unique) + ("\n" if unique else ""))

def merge_files(output_path, input_paths):
    merged = []
    for path in input_paths:
        if os.path.exists(path):
            with open(path, "r") as f:
                merged.extend([line.strip() for line in f if line.strip()])
    if merged:
        with open(output_path, "w") as f:
            f.write("\n".join(sorted(set(merged))) + "\n")

def merge_results(output_path, input_paths):
    merge_files(output_path, input_paths)

def filter_live_domains(input_path, output_path):
    if not os.path.exists(input_path):
        return
    if not tool_available("dnsx"):
        return
    run_command("DNSX", ["dnsx", "-l", input_path, "-silent"], output_path)
    ensure_file(output_path)

def tool_available(tool_name):
    return shutil.which(tool_name) is not None

def parse_args():
    parser = argparse.ArgumentParser(description="Recon tự động cho CTF/Pentest có ủy quyền (Optimized v2.0)")
    parser.add_argument("target", help="Domain hoặc IP mục tiêu (không kèm path)")
    parser.add_argument("--wordlist", default=WORDLIST_PATH, help="Đường dẫn wordlist FFuf")
    parser.add_argument("--gau-threads", default="5", help="Số luồng GAU")
    parser.add_argument("--ffuf-threads", default="50", help="Số luồng FFuf")
    parser.add_argument("--max-urls", type=int, default=DEFAULT_MAX_URLS, help="Giới hạn số URL lịch sử để xử lý")
    parser.add_argument("--timeout", type=int, default=DEFAULT_TIMEOUT, help="Timeout cho mỗi tool (giây)")
    parser.add_argument("--retries", type=int, default=1, help="Số lần retry khi tool lỗi")
    parser.add_argument("--retry-backoff", type=float, default=2.0, help="Backoff giữa các lần retry (giây)")
    parser.add_argument("--auto-throttle", action="store_true", help="Tự giảm tốc khi lỗi/timeout")
    parser.add_argument("--throttle-base", type=float, default=DEFAULT_THROTTLE_BASE, help="Delay cơ bản trước mỗi lệnh")
    parser.add_argument("--throttle-step", type=float, default=DEFAULT_THROTTLE_STEP, help="Mức tăng delay khi lỗi")
    parser.add_argument("--throttle-max", type=float, default=DEFAULT_THROTTLE_MAX, help="Delay tối đa")
    parser.add_argument("--no-telegram", action="store_true", help="Tắt gửi Telegram")
    parser.add_argument("--batch-size", type=int, default=DEFAULT_BATCH_SIZE, help="Batch size cho FFuf/Nuclei")
    parser.add_argument("--max-workers", type=int, default=DEFAULT_THREAD_POOL, help="Max async workers")
    parser.add_argument("--ctf-mode", action="store_true", help="Tối ưu báo cáo cho CTF")
    parser.add_argument("--nuclei-auto-tags", action="store_true", help="Tự chọn nuclei tags theo tech stack")
    parser.add_argument("--nuclei-tags", default="", help="Bổ sung tags cho nuclei, cách nhau bởi dấu phẩy")
    parser.add_argument("--nuclei-exclude-tags", default="", help="Loại trừ tags cho nuclei, cách nhau bởi dấu phẩy")
    parser.add_argument("--nuclei-templates", default="", help="Đường dẫn thư mục templates nuclei (tùy chọn)")
    parser.add_argument("--nuclei-include-info", action="store_true", help="Bao gồm severity info khi quét nuclei")
    parser.add_argument("--nuclei-rate-limit", type=int, default=0, help="Giới hạn tốc độ nuclei (requests/giây)")
    parser.add_argument("--nuclei-concurrency", type=int, default=0, help="Số luồng nuclei")
    parser.add_argument("--nuclei-auto-tune", action="store_true", help="Tự điều chỉnh -rl/-c khi Nuclei lỗi")
    parser.add_argument("--nuclei-rl-default", type=int, default=DEFAULT_NUCLEI_RL, help="Rate limit mặc định khi auto-tune")
    parser.add_argument("--nuclei-c-default", type=int, default=DEFAULT_NUCLEI_C, help="Concurrency mặc định khi auto-tune")
    parser.add_argument("--nuclei-rl-min", type=int, default=DEFAULT_NUCLEI_RL_MIN, help="Rate limit tối thiểu")
    parser.add_argument("--nuclei-c-min", type=int, default=DEFAULT_NUCLEI_C_MIN, help="Concurrency tối thiểu")
    parser.add_argument("--nuclei-rl-step", type=int, default=DEFAULT_NUCLEI_RL_STEP, help="Bước giảm rate limit khi lỗi")
    parser.add_argument("--nuclei-c-step", type=int, default=DEFAULT_NUCLEI_C_STEP, help="Bước giảm concurrency khi lỗi")
    parser.add_argument("--nuclei-ctf-pack", action="store_true", help="Bổ sung tag pack cho CTF (exposures/misconfig/default-login)")
    parser.add_argument("--nuclei-two-pass", action="store_true", help="Chạy 2 lượt Nuclei (tech tags + CTF pack)")
    parser.add_argument("--nuclei-group-by-tech", action="store_true", help="Ưu tiên target theo tech stack (chạy Nuclei theo nhóm tech)")
    parser.add_argument("--telegram-files", action="store_true", help="Gửi file đính kèm qua Telegram")
    parser.add_argument("--cleanup", action="store_true", help="Dọn dẹp file tạm sau khi hoàn tất quét")
    parser.add_argument("--logic-scan", action="store_true", help="Bật quét lỗ hổng logic (Race/IDOR/Workflow)")
    parser.add_argument("--logic-base-url", default="", help="Base URL cho các module logic, ví dụ: http://127.0.0.1:8001")
    parser.add_argument("--race-endpoint", default="", help="Endpoint test race condition, ví dụ: /api/v1/coupon/apply")
    parser.add_argument("--race-concurrency", type=int, default=50, help="Số request đồng thời cho race condition")
    parser.add_argument("--idor-endpoint-template", default="", help="Endpoint template IDOR, ví dụ: /api/v1/users/{user_id}/profile")
    parser.add_argument("--token-a", default="", help="Token người dùng A")
    parser.add_argument("--token-b", default="", help="Token người dùng B")
    parser.add_argument("--workflow-endpoint", default="", help="Endpoint cuối quy trình, ví dụ: /api/v1/transfer/execute")
    return parser.parse_args()

# =================================================================
# PHÂN TÍCH DỮ LIỆU
# =================================================================

def try_decode_base64(text):
    try:
        missing_padding = len(text) % 4
        if missing_padding: text += '=' * (4 - missing_padding)
        decoded = base64.b64decode(text).decode('utf-8')
        if decoded.isprintable() and len(decoded) > 3: return decoded
    except: pass
    return None

def analyze_urls_for_secrets(file_path):
    if not os.path.exists(file_path): return ""
    findings = []
    regex_sensitive = r"(?i)(token|key|secret|password|passwd|auth)=([^& \n]+)"
    with open(file_path, "r") as f:
        for url in f.readlines():
            for key, value in re.findall(regex_sensitive, url.strip()):
                if len(value) > 5:
                    decoded = try_decode_base64(value)
                    if decoded: findings.append(f"🔓 {key}: <code>{value}</code> (Dịch mã: {decoded})")
                    else: findings.append(f"🔑 {key}: <code>{value}</code>")
    return "\n".join(list(set(findings))[:10])

def analyze_ffuf(file_path):
    if not os.path.exists(file_path): return ""
    juicy_files = []
    keywords = [".env", ".git", "admin", "backup", "config", "api", "db", "sql"]
    with open(file_path, "r") as f:
        for line in f:
            if "Status: 200" in line and any(kw in line.lower() for kw in keywords):
                juicy_files.append(f"📁 <code>{line.split(' ')[0]}</code>")
    return "\n".join(list(set(juicy_files))[:10])

def trim_file_lines(file_path, max_lines):
    if not os.path.exists(file_path):
        return
    with open(file_path, "r") as f:
        lines = f.readlines()
    if len(lines) <= max_lines:
        return
    with open(file_path, "w") as f:
        f.writelines(lines[:max_lines])

def extract_interesting_urls(file_path, limit=20):
    if not os.path.exists(file_path):
        return []
    results = []
    with open(file_path, "r") as f:
        for line in f:
            url = line.strip()
            if not url:
                continue
            if any(k in url.lower() for k in INTERESTING_KEYWORDS) or "?" in url:
                results.append(url)
            if len(results) >= limit:
                break
    return results

def score_url(url):
    score = 0
    lowered = url.lower()
    for keyword in INTERESTING_KEYWORDS:
        if keyword in lowered:
            score += 5
    if "?" in url:
        score += 5
    if "=" in url:
        score += 5
    if any(ext in lowered for ext in [".zip", ".tar", ".gz", ".bak", ".sql", ".env", ".git"]):
        score += 10
    return score

def rank_urls(file_path, limit=10):
    if not os.path.exists(file_path):
        return []
    scored = []
    with open(file_path, "r") as f:
        for line in f:
            url = line.strip()
            if not url:
                continue
            scored.append((score_url(url), url))
    scored.sort(key=lambda x: x[0], reverse=True)
    return [u for s, u in scored if s > 0][:limit]

def build_ctf_tips(highlights):
    tips = []
    if highlights.get("critical_alerts"):
        tips.append("Ưu tiên kiểm tra các dòng HIGH/CRITICAL trong nuclei_results.txt.")
    if highlights.get("secrets_found"):
        tips.append("Tìm token/secret trong URL lịch sử để đăng nhập hoặc lấy flag.")
    if highlights.get("interesting_urls"):
        tips.append("Mở nhanh các URL gợi ý (admin/login/swagger/graphql).")
    if not tips:
        tips.append("Bắt đầu từ live hosts và tìm trang login/admin/backup.")
    return tips

def build_plain_report(target, start_time, end_time, counts, highlights, ctf_mode=False):
    duration = round(end_time - start_time, 2)
    likelihood = compute_flag_likelihood(highlights)
    report_lines = [
        f"✅ Hoàn tất quét mục tiêu: {target}",
        f"⏱️ Thời gian: {duration}s",
        f"⭐ Priority Score: {highlights.get('priority_score', 0)}/100",
        f"🏁 Flag Likelihood: {likelihood}",
        f"🌐 Subdomain tìm thấy: {counts.get('subdomains', 0)}",
        f"🟢 Host còn sống: {counts.get('live_hosts', 0)}",
        f"🔗 URL lịch sử: {counts.get('gau_urls', 0)}",
        f"📄 JS links: {counts.get('js_links', 0)}",
    ]
    if highlights.get("critical_alerts"):
        report_lines.append("🚨 Có lỗ hổng HIGH/CRITICAL (xem file nuclei_results.txt)")
    else:
        report_lines.append("✅ Không thấy HIGH/CRITICAL trong nuclei")
    if highlights.get("secrets_found"):
        report_lines.append("🔐 Có dấu hiệu lộ token/secret (xem báo cáo chi tiết)")
    else:
        report_lines.append("✅ Không thấy dấu hiệu lộ token/secret")
    if highlights.get("interesting_urls"):
        report_lines.append("⭐ Gợi ý nhanh (URL đáng chú ý):")
        report_lines.extend([f"- {url}" for url in highlights["interesting_urls"][:10]])
    if highlights.get("nuclei_tags"):
        report_lines.append("🏷️ Nuclei tags đã dùng:")
        report_lines.append(", ".join(highlights["nuclei_tags"]))
    if highlights.get("nuclei_stats"):
        stats = highlights["nuclei_stats"]
        report_lines.append(
            f"📊 Nuclei stats: info={stats['info']} low={stats['low']} medium={stats['medium']} high={stats['high']} critical={stats['critical']}"
        )
    if ctf_mode:
        report_lines.append("🧭 Bước tiếp theo đề xuất:")
        report_lines.extend([f"- {tip}" for tip in build_ctf_tips(highlights)])
    return "\n".join(report_lines)

def build_json_report(target, start_time, end_time, counts, highlights, output_path):
    payload = {
        "target": target,
        "duration_seconds": round(end_time - start_time, 2),
        "counts": counts,
        "highlights": highlights,
    }
    with open(output_path, "w") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

def _read_txt_lines(file_path):
    if not os.path.exists(file_path):
        return []
    with open(file_path, "r") as f:
        return [line.strip() for line in f if line.strip()]

def _parse_nuclei_findings(file_path):
    findings = []
    for line in _read_txt_lines(file_path):
        lowered = line.lower()
        severity = "unknown"
        for sev in ["critical", "high", "medium", "low", "info"]:
            if f"[{sev}]" in lowered:
                severity = sev
                break
        findings.append({"severity": severity, "raw": line})
    return findings

def _parse_ffuf_findings(file_path):
    findings = []
    for line in _read_txt_lines(file_path):
        lowered = line.lower()
        if "status:" in lowered:
            findings.append({"raw": line})
    return findings

def build_result_json_tree(target, folder, counts, highlights, output_path, logic_results=None):
    logic_results = logic_results or {}

    sub_file = f"{folder}/subdomains.txt"
    dnsx_file = f"{folder}/dnsx_live.txt"
    live_file = f"{folder}/live_sites.txt"

    gau_file = f"{folder}/history_urls.txt"
    wayback_file = f"{folder}/wayback_urls.txt"
    katana_file = f"{folder}/crawl_urls.txt"
    combined_urls = f"{folder}/combined_urls.txt"
    js_file = f"{folder}/js_links.txt"

    vuln_file = f"{folder}/nuclei_results.txt"
    ffuf_file = f"{folder}/ffuf_main.txt"

    payload = {
        "target": target,
        "counts": counts,
        "highlights": highlights,
        "subdomains": {
            "all": _read_txt_lines(sub_file),
            "dns_live": _read_txt_lines(dnsx_file),
            "http_live": _read_txt_lines(live_file),
        },
        "urls": {
            "gau": _read_txt_lines(gau_file),
            "wayback": _read_txt_lines(wayback_file),
            "katana": _read_txt_lines(katana_file),
            "combined": _read_txt_lines(combined_urls),
            "js_links": _read_txt_lines(js_file),
        },
        "vulnerabilities": {
            "nuclei": _parse_nuclei_findings(vuln_file),
            "ffuf": _parse_ffuf_findings(ffuf_file),
        },
        "logic_vulnerabilities": logic_results,
    }
    with open(output_path, "w") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

def build_priority_summary(counts, highlights):
    score = 0
    reasons = []
    if highlights.get("critical_alerts"):
        score += 50
        reasons.append("Có lỗ hổng HIGH/CRITICAL")
    if highlights.get("secrets_found"):
        score += 30
        reasons.append("Có dấu hiệu lộ token/secret")
    interesting_count = len(highlights.get("interesting_urls", []))
    if interesting_count:
        score += min(20, interesting_count * 2)
        reasons.append("Có URL đáng chú ý (admin/login/swagger/backup)")
    if counts.get("live_hosts", 0) == 0:
        reasons.append("Không có host live (kiểm tra DNS/wordlist)")
    score = min(score, 100)
    return score, reasons

def build_checklist(highlights):
    steps = [
        "Mở các URL đáng chú ý và kiểm tra login/admin/api/docs",
        "Tìm file backup hoặc cấu hình rò rỉ (.env/.git/.zip/.sql)",
        "Đọc nhanh nuclei_results.txt để ưu tiên lỗi nặng",
        "Kiểm tra tham số URL có token/secret",
        "Rà soát các endpoint có khả năng lộ cấu hình hệ thống",
    ]
    if highlights.get("critical_alerts"):
        steps.insert(0, "Ưu tiên xử lý các dòng HIGH/CRITICAL trước")
    return steps

def build_html_report(target, start_time, end_time, counts, highlights, output_path):
    score = highlights.get("priority_score", 0)
    likelihood = compute_flag_likelihood(highlights)
    reasons = highlights.get("priority_reasons", [])
    urls = highlights.get("interesting_urls", [])
    top_targets = highlights.get("top_targets", [])
    checklist = build_checklist(highlights)
    html = f"""<!doctype html>
<html lang=\"vi\">
<head>
    <meta charset=\"utf-8\">
    <meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">
    <title>CTF Recon Report - {target}</title>
    <style>
        body {{ font-family: Arial, sans-serif; margin: 24px; color: #1f2937; }}
        .card {{ border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 16px; }}
        .badge {{ display: inline-block; padding: 4px 8px; background: #111827; color: #fff; border-radius: 999px; font-size: 12px; }}
        h1 {{ margin: 0 0 8px; }}
        ul {{ margin: 8px 0 0 18px; }}
        .score {{ font-size: 28px; font-weight: bold; }}
    </style>
</head>
<body>
    <h1>CTF Recon Report</h1>
    <p><span class=\"badge\">Target</span> {target}</p>
    <div class=\"card\">
    <div class=\"score\">Priority Score: {score}/100</div>
    <p>Flag Likelihood: {likelihood}</p>
        <p>Lý do ưu tiên: {'; '.join(reasons) if reasons else 'Không có ưu tiên đặc biệt'}</p>
    </div>
    <div class=\"card\">
        <h3>Thống kê nhanh</h3>
        <ul>
            <li>Subdomains: {counts.get('subdomains', 0)}</li>
            <li>Live hosts: {counts.get('live_hosts', 0)}</li>
            <li>GAU URLs: {counts.get('gau_urls', 0)}</li>
            <li>JS links: {counts.get('js_links', 0)}</li>
        </ul>
    </div>
    <div class=\"card\">
        <h3>URL đáng chú ý</h3>
        <ul>
            {''.join([f'<li><a href="{u}">{u}</a></li>' for u in urls[:20]]) or '<li>Không có</li>'}
        </ul>
    </div>
    <div class=\"card\">
        <h3>Top mục tiêu ưu tiên</h3>
        <ul>
            {''.join([f'<li><a href="{u}">{u}</a></li>' for u in top_targets[:10]]) or '<li>Không có</li>'}
        </ul>
    </div>
    <div class=\"card\">
        <h3>Checklist gợi ý</h3>
        <ul>
            {''.join([f'<li>{s}</li>' for s in checklist])}
        </ul>
    </div>
    <div class=\"card\">
        <h3>Thời gian</h3>
        <p>Bắt đầu: {time.ctime(start_time)}<br>Hoàn tất: {time.ctime(end_time)}</p>
    </div>
</body>
</html>"""
    with open(output_path, "w") as f:
        f.write(html)

def build_markdown_report(target, start_time, end_time, counts, highlights, output_path):
    score = highlights.get("priority_score", 0)
    likelihood = compute_flag_likelihood(highlights)
    reasons = highlights.get("priority_reasons", [])
    urls = highlights.get("interesting_urls", [])
    top_targets = highlights.get("top_targets", [])
    checklist = build_checklist(highlights)
    lines = [
        f"# CTF Recon Report - {target}",
        "",
        f"**Priority Score:** {score}/100",
        f"**Flag Likelihood:** {likelihood}",
        f"**Lý do ưu tiên:** {', '.join(reasons) if reasons else 'Không có'}",
        f"**Nuclei tags:** {', '.join(highlights.get('nuclei_tags', [])) or 'Không có'}",
        "",
        f"**Nuclei stats:** {highlights.get('nuclei_stats', {})}",
        "## Thống kê nhanh",
        f"- Subdomains: {counts.get('subdomains', 0)}",
        f"- Live hosts: {counts.get('live_hosts', 0)}",
        f"- GAU URLs: {counts.get('gau_urls', 0)}",
        f"- JS links: {counts.get('js_links', 0)}",
        "",
        "## Top mục tiêu ưu tiên",
    ]
    lines.extend([f"- {u}" for u in top_targets] or ["- Không có"])
    lines += ["", "## URL đáng chú ý"]
    lines.extend([f"- {u}" for u in urls] or ["- Không có"])
    lines += ["", "## Checklist gợi ý"]
    lines.extend([f"- {s}" for s in checklist])
    lines += ["", "## Thời gian", f"- Bắt đầu: {time.ctime(start_time)}", f"- Hoàn tất: {time.ctime(end_time)}"]
    with open(output_path, "w") as f:
        f.write("\n".join(lines))

def extract_nuclei_tags_from_tech(tech_file):
    if not os.path.exists(tech_file):
        return []
    tags = set()
    with open(tech_file, "r") as f:
        for line in f:
            lowered = line.lower()
            for key, tag in TECH_TAG_MAP.items():
                if key in lowered:
                    tags.add(tag)
    return sorted(tags)

def group_targets_by_tech(tech_file):
    if not os.path.exists(tech_file):
        return {}
    groups = {}
    with open(tech_file, "r") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            parts = line.split()
            if not parts:
                continue
            url = parts[0]
            lowered = line.lower()
            for key, tag in TECH_TAG_MAP.items():
                if key in lowered:
                    groups.setdefault(tag, set()).add(url)
    return {tag: sorted(list(urls)) for tag, urls in groups.items()}

def build_nuclei_args(base_args, args, nuclei_tags):
    nuclei_args = base_args[:]
    if args.nuclei_templates:
        nuclei_args += ["-t", args.nuclei_templates]
    if nuclei_tags:
        nuclei_args += ["-tags", ",".join(nuclei_tags)]
    if args.nuclei_exclude_tags:
        nuclei_args += ["-exclude-tags", args.nuclei_exclude_tags]
    if args.nuclei_rate_limit and args.nuclei_rate_limit > 0:
        nuclei_args += ["-rl", str(args.nuclei_rate_limit)]
    elif NUCLEI_TUNE["enabled"]:
        nuclei_args += ["-rl", str(NUCLEI_TUNE["rl"])]
    if args.nuclei_concurrency and args.nuclei_concurrency > 0:
        nuclei_args += ["-c", str(args.nuclei_concurrency)]
    elif NUCLEI_TUNE["enabled"]:
        nuclei_args += ["-c", str(NUCLEI_TUNE["c"])]
    return nuclei_args

def parse_nuclei_severity_stats(file_path):
    if not os.path.exists(file_path):
        return {"info": 0, "low": 0, "medium": 0, "high": 0, "critical": 0}
    stats = {"info": 0, "low": 0, "medium": 0, "high": 0, "critical": 0}
    with open(file_path, "r") as f:
        for line in f:
            lowered = line.lower()
            for key in stats.keys():
                if f"[{key}]" in lowered:
                    stats[key] += 1
    return stats

def summarize_nuclei(file_path, limit=5):
    if not os.path.exists(file_path):
        return []
    results = []
    with open(file_path, "r") as f:
        for line in f:
            line = line.strip()
            if line:
                results.append(line)
            if len(results) >= limit:
                break
    return results

def summarize_ffuf(file_path, limit=5):
    if not os.path.exists(file_path):
        return []
    results = []
    with open(file_path, "r") as f:
        for line in f:
            if "Status:" in line:
                parts = line.strip().split()
                if parts:
                    results.append(parts[0])
            if len(results) >= limit:
                break
    return results

def classify_risks_from_nuclei(file_path, limit=5):
    if not os.path.exists(file_path):
        return []
    impacts = []
    with open(file_path, "r") as f:
        for line in f:
            lowered = line.lower()
            for key, msg in RISK_KEYWORDS.items():
                if key in lowered:
                    impacts.append(msg)
            if len(impacts) >= limit:
                break
    return list(dict.fromkeys(impacts))[:limit]

def classify_risks_from_paths(paths):
    impacts = []
    for path in paths:
        lowered = path.lower()
        if ".env" in lowered or ".git" in lowered:
            impacts.append("Có thể lộ biến môi trường hoặc mã nguồn nếu truy cập mở.")
        if "admin" in lowered or "login" in lowered:
            impacts.append("Có thể lộ trang quản trị hoặc cổng đăng nhập cần kiểm tra quyền.")
        if "backup" in lowered or ".zip" in lowered or ".tar" in lowered or ".bak" in lowered:
            impacts.append("Có thể lộ file sao lưu chứa dữ liệu nhạy cảm.")
        if "swagger" in lowered or "graphql" in lowered:
            impacts.append("Có thể lộ tài liệu API, giúp liệt kê chức năng nội bộ.")
    return list(dict.fromkeys(impacts))

def classify_risks_from_ports(ports):
    impacts = []
    for item in ports:
        if ":" in item:
            port = item.split(":")[-1]
        else:
            port = item
        if port in ["21", "22", "23", "3389", "5900"]:
            impacts.append("Có dịch vụ quản trị/remote; cần đảm bảo không lộ thông tin đăng nhập.")
        if port in ["6379", "27017", "9200", "5432", "3306", "1433"]:
            impacts.append("Có dịch vụ dữ liệu mở; cần kiểm tra quyền truy cập.")
    return list(dict.fromkeys(impacts))

def summarize_ports(file_path, limit=5):
    if not os.path.exists(file_path):
        return []
    ports = []
    with open(file_path, "r") as f:
        for line in f:
            line = line.strip()
            if line:
                ports.append(line)
            if len(ports) >= limit:
                break
    return ports

def summarize_tech(file_path, limit=5):
    if not os.path.exists(file_path):
        return []
    tech = []
    with open(file_path, "r") as f:
        for line in f:
            line = line.strip()
            if line:
                tech.append(line)
            if len(tech) >= limit:
                break
    return tech

def build_human_summary(counts, highlights, samples):
    likelihood = compute_flag_likelihood(highlights)
    lines = [
        "📌 Tóm tắt dễ hiểu:",
        f"- Có {counts.get('subdomains', 0)} subdomain; {counts.get('live_hosts', 0)} host đang hoạt động.",
        f"- Có {counts.get('gau_urls', 0)} URL tổng hợp; {counts.get('js_links', 0)} JS links.",
        f"- Priority score: {highlights.get('priority_score', 0)}/100.",
        f"- Khả năng ra flag: {likelihood}.",
    ]
    if highlights.get("critical_alerts"):
        lines.append("- Có lỗ hổng mức HIGH/CRITICAL (ưu tiên xử lý).")
    if highlights.get("secrets_found"):
        lines.append("- Có dấu hiệu lộ token/secret trong URL.")
    if samples.get("nuclei"):
        lines.append("- Ví dụ kết quả Nuclei:")
        lines.extend([f"  • {item}" for item in samples["nuclei"]])
    if samples.get("ffuf"):
        lines.append("- Ví dụ đường dẫn nhạy cảm từ FFuf:")
        lines.extend([f"  • {item}" for item in samples["ffuf"]])
    if samples.get("ports"):
        lines.append("- Cổng mở đáng chú ý:")
        lines.extend([f"  • {item}" for item in samples["ports"]])
    if samples.get("tech"):
        lines.append("- Tech stack tiêu biểu:")
        lines.extend([f"  • {item}" for item in samples["tech"]])
    return "\n".join(lines)

def build_action_advice(counts, highlights, samples):
    advice = ["🧭 Phân tích nguyên nhân & hành động gợi ý:"]

    if counts.get("live_hosts", 0) == 0:
        advice.append("- Nguyên nhân: Không có host live. Hành động: kiểm tra DNS, chạy lại subfinder/dnsx, hoặc dùng danh sách subdomain khác.")
    else:
        advice.append("- Nguyên nhân: Có host live. Hành động: ưu tiên truy cập login/admin và kiểm tra trang nhạy cảm.")

    if highlights.get("critical_alerts"):
        advice.append("- Nguyên nhân: Nuclei báo HIGH/CRITICAL. Hành động: mở các dòng đó để xác nhận và khai thác nhanh.")
    else:
        advice.append("- Nguyên nhân: Không thấy HIGH/CRITICAL. Hành động: tập trung vào cấu hình hở và logic flaws.")

    if highlights.get("secrets_found"):
        advice.append("- Nguyên nhân: URL chứa token/secret. Hành động: thử token để đăng nhập hoặc truy cập API.")
    else:
        advice.append("- Nguyên nhân: Chưa thấy token/secret. Hành động: rà tham số URL hoặc JS để tìm endpoint ẩn.")

    if samples.get("ffuf"):
        advice.append("- Nguyên nhân: FFuf tìm được đường dẫn nhạy cảm. Hành động: kiểm tra quyền truy cập và file backup.")
    else:
        advice.append("- Nguyên nhân: FFuf chưa thấy gì nổi bật. Hành động: thử wordlist khác hoặc tăng depth.")

    if samples.get("ports"):
        advice.append("- Nguyên nhân: Có cổng mở. Hành động: kiểm tra dịch vụ web trên cổng không chuẩn.")
    else:
        advice.append("- Nguyên nhân: Không có cổng mở rõ ràng. Hành động: tập trung web app trên 80/443.")

    if samples.get("tech"):
        advice.append("- Nguyên nhân: Có tech stack. Hành động: chạy nuclei theo tag tương ứng hoặc tìm CVE phổ biến.")
    else:
        advice.append("- Nguyên nhân: Chưa nhận diện tech. Hành động: kiểm tra manual response headers.")

    if highlights.get("top_targets"):
        advice.append("- Ưu tiên: kiểm tra ngay top mục tiêu đã xếp hạng.")
    else:
        advice.append("- Ưu tiên: chưa có top target, hãy bắt đầu từ live hosts và URL có tham số.")

    return "\n".join(advice)

def compute_flag_likelihood(highlights):
    score = highlights.get("priority_score", 0)
    if score >= 70:
        return "HIGH"
    if score >= 40:
        return "MEDIUM"
    return "LOW"

# =================================================================
# HÀM CHÍNH
# =================================================================

def main():
    # ⚠️  CẢNH BÁO BẢO MẬT: Không bao giờ truyền token/secret qua command-line arguments
    # Luôn đọc từ biến môi trường hoặc file .env để tránh lộ trong process listing
    if not os.environ.get("TELEGRAM_TOKEN") or not os.environ.get("TELEGRAM_CHAT_ID"):
        log(
            "[!] CẢNH BÁO: TELEGRAM_TOKEN và TELEGRAM_CHAT_ID chưa được thiết lập qua biến môi trường.\n"
            "    Để sử dụng Telegram notifications, hãy thiết lập:\n"
            "    $ export TELEGRAM_TOKEN=your_token\n"
            "    $ export TELEGRAM_CHAT_ID=your_chat_id\n"
            "    ℹ️  Để tắt Telegram, dùng flag --no-telegram\n",
            Colors.Y,
        )
    
    args = parse_args()
    global TELEGRAM_TOKEN, TELEGRAM_CHAT_ID, TELEGRAM_ENABLED
    # TELEGRAM_TOKEN và TELEGRAM_CHAT_ID đã được khởi tạo từ os.environ ở đầu file
    # Do không có --telegram-token argument nữa, sử dụng trực tiếp biến global
    TELEGRAM_ENABLED = not args.no_telegram

    THROTTLE_STATE["enabled"] = args.auto_throttle
    THROTTLE_STATE["base"] = args.throttle_base
    THROTTLE_STATE["step"] = args.throttle_step
    THROTTLE_STATE["max"] = args.throttle_max
    THROTTLE_STATE["current_delay"] = args.throttle_base

    NUCLEI_TUNE["enabled"] = args.nuclei_auto_tune
    NUCLEI_TUNE["rl"] = args.nuclei_rl_default
    NUCLEI_TUNE["c"] = args.nuclei_c_default
    NUCLEI_TUNE["rl_min"] = args.nuclei_rl_min
    NUCLEI_TUNE["c_min"] = args.nuclei_c_min
    NUCLEI_TUNE["rl_step"] = args.nuclei_rl_step
    NUCLEI_TUNE["c_step"] = args.nuclei_c_step

    try:
        target = normalize_target(args.target)
    except ValueError as exc:
        log(str(exc), Colors.R)
        sys.exit(1)

    folder = sanitize_folder_name(target)
    if not os.path.exists(folder): os.makedirs(folder)

    start_time = time.time()
    
    send_telegram(f"▶️ <b>[KHỞI ĐỘNG] Mục tiêu:</b> <code>{target}</code>")

    tool_list = list(dict.fromkeys(["subfinder", "httpx-toolkit", "gau", "subjs", "nuclei", "ffuf"] + EXTRA_TOOLS))
    missing_tools = [tool for tool in tool_list if not tool_available(tool)]
    if missing_tools:
        log(f"[!] Cảnh báo: Thiếu các công cụ sau ({', '.join(missing_tools)}). Hệ thống sẽ bỏ qua và tiếp tục.", Colors.Y)

    # BƯỚC 1: Subdomain
    send_telegram("⏳ <b>[TIẾN TRÌNH]</b> Quét Subfinder...")
    sub_file = f"{folder}/subdomains.txt"
    if tool_available("subfinder"):
        run_command("Subfinder", ["subfinder", "-d", target, "-silent"], sub_file, timeout=args.timeout, retries=args.retries, backoff=args.retry_backoff)
    else:
        log("[!] Cảnh báo: subfinder không khả dụng, bỏ qua.", Colors.Y)
    ensure_file(sub_file)
    with open(sub_file, "a") as f:
        f.write(f"{target}\n")

    sub_count = count_lines(sub_file)

    # BƯỚC 1.2: DNSX (lọc domain có DNS sống)
    dnsx_file = f"{folder}/dnsx_live.txt"
    filter_live_domains(sub_file, dnsx_file)
    if os.path.exists(dnsx_file) and count_lines(dnsx_file) > 0:
        sub_file_for_httpx = dnsx_file
    else:
        sub_file_for_httpx = sub_file

    # BƯỚC 1.5: Port Scan (naabu)
    ports_file = f"{folder}/open_ports.txt"
    if tool_available("naabu"):
        run_command("Naabu", ["naabu", "-l", sub_file, "-silent"], ports_file, timeout=args.timeout)
    else:
        log("[!] Cảnh báo: naabu không khả dụng, bỏ qua.", Colors.Y)
    ensure_file(ports_file)

    # BƯỚC 2: Live Host
    send_telegram(f"✅ <b>[THÔNG TIN]</b> Tìm thấy {sub_count} Subdomains. Đang chạy HTTPX...")
    live_file = f"{folder}/live_sites.txt"
    if tool_available("httpx-toolkit"):
        run_command("HTTPX", ["httpx-toolkit", "-l", sub_file_for_httpx, "-silent", "-mc", "200,301,302,403"], live_file, timeout=args.timeout, retries=args.retries, backoff=args.retry_backoff)
    else:
        log("[!] Cảnh báo: httpx-toolkit không khả dụng, bỏ qua.", Colors.Y)
    ensure_file(live_file)

    live_count = count_lines(live_file)

    tech_file = f"{folder}/httpx_tech.txt"
    if tool_available("httpx-toolkit"):
        run_command("HTTPX-Tech", ["httpx-toolkit", "-l", live_file, "-title", "-tech-detect", "-status-code", "-silent"], tech_file, timeout=args.timeout, retries=args.retries, backoff=args.retry_backoff)
    else:
        log("[!] Cảnh báo: httpx-toolkit không khả dụng cho tech-detect, bỏ qua.", Colors.Y)
    ensure_file(tech_file)

    # BƯỚC 3 & 4: URL Crawling & History
    send_telegram(f"✅ <b>[THÔNG TIN]</b> Có {live_count} host đang hoạt động. Khởi chạy Crawl & GAU...")

    katana_file = f"{folder}/crawl_urls.txt"
    if tool_available("katana"):
        run_command("Katana", ["katana", "-list", live_file, "-silent"], katana_file, timeout=args.timeout, retries=args.retries, backoff=args.retry_backoff)
    else:
        log("[!] Cảnh báo: katana không khả dụng, bỏ qua.", Colors.Y)
    ensure_file(katana_file)

    gau_file = f"{folder}/history_urls.txt"
    if tool_available("gau"):
        run_command("GAU", ["gau", "--threads", str(args.gau_threads)], gau_file, input_file=sub_file, timeout=args.timeout, retries=args.retries, backoff=args.retry_backoff)
    ensure_file(gau_file)
    trim_file_lines(gau_file, args.max_urls)

    wayback_file = f"{folder}/wayback_urls.txt"
    if tool_available("waybackurls"):
        run_command("WaybackURLs", ["waybackurls"], wayback_file, input_file=sub_file, timeout=args.timeout, retries=args.retries, backoff=args.retry_backoff)
    ensure_file(wayback_file)

    combined_urls = f"{folder}/combined_urls.txt"
    merge_files(combined_urls, [gau_file, wayback_file, katana_file])
    ensure_file(combined_urls)
    dedupe_file(combined_urls)
    trim_file_lines(combined_urls, args.max_urls)

    js_file = f"{folder}/js_links.txt"
    if tool_available("subjs"):
        run_command("SubJS", ["subjs"], js_file, input_file=combined_urls, timeout=args.timeout, retries=args.retries, backoff=args.retry_backoff)
    ensure_file(js_file)

    # BƯỚC 4.5: Phân tích Tĩnh JS Secrets & Arjun IDOR Discovery
    analyze_js_secrets_deep(js_file, folder)
    arjun_results = run_arjun_idor_scan(combined_urls, folder, timeout=args.timeout)

    # BƯỚC 5: Nuclei
    send_telegram("⏳ <b>[TIẾN TRÌNH]</b> Quét lỗ hổng bằng Nuclei...")
    vuln_file = f"{folder}/nuclei_results.txt"
    nuclei_tags = []
    manual_tags = [t.strip() for t in args.nuclei_tags.split(",") if t.strip()] if args.nuclei_tags else []
    tech_tags = extract_nuclei_tags_from_tech(tech_file) if args.nuclei_auto_tags and os.path.exists(tech_file) else []
    ctf_tags = ["exposures", "misconfiguration", "default-login"] if args.nuclei_ctf_pack else []
    nuclei_tags = sorted(set(manual_tags + tech_tags + ctf_tags))

    if tool_available("nuclei"):
        severity = "low,medium,high,critical"
        if args.nuclei_include_info:
            severity = "info," + severity
        base_args = ["nuclei", "-l", live_file, "-severity", severity, "-silent"]
        if args.nuclei_group_by_tech and os.path.exists(tech_file):
            group_outputs = []
            groups = group_targets_by_tech(tech_file)
            for tag, urls in groups.items():
                if not urls:
                    continue
                group_file = f"{folder}/tech_{tag}.txt"
                with open(group_file, "w") as f:
                    f.write("\n".join(urls) + "\n")
                group_out = f"{folder}/nuclei_{tag}.txt"
                group_tags = sorted(set([tag] + manual_tags))
                nuclei_args_group = build_nuclei_args(base_args, args, group_tags)
                run_command(f"Nuclei-{tag}", nuclei_args_group, group_out, timeout=args.timeout, retries=args.retries, backoff=args.retry_backoff)
                group_outputs.append(group_out)

            if args.nuclei_two_pass or args.nuclei_ctf_pack:
                pass2_file = f"{folder}/nuclei_pass2.txt"
                pass2_tags = sorted(set(ctf_tags)) if ctf_tags else []
                nuclei_args_2 = build_nuclei_args(base_args, args, pass2_tags)
                run_command("Nuclei-CTF", nuclei_args_2, pass2_file, timeout=args.timeout, retries=args.retries, backoff=args.retry_backoff)
                group_outputs.append(pass2_file)

            merge_results(vuln_file, group_outputs)
        elif args.nuclei_two_pass:
            pass1_tags = sorted(set(tech_tags + manual_tags))
            pass2_tags = sorted(set(ctf_tags))

            pass1_file = f"{folder}/nuclei_pass1.txt"
            pass2_file = f"{folder}/nuclei_pass2.txt"
            nuclei_args_1 = build_nuclei_args(base_args, args, pass1_tags)
            nuclei_args_2 = build_nuclei_args(base_args, args, pass2_tags)

            run_command("Nuclei-Pass1", nuclei_args_1, pass1_file, timeout=args.timeout, retries=args.retries, backoff=args.retry_backoff)
            run_command("Nuclei-Pass2", nuclei_args_2, pass2_file, timeout=args.timeout, retries=args.retries, backoff=args.retry_backoff)
            merge_results(vuln_file, [pass1_file, pass2_file])
        else:
            nuclei_args = build_nuclei_args(base_args, args, nuclei_tags)
            run_command("Nuclei", nuclei_args, vuln_file, timeout=args.timeout, retries=args.retries, backoff=args.retry_backoff)
    ensure_file(vuln_file)

    # BƯỚC 6: FFuf
    send_telegram("⏳ <b>[TIẾN TRÌNH]</b> Dò tìm thư mục bằng FFuf...")
    ffuf_out = f"{folder}/ffuf_main.txt"
    if os.path.exists(args.wordlist) and tool_available("ffuf"):
        run_command(
            "FFuf",
            ["ffuf", "-u", f"https://{target}/FUZZ", "-w", args.wordlist, "-mc", "200", "-t", str(args.ffuf_threads), "-v"],
            ffuf_out,
            timeout=args.timeout,
            retries=args.retries,
            backoff=args.retry_backoff
        )
    else:
        log("[!] Bỏ qua FFuf: thiếu wordlist hoặc ffuf.", Colors.Y)
    ensure_file(ffuf_out)

    # ---------------- TỔNG KẾT ----------------
    end_time = time.time()
    send_telegram("🔄 <b>[TIẾN TRÌNH]</b> Đang xuất báo cáo...")

    critical_alerts = ""
    if os.path.exists(vuln_file):
        with open(vuln_file, "r") as f:
            alerts = [l.strip() for l in f.readlines() if "[high]" in l.lower() or "[critical]" in l.lower()]
            if alerts: critical_alerts = "\n\n🚨 <b>[LỖ HỔNG] NGHIÊM TRỌNG (HIGH/CRITICAL):</b>\n" + "\n".join([f"• <code>{a}</code>" for a in alerts[:7]])
            else: critical_alerts = "\n\n✅ <b>[LỖ HỔNG]</b> An toàn. Không có lỗi High/Critical."

    secrets_found = analyze_urls_for_secrets(combined_urls)
    secrets_msg = f"\n\n💎 <b>[DỮ LIỆU NHẠY CẢM] BỊ LỘ:</b>\n{secrets_found}" if secrets_found else "\n\n✅ <b>[DỮ LIỆU NHẠY CẢM]</b> An toàn. Không rò rỉ Key/Token."

    juicy_ffuf = analyze_ffuf(ffuf_out)
    ffuf_msg = f"\n\n📂 <b>[THƯ MỤC/FILE] ĐANG MỞ:</b>\n{juicy_ffuf}" if juicy_ffuf else "\n\n✅ <b>[THƯ MỤC/FILE]</b> An toàn. Không lộ thư mục ẩn."

    report = (
        f"📊 <b>[BÁO CÁO] HOÀN TẤT QUÉT</b>\n"
        f"🎯 Mục tiêu: <code>{target}</code>\n"
        f"⏱️ Thời gian: {round(end_time - start_time, 2)}s\n"
        f"{critical_alerts}{secrets_msg}{ffuf_msg}"
    )
    send_telegram(report)

    counts = {
        "subdomains": sub_count,
        "live_hosts": live_count,
        "gau_urls": count_lines(combined_urls),
        "js_links": count_lines(js_file),
    }
    highlights = {
        "critical_alerts": bool(critical_alerts and "NGHIÊM TRỌNG" in critical_alerts),
        "secrets_found": bool(secrets_found),
        "interesting_urls": extract_interesting_urls(combined_urls, limit=20),
        "nuclei_tags": nuclei_tags,
        "nuclei_stats": parse_nuclei_severity_stats(vuln_file),
    }
    highlights["top_targets"] = rank_urls(combined_urls, limit=10)
    priority_score, priority_reasons = build_priority_summary(counts, highlights)
    highlights["priority_score"] = priority_score
    highlights["priority_reasons"] = priority_reasons
    plain_report = build_plain_report(target, start_time, end_time, counts, highlights, ctf_mode=args.ctf_mode)
    send_telegram(plain_report)

    samples = {
        "nuclei": summarize_nuclei(vuln_file, limit=5),
        "ffuf": summarize_ffuf(ffuf_out, limit=5),
        "ports": summarize_ports(ports_file, limit=5),
        "tech": summarize_tech(tech_file, limit=5),
    }
    human_summary = build_human_summary(counts, highlights, samples)
    send_telegram(human_summary)

    risk_notes = []
    risk_notes.extend(classify_risks_from_nuclei(vuln_file, limit=5))
    risk_notes.extend(classify_risks_from_paths(samples.get("ffuf", [])))
    risk_notes.extend(classify_risks_from_paths(highlights.get("top_targets", [])))
    risk_notes.extend(classify_risks_from_ports(samples.get("ports", [])))
    if risk_notes:
        risk_block = "\n".join(["🛡️ Ảnh hưởng tiềm ẩn (mức khái quát):"] + [f"- {r}" for r in list(dict.fromkeys(risk_notes))[:7]])
        send_telegram(risk_block)

    action_advice = build_action_advice(counts, highlights, samples)
    send_telegram(action_advice)

    logic_results = {}
    if args.logic_scan and args.logic_base_url:
        try:
            from modules.logic.race_condition import RaceConditionScanner
            from modules.logic.idor_scanner import IDORScanner
            from modules.logic.workflow_bypass import WorkflowBypassScanner

            if args.race_endpoint:
                race_scanner = RaceConditionScanner(base_url=args.logic_base_url)
                logic_results["race_condition"] = race_scanner.scan(
                    endpoint=args.race_endpoint,
                    method="POST",
                    body={"coupon": "PROMO100"},
                    headers={},
                    concurrency=args.race_concurrency,
                )

            if args.idor_endpoint_template and args.token_a and args.token_b:
                idor_scanner = IDORScanner(base_url=args.logic_base_url)
                logic_results["idor_bola"] = idor_scanner.scan(
                    endpoint_template=args.idor_endpoint_template,
                    token_a=args.token_a,
                    token_b=args.token_b,
                    user_id_a="1001",
                    user_id_b="2002",
                )

            if args.workflow_endpoint:
                workflow_scanner = WorkflowBypassScanner(base_url=args.logic_base_url)
                logic_results["workflow_bypass"] = workflow_scanner.scan(
                    prerequisite_endpoints=["/api/v1/otp/send", "/api/v1/otp/verify"],
                    final_endpoint=args.workflow_endpoint,
                    final_method="POST",
                    final_body={"amount": 10000, "to": "ACC-XYZ"},
                )
        except Exception as e:
            logic_results["error"] = str(e)

    json_report_path = f"{folder}/summary.json"
    build_json_report(target, start_time, end_time, counts, highlights, json_report_path)

    result_json_path = f"{folder}/result.json"
    build_result_json_tree(target, folder, counts, highlights, result_json_path, logic_results=logic_results)

    html_report_path = f"{folder}/report.html"
    build_html_report(target, start_time, end_time, counts, highlights, html_report_path)

    md_report_path = f"{folder}/report.md"
    build_markdown_report(target, start_time, end_time, counts, highlights, md_report_path)

    if args.telegram_files and TELEGRAM_ENABLED and TELEGRAM_TOKEN and TELEGRAM_CHAT_ID:
        log("\n📤 [*] Đang tải file kết quả lên Telegram...", Colors.C)
        send_telegram_file(live_file, "📄 [TỆP] Danh sách trang web đang hoạt động")
        send_telegram_file(vuln_file, "🐞 [TỆP] Kết quả quét lỗi Nuclei")
        send_telegram_file(gau_file, "🔗 [TỆP] Lịch sử URL (GAU)")
        send_telegram_file(wayback_file, "🕰️ [TỆP] Lịch sử URL (WaybackURLs)")
        send_telegram_file(katana_file, "🕷️ [TỆP] URL crawl (Katana)")
        send_telegram_file(combined_urls, "🧩 [TỆP] URL tổng hợp")
        send_telegram_file(ports_file, "🧭 [TỆP] Cổng mở (Naabu)")
        send_telegram_file(dnsx_file, "🧪 [TỆP] DNS sống (DNSX)")
        send_telegram_file(tech_file, "🧬 [TỆP] Tech stack (HTTPX)")
        send_telegram_file(ffuf_out, "📁 [TỆP] Kết quả dò thư mục (FFuf)")
    
    if args.cleanup:
        log("\n🧹 [*] Đang dọn dẹp các file tạm thời...", Colors.C)
        cleanup_temp_files(folder)

    log(f"{Colors.G}🏁 [HOÀN TẤT] Đóng hệ thống.{Colors.W}")

if __name__ == "__main__":
    main()

# Đây là phần mềm nhắn mục đích kiểm thử xâm nhập (pentesting).
# Chương trình không được sử dụng cho mục đích xấu hoặc trái phép.
# Đang trong quá trình phát triển.
# Xây dựng bởi Nguyễn Kiến Quốc

# HƯỚNG DẪN SỬ DỤNG AN TOÀN:
# 1. Thiết lập biến môi trường (KHÔNG bao giờ dùng --telegram-token trong command):
#    $ export TELEGRAM_TOKEN="your_token_here"
#    $ export TELEGRAM_CHAT_ID="your_chat_id_here"
#
# 2. Chạy tool:
#    $ python quoc_omni.py anhtukala.id.vn \
#      --ctf-mode \
#      --nuclei-auto-tags \
#      --nuclei-ctf-pack \
#      --nuclei-two-pass \
#      --nuclei-group-by-tech \
#      --retries 2 \
#      --retry-backoff 2.0
#
# 3. Hoặc tắt Telegram nếu không cần:
#    $ python quoc_omni.py anhtukala.id.vn --no-telegram --ctf-mode
#
# LƯỚI HỖ TRỢ:
#    - Lưu credentials trong file ~/.bashrc, ~/.zshrc, hoặc .env (và thêm .env vào .gitignore)
#    - Tuyệt đối không commit credentials vào Git
#    - Kiểm tra qua: $ grep -r "TELEGRAM_TOKEN" .git/ để phát hiện leaks lịch sử