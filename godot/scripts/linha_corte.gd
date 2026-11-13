class_name LinhaCorte
extends Perfiladeira
## LINHA DE CORTE (chapa lisa): desbobinador → endireitador de 7 rolos (volantes de penetração) →
## alimentador com encoder → guilhotina hidráulica → mesa de roletes com batente.
## Herda TODA a lógica da perfiladeira (energia, emergência, proteção, mandril, freio, EPI, refile,
## encoder exato, conservação da chapa, sincronia com o relógio) — só a geometria e o produto mudam.
## Medidas tiradas do modelo guilhotina.glb (X ao longo da linha, +Z = lado do operador).

func _configurar() -> void:
	NOME = "Linha de Corte"
	NOME_PECA = "CHAPA"
	PECAS = "chapas"
	ARQUIVO_MODELO = "res://modelos/guilhotina.glb"
	PLANO = true
	X_DESB = -2.85
	Y_DESB = 1.12
	X_ENTRADA = -1.95          # boca do endireitador
	Y_PASSE = 0.94             # entre os rolos de baixo (topo 0,925) e de cima (base 0,945)
	X_E0 = -1.77               # 1º rolo do endireitador
	PASSO = 0.14
	N_EST = 7
	X_CORTE = 0.70             # fio da faca sobre a contra-faca
	X_BATENTE = 3.36           # face do batente da mesa de saída
	Y_PILHA0 = 0.952           # sobre os roletes da mesa
	NINHO = 0.0006             # chapa lisa: 0,43 mm + folga
	MESA_CAP = 100
	R_INF = 0.055
	R_SUP = 0.055
	LAMINA_CURSO = 0.08        # a faca passa 3,5 cm abaixo da contra-faca
	Y_PISADOR = 1.08
	PISADOR_CURSO = 0.125
	X_MESA = -1.75
	MANIVELA_Z = 0.86
	POS_CAIXA = Vector3(-0.75, 0, 1.30)
	GRAXEIRAS_X = [-1.77, -1.49, -1.21, -0.93]
	GRAXEIRA_Y = 0.87
	GRAXEIRA_Z = 0.76
	TAMPA_X0 = -0.62           # proteção sobre os rolos puxador/pressor (zona de esmagamento)
	TAMPA_X1 = -0.08
	TAMPA_Y = 1.14
	TEM_ENDIREITADOR = true
	COMPRIMENTO_PADRAO = 2.0
	TAMBOR = Vector3(1.25, 0.0, 1.3)
	COLISAO = [
		[Vector3(-2.85, 0.7, 0), Vector3(1.3, 1.4, 1.8)],
		[Vector3(-1.35, 0.75, 0), Vector3(1.1, 1.5, 1.55)],
		[Vector3(-0.35, 0.5, 0), Vector3(0.5, 1.0, 1.4)],
		[Vector3(0.6, 1.0, 0), Vector3(0.6, 2.0, 1.9)],
		[Vector3(0.6, 0.4, -1.05), Vector3(0.9, 0.8, 0.5)],
		[Vector3(2.4, 0.47, 0), Vector3(2.1, 0.95, 1.4)],
	]

func _ready() -> void:
	super._ready()
	penetracao_mm = snappedf(rng.randf_range(0.0, 4.5), 0.5)
	if absf(penetracao_mm - PENETRACAO_IDEAL) < 0.6:
		penetracao_mm = 4.0
	PENETRACAO_IDEAL = snappedf(rng.randf_range(1.5, 2.5), 0.5)
	for n in ["volante", "volante2", "volante3"]:
		var vl := modelo.find_child(n, true, false)
		if vl:
			volantes.append(vl)
	# guias laterais (roletes verticais) na boca do endireitador — as manivelas CENTRO/APERTO movem estas
	var mg := StandardMaterial3D.new()
	mg.albedo_color = Color(0.25, 0.25, 0.27)
	mg.metallic = 0.7
	for lado in [-1.0, 1.0]:
		var g := MeshInstance3D.new()
		var cy := CylinderMesh.new()
		cy.top_radius = 0.025
		cy.bottom_radius = 0.025
		cy.height = 0.12
		g.mesh = cy
		g.material_override = mg
		g.position = Vector3(X_ENTRADA - 0.05, Y_PASSE + 0.04, lado * 0.62)
		add_child(g)
		guias.append([g, lado, g.position.z])

func _achar_rolos() -> void:
	# endireitador: rolos 0,2,4,6 embaixo, 1,3,5 em cima; alimentador: puxador (baixo) e pressor (cima)
	for i in 7:
		var r := modelo.find_child("rolo_endireitador_%d" % i, true, false)
		if i % 2 == 0:
			rolos_inf.append(r)
		else:
			rolos_sup.append(r)
	rolos_inf.append(modelo.find_child("rolo_puxador", true, false))
	rolos_sup.append(modelo.find_child("rolo_pressor", true, false))
	var roda := modelo.find_child("roda_medicao", true, false)
	if roda:
		rolos_sup.append(roda)      # roda do encoder gira encostada na chapa
