class_name Perfiladeira
extends Node3D
## PERFILADEIRA TP-40 — lógica + tudo o que se vê, no MESMO lugar e no MESMO passo.
## Regra do Lucas: o que a tela mostra é o que o jogo calcula. Cada metro que anda na tela:
##  tira da bobina (raio real), gasta rolo e graxa, consome energia, avança a peça e vai para a pilha.
## Coordenadas: as do modelo 3D (X ao longo da máquina, a chapa anda de -X para +X; +Z = lado do operador).

var NOME := "Perfiladeira TP-40"
# ---- geometria do modelo perfiladeira_tp40.glb ----
var X_DESB := -7.2
var Y_DESB := 1.12
var X_ENTRADA := -6.2        # começo da mesa de entrada
var Y_PASSE := 0.948         # linha de passe (topo dos rolos inferiores)
var X_E0 := -4.9             # 1ª estação
var PASSO := 0.75
var N_EST := 13
var X_E1 := X_E0 + (N_EST - 1) * PASSO    # última estação (4,1)
var X_CORTE := 5.07          # contra-faca da guilhotina
var X_APOIO_FIM := 7.05
var X_PILHA := 7.2           # começo da pilha (sobre pontaletes no chão)
var R_INF := 0.085
var R_SUP := 0.07
var Y_LAMINA := 1.18
# ---- material e máquina (dados da Demo) ----
const ESPESSURA := 0.00043     # chapa 0,43 mm
const R_FURO := 0.254          # furo de 508 mm
const KW := 15.0
const V_REAL := 12.0 / 60.0    # 12 m/min da máquina real
const FATOR_VISUAL := 3.0      # decisão da sala: 3x a real = 0,6 m/s (telha de 6 m em 10 s)
const V_JOG := 0.12
var MESA_CAP := 60
var NINHO := 0.006           # altura de cada telha encaixada na pilha
var LARG_UTIL := 0.98        # largura útil da TP-40 (m² vendável = L × 0,98)
# ---- o que muda entre as máquinas da família (perfiladeira × linha de corte) ----
var ARQUIVO_MODELO := "res://modelos/perfiladeira_tp40.glb"
var PLANO := false            # true = chapa lisa (sem estações formadoras)
var X_MESA := -5.75           # mesa de entrada / guias
var POS_CAIXA := Vector3(-5.2, 0, 1.45)
var Y_PILHA0 := 0.10          # altura da 1ª peça da pilha
var X_BATENTE := -1.0         # >0: as peças correm até o batente (pilha na própria mesa)
var LAMINA_CURSO := 0.25
var Y_PISADOR := 1.10
var PISADOR_CURSO := 0.13
var GRAXEIRAS_X: Array = []   # vazio = calcula pelas estações
var COLISAO: Array = [
	[Vector3(-7.2, 0.7, 0), Vector3(1.4, 1.4, 1.7)],
	[Vector3(-5.75, 0.45, 0), Vector3(0.9, 0.9, 1.3)],
	[Vector3(-0.4, 0.75, 0.1), Vector3(9.9, 1.5, 1.7)],
	[Vector3(4.95, 0.9, -0.2), Vector3(1.1, 1.8, 2.3)],
	[Vector3(6.4, 0.45, 0), Vector3(1.3, 0.9, 1.3)],
]
var COMPRIMENTO_PADRAO := 3.0
var NOME_PECA := "TELHA"
var PECAS := "telhas"
var GRAXEIRA_Y := 1.2
var GRAXEIRA_Z := 0.69
var MANIVELA_Z := 0.72
var TAMPA_X0 := 0.0           # 0/0 = cobre as estações
var TAMPA_X1 := 0.0
var TAMPA_Y := 1.30
# endireitador (só a linha de corte): volantes que regulam a penetração dos rolos
var TEM_ENDIREITADOR := false
var penetracao_mm := 0.0
var PENETRACAO_IDEAL := 2.0
var volantes: Array = []
var X_SENSOR_FIM := X_E0 - 0.6   # sensor de fim de chapa (alavanca na entrada)
const T_CORTE := 0.9           # ciclo da guilhotina: pisador desce, lâmina desce/sobe, pisador sobe
const T_SIRENE := 3.0          # sirene + giroflex antes de qualquer movimento automático

# ---- estado físico ----
var energia := false            # disjuntor do quadro
var chave_geral := false
var emergencia := false
var precisa_reset := false
var modo := "manual"            # "manual" | "auto"
var rodando := false            # ciclo automático ligado
var jog := false                # botão de avanço lento segurado
var teste_ativo := false        # peça teste em andamento (modo manual)
var falha := ""                 # "" | "emergencia" | "enrosco" | "fim_bobina" | "mesa_cheia" | "lote" | "energia"
var sirene_t := 0.0
var corte_t := 0.0
var v := 0.0                    # velocidade da linha (m/s de máquina)

# configuração na IHM
var comprimento := 3.0
var quantidade := 20
var velocidade := 1.0           # 0,6 a 1,0 da nominal
var correcao_mm := 0.0

# bobina e chapa
var bobina := {"presente": false, "metros_total": 247.0, "metros": 0.0, "cinta": false, "travada": false, "codigo": "", "kg": 0.0}
var fita := "nenhuma"             # "presa" (cinta) | "solta" | "puxando" | "na_mesa" | "enfiada" | "nenhuma"
var cabeca := X_ENTRADA         # x da ponta da chapa dentro da máquina
var cauda_s := -1.0             # distância andada desde que a bobina acabou (-1 = bobina não acabou)
var peca_m := 0.0               # quanto já passou do corte na peça atual
var desvio_mm := 0.0            # guia fora de centro (chapa desloca)
var folga_mm := 0.0             # folga entre chapa e guias
var erro_encoder_mm := 0.0      # calibração do encoder (escondido; a trena revela)
var desgaste := 0.12            # máquina usada
var graxa := [0.3, 0.6, 0.2, 0.5, 0.4, 0.3]
var produzidas := 0
var sucata_m := 0.0
var puxado_mao_m := 0.0
var _comp_ult := 0.0
var consumido_m := 0.0          # chapa que saiu de bobinas (conservação: = pilha + sucata + estoque + o que está na linha)
var estoque_retirado := 0
var estoque_retirado_m := 0.0
var energia_kwh := 0.0
var ultima_medida := {}
var teste_feito := false
var medida_ok := false
var perfeita_dada := false
var enrosco_x := 0.0
var enrosco_iminente := 0.0     # segundos até enroscar (o chiado avisa antes)
var aviso_10 := false
var protecao_fechada := true    # tampa de tela sobre os rolos, com chave de segurança
var freio_ok := false           # freio do desbobinador ajustado (sem ele a bobina embala e faz barriga)
var barriga_m := 0.0            # chapa frouxa entre bobina e mesa
var ponta_refilada := false     # a ponta da bobina vem amassada: corta-se fora antes da peça teste
var lamina_em_cima := true      # sensor de lâmina em repouso
var arco_m := 0.0               # flecha vertical da chapa (memória de bobina mal endireitada) — linha de corte
var enrosco_aleatorio := true   # testes automáticos desligam o sorteio para serem repetíveis

# ---- nós visuais ----
var modelo: Node3D
var rolos_inf: Array = []
var rolos_sup: Array = []
var lamina: Node3D
var mandril: Node3D
var guias: Array = []           # [nó, lado]
var reguas: Array = []          # réguas do mandril expansivo (abrem 8 mm quando trava)
var bobina_grp: Node3D
var bobina_malha: MeshInstance3D
var bobina_furo: MeshInstance3D
var cintas: Array = []
var fita_alim: MeshInstance3D   # da bobina até a mesa (2 trechos para mostrar a barriga)
var fita_alim2: MeshInstance3D
var fita_mat: ShaderMaterial
var fita_malha: MeshInstance3D  # dentro da máquina (formando)
var peca_malha: MeshInstance3D  # telha crescendo depois do corte
var deslizando: Array = []      # telhas cortadas indo para a pilha
var pilha_nos: Array = []
var pilha: Array = []           # [{L, curva, assim, defeito}]
var amassado: MeshInstance3D
var faiscas: CPUParticles3D
var trena_no: Node3D
var manivelas: Array = []
var _cache_telha := {}
var _mat_chapa: StandardMaterial3D
var caixa: CaixaComando
var som_motor: AudioStreamPlayer3D
var som_rolos: AudioStreamPlayer3D
var som_chiado: AudioStreamPlayer3D
var som_hidr: AudioStreamPlayer3D
var rng := RandomNumberGenerator.new()
var ponta_mao: Vector3 = Vector3.ZERO   # onde está a mão do jogador quando puxa a ponta (local)
var jogador_ref: Node3D

## geometria da máquina: a perfiladeira usa os valores acima; outras máquinas da mesma família
## (linha de corte) mudam os números em _configurar() e herdam toda a lógica testada
func _configurar() -> void:
	pass

## rolos que giram com a chapa (inferiores e superiores); a linha de corte troca por endireitador + puxador
func _achar_rolos() -> void:
	for e in N_EST:
		rolos_inf.append(modelo.find_child("rolo_inf_%d" % e, true, false))
		rolos_sup.append(modelo.find_child("rolo_sup_%d" % e, true, false))

## onde a peça cortada termina de deslizar (início dela no eixo X)
func _x_pilha(L: float) -> float:
	return X_BATENTE - 0.04 - L if X_BATENTE > 0.0 else X_PILHA

