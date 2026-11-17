extends Node
## Fotos do operador com o EPI modelado no Blender, dentro do jogo (parado, andando, de costas, na empilhadeira)
var dir := ""
var cam: Camera3D
func foto(nome: String, de: Vector3, para: Vector3) -> void:
	cam.global_position = de
	cam.look_at(para)
	for k in 3:
		cam.make_current()
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(dir + "/epi_" + nome + ".png")

func _ready() -> void:
	dir = OS.get_cmdline_user_args()[0] if OS.get_cmdline_user_args().size() > 0 else "user://"
	var main = load("res://cenas/main.tscn").instantiate()
	add_child(main)
	cam = Camera3D.new(); cam.fov = 40
	add_child(cam)
	for i in 20: await get_tree().physics_frame
	var j = main.jogador
	for i in 2: await get_tree().process_frame
	var p0: Vector3 = j.global_position
	await foto("sem_epi", p0 + j.visual.global_transform.basis.z.normalized() * 2.6 + Vector3(0, 1.5, 0), p0 + Vector3(0, 1.0, 0))
	print("sem EPI: ", [j.visual.find_child("SM_Char_Operador_EPI_Capacete", true, false).visible])
	Interacoes.epi = true
	j.atualizar_epi()
	print("com EPI: ", [j.visual.find_child("SM_Char_Operador_EPI_Capacete", true, false).visible])
	j.global_position = Vector3(-9.0, 0.05, 7.0); j.reset_physics_interpolation(); j.yaw = 0.0
	for i in 30: await get_tree().process_frame
	var p: Vector3 = j.global_position
	var fw: Vector3 = j.visual.global_transform.basis.z.normalized()
	var ld: Vector3 = fw.cross(Vector3.UP).normalized()
	await foto("frente", p + fw * 2.6 + ld * 1.2 + Vector3(0, 1.5, 0), p + Vector3(0, 1.0, 0))
	await foto("cabeca", p + fw * 0.9 + ld * 0.5 + Vector3(0, 1.75, 0), p + Vector3(0, 1.62, 0))
	await foto("costas", p - fw * 2.6 + ld * 0.8 + Vector3(0, 1.5, 0), p + Vector3(0, 1.0, 0))
	Input.action_press("frente")
	for i in 40: await get_tree().process_frame
	p = j.global_position
	fw = j.visual.global_transform.basis.z.normalized(); ld = fw.cross(Vector3.UP).normalized()
	await foto("andando", p + ld * 3.0 + fw * 0.8 + Vector3(0, 1.3, 0), p + Vector3(0, 0.9, 0))
	Input.action_release("frente")
	var E = main.empilhadeira
	j.global_position = E.to_global(Vector3(1.5, 0.05, -0.5)); j.reset_physics_interpolation()
	for i in 5: await get_tree().physics_frame
	E._faz()
	for i in 90: await get_tree().physics_frame
	await foto("empilhadeira", E.to_global(Vector3(2.6, 2.0, 1.6)), E.to_global(Vector3(0, 1.3, -0.6)))
	get_tree().quit()
