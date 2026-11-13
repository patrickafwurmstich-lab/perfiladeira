extends Node
## Modos de interação do jogador. Nada de painel 2D surgindo do nada:
##  - "andar": anda e usa [E] nos pontos físicos
##  - "foco": a câmera vai até um objeto (caixa de comando, manivelas) e o mouse clica nos botões 3D de verdade
##  - "progresso": uma ação que leva tempo (cortar cinta, engraxar) — o personagem fica parado fazendo
## A câmera do jogador lê `foco_alvo` e faz a transição suave.

signal modo_mudou(modo: String)
signal progresso_mudou(texto: String, frac: float)
signal dica(texto: String)

var modo := "andar"
var epi := false                       # operador com luva, óculos e protetor auricular
var foco_alvo: Node3D = null          # Marker3D para onde a câmera vai
var foco_dono: Object = null            # quem recebe cliques/teclas (precisa de on_foco_clique / on_foco_tecla)
var _prog_t := 0.0
var _prog_dur := 0.0
var _prog_txt := ""
var _prog_cb: Callable

func progresso(texto: String, dur: float, cb: Callable) -> void:
	if modo == "progresso":
		return
	_prog_txt = texto
	_prog_dur = dur
	_prog_t = 0.0
	_prog_cb = cb
	_mudar("progresso")

func _process(delta: float) -> void:
	if modo == "progresso":
		_prog_t += delta
		progresso_mudou.emit(_prog_txt, clampf(_prog_t / _prog_dur, 0.0, 1.0))
		if _prog_t >= _prog_dur:
			_mudar("andar")
			progresso_mudou.emit("", -1.0)
			if _prog_cb.is_valid():
				_prog_cb.call()

func focar(alvo: Node3D, dono: Object, texto_dica: String) -> void:
	foco_alvo = alvo
	foco_dono = dono
	Input.mouse_mode = Input.MOUSE_MODE_VISIBLE
	_mudar("foco")
	dica.emit(texto_dica)

func sair_foco() -> void:
	if foco_dono and foco_dono.has_method("on_foco_saiu"):
		foco_dono.on_foco_saiu()
	foco_alvo = null
	foco_dono = null
	dica.emit("")
	_mudar("andar")

func modo_guias(maq: Node) -> void:
	maq.get_node("FocoGuias")
	focar(maq.get_node("FocoGuias"), GuiasFoco.new(maq), "MANIVELAS DAS GUIAS · Tab troca a manivela · roda do mouse ou A/D gira (¼ de volta = 0,5 mm) · Esc sai")

func _mudar(m: String) -> void:
	modo = m
	modo_mudou.emit(m)

func _unhandled_input(ev: InputEvent) -> void:
	if modo != "foco":
		return
	if ev.is_action_pressed("sair") or ev.is_action_pressed("interagir"):
		get_viewport().set_input_as_handled()
		sair_foco()
		return
	if foco_dono == null:
		return
	if ev is InputEventMouseButton:
		var cam := get_viewport().get_camera_3d()
		if cam == null:
			return
		var origem := cam.project_ray_origin(ev.position)
		var dir := cam.project_ray_normal(ev.position)
		var q := PhysicsRayQueryParameters3D.create(origem, origem + dir * 4.0, 2)
		q.collide_with_areas = true
		var hit := cam.get_world_3d().direct_space_state.intersect_ray(q)
		if foco_dono.has_method("on_foco_clique"):
			foco_dono.on_foco_clique(ev, hit)
		get_viewport().set_input_as_handled()
	elif ev is InputEventKey and foco_dono.has_method("on_foco_tecla"):
		foco_dono.on_foco_tecla(ev)

## Controlador temporário do modo manivelas
class GuiasFoco extends RefCounted:
	var maq
	var qual := 0
	func _init(m) -> void:
		maq = m
		_avisar()
	func _avisar() -> void:
		Interacoes.dica.emit("Manivela %s · desvio %+.1f mm · folga %.1f mm · Tab troca · roda/A-D gira · Esc sai" % ["CENTRO" if qual == 0 else "APERTO", maq.desvio_mm, maq.folga_mm])
	func on_foco_clique(ev, _hit) -> void:
		if ev.pressed and ev.button_index == MOUSE_BUTTON_WHEEL_UP:
			maq.girar_manivela(qual, 0.25)
		elif ev.pressed and ev.button_index == MOUSE_BUTTON_WHEEL_DOWN:
			maq.girar_manivela(qual, -0.25)
		_avisar()
	func on_foco_tecla(ev) -> void:
		if not ev.pressed:
			return
		if ev.is_action("trocar_manivela"):
			qual = 1 - qual
		elif ev.is_action("direita"):
			maq.girar_manivela(qual, 0.25)
		elif ev.is_action("esquerda"):
			maq.girar_manivela(qual, -0.25)
		_avisar()
