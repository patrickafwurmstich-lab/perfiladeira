extends Node
## Roteiro automático: faz a partida completa da perfiladeira como um jogador faria e confere tudo.
## Headless = só testa. Com tela (xvfb) = também tira fotos de cada etapa em user://fotos (ou FOTOS_DIR).
## Uso: godot --path . res://testes/roteiro.tscn  [-- fotos=/caminho]

var main
var m: Perfiladeira
var j: Jogador
var falhas := 0
var oks := 0
var fotos := ""
var n_foto := 0
var com_tela := false

func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("fotos="):
			fotos = a.substr(6)
	com_tela = DisplayServer.get_name() != "headless"
	main = load("res://cenas/main.tscn").instantiate()
	add_child(main)
	await _q(10)
	m = main.maquina
	j = main.jogador
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	await _rodar()
	print("RESULTADO: %d ok, %d falhas" % [oks, falhas])
	get_tree().quit(1 if falhas > 0 else 0)

func ok(cond: bool, txt: String) -> void:
	if cond:
		oks += 1
		print("  ok  ", txt)
	else:
		falhas += 1
		print("  FALHA  ", txt)

func _q(n := 1) -> void:
	for i in n:
		await get_tree().physics_frame

func _seg(s: float) -> void:
	await get_tree().create_timer(s, true, true).timeout

func foto(nome: String, pos: Vector3 = Vector3.INF, olha: Vector3 = Vector3.ZERO) -> void:
	if not com_tela or fotos == "":
		return
	var cam := Camera3D.new()
	add_child(cam)
	if pos != Vector3.INF:
		cam.global_position = pos
		cam.look_at(olha)
		cam.fov = 60
		cam.current = true
	await _q(3)
	await RenderingServer.frame_post_draw
	n_foto += 1
	get_viewport().get_texture().get_image().save_png("%s/%02d_%s.png" % [fotos, n_foto, nome])
	cam.queue_free()
	j.cam.current = true

func andar_ate(p: Vector3, yaw: float) -> void:
	j.global_position = p
	j.yaw = yaw
	await _q(4)

