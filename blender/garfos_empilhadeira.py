# Garfos da empilhadeira: ponta afinada em planta (chanfro de 15 cm) e reforço (calcanhar) mais grosso
import bpy, os, json, traceback, bmesh
from mathutils import Vector
H = os.path.expanduser('~'); B = os.path.join(H, 'Documents', 'Claude_Blender', 'parecis')
r = {}
try:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=os.path.join(B, 'forklift-light.glb'))
    car = bpy.data.objects['forklift_fork_carriage']
    mw = car.matrix_world; mi = mw.inverted()
    me = car.data
    bm = bmesh.new(); bm.from_mesh(me)
    Y_PONTA = -1.933; L = 0.15
    mov = 0
    for v in bm.verts:
        w = mw @ v.co
        if w.y < Y_PONTA + L and w.z < 0.08 and abs(w.x) > 0.2 and abs(w.x) < 0.4:
            t = (Y_PONTA + L - w.y) / L          # 0 no começo do chanfro, 1 na ponta
            cx = 0.30 if w.x > 0 else -0.30       # linha de centro de cada garfo
            w.x = cx + (w.x - cx) * (1.0 - 0.45 * t)          # afina 45% na largura
            if w.z > 0.035: w.z = 0.035 + (w.z - 0.035) * (1.0 - 0.5 * t)   # e um pouco na espessura
            v.co = mi @ w; mov += 1
    bm.to_mesh(me); bm.free(); me.update()
    r['vertices_movidos'] = mov
    # render de conferência da ponta
    sc = bpy.context.scene
    cam_d = bpy.data.cameras.new('c'); cam = bpy.data.objects.new('c', cam_d); sc.collection.objects.link(cam); sc.camera = cam
    sc.render.engine = 'BLENDER_WORKBENCH'; sc.render.resolution_x = 800; sc.render.resolution_y = 500
    try: sc.render.image_settings.media_type = 'IMAGE'
    except Exception: pass
    sc.render.image_settings.file_format = 'PNG'
    alvo = Vector((0.3, -1.8, 0.04))
    for nome, pos in (('garfo_cima', Vector((0.3, -1.8, 1.2))), ('garfo_34', Vector((1.0, -2.6, 0.5)))):
        cam.location = pos
        cam.rotation_mode = 'QUATERNION'; cam.rotation_quaternion = (alvo - pos).to_track_quat('-Z', 'Y')
        sc.render.filepath = os.path.join(B, nome + '.png'); bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(cam, do_unlink=True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(B, 'forklift-light_v2.glb'), export_format='GLB')
    r['export'] = 'ok'
except Exception:
    r['erro'] = traceback.format_exc()
open(os.path.join(B, 'garfo.json'), 'w').write(json.dumps(r, indent=1))
