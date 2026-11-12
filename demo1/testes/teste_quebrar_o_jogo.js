const { chromium } = require('playwright');
const H = require('./helpers.js');
const THREE_FILE = (process.env.THREE_JS || require('path').join(__dirname, 'three.min.js')) + '';
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const erros = [];
  p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message + ' ' + (e.stack||'').split('\n')[1]));
  p.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  await p.route('**/three.min.js', r => r.fulfill({ path: THREE_FILE, contentType: 'application/javascript' }));
  await p.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x','1'); } } catch(e){} });
  await p.goto('http://localhost:8765/demo1/index.html'); await p.waitForTimeout(1200);
  await H.setup(p);
  const r = await p.evaluate(() => {
    const out = []; const ok = (c, msg) => out.push((c ? 'PASSOU ' : 'FALHOU ') + msg);
    // tira o caminhão do kit do caminho
    T.min(40); T.frames(200, 0.1); PT.entrega.st.caminhoes.forEach(c => { c.carroceria.forEach(o => PT.ent.remover(o)); PT.entrega.partir(c); }); T.frames(300, 0.1);
    // A) coleta parcial com timeout → entrega parcial
    let pl = T.pilhaVerde(10, 4); const ped = T.pedido(30, 4, 'revenda'); PT.pedidos.aceitar(ped.id);
    const caixa0 = PT.eco.st.caixa; let c = T.coletaChegar(ped.id);
    ok(c && ped.status === 'coleta', 'A1 caminhão da coleta chegou (status ' + ped.status + ', caminhoes ' + PT.entrega.st.caminhoes.map(x => x.e.tipo + ':' + x.estado + '@' + x.x.toFixed(0)).join() + ', fila ' + PT.entrega.st.fila.length + ')');
    T.ir(115, 9); T.fazer(/Carregar PED/);
    ok(ped.carregadas === 10, 'A2 carregou 10 de 30 (' + ped.carregadas + ')');
    T.min(PT.DADOS.pedidos.janelaColetaHoras * 60 + 5);
    const sub = PT.pedidos.st.lista.find(x => x.id === ped.id + '-B');
    ok(ped.status === 'entregue' && ped.pecas === 10, 'A3 entrega parcial concluída com 10 peças (status ' + ped.status + ')');
    ok(sub && sub.pecas === 20 && sub.status === 'aceito', 'A4 sub-pedido de 20 criado para amanhã');
    ok(sub && Math.abs(ped.valor + sub.valor - 30 * 4 * 45) < 2, 'A5 valores somam o total (' + ped.valor + ' + ' + (sub && sub.valor) + ')');
    ok(sub && PT.entrega.st.fila.some(e => e.pedidoId === sub.id), 'A6 coleta do sub-pedido agendada');
    T.frames(300, 0.1);
    // B) modo devolver
    PT.DADOS.pedidos.cargaParcial = 'devolver';
    pl = T.pilhaVerde(8, 5); const ped2 = T.pedido(20, 5, 'revenda'); PT.pedidos.aceitar(ped2.id); c = T.coletaChegar(ped2.id);
    T.ir(115, 9); T.fazer(/Carregar PED/); const naVerde0 = PT.ent.naZona('expedicao', o => o.tipo === 'pilha' && o.comprimento === 5).reduce((a, o) => a + o.qtd, 0);
    T.min(PT.DADOS.pedidos.janelaColetaHoras * 60 + 5);
    const naVerde1 = PT.ent.naZona('expedicao', o => o.tipo === 'pilha' && o.comprimento === 5).reduce((a, o) => a + o.qtd, 0);
    ok(ped2.carregadas === 0 && naVerde1 === 8 && ped2.status === 'aceito', 'B1 modo devolver: 8 telhas voltaram para a zona verde (antes ' + naVerde0 + ', depois ' + naVerde1 + ')');
    PT.DADOS.pedidos.cargaParcial = 'entregaParcial'; T.frames(300, 0.1);
    // C) save com caminhão no pátio
    const ped3 = T.pedido(5, 4); PT.pedidos.aceitar(ped3.id); T.coletaChegar(ped3.id);
    ok(PT.save.salvar() === false, 'C1 save bloqueado com caminhão no pátio');
    // D) validações de dinheiro
    const cx = PT.eco.st.caixa;
    ok(PT.eco.pagar(-1000, 'x') === false && PT.eco.st.caixa === cx, 'D1 pagar valor negativo não gera dinheiro');
    ok(PT.eco.comprarFiname(-5, 'x').ok === false, 'D2 FINAME com valor negativo recusado');
    ok(PT.pedidos.aceitar('PED-999', -3) === false, 'D3 aceitar com ajuste inválido recusado');
    // E/F) FINAME, vencimento real e mensal no dia 30
    PT.rep.st.entregues = 12;
    const rf = PT.loja.comprar('dobradeira_compacta', 'finame');
    ok(rf.ok, 'F1 FINAME liberado na faixa 1: ' + rf.msg);
    const f = PT.eco.st.financiamentos[0];
    const prev = PT.eco.previsao(30) , prev29 = PT.eco.previsao(f.proximoVencimento - PT.tempo.st.dia - 1);
    ok(f && f.proximoVencimento === PT.tempo.st.dia + 30, 'F2 1ª parcela vence em 30 dias (dia ' + (f && f.proximoVencimento) + ')');
    const dia0 = PT.tempo.st.dia; let viuContador = null, viuParcela = null;
    for (let i = 0; i < 32; i++) { PT.tempo.pularNoite(); const ex = PT.eco.st.extrato; if (!viuContador && ex.some(x => /Contador/.test(x.desc))) viuContador = PT.tempo.st.dia; if (!viuParcela && ex.some(x => /Parcela FINAME/.test(x.desc))) viuParcela = PT.tempo.st.dia; }
    ok(viuContador === 30, 'E1 custos fixos cobrados no dia 30 (cobrou no dia ' + viuContador + ')');
    ok(viuParcela === f.proximoVencimento - 30 + 30 || viuParcela === dia0 + 30, 'F3 parcela FINAME cobrada no vencimento (dia ' + viuParcela + ')');
    // H) tirar a bobina com a ponte no meio da produção
    const m = T.fabrica(); m.cfg.comprimento = 4; m.cfg.quantidade = 200; PT.maq.iniciar(m); T.min(3);
    const bo = m.bobina; const P = PT.ponte.st; P.x = bo.x; P.z = bo.z; P.y = bo.y + bo.g.userData.altura + 0.2; T.frames(2);
    PT.mundo.jog.controlando = PT.ponte.controle; PT.ev.emit('tecla', 'Space'); T.frames(2);
    ok(P.carga === bo && !m.bobina && m.estado !== 'produzindo', 'H1 tirar a bobina no meio da produção para a máquina (' + m.estado + ')');
    P.y = 6; T.frames(2); P.x = 70; T.frames(2); P.y = bo.g.userData.altura * bo.g.userData.mesh.scale.x + 0.02; T.frames(2); PT.ev.emit('tecla', 'Space'); T.frames(30); PT.mundo.jog.controlando = null;
    // I) mover máquina depois que a paleteira levou a pilha
    PT.maq.ligar(m, false); const pilha = m.mesa; pilha.x = 110; pilha.z = 13; PT.ent.sync(pilha);
    PT.maq.desinstalar(m); ok(!!PT.construcao.ativo, 'I1 pode mover a máquina depois que a pilha saiu da mesa');
    PT.construcao.cancelar();
    // J) morrer carregando a paleteira com carga
    const pal = PT.ent.add({ tipo: 'paleteira', modelo: 'paleteira', x: 60, z: 30, solido: false }); const pl2 = PT.estoque.novaPilha('TP40', 3, 62, 30); PT.estoque.addNaPilha(pl2, 5, 0);
    const j = PT.mundo.jog; j.carregando = { tipo: 'paleteira', ent: pal, carga: pl2, lento: 0.5 }; pal.preso = 'jogador'; pl2.preso = 'paleteira';
    PT.zoeira.morrer('geral', null);
    ok(!j.carregando && !pal.preso && !pl2.preso, 'J1 morrer solta a paleteira e a carga');
    for (let i = 0; i < 40; i++) PT.zoeira.atualizar(0.1);
    ok(!j.morto, 'J2 respawn');
    // K) cancelamento por atraso: estorno + multa
    const ped4 = T.pedido(5, 4, 'revenda'); PT.pedidos.aceitar(ped4.id); const ent = ped4.entradaPaga; const cx4 = PT.eco.st.caixa;
    ped4.prazoDia = PT.tempo.st.dia - 4; PT.entrega.st.fila = PT.entrega.st.fila.filter(e => e.pedidoId !== ped4.id); PT.tempo.pularNoite();
    ok(ped4.status === 'cancelado' && Math.abs((cx4 - PT.eco.st.caixa) - (ent + Math.round(ped4.valor * 0.05))) < 2, 'K1 cancelamento devolve entrada + multa 5% (' + Math.round(cx4 - PT.eco.st.caixa) + ')');
    // L) chamar agora sem agendamento
    ok(PT.pedidos.chamarAgora(ped4.id) === false, 'L1 chamar agora em pedido cancelado retorna falso');
    return out;
  });
  console.log(r.join('\n'));
  // G) importar save inválido
  await p.evaluate(() => { localStorage.setItem('parecis_demo1_carregar', '{"save_version":1,"tempo":{}}'); location.reload(); });
  await p.waitForTimeout(2000);
  const g = await p.evaluate(() => !!window.__PT_OK && !localStorage.getItem('parecis_demo1_carregar'));
  console.log((g ? 'PASSOU ' : 'FALHOU ') + 'G1 save inválido não derruba o jogo e não fica preso em loop');
  console.log('ERROS:\n' + erros.slice(0, 20).join('\n'));
  await b.close();
})();
