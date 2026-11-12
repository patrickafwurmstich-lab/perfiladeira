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
  function abrirModal(nome) { st.modal = nome; ['computador', 'clp', 'minijogo', 'ligacao', 'progresso'].forEach(n => $(n).style.display = n === nome ? 'flex' : 'none'); }
  function fecharModal() { if (st.modal === 'minijogo' || st.modal === 'progresso') return; st.modal = null; ['computador', 'clp', 'ligacao'].forEach(n => $(n).style.display = 'none'); proximaLigacao(); }

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
  function proximaLigacao() {
    if (st.modal || !st.filaLigacoes.length) return;
    const p = PT.pedidos.st.lista.find(x => x.id === st.filaLigacoes.shift());
    if (!p || p.status !== 'oferta') return proximaLigacao();
    abrirModal('ligacao');
    $('ligacao').querySelector('.caixa').innerHTML = '<h2>📞 ' + p.cliente + ' ligando...</h2><p>"Ô patrão, tudo bom? Preciso de <b>' + PT.pedidos.descricao(p) +
      '</b> até o <b>dia ' + p.prazoDia + '</b>. Pago no Pix. Fecha?"</p><div class="botoes"><button id="lgA">Aceitar</button><button id="lgC">Contraproposta (+10%)</button><button id="lgR">Recusar</button></div>';
    $('lgA').onclick = () => { PT.pedidos.aceitar(p.id); aviso('Pedido ' + p.id + ' fechado.'); fecharModal(); };
    $('lgC').onclick = () => { const r = PT.pedidos.contraproposta(p.id); aviso(r ? p.cliente + ': "Tá bom, tá bom... fechado!"' : p.cliente + ': "Aí não dá, patrão. Vou ver em outro lugar."'); fecharModal(); };
    $('lgR').onclick = () => { PT.pedidos.recusar(p.id); fecharModal(); };
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
    if (st.modal === 'computador' && t - ultPc > 1500) { ultPc = t; desenharComputador(true); }
    if (st.modal === 'clp') desenharCLP(true);
    if (st.prancheta) desenharPrancheta();
  }

  // ---------------- COMPUTADOR ----------------
  const ABAS = ['Loja', 'Banco', 'E-mail', 'Pedidos', 'Reputação', 'Modelos 3D', 'Sistema'];
  function abrirComputador() { abrirModal('computador'); desenharComputador(); }
  function desenharComputador(soDados) {
    const c = $('computador').querySelector('.caixa');
    if (soDados && ['Loja', 'Modelos 3D', 'Sistema'].includes(st.aba)) return;   // não redesenha telas com botões estáticos
    const naoLidos = st.correio.filter(m => !m.lido).length;
    let h = '<div class="navegador"><div class="barra">🌐 www.' + ({ Loja: 'industriamt.com.br', Banco: 'bancocerrado.com.br', 'E-mail': 'mail.pareciste lha.com.br', Pedidos: 'sistema.pareciste lha.com.br', Reputação: 'sistema.pareciste lha.com.br/reputacao', 'Modelos 3D': 'interno/modelos', Sistema: 'interno/sistema' }[st.aba] || '').replace(/ /g, '') + '<button class="fechar" id="pcX">✕</button></div><div class="abas">' +
      ABAS.map(a => '<button class="' + (a === st.aba ? 'sel' : '') + '" data-aba="' + a + '">' + a + (a === 'E-mail' && naoLidos ? ' (' + naoLidos + ')' : '') + '</button>').join('') + '</div><div class="conteudo">';
    h += ({ 'Loja': telaLoja, 'Banco': telaBanco, 'E-mail': telaEmail, 'Pedidos': telaPedidos, 'Reputação': telaRep, 'Modelos 3D': telaModelos, 'Sistema': telaSistema }[st.aba])();
    h += '</div></div>';
    const scroll = c.querySelector('.conteudo') ? c.querySelector('.conteudo').scrollTop : 0;
    c.innerHTML = h;
    c.querySelector('.conteudo').scrollTop = scroll;
    $('pcX').onclick = fecharModal;
    c.querySelectorAll('[data-aba]').forEach(b => b.onclick = () => { st.aba = b.dataset.aba; desenharComputador(); });
    c.querySelectorAll('[data-acao]').forEach(b => b.onclick = () => acaoComputador(b.dataset.acao, b.dataset.arg));
    const imp = $('impArq'); if (imp) imp.onchange = e => { if (e.target.files[0]) PT.save.importarArquivo(e.target.files[0]); };
  }
  function telaLoja() {
    let h = '<div class="cats">' + PT.DADOS.categorias.map(k => '<button class="' + (k === st.cat ? 'sel' : '') + '" data-acao="cat" data-arg="' + k + '">' + k + '</button>').join('') + '</div><div class="cards">';
    PT.loja.itens(st.cat).forEach(f => {
      const finOk = PT.eco.finameLiberado();
      h += '<div class="card"><h3>' + f.nome + '</h3><div class="estado">' + f.estado + '</div><div class="preco">' + R(f.preco) + '</div>' +
        '<small>Frete ' + R(f.frete || 0) + ' · entrega em ' + f.prazoDias + ' dia(s)</small>' +
        (f.dims ? '<small>Dimensões ' + f.dims.join(' x ') + ' m</small>' : '') + (f.pesoKg ? '<small>Peso ' + f.pesoKg + ' kg</small>' : '') + (f.kw ? '<small>Potência ' + f.kw + ' kW</small>' : '') +
        (f.vantagem ? '<small class="bom">+ ' + f.vantagem + '</small>' : '') + (f.defeito ? '<small class="ruim">− ' + f.defeito + '</small>' : '') +
        '<div class="botoes"><button data-acao="comprar" data-arg="' + f.id + '|vista">Comprar à vista</button>' +
        (f.finame ? '<button data-acao="comprar" data-arg="' + f.id + '|finame" ' + (finOk ? '' : 'title="Liberado na faixa 1 de reputação"') + ' class="' + (finOk ? '' : 'off') + '">FINAME 30%</button>' : '') + '</div></div>';
    });
    return h + '</div>';
  }
  function telaBanco() {
    const e = PT.eco.st, E = PT.DADOS.economia;
    const rec = e.receber.reduce((a, r) => a + r.valor, 0);
    return '<h2>Banco Cerrado — Conta Empresa</h2><div class="grade">' +
      '<div><b>Saldo</b><br>' + R(e.caixa) + '</div><div><b>Capital de giro</b><br>' + R(e.creditoUsado) + ' de ' + R(E.limiteCredito) + ' (2%/mês)</div>' +
      '<div><b>Cheque especial (agiota)</b><br><span class="' + (e.cheque ? 'ruim' : '') + '">' + R(e.cheque) + ' de ' + R(E.chequeEspecial) + ' (5% a cada 7 dias)</span></div>' +
      '<div><b>A receber</b><br>' + R(rec) + ' em ' + e.receber.length + ' boleto(s)</div></div>' +
      '<div class="botoes"><button data-acao="sacar" data-arg="5000">Sacar R$ 5 mil</button><button data-acao="sacar" data-arg="10000">Sacar R$ 10 mil</button>' +
      '<button data-acao="amortizar" data-arg="5000">Amortizar R$ 5 mil</button><button data-acao="agiota">Pagar o agiota</button>' +
      '<button data-acao="antecipar">Antecipar recebíveis (−3%)</button></div>' +
      '<h3>Previsão de caixa</h3><div class="grade"><div>7 dias: ' + R(PT.eco.previsao(7)) + '</div><div>14 dias: ' + R(PT.eco.previsao(14)) + '</div><div>30 dias: ' + R(PT.eco.previsao(30)) + '</div>' +
      '<div>FINAME: ' + (PT.eco.finameLiberado() ? '<span class="bom">liberado</span>' : 'faixa 1 (faltam ' + PT.rep.proximaFaixa() + ' entregas)') + '</div></div>' +
      (e.financiamentos.length ? '<h3>Financiamentos</h3>' + e.financiamentos.map(f => '<div>' + f.desc + ': ' + f.restantes + 'x ' + R(f.parcela) + '</div>').join('') : '') +
      (e.receber.length ? '<h3>Contas a receber</h3>' + e.receber.map(r => '<div>Dia ' + r.dia + ' — ' + r.desc + ': ' + R(r.valor) + '</div>').join('') : '') +
      '<h3>Extrato</h3><table>' + e.extrato.slice(0, 40).map(x => '<tr><td>' + x.quando + '</td><td>' + x.desc + '</td><td class="' + (x.valor < 0 ? 'ruim' : 'bom') + '">' + R(x.valor) + '</td><td>' + R(x.saldo) + '</td></tr>').join('') + '</table>';
  }
  function telaEmail() {
    if (!st.correio.length) return '<p>Caixa de entrada vazia.</p>';
    return st.correio.slice(0, 40).map(m => {
      m.lido = true;
      let acoes = '';
      if (m.pedidoId) {
        const p = PT.pedidos.st.lista.find(x => x.id === m.pedidoId);
        if (p && p.status === 'oferta') acoes = '<div class="botoes"><button data-acao="aceitar" data-arg="' + p.id + '">Aceitar pedido</button><button data-acao="recusar" data-arg="' + p.id + '">Recusar</button></div>';
        else if (p) acoes = '<small>Status: ' + p.status + '</small>';
      }
      return '<div class="mail"><b>' + m.de + '</b> — ' + m.assunto + ' <small>' + m.quando + '</small><p>' + m.texto + '</p>' + acoes + '</div>';
    }).join('');
  }
  function telaPedidos() {
    const ativos = PT.pedidos.st.lista.filter(p => ['oferta', 'aceito', 'coleta'].includes(p.status));
    const fechados = PT.pedidos.st.lista.filter(p => !['oferta', 'aceito', 'coleta'].includes(p.status)).slice(-10).reverse();
    let h = '<h2>Pedidos ativos</h2>';
    if (!ativos.length) h += '<p>Nenhum. Os clientes ligam e mandam e-mail ao longo do dia.</p>';
    ativos.forEach(p => {
      const d = PT.pedidos.disponivel(p);
      h += '<div class="mail"><b>' + p.id + '</b> — ' + p.cliente + ' (' + PT.DADOS.clientes[p.perfil].nome + ')<br>' + PT.pedidos.descricao(p) + '<br>Prazo: dia ' + p.prazoDia + ' · coleta 14h–16h · ' + textoPagamento(p) +
        '<br>Status: <b>' + p.status + '</b> · na zona verde: ' + d.boas + ' boas' + (d.tortas ? ', ' + d.tortas + ' tortas' : '') + ' de ' + p.pecas +
        (p.status === 'aceito' ? '<div class="botoes"><button data-acao="chamar" data-arg="' + p.id + '">Chamar caminhão agora</button></div>' : '') +
        (p.status === 'oferta' ? '<div class="botoes"><button data-acao="aceitar" data-arg="' + p.id + '">Aceitar</button><button data-acao="recusar" data-arg="' + p.id + '">Recusar</button></div>' : '') + '</div>';
    });
    if (fechados.length) h += '<h3>Últimos</h3>' + fechados.map(p => '<div>' + p.id + ' ' + p.cliente + ' — ' + p.status + '</div>').join('');
    return h;
  }
  function barra(nome, v) { return '<div class="barraRep"><span>' + nome + '</span><div><i style="width:' + Math.round(v * 100) + '%"></i></div><b>' + Math.round(v * 100) + '%</b></div>'; }
  function telaRep() {
    const r = PT.rep;
    return '<h2>Reputação: ' + r.estrelas().toFixed(1) + ' ⭐ · faixa ' + r.faixa() + '</h2>' + barra('Pontualidade', r.st.pontualidade) + barra('Qualidade', r.st.qualidade) + barra('Confiança financeira', r.st.financeira) +
      '<p>Pedidos entregues: ' + r.st.entregues + '. Próxima faixa em ' + r.proximaFaixa() + ' entrega(s). Faixa 1 libera FINAME, construtoras e agro.</p>' +
      '<h3>Mural dos desastres</h3><div>Mortes: ' + PT.zoeira.st.mortes + ' · Cabos rompidos: ' + PT.zoeira.st.cabosRompidos + ' · Enroscos: ' + PT.zoeira.st.enroscos + ' · Quedas de carga: ' + PT.zoeira.st.quedas + ' · Recorde sem acidentes: ' + PT.zoeira.st.recorde + ' dias</div>';
  }
  function telaModelos() {
    const f = PT.fichaModelos();
    const usados = f.filter(m => m.usos > 0).length;
    return '<h2>Modelos 3D necessários (' + f.length + ' fichas · ' + usados + ' já apareceram no jogo)</h2><p>Lista gerada pelo código: cada cubo/cilindro declara qual modelo vai substituí-lo. Abra <b>modelos.html</b> para a versão completa e para baixar.</p>' +
      '<div class="botoes"><button data-acao="baixarModelos">Baixar lista (.csv)</button></div><table><tr><th>ID</th><th>Nome</th><th>Categoria</th><th>Dimensões (m)</th><th>Usos</th><th>Máx. na cena</th><th>Animações</th><th>Estados</th></tr>' +
      f.map(m => '<tr class="' + (m.usos ? '' : 'apagado') + '"><td>' + m.id + '</td><td>' + m.nome + '</td><td>' + m.categoria + '</td><td>' + m.dims.join(' x ') + '</td><td>' + m.usos + '</td><td>' + m.maxInstancias + '</td><td>' + (m.animacoes || []).join(', ') + '</td><td>' + (m.estados || []).join(', ') + '</td></tr>').join('') + '</table>';
  }
  function telaSistema() {
    return '<h2>Sistema</h2><div class="botoes"><button data-acao="salvar">Salvar (K)</button><button data-acao="carregar">Carregar último save (L)</button><button data-acao="exportar">Exportar save (.json)</button>' +
      '<label class="btn">Importar save<input type="file" id="impArq" accept=".json" hidden></label><button data-acao="novo">Novo jogo</button></div>' +
      '<h3>Teste (atalhos de desenvolvedor)</h3><div class="botoes"><button data-acao="vel">Velocidade (T): x' + PT.tempo.vel + '</button><button data-acao="pedido">Gerar pedido agora</button>' +
      '<button data-acao="dinheiro">+R$ 20 mil (debug)</button><button data-acao="noite">Pular para o próximo dia</button><button data-acao="entregas">Entregas pendentes: ' + PT.entrega.st.fila.length + '</button></div>' +
      '<h3>Últimos eventos</h3><div class="log">' + PT.ev.log.slice(-25).reverse().map(l => l.t + ' — ' + l.nome).join('<br>') + '</div>';
  }
  function acaoComputador(a, arg) {
    if (a === 'cat') st.cat = arg;
    if (a === 'comprar') { const [id, modo] = arg.split('|'); const r = PT.loja.comprar(id, modo); aviso(r.msg); }
    if (a === 'sacar') aviso('Sacado ' + R(PT.eco.sacarCredito(+arg)));
    if (a === 'amortizar') aviso('Amortizado ' + R(PT.eco.pagarCredito(+arg)));
    if (a === 'agiota') aviso('Pago ao agiota ' + R(PT.eco.pagarAgiota()));
    if (a === 'antecipar') aviso('Antecipado ' + R(PT.eco.anteciparTudo()));
    if (a === 'aceitar') { if (PT.pedidos.aceitar(arg)) aviso('Pedido ' + arg + ' aceito.'); }
    if (a === 'recusar') PT.pedidos.recusar(arg);
    if (a === 'chamar') PT.pedidos.chamarAgora(arg);
    if (a === 'baixarModelos') baixarModelos();
    if (a === 'salvar') PT.save.salvar();
    if (a === 'carregar') PT.save.pedirCarregar();
    if (a === 'exportar') PT.save.exportar();
    if (a === 'novo') { if (confirmarNovo()) { try { localStorage.removeItem('parecis_demo1_save'); } catch (e) { } location.reload(); } return; }
    if (a === 'vel') PT.tempo.alternarVel();
    if (a === 'pedido') PT.pedidos.gerar();
    if (a === 'dinheiro') PT.eco.lancar(20000, 'DEBUG: dinheiro de teste');
    if (a === 'noite') PT.tempo.pularNoite();
    desenharComputador();
  }
  let pedidoNovo = 0;
  function confirmarNovo() { pedidoNovo++; if (pedidoNovo < 2) { aviso('Clique de novo em "Novo jogo" para confirmar (apaga o save).'); return false; } return true; }
  function baixarModelos() {
    const f = PT.fichaModelos();
    const cols = ['id', 'nome', 'categoria', 'dims', 'forma', 'usos', 'maxInstancias', 'animacoes', 'estados', 'sockets', 'polys', 'prioridade', 'pivot', 'colisor', 'multimesh', 'materiais', 'arquivo', 'notas'];
    const esc = v => '"' + String(Array.isArray(v) ? v.join(' | ') : (v === undefined ? '' : v)).replace(/"/g, '""') + '"';
    const csv = cols.join(';') + '\n' + f.map(m => cols.map(c => esc(c === 'dims' ? m.dims.join(' x ') : m[c])).join(';')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'modelos_3d_parecis.csv'; a.click();
  }

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
      '<label>Velocidade <select id="cVel"><option value="0.6"' + (m.cfg.velocidade < 0.8 ? ' selected' : '') + '>Precisão (60%)</option><option value="1"' + (m.cfg.velocidade >= 0.8 && m.cfg.velocidade <= 1 ? ' selected' : '') + '>Normal</option><option value="1.3"' + (m.cfg.velocidade > 1 ? ' selected' : '') + '>Rápida (mais enrosco)</option></select></label></div>' +
      '<div class="botoes grandes"><button id="cLig" class="' + (m.ligada ? 'sel' : '') + '">' + (m.ligada ? '⏻ Desligar' : '⏻ Ligar') + '</button>' +
      (m.def.entrada === 'bobina' ? '<button id="cAli">↔ Alinhar chapa</button>' : '') +
      '<button id="cIni" class="start">▶ START</button><button id="cPar" class="stop">■ STOP</button></div>';
    $('clpX').onclick = fecharModal;
    const salvarCfg = () => {
      m.cfg.produto = $('cProd').value; if ($('cComp')) m.cfg.comprimento = PT.util.clamp(+$('cComp').value || m.def.compMin, m.def.compMin, m.def.compMax);
      m.cfg.quantidade = Math.max(1, Math.floor(+$('cQtd').value || 1)); m.cfg.velocidade = +$('cVel').value;
    };
    c.querySelectorAll('select,input').forEach(i => i.onchange = salvarCfg);
    $('cLig').onclick = () => { PT.maq.ligar(m, !m.ligada); desenharCLP(); };
    if ($('cAli')) $('cAli').onclick = () => {
      if (!m.bobina) { aviso('Monte uma bobina primeiro.'); return; }
      fecharModal(); minijogo({ titulo: 'Alinhar a ponta da chapa', dica: 'ESPAÇO com a chapa no centro', dificuldade: 1 - m.def.alinhamentoBase + 0.3 }, n => { PT.maq.alinhar(m, n); aviso('Alinhamento: ' + Math.round(m.alinhamento * 100) + '%'); abrirCLP(m); });
    };
    $('cIni').onclick = () => { salvarCfg(); if (PT.maq.iniciar(m)) aviso('▶ ' + m.nome + ' produzindo.'); desenharCLP(); };
    $('cPar').onclick = () => { if (m.estado === 'produzindo') PT.maq.parar(m, 'pronta'); desenharCLP(); };
  }

  // ---------------- MINIJOGO (bolha/alinhamento) ----------------
  function minijogo(o, cb) {
    abrirModal('minijogo');
    const c = $('minijogo').querySelector('.caixa');
    const larg = PT.util.clamp(0.28 - (o.dificuldade || 0.5) * 0.18, 0.06, 0.3);
    c.innerHTML = '<h2>' + o.titulo + '</h2><p>' + o.dica + '</p><div class="trilho"><div class="verde" style="left:' + (50 - larg * 50) + '%;width:' + (larg * 100) + '%"></div><div class="bolha" id="bolha"></div></div><p id="mjT"></p>';
    let t = 0, fim = false, ultimo = performance.now();
    const vel = 1.4 + (o.dificuldade || 0.5) * 1.6;
    function terminar(pos) {
      if (fim) return; fim = true; window.removeEventListener('keydown', tecla);
      const d = Math.abs(pos - 0.5);
      const nota = pos < 0 ? 0.3 : PT.util.clamp(1 - Math.max(0, d - larg / 2) * 3.2, 0, 1);
      setTimeout(() => { st.modal = null; $('minijogo').style.display = 'none'; cb(nota); }, 250);
    }
    function tecla(e) { if (e.code === 'Space') { e.preventDefault(); terminar(0.5 + 0.5 * Math.sin(t * vel)); } }
    window.addEventListener('keydown', tecla);
    (function loop(agora) {
      if (fim) return; t += (agora - ultimo) / 1000; ultimo = agora;
      const pos = 0.5 + 0.5 * Math.sin(t * vel);
      $('bolha').style.left = (pos * 100) + '%'; $('mjT').textContent = 'Tempo: ' + Math.max(0, 4 - t).toFixed(1) + ' s';
      if (t > 4) terminar(-1); else requestAnimationFrame(loop);
    })(ultimo);
  }

  // ---------------- PROGRESSO (ações com duração) ----------------
  function progresso(titulo, seg, cb) {
    abrirModal('progresso');
    const c = $('progresso').querySelector('.caixa');
    c.innerHTML = '<h3>' + titulo + '</h3><div class="trilho"><div class="enche" id="pgB"></div></div>';
    const ini = performance.now();
    (function loop(t) {
      const f = Math.min(1, (t - ini) / (seg * 1000)); $('pgB').style.width = (f * 100) + '%';
      if (f < 1) requestAnimationFrame(loop); else { st.modal = null; $('progresso').style.display = 'none'; cb(); }
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
    hud, aviso, email, modalAberto, capturandoTeclado, abrirComputador, abrirCLP, minijogo, progresso, fecharModal,
    salvarCorreio() { return st.correio.slice(0, 60); }, carregarCorreio(c) { st.correio = c || []; }
  };
})();
