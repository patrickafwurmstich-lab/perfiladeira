extends Node
## fotos: motorista sentado na empilhadeira (mãos no volante), rodas girando/esterçando
var cam: Camera3D
var dir := ""
func foto(nome: String, E: Node3D, p: Vector3, alvo: Vector3) -> void:
	cam.global_position = E.to_global(p)
	cam.look_at(E.to_global(alvo))
	for k in 3:
		cam.make_current()
		await get_tree().process_frame
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png(dir + "/emp_%s.png" % nome)
func _ready() -> void:
	var main = load("res://cenas/main.tscn").instantiate()
	add_child(main)
	for i in 10: await get_tree().physics_frame
	main.hud.visible = false
	var E: Empilhadeira = main.empilhadeira
	dir = OS.get_cmdline_user_args()[0]
	cam = Camera3D.new()
	add_child(cam)
	cam.fov = 50
	E._faz()
	for i in 14: await get_tree().physics_frame
	await foto("subindo1", E, Vector3(3.4, 1.4, 0.6), Vector3(0.5, 1.0, -0.8))
	for i in 18: await get_tree().physics_frame
	await foto("subindo2", E, Vector3(3.4, 1.4, 0.6), Vector3(0.5, 1.0, -0.8))
	for i in 60: await get_tree().physics_frame
	await foto("lado", E, Vector3(3.2, 1.4, -0.6), Vector3(0, 1.1, -0.6))
	await foto("frente34", E, Vector3(2.2, 2.0, 3.0), Vector3(0, 1.1, -0.6))
	E.operando = false
	E.comando = Vector3(0.6, 1.0, 0)
	for i in 70: await get_tree().physics_frame
	E.comando = Vector3(0.0, 1.0, 0)
	for i in 5: await get_tree().physics_frame
	await foto("curva", E, Vector3(-2.6, 1.6, -2.6), Vector3(0, 0.8, -0.8))
	await foto("volante", E, Vector3(0.7, 2.3, -1.6), Vector3(0, 1.3, 0.0))
	E.comando = Vector3.ZERO
	for i in 40: await get_tree().physics_frame
	await foto("volante_reto", E, Vector3(0.7, 2.3, -1.6), Vector3(0, 1.3, 0.0))
	get_tree().quit()
