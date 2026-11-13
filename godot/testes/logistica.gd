extends Node
## Logística: amarrado de telhas → empilhadeira → caminhão; palete de rufos → paleteira; tombo; sobrecarga.
var main
var E: Empilhadeira
var P: Empilhadeira
var C: Caminhao
var falhas := 0
var oks := 0
var fotos := ""
func ok(c: bool, t: String) -> void:
	if c: oks += 1
	else: falhas += 1
	print(("  ok  " if c else "  FALHA  ") + t)
func _q(n := 1) -> void:
	for i in n: await get_tree().physics_frame
func foto(nome: String, pos: Vector3, olha: Vector3) -> void:
	if DisplayServer.get_name() == "headless" or fotos == "": return
	var cam := Camera3D.new()
	add_child(cam)
	cam.global_position = pos
	cam.look_at(olha)
	cam.current = true
	await _q(3)
	await RenderingServer.frame_post_draw
	get_viewport().get_texture().get_image().save_png("%s/l_%s.png" % [fotos, nome])
	cam.queue_free()
## anda com comando até a condição (ou tempo)
func rodar(v: Vector3, seg: float, ate := Callable()) -> void:
	var veic: Empilhadeira = E if v != Vector3.INF else E
	var n := int(seg * 60)
	for i in n:
		E.comando = v
		await _q()
		if ate.is_valid() and ate.call():
			break
	E.comando = Vector3.ZERO
## coloca a empilhadeira olhando para "alvo" (garfos apontando), a "dist" da frente da carga
func posicionar(veic: Empilhadeira, alvo: Vector3, dirz: Vector3, dist: float) -> void:
	var fw := dirz.normalized()
	veic.global_position = Vector3(alvo.x, 0.0, alvo.z) - fw * dist
	veic.look_at(veic.global_position - fw, Vector3.UP)      # look_at aponta -Z; a frente é +Z
	veic.v = 0.0
	veic.reset_physics_interpolation()
