import argparse
import json
import time
from typing import Any, Dict

from bot.approval_queue import load_new_events
from config import config
from core import db
from core.dispatcher import run_validation_task


def _resolve_target(event: Dict[str, Any]) -> str:
    direct_target = str(event.get("target") or "").strip()
    if direct_target:
        return direct_target

    scan_id = str(event.get("scan_id") or "").strip()
    if not scan_id:
        return ""

    target_info = db.get_scan_target(scan_id)
    return str(target_info.get("target_domain") or "").strip()


def _handle_event(event_item: Dict[str, Any]) -> None:
    event = event_item.get("event", {})
    action = str(event.get("action") or "unknown")
    scan_id = str(event.get("scan_id") or "")
    vuln_type = str(event.get("vuln_type") or "config_leak")
    target = _resolve_target(event)

    if action == "approve":
        status_validating = db.update_scan_status(scan_id, "VALIDATING")
        print(f"[CONSUMER] approve -> scan_id={scan_id} status=VALIDATING target={target or '<unknown>'}")
        print(json.dumps({"db_update": status_validating}, ensure_ascii=False))

        validation_result = run_validation_task(
            scan_id=scan_id,
            target=target,
            vuln_type=vuln_type,
        )
        print(json.dumps({"dispatcher": validation_result}, ensure_ascii=False))

        final_status = "CONFIRMED" if validation_result.get("status") == "SUCCESS" else "REJECTED"
        status_final = db.update_scan_status(scan_id, final_status)
        print(f"[CONSUMER] approve -> scan_id={scan_id} status={final_status}")
        print(json.dumps({"db_update": status_final}, ensure_ascii=False))
    elif action == "reject":
        status_rejected = db.update_scan_status(scan_id, "REJECTED")
        print(f"[CONSUMER] reject -> scan_id={scan_id} status=REJECTED")
        print(json.dumps({"db_update": status_rejected}, ensure_ascii=False))
    else:
        print(f"[CONSUMER] unknown action={action} scan_id={scan_id}")

    print(json.dumps(event_item, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser(description="Consume Telegram approval queue (JSONL + cursor)")
    parser.add_argument("--queue-path", default=config.TELEGRAM_QUEUE_PATH, help="JSONL queue path")
    parser.add_argument("--cursor-path", default=config.TELEGRAM_QUEUE_CURSOR_PATH, help="Cursor file path")
    parser.add_argument("--interval", type=float, default=1.0, help="Polling interval in seconds")
    parser.add_argument("--max-cycles", type=int, default=None, help="Optional cycle limit for dry-run")
    args = parser.parse_args()

    cycle = 0
    while True:
        items = load_new_events(queue_path=args.queue_path, cursor_path=args.cursor_path)
        for item in items:
            _handle_event(item)

        cycle += 1
        if args.max_cycles is not None and cycle >= args.max_cycles:
            break
        time.sleep(max(0.0, args.interval))


if __name__ == "__main__":
    main()
