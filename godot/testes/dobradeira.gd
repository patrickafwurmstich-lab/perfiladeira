extends Node
## Dobradeira manual, como um jogador: EPI, tira, batente, aperto, avental, retorno elástico, conferência.
var main
var d: Dobradeira
var falhas := 0
var oks := 0
var fotos := ""
func ok(c: bool, t: String) -> void:
	if c: oks += 1
	else: falhas += 1
	print(("  ok  " if c else "  FALHA  ") + t)
func _q(n := 1) -> void:
	for i in n: await get_tree().physics_frame
func foto(nome: String) -> void:
	if DisplayServer.get_name() == "headless" or fotos == "": return
	var cam := Camera3D.new()
	add_child(cam)
	cam.global_transform = d.foco.global_transform
	cam.current = true
	await _q(3)
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("%s/d_%s.png" % [fotos, nome])
	cam.global_position = d.to_global(Vector3(-3.2, 2.0, -2.6))
	cam.look_at(d.to_global(Vector3(0, 0.9, 0)))
	await _q(3)
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("%s/d_%s_b.png" % [fotos, nome])
	cam.queue_free()
func dobrar(batente: float, ang: float) -> Dictionary:
	d.cmd_colocar_tira()
	d.ajustar_batente(batente - d.batente_mm)
	d.cmd_aperto(true)
	for a in range(0, int(ang * 10) + 1, 25):
		d.puxar_avental(a / 10.0)
	d.puxar_avental(ang)
	d.puxar_avental(0.0)
	d.cmd_aperto(false)
	return d.cmd_retirar()
func _ready() -> void:
	var a := OS.get_cmdline_user_args()
	if a.size() > 0: fotos = a[0]
	main = load("res://cenas/main.tscn").instantiate()
	add_child(main)
	await _q(5)
	d = main.dobradeira
	main.hud.visible = false
	print("== dobradeira manual")
	Interacoes.epi = false
	ok(not d.cmd_colocar_tira() and not d.chapa, "sem luva não pega a chapa")
	Interacoes.epi = true
	var est0 := d.estoque_tiras
	ok(d.cmd_colocar_tira() and d.chapa and d.estoque_tiras == est0 - 1, "tira do palete para a bancada")
	d.ajustar_batente(200.0 - d.batente_mm)
	ok(absf(d.aba_mm() - 100.0) < 0.01, "batente em 200 mm → aba de 100 mm (tira de 300)")
	await foto("tira_no_batente")
	# avental com o aperto aberto: a chapa escorrega
	d.puxar_avental(20.0)
	ok(d.escorregou, "puxar o avental com o aperto aberto: chapa escorrega")
	d.puxar_avental(0.0)
	var r := d.cmd_retirar()
	ok(not r.ok and r.defeito == "escorregou" and d.pecas_ruins == 1, "peça escorregada vai para a sucata")
	# dobra exatamente a 90°: volta ~3° e reprova (é o retorno elástico)
	r = dobrar(200.0, 90.0)
	ok(not r.ok and absf(r.ang - 86.85) < 0.05, "avental a 90°: chapa volta para %.2f° (retorno elástico) → reprovada" % r.ang)
	# batente travado com o aperto fechado
	d.cmd_colocar_tira()
	d.cmd_aperto(true)
	var b0 := d.batente_mm
	d.ajustar_batente(5.0)
	ok(d.batente_mm == b0, "com o aperto fechado o batente não mexe")
	d.puxar_avental(60.0)
	d.cmd_aperto(false)
	ok(d.aperto, "não abre o aperto com o avental levantado")
	await foto("avental_60")
	d.puxar_avental(93.3)
	await foto("avental_93")
	d.puxar_avental(0.0)
	d.cmd_aperto(false)
	r = d.cmd_retirar()
	ok(r.ok and absf(r.ang - 90.0) < 0.1 and absf(r.aba - 100.0) < 0.01, "passando para 93,3°: fica %.2f° e aba %.1f mm → APROVADA" % [r.ang, r.aba])
	# aba errada
	r = dobrar(205.0, 93.3)
	ok(not r.ok and r.defeito.begins_with("aba"), "batente 5 mm a mais → aba 95 mm → reprovada (%s)" % r.defeito)
	# alavanca do meio aberta: dobra torta
	d.cmd_colocar_tira()
	d.ajustar_batente(200.0 - d.batente_mm)
	d.alavanca(0); d.alavanca(2)
	ok(d.algum_aperto() and not d.aperto, "só as alavancas 1 e 3 fechadas")
	for aa in range(0, 94, 3): d.puxar_avental(aa)
	d.puxar_avental(0.0)
	d.alavanca(0); d.alavanca(2)
	r = d.cmd_retirar()
	ok(not r.ok and r.defeito == "dobra torta", "dobrou com uma alavanca aberta: peça torta → reprovada")
	# outro pedido: rufo de encosto 135°
	d.trocar_pedido(); d.trocar_pedido()
	d.k_retorno = 0.035
	ok(d.pedido_atual().ang == 135.0 and d.batente_ideal() == 170.0, "pedido RUFO DE ENCOSTO: batente 170 mm")
	r = dobrar(170.0, 139.9)
	ok(r.ok, "rufo: avental a 139,9° → %.2f° (retorno 4,9°) → aprovado" % r.ang)
	r = dobrar(170.0, 150.0)
	ok(absf(r.ang - (140.0 - 4.9)) < 0.05, "avental para no batente mecânico de 140°")
	await foto("pilha")
	ok(d.pecas_ok == 3 and d.pecas_ruins == 4, "contagem: %d boas, %d ruins" % [d.pecas_ok, d.pecas_ruins])
	print("RESULTADO: %d ok, %d falhas" % [oks, falhas])
	get_tree().quit(1 if falhas else 0)