func _rodar() -> void:
	print("== partida da perfiladeira")
	await foto("inicio")
	ok(not m.energia and m.pode_mover() != "", "começa desligada")
	m.cmd_chave_geral(true)
	ok(not m.chave_geral, "chave geral sem disjuntor não liga")
	m.cmd_disjuntor(true)
	m.cmd_chave_geral(true)
	ok(m.chave_geral and m.precisa_reset, "chave geral liga e pede RESET")
	m.cmd_liga()
	ok(not m.rodando, "LIGA recusado sem reset")
	m.cmd_reset()
	ok(m.pode_mover() == "", "RESET libera")
	await foto("caixa_comando", m.caixa.global_position + Vector3(0.0, 1.2, 1.1), m.caixa.global_position + Vector3(0, 1.1, 0))
	m.cmd_modo("manual")
	m.cmd_jog(true)
	ok(not m.jog, "JOG recusado sem chapa")
	# bobina: cinta
	ok(m.bobina.cinta, "bobina chega com cinta")
	m._faz_bobina()
	await _seg(1.8)
	ok(not m.bobina.cinta and m.fita == "solta", "cintas cortadas, ponta solta")
	await foto("ponta_solta", Vector3(-6.0, 1.6, 2.6), Vector3(-7.0, 0.9, 0))
	m._faz_bobina()
	ok(m.fita == "puxando", "pegou a ponta")
	await andar_ate(m.to_global(Vector3(-5.9, 0.0, 1.0)), 0.0)
	await _q(5)
	await foto("puxando_ponta", Vector3(-6.5, 2.0, 3.6), Vector3(-6.4, 0.9, 0.5))
	m._faz_mesa()
	ok(m.fita == "na_mesa" and absf(m.desvio_mm) <= 25.0, "ponta encaixada na mesa (desvio %.1f mm)" % m.desvio_mm)
	m.cmd_jog(true)
	ok(m.jog, "JOG segurado")
	var t0 := Time.get_ticks_msec()
	await _seg(3.0)
	await foto("enfiando", Vector3(-3.0, 2.4, 3.2), Vector3(-3.5, 0.9, 0))
	Relogio.vel_idx = 2
	while m.fita != "enfiada" and Time.get_ticks_msec() - t0 < 30000:
		await _q()
	Relogio.vel_idx = 0
	ok(m.fita == "enfiada", "chapa chegou na guilhotina (cabeça %.2f)" % m.cabeca)
	ok(not m.jog, "JOG solta sozinho no sensor")
	await foto("chapa_enfiada", Vector3(2.0, 2.2, 3.4), Vector3(1.0, 0.9, 0))
	# guias
	var antes: float = absf(m.desvio_mm)
	var voltas := -m.desvio_mm / 2.0
	m.girar_manivela(0, voltas)
	m.girar_manivela(1, (m.folga_mm - 2.0) / 2.0)
	ok(absf(m.desvio_mm) <= 2.0 and m.folga_mm <= 3.0, "guias centralizadas (%.1f→%.1f mm, folga %.1f)" % [antes, m.desvio_mm, m.folga_mm])
	# peça teste
	m.comprimento = 3.0
	m.cmd_peca_teste()
	ok(m.teste_ativo, "peça teste iniciada")
	await _seg(1.4)
	await foto("peca_saindo", Vector3(7.5, 2.0, 3.5), Vector3(5.8, 0.9, 0))
	while not m.teste_feito:
		await _q()
	await foto("corte", Vector3(5.6, 1.7, 2.2), Vector3(5.0, 1.1, 0))
	while m.pilha.size() < 1:
		await _q()
	ok(m.pilha.size() == 1, "peça teste caiu na pilha")
	var med := m.medir_trena()
	ok(not med.is_empty(), "trena mediu %.3f m (erro %+.0f mm)" % [med.L, med.erro_mm])
	await foto("trena", Vector3(8.6, 1.6, 2.2), Vector3(8.6, 0.2, 0))
	# corrige e faz outra
	m.ajustar("correcao", -round(med.erro_mm))
	m.cmd_peca_teste()
	while m.pilha.size() < 2:
		await _q()
	med = m.medir_trena()
	ok(absf(med.erro_mm) <= 2.0 and m.medida_ok, "depois da correção: erro %+.1f mm" % med.erro_mm)
	ok(m.perfeita_dada, "PRIMEIRA TELHA PERFEITA dada")
	# produção automática
	m.quantidade = 6
	m.cmd_zerar()
	m.cmd_liga()
	ok(not m.rodando, "LIGA recusado em manual")
	m.cmd_modo("auto")
	m.cmd_liga()
	ok(m.rodando and m.sirene_t > 0.0, "LIGA em auto: sirene antes de mover")
	await _q(10)
	ok(m.v == 0.0, "nada se move durante a sirene")
	var r0 := m.raio_bobina()
	var met0: float = m.bobina.metros
	var kwh0 := m.energia_kwh
	await _seg(4.0)
	await foto("produzindo", Vector3(-1.0, 3.2, 5.5), Vector3(0.0, 0.8, 0))
	await foto("bobina_girando", Vector3(-8.2, 1.8, 2.6), Vector3(-7.2, 1.1, 0))
	Relogio.vel_idx = 2
	while m.falha != "lote":
		await _q()
	Relogio.vel_idx = 0
	await _seg(1.0)
	ok(m.produzidas == 6, "lote de 6 concluído (falha=lote)")
	var usado: float = met0 - m.bobina.metros
	ok(absf(usado - 6 * m.comprimento) < 0.6, "metros tirados da bobina = metros produzidos (%.2f m)" % usado)
	ok(m.raio_bobina() < r0, "bobina diminuiu (%.4f → %.4f m)" % [r0, m.raio_bobina()])
	ok(m.energia_kwh > kwh0, "energia consumida (%.3f kWh)" % (m.energia_kwh - kwh0))
	await foto("pilha", Vector3(10.0, 2.4, 3.5), Vector3(9.0, 0.2, 0))
	# emergência
	m.cmd_zerar()
	m.cmd_reset()
	m.cmd_liga()
	await _seg(3.0)
	m.cmd_emergencia()
	ok(m.v == 0.0 and not m.rodando and m.precisa_reset, "emergência para na hora")
	m.cmd_reset()
	ok(m.precisa_reset, "RESET recusado com emergência travada")
	m.cmd_emergencia()
	m.cmd_reset()
	ok(m.pode_mover() == "", "destravou + RESET = pronta")
	# enrosco forçado
	m.cmd_liga()
	await _seg(2.5)
	m.enrosco_x = m.X_E0 + m.PASSO * 6
	m._enroscar()
	ok(m.falha == "enrosco" and m.amassado.visible, "enrosco: para e mostra a chapa amassada")
	await foto("enrosco", Vector3(-0.3, 2.0, 2.4), Vector3(-0.4, 1.0, 0))
	m._faz_enrosco()
	ok(Interacoes.modo != "progresso", "esmerilhadeira recusada sem bloquear a máquina")
	m.cmd_emergencia()
	m._faz_enrosco()
	await _seg(1.0)
	await foto("esmerilhando", Vector3(-0.3, 1.8, 2.2), Vector3(-0.4, 1.0, 0))
	await _seg(3.5)
	ok(not m.amassado.visible and m.fita == "na_mesa", "enrosco cortado, chapa precisa ser passada de novo")
	m.cmd_emergencia()
	m.cmd_reset()
	ok(m.pode_mover() == "", "reset depois do enrosco")
	print("== fim. Sucata %.2f m, produzidas na pilha %d" % [m.sucata_m, m.pilha.size()])
