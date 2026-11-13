class_name Carga
extends Node3D
## Uma carga que se move com garfos (empilhadeira ou paleteira): amarrado de telhas, pilha de chapas,
## palete de rufos. Os garfos entram por baixo (no vão "y_vao" acima da base da carga), pelo eixo local Z
## (de qualquer um dos dois lados). Quando está apoiada, tem colisão; levantada, a colisão sai
## (senão a própria empilhadeira empurraria a carga).

static var todas: Array = []

var tipo := "telha"           # telha | chapa | rufo
var descricao := ""
var qtd := 0
var metros := 0.0
var kg := 0.0
var tamanho := Vector3(3.0, 0.3, 1.1)   # comprimento (X) × altura × largura (Z: por onde os garfos entram)
var y_vao := 0.0              # altura do vão dos garfos acima da base da carga (palete = 0,02; amarrado = 0)
var corpo: StaticBody3D
var no_garfo: Node3D = null   # quem está segurando
var etiqueta: Label3D
var mu := 0.35                  # atrito com os garfos: madeira (palete/pontalete) sobre aço ≈ 0,3–0,4
var garfo_min := -0.04          # quanto abaixo do vão o topo do garfo pode estar (chão/tábuas de baixo + 4 cm de garfo)

static func criar(pai: Node, xf: Transform3D, p_tipo: String, p_qtd: int, p_metros: float, p_kg: float, p_tam: Vector3, p_desc: String, com_palete := false) -> Carga:
	var c := Carga.new()
	c.tipo = p_tipo
	c.qtd = p_qtd
	c.metros = p_metros
	c.kg = p_kg
	c.tamanho = p_tam
	c.descricao = p_desc
	c.y_vao = 0.12 if com_palete else 0.08      # face de baixo do que os garfos levantam (tampo do palete / topo dos pontaletes)
	c.garfo_min = -0.06 if com_palete else -0.04  # palete: tábuas de baixo a 2 cm; pontaletes: chão
	pai.add_child(c)
	c.global_transform = xf
	c._montar(com_palete)
	return c

func _enter_tree() -> void:
	if not todas.has(self):
		todas.append(self)

func _exit_tree() -> void:
	# reparent() também passa por aqui: só sai da lista de verdade se for apagada
	if is_queued_for_deletion():
		todas.erase(self)

func _notification(what: int) -> void:
	if what == NOTIFICATION_PREDELETE:
		todas.erase(self)

func _montar(com_palete: bool) -> void:
	var mch := Perfil.material_chapa()
	var madeira := StandardMaterial3D.new()
	madeira.albedo_color = Color(0.58, 0.44, 0.27)
	madeira.roughness = 0.95
	var base_h := 0.0
	if com_palete:
		# palete de madeira com vão para os garfos (tábuas de baixo 2 cm, blocos 10 cm, tampo 2 cm)
		base_h = 0.14
		for zz in [-0.45, 0.0, 0.45]:
			_caixa(Vector3(tamanho.x, 0.02, 0.10), Vector3(0, 0.01, zz * tamanho.z), madeira)
		for xx in [-0.5, 0.0, 0.5]:
			_caixa(Vector3(0.10, 0.10, tamanho.z), Vector3(xx * (tamanho.x - 0.1), 0.07, 0), madeira)
		_caixa(Vector3(tamanho.x, 0.02, tamanho.z), Vector3(0, 0.13, 0), madeira)
	else:
		# pontaletes de madeira 8 × 8 cm atravessados (os garfos entram entre eles)
		base_h = 0.08
		var n_p := maxi(2, int(tamanho.x / 1.0) + 1)
		for i in n_p:
			var xx := lerpf(-tamanho.x * 0.5 + 0.12, tamanho.x * 0.5 - 0.12, float(i) / (n_p - 1))
			_caixa(Vector3(0.08, 0.08, tamanho.z + 0.06), Vector3(xx, 0.04, 0), madeira)
	# o produto
	var h := maxf(tamanho.y - base_h, 0.01)
	var larg := tamanho.z * (0.92 if com_palete else 1.0)
	if tipo == "telha":
		# laterais em camadas + a onda TP-40 da telha de cima (lê como telhas, não como bloco)
		_caixa(Vector3(tamanho.x, maxf(h - 0.04, 0.005), larg * 0.96), Vector3(0, base_h + (h - 0.04) * 0.5, 0), mch)
		var topo := MeshInstance3D.new()
		topo.mesh = Perfil.malha_telha(tamanho.x)
		topo.material_override = mch
		topo.position = Vector3(-tamanho.x * 0.5, base_h + h - 0.04, 0)
		add_child(topo)
	else:
		_caixa(Vector3(tamanho.x, h, larg), Vector3(0, base_h + h * 0.5, 0), mch)
	# fitas de aço da amarração (3,2 cm, pretas, um pouco salientes) + cantoneiras de proteção brancas
	var mf := StandardMaterial3D.new()
	mf.albedo_color = Color(0.10, 0.10, 0.11)
	mf.metallic = 0.6
	mf.roughness = 0.45
	var mcant := StandardMaterial3D.new()
	mcant.albedo_color = Color(0.92, 0.92, 0.9)
	var n_fitas := maxi(2, int(tamanho.x / 1.0) + 1)
	var rng := RandomNumberGenerator.new()
	rng.seed = hash(descricao) + n_fitas
	for i in n_fitas:
		var fx := lerpf(-tamanho.x * 0.38, tamanho.x * 0.38, float(i) / (n_fitas - 1)) + rng.randf_range(-0.04, 0.04)
		var fita := _caixa(Vector3(0.032, h + 0.012, larg + 0.012), Vector3(fx, base_h + h * 0.5, 0), mf)
		fita.rotation.y = deg_to_rad(rng.randf_range(-2.5, 2.5))       # passadas à mão: nunca perfeitamente retas
		for sz in [-1.0, 1.0]:
			_caixa(Vector3(0.07, 0.035, 0.035), Vector3(fx, base_h + h - 0.012, sz * (larg * 0.5 - 0.012)), mcant)
	var et := Label3D.new()
	et.text = descricao
	et.font_size = 36
	et.pixel_size = 0.0025
	et.modulate = Color(1, 1, 1)
	et.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	et.no_depth_test = false
	et.position = Vector3(0, tamanho.y + 0.25, 0)
	add_child(et)
	etiqueta = et
	corpo = StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var bx := BoxShape3D.new()
	bx.size = Vector3(tamanho.x, maxf(h, 0.05), tamanho.z)
	cs.shape = bx
	cs.position.y = base_h + bx.size.y * 0.5
	corpo.add_child(cs)
	add_child(corpo)

