import time
import uuid
import threading
from typing import Dict, Any, Tuple, Optional
from fastapi import HTTPException, status

# ----------------------------------------------------------------------
# Canonical Tier Limits for Stress Test
# ----------------------------------------------------------------------
STRESS_TIER_LIMITS = {
    "FREE": {
        "allowed": False,
        "max_requests": 0,
        "max_duration_sec": 0,
        "max_rps": 0,
        "max_concurrent_per_user": 0,
    },
    "PRO": {
        "allowed": True,
        "max_requests": 2000,
        "max_duration_sec": 30,
        "max_rps": 100,
        "max_concurrent_per_user": 1,
    },
    "PRO_MAX": {
        "allowed": True,
        "max_requests": 5000,
        "max_duration_sec": 60,
        "max_rps": 250,
        "max_concurrent_per_user": 1,
    },
    "ENTERPRISE": {
        "allowed": True,
        "max_requests": 5000,
        "max_duration_sec": 60,
        "max_rps": 250,
        "max_concurrent_per_user": 1,
    },
}

MAX_CONCURRENT_GLOBAL = 2

# Process-level in-memory fallback state
_PROCESS_GLOBAL_SEMAPHORE = threading.Semaphore(MAX_CONCURRENT_GLOBAL)
_PROCESS_ACTIVE_USERS: Dict[str, str] = {}  # user_id -> job_id
_PROCESS_LOCK = threading.Lock()

# ----------------------------------------------------------------------
# Lua Scripts for Redis Atomic Execution
# ----------------------------------------------------------------------
LUA_GLOBAL_ACQUIRE = """
local jobs_set = KEYS[1]
local job_id = ARGV[1]
local user_id = ARGV[2]
local ttl = tonumber(ARGV[3])
local max_global = tonumber(ARGV[4])

-- 1. Lazy prune stale/expired slots
local all_jobs = redis.call('SMEMBERS', jobs_set)
local valid_count = 0

for i, jid in ipairs(all_jobs) do
    local slot_key = 'stress_active_slot:' .. jid
    if redis.call('EXISTS', slot_key) == 1 then
        valid_count = valid_count + 1
    else
        redis.call('SREM', jobs_set, jid)
    end
end

-- 2. Concurrency limit check
if valid_count >= max_global then
    return 0
end

-- 3. Atomic slot allocation
local new_slot_key = 'stress_active_slot:' .. job_id
redis.call('SET', new_slot_key, user_id, 'EX', ttl)
redis.call('SADD', jobs_set, job_id)

return 1
"""

LUA_PER_USER_RELEASE_CAS = """
local user_key = KEYS[1]
local expected_job_id = ARGV[1]

if redis.call('GET', user_key) == expected_job_id then
    return redis.call('DEL', user_key)
else
    return 0
end
"""

LUA_GLOBAL_RELEASE = """
local jobs_set = KEYS[1]
local job_id = ARGV[1]

local slot_key = 'stress_active_slot:' .. job_id
redis.call('DEL', slot_key)
redis.call('SREM', jobs_set, job_id)
return 1
"""

LUA_RENEW_LEASE = """
local user_key = KEYS[1]
local jobs_set = KEYS[2]
local job_id = ARGV[1]
local ttl = tonumber(ARGV[2])

local slot_key = 'stress_active_slot:' .. job_id

if redis.call('GET', user_key) == job_id then
    redis.call('EXPIRE', user_key, ttl)
    redis.call('EXPIRE', slot_key, ttl)
    return 1
else
    return 0
end
"""

def parse_duration_sec(val: Any, default: int = 5) -> int:
    if isinstance(val, (int, float)):
        return max(1, int(val))
    if isinstance(val, str):
        cleaned = val.strip().lower().rstrip("s")
        try:
            return max(1, int(cleaned))
        except ValueError:
            pass
    return default

def validate_stress_runtime_limits(tier: str, target_requests: int, duration_sec: int) -> Tuple[int, int, int]:
    """
    Validates request payload against canonical tier limits without silent clamping.
    Returns: (target_requests, duration_sec, calculated_rps)
    """
    tier_upper = (tier or "FREE").upper()
    limits = STRESS_TIER_LIMITS.get(tier_upper, STRESS_TIER_LIMITS["FREE"])

    if not limits["allowed"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Gói FREE không hỗ trợ Stress Test. Vui lòng nâng cấp lên gói PRO hoặc ENTERPRISE."
        )

    if target_requests <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Số lượng request (target_requests) phải lớn hơn 0."
        )

    if duration_sec <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Thời gian bắn tải (duration) phải lớn hơn 0 giây."
        )

    max_reqs = limits["max_requests"]
    max_dur = limits["max_duration_sec"]
    max_rps = limits["max_rps"]

    if target_requests > max_reqs:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Số lượng requests ({target_requests}) vượt quá giới hạn gói {tier_upper} (tối đa {max_reqs} requests)."
        )

    if duration_sec > max_dur:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Thời gian bắn tải ({duration_sec}s) vượt quá giới hạn gói {tier_upper} (tối đa {max_dur}s)."
        )

    calculated_rps = max(1, int(round(target_requests / max(1, duration_sec))))
    if calculated_rps > max_rps:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Tốc độ bắn tải dự tính ({calculated_rps} RPS) vượt quá giới hạn gói {tier_upper} (tối đa {max_rps} RPS)."
        )

    return target_requests, duration_sec, calculated_rps

