"""Copies the voice files you generated (01.mp3 ... 21.mp3, from a folder) into assets/voice/<id>.mp3 and rebuilds assets/voice/index.json.
usage: python tools/voices_install.py [folder]     (default: your Downloads folder)"""
import json, os, re, shutil, sys
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = json.load(open(os.path.join(root, 'tools', 'voices.json'), encoding='utf-8'))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.expanduser('~'), 'Downloads')
out = os.path.join(root, 'assets', 'voice'); os.makedirs(out, exist_ok=True)
have = set(f[:-4] for f in os.listdir(out) if f.endswith('.mp3'))
for f in os.listdir(src):
    m = re.match(r'^0*(\d{1,2})(?:\D.*)?\.(mp3|wav|m4a)$', f, re.I)
    if not m: continue
    n = int(m.group(1)); v = next((x for x in V if x['n'] == n), None)
    if not v: continue
    if f.lower().endswith('.mp3'): shutil.copy(os.path.join(src, f), os.path.join(out, v['id'] + '.mp3')); have.add(v['id']); print('ok', f, '->', v['id'] + '.mp3')
    else: print('SKIP (needs mp3):', f)
json.dump(sorted(have), open(os.path.join(out, 'index.json'), 'w'))
print(len(have), 'voices installed of', len(V))
