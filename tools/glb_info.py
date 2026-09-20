import json, struct, sys, os, glob
def info(p):
    b = open(p, 'rb').read(); l = struct.unpack('<I', b[12:16])[0]; j = json.loads(b[20:20 + l])
    nodes = [n.get('name') for n in j.get('nodes', [])]; anims = [a.get('name') for a in j.get('animations', [])]
    tris = 0
    for m in j.get('meshes', []):
        for pr in m['primitives']:
            if 'indices' in pr: tris += j['accessors'][pr['indices']]['count'] // 3
    sc = j['scenes'][0]['nodes']; top = [j['nodes'][i].get('name') for i in sc]
    return top, len(anims), anims[:4], tris, len(j.get('skins', []))
if __name__ == '__main__':
    for d in sys.argv[1:]:
        for p in sorted(glob.glob(os.path.join(d, '*.glb'))):
            t, na, an, tris, sk = info(p); print(os.path.basename(p)[:14], '|', ','.join(map(str, t))[:70], '| anims', na, an[:3], '| tris', tris, '| skins', sk)
