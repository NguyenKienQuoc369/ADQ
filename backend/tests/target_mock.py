from fastapi import FastAPI, Request, HTTPException
from fastapi.responses import JSONResponse
import random

app = FastAPI(title="ADQ Target Mock Server")


@app.get("/waf")
async def waf_endpoint(mode: str = "random"):
    """
    Simulate a WAF-protected endpoint. Modes:
    - random: 30% chance of 429
    - force429: always 429
    - ok: always 200
    """
    if mode == "force429":
        return JSONResponse(status_code=429, content={"detail": "Too Many Requests - WAF"})
    if mode == "ok":
        return {"status": "ok"}
    # random mode
    if random.random() < 0.3:
        return JSONResponse(status_code=429, content={"detail": "Too Many Requests - WAF"})
    return {"status": "ok"}


@app.get("/param")
async def param_endpoint(state: str = "ok"):
    """
    Simulate parameter fuzzing target:
    - state=fail -> returns 500
    - state=ok -> returns 200 with echo
    """
    if state == "fail":
        raise HTTPException(status_code=500, detail="Internal Error")
    return {"result": "received", "state": state}


@app.post("/auth/refresh")
async def auth_refresh(payload: Request):
    """
    Simulate token refresh endpoint. Expects JSON body with `refresh_token`.
    If refresh_token == "valid_refresh" -> return new token, else 401.
    """
    data = await payload.json()
    rt = data.get("refresh_token")
    if rt == "valid_refresh":
        return {"access_token": "new_access_token_abc", "expires_in": 3600}
    raise HTTPException(status_code=401, detail="invalid refresh token")
