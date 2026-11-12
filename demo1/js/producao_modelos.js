// =====================================================================
// producao_modelos.js — QUEM FAZ CADA MODELO 3D (decisão do Lucas, 12/11)
// Estilo de referência: "Creative Characters FREE" da ithappy (Fab):
// low poly de brinquedo, cantos arredondados, cores chapadas e saturadas.
//
// GRUPO 1 — o Claude modela (script Python do Blender → .glb), com
//           qualidade boa e no estilo do pack. Formas geométricas,
//           máquinas, estrutura, props.
// GRUPO 2 — o Claude NÃO entrega boa qualidade: vem de pack pronto
//           (ithappy / asset gratuito) ou de modelador contratado.
//           Orgânicos, personagens, animação de personagem, veículo
//           com "cara".
// =====================================================================
window.PT = window.PT || {};

PT.ESTILO_MODELOS = {
  referencia: 'ithappy — Creative Characters FREE (Fab), formatos fbx/glb',
  regras: [
    'Cantos sempre chanfrados/arredondados (bevel), nada de quina viva',
    'Cores chapadas e saturadas (paleta única em textura atlas), sem textura realista',
    'Proporções levemente gordinhas: peças finas (cabo, grade, lâmina) engrossadas ~1,5x',
    'Poucos detalhes pequenos; o que importa é a silhueta ler de longe',
    'Escala real em metros, pivot no chão, frente para +X (igual ao jogo)'
  ]
};

// Fontes GRÁTIS conferidas em 12/11/2026 (Claude + ChatGPT + Gemini).
// Grab3D: tudo CC0 (uso comercial, sem crédito, download sem login), estilo pastel arredondado.
PT.FONTES_GRATIS = {
  'ithappy Creative Characters FREE': 'https://www.fab.com/listings/94fd60a2-5659-4fc4-af1d-a8cdd2681c2e',
  'ithappy Animals FREE': 'https://ithappystudios.com/free/animals-free/',
  'ithappy Cute Furniture FREE': 'https://www.fab.com/listings/3eca0616-aa73-4348-9af5-cb4c173f237e',
  'Grab3D (CC0)': 'https://grab3d.com/kits/cozy-industrial/',
  'Kenney Car Kit (CC0)': 'https://kenney.nl/assets/car-kit',
  'Mixamo (animações grátis, uso comercial)': 'https://www.mixamo.com'
};
const G3 = 'https://grab3d.com/models/';