func _ready() -> void:
	_configurar()
	X_E1 = X_E0 + (N_EST - 1) * PASSO
	X_SENSOR_FIM = X_E0 - 0.6 if not PLANO else X_ENTRADA + 0.1
	if TAMPA_X0 == 0.0 and TAMPA_X1 == 0.0:
		TAMPA_X0 = X_E0 - 0.35
		TAMPA_X1 = X_E1 + 0.35
	rng.randomize()
	erro_encoder_mm = rng.randf_range(-15.0, 15.0)
	_mat_chapa = Perfil.material_chapa()
	comprimento = COMPRIMENTO_PADRAO
	modelo = load(ARQUIVO_MODELO).instantiate()
	add_child(modelo)
	_achar_rolos()
	lamina = modelo.find_child("lamina", true, false)
	if lamina:
		Y_LAMINA = lamina.position.y
	mandril = modelo.find_child("mandril_desbobinador", true, false)
	if mandril:
		for c in mandril.get_children():
			if String(c.name).begins_with("regua"):
				reguas.append([c, c.position])
	var ent := modelo.find_child("mesa_entrada", true, false) if not PLANO else null
	if ent:
		for c in ent.get_children():
			if String(c.name).begins_with("guia"):
				guias.append([c, signf(c.position.z), c.position.z])
	_montar_bobina_visual()
	_montar_fita()
	_montar_pontaletes()
	_montar_pisador_e_tambor()
	_montar_protecao()
	_montar_alavancas()
	_montar_manivelas()
	_montar_graxeiras()
	_montar_colisao()
	_montar_trena()
	faiscas = _criar_faiscas()
	add_child(faiscas)
	som_motor = Som.laco("motor", self)
	som_motor.position = Vector3(-1.0, 0.4, 0.9)
	som_rolos = Som.laco("rolos", self)
	som_rolos.position = Vector3(0, 1.0, 0)
	som_chiado = Som.laco("chiado", self)
	som_chiado.position = Vector3(0, 1.0, 0)
	som_hidr = Som.laco("hidraulica", self)
	som_hidr.position = Vector3(5.0, 0.6, -1.0)
	# caixa de comando ao lado da entrada, virada para o corredor do operador (+Z)
	caixa = CaixaComando.new()
	caixa.maquina = self
	add_child(caixa)
	caixa.position = POS_CAIXA
	_interacoes()
	var fg := Marker3D.new()
	fg.name = "FocoGuias"
	add_child(fg)
	fg.transform = Transform3D(Basis(), Vector3(X_MESA, 1.55, 1.75)).looking_at(Vector3(X_MESA, 0.85, 0.55), Vector3.UP)
	_atualizar_visual(0.0)

# ======================================================================
#  ETAPAS (checklist de partida que aparece na tela — ensina e mostra o que falta)
# ======================================================================
func etapas() -> Array:
	return [
		["Vestir o EPI no armário (luva, óculos, protetor auricular)", Interacoes.epi],
		["Ligar o disjuntor da perfiladeira no quadro elétrico", energia],
		["Ligar a CHAVE GERAL na caixa de comando", chave_geral],
		["Emergência liberada e RESET apertado", chave_geral and not emergencia and not precisa_reset],
		["Trazer a bobina com a PONTE ROLANTE e encaixar no mandril", bobina.presente],
		["Travar o mandril da bobina (alavanca)", bobina.presente and bobina.travada],
		["Ajustar o freio do desbobinador", freio_ok],
		["Cortar as cintas da bobina", bobina.presente and not bobina.cinta],
		["Puxar a ponta da chapa até a mesa de entrada", fita in ["na_mesa", "enfiada"]],
		["Passar a chapa até a guilhotina (AVANÇO LENTO, modo manual)", fita == "enfiada"],
		["Refilar a ponta amassada (CORTE MANUAL — vai para a sucata)", ponta_refilada],
		["Centralizar as guias (desvio ≤ 2 mm, folga ≤ 3 mm)", absf(desvio_mm) <= 2.0 and folga_mm <= 3.0 and fita == "enfiada"],
		["Ajustar o endireitador (volantes) para a chapa sair reta", absf(penetracao_mm - PENETRACAO_IDEAL) <= 0.25] if TEM_ENDIREITADOR else ["", true],
		["Cortar uma PEÇA TESTE (IHM, modo manual)", teste_feito],
		["Medir a peça com a trena e corrigir (erro ≤ 2 mm)", medida_ok],
		["Proteção dos rolos fechada, modo AUTOMÁTICO e LIGA", rodando],
	]

## estado industrial formal (o que a IHM e os outros sistemas leem)
func fase() -> String:
	if not energia: return "DESENERGIZADA"
	if not chave_geral: return "CHAVE GERAL DESLIGADA"
	if emergencia: return "EMERGÊNCIA"
	if falha != "": return "FALHA: " + falha.to_upper()
	if precisa_reset: return "AGUARDA RESET"
	if not bobina.presente: return "SEM BOBINA"
	if fita in ["presa", "solta", "puxando"]: return "PREPARANDO BOBINA"
	if fita == "na_mesa": return "ENFIANDO"
	if cauda_s >= 0.0: return "FIM DE CHAPA"
	if corte_t > 0.0: return "CORTANDO"
	if rodando: return "PRODUÇÃO"
	if teste_ativo: return "PEÇA TESTE"
	if not ponta_refilada: return "AGUARDA REFILE"
	if not medida_ok: return "AGUARDA APROVAÇÃO DA PEÇA"
	return "PRONTA"

func proxima_etapa() -> String:
	for e in etapas():
		if not e[1] and e[0] != "":
			return e[0]
	return "Produzindo. Fique de olho no chiado, na pilha e na bobina."

# ======================================================================
#  COMANDOS (chamados pela caixa de comando, pelo quadro e pelas interações)
# ======================================================================
func cmd_disjuntor(ligar: bool) -> void:
	energia = ligar
	Som.tocar("trava", self, global_position + Vector3(-8, 1, 2))
	if not ligar:
		_parar_tudo("energia")
	_estado()

func cmd_chave_geral(ligar: bool) -> void:
	if ligar and not energia:
		Bus.aviso.emit("Chave geral sem efeito: o disjuntor da perfiladeira está desligado no quadro.")
		return
	chave_geral = ligar
	if not ligar:
		_parar_tudo("")
		precisa_reset = false
	else:
		precisa_reset = true      # ao energizar, o CLP pede reconhecimento (RESET)
	_estado()

func cmd_emergencia() -> void:
	if not emergencia:
		emergencia = true
		precisa_reset = true
		_parar_tudo("emergencia")
		Som.tocar("emergencia", caixa)
		Bus.emergencia.emit(NOME, true)
		Bus.alarme.emit(NOME, "EMERGÊNCIA ACIONADA")
	else:
		emergencia = false            # girar para destravar
		Som.tocar("click", caixa)
		Bus.emergencia.emit(NOME, false)
		Bus.aviso.emit("Emergência destravada. Aperte RESET para rearmar.")
	_estado()

func cmd_reset() -> void:
	Som.tocar("click", caixa)
	if not chave_geral:
		return
	if emergencia:
		Bus.aviso.emit("RESET recusado: a emergência ainda está travada.")
		return
	if falha == "enrosco" and amassado.visible:
		Bus.aviso.emit("RESET recusado: ainda tem chapa enroscada nos rolos.")
		return
	if falha == "protecao" and not protecao_fechada:
		Bus.aviso.emit("RESET recusado: a proteção dos rolos está aberta.")
		return
	precisa_reset = false
	if falha in ["emergencia", "enrosco", "lote", "mesa_cheia", "fim_bobina", "energia", "protecao"]:
		if falha == "mesa_cheia" and pilha.size() >= MESA_CAP:
			Bus.aviso.emit("Sensor da mesa ainda ocupado: retire a pilha.")
			precisa_reset = true
			return
		if falha == "lote":
			produzidas = 0
		Bus.alarme_resolvido.emit(NOME)
		falha = ""
	_estado()

func pode_mover() -> String:
	if not energia: return "Sem energia (disjuntor)"
	if not chave_geral: return "Chave geral desligada"
	if emergencia: return "Emergência travada"
	if precisa_reset: return "Aperte RESET"
	if falha != "": return "Falha: " + falha
	return ""

func cmd_liga() -> void:
	Som.tocar("click", caixa)
	var p := pode_mover()
	if p != "":
		Bus.aviso.emit("LIGA recusado: " + p); return
	if modo != "auto":
		Bus.aviso.emit("LIGA só funciona no modo AUTOMÁTICO. No manual use AVANÇO LENTO ou PEÇA TESTE."); return
	if fita != "enfiada":
		Bus.aviso.emit("LIGA recusado: a chapa não chegou na guilhotina (passe com AVANÇO LENTO)."); return
	if not protecao_fechada:
		Bus.aviso.emit("LIGA recusado: proteção dos rolos aberta (chave de segurança)."); return
	if cauda_s >= 0.0:
		Bus.aviso.emit("LIGA recusado: fim de chapa. Só AVANÇO LENTO para tirar o resto."); return
	if amarrado_na_saida():
		Bus.aviso.emit("LIGA recusado: tem um amarrado em cima da área da pilha. Tire com a empilhadeira."); return
	if not ponta_refilada or not medida_ok:
		Bus.aviso.emit("LIGA recusado: refile a ponta e aprove a peça teste com a trena antes da produção."); return
	if pilha.size() >= MESA_CAP:
		Bus.aviso.emit("LIGA recusado: sensor da mesa de saída ocupado."); return
	if produzidas >= quantidade:
		Bus.aviso.emit("Lote já concluído. Zere o contador na IHM ou aumente a quantidade."); return
	rodando = true
	sirene_t = T_SIRENE           # sirene + giroflex antes de qualquer movimento
	Som.tocar("sirene", self, global_position + Vector3(-1, 2.2, 1))
	_estado()

func cmd_desliga() -> void:
	Som.tocar("click", caixa)
	rodando = false
	teste_ativo = false
	sirene_t = 0.0
	_estado()

func cmd_modo(m: String) -> void:
	if rodando:
		Bus.aviso.emit("Desligue o ciclo antes de trocar o modo."); return
	modo = m
	Som.tocar("click", caixa)
	_estado()

func cmd_jog(segura: bool) -> void:
	if segura:
		var p := pode_mover()
		if p != "":
			Bus.aviso.emit("AVANÇO LENTO recusado: " + p); return
		if modo != "manual":
			Bus.aviso.emit("AVANÇO LENTO só no modo MANUAL."); return
		if fita not in ["na_mesa", "enfiada"]:
			Bus.aviso.emit("Não tem chapa nos rolos para avançar."); return
		if not bobina.travada:
			Bus.aviso.emit("AVANÇO LENTO recusado: sensor do mandril — bobina destravada."); return
		if cauda_s >= 0.0 and _cauda_x() >= X_E1:
			Bus.aviso.emit("A chapa já saiu dos rolos: retire o retalho com a mão."); return
	jog = segura

