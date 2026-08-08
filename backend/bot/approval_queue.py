import json
import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from config import config

DEFAULT_QUEUE_PATH = config.TELEGRAM_QUEUE_PATH
DEFAULT_CURSOR_PATH = config.TELEGRAM_QUEUE_CURSOR_PATH


def _ensure_parent(path: str) -> None:
    os.makedirs(os.path.dirname(path), exist_ok=True)


def _now() -> str:
    return datetime.utcnow().isoformat() + "Z"


def enqueue_approval_event(event: Dict[str, Any], queue_path: str = DEFAULT_QUEUE_PATH) -> None:
    _ensure_parent(queue_path)
    payload = {
        "created_at": _now(),
        "event": event,
    }
    with open(queue_path, "a", encoding="utf-8") as file_obj:
        file_obj.write(json.dumps(payload, ensure_ascii=False) + "\n")


def _read_cursor(cursor_path: str = DEFAULT_CURSOR_PATH) -> int:
    if not os.path.exists(cursor_path):
        return 0
    try:
        with open(cursor_path, "r", encoding="utf-8") as file_obj:
            raw = file_obj.read().strip()
            return int(raw) if raw else 0
    except (ValueError, OSError):
        return 0


def _write_cursor(position: int, cursor_path: str = DEFAULT_CURSOR_PATH) -> None:
    _ensure_parent(cursor_path)
    with open(cursor_path, "w", encoding="utf-8") as file_obj:
        file_obj.write(str(max(0, int(position))))


def load_pending_events(queue_path: str = DEFAULT_QUEUE_PATH, action: Optional[str] = None) -> List[Dict[str, Any]]:
    if not os.path.exists(queue_path):
        return []

    result: List[Dict[str, Any]] = []
    with open(queue_path, "r", encoding="utf-8") as file_obj:
        for line in file_obj:
            line = line.strip()
            if not line:
                continue
            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                continue

            event = item.get("event", {})
            if action and str(event.get("action")) != action:
                continue
            result.append(item)
    return result


def load_new_events(
    queue_path: str = DEFAULT_QUEUE_PATH,
    cursor_path: str = DEFAULT_CURSOR_PATH,
    action: Optional[str] = None,
) -> List[Dict[str, Any]]:
    if not os.path.exists(queue_path):
        return []

    start = _read_cursor(cursor_path)
    events: List[Dict[str, Any]] = []

    with open(queue_path, "r", encoding="utf-8") as file_obj:
        file_obj.seek(start)
        while True:
            line = file_obj.readline()
            if not line:
                break

            line = line.strip()
            if not line:
                continue

            try:
                item = json.loads(line)
            except json.JSONDecodeError:
                continue

            event = item.get("event", {})
            if action and str(event.get("action")) != action:
                continue

            events.append(item)

        end_position = file_obj.tell()

    _write_cursor(end_position, cursor_path)
    return events
