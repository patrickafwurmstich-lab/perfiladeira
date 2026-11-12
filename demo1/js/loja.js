// =====================================================================
// loja.js — loja do navegador do escritório. Comprar gera uma ENTREGA
// agendada (entrega.js). Aqui só tem regra; a tela fica em ui.js.
// =====================================================================
window.PT = window.PT || {};

PT.loja = (function () {
  const D = PT.DADOS;

  // junta o item do catálogo com os dados da máquina/bobina
  function ficha(id) {
    const c = D.catalogo.find(i => i.id === id); if (!c) return null;
    const m = D.maquinas[id], b = D.bobinas[id];
    const f = Object.assign({}, c);
    if (m) Object.assign(f, { nome: m.nome, dims: m.dims, pesoKg: m.pesoKg, kw: m.kw, vantagem: m.vantagem, defeito: m.defeito, modelo: m.modelo, tipoItem: 'maquina' });
    else if (b) Object.assign(f, { nome: b.nome, pesoKg: b.pesoKg, modelo: b.modelo, tipoItem: 'bobina' });
    else if (c.veiculo) f.tipoItem = 'empilhadeira';
    else f.tipoItem = c.decor ? 'decor' : (c.consumivel ? 'consumivel' : (c.upgradeQuadroKW ? 'quadro' : c.id));
    return f;
  }
  function itens(categoria) { return D.catalogo.filter(i => !categoria || i.categoria === categoria).map(i => ficha(i.id)); }

  // modo: 'vista' | 'finame'
  function comprar(id, modo, qtd) {
    qtd = qtd || 1;
    const f = ficha(id); if (!f) return { ok: false, msg: 'Item não existe' };
    const total = f.preco * qtd, frete = f.frete || 0;
    if (modo === 'finame') {
      if (!f.finame) return { ok: false, msg: 'Este item não aceita FINAME' };
      const r = PT.eco.comprarFiname(total, f.nome);
      if (!r.ok) return r;
      if (frete && !PT.eco.pagar(frete, 'Frete — ' + f.nome)) return { ok: false, msg: 'Sem caixa para o frete' };
      agendar(f, qtd); return { ok: true, msg: r.msg + ' Entrega em ' + f.prazoDias + ' dia(s).' };
    }
    if (!PT.eco.podePagar(total + frete)) return { ok: false, msg: 'Saldo insuficiente (' + PT.util.reais(total + frete) + ').' };
    PT.eco.pagar(total, 'Compra — ' + qtd + 'x ' + f.nome);
    if (frete) PT.eco.pagar(frete, 'Frete — ' + f.nome);
    agendar(f, qtd);
    if (f.aviso) PT.ev.emit('celular', { de: 'Vendedor', texto: f.aviso.replace(/^Vendedor: /, '') });
    return { ok: true, msg: 'Comprado! Entrega no dia ' + (PT.tempo.st.dia + f.prazoDias) + '.' };
  }
  function agendar(f, qtd) {
    const ids = []; for (let i = 0; i < qtd; i++) ids.push(f.id);
    PT.entrega.agendar(PT.tempo.st.dia + f.prazoDias, ids, 'Fornecedor');
    PT.ev.emit('compra', { id: f.id, qtd });
  }

  return { ficha, itens, comprar };
})();
