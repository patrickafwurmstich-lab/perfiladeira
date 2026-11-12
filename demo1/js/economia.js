// =====================================================================
// economia.js — caixa, banco, crédito, agiota, FINAME, recebíveis,
// custos fixos, energia, folha, extrato e previsão de caixa.
// Toda entrada/saída de dinheiro passa por PT.eco.lancar() — assim o
// extrato e o save sempre batem.
// =====================================================================
window.PT = window.PT || {};

PT.eco = (function () {
  const E = PT.DADOS.economia;
  const st = {
    caixa: E.caixaInicial,
    creditoUsado: 0,           // capital de giro sacado
    cheque: 0,                 // agiota (negativo coberto)
    receber: [],               // {dia, valor, desc, pedidoId}
    pagar: [],                 // {dia, valor, desc}
    financiamentos: [],        // {desc, parcela, restantes}
    extrato: [],               // {quando, desc, valor, saldo}
    energiaKWhMes: 0,
    entradas: 0, saidas: 0
  };

  function lancar(valor, desc) {
    st.caixa += valor;
    if (valor >= 0) st.entradas += valor; else st.saidas -= valor;
    st.extrato.unshift({ quando: PT.tempo.rotulo(), desc, valor, saldo: st.caixa });
    if (st.extrato.length > 200) st.extrato.pop();
    cobrirNegativo();
    PT.ev.emit('caixa', st);
  }

  // saldo negativo: usa o cheque especial (agiota) até o limite
  function cobrirNegativo() {
    if (st.caixa < 0) {
      const usar = Math.min(-st.caixa, E.chequeEspecial - st.cheque);
      if (usar > 0) {
        st.cheque += usar; st.caixa += usar;
        st.extrato.unshift({ quando: PT.tempo.rotulo(), desc: 'Cheque especial (agiota) cobriu o saldo', valor: usar, saldo: st.caixa });
        PT.ev.emit('agiota', { usado: st.cheque });
        if (PT.rep) PT.rep.efeito('financeira', PT.DADOS.reputacao.efeitos.chequeEspecial);
      }
    }
  }

  function podePagar(v) { return st.caixa + (E.chequeEspecial - st.cheque) >= v; }
  function pagar(v, desc) { if (!podePagar(v)) return false; lancar(-v, desc); return true; }

  // ---------- capital de giro ----------
  function sacarCredito(v) {
    v = Math.min(v, E.limiteCredito - st.creditoUsado); if (v <= 0) return 0;
    st.creditoUsado += v; lancar(v, 'Saque do capital de giro'); return v;
  }
  function pagarCredito(v) {
    v = Math.min(v, st.creditoUsado, Math.max(0, st.caixa)); if (v <= 0) return 0;
    st.creditoUsado -= v; lancar(-v, 'Amortização do capital de giro'); return v;
  }
  function pagarAgiota() {
    const v = Math.min(st.cheque, Math.max(0, st.caixa)); if (v <= 0) return 0;
    st.cheque -= v; lancar(-v, 'Pagamento ao agiota'); return v;
  }

  // ---------- FINAME (liberado por reputação) ----------
  function finameLiberado() { return PT.rep ? PT.rep.faixa() >= E.finame.faixaMinima : false; }
  function comprarFiname(valor, desc) {
    if (!finameLiberado()) return { ok: false, msg: 'FINAME liberado só na faixa ' + E.finame.faixaMinima + ' de reputação (≈10 pedidos entregues).' };
    const entrada = valor * E.finame.entrada, fin = valor - entrada;
    if (!podePagar(entrada)) return { ok: false, msg: 'Sem caixa para a entrada de ' + PT.util.reais(entrada) };
    const i = E.finame.jurosMes, n = E.finame.parcelas;
    const parcela = fin * i / (1 - Math.pow(1 + i, -n));
    lancar(-entrada, 'Entrada FINAME — ' + desc);
    st.financiamentos.push({ desc, parcela, restantes: n });
    return { ok: true, msg: 'Financiado: ' + n + 'x de ' + PT.util.reais(parcela) };
  }

  // ---------- recebíveis ----------
  function agendarRecebimento(dia, valor, desc, pedidoId) { st.receber.push({ dia, valor, desc, pedidoId }); }
  function anteciparTudo() {
    if (!st.receber.length) return 0;
    const bruto = st.receber.reduce((a, r) => a + r.valor, 0);
    const liq = bruto * (1 - E.antecipacaoDesconto);
    st.receber = []; lancar(liq, 'Antecipação de recebíveis (−' + (E.antecipacaoDesconto * 100) + '%)');
    return liq;
  }

  // ---------- energia ----------
  function registrarEnergia(kw, horas) { st.energiaKWhMes += kw * horas; }

  // ---------- previsão de caixa ----------
  function previsao(dias) {
    const hoje = PT.tempo.st.dia; let v = st.caixa;
    st.receber.forEach(r => { if (r.dia <= hoje + dias) v += r.valor; });
    st.pagar.forEach(p => { if (p.dia <= hoje + dias) v -= p.valor; });
    const fixos = Object.values(E.custosFixosMes).reduce((a, b) => a + b, 0);
    v -= fixos * dias / E.diasDoMes;
    v -= PT.func ? PT.func.folhaMensal() * dias / E.diasDoMes : 0;
    st.financiamentos.forEach(f => v -= f.parcela * Math.min(f.restantes, dias / E.diasDoMes));
    return v;
  }

  // ---------- rotina diária (chamada no evento 'dia') ----------
  PT.ev.on('dia', ({ dia }) => {
    // recebimentos do dia
    st.receber.filter(r => r.dia <= dia).forEach(r => lancar(r.valor, r.desc));
    st.receber = st.receber.filter(r => r.dia > dia);
    // contas agendadas
    st.pagar.filter(p => p.dia <= dia).forEach(p => lancar(-p.valor, p.desc));
    st.pagar = st.pagar.filter(p => p.dia > dia);
    // agiota: juros a cada 7 dias
    if (st.cheque > 0 && dia % 7 === 0) {
      const j = st.cheque * E.jurosCheque7d; st.cheque += j;
      st.extrato.unshift({ quando: PT.tempo.rotulo(), desc: 'Juros do agiota', valor: -j, saldo: st.caixa });
      PT.ev.emit('agiotaJuros', { juros: j, total: st.cheque });
    }
    // mensal (dia 30, 60, ...): fixos, energia, juros do crédito, parcelas
    if ((dia - 1) % E.diasDoMes === 0 && dia > 1) {
      const F = E.custosFixosMes;
      lancar(-F.energiaBase, 'Energia — taxa básica');
      const kwh = st.energiaKWhMes; st.energiaKWhMes = 0;
      if (kwh > 0) lancar(-kwh * E.tarifaKWh, 'Energia — consumo das máquinas (' + Math.round(kwh) + ' kWh)');
      lancar(-F.contadorInternetManut, 'Contador, internet e manutenção');
      lancar(-F.outros, 'Outros custos fixos');
      if (st.creditoUsado > 0) lancar(-st.creditoUsado * E.jurosCreditoMes, 'Juros do capital de giro');
      st.financiamentos.forEach(f => { if (f.restantes > 0) { lancar(-f.parcela, 'Parcela FINAME — ' + f.desc); f.restantes--; } });
      st.financiamentos = st.financiamentos.filter(f => f.restantes > 0);
      if (PT.rep && st.cheque === 0) PT.rep.efeito('financeira', PT.DADOS.reputacao.efeitos.contaEmDia);
    }
  });

  return {
    st, lancar, pagar, podePagar, sacarCredito, pagarCredito, pagarAgiota,
    finameLiberado, comprarFiname, agendarRecebimento, anteciparTudo, registrarEnergia, previsao,
    salvar() { return JSON.parse(JSON.stringify(st)); },
    carregar(o) { Object.assign(st, o); }
  };
})();
