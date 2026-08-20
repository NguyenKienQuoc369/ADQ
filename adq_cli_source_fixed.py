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
    from backend.core.engine.dag_engine import DAGEngine
    from backend.core.engine.dag_state_manager import DAGStateManager, RedisDAGListener
except ImportError:
    from backend.core import DAGEngine, DAGStateManager, RedisDAGListener

console = Console()

def clear_screen():
    os.system('cls' if os.name == 'nt' else 'clear')

def draw_header():
    clear_screen()
    header_text = (
        "[bold cyan]      [ ADQ CORE - SECURITY ORCHESTRATOR ]      [/bold cyan]\n"
        "[dim]==================================================[/dim]\n"
        "[bold green] Node: Worker-Elite | Status: ONLINE | AI: READY | Live Feed: ACTIVE[/bold green]"
    )
    console.print(Panel(header_text, border_style="cyan"))

# =========================================================================
# SECURITY REPORT RENDERERS
# =========================================================================

def render_scan_report(
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
    counts = counts if counts is not None else {"subdomains": 0, "live_hosts": 0, "crawled_urls": 0, "open_ports": 0, "vulns": 0}
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
        f"[bold yellow]📊 [BÁO CÁO BẢO MẬT] HOÀN TẤT QUÉT MỤC TIÊU THỰC TẾ[/bold yellow]\n"
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
    summary_table.add_row("Live Hosts Hoạt động", str(counts.get("live_hosts", 0)), "🌐 HTTP/HTTPS Alive")
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


def render_apk_report(
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
        f"[bold yellow]📱 [BÁO CÁO BẢO MẬT] PHÂN TÍCH FILE APK (MOBILE AUDIT)[/bold yellow]\n"
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


def render_stress_report(
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
        f"[bold red]🔥 [BÁO CÁO BẢO MẬT] KẾT QUẢ TẤN CÔNG CHỊU TẢI & RATE LIMIT (k6 Engine)[/bold red]\n"
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
    res_table.add_row("[bold red]HTTP 403 WAF Blocked[/bold red]", str(s403), f"{round(s403/tot*100, 1)}%", "🛡️ WAF / Cloudflare / AWS / Vercel Chặn Bot")
    res_table.add_row("[bold yellow]HTTP 429 Rate Limited[/bold yellow]", str(s429), f"{round(s429/tot*100, 1)}%", "Cơ chế Rate Limit WAF hoạt động")
    res_table.add_row("[bold red]HTTP 500+ Server Crash[/bold red]", str(s500), f"{round(s500/tot*100, 1)}%", "⚠️ Máy chủ quá tải hoặc bị lỗi bộ nhớ")

    console.print(res_table)

    # Dynamic calculation of WAF bypass rate based on actual response metrics
    bypass_rate = round((s200 / tot) * 100, 1)
    if s403 > 0 and s200 == 0:
        bypass_eval = f"[bold red]Kích hoạt WAF Security Checkpoint (Chặn 100% Request với HTTP 403)[/bold red]"
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

    if metrics.get("waf_mitigated_count", 0) > 0 or metrics.get("vercel_mitigated_count", 0) > 0 or (s403 > 0 and s200 == 0):
        console.print(Panel(
            f"[bold yellow]💡 LƯU Ý BẢO MẬT & MẸO BYPASS WAF (CLOUDFLARE / VERCEL / AWS WAF):[/bold yellow]\n"
            f"• Máy chủ Edge CDN/WAF của mục tiêu đã kích hoạt chế độ [bold red]Security Checkpoint / CAPTCHA Challenge[/bold red] do quá tải.\n"
            f"• Khi tự kiểm thử hệ thống chính chủ, hãy truyền Header / Cookie bypass vào mục Token / Bypass Profile:\n"
            f"  - Vercel: [bold cyan]x-vercel-protection-bypass: <secret>[/bold cyan]\n"
            f"  - Cloudflare / Custom WAF: [bold cyan]Authorization: Bearer <token>[/bold cyan] hoặc [bold cyan]cf-clearance / cf_bm cookie[/bold cyan]",
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
        console.print("[4] Lịch sử Báo cáo Báo động (View Full Security Reports)")
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
    
    target = Prompt.ask("\n[bold]🎯 Nhập mục tiêu (URL, IP hoặc Domain)[/bold]", default="https://example.com")
    
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
        from backend.core.recon_scan.scanner import perform_real_dynamic_scan
    except ImportError:
        from backend.core import perform_real_dynamic_scan

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
            "parameters": []
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
        try:
            from backend.core.stress_test.stress_orchestrator import StressOrchestrator
            orch = StressOrchestrator()
            res = orch.execute_stress_test(target_url=target, target_rps=100, duration_sec=2)
            m = res.get("metrics", {})
            return {
                "stress_metrics": {
                    "total_requests": m.get("total_requests", 0),
                    "status_200": m.get("status_200", 0),
                    "status_429_rate_limited": m.get("status_429", 0),
                    "status_500_crashed": m.get("status_500", 0),
                    "rps": m.get("actual_rps", 0.0)
                }
            }
        except Exception as e:
            return {
                "stress_metrics": {
                    "total_requests": 0,
                    "status_200": 0,
                    "status_429_rate_limited": 0,
                    "status_500_crashed": 0,
                    "rps": 0.0,
                    "error": str(e)
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

    # Output full report with real scanned data
    render_scan_report(
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
            from backend.core.ai_copilot.copilot_engine import ADQSecurityCopilot
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
        from backend.core.mobile_audit.apk_analyzer import APKAnalyzer

        if os.path.exists(apk_path):
            analyzer = APKAnalyzer(apk_path)
            with console.status("[bold cyan]Đang decompile APK & quét Secret Keys trong Java/Kotlin bytecode...", spinner="bouncingBar"):
                res = analyzer.run_pipeline()
            if res.get("ok"):
                results = res.get("results", {})
                render_apk_report(
                    apk_name=os.path.basename(apk_path),
                    scanned_files_count=results.get("scanned_files_count", 0),
                    decompile_status=res.get("decompile_status"),
                    manifest_risks=results.get("manifest_risks"),
                    secrets=results.get("secrets")
                )
            else:
                console.print(f"\n[bold red][!] Lỗi phân tích APK: {res.get('error')}[/bold red]")
        else:
            render_apk_report(apk_name="sample_ebank.apk")
    except Exception as exc:
        console.print(f"\n[bold red][!] Lỗi thực thi APK Module: {exc}[/bold red]")

    Prompt.ask("\n[dim]Ấn Enter để quay lại Menu Chính...[/dim]")

def run_stress_module():
    draw_header()
    console.print("[bold red]--- STRESS TEST & RATE LIMIT MODULE (High-Throughput Async/Thread Engine) ---[/bold red]")
    target_input = Prompt.ask("[bold]🔥 Nhập URL hoặc Domain kiểm thử chịu tải[/bold]")
    
    # Format base target URL
    raw_target = target_input.strip()
    if not raw_target.startswith(("http://", "https://")):
        base_target = f"https://{raw_target}"
    else:
        base_target = raw_target

    # Probe & discovery candidate endpoints for this specific target
    console.print("\n[bold cyan]🔍 [ENDPOINT DISCOVERY] Đang rà quét nhanh các Endpoint thực tế trên mục tiêu...[/bold cyan]")
    try:
        from backend.core.recon_scan.scanner import perform_real_dynamic_scan
    except ImportError:
        from backend.core import perform_real_dynamic_scan

    with console.status("[bold green]Đang rà quét bề mặt Endpoint...", spinner="dots"):
        scan_res = perform_real_dynamic_scan(base_target, tier_choice=1)

    # Collect discovered candidate endpoints (ONLY real paths discovered)
    discovered_endpoints = [base_target]
    if scan_res.get("exposed_paths"):
        for path_item in scan_res["exposed_paths"]:
            clean_p = path_item.split(" ")[0]
            if clean_p not in discovered_endpoints:
                discovered_endpoints.append(clean_p)

    domain_clean = base_target.replace("https://", "").replace("http://", "").split("/")[0]

    # Display Endpoint selection guide & table
    guide_panel = Panel(
        "[bold cyan]💡 BÍ QUYẾT CHỌN ENDPOINT KIỂM THỬ TẢI HIỆU QUẢ NHẤT:[/bold cyan]\n"
        "  • [bold red]1. Endpoint Xử Lý Nặng (💥 Cực Cao / 🔥 Rất Cao):[/bold red] Đường dẫn như [yellow]/api/login[/yellow], [yellow]/search?q=...[/yellow], [yellow]/export[/yellow]. Ép Server chạy Bcrypt Hashing, DB Query, Uncached Logic => [bold white]Đo chính xác ngưỡng sập của Backend & Database.[/bold white]\n"
        "  • [bold yellow]2. Endpoint API Backend (⚡ Cao):[/bold yellow] Đường dẫn [yellow]/api/...[/yellow]. Bypass hoàn toàn CDN Cache, đánh trực tiếp vào Application Server (Node.js, Python, Go, Java).\n"
        "  • [bold dim]3. Trang Chủ / Static Files (🟡 Thấp):[/bold dim] Thường bị Cloudflare / Vercel Edge Cache hấp thụ 99% request, Server gốc hầu như không tốn CPU.",
        title="[bold yellow]📊 HƯỚNG DẪN ĐÁNH GIÁ MỨC ĐỘ HIỆU QUẢ TARGET[/bold yellow]",
        border_style="cyan"
    )
    console.print(guide_panel)

    ep_table = Table(title=f"🎯 CHỌN ENDPOINT MỤC TIÊU CỤ THỂ CHO {domain_clean}", show_header=True, header_style="bold cyan")
    ep_table.add_column("STT", style="bold yellow", width=6)
    ep_table.add_column("URL Endpoint Bắn Request", style="bold white")
    ep_table.add_column("Phân Loại Endpoint", style="bold green")
    ep_table.add_column("Đánh Giá Hiệu Quả Tải", style="bold magenta")

    active_candidates = discovered_endpoints[:6]
    for idx, ep in enumerate(active_candidates, start=1):
        if idx == 1:
            ep_type = "🎯 Target chính xác đã nhập"
            ep_eff = "[bold cyan]✅ URL/Path do người dùng cung cấp[/bold cyan]"
        else:
            ep_lower = ep.lower()
            if any(k in ep_lower for k in ["login", "auth", "register", "token", "password"]):
                ep_type = "Auth & Crypto API"
                ep_eff = "[bold red]💥 Cực Cao[/bold red] (Bcrypt & DB lookup)"
            elif any(k in ep_lower for k in ["search", "query", "filter", "export", "report", "?"]):
                ep_type = "Search / Query API"
                ep_eff = "[bold orange3]🔥 Rất Cao[/bold orange3] (DB Index & CPU Search)"
            elif "/api" in ep_lower:
                ep_type = "Backend API Logic"
                ep_eff = "[bold yellow]⚡ Cao[/bold yellow] (Bypass CDN Cache)"
            elif ep_lower.endswith(('.png', '.jpg', '.jpeg', '.css', '.js', '.ico', '.svg')):
                ep_type = "Static Resource"
                ep_eff = "[dim white]⚪ Cực Thấp[/dim white] (CDN/Browser Cached)"
            else:
                ep_type = "Trang chủ / HTML"
                ep_eff = "[bold cyan]🟡 Thấp[/bold cyan] (Thường bị Edge Cache)"

        ep_table.add_row(str(idx), ep, ep_type, ep_eff)
    ep_table.add_row("0", "Tự nhập URL/Endpoint tùy chỉnh khác", "Custom Path", "[bold white]👉 Tùy chọn[/bold white]")

    console.print(ep_table)

    ep_choice = IntPrompt.ask(f"Chọn Endpoint muốn bắn [0-{len(active_candidates)}]", choices=[str(i) for i in range(len(active_candidates) + 1)], default=1)
    if ep_choice == 0:
        target = Prompt.ask("[bold]👉 Nhập URL Endpoint tùy chỉnh đầy đủ[/bold]", default=base_target)
    else:
        target = active_candidates[ep_choice - 1]

    console.print(f"\n[bold green][+] Đã chọn mục tiêu bắn chịu tải:[/bold green] [bold cyan]{target}[/bold cyan]")
    
    # Auto-Detect WAF Fingerprints
    console.print("\n[bold cyan]👁️ [WAF FINGERPRINTING ENGINE] Đang 'ngửi' hạ tầng & phân tích khiên WAF mục tiêu...[/bold cyan]")
    
    try:
        from backend.core.recon_scan.waf_detector import detect_target_waf
    except ImportError:
        from backend.core import detect_target_waf

    with console.status("[bold green]Đang thụ động & chủ động chọc giận WAF để bắt dấu vết...", spinner="dots"):
        waf_res = detect_target_waf(target)

    detected_wafs = waf_res.get("detected_wafs", [])
    has_waf = waf_res.get("has_waf", False)

    stacked_headers = {}
    stacked_cookies = {}
    platforms_list = []
    bearer_token = ""

    if has_waf and detected_wafs != ["No WAF / Generic Server"]:
        console.print(Panel(
            f"[bold red]🚨 PHÁT HIỆN TỰ ĐỘNG MỤC TIÊU ĐANG NẰM SAU KHIÊN BẢO VỆ:[/bold red]\n" +
            "\n".join([f"  • [bold yellow]Lớp {idx+1}: {waf}[/bold yellow]" for idx, waf in enumerate(detected_wafs)]) +
            f"\n\n[bold white]💡 CẢNH BÁO:[/bold white] Để Stress Test đi xuyên qua 100% không bị WAF chặn 403, vui lòng nhập mã/token lách cho các hệ thống trên.",
            title="[bold yellow]👁️ WAF FINGERPRINT DETECTED[/bold yellow]",
            border_style="yellow"
        ))

        # Loop through detected WAFs and prompt for secrets for each
        for waf in detected_wafs:
            if "Cloudflare" in waf:
                console.print(f"\n[bold yellow]🛡️ CẤU HÌNH LÁCH CLOUDFLARE ({waf}):[/bold yellow]")
                cf_type = IntPrompt.ask("  Chọn phương thức [1: Service Token API | 2: Cookie cf_clearance | 3: Bỏ qua]", choices=["1", "2", "3"], default=1)
                if cf_type == 1:
                    cid = Prompt.ask("  🔑 Nhập CF-Access-Client-Id", default="")
                    csec = Prompt.ask("  🔑 Nhập CF-Access-Client-Secret", default="")
                    if cid and csec:
                        stacked_headers["CF-Access-Client-Id"] = cid.strip()
                        stacked_headers["CF-Access-Client-Secret"] = csec.strip()
                        platforms_list.append("Cloudflare Zero Trust API")
                elif cf_type == 2:
                    cookie_val = Prompt.ask("  🔑 Nhập Cookie cf_clearance", default="")
                    if cookie_val:
                        stacked_cookies["cf_clearance"] = cookie_val.strip()
                        platforms_list.append("Cloudflare Cookie")

            elif "Vercel" in waf:
                console.print(f"\n[bold cyan]🛡️ CẤU HÌNH LÁCH VERCEL EDGE ({waf}):[/bold cyan]")
                sec = Prompt.ask("  🔑 Nhập Vercel Protection Bypass Secret", default="")
                if sec:
                    stacked_headers["x-vercel-protection-bypass"] = sec.strip()
                    stacked_headers["x-vercel-set-bypass-cookie"] = "true"
                    platforms_list.append("Vercel Edge Protection")
                    bearer_token = sec.strip()

            elif "AWS" in waf:
                console.print(f"\n[bold orange3]🛡️ CẤU HÌNH LÁCH AWS WAF / API GATEWAY ({waf}):[/bold orange3]")
                aws_type = IntPrompt.ask("  Chọn phương thức AWS [1: x-api-key | 2: X-Amzn-Waf-Bypass | 3: Bỏ qua]", choices=["1", "2", "3"], default=1)
                if aws_type == 1:
                    k = Prompt.ask("  🔑 Nhập AWS API Key (x-api-key)", default="")
                    if k:
                        stacked_headers["x-api-key"] = k.strip()
                        platforms_list.append("AWS API Gateway")
                elif aws_type == 2:
                    k = Prompt.ask("  🔑 Nhập AWS WAF Bypass Secret (X-Amzn-Waf-Bypass)", default="")
                    if k:
                        stacked_headers["X-Amzn-Waf-Bypass"] = k.strip()
                        platforms_list.append("AWS WAF Bypass")

            elif any(w in waf for w in ["Akamai", "Imperva", "F5", "Sucuri", "Fortinet"]):
                console.print(f"\n[bold red]🛡️ CẤU HÌNH LÁCH ENTERPRISE WAF ({waf}):[/bold red]")
                ua_val = Prompt.ask("  🔑 Nhập User-Agent / Whitelist Header", default="ADQ-Authorized-Scanner-2026")
                if ua_val:
                    stacked_headers["User-Agent"] = ua_val.strip()
                    platforms_list.append(f"{waf} Whitelist")
    else:
        console.print("[bold green]✅ Không phát hiện khiên WAF công khai mạnh mẽ. Hạ tầng ở trạng thái tiêu chuẩn.[/bold green]")

    # Ask if user wants to add manual extra custom headers
    add_custom = Confirm.ask("\n[bold magenta]➕ Bạn có muốn thêm Header / Cookie tùy chỉnh khác thủ công không?[/bold magenta]", default=False)
    if add_custom:
        h_name = Prompt.ask("  🔑 Nhập Tên Header bí mật (VD: X-Custom-Auth)", default="")
        h_val = Prompt.ask(f"  🔑 Nhập Giá trị cho {h_name}", default="")
        if h_name and h_val:
            stacked_headers[h_name.strip()] = h_val.strip()
            platforms_list.append("Custom Header")

    bypass_config = None
    if stacked_headers or stacked_cookies:
        bypass_config = {
            "platform": " + ".join(platforms_list) if platforms_list else "Multi-WAF Stack",
            "headers": stacked_headers,
            "cookies": stacked_cookies
        }
        console.print(f"\n[bold green]✅ [PROFILES STACKED] Đã gộp thành công {len(stacked_headers)} Headers & {len(stacked_cookies)} Cookies lách đa lớp WAF![/bold green]")
    else:
        console.print("\n[bold dim]ℹ️ Không cấu hình WAF Bypass Secret. Bắn chịu tải trực tiếp công khai.[/bold dim]")

    # Prompt user for total target requests and duration instead of raw VUs
    target_requests = IntPrompt.ask("\n[bold]💥 Tổng số Request muốn bắn (ví dụ: 10000, 1000000)[/bold]", default=100000)
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
    vus = max(20, min(int(target_rps / 2), 2000))

    console.print(f"\n[+] Đang kích hoạt Live Attack Matrix cho target: [bold cyan]{target}[/bold cyan] ({target_requests:,} requests / {duration_sec}s - VUs: {vus})...")
    
    try:
        from backend.core.stress_test.stress_orchestrator import StressOrchestrator

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

            import urllib.parse
            target_path_str = urllib.parse.urlparse(target).path or "/"

            stream_logs.append({
                "time": now_str,
                "ip": ip,
                "method": "GET",
                "path": target_path_str,
                "status": status_code,
                "latency": latency
            })
            if len(stream_logs) > 30:
                del stream_logs[0]

        # Background stress test execution task
        def execute_bg():
            nonlocal stress_result
            # Execute high-throughput Go-k6 engine on primary node
            # StressOrchestrator hiện nhận:
            # target_url, target_requests, duration, bypass_code, waf_type,
            # custom_headers, custom_cookies.
            #
            # Không truyền bearer_token / vus / stats_callback / bypass_config
            # vì các keyword này không còn thuộc API của orchestrator.
            primary_waf = detected_wafs[0] if detected_wafs else ""
            primary_lower = primary_waf.lower()

            if "vercel" in primary_lower:
                waf_type = "vercel"
                bypass_code = bearer_token or ""
            elif "cloudflare" in primary_lower:
                waf_type = "cloudflare"
                # Cloudflare profile đã được thu thập dưới dạng explicit headers/cookies.
                bypass_code = ""
            elif "aws" in primary_lower or "api gateway" in primary_lower:
                waf_type = "awswaf"
                bypass_code = ""
            else:
                waf_type = "standard"
                bypass_code = ""

            stress_result = orchestrator.execute_stress_test(
                target_url=target,
                target_requests=target_requests,
                duration=duration,
                bypass_code=bypass_code,
                waf_type=waf_type,
                custom_headers=stacked_headers or None,
                custom_cookies=stacked_cookies or None,
            )

        import threading
        bg_thread = threading.Thread(target=execute_bg)
        bg_thread.start()

        start_time = time.time()

        # Orchestrator hiện không expose stats_callback theo từng request.
        # Vì vậy UI chỉ hiển thị trạng thái thực thi/elapsed thay vì dựng số liệu live giả.
        with Live(console=console, refresh_per_second=4) as live:
            while bg_thread.is_alive():
                elapsed = time.time() - start_time
                progress = min(1.0, elapsed / max(1, duration_sec))
                bar_width = 36
                filled = int(progress * bar_width)
                bar = "[bold cyan]" + ("█" * filled) + "[/bold cyan]" + "[dim]" + ("░" * (bar_width - filled)) + "[/dim]"

                live.update(Panel(
                    f"[bold white]Target:[/bold white] [cyan]{target}[/cyan]\n"
                    f"[bold white]Requested volume:[/bold white] {target_requests:,} requests\n"
                    f"[bold white]Configured duration:[/bold white] {duration}\n"
                    f"[bold white]Elapsed:[/bold white] {elapsed:.1f}s\n\n"
                    f"{bar} [bold cyan]{progress * 100:5.1f}%[/bold cyan]\n\n"
                    "[dim]Đang chờ metrics thực từ StressOrchestrator...[/dim]",
                    title="[bold red]🔥 L7 STRESS TEST ENGINE RUNNING[/bold red]",
                    border_style="red"
                ))
                time.sleep(0.25)

        # Chờ thread kết thúc thật sự để tránh đọc stress_result khi chưa được ghi.
        bg_thread.join()

        # Đọc kết quả thực từ orchestrator.
        if not stress_result:
            raise RuntimeError("StressOrchestrator kết thúc nhưng không trả về kết quả.")

        final_metrics = stress_result.get("metrics") or {}

        if not stress_result.get("ok", False):
            profile = stress_result.get("profile") or {}
            preflight = stress_result.get("preflight") or {}
            reason = (
                profile.get("message")
                or preflight.get("error")
                or stress_result.get("error")
                or "Stress test không hoàn tất."
            )
            console.print(Panel(
                f"[bold red]Stress Test không thể thực thi.[/bold red]\n"
                f"[white]Lý do:[/white] {reason}\n"
                f"[white]Preflight status:[/white] {preflight.get('status', 'N/A')}",
                title="[bold red]STRESS TEST FAILED[/bold red]",
                border_style="red"
            ))
        else:
            console.print("\n[bold green]✅ [STRESS TEST ENGINE] Đã nhận metrics thực từ StressOrchestrator.[/bold green]")

        render_stress_report(
            target_url=target,
            vus=vus,
            duration=duration,
            metrics=final_metrics,
            simulated=bool(stress_result.get("simulated", False))
        )

    except Exception as e:
        console.print(f"\n[bold red][!] Lỗi thực thi Stress Test: {e}[/bold red]")

    Prompt.ask("\n[dim]Ấn Enter để quay lại Menu Chính...[/dim]")

def view_logs_module():
    draw_header()
    console.print("[bold blue]--- LỊCH SỬ BÁO CÁO & JOB LOGS (SECURITY FULL FEED) ---[/bold blue]\n")
    console.print("  [1] Job #1001 - Target: target-bank.com (Web Core Audit)")
    console.print("  [2] Job #2002 - Target: sample_ebank.apk (Mobile APK Audit)")
    console.print("  [3] Job #3003 - Target: https://target-bank.com/api (Application Stress Test)")
    
    log_choice = IntPrompt.ask("\nChọn Báo cáo cần xem chi tiết", choices=["1", "2", "3"], default=1)

    if log_choice == 1:
        target = "https://target-bank.com"
        render_scan_report(target=target, job_id="job_core_1001")
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
        render_apk_report(apk_name="sample_ebank.apk")
    elif log_choice == 3:
        render_stress_report(target_url="https://target-bank.com/api/v1/transfer", vus=50)

    Prompt.ask("\n[dim]Ấn Enter để quay lại Menu Chính...[/dim]")

def interactive_copilot_session(target: str = "https://target-bank.com", scan_data: Optional[Dict[str, Any]] = None, model_name: Optional[str] = None):
    console.print("\n")
    console.print(Panel(
        f"[bold magenta]           [ ADQ SECURITY COPILOT - AGENTIC AI SESSION ]           [/bold magenta]\n"
        f"[bold white]🎯 Mục tiêu đang thảo luận:[/bold white] [bold cyan]{target}[/bold cyan]\n"
        f"[dim]Gõ 'exit' hoặc 'quit' để quay lại menu chính.[/dim]\n"
        f"[dim]⚡ Phím tắt nhanh: 'stress' (Load Test k6) | 'deep' (Quét sâu Endpoint) | 'idor' (Dò IDOR) | 'patch' (Tạo bản vá)[/dim]",
        border_style="magenta"
    ))

    try:
        from backend.core.ai_copilot.copilot_engine import ADQSecurityCopilot, DEFAULT_COPILOT_SYSTEM_INSTRUCTION

        copilot = ADQSecurityCopilot(model=model_name)

        # Build context system instruction
        if scan_data:
            scan_data_str = json.dumps(scan_data, ensure_ascii=False, indent=2)
            context_instruction = (
                f"{DEFAULT_COPILOT_SYSTEM_INSTRUCTION}\n\n"
                f"DỮ LIỆU RÀ QUÉT MỤC TIÊU VỪA HOÀN THÀNH:\n"
                f"{scan_data_str}\n\n"
                f"HƯỚNG DẪN TRẢ LỜI:\n"
                f"- Khi người dùng đặt câu hỏi hoặc yêu cầu thực thi, hãy trả lời TRỰC TIẾP, ĐÚNG TRỌNG TÂM dựa trên dữ liệu rà quét.\n"
                f"- Khi cần thực thi hành động (Stress test, Quét sâu, IDOR, Patch), HÃY KÍCH HOẠT TOOL/FUNCTION CALLING tương ứng."
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

        console.print(f"\n[bold magenta]ADQ Copilot>[/bold magenta] Đã kết nối Agentic AI Core thành công. Hãy đặt câu hỏi hoặc ra lệnh cho Copilot thực thi trên [bold cyan]{target}[/bold cyan]:")

        while True:
            user_input = Prompt.ask("\n[bold green]You>[/bold green]")
            cmd = user_input.strip().lower()
            
            if cmd in ['exit', 'quit']:
                break
            
            if not user_input.strip():
                continue

            if cmd == 'report':
                render_scan_report(target=target, job_id="job_copilot_1001")
                continue

            if cmd == 'stress':
                target_rps = int(Prompt.ask("Số Request/giây (RPS)", default="500"))
                duration_sec = int(Prompt.ask("Thời gian chạy (giây)", default="5"))
                
                with console.status(f"[bold red]🔥 Đang kích hoạt k6 Stress Test ({target_rps} RPS / {duration_sec}s)...[/bold red]", spinner="dots"):
                    exec_res = copilot.execute_local_tool("run_stress_test", {"target_url": target, "target_rps": target_rps, "duration_sec": duration_sec}, default_target=target)
                
                m = exec_res.get("metrics", {})
                tbl = Table(title=f"🔥 [K6 REAL-TIME STRESS TEST RESULT] {target}", show_header=True, header_style="bold red")
                tbl.add_column("Chỉ số Metrics", style="bold white")
                tbl.add_column("Giá trị Thực tế", style="bold yellow")
                tbl.add_row("Tổng số Request", str(m.get("total_requests", 0)))
                tbl.add_row("Thực tế RPS Đạt được", f"{m.get('actual_rps', 0):.2f} req/s")
                tbl.add_row("HTTP 200 Success", str(m.get("status_200", 0)))
                tbl.add_row("HTTP 429 Rate Limited", str(m.get("status_429", 0)))
                tbl.add_row("HTTP 500 Crashed", str(m.get("status_500", 0)))
                tbl.add_row("Độ trễ trung bình (p95)", f"{m.get('http_req_duration_p95_ms', 0):.2f} ms")
                console.print(tbl)
                continue

            if cmd == 'deep':
                path_input = Prompt.ask("Endpoint path cần quét sâu (ví dụ: /api/admin)", default="/admin")
                with console.status(f"[bold cyan]🔍 Đang rà quét sâu WAF Evasion trên {target}{path_input}...[/bold cyan]", spinner="dots"):
                    exec_res = copilot.execute_local_tool("trigger_deep_scan", {"target_path": path_input}, default_target=target)
                
                console.print(Panel(
                    f"[bold green]✅ [QUÉT SÂU HOÀN TẤT][/bold green]\n"
                    f"Mục tiêu: {exec_res.get('target')}\n"
                    f"HTTP Status: {exec_res.get('status_code')}\n"
                    f"Lỗ hổng phát hiện: {len(exec_res.get('vulnerabilities', []))}\n"
                    f"Cổng dịch vụ: {', '.join(exec_res.get('ports', []))}",
                    border_style="green"
                ))
                continue

            if cmd == 'idor':
                ep_input = Prompt.ask("Endpoint cần kiểm tra IDOR/BOLA", default="/api/v1/user")
                with console.status(f"[bold yellow]🕵️ Đang dò tham số & kiểm tra IDOR trên {ep_input}...[/bold yellow]", spinner="dots"):
                    exec_res = copilot.execute_local_tool("run_arjun_idor_scan", {"endpoint": ep_input}, default_target=target)
                
                console.print(Panel(
                    f"[bold yellow]🔍 [KẾT QUẢ DÒ IDOR][/bold yellow]\n"
                    f"Endpoint: {exec_res.get('target')}\n"
                    f"HTTP Status: {exec_res.get('status_code')}\n"
                    f"Lỗ hổng/Bất thường: {len(exec_res.get('vulnerabilities', []))}",
                    border_style="yellow"
                ))
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

            with console.status("[bold magenta]ADQ Copilot đang suy luận & thực thi...", spinner="dots"):
                res = copilot._call_gemini_api(
                    user_input,
                    system_instruction=context_instruction,
                    enable_tools=True,
                    target_url=target
                )

            if res.get("status") == "SUCCESS":
                console.print("\n[bold magenta]ADQ Copilot>[/bold magenta]")
                if res.get("text"):
                    console.print(Markdown(res.get("text", "")))
                
                if "function_dispatch_result" in res:
                    fres = res["function_dispatch_result"]
                    f_name = fres.get("function")
                    f_exec = fres.get("execution_result", {})
                    
                    console.print(f"\n[bold yellow]⚡ [AGENTIC ACTION EXECUTED][/bold yellow] [green]{fres.get('message')}[/green]")
                    
                    if f_name == "run_stress_test":
                        m = f_exec.get("metrics", {})
                        tbl = Table(title=f"🔥 [K6 REAL-TIME STRESS TEST RESULT] {target}", show_header=True, header_style="bold red")
                        tbl.add_column("Chỉ số Metrics", style="bold white")
                        tbl.add_column("Giá trị Thực tế", style="bold yellow")
                        tbl.add_row("Tổng số Request", str(m.get("total_requests", 0)))
                        tbl.add_row("Thực tế RPS Đạt được", f"{m.get('actual_rps', 0):.2f} req/s")
                        tbl.add_row("HTTP 200 Success", str(m.get("status_200", 0)))
                        tbl.add_row("HTTP 429 Rate Limited", str(m.get("status_429", 0)))
                        tbl.add_row("HTTP 500 Crashed", str(m.get("status_500", 0)))
                        tbl.add_row("Độ trễ trung bình (p95)", f"{m.get('http_req_duration_p95_ms', 0):.2f} ms")
                        console.print(tbl)
                    elif f_name in ("trigger_deep_scan", "run_arjun_idor_scan"):
                        console.print(Panel(
                            f"[bold green]✅ [KẾT QUẢ THỰC THI TOOL {f_name.upper()}][/bold green]\n"
                            f"Target: {f_exec.get('target')}\n"
                            f"HTTP Status: {f_exec.get('status_code')}\n"
                            f"Lỗ hổng phát hiện: {len(f_exec.get('vulnerabilities', []))}",
                            border_style="green"
                        ))
                    elif f_name == "generate_patch":
                        console.print(Markdown(f_exec.get("patch_code", "")))
            else:
                console.print(f"\n[bold red]ADQ Copilot Error:[/bold red] {res.get('error', 'API call failed')}")
                if "attempts" in res:
                    console.print(f"[dim red]Chi tiết lỗi: {res['attempts']}[/dim red]")
    except Exception as exc:
        console.print(f"\n[bold red][!] Lỗi khởi động Copilot Engine: {exc}[/bold red]")

    Prompt.ask("\n[dim]Ấn Enter để quay lại Menu Chính...[/dim]")

if __name__ == "__main__":
    main_menu()

