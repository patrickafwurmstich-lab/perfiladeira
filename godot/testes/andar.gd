extends Node
## Anda de verdade com o teclado (ação "frente") e mede: o corpo não pode dar "pulo" (teleporte)
## e a câmera não pode tremer em relação ao corpo (distância câmera-corpo estável).
func _ready() -> void:
	var main = load("res://cenas/main.tscn").instantiate()
	add_child(main)
	for i in 10: await get_tree().physics_frame
	var j = main.jogador
	j.global_position = Vector3(-10.0, 0.05, 6.5)
	j.reset_physics_interpolation()
	j.yaw = PI / 2           # olhando para -X... anda em linha reta
	for i in 20: await get_tree().process_frame
	Input.action_press("frente")
	var osso_max := 0.0
	var cam_var := 0.0
	var dists := []
	var esq: Skeleton3D = null
	if j.anim:
		for n in j.visual.find_children("*", "Skeleton3D", true, false): esq = n
	var hips_ant := Vector3.INF
	for i in 240:
		await get_tree().process_frame
		if esq:
			var h := esq.global_transform * esq.get_bone_global_pose(esq.find_bone("Hips")).origin
			if hips_ant != Vector3.INF:
				osso_max = maxf(osso_max, Vector2(h.x - hips_ant.x, h.z - hips_ant.z).length())
			hips_ant = h
		dists.append(j.cam.global_position.distance_to(j.get_global_transform_interpolated().origin))
	await RenderingServer.frame_post_draw
	if OS.get_cmdline_user_args().size() > 0:
		get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0])
	Input.action_release("frente")
	var media := 0.0
	for d in dists.slice(60): media += d
	media /= dists.size() - 60
	for d in dists.slice(60): cam_var = maxf(cam_var, absf(d - media))
	print("ANDAR anim=%s vel_nativa=%s · maior passo do quadril %.3f m/quadro · variação câmera-corpo %.3f m" % [str(j.anim != null), str(j.vel_nativa), osso_max, cam_var])
	var ok := osso_max < 0.12 and cam_var < 0.15
	print("RESULTADO: ", "ok" if ok else "FALHA")
	get_tree().quit(0 if ok else 1)
