// =====================================================================
// modelos3d.js — troca o cubo/cilindro pelo modelo 3D de verdade (.glb)
// assim que o modelo fica pronto e aprovado (lista PT.GLB_NO_JOGO).
// O cubo continua existindo (invisível) porque o jogo usa ele para
// escala da bobina, cor de estado etc.; o .glb vira filho dele.
// Para voltar aos cubos: ?cubos=1 na URL ou Configurações do PC.
// =====================================================================
window.PT = window.PT || {};

// modelos aprovados (crítica ChatGPT + Grok) e que já encaixam na regra do jogo
PT.GLB_NO_JOGO = [
  'bobina_1t', 'bobina_2t', 'botoeira', 'mandril', 'berco_bobina', 'porta_escritorio', 'sino_balcao',
  'balcao_loja', 'mostruario', 'clp_padrao', 'placa_dias_sem_acidente', 'placa_parede',
  'perfiladeira_tp40', 'dobradeira', 'guilhotina',       // máquinas (complexos v2/v3)
  'ponte_viga', 'ponte_carro', 'ponte_gancho',          // ponte rolante v3 (viga dupla)
  'caminhao_entrega',                                   // caminhão toco v3 (arquivo caminhao_carroceria)
  'escritorio', 'loja_balcao', 'barracao_estrutura'     // prédios
];

