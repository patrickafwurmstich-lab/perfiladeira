class_name PonteRolante
extends Node3D
## Ponte rolante 3 t. O jogador pega a BOTOEIRA (pendurada no carro) e opera de verdade, com ela
## NA MÃO e a câmera normal dele (gira no mouse para acompanhar a carga), como um operador de galpão:
##  W/S = afasta/aproxima a carga de você · A/D = para os lados (a ponte só anda nos 2 eixos dela:
##  a tecla escolhe o eixo que mais combina com para onde você está olhando)
##  R/F = sobe/desce o gancho · G = engatar/soltar a cinta · Esc/E = larga a botoeira.
## O cabo da botoeira tem 9 m: a ponte não se afasta mais que isso de você (ande junto).
## A carga balança (pêndulo com o comprimento real do cabo) quando a ponte/carro aceleram ou freiam.
## Bobina no mandril: tem que ficar COAXIAL (±3 cm) ao lado do eixo; aí "empurra" a bobina para dentro.
## Velocidades de uma ponte de galpão real (não aceleram com o relógio: quem opera é o jogador).

const Y_VIGA := 9.13
const Y_CARRO := 10.21
const V_PONTE := 0.5       # m/s (30 m/min)
const V_CARRO := 0.33      # m/s (20 m/min)
const V_GANCHO := 0.12     # m/s (7 m/min)
const ACEL := 0.35
const H_MIN := 0.35        # gancho não desce além disso (fim de curso inferior)
const H_MAX := 8.6         # fim de curso superior
const X_MIN := -19.0
const X_MAX := 105.0
const Z_MIN := -18.5
const Z_MAX := 18.5
const CAPACIDADE_KG := 3000.0
const OFF_CINTA := 0.95    # do gancho até o centro da bobina pendurada (cinta + moitão)
const FUNDO_GANCHO := Vector3(0.09, 0.075, 0.0)   # curva do gancho em relação à origem do modelo (origem embaixo)
const TOPO_MOITAO := 0.70                         # topo do moitão, onde o cabo de aço entra
const CABO_BOTOEIRA := 9.0 # alcance horizontal do cabo da botoeira (do carro até a mão)

var maquina
var jogador
var x := -7.2
var z := -2.0
var h := 4.0               # altura do gancho
var vx := 0.0
var vz := 0.0
var vh := 0.0
var operando := false
var carga = null           # Dictionary da bobina pendurada
var bobinas: Array = []    # bobinas soltas no galpão: {no: Node3D, pos: Vector3, codigo, metros}
var balanco := Vector2.ZERO        # ângulo do pêndulo (x, z) em rad
var balanco_v := Vector2.ZERO
var encaixando := 0.0
var _avisou_cabo := false
var off_carga := OFF_CINTA     # comprimento da cinta + moitão da carga atual (ajusta na hora de engatar)
var bercos: Array = []         # centros de apoio das bobinas nos berços (Vector3)
const Y_BERCO := 0.55          # altura do centro da bobina apoiada no V do berço

var viga: Node3D
var carro: Node3D
var gancho: Node3D
var cabo: MeshInstance3D
var cinta: Node3D             # cinta de poliéster de 2 pernas: gancho → furo → gancho
var fitas: Array = []         # [perna_frente, perna_tras, trecho dentro do furo, laço no gancho]
var botoeira: Node3D
var cabo_bot: MeshInstance3D
var foco: Marker3D
var som_motor: AudioStreamPlayer3D

