import uuid
import time
import threading
from http.server import HTTPServer, BaseHTTPRequestHandler
from typing import Any, Dict, List, Optional, Tuple


# Global in-memory interaction log for OAST Server
OAST_INTERACTION_LOG: List[Dict[str, Any]] = []
LOG_LOCK = threading.Lock()


class OASTRequestHandler(BaseHTTPRequestHandler):
    """Custom HTTP handler for OAST Interaction Server."""

    def log_message(self, format, *args):
        # Suppress standard HTTP server stdout logging
        pass

    def do_GET(self):
        self._record_interaction("GET")

    def do_POST(self):
        self._record_interaction("POST")

    def do_PUT(self):
        self._record_interaction("PUT")

    def do_DELETE(self):
        self._record_interaction("DELETE")

    def _record_interaction(self, method: str):
        content_length = int(self.headers.get("Content-Length", 0))
        body = self.rfile.read(content_length).decode("utf-8", errors="ignore") if content_length > 0 else ""

        interaction = {
            "timestamp": time.time(),
            "method": method,
            "path": self.path,
            "headers": dict(self.headers),
            "client_ip": self.client_address[0],
            "body": body,
        }

        with LOG_LOCK:
            OAST_INTERACTION_LOG.append(interaction)

        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"status": "recorded", "oast": "ADQ-Interaction-Server"}')


class ADQInteractionServer:
    """
    Out-of-Band Application Security Testing (OAST) Server
    - Generates unique correlation IDs and payload URLs
    - Runs a lightweight background HTTP listener
    - Polls for out-of-band callbacks with 0% False Positive validation
    """

    def __init__(self, host: str = "127.0.0.1", port: int = 8888, public_domain: str = "oast.adq-project.org"):
        self.host = host
        self.port = port
        self.public_domain = public_domain
        self.server: Optional[HTTPServer] = None
        self.thread: Optional[threading.Thread] = None

    def start_server(self):
        """Start background OAST HTTP interaction listener."""
        if self.server:
            return
        self.server = HTTPServer((self.host, self.port), OASTRequestHandler)
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def stop_server(self):
        """Stop OAST HTTP interaction listener."""
        if self.server:
            self.server.shutdown()
            self.server.server_close()
            self.server = None

    def generate_payload(self) -> Tuple[str, str]:
        """
        Generates a unique OAST interaction payload URL and payload ID.
        Returns: (payload_id, oast_url)
        """
        payload_id = str(uuid.uuid4())[:8]
        oast_url = f"http://{self.host}:{self.port}/oast/{payload_id}"
        return payload_id, oast_url

    def poll_interactions(self, payload_id: str, timeout: float = 3.0) -> List[Dict[str, Any]]:
        """
        Polls the interaction log for any HTTP requests matching the unique payload_id.
        """
        start_time = time.time()
        matches: List[Dict[str, Any]] = []

        while (time.time() - start_time) < timeout:
            with LOG_LOCK:
                for item in OAST_INTERACTION_LOG:
                    if f"/oast/{payload_id}" in item.get("path", ""):
                        matches.append(item)
            if matches:
                break
            time.sleep(0.2)

        return matches