func cmd_peca_teste() -> void:
	var p := pode_mover()
	if p != "":
		Bus.aviso.emit("PEÇA TESTE recusada: " + p); return
	if modo != "manual":
		Bus.aviso.emit("PEÇA TESTE é no modo MANUAL."); return
	if fita != "enfiada":
		Bus.aviso.emit("Passe a chapa até a guilhotina antes da peça teste."); return
	if not ponta_refilada:
		Bus.aviso.emit("Refile a ponta primeiro: avance uns 30 cm com AVANÇO LENTO e use CORTE MANUAL."); return
	if not protecao_fechada:
		Bus.aviso.emit("PEÇA TESTE recusada: proteção dos rolos aberta."); return
	if not bobina.travada:
		Bus.aviso.emit("PEÇA TESTE recusada: mandril destravado."); return
	teste_ativo = true
	sirene_t = T_SIRENE * 0.5
	Som.tocar("sirene", self, global_position + Vector3(-1, 2.2, 1), -6.0)
	_estado()

func cmd_cortar_manual() -> void:
	var p := pode_mover()
	if p == "" and modo == "manual" and fita == "enfiada" and peca_m >= 0.25 and corte_t <= 0.0:
		_cortar()
		return
	if fita == "enfiada" and peca_m < 0.25:
		Bus.aviso.emit("Corte manual: avance pelo menos 25 cm de chapa depois da faca (AVANÇO LENTO).")
	else:
		Bus.aviso.emit("Corte manual recusado: %s" % (p if p != "" else "precisa de modo MANUAL e chapa na guilhotina"))

func cmd_zerar() -> void:
	produzidas = 0
	if falha == "lote":
		falha = ""
	_estado()

func ajustar(campo: String, delta_v: float) -> void:
	match campo:
		"comprimento": comprimento = clampf(snappedf(comprimento + delta_v, 0.01), 1.0, 12.0)
		"quantidade": quantidade = clampi(quantidade + int(delta_v), 1, 500)
		"velocidade": velocidade = clampf(snappedf(velocidade + delta_v, 0.05), 0.6, 1.0)
		"correcao": correcao_mm = clampf(correcao_mm + delta_v, -50.0, 50.0)
	Som.tocar("click", caixa, Vector3.ZERO, -10.0)

func _parar_tudo(motivo: String) -> void:
	rodando = false
	jog = false
	teste_ativo = false
	sirene_t = 0.0
	if motivo in ["emergencia", "energia", "protecao"]:
		v = 0.0                    # parada brusca
	if motivo != "":
		falha = motivo

# ======================================================================
#  PASSO DA MÁQUINA — usa o relógio industrial (acelera junto com x5/x20)
# ======================================================================
func _physics_process(delta: float) -> void:
	var dt := Relogio.dt_industrial(delta)
	if dt <= 0.0:
		return
	if sirene_t > 0.0:
		sirene_t -= dt
	var alvo := 0.0
	var ok := pode_mover() == ""
	if ok and corte_t <= 0.0 and sirene_t <= 0.0:
		if jog and bobina.travada and not (cauda_s >= 0.0 and _cauda_x() >= X_E1):
			alvo = V_JOG
		elif (rodando or teste_ativo) and fita == "enfiada" and protecao_fechada:
			alvo = V_REAL * FATOR_VISUAL * velocidade
	if not ok:
		alvo = 0.0
	# rampa de aceleração (0,8 m/s²) e parada da guilhotina instantânea
	var acel := 0.8 * dt
	v = clampf(alvo, v - acel, v + acel) if corte_t <= 0.0 else 0.0
	if corte_t > 0.0:
		corte_t -= dt
	var ds := v * dt
	if ds > 0.0:
		_avancar(_limitar(ds), dt)
	# sem freio, quando a linha desacelera a bobina embala e solta chapa a mais (barriga)
	var v_ant := _v_ant
	_v_ant = v
	if not freio_ok and bobina.presente and v < v_ant and fita in ["na_mesa", "enfiada"]:
		var antes := barriga_m
		barriga_m = minf(0.6, barriga_m + (v_ant - v) * 0.9)
		if antes < 0.15 and barriga_m >= 0.15:
			Bus.aviso.emit("A bobina embalou e fez BARRIGA de chapa: ajuste o freio do desbobinador!")
	# energia: motor em vazio 15% ligado, 100% formando. 1 h de jogo = 72 s reais.
	if energia and chave_geral:
		var kw := KW * (1.0 if v > 0.01 else 0.15)
		var kwh := kw * dt / 72.0
		energia_kwh += kwh
		Bus.energia_consumida.emit(kwh)
	_enrosco_iminente(dt)
	_deslizar(dt)
	_atualizar_visual(dt)

var _v_ant := 0.0
var _fim_reconhecido := false
## o encoder para a linha no ponto exato: nunca passa do comprimento (nem no x20)
func _limitar(ds: float) -> float:
	var r := ds
	if fita == "na_mesa" and cabeca < X_CORTE:
		r = minf(r, X_CORTE - cabeca)
	if fita == "enfiada" and (rodando or teste_ativo):
		r = minf(r, maxf(_alvo_corte() - peca_m, 0.0))
	if cauda_s >= 0.0 and not _fim_reconhecido and _cauda_x() < X_SENSOR_FIM:
		r = minf(r, X_SENSOR_FIM - _cauda_x())
	return r

func _avancar(ds: float, dt: float) -> void:
	if ds <= 0.0:
		if fita == "enfiada" and (rodando or teste_ativo) and peca_m >= _alvo_corte() - 0.00001:
			_cortar()
		return
	# 1) material sai da bobina (ou a cauda anda depois que ela acabou)
	if cauda_s < 0.0:
		# o trecho bobina→mesa muda de comprimento conforme o raio diminui: entra na conta
		var c := _comp_alimentacao()
		var usa := minf(ds + (c - _comp_ult), bobina.metros)
		_comp_ult = c
		bobina.metros -= usa
		consumido_m += usa
		if not aviso_10 and bobina.metros < bobina.metros_total * 0.10:
			aviso_10 = true
			Som.tocar("bip", caixa)
			Bus.bobina_acabando.emit(NOME, bobina.metros)
			Bus.aviso.emit("Bobina com 10%% (%.0f m). Prepare a próxima." % bobina.metros)
		if bobina.metros <= 0.0:
			cauda_s = maxf(0.0, ds - usa)
			Bus.aviso.emit("Fim da bobina: a ponta final está passando pela máquina.")
	else:
		cauda_s += ds
	# 2) a chapa anda dentro da máquina
	if fita == "na_mesa":
		cabeca += ds
		if cabeca >= X_CORTE - 0.00001:
			cabeca = X_CORTE
			fita = "enfiada"
			jog = false
			Som.tocar("bip", caixa)
			Bus.aviso.emit("Chapa chegou no sensor da guilhotina. Ajuste as guias e faça a peça teste.")
			Bus.procedimento.emit(NOME, "enfiada", true)
	elif fita == "enfiada":
		peca_m += ds
		if (rodando or teste_ativo) and peca_m >= _alvo_corte() - 0.00001:
			_cortar()
	if barriga_m > 0.0:
		barriga_m = maxf(0.0, barriga_m - ds * 0.5)
	# 3) desgaste, graxa e aviso para os outros sistemas
	var secura := _secura()
	desgaste = minf(1.0, desgaste + ds * 0.00002 * (1.0 + secura * 2.5))
	for i in graxa.size():
		graxa[i] = maxf(0.0, graxa[i] - ds / 350.0)
	Bus.metros_formados.emit(NOME, ds)
	# 4) risco de enrosco (o chiado sobe antes — dá tempo de apertar a emergência)
	if fita == "enfiada" and enrosco_iminente <= 0.0 and enrosco_aleatorio:
		var risco := 0.00025 * (1.0 + barriga_m * 8.0) * (1.0 + desgaste * 5.0) * (1.0 + secura * 2.0) * (1.0 + maxf(0.0, absf(desvio_mm) - 8.0) / 4.0) * (1.6 if folga_mm > 6.0 else 1.0) * (1.4 if velocidade > 0.9 else 1.0)
		if rng.randf() < risco * ds:
			enrosco_iminente = 3.0
			enrosco_x = X_E0 + PASSO * rng.randi_range(2, N_EST - 2)
	# 5) sensor de fim de chapa na entrada: a cauda passou → para tudo e avisa
	if cauda_s >= 0.0 and not _fim_reconhecido and _cauda_x() >= X_SENSOR_FIM - 0.0001:
		_fim_reconhecido = true
		_parar_tudo("fim_bobina")
		precisa_reset = true
		Som.tocar("buzina", self, global_position + Vector3(0, 2, 1))
		Bus.bobina_acabou.emit(NOME)
		Bus.alarme.emit(NOME, "FIM DE CHAPA — RESET, AVANÇO LENTO para tirar o resto e retire o retalho")
		_estado()

func _alvo_corte() -> float:
	return comprimento + correcao_mm / 1000.0 + erro_encoder_mm / 1000.0 + desgaste * 0.003

func _secura() -> float:
	var s := 0.0
	for g in graxa:
		s += 1.0 - g
	return s / graxa.size()

func _cauda_x() -> float:
	if cauda_s < 0.0:
		return -100.0
	return X_ENTRADA + cauda_s - _comp_alimentacao()

func _comp_alimentacao() -> float:
	var r := raio_bobina()
	var t := _tangente(r)
	return Vector2(X_ENTRADA, Y_PASSE).distance_to(t)

func _enrosco_iminente(dt: float) -> void:
	if enrosco_iminente <= 0.0:
		return
	if v <= 0.01:
		# parou a tempo (emergência/desliga): salvou a chapa
		enrosco_iminente = 0.0
		Bus.aviso.emit("Parou a tempo! A chapa estava começando a encavalar.")
		return
	enrosco_iminente -= dt
	if enrosco_iminente <= 0.0:
		_enroscar()

