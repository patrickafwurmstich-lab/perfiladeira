class_name Empilhadeira
extends CharacterBody3D
## Equipamento de garfos: EMPILHADEIRA (dirige sentado, torre levanta até 1,8 m, roda traseira esterça)
## ou PALETEIRA manual (empurrada a pé, bomba hidráulica levanta só 12 cm, freia sozinha).
## Os garfos pegam uma Carga quando estão retos, centrados, enfiados e na altura do vão; ao baixar,
## a carga fica onde encostar (chão, carroceria, mesa). Curva rápida com carga alta: a carga tomba.

@export var tipo := "empilhadeira"

var CAPACIDADE := 2500.0      # kg
var V_MAX := 2.2              # m/s (8 km/h): limite de operação dentro do galpão (vazia)
var ACEL := 1.4
var ENTRE_EIXOS := 1.37
var GARFO_MAX := 1.80
var GARFO_Y0 := 0.06          # topo do garfo baixado
var V_GARFO := 0.30           # m/s
var PONTA_Z := 1.93           # ponta dos garfos (frente = +Z local)
var LARG_GARFOS := 0.80
var COMPR_GARFO := 1.20       # comprimento dos garfos (calcanhar até a ponta)
var VOLANTE := Vector3(0.0, 1.36, 0.0)   # centro do volante (empilhadeira)

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
var volante: Node3D
var rodas: Array = []           # [pivô, raio, esterça, base]
var _giro := 0.0               # metros rodados (para girar as rodas)
var sobrecarga := false
var tombada := false
var a_tombo := 0.0
var _t_tombo := 0.0
var _lado_tombo := 1.0
var comando := Vector3.ZERO
var _subindo := 1.0
const ASSENTO := Vector3(0, 0.33, -0.82)
var _esterco_paleteira := 0.0     # (acelera, vira, sobe) quando ninguém está dirigindo
var _y_base_carro := 0.0

func _ready() -> void:
	if tipo == "paleteira":
		CAPACIDADE = 2000.0
		V_MAX = 1.0                # passo de quem empurra
		ACEL = 1.2
		GARFO_MAX = 0.12
		GARFO_Y0 = 0.075
		PONTA_Z = 0.74
		LARG_GARFOS = 0.54
		COMPR_GARFO = 1.15
		modelo = load("res://modelos/pallet-jack.glb").instantiate()
		# o modelo aponta os garfos para +X: gira para os garfos ficarem em +Z como na empilhadeira
		modelo.rotation.y = -PI / 2
		add_child(modelo)
		carro_garfos = modelo.find_child("pallet-jack_body", true, false)
		_roda("pallet-jack_steer_wheels", 0.09, true)
	else:
		modelo = load("res://modelos/forklift-light.glb").instantiate()
		add_child(modelo)
		carro_garfos = modelo.find_child("forklift_fork_carriage", true, false)
		_montar_volante()
		for par in [["forklift_wheel_fl", 0.33, false], ["forklift_wheel_fr", 0.33, false], ["forklift_wheel_rl", 0.25, true], ["forklift_wheel_rr", 0.25, true]]:
			_roda(par[0], par[1], par[2])
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
	assento.position = Vector3(0, 0.33, -0.82) if tipo == "empilhadeira" else Vector3(0, 0.0, -1.18)
	add_child(assento)
	Interagivel.criar(self, Vector3(0.9, 1.0, -0.6) if tipo == "empilhadeira" else Vector3(0, 0.9, -1.0), _txt, _faz, 1.6)

## põe a roda num pivô no centro dela (o modelo tem a origem no chão) para girar e esterçar de verdade
func _roda(nome: String, raio: float, esterca: bool) -> void:
	var m := modelo.find_child(nome, true, false) as MeshInstance3D
	if m == null:
		return
	var centro := m.global_transform * m.get_aabb().get_center()
	var piv := Node3D.new()
	piv.name = "Pivo_" + nome
	m.get_parent().add_child(piv)
	piv.global_position = centro
	piv.global_rotation = global_rotation
	m.reparent(piv, true)
	rodas.append([piv, raio, esterca, piv.transform.basis])

