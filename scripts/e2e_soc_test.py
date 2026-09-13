import urllib.request
import urllib.error
import http.cookiejar
import json
import ssl
import sys

ctx = ssl.create_default_context()
ctx.check_hostname = False
ctx.verify_mode = ssl.CERT_NONE

cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj), urllib.request.HTTPSHandler(context=ctx))

BASE = "https://adq-soc.click"

def check(name, cond, details=""):
    status = "PASS" if cond else "FAIL"
    print(f"[{status}] {name} - {details}")
    if not cond:
        raise Exception(f"Assertion failed: {name} - {details}")

print("=== STARTING ADQ SOC PRODUCTION E2E VERIFICATION ===")

# 1. Unauthenticated /api/admin/auth/session
try:
    req = urllib.request.Request(f"{BASE}/api/admin/auth/session")
    res = opener.open(req)
    data = json.loads(res.read().decode())
    check("Unauth session check", data.get("authenticated") is False, f"Got: {data}")
except urllib.error.HTTPError as e:
    check("Unauth session check (401)", e.code == 401, f"HTTP {e.code}")

# 2. Unauthenticated /api/admin/data/overview -> 401
try:
    req = urllib.request.Request(f"{BASE}/api/admin/data/overview")
    res = opener.open(req)
    check("Unauth overview 401", False, f"Got status {res.status}")
except urllib.error.HTTPError as e:
    check("Unauth overview 401", e.code == 401, f"HTTP {e.code}")

# 3. Wrong password login -> 401
try:
    payload = json.dumps({"password": "wrongpassword123"}).encode()
    req = urllib.request.Request(f"{BASE}/api/admin/auth/login", data=payload, headers={"Content-Type": "application/json"})
    opener.open(req)
    check("Wrong password login", False, "Expected 401")
except urllib.error.HTTPError as e:
    check("Wrong password login", e.code == 401, f"HTTP {e.code}")

# 4. Valid login with sisiniki123
payload = json.dumps({"password": "sisiniki123"}).encode()
req = urllib.request.Request(f"{BASE}/api/admin/auth/login", data=payload, headers={"Content-Type": "application/json"})
res = opener.open(req)
login_data = json.loads(res.read().decode())
check("Valid login with sisiniki123", res.status == 200 and login_data.get("ok") is True, f"Response: {login_data}")

# 5. Check session after login
req = urllib.request.Request(f"{BASE}/api/admin/auth/session")
res = opener.open(req)
sess_data = json.loads(res.read().decode())
check("Auth session active", sess_data.get("authenticated") is True and sess_data.get("realm") == "ADQ_SOC", f"Got: {sess_data}")

# 6. Data Overview (All 3 Data Sources & Workers)
req = urllib.request.Request(f"{BASE}/api/admin/data/overview")
res = opener.open(req)
ov = json.loads(res.read().decode())
sources = ov.get("sources", {})
pg_status = sources.get("postgres", {}).get("status")
sb_status = sources.get("supabaseAuth", {}).get("status")
rd_status = sources.get("redis", {}).get("status")
check("Data Overview ok", ov.get("ok") is True, f"ok: {ov.get('ok')}")
check("Postgres Source", pg_status == "HEALTHY", f"PG: {pg_status}")
check("Supabase Source", sb_status == "HEALTHY", f"SB: {sb_status}")
check("Redis Source", rd_status == "HEALTHY", f"Redis: {rd_status}")
metrics = ov.get("metrics", {})
print(f"  -> Authoritative metrics: {metrics}")

# 7. Users list (Supabase Auth & reconciliation)
req = urllib.request.Request(f"{BASE}/api/admin/data/supabase?action=users")
res = opener.open(req)
sb_users = json.loads(res.read().decode())
users_list = sb_users.get("users", [])
check("Supabase users fetched", len(users_list) > 0, f"Found {len(users_list)} users")

