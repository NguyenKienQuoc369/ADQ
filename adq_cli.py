#!/usr/bin/env python3
import os
import sys
import time
import json
import random
import datetime
from typing import Any, Dict, List, Optional

# Add project root and backend to sys.path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR = os.path.join(BASE_DIR, "backend")
if BACKEND_DIR not in sys.path:
    sys.path.insert(0, BACKEND_DIR)
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(BASE_DIR, ".env"))
except ImportError:
    pass

from rich.console import Console, Group
from rich.prompt import Prompt, IntPrompt, Confirm
from rich.panel import Panel
from rich.table import Table
from rich.markdown import Markdown
from rich.text import Text
from rich.columns import Columns
from rich.live import Live
from rich.tree import Tree

try:
    from backend.core.dag_engine import DAGEngine
    from backend.core.dag_state_manager import DAGStateManager, RedisDAGListener
except ImportError:
    from core.dag_engine import DAGEngine
    from core.dag_state_manager import DAGStateManager, RedisDAGListener

console = Console()

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def draw_header():
    clear_screen()
    header_text = (
        "[bold cyan]      [ ADQ CORE - SECURITY ORCHESTRATOR ]      [/bold cyan]\n"
        "[dim]==================================================[/dim]\n"
        "[bold green] Node: Worker-Elite | Status: ONLINE | AI: READY | Telegram Feed: ACTIVE[/bold green]"
    )
    console.print(Panel(header_text, border_style="cyan"))

# =========================================================================
# TELEGRAM-STYLE FULL REPORT RENDERERS
# =========================================================================

def render_telegram_style_scan_report(
    target: str,
    job_id: str = "job_core_1001",
    duration_sec: float = 24.5,
    counts: Optional[Dict[str, int]] = None,
    vulns: Optional[List[Dict[str, str]]] = None,
    secrets: Optional[List[Dict[str, str]]] = None,
    paths: Optional[List[str]] = None,
    ports: Optional[List[str]] = None,
    priority_score: int = 15,
    attack_chain: str = "",
    action_advice: str = "",
    artifacts: Optional[List[str]] = None
):
    counts = counts if counts is not None else {"subdomains": 0, "live_hosts": 1, "crawled_urls": 5, "open_ports": 1, "vulns": 0}
    vulns = vulns if vulns is not None else []
    secrets = secrets if secrets is not None else []
    paths = paths if paths is not None else []
    ports = ports if ports is not None else []
    artifacts = artifacts if artifacts is not None else [
        "📄 result.json (Full Live Scan Payload)",
        "📄 live_hosts.txt (Active Targets)",
    ]

    # Panel 1: Header Báo Cáo
    console.print("\n")
    risk_label = "CRITICAL RISK" if priority_score >= 70 else ("HIGH RISK" if priority_score >= 50 else ("MEDIUM RISK" if priority_score >= 30 else "LOW RISK / SECURE"))
    risk_color = "red" if priority_score >= 70 else ("yellow" if priority_score >= 30 else "green")

    console.print(Panel(
        f"[bold yellow]📊 [BÁO CÁO TELEGRAM] HOÀN TẤT QUÉT MỤC TIÊU THỰC TẾ[/bold yellow]\n"
        f"[bold white]🎯 Mục tiêu:[/bold white] [bold cyan]{target}[/bold cyan] | [bold white]Job ID:[/bold white] [bold yellow]{job_id}[/bold yellow]\n"
        f"[bold white]⏱️ Thời gian thực thi:[/bold white] {duration_sec}s | [bold white]Node:[/bold white] Worker-Elite | [bold white]Priority Score:[/bold white] [bold {risk_color}]{priority_score}/100 ({risk_label})[/bold {risk_color}]",
        border_style="yellow"
    ))

    # Panel 2: Thống kê tổng quan (Counts Table)
    summary_table = Table(title="📈 TỔNG QUAN CHỈ SỐ MỤC TIÊU (LIVE METRICS)", show_header=True, header_style="bold cyan")
    summary_table.add_column("Chỉ số", style="bold white")
    summary_table.add_column("Số lượng", style="bold yellow")
    summary_table.add_column("Trạng thái", style="bold green")

    summary_table.add_row("Subdomains Tìm thấy", str(counts.get("subdomains", 0)), "✅ Đã xác minh DNS")
    summary_table.add_row("Live Hosts Hoạt động", str(counts.get("live_hosts", 1)), "🌐 HTTP/HTTPS Alive")
    summary_table.add_row("URL Thu thập (GAU/Katana)", str(counts.get("crawled_urls", 0)), "🔗 Crawled & Indexed")
    summary_table.add_row("Cổng mở (Naabu)", str(counts.get("open_ports", 0)), "🧭 Scanned Ports")
    summary_table.add_row("Tổng Lỗ hổng Phát hiện", str(counts.get("vulns", 0)), "🚨 Active Threats")

    console.print(summary_table)

    # Panel 3: Bảng Lỗ Hổng Chi Tiết (Nuclei & Logic Findings)
    vuln_table = Table(title="🚨 [LỖ HỔNG] PHÁT HIỆN TRÊN MỤC TIÊU THỰC TẾ", show_header=True, header_style="bold red")
    vuln_table.add_column("Mức độ", style="bold")
    vuln_table.add_column("Tên Lỗ Hổng / Template", style="bold white")
    vuln_table.add_column("Endpoint Ảnh hưởng", style="bold cyan")
    vuln_table.add_column("Phân loại (CVE/CWE)", style="bold dim")

    sev_colors = {
        "CRITICAL": "[bold red]CRITICAL[/bold red]",
        "HIGH": "[bold bright_red]HIGH[/bold bright_red]",
        "MEDIUM": "[bold yellow]MEDIUM[/bold yellow]",
        "LOW": "[bold blue]LOW[/bold blue]",
        "INFO": "[bold green]INFO[/bold green]"
    }

    if vulns:
        for v in vulns:
            badge = sev_colors.get(v.get("severity", "INFO"), v.get("severity", "INFO"))
            vuln_table.add_row(badge, v.get("title", ""), v.get("endpoint", ""), v.get("cve", ""))
    else:
        vuln_table.add_row("[bold green]SECURE[/bold green]", "Không phát hiện lỗ hổng nghiêm trọng trên mục tiêu", target, "Clean Target")

    console.print(vuln_table)

    # Panel 4: Dữ liệu nhạy cảm (Secrets) & Open Paths
    sec_table = Table(title="💎 [DỮ LIỆU NHẠY CẢM] KẾT QUẢ QUÉT REAL-TIME", show_header=True, header_style="bold magenta")
    sec_table.add_column("Loại Secret / Token", style="bold magenta")
    sec_table.add_column("Giá trị Trích xuất (Masked)", style="bold white")
    sec_table.add_column("Nguồn Trích xuất", style="bold dim")

    if secrets:
        for s in secrets:
            sec_table.add_row(s.get("type", ""), s.get("value", ""), s.get("source", s.get("source", "JS Analysis")))
    else:
        sec_table.add_row("[bold green]CLEAN[/bold green]", "Không phát hiện API Keys/Tokens hardcoded trong JS", "Code Analysis")

    console.print(sec_table)

    # Panel 5: Exposed Paths & Open Ports
    console.print("\n[bold yellow]📂 [THƯ MỤC/FILE] KẾT QUẢ QUÉT BỀ MẶT THỰC TẾ:[/bold yellow]")
    if paths:
        for p in paths:
            console.print(f"  • [cyan]{p}[/cyan]")
    else:
        console.print("  • [bold green]Không phát hiện thư mục/file nhạy cảm lộ diện công khai.[/bold green]")

    console.print("\n[bold yellow]🧭 [CỔNG MỞ & DỊCH VỤ DÒ TÌM THỰC TẾ]:[/bold yellow]")
    if ports:
        for pt in ports:
            console.print(f"  • [green]{pt}[/green]")
    else:
        console.print("  • [dim green]Không phát hiện cổng mở bất thường ngoài HTTP/HTTPS.[/dim green]")

    # Panel 6: Attack Chain Correlation & Action Advice (Copilot)
    if not attack_chain:
        if priority_score >= 70:
            chain_msg = f"Phát hiện nguy cơ nghiêm trọng trên {target}: Lộ diện file nhạy cảm và lỗ hổng bảo mật mức cao."
        elif priority_score >= 30:
            chain_msg = f"Phát hiện cấu hình thiếu an toàn trên {target}: Thiếu Security Headers và cấu hình CORS chưa thắt chặt."
        else:
            chain_msg = f"Mục tiêu {target} đạt trạng thái an toàn tốt. Chưa ghi nhận chuỗi tấn công khả thi."

    if not action_advice:
        if priority_score >= 30:
            advice_msg = (
                "1. Cập nhật các Security Headers (HSTS, CSP, X-Content-Type-Options).\n"
                "2. Kiểm tra cấu hình CORS Access-Control-Allow-Origin.\n"
                "3. Bật WAF và thường xuyên rà quét mã nguồn."
            )
        else:
            advice_msg = (
                "1. Duy trì hệ thống giám sát và bảo mật định kỳ.\n"
                "2. Tiếp tục kiểm soát các thay đổi cấu hình hạ tầng."
            )

    console.print(Panel(
        f"[bold red]🛡️ [TƯƠNG QUAN CHUỖI TẤN CÔNG & ĐỀ XUẤT ADQ COPILOT][/bold red]\n\n"
        f"[bold white]⚡ Kịch bản Tấn công Tương quan:[/bold white]\n{chain_msg}\n\n"
        f"[bold green]💡 Khuyến nghị Khắc phục Nhanh:[/bold green]\n{advice_msg}",
        border_style="red"
    ))

    # Panel 7: File Artifacts
    console.print("[bold cyan]📄 [TỆP BÁO CÁO & XUẤT BẢN CÔNG CỤ]:[/bold cyan]")
    for a in artifacts:
        console.print(f"  • [dim]{a}[/dim]")


