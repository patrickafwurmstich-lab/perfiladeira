class_name Dobradeira
extends Node3D
## Dobradeira manual de bancada (4 m), sem motor: tudo é braço do operador.
## Procedimento real:
##   1. tira de chapa na bancada, encostada no BATENTE traseiro (define quanto fica preso: aba = largura − batente)
##   2. fecha o APERTO (as 3 alavancas baixam a viga de fixação sobre a chapa)
##   3. puxa o AVENTAL pelos braços: a aba dobra junto com ele
##   4. solta o avental: a chapa volta um pouco (RETORNO ELÁSTICO) — por isso se passa do ângulo
##   5. abre o aperto, tira a peça e confere aba (mm) e ângulo (°)
## Puxar o avental com o aperto aberto faz a chapa escorregar (peça perdida). Sem luva não mexe na chapa.

signal mudou

const NOME := "Dobradeira"
const X_DESB := -2.0          # (para o HUD achar o meio da máquina)
const X_CORTE := 2.0
const Z_DOBRA := -0.36        # linha de dobra: borda da frente da bancada / da viga de fixação
const Y_MESA := 0.90          # tampo da bancada
const COMPRIMENTO := 2.0      # comprimento das peças (m)
const ESPESSURA := 0.00043
const BATENTE_MIN := 20.0     # mm
const BATENTE_MAX := 560.0
const ANG_MAX := 140.0        # o avental para no batente mecânico
const TOL_ABA := 2.0          # mm
const TOL_ANG := 2.0          # graus

## pedidos (desenvolvimento = largura da tira que vem da guilhotina)
const PEDIDOS := [
	{"nome": "PINGADEIRA", "largura": 300.0, "aba": 100.0, "ang": 90.0},
	{"nome": "CANTONEIRA 50", "largura": 100.0, "aba": 50.0, "ang": 90.0},
	{"nome": "RUFO DE ENCOSTO", "largura": 250.0, "aba": 80.0, "ang": 135.0},
]

var pedido := 0
var estoque_tiras := 20       # tiras no palete ao lado (cada pedido usa a largura dele)
var chapa := false            # tem tira na bancada
var escorregou := false
var batente_mm := 400.0       # distância da linha de dobra até o batente
var aperto := false
var ang_avental := 0.0        # graus
var ang_permanente := 0.0     # dobra plástica já feita na chapa
var ang_max_puxado := 0.0
var pecas_ok := 0
var pecas_ruins := 0
var ultima := {}              # última peça conferida {aba, ang, ok}

var modelo: Node3D
var pivo_avental: Node3D
var viga: Node3D
var alavancas: Array = []
var moveis_batente: Array = []    # [nó, posição original]
var foco: Marker3D
var no_chapa: Node3D
var no_plano: MeshInstance3D
var pivo_aba: Node3D
var no_aba: MeshInstance3D
var pilha_ok: Node3D
var pilha_tiras: Node3D
var lb_regua: Label3D
var _arrastando := false

func _ready() -> void:
	modelo = load("res://modelos/dobradeira.glb").instantiate()
	add_child(modelo)
	var raiz: Node3D = modelo.get_child(0)
	# avental gira na dobradiça (eixo X na borda da frente da bancada)
	var avental: Node3D = raiz.get_node("avental")
	pivo_avental = Node3D.new()
	pivo_avental.position = Vector3(0, Y_MESA, Z_DOBRA)
	raiz.add_child(pivo_avental)
	avental.reparent(pivo_avental)
	# viga de fixação: alinhada com a linha de dobra (o modelo vinha 30 cm para trás)
	viga = raiz.get_node("viga_fixacao")
	viga.position.z += -0.30
	for n in ["alavanca_aperto", "alavanca_aperto2", "alavanca_aperto3"]:
		alavancas.append(viga.get_node(n))
	for n in ["batente_traseiro", "manipulo_batente", "manipulo_batente2", "batente", "batente2"]:
		var b: Node3D = raiz.get_node(n)
		moveis_batente.append([b, b.position])
	# chapa (duas partes: a que fica presa e a aba que dobra)
	no_chapa = Node3D.new()
	add_child(no_chapa)
	no_plano = MeshInstance3D.new()
	no_plano.mesh = BoxMesh.new()
	no_plano.material_override = Perfil.material_chapa()
	no_chapa.add_child(no_plano)
	pivo_aba = Node3D.new()
	pivo_aba.position = Vector3(0, Y_MESA + 0.0012, Z_DOBRA)
	no_chapa.add_child(pivo_aba)
	no_aba = MeshInstance3D.new()
	no_aba.mesh = BoxMesh.new()
	no_aba.material_override = Perfil.material_chapa()
	pivo_aba.add_child(no_aba)
	# leitura da régua no batente
	lb_regua = Label3D.new()
	lb_regua.font_size = 28
	lb_regua.pixel_size = 0.0012
	lb_regua.modulate = Color(0.05, 0.05, 0.05)
	lb_regua.outline_size = 0
	lb_regua.rotation = Vector3(-PI / 2, 0, 0)
	add_child(lb_regua)
	# paletes: tiras novas (esquerda) e peças prontas (direita)
	pilha_tiras = _palete(Vector3(-3.0, 0, 0.0))
	pilha_ok = _palete(Vector3(3.0, 0, 0.0))
	# colisão da bancada
	var sb := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var bx := BoxShape3D.new()
	bx.size = Vector3(4.2, 1.0, 0.9)
	cs.shape = bx
	cs.position = Vector3(0, 0.5, 0.0)
	sb.add_child(cs)
	add_child(sb)
	foco = Marker3D.new()
	add_child(foco)
	foco.transform = Transform3D(Basis(), Vector3(0.0, 1.75, -1.55)).looking_at(Vector3(0, 0.95, -0.1), Vector3.UP)
	Interagivel.criar(self, Vector3(0, 1.0, -0.9), _txt, _faz, 1.8)
	_atualizar_visual()