func _ready() -> void:
	viga = load("res://modelos/ponte_viga.glb").instantiate()
	add_child(viga)
	carro = load("res://modelos/ponte_carro.glb").instantiate()
	add_child(carro)
	gancho = load("res://modelos/ponte_gancho.glb").instantiate()
	add_child(gancho)
	cabo = MeshInstance3D.new()
	var cy := CylinderMesh.new()
	cy.top_radius = 0.008
	cy.bottom_radius = 0.008
	cy.height = 1.0
	cabo.mesh = cy
	var mc := StandardMaterial3D.new()
	mc.albedo_color = Color(0.25, 0.25, 0.27)
	mc.metallic = 0.8
	cabo.material_override = mc
	add_child(cabo)
	# cinta de poliéster vermelha (como na foto do Lucas): duas pernas saem do gancho, cada uma
	# desce para uma face da bobina e as duas passam POR DENTRO do furo, formando um "V" invertido
	cinta = Node3D.new()
	cinta.visible = false
	add_child(cinta)
	var mci := StandardMaterial3D.new()
	mci.albedo_color = Color(0.82, 0.10, 0.07)
	mci.roughness = 0.85
	mci.cull_mode = BaseMaterial3D.CULL_DISABLED
	var mfx := StandardMaterial3D.new()
	mfx.albedo_color = Color(0.95, 0.85, 0.1)     # faixa da etiqueta de carga (amarela)
	for i in 4:
		var f := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.09, 1.0, 0.008)
		f.mesh = bm
		f.material_override = mci
		cinta.add_child(f)
		fitas.append(f)
	var etq := MeshInstance3D.new()
	var be := BoxMesh.new()
	be.size = Vector3(0.07, 0.10, 0.012)
	etq.mesh = be
	etq.material_override = mfx
	fitas[0].add_child(etq)
	botoeira = load("res://modelos/botoeira.glb").instantiate()
	add_child(botoeira)
	cabo_bot = MeshInstance3D.new()
	var cy2 := CylinderMesh.new()
	cy2.top_radius = 0.006
	cy2.bottom_radius = 0.006
	cy2.height = 1.0
	cabo_bot.mesh = cy2
	var mb := StandardMaterial3D.new()
	mb.albedo_color = Color(0.1, 0.1, 0.1)
	cabo_bot.material_override = mb
	add_child(cabo_bot)
	foco = Marker3D.new()
	add_child(foco)
	som_motor = Som.laco("hidraulica", self)
	Interagivel.criar(botoeira, Vector3(0, 0.3, 0.2), _txt_botoeira, _pegar, 1.4)
	# anel guia na ponta do mandril: aparece quando a bobina chega perto (amarelo longe, verde = G funciona)
	anel_guia = MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.30
	tm.outer_radius = 0.34
	tm.rings = 32
	anel_guia.mesh = tm
	anel_guia.rotation.x = PI / 2
	mat_guia = StandardMaterial3D.new()
	mat_guia.shading_mode = BaseMaterial3D.SHADING_MODE_UNSHADED
	mat_guia.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mat_guia.no_depth_test = true
	anel_guia.material_override = mat_guia
	anel_guia.visible = false
	add_child(anel_guia)
	_atualizar(0.0)

func nova_bobina(pos: Vector3, codigo: String, metros := 247.0) -> void:
	var no := Node3D.new()
	add_child(no)
	no.position = pos
	var corpo := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	var r := sqrt(Perfiladeira.R_FURO * Perfiladeira.R_FURO + metros * Perfiladeira.ESPESSURA / PI)
	cm.top_radius = r
	cm.bottom_radius = r
	cm.height = 1.2
	cm.radial_segments = 40
	corpo.mesh = cm
	corpo.rotation.x = PI / 2
	corpo.material_override = Perfil.material_bobina()
	no.add_child(corpo)
	var furo := MeshInstance3D.new()
	var fm := CylinderMesh.new()
	fm.top_radius = Perfiladeira.R_FURO
	fm.bottom_radius = Perfiladeira.R_FURO
	fm.height = 1.205
	furo.mesh = fm
	furo.rotation.x = PI / 2
	var mf := StandardMaterial3D.new()
	mf.albedo_color = Color(0.16, 0.17, 0.19)
	furo.material_override = mf
	no.add_child(furo)
	var mci := StandardMaterial3D.new()
	mci.albedo_color = Color(0.20, 0.33, 0.48)
	for zz in [-0.42, 0.0, 0.42]:
		var c := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = r
		tm.outer_radius = r + 0.008
		c.mesh = tm
		c.rotation.x = PI / 2
		c.position.z = zz
		c.material_override = mci
		no.add_child(c)
	var et := Label3D.new()
	et.text = "%s\n%.0f m · 1.000 kg" % [codigo, metros]
	et.font_size = 32
	et.pixel_size = 0.003
	et.position = Vector3(0, 0, 0.62)
	et.modulate = Color(0.1, 0.1, 0.1)
	et.outline_size = 0
	no.add_child(et)
	bobinas.append({"no": no, "pos": pos, "codigo": codigo, "metros": metros, "kg": 1000.0, "r": r})