func _txt() -> String:
	if tombada:
		return ""
	if operando:
		return ""
	return ("Subir na empilhadeira" if tipo == "empilhadeira" else "Pegar a paleteira") + (" (carga: %s, %.0f kg)" % [carga.descricao, carga.kg] if carga else "")

func _faz() -> void:
	operando = true
	v = 0.0
	if jogador:
		# o corpo do operador fica DENTRO da caixa de colisão do veículo: sem essa exceção a física
		# empurrava a empilhadeira/paleteira (ela "andava sozinha", de lado)
		add_collision_exception_with(jogador)
		jogador.add_collision_exception_with(self)
		jogador.preso_a = assento
		jogador.visual.visible = true
		jogador.sentado = false          # pose agora vem da animação Sit_Forklift (feita no Blender)
		if tipo == "empilhadeira":
			_subindo = 0.0               # animação de subir pelo degrau (1 s)
	var dica := "EMPILHADEIRA · W/S acelera/ré · A/D esterça (roda de trás!) · R/F sobe/desce garfos · E desce" if tipo == "empilhadeira" else "PALETEIRA · W/S empurra/puxa · A/D vira · Espaço bombeia (sobe) · Q solta a válvula (desce) · E larga"
	Interacoes.operar(self, dica)

func on_foco_saiu() -> void:
	operando = false
	if jogador:
		jogador.preso_a = null
		jogador.maos_externas = []
		jogador.sentado = false
		if tipo == "paleteira":
			jogador.global_position = to_global(Vector3(0.0, 0.05, -1.45))
		_tirar_excecao.call_deferred()
		jogador.visual.visible = true
		if tipo == "empilhadeira":
			jogador.global_position = to_global(Vector3(1.1, 0.05, -0.9))

func _tirar_excecao() -> void:
	if jogador and not operando:
		remove_collision_exception_with(jogador)
		jogador.remove_collision_exception_with(self)

func on_foco_tecla(ev: InputEventKey) -> void:
	if not ev.pressed or ev.echo:
		return
	if tipo == "paleteira":
		if ev.keycode == KEY_SPACE:
			bombear()


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
	var cap := capacidade_para(c)
	if c.kg > cap:
		sobrecarga = true
		Bus.aviso.emit("SOBRECARGA: %s tem %.0f kg; com o centro de carga a %.0f mm a %s aguenta %.0f kg (nominal %.0f kg a 500 mm)." % [c.descricao, c.kg, centro_de_carga(c) * 1000.0, tipo, cap, CAPACIDADE])
		return false
	carga = c
	c.pegar(carro_garfos)
	Som.tocar("clank", null, c.global_position, -6.0)
	return true

## distância do encosto dos garfos (calcanhar) até o centro da carga, ao longo dos garfos
func centro_de_carga(c: Carga) -> float:
	var calcanhar := PONTA_Z - COMPR_GARFO
	return maxf(to_local(c.global_position).z - calcanhar, 0.0)

## capacidade residual (modelo simplificado de momento, não tabela de fabricante): a nominal vale
## para o centro de carga de 500 mm; mais longe, o momento da carga cresce na mesma proporção
func capacidade_para(c: Carga) -> float:
	return CAPACIDADE * 0.5 / maxf(0.5, centro_de_carga(c))

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
		for cam in get_tree().get_nodes_in_group("caminhao"):
			cam.carga_apoiada(c)
		Bus.aviso.emit("%s apoiada (%.2f m de altura)." % [c.descricao, apoio])