func _palete(p: Vector3) -> Node3D:
	var n := Node3D.new()
	n.position = p
	add_child(n)
	var base := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(1.2, 0.14, 1.0)
	base.mesh = bm
	var mm := StandardMaterial3D.new()
	mm.albedo_color = Color(0.62, 0.48, 0.3)
	base.material_override = mm
	base.position.y = 0.07
	n.add_child(base)
	return n

# ---------------------------------------------------------------- estado / regras

func pedido_atual() -> Dictionary:
	return PEDIDOS[pedido]

func batente_ideal() -> float:
	return pedido_atual().largura - pedido_atual().aba

func aba_mm() -> float:
	return pedido_atual().largura - batente_mm

## ângulo de retorno elástico do galvalume 0,43 mm (cresce com a dobra: ~3° a 90°, ~4,5° a 135°)
static func retorno(ang: float) -> float:
	return 0.035 * ang

## ângulo que a chapa fica (aba) — segue o avental enquanto ele empurra, senão fica no permanente
func ang_chapa() -> float:
	if ang_avental >= ang_permanente:
		return ang_avental
	return ang_permanente

func etapas() -> Array:
	var p: Dictionary = pedido_atual()
	return [
		["Luvas (EPI) — chapa corta", Interacoes.epi],
		["Pedido: %s · tira %d mm · aba %d mm a %d°" % [p.nome, p.largura, p.aba, p.ang], true],
		["Tira na bancada, encostada no batente", chapa],
		["Batente em %d mm (largura − aba)" % batente_ideal(), chapa and absf(batente_mm - batente_ideal()) < 0.6],
		["Fechar o aperto (alavancas)", aperto or ang_permanente > 1.0],
		["Puxar o avental passando do ângulo (retorno elástico)", ang_permanente > 1.0],
		["Soltar o avental e abrir o aperto", ang_permanente > 1.0 and ang_avental < 1.0 and not aperto],
		["Tirar a peça e conferir (aba ±2 mm, ângulo ±2°)", false],
	]

func cmd_colocar_tira() -> bool:
	if chapa:
		return false
	if not Interacoes.epi:
		Bus.aviso.emit("Sem luva não: a borda da chapa corta. Pegue as luvas no armário de EPI.")
		return false
	if estoque_tiras <= 0:
		Bus.aviso.emit("Acabaram as tiras: corte mais na guilhotina.")
		return false
	if aperto or ang_avental > 1.0:
		Bus.aviso.emit("Abra o aperto e abaixe o avental antes de pôr a tira.")
		return false
	estoque_tiras -= 1
	chapa = true
	escorregou = false
	ang_permanente = 0.0
	ang_max_puxado = 0.0
	Som.tocar("tlec", null, global_position + Vector3(0, Y_MESA, 0), -6.0)
	_atualizar_visual()
	mudou.emit()
	return true

func ajustar_batente(delta_mm: float) -> void:
	if aperto:
		Bus.aviso.emit("Com o aperto fechado a chapa não corre: abra o aperto para mexer no batente.")
		return
	batente_mm = clampf(snappedf(batente_mm + delta_mm, 0.5), BATENTE_MIN, BATENTE_MAX)
	if chapa and batente_mm >= pedido_atual().largura:
		Bus.aviso.emit("Batente maior que a tira: a chapa não chega na linha de dobra.")
	_atualizar_visual()
	mudou.emit()

