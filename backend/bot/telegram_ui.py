import time
from typing import Any, Callable, Dict, List, Optional

import requests

from config import config


CallbackHandler = Callable[[Dict[str, Any]], None]


def _api_base(token: Optional[str] = None) -> str:
    bot_token = token or config.TELEGRAM_TOKEN
    if not bot_token:
        raise ValueError("TELEGRAM_TOKEN chưa được cấu hình")
    return f"https://api.telegram.org/bot{bot_token}"


def send_message(
    text: str,
    chat_id: Optional[str] = None,
    parse_mode: str = "HTML",
    reply_markup: Optional[Dict[str, Any]] = None,
    disable_web_page_preview: bool = True,
) -> Dict[str, Any]:
    target_chat_id = chat_id or config.TELEGRAM_CHAT_ID
    if not target_chat_id:
        raise ValueError("TELEGRAM_CHAT_ID chưa được cấu hình")

    payload: Dict[str, Any] = {
        "chat_id": target_chat_id,
        "text": text,
        "parse_mode": parse_mode,
        "disable_web_page_preview": disable_web_page_preview,
    }
    if reply_markup:
        payload["reply_markup"] = reply_markup

    response = requests.post(
        f"{_api_base()}/sendMessage",
        json=payload,
        timeout=config.TELEGRAM_API_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()


def send_ai_review_message(review_payload: Dict[str, Any], chat_id: Optional[str] = None) -> Dict[str, Any]:
    return send_message(
        text=str(review_payload.get("text") or "(empty)"),
        chat_id=chat_id,
        parse_mode=str(review_payload.get("parse_mode") or "HTML"),
        reply_markup=review_payload.get("reply_markup"),
    )


def answer_callback_query(
    callback_query_id: str,
    text: Optional[str] = None,
    show_alert: bool = False,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "callback_query_id": callback_query_id,
        "show_alert": show_alert,
    }
    if text:
        payload["text"] = text

    response = requests.post(
        f"{_api_base()}/answerCallbackQuery",
        json=payload,
        timeout=config.TELEGRAM_API_TIMEOUT,
    )
    response.raise_for_status()
    return response.json()


def get_updates(
    offset: Optional[int] = None,
    timeout: Optional[int] = None,
    allowed_updates: Optional[List[str]] = None,
) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "timeout": timeout if timeout is not None else config.TELEGRAM_POLL_TIMEOUT,
    }
    if offset is not None:
        payload["offset"] = offset
    if allowed_updates is not None:
        payload["allowed_updates"] = allowed_updates

    response = requests.get(
        f"{_api_base()}/getUpdates",
        params=payload,
        timeout=(payload["timeout"] + config.TELEGRAM_API_TIMEOUT),
    )
    response.raise_for_status()
    return response.json()


def parse_callback_event(update: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    callback_query = update.get("callback_query")
    if not callback_query:
        return None

    data = str(callback_query.get("data") or "")
    action, scan_id, vuln_type = "unknown", "", ""
    parts = data.split(":")
    if len(parts) >= 2:
        action, scan_id = parts[0], parts[1]
    if len(parts) >= 3:
        vuln_type = parts[2]

    return {
        "update_id": update.get("update_id"),
        "callback_query_id": callback_query.get("id"),
        "data": data,
        "action": action,
        "scan_id": scan_id,
        "vuln_type": vuln_type,
        "from": callback_query.get("from", {}),
        "message": callback_query.get("message", {}),
    }


def poll_callback_queries(
    handler: CallbackHandler,
    offset: Optional[int] = None,
    timeout: Optional[int] = None,
    interval_seconds: Optional[float] = None,
    max_cycles: Optional[int] = None,
) -> int:
    next_offset = offset
    cycle = 0
    sleep_interval = config.TELEGRAM_POLL_INTERVAL if interval_seconds is None else interval_seconds

    while True:
        result = get_updates(
            offset=next_offset,
            timeout=timeout,
            allowed_updates=["callback_query"],
        )
        updates = result.get("result", []) if isinstance(result, dict) else []

        for update in updates:
            update_id = int(update.get("update_id", 0))
            next_offset = update_id + 1

            event = parse_callback_event(update)
            if not event:
                continue

            handler(event)
            callback_query_id = event.get("callback_query_id")
            if callback_query_id:
                answer_callback_query(str(callback_query_id), text=f"Đã nhận: {event.get('action', 'unknown')}")

        cycle += 1
        if max_cycles is not None and cycle >= max_cycles:
            break
        if sleep_interval > 0:
            time.sleep(sleep_interval)

    return int(next_offset or 0)