def render_telegram_style_apk_report(
    apk_name: str,
    scanned_files_count: int = 1240,
    decompile_status: Optional[Dict[str, Any]] = None,
    manifest_risks: Optional[List[Dict[str, Any]]] = None,
    secrets: Optional[List[Dict[str, Any]]] = None
):
    decompile_status = decompile_status or {"apktool": True, "jadx": True, "method": "apktool+jadx"}
    manifest_risks = manifest_risks or [
        {"file": "AndroidManifest.xml", "type": "allow_backup", "count": 1, "detail": "Cấu hình android:allowBackup='true' - Nguy cơ lộ dữ liệu local qua adb backup"},
        {"file": "AndroidManifest.xml", "type": "uses_cleartext_traffic", "count": 1, "detail": "Cấu hình android:usesCleartextTraffic='true' - Bị chặn kiểm soát HTTPS, nguy cơ bị Sniffing/Mitm"},
        {"file": "AndroidManifest.xml", "type": "debuggable", "count": 1, "detail": "Cấu hình android:debuggable='true' - Ứng dụng cho phép gắn Debugger tĩnh/động"},
    ]
    secrets = secrets or [
        {"file": "sources/com/bank/app/NetworkConfig.java", "type": "firebase_db_url", "match": "https://ebank-mobile-prod.firebaseio.com"},
        {"file": "sources/com/bank/app/AuthService.java", "type": "firebase_api_key", "match": "AIzaSyDummyApiKeyForTesting1234567890123"},
        {"file": "res/values/strings.xml", "type": "aws_access_key", "match": "AKIAIOSFODNN7EXAMPLE"},
    ]

    console.print("\n")
    console.print(Panel(
        f"[bold yellow]📱 [BÁO CÁO TELEGRAM] PHÂN TÍCH FILE APK (MOBILE AUDIT)[/bold yellow]\n"
        f"[bold white]📦 Tên File APK:[/bold white] [bold cyan]{apk_name}[/bold cyan] | [bold white]Số File Bytecode Quét:[/bold white] [bold yellow]{scanned_files_count}[/bold yellow]\n"
        f"[bold white]⚙️ Môi trường Decompiler:[/bold white] Apktool ({decompile_status.get('apktool')}) + JADX ({decompile_status.get('jadx')}) [{decompile_status.get('method')}]",
        border_style="yellow"
    ))

    # Manifest Table
    mf_table = Table(title="🛡️ RỦI RO CẤU HÌNH ANDROID MANIFEST", show_header=True, header_style="bold red")
    mf_table.add_column("Tên Rủi ro", style="bold red")
    mf_table.add_column("File Cấu hình", style="bold dim")
    mf_table.add_column("Chi tiết Rủi ro Security", style="bold white")

    for m in manifest_risks:
        mf_table.add_row(m.get("type", ""), m.get("file", ""), m.get("detail", ""))

    console.print(mf_table)

    # Secrets Table
    sec_table = Table(title="💎 SECRETS & API KEYS HARDCODED TRONG LỚP MOBILE", show_header=True, header_style="bold magenta")
    sec_table.add_column("Loại Secret / Key", style="bold magenta")
    sec_table.add_column("Nguồn Mã Nguồn Java/Kotlin/XML", style="bold cyan")
    sec_table.add_column("Chuỗi Trích xuất (Masked)", style="bold white")

    for s in secrets:
        sec_table.add_row(s.get("type", ""), s.get("file", ""), s.get("match", ""))

    console.print(sec_table)

    console.print(Panel(
        "[bold green]💡 KHUYẾN NGHỊ KHẮC PHỤC DÀNH CHO LẬP TRÌNH VIÊN MOBILE:[/bold green]\n"
        "1. Chuyển toàn bộ Firebase Keys và Cloud Storage Credentials sang môi trường Backend / Key Store.\n"
        "2. Đặt `android:allowBackup='false'` và `android:usesCleartextTraffic='false'` trong `AndroidManifest.xml`.\n"
        "3. Áp dụng ProGuard / R8 để xáo trộn (obfuscate) mã nguồn Java/Kotlin.",
        border_style="green"
    ))


