// =====================================================================
// modelos.js — REGISTRO DE MODELOS 3D
// Todo objeto visível do jogo nasce por PT.modelo('id'). Na Demo 1 isso
// monta um cubo/cilindro colorido; no Godot vira o .glb de verdade.
// O registro anota quantas vezes cada modelo apareceu e gera a FICHA
// de cotação (modelos.html e aba "Modelos 3D" do computador).
// Campos da ficha (acordados na sala: Claude + Gemini + ChatGPT):
//   nome, categoria, dims [X comprimento, Z largura, Y altura] (m),
//   forma (placeholder), partes móveis/animações, estados visuais,
//   pontos de encaixe (sockets), orçamento de polígonos, prioridade,
//   notas para o artista. 'usos' e 'maxInstancias' vêm do jogo rodando.
// =====================================================================
window.PT = window.PT || {};

PT.MODELOS = {
  // ---------- PERSONAGENS ----------
  personagem_dono: { nome: 'Personagem (dono da fábrica)', categoria: 'Personagens', dims: [0.5, 0.35, 1.75], forma: 'cilindro', cor: 0x2e86de,
    animacoes: ['parado', 'andar', 'correr', 'carregar caixa', 'carregar 2 telhas', 'empurrar paleteira', 'segurar botoeira', 'operar CLP', 'graxeira', 'ragdoll'],
    estados: ['normal', 'capacete', 'sujo de graxa'], sockets: ['mao_dir', 'mao_esq', 'cabeca (capacete)'], polys: '8–12k (rig humanoide)', prioridade: 'Demo',
    notas: 'Precisa de ossos simples para ragdoll (PhysicalBone3D, ~12 ossos). Já existe operador.txt do Blender como base.' },

  funcionario: { nome: 'Funcionário (corpo base com crachá/uniforme por cargo)', categoria: 'Personagens', dims: [0.5, 0.35, 1.72], forma: 'cilindro', cor: 0x95a5a6,
    animacoes: ['andar', 'carregar pilha', 'operar CLP', 'engraxar', 'esmerilhar', 'tomar café', 'braços cruzados (greve)', 'tropeçar', 'susto'],
    estados: ['uniforme por cargo', 'plaquinha "SEM PIX, SEM TELHA"', 'cansado'], sockets: ['mãos', 'cabeça (capacete)'], polys: '6–9k (mesmo rig do personagem)', prioridade: 'Demo',
    notas: 'Reaproveitar o rig do dono; variar só cabelo/uniforme/cor do crachá. ajudante.txt do Blender já existe como base.' },
  armario: { nome: 'Armário de vestiário', categoria: 'Instalação', dims: [0.6, 0.5, 1.9], forma: 'caixa', cor: 0x7fb3d5, estados: ['fechado', 'aberto'], polys: '400', prioridade: 'Demo' },

  cliente_balcao: { nome: 'Cliente a pé (pedreiro, chacareiro, curioso)', categoria: 'Personagens', dims: [0.5, 0.35, 1.7], forma: 'cilindro', cor: 0x8e6c4a,
    animacoes: ['andar', 'esperar impaciente', 'tocar o sino', 'pechinchar', 'ir embora bravo', 'tomar café'], estados: ['variações de roupa/chapéu'], polys: '6–9k (rig dos funcionários)', prioridade: 'Demo' },
  galinha: { nome: 'Galinha caipira (pagamento do Seu Lauro)', categoria: 'Zoeira', dims: [0.35, 0.25, 0.4], forma: 'cilindro', cor: 0xe8c547, animacoes: ['ciscar', 'andar', 'cacarejar', 'fugir do jogador'], polys: '1–2k', prioridade: 'Demo' },
  loja_balcao: { nome: 'Loja de balcão (prédio 12 x 8 m no pátio)', categoria: 'Estrutura', dims: [12, 8, 3.2], forma: 'caixa', cor: 0xd9c7a7,
    sockets: ['porta da rua', 'porta para o barracão', 'parede do mostruário', 'letreiro da fachada'], polys: '6–10k', prioridade: 'Demo', notas: 'Fachada com letreiro "Parecis Telha — pronta entrega" e toldo.' },
  balcao_loja: { nome: 'Balcão de atendimento (madeira)', categoria: 'Estrutura', dims: [9, 1.1, 0.7], forma: 'caixa', cor: 0x8b5a2b, sockets: ['sino', 'caderno de pedidos', 'garrafa de café'], polys: '1–2k', prioridade: 'Demo' },
  sino_balcao: { nome: 'Sino de balcão', categoria: 'Estrutura', dims: [0.15, 0.15, 0.12], forma: 'cilindro', cor: 0xd4ac0d, animacoes: ['plim-plim'], polys: '300', prioridade: 'Demo' },
  garrafa_cafe: { nome: 'Garrafa térmica + copinhos', categoria: 'Decoração', dims: [0.4, 0.4, 0.9], forma: 'cilindro', cor: 0x922b21, polys: '500', prioridade: 'Demo', notas: 'Bônus: cliente espera 30% mais.' },
  mostruario: { nome: 'Mostruário de telhas (amostras na parede)', categoria: 'Decoração', dims: [2.0, 0.4, 1.8], forma: 'caixa', cor: 0x95a5a6, estados: ['organizado', 'caído (zoeira)'], polys: '2–3k', prioridade: 'Demo', notas: 'Pedaços de cada família de telha/perfil. Bônus: +3% no preço do balcão.' },

  // ---------- ESTRUTURA ----------
  barracao_132x40: { nome: 'Barracão 132 x 40 m (casca)', categoria: 'Estrutura', dims: [132, 40, 12.5], forma: 'caixa', cor: 0x9aa4ad,
    estados: ['novo', 'abandonado (2º barracão)'], sockets: ['portão entrada', 'portão saída', 'trilhos da ponte', 'pontos de luz'],
    polys: '20–40k + modular', prioridade: 'Demo', notas: 'Fazer em MÓDULOS repetíveis (vão de 6 m) para instanciar. Telhado some no zoom de perto.' },
  piso_concreto: { nome: 'Piso de concreto (tile 6x6)', categoria: 'Estrutura', dims: [6, 6, 0.1], forma: 'caixa', cor: 0x7f8a93,
    estados: ['normal', 'rachado', 'cratera com destroços', 'remendo de cimento'], polys: '2 tris + decal', prioridade: 'Demo',
    notas: 'Cicatriz = troca de decal/modelo em 3 estágios, não fratura real.' },
  escritorio: { nome: 'Escritório (sala 8 x 8)', categoria: 'Estrutura', dims: [8, 8, 3], forma: 'caixa', cor: 0xd8cfc4,
    sockets: ['porta (respawn)', 'mesa do computador', 'parede de certificados'], polys: '5–8k', prioridade: 'Demo' },
  porta_escritorio: { nome: 'Porta do escritório', categoria: 'Estrutura', dims: [1, 0.1, 2.1], forma: 'caixa', cor: 0x6b4f3a, animacoes: ['abrir'], polys: '500', prioridade: 'Demo' },
  computador_mesa: { nome: 'Mesa com computador', categoria: 'Escritório', dims: [1.4, 0.7, 1.2], forma: 'caixa', cor: 0x34495e,
    estados: ['tela desligada', 'tela ligada'], sockets: ['tela (UI do navegador)'], polys: '2–3k', prioridade: 'Demo' },
  quadro_eletrico: { nome: 'Quadro elétrico', categoria: 'Instalação', dims: [1.2, 0.3, 1.8], forma: 'caixa', cor: 0x95a5a6,
    estados: ['normal', 'sobrecarga (luz vermelha, faísca)'], sockets: ['saídas de cabo (até 8)'], polys: '1–2k', prioridade: 'Demo' },
  cabo_eletrico: { nome: 'Cabo/conduíte (segmento)', categoria: 'Instalação', dims: [1, 0.05, 0.05], forma: 'caixa', cor: 0x111111,
    polys: 'gerado por curva', prioridade: 'Demo', notas: 'Gerado proceduralmente entre quadro e máquina; só precisa do perfil/material.' },
  placa_dias_sem_acidente: { nome: 'Placa "ESTAMOS HÁ X DIAS SEM ACIDENTES"', categoria: 'Zoeira', dims: [2.4, 0.08, 1.2], forma: 'caixa', cor: 0xf1c40f,
    estados: ['número dinâmico (textura de texto)'], polys: '300', prioridade: 'Demo' },
  marcacao_zona: { nome: 'Faixa pintada de zona (decal)', categoria: 'Estrutura', dims: [1, 1, 0.01], forma: 'caixa', cor: 0xe8c840,
    estados: ['amarelo recebimento', 'verde expedição', 'azul bobinas', 'vermelho rejeitados'], polys: 'decal', prioridade: 'Demo' },

  // ---------- PONTE ROLANTE ----------
  ponte_viga: { nome: 'Ponte rolante 1,5 t (viga + cabeceiras)', categoria: 'Ponte rolante', dims: [1.2, 40, 1.0], forma: 'caixa', cor: 0xf39c12,
    animacoes: ['andar no trilho'], estados: ['velha (1,5 t)', 'revisada (5 t)', 'industrial (10 t)'], sockets: ['trilho do carro'], polys: '3–5k', prioridade: 'Demo' },
  ponte_carro: { nome: 'Carro/talha da ponte', categoria: 'Ponte rolante', dims: [1.4, 1.4, 0.9], forma: 'caixa', cor: 0xe67e22,
    animacoes: ['andar na viga', 'tambor enrolando cabo'], sockets: ['saída do cabo'], polys: '2–3k', prioridade: 'Demo' },
  ponte_cabo: { nome: 'Cabo de aço da talha', categoria: 'Ponte rolante', dims: [0.05, 0.05, 1], forma: 'cilindro', cor: 0x888888,
    estados: ['cinza normal', 'amarelo tensionado', 'vermelho vibrando', 'rompido (2 pontas chicoteando)'], polys: 'cilindro esticado', prioridade: 'Demo',
    notas: 'O ESTOURO DO CABO é o acidente-símbolo do jogo: caprichar nas pontas chicoteando.' },
  ponte_gancho: { nome: 'Gancho da talha', categoria: 'Ponte rolante', dims: [0.5, 0.3, 0.8], forma: 'caixa', cor: 0xc0392b,
    estados: ['vazio', 'engatado'], sockets: ['ponto de engate'], polys: '1–2k', prioridade: 'Demo' },
  botoeira: { nome: 'Botoeira pendente', categoria: 'Ponte rolante', dims: [0.12, 0.1, 0.35], forma: 'caixa', cor: 0xf1c40f,
    animacoes: ['balançar no cabo'], sockets: ['mão do personagem'], polys: '500', prioridade: 'Demo' },

  // ---------- MÁQUINAS ----------
  perfiladeira_tp40: { nome: 'Perfiladeira TP-40 (usada)', categoria: 'Máquinas', dims: [16, 2.2, 1.6], forma: 'caixa', cor: 0x2980b9,
    animacoes: ['rolos girando', 'chapa avançando', 'corte da guilhotina hidráulica', 'vibração (desgaste)'],
    estados: ['desligada', 'produzindo', 'enroscada (espiral de chapa)', 'cassete gasto'],
    sockets: ['desbobinador (entrada da bobina)', 'mesa de saída', 'CLP', 'ponto de energia', 'graxeira'], polys: '15–25k', prioridade: 'Demo',
    notas: 'Base + cassete de rolos trocável (o cassete é modelo separado).' },
  guilhotina: { nome: 'Guilhotina com desbobinador', categoria: 'Máquinas', dims: [7, 2.4, 1.5], forma: 'caixa', cor: 0x8e44ad,
    animacoes: ['lâmina descendo', 'chapa avançando'], estados: ['desligada', 'cortando'],
    sockets: ['desbobinador', 'mesa de saída', 'CLP', 'ponto de energia'], polys: '8–12k', prioridade: 'Demo' },
  dobradeira: { nome: 'Dobradeira compacta', categoria: 'Máquinas', dims: [4, 1.6, 1.6], forma: 'caixa', cor: 0x16a085,
    animacoes: ['avental dobrando'], estados: ['desligada', 'dobrando'], sockets: ['mesa de entrada', 'mesa de saída', 'CLP', 'ponto de energia'],
    polys: '6–10k', prioridade: 'Demo' },
  clp_padrao: { nome: 'Painel CLP (família única)', categoria: 'Máquinas', dims: [0.6, 0.3, 1.5], forma: 'caixa', cor: 0x2c3e50,
    estados: ['desligado', 'verde produzindo', 'âmbar alerta', 'vermelho falha'], sockets: ['tela LCD (UI)', 'botões Start/Stop'], polys: '1–2k', prioridade: 'Demo',
    notas: 'O MESMO painel em todas as máquinas; só a tela muda.' },
  mesa_saida: { nome: 'Mesa de saída de produtos', categoria: 'Máquinas', dims: [6, 1.4, 0.8], forma: 'caixa', cor: 0x7f8c8d, polys: '1–2k', prioridade: 'Demo' },

  // ---------- MATERIAIS E PRODUTOS ----------
  bobina_1t: { nome: 'Bobina de aço 1 t', categoria: 'Materiais', dims: [1.0, 1.2, 1.0], forma: 'cilindro', cor: 0xbdc3c7,
    estados: ['cheia', 'pela metade', 'quase no fim'], sockets: ['furo central (mandril/gancho C)'], polys: '1–2k', prioridade: 'Demo',
    notas: 'Raio externo diminui conforme consome — dá para escalar o modelo.' },
  bobina_2t: { nome: 'Bobina de aço 2 t', categoria: 'Materiais', dims: [1.3, 1.2, 1.3], forma: 'cilindro', cor: 0x95a5a6, polys: '1–2k', prioridade: 'Demo' },
  pilha_telhas: { nome: 'Pilha de telhas TP-40', categoria: 'Produtos', dims: [6, 1.05, 0.5], forma: 'caixa', cor: 0x5dade2,
    estados: ['altura variável (1–60 telhas)', 'com telhas tortas visíveis'], polys: 'MultiMesh de 1 telha (~200 tris)', prioridade: 'Demo',
    notas: 'Comprimento varia com o pedido (1–12 m): modelo de 1 m esticável ou 3 tamanhos.' },
  pilha_chapas: { nome: 'Pilha de chapas planas', categoria: 'Produtos', dims: [3, 1.2, 0.3], forma: 'caixa', cor: 0xd5dbdb, polys: 'MultiMesh', prioridade: 'Demo' },
  pilha_rufos: { nome: 'Feixe de rufos/calhas', categoria: 'Produtos', dims: [3, 0.6, 0.3], forma: 'caixa', cor: 0xa9cce3, polys: 'MultiMesh', prioridade: 'Demo' },
  volume_caixa: { nome: 'Caixa de entrega (volume pequeno)', categoria: 'Entregas', dims: [0.8, 0.6, 0.6], forma: 'caixa', cor: 0xc8a165,
    estados: ['fechada', 'aberta'], polys: '300', prioridade: 'Demo' },
  volume_engradado: { nome: 'Engradado de máquina (volume grande)', categoria: 'Entregas', dims: [3, 2, 1.6], forma: 'caixa', cor: 0xa0522d,
    sockets: ['olhais para a ponte'], polys: '1k', prioridade: 'Demo', notas: 'Tamanho varia por máquina: fazer engradado escalável.' },

  // ---------- MOVIMENTAÇÃO ----------
  paleteira: { nome: 'Paleteira manual', categoria: 'Movimentação', dims: [1.6, 0.7, 1.2], forma: 'caixa', cor: 0xe74c3c,
    animacoes: ['garfo subindo', 'rodas'], sockets: ['mão do personagem', 'garfo (pilha)'], polys: '2–3k', prioridade: 'Demo' },
  empilhadeira_eletrica: { nome: 'Empilhadeira elétrica 2,5 t', categoria: 'Movimentação', dims: [2.4, 1.2, 2.2], forma: 'caixa', cor: 0xf1c40f,
    animacoes: ['rodas', 'torre subindo', 'garfo subindo', 'inclinação da torre', 'tombar de lado'], estados: ['normal', 'tombada', 'bateria fraca (luz)', 'com mandril'],
    sockets: ['banco do motorista', 'garfos (carga)', 'acessório (mandril)', 'tomada do carregador'], polys: '12–18k', prioridade: 'Demo',
    notas: 'Já existem empilhadeira_a/b do Blender no projeto (base). Precisa de gaiola de proteção visível (cinto = fica preso na gaiola).' },
  mandril: { nome: 'Mandril (aríete) de bobina', categoria: 'Movimentação', dims: [1.2, 0.3, 0.3], forma: 'caixa', cor: 0x8e44ad, sockets: ['encaixe no garfo'], polys: '500', prioridade: 'Demo' },
  berco_bobina: { nome: 'Berço de bobina', categoria: 'Movimentação', dims: [1.6, 1.6, 0.5], forma: 'caixa', cor: 0x3498db,
    sockets: ['apoio da bobina', 'plaquinha metálica (texto)'], polys: '800', prioridade: 'Demo' },
  caminhao_entrega: { nome: 'Caminhão (entrega/coleta)', categoria: 'Veículos', dims: [12, 2.6, 3.6], forma: 'caixa', cor: 0xecf0f1,
    animacoes: ['rodas', 'pisca', 'motorista gesticulando'], estados: ['fornecedor', 'cliente'], sockets: ['carroceria (volumes/pilhas)', 'buzina (som)'],
    polys: '10–15k', prioridade: 'Demo' },

  // ---------- CONSUMÍVEIS / DECORAÇÃO ----------
  saco_cimento: { nome: 'Saco de cimento', categoria: 'Consumíveis', dims: [0.6, 0.4, 0.15], forma: 'caixa', cor: 0xbdc3c7, polys: '300', prioridade: 'Demo' },
  lata_tinta: { nome: 'Lata de tinta de piso + rolo', categoria: 'Consumíveis', dims: [0.3, 0.3, 0.35], forma: 'cilindro', cor: 0xf4d03f, polys: '500', prioridade: 'Demo' },
  placa_parede: { nome: 'Placa de segurança de parede', categoria: 'Decoração', dims: [1, 0.05, 0.7], forma: 'caixa', cor: 0x27ae60,
    estados: ['texto trocável (biblioteca de frases)'], polys: '100', prioridade: 'Demo' },
  vaso_planta: { nome: 'Vaso com planta', categoria: 'Decoração', dims: [0.6, 0.6, 1.0], forma: 'cilindro', cor: 0x229954, polys: '1–2k', prioridade: 'Demo' }
};

