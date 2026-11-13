class_name PonteRolante
extends Node3D
## Ponte rolante 3 t. O jogador pega a BOTOEIRA (pendurada no carro) e opera de verdade:
##  A/D = ponte (eixo X, ao longo do galpão) · W/S = carro (eixo Z) · R/F = sobe/desce o gancho
##  G = engatar/soltar a cinta na bobina · Esc/E = larga a botoeira.
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

var maquina
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

var viga: Node3D
var carro: Node3D
var gancho: Node3D
var cabo: MeshInstance3D
var cinta: MeshInstance3D
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
	# cinta de içamento (laranja) que passa pelo furo da bobina
	cinta = MeshInstance3D.new()
	var cb := BoxMesh.new()
	cb.size = Vector3(0.08, 1.0, 0.012)
	cinta.mesh = cb
	var mci := StandardMaterial3D.new()
	mci.albedo_color = Color(0.95, 0.45, 0.05)
	cinta.material_override = mci
	cinta.visible = false
	add_child(cinta)
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
	Interacoes.focar(foco, self, "")
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
	var s := "PONTE · A/D ponte · W/S carro · R/F gancho · G engata/solta · Esc larga  |  gancho %.2f m" % h
	if carga:
		s += "  |  CARGA %s %.0f kg" % [carga.codigo, carga.kg]
	var alvo := _alvo_proximo()
	if alvo != "":
		s += "  |  " + alvo
	Interacoes.dica.emit(s)

func _pos_carga() -> Vector3:
	var L := Y_CARRO - h
	var off := Vector3(sin(balanco.x), 0, sin(balanco.y)) * (L + OFF_CINTA)
	return Vector3(x, h - OFF_CINTA, z) + off

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
		if absf(dx) <= 0.03 and absf(dy) <= 0.03 and m_loc.z > 0.55:
			return "ALINHADA COM O MANDRIL: G = empurrar para dentro"
		return "Alinhe com o mandril: Δx %+.0f mm · Δaltura %+.0f mm" % [dx * 1000, dy * 1000]
	return ""

func _bobina_sob_gancho():
	for b in bobinas:
		var topo: Vector3 = b.no.global_position
		var d := Vector2(topo.x - x, topo.z - z)
		var dh: float = (h - OFF_CINTA) - topo.y
		if d.length() < 0.25 and absf(dh) < 0.12:
			return b
	return null

func _engatar_ou_soltar() -> void:
	if carga == null:
		var b = _bobina_sob_gancho()
		if b == null:
			Bus.aviso.emit("Gancho longe: centralize em cima da bobina e desça até a cinta alcançar o furo.")
			return
		if b.kg > CAPACIDADE_KG:
			Bus.aviso.emit("Carga acima da capacidade da ponte!")
			return
		carga = b
		bobinas.erase(b)
		cinta.visible = true
		Som.tocar("trava", null, Vector3(x, h, z), -4.0)
		Bus.aviso.emit("Cinta passada no furo da %s. Suba devagar." % b.codigo)
		return
	# com carga: encaixar no mandril se coaxial, senão pousar no chão/berço
	var m_loc: Vector3 = maquina.to_local(_pos_carga())
	if absf(m_loc.x - maquina.X_DESB) <= 0.03 and absf(m_loc.y - maquina.Y_DESB) <= 0.03 and m_loc.z > 0.55 and m_loc.z < 2.5:
		if maquina.bobina.presente:
			Bus.aviso.emit("O mandril já tem bobina.")
			return
		if maquina.bobina_travada_vazia():
			Bus.aviso.emit("Mandril expandido: destrave (alavanca) para a bobina entrar.")
			return
		encaixando = 0.001
		return
	if (h - OFF_CINTA) - carga.r > 0.12:
		Bus.aviso.emit("Desça a bobina até apoiar antes de soltar a cinta (nunca solte carga no ar).")
		return
	carga.no.position = to_local(_pos_carga())
	bobinas.append(carga)
	carga = null
	cinta.visible = false
	Som.tocar("clank", null, Vector3(x, h, z), -2.0)

