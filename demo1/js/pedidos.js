// =====================================================================
// pedidos.js — clientes, ofertas, negociação, coleta e pagamento.
// Ciclo: oferta → aceito (entrada paga) → coleta (caminhão na zona
// verde) → carregado → entregue (saldo agendado conforme o perfil).
// Cada transição checa o status atual (sem clique duplo cobrando 2x).
// =====================================================================
window.PT = window.PT || {};

PT.pedidos = (function () {
  const D = PT.DADOS, P = D.pedidos;
  const st = { lista: [], cont: 0, proxHoras: 2 };

  function pecasDe(produto, comp, qtdUnid) {
    const p = D.produtos[produto];
    return p.unidade === 'm²' ? Math.max(1, Math.ceil(qtdUnid / (comp * p.larguraUtil))) : Math.max(1, Math.ceil(qtdUnid / comp));
  }
  function gerar() {
    const faixa = PT.rep.faixa();
    const perfis = {}; Object.keys(D.clientes).forEach(k => { if (D.clientes[k].faixaMin <= faixa) perfis[k] = D.clientes[k]; });
    const k = PT.util.escolhaPeso(perfis), C = D.clientes[k];
    const produto = PT.util.escolha(C.produto), prod = D.produtos[produto];
    const comp = produto === 'TP40' ? PT.util.escolha([3, 4, 5, 6]) : PT.util.escolha([2, 3]);
    const unid = PT.util.randInt(C.qtd[0], C.qtd[1]);
    const pecas = pecasDe(produto, comp, unid);
    const qtdUnid = pecas * comp * (prod.unidade === 'm²' ? prod.larguraUtil : 1);
    const precoUnit = Math.round(prod.precoBase * PT.util.rand(0.95, 1.06) * 100) / 100;
    const prazo = PT.util.randInt(C.prazo[0], C.prazo[1]);
    const ped = { id: 'PED-' + String(++st.cont).padStart(3, '0'), perfil: k, cliente: PT.util.escolha(C.nomes), canal: C.canal,
      produto, comprimento: comp, pecas, qtdUnid, unidade: prod.unidade, precoUnit, valor: Math.round(qtdUnid * precoUnit),
      prazoDia: PT.tempo.st.dia + prazo, status: 'oferta', criadoH: PT.tempo.agoraHoras(), entradaPaga: 0, carregadas: 0, tortasEntregues: 0 };
    st.lista.push(ped);
    PT.ev.emit('pedidoNovo', ped);
    return ped;
  }

  function descricao(p) { return p.pecas + 'x ' + D.produtos[p.produto].nome + ' de ' + p.comprimento + ' m (' + p.qtdUnid.toFixed(0) + ' ' + p.unidade + ') — ' + PT.util.reais(p.valor); }

  function aceitar(id, ajustePreco) {
    const p = st.lista.find(x => x.id === id); if (!p || p.status !== 'oferta') return false;
    if (ajustePreco !== undefined && !(Number.isFinite(ajustePreco) && ajustePreco >= 0.5 && ajustePreco <= 2)) return false;
    if (ajustePreco) { p.precoUnit = Math.round(p.precoUnit * ajustePreco * 100) / 100; p.valor = Math.round(p.qtdUnid * p.precoUnit); }
    const pg = D.clientes[p.perfil].pagamento;
    p.status = 'aceito';
    p.entradaPaga = Math.round(p.valor * pg.entrada);
    if (p.entradaPaga > 0) PT.eco.lancar(p.entradaPaga, (pg.entrada >= 1 ? 'Pix — ' : 'Entrada — ') + p.id + ' ' + p.cliente);
    p.janelaH = (p.prazoDia - 1) * 24 + 14;     // coleta no dia do prazo às 14h
    PT.entrega.agendar(p.prazoDia, [], p.cliente, { tipo: 'coleta', pedidoId: p.id, hora: 14 });
    PT.ev.emit('pedidoAceito', p); return true;
  }
  function recusar(id) { const p = st.lista.find(x => x.id === id); if (!p || p.status !== 'oferta') return; p.status = 'recusado'; PT.ev.emit('pedidoAtualizado', p); }
  // pedreiro: contraproposta +10% — 50% de chance de aceitar
  function contraproposta(id) {
    const p = st.lista.find(x => x.id === id); if (!p || p.status !== 'oferta') return null;
    if (Math.random() < 0.5) { aceitar(id, 1.10); return true; }
    p.status = 'recusado'; PT.ev.emit('pedidoAtualizado', p); return false;   // (ChatGPT: faltava o evento)
  }
  function chamarAgora(id) {
    const p = st.lista.find(x => x.id === id); if (!p || p.status !== 'aceito') { PT.ev.emit('aviso', 'Esse pedido não está aguardando coleta.'); return false; }
    if (PT.entrega.st.caminhoes.some(c => c.e.pedidoId === id)) { PT.ev.emit('aviso', 'O caminhão desse pedido já está em trânsito.'); return false; }
    const f = PT.entrega.st.fila.find(e => e.pedidoId === id);
    if (!f) { PT.ev.emit('aviso', 'Não há coleta agendada para ' + id + '.'); return false; }
    f.dia = PT.tempo.st.dia; f.hora = 0;
    PT.ev.emit('aviso', 'Caminhão de ' + p.cliente + ' a caminho.'); return true;
  }

  // estoque disponível na zona verde para um pedido
  function pilhasPara(p) { return PT.ent.naZona('expedicao', o => o.tipo === 'pilha' && !o.preso && o.produto === p.produto && Math.abs(o.comprimento - p.comprimento) < 1e-6); }
  function disponivel(p) { const ps = pilhasPara(p); return { boas: ps.reduce((a, o) => a + o.qtd - o.defeituosas, 0), tortas: ps.reduce((a, o) => a + o.defeituosas, 0) }; }

  function carregar(c, incluirTortas) {
    const p = st.lista.find(x => x.id === c.e.pedidoId); if (!p || p.status !== 'coleta') return;
    let falta = p.pecas - p.carregadas;
    const ps = pilhasPara(p);
    // primeiro as boas, depois (se o jogador quiser) as tortas
    for (const passo of ['boas', 'tortas']) {
      if (passo === 'tortas' && !incluirTortas) break;
      for (const o of ps) {
        if (falta <= 0) break;
        const disp = passo === 'boas' ? o.qtd - o.defeituosas : o.defeituosas;
        const n = Math.min(disp, falta); if (n <= 0) continue;
        o.qtd -= n; if (passo === 'tortas') { o.defeituosas -= n; p.tortasEntregues += n; }
        falta -= n; p.carregadas += n;
        // MANIFESTO: o que está fisicamente na carroceria deste caminhão
        c.manifesto = c.manifesto || []; c.manifesto.push({ produto: o.produto, comprimento: o.comprimento, n, tortas: passo === 'tortas' ? n : 0 });
        if (o.qtd <= 0) PT.ent.remover(o); else PT.estoque.atualizarPilha(o);
      }
    }
    if (p.carregadas >= p.pecas) concluir(p, c);
    else PT.ev.emit('aviso', 'Carregadas ' + p.carregadas + ' de ' + p.pecas + '. Faltam ' + (p.pecas - p.carregadas) + ' peças na zona verde.');
  }

  function concluir(p, c) {
    p.status = 'entregue'; p.entregueDia = PT.tempo.st.dia;
    PT.entrega.partir(c);
    const E = D.reputacao.efeitos;
    const atrasoH = Math.max(0, PT.tempo.agoraHoras() - (p.janelaH + 2));
    if (atrasoH <= D.pedidos.toleranciaAtrasoHoras) PT.rep.efeito('pontualidade', E.noPrazo);
    else PT.rep.efeito('pontualidade', E.atrasoPorHora * Math.min(24, atrasoH));
    const fracTorta = p.tortasEntregues / p.pecas;
    if (fracTorta > 0) { PT.rep.efeito('qualidade', E.defeito * (1 + fracTorta * 4)); PT.ev.emit('celular', { de: p.cliente, texto: 'Chegaram ' + p.tortasEntregues + ' telha(s) torta(s) aqui na obra, hein! Da próxima vez confere antes.' }); }
    else PT.rep.efeito('qualidade', E.semDefeito);
    PT.rep.entregou();
    const pg = D.clientes[p.perfil].pagamento, saldo = p.valor - p.entradaPaga;
    if (saldo > 0) {
      const desconto = fracTorta > 0 ? Math.round(saldo * fracTorta) : 0;        // cliente abate as tortas
      if (pg.prazoSaldo === 0) PT.eco.lancar(saldo - desconto, 'Saldo na entrega — ' + p.id + ' ' + p.cliente);
      else PT.eco.agendarRecebimento(PT.tempo.st.dia + pg.prazoSaldo, saldo - desconto, 'Boleto ' + pg.prazoSaldo + 'd — ' + p.id + ' ' + p.cliente, p.id);
    }
    PT.ev.emit('pedidoEntregue', p);
  }

  // coleta não concluída: o que já foi carregado volta para a zona verde (preserva as tortas)
  function devolverManifesto(p, c) {
    const m = c.manifesto || []; if (!m.length) return;
    const z = PT.DADOS.mundo.zonas.expedicao;
    m.forEach((it, i) => {
      const pl = PT.estoque.novaPilha(it.produto, it.comprimento, z.x0 + 3 + (i % 3) * 6.5, z.z0 + 1.2 + Math.floor(i / 3) * 1.6);
      PT.estoque.addNaPilha(pl, it.n, it.tortas);
      p.carregadas -= it.n; p.tortasEntregues -= it.tortas;
    });
    c.manifesto = [];
    PT.ev.emit('aviso', 'O motorista descarregou de volta o que já estava no caminhão (' + m.reduce((a, x) => a + x.n, 0) + ' peças).');
  }

  // motorista cansou de esperar com carga pela metade (sala: Gemini + Claude):
  // leva o que já carregou como ENTREGA PARCIAL (cliente paga proporcional) e o
  // resto vira um sub-pedido para amanhã às 14h, com perda de pontualidade.
  function entregaParcial(p, c) {
    const resto = p.pecas - p.carregadas, frac = p.carregadas / p.pecas;
    const valorParte = Math.round(p.valor * frac);
    const sub = Object.assign({}, p, {
      id: p.id + '-B', pecas: resto, qtdUnid: p.qtdUnid * (1 - frac), valor: p.valor - valorParte,
      carregadas: 0, tortasEntregues: 0, status: 'aceito', prazoDia: PT.tempo.st.dia + 1, entradaPaga: 0, caminhao: null,
      criadoH: PT.tempo.agoraHoras(), janelaH: PT.tempo.st.dia * 24 + 14 });
    // entrada já paga acima do valor entregue passa para o sub-pedido (pedreiro paga 100% no Pix)
    if (p.entradaPaga > valorParte) { sub.entradaPaga = p.entradaPaga - valorParte; p.entradaPaga = valorParte; }
    p.pecas = p.carregadas; p.qtdUnid = p.qtdUnid * frac; p.valor = valorParte;
    st.lista.push(sub);
    PT.entrega.agendar(sub.prazoDia, [], sub.cliente, { tipo: 'coleta', pedidoId: sub.id, hora: 14 });
    PT.rep.efeito('pontualidade', D.reputacao.efeitos.caminhaoEsperando * 5);
    PT.ev.emit('celular', { de: p.cliente, texto: 'Cansei de esperar! Levei as ' + p.carregadas + ' que estavam no caminhão. As outras ' + resto + ' eu busco amanhã às 14h (' + sub.id + ').' });
    p.caminhao = null; p.status = 'coleta';
    concluir(p, c);
    PT.ev.emit('pedidoNovo', Object.assign({}, sub, { silencioso: true }));
  }

  // caminhão da coleta chegou
  PT.ev.on('coletaChegou', c => {
    const p = st.lista.find(x => x.id === c.e.pedidoId); if (!p || p.status !== 'aceito') { PT.entrega.partir(c); return; }
    p.status = 'coleta'; p.caminhao = c; c.esperaMax = D.pedidos.janelaColetaHoras * 60;
    PT.ev.emit('celular', { de: p.cliente, texto: 'Tô na expedição pra pegar o ' + p.id + ' (' + p.pecas + ' peças). Tenho ' + D.pedidos.janelaColetaHoras + ' horas.' });
  });
  // caminhão esperando demais vai embora e volta amanhã (atraso)
  PT.ev.on('minuto', () => {
    st.lista.forEach(p => {
      if (p.status === 'coleta' && p.caminhao && p.caminhao.espera > p.caminhao.esperaMax) {
        const c = p.caminhao;
        if (D.pedidos.cargaParcial === 'entregaParcial' && p.carregadas > 0) { entregaParcial(p, c); return; }
        devolverManifesto(p, c);
        PT.entrega.partir(c); p.caminhao = null; p.status = 'aceito';
        PT.rep.efeito('pontualidade', D.reputacao.efeitos.caminhaoEsperando * 5);
        PT.ev.emit('celular', { de: p.cliente, texto: 'Cansei de esperar. Volto amanhã às 14h e é bom estar pronto!' });
        PT.entrega.agendar(PT.tempo.st.dia + 1, [], p.cliente, { tipo: 'coleta', pedidoId: p.id, hora: 14 });
        p.janelaH = PT.tempo.st.dia * 24 + 14;
      }
      // oferta sem resposta por 2 h expira
      if (p.status === 'oferta' && PT.tempo.agoraHoras() - p.criadoH > 2) { p.status = 'expirado'; PT.ev.emit('pedidoAtualizado', p); }
    });
  });
  // pedido muito atrasado (3 dias depois do prazo) é cancelado
  PT.ev.on('dia', ({ dia }) => {
    st.lista.forEach(p => {
      if ((p.status === 'aceito') && dia > p.prazoDia + 3) {
        p.status = 'cancelado'; PT.rep.efeito('pontualidade', D.reputacao.efeitos.cancelado);
        if (p.entradaPaga > 0) { PT.eco.lancar(-p.entradaPaga, 'Estorno da entrada (cancelado por atraso) — ' + p.id); p.entradaPaga = 0; }
        const multa = Math.round(p.valor * D.pedidos.multaCancelamento);
        if (multa > 0) PT.eco.lancar(-multa, 'Multa contratual ' + Math.round(D.pedidos.multaCancelamento * 100) + '% (atraso) — ' + p.id);
        PT.entrega.st.fila = PT.entrega.st.fila.filter(e => e.pedidoId !== p.id);
        PT.ev.emit('celular', { de: p.cliente, texto: 'Cancelei o ' + p.id + '. Comprei do concorrente.' });
        PT.ev.emit('pedidoAtualizado', p);
      }
    });
  });
  PT.ev.on('hora', () => {
    st.proxHoras -= 1;
    if (st.proxHoras <= 0) {
      st.proxHoras = PT.util.randInt(P.intervaloHoras[0], P.intervaloHoras[1]);
      if (st.lista.filter(p => ['oferta', 'aceito', 'coleta'].includes(p.status)).length < P.maxAbertos) gerar();
    }
  });

  // interação no caminhão da coleta
  PT.inter.registrar(j => {
    if (j.controlando || (j.carregando && j.carregando.tipo !== 'paleteira')) return null;
    const ops = [];
    PT.entrega.st.caminhoes.forEach(c => {
      if (c.e.tipo !== 'coleta' || c.estado !== 'parado') return;
      if (Math.hypot(j.x - c.x, j.z - PT.DADOS.mundo.caminhao.z) > 8) return;
      const p = st.lista.find(x => x.id === c.e.pedidoId); if (!p || p.status !== 'coleta') return;
      const d = disponivel(p);
      ops.push({ rotulo: 'Carregar ' + p.id + ' (' + p.carregadas + '/' + p.pecas + ' — na zona verde: ' + d.boas + ' boas)', prio: 1, acao: () => carregar(c, false) });
      if (d.tortas > 0) ops.push({ rotulo: 'Carregar incluindo ' + d.tortas + ' torta(s)... ninguém vai notar', prio: 2, acao: () => carregar(c, true) });
    });
    return ops;
  });

  return {
    st, gerar, aceitar, recusar, contraproposta, chamarAgora, descricao, disponivel, devolverManifesto,
    salvar() { return { lista: st.lista.map(p => Object.assign({}, p, { caminhao: null, status: p.status === 'coleta' ? 'aceito' : p.status })), cont: st.cont, proxHoras: st.proxHoras }; },
    carregar(o) {
      st.lista = o.lista || []; st.cont = o.cont || 0; st.proxHoras = o.proxHoras || 2;
      // caminhão de coleta que estava no pátio na hora do save: volta para a fila
      st.lista.filter(p => p.status === 'aceito' && !PT.entrega.st.fila.some(e => e.pedidoId === p.id))
        .forEach(p => PT.entrega.agendar(Math.max(PT.tempo.st.dia, p.prazoDia), [], p.cliente, { tipo: 'coleta', pedidoId: p.id, hora: 14 }));
    }
  };
})();
