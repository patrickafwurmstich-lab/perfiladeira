// =====================================================================
// carregamento.js — MESA DE CARREGAMENTO 2D ("Tetris prático").
// Vista de cima da carroceria (grade de 0,5 m). As peças do pedido que
// estão na zona verde viram PACOTES (até 20 peças). O jogador clica num
// pacote e clica na grade para posicionar. Regras mínimas (sala/Gemini):
//  • tudo dentro da carroceria e sem sobrepor
//  • peso ≤ capacidade do caminhão
//  • centro de massa entre 30% e 70% do comprimento (senão: desbalanceada)
//  • cinta em cada pacote — sem cinta, chance de amassar na viagem
// "Carregar" leva só o que está na grade (o resto pode ir depois).
// =====================================================================
window.PT = window.PT || {};

PT.carga = (function () {
  const C = PT.DADOS.carregamento;
  const COLS = Math.round(C.carroceria.comprimento / C.carroceria.celula);   // 24
  const LINS = Math.round(C.carroceria.largura / C.carroceria.celula);       // 5
  const PX = 30;                                                              // pixels por célula
  let st = null;   // { c, p, pacotes[], sel, cintasPassando }

  function pesoPeca(p) { return PT.DADOS.produtos[p.produto].larguraUtil * p.comprimento * 4.2; }

  // monta os pacotes a partir do que existe fisicamente na zona verde
  function montarPacotes(p, incluirTortas) {
    const d = PT.pedidos.disponivel(p);
    let falta = p.pecas - p.carregadas;
    const boas = Math.min(falta, d.boas); falta -= boas;
    const tortas = incluirTortas ? Math.min(falta, d.tortas) : 0;
    const lst = [];
    const cel = C.carroceria.celula;
    const w = Math.max(1, Math.ceil(p.comprimento / cel)), h = Math.max(1, Math.ceil((PT.DADOS.produtos[p.produto].larguraUtil + 0.05) / cel));
    [['boa', boas], ['torta', tortas]].forEach(([tipo, n]) => {
      while (n > 0) {
        const q = Math.min(n, C.pecasPorPacote); n -= q;
        lst.push({ id: lst.length + 1, tipo, n: q, peso: q * pesoPeca(p), w, h, gx: null, gy: null, cinta: false });
      }
    });
    return lst;
  }

  function abrir(c, p, incluirTortas) {
    st = { c, p, incluirTortas: !!incluirTortas, pacotes: montarPacotes(p, incluirTortas), sel: null };
    if (!st.pacotes.length) { PT.ev.emit('aviso', 'Não há peças desse pedido na zona verde.'); st = null; return; }
    PT.ui.abrirModal('carga'); desenhar();
  }

  // ---------- regras ----------
  function cabe(pk, gx, gy) {
    if (gx < 0 || gy < 0 || gx + pk.w > COLS || gy + pk.h > LINS) return false;
    return !st.pacotes.some(o => o !== pk && o.gx !== null && gx < o.gx + o.w && gx + pk.w > o.gx && gy < o.gy + o.h && gy + pk.h > o.gy);
  }
  function analise() {
    const pos = st.pacotes.filter(o => o.gx !== null);
    const peso = pos.reduce((a, o) => a + o.peso, 0);
    const cm = peso > 0 ? pos.reduce((a, o) => a + o.peso * (o.gx + o.w / 2), 0) / peso / COLS : 0.5;   // 0 = cabine, 1 = traseira
    const semCinta = pos.filter(o => !o.cinta).length;
    return { pos, peso, cm, semCinta, pecas: pos.reduce((a, o) => a + o.n, 0),
      acimaPeso: peso > C.capacidadeKg, desbalanceada: pos.length > 0 && (cm < C.balanco[0] || cm > C.balanco[1]) };
  }

  // ---------- tela ----------
  function desenhar() {
    const caixa = document.getElementById('carga').querySelector('.caixa');
    const a = analise(), p = st.p;
    const cor = o => o.tipo === 'torta' ? '#c0392b' : '#2e86c1';
    let grade = '<div class="carroceria" id="cgGrade" style="width:' + COLS * PX + 'px;height:' + LINS * PX + 'px">';
    grade += '<div class="cabine">CABINE</div>';
    st.pacotes.filter(o => o.gx !== null).forEach(o => {
      grade += '<div class="pacote' + (st.sel === o ? ' sel' : '') + '" data-pk="' + o.id + '" style="left:' + o.gx * PX + 'px;top:' + o.gy * PX + 'px;width:' + o.w * PX + 'px;height:' + o.h * PX + 'px;background:' + cor(o) + '">' +
        o.n + (o.cinta ? ' ⛓' : '') + '</div>';
    });
    // linha do centro de massa
    if (a.pos.length) grade += '<div class="cm ' + (a.desbalanceada ? 'ruim' : '') + '" style="left:' + (a.cm * COLS * PX) + 'px"></div>';
    grade += '</div>';
    const fora = st.pacotes.filter(o => o.gx === null);
    caixa.innerHTML = '<h2>🚚 Mesa de carregamento — ' + p.id + ' (' + p.cliente + ') <button class="fechar" id="cgX">✕</button></h2>' +
      '<p>Clique num pacote e depois na carroceria para posicionar. Clique num pacote já colocado para tirar. ' + p.pecas + ' peças no pedido, ' + p.carregadas + ' já carregadas.</p>' +
      '<div class="cgBarra"><span class="' + (a.acimaPeso ? 'ruim' : '') + '">Peso: ' + Math.round(a.peso) + ' / ' + C.capacidadeKg + ' kg</span>' +
      '<span class="' + (a.desbalanceada ? 'ruim' : 'bom') + '">Equilíbrio: ' + (a.pos.length ? Math.round(a.cm * 100) + '% ' + (a.desbalanceada ? '(DESBALANCEADA)' : '(ok)') : '—') + '</span>' +
      '<span class="' + (a.semCinta ? 'ruim' : 'bom') + '">Cintas: ' + (a.pos.length - a.semCinta) + '/' + a.pos.length + '</span>' +
      '<span>Na carroceria: ' + a.pecas + ' peças</span></div>' +
      // balança: faixa verde = zona segura; o ponto mostra para onde o peso está puxando (Gemini)
      '<div class="balanca"><span>CABINE</span><div class="trilhoB"><div class="seguro" style="left:' + C.balanco[0] * 100 + '%;width:' + (C.balanco[1] - C.balanco[0]) * 100 + '%"></div>' +
      (a.pos.length ? '<div class="ponto ' + (a.desbalanceada ? 'ruim' : '') + '" style="left:' + a.cm * 100 + '%"></div>' : '') + '</div><span>TRASEIRA</span></div>' + grade +
      '<h3>Pacotes na zona verde</h3><div class="cgFora">' + (fora.map(o => '<div class="pacote solto' + (st.sel === o ? ' sel' : '') + '" data-pk="' + o.id + '" style="width:' + o.w * PX * 0.6 + 'px;height:' + o.h * PX * 0.8 + 'px;background:' + cor(o) + '">' + o.n + (o.tipo === 'torta' ? ' tortas' : '') + '</div>').join('') || '<i>todos na carroceria</i>') + '</div>' +
      '<div class="botoes"><button id="cgAuto">Arrumar automático</button><button id="cgCinta">Passar cintas (' + a.semCinta + ')</button>' +
      '<button id="cgTortas">' + (st.incluirTortas ? 'Tirar as tortas' : 'Incluir tortas') + '</button>' +
      '<button id="cgOk" class="start"' + (a.pos.length && !a.acimaPeso ? '' : ' disabled') + '>Carregar ' + a.pecas + ' peças</button></div>';
    document.getElementById('cgX').onclick = fechar;
    caixa.querySelectorAll('[data-pk]').forEach(el => el.onclick = ev => {
      ev.stopPropagation();
      const pk = st.pacotes.find(o => o.id === +el.dataset.pk);
      if (pk.gx !== null && st.sel !== pk) { pk.gx = pk.gy = null; pk.cinta = false; st.sel = pk; }
      else st.sel = st.sel === pk ? null : pk;
      desenhar();
    });
    document.getElementById('cgGrade').onclick = ev => {
      if (!st.sel) return;
      const r = ev.currentTarget.getBoundingClientRect();
      const gx = Math.floor((ev.clientX - r.left) / PX - st.sel.w / 2 + 0.5), gy = Math.floor((ev.clientY - r.top) / PX - st.sel.h / 2 + 0.5);
      if (posicionar(st.sel, gx, gy)) st.sel = null; else PT.ev.emit('aviso', 'Não cabe aí.');
      desenhar();
    };
    document.getElementById('cgAuto').onclick = () => { arrumarAuto(); desenhar(); };
    document.getElementById('cgCinta').onclick = passarCintas;
    document.getElementById('cgTortas').onclick = () => { const c = st.c, p = st.p, t = !st.incluirTortas; abrir(c, p, t); };
    document.getElementById('cgOk').onclick = confirmar;
  }
  function posicionar(pk, gx, gy) {
    gx = PT.util.clamp(gx, 0, COLS - pk.w); gy = PT.util.clamp(gy, 0, LINS - pk.h);
    if (!cabe(pk, gx, gy)) return false;
    pk.gx = gx; pk.gy = gy; pk.cinta = false; return true;
  }
  // arrumação automática simples (pesados perto do centro): ajuda, mas não amarra
  function arrumarAuto() {
    st.pacotes.forEach(o => { o.gx = o.gy = null; o.cinta = false; });
    const ordem = st.pacotes.slice().sort((a, b) => b.peso - a.peso);
    const centro = Math.floor(COLS / 2);
    ordem.forEach(pk => {
      let melhor = null, md = 1e9;
      for (let gy = 0; gy + pk.h <= LINS; gy++) for (let gx = 0; gx + pk.w <= COLS; gx++) {
        if (!cabe(pk, gx, gy)) continue;
        const d = Math.abs(gx + pk.w / 2 - centro) + gy * 0.01;
        if (d < md) { md = d; melhor = [gx, gy]; }
      }
      if (melhor) { pk.gx = melhor[0]; pk.gy = melhor[1]; }
    });
  }
  function passarCintas() {
    const faltam = st.pacotes.filter(o => o.gx !== null && !o.cinta);
    if (!faltam.length) return;
    const voltar = st;
    PT.ui.progresso('Passando ' + faltam.length + ' cinta(s) na carga...', faltam.length * C.segundosCinta, () => {
      faltam.forEach(o => o.cinta = true); st = voltar; PT.ui.abrirModal('carga'); desenhar();
    });
  }

  function confirmar() {
    const a = analise(); if (!a.pos.length || a.acimaPeso) return;
    // sorteio do dano na viagem (por pacote)
    let dano = 0;
    a.pos.forEach(o => {
      const ch = (o.cinta ? 0 : C.chanceDanoSemCinta) + (a.desbalanceada ? C.danoDesbalanceado : 0);
      if (o.tipo === 'boa' && Math.random() < ch) dano += Math.max(1, Math.round(o.n * C.fracaoDanoPacote));
    });
    const boas = a.pos.filter(o => o.tipo === 'boa').reduce((x, o) => x + o.n, 0);
    const tortas = a.pos.filter(o => o.tipo === 'torta').reduce((x, o) => x + o.n, 0);
    const c = st.c; fechar();
    PT.pedidos.carregarCaminhao(c, tortas > 0, { boas, tortas, dano });
    PT.ev.emit('cargaMontada', { boas, tortas, dano, desbalanceada: a.desbalanceada, semCinta: a.semCinta });
  }
  function fechar() { st = null; PT.ui.fecharModal(); }

  return { abrir, analise: () => st && analise(), arrumarAuto, posicionar, get estado() { return st; }, confirmar, COLS, LINS };
})();
