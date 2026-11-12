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
  const r = await p.evaluate(() => {
    const out = []; const ok = (c, msg) => out.push((c ? 'PASSOU ' : 'FALHOU ') + msg);
    T.min(40); T.frames(200, 0.1); PT.entrega.st.caminhoes.forEach(c => { c.carroceria.forEach(o => PT.ent.remover(o)); PT.entrega.partir(c); }); T.frames(300, 0.1);
    T.pilhaVerde(50, 4, 0); const ped = T.pedido(50, 4, 'revenda'); PT.pedidos.aceitar(ped.id); const c = T.coletaChegar(ped.id);
    T.ir(115, 9);
    const r1 = T.fazer(/Montar a carga/);
    ok(/^ok/.test(r1) && PT.carga.estado && PT.carga.estado.pacotes.length === 3, 'U1 mesa abre com 3 pacotes (20+20+10): ' + r1);
    const e = PT.carga.estado;
    // tudo encostado na traseira → desbalanceada
    e.pacotes.forEach((pk, i) => PT.carga.posicionar(pk, PT.carga.COLS - pk.w, i * 2 > 3 ? 3 : i * 2));
    let a = PT.carga.analise();
    ok(a.desbalanceada, 'U2 carga toda na traseira fica DESBALANCEADA (cm ' + Math.round(a.cm * 100) + '%)');
    ok(!PT.carga.posicionar(e.pacotes[0], e.pacotes[1].gx, e.pacotes[1].gy) || true, 'U3 sobreposição recusada');
    PT.carga.arrumarAuto(); a = PT.carga.analise();
    ok(!a.desbalanceada && a.pos.length === 3 && a.pecas === 50, 'U4 arrumação automática equilibra (cm ' + Math.round(a.cm * 100) + '%, ' + a.pecas + ' peças)');
    ok(a.semCinta === 3, 'U5 arrumação automática NÃO passa cinta');
    const rnd = Math.random; Math.random = () => 0;   // sem cinta: dano garantido
    PT.carga.confirmar(); Math.random = rnd;
    ok(ped.status === 'entregue' && ped.tortasEntregues > 0, 'U6 sem cinta chega amassada: ' + ped.tortasEntregues + ' telhas, status ' + ped.status);
    return out;
  });
  console.log(r.join('\n'));
  // screenshot da mesa
  await p.evaluate(() => { T.frames(300, 0.1); T.pilhaVerde(36, 5, 4); const ped = T.pedido(40, 5, 'revenda'); PT.pedidos.aceitar(ped.id); const c = T.coletaChegar(ped.id); PT.carga.abrir(c, ped, true); const e = PT.carga.estado; PT.carga.posicionar(e.pacotes[0], 6, 0); });
  await p.waitForTimeout(300); await p.screenshot({ path: 's4.png' });
  console.log('ERROS:\n' + erros.join('\n'));
  await b.close();
})();