func _physics_process(delta: float) -> void:
	var acel := 0.0
	var vira := 0.0
	var sobe := 0.0
	if operando and Interacoes.modo != "ponte":
		operando = false
	if not operando:
		acel = comando.x; vira = comando.y; sobe = comando.z     # testes / funcionário
	elif tipo == "paleteira" and Input.is_physical_key_pressed(KEY_Q):
		sobe = -1.0                                              # segurando a válvula: desce devagar
	if operando:
		acel = float(Input.is_physical_key_pressed(KEY_W)) - float(Input.is_physical_key_pressed(KEY_S))
		vira = float(Input.is_physical_key_pressed(KEY_A)) - float(Input.is_physical_key_pressed(KEY_D))
		sobe = float(Input.is_physical_key_pressed(KEY_R)) - float(Input.is_physical_key_pressed(KEY_F))
	dirigir(acel, vira, sobe, delta)
	_girar_volante()
	if tipo == "empilhadeira" and _subindo < 1.0:
		# sobe pelo degrau do lado esquerdo: primeiro sobe (pé no degrau), depois entra e senta
		_subindo = minf(_subindo + delta, 1.0)
		var t := _subindo
		var lado := Vector3(1.0, 0.0, -0.85)
		var degrau := Vector3(0.75, 0.22, -0.85)
		var p := lado.lerp(degrau, smoothstep(0.0, 0.5, t)) if t < 0.5 else degrau.lerp(ASSENTO, smoothstep(0.5, 1.0, t))
		assento.position = p
	elif tipo == "empilhadeira":
		assento.position = ASSENTO
	if jogador and jogador.preso_a == assento:
		if tipo == "paleteira":
			jogador.maos_externas = maos_timao()
		else:
			jogador.maos_externas = maos_volante() if _subindo >= 1.0 else []

## animação do operador enquanto preso ao equipamento: na paleteira ele ANDA junto (para trás quando puxa)
func anim_jogador() -> Array:
	if tipo == "paleteira":
		if absf(v) > 0.05:
			return ["Push_Cart", v]          # anda inclinado empurrando; puxando, a animação roda de trás para frente
		return ["Idle_Breathing", 0.0]
	if _subindo < 1.0:
		return ["Climb_Forklift", 0.0]
	return ["Sit_Forklift", 0.0]

## pontos do punho do timão (as duas mãos)
func maos_timao() -> Array:
	return [to_global(Vector3(-0.09, 1.16, -0.74)), to_global(Vector3(0.09, 1.16, -0.74))]

## volante de verdade (aro, 3 raios e pomo), no lugar do volante do modelo, inclinado 24° para o motorista;
## gira 2,5 voltas de batente a batente, como numa empilhadeira
## tira do corpo do modelo o volante e a coluna que vêm "colados" na malha (não giram); no lugar entra
## o volante de verdade abaixo. Sem isso ficavam dois volantes um dentro do outro.
func _apagar_volante_do_modelo() -> void:
	var m := modelo.find_child("forklift_body", true, false) as MeshInstance3D
	if m == null:
		return
	var nova := ArrayMesh.new()
	for si in m.mesh.get_surface_count():
		var arr: Array = m.mesh.surface_get_arrays(si)
		var vs: PackedVector3Array = arr[Mesh.ARRAY_VERTEX]
		var idx: PackedInt32Array = arr[Mesh.ARRAY_INDEX] if arr[Mesh.ARRAY_INDEX] != null else PackedInt32Array(range(vs.size()))
		var fica := PackedInt32Array()
		for t in range(0, idx.size(), 3):
			var dentro := true
			for k in 3:
				var v := vs[idx[t + k]]
				if not (absf(v.x) < 0.215 and v.y > 0.98 and v.y < 1.50 and v.z > -0.32 and v.z < 0.17):
					dentro = false
					break
			if not dentro:
				fica.append(idx[t]); fica.append(idx[t + 1]); fica.append(idx[t + 2])
		arr[Mesh.ARRAY_INDEX] = fica
		nova.add_surface_from_arrays(Mesh.PRIMITIVE_TRIANGLES, arr)
		nova.surface_set_material(nova.get_surface_count() - 1, m.mesh.surface_get_material(si))
	m.mesh = nova

