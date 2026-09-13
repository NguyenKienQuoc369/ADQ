import urllib.request
import urllib.error
import http.cookiejar
import json
import ssl

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj), urllib.request.HTTPSHandler(context=ctx))

BASE = "https://adq-soc.click"

print("=== TESTING RATE LIMITER REGRESSION ===")

# Test 5 failed attempts with a test IP
test_ip = "198.51.100.77"
for i in range(1, 6):
    try:
        req = urllib.request.Request(
            f"{BASE}/api/admin/auth/login",
            data=json.dumps({"password": f"wrong_password_{i}"}).encode(),
            headers={"Content-Type": "application/json", "X-Forwarded-For": test_ip}
        )
        opener.open(req)
        print(f"Attempt {i}: Unexpected 200")
    except urllib.error.HTTPError as e:
        body = json.loads(e.read().decode())
        print(f"Attempt {i}: HTTP {e.code} - code: {body.get('code')}")

# 6th attempt should return HTTP 429
try:
    req = urllib.request.Request(
        f"{BASE}/api/admin/auth/login",
        data=json.dumps({"password": "sisiniki123"}).encode(),
        headers={"Content-Type": "application/json", "X-Forwarded-For": test_ip}
    )
    opener.open(req)
    print("Attempt 6: Unexpected 200")
except urllib.error.HTTPError as e:
    body = json.loads(e.read().decode())
    print(f"Attempt 6 (should be 429): HTTP {e.code} - code: {body.get('code')} - locked: {body.get('locked')} - retryAfter: {body.get('retryAfter')}")

# Clean IP should succeed without issues
clean_ip = "198.51.100.88"
req = urllib.request.Request(
    f"{BASE}/api/admin/auth/login",
    data=json.dumps({"password": "sisiniki123"}).encode(),
    headers={"Content-Type": "application/json", "X-Forwarded-For": clean_ip}
)
res = opener.open(req)
data = json.loads(res.read().decode())
print(f"Clean IP Attempt: HTTP {res.status} - ok: {data.get('ok')} - role: {data.get('role')}")

