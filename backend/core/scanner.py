import shlex
import subprocess
import time
from dataclasses import dataclass
from typing import Dict, List, Optional, Union

from config import config


@dataclass
class ToolResult:
    name: str
    command: List[str]
    stdout: str
    stderr: str
    returncode: int
    duration_seconds: float

    def to_dict(self) -> Dict[str, Union[str, int, float, List[str]]]:
        return {
            "name": self.name,
            "command": self.command,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "returncode": self.returncode,
            "duration_seconds": self.duration_seconds,
        }


def run_command(
    name: str,
    args: List[str],
    timeout: int = None,
    retries: int = 0,
    backoff: float = 2.0,
    input_text: Optional[str] = None,
    input_file: Optional[str] = None,
) -> ToolResult:
    timeout = timeout or config.DEFAULT_TIMEOUT
    attempt = 0
    stdout_lines: List[str] = []
    stderr_lines: List[str] = []
    start_time = time.time()

    while True:
        attempt += 1
        stdin_handle = None
        try:
            if input_file:
                stdin_handle = open(input_file, "r")
            process = subprocess.Popen(
                args,
                stdin=subprocess.PIPE if input_text is not None else stdin_handle,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )

            if input_text is not None and process.stdin:
                process.stdin.write(input_text)
                process.stdin.close()

            out, err = process.communicate(timeout=timeout)
            stdout_lines.extend(out.splitlines())
            stderr_lines.extend(err.splitlines())

            if process.returncode == 0 or attempt > retries:
                break

            time.sleep(backoff * attempt)
        finally:
            if stdin_handle:
                stdin_handle.close()

    duration = time.time() - start_time
    return ToolResult(
        name=name,
        command=args,
        stdout="\n".join(stdout_lines),
        stderr="\n".join(stderr_lines),
        returncode=process.returncode,
        duration_seconds=round(duration, 2),
    )


def run_subfinder(target: str) -> ToolResult:
    args = ["subfinder", "-d", target, "-silent"]
    return run_command("Subfinder", args)


def run_httpx(targets: List[str], scan_type: str = "httpx-toolkit", json_mode: bool = True, input_text: Optional[str] = None) -> ToolResult:
    args = [scan_type, "-l", "-", "-silent", "-mc", "200,301,302,403"]
    if json_mode:
        args.append("-json")
    return run_command("HTTPX", args, input_text=input_text)


def run_nuclei(targets: List[str], tags: Optional[List[str]] = None, json_mode: bool = True, input_text: Optional[str] = None) -> ToolResult:
    args = ["nuclei", "-l", "-", "-silent"]
    if json_mode:
        args.append("-json")
    if tags:
        args += ["-tags", ",".join(tags)]
    return run_command("Nuclei", args, input_text=input_text)


def run_ffuf(url: str, wordlist: Optional[str] = None, json_mode: bool = True, input_text: Optional[str] = None) -> ToolResult:
    args = ["ffuf", "-u", f"{url}/FUZZ", "-w", wordlist or config.WORDLIST_PATH, "-mc", "200"]
    if json_mode:
        args += ["-of", "json"]
    return run_command("FFuf", args, input_text=input_text)


def collect_tool_result(tool_result: ToolResult) -> Dict[str, object]:
    return {
        "tool": tool_result.name,
        "command": tool_result.command,
        "stdout": tool_result.stdout,
        "stderr": tool_result.stderr,
        "returncode": tool_result.returncode,
        "duration_seconds": tool_result.duration_seconds,
    }
