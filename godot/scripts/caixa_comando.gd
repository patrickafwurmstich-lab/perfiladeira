class_name CaixaComando
extends Node3D
## Caixa de comando (CLP) da perfiladeira. O jogador chega, aperta [E], a câmera vai até a porta
## e ele clica nos botões DE VERDADE: chave geral (gira), emergência (soco/gira p/ soltar),
## RESET, LIGA, DESLIGA, AVANÇO LENTO (segura), seletor MANUAL/AUTO, e a IHM touch na tela.
## Tudo o que a IHM mostra vem da máquina (metros da bobina, contador, alarmes) — nada inventado.

var maquina  # Perfiladeira
var modelo: Node3D
var botoes := {}         # id -> {no, base_z, tipo}
var luzes := {}          # "verde"/"ambar"/"vermelha" -> StandardMaterial3D
var _piscar_t := 0.0
var _cor := ""
var _piscar := false
var tela_vp: SubViewport
var tela_quad: MeshInstance3D
var ihm: Control
var foco: Marker3D
var face_z := 0.162
var y_c := 1.095
const TELA_PX := Vector2i(600, 400)
const TELA_M := Vector2(0.30, 0.20)

func _ready() -> void:
	modelo = load("res://modelos/clp_padrao.glb").instantiate()
	add_child(modelo)
	# o painel do modelo é decorativo; os controles funcionais são montados aqui na face da porta
	for nome in ["tela", "moldura_tela", "botao_liga", "botao_desliga", "botao_reset", "emergencia", "protecao_emergencia", "porta_gabinete", "fechadura"]:
		var n := modelo.find_child(nome, true, false)
		if n: n.visible = false
	var gab := modelo.find_child("gabinete", true, false) as MeshInstance3D
	if gab:
		var bb := gab.get_aabb()
		var t := gab.transform
		var p := gab.get_parent()
		while p and p != self:
			t = (p as Node3D).transform * t
			p = p.get_parent()
		var aabb := t * bb
		face_z = aabb.end.z + 0.004
		y_c = aabb.get_center().y
	for c in ["verde", "ambar", "vermelha"]:
		var l := modelo.find_child("luz_" + c, true, false) as MeshInstance3D
		if l:
			var m := StandardMaterial3D.new()
			m.albedo_color = {"verde": Color(0.1, 0.5, 0.15), "ambar": Color(0.6, 0.4, 0.05), "vermelha": Color(0.55, 0.08, 0.06)}[c]
			m.emission_enabled = true
			m.emission = m.albedo_color
			m.emission_energy_multiplier = 0.0
			l.material_override = m
			luzes[c] = m
	_montar_porta()
	_montar_tela()
	_montar_botoes()
	foco = Marker3D.new()
	add_child(foco)
	foco.transform = Transform3D(Basis(), Vector3(0, y_c + 0.08, face_z + 0.75)).looking_at(Vector3(0, y_c + 0.02, face_z), Vector3.UP)
	var col := StaticBody3D.new()
	add_child(col)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(0.62, 1.6, 0.34)
	cs.shape = bs
	cs.position = Vector3(0, 0.8, 0)
	col.add_child(cs)
	Interagivel.criar(self, Vector3(0, 1.1, face_z + 0.3), _txt_usar, _usar, 1.3)

func _txt_usar() -> String:
	return "Usar a caixa de comando"

func _usar() -> void:
	Interacoes.focar(foco, self, "CAIXA DE COMANDO · clique nos botões e na tela · segure AVANÇO LENTO · Esc ou E sai")

func _montar_porta() -> void:
	var porta := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.56, 0.9, 0.012)
	porta.mesh = bm
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.86, 0.87, 0.85)
	m.roughness = 0.55
	porta.material_override = m
	porta.position = Vector3(0, y_c, face_z - 0.006)
	add_child(porta)
	var placa := Label3D.new()
	placa.text = "PERFILADEIRA TP-40  ·  380 V  ·  15 kW"
	placa.font_size = 22
	placa.pixel_size = 0.0011
	placa.modulate = Color(0.1, 0.1, 0.1)
	placa.outline_size = 0
	placa.position = Vector3(0, y_c + 0.41, face_z + 0.003)
	add_child(placa)