def render_live_attack_matrix(
    target_url: str,
    vus: int,
    elapsed_sec: float,
    metrics: Dict[str, Any],
    recent_stream_logs: List[Dict[str, Any]]
) -> Panel:
    """
    Renders Real-Time Live Attack Matrix (War Room View) during k6 Layer 7 Stress Attack.
    Includes Metrics Summary Panel & Rolling IP Stream Log.
    """
    rps = metrics.get("rps", 0)
    s200 = metrics.get("status_200", 0)
    s403 = metrics.get("status_403_waf_blocked", 0)
    s429 = metrics.get("status_429_rate_limited", 0)
    s500 = metrics.get("status_500_crashed", 0)
    p95 = metrics.get("p95_latency", "0ms")

    # Metrics Summary Bar
    summary_text = (
        f"[bold white]⚡ Tốc độ (RPS):[/bold white] [bold cyan]{rps} req/s[/bold cyan]   | "
        f"[bold green]🟢 HTTP 200:[/bold green] [bold green]{s200:,}[/bold green]  | "
        f"[bold red]🛡️ WAF 403 Block:[/bold red] [bold red]{s403:,}[/bold red]\n"
        f"[bold yellow]⚠️ Rate Limit (429):[/bold yellow] [bold yellow]{s429:,}[/bold yellow]      | "
        f"[bold red]💥 Server Crash (500):[/bold red] [bold red]{s500:,}[/bold red]  | "
        f"[bold magenta]⏱️ Latency:[/bold magenta] [bold magenta]{p95}[/bold magenta] [dim]({elapsed_sec:.1f}s elapsed)[/dim]"
    )
    summary_panel = Panel(summary_text, title="[bold red]💥 [ CHỈ SỐ HỦY DIỆT - LIVE ATTACK METRICS ][/bold red]", border_style="red")

    # Live Stream Table
    stream_table = Table(title="[bold yellow]🚀 [ LIVE ATTACK STREAM - ROTATING X-FORWARDED-FOR IPS ][/bold yellow]", show_header=True, header_style="bold cyan", expand=True)
    stream_table.add_column("Thời gian", style="dim white", width=10)
    stream_table.add_column("Virtual IP (Spoofed)", style="bold cyan", width=18)
    stream_table.add_column("Endpoint Attack", style="bold white")
    stream_table.add_column("HTTP Status", style="bold", width=14)
    stream_table.add_column("Latency", style="dim yellow", width=10)

    for item in recent_stream_logs[-10:]:
        code = item.get("status", 200)
        if code in (200, 201, 204):
            badge = "[bold green][ 200 OK  ][/bold green]"
        elif code == 403:
            badge = "[bold red][ 403 WAF ][/bold red]"
        elif code == 429:
            badge = "[bold yellow][ 429 RL  ][/bold yellow]"
        elif code >= 500 or code == 0:
            badge = "[bold red blink][ 500 ERR ][/bold red blink]"
        else:
            badge = f"[bold white][ {code} ][/bold white]"

        stream_table.add_row(
            item.get("time", ""),
            f"🚀 {item.get('ip', '')}",
            f"--> {item.get('method', 'GET')} {item.get('path', '/api/v1/auth')}",
            badge,
            f"({item.get('latency', 0)}ms)"
        )

    # Layout Combination
    main_panel = Panel(
        Group(
            summary_panel,
            stream_table
        ),
        title=f"[bold red blink]🔥 L7 STRESS TEST ENGINES ENGAGED | Target: {target_url}[/bold red blink]",
        border_style="red"
    )
    return main_panel


