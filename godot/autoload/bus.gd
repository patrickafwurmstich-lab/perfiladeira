extends Node
## Barramento de eventos: todo sistema avisa os outros por aqui (regra do Lucas: tudo sincronizado).
## Cada sinal tem um nome claro; quem precisa escuta. Nenhum sistema chama o outro direto para "contar" coisas.

signal aviso(texto: String)                       # mensagem curta na tela
signal alarme(origem: String, texto: String)      # alarme de máquina (fica até resolver)
signal alarme_resolvido(origem: String)
signal metros_formados(maquina: String, metros: float)   # chapa que passou pelos rolos
signal peca_cortada(maquina: String, comprimento: float, defeito: String)
signal peca_na_pilha(maquina: String, total: int)
signal bobina_acabando(maquina: String, metros_restantes: float)
signal bobina_acabou(maquina: String)
signal enrosco(maquina: String, x_local: float)
signal emergencia(maquina: String, apertada: bool)
signal energia_consumida(kwh: float)
signal estado_maquina(maquina: String, estado: String)
signal procedimento(maquina: String, etapa: String, feito: bool)
signal conquista(nome: String, texto: String)
