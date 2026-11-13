class_name Perfiladeira
extends Node3D
## PERFILADEIRA TP-40 — lógica + tudo o que se vê, no MESMO lugar e no MESMO passo.
## Regra do Lucas: o que a tela mostra é o que o jogo calcula. Cada metro que anda na tela:
##  tira da bobina (raio real), gasta rolo e graxa, consome energia, avança a peça e vai para a pilha.
## Coordenadas: as do modelo 3D (X ao longo da máquina, a chapa anda de -X para +X; +Z = lado do operador).

const NOME := "Perfiladeira TP-40"
# ---- geometria do modelo perfiladeira_tp40.glb ----
const X_DESB := -7.2
const Y_DESB := 1.12
const X_ENTRADA := -6.2        # começo da mesa de entrada
const Y_PASSE := 0.948         # linha de passe (topo dos rolos inferiores)
const X_E0 := -4.9             # 1ª estação
const PASSO := 0.75
const N_EST := 13
const X_E1 := X_E0 + (N_EST - 1) * PASSO    # última estação (4,1)
const X_CORTE := 5.07          # contra-faca da guilhotina
const X_APOIO_FIM := 7.05
const X_PILHA := 7.2           # começo da pilha (sobre pontaletes no chão)
const R_INF := 0.085
const R_SUP := 0.07
const Y_LAMINA := 1.18
# ---- material e máquina (dados da Demo) ----
const ESPESSURA := 0.00043     # chapa 0,43 mm
const R_FURO := 0.254          # furo de 508 mm
const KW := 15.0
const V_REAL := 12.0 / 60.0    # 12 m/min da máquina real
const FATOR_VISUAL := 3.0      # decisão da sala: 3x a real = 0,6 m/s (telha de 6 m em 10 s)
const V_JOG := 0.12
const MESA_CAP := 60
const NINHO := 0.006           # altura de cada telha encaixada na pilha

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
var bobina := {"presente": true, "metros_total": 247.0, "metros": 247.0, "cinta": true, "travada": true, "codigo": "BOB-001", "kg": 1000.0}
var fita := "presa"             # "presa" (cinta) | "solta" | "puxando" | "na_mesa" | "enfiada" | "nenhuma"
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
var estoque_retirado := 0
var energia_kwh := 0.0
var ultima_medida := {}
var teste_feito := false
var medida_ok := false
var perfeita_dada := false
var enrosco_x := 0.0
var enrosco_iminente := 0.0     # segundos até enroscar (o chiado avisa antes)
var aviso_10 := false

# ---- nós visuais ----
var modelo: Node3D
var rolos_inf: Array = []
var rolos_sup: Array = []
var lamina: Node3D
var mandril: Node3D
var guias: Array = []           # [nó, lado]
var bobina_grp: Node3D
var bobina_malha: MeshInstance3D
var bobina_furo: MeshInstance3D
var cintas: Array = []
var fita_alim: MeshInstance3D   # da bobina até a mesa
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

func _ready() -> void:
	rng.randomize()
	erro_encoder_mm = rng.randf_range(-15.0, 15.0)
	_mat_chapa = Perfil.material_chapa()
	modelo = load("res://modelos/perfiladeira_tp40.glb").instantiate()
	add_child(modelo)
	for e in N_EST:
		rolos_inf.append(modelo.find_child("rolo_inf_%d" % e, true, false))
		rolos_sup.append(modelo.find_child("rolo_sup_%d" % e, true, false))
	lamina = modelo.find_child("lamina", true, false)
	mandril = modelo.find_child("mandril_desbobinador", true, false)
	var ent := modelo.find_child("mesa_entrada", true, false)
	if ent:
		for c in ent.get_children():
			if String(c.name).begins_with("guia"):
				guias.append([c, signf(c.position.z), c.position.z])
	_montar_bobina_visual()
	_montar_fita()
	_montar_pontaletes()
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
	caixa.position = Vector3(-5.2, 0, 1.45)
	_interacoes()
	var fg := Marker3D.new()
	fg.name = "FocoGuias"
	add_child(fg)
	fg.transform = Transform3D(Basis(), Vector3(-5.75, 1.55, 1.75)).looking_at(Vector3(-5.75, 0.85, 0.55), Vector3.UP)
	_atualizar_visual(0.0)

