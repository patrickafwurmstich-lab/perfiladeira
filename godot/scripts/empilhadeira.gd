class_name Empilhadeira
extends CharacterBody3D
## Equipamento de garfos: EMPILHADEIRA (dirige sentado, torre levanta até 1,8 m, roda traseira esterça)
## ou PALETEIRA manual (empurrada a pé, bomba hidráulica levanta só 12 cm, freia sozinha).
## Os garfos pegam uma Carga quando estão retos, centrados, enfiados e na altura do vão; ao baixar,
## a carga fica onde encostar (chão, carroceria, mesa). Curva rápida com carga alta: a carga tomba.

@export var tipo := "empilhadeira"

var CAPACIDADE := 2500.0      # kg
var V_MAX := 3.3              # m/s (12 km/h)
var ACEL := 1.4
var ENTRE_EIXOS := 1.37
var GARFO_MAX := 1.80
var GARFO_Y0 := 0.06          # topo do garfo baixado
var V_GARFO := 0.30           # m/s
var PONTA_Z := 1.93           # ponta dos garfos (frente = +Z local)
var LARG_GARFOS := 0.80

var operando := false
var jogador
var mundo: Node
var v := 0.0                  # velocidade (m/s, + para frente)
var esterco := 0.0            # ângulo das rodas que esterçam (rad)
var garfo := 0.0              # altura dos garfos acima de GARFO_Y0
var carga: Carga = null
var avarias := 0
var modelo: Node3D
var carro_garfos: Node3D      # parte que sobe
var assento: Marker3D
var rodas_esterco: Array = []
var sobrecarga := false
var comando := Vector3.ZERO     # (acelera, vira, sobe) quando ninguém está dirigindo
var _y_base_carro := 0.0

func _ready() -> void:
	if tipo == "paleteira":
		CAPACIDADE = 2000.0
		V_MAX = 1.3
		ACEL = 1.2
		GARFO_MAX = 0.12
		GARFO_Y0 = 0.075
		PONTA_Z = 0.74
		LARG_GARFOS = 0.54
		modelo = load("res://modelos/pallet-jack.glb").instantiate()
		# o modelo aponta os garfos para +X: gira para os garfos ficarem em +Z como na empilhadeira
		modelo.rotation.y = -PI / 2
		add_child(modelo)
		carro_garfos = modelo.find_child("pallet-jack_body", true, false)
	else:
		modelo = load("res://modelos/forklift-light.glb").instantiate()
		add_child(modelo)
		carro_garfos = modelo.find_child("forklift_fork_carriage", true, false)
		rodas_esterco = [modelo.find_child("forklift_wheel_rl", true, false), modelo.find_child("forklift_wheel_rr", true, false)]
	if carro_garfos:
		_y_base_carro = carro_garfos.position.y
	var cs := CollisionShape3D.new()
	var bx := BoxShape3D.new()
	if tipo == "paleteira":
		bx.size = Vector3(0.55, 0.9, 0.5)
		cs.position = Vector3(0, 0.45, -0.75)     # só o timão e a roda (os garfos passam por baixo das cargas)
	else:
		bx.size = Vector3(1.2, 2.1, 2.55)
		cs.position = Vector3(0, 1.15, -0.62)
	cs.shape = bx
	add_child(cs)
	assento = Marker3D.new()
	assento.position = Vector3(0, 0.55, -0.85) if tipo == "empilhadeira" else Vector3(0, 0.0, -1.25)
	add_child(assento)
	Interagivel.criar(self, Vector3(0.9, 1.0, -0.6) if tipo == "empilhadeira" else Vector3(0, 0.9, -1.0), _txt, _faz, 1.6)

func _txt() -> String:
	if operando:
		return ""
	return ("Subir na empilhadeira" if tipo == "empilhadeira" else "Pegar a paleteira") + (" (carga: %s, %.0f kg)" % [carga.descricao, carga.kg] if carga else "")

