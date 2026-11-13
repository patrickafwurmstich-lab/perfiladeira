extends Node3D
func _ready() -> void:
	var l := DirectionalLight3D.new(); l.rotation_degrees = Vector3(-50, 30, 0); add_child(l)
	var we := WorldEnvironment.new(); var e := Environment.new(); e.background_mode = Environment.BG_COLOR; e.background_color = Color(0.3,0.3,0.35); e.ambient_light_color = Color.WHITE; e.ambient_light_source = Environment.AMBIENT_SOURCE_COLOR; we.environment = e; add_child(we)
	var a := MeshInstance3D.new(); a.mesh = Perfil.malha_chapa(2.0); a.material_override = Perfil.material_chapa(); add_child(a)
	var b := MeshInstance3D.new(); b.mesh = Perfil.malha_telha(2.0); b.material_override = Perfil.material_chapa(); b.position.z = 1.6; add_child(b)
	var bx := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(2, 0.001, 1.2); bx.mesh = bm; bx.material_override = Perfil.material_chapa(); bx.position = Vector3(1, 0, -1.6); add_child(bx)
	var cam := Camera3D.new(); add_child(cam); cam.position = Vector3(1, 2.5, 3.5); cam.look_at(Vector3(1, 0, 0)); cam.current = true
	for i in 5: await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(OS.get_cmdline_user_args()[0])
	get_tree().quit()