func _physics_process(delta: float) -> void:
	var ax := 0.0
	var az := 0.0
	var ah := 0.0
	if operando and Interacoes.modo == "foco" and encaixando <= 0.0:
		ax = Input.get_axis("esquerda", "direita")
		az = Input.get_axis("frente", "tras")
		ah = float(Input.is_physical_key_pressed(KEY_R)) - float(Input.is_physical_key_pressed(KEY_F))
	var vx0 := vx
	var vz0 := vz
	vx = move_toward(vx, ax * V_PONTE, ACEL * delta)
	vz = move_toward(vz, az * V_CARRO, ACEL * delta)
	vh = ah * V_GANCHO
	x = clampf(x + vx * delta, X_MIN, X_MAX)
	z = clampf(z + vz * delta, Z_MIN, Z_MAX)
	var h_min := H_MIN
	if carga:
		h_min = maxf(H_MIN, carga.r + OFF_CINTA)       # a bobina apoia no chão
	h = clampf(h + vh * delta, h_min, H_MAX)
	# pêndulo: a aceleração da ponte/carro empurra a carga para trás; amortece com o tempo
	var L := maxf(0.3, Y_CARRO - h + OFF_CINTA)
	var w2 := 9.8 / L
	var acc := Vector2((vx - vx0) / maxf(delta, 0.0001), (vz - vz0) / maxf(delta, 0.0001))
	balanco_v += (-w2 * balanco - acc / L) * delta
	balanco_v *= 1.0 - 0.35 * delta
	balanco += balanco_v * delta
	if carga == null:
		balanco *= 0.9
	if encaixando > 0.0:
		_encaixar(delta)
	_atualizar(delta)
	if operando:
		_dica()

func _encaixar(delta: float) -> void:
	# a bobina desliza no mandril ao longo do eixo (Z local da máquina) até o batente
	encaixando += delta / 3.0
	var m_loc: Vector3 = maquina.to_local(_pos_carga())
	var alvo_z := lerpf(m_loc.z, 0.0, clampf(encaixando, 0.0, 1.0))
	carga.no.global_position = maquina.to_global(Vector3(maquina.X_DESB, maquina.Y_DESB, alvo_z))
	balanco = Vector2.ZERO
	if encaixando >= 1.0:
		encaixando = 0.0
		maquina.receber_bobina(carga.codigo, carga.metros)
		carga.no.queue_free()
		carga = null
		cinta.visible = false
		Som.tocar("trava", null, maquina.global_position + Vector3(maquina.X_DESB, maquina.Y_DESB, 0))
		Bus.aviso.emit("Bobina no mandril. Solte o gancho (suba), trave o mandril e ajuste o freio.")

func _atualizar(_delta: float) -> void:
	viga.position = Vector3(x, Y_VIGA, 0)
	carro.position = Vector3(x, Y_CARRO, z)
	gancho.position = Vector3(x, h, z)
	var topo := Vector3(x, Y_CARRO - 0.3, z)
	var base := Vector3(x, h + 0.3, z)
	cabo.position = (topo + base) * 0.5
	cabo.scale = Vector3(1, maxf(topo.y - base.y, 0.01), 1)
	if carga and encaixando <= 0.0:
		var p := _pos_carga()
		carga.no.position = to_local(p)
		cinta.position = (Vector3(x, h, z) + p) * 0.5
		cinta.scale.y = maxf((Vector3(x, h, z) - p).length(), 0.01)
		cinta.look_at(Vector3(x, h, z), Vector3(1, 0, 0))
		cinta.rotate_object_local(Vector3.RIGHT, PI / 2)
	# botoeira pendurada a 1,3 m do chão; o cabo sobe até o carro
	var bpos := Vector3(x + 0.6, 0.9, z + 0.6)
	botoeira.position = bpos
	cabo_bot.position = (bpos + Vector3(0, 0.72, 0) + Vector3(x + 0.6, Y_CARRO, z + 0.6)) * 0.5
	cabo_bot.scale = Vector3(1, Y_CARRO - (bpos.y + 0.72), 1)
	# câmera do operador: atrás da botoeira, olhando para o gancho/carga
	var olho := bpos + Vector3(0.0, 1.0, 3.2)
	var alvo := _pos_carga() if carga else Vector3(x, maxf(h - 0.5, 0.8), z)
	foco.global_transform = Transform3D(Basis(), olho).looking_at(alvo.lerp(bpos, 0.35), Vector3.UP)
	som_motor.volume_db = -10.0 if (absf(vx) + absf(vz) + absf(vh)) > 0.01 else -80.0