func _enroscar() -> void:
	_parar_tudo("enrosco")
	v = 0.0
	precisa_reset = true
	amassado.position = Vector3(enrosco_x, Y_PASSE + 0.12, 0)
	amassado.visible = true
	Som.tocar("bang", self, global_position + Vector3(enrosco_x, 1, 0), 4.0)
	Bus.enrosco.emit(NOME, enrosco_x)
	Bus.alarme.emit(NOME, "ENROSCO na estação %d" % [int(round((enrosco_x - X_E0) / PASSO)) + 1])
	_estado()

func limpar_enrosco() -> void:
	# chapa cortada no ponto do enrosco: o que estava depois vira sucata e é preciso passar de novo
	# corta-se a chapa 40 cm antes do enrosco: tudo dali até a faca (e o que passou dela) vira sucata
	var novo := enrosco_x - 0.4
	sucata_m += (X_CORTE - novo) + peca_m
	peca_m = 0.0
	amassado.visible = false
	cabeca = novo
	fita = "na_mesa"
	ponta_refilada = false
	teste_feito = false
	medida_ok = false
	Bus.aviso.emit("Enrosco cortado. Aperte RESET e passe a chapa de novo com AVANÇO LENTO.")
	_estado()

# ======================================================================
#  CORTE E PILHA
# ======================================================================
func _cortar() -> void:
	var L := peca_m
	peca_m = 0.0
	corte_t = T_CORTE
	_thoc_tocado = false
	Som.tocar("hidraulica_pulso" if Som.bancos.has("hidraulica_pulso") else "click", self, global_position + Vector3(X_CORTE, 1.1, 0), -4.0)
	if not ponta_refilada:
		# refile: a ponta amassada da bobina vai para o tambor de sucata (não conta como telha)
		ponta_refilada = true
		sucata_m += L
		var r := MeshInstance3D.new()
		r.mesh = _malha_telha(L, 0.0, 0.0)
		r.material_override = _mat_chapa
		r.position = Vector3(X_CORTE, Y_PASSE, 0)
		add_child(r)
		deslizando.append({"no": r, "L": L, "curva": 0.0, "assim": 0.0, "defeito": "refile", "fase": 0, "t": 0.0, "sucata": true, "preso": true})
		Bus.peca_cortada.emit(NOME, L, "refile")
		Bus.aviso.emit("Ponta refilada (%.2f m para a sucata). Agora a PEÇA TESTE." % L)
		_estado()
		return
	# defeitos que se veem: guia fora de centro entorta (camber), folga deixa a chapa "nadar",
	# cassete gasto deixa o perfil assimétrico
	var curva := (desvio_mm / 1000.0) * 0.18 * L + (rng.randf_range(-1, 1) * (folga_mm - 3.0) * 0.0006 * L if folga_mm > 3.0 else 0.0)
	var assim := clampf((desgaste - 0.35) * 1.6, 0.0, 1.0) if not PLANO else 0.0
	# endireitador fora do ponto: pouca penetração deixa a "memória" da bobina (chapa arqueada),
	# penetração demais arqueia para o outro lado
	arco_m = (PENETRACAO_IDEAL - penetracao_mm) * 0.004 * L if TEM_ENDIREITADOR else 0.0
	var erro_mm := (L - comprimento) * 1000.0
	var defeito := ""
	if absf(erro_mm) > 5.0: defeito = "medida"
	if absf(curva) > 0.004: defeito = "torta"
	if assim > 0.3: defeito = "perfil"
	if absf(arco_m) > 0.004: defeito = "memoria"
	var no := MeshInstance3D.new()
	no.mesh = _malha_telha(L, curva, assim)
	no.material_override = _mat_chapa
	no.position = Vector3(X_CORTE, Y_PASSE, desvio_mm / 1000.0 * 0.3)
	add_child(no)
	deslizando.append({"no": no, "L": L, "curva": curva, "assim": assim, "arco": arco_m, "defeito": defeito, "fase": 0, "t": 0.0, "preso": true})
	produzidas += 1
	if teste_ativo:
		teste_ativo = false
		teste_feito = true
		Bus.aviso.emit("Peça teste cortada. Meça com a trena na pilha.")
	Bus.peca_cortada.emit(NOME, L, defeito)
	if rodando and produzidas >= quantidade:
		rodando = false
		falha = "lote"
		Som.tocar("buzina", self, global_position + Vector3(0, 2, 1), -4.0)
		Bus.aviso.emit("Lote concluído: %d %s de %.2f m." % [produzidas, PECAS, comprimento])
	_estado()

var TAMBOR := Vector3(5.6, 0.0, 1.35)
var _thoc_tocado := true

func _malha_telha(L: float, curva: float, assim: float) -> ArrayMesh:
	var k := "%d_%d_%d_%d" % [int(L * 1000), int(curva * 1000), int(assim * 10), int(arco_m * 1000)]
	if not _cache_telha.has(k):
		_cache_telha[k] = Perfil.malha_chapa(L, curva, arco_m) if PLANO else Perfil.malha_telha(L, curva, assim)
	return _cache_telha[k]

func _deslizar(dt_ind: float) -> void:
	for i in range(deslizando.size() - 1, -1, -1):
		var d: Dictionary = deslizando[i]
		var no: MeshInstance3D = d.no
		if d.get("preso", false):
			# o pisador segura a peça até a lâmina subir (sensor de lâmina em cima)
			if corte_t > T_CORTE * 0.15:
				continue
			d.preso = false
		if d.get("sucata", false):
			# retalho escorrega da mesa e cai no tambor de sucata ao lado
			d.t += dt_ind
			var k := clampf(d.t / 0.8, 0.0, 1.0)
			no.position = Vector3(X_CORTE, Y_PASSE, 0).lerp(TAMBOR + Vector3(-d.L * 0.5, 0.5, 0), k)
			no.rotation.z = -k * 1.2
			if k >= 1.0:
				Som.tocar("clank", null, global_position + TAMBOR, -4.0)
				no.queue_free()
				deslizando.remove_at(i)
			continue
		if d.fase == 0:
			# desliza sobre o apoio de rolos até a traseira passar do fim do apoio
			no.position.x += 1.6 * dt_ind
			var xp := _x_pilha(d.L)
			if no.position.x >= xp:
				no.position.x = xp
				d.fase = 1
				d.t = 0.0
		else:
			# cai na pilha (encaixa por cima da anterior)
			d.t += dt_ind
			var y_alvo := Y_PILHA0 + pilha.size() * NINHO + 0.002
			no.position.y = lerpf(maxf(Y_PASSE, y_alvo), y_alvo, clampf(d.t / 0.25, 0.0, 1.0))
			if d.t >= 0.25:
				no.position.y = y_alvo
				Som.tocar("clank", self, global_position + Vector3(_x_pilha(d.L) + d.L * 0.5, Y_PILHA0, 0), -2.0)
				no.position.z += rng.randf_range(-0.003, 0.003)     # alinhadas pelas guias, mas não perfeitas
				pilha.append({"L": d.L, "curva": d.curva, "assim": d.assim, "arco": d.get("arco", 0.0), "defeito": d.defeito})
				pilha_nos.append(no)
				deslizando.remove_at(i)
				Bus.peca_na_pilha.emit(NOME, pilha.size())
				if pilha.size() >= MESA_CAP and rodando:
					_parar_tudo("mesa_cheia")
					precisa_reset = true
					Bus.alarme.emit(NOME, "MESA CHEIA (sensor de presença)")
					_estado()

func retirar_pilha() -> int:
	var n := pilha.size()
	for t in pilha:
		estoque_retirado_m += t.L
	for no in pilha_nos:
		no.queue_free()
	pilha_nos.clear()
	pilha.clear()
	estoque_retirado += n
	return n

func medir_trena() -> Dictionary:
	if pilha.is_empty():
		return {}
	var t: Dictionary = pilha[pilha.size() - 1]
	var erro: float = (t.L - comprimento) * 1000.0
	ultima_medida = {"L": t.L, "erro_mm": erro, "curva_mm": t.curva * 1000.0, "arco_mm": t.get("arco", 0.0) * 1000.0}
	trena_no.visible = true
	var top := Y_PILHA0 + pilha.size() * NINHO + 0.05
	trena_no.position = Vector3(_x_pilha(t.L), top, 0.47)
	trena_no.scale = Vector3(t.L, 1, 1)
	(trena_no.get_child(1) as Label3D).text = "%.3f m" % t.L
	(trena_no.get_child(1) as Label3D).scale = Vector3(1.0 / t.L, 1, 1)
	if absf(erro) <= 2.0 and absf(t.curva) * 1000.0 <= 3.0 and absf(t.get("arco", 0.0)) * 1000.0 <= 3.0:
		medida_ok = true
		if not perfeita_dada and absf(desvio_mm) <= 2.0 and folga_mm <= 3.0:
			perfeita_dada = true
			Bus.conquista.emit("PRIMEIRA %s PERFEITA!" % NOME_PECA, "%.3f m na trena, sem torção. Agora é produção." % t.L)
	return ultima_medida

# ======================================================================
#  VISUAL
# ======================================================================
func raio_bobina() -> float:
	if not bobina.presente:
		return R_FURO
	return sqrt(R_FURO * R_FURO + maxf(bobina.metros, 0.0) * ESPESSURA / PI)

func _tangente(r: float) -> Vector2:
	# ponto de tangência por baixo da bobina, olhando da entrada da mesa
	var c := Vector2(X_DESB, Y_DESB)
	var e := Vector2(X_ENTRADA, Y_PASSE)
	var d := c - e
	var dl := d.length()
	var ang := atan2(d.y, d.x) + asin(minf(1.0, r / dl))
	var tl := sqrt(maxf(dl * dl - r * r, 0.0))
	return e + Vector2(cos(ang), sin(ang)) * tl