func cmd_aperto(fechar: bool) -> void:
	if aperto == fechar:
		return
	if not fechar and ang_avental > 2.0:
		Bus.aviso.emit("Abaixe o avental antes de abrir o aperto.")
		return
	aperto = fechar
	Som.tocar("clank" if fechar else "trava", null, global_position + Vector3(0, 1.2, 0), -4.0)
	_atualizar_visual()
	mudou.emit()

## puxa (ou devolve) o avental até "ang" graus
func puxar_avental(ang: float) -> void:
	ang = clampf(ang, 0.0, ANG_MAX)
	if chapa and not escorregou and ang > 3.0 and not aperto:
		escorregou = true
		Som.tocar("bang", null, global_position + Vector3(0, Y_MESA, 0), -6.0)
		Bus.aviso.emit("A chapa ESCORREGOU: o aperto estava aberto. Essa peça foi perdida — tire e ponha outra.")
	if chapa and not escorregou and aperto and pedido_atual().largura - batente_mm <= 2.0:
		ang = minf(ang, 0.0)
	ang_avental = ang
	if chapa and not escorregou and aperto:
		ang_max_puxado = maxf(ang_max_puxado, ang)
		# dobra plástica: o que o avental empurrou, menos o retorno elástico quando ele soltar
		ang_permanente = maxf(ang_permanente, ang_max_puxado - retorno(ang_max_puxado))
	_atualizar_visual()
	mudou.emit()

## tira a peça da bancada e confere; devolve o resultado
func cmd_retirar() -> Dictionary:
	if not chapa:
		return {}
	if aperto or ang_avental > 1.0:
		Bus.aviso.emit("Solte o avental e abra o aperto para tirar a peça.")
		return {}
	var p: Dictionary = pedido_atual()
	var r := {"aba": aba_mm(), "ang": ang_permanente, "ok": false, "defeito": ""}
	if escorregou:
		r.defeito = "escorregou"
	elif ang_permanente < 1.0:
		Bus.aviso.emit("A tira ainda está lisa: dobre antes de tirar (ou ela volta para o palete).")
		chapa = false
		estoque_tiras += 1
		_atualizar_visual()
		mudou.emit()
		return {}
	elif absf(r.aba - p.aba) > TOL_ABA:
		r.defeito = "aba %+.1f mm" % (r.aba - p.aba)
	elif absf(r.ang - p.ang) > TOL_ANG:
		r.defeito = "ângulo %+.1f°" % (r.ang - p.ang)
	else:
		r.ok = true
	chapa = false
	escorregou = false
	ang_permanente = 0.0
	ang_max_puxado = 0.0
	ultima = r
	if r.ok:
		pecas_ok += 1
		Bus.peca_na_pilha.emit(NOME, pecas_ok)
		Bus.aviso.emit("%s OK: aba %.1f mm, ângulo %.1f° (%d prontas)" % [p.nome, r.aba, r.ang, pecas_ok])
		if pecas_ok == 1:
			Bus.conquista.emit("PRIMEIRA DOBRA", "%s dentro da tolerância" % p.nome)
	else:
		pecas_ruins += 1
		Bus.aviso.emit("Peça REPROVADA (%s) → sucata. Aba %.1f mm, ângulo %.1f°." % [r.defeito, r.aba, r.ang])
	Bus.peca_cortada.emit(NOME, COMPRIMENTO, r.defeito)
	Som.tocar("tlec", null, global_position + Vector3(3, 0.3, 0), -6.0)
	_atualizar_visual()
	mudou.emit()
	return r

func trocar_pedido() -> void:
	if chapa:
		Bus.aviso.emit("Tire a peça da bancada antes de trocar de pedido.")
		return
	pedido = (pedido + 1) % PEDIDOS.size()
	estoque_tiras = 20
	Bus.aviso.emit("Pedido: %s — tira %d mm, aba %d mm a %d°. Batente em %d mm." % [pedido_atual().nome, pedido_atual().largura, pedido_atual().aba, pedido_atual().ang, batente_ideal()])
	mudou.emit()

# ---------------------------------------------------------------- visual