func _txt_botoeira() -> String:
	return "Pegar a botoeira da ponte rolante"

func _pegar() -> void:
	operando = true
	Interacoes.operar(self, "")
	if DisplayServer.get_name() != "headless":
		Input.mouse_mode = Input.MOUSE_MODE_CAPTURED
	_dica()

func on_foco_saiu() -> void:
	operando = false

func on_foco_tecla(_ev) -> void:
	if _ev.pressed and _ev.physical_keycode == KEY_G:
		_engatar_ou_soltar()

func on_foco_clique(_ev, _hit) -> void:
	pass

func _dica() -> void:
	var s := "PONTE · W/S afasta/aproxima · A/D lados · R/F gancho · Shift lento · G engata/solta · E larga  |  gancho %.2f m" % h
	if carga:
		s += "  |  CARGA %s %.0f kg" % [carga.codigo, carga.kg]
	var alvo := _alvo_proximo()
	if alvo != "":
		s += "  |  " + alvo
	Interacoes.dica.emit(s)

func _pos_carga() -> Vector3:
	var L := Y_CARRO - h
	var off := Vector3(sin(balanco.x), 0, sin(balanco.y)) * (L + off_carga)
	var p := Vector3(x, h - off_carga, z) + off
	if carga and carga.get("apoiada", false):
		var rep_p: Vector3 = carga.repouso
		if h - off_carga <= rep_p.y:
			return rep_p        # cinta frouxa: a bobina continua parada no apoio
	return p

## chamado todo quadro: a cinta estica e a bobina sai do apoio → começa a balançar a partir de onde estava
func _checar_saida_do_apoio() -> void:
	if carga == null:
		return
	if not carga.get("apoiada", false):
		# descendo: encostou no berço/chão → a cinta afrouxa e a bobina fica parada ali (não afunda)
		var p := _pos_carga()
		var ap := _apoio_centro(p.x, p.z, carga.r)
		if p.y <= ap + 0.001 and encaixando <= 0.0:
			carga["apoiada"] = true
			carga["repouso"] = Vector3(p.x, ap, p.z)
			balanco = Vector2.ZERO
			balanco_v = Vector2.ZERO
		return
	var rep_p: Vector3 = carga.repouso
	if h - off_carga > rep_p.y:
		carga.apoiada = false
		var Lt := Y_CARRO - h + off_carga
		balanco = Vector2(asin(clampf((rep_p.x - x) / Lt, -0.5, 0.5)), asin(clampf((rep_p.z - z) / Lt, -0.5, 0.5)))
		balanco_v = Vector2.ZERO
		Bus.aviso.emit("Cinta esticou: a %s saiu do apoio." % carga.codigo)

## altura do centro da bobina quando apoiada no que está embaixo dela (berço ou chão)
func _apoio_centro(px: float, pz: float, r: float) -> float:
	for b in bercos:
		if absf(px - b.x) < 0.45 and absf(pz - b.z) < 0.45:
			return Y_BERCO
	return r

## o que dá para fazer agora com a ponte (texto para a dica)
func _alvo_proximo() -> String:
	if carga == null:
		var b = _bobina_sob_gancho()
		if b:
			return "G = passar a cinta na %s" % b.codigo
		return ""
	var m_loc: Vector3 = maquina.to_local(_pos_carga())
	var dx: float = m_loc.x - maquina.X_DESB
	var dy: float = m_loc.y - maquina.Y_DESB
	if absf(dx) < 0.6 and absf(m_loc.z) < 2.5:
		if _pode_guiar(m_loc):
			return "PERTO DO MANDRIL: G = guiar com a mão e empurrar para dentro"
		return "Alinhe com o mandril: Δx %+.0f mm · Δaltura %+.0f mm" % [dx * 1000, dy * 1000]
	return ""

## bobina logo abaixo do gancho: centralizado a até 35 cm e o gancho entre o topo dela e 1,5 m acima
func _bobina_sob_gancho():
	for b in bobinas:
		var c: Vector3 = b.no.global_position
		var d := Vector2(c.x - x, c.z - z)
		var acima: float = h - (c.y + b.r)
		if d.length() < 0.35 and acima > -0.02 and acima < 1.5:
			return b
	return null

