extends Node3D
## Cena da fatia vertical: barracão, perfiladeira TP-40, caixa de comando, quadro elétrico e o operador.

var maquina: Perfiladeira
var jogador: Jogador
var hud: HUD
var quadro: QuadroEletrico

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
	quadro = QuadroEletrico.new()
	quadro.maquina = maquina
	quadro.position = Vector3(-11.0, 0, 3.2)
	add_child(quadro)
	jogador = Jogador.new()
	jogador.maquina = maquina
	jogador.position = Vector3(-9.5, 0.05, 5.0)
	jogador.yaw = -0.4
	add_child(jogador)
	hud = HUD.new()
	hud.jogador = jogador
	hud.maquina = maquina
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
