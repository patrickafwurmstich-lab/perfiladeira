// =====================================================================
// pc_apps.js — os aplicativos do ParecisOS. Cada um imita um produto de
// uma empresa diferente (regra da sala): IndústriaMT (loja), Banco Cerrado,
// Correio, Pedidos (sistema comercial antigo), Trabalhe Conosco MT,
// Reputação, Jornal Parecis Agora, Clima, Modelos 3D, Configurações, Lixeira.
// =====================================================================
(function () {
  const R = v => PT.util.reais(v), D = PT.DADOS, I = n => PT.pc.icone(n);
  const reg = PT.pc.registrar;
  const esc = s => PT.pc.esc(s);
  const cls = s => String(s == null ? '' : s).replace(/[^a-z0-9_-]/gi, '');
  function liga(c, sel, fn) { c.querySelectorAll(sel).forEach(b => b.onclick = ev => { ev.stopPropagation(); PT.pc.som('clique'); fn(b, ev); }); }
  function msg(ok, texto) { PT.ui.aviso(texto); PT.pc.som(ok ? 'clique' : 'erro'); }
  // número "aleatório" fixo por texto (avaliações, notícias, clima não mudam a cada redesenho)
  function semente(txt) { let h = 2166136261; for (const ch of String(txt)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10000) / 10000; }; }

  // ====================== LOJA — IndústriaMT ======================
  const loja = { cat: 'Máquinas', busca: '', prod: null, qtd: 1 };
  function miniatura(f) {
    if (f.tipoItem === 'bobina') return '<div class="mt-bobina"></div>';
    const ic = { maquina: 'fabrica', empilhadeira: 'caminhao', quadro: 'ferramentas', consumivel: 'ferramentas', decor: 'cafe' }[f.tipoItem] || (f.categoria === 'Instalação' ? 'ferramentas' : 'pasta');
    return '<img src="' + I(ic) + '" alt="">';
  }
  const AVALIACOES = ['Chegou rápido, mas o motorista ficou buzinando no portão.', 'Funciona. Barulho de trator velho, mas funciona.', 'Comprei usado e veio com um adesivo de time na lateral. Não sai.', 'Nota 10. Minha sogra até elogiou.', 'Veio faltando um parafuso. Achei no fundo da caixa duas semanas depois.', 'Melhor custo-benefício do Chapadão.', 'O vendedor disse que aguenta tudo. Não aguenta tudo.', 'Bom produto. Leia o manual (eu não li).'];
  reg('loja', { nome: 'IndústriaMT', titulo: 'IndústriaMT — Equipamentos Industriais', icone: 'loja', larg: 900, alt: 600,
    abrir(c) {
      const itens = PT.loja.itens().filter(f => (loja.busca ? (f.nome + f.categoria).toLowerCase().includes(loja.busca.toLowerCase()) : f.categoria === loja.cat));
      let h = '<div class="mt"><header><div class="mt-logo">Indústria<b>MT</b></div><input class="mt-busca" placeholder="Buscar perfiladeira, bobina, paleteira..." value="' + esc(loja.busca) + '"><div class="mt-entrega">🚚 Entregamos em todo o Mato Grosso</div></header>';
      if (loja.prod) {
        const f = PT.loja.ficha(loja.prod), r = semente(f.id), nota = (3.6 + r() * 1.3).toFixed(1), finOk = PT.eco.finameLiberado();
        h += '<div class="mt-voltar"><a data-voltar>‹ Voltar para ' + esc(f.categoria) + '</a></div><div class="mt-prod"><div class="mt-foto">' + miniatura(f) + '</div><div class="mt-info">' +
          '<span class="mt-cond ' + (/Usad/.test(f.estado) ? 'usado' : '') + '">' + f.estado + '</span><h2>' + esc(f.nome) + '</h2><div class="mt-nota">' + '★'.repeat(Math.round(nota)) + '<span>' + '★'.repeat(5 - Math.round(nota)) + '</span> ' + nota + ' (' + Math.floor(3 + r() * 40) + ' avaliações)</div>' +
          '<div class="mt-preco">' + R(f.preco) + '</div><div class="mt-sub">+ frete ' + R(f.frete || 0) + ' · chega em ' + f.prazoDias + ' dia(s) úteis</div>' +
          (f.finame ? '<div class="mt-finame ' + (finOk ? '' : 'off') + '">' + (finOk ? 'Aceita FINAME: 30% de entrada e o resto em 24x' : 'FINAME disponível a partir da faixa 1 de reputação no Banco Cerrado') + '</div>' : '') +
          '<div class="mt-qtd">Quantidade <select data-qtd>' + [1, 2, 3, 4, 5].map(n => '<option' + (n === loja.qtd ? ' selected' : '') + '>' + n + '</option>').join('') + '</select></div>' +
          '<div class="mt-botoes"><button class="mt-comprar" data-comprar="vista">Comprar à vista</button>' + (f.finame ? '<button class="mt-sec" data-comprar="finame"' + (finOk ? '' : ' disabled') + '>Comprar com FINAME</button>' : '') + '</div>' +
          (f.aviso ? '<p class="mt-aviso">' + esc(f.aviso) + '</p>' : '') + '</div></div>' +
          '<h3 class="mt-h3">Ficha técnica</h3><table class="mt-ficha">' +
          [['Condição', f.estado], ['Dimensões (C × L × A)', f.dims ? f.dims.join(' × ') + ' m' : '—'], ['Peso', f.pesoKg ? f.pesoKg.toLocaleString('pt-BR') + ' kg' : '—'], ['Potência', f.kw ? f.kw + ' kW' : '—'],
           ['Ponto forte', f.vantagem || '—'], ['Ponto fraco', f.defeito || '—'], ['Volume de entrega', f.volume === 'grande' ? 'Grande (precisa de ponte rolante)' : f.volume === 'veiculo' ? 'Desce pela rampa do caminhão' : 'Caixa pequena'], ['Garantia', /Usad/.test(f.estado) ? '30 dias (motor)' : '12 meses']]
            .map(l => '<tr><th>' + l[0] + '</th><td>' + esc(l[1]) + '</td></tr>').join('') + '</table>' +
          '<h3 class="mt-h3">O que dizem os compradores</h3><div class="mt-aval">' + [0, 1, 2].map(i => { const rr = semente(f.id + i); const a = AVALIACOES[Math.floor(rr() * AVALIACOES.length)]; return '<p><b>' + ['Valdir', 'Serralheria Nova', 'Zé do Galpão', 'Cris M.', 'Metalúrgica Boa Vista'][Math.floor(rr() * 5)] + '</b> — ' + '★'.repeat(3 + Math.floor(rr() * 3)) + '<br>' + a + '</p>'; }).join('') + '</div>';
      } else {
        h += '<div class="mt-corpo"><nav>' + D.categorias.map(k => '<a data-cat="' + k + '" class="' + (k === loja.cat && !loja.busca ? 'sel' : '') + '">' + k + ' <small>' + PT.loja.itens(k).length + '</small></a>').join('') + '<div class="mt-selo">Compra 100% segura*<small>*segura para nós</small></div></nav>' +
          '<section><div class="mt-faixa">' + (loja.busca ? itens.length + ' resultado(s) para "' + esc(loja.busca) + '"' : esc(loja.cat)) + '</div><div class="mt-grade">' +
          itens.map(f => '<div class="mt-item" data-prod="' + f.id + '"><div class="mt-mini">' + miniatura(f) + '</div><div class="mt-nome">' + esc(f.nome) + '</div><div class="mt-cond2">' + f.estado + (f.finame ? ' · aceita FINAME' : '') + '</div><div class="mt-preco2">' + R(f.preco) + '</div><div class="mt-prazo">Chega em ' + f.prazoDias + ' dia(s)</div></div>').join('') +
          (itens.length ? '' : '<p class="mt-nada">Nada encontrado. Tente "bobina" ou "máquina".</p>') + '</div></section></div>';
      }
      c.innerHTML = h + '</div>';
      const b = c.querySelector('.mt-busca'); b.oninput = () => { loja.busca = b.value; loja.prod = null; const pos = b.selectionStart; PT.pc.redesenhar('loja'); const nb = c.querySelector('.mt-busca'); nb.focus(); nb.setSelectionRange(pos, pos); };
      liga(c, '[data-cat]', x => { loja.cat = x.dataset.cat; loja.busca = ''; loja.prod = null; PT.pc.redesenhar('loja'); });
      liga(c, '[data-prod]', x => { loja.prod = x.dataset.prod; loja.qtd = 1; PT.pc.redesenhar('loja'); });
      liga(c, '[data-voltar]', () => { loja.prod = null; PT.pc.redesenhar('loja'); });
      const q = c.querySelector('[data-qtd]'); if (q) q.onchange = () => loja.qtd = +q.value;
      liga(c, '[data-comprar]', x => {
        // trava contra duplo clique: um clique = uma compra (ChatGPT r5)
        const agora = performance.now(); if (x.disabled || agora - (loja.ultCompra || 0) < 800) return;
        loja.ultCompra = agora; c.querySelectorAll('[data-comprar]').forEach(b => b.disabled = true);
        const r = PT.loja.comprar(loja.prod, x.dataset.comprar, loja.qtd);
        msg(r.ok, r.ok ? 'Pedido confirmado. O fornecedor já recebeu sua solicitação. ' + r.msg : r.msg);
        setTimeout(() => PT.pc.redesenhar('loja'), 800);
      });
    } });

  // ====================== BANCO CERRADO ======================
  const banco = { aba: 'extrato' };
  reg('banco', { nome: 'Banco Cerrado', titulo: 'Banco Cerrado — Internet Banking Empresas', icone: 'banco', larg: 860, alt: 600, vivo: true,
    abrir(c) {
      const e = PT.eco.st, E = D.economia, rec = e.receber.reduce((a, r) => a + r.valor, 0);
      let h = '<div class="bc"><header><div class="bc-logo">🌾 Banco <b>Cerrado</b></div><div class="bc-conta">Agência 0742 · Conta empresa 10.338-5<br><small>PARECIS TELHA LTDA</small></div></header>' +
        '<div class="bc-resumo"><div class="bc-saldo"><small>Saldo disponível</small><b class="' + (e.caixa < 0 ? 'neg' : '') + '">' + R(e.caixa) + '</b></div>' +
        '<div><small>Capital de giro</small>' + R(e.creditoUsado) + '<em> de ' + R(E.limiteCredito) + ' · 2% a.m.</em></div><div><small>A receber</small>' + R(rec) + '<em>' + e.receber.length + ' boleto(s)</em></div>' +
        '<div><small>Previsão em 7 / 30 dias</small>' + R(PT.eco.previsao(7)) + '<em>' + R(PT.eco.previsao(30)) + '</em></div></div>' +
        '<div class="bc-acoes"><label>Valor <input type="number" class="bc-valor" value="5000" step="500" min="0"></label><button data-op="sacar">Sacar do capital de giro</button><button data-op="amortizar">Amortizar capital de giro</button><button data-op="antecipar"' + (e.receber.length ? '' : ' disabled') + '>Antecipar recebíveis (−3%)</button></div>';
      if (e.cheque > 0) h += '<div class="bc-agiota"><b>⚠ Cheque especial em uso: ' + R(e.cheque) + '</b> · juros de 5% a cada 7 dias. "Seu Ademar" ligou duas vezes hoje. <button data-op="agiota">Quitar agora</button></div>';
      h += '<div class="bc-abas">' + [['extrato', 'Extrato'], ['receber', 'Contas a receber'], ['fin', 'Financiamentos'], ['finame', 'FINAME']].map(a => '<a data-aba="' + a[0] + '" class="' + (banco.aba === a[0] ? 'sel' : '') + '">' + a[1] + '</a>').join('') + '</div><div class="bc-tab">';
      if (banco.aba === 'extrato') h += '<table class="bc-tabela"><tr><th>Data</th><th>Lançamento</th><th class="num">Valor</th><th class="num">Saldo</th></tr>' + (e.extrato.slice(0, 60).map(x => '<tr><td>' + x.quando + '</td><td>' + esc(x.desc) + '</td><td class="num ' + (x.valor < 0 ? 'neg' : 'pos') + '">' + R(x.valor) + '</td><td class="num">' + R(x.saldo) + '</td></tr>').join('') || '<tr><td colspan="4">Sem lançamentos.</td></tr>') + '</table>';
      if (banco.aba === 'receber') h += '<table class="bc-tabela"><tr><th>Vencimento</th><th>Descrição</th><th class="num">Valor</th></tr>' + (e.receber.map(r => '<tr><td>Dia ' + r.dia + '</td><td>' + esc(r.desc) + '</td><td class="num">' + R(r.valor) + '</td></tr>').join('') || '<tr><td colspan="3">Nenhum boleto em aberto.</td></tr>') + '</table>';
      if (banco.aba === 'fin') h += '<table class="bc-tabela"><tr><th>Contrato</th><th>Parcela</th><th>Restantes</th><th>Próximo vencimento</th></tr>' + (e.financiamentos.map(f => '<tr><td>' + esc(f.desc) + '</td><td>' + R(f.parcela) + '</td><td>' + f.restantes + '</td><td>Dia ' + f.proximoVencimento + '</td></tr>').join('') || '<tr><td colspan="4">Nenhum financiamento ativo.</td></tr>') + '</table>';
      if (banco.aba === 'finame') h += '<div class="bc-texto"><p><b>FINAME Máquinas</b> — linha para compra de equipamentos industriais.</p><p>Entrada de 30%, saldo em 24 parcelas mensais (1,2% a.m.).</p><p>Situação da sua empresa: ' + (PT.eco.finameLiberado() ? '<b class="pos">APROVADA</b>' : 'em análise. Faltam <b>' + PT.rep.proximaFaixa() + '</b> entregas para a faixa 1 de reputação.') + '</p><p class="bc-letra">Compras com FINAME são feitas direto na loja IndústriaMT.</p></div>';
      c.innerHTML = h + '</div></div>';
      liga(c, '[data-aba]', x => { banco.aba = x.dataset.aba; PT.pc.redesenhar('banco'); });
      liga(c, '[data-op]', x => {
        const v = +c.querySelector('.bc-valor').value || 0, op = x.dataset.op;
        if (op === 'sacar') { const s = PT.eco.sacarCredito(v); msg(s > 0, s > 0 ? R(s) + ' creditados na conta.' : 'Limite indisponível.'); }
        if (op === 'amortizar') { const s = PT.eco.pagarCredito(v); msg(s > 0, s > 0 ? 'Amortizado ' + R(s) + '.' : 'Nada para amortizar ou saldo insuficiente.'); }
        if (op === 'antecipar') { const s = PT.eco.anteciparTudo(); msg(s > 0, 'Recebíveis antecipados: ' + R(s) + '.'); }
        if (op === 'agiota') { const s = PT.eco.pagarAgiota(); msg(s > 0, s > 0 ? 'Pago ao agiota: ' + R(s) + '. Ele mandou um "valeu, patrão".' : 'Saldo insuficiente para esta operação.'); }
        PT.pc.redesenhar('banco');
      });
    } });

  // ====================== CORREIO ======================
  const mail = { pasta: 'entrada', sel: null };
  function pastaDe(m) { return m.pedidoId ? 'pedidos' : /Banco|cobran|Conta|Hospital/i.test(m.de + m.assunto) ? 'cobrancas' : 'entrada'; }
  reg('correio', { nome: 'Correio', titulo: 'Correio — contato@parecistelha.com.br', icone: 'correio', larg: 900, alt: 560, vivo: true,
    abrir(c) {
      const todos = PT.ui.correio();
      const lista = todos.filter(m => mail.pasta === 'entrada' || pastaDe(m) === mail.pasta);   // Caixa de entrada mostra tudo; as outras pastas filtram
      const atual = todos.find(m => m.id === mail.sel) || null;
      const n = p => todos.filter(m => !m.lido && (p === 'entrada' || pastaDe(m) === p)).length;
      let h = '<div class="ml"><aside><button class="ml-novo" disabled title="Em breve">✎ Nova mensagem</button>' + [['entrada', 'Caixa de entrada'], ['pedidos', 'Pedidos de clientes'], ['cobrancas', 'Contas e avisos']].map(p => '<a data-pasta="' + p[0] + '" class="' + (mail.pasta === p[0] ? 'sel' : '') + '">' + p[1] + (n(p[0]) ? ' <b>' + n(p[0]) + '</b>' : '') + '</a>').join('') + '</aside>' +
        '<div class="ml-lista">' + (lista.map(m => '<div class="ml-msg ' + (m.lido ? '' : 'novo') + (m.id === mail.sel ? ' sel' : '') + '" data-msg="' + m.id + '"><b>' + esc(m.de) + '</b><span>' + esc(m.assunto) + '</span><small>' + m.quando + '</small></div>').join('') || '<p class="ml-vazio">Nenhuma mensagem nesta pasta.</p>') + '</div><div class="ml-ler">';
      if (atual) {
        atual.lido = true;
        h += '<h3>' + esc(atual.assunto) + '</h3><div class="ml-de">De: <b>' + esc(atual.de) + '</b> · ' + atual.quando + '</div><div class="ml-texto">' + esc(atual.texto) + '</div>';
        if (atual.pedidoId) {
          const p = PT.pedidos.st.lista.find(x => x.id === atual.pedidoId);
          if (p && p.status === 'oferta') h += '<div class="ml-acoes"><button data-ped="aceitar">Responder: aceito o pedido</button><button data-ped="recusar" class="sec">Responder: não consigo atender</button></div>';
          else if (p) h += '<div class="ml-status">Pedido ' + esc(p.id) + ': <b>' + esc(p.status) + '</b></div>';
        }
      } else h += '<p class="ml-vazio">Selecione uma mensagem para ler.</p>';
      c.innerHTML = h + '</div></div>';
      liga(c, '[data-pasta]', x => { mail.pasta = x.dataset.pasta; PT.pc.redesenhar('correio'); });
      liga(c, '[data-msg]', x => { mail.sel = x.dataset.msg; PT.pc.redesenhar('correio'); });
      liga(c, '[data-ped]', x => { if (x.dataset.ped === 'aceitar') { const ok = PT.pedidos.aceitar(atual.pedidoId); msg(ok, ok ? 'Pedido ' + atual.pedidoId + ' aceito. A coleta foi agendada.' : 'Não foi possível aceitar.'); } else { PT.pedidos.recusar(atual.pedidoId); msg(true, 'Resposta enviada.'); } PT.pc.redesenhar('correio'); });
    } });

  // ====================== PEDIDOS — sistema comercial (do amigo do Lucas) ======================
  const ped = { filtro: 'ativos', sel: null };
  const SIT = { oferta: 'AGUARDANDO RESPOSTA', aceito: 'EM PRODUÇÃO', coleta: 'CAMINHÃO NA EXPEDIÇÃO', entregue: 'ENTREGUE', recusado: 'RECUSADO', expirado: 'EXPIRADO', cancelado: 'CANCELADO' };
  reg('pedidos', { nome: 'Pedidos', titulo: 'PARECIS TELHA — Sistema Comercial v1.3', icone: 'pedidos', larg: 940, alt: 560, vivo: true,
    abrir(c) {
      const L = PT.pedidos.st.lista.filter(p => ped.filtro === 'todos' || ['oferta', 'aceito', 'coleta'].includes(p.status)).slice().reverse();
      let h = '<div class="sc"><div class="sc-menu"><span>Arquivo</span><span>Cadastros</span><span>Pedidos</span><span>Relatórios</span><span>Ajuda</span></div>' +
        '<div class="sc-barra"><label><input type="radio" name="flt" value="ativos"' + (ped.filtro === 'ativos' ? ' checked' : '') + '> Em aberto</label><label><input type="radio" name="flt" value="todos"' + (ped.filtro === 'todos' ? ' checked' : '') + '> Todos</label><span class="sc-dica">Duplo clique na linha para detalhes</span></div>' +
        '<div class="sc-grade"><table><tr><th>Nº</th><th>Cliente</th><th>Tipo</th><th>Produto</th><th class="num">Qtd</th><th>Prazo</th><th>Pagamento</th><th>Situação</th><th class="num">Expedição</th></tr>' +
        (L.map(p => { const d = PT.pedidos.disponivel(p); return '<tr data-p="' + esc(p.id) + '" class="' + (p.id === ped.sel ? 'sel ' : '') + 's-' + cls(p.status) + '"><td>' + esc(p.id) + '</td><td>' + esc(p.cliente) + '</td><td>' + D.clientes[p.perfil].nome + '</td><td>' + D.produtos[p.produto].nome + ' ' + p.comprimento + ' m</td><td class="num">' + p.pecas + '</td><td>Dia ' + p.prazoDia + (PT.tempo.st.dia > p.prazoDia && ['aceito', 'coleta'].includes(p.status) ? ' ⚠' : '') + '</td><td>' + PT.ui.textoPagamento(p) + '</td><td>' + (SIT[p.status] || esc(p.status)) + '</td><td class="num">' + d.boas + '/' + p.pecas + '</td></tr>'; }).join('') || '<tr><td colspan="9">Nenhum pedido.</td></tr>') + '</table></div>';
      const p = PT.pedidos.st.lista.find(x => x.id === ped.sel);
      if (p) {
        const d = PT.pedidos.disponivel(p);
        h += '<fieldset class="sc-det"><legend>Pedido ' + esc(p.id) + ' — ' + esc(p.cliente) + '</legend><div class="sc-cols"><div>Produto: <b>' + PT.pedidos.descricao(p) + '</b><br>Prazo: dia ' + p.prazoDia + ', coleta 14h–16h<br>Pagamento: ' + PT.ui.textoPagamento(p) + (p.entradaPaga ? ' · entrada recebida ' + R(p.entradaPaga) : '') + '</div>' +
          '<div>Situação: <b>' + (SIT[p.status] || esc(p.status)) + '</b><br>Na zona verde: ' + d.boas + ' boas' + (d.tortas ? ', ' + d.tortas + ' tortas' : '') + '<br>Carregadas: ' + p.carregadas + '/' + p.pecas + '</div></div><div class="sc-bts">' +
          (p.status === 'oferta' ? '<button data-a="aceitar">Aceitar (F2)</button><button data-a="recusar">Recusar</button>' : '') + (p.status === 'aceito' ? '<button data-a="chamar">Chamar caminhão agora</button>' : '') + '</div></fieldset>';
      }
      c.innerHTML = h + '<div class="sc-status">Registros: ' + L.length + ' · Usuário: PATRÃO · Base: LOCAL</div></div>';
      c.querySelectorAll('[name="flt"]').forEach(r => r.onchange = () => { ped.filtro = r.value; PT.pc.redesenhar('pedidos'); });
      c.querySelectorAll('tr[data-p]').forEach(tr => { tr.onclick = () => { ped.sel = tr.dataset.p; PT.pc.redesenhar('pedidos'); }; });
      liga(c, '[data-a]', x => {
        const a = x.dataset.a;
        if (a === 'aceitar') { const ok = PT.pedidos.aceitar(p.id); msg(ok, ok ? 'A obra aguarda ' + p.pecas + ' peças. Coleta no dia ' + p.prazoDia + '.' : 'Não foi possível aceitar.'); }
        if (a === 'recusar') PT.pedidos.recusar(p.id);
        if (a === 'chamar') PT.pedidos.chamarAgora(p.id);
        PT.pc.redesenhar('pedidos');
      });
    } });

  // ====================== TRABALHE CONOSCO MT ======================
  const emp = { sel: null, aba: 'candidatos' };
  reg('empregos', { nome: 'Trabalhe Conosco MT', titulo: 'Trabalhe Conosco MT — Vagas no interior', icone: 'operario', larg: 880, alt: 580, vivo: true,
    abrir(c) {
      const F = PT.func, FD = D.funcionarios;
      if (!F.st.candidatos.length) F.gerarCandidatos();
      const pct = v => Math.round(v * 100);
      const barra = (n, v) => '<div class="tc-at"><span>' + n + '</span><i><s style="width:' + pct(v) + '%"></s></i><b>' + pct(v) + '</b></div>';
      let h = '<div class="tc"><header><div class="tc-logo">Trabalhe<b>Conosco</b><span>MT</span></div><div class="tc-vagas">Sua empresa: <b>' + F.st.lista.length + '/' + F.vagas() + '</b> vagas (1 por armário no vestiário)</div></header>' +
        (F.st.tartaruga > 0 ? '<div class="tc-greve">🪧 "SEM PIX, SEM TELHA" — a equipe está em operação tartaruga. <button data-a="folha">Pagar folha atrasada + multa</button></div>' : '') +
        '<div class="tc-abas">' + [['candidatos', 'Candidatos (' + F.st.candidatos.length + ')'], ['equipe', 'Minha equipe (' + F.st.lista.length + ')'], ['quadro', 'Quadro de tarefas']].map(a => '<a data-aba="' + a[0] + '" class="' + (emp.aba === a[0] ? 'sel' : '') + '">' + a[1] + '</a>').join('') + '</div>';
      if (emp.aba === 'candidatos') {
        h += '<div class="tc-lista">' + F.st.candidatos.map(k => '<div class="tc-cand"><div class="tc-foto">' + esc(k.nome[0]) + '</div><div class="tc-dados"><b>' + esc(k.nome) + '</b><span>' + FD.cargos[k.cargo].nome + ' · ' + esc(k.personalidade) + '</span><q>' + esc(k.fala) + '</q></div><div class="tc-attrs">' + barra('Competência', k.atributos.competencia) + barra('Segurança', k.atributos.seguranca) + barra('Ritmo', k.atributos.ritmo) + '</div><div class="tc-sal"><small>pretensão</small>' + R(k.salario) + '<button data-contratar="' + k.id + '">Contratar</button></div></div>').join('') + '</div><p class="tc-rod">Novos currículos a cada 3 dias. Mecânicos aparecem quando a fábrica chega à faixa 2.</p>';
      }
      if (emp.aba === 'equipe') {
        h += F.st.lista.length ? '<table class="tc-tab"><tr><th>Nome</th><th>Cargo</th><th>Jeito</th><th>Energia</th><th>Agora</th><th>Certificados</th><th></th></tr>' + F.st.lista.map(f => '<tr><td><b>' + esc(f.nome) + '</b><br><small>' + R(f.salario) + '/mês</small></td><td>' + FD.cargos[f.cargo].nome + '</td><td>' + esc(f.personalidade) + '</td><td>' + pct(f.energia) + '%</td><td>' + (f.tarefa ? FD.nomesTarefa[f.tarefa.tipo] : f.estado) + '</td><td>' + (f.certificados.join(', ') || '—') + '</td><td>' +
          ['perfiladeira', 'guilhotina', 'dobradeira'].filter(x => !f.certificados.includes(x)).map(x => '<button class="sec" data-curso="' + f.id + '|' + x + '">Curso ' + x + ' (' + R(FD.cursoPreco) + ')</button>').join('') + '<button class="sec" data-demitir="' + f.id + '">Dispensar</button></td></tr>').join('') + '</table><p class="tc-rod">Folha quinzenal: ' + R(F.folhaMensal() / 2) + ' (com encargos).</p>' : '<p class="tc-vazio">Ninguém contratado ainda. Por enquanto o dono faz tudo!</p>';
      }
      if (emp.aba === 'quadro') {
        const pr = s => '<select data-prio="' + s + '">' + ['alta', 'media', 'baixa'].map(v => '<option value="' + v + '"' + (F.st.prioridade[s] === v ? ' selected' : '') + '>' + { alta: 'Alta', media: 'Média', baixa: 'Baixa' }[v] + '</option>').join('') + '</select>';
        h += '<div class="tc-quadro"><div><b>Produção</b><small>operar lotes automáticos</small>' + pr('producao') + '</div><div><b>Expedição</b><small>tirar pilhas das mesas</small>' + pr('expedicao') + '</div><div><b>Manutenção</b><small>enrosco e graxa</small>' + pr('manutencao') + '</div></div>' +
          '<h4>Tarefas abertas agora</h4><ul class="tc-tarefas">' + (F.tarefasAbertas().map(t => '<li>' + FD.nomesTarefa[t.tipo] + ' — ' + (t.alvo.nome || t.alvo.rotulo || '') + ' <small>(' + t.setor + ')</small></li>').join('') || '<li>Nenhuma. Para o operador rodar lotes sozinho, marque a opção no CLP da máquina.</li>') + '</ul>';
      }
      c.innerHTML = h + '</div>';
      liga(c, '[data-aba]', x => { emp.aba = x.dataset.aba; PT.pc.redesenhar('empregos'); });
      liga(c, '[data-contratar]', x => { const r = F.contratar(x.dataset.contratar); msg(r.ok, r.msg); PT.pc.redesenhar('empregos'); });
      liga(c, '[data-demitir]', x => { F.demitir(x.dataset.demitir); msg(true, 'Funcionário dispensado.'); PT.pc.redesenhar('empregos'); });
      liga(c, '[data-curso]', x => { const [id, k] = x.dataset.curso.split('|'); const r = F.treinar(id, k); msg(r.ok, r.msg); PT.pc.redesenhar('empregos'); });
      liga(c, '[data-a="folha"]', () => { const ok = F.pagarAtrasado(); msg(ok, ok ? 'Folha paga. Caiu o Pix!' : 'Saldo insuficiente para esta operação.'); PT.pc.redesenhar('empregos'); });
      c.querySelectorAll('[data-prio]').forEach(s => s.onchange = () => { F.st.prioridade[s.dataset.prio] = s.value; PT.pc.som('clique'); });
    } });

  // ====================== REPUTAÇÃO ======================
  reg('reputacao', { nome: 'Reputação', titulo: 'Reputação da fábrica', icone: 'reputacao', larg: 640, alt: 520, vivo: true,
    abrir(c) {
      const r = PT.rep, z = PT.zoeira.st, est = r.estrelas();
      const b = (n, v) => '<div class="rp-b"><span>' + n + '</span><i><s style="width:' + Math.round(v * 100) + '%"></s></i><b>' + Math.round(v * 100) + '%</b></div>';
      c.innerHTML = '<div class="rp"><div class="rp-topo"><div class="rp-est">' + '★'.repeat(Math.floor(est)) + (est % 1 ? '½' : '') + '<span>' + est.toFixed(1) + '</span></div><div>Faixa <b>' + r.faixa() + '</b> · ' + r.st.entregues + ' pedidos entregues<br><small>Próxima faixa em ' + r.proximaFaixa() + ' entrega(s). A faixa 1 libera FINAME, construtoras e agro.</small></div></div>' +
        b('Pontualidade', r.st.pontualidade) + b('Qualidade', r.st.qualidade) + b('Confiança financeira', r.st.financeira) +
        '<h4>Mural de ocorrências</h4><table class="rp-mural"><tr><td>Visitas ao hospital</td><td>' + z.mortes + '</td></tr><tr><td>Cabos de ponte estourados</td><td>' + z.cabosRompidos + '</td></tr><tr><td>Enroscos de chapa</td><td>' + z.enroscos + '</td></tr><tr><td>Quedas de carga</td><td>' + z.quedas + '</td></tr><tr><td>Recorde sem acidentes</td><td>' + z.recorde + ' dia(s)</td></tr></table></div>';
    } });

  // ====================== JORNAL PARECIS AGORA ======================
  const FILLER = ['Galinha atravessa a MT-235 e para o trânsito por 40 minutos', 'Festa do peão confirma show de dupla sertaneja "que ninguém conhece ainda"', 'Prefeitura promete tapar buraco da avenida "até a próxima chuva"', 'Safra de soja deve bater recorde, dizem produtores otimistas', 'Moradores reclamam de barulho de perfiladeira às 6h da manhã', 'Concurso de pamonha tem empate inédito', 'Preço do aço oscila e serralheiros fazem estoque', 'Chuva forte derruba telhado de barracão antigo: "era telha de fibrocimento", diz dono'];
  reg('noticias', { nome: 'Jornal Parecis Agora', titulo: 'Parecis Agora — o jornal da região', icone: 'noticias', larg: 760, alt: 560,
    abrir(c) {
      const z = PT.zoeira.st, dia = PT.tempo.st.dia, rnd = semente('jornal' + dia);
      const manchete = z.cabosRompidos > 0 ? 'Empresário local arrebenta cabo de ponte rolante: "foi só uma bobininha", diz' : z.mortes > 0 ? 'Dono de fábrica de telhas vira figurinha carimbada no pronto-socorro' : PT.rep.st.entregues > 0 ? 'Nova fábrica de telhas de Campo Novo do Parecis já entregou ' + PT.rep.st.entregues + ' pedido(s)' : 'Barracão abandonado da saída da cidade ganha novo dono';
      const outras = []; while (outras.length < 4) { const t = FILLER[Math.floor(rnd() * FILLER.length)]; if (!outras.includes(t)) outras.push(t); }
      c.innerHTML = '<div class="jn"><header><h1>Parecis Agora</h1><div>Campo Novo do Parecis — MT · Edição do dia ' + dia + ' · R$ 2,50</div></header>' +
        '<article class="jn-man"><h2>' + manchete + '</h2><p>A fábrica, que funciona no antigo barracão da saída da cidade, está há <b>' + z.diasSem + '</b> dia(s) sem acidentes, segundo a placa afixada na parede. ' + (z.recorde > 3 ? 'O recorde é de ' + z.recorde + ' dias.' : 'Vizinhos apostam que a placa não passa de uma semana.') + '</p></article>' +
        '<div class="jn-cols">' + outras.map((t, i) => '<article><h3>' + t + '</h3><p>' + ['Testemunhas relataram que tudo aconteceu muito rápido.', 'A redação tentou contato, mas ninguém atendeu o telefone.', 'O caso será discutido na próxima sessão da Câmara.', 'Especialistas recomendam calma e um cafezinho.'][i] + '</p></article>').join('') + '</div>' +
        '<div class="jn-merc"><b>Mercado</b> · Aço galvalume: R$ ' + (7 + (rnd() - 0.5) * 0.3).toFixed(2) + '/kg · Telha TP-40 na região: R$ ' + (45 + (rnd() - 0.5) * 3).toFixed(2) + '/m² · Dólar: subindo, como sempre</div></div>';
    } });

  // ====================== CLIMA ======================
  reg('clima', { nome: 'Clima', titulo: 'Clima — Campo Novo do Parecis', icone: 'clima', larg: 560, alt: 360, desktop: false,
    abrir(c) {
      const dia = PT.tempo.st.dia, t = ['☀️ Sol', '⛅ Parcialmente nublado', '🌧️ Pancadas de chuva', '⛈️ Temporal à tarde'];
      const dias = [0, 1, 2, 3, 4].map(k => { const r = semente('clima' + (dia + k)); const i = Math.floor(r() * 4); return { d: dia + k, c: t[i], max: Math.round(30 + r() * 7), min: Math.round(19 + r() * 4) }; });
      c.innerHTML = '<div class="cl"><div class="cl-hoje"><span>' + dias[0].c.split(' ')[0] + '</span><div><b>' + dias[0].max + '°</b><br>' + dias[0].c.slice(3) + '<br><small>Mín. ' + dias[0].min + '° · vento leve do norte</small></div></div><div class="cl-prox">' + dias.slice(1).map(d => '<div><small>Dia ' + d.d + '</small><span>' + d.c.split(' ')[0] + '</span><b>' + d.max + '°</b> ' + d.min + '°</div>').join('') + '</div><p class="cl-obs">Dica: em dia de temporal, o motorista chega mais devagar e reclama mais.</p></div>';
    } });

  // ====================== MODELOS 3D ======================
  function baixarModelos() {
    const f = PT.fichaModelos();
    const cols = ['id', 'nome', 'grupo', 'quemFaz', 'obs', 'gratis', 'categoria', 'dims', 'forma', 'usos', 'maxInstancias', 'animacoes', 'estados', 'sockets', 'polys', 'prioridade', 'pivot', 'colisor', 'multimesh', 'materiais', 'arquivo', 'notas'];
    const e = v => '"' + String(Array.isArray(v) ? v.map(x => Array.isArray(x) ? x.join(' ') : x).join(' | ') : (v === undefined ? '' : v)).replace(/"/g, '""') + '"';
    const csv = cols.join(';') + '\n' + f.map(m => cols.map(k => e(k === 'dims' ? m.dims.join(' x ') : m[k])).join(';')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' })); a.download = 'modelos_3d_parecis.csv'; a.click();
  }
  reg('modelos', { nome: 'Modelos 3D', titulo: 'Modelos 3D — ferramenta interna', icone: 'modelos', larg: 920, alt: 560,
    abrir(c) {
      const f = PT.fichaModelos();
      c.innerHTML = '<div class="m3"><div class="m3-barra"><b>' + f.length + '</b> fichas · <b>' + f.filter(m => m.usos > 0).length + '</b> já apareceram nesta partida · 🟢 grupo 1 (Claude): <b>' + f.filter(m => m.grupo === 1).length + '</b> · 🟠 grupo 2 (pack/modelador): <b>' + f.filter(m => m.grupo === 2).length + '</b> <button data-csv>Exportar lista (.csv)</button></div><table class="m3-tab"><tr><th>ID</th><th>Nome</th><th>Quem faz</th><th>Categoria</th><th>Dimensões (m)</th><th>Usos</th><th>Máx.</th><th>Animações</th><th>Estados</th></tr>' +
        f.map(m => '<tr class="' + (m.usos ? '' : 'apagado') + '"><td><code>' + m.id + '</code></td><td>' + esc(m.nome) + '</td><td>' + (m.grupo === 1 ? '🟢 ' : '🟠 ') + esc(m.quemFaz) + '</td><td>' + m.categoria + '</td><td>' + m.dims.join(' × ') + '</td><td>' + m.usos + '</td><td>' + m.maxInstancias + '</td><td>' + (m.animacoes || []).join(', ') + '</td><td>' + (m.estados || []).join(', ') + '</td></tr>').join('') + '</table></div>';
      liga(c, '[data-csv]', baixarModelos);
    } });

  // ====================== CONFIGURAÇÕES ======================
  let novoJogoCliques = 0;
  reg('config', { nome: 'Configurações', titulo: 'Configurações do sistema', icone: 'config', larg: 620, alt: 660,
    abrir(c) {
      c.innerHTML = '<div class="cf"><section><h4>Personalizar</h4><label><input type="checkbox" data-som' + (PT.pc.st.som ? ' checked' : '') + '> Sons do sistema</label>' + '<label><input type="checkbox" data-glb' + (PT.glb && PT.glb.ligado() ? ' checked' : '') + '> Modelos 3D novos no lugar dos cubos (recarrega o jogo)</label>' +
        '<div class="cf-papeis">' + ['Entardecer no pátio', 'Noite na fábrica', 'Chapadão'].map((n, i) => '<button data-papel="' + i + '" class="papelmini papel' + i + (PT.pc.st.papel === i ? ' sel' : '') + '"><span>' + n + '</span></button>').join('') + '</div></section>' +
        '<section><h4>Personagens 3D (ithappy)</h4><p class="cf-obs">O pack Creative Characters é seu (licença Fab) e não vai para o GitHub. Escolha o arquivo <b>personagens_ithappy.glb</b> (Documentos\\ParecisTelha\\personagens). Ele fica guardado neste navegador.</p><div class="cf-bts"><label class="btn">Escolher personagens_ithappy.glb<input type="file" data-pers accept=".glb" hidden></label><button data-a="tirarpers">Voltar aos cilindros</button></div><p class="cf-obs" data-pers-st></p></section>' +
        '<section><h4>Jogo salvo</h4><div class="cf-bts"><button data-a="salvar">Salvar agora (K)</button><button data-a="carregar">Carregar último (L)</button><button data-a="exportar">Exportar arquivo</button><label class="btn">Importar arquivo<input type="file" data-imp accept=".json" hidden></label></div>' +
        '<p class="cf-obs">O jogo só salva quando nada está acontecendo (sem carga na ponte, sem caminhão no pátio, sem cliente no balcão).</p><button data-a="novo" class="perigo">Novo jogo (apaga o save)</button></section>' +
        '<section><h4>Tempo</h4><button data-a="vel">Velocidade do tempo: x' + PT.tempo.vel + ' (T)</button></section>' +
        (PT.DEBUG ? '<section><h4>Desenvolvedor (?debug=1)</h4><div class="cf-bts"><button data-a="pedido">Gerar pedido</button><button data-a="dinheiro">+R$ 20 mil</button><button data-a="noite">Pular a noite</button></div></section>' : '') +
        '<section class="cf-sobre"><img src="' + I('fabrica') + '" alt=""><div><b>ParecisOS</b> versão 1.0 (Demo 1)<br><small>Ícones: Fluent Emoji (Microsoft, licença MIT). Formiguinha Açucarada.</small></div></section></div>';
      const s = c.querySelector('[data-som]'); s.onchange = () => { PT.pc.st.som = s.checked; };
      const gl = c.querySelector('[data-glb]'); if (gl) gl.onchange = () => { PT.glb.definirLigado(gl.checked); PT.ev.emit('aviso', 'Vale depois de recarregar a página (salve antes).'); };
      const ps = c.querySelector('[data-pers]'), pst = c.querySelector('[data-pers-st]');
      if (PT.glb && pst) PT.glb.carregarPersonagens().then(g => { pst.textContent = g ? 'Personagens 3D carregados (' + g.animations.length + ' animações).' : 'Sem personagens 3D: usando cilindros.'; });
      if (ps) ps.onchange = () => { const f = ps.files[0]; if (!f) return; pst.textContent = 'Lendo ' + f.name + '...';
        PT.glb.guardarPersonagens(f).then(n => { pst.textContent = 'Pronto! ' + n + ' animações. Salve o jogo e recarregue a página.'; PT.ev.emit('aviso', 'Personagens 3D guardados. Recarregue a página (salve antes).'); })
          .catch(e => { pst.textContent = 'Não deu: ' + e.message; }); };
      liga(c, '[data-papel]', x => { PT.pc.trocarPapel(+x.dataset.papel); PT.pc.redesenhar('config'); });
      liga(c, '[data-a]', x => {
        const a = x.dataset.a;
        if (a === 'salvar') PT.save.salvar();
        if (a === 'carregar') { if (PT.save.existe()) PT.save.pedirCarregar(); else msg(false, 'Nenhum jogo salvo ainda.'); }
        if (a === 'exportar') PT.save.exportar();
        if (a === 'novo') { if (++novoJogoCliques < 2) { msg(false, 'Clique de novo para confirmar: o save atual será apagado.'); return; } try { localStorage.removeItem('parecis_demo1_save'); } catch (e) { } location.reload(); }
        if (a === 'vel') PT.tempo.alternarVel();
        if (a === 'tirarpers') PT.glb.apagarPersonagens().then(() => msg(true, 'Personagens 3D removidos. Recarregue a página.'));
        if (a === 'pedido' && PT.DEBUG) PT.pedidos.gerar();
        if (a === 'dinheiro' && PT.DEBUG) PT.eco.lancar(20000, 'DEBUG: dinheiro de teste');
        if (a === 'noite' && PT.DEBUG) PT.tempo.pularNoite();
        PT.pc.redesenhar('config');
      });
      const imp = c.querySelector('[data-imp]'); imp.onchange = e => { if (e.target.files[0]) PT.save.importarArquivo(e.target.files[0]); };
    } });

  // ====================== LIXEIRA ======================
  reg('lixeira', { nome: 'Lixeira', titulo: 'Lixeira', icone: 'lixeira', larg: 520, alt: 380,
    abrir(c) {
      const arq = [['manual_da_perfiladeira.pdf', 'Nunca foi aberto.'], ['orcamento_ponte_10t_NAO_MOSTRAR_AO_BANCO.xls', 'Melhor deixar aqui.'], ['foto_cabo_estourado (3).jpg', 'Prova do crime.'], ['planilha_do_seu_tiao_1998.xls', 'Fórmulas que ninguém entende.'], ['receita_bolo_de_milho.txt', 'Por que isso está no PC da fábrica?']];
      c.innerHTML = '<div class="lx"><table><tr><th>Nome</th><th>Observação</th></tr>' + arq.map(a => '<tr><td>📄 ' + a[0] + '</td><td>' + a[1] + '</td></tr>').join('') + '</table><button class="sec" data-esv>Esvaziar lixeira</button></div>';
      liga(c, '[data-esv]', () => msg(false, 'A lixeira se recusa a ser esvaziada. Ela tem apego.'));
    } });
})();
