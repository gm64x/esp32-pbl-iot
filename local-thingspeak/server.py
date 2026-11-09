"""Servidor local compatível com a API de atualização do ThingSpeak.

Endpoints:
  GET /update?api_key=KEY&field1=..&field2=..   grava uma leitura e responde o número da entrada (0 = recusada)
  GET /feeds.json?results=N                      últimas N leituras (padrão 100)
  GET /                                          página HTML com as últimas leituras (atualiza sozinha)

Configuração por variáveis de ambiente:
  LOCAL_API_KEY        chave exigida em /update (obrigatória)
  RATE_LIMIT_SECONDS   intervalo mínimo entre gravações (padrão 0; o ThingSpeak gratuito usa 15)
  DATA_FILE            arquivo JSON de dados (padrão /data/feeds.json)
  PORT                 porta de escuta dentro do container (padrão 8000)
"""

import hmac
import html
import json
import os
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

API_KEY = os.environ.get("LOCAL_API_KEY", "")
RATE_LIMIT = float(os.environ.get("RATE_LIMIT_SECONDS", "0"))
DATA_FILE = os.environ.get("DATA_FILE", "/data/feeds.json")
PORT = int(os.environ.get("PORT", "8000"))
FIELDS = [f"field{i}" for i in range(1, 9)]

LOCK = threading.Lock()


def load_channel():
    try:
        with open(DATA_FILE, encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {"channel": {"name": "Local PBL 02", "field1": "Valor aleatório"}, "feeds": []}


def save_channel(data):
    tmp = DATA_FILE + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    os.replace(tmp, DATA_FILE)


def write_entry(params):
    """Grava uma leitura. Retorna o entry_id, ou 0 se recusada."""
    supplied = params.get("api_key", [""])[0]
    if not API_KEY or not hmac.compare_digest(supplied, API_KEY):
        return 0

    values = {f: params[f][0] for f in FIELDS if f in params}
    if not values:
        return 0

    with LOCK:
        data = load_channel()
        feeds = data["feeds"]
        now = time.time()
        if feeds and RATE_LIMIT > 0:
            last = datetime.fromisoformat(feeds[-1]["created_at"]).timestamp()
            if now - last < RATE_LIMIT:
                return 0

        entry_id = (feeds[-1]["entry_id"] if feeds else 0) + 1
        feed = {
            "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
            "entry_id": entry_id,
        }
        feed.update(values)
        feeds.append(feed)
        save_channel(data)
        return entry_id


def render_index(limit=20):
    feeds = load_channel()["feeds"][-limit:][::-1]
    rows = "".join(
        "<tr><td>{}</td><td>{}</td><td>{}</td></tr>".format(
            f["entry_id"],
            html.escape(f["created_at"]),
            html.escape(" ".join(f"{k}={v}" for k, v in f.items() if k.startswith("field"))),
        )
        for f in feeds
    ) or '<tr><td colspan="3">Nenhuma leitura ainda.</td></tr>'
    return f"""<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta http-equiv="refresh" content="10">
<title>ThingSpeak local - PBL 02</title>
<style>
  body {{ font-family: system-ui, sans-serif; margin: 16px; }}
  table {{ border-collapse: collapse; width: 100%; max-width: 720px; }}
  th, td {{ border: 1px solid #ccc; padding: 6px 10px; text-align: left; }}
  th {{ background: #f2f2f2; }}
</style>
</head>
<body>
<h1>ThingSpeak local - PBL 02</h1>
<p>Últimas leituras (atualiza a cada 10 s).</p>
<table>
<thead><tr><th>Entrada</th><th>Data (UTC)</th><th>Campos</th></tr></thead>
<tbody>{rows}</tbody>
</table>
</body>
</html>
"""


class Handler(BaseHTTPRequestHandler):
    def _send(self, status, body, content_type):
        payload = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.end_headers()
        self.wfile.write(payload)

    def do_GET(self):
        url = urlparse(self.path)
        params = parse_qs(url.query)

        if url.path == "/update":
            self._send(200, str(write_entry(params)), "text/plain; charset=utf-8")
        elif url.path == "/feeds.json":
            try:
                results = max(1, min(int(params.get("results", ["100"])[0]), 8000))
            except ValueError:
                results = 100
            with LOCK:
                data = load_channel()
            data["feeds"] = data["feeds"][-results:]
            self._send(200, json.dumps(data, ensure_ascii=False, indent=2), "application/json; charset=utf-8")
        elif url.path == "/":
            with LOCK:
                page = render_index()
            self._send(200, page, "text/html; charset=utf-8")
        else:
            self._send(404, "Not found", "text/plain; charset=utf-8")

    def log_message(self, fmt, *args):
        print(f"{self.address_string()} {fmt % args}", flush=True)


if __name__ == "__main__":
    if not API_KEY:
        raise SystemExit("Defina a variável LOCAL_API_KEY antes de iniciar o servidor.")
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"ThingSpeak local em http://0.0.0.0:{PORT} (RATE_LIMIT_SECONDS={RATE_LIMIT:g})", flush=True)
    server.serve_forever()
