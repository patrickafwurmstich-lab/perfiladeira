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
  'perfiladeira_tp40', 'dobradeira'          // complexos v2: aprovados (ChatGPT + Grok)
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

  function carregar(id) {
    if (!cache[id]) cache[id] = new Promise((ok, erro) => {
      new THREE.GLTFLoader().load(BASE + id + '.glb', g => { st.carregados++; adaptarMateriais(g.scene); ok(g.scene); }, undefined, e => { st.erros++; erro(e); });
    });
    return cache[id];
  }
  // a Demo usa luz simples (Lambert, saída linear): o PBR do glTF fica escuro/metálico.
  // Troca por Lambert com a cor de volta em sRGB — mesmo visual da prévia, mais leve.
  function adaptarMateriais(cena) {
    const feitos = new Map();
    cena.traverse(o => {
      if (!o.isMesh) return;
      const conv = m => {
        if (feitos.has(m)) return feitos.get(m);
        const n = new THREE.MeshLambertMaterial({ color: m.color ? m.color.clone().convertLinearToSRGB() : 0xffffff, transparent: m.transparent, opacity: m.opacity, side: m.side });
        if (m.map) { m.map.encoding = THREE.LinearEncoding; n.map = m.map; n.color.set(0xffffff); }
        if (m.emissive && (m.emissive.r + m.emissive.g + m.emissive.b) > 0) { n.emissive = m.emissive.clone().convertLinearToSRGB(); n.emissiveIntensity = m.emissiveIntensity; }
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
    if (!disponivel() || opts.transparente || PT.GLB_NO_JOGO.indexOf(id) < 0) return;
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
  function definirLigado(v) { try { localStorage.setItem('pt_cubos', v ? '0' : '1'); } catch (e) { } }
  return { aplicar, carregar, st, ligado: () => ligado, definirLigado, luzTorre, ativo, ALTURA_MANDRIL };
})();
