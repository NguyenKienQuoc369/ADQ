import os
import time
from pathlib import Path

from fastapi import FastAPI

app = FastAPI(
    title="ADQ Host Telemetry",
    docs_url=None,
    redoc_url=None,
    openapi_url=None,
)

HOST_PROC = Path("/host/proc")
HOST_ROOT = Path("/host/root")


def read_cpu_times():
    line = (HOST_PROC / "stat").read_text().splitlines()[0]
    parts = [int(x) for x in line.split()[1:]]

    idle = parts[3] + (parts[4] if len(parts) > 4 else 0)
    total = sum(parts)

    return total, idle


def cpu_percent():
    total1, idle1 = read_cpu_times()
    time.sleep(0.15)
    total2, idle2 = read_cpu_times()

    total_delta = total2 - total1
    idle_delta = idle2 - idle1

    if total_delta <= 0:
        return 0.0

    return round(
        100.0 * (1.0 - idle_delta / total_delta),
        1,
    )


def memory_info():
    values = {}

    for line in (HOST_PROC / "meminfo").read_text().splitlines():
        key, raw = line.split(":", 1)
        value = raw.strip().split()[0]
        values[key] = int(value)

    total_kb = values.get("MemTotal", 0)
    available_kb = values.get("MemAvailable", 0)
    used_kb = max(0, total_kb - available_kb)

    percent = (
        round((used_kb / total_kb) * 100, 1)
        if total_kb
        else 0.0
    )

    return {
        "usage_percent": percent,
        "used_gb": round(used_kb / 1024 / 1024, 2),
        "total_gb": round(total_kb / 1024 / 1024, 2),
        "available_gb": round(available_kb / 1024 / 1024, 2),
    }


def disk_info():
    stat = os.statvfs(HOST_ROOT)

    total = stat.f_blocks * stat.f_frsize
    available = stat.f_bavail * stat.f_frsize
    used = max(0, total - available)

    percent = (
        round((used / total) * 100, 1)
        if total
        else 0.0
    )

    gib = 1024 ** 3

    return {
        "usage_percent": percent,
        "used_gb": round(used / gib, 2),
        "total_gb": round(total / gib, 2),
        "free_gb": round(available / gib, 2),
    }


def load_average():
    raw = (HOST_PROC / "loadavg").read_text().split()

    return {
        "load_1m": float(raw[0]),
        "load_5m": float(raw[1]),
        "load_15m": float(raw[2]),
    }


def uptime_seconds():
    raw = (HOST_PROC / "uptime").read_text().split()[0]
    return int(float(raw))


@app.get("/health")
def health():
    return {"ok": True}


@app.get("/metrics")
def metrics():
    return {
        "ok": True,
        "scope": "VPS_HOST",
        "cpu_usage_percent": cpu_percent(),
        "memory": memory_info(),
        "disk": disk_info(),
        "load": load_average(),
        "uptime_seconds": uptime_seconds(),
        "timestamp": time.time(),
    }
