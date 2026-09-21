"""Blender (headless): turns the Sketchfab 'Low Poly House Interior' (CC BY 4.0, Paolo Mercogliano) into game assets.
 - one static mesh with the material colours baked into vertex colours (1 draw call for the whole interior)
 - the 4 interior doors as separate objects with their origin on the hinge
 - townhouse.json: colliders, stair steps, floor heights, doors and interactive furniture (house-local metres, +Z = front)
Run:  blender --background --python tools/process_townhouse.py
"""
import bpy, json, math, mathutils, os
ROOT = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
OUT = os.path.join(ROOT, 'assets', 'house'); os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(ROOT, 'assets_src', 'house', 'x', 'scene.gltf'))
sc = bpy.context.scene
objs = [o for o in sc.objects if o.type == 'MESH']

def top(o):                                        # the group just under RootNode
    p = o
    while p.parent and p.parent.name != 'RootNode' and p.parent.parent: p = p.parent
    return p.name
tops = {o.name: top(o) for o in objs}
for o in objs:                                     # flatten the hierarchy keeping the world transform
    mw = o.matrix_world.copy(); o.parent = None; o.matrix_world = mw
bpy.context.view_layer.update()

def bb(o):
    ws = [o.matrix_world @ mathutils.Vector(c) for c in o.bound_box]; return [min(w[i] for w in ws) for i in range(3)], [max(w[i] for w in ws) for i in range(3)]
allmin = [1e9]*3; allmax = [-1e9]*3
for o in objs:
    a, b = bb(o)
    for i in range(3): allmin[i] = min(allmin[i], a[i]); allmax[i] = max(allmax[i], b[i])
cx = (allmin[0] + allmax[0]) / 2; cy = (allmin[1] + allmax[1]) / 2
# centre on the origin and turn 180 degrees about the vertical axis so the front (+y in the source) ends up on +Z after the glTF axis swap
rot = mathutils.Matrix.Rotation(math.pi, 4, 'Z') @ mathutils.Matrix.Translation((-cx, -cy, 0))
for o in objs: o.matrix_world = rot @ o.matrix_world
bpy.context.view_layer.update()

# ---- group bounding boxes (after the transform, before joining)
groups = {}
for o in objs:
    a, b = bb(o); g = groups.setdefault(tops[o.name], {'mn': [1e9]*3, 'mx': [-1e9]*3, 'mats': set()})
    for i in range(3): g['mn'][i] = min(g['mn'][i], a[i]); g['mx'][i] = max(g['mx'][i], b[i])
    for s in o.material_slots:
        if s.material: g['mats'].add(s.material.name)
allmin = [min(g['mn'][i] for g in groups.values()) for i in range(3)]; allmax = [max(g['mx'][i] for g in groups.values()) for i in range(3)]
W = allmax[0] - allmin[0]; D = allmax[1] - allmin[1]
L = lambda x, y: (round(x, 3), round(-y, 3))       # blender (x, y) -> local (x, z)

# ---- colliders from individual objects (group boxes are unreliable: some groups span both floors)
SKIPM = {'gradini', 'pavimento_piano_terra', 'pavimento_primo_piano', 'tappeto', 'bicchieri', 'tovaglia', 'Battiscopa', 'Default_Material', 'lambert1', 'porte_legno', 'porte_maniglie', 'asta', 'lampada_filo', 'mobili_esportatilampada_filo', 'mobili_esportatilampada_plafoniera', 'mobili_esportatilampada_lampadina', 'anelli_doccia', 'bastone_doccia', 'tenda_doccia', 'pomelli', 'pomelli1', 'sedie_metallo', 'sedie_piano', 'fornelli_sostegni', 'fornelli1', 'material', 'cuscino', 'cuscini', 'coperta'}
boxes = []
for o in objs:
    if tops[o.name] in ('porta', 'porta1', 'porta2', 'porta3'): continue
    ms = {s.material.name for s in o.material_slots if s.material}
    a, b = bb(o); dx, dy, dz = b[0] - a[0], b[1] - a[1], b[2] - a[2]
    if 'pareti_casa' in ms:                        # walls: one thin box per vertical face (their bounding boxes are L shaped)
        me = o.data; nm = o.matrix_world.to_3x3()
        for poly in me.polygons:
            nrm = (nm @ poly.normal).normalized()
            if abs(nrm.z) > .2 or poly.area < .12: continue
            vs = [o.matrix_world @ me.vertices[i].co for i in poly.vertices]
            xs = [v.x for v in vs]; ys = [v.y for v in vs]; zs = [v.z for v in vs]
            if abs(nrm.x) > abs(nrm.y): boxes.append((min(xs) - .05, min(ys), min(zs), max(xs) + .05, max(ys), max(zs)))
            else: boxes.append((min(xs), min(ys) - .05, min(zs), max(xs), max(ys) + .05, max(zs)))
        continue
    if ms and ms <= SKIPM: continue
    if max(dx, dy) > .35 and dz > .25 and not (dx > 2.5 and dy > 2.5) and a[2] > -.1: boxes.append((a[0], a[1], a[2], b[0], b[1], b[2]))
def inside(u, v): return u[0] >= v[0] - .02 and u[1] >= v[1] - .02 and u[2] >= v[2] - .02 and u[3] <= v[3] + .02 and u[4] <= v[4] + .02 and u[5] <= v[5] + .02
uniq = []
for bx in boxes:
    if any(inside(bx, o2) for o2 in uniq): continue
    uniq = [o2 for o2 in uniq if not inside(o2, bx)] + [bx]
obj_colliders = [{'x': round((u[0] + u[3]) / 2, 3), 'z': round(-(u[1] + u[4]) / 2, 3), 'hx': round((u[3] - u[0]) / 2, 3), 'hz': round((u[4] - u[1]) / 2, 3), 'y0': round(u[2], 3), 'y1': round(u[5], 3)} for u in uniq]

