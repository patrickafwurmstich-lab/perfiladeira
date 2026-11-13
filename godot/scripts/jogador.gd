class_name Jogador
extends CharacterBody3D
## Operador. 3ª pessoa (SpringArm, não atravessa parede) ou 1ª pessoa (V).
## O [E] escolhe o ponto de interação mais perto e na frente do olhar.
## No modo foco a câmera voa até o alvo (caixa de comando, manivelas) e volta depois.
## Câmera estilo GTA V: suporte separado do corpo (top_level) que segue a posição INTERPOLADA do
## personagem (física 60 Hz × tela) com leve atraso, órbita livre no mouse, ombro direito,
## colisão sem tranco e FOV um pouco maior correndo. O corpo vira suave para onde anda.

const VEL_ANDAR := 1.6
const VEL_CORRER := 3.6
const SENS := 0.0022
const OMBRO := 0.45              # deslocamento para a direita (câmera sobre o ombro)
const DIST := 3.0
const ALTURA_OLHO := 1.55
const ALT_CAPACETE := 0.215      # do osso Head (nuca) até a base do capacete, no espaço do osso
var vel_nativa := {}             # m/s que cada animação "anda" sozinha (para os pés não escorregarem)
var _fov_alvo := 70.0
var maquina
var primeira_pessoa := false
var yaw := 0.0
var pitch := -0.25
var braco: SpringArm3D
var cam: Camera3D
var cabeca: Node3D
var visual: Node3D
var anim: AnimationPlayer
var alvo: Interagivel = null
var _anim_atual := ""
var _cam_foco_t := 0.0
var _foco_xf: Transform3D        # última posição da câmera de foco (para voltar suave, sem pulo)
var _dist := 2.8                 # distância real da câmera (suavizada; o SpringArm só mede a colisão)
var _ignorar_mouse := 0.0        # ignora o 1º movimento depois de recapturar o mouse (evita o tranco)
var _modo_ant := "andar"
var _cam_xf_jogo: Transform3D

func _ready() -> void:
	var cs := CollisionShape3D.new()
	var cap := CapsuleShape3D.new()
	cap.radius = 0.3
	cap.height = 1.8
	cs.shape = cap
	cs.position.y = 0.9
	add_child(cs)
	# suporte da câmera: NÃO é filho "colado" do corpo (top_level) — segue suave a posição interpolada
	cabeca = Node3D.new()
	cabeca.top_level = true
	cabeca.physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	add_child(cabeca)
	braco = SpringArm3D.new()
	braco.spring_length = DIST
	braco.margin = 0.2
	braco.position = Vector3(OMBRO, 0, 0)
	braco.add_excluded_object(get_rid())
	cabeca.add_child(braco)
	cam = Camera3D.new()
	cam.fov = 70
	cam.near = 0.05
	cam.current = true
	cam.physics_interpolation_mode = Node.PHYSICS_INTERPOLATION_MODE_OFF
	cabeca.add_child(cam)
	_carregar_visual()
	cabeca.global_position = global_position + Vector3(0, ALTURA_OLHO, 0)
	if DisplayServer.get_name() != "headless":
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED

func _carregar_visual() -> void:
	var cam_p := "res://privado/personagens_ithappy.glb"
	if ResourceLoader.exists(cam_p):
		visual = load(cam_p).instantiate()
		var usar := ["Body_010", "Male_emotion_usual_001", "Outerwear_036", "Pants_014", "Shoe_Sneakers_009", "Gloves_014"]
		for mi in visual.find_children("*", "MeshInstance3D", true, false):
			mi.visible = mi.name in usar
		anim = visual.find_child("AnimationPlayer", true, false)
		_tirar_root_motion()
		atualizar_epi()
		# capacete amarelo preso no osso da cabeça
		var esq := visual.find_child("Skeleton*", true, false) as Skeleton3D
		if esq == null:
			for n in visual.find_children("*", "Skeleton3D", true, false):
				esq = n
		if esq and esq.find_bone("Head") >= 0:
			var ba := BoneAttachment3D.new()
			ba.bone_name = "Head"
			esq.add_child(ba)
			# capacete de segurança: casco + aba, apoiado no alto da cabeça (o osso Head fica na nuca)
			var m := StandardMaterial3D.new()
			m.albedo_color = Color(0.95, 0.95, 0.93)
			m.roughness = 0.35
			var c := MeshInstance3D.new()
			var sm := SphereMesh.new()
			sm.radius = 0.165
			sm.height = 0.15
			sm.is_hemisphere = true
			c.mesh = sm
			c.material_override = m
			c.position = Vector3(0, ALT_CAPACETE, 0.01)
			ba.add_child(c)
			var aba := MeshInstance3D.new()
			var cy := CylinderMesh.new()
			cy.top_radius = 0.185
			cy.bottom_radius = 0.19
			cy.height = 0.014
			aba.mesh = cy
			aba.material_override = m
			aba.position = Vector3(0, ALT_CAPACETE, 0.03)
			ba.add_child(aba)
		var aabb_alt := 1.86
		visual.scale = Vector3.ONE * (1.80 / aabb_alt)
	else:
		visual = Node3D.new()
		var mi := MeshInstance3D.new()
		var cm := CapsuleMesh.new()
		cm.radius = 0.28
		cm.height = 1.75
		mi.mesh = cm
		mi.position.y = 0.875
		var m := StandardMaterial3D.new()
		m.albedo_color = Color(0.2, 0.35, 0.6)
		mi.material_override = m
		visual.add_child(mi)
		var cap := MeshInstance3D.new()
		var sm := SphereMesh.new()
		sm.radius = 0.2
		sm.height = 0.25
		sm.is_hemisphere = true
		cap.mesh = sm
		var mc := StandardMaterial3D.new()
		mc.albedo_color = Color(0.96, 0.78, 0.29)
		cap.material_override = mc
		cap.position.y = 1.72
		visual.add_child(cap)
	add_child(visual)

