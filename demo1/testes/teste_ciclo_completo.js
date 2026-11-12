const { chromium } = require('playwright');
const THREE_FILE = (process.env.THREE_JS || require('path').join(__dirname, 'three.min.js'));
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const erros = [];
  p.on('console', m => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  p.on('pageerror', e => erros.push('PAGEERROR: ' + e.message + ' ' + (e.stack||'').split('\n')[1]));
  await p.route('**/three.min.js', r => r.fulfill({ path: THREE_FILE, contentType: 'application/javascript' }));
  await p.addInitScript(() => { try { if (!sessionStorage.getItem('x')) { localStorage.clear(); sessionStorage.setItem('x','1'); } } catch(e){} });
  await p.goto('http://localhost:8765/demo1/index.html');
  await p.waitForTimeout(1500);
  const log = async (fn, arg) => { const r = await p.evaluate(fn, arg); if (r) console.log(r); };
  // helpers no navegador
  await p.evaluate(() => {
    window.T = {
      min(n) { for (let i = 0; i < n; i++) { PT.tempo.st.acum = 1.2000001; PT.tempo.atualizar(0); PT.entrega.atualizar(0.05); } },
      frames(n, dt) { for (let i = 0; i < n; i++) { PT.ponte.atualizar(dt || 0.05); PT.estoque.atualizar(); PT.entrega.atualizar(dt || 0.05); PT.construcao.atualizar(); } },
      ir(x, z) { const j = PT.mundo.jog; j.x = x; j.z = z; PT.estoque.atualizar(); },
      fazer(re) { const ops = PT.inter.calcular(); const o = ops.find(o => re.test(o.rotulo)); if (!o) return 'SEM OPÇÃO ' + re + ' | tem: ' + ops.map(o => o.rotulo).join(' / '); o.acao(); return 'ok: ' + o.rotulo; },
      ponteEngatar(o) { PT.ui.cancelarInteracoes();
        const P = PT.ponte.st; P.x = o.x; P.z = o.z; P.y = o.y + o.g.userData.altura + 0.3; T.frames(2);
        PT.mundo.jog.controlando = PT.ponte.controle; PT.ev.emit('tecla', 'Space'); return P.carga ? 'engatou ' + (P.carga.item || P.carga.codigo) : 'nao engatou';
      },
      ponteLevar(x, z, alt) { const P = PT.ponte.st; P.y = Math.max(P.y, alt || 4); T.frames(2); P.x = x; P.z = z; T.frames(2); },
      ponteBaixarSoltar() { const P = PT.ponte.st; P.y = P.carga ? P.carga.g.userData.altura * (P.carga.tipo === 'bobina' ? P.carga.g.userData.mesh.scale.x : 1) + 0.02 : 1; T.frames(2); PT.ev.emit('tecla', 'Space'); T.frames(30); PT.mundo.jog.controlando = null; }
    };
  });
  // 1) chegada do caminhão do kit
  await log(() => { PT.tempo.st.velIdx = 0; T.min(40); T.frames(200, 0.1); return '1) ' + PT.tempo.rotulo() + ' caminhão: ' + PT.entrega.st.caminhoes.map(c => c.estado).join(); });
  // 2) ponte tira a perfiladeira
  await log(() => { const v = PT.ent.lista.find(o => o.item === 'perf_tp40_usada'); const r = T.ponteEngatar(v); T.ponteLevar(50, 26); T.ponteBaixarSoltar(); return '2) ' + r + ' → engradado em ' + v.x.toFixed(1) + ',' + v.z.toFixed(1) + ' y=' + v.y.toFixed(2); });
  // 3) instalar (minijogo de nivelamento: aperta espaço)
  await log(() => { const v = PT.ent.lista.find(o => o.item === 'perf_tp40_usada'); T.ir(v.x, v.z + 2.2); return '3) ' + T.fazer(/Abrir engradado/); });
  await log(() => { const a = PT.construcao.ativo; a.x = 50; a.z = 26; PT.construcao.atualizar(); return '   fantasma: ' + a.cor + ' — ' + a.motivo; });
  await p.evaluate(() => PT.ev.emit('tecla', 'Enter'));
  await p.waitForTimeout(700); await p.keyboard.press('Space'); await p.waitForTimeout(600);
  await log(() => { const m = PT.maq.lista[0]; return '   instalada: ' + (m ? m.nome + ' estado=' + m.estado + ' nivel=' + m.nivelamento.toFixed(2) : 'NÃO'); });
  // 4) cabo
  await log(() => { const m = PT.maq.lista[0]; const c = PT.maq.pontoEntrada(m); T.ir(m.x, m.z + 2.0); return '4) ' + T.fazer(/Puxar cabo/) + ' → ' + m.estado; });
  // 5) bobina para o desbobinador
  await log(() => { const bo = PT.ent.lista.find(o => o.tipo === 'bobina'); const r = T.ponteEngatar(bo); const m = PT.maq.lista[0]; const e = PT.maq.pontoEntrada(m); T.ponteLevar(e.x, e.z); T.ponteBaixarSoltar(); T.frames(5); return '5) ' + r + ' montada? ' + !!m.bobina + ' estado=' + m.estado + ' | caminhão: ' + PT.entrega.st.caminhoes.map(c => c.estado).join(); });
  // 6) CLP
  await log(() => { const m = PT.maq.lista[0]; PT.maq.ligar(m, true); PT.maq.alinhar(m, 0.95); Object.assign(m.cfg, { comprimento: 4, quantidade: 30 }); const ok = PT.maq.iniciar(m); T.min(30); const pl = m.mesa; return '6) iniciou=' + ok + ' estado=' + m.estado + ' produzidas=' + m.produzidas + ' pilha=' + (pl ? pl.qtd + ' (tortas ' + pl.defeituosas + ')' : '-') + ' bobina=' + (m.bobina ? m.bobina.metros.toFixed(1) + 'm' : '-') + ' energiaMes=' + PT.eco.st.energiaKWhMes.toFixed(1) + 'kWh'; });
  await log(() => { T.min(30); const m = PT.maq.lista[0]; return '   +30min estado=' + m.estado + ' produzidas=' + m.produzidas + ' pilha=' + (m.mesa ? m.mesa.qtd : '-'); });
  // 7) paleteira: está como caixa pequena na zona amarela → pegar, instalar
  await log(() => { const v = PT.ent.lista.find(o => o.item === 'paleteira'); T.ir(v.x + 1, v.z); let r = T.fazer(/Pegar Paleteira/i); r += ' | ' + T.fazer(/Abrir e instalar/); const a = PT.construcao.ativo; a.x = 30; a.z = 26; PT.construcao.atualizar(); PT.ev.emit('tecla', 'Enter'); const pal = PT.ent.lista.find(o => o.tipo === 'paleteira'); return '7) ' + r + ' → paleteira ' + (pal ? 'no chão em ' + pal.x + ',' + pal.z : 'NÃO'); });
  // 8) pegar paleteira, buscar pilha, levar à zona verde
  await log(() => {
    const pal = PT.ent.lista.find(o => o.tipo === 'paleteira'); T.ir(pal.x + 1.2, pal.z); let r = T.fazer(/Pegar a paleteira/);
    const m = PT.maq.lista[0]; const pl = m.mesa;
    // posiciona o jogador olhando para a pilha, a ~1,6 m dela
    const j = PT.mundo.jog; j.x = pl.x - 1.6; j.z = pl.z; j.rot = Math.PI / 2; PT.estoque.atualizar();
    r += ' | ' + T.fazer(/Erguer/);
    j.x = 110; j.z = 13; j.rot = Math.PI / 2; PT.estoque.atualizar();
    r += ' | ' + T.fazer(/Baixar a carga/);
    r += ' | ' + T.fazer(/Largar a paleteira/);
    const naZona = PT.ent.naZona('expedicao', o => o.tipo === 'pilha');
    return '8) ' + r + ' → pilhas na zona verde: ' + naZona.map(o => o.qtd).join(',');
  });
  // 9) pedido e coleta
  await log(() => {
    const ped = PT.pedidos.gerar(); ped.produto = 'TP40'; ped.comprimento = 4; ped.pecas = 15; ped.qtdUnid = 60; ped.valor = 2700; ped.perfil = 'revenda';
    const caixa0 = PT.eco.st.caixa; PT.pedidos.aceitar(ped.id); PT.pedidos.chamarAgora(ped.id); T.min(3); T.frames(400, 0.1);
    let r = '9) entrada=' + (PT.eco.st.caixa - caixa0) + ' caminhão: ' + PT.entrega.st.caminhoes.map(c => c.e.tipo + ':' + c.estado + '@' + c.x.toFixed(0)).join() + ' status=' + ped.status;
    T.ir(115, 9); r += ' | ' + T.fazer(/Carregar PED/); T.min(2);
    r += ' → status=' + ped.status + ' entregues=' + PT.rep.st.entregues + ' receber=' + PT.eco.st.receber.map(x => x.valor + '@d' + x.dia).join();
    return r;
  });
  // 10) zoeira: bobina de 2 t
  await log(() => {
    const r0 = PT.loja.comprar('GL050-2T', 'vista'); PT.tempo.pularNoite(); PT.tempo.pularNoite(); T.min(150); T.frames(300, 0.1);
    const bo = PT.ent.lista.find(o => o.tipo === 'bobina' && o.spec === 'GL050-2T');
    if (!bo) return '10) bobina 2t não chegou: ' + r0.msg + ' fila=' + JSON.stringify(PT.entrega.st.fila) + ' cam=' + PT.entrega.st.caminhoes.length;
    let r = '10) ' + r0.msg + ' | ' + T.ponteEngatar(bo);
    PT.ponte.st.y += 2; T.frames(10);
    const j = PT.mundo.jog; j.x = bo.x + 0.5; j.z = bo.z;     // jogador embaixo da carga
    T.frames(80, 0.05);
    return r + ' → rompeu? cabos=' + PT.zoeira.st.cabosRompidos + ' mortes=' + PT.zoeira.st.mortes + ' cicatrizes=' + PT.zoeira.st.cicatrizes.length + ' placa=' + PT.zoeira.st.diasSem + ' morto=' + j.morto;
  });
  await p.evaluate(() => { for (let i = 0; i < 40; i++) PT.zoeira.atualizar(0.1); });
  await log(() => 'respawn: morto=' + PT.mundo.jog.morto + ' e-mails=' + PT.ui.salvarCorreio().map(m => m.assunto).slice(0, 2).join(' / '));
  await p.screenshot({ path: 's2.png' });
  // 11) save/load
  await log(() => { PT.mundo.jog.controlando = null; T.frames(400, 0.1); PT.ui.fecharModal(); const ok = PT.save.salvar(); return '11) salvou=' + ok + ' motivo=' + PT.save.estavel() + ' cam=' + PT.entrega.st.caminhoes.map(c => c.e.tipo + ':' + c.estado + ':' + c.carroceria.length + '@' + c.x.toFixed(0)).join() + ' caixa=' + Math.round(PT.eco.st.caixa) + ' maq=' + PT.maq.lista.length + ' ents=' + PT.ent.lista.length; });
  await p.evaluate(() => PT.save.pedirCarregar());
  await p.waitForTimeout(2500);
  await log(() => '   carregado: ' + PT.tempo.rotulo() + ' caixa=' + Math.round(PT.eco.st.caixa) + ' maq=' + PT.maq.lista.map(m => m.nome + ':' + m.estado + (m.bobina ? '+bob' : '') + (m.cabo ? '+cabo' : '')).join() + ' ents=' + PT.ent.lista.length + ' entregues=' + PT.rep.st.entregues + ' cicatrizes=' + PT.zoeira.st.cicatrizes.length);
  await p.screenshot({ path: 's3.png' });
  console.log('ERROS:\n' + erros.slice(0, 20).join('\n'));
  await b.close();
})();