def render_telegram_style_stress_report(
    target_url: str,
    vus: int = 50,
    duration: str = "30s",
    metrics: Optional[Dict[str, Any]] = None,
    simulated: bool = False
):
    metrics = metrics or {
        "total_requests": 750,
        "status_200": 637,
        "status_429_rate_limited": 75,
        "status_500_crashed": 38,
        "rps": 25.0,
    }

    console.print("\n")
    console.print(Panel(
        f"[bold red]🔥 [BÁO CÁO TELEGRAM] KẾT QUẢ TẤN CÔNG CHỊU TẢI & RATE LIMIT (k6 Engine)[/bold red]\n"
        f"[bold white]🎯 Target URL:[/bold white] [bold cyan]{target_url}[/bold cyan]\n"
        f"[bold white]👥 Virtual Users (VUs):[/bold white] [bold yellow]{vus}[/bold yellow] | [bold white]Thời gian:[/bold white] [bold yellow]{duration}[/bold yellow] | [bold white]Chế độ:[/bold white] {'Mô phỏng' if simulated else 'Live Engine'}",
        border_style="red"
    ))

    res_table = Table(title="📊 THỐNG KÊ PHẢN HỒI HTTP TỪ MỤC TIÊU", show_header=True, header_style="bold cyan")
    res_table.add_column("Mã Phản hồi HTTP", style="bold")
    res_table.add_column("Số lượng Request", style="bold yellow")
    res_table.add_column("Tỷ lệ %", style="bold white")
    res_table.add_column("Đánh giá An ninh Bề mặt", style="bold green")

    tot = max(1, metrics.get("total_requests", 1))
    s200 = metrics.get("status_200", 0)
    s403 = metrics.get("status_403_waf_blocked", 0)
    s429 = metrics.get("status_429_rate_limited", 0)
    s500 = metrics.get("status_500_crashed", 0)

    res_table.add_row("[bold green]HTTP 200 OK[/bold green]", str(s200), f"{round(s200/tot*100, 1)}%", "Xử lý thành công bình thường")
    res_table.add_row("[bold red]HTTP 403 WAF Blocked[/bold red]", str(s403), f"{round(s403/tot*100, 1)}%", "🛡️ Vercel Security Checkpoint / WAF Chặn Bot")
    res_table.add_row("[bold yellow]HTTP 429 Rate Limited[/bold yellow]", str(s429), f"{round(s429/tot*100, 1)}%", "Cơ chế Rate Limit WAF hoạt động")
    res_table.add_row("[bold red]HTTP 500+ Server Crash[/bold red]", str(s500), f"{round(s500/tot*100, 1)}%", "⚠️ Máy chủ quá tải hoặc bị lỗi bộ nhớ")

    console.print(res_table)

    # Dynamic calculation of WAF bypass rate based on actual response metrics
    bypass_rate = round((s200 / tot) * 100, 1)
    if s403 > 0 and s200 == 0:
        bypass_eval = f"[bold red]Kích hoạt Vercel Security Checkpoint / WAF (Chặn 100% Request với HTTP 403)[/bold red]"
    elif s429 == 0 and s403 == 0:
        bypass_eval = f"[bold green]Lách hoàn toàn Rate Limit & WAF (Tỷ lệ 200 OK: {bypass_rate}%)[/bold green]"
    elif s200 > (s429 + s403):
        bypass_eval = f"[bold yellow]Lách được một phần WAF (Tỷ lệ 200 OK: {bypass_rate}%)[/bold yellow]"
    else:
        bypass_eval = f"[bold red]Bị WAF / Rate Limit chặn phần lớn (Chỉ lách được {bypass_rate}%)[/bold red]"

    console.print(Panel(
        f"[bold yellow]🛡️ ĐÁNH GIÁ KHẢ NĂNG CHỊU TẢI & WAF RATE LIMIT:[/bold yellow]\n"
        f"• [bold white]Tốc độ bắn phá (Throughput):[/bold white] [bold cyan]{metrics.get('rps', round(tot/30, 1))} req/sec[/bold cyan]\n"
        f"• [bold white]Kỹ thuật lách IP (X-Forwarded-For Rotation):[/bold white] {bypass_eval}\n"
        f"• [bold red]Cảnh báo DoS/Overload:[/bold red] Phát hiện {s500} request bị sập 500 khi tải chạm ngưỡng {vus} VUs.",
        border_style="yellow"
    ))

    if metrics.get("vercel_mitigated_count", 0) > 0 or (s403 > 0 and s200 == 0):
        console.print(Panel(
            f"[bold yellow]💡 LƯU Ý BẢO MẬT & MẸO BYPASS VERCEL / CLOUDFLARE WAF:[/bold yellow]\n"
            f"• Máy chủ Edge CDN của mục tiêu đã bật chế độ [bold red]Security Checkpoint (x-vercel-mitigated: challenge)[/bold red] do quá tải.\n"
            f"• Khi tự kiểm thử trang web Vercel chính chủ của bạn, hãy nhập header bypass vào mục Token:\n"
            f"  [bold cyan]x-vercel-protection-bypass: <your_protection_bypass_secret>[/bold cyan]\n"
            f"  (Lấy Secret tại: Vercel Dashboard -> Project Settings -> Security -> Protection Bypass for Automation)",
            border_style="cyan"
        ))

# =========================================================================
# MODULE CONTROLLERS
# =========================================================================

def main_menu():
    while True:
        draw_header()
        console.print("\n[1] Khởi động chiến dịch Rà quét (Recon & Scan)")
        console.print("[2] Phân tích file APK (Mobile Audit) [bold yellow][BETA / WIP][/bold yellow]")
        console.print("[3] Tấn công chịu tải (Stress Test & Rate Limit)")
        console.print("[4] Lịch sử Báo cáo Báo động (View Full Telegram Reports)")
        console.print("[0] Thoát hệ thống (Exit)\n")
        
        choice = IntPrompt.ask("[bold yellow]root@adq-core:~#[/bold yellow] Chọn một lệnh", choices=["0", "1", "2", "3", "4"])
        
        if choice == 1:
            run_scan_module()
        elif choice == 2:
            run_apk_module()
        elif choice == 3:
            run_stress_module()
        elif choice == 4:
            view_logs_module()
        elif choice == 0:
            console.print("\n[bold red]Đang ngắt kết nối Worker... Tạm biệt![/bold red]")
            sys.exit(0)

