extends Node
## Liga a perfiladeira como o jogador faria: anda até o quadro, aperta E, clica no disjuntor com o mouse.
func tecla(code: Key) -> void:
	var e := InputEventKey.new(); e.keycode = code; e.physical_keycode = code; e.pressed = true
	Input.parse_input_event(e)
	await get_tree().process_frame
	var u := e.duplicate(); u.pressed = false
	Input.parse_input_event(u)
	await get_tree().process_frame

func clicar_em(p: Vector3) -> void:
	var cam := get_viewport().get_camera_3d()
	var s := cam.unproject_position(p)
	print("  clique em tela ", s, " (cam ", cam.global_position, ")")
	var e := InputEventMouseButton.new(); e.button_index = MOUSE_BUTTON_LEFT; e.pressed = true; e.position = s; e.global_position = s
	Input.parse_input_event(e)
	await get_tree().process_frame
	var u := e.duplicate(); u.pressed = false
	Input.parse_input_event(u)
	for i in 5: await get_tree().process_frame

func _ready() -> void:
	Bus.aviso.connect(func(t): print("   AVISO: ", t))
	var main = load("res://cenas/main.tscn").instantiate()
	add_child(main)
	for i in 20: await get_tree().physics_frame
	var j = main.jogador
	var q = main.quadro
	j.global_position = q.to_global(Vector3(0, 0.05, 1.3))
	j.reset_physics_interpolation()
	j.yaw = q.global_rotation.y        # de frente para o quadro
	for i in 20: await get_tree().process_frame
	print("alvo: ", j.alvo.texto() if j.alvo else "NENHUM", "  yaw ", j.yaw)
	if j.alvo == null:
		for y in [0.0, PI / 2, PI, -PI / 2]:
			j.yaw = y
			for i in 5: await get_tree().process_frame
			print("  yaw ", y, " alvo ", j.alvo.texto() if j.alvo else "-")
	await tecla(KEY_E)
	for i in 5: await get_tree().process_frame
	print("depois 1º E: alvo ", j.alvo.texto() if j.alvo else "NENHUM", " aberta ", q.aberta)
	await tecla(KEY_E)
	for i in 90: await get_tree().process_frame
	print("modo ", Interacoes.modo)
	await clicar_em(q.to_global(Vector3(-0.42, 1.35, 0.18)))
	print("energia perfiladeira: ", main.maquina.energia)
	await tecla(KEY_ESCAPE)
	for i in 30: await get_tree().process_frame
	print("modo ", Interacoes.modo)
	# caixa de comando da perfiladeira
	var m = main.maquina
	var cx = m.caixa
	var it: Interagivel = null
	for n in cx.get_children():
		if n is Interagivel: it = n
	var frente: Vector3 = it.global_position - cx.global_position
	frente.y = 0
	j.global_position = it.global_position + frente.normalized() * 0.6 - Vector3(0, it.global_position.y - 0.05, 0)
	j.reset_physics_interpolation()
	var d := -frente.normalized()
	j.yaw = atan2(-d.x, -d.z)
	for i in 20: await get_tree().process_frame
	print("alvo na caixa: ", j.alvo.texto() if j.alvo else "NENHUM")
	if j.alvo == null:
		for y in [0.0, PI / 2, PI, -PI / 2]:
			j.yaw = y
			for i in 5: await get_tree().process_frame
			if j.alvo: print("  achou com yaw ", y, ": ", j.alvo.texto()); break
	await tecla(KEY_E)
	for i in 90: await get_tree().process_frame
	print("modo ", Interacoes.modo)
	var bots := {}
	for n in cx.find_children("*", "StaticBody3D", true, false):
		if n.has_meta("botao"): bots[n.get_meta("botao")] = n
	for id in ["chave", "reset"]:
		await clicar_em(bots[id].global_position)
		print(id, " -> chave_geral ", m.chave_geral, " pode_mover '", m.pode_mover(), "'")
	await clicar_em(bots["liga"].global_position)
	print("rodando ", m.rodando)
	get_tree().quit()
