# =====================================================================
# parecis_blender.py — roda DENTRO do Blender (aba Scripting > Run Script)
# 1) simplifica os modelos grátis pesados (Decimate preserva UV/textura)
# 2) renderiza (EEVEE) os modelos do Claude para a crítica das IAs
# Tudo vai para Documentos\ParecisTelha. Erros vão para blender_log.json.
# =====================================================================
import bpy, os, json, math, time, traceback
from mathutils import Vector

RAIZ = os.path.join(os.path.expanduser('~'), 'Documents', 'ParecisTelha')
GRATIS = os.path.join(RAIZ, 'modelos3d_gratis', 'grab3d')
LEVES = os.path.join(RAIZ, 'modelos3d_gratis', 'leves')
CLAUDE = os.path.join(RAIZ, 'modelos_claude', 'glb')
RENDERS = os.path.join(RAIZ, 'modelos_claude', 'renders')
LOG = os.path.join(RAIZ, 'blender_log.json')
ALVO_TRI = 5000          # teto de triângulos para os grátis
log = {'inicio': time.strftime('%H:%M:%S'), 'decimate': [], 'renders': [], 'erros': []}

def salvar_log():
    with open(LOG, 'w', encoding='utf-8') as f: json.dump(log, f, ensure_ascii=False, indent=1)

def limpar():
    bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete()
    for col in (bpy.data.meshes, bpy.data.materials, bpy.data.images, bpy.data.cameras, bpy.data.lights):
        for b in list(col):
            if b.users == 0: col.remove(b)

def importar(caminho):
    antes = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=caminho)
    return [o for o in bpy.data.objects if o not in antes]

def triangulos(objs):
    dg = bpy.context.evaluated_depsgraph_get(); t = 0
    for o in objs:
        if o.type == 'MESH':
            m = o.evaluated_get(dg).to_mesh(); m.calc_loop_triangles(); t += len(m.loop_triangles); o.evaluated_get(dg).to_mesh_clear()
    return t

def caixa(objs):
    pts = [o.matrix_world @ Vector(c) for o in objs if o.type == 'MESH' for c in o.bound_box]
    mn = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
    mx = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
    return mn, mx

# ---------- 1) DECIMATE dos grátis ----------
os.makedirs(LEVES, exist_ok=True)
for nome in sorted(os.listdir(GRATIS)) if os.path.isdir(GRATIS) else []:
    if not nome.endswith('.glb'): continue
    try:
        limpar(); objs = importar(os.path.join(GRATIS, nome)); t0 = triangulos(objs)
        if t0 <= ALVO_TRI:
            log['decimate'].append({'arquivo': nome, 'antes': t0, 'depois': t0, 'obs': 'já leve'}); continue
        razao = max(0.08, ALVO_TRI / t0)
        for o in objs:
            if o.type == 'MESH':
                md = o.modifiers.new('decimate', 'DECIMATE'); md.ratio = razao; md.use_collapse_triangulate = True
        t1 = triangulos(objs)
        bpy.ops.object.select_all(action='DESELECT')
        for o in objs: o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=os.path.join(LEVES, nome.replace('.glb', '-leve.glb')), export_format='GLB', use_selection=True, export_apply=True)
        log['decimate'].append({'arquivo': nome, 'antes': t0, 'depois': t1, 'razao': round(razao, 3)})
    except Exception as e:
        log['erros'].append({'etapa': 'decimate', 'arquivo': nome, 'erro': str(e), 'trace': traceback.format_exc()[-600:]})
    salvar_log()

# ---------- 2) RENDERS dos modelos do Claude ----------
os.makedirs(RENDERS, exist_ok=True)
cena = bpy.context.scene
for motor in ('BLENDER_EEVEE', 'BLENDER_EEVEE_NEXT'):
    try: cena.render.engine = motor; break
    except Exception: pass
cena.render.resolution_x, cena.render.resolution_y = 1280, 720
cena.render.image_settings.file_format = 'PNG'
try: cena.view_settings.view_transform = 'Standard'
except Exception: pass

LISTA = ['perfiladeira_tp40', 'guilhotina', 'dobradeira', 'barracao_trecho', 'escritorio', 'loja_balcao',
         'ponte_viga', 'ponte_carro', 'ponte_gancho', 'caminhao_carroceria', 'pilar_consolo', 'painel_fechamento',
         'bobina_1t', 'berco_bobina', 'clp_padrao', 'mesa_saida', 'pilha_telhas', 'balcao_loja', 'mostruario', 'botoeira']
for nome in LISTA:
    arq = os.path.join(CLAUDE, nome + '.glb')
    if not os.path.exists(arq): continue
    try:
        limpar(); objs = importar(arq)
        mn, mx = caixa(objs); c = (mn + mx) / 2; tam = max((mx - mn).length, 0.3)
        # mundo cinza-claro, sol e luz de preenchimento
        w = bpy.data.worlds.get('Mundo') or bpy.data.worlds.new('Mundo'); w.use_nodes = True; cena.world = w
        bg = w.node_tree.nodes.get('Background'); bg.inputs[0].default_value = (0.82, 0.85, 0.88, 1); bg.inputs[1].default_value = 0.9
        sol = bpy.data.objects.new('sol', bpy.data.lights.new('sol', 'SUN')); sol.data.energy = 3.2; sol.rotation_euler = (math.radians(50), math.radians(10), math.radians(35)); cena.collection.objects.link(sol)
        cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); cam.data.lens = 50; cena.collection.objects.link(cam); cena.camera = cam
        d = Vector((1.0, -1.15, 0.62)).normalized()
        cam.location = c + d * tam * 1.25
        dirc = (c - cam.location); cam.rotation_euler = dirc.to_track_quat('-Z', 'Y').to_euler()
        cena.render.filepath = os.path.join(RENDERS, nome + '.png')
        bpy.ops.render.render(write_still=True)
        log['renders'].append({'modelo': nome, 'tri': triangulos(objs)})
    except Exception as e:
        log['erros'].append({'etapa': 'render', 'arquivo': nome, 'erro': str(e), 'trace': traceback.format_exc()[-600:]})
    salvar_log()

log['fim'] = time.strftime('%H:%M:%S'); salvar_log()
print('PARECIS: terminou. Log em', LOG)
