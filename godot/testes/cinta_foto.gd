extends Node
func _ready() -> void:
	var main = load("res://cenas/main.tscn").instantiate()
	add_child(main)
	for i in 10: await get_tree().physics_frame
	var P: PonteRolante = main.ponte
	main.hud.visible = false
	var b0 = P.bobinas[1]
	var c: Vector3 = b0.no.global_position
	P.x = c.x; P.z = c.z; P.h = c.y + b0.r + 0.05
	await get_tree().physics_frame
	P._engatar_ou_soltar()
	P.h = c.y + P.off_carga + 0.6
	for i in 20: await get_tree().physics_frame
	var cam := Camera3D.new()
	add_child(cam)
	cam.global_position = c + Vector3(1.9, 1.3, 1.7)
	cam.look_at(c + Vector3(0, 0.8, 0))
	cam.current = true
	for i in 6: await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0])
	var base: String = OS.get_cmdline_user_args()[0].get_basename()
	# close do gancho (olhais) e da boca do furo (manga de proteção)
	cam.global_position = Vector3(P.x, P.h, P.z) + Vector3(0.55, 0.15, 0.55)
	cam.look_at(Vector3(P.x, P.h + 0.05, P.z))
	for i in 4: await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(base + "_gancho.png")
	var pc: Vector3 = b0.no.global_position
	cam.global_position = pc + Vector3(0.9, 0.55, 1.1)
	cam.look_at(pc + Vector3(0, 0.2, 0.55))
	for i in 4: await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(base + "_furo.png")
	# vista frontal ortográfica (perpendicular ao eixo da bobina): mede o V entre as pernas
	var eixo: Vector3 = b0.no.global_transform.basis.z.normalized()
	var lado := eixo.cross(Vector3.UP).normalized()
	var meio := (Vector3(P.x, P.h, P.z) + pc) * 0.5
	cam.projection = Camera3D.PROJECTION_ORTHOGONAL
	cam.size = 2.0
	cam.global_position = meio + lado * 4.0
	cam.look_at(meio)
	for i in 4: await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(base + "_frente.png")
	# vista pelo eixo (olhando dentro do furo): a fita entrando no núcleo
	cam.size = 1.1
	cam.global_position = pc + eixo * 4.0 + Vector3(0, 0.35, 0)
	cam.look_at(pc + Vector3(0, 0.35, 0))
	for i in 4: await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(base + "_eixo.png")
	var g: Vector3 = Vector3(P.x, P.h, P.z) + P.FUNDO_GANCHO
	print("V entre pernas: %.1f graus" % rad_to_deg((pc + eixo * 0.52 - g).angle_to(pc - eixo * 0.52 - g)))
	# close maior do gancho (perspectiva)
	cam.projection = Camera3D.PROJECTION_PERSPECTIVE
	cam.global_position = g + Vector3(0.32, 0.06, 0.30)
	cam.look_at(g + Vector3(0, -0.02, 0))
	for i in 4: await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(base + "_gancho2.png")
	get_tree().quit()