var _r_malha := 0.0
func _atualizar_visual(dt: float) -> void:
	var r := raio_bobina()
	# bobina: raio real pelo que sobrou (largura não muda), gira com a chapa
	bobina_grp.visible = bobina.presente
	if absf(r - _r_malha) > 0.0008:
		_r_malha = r
		(bobina_malha.mesh as CylinderMesh).top_radius = r
		(bobina_malha.mesh as CylinderMesh).bottom_radius = r
		for c in cintas:
			(c.mesh as TorusMesh).inner_radius = r
			(c.mesh as TorusMesh).outer_radius = r + 0.008
	var dsv := v * dt
	if bobina.presente and cauda_s < 0.0 and fita in ["na_mesa", "enfiada"]:
		bobina_grp.rotation.z -= dsv / r
	if mandril:
		mandril.rotation.z = bobina_grp.rotation.z
	for c in cintas:
		c.visible = bobina.cinta and bobina.presente
	# fita de alimentação (bobina → mesa), ou presa na mão quando o jogador puxa a ponta
	var t := _tangente(r)
	var e := Vector2(X_ENTRADA, Y_PASSE)
	var ini := t
	var fim := e
	var mostra := false
	if fita == "puxando":
		fim = Vector2(ponta_mao.x, ponta_mao.y)
		mostra = true
	elif fita in ["na_mesa", "enfiada"]:
		mostra = true
		if cauda_s >= 0.0:
			var resta := _comp_alimentacao() - cauda_s
			if resta <= 0.0:
				mostra = false
			else:
				ini = e + (t - e).normalized() * resta
	elif fita == "solta":
		# ponta pendurada uns 40 cm abaixo da bobina
		ini = Vector2(X_DESB + r * 0.87, Y_DESB - r * 0.5)
		fim = Vector2(X_DESB + r + 0.12, Y_DESB - r - 0.5)
		mostra = true
	fita_alim.visible = mostra and bobina.presente or (mostra and cauda_s >= 0.0)
	fita_alim2.visible = fita_alim.visible
	if fita_alim.visible:
		var zf := desvio_mm / 1000.0 if fita != "puxando" else clampf(ponta_mao.z, -0.6, 1.2) * 0.5
		# barriga: o meio da chapa cai (sem freio a bobina solta chapa a mais)
		var meio := (ini + fim) * 0.5 - Vector2(0, barriga_m * 0.55 if fita in ["na_mesa", "enfiada"] else 0.0)
		_segmento(fita_alim, ini, meio, zf)
		_segmento(fita_alim2, meio, fim, zf)
	# fita dentro da máquina: shader corta na ponta (cabeça) e no fim (cauda)
	var cab := cabeca if fita in ["na_mesa", "enfiada"] else X_ENTRADA - 1.0
	fita_mat.set_shader_parameter("cabeca", cab)
	fita_mat.set_shader_parameter("cauda", _cauda_x())
	fita_mat.set_shader_parameter("desvio", desvio_mm / 1000.0)
	fita_malha.visible = fita in ["na_mesa", "enfiada"]
	# telha crescendo depois do corte
	peca_malha.visible = fita == "enfiada" and peca_m > 0.005
	if peca_malha.visible:
		peca_malha.scale.x = peca_m
	# tampa de proteção abre/fecha (articulada no lado de trás)
	_tampa_ang = move_toward(_tampa_ang, 0.0 if protecao_fechada else 1.6, dt * 2.5 / maxf(Relogio.vel, 1))
	tampa.rotation.x = -_tampa_ang
	alav_mandril.rotation.z = -1.2 if bobina.travada else 0.0
	for rg in reguas:
		var p0: Vector3 = rg[1]
		var dir := Vector3(p0.x, p0.y, 0.0).normalized()
		(rg[0] as Node3D).position = p0 + dir * (0.008 if bobina.travada else 0.0)
	volante_freio.rotation.z = -2.0 if freio_ok else 0.0
	# rolos giram só onde tem chapa puxando; todos estão engrenados pela corrente
	if dsv > 0.0:
		for rl in rolos_inf:
			if rl: rl.rotation.z -= dsv / R_INF
		for rl in rolos_sup:
			if rl: rl.rotation.z += dsv / R_SUP
	# guilhotina: pisador desce → lâmina desce (THOC no fundo) → lâmina sobe → pisador sobe
	var tt := 1.0 - corte_t / T_CORTE if corte_t > 0.0 else 1.0
	var kl := 0.0
	var kp := 0.0
	if corte_t > 0.0:
		kp = clampf(tt / 0.17, 0.0, 1.0) if tt < 0.83 else clampf((1.0 - tt) / 0.17, 0.0, 1.0)
		if tt >= 0.17 and tt < 0.5:
			kl = (tt - 0.17) / 0.33
		elif tt >= 0.5 and tt < 0.83:
			kl = 1.0 - (tt - 0.5) / 0.33
		if tt >= 0.5 and not _thoc_tocado:
			_thoc_tocado = true
			Som.tocar("thoc", null, global_position + Vector3(X_CORTE, 1.3, 0), 3.0)
	lamina_em_cima = kl < 0.02
	if lamina:
		lamina.position.y = Y_LAMINA - LAMINA_CURSO * kl
	pisador.position.y = Y_PISADOR - PISADOR_CURSO * kp
	# guias: centro deslocado e folga visíveis
	for g in guias:
		var no: Node3D = g[0]
		no.position.z = g[2] + desvio_mm / 1000.0 + g[1] * (folga_mm / 1000.0 - 0.0)
	# sons: motor sempre que energizado, rolos com chapa andando, chiado = secura × desgaste (e enrosco chegando)
	var energizada := energia and chave_geral
	som_motor.volume_db = -14.0 + (6.0 if v > 0.01 else 0.0) if energizada else -80.0
	som_motor.pitch_scale = 0.85 + 0.3 * clampf(v / 0.6, 0.0, 1.0)
	som_rolos.volume_db = linear_to_db(clampf(v / 0.6, 0.0, 1.0) * 0.7 + 0.0001)
	var ch := (_secura() * 0.6 + desgaste * 0.5) * clampf(v / 0.3, 0.0, 1.0)
	if enrosco_iminente > 0.0:
		ch = 1.0 + (3.0 - enrosco_iminente)
	som_chiado.volume_db = linear_to_db(clampf(ch, 0.0, 2.0) * 0.5 + 0.0001)
	som_hidr.volume_db = -18.0 if energizada else -80.0
	# faíscas da esmerilhadeira (ligadas pela interação)
	_atualizar_torre()

func _segmento(no: MeshInstance3D, a: Vector2, b: Vector2, z: float) -> void:
	var dd := b - a
	no.position = Vector3((a.x + b.x) * 0.5, (a.y + b.y) * 0.5, z)
	no.rotation.z = atan2(dd.y, dd.x)
	no.scale.x = maxf(dd.length(), 0.01)

func _atualizar_torre() -> void:
	var cor := ""
	var piscar := false
	if not (energia and chave_geral):
		cor = ""
	elif emergencia or falha == "enrosco" or falha == "emergencia":
		cor = "vermelha"; piscar = true
	elif falha in ["fim_bobina", "mesa_cheia", "energia", "protecao"] or precisa_reset:
		cor = "ambar"; piscar = precisa_reset
	elif sirene_t > 0.0:
		cor = "ambar"; piscar = true          # giroflex: vai partir, saia da linha
	elif v > 0.01:
		cor = "verde"
	elif falha == "lote":
		cor = "verde"; piscar = true
	else:
		cor = "ambar"
	if aviso_10 and cor == "verde" and bobina.metros > 0.0:
		piscar = true
	caixa.torre(cor, piscar)

func _estado() -> void:
	var e := "desligada"
	if energia and chave_geral:
		e = "produzindo" if rodando else ("falha:" + falha if falha != "" else "pronta")
	Bus.estado_maquina.emit(NOME, e)

# ======================================================================
#  MONTAGEM DOS NÓS
# ======================================================================
func _montar_bobina_visual() -> void:
	bobina_grp = Node3D.new()
	bobina_grp.position = Vector3(X_DESB, Y_DESB, 0)
	add_child(bobina_grp)
	bobina_malha = MeshInstance3D.new()
	var cm := CylinderMesh.new()
	cm.height = 1.2
	cm.radial_segments = 48
	cm.top_radius = 0.31
	cm.bottom_radius = 0.31
	bobina_malha.mesh = cm
	bobina_malha.rotation.x = PI / 2
	bobina_malha.material_override = Perfil.material_bobina()
	bobina_grp.add_child(bobina_malha)
	bobina_furo = MeshInstance3D.new()
	var fm := CylinderMesh.new()
	fm.height = 1.205
	fm.top_radius = R_FURO
	fm.bottom_radius = R_FURO
	bobina_furo.mesh = fm
	bobina_furo.rotation.x = PI / 2
	var mf := StandardMaterial3D.new()
	mf.albedo_color = Color(0.16, 0.17, 0.19)
	bobina_furo.material_override = mf
	bobina_grp.add_child(bobina_furo)
	# cintas de aço azuis (3 voltas) — só saem com o corta-cinta
	var mc := StandardMaterial3D.new()
	mc.albedo_color = Color(0.20, 0.33, 0.48)
	mc.metallic = 0.3
	for z in [-0.42, 0.0, 0.42]:
		var c := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = 0.31
		tm.outer_radius = 0.318
		tm.rings = 32
		tm.ring_segments = 4
		c.mesh = tm
		c.rotation.x = PI / 2
		c.position.z = z
		c.material_override = mc
		bobina_grp.add_child(c)
		cintas.append(c)

