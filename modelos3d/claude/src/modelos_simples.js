// =====================================================================
// modelos_simples.js — modelos do GRUPO 1 feitos em código pelo Claude
// Cada função devolve um THREE.Group com o nome = ID da ficha do jogo.
// Peças que o jogo anima ou troca têm nome próprio (ver comentários).
// =====================================================================
(function () {
  const { COR, mat, malha, caixa, cilindro, anel, extrudar, chapaPerfil, texturaTexto, grupo, pos, rot } = OF;
  const M = OF.MODELOS;

  // ---------- perfil da telha TP-40 (largura útil 1,0 m, ondas de 40 mm a cada 250 mm) ----------
  function linhaTP40() {
    const L = [[-0.53, 0.04]], h = 0.04, topo = 0.022, base = 0.065;
    for (let k = 0; k < 5; k++) {
      const c = -0.5 + k * 0.25;
      if (k > 0) { L.push([c - base, 0]); L.push([c - topo, h]); }
      L.push([c + topo, h]); L.push([c + base, 0]);
    }
    L.push([0.5 - 0.065 + 0.0001, 0]); // garante vale antes da última onda
    L.push([0.5 - 0.022, h]); L.push([0.53, h]);
    // remove pontos repetidos/fora de ordem
    return L.filter((p, i) => i === 0 || p[0] > L[i - 1][0] + 1e-4);
  }
  function telha(comp, cor, nome) {
    const m = extrudar(chapaPerfil(linhaTP40(), 0.005), comp, cor || COR.galvalume, nome || 'telha');
    m.rotation.y = Math.PI / 2;  // comprimento no eixo X
    return m;
  }
  function pontalete(comp) { return caixa(0.08, 0.06, comp, COR.madeira, 'pontalete', 0.01); }

  // ---------- BOBINAS (eixo da bobina no eixo Z, deitada) ----------
  function bobina(id, diam, larg) {
    const re = diam / 2, ri = 0.254;   // furo de 508 mm (padrão)
    const corpo = anel(ri, re, larg, COR.galvalume, 'corpo', 32, 0.02); rot(corpo, Math.PI / 2, 0, 0);
    const g = grupo(id, [corpo]);
    // espiras visíveis nas laterais (anéis um pouco mais escuros)
    [0.36, 0.43].forEach((r, i) => [-1, 1].forEach(s => {
      const a = anel(r * diam / 1.0 - 0.006, r * diam / 1.0, 0.004, COR.galvEsc, 'espira'); rot(a, Math.PI / 2, 0, 0); pos(a, 0, 0, s * (larg / 2 + 0.001)); g.add(a);
    }));
    // cintas: 2 circunferenciais + 2 pelo furo
    [-larg * 0.3, larg * 0.3].forEach(z => { const c = anel(re - 0.002, re + 0.008, 0.035, COR.azul, 'cinta', 32, 0.003); rot(c, Math.PI / 2, 0, 0); pos(c, 0, 0, z); g.add(c); });
    [0, Math.PI / 2].forEach(a => {
      const fio = new THREE.Shape(); const w = re - ri + 0.02, hz = larg / 2 + 0.008;
      const s = chapaPerfil([[ri - 0.01, -hz], [re + 0.01, -hz], [re + 0.01, hz], [ri - 0.01, hz], [ri - 0.01, -hz + 0.001]], 0.008);
      const c = extrudar(s, 0.035, COR.azul, 'cinta_furo');
      const piv = grupo('cinta_furo', [rot(c, Math.PI / 2, 0, 0)]);
      // a cinta passa pelo furo: perfil no plano XZ, girar em volta do eixo Z
      c.rotation.set(Math.PI / 2, 0, 0); piv.rotation.z = a; g.add(piv);
    });
    // ponta da chapa (degrau na superfície) e plaquinha de identificação
    const ponta = caixa(0.02, 0.012, larg - 0.02, COR.galvEsc, 'ponta_chapa', 0.003); pos(ponta, re * 0.7, re * 0.7, 0); ponta.rotation.z = -Math.PI / 4; g.add(ponta);
    const placa = caixa(0.16, 0.1, 0.006, COR.branco, 'plaquinha', 0.008); pos(placa, 0, re * 0.62, larg / 2 + 0.006); g.add(placa);
    g.children.forEach(c => c.position.y += re + 0.008);   // apoia no chão (cinta inclusa)
    return g;
  }
  M.bobina_1t = () => bobina('bobina_1t', 1.0, 1.2);
  M.bobina_2t = () => bobina('bobina_2t', 1.3, 1.2);

  // ---------- MESA DE SAÍDA (6 x 1,4 m, rolos livres, altura de trabalho 0,8 m) ----------
  M.mesa_saida = () => {
    const g = grupo('mesa_saida'), L = 6, W = 1.4, H = 0.8;
    [-1, 1].forEach(s => { g.add(pos(caixa(L, 0.14, 0.08, COR.teal, 'longarina'), 0, H - 0.07, s * (W / 2 - 0.04))); });
    for (let i = 0; i < 4; i++) {
      const x = -L / 2 + 0.25 + i * (L - 0.5) / 3;
      [-1, 1].forEach(s => g.add(pos(caixa(0.08, H - 0.12, 0.08, COR.tealEsc, 'pe'), x, (H - 0.12) / 2, s * (W / 2 - 0.04))));
      g.add(pos(caixa(0.06, 0.06, W - 0.1, COR.tealEsc, 'travessa'), x, 0.18, 0));
      [-1, 1].forEach(s => g.add(pos(caixa(0.14, 0.03, 0.14, COR.grafite, 'sapata', 0.01), x, 0.015, s * (W / 2 - 0.04))));
    }
    for (let i = 0; i < 12; i++) {
      const r = rot(cilindro(0.04, W - 0.18, COR.aco, 'rolo', 0.01, 12), Math.PI / 2, 0, 0);
      g.add(pos(r, -L / 2 + 0.25 + i * (L - 0.5) / 11, H - 0.03, 0));
    }
    // batente amarelo/preto no fim da mesa
    g.add(pos(caixa(0.1, 0.22, W, COR.amarelo, 'batente'), L / 2 - 0.05, H + 0.08, 0));
    for (let i = 0; i < 4; i++) g.add(pos(caixa(0.104, 0.05, 0.16, COR.preto, 'faixa', 0.005), L / 2 - 0.05, H + 0.08, -W / 2 + 0.2 + i * 0.34));
    return g;
  };

  // ---------- BOTOEIRA PENDENTE ----------
  M.botoeira = () => {
    const g = grupo('botoeira');
    g.add(pos(caixa(0.11, 0.3, 0.09, COR.amarelo, 'corpo', 0.025), 0, 0.15, 0));
    const tampa = pos(caixa(0.115, 0.03, 0.095, COR.grafite, 'tampa', 0.012), 0, 0.305, 0); g.add(tampa);
    // botões de frente (+Z): setas sobe/desce, direções, liga
    const cores = [COR.verde, COR.verde, COR.preto, COR.preto, COR.preto, COR.preto];
    cores.forEach((c, i) => { const b = rot(cilindro(0.016, 0.016, c, 'botao', 0.005, 12), Math.PI / 2, 0, 0); g.add(pos(b, (i % 2 ? 0.026 : -0.026), 0.235 - Math.floor(i / 2) * 0.055, 0.048)); });
    // emergência (cogumelo vermelho) no topo
    g.add(pos(cilindro(0.022, 0.02, COR.vermelho, 'emergencia', 0.008, 14), 0.025, 0.33, 0));
    // prensa-cabo e cabo saindo para cima (o jogo estica o cabo até a ponte)
    g.add(pos(cilindro(0.012, 0.03, COR.preto, 'prensa_cabo', 0.004, 10), -0.02, 0.335, 0));
    g.add(pos(cilindro(0.007, 0.25, COR.preto, 'cabo', 0.003, 8), -0.02, 0.47, 0));
    g.position.y = 0; return g;
  };

  // ---------- MANDRIL (aríete de bobina para a empilhadeira) ----------
  M.mandril = () => {
    const g = grupo('mandril');
    g.add(pos(caixa(0.08, 0.3, 0.3, COR.amarelo, 'placa_fixacao', 0.02), -0.56, 0.15, 0));
    [-1, 1].forEach(s => g.add(pos(caixa(0.06, 0.05, 0.05, COR.grafite, 'gancho_garfo', 0.01), -0.62, 0.27, s * 0.1)));
    const haste = rot(cilindro(0.075, 1.0, COR.grafite, 'haste', 0.02, 16), 0, 0, Math.PI / 2); g.add(pos(haste, -0.02, 0.15, 0));
    const ponta = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.12, 16), mat(COR.amarelo)); ponta.name = 'ponta'; rot(ponta, 0, 0, -Math.PI / 2); g.add(pos(ponta, 0.54, 0.15, 0));
    return g;
  };

  // ---------- BERÇO DE BOBINA (V com borracha) ----------
  M.berco_bobina = () => {
    const g = grupo('berco_bobina'), L = 1.6, W = 1.6, H = 0.5;
    [-1, 1].forEach(s => g.add(pos(caixa(L, 0.08, 0.12, COR.teal, 'base'), 0, 0.04, s * (W / 2 - 0.06))));
    for (let i = 0; i < 3; i++) g.add(pos(caixa(0.12, 0.08, W, COR.tealEsc, 'travessa'), -L / 2 + 0.15 + i * (L - 0.3) / 2, 0.04, 0));
    // dois blocos inclinados formando o V (perfil no plano YZ, extrudado em X)
    [-1, 1].forEach(s => {
      const perfil = [[0, 0.08], [s * 0.72, 0.08], [s * 0.72, H], [s * 0.2, 0.2]].map(p => [p[0], p[1]]);
      const b = extrudar(s > 0 ? perfil : perfil.reverse(), L - 0.1, COR.teal, 'cunha', 0.012); rot(b, 0, -Math.PI / 2, 0); g.add(b);
      const pad = caixa(L - 0.2, 0.025, 0.5, COR.borracha, 'borracha', 0.01);
      pad.rotation.x = s * Math.atan2(H - 0.2, 0.52); pos(pad, 0, 0.365, s * 0.46); g.add(pad);
    });
    return g;
  };

  // ---------- TELHA E PILHAS ----------
  M.telha_tp40 = () => { const g = grupo('telha_tp40', [telha(1.0)]); return g; };   // 1 m: o jogo escala no X (MultiMesh)
  M.pilha_telhas = () => {
    const g = grupo('pilha_telhas'), L = 6, n = 30;
    [-2.4, 0, 2.4].forEach(x => g.add(pos(pontalete(1.0), x, 0.03, 0)));
    for (let i = 0; i < n; i++) g.add(pos(telha(L, i % 9 === 4 ? COR.galvEsc : COR.galvalume, 'telha'), 0, 0.06 + i * 0.012, 0));
    return g;
  };
  M.pilha_chapas = () => {
    const g = grupo('pilha_chapas'), L = 3, W = 1.2;
    [-1.1, 0, 1.1].forEach(x => g.add(pos(pontalete(W), x, 0.03, 0)));
    for (let i = 0; i < 8; i++) { const c = caixa(L, 0.026, W, i % 2 ? COR.galvalume : COR.galvEsc, 'chapa', 0.006); pos(c, (i % 3 - 1) * 0.012, 0.073 + i * 0.027, (i % 2 ? 0.008 : -0.006)); g.add(c); }
    [-0.9, 0.9].forEach(x => g.add(pos(caixa(0.035, 0.24, W + 0.02, COR.azul, 'cinta', 0.005), x, 0.17, 0)));
    return g;
  };
  M.pilha_rufos = () => {
    const g = grupo('pilha_rufos'), L = 3;
    const rufo = [[-0.2, 0.06], [-0.2, 0], [0.02, 0], [0.02, 0.1], [0.2, 0.1], [0.2, 0.08]];
    [-1.1, 0, 1.1].forEach(x => g.add(pos(pontalete(0.6), x, 0.03, 0)));
    for (let i = 0; i < 7; i++) { const m = extrudar(chapaPerfil(rufo, 0.006), L, COR.galvalume, 'rufo'); rot(m, 0, Math.PI / 2, 0); pos(m, 0, 0.065 + i * 0.016, 0); g.add(m); }
    [-0.9, 0.9].forEach(x => g.add(pos(caixa(0.03, 0.24, 0.46, COR.azul, 'cinta', 0.005), x, 0.15, 0)));
    return g;
  };

  // ---------- PISO, FAIXA DE ZONA E CABO ----------
  M.piso_concreto = () => {
    const g = grupo('piso_concreto');
    g.add(pos(caixa(5.98, 0.1, 5.98, COR.concreto, 'placa', 0.012), 0, -0.05, 0));   // topo no Y=0, junta de 2 cm entre placas
    return g;
  };
  M.marcacao_zona = () => {
    const g = grupo('marcacao_zona');
    // faixa de 1 x 1 m (o jogo troca a cor: amarelo, verde, azul, vermelho)
    g.add(pos(caixa(1, 0.004, 1, COR.amarelo, 'faixa', 0), 0, 0.002, 0));
    return g;
  };
  M.cabo_eletrico = () => {
    const g = grupo('cabo_eletrico');
    const tubo = rot(cilindro(0.022, 1.0, COR.cinza, 'conduite', 0.004, 10), 0, 0, Math.PI / 2); g.add(pos(tubo, 0, 0.022, 0));
    for (let i = 0; i < 9; i++) { const a = anel(0.021, 0.026, 0.012, COR.grafite, 'anel', 10, 0.002); rot(a, 0, 0, Math.PI / 2); g.add(pos(a, -0.45 + i * 0.1125, 0.022, 0)); }
    return g;
  };

  // ---------- PLACAS ----------
  M.placa_dias_sem_acidente = () => {
    const g = grupo('placa_dias_sem_acidente'), W = 2.4, H = 1.2;
    const tex = texturaTexto(1024, 512, (c, w, h) => {
      c.fillStyle = '#2f8f4e'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffffff'; c.font = 'bold 74px sans-serif'; c.textAlign = 'center';
      c.fillText('ESTAMOS HÁ', w / 2, 100); c.fillText('DIAS SEM ACIDENTES', w / 2, 455);
      c.fillStyle = '#f4f1ea'; c.fillRect(w / 2 - 180, 140, 360, 240);     // espaço do número
      c.font = 'bold 26px sans-serif'; c.fillStyle = '#d7f0dd'; c.fillText('SEGURANÇA EM PRIMEIRO LUGAR', w / 2, 500);
    });
    g.add(pos(caixa(W + 0.08, H + 0.08, 0.05, COR.branco, 'moldura', 0.02), 0, 0, 0));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })); face.name = 'face'; g.add(pos(face, 0, 0, 0.027));
    // o jogo escreve o número neste quadro (textura dinâmica)
    const num = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 0.56), mat(COR.branco)); num.name = 'numero'; g.add(pos(num, 0, 0.03, 0.029));
    g.children.forEach(c => c.position.y += 2.2);   // pendurada a 2,2 m (pivot no chão para alinhar com a parede)
    return g;
  };
  M.placa_parede = () => {
    const g = grupo('placa_parede'), W = 1.0, H = 0.7;
    const tex = texturaTexto(512, 360, (c, w, h) => {
      c.fillStyle = '#f5c84b'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2b2f36'; c.lineWidth = 18; c.strokeRect(14, 14, w - 28, h - 28);
      c.fillStyle = '#2b2f36'; c.beginPath(); c.moveTo(w / 2, 50); c.lineTo(w / 2 + 70, 170); c.lineTo(w / 2 - 70, 170); c.closePath(); c.fill();
      c.fillStyle = '#f5c84b'; c.font = 'bold 90px sans-serif'; c.textAlign = 'center'; c.fillText('!', w / 2, 160);
      c.fillStyle = '#2b2f36'; c.font = 'bold 54px sans-serif'; c.fillText('USE EPI', w / 2, 255); c.font = 'bold 32px sans-serif'; c.fillText('CAPACETE E BOTINA', w / 2, 310);
    });
    g.add(caixa(W + 0.04, H + 0.04, 0.03, COR.preto, 'moldura', 0.012));
    const face = new THREE.Mesh(new THREE.PlaneGeometry(W, H), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })); face.name = 'face'; g.add(pos(face, 0, 0, 0.017));
    g.children.forEach(c => c.position.y += 1.8);
    return g;
  };

  // ---------- PORTA DO ESCRITÓRIO (folha gira na dobradiça, x = -0,45) ----------
  M.porta_escritorio = () => {
    const g = grupo('porta_escritorio');
    [-1, 1].forEach(s => g.add(pos(caixa(0.08, 2.14, 0.12, COR.branco, 'batente', 0.01), s * 0.5, 1.07, 0)));
    g.add(pos(caixa(1.08, 0.08, 0.12, COR.branco, 'batente', 0.01), 0, 2.14, 0));
    const folha = grupo('folha'); pos(folha, -0.45, 0, 0);    // pivot na dobradiça
    folha.add(pos(caixa(0.9, 2.08, 0.045, COR.madeira, 'madeira', 0.012), 0.45, 1.04, 0));
    folha.add(pos(caixa(0.4, 0.5, 0.05, COR.azul, 'visor', 0.01), 0.45, 1.55, 0)); folha.children[1].material = mat(COR.menta, { roughness: 0.2 });
    [-1, 1].forEach(s => folha.add(pos(caixa(0.14, 0.03, 0.03, COR.aco, 'macaneta', 0.01), 0.78, 1.0, s * 0.04)));
    g.add(folha); return g;
  };

  // ---------- LOJA: SINO, BALCÃO, MOSTRUÁRIO ----------
  M.sino_balcao = () => {
    const g = grupo('sino_balcao');
    g.add(pos(cilindro(0.064, 0.016, COR.madeiraEsc, 'base', 0.006, 20), 0, 0.008, 0));
    const pts = []; for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * 0.06 + 0.0001, Math.sin(a) * 0.065)); }
    const cup = new THREE.Mesh(new THREE.LatheGeometry(pts.reverse(), 20), mat(COR.latao, { metalness: 0.3, roughness: 0.4 })); cup.name = 'cupula'; g.add(pos(cup, 0, 0.016, 0));
    g.add(pos(cilindro(0.008, 0.03, COR.grafite, 'pino', 0.003, 8), 0, 0.1, 0));
    g.add(pos(cilindro(0.016, 0.01, COR.grafite, 'botao', 0.004, 12), 0, 0.118, 0));
    return g;
  };
  M.balcao_loja = () => {
    const g = grupo('balcao_loja'), L = 9, D = 0.7, H = 1.1;
    g.add(pos(caixa(L + 0.1, 0.05, D + 0.12, COR.madeiraEsc, 'tampo', 0.015), 0, H - 0.025, 0.03));
    g.add(pos(caixa(L, H - 0.15, D - 0.04, COR.madeira, 'corpo', 0.02), 0, (H - 0.15) / 2 + 0.1, 0));
    g.add(pos(caixa(L - 0.04, 0.1, D - 0.1, COR.preto, 'rodape', 0.01), 0, 0.05, 0.02));
    // ripas verticais na frente do cliente (lado -Z)
    for (let i = 0; i < 30; i++) g.add(pos(caixa(0.22, H - 0.25, 0.02, i % 2 ? COR.madeira : COR.madeiraEsc, 'ripa', 0.006), -L / 2 + 0.16 + i * (L - 0.32) / 29, (H - 0.25) / 2 + 0.12, -D / 2 - 0.005));
    // prateleira interna (lado do atendente, +Z)
    g.add(pos(caixa(L - 0.2, 0.03, 0.3, COR.madeiraEsc, 'prateleira', 0.008), 0, 0.5, D / 2 - 0.2));
    return g;
  };
  M.mostruario = () => {
    const g = grupo('mostruario'), W = 2.0, H = 1.8;
    g.add(pos(caixa(W, H, 0.06, COR.madeira, 'painel', 0.02), 0, H / 2 + 0.05, -0.17));
    [-1, 1].forEach(s => g.add(pos(caixa(0.08, H + 0.05, 0.08, COR.madeiraEsc, 'montante', 0.015), s * (W / 2 - 0.04), (H + 0.05) / 2, -0.15)));
    const tex = texturaTexto(512, 96, (c, w, h) => { c.fillStyle = '#2b8a7e'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = 'bold 52px sans-serif'; c.textAlign = 'center'; c.fillText('PARECIS TELHA', w / 2, 66); });
    const topo = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.2, 0.3), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.8 })); topo.name = 'letreiro'; g.add(pos(topo, 0, H - 0.12, -0.135));
    // amostras: TP-40, rufo, chapa lisa — pedaços de 0,5 m presos no painel
    const amostras = [
      ['amostra_tp40', () => { const m = extrudar(chapaPerfil(linhaTP40(), 0.005), 0.36, COR.galvalume, 'amostra_tp40'); return m; }],
      ['amostra_tp40_azul', () => extrudar(chapaPerfil(linhaTP40(), 0.005), 0.36, COR.azul, 'amostra_tp40_azul')],
      ['amostra_tp40_vermelha', () => extrudar(chapaPerfil(linhaTP40(), 0.005), 0.36, COR.vermelho, 'amostra_tp40_vermelha')]
    ];
    amostras.forEach((a, i) => { const m = a[1](); m.scale.set(0.8, 1.6, 1); rot(m, Math.PI / 2, 0, 0); pos(m, -0.1, 1.38 - i * 0.43, -0.13); g.add(m); });
    const pt = texturaTexto(256, 128, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#2b2f36'; c.font = 'bold 30px sans-serif'; c.fillText('TP-40 ....... m²', 14, 44); c.fillText('Rufo ......... m', 14, 84); c.fillText('Calha ....... m', 14, 120); });
    const preco = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshStandardMaterial({ map: pt, roughness: 0.9 })); preco.name = 'tabela_preco'; g.add(pos(preco, 0.62, 0.32, -0.135));
    return g;
  };

  // ---------- PAINEL CLP EM PÉ (família única das máquinas) ----------
  M.clp_padrao = () => {
    const g = grupo('clp_padrao');
    g.add(pos(caixa(0.4, 0.04, 0.3, COR.grafite, 'base', 0.01), 0, 0.02, 0));
    g.add(pos(caixa(0.12, 0.9, 0.12, COR.tealEsc, 'coluna', 0.02), 0, 0.47, 0));
    g.add(pos(caixa(0.56, 0.5, 0.24, COR.teal, 'gabinete', 0.04), 0, 1.15, 0));
    const tela = new THREE.Mesh(new THREE.PlaneGeometry(0.28, 0.19), mat(0x1c3b44, { emissive: 0x2a7f8f, emissiveIntensity: 0.6, roughness: 0.3 })); tela.name = 'tela'; g.add(pos(tela, -0.08, 1.22, 0.121));
    g.add(pos(caixa(0.32, 0.23, 0.01, COR.preto, 'moldura_tela', 0.008), -0.08, 1.22, 0.117));
    [[COR.verde, 'botao_liga'], [COR.vermelho, 'botao_desliga']].forEach((b, i) => g.add(pos(rot(cilindro(0.022, 0.02, b[0], b[1], 0.006, 14), Math.PI / 2, 0, 0), 0.17, 1.27 - i * 0.08, 0.125)));
    g.add(pos(rot(cilindro(0.035, 0.03, COR.vermelho, 'emergencia', 0.012, 16), Math.PI / 2, 0, 0), 0.17, 1.03, 0.13));
    g.add(pos(caixa(0.06, 0.06, 0.02, COR.amarelo, 'fundo_emergencia', 0.006), 0.17, 1.03, 0.12));
    // torre de sinalização: verde (produzindo), âmbar (alerta), vermelho (falha)
    g.add(pos(cilindro(0.012, 0.06, COR.grafite, 'haste_torre', 0.004, 8), 0.2, 1.43, -0.05));
    [[COR.vermelho, 'luz_vermelha'], [COR.amarelo, 'luz_ambar'], [COR.verde, 'luz_verde']].forEach((l, i) => {
      g.add(pos(cilindro(0.032, 0.055, l[0], l[1], 0.008, 14), 0.2, 1.61 - i * 0.058, -0.05));
    });
    g.add(pos(cilindro(0.03, 0.015, COR.grafite, 'tampa_torre', 0.006, 14), 0.2, 1.645, -0.05));
    return g;
  };
})();