PT.glb = (function () {
  const BASE = '../modelos3d/claude/glb/';
  const cache = {};   // id -> Promise<gltf.scene>
  let ligado = true;
  try { ligado = !/[?&]cubos=1/.test(location.search) && localStorage.getItem('pt_cubos') !== '1'; } catch (e) { }
  const disponivel = () => ligado && typeof THREE !== 'undefined' && THREE.GLTFLoader;
  const st = { carregados: 0, erros: 0, trocados: 0 };
  // deslocamento do .glb dentro da caixa do jogo: o mandril do desbobinador do modelo
  // fica exatamente no ponto onde o jogo monta a bobina (pontoEntrada = -comprimento/2 - 1 m)
  const AJUSTE = {
    perfiladeira_tp40: { dx: -1.8 },   // mandril do modelo em x = -7,2 → -9,0
    guilhotina: { dx: -1.65 }          // mandril em x = -2,85 → -4,5
  };
  const ALTURA_MANDRIL = 1.12;         // eixo do desbobinador dos modelos (m)
  function ativo(id) { return disponivel() && PT.GLB_NO_JOGO.indexOf(id) >= 0; }

  // id do jogo → nome do arquivo .glb (quando são diferentes)
  const ARQUIVO = { caminhao_entrega: 'caminhao_carroceria' };
  function carregar(id) {
    if (!cache[id]) cache[id] = new Promise((ok, erro) => {
      new THREE.GLTFLoader().load(BASE + (ARQUIVO[id] || id) + '.glb', g => { st.carregados++; adaptarMateriais(g.scene); ok(g.scene); }, undefined, e => { st.erros++; erro(e); });
    });
    return cache[id];
  }
  // a Demo usa luz simples (Lambert, saída linear): o PBR do glTF fica escuro/metálico.
  // Troca por Lambert com a cor de volta em sRGB — mesmo visual da prévia, mais leve.
  function adaptarMateriais(cena, comPele) {
    const feitos = new Map();
    cena.traverse(o => {
      if (!o.isMesh) return;
      const conv = m => {
        if (feitos.has(m)) return feitos.get(m);
        const n = new THREE.MeshLambertMaterial({ color: m.color ? m.color.clone().convertLinearToSRGB() : 0xffffff, transparent: m.transparent, opacity: m.opacity, side: m.side });
        if (m.map) { m.map.encoding = THREE.LinearEncoding; n.map = m.map; n.color.set(0xffffff); }
        if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0) { n.emissive = m.emissive.clone().convertLinearToSRGB(); n.emissiveIntensity = m.emissiveIntensity; }
        if (comPele || o.isSkinnedMesh) n.skinning = true;
        n.name = m.name; feitos.set(m, n); return n;
      };
      o.material = Array.isArray(o.material) ? o.material.map(conv) : conv(o.material);
    });
  }
  function esconderCubo(mesh) {
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    mats.forEach(m => { if (m) m.visible = false; });
  }
  // chamado pelo PT.modelo logo depois de criar o placeholder
  function aplicar(g, id, opts) {
    if (!disponivel() || opts.transparente) return;
    if (ROUPAS[id]) return aplicarPersonagem(g, id, opts);
    if (PT.GLB_NO_JOGO.indexOf(id) < 0) return;
    const mesh = g.userData.mesh, altura = g.userData.altura;
    carregar(id).then(cena => {
      if (!mesh.parent) return;                       // objeto já foi removido
      const m = cena.clone(true);
      const caixa = new THREE.Box3().setFromObject(m);
      m.position.y = -altura / 2 - caixa.min.y;       // base do modelo no chão do objeto
      const aj = AJUSTE[id]; if (aj) { m.position.x += aj.dx || 0; m.position.z += aj.dz || 0; if (aj.ry) m.rotation.y = aj.ry; }
      m.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      // placa de acidentes: a textura viva do jogo (número de dias) vai para a face do modelo
      if (id === 'placa_dias_sem_acidente' && Array.isArray(mesh.material) && mesh.material[4] && mesh.material[4].map) {
        const tex = mesh.material[4].map;
        m.traverse(o => { if (o.name === 'face') o.material = new THREE.MeshLambertMaterial({ map: tex }); if (o.name === 'numero') o.visible = false; });
      }
      esconderCubo(mesh);
      mesh.add(m); g.userData.glb = m; st.trocados++;
      if (id === 'escritorio' || id === 'loja_balcao') registrarPredio(g, m);
      // painel CLP de máquina: a torre de luz do modelo assume a luz de estado
      if (id === 'clp_padrao' && PT.maq) { const maq = PT.maq.lista.find(x => x.g === g.parent); if (maq) luzTorre(maq); }
    }).catch(() => { /* sem o arquivo: fica o cubo */ });
  }
  // verde = produzindo/pronta, âmbar = alerta, vermelha = falha, apagada = sem energia/desligada
  function luzTorre(maq) {
    const clp = maq.g.children.find(c => c.userData && c.userData.modeloId === 'clp_padrao' && c.userData.glb);
    if (!clp) return;
    if (maq.luz) maq.luz.visible = false;
    const e = maq.estado, acesa = e === 'enroscada' ? 'luz_vermelha' : (e === 'produzindo' || e === 'pronta') ? 'luz_verde' : (e === 'sem_energia' || e === 'desligada') ? null : 'luz_ambar';
    clp.userData.glb.traverse(o => {
      if (!o.isMesh || !/^luz_/.test(o.name)) return;
      if (!o.userData.matProprio) { o.material = o.material.clone(); o.userData.base = o.material.color.clone(); o.userData.matProprio = true; }
      const on = o.name === acesa;
      o.material.color.copy(o.userData.base).multiplyScalar(on ? 1 : 0.35);
      o.material.emissive = on ? o.userData.base.clone() : new THREE.Color(0); o.material.emissiveIntensity = on ? 0.9 : 0;
    });
  }
  // =================== PERSONAGENS (ithappy Creative Characters FREE) ===================
  // O pack é do Lucas (licença Fab): NÃO vai para o GitHub. O arquivo personagens_ithappy.glb
  // (gerado pelo pers_blender2.py) é carregado do PC dele pelo app Configurações e fica guardado
  // no navegador (IndexedDB). Rodando local, também lê ../privado/personagens_ithappy.glb.
  // Um corpo + peças de roupa ligadas/desligadas por personagem; 15 animações.
  const CORPO = ['Body_010'];
  const ROUPAS = {
    personagem_dono: [{ pecas: ['Male_emotion_usual_001', 'T_Shirt_009', 'Pants_014', 'Shoe_Sneakers_009'], capacete: 0xf5c84b }],
    funcionario: [{ pecas: ['Male_emotion_usual_001', 'Outerwear_036', 'Pants_014', 'Shoe_Sneakers_009', 'Gloves_014'], capacete: 'cor' }],
    cliente_balcao: [
      { nome: 'pedreiro', pecas: ['Male_emotion_happy_002', 'Hairstyle_male_010', 'T_Shirt_009', 'Shorts_003', 'Socks_008', 'Shoe_Slippers_005', 'Moustache_001'] },
      { nome: 'chacareiro', pecas: ['Male_emotion_usual_001', 'Hat_010', 'Outerwear_029', 'Pants_010', 'Shoe_Slippers_002', 'Moustache_002'] },
      { nome: 'curioso', pecas: ['Male_emotion_happy_002', 'Hairstyle_male_012', 'Glasses_006', 'T_Shirt_009', 'Pants_010', 'Shoe_Sneakers_009'] }
    ]
  };
  const ALTURA_MODELO = 1.86;
  const vivos = [], contRoupa = {};            // {g, m, mix, acoes, atual, px, pz, v}
  let fontePers = null;
  const IDB = { db: 'parecis_telha', loja: 'arquivos', chave: 'personagens_ithappy' };
  function idb(modo, valor) {
    return new Promise((ok, erro) => {
      let req; try { req = indexedDB.open(IDB.db, 1); } catch (e) { return erro(e); }
      req.onupgradeneeded = () => req.result.createObjectStore(IDB.loja);
      req.onerror = () => erro(req.error);
      req.onsuccess = () => {
        try {
          const tx = req.result.transaction(IDB.loja, modo === 'gravar' ? 'readwrite' : 'readonly'), st = tx.objectStore(IDB.loja);
          const r = modo === 'gravar' ? st.put(valor, IDB.chave) : modo === 'apagar' ? st.delete(IDB.chave) : st.get(IDB.chave);
          r.onsuccess = () => ok(r.result); r.onerror = () => erro(r.error);
        } catch (e) { erro(e); }
      };
    });
  }
  function analisar(buf) {
    return new Promise((ok, erro) => new THREE.GLTFLoader().parse(buf, '', g => { adaptarMateriais(g.scene, true); ok(g); }, erro));
  }
  function carregarPersonagens() {
    if (!fontePers) fontePers = idb('ler').catch(() => null)
      .then(buf => buf || fetch('../privado/personagens_ithappy.glb').then(r => r.ok ? r.arrayBuffer() : null).catch(() => null))
      .then(buf => buf ? analisar(buf) : null)
      .catch(e => { console.warn('[personagens]', e); return null; });
    return fontePers;
  }
  // chamado pelo app Configurações com o arquivo escolhido pelo jogador
  function guardarPersonagens(arquivo) {
    return arquivo.arrayBuffer().then(buf => analisar(buf).then(g => {
      if (!g.animations.length || !g.scene.getObjectByName('Body_010')) throw new Error('arquivo não é o personagens_ithappy.glb');
      return idb('gravar', buf).then(() => g.animations.length);
    }));
  }
  function capacete(cor) {
    const c = new THREE.Group(), mat = new THREE.MeshLambertMaterial({ color: cor });
    const domo = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat); domo.scale.set(1, 0.9, 1.08); c.add(domo);
    const aba = new THREE.Mesh(new THREE.CylinderGeometry(0.175, 0.18, 0.018, 18), mat); aba.scale.set(1, 1, 1.12); aba.position.set(0, 0.005, 0.02); c.add(aba);
    const viseira = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.014, 0.08), mat); viseira.position.set(0, 0.008, 0.19); c.add(viseira);
    const crista = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.03, 0.3), mat); crista.position.set(0, 0.135, 0); c.add(crista);
    c.traverse(o => { if (o.isMesh) o.castShadow = true; });
    return c;
  }
  function aplicarPersonagem(g, id, opts) {
    const mesh = g.userData.mesh, altura = g.userData.altura;
    carregarPersonagens().then(fonte => {
      if (!fonte || !mesh.parent) return;
      const lista = ROUPAS[id], roupa = lista[(contRoupa[id] = ((contRoupa[id] || 0) + 1)) % lista.length];   // cada cliente com uma roupa
      if (g.userData.nariz) g.userData.nariz.visible = false;     // marcador de frente do cilindro
      const m = THREE.SkeletonUtils.clone(fonte.scene);
      const usar = CORPO.concat(roupa.pecas);
      m.traverse(o => {
        if (!o.isMesh) return;
        o.visible = usar.indexOf(o.name) >= 0 || (o.parent && usar.indexOf(o.parent.name) >= 0);
        o.castShadow = true; o.frustumCulled = false;   // malha com esqueleto: a caixa não acompanha a animação
      });
      if (roupa.capacete) {
        const cor = roupa.capacete === 'cor' ? (opts.cor !== undefined ? opts.cor : 0xf5c84b) : roupa.capacete;
        const cab = m.getObjectByName('Head'); const cap = capacete(cor);
        m.updateMatrixWorld(true); cap.position.set(0, 1.705, -0.005); m.add(cap); m.updateMatrixWorld(true);
        if (cab) cab.attach(cap);
      }
      m.scale.setScalar(altura / ALTURA_MODELO); m.position.y = -altura / 2;
      esconderCubo(mesh); mesh.add(m); g.userData.glb = m; st.trocados++;
      const mix = new THREE.AnimationMixer(m), acoes = {};
      fonte.animations.forEach(c => { acoes[c.name] = mix.clipAction(c); });
      ['Death_Backward', 'Death_Forward', 'Fall', 'Hit_Reaction_Light', 'Hit_Reaction_Heavy'].forEach(n => { if (acoes[n]) { acoes[n].setLoop(THREE.LoopOnce); acoes[n].clampWhenFinished = true; } });
      const p = new THREE.Vector3(); g.getWorldPosition(p);
      const ser = { g, m, mix, acoes, atual: null, px: p.x, pz: p.z, v: 0, dono: id === 'personagem_dono' };
      trocar(ser, 'Idle_Relaxed'); vivos.push(ser);
      g.userData.liberarGlb = () => { const i = vivos.indexOf(ser); if (i >= 0) vivos.splice(i, 1); };
    });
  }
  function trocar(ser, nome) {
    if (ser.atual === nome || !ser.acoes[nome]) return;
    const nova = ser.acoes[nome], velha = ser.atual && ser.acoes[ser.atual];
    nova.reset().play(); if (velha) nova.crossFadeFrom(velha, 0.2, false);
    ser.atual = nome;
  }
  // prédios: com o jogador dentro some o teto e as paredes ficam transparentes (câmera em 3ª pessoa)
  const predios = [];
  function registrarPredio(g, m) {
    const tetos = [], mats = [];
    m.traverse(o => {
      if (/^teto|laje|platibanda/.test(o.name)) tetos.push(o);
      if (o.isMesh) { o.material = o.material.clone(); o.material.userData.op = o.material.opacity; mats.push(o.material); }
    });
    const d = g.userData.dims; predios.push({ g, tetos, mats, meioX: d[0] / 2, meioZ: d[1] / 2, dentro: null });
  }
  function atualizarPredios() {
    const j = PT.mundo && PT.mundo.jog; if (!j) return;
    predios.forEach(p => {
      const dx = j.x - p.g.position.x, dz = j.z - p.g.position.z, c = Math.cos(p.g.rotation.y), s = Math.sin(p.g.rotation.y);
      const lx = dx * c - dz * s, lz = dx * s + dz * c;
      const dentro = Math.abs(lx) < p.meioX + 0.3 && Math.abs(lz) < p.meioZ + 0.3;
      if (dentro === p.dentro) return; p.dentro = dentro;
      p.tetos.forEach(t => { t.visible = !dentro; });
      p.mats.forEach(m => { m.transparent = dentro || m.userData.op < 1; m.opacity = dentro ? Math.min(m.userData.op, 0.28) : m.userData.op; m.depthWrite = !dentro; m.needsUpdate = true; });
    });
  }
  const _p = new THREE.Vector3();
  function atualizar(dt) {
    if (predios.length) atualizarPredios();
    if (!vivos.length || dt <= 0) return;
    for (let i = vivos.length - 1; i >= 0; i--) {
      const s = vivos[i];
      if (!s.g.parent) { vivos.splice(i, 1); continue; }      // personagem saiu da cena
      s.g.getWorldPosition(_p);
      const inst = Math.hypot(_p.x - s.px, _p.z - s.pz) / dt; s.px = _p.x; s.pz = _p.z;
      s.v += (Math.min(inst, 12) - s.v) * Math.min(1, dt * 10);  // velocidade suavizada (m/s)
      const morto = s.dono && PT.mundo && PT.mundo.jog && PT.mundo.jog.morto;
      if (morto) trocar(s, 'Death_Backward');
      else if (s.v > 3.4) { trocar(s, 'Run_Forward'); s.acoes.Run_Forward.timeScale = Math.min(1.6, s.v / 4.5); }
      else if (s.v > 0.3) { trocar(s, 'Walk_Forward'); s.acoes.Walk_Forward.timeScale = Math.max(0.6, Math.min(2.2, s.v / 1.4)); }
      else trocar(s, 'Idle_Relaxed');
      s.mix.update(dt);
    }
  }

  function definirLigado(v) { try { localStorage.setItem('pt_cubos', v ? '0' : '1'); } catch (e) { } }
  return { aplicar, carregar, st, ligado: () => ligado, definirLigado, luzTorre, ativo, ALTURA_MANDRIL,
           atualizar, carregarPersonagens, guardarPersonagens, apagarPersonagens: () => idb('apagar'), vivos };
})();