func _montar_fita() -> void:
	# alimentação: placa fina de 1,20 m de largura, escalada no comprimento
	fita_alim = MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(1.0, 0.0015, 1.2)
	fita_alim.mesh = bm
	fita_alim.material_override = _mat_chapa
	add_child(fita_alim)
	fita_alim2 = MeshInstance3D.new()
	fita_alim2.mesh = bm
	fita_alim2.material_override = _mat_chapa
	add_child(fita_alim2)
	# fita formando (uma malha só; o shader esconde o que ainda não chegou)
	fita_malha = MeshInstance3D.new()
	fita_malha.mesh = Perfil.malha_fita(X_ENTRADA, X_CORTE, X_E0, X_E1, 0.08, PLANO)
	fita_mat = Perfil.material_fita()
	fita_mat.set_shader_parameter("x_rolos", X_E0)
	fita_malha.material_override = fita_mat
	fita_malha.position.y = Y_PASSE
	add_child(fita_malha)
	# telha crescendo depois da contra-faca (malha de 1 m escalada)
	peca_malha = MeshInstance3D.new()
	peca_malha.mesh = Perfil.malha_chapa(1.0) if PLANO else Perfil.malha_telha(1.0)
	peca_malha.material_override = _mat_chapa
	peca_malha.position = Vector3(X_CORTE, Y_PASSE, 0)
	add_child(peca_malha)
	# chapa amassada do enrosco (sanfona de chapa)
	amassado = MeshInstance3D.new()
	var st := SurfaceTool.new()
	st.begin(Mesh.PRIMITIVE_TRIANGLES)
	var n := 14
	for i in n:
		var a := float(i) / n
		var x0 := -0.45 + a * 0.9
		var x1 := x0 + 0.9 / n
		var y0 := (0.0 if i % 2 == 0 else 0.22) * (1.0 - absf(a - 0.5))
		var y1 := (0.22 if i % 2 == 0 else 0.0) * (1.0 - absf(a + 1.0 / n - 0.5))
		for p in [[x0, y0, -0.55], [x1, y1, -0.55], [x1, y1, 0.55], [x0, y0, -0.55], [x1, y1, 0.55], [x0, y0, 0.55]]:
			st.add_vertex(Vector3(p[0], p[1], p[2]))
	st.generate_normals()
	amassado.mesh = st.commit()
	amassado.material_override = _mat_chapa
	amassado.visible = false
	add_child(amassado)

var pisador: MeshInstance3D
func _montar_pisador_e_tambor() -> void:
	pisador = MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(0.05, 0.03, 1.15)
	pisador.mesh = bm
	var mp := StandardMaterial3D.new()
	mp.albedo_color = Color(0.2, 0.2, 0.22)
	mp.metallic = 0.6
	pisador.material_override = mp
	pisador.position = Vector3(X_CORTE - 0.1, Y_PISADOR, 0)
	add_child(pisador)
	var tambor := MeshInstance3D.new()
	var cy := CylinderMesh.new()
	cy.top_radius = 0.29
	cy.bottom_radius = 0.29
	cy.height = 0.88
	tambor.mesh = cy
	var mt := StandardMaterial3D.new()
	mt.albedo_color = Color(0.25, 0.32, 0.45)
	mt.metallic = 0.4
	tambor.material_override = mt
	tambor.position = TAMBOR + Vector3(0, 0.44, 0)
	add_child(tambor)
	var lb := Label3D.new()
	lb.text = "SUCATA"
	lb.font_size = 40
	lb.pixel_size = 0.004
	lb.position = TAMBOR + Vector3(0, 0.5, 0.3)
	lb.modulate = Color(1, 1, 1)
	add_child(lb)

func _montar_pontaletes() -> void:
	if X_BATENTE > 0.0:
		return            # a pilha fica na própria mesa de saída, contra o batente
	# batente de fim e guias laterais da pilha (as telhas encostam aqui e saem alinhadas)
	var mg := StandardMaterial3D.new()
	mg.albedo_color = Color(0.85, 0.65, 0.1)
	mg.metallic = 0.3
	for lado in [-1.0, 1.0]:
		for xx in [X_PILHA + 0.6, X_PILHA + 2.6, X_PILHA + 4.6]:
			var g := MeshInstance3D.new()
			var gb := BoxMesh.new()
			gb.size = Vector3(0.05, 0.6, 0.05)
			g.mesh = gb
			g.material_override = mg
			g.position = Vector3(xx, 0.3, lado * 0.585)
			add_child(g)
	var mm := StandardMaterial3D.new()
	mm.albedo_color = Color(0.55, 0.40, 0.25)
	for i in 7:
		var p := MeshInstance3D.new()
		var b := BoxMesh.new()
		b.size = Vector3(0.08, 0.08, 1.2)
		p.mesh = b
		p.material_override = mm
		p.position = Vector3(X_PILHA + 0.2 + i * 1.0, 0.04, 0)
		add_child(p)

func _montar_manivelas() -> void:
	# duas manivelas na lateral do operador da mesa de entrada: centro das guias e aperto (folga)
	var mm := StandardMaterial3D.new()
	mm.albedo_color = Color(0.95, 0.78, 0.2)
	for i in 2:
		var g := Node3D.new()
		g.position = Vector3(X_MESA - 0.2 + i * 0.4, 0.86, MANIVELA_Z)
		add_child(g)
		var roda := MeshInstance3D.new()
		var tm := TorusMesh.new()
		tm.inner_radius = 0.07
		tm.outer_radius = 0.085
		roda.mesh = tm
		roda.rotation.x = PI / 2
		roda.material_override = mm
		g.add_child(roda)
		var cabo := MeshInstance3D.new()
		var cy := CylinderMesh.new()
		cy.top_radius = 0.012
		cy.bottom_radius = 0.012
		cy.height = 0.09
		cabo.mesh = cy
		cabo.rotation.x = PI / 2
		cabo.position = Vector3(0.07, 0, 0.045)
		cabo.material_override = mm
		g.add_child(cabo)
		var rot := Label3D.new()
		rot.text = "CENTRO" if i == 0 else "APERTO"
		rot.font_size = 28
		rot.pixel_size = 0.0015
		rot.position = Vector3(0, -0.12, 0.02)
		g.add_child(rot)
		manivelas.append(g)
	# régua milimetrada na mesa de entrada (o operador lê o desvio aqui)
	var regua := Label3D.new()
	regua.text = "|....|....|....|....|0|....|....|....|....|"
	regua.font_size = 40
	regua.pixel_size = 0.0012
	regua.rotation.x = -PI / 2
	regua.position = Vector3(X_MESA, 0.885, 0.0)
	regua.rotation.y = PI / 2
	add_child(regua)

var graxeiras: Array = []
func _montar_graxeiras() -> void:
	var mg := StandardMaterial3D.new()
	mg.albedo_color = Color(0.98, 0.82, 0.1)
	mg.emission_enabled = true
	mg.emission = Color(0.3, 0.25, 0.0)
	if GRAXEIRAS_X.is_empty():
		for i in 6:
			GRAXEIRAS_X.append(X_E0 + (1 + i * 2) * PASSO)
	for x in GRAXEIRAS_X:
		var g := MeshInstance3D.new()
		var cy := CylinderMesh.new()
		cy.top_radius = 0.012
		cy.bottom_radius = 0.016
		cy.height = 0.035
		g.mesh = cy
		g.rotation.x = PI / 2
		g.position = Vector3(x, GRAXEIRA_Y, GRAXEIRA_Z)
		g.material_override = mg
		add_child(g)
		graxeiras.append(g)
	while graxa.size() < graxeiras.size():
		graxa.append(0.4)
	graxa.resize(graxeiras.size())

func _montar_colisao() -> void:
	var corpo := StaticBody3D.new()
	add_child(corpo)
	for b in COLISAO:
		var cs := CollisionShape3D.new()
		var bs := BoxShape3D.new()
		bs.size = b[1]
		cs.shape = bs
		cs.position = b[0]
		corpo.add_child(cs)

func _montar_trena() -> void:
	trena_no = Node3D.new()
	var fita_t := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(1.0, 0.002, 0.025)
	fita_t.mesh = bm
	fita_t.position.x = 0.5
	var mt := StandardMaterial3D.new()
	mt.albedo_color = Color(1.0, 0.85, 0.05)
	mt.emission_enabled = true
	mt.emission = Color(0.4, 0.33, 0.0)
	fita_t.material_override = mt
	trena_no.add_child(fita_t)
	var lb := Label3D.new()
	lb.font_size = 64
	lb.pixel_size = 0.004
	lb.billboard = BaseMaterial3D.BILLBOARD_ENABLED
	lb.position = Vector3(0.5, 0.25, 0)
	lb.modulate = Color(1, 0.9, 0.2)
	lb.outline_size = 12
	trena_no.add_child(lb)
	trena_no.visible = false
	add_child(trena_no)

func _criar_faiscas() -> CPUParticles3D:
	var f := CPUParticles3D.new()
	f.emitting = false
	f.amount = 80
	f.lifetime = 0.45
	f.explosiveness = 0.0
	f.direction = Vector3(0, 0.6, 1)
	f.spread = 35.0
	f.initial_velocity_min = 2.0
	f.initial_velocity_max = 4.0
	f.gravity = Vector3(0, -9.8, 0)
	f.scale_amount_min = 0.01
	f.scale_amount_max = 0.02
	var m := SphereMesh.new()
	m.radius = 0.5
	m.height = 1.0
	var mat := StandardMaterial3D.new()
	mat.albedo_color = Color(1.0, 0.7, 0.2)
	mat.emission_enabled = true
	mat.emission = Color(1.0, 0.6, 0.1)
	mat.emission_energy_multiplier = 3.0
	m.material = mat
	f.mesh = m
	return f

# ======================================================================
#  INTERAÇÕES FÍSICAS (cada uma no seu lugar da máquina)
# ======================================================================
var _i_enrosco: Interagivel

func _interacoes() -> void:
	Interagivel.criar(self, Vector3(X_DESB + 0.2, 1.0, 0.9), _txt_bobina, _faz_bobina, 1.8)
	Interagivel.criar(self, Vector3(X_MESA, 0.95, 0.85), _txt_mesa, _faz_mesa, 1.4)
	var xp := _x_pilha(COMPRIMENTO_PADRAO)
	Interagivel.criar(self, Vector3(xp + 1.0, Y_PILHA0 + 0.5, 0.9), _txt_trena, _faz_trena, 2.0)
	Interagivel.criar(self, Vector3(xp + COMPRIMENTO_PADRAO * 0.8, Y_PILHA0 + 0.5, 0.9), _txt_retirar, _faz_retirar, 2.5)
	for i in graxeiras.size():
		Interagivel.criar(self, graxeiras[i].position + Vector3(0, -0.2, 0.25), _txt_graxa.bind(i), _faz_graxa.bind(i), 1.0)
	_i_enrosco = Interagivel.criar(self, Vector3(0, 1.0, 0.95), _txt_enrosco, _faz_enrosco, 2.2)

# --- bobina: cortar cinta, pegar a ponta, montar bobina nova ---
func _txt_bobina() -> String:
	if bobina.presente and bobina.cinta:
		return "Cortar as cintas da bobina (alicate corta-cinta)"
	if bobina.presente and fita == "solta":
		return "Pegar a ponta da chapa e puxar até a mesa de entrada"
	if fita == "puxando":
		return "Soltar a ponta (volta a ficar pendurada)"
	return ""