func _faz() -> void:
	operando = true
	if jogador:
		jogador.preso_a = assento
		jogador.visual.visible = tipo == "paleteira"
	var dica := "EMPILHADEIRA · W/S acelera/ré · A/D esterça (roda de trás!) · R/F sobe/desce garfos · E desce" if tipo == "empilhadeira" else "PALETEIRA · W/S empurra/puxa · A/D vira · Espaço bombeia (sobe) · Q solta a válvula (desce) · E larga"
	Interacoes.operar(self, dica)

func on_foco_saiu() -> void:
	operando = false
	if jogador:
		jogador.preso_a = null
		jogador.visual.visible = true
		if tipo == "empilhadeira":
			jogador.global_position = to_global(Vector3(1.1, 0.05, -0.9))

func on_foco_tecla(ev: InputEventKey) -> void:
	if not ev.pressed or ev.echo:
		return
	if tipo == "paleteira":
		if ev.keycode == KEY_SPACE:
			bombear()
		elif ev.keycode == KEY_Q:
			garfo_para(0.0)

## paleteira: cada bombada do timão sobe 3 cm
func bombear() -> void:
	var antes := garfo
	garfo = minf(garfo + 0.03, GARFO_MAX)
	if carro_garfos:
		carro_garfos.position.y = _y_base_carro + garfo
	if carga == null:
		sobrecarga = false
		_tentar_pegar_no_proximo(garfo - antes)
		if sobrecarga:
			garfo = antes
			carro_garfos.position.y = _y_base_carro + garfo
	Som.tocar("click", null, global_position, -8.0)

func garfo_para(alvo: float) -> void:
	garfo = clampf(alvo, 0.0, GARFO_MAX)
	if carro_garfos:
		carro_garfos.position.y = _y_base_carro + garfo
	_conferir_carga()

func y_topo_garfo() -> float:
	return global_position.y + GARFO_Y0 + garfo

func ponta_garfos() -> Vector3:
	return to_global(Vector3(0, GARFO_Y0 + garfo, PONTA_Z))

func frente() -> Vector3:
	return global_transform.basis.z.normalized()

## procura a carga que os garfos estão em posição de pegar; devolve o motivo de não pegar da mais perto
func carga_alvo(subida := 0.0) -> Array:
	var melhor: Carga = null
	var motivo := "nenhuma carga nos garfos"
	var dmin := 9999.0
	for c in Carga.todas:
		var cc: Carga = c
		if cc.no_garfo:
			continue
		var d := cc.global_position.distance_to(ponta_garfos())
		if d > 4.0:
			continue
		var m := cc.pode_pegar(frente(), ponta_garfos(), y_topo_garfo() - subida, LARG_GARFOS)
		if m == "" :
			return [cc, ""]
		if d < dmin:
			dmin = d
			motivo = m
			melhor = cc
	return [null, motivo]

func _tentar_pegar_no_proximo(subida: float) -> bool:
	var r := carga_alvo(subida)
	if r[0] == null:
		return false
	var c: Carga = r[0]
	if y_topo_garfo() < c.global_position.y + c.y_vao - 0.003:
		return false              # os garfos ainda não encostaram embaixo da carga
	if c.kg > CAPACIDADE:
		sobrecarga = true
		Bus.aviso.emit("SOBRECARGA: %s tem %.0f kg, a %s aguenta %.0f kg." % [c.descricao, c.kg, tipo, CAPACIDADE])
		return false
	carga = c
	c.pegar(carro_garfos)
	Som.tocar("clank", null, c.global_position, -6.0)
	return true

## ao baixar: se a carga encostou em algo, ela fica lá
func _conferir_carga() -> void:
	if carga == null:
		return
	var apoio := carga.apoio_embaixo(get_world_3d().direct_space_state)
	if carga.global_position.y <= apoio + 0.004:
		var c := carga
		carga = null
		c.soltar(mundo if mundo else get_parent())
		c.global_position.y = apoio
		Som.tocar("thoc", null, c.global_position, -6.0)
		Bus.aviso.emit("%s apoiada (%.2f m de altura)." % [c.descricao, apoio])