## topo da bobina mais alta logo abaixo do gancho (o gancho não entra na bobina)
func _topo_embaixo() -> float:
	var t := -10.0
	for b in bobinas:
		var c: Vector3 = b.no.global_position
		if Vector2(c.x - x, c.z - z).length() < 0.5:
			t = maxf(t, c.y + b.r)
	return t

func _engatar_ou_soltar() -> void:
	if carga == null:
		var b = _bobina_sob_gancho()
		if b == null:
			Bus.aviso.emit("Gancho longe: centralize o gancho em cima da bobina e desça até perto dela.")
			return
		if b.kg > CAPACIDADE_KG:
			Bus.aviso.emit("Carga acima da capacidade da ponte!")
			return
		carga = b
		bobinas.erase(b)
		# a cinta se ajusta: o centro da bobina fica onde está; o gancho guarda essa distância
		# pernas da cinta com comprimento real: se o gancho estiver baixo, a cinta fica frouxa e a
		# bobina só sai do apoio quando o gancho sobe e a cinta estica
		off_carga = maxf(h - b.no.global_position.y, b.r + 0.55)
		# gancho fora de centro: ao subir, a bobina "puxa" para baixo do gancho e balança (não teleporta)
		carga["apoiada"] = true
		carga["repouso"] = carga.no.global_position
		balanco = Vector2.ZERO
		balanco_v = Vector2.ZERO
		cinta.visible = true
		Som.tocar("trava", null, Vector3(x, h, z), -4.0)
		Bus.aviso.emit("Cinta passada no furo da %s. Suba devagar." % b.codigo)
		return
	# com carga: encaixar no mandril se coaxial, senão pousar no chão/berço
	var m_loc: Vector3 = maquina.to_local(_pos_carga())
	if _pode_guiar(m_loc):
		if maquina.bobina.presente:
			Bus.aviso.emit("O mandril já tem bobina.")
			return
		if maquina.bobina_travada_vazia():
			Bus.aviso.emit("Mandril expandido: destrave (alavanca) para a bobina entrar.")
			return
		encaixando = 0.001
		return
	var pc := _pos_carga()
	var apoio := _apoio_centro(pc.x, pc.z, carga.r)
	if pc.y - apoio > 0.04:
		Bus.aviso.emit("Desça a bobina até apoiar (no chão ou no berço) antes de soltar a cinta — nunca solte carga no ar.")
		return
	carga.no.position = to_local(Vector3(pc.x, apoio, pc.z))
	carga.erase("apoiada")
	carga.erase("repouso")
	bobinas.append(carga)
	carga = null
	cinta.visible = false
	Som.tocar("clank", null, Vector3(x, h, z), -2.0)