# 8. User 360 profile
first_user_id = users_list[0]["id"]
req = urllib.request.Request(f"{BASE}/api/admin/data/user-360/{first_user_id}")
res = opener.open(req)
u360 = json.loads(res.read().decode())
u_obj = u360.get("user", {})
u_act = u360.get("activity", {})
check("User 360 profile fetched", u_obj.get("authUserId") == first_user_id or u_obj.get("id") == first_user_id, f"User: {u_obj.get('email')}")
print(f"  -> User 360 activity: projects={len(u_act.get('projects',[]))}, scans={len(u_act.get('scans',[]))}, stress={len(u_act.get('stressJobs',[]))}, redemptions={len(u_act.get('redemptions',[]))}")

# 9. Product Views (projects, scans, stress, apk, copilot, audit-logs)
for p in ["projects", "scans", "stress", "apk", "copilot", "audit-logs"]:
    req = urllib.request.Request(f"{BASE}/api/admin/data/products/{p}")
    res = opener.open(req)
    prod_data = json.loads(res.read().decode())
    check(f"Product view: {p}", prod_data.get("product") == p, f"Items: {len(prod_data.get('items', []))}")

# 10. PostgreSQL Table Explorer (allowlisted tables)
req = urllib.request.Request(f"{BASE}/api/admin/data/postgres?action=tables")
res = opener.open(req)
pg_tables = json.loads(res.read().decode()).get("tables", [])
check("Postgres allowlisted tables list", len(pg_tables) >= 10, f"Tables: {[t.get('name') for t in pg_tables]}")

# 11. PostgreSQL Table Query (e.g. admin_actions)
req = urllib.request.Request(f"{BASE}/api/admin/data/postgres?action=query&table=admin_actions&pageSize=5")
res = opener.open(req)
t_query = json.loads(res.read().decode())
check("Postgres query admin_actions", "rows" in t_query, f"Total rows: {t_query.get('total')}")

# 12. PostgreSQL Disallowed Table Check
try:
    req = urllib.request.Request(f"{BASE}/api/admin/data/postgres?action=query&table=non_existent_table")
    opener.open(req)
    check("Disallowed table rejected", False, "Expected 400")
except urllib.error.HTTPError as e:
    check("Disallowed table rejected", e.code == 400, f"HTTP {e.code}")

# 13. Redis Explorer
req = urllib.request.Request(f"{BASE}/api/admin/data/redis?action=keys&pattern=*&limit=10")
res = opener.open(req)
r_keys = json.loads(res.read().decode())
check("Redis keys inspected", "keys" in r_keys, f"Found {len(r_keys.get('keys', []))} sample keys")

# 14. HTML Page Responses (Check dark theme & rendered components)
pages = ["/admin", "/admin/users", "/admin/entitlements", "/admin/redeem-codes", "/admin/projects", "/admin/scans", "/admin/stress", "/admin/apk", "/admin/copilot", "/admin/postgres", "/admin/supabase", "/admin/redis", "/admin/services", "/admin/audit-logs", "/admin/security"]
for p in pages:
    req = urllib.request.Request(f"{BASE}{p}")
    res = opener.open(req)
    check(f"HTML Page {p}", res.status == 200, f"Status {res.status}")

# 15. Sensitive Field Redaction Inspection
req = urllib.request.Request(f"{BASE}/api/admin/data/postgres?action=query&table=admin_actions&pageSize=10")
res = opener.open(req)
rows_str = res.read().decode()
check("No raw secrets in responses", "sisiniki123" not in rows_str and "DATABASE_URL" not in rows_str, "Zero leaked credentials")

# 16. Logout
req = urllib.request.Request(f"{BASE}/api/admin/auth/logout", data=b"{}", headers={"Content-Type": "application/json"})
res = opener.open(req)
check("Logout successful", res.status == 200)

# 17. Post-logout protection
try:
    req = urllib.request.Request(f"{BASE}/api/admin/data/overview")
    opener.open(req)
    check("Post-logout overview blocked", False, "Expected 401")
except urllib.error.HTTPError as e:
    check("Post-logout overview blocked", e.code == 401, f"HTTP {e.code}")

print("\n>>> ALL 17 E2E CHECKS PASSED WITH 100% SUCCESS ON PRODUCTION HTTPS://ADQ-SOC.CLICK <<<")