func _physics_process(delta: float) -> void:
	var acel := 0.0
	var vira := 0.0
	var sobe := 0.0
	if operando and Interacoes.modo != "ponte":
		operando = false
	if not operando:
		acel = comando.x; vira = comando.y; sobe = comando.z     # testes / funcionário
	if operando:
		acel = float(Input.is_physical_key_pressed(KEY_W)) - float(Input.is_physical_key_pressed(KEY_S))
		vira = float(Input.is_physical_key_pressed(KEY_A)) - float(Input.is_physical_key_pressed(KEY_D))
		sobe = float(Input.is_physical_key_pressed(KEY_R)) - float(Input.is_physical_key_pressed(KEY_F))
	dirigir(acel, vira, sobe, delta)

## um passo de física (também usado pelos testes)
func dirigir(acel: float, vira: float, sobe: float, delta: float) -> void:
	var peso := carga.kg if carga else 0.0
	var vmax := V_MAX * (1.0 - 0.35 * clampf(peso / CAPACIDADE, 0.0, 1.0))
	if tipo == "empilhadeira" and garfo > 0.5 and carga:
		vmax = minf(vmax, 1.0)      # carga alta: anda devagar
	if acel != 0.0:
		v = move_toward(v, acel * vmax * (1.0 if acel > 0 else 0.6), ACEL * delta)
	else:
		v = move_toward(v, 0.0, ACEL * 1.5 * delta)       # freio motor / paleteira para sozinha
	# esterço
	if tipo == "empilhadeira":
		esterco = move_toward(esterco, vira * deg_to_rad(60.0), deg_to_rad(120.0) * delta)
		for r in rodas_esterco:
			if r:
				(r as Node3D).rotation.y = -esterco
		var w := v * tan(esterco) / ENTRE_EIXOS        # gira em torno do eixo da frente (traseira "abre")
		rotate_y(w * delta)
		if absf(v * w) > 0.01:
			_checar_tombo(absf(v * w))
	else:
		rotate_y(vira * (0.9 if absf(v) < 0.1 else 1.4) * delta)
	velocity = frente() * v
	velocity.y = 0.0
	move_and_slide()
	if is_on_wall() and absf(v) > 0.2:
		Som.tocar("bang", null, global_position, -10.0)
		v = 0.0
	# garfos
	if tipo == "empilhadeira" and sobe != 0.0:
		var antes := garfo
		garfo = clampf(garfo + sobe * V_GARFO * delta, 0.0, GARFO_MAX)
		if carro_garfos:
			carro_garfos.position.y = _y_base_carro + garfo
		if sobe > 0.0 and carga == null:
			sobrecarga = false
			_tentar_pegar_no_proximo(garfo - antes)
			if sobrecarga:
				garfo = antes          # a torre não levanta (válvula de alívio)
				carro_garfos.position.y = _y_base_carro + garfo
		if sobe < 0.0:
			_conferir_carga()

## aceleração lateral máxima antes de a carga tombar: quanto mais alta, menos aguenta
func _checar_tombo(a_lat: float) -> void:
	if carga == null:
		return
	var limite := 1.9 / (0.4 + garfo + carga.tamanho.y * 0.5)
	if a_lat > limite:
		var c := carga
		carga = null
		c.soltar(mundo if mundo else get_parent())
		c.global_position = Vector3(c.global_position.x, 0.0, c.global_position.z) + global_transform.basis.x * signf(esterco) * 0.6
		c.rotation.z = deg_to_rad(8.0)
		c.descricao += " (AVARIADA)"
		avarias += 1
		Som.tocar("bang", null, c.global_position, 0.0)
		Bus.alarme.emit("Empilhadeira", "CARGA TOMBOU na curva (%.1f m/s² com garfo a %.2f m). Avaria registrada." % [a_lat, garfo])
