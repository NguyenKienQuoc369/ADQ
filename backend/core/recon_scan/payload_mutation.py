from typing import Any, Dict, List, Optional, Union
import urllib.parse
from typing import Any, Dict, List, Optional


class ContextAwarePayloadMutator:
    """
    Context-Aware Test Case Mutation Engine
    - Analyzes response context (HTML attribute, JS string, JSON key, SQL query)
    - Mutates base payloads dynamically based on WAF or filter feedback
    - Generates multi-encoding & polyglot bypass payloads
    """

    @staticmethod
    def url_encode_all(text: str) -> str:
        """URL encode every character in string."""
        return "".join(f"%{ord(c):02X}" for c in text)

    @staticmethod
    def html_entity_encode(text: str) -> str:
        """HTML entity encode string."""
        return "".join(f"&#{ord(c)};" for c in text)

    @staticmethod
    def unicode_escape_encode(text: str) -> str:
        """Unicode escape encode string."""
        return "".join(f"\\u{ord(c):04x}" for c in text)

    def mutate_payload(self, base_payload: str, context: str = "generic") -> List[Dict[str, str]]:
        """
        Generate mutated payload variants based on execution context.
        Contexts: html_attr, js_string, json_body, sql_query, command_exec
        """
        mutations: List[Dict[str, str]] = [
            {"type": "raw", "payload": base_payload}
        ]

        # 1. URL Encoding Mutations
        mutations.append({
            "type": "url_encode",
            "payload": urllib.parse.quote(base_payload),
        })
        mutations.append({
            "type": "double_url_encode",
            "payload": urllib.parse.quote(urllib.parse.quote(base_payload)),
        })

        # 2. Context-Specific Mutations
        ctx = context.lower()
        if ctx == "html_attr":
            mutations.append({
                "type": "html_attr_escape_break",
                "payload": f'"><script>{base_payload}</script><"',
            })
            mutations.append({
                "type": "html_entity",
                "payload": self.html_entity_encode(base_payload),
            })
        elif ctx == "js_string":
            mutations.append({
                "type": "js_string_breakout",
                "payload": f"'-{base_payload}-'",
            })
            mutations.append({
                "type": "unicode_escape",
                "payload": self.unicode_escape_encode(base_payload),
            })
        elif ctx == "sql_query":
            mutations.append({
                "type": "sql_inline_comment_bypass",
                "payload": base_payload.replace(" ", "/**/"),
            })
            mutations.append({
                "type": "sql_case_variation",
                "payload": base_payload.replace("UNION", "uNiOn").replace("SELECT", "sElEcT"),
            })
        elif ctx == "command_exec":
            mutations.append({
                "type": "cmd_delimiter_pipe",
                "payload": f"| {base_payload}",
            })
            mutations.append({
                "type": "cmd_subshell",
                "payload": f"$({base_payload})",
            })

        return mutations
