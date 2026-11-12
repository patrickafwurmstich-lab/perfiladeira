const { chromium } = require('playwright');
const H = require('./helpers.js');
const THREE_FILE = (process.env.THREE_JS || require('path').join(__dirname, 'three.min.js'));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const erros = [];
  p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message + ' ' + (e.stack||'').split('\n')[1]));
  await p.route('**/three.min.js', r => r.fulfill({ path: THREE_FILE, contentType: 'application/javascript' }));
  await p.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x','1'); } } catch(e){} });
  await p.goto('http://localhost:8765/demo1/index.html'); await p.waitForTimeout(1200);
  await H.setup(p);
  const r = await p.evaluate(() => {
    const out = []; const ok = (c, msg) => out.push((c ? 'PASSOU ' : 'FALHOU ') + msg);
    const drive = (t, n) => { for (let i = 0; i < n; i++) { PT.empi.controle.controlar(0.05, t); PT.zoeira.atualizar(0.05); } };
    // compra e entrega
    PT.eco.lancar(50000, 'teste'); const rc = PT.loja.comprar('empilhadeira_eletrica', 'vista'); PT.loja.comprar('mandril', 'vista');
    T.min(40); T.frames(200, 0.1); PT.entrega.st.caminhoes.forEach(c => { c.carroceria.forEach(o => PT.ent.remover(o)); PT.entrega.partir(c); }); T.frames(300, 0.1);
    PT.tempo.pularNoite(); PT.tempo.pularNoite(); PT.tempo.pularNoite(); T.min(140); for (let k = 0; k < 6; k++) { T.frames(300, 0.1); T.min(2); }
    let e = PT.ent.lista.find(o => o.tipo === 'empilhadeira');
    ok(rc.ok && !!e, 'V1 empilhadeira comprada chega pela rampa na zona amarela');
    if (!e) return out;
    PT.entrega.st.caminhoes.forEach(c => PT.entrega.partir(c)); T.frames(300, 0.1);
    // pegar uma pilha
    e.x = 60; e.z = 25; e.rot = 0; PT.ent.sync(e);
    const pl = PT.estoque.novaPilha('TP40', 3, 63.5, 25); PT.estoque.addNaPilha(pl, 20, 0);
    PT.empi.entrar(e); PT.empi.pegarOuSoltar();
    ok(e.carga === pl, 'V2 pega a pilha com o garfo baixo');
    drive({ KeyR: true }, 20); drive({ KeyW: true }, 30);
    ok(e.x > 62 && Math.abs(pl.x - (e.x + 1.7 + 1)) < 0.6, 'V3 anda com a carga no garfo (x ' + e.x.toFixed(1) + ')');
    // tentar soltar com garfo alto
    PT.empi.pegarOuSoltar(); ok(e.carga === pl, 'V4 não solta com o garfo alto');
    drive({ KeyF: true }, 40); drive({}, 30); PT.empi.pegarOuSoltar(); ok(!e.carga && !pl.preso, 'V5 solta com o garfo baixo');
    // curva rápida com garfo BAIXO e sem carga: não tomba
    e.cinto = false; e.garfoY = 0; e.x = 60; e.z = 25; e.rot = 0; PT.ent.sync(e); drive({ KeyW: true }, 40); drive({ KeyW: true, KeyA: true }, 40);
    ok(e.tombada === 0, 'V5b curva rápida com garfo baixo e sem carga NÃO tomba (risco ' + (e.risco || 0).toFixed(2) + ')');
    // tombar SEM cinto: garfo alto, rápido, curva
    e.cinto = false; drive({ KeyS: true }, 20); drive({}, 30); e.x = 60; e.z = 25; e.rot = 0; PT.ent.sync(e);
    drive({ KeyR: true }, 60); drive({ KeyW: true }, 30); drive({ KeyW: true, KeyA: true }, 30);
    ok(e.tombada > 0, 'V6 curva rápida com garfo alto TOMBA (risco ' + (e.risco || 0).toFixed(2) + ')');
    ok(PT.mundo.jog.morto === true && PT.mundo.jog.controlando === null, 'V7 sem cinto: arremessado pela lateral');
    drive({}, 60); ok(!PT.mundo.jog.morto && PT.zoeira.st.diasSem === 0, 'V8 levanta sozinho (sem hospital) e a placa zera');
    // desvirar
    T.ir(e.x, e.z + 1.8); let r1 = T.fazer(/Desvirar/); T.min(31); ok(e.tombada === 0, 'V9 desvirar leva 30 min de jogo (' + r1 + ')');
    // tombar COM cinto
    PT.ui.cancelarInteracoes(); PT.empi.entrar(e); PT.ev.emit('tecla', 'KeyC'); e.garfoY = 3; e.x = 60; e.z = 25; e.rot = 0; PT.ent.sync(e);
    drive({ KeyW: true }, 30); drive({ KeyW: true, KeyD: true }, 30);
    ok(PT.mundo.jog.controlando === null && PT.mundo.jog.y === 0, 'V10b depois de tombar o jogador não volta para o banco');
    ok(e.tombada > 0 && !PT.mundo.jog.morto, 'V10 com cinto: tomba mas o personagem não é arremessado (tomb ' + e.tombada + ' cinto ' + e.cinto + ' morto ' + PT.mundo.jog.morto + ' risco ' + (e.risco||0).toFixed(1) + ' ctrl ' + !!PT.mundo.jog.controlando + ')');
    e.tombada = 0; PT.empi.atualizarVisual(e);
    // bobina sem mandril
    const bo = PT.estoque.novaBobina('GL043-1T', 70, 30, 0); e.x = 67.5; e.z = 30; e.rot = 0; e.garfoY = 0; PT.ent.sync(e);
    PT.empi.entrar(e); PT.empi.pegarOuSoltar();
    ok(!e.carga && Math.abs(bo.x - 70) > 0.5, 'V11 bobina sem mandril escorrega e rola (x ' + bo.x.toFixed(1) + ')');
    PT.empi.sair();
    // instalar mandril
    const md = PT.ent.lista.find(o => o.item === 'mandril'); md.x = e.x; md.z = e.z + 2; PT.ent.sync(md);
    T.ir(e.x, e.z + 1.5); T.fazer(/^Pegar Mandril/); const r2 = T.fazer(/Instalar o MANDRIL/);
    ok(e.acessorio === 'mandril', 'V12 instala o mandril (' + r2 + ')');
    e.x = bo.x - 2.5; e.z = bo.z; e.rot = 0; PT.ent.sync(e); PT.empi.entrar(e); PT.empi.pegarOuSoltar();
    ok(e.carga === bo, 'V13 com mandril pega a bobina');
    PT.empi.pegarOuSoltar(); PT.empi.sair();
    // entrar cancela a recarga
    e.carregando = true; PT.empi.entrar(e); ok(e.carregando === false, 'V13b subir na empilhadeira desliga o carregador'); PT.empi.sair();
    // save com empilhadeira
    PT.ui.fecharModal();
    const sv = PT.save.salvar(); ok(sv, 'V14 salva com a empilhadeira no chão (motivo: ' + PT.save.estavel() + ')');
    return out;
  });
  console.log(r.join('\n'));
  await p.evaluate(() => PT.save.pedirCarregar()); await p.waitForTimeout(2000);
  const v = await p.evaluate(() => { const e = PT.ent.lista.find(o => o.tipo === 'empilhadeira'); return e ? e.acessorio + ' ' + e.bateria.toFixed(2) : 'nenhuma'; });
  console.log((/mandril/.test(v) ? 'PASSOU' : 'FALHOU') + ' V15 load restaura a empilhadeira com mandril (' + v + ')');
  console.log('ERROS:\n' + erros.join('\n'));
  await b.close();
})();
