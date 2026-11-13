extends Node
## Opera a ponte COMO O JOGADOR: teclas (F desce, G engata, R sobe) — sem mexer em variáveis internas.
var falhas := 0
func ok(c: bool, t: String) -> void:
	print(("  ok  " if c else "  FALHA  ") + t)
	if not c: falhas += 1
func tecla(k: Key, segura := 0.0) -> void:
	var e := InputEventKey.new()
	e.physical_keycode = k
	e.keycode = k
	e.pressed = true
	Input.parse_input_event(e)
	if segura > 0.0:
		await get_tree().create_timer(segura).timeout
	var e2 := e.duplicate()
	e2.pressed = false
	Input.parse_input_event(e2)
	await get_tree().physics_frame
	await get_tree().physics_frame
func _ready() -> void:
	var main = load("res://cenas/main.tscn").instantiate()
	add_child(main)
	for i in 10: await get_tree().physics_frame
	var P: PonteRolante = main.ponte
	var j = main.jogador
	var b0 = P.bobinas[0]
	var c: Vector3 = b0.no.global_position
	# ponte parada a ~25 cm do centro da bobina (como um jogador mira), gancho a 3 m
	P.x = c.x + 0.2; P.z = c.z - 0.15; P.h = 3.0
	j.global_position = Vector3(c.x + 2.0, 0.05, c.z + 4.0)
	j.reset_physics_interpolation()
	await get_tree().physics_frame
	P._pegar()
	ok(Interacoes.modo == "ponte", "pegou a botoeira")
	await tecla(KEY_F, 25.0)       # segura F até o gancho parar em cima da bobina
	ok(absf(P.h - (c.y + b0.r + 0.02)) < 0.02, "gancho parou EM CIMA da bobina (h %.2f, topo %.2f)" % [P.h, c.y + b0.r])
	await tecla(KEY_G)
	ok(P.carga != null, "G engatou a bobina")
	var antes: Vector3 = b0.no.global_position
	await get_tree().physics_frame
	ok(b0.no.global_position.distance_to(antes) < 0.02, "engatar não teleporta a bobina")
	await tecla(KEY_R, 3.0)
	ok(absf(b0.no.global_position.y - c.y) < 0.01, "cinta ainda frouxa: bobina parada no berço enquanto o gancho sobe")
	await tecla(KEY_R, 14.0)      # pernas de 1,55 m: a cinta leva mais tempo para esticar
	ok(b0.no.global_position.y > c.y + 0.5, "R levantou a bobina (centro %.2f m)" % b0.no.global_position.y)
	await tecla(KEY_G)
	ok(P.carga != null, "não solta no ar")
	await tecla(KEY_F, 18.0)
	await get_tree().create_timer(3.0).timeout
	ok(absf(b0.no.global_position.y - P.Y_BERCO) < 0.01, "descendo, a bobina para no berço (não afunda): centro %.2f" % b0.no.global_position.y)
	await tecla(KEY_G)
	ok(P.carga == null and absf(b0.no.global_position.y - P.Y_BERCO) < 0.01, "desceu e soltou de volta NO BERÇO (centro %.2f)" % b0.no.global_position.y)
	print("RESULTADO: ", "ok" if falhas == 0 else "FALHA")
	get_tree().quit(1 if falhas else 0)