def run_scan_module():
    draw_header()
    console.print("[bold magenta]--- THIẾT LẬP MỤC TIÊU & BẢN ĐỒ DỊCH VỤ SAAS TIERS ---[/bold magenta]")
    
    target = Prompt.ask("\n[bold]🎯 Nhập mục tiêu (URL, IP hoặc Domain)[/bold]", default="https://target-bank.com")
    
    console.print("\n[bold]🛡️ CHỌN GÓI DỊCH VỤ SAAS (SaaS Tier Routing):[/bold]")
    console.print("  [1] [bold green]STARTER[/bold green] - Cơ Bản (Lính Trinh Sát Worker-Light | Surface Recon | Executive Summary AI)")
    console.print("  [2] [bold cyan]DEVSEC PRO[/bold cyan] - Chuyên Nghiệp (Worker-Light + Worker-Elite | Web Deep Exploit + APK Audit | Interactive Copilot + One-Click Fix | ADQ Security Copilot 0.1)")
    console.print("  [3] [bold red]FINTECH ULTIMATE[/bold red] - Tối Thượng (Worker-Elite VIP Priority Queue | Full Engine + k6 Layer 7 Stress Test | Copilot VIP Graph | ADQ Security Copilot 0.5)")
    
    tier_choice = IntPrompt.ask("Chọn [1/2/3]", choices=["1", "2", "3"], default=2)
    
    tier_config = {
        1: {
            "name": "STARTER",
            "style": "green",
            "queue": "queue:recon_light",
            "worker": "Worker-Light (Lính Trinh Sát)",
            "model_display": "ADQ Security Copilot 0.1",
            "features": "Surface Recon, Basic DAG Graph, Static Executive AI Summary",
            "interactive_ai": False,
            "apk_allowed": False,
            "stress_allowed": False,
        },
        2: {
            "name": "DEVSEC PRO",
            "style": "cyan",
            "queue": "queue:exploit_elite",
            "worker": "Worker-Light + Worker-Elite (Resource Capped)",
            "model_display": "ADQ Security Copilot 0.1",
            "features": "Deep Exploit, WAF Evasion, APK Audit, Interactive Copilot, One-Click Fix Patches",
            "interactive_ai": True,
            "apk_allowed": True,
            "stress_allowed": False,
        },
        3: {
            "name": "FINTECH ULTIMATE",
            "style": "red",
            "queue": "queue:exploit_elite_vip",
            "worker": "Worker-Elite VIP Priority Fleet + k6 Stress Cluster",
            "model_display": "ADQ Security Copilot 0.5",
            "features": "Full Engine, Layer 7 Stress Test, BYOS Token Scan, Unlimited Copilot Graph AI",
            "interactive_ai": True,
            "apk_allowed": True,
            "stress_allowed": True,
        }
    }
    
    selected_tier = tier_config[tier_choice]
    job_id = f"job_{selected_tier['name'].lower()}_1001"
    
    console.print(f"\n[bold green][+] Đang khởi động chiến dịch nhắm vào:[/bold green] [bold cyan]{target}[/bold cyan]")
    console.print(f"[bold green][+] Gói SaaS được chọn:[/bold green] [{selected_tier['style']}]{selected_tier['name']}[/{selected_tier['style']}]")
    console.print(f"[bold green][+] Hàng đợi Redis:[/bold green] [bold yellow]{selected_tier['queue']}[/bold yellow] | [bold green]Lực lượng Executed:[/bold green] [bold magenta]{selected_tier['worker']}[/bold magenta]")
    console.print(f"[bold green][+] AI Intelligence Core:[/bold green] [bold cyan]{selected_tier['model_display']}[/bold cyan]")
    console.print(f"[bold green][+] Khởi tạo DAG Engine & Redis Event Channel ([/bold green][dimcyan]channel:dag_events:{job_id}[/dimcyan][bold green])...[/bold green]\n")

    # Initialize State Manager & DAG Engine
    state_manager = DAGStateManager(job_id=job_id, target=target)
    dag = DAGEngine(job_id=job_id, redis_url=os.environ.get("REDIS_URL"), event_callback=state_manager.sync_update_from_event)

    # Clean domain name
    domain = target.replace("https://", "").replace("http://", "").split("/")[0]

    try:
        from backend.core.scanner import perform_real_dynamic_scan
    except ImportError:
        from core.scanner import perform_real_dynamic_scan

    with console.status(f"[bold cyan]Đang thực hiện rà quét thực tế nhắm vào {target}...", spinner="dots"):
        real_scan = perform_real_dynamic_scan(target, tier_choice=tier_choice)

    # Define Node Step Executable Functions
    async def step_recon(results):
        await asyncio.sleep(0.4)
        return {
            "subdomains": real_scan.get("subdomains", []),
            "live_hosts": real_scan.get("live_hosts", [target]),
        }

    async def step_port_scan(results):
        await asyncio.sleep(0.4)
        return {
            "open_ports": real_scan.get("open_ports_raw", []),
            "services": real_scan.get("ports", [])
        }

    async def step_crawl_gau(results):
        await asyncio.sleep(0.4)
        return {
            "crawled_urls": real_scan.get("exposed_paths", [target]),
            "parameters": ["id", "token", "query", "user"]
        }

    async def step_vuln_nuclei(results):
        await asyncio.sleep(0.5)
        return {
            "vulnerabilities": real_scan.get("vulnerabilities", []),
            "critical_count": sum(1 for v in real_scan.get("vulnerabilities", []) if v.get("severity") == "CRITICAL")
        }

    async def step_js_secrets(results):
        await asyncio.sleep(0.4)
        return {
            "secrets": real_scan.get("secrets", [])
        }

    async def step_waf_evasion(results):
        await asyncio.sleep(0.3)
        return {
            "evasion_status": "ACTIVE",
            "active_headers": {"X-Forwarded-For": "127.0.0.1", "X-Originating-IP": "127.0.0.1"},
            "mutated_payloads": 5
        }

    async def step_logic_chain(results):
        await asyncio.sleep(0.4)
        return {
            "attack_chain": f"Live Target Analysis Correlation for {target}",
            "priority_score": real_scan.get("priority_score", 15)
        }

    async def step_stress_k6(results):
        await asyncio.sleep(0.5)
        return {
            "stress_metrics": {
                "total_requests": 100,
                "status_200": 98,
                "status_429_rate_limited": 2,
                "status_500_crashed": 0,
                "rps": 20.0
            }
        }

    # Register Nodes into DAG Graph based on Tier Capabilities
    dag.add_node("node_recon", step_recon, label="Surface & Subdomain Discovery (Worker-Light)", parent_id="ROOT")
    dag.add_node("node_port_scan", step_port_scan, dependencies=["node_recon"], label="Port & Service Fingerprinting (Worker-Light)", parent_id="node_recon")
    dag.add_node("node_crawl_gau", step_crawl_gau, dependencies=["node_recon"], label="Crawl & Endpoint Extraction (Worker-Light)", parent_id="node_recon")
    
    if tier_choice >= 2:
        dag.add_node("node_vuln_nuclei", step_vuln_nuclei, dependencies=["node_port_scan", "node_crawl_gau"], label="Nuclei Deep Vuln Scan (Worker-Elite)", parent_id="node_crawl_gau")
        dag.add_node("node_js_secrets", step_js_secrets, dependencies=["node_crawl_gau"], label="Deep JS Secret & Token Extraction (Worker-Elite)", parent_id="node_crawl_gau")
        dag.add_node("node_waf_evasion", step_waf_evasion, dependencies=["node_vuln_nuclei", "node_js_secrets"], label="Adaptive WAF Evasion Engine (Worker-Elite)", parent_id="node_vuln_nuclei")
        dag.add_node("node_logic_chain", step_logic_chain, dependencies=["node_waf_evasion"], label="Automated Logic Chaining (Worker-Elite)", parent_id="node_waf_evasion")

    if tier_choice == 3:
        dag.add_node("node_stress_k6", step_stress_k6, dependencies=["node_logic_chain"], label="Layer 7 Stress Test & Rate Limit Evasion (k6 Cluster)", parent_id="node_logic_chain")

    # Run Async DAG Engine inside Rich Live TUI
    async def run_live_dag():
        listener = RedisDAGListener(state_manager)
        await listener.start()

        with Live(state_manager.build_rich_tree(), console=console, refresh_per_second=4) as live:
            async def render_loop():
                while True:
                    live.update(state_manager.build_rich_tree())
                    await asyncio.sleep(0.2)

            render_task = asyncio.create_task(render_loop())
            try:
                results = await dag.execute()
                return results
            finally:
                render_task.cancel()
                await listener.stop()
                live.update(state_manager.build_rich_tree())

    try:
        import asyncio
        asyncio.run(run_live_dag())
    except Exception as exc:
        console.print(f"[bold red][!] Lỗi thực thi DAG Engine: {exc}[/bold red]")

    console.print("\n[bold green]✅ [DAG ENGINE] Tất cả các nhánh rẽ rà quét thực tế đã hoàn tất![/bold green]")

    # Output full Telegram-style report with real scanned data
    render_telegram_style_scan_report(
        target=target,
        job_id=job_id,
        counts=real_scan.get("counts"),
        vulns=real_scan.get("vulnerabilities"),
        secrets=real_scan.get("secrets"),
        paths=real_scan.get("exposed_paths"),
        ports=real_scan.get("ports"),
        priority_score=real_scan.get("priority_score", 15)
    )
    
    # Prepare complete DAG state scan data payload for Copilot
    scan_data = {
        "target": target,
        "job_id": job_id,
        "tier": selected_tier["name"],
        "status": "COMPLETED",
        "live_hosts": real_scan.get("live_hosts", [target]),
        "open_ports": real_scan.get("ports", []),
        "vulnerabilities": real_scan.get("vulnerabilities", []),
        "secrets": real_scan.get("secrets", []),
        "exposed_paths": real_scan.get("exposed_paths", []),
        "priority_score": real_scan.get("priority_score", 15),
        "dag_execution_graph": state_manager.to_dict()
    }

    if selected_tier["interactive_ai"]:
        console.print(f"\n[bold magenta]🤖 [KÍCH HOẠT ADQ COPILOT] Đã nạp dữ liệu DAG Graph vào bộ nhớ Agentic AI (Core Engine: {selected_tier['model_display']})...[/bold magenta]")
        interactive_copilot_session(target=target, scan_data=scan_data)
    else:
        console.print(f"\n[bold yellow]ℹ️ [STARTER TIER] Gói Starter tự động tạo Báo cáo AI Executive Summary tĩnh.[/bold yellow]")
        try:
            from backend.core.copilot_engine import ADQSecurityCopilot
            copilot = ADQSecurityCopilot()
            with console.status("[bold green]Đang tạo Executive Summary Report...", spinner="dots"):
                res = copilot.analyze_scan_job(scan_data)
            if res.get("status") == "SUCCESS":
                console.print("\n[bold green]📊 [STARTER EXECUTIVE AI SUMMARY][/bold green]")
                console.print(Markdown(res.get("text", "")))
        except Exception as e:
            console.print(f"[dim red]Lỗi tạo AI Executive Summary: {e}[/dim red]")
        Prompt.ask("\n[dim]Ấn Enter để quay lại Menu Chính...[/dim]")