# ======================================================================
#  ETAPAS (checklist de partida que aparece na tela — ensina e mostra o que falta)
# ======================================================================
func etapas() -> Array:
	return [
		["Ligar o disjuntor da perfiladeira no quadro elétrico", energia],
		["Ligar a CHAVE GERAL na caixa de comando", chave_geral],
		["Emergência liberada e RESET apertado", chave_geral and not emergencia and not precisa_reset],
		["Bobina no desbobinador com o mandril travado", bobina.presente and bobina.travada],
		["Cortar as cintas da bobina", bobina.presente and not bobina.cinta],
		["Puxar a ponta da chapa até a mesa de entrada", fita in ["na_mesa", "enfiada"]],
		["Passar a chapa até a guilhotina (AVANÇO LENTO, modo manual)", fita == "enfiada"],
		["Centralizar as guias (desvio ≤ 2 mm, folga ≤ 3 mm)", absf(desvio_mm) <= 2.0 and folga_mm <= 3.0 and fita == "enfiada"],
		["Cortar uma PEÇA TESTE (IHM, modo manual)", teste_feito],
		["Medir a peça com a trena e corrigir (erro ≤ 2 mm)", medida_ok],
		["Modo AUTOMÁTICO e apertar LIGA", rodando],
	]

func proxima_etapa() -> String:
	for e in etapas():
		if not e[1]:
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
	precisa_reset = false
	if falha in ["emergencia", "enrosco", "lote", "mesa_cheia", "fim_bobina", "energia"]:
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
	if pilha.size() >= MESA_CAP:
		Bus.aviso.emit("LIGA recusado: sensor da mesa de saída ocupado."); return
	if produzidas >= quantidade:
		Bus.aviso.emit("Lote já concluído. Zere o contador na IHM ou aumente a quantidade."); return
	rodando = true
	sirene_t = 2.0                # sirene de partida antes de qualquer movimento
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
	jog = segura

func cmd_peca_teste() -> void:
	var p := pode_mover()
	if p != "":
		Bus.aviso.emit("PEÇA TESTE recusada: " + p); return
	if modo != "manual":
		Bus.aviso.emit("PEÇA TESTE é no modo MANUAL."); return
	if fita != "enfiada":
		Bus.aviso.emit("Passe a chapa até a guilhotina antes da peça teste."); return
	teste_ativo = true
	sirene_t = 1.0
	Som.tocar("sirene", self, global_position + Vector3(-1, 2.2, 1), -6.0)
	_estado()

func cmd_cortar_manual() -> void:
	if pode_mover() != "" or modo != "manual" or fita != "enfiada" or peca_m < 0.3:
		Bus.aviso.emit("Corte manual: precisa de chapa passada do corte (pelo menos 30 cm) e modo manual."); return
	_cortar()

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
	if motivo == "emergencia" or motivo == "energia":
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
		if jog:
			alvo = V_JOG
		elif (rodando or teste_ativo) and fita == "enfiada":
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
		_avancar(ds, dt)
	# energia: motor em vazio 15% ligado, 100% formando. 1 h de jogo = 72 s reais.
	if energia and chave_geral:
		var kw := KW * (1.0 if v > 0.01 else 0.15)
		var kwh := kw * dt / 72.0
		energia_kwh += kwh
		Bus.energia_consumida.emit(kwh)
	_enrosco_iminente(dt)
	_deslizar(dt)
	_atualizar_visual(dt)

