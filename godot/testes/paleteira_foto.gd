extends Node
## fotos: operador empurrando a paleteira (mãos no timão, andando)
func _ready() -> void:
	var main = load("res://cenas/main.tscn").instantiate()
	add_child(main)
	for i in 10: await get_tree().physics_frame
	main.hud.visible = false
	var P: Empilhadeira = main.paleteira
	var j = main.jogador
	P._faz()
	var dir: String = OS.get_cmdline_user_args()[0]
	var cam := Camera3D.new()
	add_child(cam)
	cam.current = true
	for i in 60: await get_tree().physics_frame
	var vistas := {"parado": Vector3(2.2, 1.4, -1.0), "lado": Vector3(2.6, 1.2, -0.6)}
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = 3.5
	cam.global_position = P.to_global(Vector3(0, 6, -0.5))
	cam.look_at(P.to_global(Vector3(0, 0, -0.5)), Vector3(0, 0, 1))
	for k in 3:
		cam.make_current()
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(dir + "/pal_parado.png")
	cam.projection = Camera3D.PROJECTION_PERSPECTIVE
	P.comando = Vector3(1, 0, 0)
	P.operando = false   # usa o comando do teste, mas mantém o jogador preso
	for i in 50: await get_tree().physics_frame
	cam.global_position = P.to_global(Vector3(1.6, 2.0, -3.2))
	cam.look_at(P.to_global(Vector3(0, 0.8, -0.6)))
	for k in 3:
		cam.make_current()
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(dir + "/pal_andando.png")
	print("jog fw ", j.visual.global_transform.basis.z, " P fw ", P.global_transform.basis.z, " jog ", j.global_position, " P ", P.global_position)
	print("v ", P.v, " anim ", j.anim.current_animation if j.anim else "-", " scale ", j.anim.speed_scale if j.anim else 0)
	get_tree().quit()