func _montar_volante() -> void:
	_apagar_volante_do_modelo()
	volante = Node3D.new()
	volante.position = VOLANTE
	add_child(volante)
	var mv := StandardMaterial3D.new()
	mv.albedo_color = Color(0.08, 0.08, 0.09)
	mv.roughness = 0.6
	var aro := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.148
	tm.outer_radius = 0.175
	tm.rings = 32
	aro.mesh = tm
	aro.material_override = mv
	volante.add_child(aro)
	for i in 3:
		var raio := MeshInstance3D.new()
		var bm := BoxMesh.new()
		bm.size = Vector3(0.025, 0.012, 0.155)
		raio.mesh = bm
		raio.material_override = mv
		var a := TAU * i / 3.0
		raio.position = Vector3(sin(a), 0, cos(a)) * 0.078
		raio.rotation.y = a
		volante.add_child(raio)
	var cubo := MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.top_radius = 0.045
	cm.bottom_radius = 0.05
	cm.height = 0.04
	cubo.mesh = cm
	var mc := StandardMaterial3D.new()
	mc.albedo_color = Color(0.85, 0.65, 0.1)
	cubo.material_override = mc
	volante.add_child(cubo)
	var pomo := MeshInstance3D.new()
	var pm := CylinderMesh.new()
	pm.top_radius = 0.018
	pm.bottom_radius = 0.018
	pm.height = 0.07
	pomo.mesh = pm
	pomo.material_override = mv
	pomo.position = Vector3(-0.162, 0.035, 0.0)     # lado direito do motorista (ele olha para +Z)
	volante.add_child(pomo)
	# coluna de direção até o painel
	var col := MeshInstance3D.new()
	var clm := CylinderMesh.new()
	clm.top_radius = 0.025
	clm.bottom_radius = 0.03
	clm.height = 0.42
	col.mesh = clm
	col.material_override = mv
	col.position = VOLANTE + Vector3(0, -0.19, 0.09)
	col.rotation.x = deg_to_rad(24.0)
	add_child(col)

const VOLTAS_VOLANTE := 2.5

func _girar_volante() -> void:
	if volante:
		var giro := esterco / deg_to_rad(60.0) * VOLTAS_VOLANTE * PI    # ±60° nas rodas = ±1,25 volta
		volante.basis = Basis(Vector3.RIGHT, deg_to_rad(24.0)) * Basis(Vector3.UP, giro)

## mãos no aro do volante (posições 10h10 que giram junto; a direita fica no pomo)
func maos_volante() -> Array:
	if volante == null:
		return [to_global(VOLANTE), to_global(VOLANTE)]
	var r := 0.162
	var dir_p := volante.global_transform * Vector3(-r, 0.05, 0.0)              # mão direita no pomo
	var esq_p := volante.global_transform * Vector3(r * 0.87, 0.0, -r * 0.5)    # esquerda no aro, 10h
	return [dir_p, esq_p]

## um passo de física (também usado pelos testes)
func dirigir(acel: float, vira: float, sobe: float, delta: float) -> void:
	var peso := carga.kg if carga else 0.0
	if tombada:
		acel = 0.0; vira = 0.0; sobe = 0.0
	# carregada anda mais devagar (empilhadeira até -30%, paleteira até -20%); garfo alto com carga: 0,8 m/s
	var vmax := V_MAX * (1.0 - (0.30 if tipo == "empilhadeira" else 0.20) * clampf(peso / CAPACIDADE, 0.0, 1.0))
	if tipo == "empilhadeira" and garfo > 0.5 and carga:
		vmax = minf(vmax, 0.8)
	if acel != 0.0:
		v = move_toward(v, acel * vmax * (1.0 if acel > 0 else 0.6), ACEL * delta)
	else:
		# empilhadeira: freio motor; paleteira: quem empurra para de andar, ela para junto (sem embalo)
		v = move_toward(v, 0.0, (ACEL * 1.5 if tipo == "empilhadeira" else 8.0) * delta)
	# esterço
	if tipo == "empilhadeira":
		esterco = move_toward(esterco, vira * deg_to_rad(60.0), deg_to_rad(120.0) * delta)
		var w := v * tan(esterco) / ENTRE_EIXOS        # gira em torno do eixo da frente (traseira "abre")
		rotate_y(w * delta)
		if absf(v * w) > 0.01:
			_checar_tombo(absf(v * w), signf(w))
	else:
		rotate_y(vira * (0.9 if absf(v) < 0.1 else 1.4) * delta)
	var pos0 := global_position
	velocity = frente() * v
	velocity.y = 0.0
	move_and_slide()
	# rodas giram com a distância andada de verdade (bateu na parede: não giram)
	var andou := (global_position - pos0).dot(frente())
	_giro += andou
	var est := esterco if tipo == "empilhadeira" else _esterco_paleteira
	_esterco_paleteira = move_toward(_esterco_paleteira, vira * 0.9, 3.0 * delta)
	for r in rodas:
		var piv: Node3D = r[0]
		var raio: float = r[1]
		var b: Basis = r[3]
		var giro := Basis(Vector3.RIGHT, _giro / raio)
		piv.transform.basis = (Basis(Vector3.UP, -est if tipo == "empilhadeira" else est) * b * giro) if r[2] else (b * giro)
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
	elif tipo == "paleteira" and sobe < 0.0 and garfo > 0.0:
		# válvula de descida: vazão limitada (≈6 cm/s), a carga não despenca
		garfo = maxf(garfo - 0.06 * delta, 0.0)
		if carro_garfos:
			carro_garfos.position.y = _y_base_carro + garfo
		_conferir_carga()