## As animações do pacote andam o boneco para frente sozinhas (o osso Root vai 1,48 m por ciclo
## na caminhada) e voltam ao início no loop = "teleporte". Tira esse avanço (o script já anda)
## e guarda a velocidade nativa para casar o passo com a velocidade real.
func _tirar_root_motion() -> void:
	if anim == null:
		return
	for nome in anim.get_animation_list():
		var a := anim.get_animation(nome)
		for t in a.get_track_count():
			if a.track_get_type(t) != Animation.TYPE_POSITION_3D:
				continue
			var caminho := String(a.track_get_path(t))
			if not caminho.ends_with(":Root"):
				continue
			var n := a.track_get_key_count(t)
			if n < 2:
				continue
			var ini: Vector3 = a.track_get_key_value(t, 0)
			var fim: Vector3 = a.track_get_key_value(t, n - 1)
			var dur := a.track_get_key_time(t, n - 1) - a.track_get_key_time(t, 0)
			if dur > 0.0:
				vel_nativa[nome] = Vector2(fim.x - ini.x, fim.z - ini.z).length() / dur * visual.scale.x
			for k in n:
				var v: Vector3 = a.track_get_key_value(t, k)
				a.track_set_key_value(t, k, Vector3(ini.x, v.y, ini.z))

func atualizar_epi() -> void:
	if visual == null:
		return
	for mi in visual.find_children("*", "MeshInstance3D", true, false):
		if mi.name == "Glasses_004":
			mi.visible = Interacoes.epi
		elif mi.name == "Gloves_014":
			mi.visible = Interacoes.epi

func _tocar(nome: String) -> void:
	if anim == null or _anim_atual == nome:
		return
	if anim.has_animation(nome):
		var a := anim.get_animation(nome)
		a.loop_mode = Animation.LOOP_LINEAR
		anim.play(nome, 0.25)
		_anim_atual = nome

func _unhandled_input(ev: InputEvent) -> void:
	if Interacoes.modo != "andar":
		return
	if ev is InputEventMouseMotion and Input.mouse_mode == Input.MOUSE_MODE_CAPTURED:
		if _ignorar_mouse > 0.0:
			return
		var rel: Vector2 = ev.relative.limit_length(120.0)    # nenhum tranco grande de uma vez
		yaw -= rel.x * SENS
		pitch = clampf(pitch - rel.y * SENS, -1.2, 0.9)
	elif ev is InputEventMouseButton and ev.pressed:
		if ev.button_index == MOUSE_BUTTON_LEFT and Input.mouse_mode != Input.MOUSE_MODE_CAPTURED:
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
			_ignorar_mouse = 0.15
		elif ev.button_index == MOUSE_BUTTON_WHEEL_UP and not primeira_pessoa:
			braco.spring_length = maxf(1.2, braco.spring_length - 0.3)
		elif ev.button_index == MOUSE_BUTTON_WHEEL_DOWN and not primeira_pessoa:
			braco.spring_length = minf(6.0, braco.spring_length + 0.3)
	elif ev.is_action_pressed("camera"):
		primeira_pessoa = not primeira_pessoa
	elif ev.is_action_pressed("interagir") and alvo:
		alvo.acao.call()
		get_viewport().set_input_as_handled()
	elif ev.is_action_pressed("sair"):
		Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	elif ev.is_action_pressed("relogio"):
		Relogio.alternar_vel()

