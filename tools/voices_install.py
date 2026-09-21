"""Installs the voice files you generated into assets/voice/<id>.<ext> and rebuilds assets/voice/index.json.
Input files (in a folder, default: your Downloads):
  - NN.wav / NN.mp3  -> line NN of tools/voices.json
  - *_Lumina.wav     -> Lumina downloads, assigned in download order (oldest = line 1) unless a NN.* file exists for that line
usage: python tools/voices_install.py [folder] [--skip N,N]   (--skip: line numbers whose Lumina file you deleted / want to redo later)
"""
import json, os, re, shutil, sys, wave
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = json.load(open(os.path.join(root, 'tools', 'voices.json'), encoding='utf-8'))
args = [a for a in sys.argv[1:] if not a.startswith('--')]; src = args[0] if args else os.path.join(os.path.expanduser('~'), 'Downloads')
out = os.path.join(root, 'assets', 'voice'); os.makedirs(out, exist_ok=True)
idx_path = os.path.join(out, 'index.json')
try: idx = json.load(open(idx_path)); idx = {k: 'mp3' for k in idx} if isinstance(idx, list) else idx
except Exception: idx = {}
files = os.listdir(src); numbered, lumina = {}, []
for f in files:
    m = re.match(r'^0*(\d{1,2})(?:\D.*)?\.(mp3|wav)$', f, re.I)
    if m and not f.startswith('20'): numbered[int(m.group(1))] = f
    elif re.match(r'^\d{4}-\d\d-\d\d_\d\d-\d\d-\d\d_Lumina\.(wav|mp3)$', f): lumina.append(f)
lumina.sort()
skip = set()
for a in sys.argv[1:]:
    if a.startswith('--skip'): skip = {int(x) for x in a.split('=')[-1].split(',') if x}
plan = dict(numbered); free = [v['n'] for v in V if v['n'] not in numbered and v['n'] not in skip]
for f, n in zip(lumina, free): plan[n] = f
def dur(p):
    try: w = wave.open(p); return w.getnframes() / w.getframerate()
    except Exception: return None
for n in sorted(plan):
    v = V[n - 1]; f = plan[n]; ext = f.rsplit('.', 1)[1].lower(); shutil.copy(os.path.join(src, f), os.path.join(out, v['id'] + '.' + ext)); idx[v['id']] = ext
    d = dur(os.path.join(src, f)) if ext == 'wav' else None; exp = v['chars'] / 13.5
    flag = '' if d is None or .55 < d / exp < 1.6 else '   <-- duracion rara, revisa'
    print(f'{n:02d} {v["speaker"]:<22} {f}  ->  {v["id"]}.{ext}' + (f'  ({d:.1f}s, esperado ~{exp:.1f}s){flag}' if d else ''))
json.dump(idx, open(idx_path, 'w'), indent=0)
print(len(idx), 'voices installed of', len(V))
