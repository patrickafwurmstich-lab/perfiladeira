extends Node
func _ready() -> void:
	for arq in ["res://modelos/perfiladeira_tp40.glb", "res://modelos/guilhotina.glb"]:
		var g: Node3D = load(arq).instantiate()
		add_child(g)
		for nome in ["lamina", "mandril_desbobinador", "rolo_inf_0", "rolo_endireitador_0", "rolo_puxador", "batente", "mesa_entrada"]:
			var n := g.find_child(nome, true, false)
			if n: print(arq.get_file(), " ", nome, " pos ", n.position, " pai ", n.get_parent().name, " tipo ", n.get_class())
	get_tree().quit()
