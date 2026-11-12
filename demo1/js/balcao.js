// =====================================================================
// balcao.js — LOJA DE BALCÃO no pátio, de frente para a rua.
// Clientes chegam A PÉ, entram pela porta da rua e fazem fila no balcão.
// O jogador entra pela porta da frente do barracão, vai para trás do
// balcão e atende: vender da PRONTA ENTREGA (peças da zona verde, pago
// na hora) ou ANOTAR ENCOMENDA (vira pedido). Cliente pede desconto,
// curioso faz pergunta sem fim, o do sítio quer pagar com galinha.
// Paciência acaba = vai embora reclamando. Café +30% de paciência;
// mostruário +3% no preço. (Sala: Gemini — regras e zoeira; Claude.)
// =====================================================================
window.PT = window.PT || {};

PT.balcao = (function () {
  const B = () => PT.DADOS.balcao, L = () => PT.DADOS.mundo.loja;
  const st = { fila: [], cont: 0, atendidos: 0, perdidos: 0, atual: null };

  // ---------------- prédio ----------------
  function construir() {
    const sc = PT.mundo.scene, lj = L(), h = 3, cw = 0xd9c7a7;
    const caixa = (w, hh, d, cor, x, y, z, op) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), new THREE.MeshLambertMaterial({ color: cor, transparent: !!op, opacity: op || 1 })); m.position.set(x, y, z); m.receiveShadow = true; sc.add(m); return m; };
    const P = PT.mundo.paredes, px = lj.portaX;
    // piso
    caixa(lj.x1 - lj.x0, 0.08, lj.z1 - lj.z0, 0xb08d5e, (lj.x0 + lj.x1) / 2, 0.04, (lj.z0 + lj.z1) / 2);
    // paredes com porta para o barracão (norte) e para a rua (sul)
    [[lj.z1, 'norte'], [lj.z0, 'sul']].forEach(([z]) => {
      caixa(px - 1 - lj.x0, h, 0.25, cw, (lj.x0 + px - 1) / 2, h / 2, z, 0.55); P.push({ x0: lj.x0, x1: px - 1, z0: z - 0.2, z1: z + 0.2 });
      caixa(lj.x1 - px - 1, h, 0.25, cw, (px + 1 + lj.x1) / 2, h / 2, z, 0.55); P.push({ x0: px + 1, x1: lj.x1, z0: z - 0.2, z1: z + 0.2 });
    });
    [lj.x0, lj.x1].forEach(x => { caixa(0.25, h, lj.z1 - lj.z0, cw, x, h / 2, (lj.z0 + lj.z1) / 2, 0.55); P.push({ x0: x - 0.2, x1: x + 0.2, z0: lj.z0, z1: lj.z1 }); });
    // balcão (deixa passagem na ponta oeste para o dono entrar e sair)
    const bal = PT.modelo('balcao_loja', { dims: [lj.x1 - lj.x0 - 3, 0.7, 1.1] }); bal.position.set((lj.x0 + 2.5 + lj.x1) / 2, 0, lj.balcaoZ); sc.add(bal);
    P.push({ x0: lj.x0 + 2.5, x1: lj.x1, z0: lj.balcaoZ - 0.35, z1: lj.balcaoZ + 0.35 });
    const sino = PT.modelo('sino_balcao', { semRotulo: true }); sino.position.set(px + 1.2, 1.1, lj.balcaoZ); sc.add(sino);
    // placa da fachada
    const placa = PT.rotuloSprite('LOJA PARECIS TELHA — PRONTA ENTREGA', '#ffd27a'); placa.scale.set(4.6, 0.85, 1); placa.position.set((lj.x0 + lj.x1) / 2, 3.8, lj.z0 - 0.2); sc.add(placa);
    PT.registroModelos.usos.loja_balcao = 1; PT.registroModelos.max.loja_balcao = 1;
  }

  // ---------------- clientes ----------------
  function pontoFila(i) { const lj = L(); return { x: lj.portaX + (i % 2 ? 1.5 : 0) * Math.sign(i), z: lj.balcaoZ - 1.0 - i * 1.1 }; }
  function bonusLoja() {
    const lj = L(), dentro = o => o.x > lj.x0 && o.x < lj.x1 && o.z > lj.z0 && o.z < lj.z1;
    const ents = PT.ent.lista.filter(o => o.tipo === 'decor' && dentro(o));
    return { cafe: ents.some(o => o.item === 'garrafa_cafe'), mostruario: ents.some(o => o.item === 'mostruario') };
  }
  function novoCliente() {
    if (st.fila.length >= B().filaMax) return null;
    const tipo = PT.util.escolhaPeso(B().tipos), T = B().tipos[tipo];
    const produto = tipo === 'curioso' ? 'TP40' : PT.util.escolha(['TP40', 'TP40', 'TP40', 'RUFO']);
    const comp = produto === 'TP40' ? PT.util.escolha([3, 4, 5, 6]) : PT.util.escolha([2, 3]);
    const c = { id: 'cli_' + (++st.cont), tipo, nome: tipo === 'escambo' ? 'Seu Lauro do sítio' : PT.util.escolha(B().nomes), produto, comprimento: comp,
      pecas: PT.util.randInt(T.qtd[0], T.qtd[1]), estado: 'chegando', x: L().portaX + PT.util.rand(-3, 3), z: -45, paciencia: B().pacienciaMin * (bonusLoja().cafe ? 1 + B().bonusCafe : 1) };
    c.pacienciaMax = c.paciencia;
    c.g = PT.modelo('cliente_balcao', { cor: PT.util.escolha([0x8e6c4a, 0x5d8aa8, 0x9b59b6, 0x6b8e23, 0xc0392b]), rotulo: c.nome });
    PT.mundo.scene.add(c.g); st.fila.push(c);
    return c;
  }
  function sair(c, bravo) {
    c.estado = 'saindo'; c.bravo = bravo;
    if (st.atual === c) st.atual = null;
    st.fila = st.fila.filter(x => x !== c); c.saindo = true; saindo.push(c);
  }
  const saindo = [];

  function andar(c, d, dt) {
    const dx = d.x - c.x, dz = d.z - c.z, dist = Math.hypot(dx, dz); if (dist < 0.15) return true;
    const p = Math.min(dist, B().velocidade * dt); c.x += dx / dist * p; c.z += dz / dist * p; c.rot = Math.atan2(dx, dz); return false;
  }
  function caminho(c, alvo, dt) {
    // rua → porta sul → posição na fila (evita atravessar a parede da loja)
    const lj = L(), porta = { x: lj.portaX, z: lj.z0 - 0.8 }, dentro = { x: lj.portaX, z: lj.z0 + 0.8 };
    if (c.z < lj.z0 - 0.5) return andar(c, Math.abs(c.x - porta.x) > 0.2 ? porta : dentro, dt) && false;
    if (c.z < lj.z0 + 0.6) return andar(c, dentro, dt) && false;
    return andar(c, alvo, dt);
  }

  function atualizar(dt) {
    const dtj = Math.min(dt, 0.1) * Math.max(1, PT.tempo.vel);
    st.fila.forEach((c, i) => {
      const chegou = caminho(c, pontoFila(i), dtj);
      if (chegou && c.estado === 'chegando') { c.estado = 'esperando'; if (i === 0) tocarSino(c); }
      if (i === 0 && c.estado === 'esperando' && !c.tocou) tocarSino(c);
      c.g.position.set(c.x, 0, c.z); c.g.rotation.y = c.rot || Math.PI;
      if (c.g.userData.rotulo) { const r = c.estado === 'esperando' ? c.nome + ' ' + barra(c.paciencia / c.pacienciaMax) : c.nome; if (r !== c.ultRot) { c.ultRot = r; c.g.userData.rotulo.userData.atualizar(r, c.paciencia / c.pacienciaMax < 0.3 ? '#ffb3a7' : '#fff'); } }
    });
    saindo.slice().forEach(c => {
      const lj = L(); const alvo = c.z > lj.z0 - 0.5 ? { x: lj.portaX, z: lj.z0 - 1 } : { x: lj.portaX + 6, z: -48 };
      andar(c, alvo, dtj); c.g.position.set(c.x, 0, c.z); c.g.rotation.y = c.rot || 0;
      if (c.z < -46) { PT.mundo.scene.remove(c.g); c.g.userData.liberar(); saindo.splice(saindo.indexOf(c), 1); }
    });
  }
  function barra(f) { const n = Math.round(PT.util.clamp(f, 0, 1) * 5); return '▮'.repeat(n) + '▯'.repeat(5 - n); }
  function tocarSino(c) {
    c.tocou = true;
    PT.ev.emit('aviso', '🔔 Plim-plim! ' + c.nome + ' está esperando no balcão da loja.');
    if (PT.pc) PT.pc.notificar({ de: 'Loja de balcão', texto: c.nome + ' (' + B().tipos[c.tipo].nome.toLowerCase() + ') está esperando atendimento.', categoria: 'Clientes' });
  }

  // paciência e chegada em minutos de JOGO
  PT.ev.on('minuto', () => {
    if (st.atual && !PT.ui.modalAberto()) st.atual = null;      // fechou a janela sem decidir: o cliente volta a esperar
    st.fila.forEach(c => {
      if (c.estado !== 'esperando' || st.atual === c) return;
      c.paciencia -= 1;
      if (c.paciencia <= 0) {
        st.perdidos++; PT.rep.efeito('pontualidade', -0.01);
        PT.ev.emit('celular', { de: c.nome, texto: PT.util.escolha(['Sem atendimento aqui, vou na concorrência!', 'Fiquei uma hora plantado nesse balcão. Tchau!', 'Nem um cafezinho... vou embora.']) });
        sair(c, true);
      }
    });
  });
  PT.ev.on('hora', ({ hora }) => {
    if (hora < B().horaAbre || hora >= B().horaFecha) return;
    if (Math.random() < B().chancePorHora) novoCliente();
  });
  PT.ev.on('fimDoTurno', () => { st.fila.slice().forEach(c => sair(c, false)); });

  // ---------------- atendimento ----------------
  function precoUnit(c) { const p = PT.DADOS.produtos[c.produto]; return p.precoBase * (1 + B().margemProntaEntrega) * (bonusLoja().mostruario ? 1 + B().bonusMostruario : 1); }
  function unidades(c) { const p = PT.DADOS.produtos[c.produto]; return c.pecas * c.comprimento * (p.unidade === 'm²' ? p.larguraUtil : 1); }
  function disponivel(c) {
    return PT.ent.naZona('expedicao', o => o.tipo === 'pilha' && !o.preso && o.produto === c.produto && Math.abs(o.comprimento - c.comprimento) < 1e-6)
      .reduce((a, o) => a + o.qtd - (o.tortasEscondidas ? 0 : o.defeituosas), 0);
  }
  function retirar(c) {
    let falta = c.pecas, tortas = 0;
    PT.ent.naZona('expedicao', o => o.tipo === 'pilha' && !o.preso && o.produto === c.produto && Math.abs(o.comprimento - c.comprimento) < 1e-6).forEach(o => {
      if (falta <= 0) return;
      const esc = o.tortasEscondidas ? o.defeituosas : 0, boas = o.qtd - o.defeituosas + esc, n = Math.min(boas, falta);
      if (esc > 0) { const t = Math.min(esc, Math.round(n * o.defeituosas / o.qtd)); o.defeituosas -= t; tortas += t; }
      o.qtd -= n; falta -= n;
      if (o.qtd <= 0) PT.ent.remover(o); else PT.estoque.atualizarPilha(o);
    });
    return tortas;
  }
  function atender(c) { st.atual = c; c.pediuDesconto = Math.random() < B().tipos[c.tipo].pechincha; abrirDialogo(c); }

  function abrirDialogo(c, etapa) {
    PT.ui.abrirModal('balcao');
    const cx = document.getElementById('balcao').querySelector('.caixa');
    const p = PT.DADOS.produtos[c.produto], disp = disponivel(c), total = Math.round(unidades(c) * precoUnit(c));
    const desc = Math.round(total * (1 - B().descontoPedido));
    let fala, ops = [];
    if (c.tipo === 'curioso' && etapa !== 'compra') {
      fala = PT.util.escolha(B().falasCurioso) + ' ... Tá, tá. Me vê UMA telha de ' + c.comprimento + ' m, pra casinha do cachorro.';
    } else if (c.tipo === 'escambo') {
      fala = 'Bom dia, patrão! Preciso de ' + c.pecas + ' ' + p.nome.toLowerCase() + ' de ' + c.comprimento + ' m. Dinheiro tá curto... aceita metade em dinheiro e uma galinha caipira das boas?';
    } else {
      fala = 'Bom dia! Tem ' + c.pecas + ' ' + p.nome.toLowerCase() + ' de ' + c.comprimento + ' m pra levar agora?' + (c.pediuDesconto ? ' Faz um descontinho à vista?' : '');
    }
    const temEstoque = disp >= c.pecas;
    if (c.tipo === 'escambo') {
      ops.push(['galinha', 'Aceitar: ' + PT.util.reais(total * 0.5) + ' + 1 galinha', temEstoque]);
      ops.push(['vender', 'Só no dinheiro: ' + PT.util.reais(total), temEstoque]);
    } else if (c.pediuDesconto) {
      ops.push(['desconto', 'Vender com 5% de desconto: ' + PT.util.reais(desc), temEstoque]);
      ops.push(['vender', 'Preço cheio: ' + PT.util.reais(total) + ' (ele pode desistir)', temEstoque]);
    } else ops.push(['vender', 'Vender da pronta entrega: ' + PT.util.reais(total), temEstoque]);
    ops.push(['encomenda', 'Anotar encomenda (fica pronta em ' + (c.tipo === 'curioso' ? 1 : 2) + ' dia(s), ele paga no Pix agora e busca de caminhonete)', true]);
    ops.push(['recusar', 'Hoje não vai dar', true]);
    cx.innerHTML = '<h2>🛒 Balcão — ' + c.nome + ' <small>(' + B().tipos[c.tipo].nome + ')</small></h2><p class="fala">"' + fala + '"</p>' +
      '<p class="info">Na zona verde: <b>' + disp + '</b> ' + p.nome + ' de ' + c.comprimento + ' m (precisa de ' + c.pecas + ').' + (temEstoque ? '' : ' <span class="ruim">Não dá para pronta entrega.</span>') +
      (bonusLoja().cafe ? ' ☕ Tomando cafezinho.' : '') + (bonusLoja().mostruario ? ' 🧱 Viu o mostruário (+3%).' : '') + '</p>' +
      '<div class="botoes">' + ops.map(o => '<button data-b="' + o[0] + '"' + (o[2] ? '' : ' disabled') + '>' + o[1] + '</button>').join('') + '</div>';
    cx.querySelectorAll('[data-b]').forEach(b => b.onclick = () => decidir(c, b.dataset.b, total, desc));
  }

  function decidir(c, acao, total, desc) {
    const fechar = () => { st.atual = null; PT.ui.fecharModal(); };
    if (acao === 'recusar') { fechar(); PT.ev.emit('aviso', c.nome + ': "Tá bom, passo outro dia."'); sair(c, false); return; }
    if (acao === 'encomenda') {
      const ped = PT.pedidos.gerar({ perfil: 'pedreiro', cliente: c.nome + ' (balcão)', canal: 'balcao', produto: c.produto, comprimento: c.comprimento, pecas: c.pecas,
        precoUnit: Math.round(PT.DADOS.produtos[c.produto].precoBase * 100) / 100, prazoDia: PT.tempo.st.dia + (c.tipo === 'curioso' ? 1 : 2), silencioso: true });
      delete ped.silencioso;
      PT.pedidos.aceitar(ped.id);
      fechar(); st.atendidos++; PT.ev.emit('aviso', 'Encomenda ' + ped.id + ' anotada. ' + c.nome + ' volta com a caminhonete no dia ' + ped.prazoDia + ' às 14h.');
      sair(c, false); return;
    }
    if (acao === 'vender' && c.pediuDesconto && Math.random() > B().chanceAceitarSemDesconto) {
      fechar(); PT.ev.emit('celular', { de: c.nome, texto: 'Sem desconto não dá, patrão. Vou pesquisar.' }); sair(c, false); return;
    }
    const valor = acao === 'desconto' ? desc : acao === 'galinha' ? Math.round(total * 0.5) : total;
    const tortas = retirar(c);
    PT.eco.lancar(valor, 'Venda no balcão — ' + c.pecas + 'x ' + PT.DADOS.produtos[c.produto].nome + ' (' + c.nome + ')');
    PT.rep.efeito('qualidade', tortas ? -0.03 : 0.01); st.atendidos++;
    if (acao === 'galinha') {
      const lj = L(); PT.ent.add({ tipo: 'decor', item: 'galinha', modelo: 'galinha', rotulo: 'Galinha do Seu Lauro', x: lj.x0 + 1.5 + Math.random() * 2, z: lj.z1 - 1.2, solido: false });
      PT.ev.emit('aviso', '🐔 Negócio fechado! Você agora tem uma galinha.');
    }
    fechar();
    PT.ev.emit('aviso', '💵 ' + c.nome + ' pagou ' + PT.util.reais(valor) + (tortas ? ' — e reclamou de ' + tortas + ' telha(s) torta(s)!' : '. Saiu satisfeito.'));
    sair(c, false);
  }

  // ---------------- interação ----------------
  PT.inter.registrar(j => {
    if (j.controlando || j.carregando) return null;
    const lj = L();
    const atrasDoBalcao = j.x > lj.x0 && j.x < lj.x1 && j.z > lj.balcaoZ && j.z < lj.z1;
    if (!atrasDoBalcao || Math.abs(j.z - lj.balcaoZ) > 2.6) return null;
    const c = st.fila.find(x => x.estado === 'esperando');
    if (!c) return [{ rotulo: 'Balcão vazio (os clientes chegam a pé, das 8h às 16h)', prio: 9, acao: () => PT.ev.emit('aviso', 'Nenhum cliente agora.') }];
    return [{ rotulo: 'Atender ' + c.nome + ' (' + B().tipos[c.tipo].nome.toLowerCase() + ')', prio: 1, acao: () => atender(c) }];
  });

  return { st, construir, atualizar, novoCliente, atender, decidir, disponivel, bonusLoja };
})();
