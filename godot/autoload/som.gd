extends Node
## Sons sintetizados em código (sem arquivo de fora). Cada som existe porque algo aconteceu de verdade no jogo.
## Laços (motor, rolos, chiado, esmerilhadeira) ficam num AudioStreamPlayer3D preso na máquina,
## com volume controlado pelo estado; batidas (THOC, clank, bip, sirene) tocam uma vez na posição.

const TAXA := 22050
var bancos := {}

func _ready() -> void:
	bancos["motor"] = _laco(_motor, 1.0)
	bancos["rolos"] = _laco(_rolos, 1.0)
	bancos["chiado"] = _laco(_chiado, 1.0)
	bancos["esmeril"] = _laco(_esmeril, 1.0)
	bancos["hidraulica"] = _laco(_hidraulica, 1.0)
	bancos["thoc"] = _uma(_thoc, 0.45)
	bancos["clank"] = _uma(_clank, 0.5)
	bancos["bip"] = _uma(_bip, 0.18)
	bancos["sirene"] = _uma(_sirene, 2.0)
	bancos["buzina"] = _uma(_buzina, 0.6)
	bancos["bang"] = _uma(_bang, 0.9)
	bancos["click"] = _uma(_click, 0.06)
	bancos["trava"] = _uma(_trava, 0.35)
	bancos["tlec"] = _uma(_tlec, 0.25)
	bancos["emergencia"] = _uma(_emergencia_som, 0.25)

func _amostras(f: Callable, dur: float) -> PackedByteArray:
	var n := int(TAXA * dur)
	var d := PackedByteArray()
	d.resize(n * 2)
	var rng := RandomNumberGenerator.new()
	rng.seed = 7
	for i in n:
		var t := float(i) / TAXA
		var v: float = clampf(f.call(t, dur, rng), -1.0, 1.0)
		d.encode_s16(i * 2, int(v * 30000.0))
	return d

func _laco(f: Callable, dur: float) -> AudioStreamWAV:
	var s := AudioStreamWAV.new()
	s.format = AudioStreamWAV.FORMAT_16_BITS
	s.mix_rate = TAXA
	s.data = _amostras(f, dur)
	s.loop_mode = AudioStreamWAV.LOOP_FORWARD
	s.loop_begin = 0
	s.loop_end = int(TAXA * dur)
	return s

func _uma(f: Callable, dur: float) -> AudioStreamWAV:
	var s := AudioStreamWAV.new()
	s.format = AudioStreamWAV.FORMAT_16_BITS
	s.mix_rate = TAXA
	s.data = _amostras(f, dur)
	return s

# ---------- receitas (frequências inteiras por segundo para o laço fechar sem estalo) ----------
func _motor(t, _d, rng) -> float:
	return 0.45 * sin(TAU * 50 * t) + 0.25 * sin(TAU * 100 * t) + 0.1 * sin(TAU * 150 * t) + 0.04 * rng.randf_range(-1, 1)
func _rolos(t, _d, rng) -> float:
	return 0.35 * rng.randf_range(-1, 1) * (0.7 + 0.3 * sin(TAU * 6 * t)) + 0.1 * sin(TAU * 220 * t)
func _chiado(t, _d, _r) -> float:
	return 0.5 * sin(TAU * (2400 + 180 * sin(TAU * 3 * t)) * t) * (0.6 + 0.4 * sin(TAU * 2 * t))
func _esmeril(t, _d, rng) -> float:
	return 0.35 * sin(TAU * 3100 * t) + 0.25 * sin(TAU * 6200 * t) + 0.3 * rng.randf_range(-1, 1)
func _hidraulica(t, _d, rng) -> float:
	return 0.3 * sin(TAU * 120 * t) + 0.2 * rng.randf_range(-1, 1) * 0.5
func _thoc(t, _d, rng) -> float:
	var e := exp(-t * 18.0)
	return e * (0.8 * sin(TAU * 70 * t) + 0.6 * rng.randf_range(-1, 1) * exp(-t * 40.0))
func _clank(t, _d, rng) -> float:
	var e := exp(-t * 9.0)
	return e * (0.4 * sin(TAU * 910 * t) + 0.3 * sin(TAU * 1340 * t) + 0.2 * sin(TAU * 2120 * t) + 0.2 * rng.randf_range(-1, 1) * exp(-t * 60.0))
func _bip(t, d, _r) -> float:
	return 0.5 * sin(TAU * 1000 * t) * (1.0 if t < d * 0.85 else 0.0)
func _sirene(t, _d, _r) -> float:
	var f := 620.0 if fmod(t, 0.5) < 0.25 else 820.0
	return 0.45 * sin(TAU * f * t)
func _buzina(t, _d, _r) -> float:
	return 0.4 * (sin(TAU * 420 * t) + 0.5 * sin(TAU * 840 * t)) * minf(1.0, (0.6 - t) * 10.0)
func _bang(t, _d, rng) -> float:
	return exp(-t * 6.0) * (0.7 * rng.randf_range(-1, 1) + 0.6 * sin(TAU * 55 * t) + 0.3 * sin(TAU * 1700 * t) * exp(-t * 20.0))
func _click(t, _d, _r) -> float:
	return exp(-t * 200.0) * sin(TAU * 2500 * t)
func _trava(t, _d, rng) -> float:
	return exp(-t * 25.0) * (0.6 * sin(TAU * 400 * t) + 0.4 * rng.randf_range(-1, 1))
func _tlec(t, _d, rng) -> float:
	return exp(-t * 30.0) * (0.5 * sin(TAU * 1800 * t) + 0.5 * rng.randf_range(-1, 1)) + exp(-maxf(0.0, t - 0.08) * 40.0) * 0.3 * sin(TAU * 600 * t) * float(t > 0.08)
func _emergencia_som(t, _d, rng) -> float:
	return exp(-t * 30.0) * (0.7 * sin(TAU * 180 * t) + 0.3 * rng.randf_range(-1, 1))

# ---------- uso ----------
## toca um som de uma vez na posição (ou sem posição = na cabeça do jogador)
func tocar(nome: String, onde: Node3D = null, posicao := Vector3.ZERO, vol_db := 0.0) -> void:
	if not bancos.has(nome):
		return
	var p: Node
	if onde or posicao != Vector3.ZERO:
		var p3 := AudioStreamPlayer3D.new()
		p3.unit_size = 6.0
		p3.max_distance = 45.0
		p3.volume_db = vol_db
		p = p3
		get_tree().current_scene.add_child(p3)
		p3.global_position = posicao if posicao != Vector3.ZERO else onde.global_position
	else:
		var p2 := AudioStreamPlayer.new()
		p2.volume_db = vol_db
		p = p2
		add_child(p2)
	p.stream = bancos[nome]
	p.finished.connect(p.queue_free)
	p.play()

## cria um laço preso a um nó (o dono controla volume_db e playing)
func laco(nome: String, dono: Node3D) -> AudioStreamPlayer3D:
	var p := AudioStreamPlayer3D.new()
	p.stream = bancos[nome]
	p.unit_size = 5.0
	p.max_distance = 40.0
	p.volume_db = -80.0
	dono.add_child(p)
	p.play()
	return p