func _avancar(ds: float, dt: float) -> void:
	# 1) material sai da bobina (ou a cauda anda depois que ela acabou)
	if cauda_s < 0.0:
		var usa := minf(ds, bobina.metros)
		bobina.metros -= usa
		if not aviso_10 and bobina.metros < bobina.metros_total * 0.10:
			aviso_10 = true
			Som.tocar("bip", caixa)
			Bus.bobina_acabando.emit(NOME, bobina.metros)
			Bus.aviso.emit("Bobina com 10%% (%.0f m). Prepare a próxima." % bobina.metros)
		if bobina.metros <= 0.0:
			cauda_s = 0.0
			Bus.aviso.emit("Fim da bobina: a ponta final está passando pela máquina.")
	else:
		cauda_s += ds
	# 2) a chapa anda dentro da máquina
	if fita == "na_mesa":
		cabeca += ds
		if cabeca >= X_CORTE:
			cabeca = X_CORTE
			fita = "enfiada"
			jog = false
			Som.tocar("bip", caixa)
			Bus.aviso.emit("Chapa chegou no sensor da guilhotina. Ajuste as guias e faça a peça teste.")
			Bus.procedimento.emit(NOME, "enfiada", true)
	elif fita == "enfiada":
		peca_m += ds
		if peca_m >= _alvo_corte():
			_cortar()
	# 3) desgaste, graxa e aviso para os outros sistemas
	var secura := _secura()
	desgaste = minf(1.0, desgaste + ds * 0.00002 * (1.0 + secura * 2.5))
	for i in graxa.size():
		graxa[i] = maxf(0.0, graxa[i] - ds / 350.0)
	Bus.metros_formados.emit(NOME, ds)
	# 4) risco de enrosco (o chiado sobe antes — dá tempo de apertar a emergência)
	if fita == "enfiada" and enrosco_iminente <= 0.0:
		var risco := 0.00025 * (1.0 + desgaste * 5.0) * (1.0 + secura * 2.0) * (1.0 + maxf(0.0, absf(desvio_mm) - 8.0) / 4.0) * (1.6 if folga_mm > 6.0 else 1.0) * (1.4 if velocidade > 0.9 else 1.0)
		if rng.randf() < risco * ds:
			enrosco_iminente = 3.0
			enrosco_x = X_E0 + PASSO * rng.randi_range(2, N_EST - 2)
	# 5) cauda passou do corte: a última peça incompleta vira retalho
	if cauda_s >= 0.0 and _cauda_x() >= X_CORTE:
		if peca_m > 0.0:
			sucata_m += peca_m
			Bus.aviso.emit("Retalho de %.2f m (fim de chapa) foi para a sucata." % peca_m)
		peca_m = 0.0
		fita = "nenhuma"
		bobina.presente = false
		_parar_tudo("fim_bobina")
		precisa_reset = true
		Som.tocar("buzina", self, global_position + Vector3(0, 2, 1))
		Bus.bobina_acabou.emit(NOME)
		Bus.alarme.emit(NOME, "FIM DE BOBINA")
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
	sucata_m += (X_CORTE - enrosco_x) + peca_m + 0.8
	peca_m = 0.0
	amassado.visible = false
	cabeca = enrosco_x - 0.4
	fita = "na_mesa"
	Bus.aviso.emit("Enrosco cortado. Aperte RESET e passe a chapa de novo com AVANÇO LENTO.")
	_estado()

# ======================================================================
#  CORTE E PILHA
# ======================================================================
func _cortar() -> void:
	var L := peca_m
	peca_m = 0.0
	corte_t = 0.75
	Som.tocar("thoc", self, global_position + Vector3(X_CORTE, 1.3, 0), 3.0)
	# defeitos que se veem: guia fora de centro entorta (camber), folga deixa a chapa "nadar",
	# cassete gasto deixa o perfil assimétrico
	var curva := (desvio_mm / 1000.0) * 0.18 * L + (rng.randf_range(-1, 1) * (folga_mm - 3.0) * 0.0006 * L if folga_mm > 3.0 else 0.0)
	var assim := clampf((desgaste - 0.35) * 1.6, 0.0, 1.0)
	var erro_mm := (L - comprimento) * 1000.0
	var defeito := ""
	if absf(erro_mm) > 5.0: defeito = "medida"
	if absf(curva) > 0.004: defeito = "torta"
	if assim > 0.3: defeito = "perfil"
	var no := MeshInstance3D.new()
	no.mesh = _malha_telha(L, curva, assim)
	no.material_override = _mat_chapa
	no.position = Vector3(X_CORTE, Y_PASSE, desvio_mm / 1000.0 * 0.3)
	add_child(no)
	deslizando.append({"no": no, "L": L, "curva": curva, "assim": assim, "defeito": defeito, "fase": 0, "t": 0.0})
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
		Bus.aviso.emit("Lote concluído: %d telhas de %.2f m." % [produzidas, comprimento])
	_estado()

func _malha_telha(L: float, curva: float, assim: float) -> ArrayMesh:
	var k := "%d_%d_%d" % [int(L * 1000), int(curva * 1000), int(assim * 10)]
	if not _cache_telha.has(k):
		_cache_telha[k] = Perfil.malha_telha(L, curva, assim)
	return _cache_telha[k]

