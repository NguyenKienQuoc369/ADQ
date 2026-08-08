import json

from modules.logic.idor_scanner import IDORScanner
from modules.logic.race_condition import RaceConditionScanner
from modules.logic.workflow_bypass import WorkflowBypassScanner


def main():
    base = "http://127.0.0.1:8001"

    race = RaceConditionScanner(base_url=base)
    race_result = race.scan(
        endpoint="/api/v1/coupon/apply",
        method="POST",
        body={"coupon": "PROMO100"},
        headers={},
        concurrency=60,
        action_limit=1,
    )

    idor = IDORScanner(base_url=base)
    idor_result = idor.scan(
        endpoint_template="/api/v1/users/{user_id}/profile",
        token_a="tokenA",
        token_b="tokenB",
        user_id_a="1001",
        user_id_b="2002",
        method="GET",
    )

    workflow = WorkflowBypassScanner(base_url=base)
    workflow_result = workflow.scan(
        prerequisite_endpoints=["/api/v1/otp/send", "/api/v1/otp/verify"],
        final_endpoint="/api/v1/transfer/execute",
        final_method="POST",
        final_body={"amount": 1000, "to": "ACC-DEMO"},
    )

    print(
        json.dumps(
            {
                "race_condition": race_result,
                "idor_bola": idor_result,
                "workflow_bypass": workflow_result,
            },
            ensure_ascii=False,
            indent=2,
        )
    )


if __name__ == "__main__":
    main()
