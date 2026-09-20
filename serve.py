"""Local dev server for the open-world project + Studio.

Serves the project folder and lets the Studio save JSON files straight into it:
  POST /api/save?path=anims/walk.json     (only anims/*.json and config/*.json are writable)
  GET  /api/ping
Bound to 127.0.0.1 only. Usage: python serve.py [port]
"""
import http.server, json, os, re, sys, urllib.parse

ROOT = os.path.dirname(os.path.abspath(__file__))
ALLOWED = re.compile(r'(anims|config)/[A-Za-z0-9_\-]+\.json')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k):
        super().__init__(*a, directory=ROOT, **k)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def _json(self, code, obj):
        body = json.dumps(obj).encode()
        self.send_response(code)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path.split('?')[0] == '/api/ping':
            return self._json(200, {'ok': True, 'root': os.path.basename(ROOT)})
        return super().do_GET()

    def do_POST(self):
        url = urllib.parse.urlparse(self.path)
        if url.path != '/api/save':
            return self._json(404, {'ok': False, 'error': 'not found'})
        rel = urllib.parse.parse_qs(url.query).get('path', [''])[0]
        n = int(self.headers.get('Content-Length', 0))
        if not ALLOWED.fullmatch(rel) or n <= 0 or n > 4_000_000:
            return self._json(400, {'ok': False, 'error': 'path/size not allowed'})
        raw = self.rfile.read(n)
        try:
            data = json.loads(raw)
        except ValueError:
            return self._json(400, {'ok': False, 'error': 'invalid json'})
        full = os.path.join(ROOT, *rel.split('/'))
        with open(full, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=1)
        if rel.startswith('anims/') and rel != 'anims/index.json':          # keep the clip index in sync
            idx_path = os.path.join(ROOT, 'anims', 'index.json')
            try:
                idx = json.load(open(idx_path, encoding='utf-8'))
            except (OSError, ValueError):
                idx = []
            name = rel.split('/')[1]
            if name not in idx:
                idx.append(name)
                json.dump(idx, open(idx_path, 'w', encoding='utf-8'), indent=1)
        return self._json(200, {'ok': True, 'path': rel})

    def log_message(self, *a):
        pass


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8766
    http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler).serve_forever()
