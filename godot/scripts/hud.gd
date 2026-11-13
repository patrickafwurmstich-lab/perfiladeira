class_name HUD
extends CanvasLayer
## HUD mínimo: relógio, checklist de partida (ensina o procedimento real), [E] do ponto mais perto,
## avisos que somem, alarme que FICA até resolver, barra de progresso e a conquista grande.

var jogador
var maquina
var maquinas: Array = []
var lb_relogio: Label
var lb_check: RichTextLabel
var lb_prompt: Label
var caixa_avisos: VBoxContainer
var faixa_alarme: Label
var barra: ProgressBar
var lb_barra: Label
var lb_dica: Label
var conq: Label
var _conq_t := 0.0
var mira: ColorRect
var ajuda: Label
var mostrar_check := true

func _ready() -> void:
	lb_relogio = _lab(18, Color(1, 1, 1))
	lb_relogio.position = Vector2(16, 10)
	add_child(lb_relogio)
	lb_check = RichTextLabel.new()
	lb_check.bbcode_enabled = true
	lb_check.fit_content = true
	lb_check.position = Vector2(16, 44)
	lb_check.size = Vector2(470, 400)
	lb_check.add_theme_font_size_override("normal_font_size", 14)
	lb_check.add_theme_color_override("default_color", Color(0.92, 0.92, 0.92))
	lb_check.add_theme_constant_override("outline_size", 4)
	lb_check.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.8))
	add_child(lb_check)
	lb_prompt = _lab(20, Color(1, 0.95, 0.6))
	lb_prompt.set_anchors_preset(Control.PRESET_CENTER_BOTTOM)
	lb_prompt.position = Vector2(0, -120)
	lb_prompt.size = Vector2(1280, 30)
	lb_prompt.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	lb_prompt.anchor_left = 0; lb_prompt.anchor_right = 1; lb_prompt.anchor_top = 1; lb_prompt.anchor_bottom = 1
	lb_prompt.offset_left = 0; lb_prompt.offset_right = 0; lb_prompt.offset_top = -130; lb_prompt.offset_bottom = -100
	add_child(lb_prompt)
	caixa_avisos = VBoxContainer.new()
	caixa_avisos.anchor_left = 1; caixa_avisos.anchor_right = 1
	caixa_avisos.offset_left = -520; caixa_avisos.offset_right = -16; caixa_avisos.offset_top = 12
	caixa_avisos.alignment = BoxContainer.ALIGNMENT_BEGIN
	add_child(caixa_avisos)
	faixa_alarme = _lab(22, Color(1, 1, 1))
	faixa_alarme.anchor_left = 0.5; faixa_alarme.anchor_right = 0.5; faixa_alarme.anchor_top = 1; faixa_alarme.anchor_bottom = 1
	faixa_alarme.offset_left = -320; faixa_alarme.offset_right = 320; faixa_alarme.offset_top = -260; faixa_alarme.offset_bottom = -224
	faixa_alarme.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	faixa_alarme.vertical_alignment = VERTICAL_ALIGNMENT_CENTER
	var sb := StyleBoxFlat.new()
	sb.bg_color = Color(0.7, 0.05, 0.05, 0.85)
	faixa_alarme.add_theme_stylebox_override("normal", sb)
	faixa_alarme.visible = false
	add_child(faixa_alarme)
	barra = ProgressBar.new()
	barra.anchor_left = 0.5; barra.anchor_right = 0.5; barra.anchor_top = 1; barra.anchor_bottom = 1
	barra.offset_left = -200; barra.offset_right = 200; barra.offset_top = -180; barra.offset_bottom = -160
	barra.max_value = 1.0
	barra.show_percentage = false
	barra.visible = false
	add_child(barra)
	lb_barra = _lab(17, Color(1, 1, 1))
	lb_barra.anchor_left = 0; lb_barra.anchor_right = 1; lb_barra.anchor_top = 1; lb_barra.anchor_bottom = 1
	lb_barra.offset_top = -210; lb_barra.offset_bottom = -184
	lb_barra.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(lb_barra)
	lb_dica = _lab(16, Color(0.8, 0.95, 1))
	lb_dica.anchor_left = 0; lb_dica.anchor_right = 1; lb_dica.anchor_top = 1; lb_dica.anchor_bottom = 1
	lb_dica.offset_top = -40; lb_dica.offset_bottom = -14
	lb_dica.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_child(lb_dica)
	conq = _lab(34, Color(1, 0.85, 0.2))
	conq.anchor_left = 0; conq.anchor_right = 1; conq.anchor_top = 0.35; conq.anchor_bottom = 0.35
	conq.horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	conq.add_theme_constant_override("outline_size", 10)
	conq.visible = false
	add_child(conq)
	mira = ColorRect.new()
	mira.color = Color(1, 1, 1, 0.7)
	mira.anchor_left = 0.5; mira.anchor_right = 0.5; mira.anchor_top = 0.5; mira.anchor_bottom = 0.5
	mira.offset_left = -2; mira.offset_right = 2; mira.offset_top = -2; mira.offset_bottom = 2
	add_child(mira)
	ajuda = _lab(15, Color(1, 1, 1))
	ajuda.anchor_left = 0; ajuda.anchor_right = 0; ajuda.anchor_top = 1; ajuda.anchor_bottom = 1
	ajuda.offset_left = 16; ajuda.offset_top = -100; ajuda.offset_right = 360; ajuda.offset_bottom = -10
	ajuda.text = "WASD andar · Shift correr · Mouse olhar\nE usar/sair · V 1ª/3ª pessoa · roda zoom\nT velocidade do relógio · H esconde a lista\nEsc solta o mouse · empilhadeira: R/F garfos"
	add_child(ajuda)
	# NADA do HUD pode segurar o mouse: com o mouse preso o ponteiro fica no centro da tela,
	# em cima da mira, e um elemento que "para" o evento travava a câmera em 1ª pessoa
	_ignorar_mouse(self)
	Bus.aviso.connect(_aviso)
	Bus.alarme.connect(func(_o, t): faixa_alarme.text = "! " + t; faixa_alarme.visible = true)
	Bus.alarme_resolvido.connect(func(_o): faixa_alarme.visible = false)
	Bus.conquista.connect(_conquista)
	Interacoes.progresso_mudou.connect(_progresso)
	Interacoes.dica.connect(func(t): lb_dica.text = t)

