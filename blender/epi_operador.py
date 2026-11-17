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
    apontar('Spine', U + F * 0.45); apontar('Spine1', U + F * 0.15)   # tronco ~25° à frente: peso sobre o pé do degrau
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
    # ================= EPI do operador (skill character-artist: peças separadas, presas ao rig) =================
    import bmesh, math
    from mathutils import Matrix
    rig.animation_data.action = None
    arm.pose_position = 'REST'; bpy.context.view_layer.update()
    corpo = bpy.data.objects['Body_010']
    hb = arm.bones['Head']
    hz = (rig.matrix_world @ hb.head_local).z
    pts = [corpo.matrix_world @ v.co for v in corpo.data.vertices]
    cab = [p for p in pts if p.z > hz - 0.02]
    topo = max(p.z for p in cab)
    hx = (max(p.x for p in cab) + min(p.x for p in cab)) / 2
    hy = (max(p.y for p in cab) + min(p.y for p in cab)) / 2
    meia_l = (max(p.x for p in cab) - min(p.x for p in cab)) / 2
    meia_p = (max(p.y for p in cab) - min(p.y for p in cab)) / 2
    alt_cab = topo - hz
    olho_z = hz + 0.43 * alt_cab
    frente_rosto = min(p.y for p in cab if abs(p.z - olho_z) < 0.03 and abs(p.x - hx) < meia_l * 0.5)
    log['cabeca'] = dict(topo=topo, hx=hx, hy=hy, meia_l=meia_l, meia_p=meia_p, hz=hz, olho_z=olho_z, frente=frente_rosto)
    def mat(nome, cor, rug=0.5, met=0.0, alfa=1.0):
        m = bpy.data.materials.get(nome) or bpy.data.materials.new(nome)
        m.use_nodes = True
        b = m.node_tree.nodes['Principled BSDF']
        b.inputs['Base Color'].default_value = (*cor, 1); b.inputs['Roughness'].default_value = rug
        b.inputs['Metallic'].default_value = met; m.diffuse_color = (*cor, alfa)
        if alfa < 1:
            b.inputs['Alpha'].default_value = alfa
            try: m.surface_render_method = 'BLENDED'
            except Exception: pass
        return m
    M_CAP = mat('MAT_EPI_Capacete_Amarelo', (0.95, 0.72, 0.05), 0.35)
    M_VERM = mat('MAT_EPI_Abafador_Vermelho', (0.75, 0.06, 0.04), 0.45)
    M_PRETO = mat('MAT_EPI_Plastico_Preto', (0.04, 0.04, 0.045), 0.6)
    M_LENTE = mat('MAT_EPI_Lente', (0.80, 0.88, 0.95), 0.05, 0.0, 0.35)
    M_LARANJA = mat('MAT_EPI_Colete_Laranja', (0.92, 0.10, 0.0), 0.7)   # laranja de segurança (linear) — 1,0/0,30 virava amarelo no sol
    M_REFL = mat('MAT_EPI_Faixa_Refletiva', (0.82, 0.83, 0.80), 0.25, 0.6)
    def novo(nome, bm, m):
        me = bpy.data.meshes.new(nome); bm.to_mesh(me); bm.free()
        o = bpy.data.objects.new(nome, me); sc.collection.objects.link(o)
        if isinstance(m, list):
            for mm in m: me.materials.append(mm)
        else: me.materials.append(m)
        for p in me.polygons: p.use_smooth = True
        return o
    R = meia_l * 1.16
    zc = topo + 0.028 - R * 1.02
    # casco: meia esfera achatada, mais funda na nuca
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=24, v_segments=14, radius=1.0)
    for v in list(bm.verts):
        if v.co.z < -0.02: bm.verts.remove(v)
    for v in bm.verts:
        v.co = Vector((hx + v.co.x * R, hy + v.co.y * R * (meia_p / meia_l) * 1.10 + 0.006, zc + v.co.z * R * 1.02))
    # nervura central (de frente para trás)
    # nervura central: faixa de vértices do casco perto de x = 0 sobe 7 mm (acompanha a curva, não sai para fora)
    for v in bm.verts:
        if abs(v.co.x - hx) < R * 0.07 and v.co.z > zc + R * 0.25:
            v.co.z += 0.007 * (1 - abs(v.co.x - hx) / (R * 0.07))
    # aba frontal (pala) e borda em volta
    bmesh.ops.create_cone(bm, cap_ends=True, segments=28, radius1=R * 1.015, radius2=R * 1.015, depth=0.010,
                          matrix=Matrix.Translation((hx, hy + 0.006, zc + 0.004)))
    pala = bmesh.ops.create_cone(bm, cap_ends=True, segments=20, radius1=R * 0.62, radius2=R * 0.62, depth=0.009,
                          matrix=Matrix.Translation((hx, hy - R * 0.62, zc + 0.010)) @ Matrix.Rotation(math.radians(-8), 4, 'X'))
    for v in pala['verts']:
        if v.co.y > hy - R * 0.70: v.co.y = hy - R * 0.70
    cap = novo('SM_Char_Operador_EPI_Capacete', bm, M_CAP)
    # abafadores tipo concha presos no casco
    bm = bmesh.new()
    zo = hz + 0.40 * alt_cab
    for lado in (-1, 1):
        xo = hx + lado * (meia_l + 0.018)
        bmesh.ops.create_cone(bm, cap_ends=True, segments=18, radius1=0.042, radius2=0.036, depth=0.034,
                              matrix=Matrix.Translation((xo, hy + 0.005, zo)) @ Matrix.Rotation(math.radians(90 * lado), 4, 'Y'))
    for f in bm.faces: f.material_index = 0
    bm2 = bmesh.new()
    for lado in (-1, 1):
        xo = hx + lado * (meia_l + 0.024)
        r = bmesh.ops.create_cube(bm2, size=1.0)
        for v in r['verts']:
            v.co = Vector((xo + v.co.x * 0.008, hy + 0.005 + v.co.y * 0.018, (zo + zc) / 2 + v.co.z * (zc - zo + 0.02)))
    me_tmp = bpy.data.meshes.new('tmp'); bm2.to_mesh(me_tmp); bm2.free()
    n0 = len(bm.faces); bm.from_mesh(me_tmp); bpy.data.meshes.remove(me_tmp)
    bm.faces.ensure_lookup_table()
    for i in range(n0, len(bm.faces)): bm.faces[i].material_index = 1
    abaf = novo('SM_Char_Operador_EPI_Abafador', bm, [M_VERM, M_PRETO])
    # óculos de segurança: lente envolvente + hastes
    bm = bmesh.new()
    seg = 16; larg = meia_l * 0.95; altl = 0.042; y0 = frente_rosto - 0.014
    vs = []
    for i in range(seg + 1):
        a = -1 + 2 * i / seg
        x = hx + a * larg
        y = y0 + (a * a) * 0.045
        vs.append((bm.verts.new((x, y, olho_z - altl / 2)), bm.verts.new((x, y, olho_z + altl / 2))))
    for i in range(seg):
        bm.faces.new((vs[i][0], vs[i + 1][0], vs[i + 1][1], vs[i][1]))
    bmesh.ops.solidify(bm, geom=bm.faces[:], thickness=0.002)
    for lado in (-1, 1):
        r = bmesh.ops.create_cube(bm, size=1.0)
        for v in r['verts']:
            v.co = Vector((hx + lado * (larg + 0.004) + v.co.x * 0.004, y0 + 0.045 + (meia_p * 0.9) * (v.co.y + 0.5), olho_z + 0.012 + v.co.z * 0.008))
    oc = novo('SM_Char_Operador_EPI_Oculos', bm, M_LENTE)
    # presos no osso da cabeça mantendo a posição
    for o in (cap, abaf, oc):
        mw = o.matrix_world.copy()
        o.parent = rig; o.parent_type = 'BONE'; o.parent_bone = 'Head'
        bpy.context.view_layer.update()
        o.matrix_world = mw
    # colete refletivo: a partir da jaqueta (mesmos pesos de pele), sem mangas, 6 mm por fora, 2 faixas prata
    jaq = bpy.data.objects['T_Shirt_009']   # uniforme novo: camiseta manga curta + colete por cima
    col = jaq.copy(); col.data = jaq.data.copy(); col.name = 'SM_Char_Operador_EPI_Colete'; col.data.name = col.name
    sc.collection.objects.link(col)
    gi = {g.index: g.name for g in col.vertex_groups}
    braco = ('Arm', 'ForeArm', 'Hand')
    bm = bmesh.new(); bm.from_mesh(col.data)
    dl = bm.verts.layers.deform.verify()
    tira = []
    for v in bm.verts:
        w = sum(p for g, p in v[dl].items() if any(gi.get(g, '').endswith(k) or (k in gi.get(g, '') and 'Shoulder' not in gi.get(g, '')) for k in braco))
        if w > 0.35 or (col.matrix_world @ v.co).z > hz - 0.05: tira.append(v)
    bmesh.ops.delete(bm, geom=tira, context='VERTS')
    bm.normal_update()
    for v in bm.verts: v.co += v.normal * 0.006
    zs = [(col.matrix_world @ v.co).z for v in bm.verts]
    zmin, zmax = min(zs), max(zs); h = zmax - zmin
    bm.to_mesh(col.data); bm.free()
    col.data.materials.clear(); col.data.materials.append(M_LARANJA); col.data.materials.append(M_REFL)
    for pg in col.data.polygons:
        t = ((col.matrix_world @ pg.center).z - zmin) / h
        pg.material_index = 1 if (0.20 < t < 0.30 or 0.55 < t < 0.65) else 0
    log['faixas'] = sum(1 for pg in col.data.polygons if pg.material_index == 1)
    log['epi'] = {o.name: len(o.data.polygons) for o in (cap, abaf, oc, col)}
    arm.pose_position = 'POSE'
    salvar()
    # fotos antes/depois
    def mostrar_epi(on):
        for o in (cap, abaf, oc, col, bpy.data.objects.get('Gloves_014')):
            if o: o.hide_render = not on
        jq = bpy.data.objects.get('Glasses_004')
        if jq: jq.hide_render = True
    # ---- renders de conferência (Workbench)
    cam_d = bpy.data.cameras.new('cam'); cam = bpy.data.objects.new('cam', cam_d); sc.collection.objects.link(cam); sc.camera = cam
    cam_d.lens = 50
    sc.render.engine = 'BLENDER_WORKBENCH'; sc.render.resolution_x = 640; sc.render.resolution_y = 640
    try: sc.render.image_settings.media_type = 'IMAGE'
    except Exception: pass
    sc.render.image_settings.file_format = 'PNG'
    sc.display.shading.light = 'STUDIO'; sc.display.shading.color_type = 'MATERIAL'
    centro = rig.matrix_world @ (rest('Hips').head_local)
    VISIVEIS = {'Body_010', 'Male_emotion_usual_001', 'T_Shirt_009', 'Pants_014', 'Shoe_Sneakers_009', 'Gloves_014',
                'SM_Char_Operador_EPI_Capacete', 'SM_Char_Operador_EPI_Abafador', 'SM_Char_Operador_EPI_Oculos', 'SM_Char_Operador_EPI_Colete'}
    for o in bpy.data.objects:
        if o.type == 'MESH': o.hide_render = o.name not in VISIVEIS
    def foto(nome, acao, f, dirv):
        usar(bpy.data.actions[acao]); sc.frame_set(f); bpy.context.view_layer.update()
        dw = (rig.matrix_world.to_3x3() @ dirv).normalized()
        c = rig.matrix_world @ pb['Hips'].head
        cam.location = c + dw * 4.0 + Vector((0, 0, 0.15))
        cam.rotation_mode = 'QUATERNION'
        cam.rotation_quaternion = (c - cam.location).to_track_quat('-Z', 'Y')
        sc.render.filepath = os.path.join(OUT, 'anim_' + nome + '.png')
        bpy.ops.render.render(write_still=True)
    sc.render.film_transparent = False
    cam_d.lens = 65
    mostrar_epi(False)
    foto('epi_antes_34', 'Idle_Breathing', 10, F + S * 0.6)
    log['camiseta'] = [len(bpy.data.objects['T_Shirt_009'].data.polygons), [m.name for m in bpy.data.objects['T_Shirt_009'].data.materials]]
    mostrar_epi(True)
    foto('epi_depois_34', 'Idle_Breathing', 10, F + S * 0.6)
    foto('epi_depois_lado', 'Idle_Breathing', 10, S)
    foto('epi_depois_costas', 'Idle_Breathing', 10, -F + S * 0.4)
    foto('epi_andando', 'Walk_Forward', 9, F * 0.5 + S)
    foto('epi_sentado', 'Sit_Forklift', 0, F + S * 0.5)
    # close da cabeça
    usar(bpy.data.actions['Idle_Breathing']); sc.frame_set(10); bpy.context.view_layer.update()
    c = rig.matrix_world @ pb['Head'].head + Vector((0, 0, 0.12))
    dw = (rig.matrix_world.to_3x3() @ (F + S * 0.7)).normalized()
    cam.location = c + dw * 1.2; cam.rotation_mode = 'QUATERNION'; cam.rotation_quaternion = (c - cam.location).to_track_quat('-Z', 'Y')
    sc.render.filepath = os.path.join(OUT, 'anim_epi_cabeca.png'); bpy.ops.render.render(write_still=True)
    # ---- exporta
    bpy.data.objects.remove(cam, do_unlink=True)
    rig.animation_data.action = None
    for o in bpy.data.objects: o.hide_set(False); o.hide_viewport = False; o.hide_render = False
    bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, 'personagens_ithappy.glb'), export_format='GLB',
        export_animations=True, export_animation_mode='ACTIONS', use_visible=False, use_selection=False)
    log['export'] = 'ok'
except Exception as e:
    log['erros'].append(traceback.format_exc()[-2500:])
salvar(); print('ANIM: fim', log.get('export'), len(log['erros']))
