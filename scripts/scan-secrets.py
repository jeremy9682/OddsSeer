"""Report paths/line numbers only; never print potential secret values."""
from pathlib import Path
import re
import json
import sys

root = Path(sys.argv[1])
skip = {".git", "node_modules", ".wxt"}
rules = {
    "private-key-block": re.compile(r"-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----"),
    "wallet-private-key-literal": re.compile(
        r"""(?i)(?:private.?key|secret.?key)\s*[:=]\s*['"](?:0x)?[0-9a-f]{64}['"]"""
    ),
    "service-key": re.compile(r"\b(?:sk-(?:proj-|or-v1-)?[A-Za-z0-9_-]{24,}|gh[pousr]_[A-Za-z0-9]{30,}|AKIA[A-Z0-9]{16})\b"),
    "credential-url": re.compile(r"""(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis)://[^:\s/]+:[^@\s]+@"""),
}
findings = []
count = 0
for path in root.rglob("*"):
    if not path.is_file() or any(p in skip for p in path.relative_to(root).parts):
        continue
    rel = str(path.relative_to(root))
    if path.name.startswith(".env") and path.name not in {".env.example", ".env.sample"}:
        findings.append({"path": rel, "rule": "runtime-env-file"})
    try:
        value = path.read_text(encoding="utf-8")
    except (UnicodeError, OSError):
        continue
    count += 1
    for number, line in enumerate(value.splitlines(), 1):
        for rule, regex in rules.items():
            if regex.search(line):
                findings.append({"path": rel, "line": number, "rule": rule})
print(json.dumps({"root": str(root), "text_files_scanned": count, "findings": findings}, indent=2))
sys.exit(bool(findings))
