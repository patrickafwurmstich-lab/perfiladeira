extends Node
## Controles definidos em código (fica fácil de ler e mudar).

const MAPA := {
	"frente": [KEY_W, KEY_UP], "tras": [KEY_S, KEY_DOWN],
	"esquerda": [KEY_A, KEY_LEFT], "direita": [KEY_D, KEY_RIGHT],
	"correr": [KEY_SHIFT], "interagir": [KEY_E], "camera": [KEY_V],
	"sair": [KEY_ESCAPE], "relogio": [KEY_T], "ajuda": [KEY_H],
	"trocar_manivela": [KEY_TAB],
}

func _ready() -> void:
	for acao in MAPA:
		if not InputMap.has_action(acao):
			InputMap.add_action(acao)
		for tecla in MAPA[acao]:
			var ev := InputEventKey.new()
			ev.physical_keycode = tecla
			InputMap.action_add_event(acao, ev)
