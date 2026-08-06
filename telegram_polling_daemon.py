import argparse
import json

from bot.approval_queue import enqueue_approval_event
from bot.telegram_ui import poll_callback_queries
from config import config


def _on_callback(event, queue_path: str):
    action = event.get("action")
    scan_id = event.get("scan_id")

    enqueue_approval_event(event, queue_path=queue_path)

    if action == "approve":
        print(f"[APPROVE] scan_id={scan_id} -> queued for deep scan")
    elif action == "reject":
        print(f"[REJECT] scan_id={scan_id} -> queued as manual review")
    else:
        print(f"[UNKNOWN] action={action} scan_id={scan_id} -> queued")

    print(json.dumps(event, ensure_ascii=False))


def main() -> None:
    parser = argparse.ArgumentParser(description="Telegram callback polling daemon")
    parser.add_argument("--offset", type=int, default=None, help="Initial Telegram update offset")
    parser.add_argument("--timeout", type=int, default=None, help="Long-poll timeout seconds")
    parser.add_argument("--interval", type=float, default=None, help="Sleep seconds between poll cycles")
    parser.add_argument("--max-cycles", type=int, default=None, help="Optional cycle limit for dry-run")
    parser.add_argument("--queue-path", default=config.TELEGRAM_QUEUE_PATH, help="Path JSONL queue file")
    args = parser.parse_args()

    next_offset = poll_callback_queries(
        handler=lambda event: _on_callback(event, queue_path=args.queue_path),
        offset=args.offset,
        timeout=args.timeout,
        interval_seconds=args.interval,
        max_cycles=args.max_cycles,
    )
    print(f"[EXIT] next_offset={next_offset}")


if __name__ == "__main__":
    main()