func _ready() -> void:
	var a := OS.get_cmdline_user_args()
	if a.size() > 0: fotos = a[0]
	main = load("res://cenas/main.tscn").instantiate()
	add_child(main)
	await _q(5)
	main.hud.visible = false
	E = main.empilhadeira; P = main.paleteira; C = main.caminhao
	var m: Perfiladeira = main.maquina
	print("== amarrado da perfiladeira")
	# simula 40 telhas de 3 m na pilha (como se a máquina tivesse produzido)
	for i in 40:
		var no := Node3D.new(); m.add_child(no); no.position = Vector3(m.X_PILHA, m.Y_PILHA0 + i * m.NINHO, 0)
		m.pilha.append({"L": 3.0, "curva": 0.0, "assim": 0.0, "defeito": ""}); m.pilha_nos.append(no)
	var am: Carga = m.embalar_pilha()
	ok(am != null and m.pilha.is_empty() and absf(am.metros - 120.0) < 0.01, "pilha vira amarrado no lugar: %s" % (am.descricao if am else "-"))
	ok(absf(am.kg - 120.0 * 1.2 * 3.38) < 0.5, "peso do amarrado = 120 m × 1,20 m × 3,38 kg/m² = %.0f kg" % am.kg)
	ok(m.amarrado_na_saida(), "máquina sabe que tem amarrado na área da pilha (LIGA recusa)")
	await foto("amarrado", am.global_position + Vector3(2.5, 2.0, 3.0), am.global_position)
	print("== empilhadeira")
	var ez: Vector3 = am.global_transform.basis.z
	# garfos tortos: 20°
	posicionar(E, am.global_position, ez.rotated(Vector3.UP, deg_to_rad(20)), 2.6)
	ok(E.carga_alvo()[0] == null, "garfos tortos: não pega (%s)" % E.carga_alvo()[1])
	posicionar(E, am.global_position, ez, 2.9)
	await _q(2)
	await rodar(Vector3(0.5, 0, 0), 6.0, func(): return E.carga_alvo()[1] == "")
	await _q(10)
	ok(E.carga_alvo()[1] == "", "andou reto e enfiou os garfos por baixo do amarrado")
	await foto("garfos_enfiados", E.global_position + Vector3(3.5, 2.0, 0.5), am.global_position)
	await rodar(Vector3(0, 0, 1), 1.0)
	ok(E.carga == am and am.global_position.y > m.Y_PILHA0 + 0.15, "R levanta: amarrado nos garfos (%.2f m)" % am.global_position.y)
	# sobrecarga
	var pesada := Carga.criar(main, Transform3D(Basis(), Vector3(26, 0, -4)), "chapa", 1, 0, 3200.0, Vector3(1.2, 0.5, 1.0), "BOBINA FALSA 3200 kg", true)
	ok(pesada.kg > E.CAPACIDADE, "carga de teste de %.0f kg" % pesada.kg)
	# tombo: curva rápida com o garfo lá em cima
	var g0 := E.garfo
	await rodar(Vector3(0, 0, 1), 4.0)
	ok(E.garfo > 1.0, "garfo a %.2f m" % E.garfo)
	await rodar(Vector3(1, 1, 0), 3.0, func(): return E.carga == null)
	ok(E.carga == null and E.avarias == 1, "curva rápida com carga alta: TOMBOU (avaria registrada)")
	ok(am.descricao.ends_with("(AVARIADA)"), "amarrado marcado como avariado")
	await foto("tombou", E.global_position + Vector3(4, 3, 4), E.global_position)
	# nova carga boa para levar ao caminhão
	await rodar(Vector3(0, 0, -1), 8.0)
	var boa := Carga.criar(main, Transform3D(Basis(), Vector3(24.0, 0.10, 6.0)), "telha", 30, 90.0, 90.0 * 1.2 * 3.38, Vector3(3.0, 0.22, 1.10), "30 TELHAS 3,00 m")
	posicionar(E, boa.global_position, Vector3(0, 0, 1), 2.9)
	await _q(2)
	await rodar(Vector3(0.5, 0, 0), 6.0, func(): return E.carga_alvo()[1] == "")
	await rodar(Vector3(0, 0, 1), 1.0)
	ok(E.carga == boa, "pegou o amarrado bom")
	# leva até o lado aberto do caminhão (garfos apontando para +Z, para dentro da carroceria)
	await rodar(Vector3(0, 0, 1), 3.0)
	ok(E.garfo * 1.0 + E.GARFO_Y0 > 1.05, "garfos acima do piso da carroceria (%.2f m)" % (E.GARFO_Y0 + E.garfo))
	var alvo: Vector3 = C.to_global(Vector3(-1.5, C.Y_PISO, 0.0))
	posicionar(E, alvo, C.global_transform.basis.z, 1.93 + 0.55 + 1.4)
	await _q(2)
	await rodar(Vector3(0.4, 0, 0), 8.0, func(): return C.to_local(boa.global_position).z > -0.05)
	ok(C.to_local(boa.global_position).z > -1.17 + 0.55, "amarrado sobre a carroceria (z local %.2f)" % C.to_local(boa.global_position).z)
	await rodar(Vector3(0, 0, -1), 4.0, func(): return E.carga == null)
	ok(E.carga == null and absf(boa.global_position.y - (C.global_position.y + C.Y_PISO)) < 0.02, "baixou: amarrado apoiado no piso da carroceria (%.2f m)" % boa.global_position.y)
	await rodar(Vector3(0, 0, -1), 1.0)
	await rodar(Vector3(-0.5, 0, 0), 3.0)
	await foto("no_caminhao", C.to_global(Vector3(-1, 3.5, -6)), C.to_global(Vector3(-1, 1, 0)))
	print("== paleteira + dobradeira")
	var d: Dobradeira = main.dobradeira
	d.pecas_palete = 12
	var pal := d.fechar_palete()
	ok(pal != null and pal.qtd == 12 and pal.tipo == "rufo", "palete de rufos fechado: %s" % pal.descricao)
	posicionar(P, pal.global_position, pal.global_transform.basis.z, 0.5 + 0.74 + 0.6)
	await _q(2)
	for i in 120:
		P.comando = Vector3(0.6, 0, 0)
		await _q()
		if P.carga_alvo()[1] == "": break
	P.comando = Vector3.ZERO
	await _q(30)
	ok(P.carga_alvo()[1] == "", "paleteira enfiou no palete")
	P.bombear(); P.bombear(); P.bombear()
	ok(P.carga == pal and pal.global_position.y > 0.03, "3 bombadas: palete levantado (%.2f m)" % pal.global_position.y)
	var x0 := pal.global_position
	for i in 120:
		P.comando = Vector3(-1, 0, 0)
		await _q()
	P.comando = Vector3.ZERO
	await _q(40)
	ok(pal.global_position.distance_to(x0) > 1.0, "puxou o palete %.1f m" % pal.global_position.distance_to(x0))
	P.garfo_para(0.0)
	ok(P.carga == null and absf(pal.global_position.y) < 0.01, "soltou a válvula: palete no chão")
	print("== despacho")
	var r := C.resumo()
	ok(absf(r.telha_m - 90.0) < 0.01, "caminhão vê 90 m de telha na carroceria")
	ok(C.conferir() == "", "conferência ok (dentro da carroceria e do peso)")
	ok(C.despachar() and C.estado == "saindo", "despachado")
	await get_tree().create_timer(8.0).timeout
	ok(C.estado == "fora" and C.entregas == 1, "caminhão foi embora com a carga")
	print("RESULTADO: %d ok, %d falhas" % [oks, falhas])
	get_tree().quit(1 if falhas else 0)
