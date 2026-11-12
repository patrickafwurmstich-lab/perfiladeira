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

(function () {
  const C = (obs) => ({ grupo: 1, quemFaz: 'Claude (script Blender)', obs: obs || '' });
  const P = (quemFaz, obs) => ({ grupo: 2, quemFaz, obs: obs || '' });
  PT.PRODUCAO_MODELOS = {
    // ---------- GRUPO 1: Claude modela ----------
    barracao_132x40: C('Modular: pilar, tesoura, telha da cobertura, portão — monto o barracão juntando peças'),
    piso_concreto: C('Tile + decais de rachadura/cratera'),
    escritorio: C(), porta_escritorio: C(), computador_mesa: C('Tela ligada/desligada por material'),
    quadro_eletrico: C(), cabo_eletrico: C('Gerado por curva no Godot; eu entrego o perfil'),
    placa_dias_sem_acidente: C('Número por textura de texto no jogo'), marcacao_zona: C('Decal'),
    ponte_viga: C(), ponte_carro: C(), ponte_cabo: C(), ponte_gancho: C(), botoeira: C(),
    perfiladeira_tp40: C('A mais trabalhosa do grupo: rolos repetidos por script. Primeira a testar'),
    guilhotina: C(), dobradeira: C(), clp_padrao: C(), mesa_saida: C(),
    bobina_1t: C(), bobina_2t: C(),
    pilha_telhas: C('1 telha TP-40 para MultiMesh'), pilha_chapas: C(), pilha_rufos: C(),
    volume_caixa: C(), volume_engradado: C(),
    paleteira: C(), mandril: C(), berco_bobina: C(),
    empilhadeira_eletrica: C('Peças separadas (torre, garfo, rodas) para animar; o tombo é física do Godot'),
    saco_cimento: C(), lata_tinta: C(), placa_parede: C(), armario: C(),
    loja_balcao: C(), balcao_loja: C(), sino_balcao: C(), garrafa_cafe: C(), mostruario: C(),

    // ---------- GRUPO 2: pack pronto ou modelador ----------
    personagem_dono: P('Pack ithappy', 'Montar o dono com as peças modulares (capacete, roupa). Animações extras (botoeira, CLP, paleteira, graxeira) e ragdoll: animador ou Mixamo'),
    funcionario: P('Pack ithappy', 'Variações de roupa/crachá do pack. Greve, esmerilhar e tropeçar: animador ou Mixamo'),
    cliente_balcao: P('Pack ithappy', 'Pedreiro, chacareiro (chapéu de palha do pack) e curioso'),
    galinha: P('Asset pronto ou modelador', 'Animal orgânico com 4 animações; procurar pack low poly de fazenda no mesmo estilo'),
    vaso_planta: P('Asset pronto', 'Folhagem orgânica; pack de plantas low poly'),
    caminhao_entrega: P('Modelador ou asset', 'Cabine de caminhão brasileiro com cara própria; motorista vem do pack ithappy')
  };
})();
