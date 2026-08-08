import os
from dataclasses import dataclass
from dotenv import load_dotenv

load_dotenv()

@dataclass
class Config:
    TELEGRAM_TOKEN: str = os.environ.get("TELEGRAM_TOKEN", "")
    TELEGRAM_CHAT_ID: str = os.environ.get("TELEGRAM_CHAT_ID", "")
    TELEGRAM_ENABLED: bool = os.environ.get("TELEGRAM_ENABLED", "true").lower() not in ["0", "false", "no"]
    WORDLIST_PATH: str = os.environ.get("WORDLIST_PATH", "/usr/share/seclists/Discovery/Web-Content/common.txt")
    DEFAULT_MAX_URLS: int = int(os.environ.get("DEFAULT_MAX_URLS", 5000))
    DEFAULT_TIMEOUT: int = int(os.environ.get("DEFAULT_TIMEOUT", 900))
    DEFAULT_BATCH_SIZE: int = int(os.environ.get("DEFAULT_BATCH_SIZE", 500))
    DEFAULT_THREAD_POOL: int = int(os.environ.get("DEFAULT_THREAD_POOL", 4))
    DEFAULT_THROTTLE_ENABLED: bool = os.environ.get("DEFAULT_THROTTLE_ENABLED", "false").lower() in ["1", "true", "yes"]
    DEFAULT_THROTTLE_BASE: float = float(os.environ.get("DEFAULT_THROTTLE_BASE", 0.0))
    DEFAULT_THROTTLE_STEP: float = float(os.environ.get("DEFAULT_THROTTLE_STEP", 0.5))
    DEFAULT_THROTTLE_MAX: float = float(os.environ.get("DEFAULT_THROTTLE_MAX", 5.0))
    DEFAULT_NUCLEI_RL: int = int(os.environ.get("DEFAULT_NUCLEI_RL", 150))
    DEFAULT_NUCLEI_C: int = int(os.environ.get("DEFAULT_NUCLEI_C", 50))
    DEFAULT_NUCLEI_RL_MIN: int = int(os.environ.get("DEFAULT_NUCLEI_RL_MIN", 50))
    DEFAULT_NUCLEI_C_MIN: int = int(os.environ.get("DEFAULT_NUCLEI_C_MIN", 10))
    DEFAULT_NUCLEI_RL_STEP: int = int(os.environ.get("DEFAULT_NUCLEI_RL_STEP", 25))
    DEFAULT_NUCLEI_C_STEP: int = int(os.environ.get("DEFAULT_NUCLEI_C_STEP", 10))
    EXTRA_TOOLS: tuple = tuple(os.environ.get("EXTRA_TOOLS", "naabu,katana,waybackurls,dnsx,httpx").split(","))
    SUPABASE_URL: str = os.environ.get("SUPABASE_URL", "")
    SUPABASE_KEY: str = os.environ.get("SUPABASE_KEY", "")
    AI_ENABLED: bool = os.environ.get("AI_ENABLED", "false").lower() in ["1", "true", "yes"]
    AI_API_URL: str = os.environ.get("AI_API_URL", "")
    AI_API_KEY: str = os.environ.get("AI_API_KEY", "")
    AI_MODEL: str = os.environ.get("AI_MODEL", "gpt-4o-mini")
    AI_TIMEOUT: int = int(os.environ.get("AI_TIMEOUT", 30))
    TELEGRAM_API_TIMEOUT: int = int(os.environ.get("TELEGRAM_API_TIMEOUT", 20))
    TELEGRAM_POLL_TIMEOUT: int = int(os.environ.get("TELEGRAM_POLL_TIMEOUT", 50))
    TELEGRAM_POLL_INTERVAL: float = float(os.environ.get("TELEGRAM_POLL_INTERVAL", 0.5))
    TELEGRAM_QUEUE_PATH: str = os.environ.get("TELEGRAM_QUEUE_PATH", "/home/sisiniki123/ADQ/runtime/telegram_approvals.jsonl")
    TELEGRAM_QUEUE_CURSOR_PATH: str = os.environ.get("TELEGRAM_QUEUE_CURSOR_PATH", "/home/sisiniki123/ADQ/runtime/telegram_approvals.cursor")


config = Config()