(function () {
  // grupo 1 = Claude modela | grupo 2 = Claude não entrega boa qualidade (pack/modelador)
  // gratis = existe modelo GRÁTIS pronto (aí ninguém precisa modelar; Claude só adapta/recolore)
  const C = (obs, gratis) => ({ grupo: 1, quemFaz: gratis ? 'GRÁTIS + Claude adapta' : 'Claude (script Blender)', obs: obs || '', gratis: gratis || null });
  const P = (obs, gratis) => ({ grupo: 2, quemFaz: gratis ? 'GRÁTIS (pack)' : 'Modelador', obs: obs || '', gratis: gratis || null });
  PT.PRODUCAO_MODELOS = {
    // ---------- GRUPO 1 ----------
    barracao_132x40: C('Casca modular eu faço (132 x 40 m não existe pronto). Portão de enrolar e doca grátis', [['Grab3D Roller Shutter Door', G3 + 'buildings/roller-shutter-door/'], ['Grab3D Loading Dock', G3 + 'buildings/loading-dock/']]),
    piso_concreto: C('Tile + decais de rachadura/cratera'),
    escritorio: C(), porta_escritorio: C(),
    computador_mesa: C('Juntar mesa + PC + monitor', [['Grab3D Office Desk', G3 + 'furniture/office-desk/'], ['Grab3D Desktop PC', G3 + 'electronics/desktop-pc/'], ['Grab3D Computer Monitor', G3 + 'electronics/computer-monitor/']]),
    quadro_eletrico: C('Armário elétrico de 2 portas, kit industrial', [['Grab3D Electrical Cabinet', G3 + 'electronics/electrical-cabinet/']]),
    cabo_eletrico: C('Gerado por curva no Godot; eu entrego o perfil'),
    placa_dias_sem_acidente: C('Número por textura de texto no jogo'), marcacao_zona: C('Decal'),
    ponte_viga: C('O grátis é PÓRTICO (pés no chão); eu adapto a viga para correr no trilho do barracão', [['Grab3D Overhead Crane', G3 + 'buildings/overhead-crane/']]),
    ponte_carro: C('Carro amarelo do mesmo modelo', [['Grab3D Overhead Crane', G3 + 'buildings/overhead-crane/']]),
    ponte_cabo: C('Cabo/corrente do mesmo modelo; estados de cor no Godot', [['Grab3D Overhead Crane', G3 + 'buildings/overhead-crane/']]),
    ponte_gancho: C('Gancho do mesmo modelo', [['Grab3D Overhead Crane', G3 + 'buildings/overhead-crane/']]),
    botoeira: C(),
    perfiladeira_tp40: C('Não existe grátis. A mais trabalhosa: rolos repetidos por script. Primeira a testar'),
    guilhotina: C('Não existe grátis. A prensa hidráulica do kit serve de referência de cor/estilo', [['(referência) Grab3D Hydraulic Press', G3 + 'tools/hydraulic-press/']]),
    dobradeira: C('Não existe grátis'),
    clp_padrao: C('Mesa de comando grátis serve para a sala; o painel em pé da máquina eu faço', [['(parcial) Grab3D Industrial Control Panel', G3 + 'electronics/industrial-control-panel/']]),
    mesa_saida: C(),
    bobina_1t: C('Não existe grátis (o carretel de cabo do kit não serve)'), bobina_2t: C(),
    pilha_telhas: C('1 telha TP-40 para MultiMesh'), pilha_chapas: C(), pilha_rufos: C(),
    volume_caixa: C('Caixas de papelão', [['Grab3D Cardboard Box Stack', G3 + 'props/cardboard-box-stack/']]),
    volume_engradado: C('Engradado metálico do kit industrial', [['Grab3D Metal Crate', G3 + 'props/metal-crate/'], ['Grab3D Wooden Pallet', G3 + 'city/wooden-pallet/']]),
    paleteira: C('Rodas e alavanca separadas', [['Grab3D Pallet Jack', G3 + 'tools/pallet-jack/']]),
    mandril: C(), berco_bobina: C(),
    empilhadeira_eletrica: C('Garfo sobe sozinho, rodas traseiras viram; usar versão Light (15k tri)', [['Grab3D Forklift', G3 + 'vehicles/forklift/']]),
    saco_cimento: C('Palete com 19 sacos', [['Grab3D Cement Bags', G3 + 'props/cement-bags/']]),
    lata_tinta: C('Lata + rolo', [['Grab3D Paint Can', G3 + 'tools/paint-can/'], ['Grab3D Paint Roller', G3 + 'tools/paint-roller/']]),
    placa_parede: C('Placas com texto nosso'),
    armario: C('Fileira de 3 armários coloridos', [['Grab3D School Locker', G3 + 'furniture/school-locker/']]),
    loja_balcao: C(), balcao_loja: C('Balcão de madeira simples (os grátis são de recepção/supermercado)'),
    sino_balcao: C('Sino de balcão não existe grátis (só sino de mão); é simples'),
    garrafa_cafe: C('Garrafa térmica', [['Grab3D Thermos', G3 + 'props/thermos/']]),
    mostruario: C(),

    // ---------- GRUPO 2 ----------
    personagem_dono: P('Corpo modular (30 peças, 14 animações). Botoeira, CLP, paleteira, graxeira: Mixamo. Ragdoll no Godot', [['ithappy Creative Characters FREE', 'https://www.fab.com/listings/94fd60a2-5659-4fc4-af1d-a8cdd2681c2e'], ['Mixamo', 'https://www.mixamo.com'], ['Capacete: Grab3D Hard Hat', G3 + 'tools/hard-hat/']]),
    funcionario: P('Variações de roupa do pack + capacete. Greve, esmerilhar, tropeçar: Mixamo', [['ithappy Creative Characters FREE', 'https://www.fab.com/listings/94fd60a2-5659-4fc4-af1d-a8cdd2681c2e'], ['Mixamo', 'https://www.mixamo.com']]),
    cliente_balcao: P('Pedreiro, chacareiro (chapéu de palha do pack) e curioso', [['ithappy Creative Characters FREE', 'https://www.fab.com/listings/94fd60a2-5659-4fc4-af1d-a8cdd2681c2e']]),
    galinha: P('Galinha animada (parado/andar/correr) no mesmo estilo dos personagens', [['ithappy Animals FREE', 'https://ithappystudios.com/free/animals-free/']]),
    vaso_planta: P('Plantas no estilo ithappy ou Grab3D', [['ithappy Cute Furniture FREE', 'https://www.fab.com/listings/3eca0616-aa73-4348-9af5-cb4c173f237e'], ['Grab3D Snake Plant', G3 + 'nature/snake-plant/']]),
    caminhao_entrega: P('Baú para entregas de máquinas; carroceria aberta (Truck Flat) para telhas. Caminhão brasileiro sob medida: modelador (opcional)', [['Grab3D Delivery Truck', G3 + 'vehicles/delivery-truck/'], ['Kenney Car Kit — Truck Flat', 'https://kenney.nl/assets/car-kit']])
  };
})();

// Modelos já feitos pelo Claude (GLB em modelos3d/claude/glb/). Revisão 2 após crítica do ChatGPT.
PT.MODELOS_PRONTOS = ["balcao_loja", "balcao_modulo", "balcao_modulo_caixa", "berco_bobina", "bobina_1t", "bobina_2t", "botoeira", "cabo_eletrico", "cabo_eletrico_curva", "clp_padrao", "mandril", "marcacao_perigo", "marcacao_zona", "marcacao_zona_verde", "marcacao_zona_vermelha", "mesa_saida", "mostruario", "pilha_chapas", "pilha_rufos", "pilha_telhas", "piso_concreto", "placa_dias_sem_acidente", "placa_parede", "porta_escritorio", "sino_balcao", "telha_tp40", "perfiladeira_tp40", "guilhotina", "dobradeira", "ponte_viga", "ponte_carro", "ponte_gancho", "escritorio"];
