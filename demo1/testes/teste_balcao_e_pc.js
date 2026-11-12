const { chromium } = require('playwright');
const H = require('./helpers.js');
const THREE_FILE = (process.env.THREE_JS || require('path').join(__dirname, 'three.min.js'));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
  const erros = [];
  p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message + ' ' + (e.stack||'').split('\n')[1]));
  p.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  await p.route('**/three.min.js', r => r.fulfill({ path: THREE_FILE, contentType: 'application/javascript' }));
  await p.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x','1'); } } catch(e){} });
  await p.goto('http://localhost:8765/demo1/index.html'); await p.waitForTimeout(1200);
  await H.setup(p);
  const r = await p.evaluate(() => {
    const out = []; const ok = (c, msg) => out.push((c ? 'PASSOU ' : 'FALHOU ') + msg);
    const L = PT.DADOS.mundo.loja;
    // jogador passa pela porta da frente até atrás do balcão
    const j = PT.mundo.jog; j.x = 19; j.z = 3; let x = j.x, z = j.z;
    for (let i = 0; i < 80; i++) { const pp = PT.mundo.empurrar(x, z - 0.1, 0.35); x = pp.x; z = pp.z; }
    ok(z < -4 && z > L.balcaoZ, 'Z1 jogador sai pela porta da frente e chega atrás do balcão (z ' + z.toFixed(2) + ')');
    j.x = x; j.z = z;
    // cliente chega e faz fila
    PT.ui.cancelarInteracoes();
    const rnd = Math.random; Math.random = () => 0.1;   // pedreiro que pede desconto
    const c = PT.balcao.novoCliente(); Math.random = rnd;
    for (let i = 0; i < 400; i++) PT.balcao.atualizar(0.1);
    ok(c.estado === 'esperando' && Math.abs(c.z - (L.balcaoZ - 1)) < 0.3, 'Z2 cliente entra pela porta da rua e espera no balcão (z ' + c.z.toFixed(2) + ', ' + c.estado + ')');
    // sem estoque: só encomenda
    const r1 = T.fazer(/^Atender/); ok(/^ok/.test(r1) && PT.ui.modalAberto(), 'Z3 atender abre o diálogo do balcão: ' + r1);
    const vend = document.querySelector('#balcao [data-b="desconto"], #balcao [data-b="vender"]');
    ok(vend && vend.disabled, 'Z4 sem estoque na zona verde a pronta entrega fica bloqueada');
    document.querySelector('#balcao [data-b="encomenda"]').click();
    const ped = PT.pedidos.st.lista.find(pp => /balcão/.test(pp.cliente));
    ok(ped && ped.status === 'aceito' && ped.entradaPaga > 0, 'Z5 encomenda vira pedido aceito com sinal (' + (ped && ped.id) + ', entrada ' + (ped && ped.entradaPaga) + ')');
    // venda da pronta entrega
    T.pilhaVerde(30, 4, 0);
    Math.random = () => 0.9;   // não pede desconto (pechincha < 0.9)
    const c2 = PT.balcao.novoCliente(); c2.produto = 'TP40'; c2.comprimento = 4; c2.pecas = 10; c2.tipo = 'chacara'; Math.random = rnd;
    for (let i = 0; i < 400; i++) PT.balcao.atualizar(0.1);
    const cx0 = PT.eco.st.caixa; Math.random = () => 0.9; T.fazer(/^Atender/);
    document.querySelector('#balcao [data-b="vender"]').click(); Math.random = rnd;
    const restante = PT.ent.naZona('expedicao', o => o.tipo === 'pilha').reduce((a, o) => a + o.qtd, 0);
    ok(PT.eco.st.caixa > cx0 && restante === 20, 'Z6 pronta entrega: pagou ' + Math.round(PT.eco.st.caixa - cx0) + ' e saíram 10 telhas da zona verde (sobrou ' + restante + ')');
    // escambo com galinha
    const c3 = PT.balcao.novoCliente(); c3.tipo = 'escambo'; c3.nome = 'Seu Lauro do sítio'; c3.produto = 'TP40'; c3.comprimento = 4; c3.pecas = 5;
    for (let i = 0; i < 400; i++) PT.balcao.atualizar(0.1);
    T.fazer(/^Atender/); document.querySelector('#balcao [data-b="galinha"]').click();
    ok(PT.ent.lista.some(o => o.item === 'galinha'), 'Z7 aceitar a galinha do Seu Lauro coloca uma galinha na loja');
    // paciência acaba
    const c4 = PT.balcao.novoCliente(); for (let i = 0; i < 400; i++) PT.balcao.atualizar(0.1);
    const perd0 = PT.balcao.st.perdidos; T.min(Math.ceil(c4.pacienciaMax) + 2);
    ok(PT.balcao.st.perdidos === perd0 + 1 && c4.estado === 'saindo', 'Z8 cliente ignorado vai embora reclamando');
    // café aumenta paciência
    PT.ent.add({ tipo: 'decor', item: 'garrafa_cafe', modelo: 'garrafa_cafe', rotulo: 'Café', x: L.x0 + 1, z: L.z1 - 1, solido: true });
    const c5 = PT.balcao.novoCliente();
    ok(Math.abs(c5.pacienciaMax - PT.DADOS.balcao.pacienciaMin * 1.3) < 1e-6, 'Z9 com cafezinho na loja o cliente tem 30% mais paciência');
    // decoração pode ser instalada dentro da loja
    const v = PT.construcao.validar({ x: L.x1 - 1.2, z: L.z1 - 1, dims: [2, 0.4, 1.8], rot: 0, decor: true });
    ok(v.cor !== 'vermelho', 'Z10 dá para instalar o mostruário dentro da loja (' + v.motivo + ')');
    // PC abre e fecha
    PT.ui.cancelarInteracoes(); PT.pc.abrir(); const aberto = PT.pc.aberto && PT.ui.modalAberto();
    PT.pc.abrirApp('loja'); PT.pc.abrirApp('banco'); const nj = PT.pc.janelas.length; PT.pc.fechar();
    ok(aberto && nj === 2 && !PT.ui.modalAberto(), 'Z11 ParecisOS abre, abre 2 janelas e fecha devolvendo o controle');
    return out;
  });
  console.log(r.join('\n'));
  console.log('ERROS:\n' + erros.join('\n'));
  await b.close();
})();
