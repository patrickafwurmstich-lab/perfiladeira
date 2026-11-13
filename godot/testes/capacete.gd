extends Node
func _ready() -> void:
	var main = load("res://cenas/main.tscn").instantiate()
	add_child(main)
	for i in 10: await get_tree().process_frame
	var j = main.jogador
	for ba in j.visual.find_children("*", "BoneAttachment3D", true, false):
		var esq: Skeleton3D = ba.get_parent()
		var c: MeshInstance3D = ba.get_child(0)
		print("osso Head global ", ba.global_position, " capacete ", c.global_position, " escala global ", ba.global_transform.basis.get_scale(), " visivel ", c.is_visible_in_tree(), " pai ", esq.name)
	print("corpo ", j.global_position)
	var cam := Camera3D.new()
	add_child(cam)
	cam.global_position = j.global_position + Vector3(0.9, 1.75, 1.3)
	cam.look_at(j.global_position + Vector3(0, 1.6, 0))
	cam.current = true
	main.hud.visible = false
	for i in 5: await get_tree().process_frame
	await RenderingServer.frame_post_draw
	if OS.get_cmdline_user_args().size() > 0:
		get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0])
	get_tree().quit()
