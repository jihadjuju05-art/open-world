# usage: pp_dl.py <bundle-url> <outdir>   -- downloads all GLBs of a poly.pizza bundle (CC0 Quaternius etc.)
import re, sys, os, urllib.request
def get(u): return urllib.request.urlopen(urllib.request.Request(u, headers={'User-Agent': 'Mozilla/5.0'}), timeout=60).read()
url, out = sys.argv[1], sys.argv[2]; os.makedirs(out, exist_ok=True)
h = get(url).decode('utf8', 'ignore'); ids = sorted(set(re.findall(r'/m/([A-Za-z0-9_-]{10})[^A-Za-z0-9_-]', h)))
for i in ids:
    p = get('https://poly.pizza/m/' + i).decode('utf8', 'ignore')
    t = re.search(r'<title>([^<|]*)', p); name = re.sub(r'[^A-Za-z0-9]+', '_', (t.group(1) if t else i).strip()).strip('_')
    g = re.search(r'static\.poly\.pizza/([0-9a-f-]{36})\.glb', p)
    if not g: print('no glb', i, name); continue
    d = get('https://static.poly.pizza/' + g.group(1) + '.glb'); open(os.path.join(out, name + '.glb'), 'wb').write(d); print(name, len(d))
