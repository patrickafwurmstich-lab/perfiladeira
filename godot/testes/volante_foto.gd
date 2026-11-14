extends Node
func _ready() -> void:
	var main = load("res://cenas/main.tscn").instantiate()
	add_child(main)
	for i in 10: await get_tree().physics_frame
	main.hud.visible = false
	var E: Empilhadeira = main.empilhadeira
	var dir: String = OS.get_cmdline_user_args()[0]
	var cam := Camera3D.new(); add_child(cam); cam.fov = 45
	var vistas := {"lado": [Vector3(1.2, 1.5, 0.0), Vector3(0, 1.35, 0.0)], "cima": [Vector3(0.3, 2.1, -0.6), Vector3(0, 1.35, 0.0)], "frente": [Vector3(0.4, 1.6, 1.3), Vector3(0, 1.35, 0.0)]}
	for nome in vistas:
		cam.global_position = E.to_global(vistas[nome][0])
		cam.look_at(E.to_global(vistas[nome][1]))
		for k in 3:
			cam.make_current(); await get_tree().process_frame
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png(dir + "/vol_%s.png" % nome)
	get_tree().quit()