func _physics_process(delta: float) -> void:
	var ax := 0.0
	var az := 0.0
	var ah := 0.0
	if operando and Interacoes.modo != "ponte":
		operando = false
	if operando and encaixando <= 0.0:
		# teclas relativas à câmera, travadas no eixo da ponte (X) ou do carro (Z) que mais combina
		var ent := Vector2(Input.get_axis("esquerda", "direita"), Input.get_axis("frente", "tras"))
		if ent.length() > 0.1 and jogador:
			var b: Basis = jogador.cam.global_transform.basis
			var fr := Vector3(-b.z.x, 0, -b.z.z).normalized()
			var di := Vector3(b.x.x, 0, b.x.z).normalized()
			var mundo := di * ent.x - fr * ent.y
			if absf(mundo.x) >= absf(mundo.z):
				ax = signf(mundo.x)
			else:
				az = signf(mundo.z)
		ah = float(Input.is_physical_key_pressed(KEY_R)) - float(Input.is_physical_key_pressed(KEY_F))
	var vx0 := vx
	var vz0 := vz
	# Shift = velocidade lenta (25%), como o 2º estágio do botão de uma botoeira de verdade
	var lento := 0.25 if (operando and Input.is_action_pressed("correr")) else 1.0
	vx = move_toward(vx, ax * V_PONTE * lento, ACEL * delta)
	vz = move_toward(vz, az * V_CARRO * lento, ACEL * delta)
	vh = ah * V_GANCHO * (0.35 if lento < 1.0 else 1.0)
	var nx := clampf(x + vx * delta, X_MIN, X_MAX)
	var nz := clampf(z + vz * delta, Z_MIN, Z_MAX)
	if operando and jogador:
		# o cabo da botoeira não estica: além do alcance a ponte para
		var pj: Vector3 = jogador.global_position
		var d_novo := Vector2(nx - pj.x, nz - pj.z).length()
		if d_novo > CABO_BOTOEIRA and d_novo > Vector2(x - pj.x, z - pj.z).length():
			if not _avisou_cabo:
				_avisou_cabo = true
				Bus.aviso.emit("Cabo da botoeira no limite: largue (E), ande junto e pegue de novo.")
			nx = x
			nz = z
			vx = 0.0
			vz = 0.0
		else:
			_avisou_cabo = false
	x = nx
	z = nz
	var h_min := maxf(H_MIN, _topo_embaixo() + 0.02)   # o gancho para em cima da bobina, não entra nela
	if carga:
		h_min = maxf(H_MIN, _apoio_centro(x, z, carga.r) + carga.r + 0.02)   # gancho pode afrouxar a cinta até encostar na bobina
	h = clampf(h + vh * delta, h_min, H_MAX)
	# pêndulo: a aceleração da ponte/carro empurra a carga para trás; amortece com o tempo
	var L := maxf(0.3, Y_CARRO - h + off_carga)
	var w2 := 9.8 / L
	var acc := Vector2((vx - vx0) / maxf(delta, 0.0001), (vz - vz0) / maxf(delta, 0.0001))
	balanco_v += (-w2 * balanco - acc / L) * delta
	balanco_v *= 1.0 - 0.35 * delta
	balanco += balanco_v * delta
	_checar_saida_do_apoio()
	if carga == null or carga.get("apoiada", false):
		balanco *= 0.9      # sem carga, ou carga ainda apoiada: não balança
	if encaixando > 0.0:
		_encaixar(delta)
	_atualizar(delta)
	if operando:
		_dica()

## a até 15 cm do eixo (lado e altura), na frente do mandril ou já entrando nele: dá para guiar com a mão
## (é o que o operador faz: desce perto e empurra a bobina para o eixo)
const GUIA_TOL := 0.15
func _pode_guiar(m_loc: Vector3) -> bool:
	return absf(m_loc.x - maquina.X_DESB) <= GUIA_TOL and absf(m_loc.y - maquina.Y_DESB) <= GUIA_TOL and m_loc.z > -0.3 and m_loc.z < 2.5

var _ini_encaixe := Vector3.ZERO
var anel_guia: MeshInstance3D
var mat_guia: StandardMaterial3D
func _encaixar(delta: float) -> void:
	# 1º terço: a mão alinha a bobina com o eixo; depois ela desliza no mandril até o batente
	if encaixando <= 0.0011:
		_ini_encaixe = maquina.to_local(_pos_carga())
	encaixando += delta / 3.5
	var k := clampf(encaixando, 0.0, 1.0)
	var ka := smoothstep(0.0, 0.3, k)
	var kz := smoothstep(0.3, 1.0, k)
	var p := Vector3(lerpf(_ini_encaixe.x, maquina.X_DESB, ka), lerpf(_ini_encaixe.y, maquina.Y_DESB, ka), lerpf(_ini_encaixe.z, 0.0, kz))
	carga.no.global_position = maquina.to_global(p)
	balanco = Vector2.ZERO
	balanco_v = Vector2.ZERO
	if encaixando >= 1.0:
		encaixando = 0.0
		maquina.receber_bobina(carga.codigo, carga.metros)
		carga.no.queue_free()
		carga = null
		cinta.visible = false
		Som.tocar("trava", null, maquina.global_position + Vector3(maquina.X_DESB, maquina.Y_DESB, 0))
		Bus.aviso.emit("Bobina no mandril. Solte o gancho (suba), trave o mandril e ajuste o freio.")

## coloca uma fita (caixa fina) de a até b, com a largura virada para "larg"
func _fita(no: MeshInstance3D, a: Vector3, b: Vector3, larg: Vector3) -> void:
	var y := b - a
	var L := maxf(y.length(), 0.001)
	var yn := y / L
	var xn := (larg - yn * larg.dot(yn)).normalized()
	if xn.length() < 0.5:
		xn = yn.cross(Vector3.UP).normalized()
	var zn := xn.cross(yn)
	no.global_transform = Transform3D(Basis(xn, yn * L, zn), (a + b) * 0.5)