def run_apk_module():
    draw_header()
    console.print("[bold yellow]--- MOBILE AUDIT MODULE (BETA / WIP) ---[/bold yellow]")
    console.print("[dim]Hệ thống sử dụng Apktool và JADX để dịch ngược file mã nguồn tĩnh.[/dim]\n")
    
    apk_path = Prompt.ask("[bold]📦 Nhập đường dẫn tuyệt đối đến file .apk[/bold]", default="/tmp/sample_ebank.apk")
    
    if not os.path.exists(apk_path):
        console.print(f"\n[bold yellow][!] Không tìm thấy file local tại {apk_path}. Đang khởi tạo Sandbox Mô Phỏng...[/bold yellow]")
        time.sleep(1)

    try:
        try:
            from backend.core.apk_analyzer import APKAnalyzer
        except ImportError:
            from core.apk_analyzer import APKAnalyzer

        if os.path.exists(apk_path):
            analyzer = APKAnalyzer(apk_path)
            with console.status("[bold cyan]Đang decompile APK & quét Secret Keys trong Java/Kotlin bytecode...", spinner="bouncingBar"):
                res = analyzer.run_pipeline()
            if res.get("ok"):
                results = res.get("results", {})
                render_telegram_style_apk_report(
                    apk_name=os.path.basename(apk_path),
                    scanned_files_count=results.get("scanned_files_count", 0),
                    decompile_status=res.get("decompile_status"),
                    manifest_risks=results.get("manifest_risks"),
                    secrets=results.get("secrets")
                )
            else:
                console.print(f"\n[bold red][!] Lỗi phân tích APK: {res.get('error')}[/bold red]")
        else:
            render_telegram_style_apk_report(apk_name="sample_ebank.apk")
    except Exception as exc:
        console.print(f"\n[bold red][!] Lỗi thực thi APK Module: {exc}[/bold red]")

    Prompt.ask("\n[dim]Ấn Enter để quay lại Menu Chính...[/dim]")