func _sem_epi(acao: String) -> bool:
	if Interacoes.epi:
		return false
	Bus.aviso.emit("SEM EPI: %s sem luva e óculos não. Vista o EPI no armário." % acao)
	return true

func _faz_bobina() -> void:
	if (bobina.presente and (bobina.cinta or fita == "solta")) and _sem_epi("mexer em chapa"):
		return
	if bobina.presente and bobina.cinta and not bobina.travada:
		Bus.aviso.emit("Trave o mandril antes de cortar a cinta: a bobina solta pode rolar.")
		return
	if bobina.presente and bobina.cinta:
		Interacoes.progresso("Cortando as cintas...", 1.6, func():
			bobina.cinta = false
			fita = "solta"
			Som.tocar("tlec", null, global_position + Vector3(X_DESB, 1.2, 0.6))
			Bus.aviso.emit("Cintas cortadas: a ponta da chapa ficou pendurada. Cuidado, a chapa é afiada."))
	elif bobina.presente and fita == "solta":
		fita = "puxando"
		Bus.aviso.emit("Segurando a ponta: ande até a mesa de entrada (a chapa vem junto).")
	elif fita == "puxando":
		fita = "solta"


func bobina_travada_vazia() -> bool:
	return bobina.travada and not bobina.presente

## chamada pela ponte rolante quando a bobina termina de deslizar no mandril
func receber_bobina(codigo: String, metros: float) -> void:
	bobina = {"presente": true, "metros_total": metros, "metros": metros, "cinta": true, "travada": false, "codigo": codigo, "kg": metros / 247.0 * 1000.0}
	_r_malha = 0.0
	cauda_s = -1.0
	aviso_10 = false
	_fim_reconhecido = false
	fita = "presa"
	cabeca = X_ENTRADA
	# bobina nova = setup novo: refile, peça teste e medição obrigatórios de novo
	ponta_refilada = false
	teste_feito = false
	medida_ok = false
	freio_ok = false
	barriga_m = 0.0
	erro_encoder_mm = clampf(erro_encoder_mm + rng.randf_range(-3.0, 3.0), -15.0, 15.0)
	Som.tocar("trava", null, global_position + Vector3(X_DESB, 1.1, 0))
	_estado()

# --- mesa de entrada ---
func _txt_mesa() -> String:
	if fita == "puxando":
		return "Encaixar a ponta entre as guias da mesa de entrada"
	if fita in ["na_mesa", "enfiada"]:
		return "Ajustar as guias (manivelas CENTRO e APERTO) — desvio %+.1f mm, folga %.1f mm" % [desvio_mm, folga_mm]
	return ""

func _faz_mesa() -> void:
	if fita == "puxando":
		fita = "na_mesa"
		cabeca = X_ENTRADA + 0.35
		# a chapa puxada à mão também saiu da bobina (trecho bobina→mesa + o que passou da entrada)
		var puxado := minf(_comp_alimentacao() + 0.35, bobina.metros)
		bobina.metros -= puxado
		consumido_m += puxado
		puxado_mao_m += puxado
		_comp_ult = _comp_alimentacao()
		desvio_mm = snappedf(rng.randf_range(-12.0, 12.0), 0.5)
		folga_mm = snappedf(rng.randf_range(4.0, 10.0), 0.5)
		Som.tocar("tlec", null, global_position + Vector3(-5.8, 1.0, 0.5), -6.0)
		Bus.aviso.emit("Ponta nas guias. Na caixa de comando: modo MANUAL e segure AVANÇO LENTO.")
		_estado()
	elif fita in ["na_mesa", "enfiada"]:
		Interacoes.modo_guias(self)

func girar_manivela(qual: int, voltas: float) -> void:
	# 1 volta = 2 mm (fuso de passo 2). CENTRO move as duas guias; APERTO fecha/abre
	if v > 0.3:
		Bus.aviso.emit("Não mexa nas guias com a máquina em produção.")
		return
	if qual == 2:
		# volantes do endireitador: 1 volta = 0,5 mm de penetração dos rolos de cima
		penetracao_mm = clampf(penetracao_mm + voltas * 0.5, 0.0, 6.0)
		for vl in volantes:
			vl.rotation.y -= voltas * TAU
		Som.tocar("click", null, global_position + Vector3(X_E0 + 0.4, 1.6, 0), -14.0)
		return
	if qual == 0:
		desvio_mm = clampf(desvio_mm + voltas * 2.0, -40.0, 40.0)
	else:
		folga_mm = clampf(folga_mm - voltas * 2.0, 0.0, 15.0)
		if folga_mm < 0.5:
			Bus.aviso.emit("Guia apertada demais: a chapa vai raspar e marcar a borda.")
	manivelas[qual].rotation.z -= voltas * TAU
	Som.tocar("click", null, global_position + manivelas[qual].position, -14.0)

# --- trena ---
func _txt_trena() -> String:
	if pilha.is_empty():
		return ""
	return "Medir a última telha com a trena (%d na pilha)" % pilha.size()

func _faz_trena() -> void:
	var m := medir_trena()
	if m.is_empty():
		return
	Som.tocar("click", null, global_position + Vector3(X_PILHA, 0.5, 0.5))
	var txt := "Trena: %.3f m (programado %.3f). Erro %+.0f mm" % [m.L, comprimento, m.erro_mm]
	if absf(m.curva_mm) > 1.0:
		txt += " · torta %.0f mm (guia fora de centro!)" % absf(m.curva_mm)
	if absf(m.get("arco_mm", 0.0)) > 1.0:
		txt += " · arqueada %.0f mm (endireitador!)" % absf(m.arco_mm)
	if absf(m.erro_mm) > 2.0:
		txt += " → corrija %+.0f mm na IHM" % -m.erro_mm
	Bus.aviso.emit(txt)

# --- embalar a pilha (vira um amarrado que a empilhadeira leva) ---
func _txt_retirar() -> String:
	if pilha.is_empty() or rodando:
		return ""
	return "Amarrar a pilha (%d %s) com fita de aço" % [pilha.size(), PECAS]

func _faz_retirar() -> void:
	Interacoes.progresso("Amarrando a pilha com fita de aço...", 3.0, embalar_pilha)

## a pilha vira uma Carga no MESMO lugar (o que a tela mostra é o que existe): amarrado de telhas
## sobre os pontaletes ou pilha de chapas na mesa. Peso: chapa 0,43 mm = 3,38 kg/m², bobina de 1,20 m.
func embalar_pilha() -> Carga:
	if pilha.is_empty():
		return null
	var n := pilha.size()
	var metros := 0.0
	var lmax := 0.0
	var x0 := 1e9
	for t in pilha:
		metros += t.L
		lmax = maxf(lmax, t.L)
	for no in pilha_nos:
		x0 = minf(x0, (no as Node3D).position.x)
	var h := n * NINHO + (0.008 if PLANO else 0.045)
	# 1,20 m é a largura PLANA da bobina (o que a máquina consome), não a largura útil da telha
	var n_fitas := maxi(2, int(lmax / 1.0) + 1)
	var kg := metros * 1.20 * 3.38 + n_fitas * 1.1 * 0.25 + n_fitas * 2.0   # chapa + fitas de aço + pontaletes
	var desc := "%d %s %.2f m · %.0f kg" % [n, PECAS.to_upper(), lmax, kg]
	retirar_pilha()
	# o amarrado leva os próprios pontaletes (8 cm): na perfiladeira eles ficam nos mesmos lugares dos
	# pontaletes da pilha; na linha de corte a equipe calça a pilha em cima da mesa
	var y_base := (Y_PILHA0 - 0.08) if not PLANO else Y_PILHA0
	var xf := global_transform * Transform3D(Basis(), Vector3(x0 + lmax * 0.5, y_base, 0))
	var c := Carga.criar(get_parent(), xf, "chapa" if PLANO else "telha", n, metros, kg, Vector3(lmax, h + 0.08, 1.10 if not PLANO else 1.20), desc)
	Bus.aviso.emit("Amarrado pronto: %s. Leve com a empilhadeira (garfos por baixo, pelo lado)." % desc)
	if falha == "mesa_cheia":
		Bus.aviso.emit("Tire o amarrado da área da pilha, depois RESET e LIGA.")
	return c

func amarrado_na_saida() -> bool:
	for c in Carga.todas:
		var cc: Carga = c
		if cc.no_garfo or not is_instance_valid(cc):
			continue
		var l := to_local(cc.global_position)
		var xp := _x_pilha(COMPRIMENTO_PADRAO)
		if l.x > xp - 0.5 and l.x < xp + 7.0 and absf(l.z) < 1.0 and l.y < Y_PILHA0 + 0.5:
			return true
	return false

# --- graxeiras ---
func _txt_graxa(i: int) -> String:
	return "Engraxar o mancal da estação %d (graxa %d%%)" % [2 + i * 2, int(graxa[i] * 100)]

func _faz_graxa(i: int) -> void:
	if v > 0.01:
		Bus.aviso.emit("Não engraxe com a máquina andando: desligue ou aperte a emergência.")
		return
	Interacoes.progresso("Bombeando graxa...", 1.2, func():
		graxa[i] = 1.0
		Som.tocar("click", null, global_position + graxeiras[i].position))

# --- enrosco (só com a máquina bloqueada) ---
func _txt_enrosco() -> String:
	if not amassado.visible:
		return ""
	return "Cortar o enrosco com a esmerilhadeira"

var _esm: AudioStreamPlayer3D
func _faz_enrosco() -> void:
	if not (emergencia or not chave_geral or not energia):
		Bus.aviso.emit("SEGURANÇA: aperte a EMERGÊNCIA ou desligue a chave geral antes de pôr a mão na máquina.")
		return
	if protecao_fechada:
		Bus.aviso.emit("Abra a proteção dos rolos para alcançar o enrosco.")
		return
	if _sem_epi("esmerilhadeira"):
		return
	faiscas.position = amassado.position + Vector3(0, 0.1, 0.4)
	faiscas.emitting = true
	_esm = Som.laco("esmeril", self)
	_esm.position = amassado.position
	_esm.volume_db = -4.0
	Interacoes.progresso("Cortando a chapa amassada (faíscas!)...", 4.0, func():
		faiscas.emitting = false
		if _esm: _esm.queue_free()
		limpar_enrosco())

