extends Node
## Mede a câmera quadro a quadro ao entrar e sair da caixa de comando e ao passar rente à máquina.
func _ready() -> void:
	var main = load("res://cenas/main.tscn").instantiate()
	add_child(main)
	for i in 10: await get_tree().physics_frame
	var j = main.jogador
	var m = main.maquina
	j.global_position = m.caixa.global_position + Vector3(0.0, 0.05, 1.3)
	j.yaw = 0.0
	for i in 30: await get_tree().process_frame
	var maior := 0.0
	var ant: Vector3 = j.cam.global_position
	var p0: Vector3 = j.cam.global_position
	m.caixa._usar()
	for i in 90:
		await get_tree().process_frame
		maior = maxf(maior, j.cam.global_position.distance_to(ant)); ant = j.cam.global_position
	var entrar := maior
	var caminho: float = p0.distance_to(j.cam.global_position)
	maior = 0.0
	Interacoes.sair_foco()
	for i in 90:
		await get_tree().process_frame
		maior = maxf(maior, j.cam.global_position.distance_to(ant)); ant = j.cam.global_position
	var sair := maior
	# anda DE VERDADE rente à máquina (a câmera roça nas proteções): não pode dar tranco
	maior = 0.0
	j.global_position = m.to_global(Vector3(-6.0, 0.05, 1.15))
	j.reset_physics_interpolation()
	j.yaw = -PI / 2
	for i in 20: await get_tree().process_frame
	ant = j.cam.global_position
	Input.action_press("frente")
	var pos_ant: Vector3 = j.get_global_transform_interpolated().origin
	for i in 240:
		await get_tree().process_frame
		var p: Vector3 = j.get_global_transform_interpolated().origin
		var passo := p.distance_to(pos_ant)
		pos_ant = p
		maior = maxf(maior, j.cam.global_position.distance_to(ant) - passo)
		ant = j.cam.global_position
	Input.action_release("frente")
	var rente := maior          # já descontado o próprio passo do jogador
	print("CAMERA caminho %.2f m · entrar: maior passo %.3f m/quadro · sair: %.3f · rente à máquina: %.3f" % [caminho, entrar, sair, rente])
	var ok := entrar < caminho / 8.0 and sair < caminho / 8.0 and rente < 0.15
	print("RESULTADO: ", "ok" if ok else "FALHA")
	get_tree().quit(0 if ok else 1)
