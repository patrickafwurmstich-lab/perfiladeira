const { chromium } = require('playwright');
const H = require('./helpers.js');
const THREE_FILE = (process.env.THREE_JS || require('path').join(__dirname, 'three.min.js'));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const erros = [];
  p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message + ' ' + (e.stack||'').split('\n')[1]));
  await p.route('**/three.min.js', r => r.fulfill({ path: THREE_FILE, contentType: 'application/javascript' }));
  await p.addInitScript(() => { try { localStorage.clear(); } catch(e){} });
  await p.goto('http://localhost:8765/demo1/index.html'); await p.waitForTimeout(1200);
  await H.setup(p);
  const out = [];
  const ok = (c, msg) => out.push((c ? 'PASSOU ' : 'FALHOU ') + msg);
  // W1: morrer durante o progresso (remendo com cimento) não conclui nem gasta cimento
  await p.evaluate(() => { PT.estoque.st.inv.cimento = 1; PT.zoeira.cicatriz(40, 30, 1); T.ir(40, 31); T.fazer(/Remendar/); setTimeout(() => PT.zoeira.morrer('geral', null), 300); });
  await p.waitForTimeout(5000);
  let r = await p.evaluate(() => ({ cim: PT.estoque.st.inv.cimento, cic: PT.zoeira.st.cicatrizes.length, modal: PT.ui.modalAberto() }));
  ok(r.cim === 1 && r.cic >= 1 && !r.modal, 'W1 morrer no meio do remendo: não gasta cimento nem conserta (cimento ' + r.cim + ', cicatrizes ' + r.cic + ')');
  await p.evaluate(() => { for (let i = 0; i < 40; i++) PT.zoeira.atualizar(0.1); });
  // W2: morrer durante o minijogo não executa o callback
  await p.evaluate(() => { window.__cb = 0; PT.ui.minijogo({ titulo: 't', dica: 't', dificuldade: 0.5 }, () => window.__cb++); setTimeout(() => PT.zoeira.morrer('geral', null), 300); });
  await p.waitForTimeout(5000);
  r = await p.evaluate(() => window.__cb);
  ok(r === 0, 'W2 morrer durante o minijogo cancela o resultado (callbacks: ' + r + ')');
  await p.evaluate(() => { for (let i = 0; i < 40; i++) PT.zoeira.atualizar(0.1); });
  // W3: tecla repetida não dispara de novo
  r = await p.evaluate(() => { let n = 0; const f = c => { if (c === 'KeyQ') n++; }; PT.ev.on('tecla', f);
    window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ' })); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', repeat: true })); window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyQ', repeat: true }));
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'KeyQ' })); PT.ev.off('tecla', f); return n; });
  ok(r === 1, 'W3 segurar a tecla dispara a ação só uma vez (' + r + ')');
  // W4: blur limpa teclas
  r = await p.evaluate(() => { window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyW' })); window.dispatchEvent(new Event('blur')); return PT.mundo.teclas.KeyW; });
  ok(r === false, 'W4 perder o foco da janela solta as teclas');
  // W5: ligação fechada vira chamada perdida
  r = await p.evaluate(() => {
    PT.ui.cancelarInteracoes(); let ped; for (let i = 0; i < 30 && !ped; i++) { const x = PT.pedidos.gerar(); if (x.canal === 'telefone') ped = x; }
    const aberta = PT.ui.modalAberto(); PT.ui.fecharModal();
    const mail = PT.ui.salvarCorreio().find(m => m.pedidoId === ped.id && /Chamada perdida/.test(m.assunto));
    return { aberta, mail: !!mail, status: ped.status };
  });
  ok(r.aberta && r.mail && r.status === 'oferta', 'W5 ligação fechada sem responder vira "chamada perdida" no e-mail e o pedido continua em aberto');
  await p.evaluate(() => PT.ui.cancelarInteracoes());
  // W6: caminhão travado pelo corredor desiste e volta amanhã
  r = await p.evaluate(() => {
    T.min(40); T.frames(200, 0.1); PT.entrega.st.caminhoes.forEach(c => { c.carroceria.forEach(o => PT.ent.remover(o)); PT.entrega.partir(c); }); T.frames(300, 0.1);
    const obst = PT.ent.add({ tipo: 'decor', item: 'vaso_planta', modelo: 'vaso_planta', rotulo: 'Vaso', x: 3, z: 6, solido: true });
    PT.entrega.agendar(PT.tempo.st.dia, ['saco_cimento'], 'Teste', { hora: 0 }); T.min(2); T.frames(100, 0.1);
    const travado = PT.entrega.st.caminhoes.some(c => c.estado === 'chegando' && c.bloqueado);
    for (let i = 0; i < 95; i++) { T.min(1); T.frames(1, 0.05); }
    const sumiu = !PT.entrega.st.caminhoes.some(c => c.e.de === 'Teste'), reag = PT.entrega.st.fila.some(e => e.de === 'Teste' && e.dia === PT.tempo.st.dia + 1);
    PT.ent.remover(obst); return { travado, sumiu, reag };
  });
  ok(r.travado && r.sumiu && r.reag, 'W6 caminhão travado no corredor desiste depois de 90 min e volta amanhã (' + JSON.stringify(r) + ')');
  // W7: fornecedor esquecido leva a carga e volta
  r = await p.evaluate(() => {
    PT.entrega.st.fila = []; PT.entrega.agendar(PT.tempo.st.dia, ['GL043-1T'], 'Esquecido', { hora: 0 }); T.min(2); T.frames(300, 0.1);
    const c = PT.entrega.st.caminhoes.find(x => x.e.de === 'Esquecido'); const parado = c && c.estado === 'parado';
    for (let i = 0; i < 185; i++) T.min(1);
    T.frames(5, 0.05);
    const reag = PT.entrega.st.fila.find(e => e.de === 'Esquecido');
    const bobinasNoChao = PT.ent.lista.filter(o => o.tipo === 'bobina' && o.y > 1).length;
    return { parado, saiu: c && c.estado === 'saindo', reag: reag ? reag.itens.join() : null, bobinasNoChao };
  });
  ok(r.parado && r.saiu && r.reag === 'GL043-1T' && r.bobinasNoChao === 0, 'W7 fornecedor esquecido leva a bobina e volta amanhã sem cobrar de novo (' + JSON.stringify(r) + ')');
  // W8: coleta tem carga visual
  r = await p.evaluate(() => { T.frames(400, 0.1); PT.entrega.st.fila = []; T.pilhaVerde(10, 4); const ped = T.pedido(20, 4); PT.pedidos.aceitar(ped.id); const c = T.coletaChegar(ped.id); const n0 = c.g.children.length; T.ir(115, 9); T.fazer(/direto/); return c.g.children.length - n0; });
  ok(r > 0, 'W8 coleta mostra a carga na carroceria (' + r + ' volume(s) visuais)');
  // W9: debug escondido
  r = await p.evaluate(() => { PT.ui.abrirComputador(); document.querySelector('[data-aba="Sistema"]').click(); return !!document.querySelector('[data-acao="dinheiro"]'); });
  ok(r === false, 'W9 botão de dinheiro de teste escondido sem ?debug=1');
  console.log(out.join('\n'));
  console.log('ERROS:\n' + erros.join('\n'));
  await b.close();
})();