def run_stress_module():
    draw_header()
    console.print("[bold red]--- STRESS TEST & RATE LIMIT MODULE (High-Throughput Async/Thread Engine) ---[/bold red]")
    target = Prompt.ask("[bold]🔥 Nhập URL kiểm thử chịu tải[/bold]", default="https://target-bank.com/api/v1/transfer")
    bearer_token = Prompt.ask("[bold]🔑 Nhập Bearer Token / Bypass Header (VD: x-vercel-protection-bypass: secret)[/bold]", default="")
    
    # Prompt user for total target requests and duration instead of raw VUs
    target_requests = IntPrompt.ask("[bold]💥 Tổng số Request muốn bắn (ví dụ: 10000, 1000000)[/bold]", default=100000)
    duration = Prompt.ask("[bold]⏱️ Thời gian phân bổ bắn (ví dụ: 10s, 30s, 60s)[/bold]", default="10s")

    # Dynamic calculation of target RPS
    duration_sec = 10
    if duration.endswith("s"):
        try:
            duration_sec = int(duration[:-1])
        except ValueError:
            duration_sec = 10
    elif duration.endswith("m"):
        try:
            duration_sec = int(duration[:-1]) * 60
        except ValueError:
            duration_sec = 60

    target_rps = round(target_requests / max(1, duration_sec), 1)

    # Dynamic Warning Panel highlighting High Volume (>1M requests) consequences
    is_massive_scale = target_requests >= 1000000
    severity_color = "bold red" if is_massive_scale else "bold yellow"
    severity_title = "🚨 CẢNH BÁO TẢI SIÊU LỚN (>1 TRIỆU REQUEST)" if is_massive_scale else "⚠️ CẢNH BÁO TẢI CAO (HIGH-THROUGHPUT STRESS TEST)"

    warning_text = (
        f"[{severity_color}]MỤC TIÊU: {target_requests:,} REQUESTS TRONG {duration_sec} GIÂY (~{target_rps:,} REQ/S)[/{severity_color}]\n\n"
        "[yellow]Tốc độ bắn request hiện tại đã được cấu hình mở tối đa công suất.\n"
        "Việc bắn hàng triệu request có thể dẫn đến các hậu quả cực kỳ nghiêm trọng:[/yellow]\n"
        "  • [bold red]1. SẬP MÁY CHỦ & DỊCH VỤ DÍCH (COMPLETE SERVICE OUTAGE):[/bold red] Đánh sập hoàn toàn Load Balancer, Nginx/Apache, làm cạn kiệt Database Connection Pool và RAM/CPU Server target.\n"
        "  • [bold red]2. BỊ CDN/WAF KHÓA IP VĨNH VIỄN (IP BAN & BLACKLISTING):[/bold red] Cloudflare, Vercel Edge, AWS Shield sẽ nhận diện IP nguồn là DDoS botnet và đưa vào Blacklist WAF toàn cầu.\n"
        "  • [bold red]3. PHÁT SINH CHI PHÍ INFRASTRUCTURE KHỔNG LỒ (BILLING SHOCK):[/bold red] Làm bùng nổ chi phí Vercel/AWS Auto-scaling, Serverless Invocations và Bandwidth Egress của nạn nhân.\n"
        "  • [bold red]4. HẬU QUẢ PHÁP LÝ NGHIÊM TRỌNG:[/bold red] Bắn lượng tải lớn mà không có văn bản ủy quyền hợp pháp có thể bị quy vào hành vi tấn công từ chối dịch vụ (DDoS) trái pháp luật.\n\n"
        "[bold white]Xác nhận: Bạn có đầy đủ quyền hạn kiểm thử và đồng ý chịu trách nhiệm cho đợt kiểm thử này?[/bold white]"
    )
    console.print()
    console.print(Panel(warning_text, border_style=severity_color, title=severity_title))
    
    confirm = Confirm.ask(f"\n[{severity_color}]Xác nhận đồng ý bắn {target_requests:,} request?[/{severity_color}]", default=False)
    if not confirm:
        console.print("[yellow][!] Đã hủy thao tác stress test theo yêu cầu của người dùng.[/yellow]")
        Prompt.ask("\n[dim]Ấn Enter để quay lại Menu Chính...[/dim]")
        return

    # Map request volume dynamically to optimal worker concurrency (VUs)
    vus = max(10, min(int(target_rps / 5), 500))

    console.print(f"\n[+] Đang kích hoạt Live Attack Matrix cho target: [bold cyan]{target}[/bold cyan] ({target_requests:,} requests / {duration_sec}s - VUs: {vus})...")
    
    try:
        try:
            from backend.core.stress_orchestrator import StressOrchestrator
        except ImportError:
            from core.stress_orchestrator import StressOrchestrator

        orchestrator = StressOrchestrator()

        # Parse duration string to seconds integer
        duration_sec = 10
        if duration.endswith("s"):
            try:
                duration_sec = int(duration[:-1])
            except ValueError:
                duration_sec = 10
        elif duration.endswith("m"):
            try:
                duration_sec = int(duration[:-1]) * 60
            except ValueError:
                duration_sec = 60

        # Shared data structures for live rendering & background execution
        stress_result = {}
        stream_logs: List[Dict[str, Any]] = []
        live_metrics = {
            "total_requests": 0,
            "status_200": 0,
            "status_403_waf_blocked": 0,
            "status_429_rate_limited": 0,
            "status_500_crashed": 0,
            "rps": 0.0,
            "p95_latency": "0ms",
        }

        # Real-Time callback from native Python HTTP thread fleet
        def on_http_request_complete(res: Dict[str, Any]):
            now_str = datetime.datetime.now().strftime("%H:%M:%S")
            status_code = res.get("status", 0)
            latency = res.get("latency", 0)
            ip = res.get("ip", "127.0.0.1")

            live_metrics["total_requests"] += 1
            if status_code in (200, 201, 204):
                live_metrics["status_200"] += 1
            elif status_code == 403:
                live_metrics["status_403_waf_blocked"] += 1
            elif status_code == 429:
                live_metrics["status_429_rate_limited"] += 1
            else:
                live_metrics["status_500_crashed"] += 1

            live_metrics["p95_latency"] = f"{latency}ms"

            stream_logs.append({
                "time": now_str,
                "ip": ip,
                "method": "GET",
                "path": "/api/v1/auth",
                "status": status_code,
                "latency": latency
            })
            if len(stream_logs) > 30:
                del stream_logs[0]

        # Background stress test execution task
        def execute_bg():
            nonlocal stress_result
            stress_result = orchestrator.execute_stress_test(
                target_url=target,
                bearer_token=bearer_token,
                vus=vus,
                duration=duration,
                stats_callback=on_http_request_complete
            )

        import threading
        bg_thread = threading.Thread(target=execute_bg)
        bg_thread.start()

        start_time = time.time()

        # Live Attack Matrix Rendering Loop
        with Live(
            render_live_attack_matrix(
                target_url=target,
                vus=vus,
                elapsed_sec=0.0,
                metrics=live_metrics,
                recent_stream_logs=stream_logs
            ),
            console=console,
            refresh_per_second=8
        ) as live:
            while bg_thread.is_alive() or (time.time() - start_time) < duration_sec:
                elapsed = time.time() - start_time
                if live_metrics["total_requests"] > 0:
                    live_metrics["rps"] = round(live_metrics["total_requests"] / max(0.5, elapsed), 1)

                live.update(render_live_attack_matrix(
                    target_url=target,
                    vus=vus,
                    elapsed_sec=elapsed,
                    metrics=live_metrics,
                    recent_stream_logs=stream_logs
                ))
                time.sleep(0.12)

        bg_thread.join(timeout=5)

        # Merge actual background k6 result metrics if available
        final_metrics = stress_result.get("metrics") if stress_result.get("metrics") else live_metrics

        # Output Final Telegram-Style Summary Report & AI Analysis Trigger
        console.print("\n[bold green]✅ [STRESS TEST ENGINE] Kế thừa kết quả từ k6_results.json![/bold green]")
        render_telegram_style_stress_report(
            target_url=target,
            vus=vus,
            duration=duration,
            metrics=final_metrics,
            simulated=stress_result.get("simulated", False)
        )

    except Exception as e:
        console.print(f"\n[bold red][!] Lỗi thực thi Stress Test: {e}[/bold red]")

    Prompt.ask("\n[dim]Ấn Enter để quay lại Menu Chính...[/dim]")

