import bpy, math, mathutils, sys
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld\assets_src\house\x\scene.gltf')
sc = bpy.context.scene
sc.render.engine = 'BLENDER_WORKBENCH'
sc.render.resolution_x = 900; sc.render.resolution_y = 700
sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'
sc.world = bpy.data.worlds.new('w'); sc.world.color = (.5, .55, .6)
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 28
c = mathutils.Vector((1.45, -3.3, 2.9))
def shot(name, pos, target=c):
    cam.location = pos
    d = target - mathutils.Vector(pos); cam.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld\assets_src\house\\' + name + '.png'
    bpy.ops.render.render(write_still=True)
shot('view_iso', (9, -16, 9))
shot('view_back', (-8, 8, 8))
shot('view_top', (1.45, -3.3, 16), mathutils.Vector((1.45, -3.35, 2.9)))