func _montar_tela() -> void:
	tela_vp = SubViewport.new()
	tela_vp.size = TELA_PX
	tela_vp.transparent_bg = false
	tela_vp.render_target_update_mode = SubViewport.UPDATE_ALWAYS
	tela_vp.gui_embed_subwindows = true
	add_child(tela_vp)
	ihm = IHM.new()
	ihm.maquina = maquina
	ihm.size = Vector2(TELA_PX)
	tela_vp.add_child(ihm)
	tela_quad = MeshInstance3D.new()
	var q := QuadMesh.new()
	q.size = TELA_M
	tela_quad.mesh = q
	var m := StandardMaterial3D.new()
	m.albedo_texture = tela_vp.get_texture()
	m.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	tela_quad.material_override = m
	tela_quad.position = Vector3(0, y_c + 0.24, face_z + 0.011)
	add_child(tela_quad)
	var moldura := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(TELA_M.x + 0.03, TELA_M.y + 0.03, 0.01)
	moldura.mesh = bm
	var mm := StandardMaterial3D.new()
	mm.albedo_color = Color(0.12, 0.12, 0.13)
	moldura.material_override = mm
	moldura.position = Vector3(0, y_c + 0.24, face_z + 0.004)
	add_child(moldura)
	var sb := StaticBody3D.new()
	sb.collision_layer = 2
	sb.set_meta("tela", true)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(TELA_M.x, TELA_M.y, 0.01)
	cs.shape = bs
	sb.add_child(cs)
	sb.position = tela_quad.position
	add_child(sb)

func _botao(id: String, pos: Vector2, raio: float, cor: Color, rotulo: String, tipo := "pulso", alto := 0.025) -> void:
	var g := Node3D.new()
	g.position = Vector3(pos.x, y_c + pos.y, face_z)
	add_child(g)
	var mi := MeshInstance3D.new()
	var cy := CylinderMesh.new()
	cy.top_radius = raio
	cy.bottom_radius = raio * 1.05
	cy.height = alto
	mi.mesh = cy
	mi.rotation.x = PI / 2
	mi.position.z = alto * 0.5
	var m := StandardMaterial3D.new()
	m.albedo_color = cor
	m.roughness = 0.35
	mi.material_override = m
	g.add_child(mi)
	# anel do botão
	var anel := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = raio * 1.05
	tm.outer_radius = raio * 1.3
	anel.mesh = tm
	anel.rotation.x = PI / 2
	var ma := StandardMaterial3D.new()
	ma.albedo_color = Color(0.2, 0.2, 0.22)
	ma.metallic = 0.6
	anel.material_override = ma
	g.add_child(anel)
	var lb := Label3D.new()
	lb.text = rotulo
	lb.font_size = 26
	lb.pixel_size = 0.0009
	lb.modulate = Color(0.05, 0.05, 0.05)
	lb.outline_size = 0
	lb.position = Vector3(0, -raio * 1.3 - 0.016, 0.003)
	g.add_child(lb)
	var sb := StaticBody3D.new()
	sb.collision_layer = 2
	sb.set_meta("botao", id)
	var cs := CollisionShape3D.new()
	var sp := CylinderShape3D.new()
	sp.radius = raio * 1.2
	sp.height = alto + 0.02
	cs.shape = sp
	cs.rotation.x = PI / 2
	cs.position.z = alto * 0.5
	sb.add_child(cs)
	g.add_child(sb)
	botoes[id] = {"no": mi, "base_z": alto * 0.5, "tipo": tipo, "grp": g, "mat": m}

func _montar_botoes() -> void:
	_botao("liga", Vector2(-0.19, 0.03), 0.022, Color(0.1, 0.65, 0.2), "LIGA")
	_botao("desliga", Vector2(-0.10, 0.03), 0.022, Color(0.75, 0.12, 0.1), "DESLIGA")
	_botao("reset", Vector2(-0.01, 0.03), 0.022, Color(0.15, 0.35, 0.85), "RESET")
	_botao("jog", Vector2(0.08, 0.03), 0.022, Color(0.12, 0.12, 0.12), "AVANÇO LENTO")
	_botao("modo", Vector2(-0.15, -0.12), 0.026, Color(0.1, 0.1, 0.1), "MANUAL   AUTO", "seletor", 0.02)
	_botao("emergencia", Vector2(0.17, 0.0), 0.036, Color(0.85, 0.07, 0.05), "EMERGÊNCIA", "trava", 0.04)
	_botao("chave", Vector2(0.10, -0.26), 0.045, Color(0.92, 0.75, 0.1), "CHAVE GERAL\n0        I", "seletor", 0.02)
	# fundo amarelo da emergência
	var fundo := MeshInstance3D.new()
	var cy := CylinderMesh.new()
	cy.top_radius = 0.06
	cy.bottom_radius = 0.06
	cy.height = 0.003
	fundo.mesh = cy
	fundo.rotation.x = PI / 2
	var m := StandardMaterial3D.new()
	m.albedo_color = Color(0.98, 0.82, 0.05)
	fundo.material_override = m
	botoes["emergencia"].grp.add_child(fundo)
	# alavancas dos seletores (uma barra que gira)
	for id in ["modo", "chave"]:
		var b: Dictionary = botoes[id]
		var bar := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.012, b.no.mesh.top_radius * 2.0, 0.02)
		bar.mesh = bm
		var mb := StandardMaterial3D.new()
		mb.albedo_color = Color(0.85, 0.1, 0.08) if id == "chave" else Color(0.9, 0.9, 0.9)
		bar.material_override = mb
		bar.position.z = 0.03
		b.grp.add_child(bar)
		b["alavanca"] = bar
	_sincronizar()

