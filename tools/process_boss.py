"""Blender (headless): Stylized Female Character (FBX + 5 animation FBX) -> assets/boss/valkyrie.glb (+ 2048px JPG textures).
Materials are not exported: the game builds them from the textures (see src/boss.js).
Run:  blender --background --python tools/process_boss.py
"""
import bpy, os
ROOT = r'C:\Users\jihad\Documents\aguda-mente-project\aguda-mente-master\openworld'
SRC = os.path.join(ROOT, 'assets_src', 'boss'); OUT = os.path.join(ROOT, 'assets', 'boss'); os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, 'SK_Stylized_Female_Character.fbx'))
sc = bpy.context.scene
main = [o for o in sc.objects if o.type == 'ARMATURE'][0]
CLIPS = {'Idle': 'StylizedFemale_Idle', 'CombatIdle': 'StylizedFemale_CombatIdle', 'Walk': 'StylizedFemale_Walk_F', 'Run': 'StylizedFemale_Run_F', 'Attack': 'StylizedFemale_Attack_Light_01'}
actions = {}
for name, f in CLIPS.items():
    before = set(bpy.data.actions.keys()); objs_before = set(sc.objects.keys())
    bpy.ops.import_scene.fbx(filepath=os.path.join(SRC, f + '.fbx'))
    new = [a for k, a in bpy.data.actions.items() if k not in before]
    a = new[0]; a.name = name; actions[name] = a
    for o in [o for k, o in sc.objects.items() if k not in objs_before]: bpy.data.objects.remove(o, do_unlink=True)   # drop the animation-only armature / helper meshes
main.animation_data_create()
for name, a in actions.items():
    tr = main.animation_data.nla_tracks.new(); tr.name = name; st = tr.strips.new(name, int(a.frame_range[0]), a); st.name = name
main.animation_data.action = None
for a in actions.values(): a.use_fake_user = True
print('CLIPS', {n: (round(a.frame_range[0]), round(a.frame_range[1]), len(a.fcurves) if hasattr(a, 'fcurves') else '?') for n, a in actions.items()})
# textures -> 2048 jpg
NAMES = ['Body', 'Helmet', 'Outfit', 'Shoes', 'Tail', 'Weapon']
for n in NAMES:
    for kind in ('BaseColor', 'Normal', 'Emissive', 'MAS'):
        p = os.path.join(SRC, f'T_Character_F_{n}_{kind}.png')
        if not os.path.exists(p): continue
        img = bpy.data.images.load(p); img.scale(2048, 2048)
        sc.render.image_settings.file_format = 'JPEG'; sc.render.image_settings.quality = 88
        img.save_render(os.path.join(OUT, f'{n}_{kind}.jpg'), scene=sc); bpy.data.images.remove(img)
# export
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'valkyrie.glb'), export_format='GLB', use_selection=True, export_yup=True, export_animations=True, export_animation_mode='NLA_TRACKS', export_materials='EXPORT', export_image_format='NONE', export_apply=False)
print('DONE')
