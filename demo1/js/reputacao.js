// =====================================================================
// reputacao.js — 3 barras (pontualidade, qualidade, confiança
// financeira) → estrelas na fachada. Faixa = pedidos entregues.
// =====================================================================
window.PT = window.PT || {};

PT.rep = (function () {
  const R = PT.DADOS.reputacao;
  const st = Object.assign({ entregues: 0 }, JSON.parse(JSON.stringify(R.inicial)));
  function efeito(barra, d) { st[barra] = PT.util.clamp(st[barra] + d, 0, 1); PT.ev.emit('reputacao', st); }
  function media() { return (st.pontualidade + st.qualidade + st.financeira) / 3; }
  function estrelas() { return Math.round((1 + media() * 4) * 2) / 2; }
  function faixa() { let f = 0; R.faixas.forEach((n, i) => { if (st.entregues >= n) f = i; }); return f; }
  function proximaFaixa() { const f = faixa(); return R.faixas[f + 1] !== undefined ? R.faixas[f + 1] - st.entregues : 0; }
  function entregou() {
    const antes = faixa(); st.entregues++;
    if (faixa() > antes) PT.ev.emit('celular', { de: 'Banco Cerrado', texto: 'Parabéns! Sua empresa subiu para a FAIXA ' + faixa() + ' de reputação.' + (faixa() === PT.DADOS.economia.finame.faixaMinima ? ' O FINAME agora está liberado para compra de máquinas!' : '') });
    PT.ev.emit('reputacao', st);
  }
  return { st, efeito, media, estrelas, faixa, proximaFaixa, entregou, salvar: () => Object.assign({}, st), carregar: o => Object.assign(st, o) };
})();
