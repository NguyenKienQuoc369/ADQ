import asyncio
import json
import logging
from typing import Any, Callable, Dict, List, Optional
import os

try:
    import redis.asyncio as aioredis  # type: ignore
    HAS_REDIS_ASYNC = True
except ImportError:
    HAS_REDIS_ASYNC = False

logger = logging.getLogger("ADQ.HiveMind")

HIVE_MIND_CHANNEL = "adq:hive_mind:events"
HIVE_MIND_MEM_KEY = "adq:hive_mind:shared_memory"


class HiveMindNode:
    """
    Distributed Shared Memory & Hive-Mind State Synchronizer
    - Connects distributed workers across VPS nodes into a single collective intelligence
    - Uses Redis Pub/Sub for sub-millisecond event broadcasting (secrets, tokens, bypass headers)
    - Manages global state synchronization in Redis Distributed Hash Table
    """

    def __init__(self, node_id: str, redis_url: Optional[str] = None):
        self.node_id = node_id
        self.redis_url = redis_url or os.environ.get("REDIS_URL", "redis://localhost:6379/0")
        self.redis_client = None
        self.pubsub = None
        self.listeners: List[Callable[[Dict[str, Any]], None]] = []
        self.is_running = False

    async def connect(self) -> bool:
        if not HAS_REDIS_ASYNC:
            logger.warning("redis.asyncio package unavailable. HiveMind running in local-only mode.")
            return False

        try:
            self.redis_client = aioredis.from_url(self.redis_url, decode_responses=True)
            await self.redis_client.ping()
            logger.info(f"HiveMind Node [{self.node_id}] connected to Redis cluster at {self.redis_url}")
            return True
        except Exception as e:
            logger.warning(f"HiveMind Node [{self.node_id}] connection failed: {e}")
            self.redis_client = None
            return False

    async def broadcast_event(self, event_type: str, payload: Dict[str, Any]):
        """Publish real-time event to all nodes in the swarm."""
        event_data = {
            "node_id": self.node_id,
            "event_type": event_type,
            "payload": payload,
        }

        # Store in Distributed Shared Memory (DSM) Hash
        if self.redis_client:
            try:
                mem_field = f"{event_type}:{payload.get('key', 'generic')}"
                await self.redis_client.hset(HIVE_MIND_MEM_KEY, mem_field, json.dumps(payload))
                await self.redis_client.publish(HIVE_MIND_CHANNEL, json.dumps(event_data))
            except Exception as e:
                logger.error(f"Error broadcasting HiveMind event: {e}")

    def add_event_listener(self, callback: Callable[[Dict[str, Any]], None]):
        """Register callback for incoming hive events from other workers."""
        self.listeners.append(callback)

    async def start_listening(self):
        """Listen continuously for swarm intelligence events."""
        if not self.redis_client:
            return

        try:
            self.pubsub = self.redis_client.pubsub()
            await self.pubsub.subscribe(HIVE_MIND_CHANNEL)
            self.is_running = True

            while self.is_running:
                message = await self.pubsub.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if message and message.get("type") == "message":
                    try:
                        data = json.loads(message["data"])
                        # Don't re-process self-published events
                        if data.get("node_id") != self.node_id:
                            for cb in self.listeners:
                                if asyncio.iscoroutinefunction(cb):
                                    await cb(data)
                                else:
                                    cb(data)
                    except Exception as parse_err:
                        logger.error(f"Failed parsing HiveMind message: {parse_err}")
                await asyncio.sleep(0.01)
        except Exception as e:
            logger.error(f"HiveMind listening loop stopped: {e}")
            self.is_running = False

    async def get_shared_memory(self, pattern: str = "*") -> Dict[str, Any]:
        """Query global Distributed Shared Memory."""
        if not self.redis_client:
            return {}

        try:
            raw_data = await self.redis_client.hgetall(HIVE_MIND_MEM_KEY)
            parsed: Dict[str, Any] = {}
            for k, v in raw_data.items():
                try:
                    parsed[k] = json.loads(v)
                except Exception:
                    parsed[k] = v
            return parsed
        except Exception as e:
            logger.error(f"Error fetching HiveMind shared memory: {e}")
            return {}

    async def close(self):
        self.is_running = False
        if self.pubsub:
            await self.pubsub.unsubscribe(HIVE_MIND_CHANNEL)
        if self.redis_client:
            await self.redis_client.close()
