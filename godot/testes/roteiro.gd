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
	m.enrosco_aleatorio = false
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
	# ponte rolante: buscar a bobina no berço e encaixar no mandril
	var P: PonteRolante = main.ponte
	ok(not m.bobina.presente and P.bobinas.size() == 3, "começa sem bobina na máquina; 3 bobinas no berço")
	var b0 = P.bobinas[0]
	P.x = b0.no.global_position.x; P.z = b0.no.global_position.z; P.h = 3.0
	await _q(2)
	P._engatar_ou_soltar()
	ok(P.carga == null, "gancho alto demais não engata")
	P.h = b0.no.global_position.y + P.OFF_CINTA
	await _q(2)
	P._engatar_ou_soltar()
	ok(P.carga != null, "cinta passada no furo da %s" % b0.codigo)
	P.h = 3.0
	await _q(2)
	P._engatar_ou_soltar()
	ok(P.carga != null, "não solta a carga no ar")
	# acelera a ponte: a carga tem que balançar
	await foto("berco", Vector3(-11.8, 1.6, -2.6), Vector3(-10.0, 0.6, -4.5))
	j.global_position = Vector3(P.x + 1.5, 0.05, P.z + 3.5)
	j.reset_physics_interpolation()
	await _q(3)
	P._pegar()
	ok(Interacoes.modo == "ponte" and P.operando, "botoeira na mão (modo ponte)")
	Input.action_press("direita")
	await _seg(1.0)
	Input.action_release("direita")
	await _seg(0.3)
	ok(P.balanco.length() > 0.005, "carga balança quando a ponte acelera (%.1f°)" % rad_to_deg(P.balanco.length()))
	ok(P.botoeira.global_position.distance_to(j.global_position) < 1.2, "a botoeira está na mão do operador")
	await foto("ponte_na_mao")
	# cabo da botoeira: tenta levar a ponte para longe do jogador
	var x0: float = P.x
	Input.action_press("direita")
	await _seg(2.0)
	for k in 60:
		P.x = clampf(P.x + 0.3, -100, 100)
		await _q()
		if Vector2(P.x - j.global_position.x, P.z - j.global_position.z).length() > P.CABO_BOTOEIRA: break
	Input.action_release("direita")
	P.x = x0
	Interacoes.sair_foco()
	ok(not P.operando and Interacoes.modo == "andar", "E larga a botoeira")
	P.x = m.to_global(Vector3(m.X_DESB, 0, 0)).x + 0.08
	P.z = 1.3
	P.h = m.Y_DESB + P.OFF_CINTA
	P.balanco = Vector2.ZERO; P.balanco_v = Vector2.ZERO
	await _q(2)
	P._engatar_ou_soltar()
	ok(P.encaixando == 0.0 and not m.bobina.presente, "desalinhada 8 cm: não encaixa")
	P.x -= 0.08
	P.balanco = Vector2.ZERO; P.balanco_v = Vector2.ZERO
	await _q(2)
	await foto("alinhando_mandril", Vector3(-5.6, 1.8, 3.0), Vector3(-7.2, 1.1, 0.8))
	P._engatar_ou_soltar()
	ok(P.encaixando > 0.0, "coaxial: bobina começa a deslizar no mandril")
	await _seg(3.4)
	ok(m.bobina.presente and m.bobina.cinta and P.carga == null and m.bobina.codigo == b0.codigo, "%s no mandril, com cinta, gancho livre" % b0.codigo)
	P.h = 5.0
	# bobina: cinta (precisa de EPI e mandril travado)
	ok(m.bobina.cinta, "bobina chega com cinta")
	m._faz_bobina()
	ok(m.bobina.cinta, "sem EPI não corta a cinta")
	main._epi()
	await _seg(2.2)
	ok(Interacoes.epi, "EPI vestido")
	m._faz_bobina()
	ok(m.bobina.cinta, "com mandril destravado não corta a cinta")
	m._faz_mandril()
	await _seg(1.4)
	ok(m.bobina.travada, "mandril travado")
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
	ok(m.jog, "JOG segurado (sem freio, de propósito)")
	var t0 := Time.get_ticks_msec()
	await _seg(3.0)
	await foto("enfiando", Vector3(-3.0, 2.4, 3.2), Vector3(-3.5, 0.9, 0))
	Relogio.vel_idx = 2
	while m.fita != "enfiada" and Time.get_ticks_msec() - t0 < 30000:
		await _q()
	Relogio.vel_idx = 0
	ok(m.fita == "enfiada", "chapa chegou na guilhotina (cabeça %.2f)" % m.cabeca)
	ok(not m.jog, "JOG solta sozinho no sensor")
	await _q(3)
	ok(absf(m.cabeca - m.X_CORTE) < 0.0005, "ponta parou exatamente na faca (x20 sem passar)")
	ok(m.barriga_m > 0.0, "sem freio a bobina embalou e fez barriga (%.2f m)" % m.barriga_m)
	await foto("barriga", Vector3(-6.4, 1.3, 2.6), Vector3(-6.7, 0.7, 0))
	m._faz_freio()
	await _seg(1.7)
	ok(m.freio_ok and m.barriga_m == 0.0, "freio ajustado, barriga recolhida")
	# refile
	m.cmd_peca_teste()
	ok(not m.teste_ativo, "peça teste recusada antes do refile")
	m.cmd_cortar_manual()
	ok(not m.ponta_refilada, "corte manual recusado com menos de 25 cm")
	m.cmd_jog(true)
	while m.peca_m < 0.3:
		await _q()
	m.cmd_jog(false)
	m.cmd_cortar_manual()
	ok(m.ponta_refilada and m.sucata_m > 0.29, "ponta refilada (%.2f m na sucata)" % m.sucata_m)
	await _seg(0.5)
	await foto("refile", Vector3(6.6, 1.6, 2.6), Vector3(5.4, 0.8, 0.6))
	await _seg(1.5)
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
	ok(m.pilha.size() == 1 and m.produzidas == 1, "o refile não entrou na pilha nem no contador")
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
	m._faz_tampa()
	m.cmd_liga()
	ok(not m.rodando, "LIGA recusado com a proteção aberta")
	m._faz_tampa()
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
	var soma := 0.0
	for t in m.pilha.slice(m.pilha.size() - 6):
		soma += t.L
	ok(absf(usado - soma) < 0.002, "bobina gastou %.3f m = soma das 6 telhas %.3f m (x20, sem sobra)" % [usado, soma])
	var maxerr := 0.0
	for t in m.pilha.slice(m.pilha.size() - 6):
		maxerr = maxf(maxerr, absf(t.L - m._alvo_corte()))
	ok(maxerr < 0.0005, "todas as telhas no comprimento do encoder em x20 (erro máx %.2f mm)" % (maxerr * 1000))
	ok(absf(Registro.totais.metros_formados - (m.consumido_m - m.puxado_mao_m)) < 0.01, "Registro: metros que a máquina puxou (%.3f) = consumo da bobina menos o puxado à mão (%.3f)" % [Registro.totais.metros_formados, m.consumido_m - m.puxado_mao_m])
	ok(Registro.totais.pecas == m.pilha.size() + m.deslizando.size() and Registro.totais.refiles == 1, "Registro: peças cortadas (%d) = pilha + em trânsito; 1 refile" % Registro.totais.pecas)
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
	# proteção aberta com a máquina andando
	m.cmd_liga()
	await _seg(3.6)
	m._faz_tampa()
	ok(m.v == 0.0 and m.falha == "protecao" and m.precisa_reset, "abrir a proteção em ciclo para na hora")
	m.cmd_reset()
	ok(m.precisa_reset, "RESET recusado com proteção aberta")
	m._faz_tampa()
	m.cmd_reset()
	ok(m.pode_mover() == "" and not m.rodando, "fechou + RESET: pronta, mas NÃO religa sozinha")
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
	ok(Interacoes.modo != "progresso", "esmerilhadeira recusada com a proteção fechada")
	m._faz_tampa()
	m._faz_enrosco()
	await _seg(1.0)
	await foto("esmerilhando", Vector3(-0.3, 1.8, 2.2), Vector3(-0.4, 1.0, 0))
	await _seg(3.5)
	ok(not m.amassado.visible and m.fita == "na_mesa", "enrosco cortado, chapa precisa ser passada de novo")
	ok(not m.medida_ok and not m.ponta_refilada, "depois do enrosco: refile e medição obrigatórios de novo")
	m._faz_tampa()
	m.cmd_emergencia()
	m.cmd_reset()
	ok(m.pode_mover() == "", "reset depois do enrosco")
	# fim de bobina: deixa só 4 m na bobina e produz até acabar
	m.cmd_modo("manual")
	m.cmd_jog(true)
	Relogio.vel_idx = 2
	while m.fita != "enfiada":
		await _q()
	m.cmd_jog(true)
	while m.peca_m < 0.3:
		await _q()
	m.cmd_jog(false)
	await _q(3)
	m.cmd_cortar_manual()
	m.ponta_refilada = true
	m.medida_ok = true
	m.teste_feito = true
	m.bobina.metros = 4.0
	m.quantidade = 50
	m.cmd_zerar()
	m.cmd_modo("auto")
	m.cmd_liga()
	var t1 := Time.get_ticks_msec()
	while m.falha != "fim_bobina" and Time.get_ticks_msec() - t1 < 40000:
		await _q()
	while m.v > 0.0:
		await _q()
	ok(m.falha == "fim_bobina" and m.v == 0.0, "sensor de fim de chapa parou a máquina")
	var passou := m._cauda_x() - m.X_SENSOR_FIM
	ok(passou >= 0.0 and passou <= 0.23, "parou %.0f mm depois do sensor (distância de frenagem a 0,8 m/s²)" % (passou * 1000))
	m.cmd_reset()
	m.cmd_liga()
	ok(not m.rodando, "LIGA recusado em fim de chapa")
	m.cmd_modo("manual")
	m.cmd_jog(true)
	while m.jog and m._cauda_x() < m.X_E1:
		await _q()
	m.cmd_jog(false)
	await _q(30)
	Relogio.vel_idx = 0
	ok(m._cauda_x() >= m.X_E1 - 0.001, "AVANÇO LENTO levou a cauda até sair dos rolos")
	await foto("fim_chapa", Vector3(4.6, 1.8, 2.6), Vector3(4.4, 0.9, 0))
	var suc0 := m.sucata_m
	m._faz_retalho()
	await _seg(2.3)
	ok(not m.bobina.presente and m.sucata_m > suc0 + 0.9, "retalho de fim de chapa na sucata (%.2f m)" % (m.sucata_m - suc0))
	var na_pilha := _soma_pilha() + m.estoque_retirado_m
	ok(absf(m.consumido_m - (na_pilha + m.sucata_m)) < 0.005, "conservação da chapa: saiu da bobina %.3f m = pilha %.3f + sucata %.3f" % [m.consumido_m, na_pilha, m.sucata_m])
	print("   balanço: formado %.2f m · pilha %.2f m · sucata %.2f m" % [Registro.totais.metros_formados, _soma_pilha(), m.sucata_m])
	print("== fim. Sucata %.2f m, produzidas na pilha %d" % [m.sucata_m, m.pilha.size()])

func _soma_pilha() -> float:
	var t := 0.0
	for p in m.pilha:
		t += p.L
	return t
