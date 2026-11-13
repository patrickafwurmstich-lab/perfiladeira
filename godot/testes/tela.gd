extends Node
func shot(cam: Camera3D, p: Vector3, a: Vector3, nome: String) -> void:
	cam.global_position = p
	cam.look_at(a)
	for i in 4: await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0] + "/" + nome + ".png")
func _ready() -> void:
	var main = load("res://cenas/main.tscn").instantiate()
	add_child(main)
	for i in 5: await get_tree().physics_frame
	var m = main.maquina
	main.hud.visible = false
	m.cmd_disjuntor(true); m.cmd_chave_geral(true); m.cmd_reset()
	m.bobina.cinta = false; m.fita = "solta"
	var cam := Camera3D.new()
	add_child(cam)
	cam.current = true
	await shot(cam, Vector3(-6.0, 1.5, 2.5), Vector3(-7.0, 0.8, 0), "d_solta")
	m.fita = "puxando"
	m.ponta_mao = Vector3(-5.9, 0.95, 1.0)
	await shot(cam, Vector3(-6.3, 1.8, 3.0), Vector3(-6.4, 0.9, 0), "d_puxando")
	m.fita = "enfiada"; m.cabeca = m.X_CORTE; m.peca_m = 1.2
	main.jogador.process_mode = Node.PROCESS_MODE_DISABLED
	for i in 3: await get_tree().physics_frame
	print("fita vis ", m.fita_malha.visible, " alim ", m.fita_alim.visible, " ", m.fita_alim.global_position, m.fita_alim.scale, " peca ", m.peca_malha.visible, m.peca_malha.global_position, m.peca_malha.scale, " aabb ", m.fita_malha.get_aabb(), " tree ", m.fita_alim.is_visible_in_tree())
	await shot(cam, Vector3(-3.0, 3.0, 0.3), Vector3(-3.0, 0.9, 0), "d_topo")
	await shot(cam, Vector3(-5.6, 1.6, 2.0), Vector3(-5.6, 0.9, 0), "d_entrada")
	await shot(cam, Vector3(6.0, 1.6, 2.2), Vector3(5.6, 0.9, 0), "d_saida")
	get_tree().quit()
