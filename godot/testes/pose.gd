extends Node
## fotos de perto do personagem segurando a botoeira (frente, lado, 3/4)
func _ready() -> void:
	var main = load("res://cenas/main.tscn").instantiate()
	add_child(main)
	for i in 10: await get_tree().physics_frame
	var j = main.jogador
	var P = main.ponte
	main.hud.visible = false
	P.x = 20.0; P.z = 6.0; P.h = 4.0
	j.global_position = Vector3(P.x + 1.2, 0.05, P.z + 3.0)
	j.reset_physics_interpolation()
	j.visual.rotation.y = PI      # olhando para -Z (para a ponte)
	for i in 5: await get_tree().physics_frame
	P._pegar()
	for i in 90: await get_tree().physics_frame
	var cam := Camera3D.new()
	add_child(cam)
	cam.current = true
	cam.fov = 45
	var base: Vector3 = j.global_position
	var vistas := {"frente": Vector3(0.2, 1.4, -2.0), "lado": Vector3(-2.0, 1.3, 0.0), "tres_quartos": Vector3(-1.4, 1.6, -1.4)}
	var dir: String = OS.get_cmdline_user_args()[0]
	for nome in vistas:
		cam.global_position = base + vistas[nome]
		cam.look_at(base + Vector3(0, 1.1, 0))
		for i in 4: await get_tree().process_frame
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("%s/pose_%s.png" % [dir, nome])
	print("mao ", j.mao.global_position if j.mao else "sem", " botoeira ", P.botoeira.global_position, " ik ", j.ik_braco.influence if j.ik_braco else -1)
	get_tree().quit()
