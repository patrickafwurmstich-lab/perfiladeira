class_name IHM
extends Control
## IHM touch da perfiladeira (aparece NA TELA DA CAIXA via SubViewport — não é um painel solto).
## Tudo que mostra é lido da máquina a cada quadro. Cada toque chama um comando da máquina.

var maquina
var lb_estado: Label
var lb_alarme: Label
var valores := {}
var lb_bobina: Label
var lb_cont: Label
var lb_etapa: Label
var barra_bob: ProgressBar
var bt_teste: Button
var bt_corte: Button

func _ready() -> void:
	var fundo := ColorRect.new()
	fundo.color = Color(0.07, 0.09, 0.12)
	fundo.set_anchors_preset(Control.PRESET_FULL_RECT)
	add_child(fundo)
	var v := VBoxContainer.new()
	v.position = Vector2(10, 6)
	v.size = Vector2(580, 388)
	v.add_theme_constant_override("separation", 4)
	add_child(v)
	var topo := HBoxContainer.new()
	v.add_child(topo)
	var tit := _lab("TP-40  IHM", 22, Color(0.55, 0.8, 1.0))
	tit.custom_minimum_size.x = 170
	topo.add_child(tit)
	lb_estado = _lab("", 22, Color(1, 1, 1))
	lb_estado.size_flags_horizontal = Control.SIZE_EXPAND_FILL
	lb_estado.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	topo.add_child(lb_estado)
	lb_alarme = _lab("", 20, Color(1, 0.35, 0.3))
	v.add_child(lb_alarme)
	for c in [["comprimento", "COMPRIMENTO", "m", 0.01, 0.10], ["quantidade", "QUANTIDADE", "pç", 1, 10], ["velocidade", "VELOCIDADE", "%", 0.05, 0.05], ["correcao", "CORREÇÃO", "mm", 1, 5]]:
		v.add_child(_linha(c[0], c[1], c[2], c[3], c[4]))
	lb_bobina = _lab("", 18, Color(0.85, 0.9, 0.95))
	v.add_child(lb_bobina)
	barra_bob = ProgressBar.new()
	barra_bob.custom_minimum_size = Vector2(560, 12)
	barra_bob.show_percentage = false
	barra_bob.max_value = 1.0
	v.add_child(barra_bob)
	lb_cont = _lab("", 20, Color(0.9, 1.0, 0.85))
	v.add_child(lb_cont)
	var bts := HBoxContainer.new()
	bts.add_theme_constant_override("separation", 8)
	v.add_child(bts)
	bt_teste = _bt("PEÇA TESTE", func(): maquina.cmd_peca_teste(), Color(0.2, 0.45, 0.25))
	bts.add_child(bt_teste)
	bt_corte = _bt("CORTE MANUAL", func(): maquina.cmd_cortar_manual(), Color(0.45, 0.3, 0.15))
	bts.add_child(bt_corte)
	bts.add_child(_bt("ZERAR CONT.", func(): maquina.cmd_zerar(), Color(0.25, 0.25, 0.3)))
	lb_etapa = _lab("", 15, Color(1.0, 0.85, 0.4))
	lb_etapa.autowrap_mode = TextServer.AUTOWRAP_WORD
	lb_etapa.custom_minimum_size.x = 570
	v.add_child(lb_etapa)

func _lab(t: String, tam: int, cor: Color) -> Label:
	var l := Label.new()
	l.text = t
	l.add_theme_font_size_override("font_size", tam)
	l.add_theme_color_override("font_color", cor)
	return l

func _bt(t: String, f: Callable, cor: Color) -> Button:
	var b := Button.new()
	b.text = t
	b.custom_minimum_size = Vector2(180, 40)
	b.add_theme_font_size_override("font_size", 18)
	var sb := StyleBoxFlat.new()
	sb.bg_color = cor
	sb.set_corner_radius_all(6)
	b.add_theme_stylebox_override("normal", sb)
	var sh := sb.duplicate()
	sh.bg_color = cor.lightened(0.25)
	b.add_theme_stylebox_override("hover", sh)
	var sp := sb.duplicate()
	sp.bg_color = cor.darkened(0.3)
	b.add_theme_stylebox_override("pressed", sp)
	b.pressed.connect(func():
		Som.tocar("bip", null, Vector3.ZERO, -14.0)
		f.call())
	return b

