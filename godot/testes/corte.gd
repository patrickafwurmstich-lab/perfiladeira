extends Node
## Partida completa da LINHA DE CORTE, como um jogador: quadro, caixa, ponte, EPI, mandril, freio,
## cinta, ponta, avanço lento, refile, guias, ENDIREITADOR, peça teste, trena, produção, pilha no batente.
var main
var m: LinhaCorte
var falhas := 0
var oks := 0
var fotos := ""
var n_foto := 0
func ok(c: bool, t: String) -> void:
	if c: oks += 1
	else: falhas += 1
	print(("  ok  " if c else "  FALHA  ") + t)
func _q(n := 1) -> void:
	for i in n: await get_tree().physics_frame
func _seg(s: float) -> void:
	await get_tree().create_timer(s, true, true).timeout
func foto(nome: String, pos: Vector3, olha: Vector3) -> void:
	if DisplayServer.get_name() == "headless" or fotos == "": return
	var cam := Camera3D.new()
	add_child(cam)
	cam.global_position = pos
	cam.look_at(olha)
	cam.current = true
	await _q(3)
	await RenderingServer.frame_post_draw
	n_foto += 1
	get_viewport().get_texture().get_image().save_png("%s/c%02d_%s.png" % [fotos, n_foto, nome])
	cam.queue_free()
