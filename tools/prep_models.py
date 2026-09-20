# Blender batch: import source glTF assets, reduce triangles (LOD), shrink textures, export lightweight .glb + manifest.json
#   blender --background --python tools/prep_models.py -- <openworld dir>
import bpy, sys, os, glob, json, mathutils

ROOT = sys.argv[sys.argv.index('--') + 1]
SRC, OUT = os.path.join(ROOT, 'assets_src'), os.path.join(ROOT, 'assets', 'models')
os.makedirs(OUT, exist_ok=True)

# name, source dir, [(suffix, triangle_target or None), ...], max texture size, tags
TREES = ['CommonTree_1', 'CommonTree_2', 'CommonTree_3', 'CommonTree_4', 'Pine_1', 'Pine_2', 'Pine_3', 'Pine_4', 'TwistedTree_1', 'TwistedTree_2', 'DeadTree_1', 'DeadTree_2']
SMALL = ['Bush_Common', 'Bush_Common_Flowers', 'Fern_1', 'Plant_1', 'Plant_1_Big', 'Plant_7', 'Plant_7_Big', 'Grass_Common_Short', 'Grass_Common_Tall', 'Grass_Wispy_Short', 'Grass_Wispy_Tall', 'Clover_1', 'Flower_3_Group', 'Flower_4_Group', 'Mushroom_Common', 'Pebble_Round_3']
ROCKS_QN = ['Rock_Medium_1', 'Rock_Medium_2', 'Rock_Medium_3']
ROCKS_PH = [('boulder_01', 2200), ('namaqualand_boulder_02', 2600), ('rock_07', 1200), ('rock_09', 1000), ('tree_stump_01', 2500), ('dead_tree_trunk', 1800)]

jobs = []
for n in TREES: jobs.append((n, os.path.join(SRC, 'nature', n), [('', None), ('_lod1', .2)], 1024, 'tree'))
for n in SMALL: jobs.append((n, os.path.join(SRC, 'nature', n), [('', None)], 512, 'plant'))
for n in ROCKS_QN: jobs.append((n, os.path.join(SRC, 'nature', n), [('', None)], 1024, 'rock'))
for n, t in ROCKS_PH: jobs.append((n, os.path.join(SRC, n), [('', t)], 1024, 'rock'))

def tri_count():
    t = 0
    for o in bpy.context.scene.objects:
        if o.type == 'MESH': o.data.calc_loop_triangles(); t += len(o.data.loop_triangles)
    return t

def bounds():
    mn = [1e9] * 3; mx = [-1e9] * 3
    for o in bpy.context.scene.objects:
        if o.type != 'MESH': continue
        for v in o.bound_box:
            w = o.matrix_world @ mathutils.Vector(v)
            for i in range(3): mn[i] = min(mn[i], w[i]); mx[i] = max(mx[i], w[i])
    return mn, mx

manifest = {}
for name, d, lods, texmax, tag in jobs:
    g = glob.glob(os.path.join(d, '*.gltf'))
    if not g: print('MISSING', name); continue
    for suffix, target in lods:
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=g[0])
        before = tri_count()
        if target is not None:                               # target: ratio (<1) or absolute triangle count
            ratio = target if target < 1 else min(1.0, target / max(1, before))
            if ratio < 1:
                for o in [o for o in bpy.context.scene.objects if o.type == 'MESH']:
                    bpy.context.view_layer.objects.active = o; o.select_set(True)
                    m = o.modifiers.new('dec', 'DECIMATE'); m.decimate_type = 'COLLAPSE'; m.ratio = ratio; m.use_collapse_triangulate = True
                    bpy.ops.object.modifier_apply(modifier='dec')
        for im in bpy.data.images:                            # shrink textures
            w, h = im.size
            if w > texmax or h > texmax:
                s = texmax / max(w, h); im.scale(max(1, int(w * s)), max(1, int(h * s)))
        after = tri_count(); mn, mx = bounds()
        path = os.path.join(OUT, name + suffix + '.glb')
        bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', export_apply=True, export_image_format='AUTO', export_yup=True)
        key = name + suffix
        manifest[key] = {'tag': tag, 'tris': after, 'from': before, 'bytes': os.path.getsize(path),
                         'size': [round(mx[0] - mn[0], 3), round(mx[2] - mn[2], 3), round(mx[1] - mn[1], 3)]}    # width x, height (blender Z), depth
        print('OK', key, before, '->', after, round(os.path.getsize(path) / 1e6, 2), 'MB')
json.dump(manifest, open(os.path.join(OUT, 'manifest.json'), 'w'), indent=1)
print('DONE', len(manifest))
