import json
import os

from bot.approval_queue import enqueue_approval_event, load_new_events
from bot.telegram_ui import parse_callback_event


def _fake_update(update_id: int, action: str, scan_id: str, vuln_type: str) -> dict:
    return {
        "update_id": update_id,
        "callback_query": {
            "id": f"cq-{update_id}",
            "from": {"id": 999, "username": "local_tester"},
            "message": {"message_id": update_id, "chat": {"id": 12345}},
            "data": f"{action}:{scan_id}:{vuln_type}",
        },
    }


def main() -> None:
    queue_path = "/tmp/telegram_approvals_test.jsonl"
    cursor_path = "/tmp/telegram_approvals_test.cursor"

    for path in [queue_path, cursor_path]:
        if os.path.exists(path):
            os.remove(path)

    updates = [
        _fake_update(1001, "approve", "scan-aaa", "config_leak"),
        _fake_update(1002, "reject", "scan-bbb", "directory_listing"),
    ]

    for update in updates:
        event = parse_callback_event(update)
        if event:
            event["target"] = "example.com"
            enqueue_approval_event(event, queue_path=queue_path)

    first_batch = load_new_events(queue_path=queue_path, cursor_path=cursor_path)
    second_batch = load_new_events(queue_path=queue_path, cursor_path=cursor_path)

    print(json.dumps({"first_batch": first_batch, "second_batch": second_batch}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
