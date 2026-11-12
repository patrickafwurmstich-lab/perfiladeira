// =====================================================================
// zoeira.js — placa de dias sem acidentes, morte do personagem,
// respawn, boleto simbólico, cicatrizes no piso e mural de desastres.
// REGRA DE OURO: zoeira nunca tira dinheiro, máquina ou pedido.
// =====================================================================
window.PT = window.PT || {};

PT.zoeira = (function () {
  const Z = PT.DADOS.zoeira, M = PT.DADOS.mundo;
  const st = { diasSem: 0, recorde: 0, mortes: 0, cabosRompidos: 0, enroscos: 0, quedas: 0, cicatrizes: [] };
  let placa, placaCanvas, placaTex, morte = null;

  function init() {
    placaCanvas = document.createElement('canvas'); placaCanvas.width = 512; placaCanvas.height = 256;
    placaTex = new THREE.CanvasTexture(placaCanvas);
    placa = PT.modelo('placa_dias_sem_acidente', { semRotulo: true });
    placa.userData.mesh.material = [0, 0, 0, 0, new THREE.MeshLambertMaterial({ map: placaTex }), 0].map(m => m || new THREE.MeshLambertMaterial({ color: 0xf1c40f }));
    placa.position.set(M.placa.x, 2.2, M.placa.z - 0.1); placa.rotation.y = Math.PI;
    PT.mundo.scene.add(placa); desenharPlaca();
  }
  function desenharPlaca() {
    const x = placaCanvas.getContext('2d');
    x.fillStyle = '#f1c40f'; x.fillRect(0, 0, 512, 256);
    x.fillStyle = '#111'; x.textAlign = 'center';
    x.font = 'bold 30px sans-serif'; x.fillText('ESTAMOS HÁ', 256, 48);
    x.font = 'bold 110px sans-serif'; x.fillText(String(st.diasSem), 256, 160);
    x.font = 'bold 30px sans-serif'; x.fillText('DIAS SEM ACIDENTES', 256, 205);
    x.font = '20px sans-serif'; x.fillText('Recorde: ' + st.recorde, 256, 238);
    placaTex.needsUpdate = true;
  }
  PT.ev.on('dia', () => { st.diasSem++; st.recorde = Math.max(st.recorde, st.diasSem); desenharPlaca(); });
  function zerarPlaca() { st.diasSem = 0; desenharPlaca(); PT.ev.emit('placaZerou', st); }

  function acidente(texto) { st.quedas++; zerarPlaca(); PT.ev.emit('aviso', '💥 ' + texto + ' A placa zerou.'); }

  // ---------- morte ----------
  function morrer(motivo, obj) {
    const j = PT.mundo.jog; if (j.morto) return;
    j.morto = true; j.controlando = null;
    if (j.carregando) {
      const c = j.carregando; if (c.ent) PT.estoque.soltarNoChao(c.ent, c.ent.x, c.ent.z);
      if (c.carga) PT.estoque.soltarNoChao(c.carga, c.carga.x, c.carga.z); j.carregando = null;
    }
    st.mortes++; zerarPlaca();
    const ang = obj ? Math.atan2(j.x - obj.x, j.z - obj.z) : Math.random() * 6.28;
    morte = { t: 0, vx: Math.sin(ang) * 6, vz: Math.cos(ang) * 6, vy: 7, rx: 0 };
    const frases = (Z.frasesMorte[motivo] || []).concat(Z.frasesMorte.geral);
    PT.ev.emit('morreu', { motivo, frase: PT.util.escolha(frases), mortes: st.mortes });
  }
  function atualizar(dt) {
    if (!morte) return;
    const j = PT.mundo.jog; morte.t += dt;
    // "ragdoll" do cilindro: voa, gira e cai
    if (morte.t < 1.6) {
      morte.vy -= 14 * dt; j.y = Math.max(0, j.y + morte.vy * dt);
      const p = PT.mundo.empurrar(j.x + morte.vx * dt, j.z + morte.vz * dt, 0.35); j.x = p.x; j.z = p.z;
      if (j.y <= 0) { morte.vx *= 0.6; morte.vz *= 0.6; morte.vy = Math.abs(morte.vy) * 0.35; }
      morte.rx = Math.min(Math.PI / 2, morte.rx + dt * 5);
      j.g.rotation.set(morte.rx, j.rot, morte.t * 3);
    }
    if (morte.t > Z.respawnSegundos) respawn();
  }
  function respawn() {
    const j = PT.mundo.jog; morte = null;
    j.x = M.porta.x + 1; j.z = M.porta.z; j.y = 0; j.morto = false; j.g.rotation.set(0, 0, 0);
    PT.ev.emit('respawn', {});
    PT.ui.email({ de: 'Hospital Municipal (fictício)', assunto: 'Sua internação foi registrada',
      texto: 'Prezado(a) paciente, registramos mais uma visita sua ao nosso pronto-socorro. Valor simbólico: ' + PT.util.reais(PT.DADOS.economia.boletoHospitalSimbolico) +
        ' (cortesia da casa — não será cobrado). Favor não repetir o procedimento. Visitas este ano: ' + st.mortes + '.' });
    PT.ev.emit('celular', { de: 'Você', texto: PT.util.escolha(Z.resmungos) });
  }

  // ---------- cicatrizes no piso ----------
  const visuais = [];
  function cicatriz(x, z, nivel, semEvento) {
    const c = { id: PT.util.id('cic'), x, z, nivel };
    st.cicatrizes.push(c);
    const g = new THREE.Mesh(new THREE.CircleGeometry(nivel > 1 ? 1.4 : 0.9, 18), new THREE.MeshLambertMaterial({ color: nivel > 1 ? 0x2b2b2b : 0x4a4a4a }));
    g.rotation.x = -Math.PI / 2; g.position.set(x, 0.07, z); PT.mundo.scene.add(g);
    visuais.push({ c, g });
    PT.registroModelos.usos.piso_concreto = (PT.registroModelos.usos.piso_concreto || 0);
    if (!semEvento) PT.ev.emit('cicatriz', c);
  }
  function consertar(c) {
    st.cicatrizes = st.cicatrizes.filter(x => x !== c);
    const v = visuais.find(v => v.c === c); if (v) { PT.mundo.scene.remove(v.g); visuais.splice(visuais.indexOf(v), 1); }
  }
  PT.inter.registrar(j => {
    if (j.carregando || j.controlando) return null;
    const c = st.cicatrizes.find(c => Math.hypot(j.x - c.x, j.z - c.z) < 2);
    if (!c) return null;
    const ops = [];
    if (PT.estoque.st.inv.cimento > 0) ops.push({ rotulo: 'Remendar o piso com cimento (faça você mesmo)', prio: 4, acao: () => PT.ui.progresso('Remendando com a colher de pedreiro...', 4, () => { PT.estoque.st.inv.cimento--; consertar(c); PT.ev.emit('aviso', 'Piso remendado. Ficou quase bom.'); }) });
    else ops.push({ rotulo: 'Piso quebrado (compre cimento na loja para remendar)', prio: 9, acao: () => PT.ev.emit('aviso', 'Sem cimento no inventário.') });
    return ops;
  });

  // ---------- reações a eventos ----------
  PT.ev.on('caboRompeu', () => { st.cabosRompidos++; PT.ev.emit('aviso', 'TÉÉÉIM! O CABO DA PONTE ESTOUROU!'); });
  PT.ev.on('enrosco', m => { st.enroscos++; PT.ev.emit('celular', { de: m.nome, texto: 'CRAAACK! A chapa virou uma mola gigante e enroscou nos rolos.' }); });

  return {
    st, init, atualizar, morrer, acidente, cicatriz, consertar,
    salvar() { return JSON.parse(JSON.stringify(st)); },
    carregar(o) { const cs = o.cicatrizes || []; Object.assign(st, o, { cicatrizes: [] }); cs.forEach(c => cicatriz(c.x, c.z, c.nivel, true)); desenharPlaca(); }
  };
})();
