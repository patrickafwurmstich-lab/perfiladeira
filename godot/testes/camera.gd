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
	# anda rente à máquina (a câmera roça nas proteções): não pode dar tranco
	maior = 0.0
	j.yaw = PI / 2
	for i in 150:
		j.global_position = m.to_global(Vector3(-6.0 + i * 0.04, 0.05, 1.05))
		await get_tree().process_frame
		if i > 2:
			maior = maxf(maior, j.cam.global_position.distance_to(ant))
		ant = j.cam.global_position
	var rente := maior - 0.04   # descontando o próprio passo do jogador
	print("CAMERA caminho %.2f m · entrar: maior passo %.3f m/quadro · sair: %.3f · rente à máquina: %.3f" % [caminho, entrar, sair, rente])
	var ok := entrar < caminho / 8.0 and sair < caminho / 8.0 and rente < 0.15
	print("RESULTADO: ", "ok" if ok else "FALHA")
	get_tree().quit(0 if ok else 1)