// ---------------------------------------------------------------------
// Fábrica de objetos. Retorna um THREE.Group com o placeholder.
// opts: { dims, cor, rotulo, semRotulo }
// ---------------------------------------------------------------------
PT.registroModelos = { usos: {}, ativos: {}, max: {} };

PT.modelo = function (id, opts) {
  opts = opts || {};
  const def = PT.MODELOS[id];
  if (!def) console.warn('[modelos] ID sem ficha:', id);
  const d = opts.dims || (def ? def.dims : [1, 1, 1]);
  const cor = opts.cor !== undefined ? opts.cor : (def ? def.cor : 0xff00ff);
  const g = new THREE.Group();
  let geo;
  const forma = opts.forma || (def ? def.forma : 'caixa');
  const deitado = forma === 'cilindro' && id.indexOf('bobina') === 0;
  if (deitado) {
    // bobina: cilindro deitado, eixo ao longo de Z (largura da chapa = d[1])
    const r = Math.max(d[0], d[2]) / 2;
    geo = new THREE.CylinderGeometry(r, r, d[1], 20); geo.rotateX(Math.PI / 2);
  } else if (forma === 'cilindro') {
    const r = Math.max(d[0], d[1]) / 2;          // em pé: diâmetro no chão, altura = d[2]
    geo = new THREE.CylinderGeometry(r, r, d[2], 16);
  } else {
    geo = new THREE.BoxGeometry(d[0], d[2], d[1]);
  }
  const mat = new THREE.MeshLambertMaterial({ color: cor, transparent: !!opts.transparente, opacity: opts.transparente ? 0.45 : 1 });
  const mesh = new THREE.Mesh(geo, mat);
  const altura = deitado ? Math.max(d[0], d[2]) : d[2];
  mesh.position.y = altura / 2;
  mesh.castShadow = !opts.semSombra; mesh.receiveShadow = true;
  g.add(mesh);
  g.userData.mesh = mesh; g.userData.modeloId = id; g.userData.dims = d; g.userData.altura = altura;
  if (!opts.semRotulo && (opts.rotulo || def)) {
    const s = PT.rotuloSprite(opts.rotulo || (def ? def.nome : id));
    s.position.y = altura + 0.6; g.add(s); g.userData.rotulo = s;
  }
  const R = PT.registroModelos;
  R.usos[id] = (R.usos[id] || 0) + 1;
  R.ativos[id] = (R.ativos[id] || 0) + 1;
  R.max[id] = Math.max(R.max[id] || 0, R.ativos[id]);
  g.userData.liberar = function () { R.ativos[id] = Math.max(0, (R.ativos[id] || 1) - 1); };
  return g;
};

