class_name Caminhao
extends Node3D
## Caminhão de entrega (toco, carroceria de madeira 6,4 × 2,45 m, piso a 0,98 m).
## Fica na doca com a guarda lateral de um lado ABERTA para a empilhadeira carregar de lado.
## A carga só sai se estiver inteira sobre a carroceria e dentro do peso; depois de despachar,
## o caminhão vai embora com ela e volta vazio com o próximo pedido.

const CAPACIDADE := 6000.0     # kg de CARGA ÚTIL (toco 4×2)
const PBT := 10000.0           # peso bruto total = tara 4.000 kg + carga útil 6.000 kg
const X_EIXO_D := 3.00         # eixo dianteiro (local)
const X_EIXO_T := -2.00        # eixo traseiro
const TARA_D := 2600.0         # tara sobre o eixo dianteiro (cabine, motor) — toco ~4 t de tara
const TARA_T := 1400.0         # tara sobre o eixo traseiro (chassi, carroceria)
const LIM_EIXO_D := 6000.0     # limite legal do eixo dianteiro simples (pneus simples)
const LIM_EIXO_T := 10000.0    # limite legal do eixo traseiro simples com rodado duplo
const FRENTE_MIN := 0.25       # a frente precisa de pelo menos 25% do peso total para esterçar e frear
const Y_PISO := 0.98
const BED_X0 := -4.40
const BED_X1 := 1.85
const BED_Z := 1.17
const PEDIDOS := [
	{"cliente": "Casa do Construtor", "telha_m": 120.0, "rufo": 0, "chapa": 0, "km": 6.0},
	{"cliente": "Obra Jd. Primavera", "telha_m": 60.0, "rufo": 10, "chapa": 0, "km": 14.0},
	{"cliente": "Serralheria Parecis", "telha_m": 0.0, "rufo": 0, "chapa": 8, "km": 22.0},
]

var pedido := 0
var entregas := 0
var kg_entregue := 0.0
var estado := "doca"            # doca | saindo | fora | voltando
var t := 0.0
var modelo: Node3D
var guarda_aberta: Array = []
var placa: Label3D
var origem: Vector3
var calcado := false            # calços nas rodas (obrigatório antes de a empilhadeira carregar)
var infracoes := 0
var calcos: Array = []
var t_volta := 0.0              # minutos de jogo até voltar
var _avisou_calco := false

func _ready() -> void:
	add_to_group("caminhao")
	origem = position
	modelo = load("res://modelos/caminhao_carroceria.glb").instantiate()
	add_child(modelo)
	for n in ["tabua_lateral", "tabua_lateral2", "tabua_lateral3"]:
		var tb: Node3D = modelo.find_child(n, true, false)
		if tb:
			guarda_aberta.append(tb)
	_guarda(false)
	# colisão: carroceria (piso), chassi por baixo e cabine
	_caixa(Vector3((BED_X0 + 2.0) * 0.5, Y_PISO * 0.5, 0), Vector3(2.0 - BED_X0, Y_PISO, 2.45))
	_caixa(Vector3(3.35, 1.4, 0), Vector3(1.9, 2.8, 2.4))
	_caixa(Vector3(1.95, 1.6, 0), Vector3(0.12, 1.3, 2.45))
	placa = Label3D.new()
	placa.font_size = 40
	placa.pixel_size = 0.004
	placa.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	placa.position = Vector3(-1.2, 3.2, 0)
	placa.outline_size = 8
	add_child(placa)
	Interagivel.criar(self, Vector3(2.9, 1.2, -1.6), _txt, _faz, 2.2)
	# calços amarelos atrás das rodas traseiras (aparecem quando calçado)
	var mc := StandardMaterial3D.new()
	mc.albedo_color = Color(0.95, 0.8, 0.1)
	# um calço de cada lado do pneu traseiro (frente e trás), encostados na banda de rodagem
	# pneu traseiro: centro em x = −2,00, raio 0,48 → toca o chão em x = −2,00; o calço de 0,30 × 0,20
	# encosta no pneu a ~0,13 m do centro de contato (onde a altura do pneu bate com a rampa do calço)
	for sz in [-1.0, 1.0]:
		for lado in [-1.0, 1.0]:
			var k := MeshInstance3D.new()
			var pm := PrismMesh.new()
			pm.size = Vector3(0.30, 0.20, 0.24)
			pm.left_to_right = 0.0 if lado < 0.0 else 1.0     # ponta fina embaixo do pneu, face alta para fora
			k.mesh = pm
			k.material_override = mc
			k.position = Vector3(-2.00 + lado * 0.27, 0.10, sz * 1.0)
			k.visible = false
			add_child(k)
			calcos.append(k)
	Interagivel.criar(self, Vector3(-3.0, 0.6, -1.6), _txt_calco, _faz_calco, 1.6)
	_placa()

