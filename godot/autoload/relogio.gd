extends Node
## Dois relógios (decisão do ChatGPT):
##  - relógio INDUSTRIAL: minutos de jogo, acelerável x1/x5/x20. Produção, energia, salários, prazos.
##  - relógio FÍSICO: delta real do _physics_process (personagem, câmera, colisão). Não acelera.
## As máquinas andam com dt_industrial = delta * vel, então o que se vê é exatamente o que se calcula.
## 1 h de jogo = 72 s reais (turno 7h–17h = 12 min reais), igual à Demo.

signal minuto(dia: int, minutos: int)
signal hora(dia: int, hora: int)
signal novo_dia(dia: int)

const SEG_POR_MINUTO := 1.2
const VELOCIDADES := [1, 5, 20]
const HORA_INICIO := 7
const HORA_FIM := 17

var dia := 1
var minutos := HORA_INICIO * 60.0
var vel_idx := 0
var pausado := false
var _acum := 0.0

var vel: int:
	get: return VELOCIDADES[vel_idx]

func alternar_vel() -> int:
	vel_idx = (vel_idx + 1) % VELOCIDADES.size()
	Bus.aviso.emit("Relógio x%d (máquinas e prazos aceleram juntos)" % vel)
	return vel

## tempo industrial deste quadro (s de máquina). Use em tudo que é produção.
func dt_industrial(delta: float) -> float:
	return 0.0 if pausado else minf(delta, 0.1) * vel

func _physics_process(delta: float) -> void:
	if pausado:
		return
	_acum += minf(delta, 0.1) * vel
	var passos := 0
	while _acum >= SEG_POR_MINUTO and passos < 200:
		_acum -= SEG_POR_MINUTO
		passos += 1
		minutos += 1
		minuto.emit(dia, int(minutos))
		if int(minutos) % 60 == 0:
			hora.emit(dia, int(minutos) / 60)
		if minutos >= HORA_FIM * 60:
			dia += 1
			minutos = HORA_INICIO * 60
			novo_dia.emit(dia)

func rotulo() -> String:
	var h := int(minutos) / 60
	var m := int(minutos) % 60
	return "Dia %d  %02d:%02d  (x%d)" % [dia, h, m, vel]