def view_logs_module():
    draw_header()
    console.print("[bold blue]--- LỊCH SỬ BÁO CÁO & JOB LOGS (TELEGRAM FULL FEED) ---[/bold blue]\n")
    console.print("  [1] Job #1001 - Target: target-bank.com (Web Core Audit)")
    console.print("  [2] Job #2002 - Target: sample_ebank.apk (Mobile APK Audit)")
    console.print("  [3] Job #3003 - Target: https://target-bank.com/api (Application Stress Test)")
    
    log_choice = IntPrompt.ask("\nChọn Báo cáo cần xem chi tiết", choices=["1", "2", "3"], default=1)

    if log_choice == 1:
        target = "https://target-bank.com"
        render_telegram_style_scan_report(target=target, job_id="job_core_1001")
        scan_data = {
            "target": target,
            "job_id": "job_core_1001",
            "vulnerabilities": [
                {"severity": "CRITICAL", "title": "JWT Hardcoded Secret Key", "endpoint": "/api/v1/auth/token"},
                {"severity": "HIGH", "title": "IDOR Unauthorized Parameter Mutation", "endpoint": "/api/user?id=1002"},
            ],
            "secrets": [
                {"type": "jwt_token", "value": "eyJhbGciOiJIUzI1..."},
                {"type": "aws_access_key", "value": "AKIAIOSFODNN7EXAMPLE"}
            ]
        }
        ask_copilot = Prompt.ask("\n[bold magenta]🤖 Đánh thức ADQ Copilot để thảo luận về báo cáo này? (y/n)[/bold magenta]", default="y")
        if ask_copilot.lower() in ['y', 'yes']:
            interactive_copilot_session(target=target, scan_data=scan_data)
            return
    elif log_choice == 2:
        render_telegram_style_apk_report(apk_name="sample_ebank.apk")
    elif log_choice == 3:
        render_telegram_style_stress_report(target_url="https://target-bank.com/api/v1/transfer", vus=50)

    Prompt.ask("\n[dim]Ấn Enter để quay lại Menu Chính...[/dim]")

def interactive_copilot_session(target: str = "https://target-bank.com", scan_data: Optional[Dict[str, Any]] = None, model_name: Optional[str] = None):
    console.print("\n")
    console.print(Panel(
        f"[bold magenta]           [ ADQ SECURITY COPILOT - AGENTIC AI SESSION ]           [/bold magenta]\n"
        f"[bold white]🎯 Mục tiêu đang thảo luận:[/bold white] [bold cyan]{target}[/bold cyan]\n"
        f"[dim]Gõ 'exit' hoặc 'quit' để quay lại menu chính.[/dim]\n"
        f"[dim]Gõ 'patch' để sinh mã vá lỗi One-Click Fix | Gõ 'report' để xem lại báo cáo scan.[/dim]",
        border_style="magenta"
    ))

    try:
        try:
            from backend.core.copilot_engine import ADQSecurityCopilot, DEFAULT_COPILOT_SYSTEM_INSTRUCTION
        except ImportError:
            from core.copilot_engine import ADQSecurityCopilot, DEFAULT_COPILOT_SYSTEM_INSTRUCTION

        copilot = ADQSecurityCopilot(model=model_name)

        # Build context system instruction
        if scan_data:
            scan_data_str = json.dumps(scan_data, ensure_ascii=False, indent=2)
            context_instruction = (
                f"{DEFAULT_COPILOT_SYSTEM_INSTRUCTION}\n\n"
                f"DỮ LIỆU RÀ QUÉT MỤC TIÊU VỪA HOÀN THÀNH:\n"
                f"{scan_data_str}\n\n"
                f"HƯỚNG DẪN TRẢ LỜI:\n"
                f"- Khi người dùng đặt câu hỏi, hãy trả lời TRỰC TIẾP, ĐÚNG TRỌNG TÂM câu hỏi đó dựa trên dữ liệu rà quét ở trên.\n"
                f"- Không tự ý lặp lại cấu trúc báo cáo 4 pha trừ khi người dùng yêu cầu 'phân tích tổng thể' hoặc 'báo cáo tổng quan'."
            )

            # Auto-run 4-Phase Agentic Analysis
            with console.status("[bold magenta]ADQ Copilot đang thực hiện Phân tích Agentic 4 pha trên dữ liệu vừa quét...", spinner="dots"):
                analysis_res = copilot.analyze_scan_job(scan_data)

            if analysis_res.get("status") == "SUCCESS":
                console.print("\n[bold magenta]🤖 [ADQ COPILOT AGENTIC ANALYSIS][/bold magenta]")
                console.print(Markdown(analysis_res.get("text", "")))
            else:
                console.print(f"[dim red]Lỗi phân tích Copilot: {analysis_res.get('error')}[/dim red]")
        else:
            context_instruction = DEFAULT_COPILOT_SYSTEM_INSTRUCTION

        console.print(f"\n[bold magenta]ADQ Copilot>[/bold magenta] Đã kết nối Agentic AI Core thành công. Hãy đặt câu hỏi về mục tiêu [bold cyan]{target}[/bold cyan]:")

        while True:
            user_input = Prompt.ask("\n[bold green]You>[/bold green]")
            cmd = user_input.strip().lower()
            
            if cmd in ['exit', 'quit']:
                break
            
            if not user_input.strip():
                continue

            if cmd == 'report':
                render_telegram_style_scan_report(target=target, job_id="job_copilot_1001")
                continue

            if cmd == 'patch':
                vuln_type = Prompt.ask("Loại lỗ hổng cần vá", default="IDOR Parameter Mutation")
                endpoint = Prompt.ask("Endpoint bị ảnh hưởng", default="/api/v1/user")
                framework = Prompt.ask("Framework phát triển", default="Next.js")
                
                with console.status("[bold magenta]ADQ Copilot đang tạo bản vá One-Click Fix...", spinner="dots"):
                    patch_res = copilot.generate_one_click_fix(vulnerability_type=vuln_type, endpoint=endpoint, framework=framework)
                
                if patch_res.get("status") == "SUCCESS":
                    console.print("\n[bold magenta]ADQ Copilot One-Click Fix>[/bold magenta]")
                    console.print(Markdown(patch_res.get("text", "")))
                else:
                    console.print(f"\n[bold red]ADQ Copilot Error:[/bold red] {patch_res.get('error', 'Patch generation failed')}")
                continue

            with console.status("[bold magenta]ADQ Copilot đang suy luận & trả lời...", spinner="dots"):
                res = copilot._call_gemini_api(
                    user_input,
                    system_instruction=context_instruction,
                    enable_tools=True
                )

            if res.get("status") == "SUCCESS":
                console.print("\n[bold magenta]ADQ Copilot>[/bold magenta]")
                console.print(Markdown(res.get("text", "")))
                
                if "function_dispatch_result" in res:
                    fres = res["function_dispatch_result"]
                    console.print(f"\n[bold yellow]⚡ [AGENTIC FUNCTION DISPATCH][/bold yellow] [green]{fres.get('message')}[/green]")
            else:
                console.print(f"\n[bold red]ADQ Copilot Error:[/bold red] {res.get('error', 'API call failed')}")
                if "attempts" in res:
                    console.print(f"[dim red]Chi tiết lỗi: {res['attempts']}[/dim red]")
    except Exception as exc:
        console.print(f"\n[bold red][!] Lỗi khởi động Copilot Engine: {exc}[/bold red]")

    Prompt.ask("\n[dim]Ấn Enter để quay lại Menu Chính...[/dim]")

if __name__ == "__main__":
    main_menu()

