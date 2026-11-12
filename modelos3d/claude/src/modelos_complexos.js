// =====================================================================
// modelos_complexos.js — máquinas, prédios e veículos (GRUPO 1, parte 2)
// Referências: fichas do ChatGPT (Marafon TP40x980, Stockmans TP40 com 13
// estações, linhas de corte transversal Marafon/Cisa, viradeira Berlopes,
// galpões pré-moldados Santa Maria/Engeba) + fotos reais pesquisadas.
// Convenção: X = comprimento (o material anda de -X para +X), Y = altura,
// pivot no chão no centro. Peças animadas têm nome próprio.
// =====================================================================
(function () {
  const { COR, mat, malha, caixa, cilindro, anel, extrudar, chapaPerfil, texturaTexto, grupo, pos, rot } = OF;
  const M = OF.MODELOS;
  const AMARELO = COR.amarelo, TEAL = COR.teal, TEAL_E = COR.tealEsc;

  function plano(w, h, desenhar, tw, th, nome) {
    const t = texturaTexto(tw || 512, th || 256, desenhar);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.85 })); m.name = nome || 'face'; return m;
  }
  function tubo(pontos, r, cor, nome, seg) {
    const curva = new THREE.CatmullRomCurve3(pontos.map(p => new THREE.Vector3(p[0], p[1], p[2])));
    return malha(new THREE.TubeGeometry(curva, seg || 16, r, 8, false), cor, nome);
  }
  // barra reta entre dois pontos (treliças, travamentos), seção quadrada
  function barra(a, b, s, cor, nome) {
    const va = new THREE.Vector3(a[0], a[1], a[2]), vb = new THREE.Vector3(b[0], b[1], b[2]), d = vb.clone().sub(va), L = d.length();
    const m = caixa(s, L, s, cor, nome || 'barra', 0);
    m.position.copy(va.clone().add(vb).multiplyScalar(0.5));
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    return m;
  }
  // cilindro simples (sem chanfro) para eixos, rolos e discos: muito mais leve
  function cil(r, L, cor, nome, lados) { return malha(new THREE.CylinderGeometry(r, r, L, lados || 10), cor, nome); }
  function eixoZ(r, L, cor, nome, lados) { return rot(cil(r, L, cor, nome, lados), Math.PI / 2, 0, 0); }
  function eixoX(r, L, cor, nome, lados) { return rot(cil(r, L, cor, nome, lados), 0, 0, Math.PI / 2); }
  function zebra(g, x, y, z, w, h, d, n, eixo) {   // faixas pretas sobre peça amarela
    for (let i = 0; i < n; i++) {
      const t = eixo === 'z' ? caixa(w + 0.004, h * 0.9, d / (2 * n), COR.preto, 'faixa', 0) : caixa(w / (2 * n), h * 0.9, d + 0.004, COR.preto, 'faixa', 0);
      if (eixo === 'z') pos(t, x, y, z - d / 2 + (i + 0.5) * d / n); else pos(t, x - w / 2 + (i + 0.5) * w / n, y, z);
      t.rotation.y = 0; g.add(t);
    }
  }
  // parede com vãos (porta/janela) ao longo de X; vaos: [{c, larg, alt, base}]
  function parede(L, H, esp, vaos, cor, nome) {
    const g = grupo(nome || 'parede'); vaos = (vaos || []).slice().sort((a, b) => a.c - b.c);
    let x = -L / 2;
    vaos.forEach(v => {
      const x0 = v.c - v.larg / 2, x1 = v.c + v.larg / 2;
      if (x0 > x) g.add(pos(caixa(x0 - x, H, esp, cor, 'trecho', 0), (x + x0) / 2, H / 2, 0));
      if (v.base > 0) g.add(pos(caixa(v.larg, v.base, esp, cor, 'peitoril', 0), v.c, v.base / 2, 0));
      const topo = v.base + v.alt; if (topo < H) g.add(pos(caixa(v.larg, H - topo, esp, cor, 'verga', 0), v.c, (H + topo) / 2, 0));
      x = x1;
    });
    if (x < L / 2) g.add(pos(caixa(L / 2 - x, H, esp, cor, 'trecho', 0), (x + L / 2) / 2, H / 2, 0));
    return g;
  }
  function janela(larg, alt, esp, nome) {   // caixilho + vidro, centrada na origem (base em y=0)
    const g = grupo(nome || 'janela'), f = 0.05;
    [[larg, f, 0, alt - f / 2], [larg, f, 0, f / 2], [f, alt, -larg / 2 + f / 2, alt / 2], [f, alt, larg / 2 - f / 2, alt / 2], [f * 0.6, alt, 0, alt / 2]].forEach(([w, h, x, y]) => g.add(pos(caixa(w, h, esp + 0.02, COR.grafite, 'caixilho', 0.008), x, y, 0)));
    const v = new THREE.Mesh(new THREE.BoxGeometry(larg - f, alt - f, 0.01), new THREE.MeshStandardMaterial({ color: new THREE.Color(0x9fd3dc).convertSRGBToLinear(), roughness: 0.1, transparent: true, opacity: 0.45 })); v.name = 'vidro';
    g.add(pos(v, 0, alt / 2, 0)); return g;
  }

  // ---------- peças de máquina reutilizadas ----------
  function desbobinador(nome, L) {   // bobina deitada (eixo Z); mandril expansível com 4 réguas
    const g = grupo(nome || 'desbobinador'); L = L || 1.4;
    g.add(pos(caixa(L, 0.12, 1.7, TEAL_E, 'base'), 0, 0.06, 0));
    [-1, 1].forEach(s => {
      const a = extrudar([[-0.5, 0], [0.5, 0], [0.12, 1.05], [-0.12, 1.05]], 0.12, TEAL, 'cavalete', 0.012); pos(a, 0, 0.12, s * 0.8); g.add(a);
      g.add(pos(rot(cilindro(0.11, 0.16, COR.grafite, 'mancal', 0.02, 14), Math.PI / 2, 0, 0), 0, 1.12, s * 0.8));
    });
    const mand = grupo('mandril_desbobinador'); pos(mand, 0, 1.12, 0);
    mand.add(eixoZ(0.05, 1.9, COR.aco, 'eixo'));
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2, r = caixa(0.05, 0.05, 1.25, COR.aco, 'regua', 0.01); pos(r, Math.cos(a) * 0.2, Math.sin(a) * 0.2, 0); mand.add(r); }
    mand.add(pos(eixoZ(0.22, 0.04, AMARELO, 'flange', 18), 0, 0, 0.66));
    g.add(mand);
    // freio (disco amarelo do lado de fora)
    g.add(pos(eixoZ(0.2, 0.03, AMARELO, 'disco_freio', 18), 0, 1.12, -0.97));
    g.add(pos(caixa(0.12, 0.14, 0.08, COR.grafite, 'pinca_freio', 0.02), 0.15, 1.2, -0.97));
    return g;
  }
  function unidadeHidraulica(nome) {
    const g = grupo(nome || 'unidade_hidraulica');
    g.add(pos(caixa(0.8, 0.45, 0.42, TEAL_E, 'tanque', 0.03), 0, 0.3, 0));
    g.add(pos(caixa(0.84, 0.06, 0.46, COR.grafite, 'tampa', 0.01), 0, 0.55, 0));
    g.add(pos(eixoX(0.11, 0.32, COR.grafite, 'motor', 14), -0.12, 0.7, 0));
    g.add(pos(eixoX(0.115, 0.06, COR.preto, 'tampa_ventilador', 14), -0.3, 0.7, 0));
    g.add(pos(cilindro(0.05, 0.12, COR.aco, 'filtro', 0.01, 10), 0.25, 0.64, 0.1));
    g.add(pos(rot(cilindro(0.045, 0.02, COR.branco, 'manometro', 0.006, 12), Math.PI / 2, 0, 0), 0.25, 0.42, 0.215));
    [-0.03, 0.04].forEach(h => g.add(pos(caixa(0.03, 0.03, 0.03, COR.preto, 'pe', 0), 0, 0.03, 0)));
    return g;
  }
  function guilhotinaHidraulica(nome, W, H) {   // pórtico com lâmina que desce (nó 'lamina')
    const g = grupo(nome || 'guilhotina_hidraulica'); W = W || 1.6; H = H || 1.7;
    g.add(pos(caixa(1.1, 0.2, W + 0.3, TEAL_E, 'base'), 0, 0.1, 0));
    g.add(pos(caixa(0.6, 0.7, W, TEAL, 'mesa_inferior', 0.03), 0, 0.55, 0));
    g.add(pos(caixa(0.2, 0.05, W - 0.1, COR.aco, 'contra_faca', 0.005), 0.12, 0.92, 0));
    [-1, 1].forEach(s => g.add(pos(caixa(0.5, H, 0.22, TEAL, 'coluna', 0.04), 0, H / 2, s * (W / 2 + 0.11))));
    g.add(pos(caixa(0.55, 0.3, W + 0.44, TEAL, 'travessa', 0.04), 0, H - 0.15, 0));
    const lam = grupo('lamina'); pos(lam, 0, 1.18, 0);
    lam.add(caixa(0.18, 0.32, W - 0.04, AMARELO, 'porta_lamina', 0.02));
    lam.add(pos(caixa(0.04, 0.06, W - 0.06, COR.aco, 'faca', 0.004), 0.08, -0.17, 0));
    zebra(lam, 0, 0.02, 0, 0.184, 0.12, W - 0.04, 5, 'z');
    g.add(lam);
    [-W / 3, W / 3].forEach(z => {
      g.add(pos(cilindro(0.09, 0.42, COR.grafite, 'cilindro_hidraulico', 0.02, 14), 0, H + 0.21, z));
      g.add(pos(cilindro(0.035, 0.3, COR.aco, 'haste', 0.008, 10), 0, H - 0.08, z));
    });
    // proteção frontal (grade amarela) na saída
    [[0.03, 0.5, W, 0.33, 1.3]].forEach(([w, h, d, x, y]) => {
      g.add(pos(caixa(w, 0.04, d, AMARELO, 'protecao', 0.006), x, y + h / 2, 0));
      g.add(pos(caixa(w, 0.04, d, AMARELO, 'protecao', 0.006), x, y - h / 2, 0));
      for (let i = 0; i < 6; i++) g.add(pos(caixa(w, h, 0.03, AMARELO, 'grade', 0), x, y, -d / 2 + (i + 0.5) * d / 6));
    });
    return g;
  }

  // ---------- 1) PERFILADEIRA TP-40 (16 m) ----------
  M.perfiladeira_tp40 = () => {
    const g = grupo('perfiladeira_tp40'), ESTACOES = 13, X0 = -4.9, PASSO = 0.75, YI = 0.86, YS = 1.14;
    g.add(pos(desbobinador('desbobinador', 1.4), -7.2, 0, 0));
    // mesa de entrada com guias laterais
    const ent = grupo('mesa_entrada'); pos(ent, -5.75, 0, 0);
    ent.add(pos(caixa(0.9, 0.08, 1.3, TEAL, 'tampo', 0.01), 0, 0.84, 0));
    [-1, 1].forEach(s => { ent.add(pos(caixa(0.08, 0.8, 0.08, TEAL_E, 'pe', 0.01), 0, 0.4, s * 0.55)); ent.add(pos(cilindro(0.035, 0.14, AMARELO, 'guia', 0.008, 10), 0.25, 0.95, s * 0.62)); ent.add(pos(cilindro(0.035, 0.14, AMARELO, 'guia', 0.008, 10), -0.25, 0.95, s * 0.62)); });
    for (let i = 0; i < 3; i++) ent.add(pos(eixoZ(0.03, 1.16, COR.aco, 'rolete'), -0.3 + i * 0.3, 0.9, 0));
    g.add(ent);
    // chassi do corpo formador
    const L = ESTACOES * PASSO + 0.4, XC = X0 + (ESTACOES - 1) * PASSO / 2;
    [-1, 1].forEach(s => g.add(pos(caixa(L, 0.3, 0.16, TEAL_E, 'longarina'), XC, 0.35, s * 0.55)));
    for (let i = 0; i < 6; i++) { const x = X0 - 0.2 + i * L / 5; [-1, 1].forEach(s => g.add(pos(caixa(0.22, 0.2, 0.22, COR.grafite, 'pe', 0.02), x, 0.1, s * 0.55))); g.add(pos(caixa(0.12, 0.12, 1.0, TEAL_E, 'travessa', 0), x, 0.3, 0)); }
    g.add(pos(caixa(L, 0.05, 1.3, TEAL, 'mesa_base', 0.01), XC, 0.525, 0));
    // estações: placas laterais, eixos superior/inferior e rolos que vão fechando as ondas
    const ondas = [-0.392, -0.196, 0, 0.196, 0.392];
    const rolos = grupo('rolos');   // o jogo gira os filhos 'rolo_inf_*' e 'rolo_sup_*'
    for (let e = 0; e < ESTACOES; e++) {
      const x = X0 + e * PASSO, f = (e + 1) / ESTACOES;
      [-1, 1].forEach(s => g.add(pos(caixa(0.32, 0.8, 0.06, TEAL, 'castelo', 0.015), x, 0.95, s * 0.64)));
      g.add(pos(caixa(0.34, 0.08, 1.34, TEAL_E, 'tampa_castelo', 0.015), x, 1.39, 0));
      const inf = grupo('rolo_inf_' + e), sup = grupo('rolo_sup_' + e); pos(inf, x, YI, 0); pos(sup, x, YS, 0);
      inf.add(eixoZ(0.045, 1.5, COR.aco, 'eixo')); sup.add(eixoZ(0.04, 1.5, COR.aco, 'eixo'));
      inf.add(eixoZ(0.085, 1.1, COR.galvEsc, 'corpo', 12)); sup.add(eixoZ(0.07, 1.1, COR.galvEsc, 'corpo', 12));
      // a onda nasce do centro para as bordas: estações iniciais formam só as ondas do meio
      ondas.forEach((z, k) => {
        const ativa = Math.abs(k - 2) <= Math.ceil(f * 2.4);
        if (!ativa) return;
        const h = 0.012 + 0.03 * f;
        inf.add(pos(eixoZ(0.085 + h, 0.06, COR.aco, 'disco', 12), 0, 0, z));
        sup.add(pos(eixoZ(0.07 + h * 0.5, 0.1, COR.aco, 'disco', 12), 0, 0, z + 0.098 * (z >= 0 ? 1 : -1) * (k === 2 ? 0 : 1)));
      });
      // engrenagens do lado da transmissão (+Z), atrás da proteção
      inf.add(pos(eixoZ(0.11, 0.03, COR.grafite, 'engrenagem', 14), 0, 0, 0.78)); sup.add(pos(eixoZ(0.1, 0.03, COR.grafite, 'engrenagem', 14), 0, 0, 0.78));
      rolos.add(inf); rolos.add(sup);
    }
    g.add(rolos);
    // proteção amarela das correntes (lado +Z) com faixas e motorredutor por baixo
    const prot = pos(caixa(L, 0.5, 0.14, AMARELO, 'protecao_correntes', 0.03), XC, 1.0, 0.86); g.add(prot);
    zebra(g, XC, 1.2, 0.86, L, 0.08, 0.144, 10, 'x');
    g.add(pos(eixoX(0.17, 0.55, COR.grafite, 'motor', 16), XC - 0.4, 0.32, 0.92));
    g.add(pos(eixoX(0.18, 0.08, COR.preto, 'tampa_ventilador', 16), XC - 0.72, 0.32, 0.92));
    g.add(pos(caixa(0.42, 0.42, 0.34, TEAL_E, 'redutor', 0.04), XC + 0.08, 0.34, 0.92));
    g.add(pos(caixa(0.3, 0.6, 0.12, AMARELO, 'protecao_corrente_motor', 0.03), XC + 0.08, 0.72, 1.0));
    // placa de identificação
    g.add(pos(rot(plano(0.4, 0.2, (c, w, h) => { c.fillStyle = '#e9edf0'; c.fillRect(0, 0, w, h); c.fillStyle = '#2b2f36'; c.font = 'bold 54px sans-serif'; c.fillText('TP-40/980', 20, 70); c.font = '32px sans-serif'; c.fillText('13 est. · 15 kW · 12 m/min', 20, 120); c.fillText('ano 2009 · série 0417', 20, 160); }, 512, 256, 'placa_identificacao'), 0, Math.PI, 0), X0 - 0.1, 0.36, -0.635));
    // guilhotina hidráulica pós-corte + unidade hidráulica + mangueiras
    const xg = X0 + (ESTACOES - 1) * PASSO + 0.85;
    g.add(pos(guilhotinaHidraulica('guilhotina', 1.3, 1.75), xg, 0, 0));
    g.add(pos(unidadeHidraulica('unidade_hidraulica'), xg + 0.1, 0, -1.0));
    [-1, 1].forEach(s => g.add(tubo([[xg + 0.1 + s * 0.15, 0.6, -0.9], [xg + s * 0.25, 1.2, -0.95], [xg, 1.95, -0.6], [xg, 1.95, s * 0.43]], 0.018, COR.preto, 'mangueira', 14)));
    // apoio de saída curto (a mesa de saída é outro modelo)
    const sai = grupo('apoio_saida'); pos(sai, xg + 1.45, 0, 0);
    sai.add(pos(caixa(1.3, 0.1, 1.3, TEAL, 'quadro', 0.01), 0, 0.82, 0));
    [-1, 1].forEach(s => [-0.5, 0.5].forEach(x => sai.add(pos(caixa(0.08, 0.78, 0.08, TEAL_E, 'pe', 0.01), x, 0.39, s * 0.55))));
    for (let i = 0; i < 4; i++) sai.add(pos(eixoZ(0.045, 1.16, COR.aco, 'rolete'), -0.45 + i * 0.3, 0.9, 0));
    g.add(sai);
    return g;
  };

  // ---------- 2) LINHA DE CORTE (GUILHOTINA COM DESBOBINADOR) — 7 m ----------
  M.guilhotina = () => {
    const g = grupo('guilhotina');
    g.add(pos(desbobinador('desbobinador', 1.3), -2.85, 0, 0));
    // endireitador: rolos alternados em cima e embaixo, ajuste por volantes
    const end = grupo('endireitador'); pos(end, -1.35, 0, 0);
    end.add(pos(caixa(1.1, 0.7, 1.5, TEAL_E, 'base', 0.03), 0, 0.35, 0));
    [-1, 1].forEach(s => end.add(pos(caixa(1.1, 0.75, 0.1, TEAL, 'lateral', 0.03), 0, 1.0, s * 0.72)));
    for (let i = 0; i < 7; i++) { const sup = i % 2 === 1; const r = grupo('rolo_endireitador_' + i); r.add(eixoZ(0.055, 1.36, COR.aco, 'rolo', 12)); pos(r, -0.42 + i * 0.14, sup ? 1.0 : 0.87, 0); end.add(r); }
    end.add(pos(caixa(1.12, 0.1, 1.54, TEAL, 'tampa', 0.03), 0, 1.42, 0));
    [-0.3, 0, 0.3].forEach(x => { end.add(pos(cilindro(0.02, 0.18, COR.aco, 'fuso', 0.005, 8), x, 1.55, 0)); end.add(pos(cilindro(0.09, 0.03, AMARELO, 'volante', 0.01, 14), x, 1.65, 0)); });
    g.add(end);
    // alimentador com roda de medição (encoder)
    const ali = grupo('alimentador'); pos(ali, -0.35, 0, 0);
    ali.add(pos(caixa(0.5, 0.75, 1.4, TEAL_E, 'base', 0.03), 0, 0.375, 0));
    ali.add(pos(eixoZ(0.07, 1.3, COR.borracha, 'rolo_puxador', 14), 0, 0.86, 0));
    ali.add(pos(eixoZ(0.06, 1.3, COR.aco, 'rolo_pressor', 14), 0, 1.0, 0));
    ali.add(pos(eixoZ(0.08, 0.04, AMARELO, 'roda_medicao', 16), 0.18, 0.99, 0.45));
    ali.add(pos(caixa(0.12, 0.1, 0.1, COR.grafite, 'encoder', 0.02), 0.18, 1.14, 0.45));
    g.add(ali);
    g.add(pos(guilhotinaHidraulica('guilhotina_corte', 1.4, 1.65), 0.6, 0, 0));
    g.add(pos(unidadeHidraulica('unidade_hidraulica'), 0.6, 0, -1.05));
    [-1, 1].forEach(s => g.add(tubo([[0.6 + s * 0.15, 0.6, -0.95], [0.6 + s * 0.2, 1.2, -1.0], [0.6, 1.85, -0.6], [0.6, 1.85, s * 0.47]], 0.018, COR.preto, 'mangueira', 14)));
    // mesa de saída com batente regulável (empilha as chapas cortadas)
    const ms = grupo('mesa_saida_chapas'); pos(ms, 2.4, 0, 0);
    ms.add(pos(caixa(2.1, 0.08, 1.4, TEAL, 'tampo', 0.01), 0, 0.84, 0));
    [-1, 1].forEach(s => [-0.9, 0, 0.9].forEach(x => ms.add(pos(caixa(0.08, 0.8, 0.08, TEAL_E, 'pe', 0.01), x, 0.4, s * 0.62))));
    for (let i = 0; i < 6; i++) ms.add(pos(eixoZ(0.04, 1.3, COR.aco, 'rolete'), -0.9 + i * 0.36, 0.91, 0));
    ms.add(pos(caixa(0.08, 0.3, 1.4, AMARELO, 'batente', 0.015), 1.0, 1.03, 0));
    zebra(ms, 1.0, 1.03, 0, 0.084, 0.1, 1.4, 4, 'z');
    g.add(ms);
    return g;
  };

  // ---------- 3) VIRADEIRA (dobradeira manual de rufo e calha) — 4 m ----------
  M.dobradeira = () => {
    const g = grupo('dobradeira'), L = 4, YT = 0.9;
    // estrutura tubular
    [-1.8, 0, 1.8].forEach(x => {
      [-1, 1].forEach(s => g.add(pos(caixa(0.08, YT - 0.05, 0.08, COR.grafite, 'perna', 0.01), x, (YT - 0.05) / 2, s * 0.32)));
      g.add(pos(caixa(0.07, 0.07, 0.7, COR.grafite, 'travessa', 0.008), x, 0.25, 0));
      g.add(pos(caixa(0.16, 0.025, 0.8, COR.grafite, 'sapata', 0.006), x, 0.012, 0));
    });
    g.add(pos(caixa(L - 0.2, 0.07, 0.07, COR.grafite, 'longarina', 0.008), 0, 0.25, 0.32));
    // bancada (mesa) e régua de medida na frente (-Z)
    g.add(pos(caixa(L, 0.08, 0.72, TEAL, 'bancada', 0.012), 0, YT - 0.04, 0));
    g.add(pos(plano(L - 0.4, 0.05, (c, w, h) => { c.fillStyle = '#f5c84b'; c.fillRect(0, 0, w, h); c.fillStyle = '#2b2f36'; for (let i = 0; i <= 72; i++) c.fillRect(i * (w / 72), 0, 2, i % 6 === 0 ? h : h * 0.45); }, 2048, 32, 'regua'), 0, YT + 0.001, -0.33).rotateX(-Math.PI / 2));
    // viga superior de fixação (prende a chapa), com 3 alavancas de aperto atrás
    const viga = grupo('viga_fixacao'); pos(viga, 0, YT + 0.02, 0);
    viga.add(pos(extrudar([[-0.3, 0], [-0.12, 0], [0.05, 0.12], [0.05, 0.2], [-0.3, 0.2]], L - 0.1, TEAL_E, 'perfil_viga', 0.01), 0, 0, 0).rotateY(Math.PI / 2));
    [-1.6, 0, 1.6].forEach(x => {
      viga.add(pos(caixa(0.12, 0.34, 0.12, COR.grafite, 'braco', 0.015), x, 0.3, 0.2));
      viga.add(pos(rot(cilindro(0.016, 0.35, COR.aco, 'alavanca_aperto', 0.005, 8), 0.9, 0, 0), x, 0.5, 0.33));
      viga.add(pos(cilindro(0.03, 0.06, COR.vermelho, 'manopla', 0.01, 10), x, 0.62, 0.45));
    });
    g.add(viga);
    // batente traseiro regulável (encosto da chapa) com 2 manípulos amarelos
    g.add(pos(caixa(L - 0.5, 0.06, 0.05, COR.aco, 'batente_traseiro', 0.008), 0, YT + 0.03, 0.3));
    [-1.2, 1.2].forEach(x => g.add(pos(cilindro(0.035, 0.07, AMARELO, 'manipulo_batente', 0.01, 10), x, YT + 0.09, 0.3)));
    // avental: gira na aresta da frente (dobradiça em z = -0,36, y = YT) — nó 'avental'
    const av = grupo('avental'); pos(av, 0, YT, -0.36);
    av.add(pos(caixa(L - 0.06, 0.04, 0.16, AMARELO, 'chapa_avental', 0.01), 0, -0.02, -0.08));
    zebra(av, 0, -0.02, -0.08, L - 0.06, 0.044, 0.164, 12, 'x');
    [-1, 1].forEach(s => {
      av.add(pos(rot(caixa(0.06, 0.9, 0.06, COR.grafite, 'braco_alavanca', 0.01), -0.6, 0, 0), s * (L / 2 + 0.04), 0.25, -0.38));
      av.add(pos(cilindro(0.035, 0.18, COR.vermelho, 'punho', 0.012, 10), s * (L / 2 + 0.04), 0.66, -0.66).rotateX(-0.6));
      av.add(pos(new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 8), mat(COR.grafite)), s * (L / 2 + 0.04), -0.32, -0.02));
    });
    av.children.filter(c => c.isMesh && c.geometry.type === 'SphereGeometry').forEach(c => c.name = 'contrapeso');
    [-1, 1].forEach(s => g.add(pos(cilindro(0.05, 0.1, COR.aco, 'dobradica', 0.01, 12).rotateZ(Math.PI / 2), s * (L / 2 + 0.01), YT, -0.36)));
    g.add(av);
    // batentes traseiros reguláveis
    [-1.2, 1.2].forEach(x => { g.add(pos(cilindro(0.015, 0.5, COR.aco, 'guia_batente', 0.005, 8).rotateX(Math.PI / 2), x, YT + 0.03, 0.55)); g.add(pos(caixa(0.12, 0.08, 0.04, AMARELO, 'batente', 0.01), x, YT + 0.06, 0.62)); });
    return g;
  };

  // ---------- 4) BARRACÃO MODULAR (vão de 6 m, 40 m de largura, trilho a 9 m) ----------
  const CONCRETO = 0xb9b4aa, ACO_EST = 0x6f7d88;
  M.pilar_consolo = () => {   // pilar pré-moldado 0,5 x 0,6 m, consolo virado para dentro (+Z)
    const g = grupo('pilar_consolo'), H = 10.5;
    g.add(pos(caixa(1.0, 0.12, 1.0, CONCRETO, 'colarinho', 0.02), 0, 0.06, 0));
    g.add(pos(caixa(0.5, H, 0.6, CONCRETO, 'pilar', 0.03), 0, H / 2, 0));
    const c = extrudar([[0.3, 7.9], [0.85, 8.35], [0.85, 8.5], [0.3, 8.5]], 0.5, CONCRETO, 'consolo', 0.02); rot(c, 0, -Math.PI / 2, 0); g.add(c);
    g.add(pos(caixa(0.4, 0.03, 0.4, COR.grafite, 'chapa_apoio', 0), 0, 8.515, 0.6));
    g.add(pos(caixa(0.52, 0.15, 0.62, 0xa8a398, 'capitel', 0.02), 0, H + 0.075, 0));
    g.add(pos(caixa(0.36, 0.02, 0.36, COR.grafite, 'chapa_tesoura', 0), 0, H + 0.16, 0));
    // faixa zebrada de proteção na base (empilhadeira!)
    g.add(pos(caixa(0.52, 1.0, 0.62, AMARELO, 'protecao_base', 0.02), 0, 0.62, 0));
    for (let i = 0; i < 3; i++) { const t = caixa(0.53, 0.1, 0.63, COR.preto, 'faixa', 0); pos(t, 0, 0.32 + i * 0.3, 0); g.add(t); }
    return g;
  };
  M.viga_rolamento = () => {   // perfil I de 6 m + trilho; topo do trilho = 0,6 m acima do pivot
    const g = grupo('viga_rolamento'), L = 6;
    g.add(pos(caixa(L, 0.03, 0.3, ACO_EST, 'mesa_inferior', 0), 0, 0.015, 0));
    g.add(pos(caixa(L, 0.46, 0.025, ACO_EST, 'alma', 0), 0, 0.26, 0));
    g.add(pos(caixa(L, 0.03, 0.3, ACO_EST, 'mesa_superior', 0), 0, 0.505, 0));
    for (let i = 0; i < 5; i++) [-1, 1].forEach(s => g.add(pos(caixa(0.012, 0.46, 0.13, ACO_EST, 'enrijecedor', 0), -L / 2 + 0.6 + i * 1.2, 0.26, s * 0.075)));
    g.add(pos(caixa(L, 0.02, 0.12, COR.grafite, 'base_trilho', 0), 0, 0.53, 0));
    g.add(pos(caixa(L, 0.05, 0.03, COR.grafite, 'alma_trilho', 0), 0, 0.565, 0));
    g.add(pos(caixa(L, 0.03, 0.06, COR.aco, 'boleto_trilho', 0), 0, 0.6, 0));
    for (let i = 0; i < 7; i++) [-1, 1].forEach(s => g.add(pos(caixa(0.06, 0.02, 0.04, COR.grafite, 'grampo', 0), -L / 2 + 0.5 + i * 0.83, 0.545, s * 0.07)));
    return g;
  };
  M.tesoura_40m = () => {   // treliça de 40 m em Z, banzo inferior em y=0, cumeeira +2,0 m
    const g = grupo('tesoura_40m'), V = 20, N = 20, hE = 0.45, hC = 2.0;
    const topo = z => hE + (hC - hE) * (1 - Math.abs(z) / V);
    for (let i = 0; i < N; i++) {
      const z0 = -V + i * 2, z1 = z0 + 2;
      g.add(barra([0, 0, z0], [0, 0, z1], 0.14, ACO_EST, 'banzo_inferior'));
      g.add(barra([0, topo(z0), z0], [0, topo(z1), z1], 0.16, ACO_EST, 'banzo_superior'));
      g.add(barra([0, 0, z1], [0, topo(z1), z1], 0.07, ACO_EST, 'montante'));
      const sobe = z0 < 0; g.add(barra(sobe ? [0, 0, z0] : [0, 0, z1], sobe ? [0, topo(z1), z1] : [0, topo(z0), z0], 0.06, ACO_EST, 'diagonal'));
    }
    g.add(barra([0, 0, -V], [0, topo(-V), -V], 0.1, ACO_EST, 'montante_ponta'));
    [-V, V].forEach(z => g.add(pos(caixa(0.36, 0.03, 0.4, COR.grafite, 'chapa_apoio', 0), 0, -0.02, z)));
    for (let i = 1; i < N; i += 2) g.add(pos(caixa(0.3, 0.3, 0.012, COR.grafite, 'gusset', 0).rotateY(Math.PI / 2), 0, 0.15, -V + i * 2));
    return g;
  };
  M.terca = () => {   // perfil U enrijecido 150 x 60, 6 m em X, galvanizado
    const g = grupo('terca');
    const m = extrudar(chapaPerfil([[0.045, 0.012], [0.06, 0.012], [0.06, 0], [0, 0], [0, 0.15], [0.06, 0.15], [0.06, 0.138], [0.045, 0.138]], 0.004), 6, COR.galvalume, 'perfil');
    rot(m, 0, Math.PI / 2, 0); g.add(m); return g;
  };
  M.painel_fechamento = () => {   // 6 m de largura: alvenaria 2,5 m + telha vertical até 10,5 m (face externa em -Z)
    const g = grupo('painel_fechamento'), L = 6, HA = 2.5, H = 10.5;
    g.add(pos(caixa(L, HA, 0.19, 0xd9d4c8, 'alvenaria', 0), 0, HA / 2, 0.05));
    g.add(pos(caixa(L, 0.08, 0.24, 0xa8a398, 'cinta', 0.01), 0, HA + 0.04, 0.05));
    g.add(pos(caixa(L, 0.35, 0.192, 0x8e98a2, 'barrado', 0), 0, 0.175, 0.049));
    for (let i = 0; i < 6; i++) {   // 6 telhas TP-40 em pé (útil 0,98 m), ondas viradas para fora
      const t = extrudar(chapaPerfil(OF.linhaTP40(), 0.004), H - HA - 0.08, i % 2 ? 0xc5cdd3 : 0xbcc5cc, 'telha_fechamento');
      t.rotation.set(-Math.PI / 2, 0, Math.PI); pos(t, -L / 2 + 0.49 + i * 0.98, (H + HA + 0.08) / 2, -0.05); g.add(t);
    }
    [4.5, 7.0, 9.5].forEach(y => g.add(pos(caixa(L, 0.15, 0.06, COR.galvalume, 'longarina', 0), 0, y, 0.02)));
    return g;
  };
  // trecho de exemplo (só para conferir o encaixe; o jogo instancia as peças)
  M.barracao_trecho = () => {
    const g = grupo('barracao_trecho'), nV = 2;
    for (let i = 0; i <= nV; i++) {
      const x = -6 + i * 6;
      [-1, 1].forEach(s => { const p = M.pilar_consolo(); pos(p, x, 0, s * 20); p.rotation.y = s > 0 ? Math.PI : 0; g.add(p); });
      g.add(pos(M.tesoura_40m(), x, 10.68, 0));
    }
    for (let i = 0; i < nV; i++) [-1, 1].forEach(s => {
      g.add(pos(M.viga_rolamento(), -3 + i * 6, 8.53, s * 19.4));
      const pf = M.painel_fechamento(); pos(pf, -3 + i * 6, 0, s * 20.35); if (s > 0) pf.rotation.y = Math.PI; g.add(pf);
      for (let k = 0; k < 7; k++) { const z = s * (20 - k * 2.9); const y = 10.68 + 0.45 + (2.0 - 0.45) * (1 - Math.abs(z) / 20); g.add(pos(M.terca(), -3 + i * 6, y + 0.08, z)); }
    });
    return g;
  };

  // ---------- 5) ESCRITÓRIO 8 x 8 x 3 (porta no lado +X, centro) ----------
  M.escritorio = () => {
    const g = grupo('escritorio'), L = 8, H = 3, E = 0.15, CREME = 0xe9dfcc, BARRA = 0xb9a888;
    g.add(pos(caixa(L - 0.1, 0.03, L - 0.1, 0xd9d4c8, 'piso', 0), 0, 0.015, 0));
    const lados = [
      ['parede_x+', [{ c: 0, larg: 1.0, alt: 2.12, base: 0 }, { c: -2.4, larg: 1.6, alt: 1.1, base: 1.0 }, { c: 2.4, larg: 1.6, alt: 1.1, base: 1.0 }], L / 2, 0, -Math.PI / 2],
      ['parede_x-', [{ c: 0, larg: 2.0, alt: 1.1, base: 1.0 }], -L / 2, 0, Math.PI / 2],
      ['parede_z+', [], 0, L / 2, Math.PI],
      ['parede_z-', [{ c: -1.5, larg: 2.0, alt: 1.1, base: 1.0 }, { c: 1.8, larg: 1.2, alt: 1.1, base: 1.0 }], 0, -L / 2, 0]
    ];
    lados.forEach(([n, vaos, x, z, ry]) => {
      const w = grupo(n); w.add(parede(L + E, H, E, vaos, CREME, 'alvenaria'));
      w.add(pos(parede(L + E + 0.02, 0.9, E + 0.02, vaos.filter(v => v.base < 0.9).map(v => ({ c: v.c, larg: v.larg, alt: 2.12, base: 0 })), BARRA, 'barrado'), 0, 0, 0));
      vaos.filter(v => v.base > 0).forEach(v => w.add(pos(janela(v.larg, v.alt, E), v.c, v.base, 0)));
      vaos.filter(v => v.base > 0).forEach(v => w.add(pos(caixa(v.larg + 0.1, 0.04, E + 0.12, 0xd0d0cc, 'peitoril_pedra', 0.008), v.c, v.base - 0.02, 0)));
      pos(w, x, 0, z); w.rotation.y = ry; g.add(w);
    });
    // laje/teto separado (o jogo pode esconder quando o jogador entra) e platibanda
    const teto = grupo('teto'); teto.add(pos(caixa(L + 0.2, 0.12, L + 0.2, 0xcfc6b6, 'laje', 0.01), 0, H + 0.06, 0));
    [[L + 0.3, 0, L / 2 + 0.1], [L + 0.3, 0, -L / 2 - 0.1]].forEach(([w, x, z]) => teto.add(pos(caixa(w, 0.35, 0.1, CREME, 'platibanda', 0.01), x, H + 0.29, z)));
    [[L / 2 + 0.1], [-L / 2 - 0.1]].forEach(([x]) => teto.add(pos(caixa(0.1, 0.35, L + 0.3, CREME, 'platibanda', 0.01), x, H + 0.29, 0)));
    g.add(teto);
    // letreiro sobre a porta, ar-condicionado e luminária externa
    g.add(pos(rot(plano(1.6, 0.35, (c, w, h) => { c.fillStyle = '#2b8a7e'; c.fillRect(0, 0, w, h); c.fillStyle = '#fff'; c.font = 'bold 60px sans-serif'; c.textAlign = 'center'; c.fillText('ESCRITÓRIO', w / 2, 76); }, 512, 112, 'letreiro'), 0, Math.PI / 2, 0), L / 2 + E / 2 + 0.01, 2.5, 0));
    const ac = grupo('ar_condicionado'); pos(ac, -L / 2 - E / 2 - 0.18, 0.4, 2.6);
    ac.add(caixa(0.32, 0.55, 0.8, COR.branco, 'condensadora', 0.03));
    ac.add(pos(rot(cilindro(0.2, 0.02, COR.grafite, 'grade', 0.005, 16), 0, 0, Math.PI / 2), -0.17, 0.02, 0));
    g.add(ac);
    g.add(pos(caixa(0.1, 0.15, 0.25, COR.grafite, 'luminaria', 0.02), L / 2 + E / 2 + 0.05, 2.3, 0.9));
    return g;
  };

  // ---------- 6) LOJA DE BALCÃO 12 x 8 x 3,2 (rua em -Z, barracão em +Z) ----------
  M.loja_balcao = () => {
    const g = grupo('loja_balcao'), W = 12, D = 8, H = 3.2, E = 0.15, PAREDE = 0xefe6d2, FACHADA = 0x2b8a7e;
    g.add(pos(caixa(W - 0.1, 0.03, D - 0.1, 0xd8cbb3, 'piso', 0), 0, 0.015, 0));
    for (let i = 0; i < 12; i++) g.add(pos(caixa(0.01, 0.031, D - 0.12, 0xc4b69c, 'rejunte', 0), -W / 2 + (i + 0.5) * W / 12, 0.0155, 0));
    // frente (rua): porta de vidro 2 m no centro e vitrine à direita
    const frente = grupo('fachada'); pos(frente, 0, 0, -D / 2);
    const vaosF = [{ c: 0, larg: 2.0, alt: 2.3, base: 0 }, { c: 3.3, larg: 2.6, alt: 1.6, base: 0.6 }];
    frente.add(parede(W + E, H, E, vaosF, PAREDE, 'alvenaria'));
    frente.add(pos(janela(2.6, 1.6, E, 'vitrine'), 3.3, 0.6, 0));
    const porta = grupo('porta_vidro'); porta.add(pos(janela(2.0, 2.3, E, 'porta'), 0, 0, 0));
    [-0.08, 0.08].forEach(x => porta.add(pos(caixa(0.03, 0.4, 0.06, COR.aco, 'puxador', 0.01), x, 1.1, -0.06))); frente.add(porta);
    // platibanda alta com letreiro e toldo
    frente.add(pos(caixa(W + 0.4, 1.1, 0.25, FACHADA, 'platibanda', 0.02), 0, H + 0.45, -0.05));
    frente.add(pos(plano(8.5, 0.8, (c, w, h) => { c.fillStyle = '#2b8a7e'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.font = 'bold 120px sans-serif'; c.textAlign = 'center'; c.fillText('PARECIS TELHA', 690, 138); c.fillStyle = '#f5c84b'; c.font = 'bold 72px sans-serif'; c.fillText('PRONTA ENTREGA', 1610, 130); }, 2048, 192, 'letreiro'), -0.3, H + 0.45, -0.185).rotateY(Math.PI));
    const toldo = grupo('toldo'); pos(toldo, 1.6, 2.65, -0.15);
    const lona = caixa(6.0, 0.04, 1.2, AMARELO, 'lona', 0.01); lona.rotation.x = -0.35; pos(lona, 0, 0, -0.55); toldo.add(lona);
    for (let i = 0; i < 7; i++) { const t = caixa(0.42, 0.045, 1.2, COR.branco, 'listra', 0); t.rotation.x = -0.35; pos(t, -2.7 + i * 0.86, 0.003, -0.55); toldo.add(t); }
    [-2.9, 2.9].forEach(x => toldo.add(pos(rot(cilindro(0.02, 1.0, COR.grafite, 'mao_francesa', 0.005, 8), -0.9, 0, 0), x, -0.45, -0.42)));
    frente.add(toldo);
    g.add(frente);
    // fundos (porta para o barracão) e laterais
    const fundos = grupo('parede_fundos'); fundos.add(parede(W + E, H, E, [{ c: 0, larg: 1.2, alt: 2.12, base: 0 }], PAREDE, 'alvenaria')); pos(fundos, 0, 0, D / 2); fundos.rotation.y = Math.PI; g.add(fundos);
    [-1, 1].forEach(s => { const l = grupo('parede_lateral'); l.add(parede(D, H, E, [{ c: 1.5 * s, larg: 1.4, alt: 1.0, base: 1.3 }], PAREDE, 'alvenaria')); l.add(pos(janela(1.4, 1.0, E), 1.5 * s, 1.3, 0)); pos(l, s * W / 2, 0, 0); l.rotation.y = s * Math.PI / 2; g.add(l); });
    // barrado externo e estantes (lado do atendente, atrás do balcão)
    [-1, 1].forEach(s => g.add(pos(caixa(0.012, 0.9, D, 0xc7b994, 'barrado', 0), s * (W / 2 + E / 2 + 0.006), 0.45, 0)));
    for (let k = 0; k < 4; k++) {
      const est = grupo('estante'), x = -4.2 + k * 2.8; pos(est, x, 0, D / 2 - 0.35);
      [-1, 1].forEach(s => est.add(pos(caixa(0.05, 2.0, 0.45, COR.grafite, 'montante', 0.01), s * 1.2, 1.0, 0)));
      for (let n = 0; n < 4; n++) {
        const y = 0.15 + n * 0.55; est.add(pos(caixa(2.4, 0.03, 0.45, COR.madeira, 'prateleira', 0.006), 0, y, 0));
        for (let b = 0; b < 4; b++) { const cor = [COR.vermelho, COR.azul, COR.laranja, COR.branco][(k + n + b) % 4]; est.add(pos(caixa(0.32, 0.22, 0.3, cor, 'mercadoria', 0.02), -0.9 + b * 0.6 + ((k + n) % 2) * 0.1, y + 0.125, 0)); }
      }
      g.add(est);
    }
    // amostras de telha na vitrine
    for (let i = 0; i < 3; i++) { const t = extrudar(chapaPerfil(OF.linhaTP40(), 0.004), 0.8, [COR.galvalume, COR.azul, COR.vermelho][i], 'amostra_vitrine'); t.scale.set(0.7, 1.4, 1); rot(t, Math.PI / 2 - 0.15, 0, 0); pos(t, 2.5 + i * 0.8, 1.05, -D / 2 + 0.45); g.add(t); }
    const teto = grupo('teto'); teto.add(pos(caixa(W + 0.2, 0.12, D + 0.2, 0xcfc6b6, 'laje', 0.01), 0, H + 0.06, 0)); g.add(teto);
    return g;
  };

  // ---------- PONTE ROLANTE (feita do zero: a grátis é de pórtico) ----------
  M.ponte_viga = () => {   // viga caixão de 40 m em Z + cabeceiras com rodas; pivot = topo do trilho
    const g = grupo('ponte_viga'), V = 20;
    // viga DUPLA: o carro anda por cima das duas e o cabo desce pelo vão do meio (não atravessa a viga)
    [-1, 1].forEach(s => {
      g.add(pos(caixa(0.32, 0.9, 2 * V - 0.6, AMARELO, 'viga_caixao', 0.04), s * 0.62, 0.55, 0));
      g.add(pos(caixa(0.1, 0.08, 2 * V - 1.0, COR.grafite, 'trilho_carro', 0), s * 0.62, 1.04, 0));
      zebra(g, s * 0.62, 0.55, 0, 0.33, 0.3, 2 * V - 0.6, 30, 'z');
    });
    // diafragmas ligando as duas vigas
    for (let i = -3; i <= 3; i++) g.add(pos(caixa(0.92, 0.16, 0.12, AMARELO, 'travamento', 0.02), 0, 0.85, i * 5.5));
    [-1, 1].forEach(s => {
      const cab = grupo('cabeceira'); pos(cab, 0, 0, s * (V - 0.2));
      cab.add(pos(caixa(2.6, 0.45, 0.4, AMARELO, 'viga_cabeceira', 0.03), 0, 0.3, 0));
      [-1, 1].forEach(t => { cab.add(pos(eixoZ(0.16, 0.12, COR.grafite, 'roda', 16), t * 1.05, 0.16, 0)); cab.add(pos(caixa(0.3, 0.3, 0.46, COR.grafite, 'caixa_roda', 0.03), t * 1.05, 0.25, 0)); });
      cab.add(pos(eixoX(0.13, 0.35, COR.grafite, 'motor_translacao', 14), 0.6, 0.65, 0));
      cab.add(pos(caixa(0.6, 0.12, 0.5, COR.vermelho, 'batente', 0.03), s > 0 ? 0 : 0, 0.3, s * 0.25));
      g.add(cab);
    });
    g.add(pos(rot(plano(1.6, 0.4, (c, w, h) => { c.fillStyle = '#f5c84b'; c.fillRect(0, 0, w, h); c.fillStyle = '#2b2f36'; c.font = 'bold 90px sans-serif'; c.textAlign = 'center'; c.fillText('1.500 kg', w / 2, 92); }, 512, 128, 'placa_capacidade'), 0, -Math.PI / 2, 0), -0.785, 0.55, 3));
    return g;
  };
  M.ponte_carro = () => {   // carro/talha: rodas no trilho da viga, tambor do cabo
    const g = grupo('ponte_carro');
    g.add(pos(caixa(1.4, 0.15, 1.3, COR.grafite, 'quadro', 0.03), 0, 0.3, 0));
    [-1, 1].forEach(s => [-1, 1].forEach(t => { g.add(pos(eixoX(0.13, 0.08, COR.preto, 'roda', 14), s * 0.62, 0.13, t * 0.5)); g.add(pos(eixoX(0.15, 0.02, COR.aco, 'flange_roda', 14), s * 0.62 - s * 0.05, 0.13, t * 0.5)); }));
    g.add(pos(eixoZ(0.24, 0.8, TEAL, 'tambor', 18), 0, 0.64, 0));
    for (let i = 0; i < 6; i++) g.add(pos(rot(anel(0.24, 0.255, 0.03, COR.aco, 'espira_cabo', 18, 0.004), Math.PI / 2, 0, 0), 0, 0.64, -0.3 + i * 0.12));
    g.add(pos(eixoZ(0.16, 0.36, TEAL_E, 'motor_elevacao', 16), 0, 0.6, 0.62));
    g.add(pos(caixa(0.34, 0.34, 0.2, TEAL_E, 'redutor', 0.03), 0, 0.6, -0.52));
    g.add(pos(caixa(0.3, 0.25, 0.15, COR.grafite, 'caixa_eletrica', 0.03), 0.5, 0.52, 0.4));
    return g;
  };
  M.ponte_gancho = () => {   // moitão com 2 polias + gancho com trava (pivot = ponta de baixo do gancho)
    const g = grupo('ponte_gancho');
    const moitao = grupo('moitao'); pos(moitao, 0, 0.55, 0);
    moitao.add(caixa(0.36, 0.28, 0.2, AMARELO, 'carcaca', 0.04));
    [-1, 1].forEach(s => { moitao.add(pos(eixoZ(0.075, 0.03, COR.grafite, 'polia', 16), s * 0.085, 0.02, 0.112)); [-0.017, 0.017].forEach(dz => moitao.add(pos(eixoZ(0.095, 0.008, COR.aco, 'flange_polia', 16), s * 0.085, 0.02, 0.112 + dz))); });
    zebra(moitao, 0, 0, 0, 0.364, 0.2, 0.204, 3, 'x');
    g.add(moitao);
    g.add(pos(cilindro(0.04, 0.12, COR.aco, 'pescoco', 0.01, 10), 0, 0.36, 0));
    // gancho em J: haste desce, curva por baixo e sobe até a ponta (abertura para +X)
    const cx = 0.075, cy = 0.13, rr = 0.075, pts = [[0, 0.31, 0], [0, 0.22, 0]];
    for (let i = 0; i <= 12; i++) { const a = Math.PI + (i / 12) * (Math.PI + 0.55); pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr, 0]); }
    const gancho = tubo(pts, 0.03, COR.vermelho, 'gancho', 28);
    g.add(gancho);
    g.add(pos(rot(caixa(0.022, 0.14, 0.04, AMARELO, 'trava', 0.006), 0, 0, -0.75), 0.07, 0.2, 0));
    g.children.forEach(c => c.position.y += 0.02);
    return g;
  };

  // ---------- CAMINHÃO TOCO COM CARROCERIA ABERTA (feito do zero) ----------
  M.caminhao_carroceria = () => {
    const g = grupo('caminhao_carroceria'), BRANCO = 0xf2f0ea;
    // chassi e rodas (2 eixos, roda dupla atrás)
    [-1, 1].forEach(s => g.add(pos(caixa(8.4, 0.22, 0.12, COR.grafite, 'longarina', 0), 0.2, 0.75, s * 0.45)));
    const roda = (x, z, nome) => { const r = grupo(nome); r.add(eixoZ(0.48, 0.3, COR.borracha, 'pneu', 18)); r.add(pos(eixoZ(0.26, 0.31, COR.aco, 'aro', 14), 0, 0, 0)); for (let k = 0; k < 6; k++) { const a = k * Math.PI / 3; [-1, 1].forEach(f => r.add(pos(caixa(0.05, 0.05, 0.02, COR.grafite, 'porca', 0), Math.cos(a) * 0.15, Math.sin(a) * 0.15, f * 0.16))); } pos(r, x, 0.48, z); return r; };
    [-1, 1].forEach(s => { g.add(roda(3.0, s * 1.02, 'roda_dianteira')); g.add(roda(-2.0, s * 1.0, 'roda_traseira')); g.add(roda(-2.0, s * 0.68, 'roda_traseira_dupla')); });
    // cabine avançada (cara de caminhão brasileiro), para-choque e faróis
    const cab = grupo('cabine'); pos(cab, 3.35, 0, 0);
    cab.add(pos(caixa(1.9, 1.75, 2.35, BRANCO, 'corpo', 0.18), 0, 1.95, 0));
    cab.add(pos(caixa(1.92, 0.5, 2.37, TEAL, 'faixa_cabine', 0.1), 0, 1.2, 0));
    cab.add(pos(caixa(0.06, 0.75, 2.1, 0x6f9fae, 'para_brisa', 0.03), 0.95, 2.35, 0));
    [-1, 1].forEach(s => cab.add(pos(caixa(0.9, 0.55, 0.06, 0x6f9fae, 'vidro_porta', 0.02), 0.2, 2.4, s * 1.18)));
    cab.add(pos(caixa(0.25, 0.3, 2.45, COR.grafite, 'para_choque', 0.05), 1.0, 0.75, 0));
    cab.add(pos(caixa(0.06, 0.35, 1.2, COR.grafite, 'grade', 0.02), 0.96, 1.25, 0));
    [-1, 1].forEach(s => { cab.add(pos(caixa(0.06, 0.16, 0.3, 0xfff3c4, 'farol', 0.03), 0.97, 1.0, s * 0.85)); cab.add(pos(caixa(0.3, 0.06, 0.05, COR.grafite, 'braco_retrovisor', 0.01), 0.75, 2.4, s * 1.3)); cab.add(pos(caixa(0.05, 0.3, 0.15, COR.grafite, 'retrovisor', 0.02), 0.9, 2.35, s * 1.42)); });
    cab.add(pos(caixa(0.6, 0.25, 0.5, COR.grafite, 'tanque', 0.05), -0.6, 0.65, -1.0));
    g.add(cab);
    // carroceria de madeira com guardas laterais baixas (cabem pilhas de telha de 6 m)
    const car = grupo('carroceria'); pos(car, -1.2, 0, 0);
    car.add(pos(caixa(6.4, 0.12, 2.45, COR.madeira, 'assoalho', 0.01), 0, 0.92, 0));
    [-1, 1].forEach(s => { [0, 1, 2].forEach(k => car.add(pos(caixa(6.4, 0.14, 0.06, k === 1 ? COR.madeira : COR.madeiraEsc, 'tabua_lateral', 0.01), 0, 1.04 + k * 0.155, s * 1.2))); });
    [0, 1, 2].forEach(k => car.add(pos(caixa(0.06, 0.14, 2.45, k === 1 ? COR.madeira : COR.madeiraEsc, 'tabua_traseira', 0.01), -3.2, 1.04 + k * 0.155, 0)));
    car.add(pos(caixa(0.12, 1.3, 2.45, COR.grafite, 'protetor_cabine', 0.02), 3.15, 1.6, 0));
    for (let i = 0; i < 6; i++) [-1, 1].forEach(s => car.add(pos(caixa(0.06, 0.5, 0.08, COR.grafite, 'fueiro', 0.01), -2.9 + i * 1.16, 1.22, s * 1.22)));
    g.add(car);
    g.add(pos(caixa(0.12, 0.2, 2.2, COR.vermelho, 'para_choque_traseiro', 0.02), -4.35, 0.55, 0));
    return g;
  };
})();
