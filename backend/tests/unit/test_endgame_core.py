import asyncio
import os
from core.rust_accelerator import NativePayloadAccelerator, RustBridge
from core.raw_socket_prober import RawSocketProber
from core.hive_mind import HiveMindNode


def test_native_payload_accelerator():
    accelerator = NativePayloadAccelerator()
    encoded = accelerator.fast_url_encode_all("<script>alert(1)</script>")
    assert "%3C" in encoded
    assert "%3E" in encoded

    bridge = RustBridge()
    mutations = bridge.batch_mutate(["' OR 1=1"], context="sql")
    assert len(mutations) > 0
    assert "payload" in mutations[0]


def test_raw_socket_prober():
    async def _run():
        prober = RawSocketProber(timeout=0.5)
        # Test fallback / probe execution against localhost
        res = await prober.probe_port_raw("127.0.0.1", 80)
        assert "target_ip" in res
        assert "is_open" in res

    asyncio.run(_run())


def test_hive_mind_node():
    async def _run():
        node = HiveMindNode(node_id="worker-test-1")
        connected = await node.connect()
        # Should gracefully handle local or redis connection
        await node.broadcast_event("secret_discovered", {"key": "jwt", "val": "eyJhbG..."})
        shared = await node.get_shared_memory()
        assert isinstance(shared, dict)
        await node.close()

    asyncio.run(_run())
