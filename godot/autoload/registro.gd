extends Node
## Registro de eventos (ChatGPT: "contrato de evento"). Escuta TODOS os sinais do Bus,
## numera em sequência e carimba a hora do jogo. Serve para: salvar/carregar, auditoria nos testes
## (soma de metros = consumo de bobina = peças + sucata) e, depois, para a economia consumir.

var eventos: Array = []        # [{seq, dia, min, tipo, dados}]
var seq := 0
var totais := {"metros_formados": 0.0, "pecas": 0, "refiles": 0, "kwh": 0.0, "emergencias": 0}
const MAX := 5000

func _ready() -> void:
	for sig in Bus.get_signal_list():
		var nome: String = sig.name
		var n_args: int = sig.args.size()
		match n_args:
			0: Bus.connect(nome, func(): _reg(nome, []))
			1: Bus.connect(nome, func(a): _reg(nome, [a]))
			2: Bus.connect(nome, func(a, b): _reg(nome, [a, b]))
			3: Bus.connect(nome, func(a, b, c): _reg(nome, [a, b, c]))

func _reg(tipo: String, dados: Array) -> void:
	match tipo:
		"metros_formados": totais.metros_formados += dados[1]; return   # alta frequência: só soma
		"energia_consumida": totais.kwh += dados[0]; return
		"peca_cortada":
			if dados[2] == "refile": totais.refiles += 1
			else: totais.pecas += 1
		"emergencia":
			if dados[1]: totais.emergencias += 1
	seq += 1
	eventos.append({"seq": seq, "dia": Relogio.dia, "min": int(Relogio.minutos), "tipo": tipo, "dados": dados})
	if eventos.size() > MAX:
		eventos.pop_front()

func contar(tipo: String) -> int:
	var n := 0
	for e in eventos:
		if e.tipo == tipo:
			n += 1
	return n
