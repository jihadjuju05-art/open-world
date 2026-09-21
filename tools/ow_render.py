import bpy, mathutils, collections
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld\assets_src\oldwest\Main_File_V1_1.glb')
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'; sc.render.resolution_x = 1100; sc.render.resolution_y = 800
sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'TEXTURE'
sc.world = bpy.data.worlds.new('w'); sc.world.color = (.5, .55, .6)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam; cam.data.lens = 28; cam.data.clip_end = 3000
objs = [o for o in sc.objects if o.type == 'MESH']
mn = [1e9]*3; mx = [-1e9]*3
for o in objs:
    for cc in o.bound_box:
        w = o.matrix_world @ mathutils.Vector(cc)
        for k in range(3): mn[k] = min(mn[k], w[k]); mx[k] = max(mx[k], w[k])
print('OBJ', len(objs), 'BBOX', [round(v, 1) for v in mn], [round(v, 1) for v in mx])
print('NAMES', dict(collections.Counter(o.name.split('.')[0] for o in objs).most_common(90)))
cx = (mn[0]+mx[0])/2; cy = (mn[1]+mx[1])/2; R = max(mx[0]-mn[0], mx[1]-mn[1]); c = mathutils.Vector((cx, cy, 0))
def shot(name, pos, target=c):
    cam.location = pos; d = target - mathutils.Vector(pos); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld\assets_src\oldwest\\' + name + '.png'
    bpy.ops.render.render(write_still=True)
shot('ow_iso', (cx + R*.7, cy - R*.9, R*.7)); shot('ow_top', (cx, cy, R*1.3))
