// Rodada 5 do ChatGPT: ParecisOS + balcão (XSS, duplo clique, FINAME atômico,
// foco em botão, janela fora da tela, reserva de estoque, colisão, save com cliente)
const { chromium } = require('playwright');
const H = require('./helpers.js');
const THREE_FILE = (process.env.THREE_JS || require('path').join(__dirname, 'three.min.js'));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const erros = [];
  p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message + ' ' + (e.stack || '').split('\n')[1]));
  p.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  await p.route('**/three.min.js', r => r.fulfill({ path: THREE_FILE, contentType: 'application/javascript' }));
  await p.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x', '1'); } } catch (e) { } });
  await p.goto('http://localhost:8765/demo1/index.html'); await p.waitForTimeout(1200);
  await H.setup(p);
  const r1 = await p.evaluate(() => {
    const out = []; const ok = (c, msg) => out.push((c ? 'PASSOU ' : 'FALHOU ') + msg);
    PT.ui.cancelarInteracoes();
    // R1 XSS nas notificações
    window.__xss = 0;
    PT.pc.abrir();
    PT.pc.notificar({ de: '<img src=x onerror="window.__xss=1">', texto: '<b id="injetado">oi</b>' });
    document.querySelector('.pc-sino').click();
    ok(!document.getElementById('injetado') && /&lt;b/.test(document.querySelector('.pc-notifs').innerHTML), 'R1 notificação com HTML aparece como texto (sem injeção)');
    // R2 duplo clique compra uma vez só
    const it = PT.DADOS.catalogo.find(i => !i.finame && i.preco < 3000) || PT.DADOS.catalogo[0];
    PT.eco.st.caixa = 500000;
    const ag0 = PT.entrega.st.agenda ? PT.entrega.st.agenda.length : 0;
    let compras = 0; const h = () => compras++; PT.ev.on('compra', h);
    const j = PT.pc.abrirApp('loja');
    // abre a ficha do produto
    const st = PT.pc.janelas.find(x => x.id === 'loja');
    const bcat = st.corpo.querySelector('[data-cat="' + it.categoria + '"]'); if (bcat) bcat.click();
    const bp = st.corpo.querySelector('[data-prod="' + it.id + '"]');
    if (bp) bp.click();
    const bc = st.corpo.querySelector('[data-comprar="vista"]');
    if (bc) { bc.click(); bc.click(); bc.click(); }
    ok(bc && compras === 1, 'R2 três cliques rápidos em "Comprar à vista" = 1 compra (' + compras + ', item ' + it.id + ', ficha ' + !!bp + ', botão ' + !!bc + ')');
    // R3 FINAME: sem caixa p/ entrada+frete não contrata nada
    const itf = PT.DADOS.catalogo.find(i => i.finame && (i.frete || 0) > 0) || PT.DADOS.catalogo.find(i => i.finame);
    const faixa = PT.rep.faixa; PT.rep.faixa = () => 9;
    const fin0 = PT.eco.st.financiamentos.length;
    const f = PT.loja.ficha(itf.id), entrada = f.preco * PT.DADOS.economia.finame.entrada;
    PT.eco.st.caixa = entrada + (f.frete || 0) - 1 - (PT.DADOS.economia.chequeEspecial - PT.eco.st.cheque);
    const rf = PT.loja.comprar(itf.id, 'finame', 1);
    ok(!rf.ok && PT.eco.st.financiamentos.length === fin0, 'R3 FINAME sem caixa para entrada + frete não deixa financiamento órfão (' + rf.msg + ')');
    PT.rep.faixa = faixa; PT.eco.st.caixa = 500000;
    // R4 botão com foco não é redesenhado
    const jp = PT.pc.abrirApp('pedidos'); const btn = jp.corpo.querySelector('button, input');
    let redesenhou = false;
    if (btn) { btn.focus(); jp.mouseDentro = false; const orig = jp.app.abrir; jp.app.abrir = (c, jj) => { redesenhou = true; orig(c, jj); }; PT.pc.atualizar(true); jp.app.abrir = orig; }
    ok(btn && !redesenhou, 'R4 janela viva não se redesenha enquanto um botão dela tem o foco do teclado');
    // R5 janela volta para dentro da tela no resize
    const jl = PT.pc.janelas.find(x => x.id === 'loja'); jl.el.style.left = '3000px'; jl.el.style.top = '2000px'; jl.el.style.width = '5000px';
    PT.pc.ajustarJanela(jl);
    ok(jl.el.offsetLeft + jl.el.offsetWidth <= innerWidth && jl.el.offsetTop + jl.el.offsetHeight <= innerHeight - 46 + 1, 'R5 janela perdida fora da tela volta para dentro (' + jl.el.offsetLeft + ',' + jl.el.offsetTop + ' ' + jl.el.offsetWidth + 'px)');
    // R6 empregos/pedidos escapam campos
    PT.func.gerarCandidatos(); PT.func.st.candidatos[0].personalidade = '<i id="inj2">x</i>';
    const je = PT.pc.abrirApp('empregos'); PT.pc.desenhar(je);
    ok(!document.getElementById('inj2'), 'R6 campos de candidato com HTML não viram HTML no Trabalhe Conosco');
    PT.pc.fechar();
    return out;
  });
  const r2 = await p.evaluate(() => {
    const out = []; const ok = (c, msg) => out.push((c ? 'PASSOU ' : 'FALHOU ') + msg);
    const L = PT.DADOS.mundo.loja; PT.ui.cancelarInteracoes();
    const j = PT.mundo.jog; j.x = 19; j.z = L.balcaoZ + 1.2;
    // R7 estoque reservado para pedido aceito não vai para o balcão
    T.pilhaVerde(20, 5, 0);
    const ped = PT.pedidos.gerar({ perfil: 'pedreiro', cliente: 'Construtora Teste', canal: 'email', produto: 'TP40', comprimento: 5, pecas: 15, precoUnit: 30, prazoDia: PT.tempo.st.dia + 3, silencioso: true });
    delete ped.silencioso; PT.pedidos.aceitar(ped.id);
    const rnd = Math.random; Math.random = () => 0.9;
    const c = PT.balcao.novoCliente(); Math.random = rnd;
    c.tipo = 'chacara'; c.produto = 'TP40'; c.comprimento = 5; c.pecas = 10;
    for (let i = 0; i < 400; i++) PT.balcao.atualizar(0.1);
    ok(PT.balcao.emEstoque(c) === 20 && PT.balcao.disponivel(c) === 5, 'R7 balcão enxerga 20 na zona verde mas só 5 livres (15 são da construtora)');
    Math.random = () => 0.9; T.fazer(/^Atender/); Math.random = rnd;
    const bv = document.querySelector('#balcao [data-b="vender"]');
    ok(bv && bv.disabled, 'R8 pronta entrega bloqueada quando o estoque é de pedido aceito');
    // R9 revalida na hora da venda (estoque some com a janela aberta)
    c.pecas = 5; const cx0 = PT.eco.st.caixa;
    PT.ent.naZona('expedicao', o => o.tipo === 'pilha' && o.comprimento === 5).forEach(o => { o.qtd = 16; PT.estoque.atualizarPilha(o); });
    PT.balcao.decidir(c, 'vender', 999, 950);
    ok(PT.eco.st.caixa === cx0, 'R9 se o estoque mudou com a janela aberta, não cobra o cliente (caixa igual)');
    PT.ui.cancelarInteracoes();
    // R10 save bloqueado com cliente no balcão
    const motivo = PT.save.estavel();
    ok(/balcão/.test(motivo || ''), 'R10 não salva com cliente esperando no balcão: ' + motivo);
    // R11 colisão: cliente não atravessa o balcão
    ok(!PT.balcao.livre(19, L.balcaoZ) && PT.balcao.livre(19, L.balcaoZ - 1), 'R11 o balcão e as paredes bloqueiam o cliente');
    const c2 = PT.balcao.novoCliente();
    let atravessou = false;
    for (let i = 0; i < 600; i++) { PT.balcao.atualizar(0.1); if (Math.abs(c2.z - L.balcaoZ) < 0.3 && c2.x > L.x0 + 2.5) atravessou = true; }
    ok(!atravessou && c2.estado === 'esperando', 'R12 cliente entra pela porta e espera sem atravessar o balcão (' + c2.estado + ' z ' + c2.z.toFixed(2) + ')');
    return out;
  });
  console.log(r1.concat(r2).join('\n'));
  console.log('ERROS:\n' + erros.join('\n'));
  await b.close();
})();
