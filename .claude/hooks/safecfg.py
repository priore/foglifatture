#!/usr/bin/env python3
# Unico modo autorizzato per leggere file con segreti (.env, config.json, chiavi): 1 file = mostra, 2 file = diff unificato.
# I valori sensibili diventano ***#xxxx (4 hex dello sha256): si vede se due valori differiscono, non il valore.
import difflib, hashlib, re, sys

SENS = re.compile(r"token|pass|pwd|secret|key|client|bearer|auth|credential|private|iban|cf|piva", re.I)
BLOB = re.compile(r"[A-Za-z0-9_\-.=+/]{24,}")
ENV_LINE = re.compile(r"^(\s*(?:export\s+)?)([A-Za-z_][A-Za-z0-9_.]*)(\s*=\s*)(.*)$")
JSON_LINE = re.compile(r'^(\s*"([^"]+)"\s*:\s*)(".*?"|[^,\s][^,]*)(,?\s*)$')
SETTING_NAME = re.compile(r'<(?:setting|add)\s+(?:name|key)="([^"]+)"', re.I)
VALUE_TEXT = re.compile(r"(<value[^>]*>)([^<]+)", re.I)
XML_ATTR = re.compile(r'((?:value|connectionString|password|pwd|secret|token|apiKey)=")([^"]+)', re.I)
PEM_BEGIN = re.compile(r"-----BEGIN [A-Z ]*(PRIVATE KEY|CERTIFICATE)-----")
PEM_END = re.compile(r"-----END [A-Z ]*(PRIVATE KEY|CERTIFICATE)-----")

def tag(v):
    return "***#" + hashlib.sha256(v.encode()).hexdigest()[:4]

def mask(line, sensitive_setting=False):
    if sensitive_setting or (("<" in line) and SENS.search(line)):
        line = VALUE_TEXT.sub(lambda m: m.group(1) + tag(m.group(2)), line)
        line = XML_ATTR.sub(lambda m: m.group(1) + tag(m.group(2)), line)
    m = ENV_LINE.match(line)
    if m and SENS.search(m.group(2)):
        return m.group(1) + m.group(2) + m.group(3) + tag(m.group(4))
    m = JSON_LINE.match(line)
    if m and SENS.search(m.group(2)) and not m.group(3).strip('"') in ("", "true", "false", "null") and not m.group(3).lstrip("-").isdigit():
        return m.group(1) + '"' + tag(m.group(3)) + '"' + m.group(4)
    return BLOB.sub(lambda b: tag(b.group(0)), line)

def load(path):
    out, in_pem, sensitive = [], False, False
    with open(path, encoding="utf-8-sig", errors="replace") as f:
        for raw in f:
            line = raw.rstrip("\r\n")
            if PEM_BEGIN.search(line):
                in_pem = True
                out.append(line)
            elif PEM_END.search(line):
                in_pem = False
                out.append(line)
            else:
                m = SETTING_NAME.search(line)
                if m:
                    sensitive = bool(SENS.search(m.group(1)))  # si valuta il nome prima del mascheramento
                out.append(tag(line) if in_pem else mask(line, sensitive))
                if re.search(r"</setting>|/>\s*$", line, re.I):
                    sensitive = False
    return out

if len(sys.argv) == 2:
    print("\n".join(load(sys.argv[1])))
elif len(sys.argv) == 3:
    print("\n".join(difflib.unified_diff(load(sys.argv[1]), load(sys.argv[2]), "a", "b", lineterm="", n=1)))
else:
    sys.exit("uso: safecfg.py FILE | safecfg.py FILE_A FILE_B")