func _sincronizar() -> void:
	if maquina == null:
		return
	botoes.chave.alavanca.rotation.z = -PI / 4 if maquina.chave_geral else PI / 4
	botoes.modo.alavanca.rotation.z = -PI / 4 if maquina.modo == "auto" else PI / 4
	var em: MeshInstance3D = botoes.emergencia.no
	em.position.z = botoes.emergencia.base_z - (0.012 if maquina.emergencia else 0.0)

func _process(delta: float) -> void:
	_sincronizar()
	_piscar_t += delta
	var aceso := not _piscar or fmod(_piscar_t, 0.8) < 0.45
	for c in luzes:
		luzes[c].emission_energy_multiplier = 3.5 if (c == _cor and aceso) else 0.0
	# botões luminosos: LIGA aceso produzindo, RESET pisca pedindo reconhecimento
	if maquina:
		botoes.liga.mat.emission_enabled = maquina.v > 0.01
		botoes.liga.mat.emission = Color(0.1, 0.9, 0.2)
		botoes.reset.mat.emission_enabled = maquina.precisa_reset and fmod(_piscar_t, 0.6) < 0.3
		botoes.reset.mat.emission = Color(0.2, 0.4, 1.0)

func torre(cor: String, piscar: bool) -> void:
	_cor = cor
	_piscar = piscar

func _apertar_visual(id: String, dentro: bool) -> void:
	var b: Dictionary = botoes[id]
	if b.tipo == "pulso":
		b.no.position.z = b.base_z - (0.008 if dentro else 0.0)

func on_foco_clique(ev: InputEventMouseButton, hit: Dictionary) -> void:
	if ev.button_index != MOUSE_BUTTON_LEFT:
		return
	if not ev.pressed:
		# soltar o mouse solta o AVANÇO LENTO e os botões de pulso
		maquina.cmd_jog(false)
		for id in botoes:
			_apertar_visual(id, false)
		_tela_evento(ev, hit, false)
		return
	if hit.is_empty():
		return
	var col: Object = hit.collider
	if col.has_meta("tela"):
		_tela_evento(ev, hit, true)
		return
	if not col.has_meta("botao"):
		return
	var id: String = col.get_meta("botao")
	_apertar_visual(id, true)
	match id:
		"liga": maquina.cmd_liga()
		"desliga": maquina.cmd_desliga()
		"reset": maquina.cmd_reset()
		"jog":
			Som.tocar("click", self)
			maquina.cmd_jog(true)
		"modo": maquina.cmd_modo("manual" if maquina.modo == "auto" else "auto")
		"emergencia": maquina.cmd_emergencia()
		"chave":
			Som.tocar("trava", self)
			maquina.cmd_chave_geral(not maquina.chave_geral)

func on_foco_saiu() -> void:
	maquina.cmd_jog(false)

var _ultimo_px := Vector2.ZERO
func _tela_evento(ev: InputEventMouseButton, hit: Dictionary, apertou: bool) -> void:
	var px := _ultimo_px
	if apertou:
		var local: Vector3 = tela_quad.global_transform.affine_inverse() * (hit.position as Vector3)
		var uv := Vector2(local.x / TELA_M.x + 0.5, 0.5 - local.y / TELA_M.y)
		px = uv * Vector2(TELA_PX)
		_ultimo_px = px
	var e := InputEventMouseButton.new()
	e.button_index = MOUSE_BUTTON_LEFT
	e.pressed = apertou
	e.position = px
	e.global_position = px
	var mv := InputEventMouseMotion.new()
	mv.position = px
	mv.global_position = px
	tela_vp.push_input(mv)
	tela_vp.push_input(e)
