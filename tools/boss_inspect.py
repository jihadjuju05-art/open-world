import bpy, os, collections
R = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld\assets_src\boss'
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=os.path.join(R, 'SK_Stylized_Female_Character.fbx'))
arms = [o for o in bpy.context.scene.objects if o.type == 'ARMATURE']
meshes = [o for o in bpy.context.scene.objects if o.type == 'MESH']
print('ARMS', [(a.name, len(a.data.bones)) for a in arms])
print('BONES', [b.name for b in arms[0].data.bones][:80])
print('MESHES', [(m.name, len(m.data.polygons), [s.material.name if s.material else None for s in m.material_slots]) for m in meshes])
import mathutils
mn = [1e9]*3; mx = [-1e9]*3
for m in meshes:
    for c in m.bound_box:
        w = m.matrix_world @ mathutils.Vector(c)
        for k in range(3): mn[k] = min(mn[k], w[k]); mx[k] = max(mx[k], w[k])
print('BBOX', [round(v, 2) for v in mn], [round(v, 2) for v in mx], 'scale', arms[0].scale[:], 'unit', bpy.context.scene.unit_settings.scale_length)
bpy.ops.import_scene.fbx(filepath=os.path.join(R, 'StylizedFemale_Idle.fbx'))
print('ACTIONS', [(a.name, round(a.frame_range[1] - a.frame_range[0])) for a in bpy.data.actions])
print('ARMS2', [(a.name, len(a.data.bones), a.data.bones[0].name) for a in bpy.context.scene.objects if a.type == 'ARMATURE'])