func _deslizar(dt_ind: float) -> void:
	for i in range(deslizando.size() - 1, -1, -1):
		var d: Dictionary = deslizando[i]
		var no: MeshInstance3D = d.no
		if d.fase == 0:
			# desliza sobre o apoio de rolos até a traseira passar do fim do apoio
			no.position.x += 1.6 * dt_ind
			if no.position.x >= X_PILHA:
				no.position.x = X_PILHA
				d.fase = 1
				d.t = 0.0
		else:
			# cai na pilha (encaixa por cima da anterior)
			d.t += dt_ind
			var y_alvo := 0.10 + pilha.size() * NINHO + 0.02
			no.position.y = lerpf(Y_PASSE, y_alvo, clampf(d.t / 0.25, 0.0, 1.0))
			if d.t >= 0.25:
				no.position.y = y_alvo
				Som.tocar("clank", self, global_position + Vector3(X_PILHA + d.L * 0.5, 0.4, 0), -2.0)
				pilha.append({"L": d.L, "curva": d.curva, "assim": d.assim, "defeito": d.defeito})
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
	ultima_medida = {"L": t.L, "erro_mm": erro, "curva_mm": t.curva * 1000.0}
	trena_no.visible = true
	var top := 0.10 + pilha.size() * NINHO + 0.05
	trena_no.position = Vector3(X_PILHA, top, 0.47)
	trena_no.scale = Vector3(t.L, 1, 1)
	(trena_no.get_child(1) as Label3D).text = "%.3f m" % t.L
	(trena_no.get_child(1) as Label3D).scale = Vector3(1.0 / t.L, 1, 1)
	if absf(erro) <= 2.0 and absf(t.curva) * 1000.0 <= 3.0:
		medida_ok = true
		if not perfeita_dada and absf(desvio_mm) <= 2.0 and folga_mm <= 3.0:
			perfeita_dada = true
			Bus.conquista.emit("PRIMEIRA TELHA PERFEITA!", "%.3f m na trena, sem torção. Agora é produção." % t.L)
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
	if fita_alim.visible:
		var dd := fim - ini
		fita_alim.position = Vector3((ini.x + fim.x) * 0.5, (ini.y + fim.y) * 0.5, desvio_mm / 1000.0 if fita != "puxando" else clampf(ponta_mao.z, -0.6, 1.2) * 0.5)
		fita_alim.rotation.z = atan2(dd.y, dd.x)
		fita_alim.scale.x = maxf(dd.length(), 0.01)
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
	# rolos giram só onde tem chapa puxando; todos estão engrenados pela corrente
	if dsv > 0.0:
		for i in N_EST:
			if rolos_inf[i]: rolos_inf[i].rotation.z -= dsv / R_INF
			if rolos_sup[i]: rolos_sup[i].rotation.z += dsv / R_SUP
	# lâmina da guilhotina (desce 0,25 m e volta)
	if lamina:
		var k := 0.0
		if corte_t > 0.0:
			var tt := 1.0 - corte_t / 0.75
			k = tt / 0.35 if tt < 0.35 else (1.0 if tt < 0.5 else maxf(0.0, 1.0 - (tt - 0.5) / 0.4))
		lamina.position.y = Y_LAMINA - 0.25 * k
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

func _atualizar_torre() -> void:
	var cor := ""
	var piscar := false
	if not (energia and chave_geral):
		cor = ""
	elif emergencia or falha == "enrosco" or falha == "emergencia":
		cor = "vermelha"; piscar = true
	elif falha in ["fim_bobina", "mesa_cheia", "energia"] or precisa_reset:
		cor = "ambar"; piscar = precisa_reset
	elif v > 0.01 or sirene_t > 0.0:
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
	var mb := StandardMaterial3D.new()
	mb.albedo_color = Color(0.72, 0.76, 0.80)
	mb.metallic = 0.6
	mb.roughness = 0.32
	bobina_malha.material_override = mb
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
	# fita formando (uma malha só; o shader esconde o que ainda não chegou)
	fita_malha = MeshInstance3D.new()
	fita_malha.mesh = Perfil.malha_fita(X_ENTRADA, X_CORTE, X_E0, X_E1)
	fita_mat = Perfil.material_fita()
	fita_mat.set_shader_parameter("x_rolos", X_E0)
	fita_malha.material_override = fita_mat
	fita_malha.position.y = Y_PASSE
	add_child(fita_malha)
	# telha crescendo depois da contra-faca (malha de 1 m escalada)
	peca_malha = MeshInstance3D.new()
	peca_malha.mesh = Perfil.malha_telha(1.0)
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