func _caixa(c: Vector3, s: Vector3) -> void:
	var sb := StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var bx := BoxShape3D.new()
	bx.size = s
	cs.shape = bx
	sb.add_child(cs)
	sb.position = c
	add_child(sb)

func _guarda(fechada: bool) -> void:
	for tb in guarda_aberta:
		(tb as Node3D).visible = fechada

func _txt_calco() -> String:
	if estado != "doca":
		return ""
	return "Tirar os calços das rodas" if calcado else "Pôr os calços nas rodas (antes de carregar)"

func _faz_calco() -> void:
	Interacoes.progresso("Calçando as rodas traseiras..." if not calcado else "Tirando os calços...", 2.0, func(): calcar(not calcado))

func calcar(sim: bool) -> void:
	calcado = sim
	for k in calcos:
		(k as Node3D).visible = sim
	Som.tocar("thoc", null, to_global(Vector3(-3.0, 0.2, 0)), -6.0)

## a empilhadeira acabou de pôr uma carga na carroceria
func carga_apoiada(c: Carga) -> void:
	if not cargas_na_carroceria().has(c):
		return
	if not calcado:
		infracoes += 1
		Bus.alarme.emit("Caminhão", "CARREGANDO SEM CALÇO NAS RODAS: o caminhão pode andar com a empilhadeira em cima. Infração %d." % infracoes)
	else:
		Bus.alarme_resolvido.emit("Caminhão")

## reação nos eixos com a tara: devolve [total dianteiro, total traseiro, xcg da carga, carga útil]
func cargas_eixos() -> Array:
	var w := 0.0
	var mx := 0.0
	for c in cargas_na_carroceria():
		var cc: Carga = c
		w += cc.kg
		mx += cc.kg * to_local(cc.global_position).x
	if w <= 0.0:
		return [TARA_D, TARA_T, 0.0, 0.0]
	var xcg := mx / w
	# momentos em torno do eixo traseiro: R_d · L = W · (xcg − x_t)
	var fd := w * (xcg - X_EIXO_T) / (X_EIXO_D - X_EIXO_T)
	return [TARA_D + fd, TARA_T + (w - fd), xcg, w]

func pedido_atual() -> Dictionary:
	return PEDIDOS[pedido]

## cargas que estão sobre a carroceria (apoiadas no piso dela)
func cargas_na_carroceria() -> Array:
	var r := []
	for c in Carga.todas:
		var cc: Carga = c
		if cc.no_garfo:
			continue
		var l := to_local(cc.global_position)
		if l.x > BED_X0 - 1.0 and l.x < BED_X1 + 1.0 and absf(l.z) < BED_Z + 1.0 and absf(l.y - Y_PISO) < 0.05:
			r.append(cc)
	return r

