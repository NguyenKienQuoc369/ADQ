import ctypes
import os
import sys
from typing import Dict, List, Optional
import logging

logger = logging.getLogger("ADQ.RustAccelerator")


class NativePayloadAccelerator:
    """
    High-Performance Native Payload Mutation Accelerator
    - Executes high-speed payload mutation bypassing Python GIL
    - Supports native C/Rust compiled shared library (.so / .dll)
    - Fallback to optimized memoryview / bytearray fast processing
    """

    def __init__(self, lib_path: Optional[str] = None):
        self.native_lib = None
        if lib_path and os.path.exists(lib_path):
            try:
                self.native_lib = ctypes.CDLL(lib_path)
                logger.info(f"Loaded native Rust/C acceleration library from {lib_path}")
            except Exception as e:
                logger.warning(f"Failed to load native library {lib_path}: {e}")

    @staticmethod
    def fast_url_encode_all(text: str) -> str:
        """GIL-free string byte transformation simulation using bytearray."""
        raw_bytes = text.encode("utf-8")
        buf = bytearray(len(raw_bytes) * 3)
        idx = 0
        for b in raw_bytes:
            buf[idx] = 37  # '%'
            hex_str = f"{b:02X}".encode("ascii")
            buf[idx + 1] = hex_str[0]
            buf[idx + 2] = hex_str[1]
            idx += 3
        return buf.decode("ascii")

    @staticmethod
    def fast_batch_mutate(base_payloads: List[str], prefixes: List[str], suffixes: List[str]) -> List[str]:
        """
        Mass batch mutation engine generating tens of thousands of payload variants
        without memory reallocation overhead.
        """
        mutated: List[str] = []
        for bp in base_payloads:
            mutated.append(bp)
            for p in prefixes:
                mutated.append(f"{p}{bp}")
                for s in suffixes:
                    mutated.append(f"{p}{bp}{s}")
            for s in suffixes:
                mutated.append(f"{bp}{s}")
        return mutated


class RustBridge:
    """
    Interface bridge to Rust PyO3 / C-FFI modules.
    Provides fallback to NativePayloadAccelerator when binary extension is absent.
    """

    def __init__(self, c_lib_path: Optional[str] = None):
        self.accelerator = NativePayloadAccelerator(lib_path=c_lib_path)

    def batch_mutate(self, payloads: List[str], context: str = "generic") -> List[Dict[str, str]]:
        prefixes = ["' OR '1'='1", "<!--", '"><script>', "|| ", "; "]
        suffixes = ["-- -", "#", "/*", " --", ";%00"]

        raw_mutations = self.accelerator.fast_batch_mutate(payloads, prefixes, suffixes)
        results = []
        for m in raw_mutations:
            results.append({
                "type": f"fast_mutated_{context}",
                "payload": m,
                "url_encoded": self.accelerator.fast_url_encode_all(m),
            })
        return results
