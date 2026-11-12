module.exports.setup = async (p) => {
  await p.evaluate(() => {
    window.T = {
      min(n) { for (let i = 0; i < n; i++) { PT.tempo.st.acum = 1.2000001; PT.tempo.atualizar(0); PT.entrega.atualizar(0.05); } },
      frames(n, dt) { for (let i = 0; i < n; i++) { PT.ponte.atualizar(dt || 0.05); PT.estoque.atualizar(); PT.entrega.atualizar(dt || 0.05); PT.construcao.atualizar(); } },
      ir(x, z) { const j = PT.mundo.jog; j.x = x; j.z = z; PT.estoque.atualizar(); },
      fazer(re) { const ops = PT.inter.calcular(); const o = ops.find(o => re.test(o.rotulo)); if (!o) return 'SEM OPÇÃO ' + re + ' | tem: ' + ops.map(o => o.rotulo).join(' / '); o.acao(); return 'ok: ' + o.rotulo; },
      // monta rápido uma fábrica: perfiladeira instalada, com cabo, bobina montada e alinhada
      fabrica() {
        const m = PT.maq.instalar('perf_tp40_usada', 50, 26, 0); PT.construcao.conectar(m);
        const e = PT.maq.pontoEntrada(m); const b = PT.estoque.novaBobina('GL043-1T', e.x, e.z, 0); PT.maq.tentarMontar(b);
        PT.maq.ligar(m, true); PT.maq.alinhar(m, 1); return m;
      },
      pilhaVerde(qtd, comp, tortas) { const pl = PT.estoque.novaPilha('TP40', comp || 4, 112, 13); PT.estoque.addNaPilha(pl, qtd, tortas || 0); return pl; },
      pedido(pecas, comp, perfil) { const ped = PT.pedidos.gerar(); Object.assign(ped, { produto: 'TP40', comprimento: comp || 4, pecas, qtdUnid: pecas * (comp || 4), valor: pecas * (comp || 4) * 45, perfil: perfil || 'revenda' }); return ped; },
      coletaChegar(id) { PT.pedidos.chamarAgora(id); T.min(2); T.frames(400, 0.1); return PT.entrega.st.caminhoes.find(c => c.e.pedidoId === id); }
    };
  });
};