## dois limites físicos na curva (aceleração lateral a = v·ω):
##  1) a carga solta escorrega dos garfos quando a > μ·g (μ da carga: madeira dos pontaletes/palete sobre aço ≈ 0,35 → 3,4 m/s²)
##     (modelo simplificado: o CG combinado é recalculado a cada quadro com o peso e a altura atuais)
##  2) a empilhadeira tomba de lado quando a > g·b/h, com b = 0,33 m (meia base do triângulo de
##     estabilidade de uma contrabalançada com eixo traseiro pivotado) e h = altura do centro de gravidade
##     combinado (máquina 3.600 kg a 0,62 m + carga na altura dos garfos)
const MU_GARFO := 0.30
const MASSA := 3600.0
const H_CG := 0.62
const B_ESTAB := 0.33

func h_cg_combinado() -> float:
	if carga == null:
		return H_CG
	var hc := GARFO_Y0 + garfo + carga.tamanho.y * 0.5
	return (MASSA * H_CG + carga.kg * hc) / (MASSA + carga.kg)

func limite_tombo() -> float:
	return 9.8 * B_ESTAB / h_cg_combinado()

func _checar_tombo(a_lat: float, lado_curva: float) -> void:
	if tombada:
		return
	var fora := -global_transform.basis.x * lado_curva      # para fora da curva
	if carga and a_lat > carga.mu * 9.8:
		var c := carga
		carga = null
		c.soltar(mundo if mundo else get_parent())
		c.global_position = Vector3(c.global_position.x, 0.0, c.global_position.z) + fora * 0.6
		c.rotation.z = deg_to_rad(8.0)
		c.espalhar(fora)
		avarias += 1
		Som.tocar("bang", null, c.global_position, 0.0)
		Bus.alarme.emit("Empilhadeira", "CARGA ESCORREGOU dos garfos na curva (%.1f m/s², limite μ·g = %.1f). Ande mais devagar nas curvas." % [a_lat, c.mu * 9.8])
	if a_lat > limite_tombo():
		tombada = true
		a_tombo = a_lat
		_t_tombo = 0.0
		_lado_tombo = lado_curva
		avarias += 1
		v = 0.0
		Som.tocar("bang", null, global_position, 4.0)
		Bus.alarme.emit("Empilhadeira", "EMPILHADEIRA TOMBOU (%.1f m/s² na curva, limite %.1f com o CG a %.2f m). Sempre de cinto!" % [a_lat, limite_tombo(), h_cg_combinado()])
		if operando:
			Interacoes.sair_foco()

func _process(delta: float) -> void:
	if not tombada or modelo == null:
		return
	_t_tombo += delta
	# rola para fora da curva até deitar (~80°); depois de 5 s o guincho põe de pé
	var alvo := deg_to_rad(80.0) * -_lado_tombo if _t_tombo < 5.0 else 0.0
	modelo.rotation.z = move_toward(modelo.rotation.z, alvo, delta * (3.0 if _t_tombo < 5.0 else 1.0))
	if _t_tombo >= 5.0 and absf(modelo.rotation.z) < 0.01:
		modelo.rotation.z = 0.0
		tombada = false
		Bus.alarme_resolvido.emit("Empilhadeira")
		Bus.aviso.emit("Empilhadeira levantada pelo guincho. Avaria registrada (%d)." % avarias)
