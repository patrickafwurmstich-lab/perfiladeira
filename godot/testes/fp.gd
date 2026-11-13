extends Node
func _ready() -> void:
	var main = load("res://cenas/main.tscn").instantiate()
	add_child(main)
	for i in 10: await get_tree().process_frame
	var j = main.jogador
	Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	main.hud.visible = false
	var y_ini: float = j.yaw
	main.hud.visible = true
	for modo in [true, true]:
		j.primeira_pessoa = modo
		for i in 10: await get_tree().process_frame
		var b0: Vector3 = -j.cam.global_transform.basis.z
		var y0: float = j.yaw
		for i in 20:
			var ev := InputEventMouseMotion.new()
			ev.relative = Vector2(15, 0)
			ev.position = get_viewport().get_visible_rect().size * 0.5   # mouse preso = ponteiro no centro (em cima da mira)
			ev.global_position = ev.position
			get_viewport().push_input(ev)
			await get_tree().process_frame
		var b1: Vector3 = -j.cam.global_transform.basis.z
		await RenderingServer.frame_post_draw
		get_viewport().get_texture().get_image().save_png("/tmp/claude-0/-home-claude/7d2cc255-f58b-5285-97b1-f4ca9d497ea3/scratchpad/fp_%s.png" % str(modo))
		print("1P=%s yaw %.2f->%.2f  olhar %s -> %s  mouse=%d" % [modo, y0, j.yaw, b0, b1, Input.mouse_mode])
	var ok: bool = absf(j.yaw - y_ini) > 1.0 and absf(wrapf(j.visual.rotation.y - (j.yaw + PI), -PI, PI)) < 0.01 and j.cam.global_position.distance_to(j.get_global_transform_interpolated().origin + Vector3(0, 1.62, 0)) < 0.2
	print("RESULTADO: ", "ok" if ok else "FALHA")
	get_tree().quit()
