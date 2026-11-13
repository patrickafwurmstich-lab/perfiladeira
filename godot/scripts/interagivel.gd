class_name Interagivel
extends Node3D
## Ponto físico de interação. O [E] só aparece aqui, perto e olhando para cá.
## texto_fn devolve o texto da ação ou "" quando a ação não faz sentido agora
## (ex.: "Cortar a cinta" só existe se a bobina está montada e com cinta).

var texto_fn: Callable
var acao: Callable
var raio := 1.6
var segurar := false         # true = ação enquanto segura E (ex.: puxar a ponta)

static func criar(pai: Node3D, posicao: Vector3, texto: Callable, faz: Callable, r := 1.6) -> Interagivel:
	var i := Interagivel.new()
	i.texto_fn = texto
	i.acao = faz
	i.raio = r
	pai.add_child(i)
	i.position = posicao
	i.add_to_group("interagivel")
	return i

func texto() -> String:
	return texto_fn.call() if texto_fn.is_valid() else ""