func _physics_process(delta: float) -> void:
	var dir := Vector3.ZERO
	var pode := Interacoes.modo == "andar"
	if pode:
		var i := Input.get_vector("esquerda", "direita", "frente", "tras")
		dir = (Basis(Vector3.UP, yaw) * Vector3(i.x, 0, i.y))
	var vel := VEL_CORRER if Input.is_action_pressed("correr") else VEL_ANDAR
	# puxando a chapa: anda devagar e não pode passar do comprimento que a bobina solta
	if maquina and maquina.fita == "puxando":
		vel = 1.0
	velocity.x = dir.x * vel
	velocity.z = dir.z * vel
	if not is_on_floor():
		velocity.y -= 9.8 * delta
	else:
		velocity.y = 0.0
	move_and_slide()
	if maquina and maquina.fita == "puxando":
		var local: Vector3 = maquina.to_local(global_position)
		var desb := Vector3(maquina.X_DESB, 0, 0)
		if local.x < maquina.X_DESB - 0.5 or local.distance_to(desb) > 3.2:
			# a chapa estica: não deixa ir além
			var lim := desb + (Vector3(local.x, 0, local.z) - desb).limit_length(3.2)
			global_position = maquina.to_global(Vector3(lim.x, local.y, lim.z))
		var mao: Vector3 = maquina.to_local(global_position + Vector3(0, 0.95, 0))
		maquina.ponta_mao = mao
	# animação e direção do corpo
	var vh := Vector2(velocity.x, velocity.z).length()
	if dir.length() > 0.1 and vh > 0.05:
		# vira suave para onde anda (independe do FPS)
		visual.rotation.y = lerp_angle(visual.rotation.y, atan2(dir.x, dir.z), 1.0 - exp(-10.0 * delta))
		var nome := "Run_Forward" if vel > 2.0 else "Walk_Forward"
		_tocar(nome)
		if anim and vel_nativa.has(nome) and vel_nativa[nome] > 0.1:
			anim.speed_scale = clampf(vh / vel_nativa[nome], 0.5, 2.0)
	else:
		_tocar("Idle_Breathing")
		if anim:
			anim.speed_scale = 1.0
	_fov_alvo = 76.0 if vh > 2.5 else 70.0

func _process(delta: float) -> void:
	_ignorar_mouse = maxf(0.0, _ignorar_mouse - delta)
	# segue a posição interpolada do corpo (sem tremido entre física e tela), com leve atraso
	var corpo := get_global_transform_interpolated().origin + Vector3(0, ALTURA_OLHO, 0)
	cabeca.global_position = cabeca.global_position.lerp(corpo, 1.0 - exp(-16.0 * delta))
	if cabeca.global_position.distance_to(corpo) > 3.0:
		cabeca.global_position = corpo          # teleporte de verdade (spawn): não arrasta
	cabeca.rotation = Vector3(pitch, yaw, 0)
	cam.fov = lerpf(cam.fov, _fov_alvo, 1.0 - exp(-4.0 * delta))
	# saiu do foco (caixa de comando, ponte, manivelas): recaptura o mouse e ignora o 1º movimento
	if _modo_ant == "foco" and Interacoes.modo != "foco":
		if DisplayServer.get_name() != "headless":
			Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
		_ignorar_mouse = 0.2
	_modo_ant = Interacoes.modo
	var alvo_dist: float
	if primeira_pessoa:
		braco.spring_length = 0.0
		braco.position = Vector3(0, 0.05, -0.1)
		visual.visible = false
		_dist = 0.0
		alvo_dist = 0.0
	else:
		if braco.spring_length < 1.2:
			braco.spring_length = DIST
		braco.position = Vector3(OMBRO, 0, 0)
		visual.visible = true
		# aproxima rápido se bater em algo (não atravessa parede), afasta devagar (sem "pulos")
		alvo_dist = braco.get_hit_length()
		if alvo_dist < _dist:
			_dist = move_toward(_dist, alvo_dist, delta * 10.0)
		else:
			_dist = move_toward(_dist, alvo_dist, delta * 2.0)
	var xf_jogo := Transform3D(Basis(), braco.position + Vector3(0, 0, _dist))
	# câmera em foco: interpola até o alvo e volta pelo mesmo caminho
	if Interacoes.modo == "foco" and Interacoes.foco_alvo:
		_foco_xf = Interacoes.foco_alvo.global_transform
		_cam_foco_t = minf(1.0, _cam_foco_t + delta * 2.5)
	else:
		_cam_foco_t = maxf(0.0, _cam_foco_t - delta * 2.5)
	if _cam_foco_t > 0.0:
		var k := smoothstep(0.0, 1.0, _cam_foco_t)
		var g_jogo := cabeca.global_transform * xf_jogo
		cam.global_transform = g_jogo.interpolate_with(_foco_xf, k)
	else:
		cam.transform = xf_jogo
	_escolher_alvo()

func _escolher_alvo() -> void:
	alvo = null
	if Interacoes.modo != "andar":
		return
	var melhor := 1e9
	var frente := -cam.global_transform.basis.z
	frente.y = 0
	frente = frente.normalized()
	for n in get_tree().get_nodes_in_group("interagivel"):
		var it := n as Interagivel
		if not it.is_visible_in_tree():
			continue
		var d := it.global_position - (global_position + Vector3(0, 1.0, 0))
		var dh := Vector2(d.x, d.z)
		if dh.length() > it.raio:
			continue
		var dirh := Vector3(d.x, 0, d.z).normalized()
		if dh.length() > 0.5 and dirh.dot(frente) < 0.25:
			continue
		var t := it.texto()
		if t == "":
			continue
		var custo := dh.length() - dirh.dot(frente) * 0.5
		if custo < melhor:
			melhor = custo
			alvo = it
