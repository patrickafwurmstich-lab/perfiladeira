extends Node
func _ready() -> void:
	var arq: String = OS.get_cmdline_user_args()[0]
	var g: Node3D = load(arq).instantiate()
	add_child(g)
	await get_tree().process_frame
	for mi in g.find_children("*", "MeshInstance3D", true, false):
		var bb: AABB = mi.global_transform * mi.get_aabb()
		var c := bb.get_center()
		print("%-22s c(%.2f,%.2f,%.2f) tam(%.2f,%.2f,%.2f) pai %s" % [mi.name, c.x, c.y, c.z, bb.size.x, bb.size.y, bb.size.z, mi.get_parent().name])
	get_tree().quit()
