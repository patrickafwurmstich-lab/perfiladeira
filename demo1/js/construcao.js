// =====================================================================
// construcao.js — modo construção (fantasma), instalação, nivelamento,
// cabos elétricos e quadro.
// Fantasma: VERDE ok | AMARELO ok com aviso (no corredor do caminhão)
//           VERMELHO impedido (fora do barracão, colisão, parede).
// Grade 0,5 m; R gira 90° (decoração 15°); clique/Enter confirma; Esc cancela.
// =====================================================================
window.PT = window.PT || {};

PT.construcao = (function () {
  const M = PT.DADOS.mundo;
  const st = { ativo: null, quadroKW: M.quadro.capacidadeKW, cabos: [] };   // cabos: {maqId, linha}
  const cores = { verde: 0x2ecc71, amarelo: 0xf1c40f, vermelho: 0xe74c3c };

  // ---------- iniciar ----------
  function iniciar(spec) {
    // spec: { itemId, dims, modelo, nome, decor, volume (entidade a remover), maqSalva }
    cancelar();
    const fant = PT.modelo(spec.modelo, { dims: spec.dims, transparente: true, semSombra: true, rotulo: spec.nome });
    PT.registroModelos.usos[spec.modelo]--; PT.registroModelos.ativos[spec.modelo]--;      // fantasma não conta como uso
    const area = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x3498db, transparent: true, opacity: 0.25 }));
    area.rotation.x = -Math.PI / 2; area.position.y = 0.08;
    const grupo = new THREE.Group(); grupo.add(fant); grupo.add(area);
    PT.mundo.scene.add(grupo);
    const j = PT.mundo.jog;
    st.ativo = Object.assign({ grupo, fant, area, rot: 0, x: j.x + 3, z: j.z, cor: 'verde', motivo: '' }, spec);
    PT.ev.emit('construcao', true);
  }
  function iniciarDeVolume(vol) {
    const f = PT.loja.ficha(vol.item);
    const j = PT.mundo.jog;
    if (j.carregando && j.carregando.ent === vol) j.carregando = null;
    iniciar({ itemId: f.id, dims: f.dims, modelo: f.modelo, nome: f.nome, decor: f.tipoItem === 'decor', volume: vol });
  }
  function cancelar() {
    if (!st.ativo) return;
    PT.mundo.scene.remove(st.ativo.grupo);
    if (st.ativo.volume && st.ativo.volume.preso === 'mao') { const j = PT.mundo.jog; j.carregando = { tipo: 'mao', ent: st.ativo.volume, lento: 0.85 }; }
    if (st.ativo.maqSalva) PT.maq.reinstalar(st.ativo.maqSalva, true); // desistiu de mover: volta para onde estava, com cabo
    st.ativo = null; PT.ev.emit('construcao', false);
  }

  // ---------- validação ----------
  // AABB da caixa girada em QUALQUER ângulo (decoração gira 15°) — ChatGPT, bug 10
  function footprint(x, z, dims, rot) {
    const c = Math.abs(Math.cos(rot || 0)), s = Math.abs(Math.sin(rot || 0));
    const w = c * dims[0] + s * dims[1], d = s * dims[0] + c * dims[1];
    return { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 };
  }
  // área de operação: faixa de 1,5 m na frente da máquina (lado do CLP, +Z local)
  function areaOperacao(x, z, dims, rot) {
    const off = dims[1] / 2 + 0.75, cx = x + Math.sin(rot) * off, cz = z + Math.cos(rot) * off;
    return footprint(cx, cz, [dims[0], 1.5], rot);
  }
  function cruza(a, b) { return a.x0 < b.x1 && a.x1 > b.x0 && a.z0 < b.z1 && a.z1 > b.z0; }
  function validar(a) {
    const fp = footprint(a.x, a.z, a.dims, a.rot);
    const lj = M.loja, naLoja = a.decor && fp.x0 >= lj.x0 + 0.2 && fp.x1 <= lj.x1 - 0.2 && fp.z0 >= lj.z0 + 0.2 && fp.z1 <= lj.z1 - 0.2;   // decoração pode ir na loja de balcão
    if (!naLoja && (fp.x0 < 0.3 || fp.x1 > M.L - 0.3 || fp.z0 < 0.3 || fp.z1 > M.D - 0.3)) return { cor: 'vermelho', motivo: 'Fora do barracão' };
    if (PT.mundo.paredes.some(p => cruza(fp, p))) return { cor: 'vermelho', motivo: 'Bate na parede/escritório' };
    const ignora = o => o === a.volume || o.preso === 'mao' || o.preso === 'jogador' || o.preso === 'paleteira' || o.tipo === 'decorChao' || o.tipo === 'berco';
    const bate = PT.ent.lista.find(o => !ignora(o) && o.aabb && cruza(fp, o.aabb));
    if (bate) return { cor: 'vermelho', motivo: 'Ocupado por ' + (bate.rotulo || bate.tipo) };
    if (!a.decor) {
      const ao = areaOperacao(a.x, a.z, a.dims, a.rot);
      if (PT.mundo.paredes.some(p => cruza(ao, p))) return { cor: 'vermelho', motivo: 'A frente da máquina (área de operação) bate na parede' };
      const ba = PT.ent.lista.find(o => !ignora(o) && o.aabb && (o.tipo === 'maquina' || o.tipo === 'decor') && cruza(ao, o.aabb));
      if (ba) return { cor: 'vermelho', motivo: 'Área de operação bloqueada por ' + (ba.rotulo || ba.tipo) };
    }
    if (fp.z0 < M.corredor.z1 && fp.z1 > M.corredor.z0) return { cor: 'amarelo', motivo: 'No corredor do caminhão: ele não vai conseguir passar!' };
    return { cor: 'verde', motivo: 'Pode instalar' };
  }

  // ---------- frame ----------
  function atualizar() {
    const a = st.ativo; if (!a) return;
    const p = PT.mundo.chaoSobMouse();
    if (p) { const g = M.grade; a.x = PT.util.snap(p.x, g); a.z = PT.util.snap(p.z, g); }
    const v = validar(a); a.cor = v.cor; a.motivo = v.motivo;
    a.grupo.position.set(a.x, 0, a.z); a.grupo.rotation.y = a.rot;
    a.fant.userData.mesh.material.color.setHex(cores[a.cor]);
    // área de operação: 1,5 m na frente (lado +Z local) para máquinas
    if (!a.decor) { a.area.visible = true; a.area.scale.set(a.dims[0], 1.5, 1); a.area.position.set(0, 0.08, a.dims[1] / 2 + 0.75); }
    else a.area.visible = false;
  }

  PT.ev.on('tecla', code => {
    const a = st.ativo; if (!a) return;
    if (code === 'KeyR') a.rot += a.decor ? Math.PI / 12 : Math.PI / 2;
    if (code === 'Escape') cancelar();
    if (code === 'Enter' || code === 'NumpadEnter') confirmar();
  });
  PT.ev.on('clique', c => { if (st.ativo && c.botao === 0) confirmar(); });

  function confirmar() {
    const a = st.ativo; if (!a) return;
    if (a.cor === 'vermelho') { PT.ev.emit('aviso', '✖ ' + a.motivo); return; }
    if (a.cor === 'amarelo') PT.ev.emit('aviso', '⚠ ' + a.motivo);
    const pos = { x: a.x, z: a.z, rot: a.rot };
    const spec = a; st.ativo = null; PT.mundo.scene.remove(spec.grupo); PT.ev.emit('construcao', false);
    const finalizar = (nivel) => {
      if (spec.volume) { if (PT.mundo.jog.carregando && PT.mundo.jog.carregando.ent === spec.volume) PT.mundo.jog.carregando = null; PT.ent.remover(spec.volume); }
      if (spec.maqSalva) { PT.maq.reinstalar(Object.assign(spec.maqSalva, pos)); return; }
      const m = PT.DADOS.maquinas[spec.itemId];
      if (m) PT.maq.instalar(spec.itemId, pos.x, pos.z, pos.rot, { nivelamento: nivel });
      else if (spec.itemId === 'paleteira') PT.ent.add({ tipo: 'paleteira', modelo: 'paleteira', x: pos.x, z: pos.z, rot: pos.rot, solido: false });
      else if (spec.itemId === 'berco_bobina') PT.ent.add({ tipo: 'berco', modelo: 'berco_bobina', x: pos.x, z: pos.z, rot: pos.rot, solido: false, decorChao: true });
      else PT.ent.add({ tipo: 'decor', item: spec.itemId, modelo: spec.modelo, rotulo: spec.nome, x: pos.x, z: pos.z, rot: pos.rot, solido: true });
      PT.ev.emit('instalou', { itemId: spec.itemId, x: pos.x, z: pos.z });
    };
    // máquina nova: nivelamento (3 s, aperta ESPAÇO com a bolha no verde)
    if (PT.DADOS.maquinas[spec.itemId] && !spec.maqSalva) {
      PT.ui.minijogo({ titulo: 'Nivelar e chumbar a máquina', dica: 'Aperte ESPAÇO com a bolha no verde', dificuldade: 0.5 },
        nota => { finalizar(nota); PT.ev.emit('aviso', nota >= 0.6 ? 'CLANG! Máquina nivelada.' : 'Serviço nas coxas... vai vibrar.'); });
    } else finalizar(1);
  }

  // ---------- energia ----------
  function conectar(maq) {
    if (maq.cabo) return;
    const q = M.quadro;
    const pts = [new THREE.Vector3(q.x, 2.5, q.z - 0.2), new THREE.Vector3(q.x, 7.5, q.z - 0.2), new THREE.Vector3(maq.x, 7.5, maq.z), new THREE.Vector3(maq.x, 1.2, maq.z)];
    const linha = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x111111 }));
    PT.mundo.scene.add(linha); maq.cabo = linha;
    PT.registroModelos.usos.cabo_eletrico = (PT.registroModelos.usos.cabo_eletrico || 0) + 1;
    PT.ev.emit('aviso', 'Cabo ligado do quadro até ' + maq.nome);
  }
  function desconectar(maq) { if (maq.cabo) { PT.mundo.scene.remove(maq.cabo); maq.cabo = null; } }
  function kwLigado() { return PT.maq.lista.filter(m => m.cabo && m.ligada).reduce((a, m) => a + m.def.kw, 0); }
  function trocarQuadro(kw) { st.quadroKW = Math.max(st.quadroKW, kw); PT.ev.emit('aviso', 'Quadro elétrico agora tem ' + st.quadroKW + ' kW'); }

  return {
    st, iniciar, iniciarDeVolume, cancelar, atualizar, conectar, desconectar, kwLigado, trocarQuadro, footprint, areaOperacao, cruza, validar,
    get ativo() { return st.ativo; },
    salvar() { return { quadroKW: st.quadroKW }; }, carregar(o) { st.quadroKW = o.quadroKW || M.quadro.capacidadeKW; }
  };
})();

// volumes grandes (engradado de máquina) no chão: "Abrir e instalar"
PT.inter.registrar(j => {
  if (j.carregando || j.controlando || PT.construcao.ativo) return null;
  const v = PT.ent.perto(j.x, j.z, PT.DADOS.personagem.alcanceInteracao + 0.5, o => o.tipo === 'volume' && !o.pequeno && !o.preso && o.y < 0.2);
  if (!v) return null;
  return [{ rotulo: 'Abrir engradado e instalar ' + PT.loja.ficha(v.item).nome, prio: 3, acao: () => PT.construcao.iniciarDeVolume(v) }];
});
