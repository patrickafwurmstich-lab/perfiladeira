class_name QuadroEletrico
extends Node3D
## Quadro elétrico geral. Cada máquina tem seu disjuntor; sem ele, a caixa de comando fica morta.
## A porta abre (anima) e a alavanca do disjuntor sobe/desce de verdade.

var maquina                    # perfiladeira (disjuntor 0)
var maquinas := {}             # índice do disjuntor → máquina (0 perfiladeira, 1 linha de corte...)
var alavancas: Array = []
var foco: Marker3D
var modelo: Node3D
var porta: Node3D
var alavanca: MeshInstance3D
var aberta := false
var _ang := 0.0

func _ready() -> void:
	modelo = load("res://modelos/quadro_eletrico.glb").instantiate()
	add_child(modelo)
	porta = modelo.find_child("electrical-cabinet_door_right", true, false)
	# painel interno com o disjuntor da perfiladeira (visível quando a porta abre)
	var placa := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(1.1, 1.6, 0.02)
	placa.mesh = bm
	var mp := StandardMaterial3D.new()
	mp.albedo_color = Color(0.82, 0.83, 0.8)
	placa.material_override = mp
	placa.position = Vector3(0, 1.05, 0.12)
	add_child(placa)
	var nomes := ["PERFILADEIRA", "GUILHOTINA", "DOBRADEIRA", "PONTE", "ILUMINAÇÃO", "TOMADAS"]
	for i in nomes.size():
		var x := -0.42 + i * 0.17
		var corpo := MeshInstance3D.new()
		var cb := BoxMesh.new()
		cb.size = Vector3(0.07, 0.12, 0.06)
		corpo.mesh = cb
		var mc := StandardMaterial3D.new()
		mc.albedo_color = Color(0.95, 0.95, 0.93)
		corpo.material_override = mc
		corpo.position = Vector3(x, 1.35, 0.16)
		add_child(corpo)
		var lv := MeshInstance3D.new()
		var lb := BoxMesh.new()
		lb.size = Vector3(0.025, 0.04, 0.03)
		lv.mesh = lb
		var ml := StandardMaterial3D.new()
		ml.albedo_color = Color(0.1, 0.1, 0.1) if i != 0 else Color(0.85, 0.1, 0.1)
		lv.material_override = ml
		lv.position = Vector3(x, 1.33, 0.2)
		add_child(lv)
		if i == 0:
			alavanca = lv
		alavancas.append(lv)
		# área clicável do disjuntor (camada 2, como os botões da caixa de comando)
		var sb := StaticBody3D.new()
		sb.collision_layer = 2
		sb.set_meta("disjuntor", i)
		var cs2 := CollisionShape3D.new()
		var bs2 := BoxShape3D.new()
		bs2.size = Vector3(0.09, 0.15, 0.08)
		cs2.shape = bs2
		sb.add_child(cs2)
		sb.position = Vector3(x, 1.35, 0.18)
		add_child(sb)
		var et := Label3D.new()
		et.text = nomes[i]
		et.font_size = 16
		et.pixel_size = 0.0012
		et.modulate = Color(0.05, 0.05, 0.05)
		et.outline_size = 0
		et.position = Vector3(x, 1.25, 0.191)
		add_child(et)
	var col := StaticBody3D.new()
	add_child(col)
	var cs := CollisionShape3D.new()
	var bs := BoxShape3D.new()
	bs.size = Vector3(1.24, 2.06, 0.6)
	cs.shape = bs
	cs.position = Vector3(0, 1.03, 0.02)
	col.add_child(cs)
	foco = Marker3D.new()
	add_child(foco)
	foco.transform = Transform3D(Basis(), Vector3(0, 1.45, 0.95)).looking_at(Vector3(0, 1.3, 0.15), Vector3.UP)
	Interagivel.criar(self, Vector3(0, 1.2, 0.8), _txt, _faz, 1.6)

func _txt() -> String:
	if not aberta:
		return "Abrir o quadro elétrico"
	return "Mexer nos disjuntores (clique no da máquina)"

func _faz() -> void:
	if not aberta:
		aberta = true
		Som.tocar("trava", null, global_position + Vector3(0, 1.2, 0.4), -6.0)
		return
	if maquinas.is_empty():
		maquinas[0] = maquina
	Interacoes.focar(foco, self, "QUADRO ELÉTRICO · clique no disjuntor para ligar/desligar · E ou Esc sai")

func on_foco_clique(ev: InputEventMouseButton, hit: Dictionary) -> void:
	if not ev.pressed or ev.button_index != MOUSE_BUTTON_LEFT or hit.is_empty():
		return
	var col: Object = hit.collider
	if not col.has_meta("disjuntor"):
		return
	var i: int = col.get_meta("disjuntor")
	if maquinas.has(i):
		maquinas[i].cmd_disjuntor(not maquinas[i].energia)
	else:
		Som.tocar("trava", null, global_position + Vector3(0, 1.3, 0.2), -6.0)
		Bus.aviso.emit("Esse circuito ainda não tem máquina instalada.")

## para testes e funcionários: liga/desliga o disjuntor de uma máquina sem o mouse
func disjuntor(i: int, ligar: bool) -> void:
	if maquinas.has(i) and maquinas[i].energia != ligar:
		maquinas[i].cmd_disjuntor(ligar)

func _process(delta: float) -> void:
	_ang = move_toward(_ang, 1.9 if aberta else 0.0, delta * 3.0)
	if porta:
		porta.rotation.y = _ang
	for i in alavancas.size():
		var mq = maquinas.get(i, maquina if i == 0 else null)
		alavancas[i].position.y = 1.36 if (mq and mq.energia) else 1.30