## devolve "" se pode despachar, senão o motivo
func conferir() -> String:
	var cs := cargas_na_carroceria()
	if cs.is_empty():
		return "carroceria vazia"
	var kg := 0.0
	for c in cs:
		var cc: Carga = c
		kg += cc.kg
		# os 4 cantos da carga têm que estar dentro da carroceria
		for sx in [-0.5, 0.5]:
			for sz in [-0.5, 0.5]:
				var p := to_local(cc.global_transform * Vector3(sx * cc.tamanho.x, 0, sz * cc.tamanho.z))
				if p.x < BED_X0 - 0.02 or p.x > BED_X1 + 0.02 or absf(p.z) > BED_Z + 0.02:
					return "%s está para fora da carroceria" % cc.descricao
	if kg > CAPACIDADE:
		return "PESO: %.0f kg, o caminhão leva %.0f kg de carga útil" % [kg, CAPACIDADE]
	var ex := cargas_eixos()
	if ex[0] + ex[1] > PBT:
		return "PBT: %.0f kg, o limite é %.0f kg" % [ex[0] + ex[1], PBT]
	if ex[0] > LIM_EIXO_D:
		return "eixo dianteiro com %.0f kg (limite %.0f): carga muito para a frente — puxe para trás" % [ex[0], LIM_EIXO_D]
	if ex[1] > LIM_EIXO_T:
		return "eixo traseiro com %.0f kg (limite %.0f): carga muito para trás" % [ex[1], LIM_EIXO_T]
	if ex[0] < FRENTE_MIN * (ex[0] + ex[1]):
		return "frente leve: só %.0f%% do peso no eixo dianteiro (mín 25%%) — puxe a carga para a frente" % (100.0 * ex[0] / (ex[0] + ex[1]))
	return ""

func resumo() -> Dictionary:
	var r := {"telha_m": 0.0, "rufo": 0, "chapa": 0, "kg": 0.0, "avaria": 0}
	for c in cargas_na_carroceria():
		var cc: Carga = c
		r.kg += cc.kg
		if cc.descricao.ends_with("(AVARIADA)"):
			r.avaria += 1
		if cc.tipo == "telha":
			r.telha_m += cc.metros
		elif cc.tipo == "rufo":
			r.rufo += cc.qtd
		elif cc.tipo == "chapa":
			r.chapa += cc.qtd
	return r

func _txt() -> String:
	if estado != "doca":
		return ""
	var m := conferir()
	if m == "carroceria vazia":
		return ""
	if m != "":
		return "Despachar o caminhão  (não dá: %s)" % m
	if not amarrada():
		return "Amarrar a carga na carroceria (cintas com catraca nos ganchos)"
	return "Despachar o caminhão (tira os calços e sai)"

func _faz() -> void:
	var m := conferir()
	if m != "":
		Bus.aviso.emit("Não dá para despachar: " + m + ".")
		return
	if not amarrada():
		Interacoes.progresso("Passando as cintas e apertando as catracas...", 4.0, amarrar)
		return
	despachar()

## cada carga sobre a carroceria leva 2 cintas de poliéster amarelas presas nos ganchos de amarração
## das duas laterais, passando por cima (com cantoneira nos cantos)
func amarrar() -> void:
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(0.95, 0.75, 0.05)
	mat.roughness = 0.8
	for c in cargas_na_carroceria():
		var cc: Carga = c
		if cc.has_meta("cintada"):
			continue
		cc.set_meta("cintada", true)
		var lc := to_local(cc.global_position)
		var topo := lc.y + cc.tamanho.y + 0.006
		for k in 2:
			var fx := lc.x + (k - 0.5) * cc.tamanho.x * 0.55
			# por cima da carga
			_cinta(Vector3(fx, topo, -cc.tamanho.z * 0.5 - 0.005), Vector3(fx, topo, cc.tamanho.z * 0.5 + 0.005), mat)
			# descendo até os ganchos das laterais (z = ±1,25, logo abaixo do piso)
			for sz in [-1.0, 1.0]:
				_cinta(Vector3(fx, topo, sz * (cc.tamanho.z * 0.5 + 0.005)), Vector3(fx, Y_PISO - 0.12, sz * 1.25), mat)
	Som.tocar("tlec", null, global_position + Vector3(0, 1.2, 0), -4.0)
	Bus.aviso.emit("Carga amarrada: 2 cintas por volume, catracas apertadas.")