func _caixa(sz: Vector3, pos: Vector3, mat: Material) -> MeshInstance3D:
	var m := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = sz
	m.mesh = bm
	m.material_override = mat
	m.position = pos
	add_child(m)
	return m

## a carga caiu: inclina e algumas peças escorregam para fora do amarrado
func espalhar(lado: Vector3) -> void:
	descricao += " (AVARIADA)"
	if etiqueta:
		etiqueta.text = descricao
		etiqueta.modulate = Color(1, 0.4, 0.3)
	var rng := RandomNumberGenerator.new()
	var mch := Perfil.material_chapa()
	var lado_l := global_transform.basis.inverse() * lado
	for i in 5:
		var p := MeshInstance3D.new()
		p.mesh = Perfil.malha_telha(tamanho.x * rng.randf_range(0.9, 1.0)) if tipo == "telha" else BoxMesh.new()
		if tipo != "telha":
			(p.mesh as BoxMesh).size = Vector3(tamanho.x, 0.004, tamanho.z)
		p.material_override = mch
		p.position = Vector3(-tamanho.x * 0.5 + rng.randf_range(-0.3, 0.3), 0.02 + i * 0.012, 0) + lado_l.normalized() * (0.5 + i * 0.22)
		p.rotation = Vector3(rng.randf_range(-0.12, 0.12), rng.randf_range(-0.35, 0.35), rng.randf_range(-0.2, 0.2))
		add_child(p)

## os garfos (frente apontando para "fwd", ponta em "ponta", altura de cima do garfo "y_garfo")
## estão em posição de pegar esta carga?  Devolve "" se sim, ou o motivo.
func pode_pegar(fwd: Vector3, ponta: Vector3, y_topo_garfo: float, largura_garfos: float) -> String:
	if no_garfo:
		return "já está nos garfos"
	var ez := global_transform.basis.z.normalized()
	var cosang := absf(fwd.normalized().dot(ez))
	if cosang < 0.985:                 # ~10°
		return "garfos tortos em relação à carga (%.0f°)" % rad_to_deg(acos(clampf(cosang, -1, 1)))
	var loc := to_local(ponta)
	if absf(loc.x) > tamanho.x * 0.5 - largura_garfos * 0.5 + 0.05:
		return "garfos fora do centro da carga"
	# quanto os garfos entraram (a ponta tem que ter passado pelo menos 2/3 da largura)
	var lado := signf(fwd.dot(ez))
	var entrou := tamanho.z * 0.5 + loc.z * lado
	if entrou < tamanho.z * 0.66:
		return "garfos pouco enfiados (%.0f%%)" % (100.0 * entrou / tamanho.z)
	if entrou > tamanho.z + 0.25:
		return "garfos passaram da carga"
	var rel := y_topo_garfo - (global_position.y + y_vao)
	if rel > 0.01:
		return "garfos altos demais: batem na carga (%.0f cm acima do vão)" % (rel * 100.0)
	if rel < garfo_min - 0.005:
		return "garfos baixos demais: raspam embaixo (%.0f cm abaixo do vão)" % (-rel * 100.0)
	return ""

func pegar(garfo: Node3D) -> void:
	no_garfo = garfo
	corpo.process_mode = Node.PROCESS_MODE_DISABLED
	reparent(garfo, true)

## solta no mundo (apoiada no que estiver embaixo)
func soltar(mundo: Node) -> void:
	no_garfo = null
	reparent(mundo, true)
	var r := global_rotation
	global_rotation = Vector3(0, r.y, 0)
	corpo.process_mode = Node.PROCESS_MODE_INHERIT

## altura do que estiver embaixo da carga (chão, carroceria, mesa) — raios nos 4 cantos e no meio
func apoio_embaixo(espaco: PhysicsDirectSpaceState3D) -> float:
	var melhor := 0.0
	var b := global_transform.basis
	for p in [Vector3.ZERO, Vector3(0.4, 0, 0.4), Vector3(-0.4, 0, 0.4), Vector3(0.4, 0, -0.4), Vector3(-0.4, 0, -0.4)]:
		var o: Vector3 = global_position + b * Vector3(p.x * tamanho.x, 0, p.z * tamanho.z) + Vector3.UP * 0.02
		var q := PhysicsRayQueryParameters3D.create(o, o + Vector3.DOWN * 6.0, 1)
		q.exclude = [corpo.get_rid()]
		var hit := espaco.intersect_ray(q)
		if not hit.is_empty():
			melhor = maxf(melhor, hit.position.y)
	return melhor
