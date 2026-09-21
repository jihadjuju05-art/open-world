import bpy, collections, sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld\assets_src\house\x\scene.gltf')
objs = [o for o in bpy.context.scene.objects if o.type == 'MESH']
print('MESHES', len(objs))
mat_count = collections.Counter(); mat_verts = collections.Counter()
for o in objs:
    for s in o.material_slots:
        mat_count[s.material.name if s.material else 'none'] += 1
print('MATERIALS', dict(mat_count))
def bbox(o):
    import mathutils
    ws = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]
    return [min(w[i] for w in ws) for i in range(3)], [max(w[i] for w in ws) for i in range(3)]
allmin = [1e9]*3; allmax = [-1e9]*3
for o in objs:
    a, b = bbox(o)
    for i in range(3): allmin[i] = min(allmin[i], a[i]); allmax[i] = max(allmax[i], b[i])
print('BBOX blender (z up)', [round(v, 2) for v in allmin], [round(v, 2) for v in allmax])
# per top-level group: material + bbox
tops = collections.OrderedDict()
def top(o):
    p = o
    while p.parent and p.parent.name not in ('RootNode',) and p.parent.parent: p = p.parent
    return p.name
for o in objs:
    t = top(o); a, b = bbox(o); tops.setdefault(t, []).append((o.name, [s.material.name for s in o.material_slots], a, b))
for t, lst in list(tops.items())[:200]:
    mats = sorted({m for x in lst for m in x[1]})
    mn = [round(min(x[2][i] for x in lst), 2) for i in range(3)]; mx = [round(max(x[3][i] for x in lst), 2) for i in range(3)]
    print(f'{t:28s} n={len(lst):2d} mats={mats[:3]} bbox={mn}->{mx}')