func _atualizar_visual() -> void:
	var d := batente_mm / 1000.0
	for par in moveis_batente:
		var no: Node3D = par[0]
		var orig: Vector3 = par[1]
		# a face da frente da barra do batente fica a "d" da linha de dobra
		no.position = orig + Vector3(0, 0, (Z_DOBRA + d) - 0.275)
	lb_regua.text = "%.1f mm" % batente_mm
	lb_regua.position = Vector3(-1.45, Y_MESA + 0.003, Z_DOBRA + d - 0.06)
	viga.position.y = 0.0 if aperto else 0.05
	for a in alavancas:
		(a as Node3D).rotation.x = deg_to_rad(-55.0) if aperto else 0.0
	pivo_avental.rotation.x = deg_to_rad(ang_avental)
	no_chapa.visible = chapa
	if chapa:
		var w: float = pedido_atual().largura / 1000.0
		var preso := minf(d, w)
		var aba := maxf(w - preso, 0.001)
		var desliza := 0.0
		if escorregou:
			desliza = -0.03
		(no_plano.mesh as BoxMesh).size = Vector3(COMPRIMENTO, 0.0012, preso)
		no_plano.position = Vector3(0, Y_MESA + 0.0006, Z_DOBRA + preso * 0.5 + desliza)
		(no_aba.mesh as BoxMesh).size = Vector3(COMPRIMENTO, 0.0012, aba)
		no_aba.position = Vector3(0, 0, -aba * 0.5)
		pivo_aba.position = Vector3(0, Y_MESA + 0.0006, Z_DOBRA + desliza)
		pivo_aba.rotation.x = deg_to_rad(ang_chapa() if not escorregou else minf(ang_avental, 25.0))
	# palete de tiras e de peças prontas
	_empilhar(pilha_tiras, estoque_tiras, false)
	_empilhar(pilha_ok, pecas_ok, true)

func _empilhar(pal: Node3D, n: int, dobradas: bool) -> void:
	var nome := "pilha"
	var antiga := pal.get_node_or_null(nome)
	if antiga:
		antiga.free()
	if n <= 0:
		return
	var m := MeshInstance3D.new()
	m.name = nome
	var bm := BoxMesh.new()
	var w: float = pedido_atual().largura / 1000.0
	var h := maxf(n * (0.006 if dobradas else 0.0008), 0.002)
	bm.size = Vector3(COMPRIMENTO * 0.55, h, w if not dobradas else w - pedido_atual().aba / 1000.0 + 0.02)
	m.mesh = bm
	m.material_override = Perfil.material_chapa()
	m.position.y = 0.14 + h * 0.5
	pal.add_child(m)

# ---------------------------------------------------------------- interação do jogador

func _txt() -> String:
	if not chapa:
		return "Dobradeira: pôr tira de %d mm na bancada (%d no palete)" % [pedido_atual().largura, estoque_tiras]
	return "Operar a dobradeira"

func _faz() -> void:
	if not chapa and not cmd_colocar_tira():
		return
	Interacoes.focar(foco, self, _dica())

func _dica() -> String:
	return "DOBRADEIRA · roda/A-D batente (Shift ×10) · Espaço aperto · arraste o mouse p/ cima (ou W/S) puxa o avental · R tira a peça · P troca pedido · E sai   |   batente %.1f mm · aba %.1f mm · avental %.0f° · chapa %.1f°" % [batente_mm, aba_mm(), ang_avental, ang_chapa()]

func on_foco_tecla(ev: InputEventKey) -> void:
	if not ev.pressed:
		return
	var passo := 10.0 if ev.shift_pressed else 1.0
	match ev.keycode:
		KEY_A:
			ajustar_batente(-passo)
		KEY_D:
			ajustar_batente(passo)
		KEY_SPACE:
			cmd_aperto(not aperto)
		KEY_W:
			puxar_avental(ang_avental + (5.0 if ev.shift_pressed else 1.0))
		KEY_S:
			puxar_avental(ang_avental - (5.0 if ev.shift_pressed else 1.0))
		KEY_R:
			if chapa:
				cmd_retirar()
			else:
				cmd_colocar_tira()
		KEY_P:
			trocar_pedido()
	Interacoes.dica.emit(_dica())

func on_foco_clique(ev: InputEventMouseButton, _hit: Dictionary) -> void:
	if ev.button_index == MOUSE_BUTTON_LEFT:
		_arrastando = ev.pressed
	elif ev.pressed and ev.button_index == MOUSE_BUTTON_WHEEL_UP:
		ajustar_batente(10.0 if ev.shift_pressed else 1.0)
	elif ev.pressed and ev.button_index == MOUSE_BUTTON_WHEEL_DOWN:
		ajustar_batente(-10.0 if ev.shift_pressed else 1.0)
	Interacoes.dica.emit(_dica())

## arrastar o mouse para cima com o botão segurado = puxar os braços do avental
func on_foco_movimento(ev: InputEventMouseMotion) -> void:
	if not _arrastando:
		return
	puxar_avental(ang_avental - ev.relative.y * 0.35)
	Interacoes.dica.emit(_dica())

func on_foco_saiu() -> void:
	_arrastando = false