func _cinta(a: Vector3, b: Vector3, mat: Material) -> void:
	var m := MeshInstance3D.new()
	var bm := BoxMesh.new()
	var d := b - a
	bm.size = Vector3(0.05, d.length(), 0.004)
	m.mesh = bm
	m.material_override = mat
	add_child(m)
	var y := d.normalized()
	var x := Vector3.RIGHT
	var z := x.cross(y).normalized()
	m.transform = Transform3D(Basis(x, y, z), (a + b) * 0.5)
	m.add_to_group("cinta_caminhao")

func amarrada() -> bool:
	var cs := cargas_na_carroceria()
	if cs.is_empty():
		return false
	for c in cs:
		if not (c as Carga).has_meta("cintada"):
			return false
	return true

func despachar() -> bool:
	if estado != "doca" or conferir() != "":
		return false
	if not amarrada():
		Bus.aviso.emit("Carga solta: amarre com as cintas antes de sair.")
		return false
	var p := pedido_atual()
	var r := resumo()
	var faltou := []
	if r.telha_m + 0.01 < p.telha_m:
		faltou.append("%.0f m de telha" % (p.telha_m - r.telha_m))
	if r.rufo < p.rufo:
		faltou.append("%d rufos" % (p.rufo - r.rufo))
	if r.chapa < p.chapa:
		faltou.append("%d chapas" % (p.chapa - r.chapa))
	for c in cargas_na_carroceria():
		(c as Carga).reparent(self, true)
	_guarda(true)
	calcar(false)
	entregas += 1
	# viagem: ida e volta a 50 km/h + 30 min para descarregar (minutos de jogo)
	t_volta = 2.0 * float(p.km) / 50.0 * 60.0 + 30.0
	kg_entregue += r.kg
	estado = "saindo"
	t = 0.0
	var txt := "Caminhão saiu para %s (%.0f km) com %.0f kg — volta em %.0f min." % [p.cliente, p.km, r.kg, t_volta]
	if faltou.is_empty():
		txt += " Pedido COMPLETO."
	else:
		txt += " Faltou: " + ", ".join(faltou) + "."
	if r.avaria > 0:
		txt += " %d carga(s) avariada(s) — o cliente vai reclamar." % r.avaria
	Bus.aviso.emit(txt)
	Som.tocar("buzina", null, global_position, -2.0)
	if entregas == 1:
		Bus.conquista.emit("PRIMEIRA ENTREGA", p.cliente)
	return true

func _process(delta: float) -> void:
	match estado:
		"saindo":
			t += delta
			position = origem + global_transform.basis.x.normalized() * (0.5 * 1.2 * t * t)
			if t > 7.0:
				estado = "fora"
				visible = false
				t = 0.0
				for c in get_children():
					if c is Carga or c.is_in_group("cinta_caminhao"):
						c.queue_free()
		"fora":
			t_volta -= Relogio.dt_industrial(delta) / Relogio.SEG_POR_MINUTO
			if t_volta <= 0.0:
				pedido = (pedido + 1) % PEDIDOS.size()
				position = origem
				visible = true
				_guarda(false)
				calcar(false)
				estado = "doca"
				Som.tocar("buzina", null, global_position, -6.0)
				Bus.aviso.emit("Chegou caminhão: " + _txt_pedido())
	_placa()

func _txt_pedido() -> String:
	var p := pedido_atual()
	var itens := []
	if p.telha_m > 0:
		itens.append("%.0f m de telha" % p.telha_m)
	if p.rufo > 0:
		itens.append("%d rufos" % p.rufo)
	if p.chapa > 0:
		itens.append("%d chapas" % p.chapa)
	return "%s — %s" % [p.cliente, ", ".join(itens)]

func _placa() -> void:
	if placa == null:
		return
	var r := resumo()
	var ex := cargas_eixos()
	placa.text = "PEDIDO: %s\nna carroceria: %.0f m telha · %d rufos · %d chapas · %.0f/%.0f kg úteis\neixos: dianteiro %.0f/%.0f kg · traseiro %.0f/%.0f kg · %s" % [_txt_pedido(), r.telha_m, r.rufo, r.chapa, r.kg, CAPACIDADE, ex[0], LIM_EIXO_D, ex[1], LIM_EIXO_T, "CALÇADO" if calcado else "SEM CALÇO"]
