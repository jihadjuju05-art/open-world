# blender --background --python blender_report.py -- <assets_src dir>
import bpy, sys, os, glob, json
root = sys.argv[sys.argv.index('--') + 1]
out = {}
for d in sorted(glob.glob(os.path.join(root, '*'))):
    g = glob.glob(os.path.join(d, '*.gltf'))
    if not g: continue
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=g[0])
    tris = 0; mats = set(); imgs = set(); dims = None
    mins = [1e9]*3; maxs = [-1e9]*3
    for o in bpy.context.scene.objects:
        if o.type == 'MESH':
            o.data.calc_loop_triangles(); tris += len(o.data.loop_triangles)
            for m in o.data.materials:
                if m: mats.add(m.name)
            for v in o.bound_box:
                w = o.matrix_world @ __import__('mathutils').Vector(v)
                for i in range(3): mins[i] = min(mins[i], w[i]); maxs[i] = max(maxs[i], w[i])
    for im in bpy.data.images: imgs.add((im.name, im.size[0], im.size[1]))
    out[os.path.basename(d)] = {'tris': tris, 'materials': sorted(mats), 'size_m': [round(maxs[i]-mins[i], 2) for i in range(3)], 'images': sorted(imgs)}
print('REPORT' + json.dumps(out))