func _desenhar_cinta() -> void:
	var c: Vector3 = carga.no.global_position
	var eixo: Vector3 = carga.no.global_transform.basis.z.normalized()   # eixo da bobina (furo)
	var lado := eixo.cross(Vector3.UP).normalized()                      # largura da fita
	var topo_furo := Perfiladeira.R_FURO - 0.012
	var e1 := c + eixo * 0.6 + Vector3.UP * topo_furo                     # boca do furo, face 1
	var e2 := c - eixo * 0.6 + Vector3.UP * topo_furo                     # boca do furo, face 2
	var g := Vector3(x, h, z) + FUNDO_GANCHO                             # fundo da curva do gancho (medido no modelo)
	_fita(fitas[0], g, e1, lado)
	_fita(fitas[1], g, e2, lado)
	_fita(fitas[2], e1, e2, lado)                                        # trecho que passa por dentro do furo
	_fita(fitas[3], g - eixo * 0.06, g + eixo * 0.06, lado)              # laço apoiado na curva do gancho
	var L0 := maxf((e1 - g).length(), 0.01)
	var etq := fitas[0].get_child(0) as Node3D
	etq.scale = Vector3(1, 1.0 / L0, 1)                    # etiqueta não estica junto com a perna
	etq.position = Vector3(0, 0.5 - 0.3 / L0, 0.006)

func _atualizar(_delta: float) -> void:
	viga.position = Vector3(x, Y_VIGA, 0)
	carro.position = Vector3(x, Y_CARRO, z)
	gancho.position = Vector3(x, h, z)
	var topo := Vector3(x, Y_CARRO - 0.3, z)
	var base := Vector3(x, h + TOPO_MOITAO, z)
	cabo.position = (topo + base) * 0.5
	cabo.scale = Vector3(1, maxf(topo.y - base.y, 0.01), 1)
	if carga and encaixando <= 0.0:
		var p := _pos_carga()
		carga.no.position = to_local(p)
	if carga:
		_desenhar_cinta()
	# botoeira: na mão do operador quando em uso; senão pendurada ao lado do gancho (fora da carga)
	var bpos: Vector3
	if operando and jogador:
		var yv: float = jogador.visual.rotation.y
		bpos = jogador.global_position + Basis(Vector3.UP, yv) * Vector3(-0.22, 0.62, 0.32)
		botoeira.rotation.y = yv
	else:
		bpos = Vector3(x + 0.9, 0.85, z + 1.3)
		botoeira.rotation.y = 0.0
	botoeira.position = bpos
	# cabo da botoeira: do carro até o topo da botoeira (fica inclinado quando você se afasta)
	var topo_b := bpos + Vector3(0, 0.72, 0)
	var ancora := Vector3(x + 0.5, Y_CARRO - 0.3, z + 0.5)
	var dcb := ancora - topo_b
	cabo_bot.position = (topo_b + ancora) * 0.5
	if dcb.length() > 0.01:
		var yv2 := dcb.normalized()
		var ref := Vector3.FORWARD if absf(yv2.dot(Vector3.FORWARD)) < 0.9 else Vector3.RIGHT
		var xv := yv2.cross(ref).normalized()
		cabo_bot.basis = Basis(xv, yv2 * dcb.length(), xv.cross(yv2))
	# anel guia do mandril
	var mostra_guia := false
	if carga and encaixando <= 0.0 and maquina and not maquina.bobina.presente:
		var ml: Vector3 = maquina.to_local(_pos_carga())
		if absf(ml.x - maquina.X_DESB) < 1.5 and ml.z > -0.5 and ml.z < 4.0:
			mostra_guia = true
			anel_guia.global_position = maquina.to_global(Vector3(maquina.X_DESB, maquina.Y_DESB, 0.8))
			mat_guia.albedo_color = Color(0.2, 1.0, 0.3, 0.75) if _pode_guiar(ml) else Color(1.0, 0.85, 0.1, 0.55)
	anel_guia.visible = mostra_guia
	som_motor.volume_db = -10.0 if (absf(vx) + absf(vz) + absf(vh)) > 0.01 else -80.0
