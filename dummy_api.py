import asyncio
from typing import Dict

from fastapi import FastAPI, Header, HTTPException

app = FastAPI(title="Dummy Vulnerable API", version="1.0.0")

COUPON_USED = False
USERS: Dict[str, Dict] = {
    "1001": {"user_id": "1001", "name": "alice", "balance": 5000},
    "2002": {"user_id": "2002", "name": "bob", "balance": 8000},
}


def user_from_auth(auth: str | None):
    if not auth or not auth.startswith("Bearer "):
        return None
    token = auth.split(" ", 1)[1]
    if token == "tokenA":
        return "1001"
    if token == "tokenB":
        return "2002"
    return None


@app.post("/api/v1/coupon/apply")
async def apply_coupon(payload: Dict):
    global COUPON_USED
    # Intentionally vulnerable race: no lock around check+set
    await asyncio.sleep(0.01)
    if not COUPON_USED:
        await asyncio.sleep(0.01)
        COUPON_USED = True
        return {"ok": True, "discount": 100, "message": "coupon applied"}
    return {"ok": False, "message": "already used"}


@app.get("/api/v1/users/{user_id}/profile")
def user_profile(user_id: str, authorization: str | None = Header(default=None)):
    # Intentionally vulnerable IDOR: token is checked only for existence, not ownership
    if not user_from_auth(authorization):
        raise HTTPException(status_code=401, detail="unauthorized")
    data = USERS.get(user_id)
    if not data:
        raise HTTPException(status_code=404, detail="not found")
    return data


@app.post("/api/v1/otp/send")
def otp_send():
    return {"ok": True, "step": "otp_sent"}


@app.post("/api/v1/otp/verify")
def otp_verify():
    return {"ok": True, "step": "otp_verified"}


@app.post("/api/v1/transfer/execute")
def transfer_execute(payload: Dict, authorization: str | None = Header(default=None)):
    # Intentionally vulnerable workflow bypass: allows execution without prior OTP/session state
    return {"ok": True, "tx": "TX-DEMO-001", "payload": payload, "auth_present": bool(authorization)}