func _ready() -> void:
	for a in OS.get_cmdline_user_args():
		if a.begins_with("fotos="): fotos = a.substr(6)
	main = load("res://cenas/main.tscn").instantiate()
	add_child(main)
	await _q(10)
	m = main.corte
	m.enrosco_aleatorio = false
	var j = main.jogador
	var P: PonteRolante = main.ponte
	var mg := func(v: Vector3) -> Vector3: return m.to_global(v)
	print("== linha de corte")
	await foto("visao_geral", mg.call(Vector3(-1.0, 3.2, 5.5)), mg.call(Vector3(0.0, 0.8, 0)))
	main.quadro.disjuntor(1, true)
	ok(m.energia and not main.maquina.energia, "disjuntor 1 liga só a linha de corte")
	m.cmd_chave_geral(true); m.cmd_reset()
	ok(m.pode_mover() == "", "chave geral + reset")
	# ponte: bobina do berço até o mandril da linha de corte
	var b0 = P.bobinas[2]
	var c: Vector3 = b0.no.global_position
	P.x = c.x; P.z = c.z; P.h = c.y + P.OFF_CINTA
	await _q(2)
	P._engatar_ou_soltar()
	ok(P.carga != null, "engatou %s" % b0.codigo)
	var alvo: Vector3 = mg.call(Vector3(m.X_DESB, m.Y_DESB, 1.3))
	P.x = alvo.x + 0.06; P.z = alvo.z; P.h = alvo.y + P.off_carga + 0.05
	P.balanco = Vector2.ZERO; P.balanco_v = Vector2.ZERO
	P.carga.apoiada = false
	await _q(3)
	ok(P.maquina == m, "a ponte reconhece a linha de corte como a máquina mais perto")
	P._engatar_ou_soltar()
	await _seg(4.0)
	ok(m.bobina.presente and m.bobina.codigo == b0.codigo, "%s no mandril da linha de corte" % b0.codigo)
	P.h = 5.0
	main._epi(); await _seg(2.2)
	m._faz_mandril(); await _seg(1.4)
	m._faz_freio(); await _seg(1.7)
	m._faz_bobina(); await _seg(1.8)
	ok(m.fita == "solta", "cintas cortadas")
	m._faz_bobina()
	j.global_position = mg.call(Vector3(m.X_ENTRADA + 0.2, 0.05, 1.0)); j.reset_physics_interpolation()
	await _q(5)
	m._faz_mesa()
	ok(m.fita == "na_mesa", "ponta na boca do endireitador")
	await foto("ponta_endireitador", mg.call(Vector3(-2.3, 1.7, 2.2)), mg.call(Vector3(-2.0, 0.9, 0)))
	m.cmd_modo("manual")
	Relogio.vel_idx = 2
	m.cmd_jog(true)
	while m.fita != "enfiada": await _q()
	await _q(3)
	ok(absf(m.cabeca - m.X_CORTE) < 0.0005, "chapa parou exatamente na faca")
	m.cmd_jog(true)
	while m.peca_m < 0.3: await _q()
	m.cmd_jog(false)
	await _q(3)
	m.cmd_cortar_manual()
	ok(m.ponta_refilada, "refile da ponta")
	Relogio.vel_idx = 0
	m.girar_manivela(0, -m.desvio_mm / 2.0)
	m.girar_manivela(1, (m.folga_mm - 2.0) / 2.0)
	# peça teste SEM ajustar o endireitador: tem que sair arqueada
	m.comprimento = 2.0
	m.cmd_peca_teste()
	while m.pilha.size() < 1: await _q()
	var med := m.medir_trena()
	ok(absf(med.arco_mm) > 3.0 and not m.medida_ok, "endireitador fora do ponto: chapa arqueada %.0f mm, não aprova" % absf(med.arco_mm))
	await foto("chapa_arqueada", mg.call(Vector3(2.4, 1.5, 1.8)), mg.call(Vector3(2.4, 0.95, 0)))
	m.girar_manivela(2, (m.PENETRACAO_IDEAL - m.penetracao_mm) / 0.5)
	ok(absf(m.penetracao_mm - m.PENETRACAO_IDEAL) < 0.01, "volantes do endireitador ajustados (%.1f mm)" % m.penetracao_mm)
	m.ajustar("correcao", -round(med.erro_mm))
	m.cmd_peca_teste()
	while m.pilha.size() < 2: await _q()
	med = m.medir_trena()
	ok(m.medida_ok and absf(med.arco_mm) <= 3.0 and absf(med.erro_mm) <= 2.0, "chapa reta e na medida: erro %+.1f mm, flecha %.1f mm" % [med.erro_mm, med.arco_mm])
	ok(m.perfeita_dada, "PRIMEIRA CHAPA PERFEITA")
	# produção
	m.quantidade = 8
	m.cmd_zerar()
	m.cmd_modo("auto")
	m.cmd_liga()
	await _seg(4.0)
	await foto("cortando", mg.call(Vector3(1.6, 1.8, 2.2)), mg.call(Vector3(0.7, 1.0, 0)))
	Relogio.vel_idx = 2
	while m.falha != "lote": await _q()
	Relogio.vel_idx = 0
	await _seg(1.5)
	ok(m.pilha.size() == 10, "pilha com 10 chapas (2 testes + 8)")
	var fim_max := 0.0
	for t in m.pilha:
		fim_max = maxf(fim_max, absf(m._x_pilha(t.L) + t.L - (m.X_BATENTE - 0.04)))
	ok(fim_max < 0.001, "todas encostadas no batente")
	var maxerr := 0.0
	for t in m.pilha.slice(2):
		maxerr = maxf(maxerr, absf(t.L - m._alvo_corte()))
	ok(maxerr < 0.0005, "8 chapas no comprimento exato em x20 (erro máx %.2f mm)" % (maxerr * 1000))
	var soma := 0.0
	for t in m.pilha: soma += t.L
	ok(absf(m.consumido_m - (soma + m.sucata_m + m.peca_m + (m.X_CORTE - m.X_ENTRADA) + m._comp_alimentacao())) < 0.01, "conservação da chapa na linha de corte")
	var n0: MeshInstance3D = m.pilha_nos[0]
	print("DBG pilha_nos=%d pos=%s gpos=%s aabb=%s visivel=%s mat=%s" % [m.pilha_nos.size(), n0.position, n0.global_position, n0.mesh.get_aabb(), n0.is_visible_in_tree(), n0.material_override])
	var tb := MeshInstance3D.new(); var bm := BoxMesh.new(); bm.size = Vector3(0.3, 0.3, 0.3); tb.mesh = bm; m.add_child(tb); tb.position = n0.position + Vector3(1.0, 0.15, 0)
	await foto("debug_cima", mg.call(Vector3(2.3, 3.0, 0.01)), mg.call(Vector3(2.3, 0.95, 0)))
	await foto("pilha_batente", mg.call(Vector3(2.6, 1.4, 2.0)), mg.call(Vector3(2.6, 0.95, 0)))
	print("RESULTADO: %d ok, %d falhas" % [oks, falhas])
	get_tree().quit(1 if falhas else 0)
