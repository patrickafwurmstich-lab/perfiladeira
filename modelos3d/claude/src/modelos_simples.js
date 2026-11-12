// =====================================================================
// modelos_simples.js — modelos do GRUPO 1 feitos em código pelo Claude
// Revisão 2: correções da crítica do ChatGPT (12/11) + conferências do Claude.
// Cada função devolve um THREE.Group com o nome = ID da ficha do jogo.
// Peças que o jogo anima ou troca têm nome próprio (ver comentários).
// =====================================================================
(function () {
  const { COR, mat, malha, caixa, cilindro, anel, extrudar, chapaPerfil, texturaTexto, grupo, pos, rot } = OF;
  const M = OF.MODELOS;
  const CINTA = 0x34557a;   // cinta de aço azul-escura (discreta)

  function plano(w, h, desenhar, tw, th, nome) {
    const t = texturaTexto(tw || 512, th || 256, desenhar);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 })); m.name = nome || 'face'; return m;
  }
  function tubo(pontos, r, cor, nome, seg) {
    const curva = new THREE.CatmullRomCurve3(pontos.map(p => new THREE.Vector3(p[0], p[1], p[2])));
    return malha(new THREE.TubeGeometry(curva, seg || 24, r, 8, false), cor, nome);
  }
  function parafuso(r) { return rot(cilindro(r || 0.012, 0.006, COR.aco, 'parafuso', 0.003, 8), Math.PI / 2, 0, 0); }

  // ---------- perfil TP-40/980 (catálogo Eternit TMTP 40: útil 980, total 1.040, passo 196, altura ~40 mm, 5 ondas) ----------
  function linhaTP40() {
    const h = 0.04, topo = 0.016, base = 0.048, L = [[-0.52, 0]];
    for (let k = 0; k < 5; k++) { const c = -0.392 + k * 0.196; L.push([c - base, 0], [c - topo, h], [c + topo, h], [c + base, 0]); }
    L.push([0.488, 0], [0.52, h]);     // meia-onda de sobreposição
    return L;
  }
  OF.linhaTP40 = linhaTP40;
  function telha(comp, cor, nome) {
    const m = extrudar(chapaPerfil(linhaTP40(), 0.004), comp, cor || COR.galvalume, nome || 'telha');
    m.rotation.y = Math.PI / 2;  // comprimento no eixo X
    return m;
  }
  function pontalete(comp) { return caixa(0.08, 0.06, comp, COR.madeira, 'pontalete', 0.01); }
  function cintaVertical(x, altura, larg, nome) {   // cinta que abraça a pilha (3 lados visíveis)
    const g = grupo(nome || 'cinta');
    g.add(pos(caixa(0.025, 0.004, larg + 0.01, CINTA, 'topo', 0), x, altura, 0));
    [-1, 1].forEach(s => g.add(pos(caixa(0.025, altura - 0.03, 0.004, CINTA, 'lado', 0), x, (altura + 0.03) / 2, s * (larg / 2 + 0.005))));
    return g;
  }

  // ---------- BOBINAS — diâmetro calculado pelo peso ----------
  // aço 7.850 kg/m³, largura 1,20 m, furo 508 mm: 1 t → Ø ≈ 0,63 m | 2 t → Ø ≈ 0,73 m
  function bobina(id, kg, larg) {
    const ri = 0.254, area = kg / 7850 / larg, re = Math.sqrt(area / Math.PI + ri * ri), diam = re * 2;
    const g = grupo(id);
    g.add(rot(anel(ri, re, larg, COR.galvalume, 'corpo', 36, 0.015), Math.PI / 2, 0, 0));
    g.add(rot(anel(ri - 0.004, ri + 0.002, larg - 0.01, COR.grafite, 'furo'), Math.PI / 2, 0, 0));   // contraste do furo
    // camadas enroladas nas faces laterais (anéis finos mais escuros)
    [0.35, 0.55, 0.78].forEach(f => [-1, 1].forEach(s => {
      const r = ri + (re - ri) * f;
      g.add(pos(rot(anel(r - 0.003, r, 0.003, COR.galvEsc, 'espira', 28, 0.001), Math.PI / 2, 0, 0), 0, 0, s * (larg / 2 + 0.001)));
    }));
    // 2 cintas circunferenciais estreitas + 2 pelo furo
    [[-larg * 0.32, 0.012], [larg * 0.3, -0.02]].forEach(([z, inc]) => g.add(pos(rot(anel(re - 0.001, re + 0.005, 0.025, CINTA, 'cinta', 36, 0.002), Math.PI / 2 + inc, 0, 0), 0, 0, z)));
    [Math.PI / 4, -Math.PI * 3 / 4].forEach(a => {
      const hz = larg / 2 + 0.005;
      const c = extrudar(chapaPerfil([[ri - 0.006, -hz], [re + 0.005, -hz], [re + 0.005, hz], [ri - 0.006, hz], [ri - 0.006, -hz + 0.002]], 0.005), 0.025, CINTA, 'cinta_furo');
      c.rotation.set(Math.PI / 2, 0, 0); const piv = grupo('cinta_furo', [c]); piv.rotation.z = a; g.add(piv);
    });
    g.add(pos(rot(caixa(0.018, 0.01, larg - 0.02, COR.galvEsc, 'ponta_chapa', 0.003), 0, 0, -0.5), re * 0.88, re * 0.47, 0));
    // etiqueta de identificação com o peso
    const et = plano(0.2, 0.12, (c, w, h) => { c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, w, h); c.fillStyle = '#2b2f36'; c.font = 'bold 120px sans-serif'; c.textAlign = 'center'; c.fillText(kg / 1000 + ' t', w / 2, 150); c.font = 'bold 44px sans-serif'; c.fillText('GL 0,43 · 1200', w / 2, 225); }, 512, 256, 'etiqueta');
    et.rotation.x = -Math.PI / 2; g.add(pos(et, 0, re + 0.006, larg / 2 - 0.2));   // adesivo em cima da bobina
    g.children.forEach(c => c.position.y += re + 0.005);
    g.userData.diametro = +diam.toFixed(3);
    return g;
  }
  M.bobina_1t = () => bobina('bobina_1t', 1000, 1.2);
  M.bobina_2t = () => bobina('bobina_2t', 2000, 1.2);

  // ---------- MESA DE SAÍDA (6 x 1,4 m, rolos livres, altura 0,8 m) ----------
  M.mesa_saida = () => {
    const g = grupo('mesa_saida'), L = 6, W = 1.4, H = 0.8;
    [-1, 1].forEach(s => {
      g.add(pos(caixa(L, 0.18, 0.1, COR.teal, 'longarina'), 0, H - 0.09, s * (W / 2 - 0.05)));
      g.add(pos(caixa(L - 0.3, 0.07, 0.07, COR.tealEsc, 'travamento_baixo'), 0, 0.22, s * (W / 2 - 0.05)));
      g.add(pos(caixa(L, 0.06, 0.02, COR.amarelo, 'guia_lateral', 0.006), 0, H + 0.03, s * (W / 2 - 0.1)));
    });
    for (let i = 0; i < 4; i++) {
      const x = -L / 2 + 0.3 + i * (L - 0.6) / 3;
      [-1, 1].forEach(s => {
        g.add(pos(caixa(0.1, H - 0.18, 0.1, COR.tealEsc, 'pe'), x, (H - 0.18) / 2 + 0.02, s * (W / 2 - 0.05)));
        g.add(pos(caixa(0.18, 0.03, 0.18, COR.grafite, 'sapata', 0.01), x, 0.015, s * (W / 2 - 0.05)));
        [-0.06, 0.06].forEach(d => g.add(pos(cilindro(0.014, 0.012, COR.aco, 'parafuso', 0.004, 8), x + d, 0.034, s * (W / 2 - 0.05) + d)));
      });
      g.add(pos(caixa(0.07, 0.07, W - 0.12, COR.tealEsc, 'travessa'), x, 0.22, 0));
    }
    for (let i = 0; i < 14; i++) g.add(pos(rot(cilindro(0.055, W - 0.24, COR.aco, 'rolo', 0.012, 10), Math.PI / 2, 0, 0), -L / 2 + 0.2 + i * (L - 0.4) / 13, H - 0.01, 0));
    g.add(pos(caixa(0.12, 0.26, W, COR.amarelo, 'batente'), L / 2 - 0.06, H + 0.1, 0));
    for (let i = 0; i < 4; i++) g.add(pos(caixa(0.124, 0.06, 0.16, COR.preto, 'faixa', 0), L / 2 - 0.06, H + 0.1, -W / 2 + 0.2 + i * 0.34));
    return g;
  };

  // ---------- BOTOEIRA PENDENTE (cabe na mão: 13 cm de largura) ----------
  M.botoeira = () => {
    const g = grupo('botoeira'), W = 0.13, H = 0.32, D = 0.09;
    g.add(pos(caixa(W, H, D, COR.amarelo, 'corpo', 0.03), 0, H / 2, 0));
    g.add(pos(caixa(W + 0.006, 0.09, D + 0.006, COR.borracha, 'pegada', 0.025), 0, 0.06, 0));
    g.add(pos(caixa(W + 0.004, 0.035, D + 0.004, COR.grafite, 'tampa', 0.015), 0, H - 0.005, 0));
    // painel com símbolos (↑ ↓ ← → e frente/trás)
    const painel = plano(0.1, 0.17, (c, w, h) => {
      c.fillStyle = '#2b2f36'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.font = 'bold 54px sans-serif'; c.textAlign = 'center';
      ['▲', '▼', '◀', '▶', '⬆', '⬇'].forEach((s, i) => c.fillText(s, (i % 2 ? 0.75 : 0.25) * w, (0.23 + Math.floor(i / 2) * 0.32) * h));
    }, 256, 432, 'painel');
    g.add(pos(painel, 0, 0.2, D / 2 + 0.002));
    for (let i = 0; i < 6; i++) g.add(pos(rot(anel(0.012, 0.019, 0.01, COR.preto, 'aro_botao', 12, 0.003), Math.PI / 2, 0, 0), (i % 2 ? 0.025 : -0.025), 0.2 + 0.085 - 0.04 - Math.floor(i / 2) * 0.054 + 0.012, D / 2 + 0.006));
    // emergência grande, vermelha, no topo-frente
    g.add(pos(cilindro(0.016, 0.02, COR.amarelo, 'base_emergencia', 0.004, 12), 0, H + 0.02, 0.015));
    g.add(pos(cilindro(0.03, 0.022, COR.vermelho, 'emergencia', 0.01, 16), 0, H + 0.04, 0.015));
    // cabo preto com curva suave saindo de trás do topo
    g.add(pos(cilindro(0.013, 0.03, COR.preto, 'prensa_cabo', 0.004, 10), 0, H + 0.015, -0.025));
    g.add(tubo([[0, H + 0.03, -0.025], [0, H + 0.12, -0.04], [0.02, H + 0.25, -0.01], [0, H + 0.4, 0]], 0.007, COR.preto, 'cabo', 20));
    return g;
  };

  // ---------- MANDRIL (aríete de bobina encaixado no porta-garfos) ----------
  M.mandril = () => {
    const g = grupo('mandril'), hc = 0.22;   // altura do centro do aríete
    g.add(pos(caixa(0.1, 0.44, 0.52, COR.amarelo, 'placa_traseira', 0.025), -0.55, 0.22, 0));
    // ganchos superior e inferior que prendem no porta-garfos
    g.add(pos(caixa(0.08, 0.05, 0.46, COR.grafite, 'gancho_superior', 0.012), -0.63, 0.42, 0));
    g.add(pos(caixa(0.06, 0.04, 0.46, COR.grafite, 'gancho_inferior', 0.01), -0.62, 0.03, 0));
    // colar/batente de segurança (a bobina para aqui)
    g.add(pos(rot(cilindro(0.17, 0.05, COR.amarelo, 'batente', 0.015, 20), 0, 0, Math.PI / 2), -0.475, hc, 0));
    // reforços triangulares na união
    [-1, 1].forEach(s => { const tri = s > 0 ? [[0, 0], [0.2, 0], [0, 0.15]] : [[0, 0], [0, -0.15], [0.2, 0]]; g.add(pos(extrudar(tri, 0.03, COR.amarelo, 'reforco'), -0.5, hc + s * 0.09, 0)); });
    // aríete de aço (cabe no furo de 508 mm com folga) e ponta cônica arredondada
    g.add(pos(rot(cilindro(0.09, 0.82, COR.aco, 'ariete', 0.02, 18), 0, 0, Math.PI / 2), -0.04, hc, 0));
    const pts = [[0, 0.09], [0.08, 0.075], [0.13, 0.04], [0.15, 0]].map(p => new THREE.Vector2(p[1] + 0.0001, p[0]));
    const ponta = new THREE.Mesh(new THREE.LatheGeometry(pts, 18), mat(COR.amarelo)); ponta.name = 'ponta'; rot(ponta, 0, 0, -Math.PI / 2); g.add(pos(ponta, 0.37, hc, 0));
    return g;
  };

  // ---------- BERÇO DE BOBINA (2 selas em V, borracha, batentes) ----------
  M.berco_bobina = () => {
    const g = grupo('berco_bobina'), L = 1.6, W = 1.6, H = 0.5;   // bobina deita com o eixo no X
    [-1, 1].forEach(s => g.add(pos(caixa(L, 0.12, 0.1, COR.tealEsc, 'longarina'), 0, 0.06, s * 0.55)));
    [-0.5, 0.5].forEach(x => {
      g.add(pos(caixa(0.22, 0.1, W, COR.tealEsc, 'travessa'), x, 0.05, 0));
      // sela em V: perfil no plano YZ extrudado 0,2 m em X
      const v = [[-0.78, 0.1], [0.78, 0.1], [0.78, H], [0.62, H], [0.1, 0.24], [-0.1, 0.24], [-0.62, H], [-0.78, H]];
      const sela = extrudar(v, 0.26, COR.teal, 'sela', 0.012); rot(sela, 0, Math.PI / 2, 0); pos(sela, x, 0, 0); g.add(sela);
      [-1, 1].forEach(s => {
        const ang = Math.atan2(H - 0.24, 0.52), pad = caixa(0.28, 0.025, 0.54, COR.borracha, 'borracha', 0.006);
        pad.rotation.x = -s * ang; pos(pad, x, 0.383, s * 0.36); g.add(pad);
        g.add(pos(caixa(0.28, 0.08, 0.1, COR.amarelo, 'batente', 0.012), x, H + 0.04, s * 0.71));
        g.add(pos(rot(extrudar([[0, 0], [0.22, 0], [0, 0.22]], 0.04, COR.tealEsc, 'reforco'), 0, s > 0 ? -Math.PI / 2 : Math.PI / 2, 0), x, 0.1, s * 0.56));
        [-0.08, 0.08].forEach(dx => g.add(pos(rot(cilindro(0.016, 0.012, COR.aco, 'parafuso', 0.004, 8), 0, 0, 0), x + dx, 0.106, s * 0.55)));
      });
    });
    return g;
  };

  // ---------- TELHA E PILHAS ----------
  M.telha_tp40 = () => grupo('telha_tp40', [telha(1.0)]);   // 1 m: o jogo escala no X (MultiMesh)
  M.pilha_telhas = () => {
    const g = grupo('pilha_telhas'), L = 6, n = 20;
    [-2.4, 0, 2.4].forEach(x => g.add(pos(pontalete(1.12), x, 0.03, 0)));
    for (let i = 0; i < n; i++) { const t = telha(L, i % 2 ? COR.galvEsc : COR.galvalume, 'telha'); pos(t, ((i * 7) % 5 - 2) * 0.006 + (i === 13 ? 0.05 : 0), 0.06 + i * 0.011, ((i * 3) % 5 - 2) * 0.004); if (i === 13) t.rotation.y += 0.015; if (i === 6) t.rotation.y -= 0.01; g.add(t); }
    [-1.8, 1.8].forEach(x => g.add(cintaVertical(x, 0.06 + n * 0.011 + 0.05, 1.06)));
    return g;
  };
  M.pilha_chapas = () => {
    const g = grupo('pilha_chapas'), L = 3, W = 1.2, n = 16;
    [-1.1, 0, 1.1].forEach(x => g.add(pos(pontalete(W), x, 0.03, 0)));
    for (let i = 0; i < n; i++) { const c = caixa(L, 0.01, W, i % 2 ? COR.galvalume : COR.galvEsc, 'chapa', 0); pos(c, ((i * 7) % 5 - 2) * 0.006, 0.065 + i * 0.012, ((i * 3) % 5 - 2) * 0.005); if (i === 9) c.rotation.y = 0.02; g.add(c); }
    [-0.9, 0.9].forEach(x => g.add(cintaVertical(x, 0.06 + n * 0.012 + 0.01, W)));
    return g;
  };
  M.pilha_rufos = () => {
    const g = grupo('pilha_rufos'), L = 3;
    const perfis = {
      L: [[-0.075, 0.075], [-0.075, 0], [0.075, 0]],
      U: [[-0.07, 0.07], [-0.05, 0.07], [-0.05, 0], [0.05, 0], [0.05, 0.07], [0.07, 0.07]],
      acabamento: [[-0.09, 0.02], [-0.07, 0], [0.02, 0], [0.02, 0.06], [0.09, 0.06], [0.09, 0.04]]
    };
    [-1.1, 0, 1.1].forEach(x => g.add(pos(pontalete(0.62), x, 0.03, 0)));
    [['L', -0.2], ['U', 0], ['acabamento', 0.2]].forEach(([k, z]) => {
      for (let i = 0; i < 5; i++) { const m = extrudar(chapaPerfil(perfis[k], 0.005), L, i % 2 ? COR.galvEsc : COR.galvalume, 'rufo_' + k); rot(m, 0, Math.PI / 2 + ((i * 5 + z * 10) % 3 - 1) * 0.006, 0); pos(m, ((i * 3) % 4 - 1.5) * 0.02, 0.062 + i * 0.014, z); g.add(m); }
    });
    [-0.9, 0.9].forEach(x => g.add(cintaVertical(x, 0.06 + 5 * 0.014 + 0.08, 0.6)));
    return g;
  };

  // ---------- PISO (contínuo), MARCAÇÕES E CABO ----------
  M.piso_concreto = () => {
    const g = grupo('piso_concreto');
    // placa de 6 x 6 m sem chanfro (as placas se emendam), 4 tons quase iguais e junta serrada em 2 bordas
    [[-1.5, -1.5, 0x9e9a92], [1.5, -1.5, 0xa29e96], [-1.5, 1.5, 0xa09c94], [1.5, 1.5, 0x9b978f]].forEach(([x, z, c]) => g.add(pos(caixa(3, 0.1, 3, c, 'placa', 0), x, -0.05, z)));
    g.add(pos(caixa(6, 0.002, 0.012, 0x7d7a74, 'junta', 0), 0, 0.001, 2.994));
    g.add(pos(caixa(0.012, 0.002, 6, 0x7d7a74, 'junta', 0), 2.994, 0.001, 0));
    return g;
  };
  // faixas pintadas de 1 m (o jogo emenda): fininhas, o piso continua aparecendo
  function faixa(id, cor) { return () => grupo(id, [pos(caixa(1, 0.003, 0.1, cor, 'tinta', 0), 0, 0.0015, 0)]); }
  M.marcacao_zona = faixa('marcacao_zona', COR.amarelo);
  M.marcacao_zona_verde = faixa('marcacao_zona_verde', COR.verde);
  M.marcacao_zona_vermelha = faixa('marcacao_zona_vermelha', COR.vermelho);
  M.marcacao_perigo = () => {
    const g = grupo('marcacao_perigo');
    g.add(pos(caixa(1, 0.003, 0.15, COR.amarelo, 'tinta', 0), 0, 0.0015, 0));
    for (let i = 0; i < 5; i++) { const t = caixa(0.07, 0.0035, 0.2, COR.preto, 'listra', 0); t.rotation.y = Math.PI / 4; pos(t, -0.4 + i * 0.2, 0.0017, 0); g.add(t); }
    g.children.slice(1).forEach(t => t.scale.set(1, 1, 0.75));
    return g;
  };
  M.cabo_eletrico = () => {
    const g = grupo('cabo_eletrico');
    g.add(pos(rot(cilindro(0.02, 1.0, COR.cinza, 'conduite', 0.004, 10), 0, 0, Math.PI / 2), 0, 0.03, 0));
    [-0.35, 0.35].forEach(x => {   // presilhas de fixação
      g.add(pos(rot(anel(0.02, 0.027, 0.03, COR.aco, 'presilha', 10, 0.003), 0, 0, Math.PI / 2), x, 0.03, 0));
      g.add(pos(caixa(0.03, 0.006, 0.08, COR.aco, 'pe_presilha', 0.002), x, 0.003, 0));
    });
    return g;
  };
  M.cabo_eletrico_curva = () => {   // cotovelo de 90°: entra em +X, sai em +Z (raio 0,15 m)
    const g = grupo('cabo_eletrico_curva'), r = 0.15, y = 0.03, pts = [[-0.15, y, 0]];
    for (let i = 0; i <= 8; i++) { const a = (i / 8) * Math.PI / 2; pts.push([r * Math.sin(a), y, r * (1 - Math.cos(a))]); }
    pts.push([r, y, r + 0.15]);
    g.add(tubo(pts, 0.02, COR.cinza, 'conduite', 28));
    return g;
  };

  // ---------- PLACAS ----------
  M.placa_dias_sem_acidente = () => {
    const g = grupo('placa_dias_sem_acidente'), W = 1.5, H = 0.8;
    g.add(caixa(W + 0.04, H + 0.04, 0.025, COR.branco, 'moldura', 0.01));
    g.add(pos(plano(W, H, (c, w, h) => {
      c.fillStyle = '#2f8f4e'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.textAlign = 'center';
      c.font = 'bold 64px sans-serif'; c.fillText('ESTAMOS HÁ', w / 2, 80); c.fillText('DIAS SEM ACIDENTES', w / 2, 470);
      c.fillStyle = '#f4f1ea'; c.fillRect(w / 2 - 210, 110, 420, 290);
    }, 1024, 546), 0, 0, 0.0135));
    const num = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.42), mat(COR.branco)); num.name = 'numero'; g.add(pos(num, 0, 0.03, 0.015));   // o jogo escreve o número aqui
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => g.add(pos(parafuso(), sx * (W / 2 - 0.03), sy * (H / 2 - 0.03), 0.016)));
    g.children.forEach(c => c.position.y += 2.2);
    return g;
  };
  M.placa_parede = () => {
    const g = grupo('placa_parede'), W = 0.6, H = 0.42;
    g.add(caixa(W, H, 0.008, COR.amarelo, 'chapa', 0.008));
    g.add(pos(plano(W - 0.02, H - 0.02, (c, w, h) => {
      c.fillStyle = '#f5c84b'; c.fillRect(0, 0, w, h); c.strokeStyle = '#2b2f36'; c.lineWidth = 10; c.strokeRect(12, 12, w - 24, h - 24);
      c.fillStyle = '#2b2f36'; c.beginPath(); c.moveTo(w * 0.22, 40); c.lineTo(w * 0.22 + 85, 190); c.lineTo(w * 0.22 - 85, 190); c.closePath(); c.fill();
      c.fillStyle = '#f5c84b'; c.font = 'bold 110px sans-serif'; c.textAlign = 'center'; c.fillText('!', w * 0.22, 178);
      c.fillStyle = '#2b2f36'; c.textAlign = 'left'; c.font = 'bold 66px sans-serif'; c.fillText('USE EPI', w * 0.43, 120); c.font = 'bold 34px sans-serif'; c.fillText('CAPACETE', w * 0.43, 175); c.fillText('E BOTINA', w * 0.43, 215);
    }, 512, 358), 0, 0, 0.0045));
    [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([sx, sy]) => g.add(pos(parafuso(0.009), sx * (W / 2 - 0.025), sy * (H / 2 - 0.025), 0.006)));
    g.children.forEach(c => c.position.y += 1.7);
    return g;
  };

  // ---------- PORTA DO ESCRITÓRIO (abre para dentro, dobradiça em x = -0,45) ----------
  M.porta_escritorio = () => {
    const g = grupo('porta_escritorio'), cor = 0x6f8fa6;
    [-1, 1].forEach(s => g.add(pos(caixa(0.08, 2.14, 0.14, COR.branco, 'batente', 0.01), s * 0.5, 1.07, 0)));
    g.add(pos(caixa(1.08, 0.08, 0.14, COR.branco, 'batente', 0.01), 0, 2.14, 0));
    const folha = grupo('folha'); pos(folha, -0.45, 0, 0);
    folha.add(pos(caixa(0.9, 2.08, 0.045, cor, 'chapa', 0.012), 0.45, 1.04, 0));
    // visor de vidro com moldura
    [[0.42, 0.04, 0, 1.79], [0.42, 0.04, 0, 1.31], [0.04, 0.52, -0.19, 1.55], [0.04, 0.52, 0.19, 1.55]].forEach(([w, h, dx, y]) => folha.add(pos(caixa(w, h, 0.055, COR.grafite, 'moldura_visor', 0.006), 0.45 + dx, y, 0)));
    const vidro = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.46, 0.012), new THREE.MeshStandardMaterial({ color: new THREE.Color(COR.menta).convertSRGBToLinear(), roughness: 0.15, transparent: true, opacity: 0.55 })); vidro.name = 'vidro'; folha.add(pos(vidro, 0.45, 1.55, 0));
    // maçaneta tipo alavanca + fechadura dos dois lados
    [-1, 1].forEach(s => {
      folha.add(pos(caixa(0.05, 0.18, 0.012, COR.aco, 'espelho', 0.004), 0.8, 1.0, s * 0.028));
      folha.add(pos(caixa(0.13, 0.025, 0.025, COR.aco, 'macaneta', 0.01), 0.75, 1.05, s * 0.05));
      folha.add(pos(rot(cilindro(0.01, 0.01, COR.grafite, 'fechadura', 0.003, 8), Math.PI / 2, 0, 0), 0.8, 0.95, s * 0.035));
    });
    [0.25, 1.05, 1.85].forEach(y => g.add(pos(cilindro(0.012, 0.1, COR.aco, 'dobradica', 0.003, 8), -0.455, y, 0.02)));
    g.add(folha); return g;
  };

  // ---------- LOJA: SINO, BALCÃO EM MÓDULOS, MOSTRUÁRIO ----------
  M.sino_balcao = () => {
    const g = grupo('sino_balcao');
    g.add(pos(cilindro(0.058, 0.014, COR.madeiraEsc, 'base', 0.005, 16), 0, 0.007, 0));
    g.add(pos(rot(anel(0.046, 0.052, 0.006, COR.latao, 'aro', 16, 0.002), 0, 0, 0), 0, 0.017, 0));
    const pts = []; for (let i = 0; i <= 6; i++) { const a = (i / 6) * Math.PI / 2; pts.push(new THREE.Vector2(Math.cos(a) * 0.05 + 0.0001, Math.sin(a) * 0.038)); }
    const cup = new THREE.Mesh(new THREE.LatheGeometry(pts.reverse(), 16), mat(COR.latao, { metalness: 0.35, roughness: 0.35 })); cup.name = 'cupula'; g.add(pos(cup, 0, 0.018, 0));
    g.add(pos(cilindro(0.005, 0.014, COR.grafite, 'pino', 0.002, 8), 0, 0.062, 0));
    g.add(pos(cilindro(0.011, 0.007, COR.grafite, 'botao', 0.003, 10), 0, 0.071, 0));
    return g;
  };
  // módulo de 3 m: frente do cliente em -Z (painéis rebaixados), lado do atendente em +Z (gavetas e prateleira)
  function moduloBalcao(id, caixaReg) {
    const g = grupo(id), L = 3, D = 0.75, H = 1.05;
    g.add(pos(caixa(L, 0.04, D + 0.08, COR.madeiraEsc, 'tampo', 0.012), 0, H - 0.02, 0.02));
    g.add(pos(caixa(L, H - 0.12, D - 0.04, COR.madeira, 'corpo', 0.015), 0, (H - 0.12) / 2 + 0.08, 0));
    g.add(pos(caixa(L - 0.04, 0.08, D - 0.12, COR.preto, 'rodape', 0), 0, 0.04, 0));
    for (let i = 0; i < 3; i++) g.add(pos(caixa(0.86, 0.66, 0.02, COR.madeiraEsc, 'painel_frente', 0.008), -1 + i, 0.5, -D / 2 + 0.005));
    for (let i = 0; i < 3; i++) {
      g.add(pos(caixa(0.8, 0.18, 0.02, COR.madeira, 'gaveta', 0.006), -1 + i, 0.82, D / 2 - 0.005));
      g.add(pos(caixa(0.14, 0.025, 0.025, COR.aco, 'puxador', 0.008), -1 + i, 0.82, D / 2 + 0.012));
    }
    g.add(pos(caixa(L - 0.2, 0.025, 0.32, COR.madeiraEsc, 'prateleira', 0.006), 0, 0.42, D / 2 - 0.19));
    if (caixaReg) {
      g.add(pos(caixa(0.42, 0.1, 0.4, COR.grafite, 'gaveta_caixa', 0.015), 0.8, H + 0.05, 0.12));
      g.add(pos(caixa(0.3, 0.02, 0.22, COR.preto, 'teclado', 0.005), 0.25, H + 0.01, 0.18));
      g.add(pos(caixa(0.36, 0.26, 0.04, COR.preto, 'monitor', 0.012), 0.25, H + 0.22, 0.32));
      g.add(pos(cilindro(0.02, 0.1, COR.grafite, 'pe_monitor', 0.005, 8), 0.25, H + 0.06, 0.33));
    }
    return g;
  }
  M.balcao_modulo = () => moduloBalcao('balcao_modulo', false);
  M.balcao_modulo_caixa = () => moduloBalcao('balcao_modulo_caixa', true);
  M.balcao_loja = () => {   // o jogo atual usa 9 m (3 módulos); dá para usar só 1 ou 2
    const g = grupo('balcao_loja');
    [-3, 0, 3].forEach((x, i) => { const m = moduloBalcao('modulo_' + (i + 1), i === 2); m.position.x = x; g.add(m); });
    return g;
  };
  M.mostruario = () => {
    const g = grupo('mostruario'), W = 2.0, H = 1.9, D = 0.4;
    [-1, 1].forEach(s => {
      g.add(pos(caixa(0.08, 0.05, D, COR.grafite, 'pe', 0.012), s * (W / 2 - 0.08), 0.025, 0));
      g.add(pos(caixa(0.06, H, 0.06, COR.grafite, 'montante', 0.012), s * (W / 2 - 0.08), H / 2, 0.02));
    });
    g.add(pos(caixa(W - 0.1, H - 0.25, 0.03, COR.madeira, 'painel', 0.01), 0, (H - 0.25) / 2 + 0.12, 0));
    g.add(pos(plano(W - 0.2, 0.22, (c, w, h) => { c.fillStyle = '#2b8a7e'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = 'bold 60px sans-serif'; c.textAlign = 'center'; c.fillText('PARECIS TELHA', w / 2, 76); }, 512, 112, 'letreiro'), 0, H - 0.08, 0.035));
    g.add(pos(caixa(W - 0.12, 0.26, 0.025, COR.tealEsc, 'fundo_letreiro', 0.008), 0, H - 0.08, 0.018));
    // 3 linhas: TP-40 natural / azul / vermelha; cada amostra em suporte, com etiqueta embaixo
    [[COR.galvalume, 'TP-40 natural'], [COR.azul, 'TP-40 azul'], [COR.vermelho, 'TP-40 vermelha']].forEach(([cor, nome], i) => {
      const y = 1.4 - i * 0.45;
      const m = extrudar(chapaPerfil(linhaTP40(), 0.004), 0.3, cor, 'amostra'); m.scale.set(0.7, 1.4, 1); rot(m, Math.PI / 2, 0, 0); pos(m, 0, y + 0.15, 0.07); g.add(m);
      g.add(pos(caixa(0.8, 0.02, 0.07, COR.grafite, 'suporte', 0.005), 0, y - 0.01, 0.05));
      g.add(pos(plano(0.42, 0.07, (c, w, h) => { c.fillStyle = '#f4f1ea'; c.fillRect(0, 0, w, h); c.fillStyle = '#2b2f36'; c.font = 'bold 30px sans-serif'; c.fillText(nome, 10, 36); }, 256, 44, 'etiqueta'), 0, y - 0.07, 0.018));
    });
    g.add(pos(plano(0.5, 0.25, (c, w, h) => { c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.fillStyle = '#2b2f36'; c.font = 'bold 28px sans-serif'; c.fillText('TP-40 ....... m²', 14, 42); c.fillText('Rufo ......... m', 14, 82); c.fillText('Calha ....... m', 14, 118); }, 256, 128, 'tabela_preco'), 0.6, 0.3, 0.018));
    return g;
  };

  // ---------- PAINEL CLP (gabinete com porta, tela, botões, ventilação e torre) ----------
  M.clp_padrao = () => {
    const g = grupo('clp_padrao'), W = 0.6, D = 0.3, y0 = 0.62, Hg = 0.95;
    // pedestal
    g.add(pos(caixa(W, 0.05, D + 0.1, COR.grafite, 'base', 0.01), 0, 0.025, 0));
    [-1, 1].forEach(s => g.add(pos(caixa(0.06, y0 - 0.05, 0.06, COR.tealEsc, 'pe', 0.01), s * (W / 2 - 0.08), (y0 + 0.05) / 2, 0)));
    // gabinete e porta separada (dobradiça à esquerda)
    g.add(pos(caixa(W, Hg, D, COR.teal, 'gabinete', 0.03), 0, y0 + Hg / 2, 0));
    const porta = grupo('porta_gabinete'); pos(porta, -W / 2 + 0.02, y0 + Hg / 2, D / 2 + 0.012);
    porta.add(pos(caixa(W - 0.06, Hg - 0.06, 0.02, COR.teal, 'chapa_porta', 0.015), W / 2 - 0.05, 0, 0));
    const tela = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.2), mat(0x1c3b44, { emissive: 0x2a7f8f, emissiveIntensity: 0.6, roughness: 0.3 })); tela.name = 'tela'; porta.add(pos(tela, W / 2 - 0.08, 0.2, 0.014));
    porta.add(pos(caixa(0.34, 0.24, 0.012, COR.preto, 'moldura_tela', 0.008), W / 2 - 0.08, 0.2, 0.008));
    [[COR.verde, 'botao_liga'], [COR.vermelho, 'botao_desliga'], [COR.amarelo, 'botao_reset']].forEach((b, i) => porta.add(pos(rot(cilindro(0.022, 0.02, b[0], b[1], 0.006, 12), Math.PI / 2, 0, 0), W / 2 - 0.2 + i * 0.09, -0.05, 0.02)));
    porta.add(pos(caixa(0.04, 0.12, 0.03, COR.grafite, 'fechadura', 0.01), W - 0.12, -0.05, 0.02));
    [-0.3, 0.3].forEach(dy => porta.add(pos(cilindro(0.012, 0.08, COR.aco, 'dobradica', 0.003, 8), -0.005, dy, -0.005)));
    g.add(porta);
    // emergência separada, em proteção amarela na lateral direita
    g.add(pos(caixa(0.03, 0.12, 0.12, COR.amarelo, 'protecao_emergencia', 0.01), W / 2 + 0.015, y0 + Hg * 0.55, 0));
    g.add(pos(rot(cilindro(0.036, 0.03, COR.vermelho, 'emergencia', 0.012, 14), 0, 0, Math.PI / 2), W / 2 + 0.04, y0 + Hg * 0.55, 0));
    // ventilação (fendas) na lateral esquerda e entrada de cabos por baixo
    for (let i = 0; i < 5; i++) g.add(pos(caixa(0.006, 0.012, 0.18, COR.preto, 'fenda', 0), -W / 2 - 0.002, y0 + 0.2 + i * 0.04, 0));
    [-0.12, 0, 0.12].forEach(x => g.add(pos(cilindro(0.018, 0.04, COR.preto, 'prensa_cabo', 0.005, 10), x, y0 - 0.02, 0)));
    // torre de sinalização: vermelho (falha), âmbar (alerta), verde (produzindo)
    const tx = W / 2 - 0.08, ty = y0 + Hg;
    g.add(pos(cilindro(0.012, 0.06, COR.grafite, 'haste_torre', 0.004, 8), tx, ty + 0.03, -0.05));
    [[COR.verde, 'luz_verde'], [COR.amarelo, 'luz_ambar'], [COR.vermelho, 'luz_vermelha']].forEach((l, i) => g.add(pos(cilindro(0.032, 0.055, l[0], l[1], 0.008, 12), tx, ty + 0.09 + i * 0.058, -0.05)));
    g.add(pos(cilindro(0.03, 0.015, COR.grafite, 'tampa_torre', 0.006, 12), tx, ty + 0.27, -0.05));
    return g;
  };
})();