func _ignorar_mouse(n: Node) -> void:
	for c in n.get_children():
		if c is Control:
			(c as Control).mouse_filter = Control.MOUSE_FILTER_IGNORE
		_ignorar_mouse(c)

func _lab(tam: int, cor: Color) -> Label:
	var l := Label.new()
	l.add_theme_font_size_override("font_size", tam)
	l.add_theme_color_override("font_color", cor)
	l.add_theme_constant_override("outline_size", 5)
	l.add_theme_color_override("font_outline_color", Color(0, 0, 0, 0.85))
	return l

func _aviso(t: String) -> void:
	var l := _lab(15, Color(1, 1, 1))
	l.mouse_filter = Control.MOUSE_FILTER_IGNORE
	l.text = t
	l.autowrap_mode = TextServer.AUTOWRAP_WORD
	l.custom_minimum_size.x = 500
	l.horizontal_alignment = HORIZONTAL_ALIGNMENT_RIGHT
	caixa_avisos.add_child(l)
	while caixa_avisos.get_child_count() > 5:
		caixa_avisos.get_child(0).queue_free()
		caixa_avisos.remove_child(caixa_avisos.get_child(0))
	var tw := create_tween()
	tw.tween_interval(6.0)
	tw.tween_property(l, "modulate:a", 0.0, 1.0)
	tw.tween_callback(l.queue_free)

func _conquista(nome: String, texto: String) -> void:
	conq.text = "* " + nome + " *\n" + texto
	conq.visible = true
	_conq_t = 5.0
	Som.tocar("buzina", null, Vector3.ZERO, -8.0)

func _progresso(t: String, f: float) -> void:
	barra.visible = f >= 0.0
	barra.value = maxf(f, 0.0)
	lb_barra.text = t if f >= 0.0 else ""

func _unhandled_input(ev: InputEvent) -> void:
	if ev.is_action_pressed("ajuda"):
		mostrar_check = not mostrar_check

func _process(delta: float) -> void:
	lb_relogio.text = Relogio.rotulo()
	if _conq_t > 0.0:
		_conq_t -= delta
		conq.visible = _conq_t > 0.0
	if maquina:
		# a lista acompanha a máquina mais perto do jogador
		if jogador and maquinas.size() > 1:
			var melhor := 1e9
			for mq in maquinas:
				var d: float = jogador.global_position.distance_to(mq.to_global(Vector3((mq.X_DESB + mq.X_CORTE) * 0.5, 0, 0)))
				if d < melhor:
					melhor = d
					maquina = mq
		var s := "[b]PARTIDA: %s[/b]\n" % maquina.NOME.to_upper()
		var achou := false
		for e in maquina.etapas():
			if e[0] == "":
				continue
			if e[1]:
				s += "[color=#7fd67f]OK  %s[/color]\n" % e[0]
			elif not achou:
				s += "[color=#ffd75e]>> %s[/color]\n" % e[0]
				achou = true
			else:
				s += "[color=#9a9a9a]-  %s[/color]\n" % e[0]
		lb_check.text = s
		lb_check.visible = mostrar_check
	ajuda.visible = mostrar_check and Interacoes.modo == "andar"
	if jogador:
		lb_prompt.text = ("[E]  " + jogador.alvo.texto()) if jogador.alvo else ""
		mira.visible = jogador.primeira_pessoa and Interacoes.modo == "andar"
