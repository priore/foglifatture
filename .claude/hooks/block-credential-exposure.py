#!/usr/bin/env python3
# PreToolUse(Bash): impedisce ai comandi di stampare il contenuto di file con segreti (.env, config.json, chiavi, dati runtime)
# o di leggere segreti dal Keychain / dalle variabili d'ambiente. Unico lettore consentito: .claude/hooks/safecfg.py (valori mascherati).
# Nomi privati aggiuntivi (uno per riga, regex sul nome file): $FOGLIFATTURE_SECRET_FILES, default ~/.config/foglifatture/secret-files.
import json, os, re, shlex, sys

def block(msg):
    print("Bloccato: " + msg, file=sys.stderr)
    sys.exit(2)

SECRET_NAME = re.compile(r"^(\.env(\.(local|production|development))?|config\.json|[^/]*\.(pem|key|p8|p12|pfx|keystore|jks|mobileprovision)|social\.env|web\.config|app\.config|settings\.settings|appsettings[^/]*\.json)$", re.I)
SECRET_DIR = re.compile(r"(^|/)(backend/(data|logs)|\.config/(foglifatture|prioregroup))(/|$)")

def extra_names():
    path = os.environ.get("FOGLIFATTURE_SECRET_FILES") or os.path.expanduser("~/.config/foglifatture/secret-files")
    try:
        with open(path, encoding="utf-8") as f:
            return [re.compile(l.strip(), re.I) for l in f if l.strip() and not l.startswith("#")]
    except OSError:
        return []

EXTRA = extra_names()

def is_secret(token):
    t = token.strip("'\"").lstrip("<>")
    t = t.replace("${HOME}", "~").replace("$HOME", "~")
    if re.search(r"[\\|^$()*+?\[\]{}]", t.replace("*", "")):  # regex o espansioni: un pattern, non un percorso
        return False
    t = t.rstrip("/") if t.endswith("/") and not SECRET_DIR.search(t) else t
    name = t.rsplit("/", 1)[-1]
    return bool(SECRET_NAME.match(name) or SECRET_DIR.search(t) or any(r.search(name) for r in EXTRA))

SAFE_VERBS = {"ls", "stat", "test", "[", "[[", "rm", "chmod", "chown", "mkdir", "touch", "file", "wc", "du", "realpath", "dirname",
              "basename", "shasum", "sha256sum", "md5", "cd", "pwd", "which", "true", "false"}
GIT_SAFE = {"add", "commit", "rm", "mv", "ls-files", "check-ignore", "status", "rev-parse", "restore", "reset", "branch", "tag", "push", "pull", "fetch", "checkout", "stash"}
GIT_PRINTS = re.compile(r"(^|\s)(-p|--patch|-u|--cc|-c|-G\S*|-S\S*|-L\S*|--textconv)(\s|$)")
GIT_LISTS = re.compile(r"--(name-only|name-status|stat|numstat|shortstat|quiet|exit-code)|\s-q(\s|$)|\s-s(\s|$)")

cmd = json.load(sys.stdin).get("tool_input", {}).get("command", "")

if re.search(r"\bsecurity\s+(find|dump|export|delete)-\S+", cmd) and re.search(r"\s-[a-zA-Z]*[wg]\b|dump-keychain|export", cmd):
    block("lettura di segreti dal Keychain. Controlla solo l'esistenza (senza -w/-g) e non stampare il valore.")
if re.search(r"\bgh\s+auth\s+(token|status\b[^|;&]*(-t|--show-token))|\bgit\s+credential\b", cmd):
    block("stampa di token/credenziali. Non mostrarli: verifica solo che il comando di autenticazione riesca.")
if re.search(r"(^|[|;&]\s*)(printenv|env|export\s+-p|set)\s*($|[|;&])", cmd):
    block("dump delle variabili d'ambiente (possono contenere segreti). Leggi una variabile alla volta, solo se non sensibile.")

for seg in re.split(r"\|\||&&|[|;&\n]|\$\(|`|\)", cmd):
    seg = seg.strip()
    if not seg or "safecfg.py" in seg:
        continue
    try:
        toks = shlex.split(seg, posix=True)
    except ValueError:
        toks = seg.split()
    toks = [t for t in toks if not re.fullmatch(r"\w+=\S*", t)]  # assegnamenti di variabili in testa
    if not toks:
        continue
    secrets = [t for t in toks[1:] + ([toks[0]] if toks[0][:1] in "<>" else []) if is_secret(t)]
    if not secrets:
        continue
    verb = toks[0].rsplit("/", 1)[-1]
    if verb in SAFE_VERBS:
        continue
    if verb in ("echo", "printf"):
        redirected = any(t.lstrip("<>") and re.match(r">", prev) for prev, t in zip(toks, toks[1:]) if is_secret(t))
        if not redirected and not any(t.startswith(">") and is_secret(t) for t in toks):
            continue
    if verb == "git" and len(toks) > 1:
        sub = toks[1]
        if sub in GIT_SAFE:
            continue
        if sub in ("log", "diff", "show") and not GIT_PRINTS.search(seg) and (sub == "log" or GIT_LISTS.search(seg)):
            continue
    block("file con segreti o dati runtime. Per leggerli usa solo: python3 .claude/hooks/safecfg.py FILE [FILE_B] (valori sensibili mascherati). "
          "Per verificare che non siano tracciati: git ls-files | grep -E \"config\\.json|\\.env$|\\.key$|\\.pem$\".")
