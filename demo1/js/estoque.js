// =====================================================================
// estoque.js — bobinas, pilhas de produto, carregar na mão, paleteira
// e inventário de consumíveis. Unidades oficiais: METRO linear de chapa
// para bobina, UNIDADE para telhas/peças, kg para peso.
// =====================================================================
window.PT = window.PT || {};

PT.estoque = (function () {
  const D = PT.DADOS, EPS = 1e-6;
  const st = { contBobina: 0, inv: { cimento: 0, tinta: 0 } };

  // ---------------- BOBINAS ----------------
  function rotuloBobina(o) { return o.codigo + ' | ' + D.bobinas[o.spec].nome.replace('Bobina galvalume ', 'GL ') + ' | ' + Math.round(o.pesoKg) + ' kg'; }
  function novaBobina(spec, x, z, y, dadosSalvos) {
    const b = D.bobinas[spec];
    const codigo = dadosSalvos && dadosSalvos.codigo ? dadosSalvos.codigo : 'BOB-' + String(++st.contBobina).padStart(3, '0');
    const o = Object.assign({ tipo: 'bobina', spec, codigo,
      pesoKg: b.pesoKg, metros: b.pesoKg / 1000 * b.metrosPorTon, icavel: true, solido: true, modelo: b.modelo, x, z, y: y || 0 }, dadosSalvos || {});
    o.rotulo = rotuloBobina(o);
    PT.ent.add(o); visualBobina(o);
    return o;
  }
  function visualBobina(o) {
    const b = D.bobinas[o.spec];
    const frac = Math.max(0.25, Math.sqrt(o.metros / (b.pesoKg / 1000 * b.metrosPorTon)));   // área do anel ~ metros
    o.g.userData.mesh.scale.set(frac, frac, 1);
    o.g.userData.mesh.position.y = o.g.userData.altura * frac / 2;
    if (o.g.userData.rotulo) o.g.userData.rotulo.userData.atualizar(rotuloBobina(o));
  }
  // consome metros de uma bobina; retorna quanto conseguiu
  function consumir(o, metros) {
    const b = D.bobinas[o.spec]; const usar = Math.min(metros, o.metros);
    o.metros -= usar; if (o.metros < EPS) o.metros = 0;
    o.pesoKg = o.metros / b.metrosPorTon * 1000;
    visualBobina(o); return usar;
  }

  // ---------------- PILHAS ----------------
  function pesoUnit(produto, comp) { const p = D.produtos[produto]; return p.larguraUtil * comp * 4.2; }   // ~4,2 kg/m² chapa 0,43
  function rotuloPilha(o) { return D.produtos[o.produto].nome + ' ' + o.comprimento.toFixed(2) + ' m × ' + o.qtd + (o.defeituosas && !o.tortasEscondidas ? ' (' + o.defeituosas + ' tortas)' : ''); }
  function modeloPilha(produto) { return produto === 'TP40' ? 'pilha_telhas' : (produto === 'CHAPA' ? 'pilha_chapas' : 'pilha_rufos'); }
  function novaPilha(produto, comprimento, x, z, extra) {
    const o = Object.assign({ tipo: 'pilha', produto, comprimento, qtd: 0, defeituosas: 0, solido: true, x, z, y: 0 }, extra || {});
    o.modelo = modeloPilha(produto);
    o.dimsVisual = dimsPilha(o); o.rotulo = rotuloPilha(o);
    PT.ent.add(o); o.pesoKg = 0; return o;
  }
  function dimsPilha(o) { const p = D.produtos[o.produto]; return [Math.max(0.5, o.comprimento), p.larguraUtil + 0.05, 0.08 + 0.025 * Math.max(1, o.qtd)]; }
  function atualizarPilha(o) {
    const d = dimsPilha(o); const m = o.g.userData.mesh;
    m.geometry.dispose(); m.geometry = new THREE.BoxGeometry(d[0], d[2], d[1]); m.position.y = d[2] / 2;
    o.dims = [d[0], d[1], d[2]]; o.g.userData.altura = d[2];
    o.rotulo = rotuloPilha(o);
    if (o.g.userData.rotulo) { o.g.userData.rotulo.position.y = d[2] + 0.6; o.g.userData.rotulo.userData.atualizar(o.rotulo, o.defeituosas ? '#ffb3a7' : '#fff'); }
    o.pesoKg = pesoUnit(o.produto, o.comprimento) * o.qtd;
    PT.ent.sync(o);
  }
  function addNaPilha(o, qtd, tortas) { o.qtd += qtd; o.defeituosas += tortas || 0; atualizarPilha(o); }

  // ---------------- CARREGAR ----------------
  function frente(j, dist) { return { x: j.x + Math.sin(j.rot) * dist, z: j.z + Math.cos(j.rot) * dist }; }
  function prender(o, como) { o.preso = como; }
  // solta no chão SEM sobrepor outra coisa: procura o lugar livre mais perto (ChatGPT, bug 9)
  function livre(o, x, z) {
    const fp = PT.construcao.footprint(x, z, o.dims, o.rot), M = PT.DADOS.mundo;
    if (fp.x0 < 0.2 || fp.x1 > M.L - 0.2 || fp.z0 < 0.2 || fp.z1 > M.D - 0.2) return false;
    if (PT.mundo.paredes.some(p => PT.construcao.cruza(fp, p))) return false;
    return !PT.ent.lista.some(e => e !== o && !e.preso && e.aabb && e.tipo !== 'berco' && PT.construcao.cruza(fp, e.aabb));
  }
  function soltarNoChao(o, x, z) {
    o.preso = null; o.y = 0;
    let px = x, pz = z;
    if (!livre(o, x, z)) {
      achar: for (let r = 0.5; r <= 8; r += 0.5) for (let a = 0; a < 16; a++) {
        const tx = x + Math.cos(a / 16 * 6.283) * r, tz = z + Math.sin(a / 16 * 6.283) * r;
        if (livre(o, tx, tz)) { px = tx; pz = tz; break achar; }
      }
    }
    o.x = px; o.z = pz;
    PT.ent.sync(o); PT.ev.emit('soltou', o);
  }

  // cada frame: objetos carregados seguem o jogador
  function atualizar() {
    const j = PT.mundo.jog, c = j.carregando; if (!c) return;
    if (c.tipo === 'mao') { const f = frente(j, 0.7); c.ent.x = f.x; c.ent.z = f.z; c.ent.y = 0.9; c.ent.rot = j.rot; PT.ent.sync(c.ent); }
    if (c.tipo === 'paleteira') {
      const f = frente(j, 1.1); c.ent.x = f.x; c.ent.z = f.z; c.ent.rot = j.rot + Math.PI / 2; PT.ent.sync(c.ent);
      if (c.carga) { const f2 = frente(j, 1.1 + c.carga.dims[0] / 2); c.carga.x = f2.x; c.carga.z = f2.z; c.carga.y = 0.12; c.carga.rot = j.rot + Math.PI / 2; PT.ent.sync(c.carga); }
    }
  }

  // ---------------- INTERAÇÕES ----------------
  PT.inter.registrar(j => {
    const ops = [], A = D.personagem.alcanceInteracao, c = j.carregando;
    if (j.controlando) return ops;
    if (!c) {
      const p = PT.ent.perto(j.x, j.z, A, o => !o.preso && o.y < 0.2 && ((o.tipo === 'volume' && o.pequeno) || o.tipo === 'decor'));
      if (p) {
        ops.push({ rotulo: 'Pegar ' + (p.rotulo || p.tipo), acao: () => { j.carregando = { tipo: 'mao', ent: p, lento: 0.85 }; prender(p, 'mao'); } });
        const f = PT.loja.ficha(p.item);
        if (f && f.consumivel) ops.push({ rotulo: 'Guardar ' + f.nome + ' no inventário', acao: () => { st.inv[f.consumivel]++; PT.ent.remover(p); PT.ev.emit('aviso', '+1 ' + f.nome); } });
      }
      const pal = PT.ent.perto(j.x, j.z, A, o => o.tipo === 'paleteira' && !o.preso);
      if (pal) ops.push({ rotulo: 'Pegar a paleteira', prio: 4, acao: () => { j.carregando = { tipo: 'paleteira', ent: pal, carga: null, lento: 0.75 }; prender(pal, 'jogador'); } });
    } else if (c.tipo === 'mao') {
      const f = PT.loja.ficha(c.ent.item);
      ops.push({ rotulo: 'Soltar', acao: () => { const p = frente(j, 0.9); soltarNoChao(c.ent, p.x, p.z); j.carregando = null; } });
      if (f && (f.tipoItem === 'decor' || f.id === 'berco_bobina' || f.id === 'paleteira')) ops.push({ rotulo: 'Abrir e instalar ' + f.nome, acao: () => PT.construcao.iniciarDeVolume(c.ent) });
      if (f && f.tipoItem === 'quadro') {
        const q = PT.DADOS.mundo.quadro;
        if (Math.hypot(j.x - q.x, j.z - q.z) < 3) ops.push({ rotulo: 'Trocar o quadro elétrico (' + f.upgradeQuadroKW + ' kW)', acao: () => { PT.construcao.trocarQuadro(f.upgradeQuadroKW); PT.ent.remover(c.ent); j.carregando = null; } });
      }
    } else if (c.tipo === 'paleteira') {
      if (!c.carga) {
        const alvo = PT.ent.perto(frente(j, 1.6).x, frente(j, 1.6).z, 1.4, o => !o.preso && o.y < 0.2 && (o.tipo === 'pilha' || (o.tipo === 'volume' && !o.pequeno)) && (o.pesoKg || 0) <= 2500);
        if (alvo) ops.push({ rotulo: 'Erguer ' + (alvo.rotulo || alvo.tipo) + ' com a paleteira', acao: () => { c.carga = alvo; prender(alvo, 'paleteira'); c.lento = 0.55; PT.ev.emit('paleteiraCarregou', alvo); } });
      } else {
        ops.push({ rotulo: 'Baixar a carga', acao: () => { const p = frente(j, 1.1 + c.carga.dims[0] / 2); soltarNoChao(c.carga, p.x, p.z); c.carga = null; c.lento = 0.75; } });
      }
      ops.push({ rotulo: 'Largar a paleteira', prio: 9, acao: () => {
        if (c.carga) { const p = frente(j, 1.1 + c.carga.dims[0] / 2); soltarNoChao(c.carga, p.x, p.z); }
        const p = frente(j, 1.1); soltarNoChao(c.ent, p.x, p.z); j.carregando = null; } });
    }
    return ops;
  });

  return {
    st, novaBobina, consumir, visualBobina, novaPilha, addNaPilha, atualizarPilha, atualizar, soltarNoChao, frente,
    salvar() { return { contBobina: st.contBobina, inv: st.inv }; },
    carregar(o) { st.contBobina = o.contBobina || 0; st.inv = o.inv || { cimento: 0, tinta: 0 }; }
  };
})();
