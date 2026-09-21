"""Rebuilds assets/voice/index.json = { id: { e: extension, d: duration in seconds } } from the files in assets/voice."""
import json, os, soundfile as sf
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__))); out = os.path.join(root, 'assets', 'voice'); idx = {}
for f in sorted(os.listdir(out)):
    n, e = os.path.splitext(f)
    if e in ('.mp3', '.wav') and len(n) == 8: idx[n] = {'e': e[1:], 'd': round(sf.info(os.path.join(out, f)).duration, 2)}
json.dump(idx, open(os.path.join(out, 'index.json'), 'w'), indent=0); print(len(idx), 'voices indexed')
