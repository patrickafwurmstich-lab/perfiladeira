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
    const rodar = (seg) => { for (let i = 0; i < seg * 10; i++) { PT.func.atualizar(0.1); PT.tempo.st.acum += 0.1; PT.tempo.atualizar(0); PT.entrega.atualizar(0.1); } };
    T.min(40); T.frames(200, 0.1); PT.entrega.st.caminhoes.forEach(c => { c.carroceria.forEach(o => PT.ent.remover(o)); PT.entrega.partir(c); }); T.frames(300, 0.1);
    PT.func.gerarCandidatos();
    let r0 = PT.func.contratar(PT.func.st.candidatos[0].id);
    ok(!r0.ok && /ARMÁRIOS/.test(r0.msg), 'X1 sem armário não contrata: ' + r0.msg);
    for (let i = 0; i < 2; i++) PT.ent.add({ tipo: 'decor', item: 'armario', modelo: 'armario', rotulo: 'Armário', x: 2 + i * 0.8, z: 30, solido: true });
    ok(PT.func.vagas() === 2, 'X2 dois armários = 2 vagas');
    // candidatos fixos para o teste
    PT.func.st.candidatos = [
      { id: 'c1', nome: 'Cleiton Souza', cargo: 'operador', atributos: { competencia: 0.9, seguranca: 0.8, ritmo: 0.9 }, personalidade: 'caprichoso', salario: 2500, certificados: ['perfiladeira'], fala: 'oi' },
      { id: 'c2', nome: 'Júnior Silva', cargo: 'ajudante', atributos: { competencia: 0.6, seguranca: 0.6, ritmo: 0.9 }, personalidade: 'apressado', salario: 1900, certificados: [], fala: 'oi' },
      { id: 'c3', nome: 'Tião Pereira', cargo: 'ajudante', atributos: { competencia: 0.6, seguranca: 0.6, ritmo: 0.6 }, personalidade: 'prestativo', salario: 1900, certificados: [], fala: 'oi' }];
    ok(PT.func.contratar('c1').ok && PT.func.contratar('c2').ok && !PT.func.contratar('c3').ok, 'X3 contrata 2 e o 3º é barrado pelas vagas');
    // fábrica com lote automático
    const m = T.fabrica(); Object.assign(m.cfg, { comprimento: 3, quantidade: 25 }); m.autoLote = true; m.alinhado = false; PT.maq.atualizarEstado(m);
    PT.tempo.st.velIdx = 2;  // x20
    const rnd = Math.random; Math.random = () => 0.3;       // sem enrosco; ajudante apressado vai esconder tortas
    rodar(40);
    const op = PT.func.st.lista[0];
    ok(m.produzidas > 0 || m.estado === 'produzindo' || m.estado === 'concluida', 'X4 operador alinha e dá START sozinho (estado ' + m.estado + ', produzidas ' + m.produzidas + ', alinh ' + Math.round(m.alinhamento * 100) + '%)');
    rodar(160);
    const naVerde = PT.ent.naZona('expedicao', o => o.tipo === 'pilha');
    ok(naVerde.length > 0, 'X5 ajudante leva a pilha da mesa até a zona verde (' + naVerde.map(o => o.qtd).join(',') + ')');
    const esc = naVerde.find(o => o.tortasEscondidas);
    ok(!!esc || naVerde.every(o => o.defeituosas === 0), 'X6 ajudante apressado esconde as tortas no meio da pilha (' + (esc ? esc.defeituosas + ' escondidas' : 'sem tortas') + ')');
    if (esc) { T.ir(esc.x, esc.z + 1.5); const rr = T.fazer(/Inspecionar o lote/); ok(/^ok/.test(rr) && !esc.tortasEscondidas, 'X7 inspecionar o lote revela as tortas'); }
    Math.random = rnd;
    // orientar
    const aj = PT.func.st.lista[1]; T.ir(aj.x, aj.z + 0.6); const ro = T.fazer(/Orientar/); ok(/^ok/.test(ro) && aj.orientadoAte > 0, 'X8 orientar o funcionário (' + ro + ' | vis ' + aj.g.visible + ' j ' + PT.mundo.jog.x.toFixed(1) + ',' + PT.mundo.jog.z.toFixed(1) + ' aj ' + aj.x.toFixed(1) + ',' + aj.z.toFixed(1) + ' carreg ' + !!PT.mundo.jog.carregando + ' ctrl ' + !!PT.mundo.jog.controlando + ')');
    // prioridade
    PT.func.st.prioridade.expedicao = 'baixa'; ok(PT.func.st.prioridade.expedicao === 'baixa', 'X9 prioridade por setor muda');
    // folha: dia 15 com dinheiro; dia 30 sem dinheiro = tartaruga
    while (PT.tempo.st.dia < 14) PT.tempo.pularNoite();
    const cx = PT.eco.st.caixa; PT.tempo.pularNoite();
    ok(PT.eco.st.extrato.some(x => /Folha quinzenal/.test(x.desc)), 'X10 folha quinzenal paga no dia 15 (' + Math.round(cx - PT.eco.st.caixa) + ')');
    PT.eco.st.caixa = -4900; PT.eco.st.cheque = 5000;
    while (PT.tempo.st.dia < 30) PT.tempo.pularNoite();
    ok(PT.func.st.tartaruga > 0, 'X11 sem dinheiro no dia 30 = OPERAÇÃO TARTARUGA');
    rodar(5); ok(PT.func.st.lista.every(f => f.estado === 'tartaruga'), 'X12 equipe de braços cruzados na cafeteira');
    PT.eco.st.caixa = 50000; ok(PT.func.pagarAtrasado() && PT.func.st.tartaruga === 0, 'X13 pagar a folha atrasada + multa encerra a greve');
    // curso
    const rc = PT.func.treinar(aj.id, 'perfiladeira'); ok(rc.ok && aj.certificados.includes('perfiladeira') && aj.ausenteAte > 0, 'X14 curso na Escola Técnica Parecis: ' + rc.msg);
    PT.ui.cancelarInteracoes(); PT.func.st.lista.forEach(f => { if (f.carregando) { PT.estoque.soltarNoChao(f.carregando, f.carregando.x, f.carregando.z); f.carregando = null; } });
    PT.ent.lista.filter(o => o.tipo === 'empilhadeira').forEach(o => o.carga = null);
    const sv = PT.save.salvar(); ok(sv, 'X15 salva com a equipe (motivo: ' + PT.save.estavel() + ')');
    return out;
  });
  console.log(r.join('\n'));
  await p.evaluate(() => PT.save.pedirCarregar()); await p.waitForTimeout(2000);
  const v = await p.evaluate(() => PT.func.st.lista.map(f => f.nome + ':' + f.certificados.join('/')).join(', '));
  console.log((/Cleiton/.test(v) && /Júnior/.test(v) ? 'PASSOU' : 'FALHOU') + ' X16 load restaura a equipe (' + v + ')');
  console.log('ERROS:\n' + erros.join('\n'));
  await b.close();
})();