# ---- vertex colours from the material base colours
def base_color(mat):
    if mat and mat.use_nodes:
        n = mat.node_tree.nodes.get('Principled BSDF')
        if n: c = n.inputs['Base Color'].default_value; return (c[0], c[1], c[2], 1.0)
    return (.5, .5, .5, 1.0)
for o in objs:
    me = o.data; colors = [base_color(s.material) for s in o.material_slots] or [(.5, .5, .5, 1.0)]
    attr = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER')
    for poly in me.polygons:
        c = colors[min(poly.material_index, len(colors) - 1)]
        for li in poly.loop_indices: attr.data[li].color = c
    me.materials.clear()

# ---- doors (separate, origin on the hinge) and the static rest
DOORS = {'porta': 0, 'porta1': 1, 'porta2': 2, 'porta3': 3}
door_objs = {}; static = []
for o in objs:
    t = tops[o.name]
    (door_objs.setdefault(DOORS[t], []) if t in DOORS else static).append(o)
def join(lst, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in lst: o.select_set(True)
    bpy.context.view_layer.objects.active = lst[0]; bpy.ops.object.join(); j = bpy.context.view_layer.objects.active; j.name = name; return j
static_obj = join(static, 'static')
doors = []; keep = [static_obj]
for i in sorted(door_objs):
    d = join(door_objs[i], f'door_{i}'); a, b = bb(d); sx, sy = b[0] - a[0], b[1] - a[1]; long_x = sx >= sy
    hinge = (a[0], (a[1] + b[1]) / 2, a[2]) if long_x else ((a[0] + b[0]) / 2, a[1], a[2])
    sc.cursor.location = hinge; bpy.ops.object.select_all(action='DESELECT'); d.select_set(True); bpy.context.view_layer.objects.active = d; bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    hx, hz = L(hinge[0], hinge[1]); ccx, ccz = L((a[0] + b[0]) / 2, (a[1] + b[1]) / 2); doors.append({'id': i, 'cx': ccx, 'cz': ccz, 'hx': round(sx / 2, 3), 'hz': round(sy / 2, 3), 'y0': round(a[2], 3), 'y1': round(b[2], 3), 'hinge': [hx, round(hinge[2], 3), hz], 'axis': 'x' if long_x else 'z', 'len': round(sx if long_x else sy, 3), 'thick': round(sy if long_x else sx, 3), 'height': round(b[2] - a[2], 3)}); keep.append(d)

# ---- data for the game
SKIP = ('porta', 'lampada', 'pCylinder1', 'pCube58', 'pCube118', 'pCylinder4', 'pavimento')
colliders, stairs, inter = [], [], []
for name, g in groups.items():
    dx, dy, dz = g['mx'][0] - g['mn'][0], g['mx'][1] - g['mn'][1], g['mx'][2] - g['mn'][2]; cxg, cyg = (g['mn'][0] + g['mx'][0]) / 2, (g['mn'][1] + g['mx'][1]) / 2
    if 'gradini' in g['mats']:
        x, z = L(cxg, cyg); stairs.append({'x0': round(g['mn'][0], 3), 'x1': round(g['mx'][0], 3), 'z0': L(0, g['mx'][1])[1], 'z1': L(0, g['mn'][1])[1], 'top': round(g['mx'][2], 3)}); continue
    if any(name.startswith(s) for s in SKIP) or 'pavimento_piano_terra' in g['mats'] or 'pavimento_primo_piano' in g['mats']: continue
    kind = None
    n = name.lower()
    if n.startswith('letto'): kind = 'sleep'
    elif n.startswith('divano') or n.startswith('poltrona') or n.startswith('sedia'): kind = 'sit'
    elif n.startswith('lampada') and dz > .2: kind = 'lamp'
    elif n.startswith('comodino') or n.startswith('scrivania') or n.startswith('antine') or n.startswith('portaarmadio') or n.startswith('frigo') or name in ('pCube132', 'pCube144', 'pCube182'): kind = 'search'
    elif 'libreria' in ' '.join(g['mats']): kind = 'read'
    elif n.startswith('lavandino') or n.startswith('doccia') or n.startswith('bidet'): kind = 'sink'
    elif n.startswith('fornelli') or name == 'pCube150': kind = 'stove'
    if kind:
        x, z = L(cxg, cyg); inter.append({'name': name, 'kind': kind, 'x': x, 'z': z, 'y': round(g['mx'][2], 3), 'y0': round(g['mn'][2], 3), 'w': round(dx, 3), 'd': round(dy, 3)})
floor0 = groups['pCube194']['mx'][2] if 'pCube194' in groups else .13; floor1 = groups['pCube21']['mx'][2]
data = {'W': round(W, 3), 'D': round(D, 3), 'floor0': round(floor0, 3), 'floor1': round(floor1, 3), 'ceiling': round(allmax[2], 3), 'stairs': stairs, 'colliders': obj_colliders, 'doors': doors, 'interact': inter, 'author': 'Paolo Mercogliano (CC BY 4.0) - Sketchfab: Low Poly House Interior'}
json.dump(data, open(os.path.join(OUT, 'townhouse.json'), 'w'), indent=1)

# ---- export (static + doors), Y-up
bpy.ops.object.select_all(action='DESELECT')
for o in keep: o.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'townhouse.glb'), export_format='GLB', use_selection=True, export_yup=True, export_apply=True)
print('DONE', 'W', W, 'D', D, 'colliders', len(obj_colliders), 'stairs', len(stairs), 'inter', len(inter), 'doors', len(doors), 'floors', floor0, floor1, allmax[2])
