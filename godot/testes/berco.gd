extends Node
func _ready() -> void:
	var b: Node3D = load("res://modelos/berco_bobina.glb").instantiate()
	add_child(b)
	await get_tree().process_frame
	for mi in b.find_children("*", "MeshInstance3D", true, false):
		var bb: AABB = mi.global_transform * mi.get_aabb()
		print(mi.name, " pos ", bb.position.snapped(Vector3.ONE*0.01), " tam ", bb.size.snapped(Vector3.ONE*0.01))
	get_tree().quit()
