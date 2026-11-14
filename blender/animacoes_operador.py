# pers_blender.py — Creative Characters FREE (ithappy): veste as peças no corpo e exporta para o jogo
# Roda no console Python do Blender. Saída: Documentos\ParecisTelha\personagens\ (GLB + log)
import bpy, os, json, traceback
from mathutils import Vector, Matrix
H = os.path.expanduser('~')
BLEND = os.path.join(H, 'Downloads', 'creative_character_free.blend')
OUT = os.path.join(H, 'Documents', 'Claude_Blender', 'parecis'); os.makedirs(OUT, exist_ok=True)
log = {'objetos': [], 'erros': []}
def salvar():
    with open(os.path.join(OUT, 'anim_log.json'), 'w', encoding='utf-8') as f: json.dump(log, f, ensure_ascii=False, indent=1)
try:
    bpy.ops.wm.open_mainfile(filepath=BLEND)
    rig = next(o for o in bpy.data.objects if o.type == 'ARMATURE')
    log['rig'] = {'nome': rig.name, 'loc': list(rig.location), 'mw': [list(r) for r in rig.matrix_world]}
    corpo = bpy.data.objects.get('Body_010')
    for o in bpy.data.objects:
        if o.type != 'MESH': continue
        mods = [m.type for m in o.modifiers]
        log['objetos'].append({'nome': o.name, 'pai': o.parent.name if o.parent else None, 'tipo_pai': o.parent_type,
            'loc': [round(v, 4) for v in o.location], 'rot': [round(v, 4) for v in o.rotation_euler], 'esc': [round(v, 4) for v in o.scale],
            'mw_t': [round(v, 4) for v in o.matrix_world.translation], 'mods': mods,
            'col': o.users_collection[0].name if o.users_collection else ''})
    salvar()
    # 1) apaga a moldura, as cabeças soltas e as peças que não servem (fantasia, chupeta, nariz de palhaço, gorro com escala própria)
    FORA = {'Frame', 'Costume_6_001', 'Costume_10_001', 'Clown_nose_001', 'Pacifier_001', 'Hat_057', 'Headphones_002'}
    for o in list(bpy.data.objects):
        if o.type == 'MESH' and (o.name in FORA or (o.users_collection and o.users_collection[0].name == 'Heads')):
            bpy.data.objects.remove(o, do_unlink=True)
    # animações que o jogo usa (o resto fica de fora para o arquivo ficar leve)
    USAR = {'Idle_Relaxed', 'Idle_Look_Around', 'Idle_Breathing', 'Walk_Forward', 'Run_Forward', 'Death_Backward', 'Death_Forward', 'Fall',
            'Hit_Reaction_Light', 'Hit_Reaction_Heavy', 'Jump_Start', 'Jump_Loop', 'Jump_End', 'Crouch_Walk_Forward', 'Climb_Ladder', 'Walk_Backward'}
    for ac in list(bpy.data.actions):
        if ac.name not in USAR: bpy.data.actions.remove(ac)
    if rig.animation_data:
        for t in list(rig.animation_data.nla_tracks):
            if not any(s.action and s.action.name in USAR for s in t.strips): rig.animation_data.nla_tracks.remove(t)
    log['acoes'] = [a.name for a in bpy.data.actions]
    # 2) cada peça com modificador de armadura vai para a mesma posição do corpo
    alvo = corpo.matrix_world.copy() if corpo else rig.matrix_world.copy()
    for o in bpy.data.objects:
        if o.type == 'MESH' and any(m.type == 'ARMATURE' for m in o.modifiers) and o != corpo:
            o.matrix_world = alvo

    # ================= animações novas (Claude) =================
    from mathutils import Quaternion
    sc = bpy.context.scene
    sc.render.fps = 24
    arm = rig.data
    pb = rig.pose.bones
    if rig.animation_data is None: rig.animation_data_create()
    # direções do personagem em espaço da armadura (repouso)
    rest = lambda n: arm.bones[n]
    pe = rest('LeftFoot').head_local; dedo = rest('LeftToeBase').head_local
    F = (dedo - pe); F.z = 0; F.normalize()
    U = Vector((0, 0, 1))
    S = (rest('LeftUpLeg').head_local - rest('RightUpLeg').head_local); S.z = 0; S.normalize()   # para a esquerda do boneco
    log['eixos'] = {'F': list(F), 'S': list(S)}
    ORDEM = ['Hips', 'Spine', 'Spine1', 'Neck', 'Head', 'LeftUpLeg', 'LeftLeg', 'LeftFoot', 'RightUpLeg', 'RightLeg', 'RightFoot',
             'LeftShoulder', 'LeftArm', 'LeftForeArm', 'LeftHand', 'RightShoulder', 'RightArm', 'RightForeArm', 'RightHand']
    for b in pb: b.rotation_mode = 'QUATERNION'
    # Blender 4.4+: ação com "slots" — sem escolher o slot, a ação não anima o rig
    def usar(a):
        rig.animation_data.action = a
        try:
            if len(a.slots): rig.animation_data.action_slot = a.slots[0]
        except Exception as e: log.setdefault('slot', str(e))
    # as faixas NLA do pacote sobrescrevem a pose a cada atualização: tira o animation_data e cria de novo vazio
    for a in bpy.data.actions: a.use_fake_user = True
    rig.animation_data_clear(); rig.animation_data_create()
    def apontar(nome, d):
        b = pb[nome]; d = d.normalized()
        bpy.context.view_layer.update()
        M = b.matrix.copy()
        cur = (M.to_3x3() @ Vector((0, 1, 0))).normalized()
        R = cur.rotation_difference(d).to_matrix().to_4x4()
        T = Matrix.Translation(M.translation)
        b.matrix = T @ R @ Matrix.Translation(-M.translation) @ M
        bpy.context.view_layer.update()
    def chave(nomes, f):
        for n in nomes:
            pb[n].keyframe_insert('rotation_quaternion', frame=f)
            if n in ('Hips', 'Root'): pb[n].keyframe_insert('location', frame=f)
    def zerar():
        for b in pb:
            b.rotation_quaternion = Quaternion(); b.location = Vector()
        bpy.context.view_layer.update()
    def lados(fn):
        for s, L in ((1, 'Left'), (-1, 'Right')): fn(s, L)
    def pose_sentado(abre=1.0):
        apontar('Spine', U - F * 0.12)
        apontar('Spine1', U - F * 0.05)
        apontar('Neck', U + F * 0.1)
        def pernas(s, L):
            apontar(L + 'UpLeg', F + S * (s * 0.12 * abre) - U * 0.04)
            apontar(L + 'Leg', -U + F * 0.18)
            apontar(L + 'Foot', F - U * 0.35)
        lados(pernas)
        def bracos(s, L):
            apontar(L + 'Arm', F * 0.75 - U * 0.55 + S * (s * 0.2))
            apontar(L + 'ForeArm', F * 0.95 + U * 0.25 - S * (s * 0.25))
        lados(bracos)
    TODOS = [n for n in ORDEM if n in pb]
    # ---- Sit_Forklift: sentado no banco, mãos à frente (o jogo ajusta as mãos no volante); respiração leve
    act = bpy.data.actions.new('Sit_Forklift'); act.use_fake_user = True
    usar(act)
    for f, resp in ((0, 0.0), (24, 1.0), (48, 0.0)):
        zerar(); pose_sentado()
        apontar('Spine1', U - F * (0.05 - 0.02 * resp))
        chave(TODOS, f)
    # ---- Push_Cart: anda (pernas do Walk_Forward), tronco inclinado 14° para frente, braços esticados no timão
    walk = bpy.data.actions.get('Walk_Forward')
    act2 = walk.copy(); act2.name = 'Push_Cart'; act2.use_fake_user = True
    usar(act2)
    f0, f1 = int(walk.frame_range[0]), int(walk.frame_range[1])
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        apontar('Spine', U + F * 0.25)
        apontar('Spine1', U + F * 0.1)
        apontar('Neck', U - F * 0.05)
        def bracos2(s, L):
            apontar(L + 'Arm', F * 0.95 - U * 0.15 + S * (s * 0.12))
            apontar(L + 'ForeArm', F + U * 0.05 - S * (s * 0.15))
        lados(bracos2)
        chave(['Spine', 'Spine1', 'Neck', 'LeftArm', 'LeftForeArm', 'RightArm', 'RightForeArm'], f)
    # ---- Climb_Forklift (1 s): 0,3 s sobe no degrau (joelho de apoio dobrado), 0,35 s passa o quadril para dentro, 0,35 s senta
    act3 = bpy.data.actions.new('Climb_Forklift'); act3.use_fake_user = True
    usar(act3)
    zerar(); chave(TODOS, 0)
    zerar()   # f7: pé esquerdo no degrau, perna direita de apoio com o joelho dobrado ~20°, mão esquerda no teto de proteção
    apontar('Spine', U + F * 0.28); apontar('Spine1', U + F * 0.1)
    apontar('LeftUpLeg', F * 0.9 + S * 0.3); apontar('LeftLeg', -U - F * 0.05)     # pé no degrau ~0,40 m acima do chão
    apontar('RightUpLeg', -U + F * 0.12); apontar('RightLeg', -U - F * 0.3)        # apoio no chão, joelho ~20°
    apontar('LeftArm', U * 0.9 + F * 0.35 + S * 0.15); apontar('LeftForeArm', U + F * 0.25)
    apontar('RightArm', F * 0.55 - U * 0.5 - S * 0.1); apontar('RightForeArm', F * 0.8 - U * 0.2)
    chave(TODOS, 7)
    chave(TODOS, 11)   # firma no degrau (mesma pose) até 0,45 s
    zerar()   # f15: quadril entra na cabine, o pé de apoio sai do chão
    apontar('Spine', U + F * 0.15)
    apontar('LeftUpLeg', F * 0.9 + U * 0.15 - S * 0.05); apontar('LeftLeg', -U * 0.8 + F * 0.45)
    apontar('RightUpLeg', F * 0.55 - U * 0.65); apontar('RightLeg', -U + F * 0.45)
    apontar('LeftArm', U * 0.55 + F * 0.55 + S * 0.15); apontar('LeftForeArm', U * 0.5 + F * 0.7)
    apontar('RightArm', F * 0.7 - U * 0.45 - S * 0.15); apontar('RightForeArm', F + U * 0.1)
    chave(TODOS, 17)
    zerar(); pose_sentado()   # f19: as duas pernas já recolhidas para a área dos pedais, quadril ainda descendo
    apontar('Spine', U + F * 0.05)
    apontar('LeftUpLeg', F + U * 0.12); apontar('LeftLeg', -U + F * 0.3)
    apontar('RightUpLeg', F + U * 0.05); apontar('RightLeg', -U + F * 0.25)
    chave(TODOS, 21)
    zerar(); pose_sentado(); chave(TODOS, 24)
    log['novas'] = ['Sit_Forklift', 'Push_Cart', 'Climb_Forklift']
    usar(act); sc.frame_set(0); bpy.context.view_layer.update()
    log['conf_sit'] = {n: [round(x, 3) for x in pb[n].rotation_quaternion] for n in ('LeftUpLeg', 'LeftLeg', 'Spine')}
    log['fcurves_sit'] = len(act.fcurves) if hasattr(act, 'fcurves') else -1
    salvar()
    # ---- renders de conferência (Workbench)
    cam_d = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
    cam_d.lens = 50
    sc.render.engine = 'BLENDER_WORKBENCH'; sc.render.resolution_x = 640; sc.render.resolution_y = 640
    try: sc.render.image_settings.media_type = 'IMAGE'
    except Exception: pass
    sc.render.image_settings.file_format = 'PNG'
    sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'
    centro = rig.matrix_world @ (rest('Hips').head_local)
    def foto(nome, acao, f, dirv):
        usar(bpy.data.actions[acao]); sc.frame_set(f); bpy.context.view_layer.update()
        dw = (rig.matrix_world.to_3x3() @ dirv).normalized()
        c = rig.matrix_world @ pb['Hips'].head
        cam.location = c + dw * 4.0 + Vector((0, 0, 0.15))
        cam.rotation_mode = 'QUATERNION'
        cam.rotation_quaternion = (c - cam.location).to_track_quat('-Z', 'Y')
        sc.render.filepath = os.path.join(OUT, 'anim_' + nome + '.png')
        bpy.ops.render.render(write_still=True)
    foto('sit_lado', 'Sit_Forklift', 0, S)
    foto('sit_frente', 'Sit_Forklift', 0, F + S * 0.3)
    foto('push_lado', 'Push_Cart', 8, S)
    foto('push_34', 'Push_Cart', 20, F * 0.6 + S)
    foto('climb_08', 'Climb_Forklift', 7, S + F * 0.4)
    foto('climb_16', 'Climb_Forklift', 15, S + F * 0.4)
    foto('climb_04', 'Climb_Forklift', 19, S + F * 0.4)
    foto('push_lado2', 'Push_Cart', 22, S)
    # ---- exporta
    bpy.data.objects.remove(cam, do_unlink=True)
    rig.animation_data.action = None
    for o in bpy.data.objects: o.hide_set(False); o.hide_viewport = False
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'personagens_ithappy.glb'), export_format='GLB',
        export_animations=True, export_animation_mode='ACTIONS', use_visible=False, use_selection=False)
    log['export'] = 'ok'
except Exception as e:
    log['erros'].append(traceback.format_exc()[-2500:])
salvar(); print('ANIM: fim', log.get('export'), len(log['erros']))