func _montar_pontaletes() -> void:
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
		g.position = Vector3(-5.95 + i * 0.4, 0.86, 0.72)
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
	regua.position = Vector3(-5.75, 0.885, 0.0)
	regua.rotation.y = PI / 2
	add_child(regua)

var graxeiras: Array = []
func _montar_graxeiras() -> void:
	var mg := StandardMaterial3D.new()
	mg.albedo_color = Color(0.98, 0.82, 0.1)
	mg.emission_enabled = true
	mg.emission = Color(0.3, 0.25, 0.0)
	for i in 6:
		var e := 1 + i * 2
		var x := X_E0 + e * PASSO
		var g := MeshInstance3D.new()
		var cy := CylinderMesh.new()
		cy.top_radius = 0.012
		cy.bottom_radius = 0.016
		cy.height = 0.035
		g.mesh = cy
		g.rotation.x = PI / 2
		g.position = Vector3(x, 1.2, 0.69)
		g.material_override = mg
		add_child(g)
		graxeiras.append(g)

func _montar_colisao() -> void:
	var corpo := StaticBody3D.new()
	add_child(corpo)
	for b in [
		[Vector3(-7.2, 0.7, 0), Vector3(1.4, 1.4, 1.7)],     # desbobinador + bobina
		[Vector3(-5.75, 0.45, 0), Vector3(0.9, 0.9, 1.3)],   # mesa de entrada
		[Vector3(-0.4, 0.75, 0.1), Vector3(9.9, 1.5, 1.7)],  # corpo formador + proteção
		[Vector3(4.95, 0.9, -0.2), Vector3(1.1, 1.8, 2.3)],  # guilhotina + unidade hidráulica
		[Vector3(6.4, 0.45, 0), Vector3(1.3, 0.9, 1.3)],     # apoio de saída
	]:
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
	Interagivel.criar(self, Vector3(-5.75, 0.95, 0.85), _txt_mesa, _faz_mesa, 1.4)
	Interagivel.criar(self, Vector3(X_PILHA + 1.0, 0.6, 0.9), _txt_trena, _faz_trena, 2.0)
	Interagivel.criar(self, Vector3(X_PILHA + 3.5, 0.6, 0.9), _txt_retirar, _faz_retirar, 2.5)
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
	if not bobina.presente:
		return "Montar bobina nova (provisório — a ponte rolante entra na próxima etapa)"
	return ""

func _faz_bobina() -> void:
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
	elif not bobina.presente:
		Interacoes.progresso("Montando bobina e travando o mandril...", 3.0, _montar_bobina_nova)

func _montar_bobina_nova() -> void:
	bobina = {"presente": true, "metros_total": 247.0, "metros": 247.0, "cinta": true, "travada": true, "codigo": "BOB-%03d" % rng.randi_range(2, 99), "kg": 1000.0}
	cauda_s = -1.0
	aviso_10 = false
	fita = "presa"
	cabeca = X_ENTRADA
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
		desvio_mm = snappedf(rng.randf_range(-25.0, 25.0), 0.5)
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
	if absf(m.erro_mm) > 2.0:
		txt += " → corrija %+.0f mm na IHM" % -m.erro_mm
	Bus.aviso.emit(txt)

# --- retirar pilha ---
func _txt_retirar() -> String:
	if pilha.is_empty() or rodando:
		return ""
	return "Retirar a pilha (%d telhas) — ajudante com a paleteira" % pilha.size()

func _faz_retirar() -> void:
	Interacoes.progresso("Ajudante amarrando e levando a pilha...", 3.0, func():
		var n := retirar_pilha()
		Bus.aviso.emit("%d telhas foram para o estoque." % n)
		if falha == "mesa_cheia":
			Bus.aviso.emit("Sensor da mesa livre. Aperte RESET e LIGA."))

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
