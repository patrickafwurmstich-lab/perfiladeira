// =====================================================================
// ui.js — HUD, dicas de interação, avisos, celular, computador
// (Loja / Banco / E-mail / Pedidos / Reputação / Modelos 3D / Sistema),
// painel CLP, prancheta (TAB), minijogo, barra de progresso, morte.
// =====================================================================
window.PT = window.PT || {};

PT.ui = (function () {
  const $ = id => document.getElementById(id);
  const R = PT.util.reais;
  const st = { modal: null, aba: 'Loja', cat: 'Máquinas', correio: [], celular: [], prancheta: false, filaLigacoes: [] };

  function el(tag, attrs, html) { const e = document.createElement(tag); Object.assign(e, attrs || {}); if (html !== undefined) e.innerHTML = html; return e; }
  function modalAberto() { return !!st.modal; }
  function capturandoTeclado() { const a = document.activeElement; return a && (a.tagName === 'INPUT' || a.tagName === 'SELECT' || a.tagName === 'TEXTAREA'); }
  function abrirModal(nome) { st.modal = nome; ['computador', 'clp', 'minijogo', 'ligacao', 'progresso', 'carga', 'balcao'].forEach(n => $(n).style.display = n === nome ? 'flex' : 'none'); }
  // fecharModal(false) = trocar de janela sem liberar a fila de ligações (ex.: CLP → minijogo) — ChatGPT, bug 5
  function fecharModal(chamarFila) {
    if (st.modal === 'minijogo' || st.modal === 'progresso') return;
    if (st.modal === 'ligacao') ligacaoPerdida();
    st.modal = null; ['computador', 'clp', 'ligacao', 'carga', 'balcao'].forEach(n => $(n).style.display = 'none');
    if (chamarFila !== false) proximaLigacao();
  }
  // token: minijogo/progresso só executam o callback se a interação ainda for válida (morte cancela) — ChatGPT, bug 4
  let token = 0;
  function cancelarInteracoes() {
    token++; if (st.modal === 'ligacao') ligacaoPerdida();
    st.modal = null; ['computador', 'clp', 'minijogo', 'ligacao', 'progresso', 'carga', 'balcao'].forEach(n => $(n).style.display = 'none');
    if (PT.pc && PT.pc.aberto) PT.pc.fechar();
  }
  PT.ev.on('morreu', cancelarInteracoes);

  // ---------------- AVISOS / CELULAR ----------------
  function aviso(txt) {
    const d = el('div', { className: 'aviso' }, txt); $('avisos').appendChild(d);
    setTimeout(() => d.classList.add('sumir'), 3800); setTimeout(() => d.remove(), 4500);
    while ($('avisos').children.length > 4) $('avisos').firstChild.remove();
  }
  function celular(m) {
    st.celular.unshift({ quando: PT.tempo.rotulo(), de: m.de, texto: m.texto }); if (st.celular.length > 30) st.celular.pop();
    desenharCelular(); $('celular').classList.add('vibrar'); setTimeout(() => $('celular').classList.remove('vibrar'), 600);
  }
  function desenharCelular() {
    $('celMsgs').innerHTML = st.celular.slice(0, 6).map(m => '<div class="msg"><b>' + m.de + '</b> <small>' + m.quando + '</small><br>' + m.texto + '</div>').join('');
  }
  PT.ev.on('aviso', aviso);
  PT.ev.on('celular', celular);
  PT.ev.on('buzina', m => { aviso('📯 ' + m.texto); });
  PT.ev.on('rangido', e => { if (e > 1.5) aviso('⚠ O cabo está vibrando! SOLTA ISSO!'); else aviso('⚠ Rangido metálico... carga acima da capacidade.'); });

  // ---------------- E-MAIL ----------------
  function email(m) { st.correio.unshift(Object.assign({ id: PT.util.id('mail'), quando: PT.tempo.rotulo(), lido: false }, m)); celular({ de: '📧 E-mail', texto: m.assunto }); }
  PT.ev.on('pedidoNovo', p => {
    if (p.silencioso) return;
    if (p.canal === 'telefone') { st.filaLigacoes.push(p.id); proximaLigacao(); }
    else email({ de: p.cliente, assunto: 'Pedido ' + p.id + ' — ' + PT.DADOS.clientes[p.perfil].nome, pedidoId: p.id,
      texto: 'Bom dia! Precisamos de ' + PT.pedidos.descricao(p) + '. Prazo: dia ' + p.prazoDia + '. Pagamento: ' + textoPagamento(p) + '.' });
  });
  function textoPagamento(p) { const pg = PT.DADOS.clientes[p.perfil].pagamento; return pg.entrada >= 1 ? 'Pix na hora' : Math.round(pg.entrada * 100) + '% de entrada + saldo ' + (pg.prazoSaldo ? 'em ' + pg.prazoSaldo + ' dias' : 'na entrega'); }

  // ---------------- LIGAÇÃO (pedreiro negocia) ----------------
  let ligacaoAtual = null, ligTimer = null;
  // ligação não atendida (fechou, morreu ou demorou 20 s) vira "chamada perdida" com retorno pelo e-mail — ChatGPT, bug 6
  function ligacaoPerdida() {
    if (!ligacaoAtual) return; const p = PT.pedidos.st.lista.find(x => x.id === ligacaoAtual); ligacaoAtual = null; clearTimeout(ligTimer);
    if (p && p.status === 'oferta') email({ de: p.cliente, assunto: '📞 Chamada perdida — ' + p.id, pedidoId: p.id, texto: 'Te liguei e não atendeu! Preciso de ' + PT.pedidos.descricao(p) + ' até o dia ' + p.prazoDia + '. Responde aqui mesmo.' });
  }
  function proximaLigacao() {
    if (st.modal || !st.filaLigacoes.length || PT.mundo.jog.morto) return;
    const id = st.filaLigacoes.shift();   // tira UM da fila (antes o shift ficava dentro do find e esvaziava a fila com 2+ pedidos)
    const p = PT.pedidos.st.lista.find(x => x.id === id);
    if (!p || p.status !== 'oferta') return proximaLigacao();
    ligacaoAtual = p.id; clearTimeout(ligTimer); ligTimer = setTimeout(() => { if (st.modal === 'ligacao' && ligacaoAtual === p.id) fecharModal(); }, 20000);
    abrirModal('ligacao');
    $('ligacao').querySelector('.caixa').innerHTML = '<h2>📞 ' + p.cliente + ' ligando...</h2><p>"Ô patrão, tudo bom? Preciso de <b>' + PT.pedidos.descricao(p) +
      '</b> até o <b>dia ' + p.prazoDia + '</b>. Pago no Pix. Fecha?"</p><div class="botoes"><button id="lgA">Aceitar</button><button id="lgC">Contraproposta (+10%)</button><button id="lgR">Recusar</button></div>';
    const responder = fn => () => { ligacaoAtual = null; clearTimeout(ligTimer); fn(); fecharModal(); };
    $('lgA').onclick = responder(() => { PT.pedidos.aceitar(p.id); aviso('Pedido ' + p.id + ' fechado.'); });
    $('lgC').onclick = responder(() => { const r = PT.pedidos.contraproposta(p.id); aviso(r ? p.cliente + ': "Tá bom, tá bom... fechado!"' : p.cliente + ': "Aí não dá, patrão. Vou ver em outro lugar."'); });
    $('lgR').onclick = responder(() => PT.pedidos.recusar(p.id));
  }

  // ---------------- HUD (a cada frame, barato) ----------------
  let ultHud = 0, ultPc = 0;
  function hud(t) {
    if (t - ultHud < 200) return; ultHud = t;
    const e = PT.eco.st, r = PT.rep;
    $('hud').innerHTML =
      '<div><b>' + PT.tempo.rotulo() + '</b> · x' + PT.tempo.vel + (PT.tempo.st.pausado ? ' ⏸' : '') + '</div>' +
      '<div>💰 ' + R(e.caixa) + (e.cheque > 0 ? ' <span class="ruim">agiota ' + R(e.cheque) + '</span>' : '') + '</div>' +
      '<div>🏦 crédito ' + R(e.creditoUsado) + ' / ' + R(PT.DADOS.economia.limiteCredito) + '</div>' +
      '<div>⭐ ' + r.estrelas().toFixed(1) + ' · faixa ' + r.faixa() + ' · entregues ' + r.st.entregues + '</div>' +
      '<div>🦺 ' + PT.zoeira.st.diasSem + ' dias sem acidente</div>' +
      '<div>⚡ ' + Math.round(PT.construcao.kwLigado()) + '/' + PT.construcao.st.quadroKW + ' kW</div>';
    // dica de interação
    if (PT.construcao.ativo) {
      const a = PT.construcao.ativo;
      $('dica').innerHTML = '<span class="' + a.cor + '">● ' + a.motivo + '</span><br>Mouse posiciona · <b>R</b> gira · <b>clique/Enter</b> instala · <b>Esc</b> cancela';
    } else {
      const ops = PT.inter.calcular();
      const teclas = ['E', '1', '2', '3', '4'];
      $('dica').innerHTML = ops.slice(0, 5).map((o, i) => '<span><b>[' + teclas[i] + ']</b> ' + o.rotulo + '</span>').join('<br>');
    }
    if (PT.pc) PT.pc.atualizar();
    if (st.modal === 'clp') desenharCLP(true);
    if (st.prancheta) desenharPrancheta();
  }

  // ---------------- COMPUTADOR ----------------
  // O computador virou o "ParecisOS" (pc.js + pc_apps.js). Aqui só ficam os atalhos.
  function abrirComputador() { PT.pc.abrir(); }

  // ---------------- CLP ----------------
  let clpMaq = null;
  function abrirCLP(m) { clpMaq = m; abrirModal('clp'); desenharCLP(); }
  function desenharCLP(soDados) {
    const m = clpMaq; if (!m) return;
    const c = $('clp').querySelector('.caixa');
    const info = '<div class="lcd"><div>' + m.nome + '</div><div>ESTADO: <b>' + (PT.maq.NOMES_ESTADO[m.estado] || m.estado) + '</b></div>' +
      '<div>Energia: ' + (m.cabo ? (m.ligada ? 'LIGADA' : 'desligada') : 'SEM CABO') + ' · ' + m.def.kw + ' kW</div>' +
      '<div>Entrada: ' + (m.def.entrada === 'bobina' ? (m.bobina ? m.bobina.codigo + ' — ' + m.bobina.metros.toFixed(1) + ' m restantes' : 'sem bobina (traga com a ponte)') : (m.chapas ? m.chapas.qtd + ' chapas de ' + m.chapas.comprimento + ' m' : 'sem chapas (traga com a paleteira)')) + '</div>' +
      '<div>Alinhamento: ' + (m.alinhado ? Math.round(m.alinhamento * 100) + '%' : '—') + ' · Chance de torta: ' + Math.round(PT.maq.chanceTorta(m) * 100) + '%</div>' +
      '<div>Desgaste do cassete: ' + Math.round(m.desgaste * 100) + '%' + (m.lubrificado > 0 ? ' (engraxado)' : '') + ' · Nivelamento: ' + (m.nivelamento >= 0.6 ? 'ok' : 'nas coxas') + '</div>' +
      '<div>Lote: ' + m.produzidas + ' / ' + m.cfg.quantidade + (m.mesa && PT.ent.lista.includes(m.mesa) ? ' · Mesa: ' + m.mesa.qtd + '/' + m.def.mesaCap : '') + '</div></div>';
    if (soDados) { const l = c.querySelector('.lcd'); if (l) l.outerHTML = info; return; }
    c.innerHTML = '<h2>Painel CLP <button class="fechar" id="clpX">✕</button></h2>' + info +
      '<div class="form"><label>Produto <select id="cProd">' + m.def.saida.map(s => '<option value="' + s + '"' + (s === m.cfg.produto ? ' selected' : '') + '>' + PT.DADOS.produtos[s].nome + '</option>').join('') + '</select></label>' +
      (m.def.entrada === 'bobina' ? '<label>Comprimento (m) <input id="cComp" type="number" step="0.5" min="' + m.def.compMin + '" max="' + m.def.compMax + '" value="' + m.cfg.comprimento + '"></label>' : '') +
      '<label>Quantidade <input id="cQtd" type="number" min="1" max="500" value="' + m.cfg.quantidade + '"></label>' +
      '<label class="chk"><input type="checkbox" id="cAuto"' + (m.autoLote ? ' checked' : '') + '> Operador pode rodar lotes sozinho</label>' +
      '<label>Velocidade <select id="cVel"><option value="0.6"' + (m.cfg.velocidade < 0.8 ? ' selected' : '') + '>Precisão (60%)</option><option value="1"' + (m.cfg.velocidade >= 0.8 && m.cfg.velocidade <= 1 ? ' selected' : '') + '>Normal</option><option value="1.3"' + (m.cfg.velocidade > 1 ? ' selected' : '') + '>Rápida (mais enrosco)</option></select></label></div>' +
      '<div class="botoes grandes"><button id="cLig" class="' + (m.ligada ? 'sel' : '') + '">' + (m.ligada ? '⏻ Desligar' : '⏻ Ligar') + '</button>' +
      (m.def.entrada === 'bobina' ? '<button id="cAli">↔ Alinhar chapa</button>' : '') +
      '<button id="cIni" class="start">▶ START</button><button id="cPar" class="stop">■ STOP</button></div>';
    $('clpX').onclick = fecharModal;
    const salvarCfg = () => {
      m.cfg.produto = $('cProd').value; if ($('cComp')) m.cfg.comprimento = PT.util.clamp(+$('cComp').value || m.def.compMin, m.def.compMin, m.def.compMax);
      m.cfg.quantidade = Math.max(1, Math.floor(+$('cQtd').value || 1)); m.cfg.velocidade = +$('cVel').value; m.autoLote = $('cAuto').checked;
    };
    c.querySelectorAll('select,input').forEach(i => i.onchange = salvarCfg);
    $('cLig').onclick = () => { PT.maq.ligar(m, !m.ligada); desenharCLP(); };
    if ($('cAli')) $('cAli').onclick = () => {
      if (!m.bobina) { aviso('Monte uma bobina primeiro.'); return; }
      fecharModal(false); minijogo({ titulo: 'Alinhar a ponta da chapa', dica: 'ESPAÇO com a chapa no centro', dificuldade: 1 - m.def.alinhamentoBase + 0.3 }, n => { PT.maq.alinhar(m, n); aviso('Alinhamento: ' + Math.round(m.alinhamento * 100) + '%'); abrirCLP(m); });
    };
    $('cIni').onclick = () => { salvarCfg(); if (PT.maq.iniciar(m)) aviso('▶ ' + m.nome + ' produzindo.'); desenharCLP(); };
    $('cPar').onclick = () => { if (m.estado === 'produzindo') PT.maq.parar(m, 'pronta'); desenharCLP(); };
  }

  // ---------------- MINIJOGO (bolha/alinhamento) ----------------
  function minijogo(o, cb) {
    abrirModal('minijogo'); const meu = ++token;
    const c = $('minijogo').querySelector('.caixa');
    const larg = PT.util.clamp(0.28 - (o.dificuldade || 0.5) * 0.18, 0.06, 0.3);
    c.innerHTML = '<h2>' + o.titulo + '</h2><p>' + o.dica + '</p><div class="trilho"><div class="verde" style="left:' + (50 - larg * 50) + '%;width:' + (larg * 100) + '%"></div><div class="bolha" id="bolha"></div></div><p id="mjT"></p>';
    let t = 0, fim = false, ultimo = performance.now();
    const vel = 1.4 + (o.dificuldade || 0.5) * 1.6;
    function terminar(pos) {
      if (fim) return; fim = true; window.removeEventListener('keydown', tecla);
      const d = Math.abs(pos - 0.5);
      const nota = pos < 0 ? 0.3 : PT.util.clamp(1 - Math.max(0, d - larg / 2) * 3.2, 0, 1);
      setTimeout(() => { if (meu !== token) return; st.modal = null; $('minijogo').style.display = 'none'; cb(nota); proximaLigacao(); }, 250);
    }
    function tecla(e) { if (e.code === 'Space') { e.preventDefault(); terminar(0.5 + 0.5 * Math.sin(t * vel)); } }
    window.addEventListener('keydown', tecla);
    (function loop(agora) {
      if (meu !== token) { fim = true; window.removeEventListener('keydown', tecla); return; }
      if (fim) return; t += (agora - ultimo) / 1000; ultimo = agora;
      const pos = 0.5 + 0.5 * Math.sin(t * vel);
      $('bolha').style.left = (pos * 100) + '%'; $('mjT').textContent = 'Tempo: ' + Math.max(0, 4 - t).toFixed(1) + ' s';
      if (t > 4) terminar(-1); else requestAnimationFrame(loop);
    })(ultimo);
  }

  // ---------------- PROGRESSO (ações com duração) ----------------
  function progresso(titulo, seg, cb) {
    abrirModal('progresso'); const meu = ++token;
    const c = $('progresso').querySelector('.caixa');
    c.innerHTML = '<h3>' + titulo + '</h3><div class="trilho"><div class="enche" id="pgB"></div></div>';
    const ini = performance.now();
    (function loop(t) {
      const f = Math.min(1, (t - ini) / (seg * 1000)); $('pgB').style.width = (f * 100) + '%';
      if (meu !== token) return;                       // morreu no meio: nada é concluído (cimento não é gasto)
      if (f < 1) requestAnimationFrame(loop); else { st.modal = null; $('progresso').style.display = 'none'; cb(); proximaLigacao(); }
    })(ini);
  }

  // ---------------- PRANCHETA (TAB) ----------------
  function desenharPrancheta() {
    const bob = PT.ent.lista.filter(o => o.tipo === 'bobina'), pil = PT.ent.lista.filter(o => o.tipo === 'pilha');
    const ped = PT.pedidos.st.lista.filter(p => ['aceito', 'coleta'].includes(p.status));
    $('prancheta').innerHTML = '<h3>📋 Prancheta</h3><b>Bobinas</b>' + (bob.map(b => '<div>' + b.codigo + ' — ' + Math.round(b.pesoKg) + ' kg' + (b.montadaEm ? ' (na máquina)' : '') + '</div>').join('') || '<div>—</div>') +
      '<b>Pilhas</b>' + (pil.map(p => '<div>' + PT.DADOS.produtos[p.produto].nome + ' ' + p.comprimento + ' m × ' + p.qtd + (p.defeituosas ? ' (' + p.defeituosas + ' tortas)' : '') + '</div>').join('') || '<div>—</div>') +
      '<b>Máquinas</b>' + (PT.maq.lista.map(m => '<div>' + m.nome + ': ' + (PT.maq.NOMES_ESTADO[m.estado] || m.estado).split(' (')[0] + '</div>').join('') || '<div>—</div>') +
      '<b>Pedidos a entregar</b>' + (ped.map(p => '<div>' + p.id + ' ' + p.pecas + 'x ' + PT.DADOS.produtos[p.produto].nome + ' ' + p.comprimento + ' m — dia ' + p.prazoDia + '</div>').join('') || '<div>—</div>') +
      '<b>Inventário</b><div>Cimento: ' + PT.estoque.st.inv.cimento + ' · Tinta: ' + PT.estoque.st.inv.tinta + '</div>';
  }

  // ---------------- MORTE ----------------
  PT.ev.on('morreu', m => { $('morte').style.display = 'flex'; $('morte').innerHTML = '<div><h1>' + m.frase + '</h1><p>Visitas ao hospital: ' + m.mortes + '</p></div>'; });
  PT.ev.on('respawn', () => { $('morte').style.display = 'none'; });

  // ---------------- TECLAS GERAIS ----------------
  PT.ev.on('tecla', code => {
    if (code === 'Escape') { if (st.modal) fecharModal(); }
    if (st.modal) return;
    if (code === 'Tab') { st.prancheta = !st.prancheta; $('prancheta').style.display = st.prancheta ? 'block' : 'none'; if (st.prancheta) desenharPrancheta(); }
    if (code === 'KeyT') aviso('Velocidade do tempo: x' + PT.tempo.alternarVel());
    if (code === 'KeyP') { PT.tempo.pausar(); aviso(PT.tempo.st.pausado ? 'Pausado' : 'Continuando'); }
    if (code === 'KeyK') PT.save.salvar();
    if (code === 'KeyL') { if (PT.save.existe()) PT.save.pedirCarregar(); else aviso('Nenhum save ainda.'); }
    if (code === 'KeyH') { const a = $('ajuda'); a.style.display = a.style.display === 'block' ? 'none' : 'block'; }
  });
  // computador do escritório
  PT.inter.registrar(j => {
    if (j.carregando || j.controlando) return null;
    const c = PT.DADOS.mundo.computador;
    if (Math.hypot(j.x - c.x, j.z - c.z) < 2.2) return [{ rotulo: 'Usar o computador (loja, banco, e-mail, pedidos)', prio: 1, acao: abrirComputador }];
    return null;
  });

  return {
    textoPagamento, correio: () => st.correio, correioNaoLidos: () => st.correio.filter(m => !m.lido).length,
    hud, aviso, email, modalAberto, abrirModal, cancelarInteracoes, capturandoTeclado, abrirComputador, abrirCLP, minijogo, progresso, fecharModal,
    salvarCorreio() { return st.correio.slice(0, 60); }, carregarCorreio(c) { st.correio = c || []; },
    _estado: () => ({ modal: st.modal, fila: st.filaLigacoes.slice(), atual: ligacaoAtual })   // para os testes
  };
})();
