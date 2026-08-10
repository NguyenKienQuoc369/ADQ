import asyncio
import os
import socket
import struct
import time
import logging
from typing import Dict, List, Optional, Tuple

logger = logging.getLogger("ADQ.RawSocketProber")


class RawSocketProber:
    """
    Kernel Bypass Raw Socket TCP SYN Prober
    - Assembles raw IPv4 + TCP SYN packets at the byte level
    - Sends SYN frames bypassing standard OS connect() handshake overhead
    - Inspects TCP Flags (SYN-ACK: 0x12, RST: 0x14) for high-speed port probing
    - Gracefully falls back to standard async socket if CAP_NET_RAW is not granted
    """

    def __init__(self, interface: str = "eth0", timeout: float = 2.0):
        self.interface = interface
        self.timeout = timeout
        self.is_raw_capable = os.geteuid() == 0 if hasattr(os, "geteuid") else False

    @staticmethod
    def _checksum(msg: bytes) -> int:
        """Calculate Internet Checksum (RFC 1071)."""
        s = 0
        for i in range(0, len(msg) - 1, 2):
            w = (msg[i] << 8) + (msg[i + 1])
            s += w
        if len(msg) % 2 == 1:
            s += msg[-1] << 8
        s = (s >> 16) + (s & 0xFFFF)
        s += s >> 16
        s = ~s & 0xFFFF
        return s

    def _create_tcp_syn_packet(self, src_ip: str, dst_ip: str, src_port: int, dst_port: int) -> bytes:
        """Assemble Raw TCP SYN Packet with Pseudo Header Checksum."""
        # TCP Header Fields
        seq = 1000
        ack_seq = 0
        doff = 5  # 5 * 4 = 20 bytes header length
        flags = 0x02  # SYN flag
        window = socket.htons(5840)
        check = 0
        urg_ptr = 0

        offset_res = (doff << 4) + 0
        tcp_header_no_check = struct.pack(
            "!HHLLBBHHH",
            src_port,
            dst_port,
            seq,
            ack_seq,
            offset_res,
            flags,
            window,
            check,
            urg_ptr,
        )

        # Pseudo Header for TCP Checksum calculation
        src_addr = socket.inet_aton(src_ip)
        dst_addr = socket.inet_aton(dst_ip)
        placeholder = 0
        protocol = socket.IPPROTO_TCP
        tcp_length = len(tcp_header_no_check)

        psh = struct.pack("!4s4sBBH", src_addr, dst_addr, placeholder, protocol, tcp_length)
        psh_tcp = psh + tcp_header_no_check

        tcp_checksum = self._checksum(psh_tcp)

        # Final TCP Header with calculated Checksum
        tcp_header = struct.pack(
            "!HHLLBBH",
            src_port,
            dst_port,
            seq,
            ack_seq,
            offset_res,
            flags,
            window,
        ) + struct.pack("H", tcp_checksum) + struct.pack("!H", urg_ptr)

        return tcp_header

    async def probe_port_raw(self, target_ip: str, port: int, src_ip: str = "127.0.0.1") -> Dict[str, Any]:
        """
        Probe single target port using Raw Socket SYN packet.
        Falls back to async socket if root privilege is unavailable.
        """
        if not self.is_raw_capable:
            return await self._fallback_probe(target_ip, port)

        try:
            # Create Raw Socket (IPPROTO_TCP)
            s = socket.socket(socket.AF_INET, socket.SOCK_RAW, socket.IPPROTO_TCP)
            s.settimeout(self.timeout)

            src_port = 54321
            packet = self._create_tcp_syn_packet(src_ip, target_ip, src_port, port)
            
            s.sendto(packet, (target_ip, port))
            
            # Listen for SYN-ACK response
            start_time = time.time()
            is_open = False
            while time.time() - start_time < self.timeout:
                try:
                    data, addr = s.recvfrom(1024)
                    if addr[0] == target_ip:
                        # Extract TCP Flags from IP payload (IP header length typically 20 bytes)
                        ip_header_len = (data[0] & 0x0F) * 4
                        tcp_header = data[ip_header_len:ip_header_len + 20]
                        if len(tcp_header) >= 14:
                            flags = tcp_header[13]
                            if flags & 0x12 == 0x12:  # SYN-ACK
                                is_open = True
                                break
                            elif flags & 0x04 == 0x04:  # RST
                                is_open = False
                                break
                except socket.timeout:
                    break

            s.close()
            return {
                "target_ip": target_ip,
                "port": port,
                "is_open": is_open,
                "method": "RAW_SOCKET_SYN",
            }
        except PermissionError:
            self.is_raw_capable = False
            return await self._fallback_probe(target_ip, port)
        except Exception as e:
            return {
                "target_ip": target_ip,
                "port": port,
                "is_open": False,
                "error": str(e),
                "method": "RAW_SOCKET_SYN_FAILED",
            }

    async def _fallback_probe(self, target_ip: str, port: int) -> Dict[str, Any]:
        """Async TCP Connect fallback when root privileges are absent."""
        try:
            _, writer = await asyncio.wait_for(
                asyncio.open_connection(target_ip, port), timeout=self.timeout
            )
            writer.close()
            await writer.wait_closed()
            return {
                "target_ip": target_ip,
                "port": port,
                "is_open": True,
                "method": "ASYNC_CONNECT_FALLBACK",
            }
        except Exception:
            return {
                "target_ip": target_ip,
                "port": port,
                "is_open": False,
                "method": "ASYNC_CONNECT_FALLBACK",
            }