func _linha(campo: String, nome: String, uni: String, passo: float, passo_grande: float) -> HBoxContainer:
	var h := HBoxContainer.new()
	h.add_theme_constant_override("separation", 6)
	var l := _lab(nome, 18, Color(0.7, 0.75, 0.8))
	l.custom_minimum_size.x = 170
	h.add_child(l)
	h.add_child(_bt_mini("−−", func(): maquina.ajustar(campo, -passo_grande)))
	h.add_child(_bt_mini("−", func(): maquina.ajustar(campo, -passo)))
	var val := _lab("", 22, Color(1, 1, 1))
	val.custom_minimum_size.x = 150
	val.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	h.add_child(val)
	h.add_child(_bt_mini("+", func(): maquina.ajustar(campo, passo)))
	h.add_child(_bt_mini("++", func(): maquina.ajustar(campo, passo_grande)))
	valores[campo] = [val, uni]
	return h

func _bt_mini(t: String, f: Callable) -> Button:
	var b := _bt(t, f, Color(0.2, 0.24, 0.3))
	b.custom_minimum_size = Vector2(50, 34)
	return b

func _process(_d: float) -> void:
	if maquina == null:
		return
	var m = maquina
	var lig: bool = m.energia and m.chave_geral
	visible = lig        # sem energia a tela apaga
	if not lig:
		return
	var est := "PRONTA"
	var cor := Color(0.6, 1, 0.6)
	if m.emergencia:
		est = "EMERGÊNCIA"; cor = Color(1, 0.3, 0.3)
	elif m.precisa_reset:
		est = "AGUARDA RESET"; cor = Color(1, 0.8, 0.3)
	elif m.v > 0.01:
		est = ("PRODUZINDO" if m.rodando else ("AVANÇO LENTO" if m.jog else "PEÇA TESTE")) + "  %.1f m/min" % (m.v * 60.0 / m.FATOR_VISUAL)
	elif m.sirene_t > 0.0:
		est = "PARTINDO..."; cor = Color(1, 0.9, 0.3)
	if est == "PRONTA" or est == "AGUARDA RESET":
		est = m.fase()
	lb_estado.text = "%s · %s" % [m.modo.to_upper(), est]
	lb_estado.add_theme_color_override("font_color", cor)
	var al := ""
	match m.falha:
		"emergencia": al = "⚠ EMERGÊNCIA ACIONADA — destrave e aperte RESET"
		"enrosco": al = "⚠ ENROSCO NOS ROLOS — bloqueie a máquina e corte a chapa"
		"fim_bobina": al = "⚠ FIM DE BOBINA — troque a bobina"
		"mesa_cheia": al = "⚠ MESA CHEIA — retire a pilha"
		"lote": al = "✔ LOTE CONCLUÍDO — zere o contador"
		"energia": al = "⚠ QUEDA DE ENERGIA"
		"protecao": al = "⚠ PROTEÇÃO ABERTA — feche e aperte RESET"
	if al == "" and not m.protecao_fechada:
		al = "! Proteção dos rolos aberta (só AVANÇO LENTO)"
	elif al == "" and not m.bobina.travada and m.bobina.presente:
		al = "! Mandril destravado"
	elif al == "" and m.barriga_m > 0.15:
		al = "! Barriga de chapa na entrada — ajuste o freio"
	elif al == "" and m.aviso_10 and m.bobina.presente:
		al = "! Bobina com menos de 10%"
	lb_alarme.text = al
	valores.comprimento[0].text = "%.2f m" % m.comprimento
	valores.quantidade[0].text = "%d pç" % m.quantidade
	valores.velocidade[0].text = "%d %%" % int(round(m.velocidade * 100))
	valores.correcao[0].text = "%+.0f mm" % m.correcao_mm
	if m.bobina.presente:
		lb_bobina.text = "BOBINA %s · %.0f m restantes · Ø %.0f mm" % [m.bobina.codigo, m.bobina.metros, m.raio_bobina() * 2000.0]
		barra_bob.value = m.bobina.metros / m.bobina.metros_total
	else:
		lb_bobina.text = "SEM BOBINA"
		barra_bob.value = 0
	lb_cont.text = "CONTADOR %d / %d   ·   NA MESA %d   ·   PEÇA %.2f m" % [m.produzidas, m.quantidade, m.pilha.size(), m.peca_m]
	bt_teste.disabled = m.modo != "manual"
	bt_corte.disabled = m.modo != "manual"
	lb_etapa.text = "PRÓXIMO: " + m.proxima_etapa()
