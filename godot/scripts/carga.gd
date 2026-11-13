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

static func criar(pai: Node, xf: Transform3D, p_tipo: String, p_qtd: int, p_metros: float, p_kg: float, p_tam: Vector3, p_desc: String, com_palete := false) -> Carga:
	var c := Carga.new()
	c.tipo = p_tipo
	c.qtd = p_qtd
	c.metros = p_metros
	c.kg = p_kg
	c.tamanho = p_tam
	c.descricao = p_desc
	c.y_vao = 0.12 if com_palete else 0.0       # face de baixo do que os garfos levantam
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
	var base_h := 0.0
	if com_palete:
		# palete de madeira 1,2 × 1,0 com vão para os garfos
		base_h = 0.14
		for zz in [-0.45, 0.0, 0.45]:
			var tb := MeshInstance3D.new()
			var bm := BoxMesh.new()
			bm.size = Vector3(tamanho.x, 0.02, 0.10)
			tb.mesh = bm
			tb.material_override = madeira
			tb.position = Vector3(0, 0.01, zz * tamanho.z / 1.0)
			add_child(tb)
		for xx in [-0.5, 0.0, 0.5]:
			var bl := MeshInstance3D.new()
			var bb := BoxMesh.new()
			bb.size = Vector3(0.10, 0.10, tamanho.z)
			bl.mesh = bb
			bl.material_override = madeira
			bl.position = Vector3(xx * (tamanho.x - 0.1), 0.07, 0)
			add_child(bl)
		var tp := MeshInstance3D.new()
		var tpm := BoxMesh.new()
		tpm.size = Vector3(tamanho.x, 0.02, tamanho.z)
		tp.mesh = tpm
		tp.material_override = madeira
		tp.position.y = 0.13
		add_child(tp)
	# o produto
	var h := maxf(tamanho.y - base_h, 0.01)
	var m := MeshInstance3D.new()
	var pm := BoxMesh.new()
	pm.size = Vector3(tamanho.x, h, tamanho.z * (0.92 if com_palete else 1.0))
	m.mesh = pm
	m.material_override = mch
	m.position.y = base_h + h * 0.5
	add_child(m)
	# fitas de amarração (aço preto) a cada ~1 m
	var mf := StandardMaterial3D.new()
	mf.albedo_color = Color(0.08, 0.08, 0.09)
	var n_fitas := maxi(2, int(tamanho.x / 1.0) + 1)
	for i in n_fitas:
		var f := MeshInstance3D.new()
		var fb := BoxMesh.new()
		fb.size = Vector3(0.02, h + 0.004, tamanho.z * (0.92 if com_palete else 1.0) + 0.004)
		f.mesh = fb
		f.material_override = mf
		f.position = Vector3(lerpf(-tamanho.x * 0.42, tamanho.x * 0.42, float(i) / (n_fitas - 1)), base_h + h * 0.5, 0)
		add_child(f)
	var et := Label3D.new()
	et.text = descricao
	et.font_size = 36
	et.pixel_size = 0.0025
	et.modulate = Color(1, 1, 1)
	et.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	et.no_depth_test = false
	et.position = Vector3(0, tamanho.y + 0.25, 0)
	add_child(et)
	corpo = StaticBody3D.new()
	var cs := CollisionShape3D.new()
	var bx := BoxShape3D.new()
	bx.size = Vector3(tamanho.x, maxf(tamanho.y - (0.14 if com_palete else 0.0), 0.05), tamanho.z)
	cs.shape = bx
	cs.position.y = tamanho.y - bx.size.y * 0.5
	corpo.add_child(cs)
	add_child(corpo)

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
	if rel < -0.09:
		return "garfos baixos demais (%.0f cm abaixo do vão)" % (-rel * 100.0)
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
