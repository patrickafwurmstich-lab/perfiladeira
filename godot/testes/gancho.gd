extends Node
func _ready() -> void:
	var g: Node3D = load("res://modelos/ponte_gancho.glb").instantiate()
	add_child(g)
	await get_tree().process_frame
	for mi in g.find_children("*", "MeshInstance3D", true, false):
		var bb: AABB = mi.global_transform * mi.get_aabb()
		print(mi.name, " y ", snappedf(bb.position.y, 0.01), "..", snappedf(bb.end.y, 0.01), " x ", snappedf(bb.position.x,0.01), "..", snappedf(bb.end.x,0.01))
	get_tree().quit()
