"""Generates every cinematic voice line with Microsoft Edge TTS (free, no account) into assets/voice/<id>.<ext>.
Kaelith gets a reverb (needs numpy + soundfile; falls back to the dry voice if they are missing).
usage: python tools/voices_edge.py [--only 1,5,16]"""
import asyncio, json, os, sys, wave
import edge_tts
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
V = json.load(open(os.path.join(root, 'tools', 'voices.json'), encoding='utf-8'))
out = os.path.join(root, 'assets', 'voice'); os.makedirs(out, exist_ok=True)
VOICE = {   # speaker -> (voice, rate, pitch)
    'Narrador': ('es-MX-JorgeNeural', '-12%', '-15Hz'),
    'Protagonista': ('es-US-AlonsoNeural', '-6%', '-4Hz'),
    'Amos Reed': ('es-CO-GonzaloNeural', '-14%', '-22Hz'),
    'Silas «El Cuervo»': ('es-ES-AlvaroNeural', '-14%', '-20Hz'),
    'Kaelith, la Segadora': ('es-ES-XimenaNeural', '-18%', '-8Hz'),
}
only = None
for a in sys.argv[1:]:
    if a.startswith('--only'): only = {int(x) for x in a.split('=')[-1].split(',')} if '=' in a else None
if '--only' in sys.argv: only = {int(x) for x in sys.argv[sys.argv.index('--only') + 1].split(',')}

def reverb(path_mp3, path_wav):
    import numpy as np, soundfile as sf
    x, sr = sf.read(path_mp3, dtype='float32'); x = x.mean(axis=1) if x.ndim > 1 else x
    rng = np.random.default_rng(7); n = int(sr * 1.6); t = np.arange(n) / sr
    ir = rng.standard_normal(n).astype('float32') * np.exp(-t * 3.2); ir[0] = 1.0; ir /= np.abs(ir).sum() ** .5 * 1.6
    spec = np.fft.rfft(x, len(x) + n); wet = np.fft.irfft(spec * np.fft.rfft(ir, len(x) + n))
    y = np.concatenate([x, np.zeros(n, 'float32')]) * .8 + wet * .55; y /= max(1e-6, np.abs(y).max()) / .92
    y = y[:len(x) + int(sr * 1.2)]
    with wave.open(path_wav, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr); w.writeframes((y * 32767).astype('<i2').tobytes())

async def main():
    idx = {}
    p = os.path.join(out, 'index.json')
    try: idx = json.load(open(p)); idx = {k: 'mp3' for k in idx} if isinstance(idx, list) else idx
    except Exception: pass
    for v in V:
        if only and v['n'] not in only: continue
        voice, rate, pitch = VOICE[v['speaker']]; mp3 = os.path.join(out, v['id'] + '.mp3')
        for ext in ('wav', 'mp3'):
            f = os.path.join(out, v['id'] + '.' + ext)
            if os.path.exists(f): os.remove(f)
        await edge_tts.Communicate(v['text'], voice, rate=rate, pitch=pitch).save(mp3); ext = 'mp3'
        if v['speaker'].startswith('Kaelith'):
            try: reverb(mp3, os.path.join(out, v['id'] + '.wav')); os.remove(mp3); ext = 'wav'
            except Exception as e: print('  (sin reverb:', e, ')')
        idx[v['id']] = ext; print(f'{v["n"]:02d} {v["speaker"]:<22} {v["id"]}.{ext}')
    json.dump(idx, open(p, 'w'), indent=0); print(len(idx), 'voices in index')
asyncio.run(main())
