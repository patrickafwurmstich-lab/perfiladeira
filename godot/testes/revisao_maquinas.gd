extends Node
## fotos para a revisão das IAs: dobradeira (cima/lado/alavancas), empilhadeira (frente com carga, lado),
## paleteira (close), amarrado (fitas/cantoneiras/pontaletes), caminhão (traseira, lado aberto, calços)
var cam: Camera3D
var dir := ""
var main
func foto(nome: String, p: Vector3, alvo: Vector3, orto := 0.0) -> void:
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL if orto > 0.0 else Camera3D.PROJECTION_PERSPECTIVE
	if orto > 0.0: cam.size = orto
	cam.global_position = p
	var up := Vector3.UP if absf((alvo - p).normalized().y) < 0.99 else Vector3(0, 0, -1)
	cam.look_at(alvo, up)
	for k in 3:
		cam.make_current()
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(dir + "/r_%s.png" % nome)
func _q(n := 1) -> void:
	for i in n: await get_tree().physics_frame
func _ready() -> void:
	dir = OS.get_cmdline_user_args()[0]
	main = load("res://cenas/main.tscn").instantiate()
	add_child(main)
	await _q(10)
	main.hud.visible = false
	cam = Camera3D.new(); add_child(cam); cam.fov = 50
	Interacoes.epi = true
	# --- dobradeira
	var d: Dobradeira = main.dobradeira
	d.cmd_colocar_tira(); d.ajustar_batente(200.0 - d.batente_mm)
	d.alavanca(0); d.alavanca(1)       # 2 fechadas (verde), 1 aberta (vermelha)
	await _q(2)
	await foto("dob_cima", d.to_global(Vector3(0, 4.5, 0.0)), d.to_global(Vector3(0, 0.9, 0.0)), 4.6)
	await foto("dob_alavancas", d.to_global(Vector3(1.2, 1.9, 1.6)), d.to_global(Vector3(0.5, 1.1, 0.0)))
	d.alavanca(2)
	d.puxar_avental(60.0)
	await _q(2)
	await foto("dob_lado_60", d.to_global(Vector3(2.6, 1.0, -0.4)), d.to_global(Vector3(0, 0.95, -0.3)), 1.4)
	d.puxar_avental(93.3)
	await _q(2)
	await foto("dob_lado_93", d.to_global(Vector3(2.6, 1.0, -0.4)), d.to_global(Vector3(0, 0.95, -0.3)), 1.4)
	d.puxar_avental(0.0)
	await _q(2)
	await foto("dob_lado_solto", d.to_global(Vector3(2.6, 1.0, -0.4)), d.to_global(Vector3(0, 0.95, -0.3)), 1.4)
	# corte na ponta da peça: raio da dobra e espessura (aperto aberto, viga levantada)
	d.cmd_aperto(false)
	await _q(2)
	await foto("dob_dobra_close", d.to_global(Vector3(1.03, 0.93, -0.37)), d.to_global(Vector3(0.0, 0.93, -0.37)), 0.10)
	# --- amarrado + empilhadeira
	var m: Perfiladeira = main.maquina
	for i in 40:
		var no := Node3D.new(); m.add_child(no); no.position = Vector3(m.X_PILHA, m.Y_PILHA0 + i * m.NINHO, 0)
		m.pilha.append({"L": 3.0, "curva": 0.0, "assim": 0.0, "defeito": ""}); m.pilha_nos.append(no)
	var am: Carga = m.embalar_pilha()
	await _q(2)
	await foto("amarrado_close", am.global_position + Vector3(1.3, 0.8, 1.4), am.global_position + Vector3(0.6, 0.15, 0))
	var E: Empilhadeira = main.empilhadeira
	var ez: Vector3 = am.global_transform.basis.z
	E.global_position = Vector3(am.global_position.x, 0, am.global_position.z) - ez * 2.0
	E.look_at(E.global_position - ez, Vector3.UP)
	E.reset_physics_interpolation()
	await _q(2)
	for i in 400:
		E.comando = Vector3(0.4, 0, 0); await _q()
		if E.carga_alvo()[1] == "": break
	E.comando = Vector3.ZERO; await _q(20)
	for i in 60:
		E.comando = Vector3(0, 0, 1); await _q()
	E.comando = Vector3.ZERO
	E._faz()      # motorista sentado
	await _q(30)
	await foto("emp_frente_carga", E.to_global(Vector3(0.6, 1.4, 5.5)), E.to_global(Vector3(0, 0.9, 1.0)))
	await foto("emp_lado_carga", E.to_global(Vector3(4.5, 1.3, 0.2)), E.to_global(Vector3(0, 1.0, 0.2)))
	Interacoes.sair_foco()
	# --- paleteira
	var P: Empilhadeira = main.paleteira
	d.pecas_palete = 12
	var pal := d.fechar_palete()
	P.global_position = Vector3(pal.global_position.x, 0, pal.global_position.z) - pal.global_transform.basis.z * 1.9
	P.look_at(P.global_position - pal.global_transform.basis.z, Vector3.UP)
	P.reset_physics_interpolation()
	await _q(2)
	for i in 300:
		P.comando = Vector3(0.6, 0, 0); await _q()
		if P.carga_alvo()[1] == "": break
	P.comando = Vector3.ZERO; await _q(30)
	await foto("pal_baixa", P.to_global(Vector3(1.8, 0.7, -0.3)), P.to_global(Vector3(0, 0.3, 0.0)))
	P.bombear(); P.bombear(); P.bombear(); P.bombear()
	await _q(2)
	await foto("pal_alta", P.to_global(Vector3(1.8, 0.7, -0.3)), P.to_global(Vector3(0, 0.3, 0.0)))
	# --- caminhão
	var C: Caminhao = main.caminhao
	var boa := Carga.criar(main, C.global_transform * Transform3D(Basis(), Vector3(-1.6, C.Y_PISO, 0)), "telha", 30, 90.0, 90.0 * 1.2 * 3.38, Vector3(3.0, 0.30, 1.10), "30 TELHAS 3,00 m · 370 kg")
	C.calcar(true)
	C.amarrar()
	await _q(3)
	await foto("cam_lado_aberto", C.to_global(Vector3(-1.0, 2.2, -7.0)), C.to_global(Vector3(-1.0, 1.0, 0)))
	await foto("cam_traseira", C.to_global(Vector3(-9.0, 2.4, -2.5)), C.to_global(Vector3(-2.0, 1.0, 0)))
	await foto("cam_calcos", C.to_global(Vector3(-4.2, 0.7, -2.6)), C.to_global(Vector3(-3.0, 0.3, -1.0)))
	get_tree().quit()
