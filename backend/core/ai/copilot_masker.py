import re
from typing import Any, Dict, List, Union


class SensitiveDataMasker:
    """
    SecOps & Privacy View - Sensitive Data Masking Filter
    - Enforces zero-leakage policies before transmitting scan logs / findings to Google Gemini LLM API
    - Redacts AWS Keys, Passwords, JWT Bearer Tokens, Database Connection Strings, Private Keys
    - Retains structural context so Copilot understands vulnerability types without exposing raw secrets
    """

    PATTERNS: Dict[str, str] = {
        "AWS Access Key": r"AKIA[0-9A-Z]{16}",
        "Postgres / MySQL Connection String": r"(postgres(?:ql)?|mysql)://[^\s:]+:[^\s]+@[a-zA-Z0-9.-]+:\d+/[a-zA-Z0-9_-]+",
        "JWT Bearer Token": r"eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+",
        "Generic Password Field": r"(?i)(?:password|passwd|pwd|pass|secret_key|api_key)[\s]*[=:]\s*['\"]([^'\"]{8,})['\"]",
        "Supabase Key": r"sb_[a-zA-Z0-9_-]{20,}",
        "Stripe Secret Key": r"sk_live_[0-9a-zA-Z]{24}",
        "Private Key Header": r"-----BEGIN (?:RSA |EC )?PRIVATE KEY-----[\s\S]+?-----END (?:RSA |EC )?PRIVATE KEY-----",
    }

    def __init__(self):
        self.compiled_patterns = {
            name: re.compile(pat) for name, pat in self.PATTERNS.items()
        }

    def mask_text(self, text: str) -> str:
        """Applies regex redaction rules to arbitrary text string."""
        if not text:
            return text

        masked = text
        masked = self.compiled_patterns["AWS Access Key"].sub("[REDACTED_AWS_KEY]", masked)
        masked = self.compiled_patterns["Postgres / MySQL Connection String"].sub("[REDACTED_DB_CONNECTION_STRING]", masked)
        masked = self.compiled_patterns["JWT Bearer Token"].sub("[REDACTED_JWT_TOKEN]", masked)
        masked = self.compiled_patterns["Supabase Key"].sub("[REDACTED_SUPABASE_KEY]", masked)
        masked = self.compiled_patterns["Stripe Secret Key"].sub("[REDACTED_STRIPE_KEY]", masked)
        masked = self.compiled_patterns["Private Key Header"].sub("[REDACTED_PRIVATE_KEY]", masked)

        # Mask generic password key=value pairs
        def _pwd_replacer(match: re.Match) -> str:
            full_match = match.group(0)
            secret_val = match.group(1) if match.lastindex and match.lastindex >= 1 else ""
            if secret_val:
                return full_match.replace(secret_val, "[REDACTED_SECRET]")
            return full_match

        masked = self.compiled_patterns["Generic Password Field"].sub(_pwd_replacer, masked)
        return masked

    def mask_dict_or_list(self, data: Union[Dict[str, Any], List[Any], str]) -> Union[Dict[str, Any], List[Any], str]:
        """Recursively traverses dictionary or list to redact sensitive key values."""
        if isinstance(data, str):
            return self.mask_text(data)

        if isinstance(data, list):
            return [self.mask_dict_or_list(item) for item in data]

        if isinstance(data, dict):
            masked_dict = {}
            for k, v in data.items():
                if any(sens_k in k.lower() for sens_k in ["password", "token", "secret", "authorization", "api_key"]):
                    if isinstance(v, str):
                        masked_dict[k] = f"[REDACTED_{k.upper()}]"
                    else:
                        masked_dict[k] = self.mask_dict_or_list(v)
                else:
                    masked_dict[k] = self.mask_dict_or_list(v)
            return masked_dict

        return data
