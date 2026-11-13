extends Node3D
## Cena da fatia vertical: barracão, perfiladeira TP-40, caixa de comando, quadro elétrico e o operador.

var maquina: Perfiladeira
var jogador: Jogador
var hud: HUD
var quadro: QuadroEletrico
var ponte: PonteRolante
var corte: LinhaCorte
var dobradeira: Dobradeira

func _ready() -> void:
	_ambiente()
	# piso de concreto com juntas a cada 6 m
	var piso := MeshInstance3D.new()
	var pm := PlaneMesh.new()
	pm.size = Vector2(140, 44)
	piso.mesh = pm
	piso.position = Vector3(45, 0, 0)
	var mp := StandardMaterial3D.new()
	mp.albedo_texture = _textura_piso()
	mp.uv1_scale = Vector3(140.0 / 6.0, 44.0 / 6.0, 1)
	mp.roughness = 0.9
	piso.material_override = mp
	add_child(piso)
	var chao := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var ws := WorldBoundaryShape3D.new()
	cs.shape = ws
	chao.add_child(cs)
	add_child(chao)
	var barracao: Node3D = load("res://modelos/barracao_estrutura.glb").instantiate()
	barracao.position = Vector3(45, 0, 0)
	add_child(barracao)
	maquina = Perfiladeira.new()
	maquina.name = "Perfiladeira"
	add_child(maquina)
	corte = LinhaCorte.new()
	corte.name = "LinhaCorte"
	corte.position = Vector3(3.0, 0, -9.0)
	add_child(corte)
	dobradeira = Dobradeira.new()
	dobradeira.name = "Dobradeira"
	dobradeira.position = Vector3(15.0, 0, 6.0)
	add_child(dobradeira)
	quadro = QuadroEletrico.new()
	quadro.maquina = maquina
	quadro.maquinas = {0: maquina, 1: corte}
	quadro.position = Vector3(-11.0, 0, 3.2)
	add_child(quadro)
	_armario_epi(Vector3(-12.6, 0, 5.6))
	ponte = PonteRolante.new()
	ponte.maquina = maquina
	ponte.maquinas = [maquina, corte]
	add_child(ponte)
	var berco_m := load("res://modelos/berco_bobina.glb")
	var cods := ["BOB-014", "BOB-015", "BOB-016"]
	for i in 3:
		var bx := -10.6 + i * 1.9
		var b: Node3D = berco_m.instantiate()
		b.position = Vector3(bx, 0.0, -4.5)
		b.rotation.y = PI / 2          # selas em V atravessadas: a bobina deita no mesmo sentido do mandril
		add_child(b)
		ponte.bercos.append(Vector3(bx, 0.55, -4.5))
		ponte.nova_bobina(Vector3(bx, 0.55, -4.5), cods[i])
	jogador = Jogador.new()
	jogador.maquina = maquina
	jogador.position = Vector3(-9.5, 0.05, 5.0)
	jogador.yaw = -0.4
	add_child(jogador)
	ponte.jogador = jogador
	hud = HUD.new()
	hud.jogador = jogador
	hud.maquina = maquina
	hud.maquinas = [maquina, corte, dobradeira]
	add_child(hud)
	Bus.aviso.emit("Bom dia! A perfiladeira está desligada. Siga a lista à esquerda: comece pelo quadro elétrico.")

func _ambiente() -> void:
	var we := WorldEnvironment.new()
	var env := Environment.new()
	var ceu := Sky.new()
	var sm := ProceduralSkyMaterial.new()
	sm.sky_top_color = Color(0.38, 0.55, 0.78)
	sm.sky_horizon_color = Color(0.72, 0.78, 0.84)
	sm.ground_bottom_color = Color(0.25, 0.24, 0.22)
	sm.ground_horizon_color = Color(0.55, 0.55, 0.52)
	ceu.sky_material = sm
	env.background_mode = Environment.BG_SKY
	env.sky = ceu
	env.ambient_light_source = Environment.AMBIENT_SOURCE_SKY
	env.ambient_light_energy = 0.45
	env.reflected_light_source = Environment.REFLECTION_SOURCE_SKY
	env.tonemap_mode = Environment.TONE_MAPPER_FILMIC
	env.tonemap_exposure = 0.95
	we.environment = env
	add_child(we)
	var sol := DirectionalLight3D.new()
	sol.rotation_degrees = Vector3(-55, -35, 0)
	sol.light_energy = 0.85
	sol.shadow_enabled = true
	sol.directional_shadow_max_distance = 40.0
	add_child(sol)
	# luminárias do galpão em cima da linha
	for x in [-6.0, 0.0, 6.0]:
		var l := OmniLight3D.new()
		l.position = Vector3(x, 7.5, 1.0)
		l.omni_range = 12.0
		l.light_energy = 0.5
		add_child(l)

func _textura_piso() -> ImageTexture:
	var n := 256
	var img := Image.create(n, n, false, Image.FORMAT_RGB8)
	var rng := RandomNumberGenerator.new()
	rng.seed = 3
	for y in n:
		for x in n:
			var c := 0.40 + rng.randf_range(-0.025, 0.025)
			if x < 2 or y < 2:
				c = 0.28
			img.set_pixel(x, y, Color(c, c * 0.98, c * 0.95))
	img.generate_mipmaps()
	return ImageTexture.create_from_image(img)

func _armario_epi(pos: Vector3) -> void:
	var a := Node3D.new()
	a.position = pos
	add_child(a)
	var corpo := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.9, 1.9, 0.5)
	corpo.mesh = bm
	corpo.position.y = 0.95
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.35, 0.45, 0.55)
	m.metallic = 0.4
	corpo.material_override = m
	a.add_child(corpo)
	var placa := Label3D.new()
	placa.text = "EPI\nUSO OBRIGATÓRIO"
	placa.font_size = 40
	placa.pixel_size = 0.004
	placa.position = Vector3(0, 1.45, 0.26)
	placa.modulate = Color(1, 0.85, 0.1)
	a.add_child(placa)
	var sb := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = bm.size
	cs.shape = bs
	cs.position.y = 0.95
	sb.add_child(cs)
	a.add_child(sb)
	Interagivel.criar(a, Vector3(0, 1.1, 0.6), func() -> String: return "Tirar o EPI" if Interacoes.epi else "Vestir o EPI (luva, óculos, protetor auricular)", _epi, 1.4)

func _epi() -> void:
	Interacoes.progresso("Vestindo o EPI..." if not Interacoes.epi else "Guardando o EPI...", 2.0, func():
		Interacoes.epi = not Interacoes.epi
		jogador.atualizar_epi()
		AudioServer.set_bus_volume_db(0, -6.0 if Interacoes.epi else 0.0)   # protetor auricular abafa o barulho
		Bus.aviso.emit("EPI vestido." if Interacoes.epi else "EPI guardado."))