class StressSlotGovernor:
    """
    Governor enforcing:
    1. Per-user concurrency limit = 1 (Atomic SET NX EX + CAS Lua Release)
    2. Global concurrency limit = 2 across API instances (Atomic Lua Acquire & Release)
    3. Queue-aware lease management and background renewal
    """
    def __init__(self, redis_client: Any, user_id: str, duration_sec: int, job_id: Optional[str] = None, is_queue: bool = False):
        self.redis_client = redis_client
        self.user_id = str(user_id)
        self.duration_sec = duration_sec
        self.is_queue = is_queue
        # For queued jobs: lease is longer to cover queue wait + execution
        self.ttl = max(180, duration_sec + 120) if is_queue else max(60, duration_sec + 15)
        self.job_id = job_id or f"stress-job-{uuid.uuid4().hex[:12]}"
        self.acquired_user_lock = False
        self.acquired_global_slot = False
        self.acquired_semaphore = False

    def __enter__(self):
        self.acquire()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.release()

    def acquire(self):
        # 1. Per-User Lock Check
        if self.redis_client:
            user_key = f"stress_active_user:{self.user_id}"
            user_acquired = self.redis_client.set(user_key, self.job_id, nx=True, ex=self.ttl)
            if not user_acquired:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="Bạn đang có 1 tiến trình kiểm thử tải đang chạy. Vui lòng chờ hoàn tất trước khi bắt đầu đợt mới."
                )
            self.acquired_user_lock = True

            # 2. Global Concurrency Slot Check via Atomic Lua Script
            try:
                acquired_global = self.redis_client.eval(
                    LUA_GLOBAL_ACQUIRE,
                    1,
                    "stress_active_jobs",
                    self.job_id,
                    self.user_id,
                    self.ttl,
                    MAX_CONCURRENT_GLOBAL,
                )
            except Exception:
                self._release_user_lock()
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Lỗi hệ thống điều phối tải (Redis Governor error)."
                )

            if not acquired_global or int(acquired_global) != 1:
                self._release_user_lock()
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Hệ thống đang phục vụ tối đa ({MAX_CONCURRENT_GLOBAL}) phiên kiểm thử tải đồng thời. Vui lòng thử lại sau giây lát."
                )
            self.acquired_global_slot = True
        else:
            # In-process fallback
            with _PROCESS_LOCK:
                if self.user_id in _PROCESS_ACTIVE_USERS:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="Bạn đang có 1 tiến trình kiểm thử tải đang chạy. Vui lòng chờ hoàn tất trước khi bắt đầu đợt mới."
                    )
                _PROCESS_ACTIVE_USERS[self.user_id] = self.job_id
                self.acquired_user_lock = True

            got_sem = _PROCESS_GLOBAL_SEMAPHORE.acquire(blocking=False)
            if not got_sem:
                with _PROCESS_LOCK:
                    if _PROCESS_ACTIVE_USERS.get(self.user_id) == self.job_id:
                        _PROCESS_ACTIVE_USERS.pop(self.user_id, None)
                    self.acquired_user_lock = False
                raise HTTPException(
                    status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                    detail=f"Hệ thống đang phục vụ tối đa ({MAX_CONCURRENT_GLOBAL}) phiên kiểm thử tải đồng thời. Vui lòng thử lại sau giây lát."
                )
            self.acquired_semaphore = True

    def renew_lease(self, extra_seconds: Optional[int] = None) -> bool:
        """Renews lock and slot TTL during active worker execution."""
        renew_ttl = extra_seconds or max(60, self.duration_sec + 30)
        if self.redis_client:
            try:
                user_key = f"stress_active_user:{self.user_id}"
                res = self.redis_client.eval(LUA_RENEW_LEASE, 2, user_key, "stress_active_jobs", self.job_id, renew_ttl)
                return bool(res and int(res) == 1)
            except Exception:
                return False
        return True

    def _release_user_lock(self):
        if self.acquired_user_lock:
            if self.redis_client:
                try:
                    user_key = f"stress_active_user:{self.user_id}"
                    self.redis_client.eval(LUA_PER_USER_RELEASE_CAS, 1, user_key, self.job_id)
                except Exception:
                    pass
            else:
                with _PROCESS_LOCK:
                    if _PROCESS_ACTIVE_USERS.get(self.user_id) == self.job_id:
                        _PROCESS_ACTIVE_USERS.pop(self.user_id, None)
            self.acquired_user_lock = False

    def release(self):
        if self.redis_client:
            if self.acquired_global_slot:
                try:
                    self.redis_client.eval(LUA_GLOBAL_RELEASE, 1, "stress_active_jobs", self.job_id)
                except Exception:
                    pass
                self.acquired_global_slot = False

            self._release_user_lock()
        else:
            if self.acquired_semaphore:
                try:
                    _PROCESS_GLOBAL_SEMAPHORE.release()
                except Exception:
                    pass
                self.acquired_semaphore = False

            self._release_user_lock()

    @staticmethod
    def release_by_job(redis_client: Any, user_id: str, job_id: str):
        """Static helper to safely release governor keys by job_id (used by worker or watchdog)."""
        if not redis_client:
            return
        try:
            user_key = f"stress_active_user:{user_id}"
            redis_client.eval(LUA_PER_USER_RELEASE_CAS, 1, user_key, job_id)
            redis_client.eval(LUA_GLOBAL_RELEASE, 1, "stress_active_jobs", job_id)
        except Exception:
            pass