func _process(_d: float) -> void:
	if _i_enrosco and amassado.visible:
		_i_enrosco.position = Vector3(amassado.position.x, 1.0, 0.95)

# ======================================================================
#  PROTEÇÃO DOS ROLOS, MANDRIL, FREIO E RETALHO DE FIM DE CHAPA
# ======================================================================
var tampa: Node3D
var _tampa_ang := 0.0
var alav_mandril: Node3D
var volante_freio: Node3D

func _montar_protecao() -> void:
	# tampa de tela articulada sobre as estações, com chave de segurança (intertravamento)
	tampa = Node3D.new()
	tampa.position = Vector3((TAMPA_X0 + TAMPA_X1) * 0.5, TAMPA_Y, -0.66)
	add_child(tampa)
	var tela := MeshInstance3D.new()
	var bm := BoxMesh.new()
	bm.size = Vector3(TAMPA_X1 - TAMPA_X0, 0.012, 1.32)
	tela.mesh = bm
	tela.position = Vector3(0, 0, 0.66)
	var mt := StandardMaterial3D.new()
	mt.albedo_color = Color(0.95, 0.8, 0.1, 0.28)
	mt.transparency = BaseMaterial3D.TRANSPARENCY_ALPHA
	mt.cull_mode = BaseMaterial3D.CULL_DISABLED
	tela.material_override = mt
	tampa.add_child(tela)
	var mq := StandardMaterial3D.new()
	mq.albedo_color = Color(0.95, 0.78, 0.1)
	for z in [0.0, 1.32]:
		var q := MeshInstance3D.new()
		var qb := BoxMesh.new()
		qb.size = Vector3(TAMPA_X1 - TAMPA_X0, 0.04, 0.04)
		q.mesh = qb
		q.position = Vector3(0, 0, z)
		q.material_override = mq
		tampa.add_child(q)
	for x in [-(TAMPA_X1 - TAMPA_X0) * 0.5, 0.0, (TAMPA_X1 - TAMPA_X0) * 0.5]:
		var q := MeshInstance3D.new()
		var qb := BoxMesh.new()
		qb.size = Vector3(0.04, 0.04, 1.32)
		q.mesh = qb
		q.position = Vector3(x, 0, 0.66)
		q.material_override = mq
		tampa.add_child(q)
	# chave de segurança (caixinha vermelha na borda do operador)
	var ch := MeshInstance3D.new()
	var cb := BoxMesh.new()
	cb.size = Vector3(0.06, 0.08, 0.04)
	ch.mesh = cb
	var mc := StandardMaterial3D.new()
	mc.albedo_color = Color(0.8, 0.1, 0.1)
	ch.material_override = mc
	ch.position = Vector3(TAMPA_X0 + minf(1.35, (TAMPA_X1 - TAMPA_X0) * 0.3), TAMPA_Y - 0.03, 0.70)
	add_child(ch)
	# dobradiças visíveis no lado de trás
	var md := StandardMaterial3D.new()
	md.albedo_color = Color(0.25, 0.25, 0.27)
	md.metallic = 0.7
	for xx in ([-3.0, 0.0, 3.0] if TAMPA_X1 - TAMPA_X0 > 3.0 else [-(TAMPA_X1 - TAMPA_X0) * 0.35, (TAMPA_X1 - TAMPA_X0) * 0.35]):
		var d := MeshInstance3D.new()
		var dc := CylinderMesh.new()
		dc.top_radius = 0.022
		dc.bottom_radius = 0.022
		dc.height = 0.14
		d.mesh = dc
		d.rotation.z = PI / 2
		d.material_override = md
		d.position = Vector3(xx, 0, 0)
		tampa.add_child(d)
	# lingueta (atuador) da chave de segurança presa na tampa: entra na caixinha vermelha quando fecha
	var lg := MeshInstance3D.new()
	var lb2 := BoxMesh.new()
	lb2.size = Vector3(0.025, 0.07, 0.012)
	lg.mesh = lb2
	lg.material_override = md
	lg.position = Vector3(TAMPA_X0 + minf(1.35, (TAMPA_X1 - TAMPA_X0) * 0.3) - (TAMPA_X0 + TAMPA_X1) * 0.5, -0.03, 1.36)
	tampa.add_child(lg)
	var placa := Label3D.new()
	placa.text = "! PERIGO — ROLOS EM MOVIMENTO\nNÃO ABRIR COM A MÁQUINA LIGADA"
	placa.font_size = 30
	placa.pixel_size = 0.0022
	placa.modulate = Color(0.1, 0.1, 0.1)
	placa.outline_size = 0
	placa.position = Vector3(-2.0, 0.012, 1.25)
	placa.visible = TAMPA_X1 - TAMPA_X0 > 3.0
	placa.rotation.x = -PI / 2
	tampa.add_child(placa)
	Interagivel.criar(self, Vector3((TAMPA_X0 + TAMPA_X1) * 0.5, 1.0, 0.95), _txt_tampa, _faz_tampa, 1.5)

func _txt_tampa() -> String:
	return "Fechar a proteção dos rolos" if not protecao_fechada else "Abrir a proteção dos rolos (chave de segurança para a máquina)"

func _faz_tampa() -> void:
	protecao_fechada = not protecao_fechada
	Som.tocar("trava", null, global_position + Vector3(TAMPA_X0 + 0.5, TAMPA_Y, 0.7), -4.0)
	if not protecao_fechada and (v > 0.01 or rodando or teste_ativo):
		# intertravamento: abriu com a máquina em ciclo → parada imediata, exige RESET
		_parar_tudo("protecao")
		precisa_reset = true
		Bus.alarme.emit(NOME, "PROTEÇÃO ABERTA COM A MÁQUINA EM CICLO")
	_estado()

func _montar_alavancas() -> void:
	var ma := StandardMaterial3D.new()
	ma.albedo_color = Color(0.85, 0.12, 0.1)
	# alavanca de expansão/trava do mandril (lado do operador, na ponta do eixo)
	alav_mandril = Node3D.new()
	alav_mandril.position = Vector3(X_DESB, Y_DESB, 0.80)
	add_child(alav_mandril)
	var h := MeshInstance3D.new()
	var cy := CylinderMesh.new()
	cy.top_radius = 0.015
	cy.bottom_radius = 0.015
	cy.height = 0.32
	h.mesh = cy
	h.position.y = 0.16
	h.material_override = ma
	alav_mandril.add_child(h)
	var bola := MeshInstance3D.new()
	var sp := SphereMesh.new()
	sp.radius = 0.03
	sp.height = 0.06
	bola.mesh = sp
	bola.position.y = 0.33
	bola.material_override = ma
	alav_mandril.add_child(bola)
	# volante do freio (na pinça do disco do desbobinador)
	volante_freio = Node3D.new()
	volante_freio.position = Vector3(X_DESB - 0.35, 0.75, 0.80)
	add_child(volante_freio)
	var r := MeshInstance3D.new()
	var tm := TorusMesh.new()
	tm.inner_radius = 0.06
	tm.outer_radius = 0.075
	r.mesh = tm
	r.rotation.x = PI / 2
	var mv := StandardMaterial3D.new()
	mv.albedo_color = Color(0.1, 0.1, 0.1)
	r.material_override = mv
	volante_freio.add_child(r)
	var lb := Label3D.new()
	lb.text = "FREIO"
	lb.font_size = 28
	lb.pixel_size = 0.0015
	lb.position = Vector3(0, -0.11, 0.02)
	volante_freio.add_child(lb)
	Interagivel.criar(self, Vector3(X_DESB + 0.1, 1.1, 1.1), _txt_mandril, _faz_mandril, 1.0)
	Interagivel.criar(self, Vector3(X_DESB - 0.35, 0.8, 1.1), _txt_freio, _faz_freio, 1.0)
	Interagivel.criar(self, Vector3(X_E1 + 0.5, 1.0, 0.95), _txt_retalho, _faz_retalho, 1.8)

func _txt_mandril() -> String:
	if not bobina.presente:
		return ""
	return "Destravar o mandril" if bobina.travada else "Travar o mandril (expandir e travar)"

func _faz_mandril() -> void:
	if bobina.travada and (v > 0.0 or fita in ["na_mesa", "enfiada"]):
		Bus.aviso.emit("Não destrave o mandril com chapa na máquina.")
		return
	Interacoes.progresso("Girando a alavanca do mandril...", 1.2, func():
		bobina.travada = not bobina.travada
		Som.tocar("trava", null, global_position + Vector3(X_DESB, Y_DESB, 0.8))
		Bus.aviso.emit("Mandril %s." % ("expandido e TRAVADO" if bobina.travada else "destravado"))
		_estado())

func _txt_freio() -> String:
	if not bobina.presente:
		return ""
	return "Afrouxar o freio do desbobinador" if freio_ok else "Ajustar o freio do desbobinador (tensão da chapa)"

func _faz_freio() -> void:
	Interacoes.progresso("Apertando o volante do freio...", 1.5, func():
		freio_ok = not freio_ok
		barriga_m = 0.0 if freio_ok else barriga_m
		Som.tocar("click", null, global_position + Vector3(X_DESB - 0.35, 0.75, 0.8))
		_estado())

func _txt_retalho() -> String:
	if cauda_s < 0.0 or fita != "enfiada" or _cauda_x() < X_E1:
		return ""
	return "Retirar o retalho de fim de chapa (vai para a sucata)"

func _faz_retalho() -> void:
	if v > 0.01:
		return
	if _sem_epi("retirar retalho"):
		return
	Interacoes.progresso("Puxando o retalho para fora da guilhotina...", 2.0, func():
		var resto := peca_m + maxf(0.0, X_CORTE - _cauda_x())
		sucata_m += resto
		peca_m = 0.0
		fita = "nenhuma"
		bobina.presente = false
		Som.tocar("clank", null, global_position + TAMBOR, -3.0)
		Bus.aviso.emit("Retalho de %.2f m na sucata. Monte a próxima bobina." % resto)
		_estado())
