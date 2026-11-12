// =====================================================================
// dados.js — TODOS OS PARÂMETROS DA DEMO 1 (Parecis Telha)
// Mudar balanceamento = mexer só aqui. Nenhum outro arquivo deve ter
// números de jogo "soltos" (preço, peso, velocidade, prazo...).
// dims = [comprimento X, largura Z, altura Y] em metros.
// Unidades: metros, kg, segundos reais, horas/dias de JOGO, R$.
// =====================================================================
window.PT = window.PT || {};

PT.DADOS = {
  versao: 'demo1-0.1',
  save_version: 1,

  // ---------------- TEMPO ----------------
  tempo: {
    horaInicio: 7, horaFim: 17,          // turno
    segundosReaisPorHora: 72,            // 10 h de turno = 12 min reais
    velocidades: [1, 5, 20, 60],         // teste (tecla T alterna)
    diaInicial: 1
  },

  // ---------------- ECONOMIA ----------------
  economia: {
    caixaInicial: 28000,
    limiteCredito: 25000, jurosCreditoMes: 0.02,
    chequeEspecial: 5000, jurosCheque7d: 0.05,
    finame: { entrada: 0.30, parcelas: 24, jurosMes: 0.012, faixaMinima: 1 },
    antecipacaoDesconto: 0.03,
    custosFixosMes: { energiaBase: 600, contadorInternetManut: 1200, outros: 700 },
    tarifaKWh: 0.85,
    encargos: 0.6,                       // salário × 1,6 (provisão simplificada)
    diasDoMes: 30,
    reservaRecomendada: 15000,
    sucataPorKg: 1.2,
    boletoHospitalSimbolico: 4870.33     // só aparece no e-mail, NÃO desconta
  },

  // ---------------- BARRACÃO / MUNDO ----------------
  mundo: {
    L: 132, D: 40, alturaBeiral: 10, grade: 0.5,
    corredor: { z0: 2, z1: 10 },          // faixa do caminhão (dentro do barracão)
    zonas: {
      recebimento: { x0: 6, x1: 26, z0: 10, z1: 16, cor: 0xe8c840, nome: 'RECEBIMENTO' },
      expedicao:   { x0: 104, x1: 126, z0: 10, z1: 16, cor: 0x3cb371, nome: 'EXPEDIÇÃO' },
      rejeitados:  { x0: 92, x1: 100, z0: 34, z1: 40, cor: 0xc0392b, nome: 'REJEITADOS' }
    },
    escritorio: { x0: 0, x1: 8, z0: 32, z1: 40 },
    porta: { x: 9, z: 36 },                // respawn
    computador: { x: 4, z: 36 },
    quadro: { x: 12, z: 39.6, capacidadeKW: 40 },
    placa: { x: 20, z: 39.8 },
    caminhao: { xEntrada: -30, xSaida: 170, velocidade: 6, z: 6, distParada: 2, esperaMaxMin: 180 },
    ponte: { capacidadeKg: 1500, alturaTrilho: 9, xIni: 20, zIni: 24,
             vel: { ponte: 3.0, carro: 2.2, gancho: 1.5 }, ganchoMin: 0.6,
             estresseSegundos: 3, raioMorte: 2.5, alcanceBotoeira: 4 }
  },

  // ---------------- MATERIAIS ----------------
  bobinas: {
    'GL043-1T': { nome: 'Bobina galvalume 0,43 mm', espessura: 0.43, largura: 1.2, pesoKg: 1000, metrosPorTon: 247, preco: 7000, modelo: 'bobina_1t' },
    'GL050-2T': { nome: 'Bobina galvalume 0,50 mm (2 t)', espessura: 0.50, largura: 1.2, pesoKg: 2000, metrosPorTon: 212, preco: 13200, modelo: 'bobina_2t' }
  },

  // produto = o que sai das máquinas e entra nos pedidos
  produtos: {
    'TP40':  { nome: 'Telha TP-40', unidade: 'm²', larguraUtil: 1.0, precoBase: 45, custoVariavel: 30 },
    'CHAPA': { nome: 'Chapa plana', unidade: 'm²', larguraUtil: 1.2, precoBase: 40, custoVariavel: 29 },
    'RUFO':  { nome: 'Rufo', unidade: 'm', larguraUtil: 0.3, precoBase: 22, custoVariavel: 9 },
    'CALHA': { nome: 'Calha', unidade: 'm', larguraUtil: 0.5, precoBase: 35, custoVariavel: 15 }
  },

  // ---------------- MÁQUINAS (dados da classe genérica) ----------------
  // entrada: 'bobina' | 'chapa' ; saida: código de produto (ou lista)
  maquinas: {
    'perf_tp40_usada': {
      nome: 'Perfiladeira TP-40 (usada)', tipo: 'perfiladeira', entrada: 'bobina', saida: ['TP40'],
      dims: [16, 2.2, 1.6], pesoKg: 1400, kw: 15, mPorMin: 12, mesaCap: 60,
      compMin: 1, compMax: 12, desgastePorM: 0.00025, alinhamentoBase: 0.75,
      vantagem: 'Robusta: aguenta 20% mais desgaste', defeito: 'Alinhamento solta: minijogo mais difícil',
      modelo: 'perfiladeira_tp40', modeloCLP: 'clp_padrao'
    },
    'guilhotina_usada': {
      nome: 'Guilhotina com desbobinador (usada)', tipo: 'guilhotina', entrada: 'bobina', saida: ['CHAPA'],
      dims: [7, 2.4, 1.5], pesoKg: 1300, kw: 7.5, mPorMin: 8, mesaCap: 80,
      compMin: 0.5, compMax: 6, desgastePorM: 0.0002, alinhamentoBase: 0.85,
      vantagem: 'Corte rápido', defeito: 'Precisão irregular (±1 cm)',
      modelo: 'guilhotina', modeloCLP: 'clp_padrao'
    },
    'dobradeira_compacta': {
      nome: 'Dobradeira compacta (usada)', tipo: 'dobradeira', entrada: 'chapa', saida: ['RUFO', 'CALHA'],
      dims: [4, 1.6, 1.6], pesoKg: 1100, kw: 11, mPorMin: 6, mesaCap: 100,
      compMin: 1, compMax: 3, desgastePorM: 0.0001, alinhamentoBase: 0.9,
      vantagem: 'Ótima precisão', defeito: 'Mais lenta',
      modelo: 'dobradeira', modeloCLP: 'clp_padrao'
    }
  },

  // ---------------- LOJA (navegador do escritório) ----------------
  categorias: ['Máquinas', 'Matéria-prima', 'Movimentação', 'Instalação', 'Decoração'],
  catalogo: [
    { id: 'perf_tp40_usada', categoria: 'Máquinas', preco: 23000, estado: 'Usada', prazoDias: 3, frete: 900, volume: 'grande', finame: true },
    { id: 'guilhotina_usada', categoria: 'Máquinas', preco: 18000, estado: 'Usada', prazoDias: 3, frete: 700, volume: 'grande', finame: true },
    { id: 'dobradeira_compacta', categoria: 'Máquinas', preco: 24000, estado: 'Usada', prazoDias: 4, frete: 700, volume: 'grande', finame: true },
    { id: 'GL043-1T', categoria: 'Matéria-prima', preco: 7000, estado: 'Nova', prazoDias: 2, frete: 250, volume: 'grande' },
    { id: 'GL050-2T', categoria: 'Matéria-prima', preco: 13200, estado: 'Nova', prazoDias: 2, frete: 400, volume: 'grande',
      aviso: 'Vendedor: "2 toneladas, hein. Essa sua ponte velha aguenta?"' },
    { id: 'berco_bobina', categoria: 'Movimentação', nome: 'Berço de bobina', preco: 1200, estado: 'Novo', prazoDias: 2, frete: 120, volume: 'pequeno',
      dims: [1.6, 1.6, 0.5], pesoKg: 80, modelo: 'berco_bobina' },
    { id: 'paleteira', categoria: 'Movimentação', nome: 'Paleteira manual', preco: 1500, estado: 'Nova', prazoDias: 2, frete: 80, volume: 'pequeno',
      dims: [1.6, 0.7, 1.2], pesoKg: 70, modelo: 'paleteira' },
    { id: 'empilhadeira_eletrica', categoria: 'Movimentação', nome: 'Empilhadeira elétrica 2,5 t (usada)', preco: 42000, estado: 'Usada', prazoDias: 3, frete: 600, volume: 'veiculo', finame: true,
      dims: [2.4, 1.2, 2.2], pesoKg: 3200, modelo: 'empilhadeira_eletrica', veiculo: true, vantagem: 'Bateria nova', defeito: 'Buzina não funciona' },
    { id: 'mandril', categoria: 'Movimentação', nome: 'Mandril (aríete) para bobina', preco: 3800, estado: 'Novo', prazoDias: 2, frete: 120, volume: 'pequeno',
      dims: [1.2, 0.3, 0.3], pesoKg: 90, modelo: 'mandril' },
    { id: 'quadro_80kw', categoria: 'Instalação', nome: 'Quadro elétrico 80 kW', preco: 6500, estado: 'Novo', prazoDias: 3, frete: 150, volume: 'pequeno',
      upgradeQuadroKW: 80, modelo: 'quadro_eletrico' },
    { id: 'saco_cimento', categoria: 'Instalação', nome: 'Saco de cimento (conserta piso)', preco: 38, estado: 'Novo', prazoDias: 1, frete: 0, volume: 'pequeno',
      consumivel: 'cimento', modelo: 'saco_cimento' },
    { id: 'placa_seguranca', categoria: 'Decoração', nome: 'Placa "USE O CAPACETE"', preco: 90, estado: 'Nova', prazoDias: 1, frete: 0, volume: 'pequeno',
      dims: [1, 0.05, 0.7], pesoKg: 3, modelo: 'placa_parede', decor: true },
    { id: 'vaso_planta', categoria: 'Decoração', nome: 'Vaso com planta', preco: 120, estado: 'Novo', prazoDias: 1, frete: 0, volume: 'pequeno',
      dims: [0.6, 0.6, 1.0], pesoKg: 15, modelo: 'vaso_planta', decor: true },
    { id: 'tinta_piso', categoria: 'Decoração', nome: 'Lata de tinta de piso (pintar zona)', preco: 210, estado: 'Nova', prazoDias: 1, frete: 0, volume: 'pequeno',
      consumivel: 'tinta', modelo: 'lata_tinta' }
  ],

  // o que chega no 1º caminhão (dia 1)
  kitHerdado: ['perf_tp40_usada', 'GL043-1T', 'paleteira'],

  // ---------------- CLIENTES / PEDIDOS ----------------
  clientes: {
    pedreiro:    { nome: 'Pedreiro', peso: 0.40, faixaMin: 0, canal: 'telefone', negocia: true,
                   pagamento: { entrada: 1.0, prazoSaldo: 0 }, produto: ['TP40', 'RUFO'], qtd: [10, 60], prazo: [1, 3],
                   nomes: ['Seu Zé da Laje', 'Toninho Reformas', 'Dona Cida Construções', 'Jairo Pedreiro'] },
    revenda:     { nome: 'Revenda', peso: 0.25, faixaMin: 0, canal: 'email', negocia: false,
                   pagamento: { entrada: 0.30, prazoSaldo: 28 }, produto: ['TP40', 'CALHA', 'RUFO'], qtd: [60, 150], prazo: [3, 6],
                   nomes: ['Casa do Construtor Parecis', 'Depósito Bom Preço', 'Materiais Chapadão'] },
    construtora: { nome: 'Construtora', peso: 0.25, faixaMin: 1, canal: 'email', negocia: false,
                   pagamento: { entrada: 0.30, prazoSaldo: 28 }, produto: ['TP40'], qtd: [200, 600], prazo: [7, 14], exigeQualidade: 0.95,
                   nomes: ['Construtora Cerrado', 'Alicerce Engenharia', 'Obra Certa Ltda'] },
    agro:        { nome: 'Agronegócio', peso: 0.10, faixaMin: 1, canal: 'email', negocia: false,
                   pagamento: { entrada: 0.40, prazoSaldo: 0 }, produto: ['TP40'], qtd: [300, 800], prazo: [10, 20],
                   nomes: ['Fazenda Três Marias', 'Agro Parecis', 'Sítio Boa Safra'] }
  },
  pedidos: { intervaloHoras: [3, 6], maxAbertos: 6, janelaColetaHoras: 2, toleranciaAtrasoHoras: 1,
             cargaParcial: 'entregaParcial',     // 'entregaParcial' (motorista leva o que carregou) | 'devolver' (descarrega de volta)
             multaCancelamento: 0.05,            // cancelamento por atraso da fábrica: devolve a entrada + multa
             prazoMinimoAceite: true },

  // ---------------- MESA DE CARREGAMENTO 2D (Fase 2, ordem do Gemini: 1º) ----------------
  carregamento: {
    mesa2D: true,
    carroceria: { comprimento: 12, largura: 2.5, celula: 0.5 },   // grade 24 x 5
    capacidadeKg: 6000,
    pecasPorPacote: 20,
    balanco: [0.30, 0.70],         // centro de massa deve ficar entre 30% e 70% do comprimento
    chanceDanoSemCinta: 0.35,      // por pacote sem cinta
    fracaoDanoPacote: 0.15,        // % das peças do pacote que amassam
    danoDesbalanceado: 0.10,       // chance extra por pacote se a carga estiver desbalanceada
    segundosCinta: 1.2             // tempo real para passar cada cinta
  },

  // ---------------- EMPILHADEIRA (Fase 2, ordem do Gemini: 2º) ----------------
  empilhadeira: {
    capacidadeKg: 2500, velMax: 3.5, aceleracao: 2.2, giro: 1.6, garfoMax: 3.0, velGarfo: 0.6,
    limiarTombo: 12,           // risco = |vel| × |giro| × (1 + garfo×fatorAltura) × (1 + peso/capacidade)
    fatorAltura: 1.2, consumoBateriaPorSeg: 1 / 900, horasRecarga: 2, minutosDesvirar: 30
  },

  // ---------------- REPUTAÇÃO ----------------
  reputacao: {
    inicial: { pontualidade: 0.6, qualidade: 0.6, financeira: 0.6 },
    faixas: [0, 10, 30, 70, 150],        // pedidos entregues para faixa 0..4
    efeitos: { noPrazo: 0.03, atrasoPorHora: -0.02, defeito: -0.05, semDefeito: 0.02,
               caminhaoEsperando: -0.01, cancelado: -0.08, contaEmDia: 0.01, chequeEspecial: -0.03 }
  },

  // ---------------- FUNCIONÁRIOS (fase 2) ----------------
  salarios: { ajudante: 1900, operador: 2450, ponte: 2650, mecanico: 3200, encarregado: 3500 },

  // ---------------- ZOEIRA ----------------
  zoeira: {
    frasesMorte: {
      cabo: ['A bobina venceu.', 'O cabo pediu demissão.', 'Física: 1 × Patrão: 0.'],
      geral: ['O departamento de segurança gostaria de conversar.', 'Mais um dia normal na Parecis Telha.', 'Isso não estava no orçamento.']
    },
    resmungos: ['Tô inteiro... minha coluna que não tá.', 'Quem foi que deixou isso aqui?', 'Eu devia ter ficado no escritório.'],
    respawnSegundos: 3
  },

  // ---------------- PERSONAGEM / CÂMERA ----------------
  personagem: { vel: 4.2, correr: 1.6, raio: 0.35, altura: 1.75, alcanceInteracao: 2.2, maxTelhasNaMao: 2 },
  camera: { dist: 9, distMin: 3, distMax: 40, altura: 4.5 }
};