// etiqueta de texto (sprite) — some de longe para não poluir
PT.rotuloSprite = function (texto, cor) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96;
  const x = c.getContext('2d');
  x.fillStyle = 'rgba(15,20,28,0.78)'; x.fillRect(0, 0, 512, 96);
  x.fillStyle = cor || '#fff'; x.font = 'bold 34px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.fillText(texto.length > 30 ? texto.slice(0, 29) + '…' : texto, 256, 48);
  const t = new THREE.CanvasTexture(c);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: true, transparent: true }));
  s.scale.set(3.2, 0.6, 1); s.userData.ehRotulo = true;
  s.userData.atualizar = function (novo, novaCor) {
    x.clearRect(0, 0, 512, 96); x.fillStyle = 'rgba(15,20,28,0.78)'; x.fillRect(0, 0, 512, 96);
    x.fillStyle = novaCor || cor || '#fff'; x.fillText(novo.length > 30 ? novo.slice(0, 29) + '…' : novo, 256, 48); t.needsUpdate = true;
  };
  return s;
};

// ficha para cotação (usada pelo computador e por modelos.html)
PT.fichaModelos = function () {
  const R = PT.registroModelos;
  return Object.keys(PT.MODELOS).map(id => {
    const m = PT.MODELOS[id];
    const mx = R.max[id] || 0;
    // campos técnicos pedidos pelo ChatGPT, com padrão quando a ficha não diz
    return Object.assign({
      id, usos: R.usos[id] || 0, maxInstancias: mx,
      pivot: 'centro da base, no chão (Y=0), frente para +X',
      footprint: m.dims[0] + ' x ' + m.dims[1] + ' m',
      colisor: m.forma === 'cilindro' ? 'cilindro simples' : 'caixa do footprint',
      multimesh: mx > 20 ? 'sim (muitas instâncias)' : 'não',
      materiais: 'cores chapadas numa textura de paleta (estilo ithappy), sem textura realista',
      arquivo: 'models/' + id + '.glb'
    }, m, (PT.PRODUCAO_MODELOS || {})[id] || { grupo: 0, quemFaz: 'a definir', obs: '' });
  });
};
