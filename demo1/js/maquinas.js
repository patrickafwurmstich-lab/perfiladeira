// =====================================================================
// maquinas.js — UMA classe genérica de máquina guiada por dados.
// Perfiladeira, guilhotina e dobradeira são só registros diferentes em
// PT.DADOS.maquinas (entrada, saída, m/min, kW, mesa, desgaste...).
// A produção anda no passo fixo de 1 minuto de jogo (evento 'minuto').
// Estados: sem_energia | desligada | sem_material | desalinhada | pronta |
//          produzindo | mesa_cheia | saida_obstruida | enroscada | concluida
// =====================================================================
window.PT = window.PT || {};

PT.maq = (function () {
  const D = PT.DADOS;
  const lista = [];
  const NOMES_ESTADO = {
    sem_energia: 'Sem energia (puxe o cabo do quadro)', desligada: 'Desligada', sem_material: 'Sem material na entrada',
    desalinhada: 'Chapa desalinhada (Alinhar)', pronta: 'Pronta para iniciar', produzindo: 'Produzindo',
    mesa_cheia: 'Parada: mesa de saída cheia', saida_obstruida: 'Parada: saída obstruída', enroscada: 'ENROSCOU! Limpe com a esmerilhadeira',
    concluida: 'Lote concluído'
  };

  // local (lx ao longo da máquina, lz para a frente/CLP) → mundo
  function mundo(m, lx, lz) {
    const c = Math.cos(m.rot), s = Math.sin(m.rot);
    return { x: m.x + lx * c + lz * s, z: m.z - lx * s + lz * c };
  }
  function pontoEntrada(m) { return mundo(m, -m.def.dims[0] / 2 - 1.0, 0); }
  function pontoSaida(m, comp) { return mundo(m, m.def.dims[0] / 2 + Math.max(0.5, comp) / 2 + 0.4, 0); }
  function pontoCLP(m) { return mundo(m, -m.def.dims[0] / 2 + 1, m.def.dims[1] / 2 + 0.5); }

  function instalar(defId, x, z, rot, extra) {
    const def = D.maquinas[defId];
    const m = Object.assign({
      tipo: 'maquina', defId, def, nome: def.nome, modelo: def.modelo, rotulo: def.nome, x, z, rot, solido: true,
      ligada: false, cabo: null, estado: 'sem_energia',
      cfg: { produto: def.saida[0], comprimento: Math.min(6, def.compMax), quantidade: 20, velocidade: 1 },
      alinhamento: 0, alinhado: false, produzidas: 0, progressoM: 0, desgaste: 0, lubrificado: 0, nivelamento: 1,
      bobina: null, chapas: null, mesa: null, autoLote: false
    }, extra || {});
    m.dims = def.dims;
    PT.ent.add(m);
    // CLP visível (placeholder próprio para entrar na lista de modelos)
    const clp = PT.modelo('clp_padrao', { semRotulo: true });
    const pc = { x: -def.dims[0] / 2 + 1, z: def.dims[1] / 2 + 0.2 };
    clp.position.set(pc.x, 0, pc.z); m.g.add(clp);
    const mesa = PT.modelo('mesa_saida', { semRotulo: true, dims: [6, 1.4, 0.15] });
    mesa.position.set(def.dims[0] / 2 + 3.4, 0, 0); m.g.add(mesa);
    // luz de estado
    const luz = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshBasicMaterial({ color: 0x555555 }));
    luz.position.set(pc.x, 1.75, pc.z); m.g.add(luz); m.luz = luz;
    lista.push(m); atualizarEstado(m);
    return m;
  }
  // re-instala uma máquina movida (mantém configuração e desgaste)
  // a pilha da saída só "prende" a máquina se ainda estiver na mesa (não se a paleteira já levou)
  function mesaOcupada(m) {
    if (!m.mesa || !PT.ent.lista.includes(m.mesa) || m.mesa.preso) return false;
    const p = pontoSaida(m, m.mesa.comprimento); return Math.hypot(m.mesa.x - p.x, m.mesa.z - p.z) < 1;
  }
  // cancelar a mudança devolve a máquina exatamente como estava (com cabo); confirmar exige puxar o cabo de novo se mudou de lugar
  function reinstalar(salva, cancelou) { const m = instalar(salva.defId, salva.x, salva.z, salva.rot, salva.extra); if (cancelou && salva.conectada) PT.construcao.conectar(m); return m; }
  function desinstalar(m) {
    if (m.bobina || mesaOcupada(m) || m.ligada || (m.chapas && m.chapas.qtd > 0) || m.progressoM > 1e-6) { PT.ev.emit('aviso', 'Desligue e esvazie a máquina (bobina, chapas, mesa) antes de mover.'); return; }
    const conectada = !!m.cabo;
    PT.construcao.desconectar(m);
    lista.splice(lista.indexOf(m), 1); PT.ent.remover(m);
    const extra = { cfg: m.cfg, desgaste: m.desgaste, nivelamento: m.nivelamento, lubrificado: m.lubrificado };
    PT.construcao.iniciar({ itemId: m.defId, dims: m.def.dims, modelo: m.def.modelo, nome: m.def.nome, maqSalva: { defId: m.defId, x: m.x, z: m.z, rot: m.rot, extra, conectada } });
  }

  function atualizarEstado(m) {
    if (m.estado === 'enroscada') { /* fica até limpar */ }
    else if (!m.cabo) m.estado = 'sem_energia';
    else if (!m.ligada) m.estado = 'desligada';
    else if (m.estado === 'produzindo') { /* continua */ }
    else if (!temMaterial(m)) m.estado = 'sem_material';
    else if (m.def.entrada === 'bobina' && !m.alinhado) m.estado = 'desalinhada';
    else if (!['mesa_cheia', 'saida_obstruida', 'concluida'].includes(m.estado)) m.estado = 'pronta';
    const cor = { produzindo: 0x2ecc71, pronta: 0x58d68d, enroscada: 0xe74c3c, mesa_cheia: 0xf39c12, saida_obstruida: 0xf39c12, sem_material: 0xf39c12, desalinhada: 0xf39c12, concluida: 0x5dade2 }[m.estado] || 0x555555;
    m.luz.material.color.setHex(cor);
    if (PT.glb) PT.glb.luzTorre(m);   // torre de luz do CLP 3D
    if (m.g.userData.rotulo) m.g.userData.rotulo.userData.atualizar(m.nome + ' — ' + (NOMES_ESTADO[m.estado] || m.estado).split(' (')[0]);
    PT.ev.emit('maqEstado', m);
  }
  function temMaterial(m) { return m.def.entrada === 'bobina' ? (m.bobina && m.bobina.metros > 1e-6) : (m.chapas && m.chapas.qtd > 0); }

  // ---------- bobina ----------
  function tentarMontar(b) {
    const m = lista.find(m => m.def.entrada === 'bobina' && !m.bobina && Math.hypot(pontoEntrada(m).x - b.x, pontoEntrada(m).z - b.z) < 1.6);
    if (!m) return false;
    const p = pontoEntrada(m); b.x = p.x; b.z = p.z; b.y = 0.3; b.rot = m.rot; b.montadaEm = m.id;
    PT.ent.sync(b); m.bobina = b; m.alinhado = false; m.alinhamento = 0;
    PT.ev.emit('aviso', b.codigo + ' montada no desbobinador da ' + m.nome + '. Agora alinhe a chapa no CLP.');
    PT.ev.emit('bobinaMontada', { m, b });
    atualizarEstado(m); return true;
  }
  function desmontarBobina(b) {
    const m = lista.find(m => m.bobina === b); if (!m) return;
    if (m.estado === 'produzindo') parar(m, 'pronta');
    // peça pela metade não pode "emendar" com a próxima bobina: vira retalho (ChatGPT, bug 1)
    if (m.progressoM > 1e-6 && m.progressoM < m.cfg.comprimento - 1e-9) { m.sucataM = (m.sucataM || 0) + m.progressoM; PT.ev.emit('aviso', 'Bobina retirada no meio da peça: retalho de ' + m.progressoM.toFixed(2) + ' m (sucata).'); m.progressoM = 0; }
    m.bobina = null; b.montadaEm = null; m.alinhado = false; atualizarEstado(m);
  }

  // ---------- comandos do CLP ----------
  function ligar(m, v) {
    if (!m.cabo) { PT.ev.emit('aviso', 'Sem cabo do quadro.'); return; }
    m.ligada = v;
    if (v && PT.construcao.kwLigado() > PT.construcao.st.quadroKW) { desarmar(); return; }
    if (m.estado !== 'enroscada') m.estado = v ? 'pronta' : 'desligada';
    atualizarEstado(m);
  }
  function desarmar() {
    lista.forEach(x => { x.ligada = false; if (x.estado !== 'enroscada') x.estado = 'desligada'; atualizarEstado(x); });
    PT.ev.emit('celular', { de: 'Quadro elétrico', texto: 'TÁ! O disjuntor geral desarmou: ' + Math.round(PT.construcao.kwLigado()) + ' kW pedidos num quadro de ' + PT.construcao.st.quadroKW + ' kW. Compre um quadro maior ou ligue menos máquinas juntas.' });
    PT.ev.emit('sobrecarga', {});
  }
  function alinhar(m, nota) {
    if (!m.bobina) return;
    const base = m.def.alinhamentoBase;
    m.alinhamento = PT.util.clamp(nota * 0.7 + base * 0.3, 0, 1); m.alinhado = true;
    if (m.estado !== 'produzindo') m.estado = 'pronta';
    atualizarEstado(m);
  }
  function chanceTorta(m) {
    return PT.util.clamp((1 - m.alinhamento) * 0.45 + m.desgaste * 0.3 + (m.nivelamento < 0.6 ? 0.08 : 0), 0, 0.95);
  }
  function iniciar(m) {
    atualizarEstado(m);
    if (!['pronta', 'concluida', 'mesa_cheia', 'saida_obstruida'].includes(m.estado)) { PT.ev.emit('aviso', 'Não dá para iniciar: ' + NOMES_ESTADO[m.estado]); return false; }
    const c = m.cfg;
    if (c.comprimento < m.def.compMin || c.comprimento > m.def.compMax) { PT.ev.emit('aviso', 'Comprimento fora da faixa da máquina (' + m.def.compMin + '–' + m.def.compMax + ' m).'); return false; }
    if (m.estado === 'concluida') m.produzidas = 0;
    const sd = saidaDisponivel(m, c.produto, c.comprimento);
    if (sd !== 'ok') { PT.ev.emit('aviso', 'Não dá para iniciar: ' + NOMES_ESTADO[sd]); parar(m, sd); return false; }
    m.estado = 'produzindo'; atualizarEstado(m);
    PT.ev.emit('maqIniciou', m); return true;
  }
  function parar(m, motivo) { m.estado = motivo || 'pronta'; atualizarEstado(m); PT.ev.emit('maqParou', { m, motivo: m.estado }); }

  // ---------- saída ----------
  // a próxima peça cabe na saída? (não cria nada — só verifica)
  function saidaDisponivel(m, produto, comp) {
    if (m.mesa && PT.ent.lista.includes(m.mesa) && !m.mesa.preso && m.mesa.produto === produto && Math.abs(m.mesa.comprimento - comp) < 1e-6) {
      const p = pontoSaida(m, comp);
      if (Math.hypot(m.mesa.x - p.x, m.mesa.z - p.z) < 0.5) return m.mesa.qtd < m.def.mesaCap ? 'ok' : 'mesa_cheia';
    }
    const p = pontoSaida(m, comp);
    const fp = PT.construcao.footprint(p.x, p.z, [Math.max(0.5, comp), D.produtos[produto].larguraUtil + 0.05, 1], m.rot);
    const bate = PT.ent.lista.find(o => o !== m && !o.preso && o.aabb && o.tipo !== 'berco' && fp.x0 < o.aabb.x1 && fp.x1 > o.aabb.x0 && fp.z0 < o.aabb.z1 && fp.z1 > o.aabb.z0);
    return bate ? 'saida_obstruida' : 'ok';
  }
  function pilhaDeSaida(m, produto, comp) {
    if (m.mesa && PT.ent.lista.includes(m.mesa) && !m.mesa.preso && m.mesa.produto === produto && Math.abs(m.mesa.comprimento - comp) < 1e-6) {
      const p = pontoSaida(m, comp);
      if (Math.hypot(m.mesa.x - p.x, m.mesa.z - p.z) < 0.5) return m.mesa;
    }
    const p = pontoSaida(m, comp);
    const fp = PT.construcao.footprint(p.x, p.z, [Math.max(0.5, comp), D.produtos[produto].larguraUtil + 0.05, 1], m.rot);
    const bate = PT.ent.lista.find(o => o !== m && !o.preso && o.aabb && o.tipo !== 'berco' && fp.x0 < o.aabb.x1 && fp.x1 > o.aabb.x0 && fp.z0 < o.aabb.z1 && fp.z1 > o.aabb.z0);
    if (bate) return null;
    m.mesa = PT.estoque.novaPilha(produto, comp, p.x, p.z, { rot: m.rot, origem: m.id });
    return m.mesa;
  }

  // ---------- produção: 1 passo = 1 minuto de jogo ----------
  function passo(m) {
    if (m.ligada && m.cabo) PT.eco.registrarEnergia(m.def.kw * (m.estado === 'produzindo' ? 1 : 0.15), 1 / 60);
    if (m.estado !== 'produzindo') return;
    const c = m.cfg, def = m.def;
    const metrosMin = def.mPorMin * c.velocidade;
    // falha aleatória: enrosco (espiral de chapa), mais provável com desgaste e velocidade alta
    const pEnrosco = 0.0015 * (1 + m.desgaste * 6) * (c.velocidade > 0.9 ? 1.5 : 1) * (m.nivelamento < 0.6 ? 1.6 : 1);
    if (Math.random() < pEnrosco) { m.estado = 'enroscada'; atualizarEstado(m); PT.ev.emit('enrosco', m); return; }

    if (def.entrada === 'bobina') {
      // nada é consumido se a saída não pode receber a peça (ChatGPT, bug 2)
      const sd = saidaDisponivel(m, c.produto, c.comprimento);
      if (sd !== 'ok') { parar(m, sd); return; }
      let metros = metrosMin;
      while (metros > 1e-9 && m.bobina && m.bobina.metros > 1e-6) {
        const falta = c.comprimento - m.progressoM;
        const usado = PT.estoque.consumir(m.bobina, Math.min(metros, falta));
        m.progressoM += usado; metros -= usado; gastar(m, usado);
        if (m.progressoM >= c.comprimento - 1e-9) {
          if (!sairPeca(m, c.produto, c.comprimento)) return;      // peça pronta fica na máquina até liberar a saída
          m.progressoM = 0;
          if (m.produzidas >= c.quantidade) { parar(m, 'concluida'); PT.ev.emit('loteConcluido', m); return; }
          if (saidaDisponivel(m, c.produto, c.comprimento) !== 'ok') { parar(m, saidaDisponivel(m, c.produto, c.comprimento)); return; }
        }
        if (usado <= 1e-9) break;
      }
      if (m.bobina && m.bobina.metros <= 1e-6) {
        PT.ev.emit('celular', { de: m.nome, texto: 'Bobina ' + m.bobina.codigo + ' acabou. Sobrou só o tubete.' });
        const b = m.bobina; m.bobina = null; m.alinhado = false; PT.ent.remover(b);
        // pedaço que não completou uma peça vira RETALHO (sucata) — não continua na próxima bobina
        if (m.progressoM > 1e-6) { PT.ev.emit('aviso', 'Fim de chapa: sobrou um retalho de ' + m.progressoM.toFixed(2) + ' m (sucata).'); m.sucataM = (m.sucataM || 0) + m.progressoM; m.progressoM = 0; }
        parar(m, 'sem_material');
      }
    } else {
      // entrada de chapas: cada chapa vira N peças do comprimento da chapa
      m.progressoM += metrosMin;
      const comp = m.chapas.comprimento, porChapa = Math.max(1, Math.floor(1.2 / D.produtos[c.produto].larguraUtil));
      gastar(m, metrosMin);
      const sd = saidaDisponivel(m, c.produto, comp);
      if (sd !== 'ok') { m.progressoM -= metrosMin; parar(m, sd); return; }
      while (m.progressoM >= comp * porChapa && m.chapas.qtd > 0) {
        m.progressoM -= comp * porChapa;
        m.chapas.qtd -= 1; const torta = m.chapas.defeituosas > 0 ? (m.chapas.defeituosas--, true) : false;
        // não passa da quantidade programada; o resto da chapa vira retalho (ChatGPT, bug 3)
        const fazer = Math.min(porChapa, c.quantidade - m.produzidas);
        if (fazer < porChapa) m.sucataM = (m.sucataM || 0) + comp * (porChapa - fazer) * D.produtos[c.produto].larguraUtil;
        for (let i = 0; i < fazer; i++) if (!sairPeca(m, c.produto, comp, torta)) return;
        if (m.produzidas >= c.quantidade) { m.progressoM = 0; parar(m, 'concluida'); PT.ev.emit('loteConcluido', m); return; }
      }
      if (m.chapas.qtd <= 0) { m.chapas = null; parar(m, 'sem_material'); }
    }
  }
  function gastar(m, metros) {
    let k = m.def.desgastePorM * (m.lubrificado > 0 ? 0.4 : 1) * (m.defId === 'perf_tp40_usada' ? 0.8 : 1);
    m.desgaste = Math.min(1, m.desgaste + metros * k);
    m.lubrificado = Math.max(0, m.lubrificado - metros);
  }
  function sairPeca(m, produto, comp, tortaForcada) {
    const pilha = pilhaDeSaida(m, produto, comp);
    if (!pilha) { parar(m, 'saida_obstruida'); return false; }
    if (pilha.qtd >= m.def.mesaCap) { parar(m, 'mesa_cheia'); PT.ev.emit('celular', { de: m.nome, texto: 'Mesa de saída cheia (' + pilha.qtd + '). Tira a pilha com a paleteira!' }); return false; }
    const torta = tortaForcada || Math.random() < chanceTorta(m);
    PT.estoque.addNaPilha(pilha, 1, torta ? 1 : 0);
    m.produzidas++;
    PT.ev.emit('peca', { m, produto, comp, torta });
    return true;
  }

  PT.ev.on('minuto', () => lista.forEach(passo));
  // noite: máquina esquecida ligada gasta energia a noite toda
  PT.ev.on('noite', ({ horas }) => {
    const lig = lista.filter(m => m.ligada && m.cabo);
    lig.forEach(m => { PT.eco.registrarEnergia(m.def.kw * 0.15, horas); if (m.estado === 'produzindo') parar(m, 'pronta'); });
    if (lig.length) PT.ev.emit('celular', { de: 'Conta de luz', texto: lig.length + ' máquina(s) ficaram ligadas a noite toda. O medidor agradece.' });
  });

  // ---------- interações perto da máquina ----------
  PT.inter.registrar(j => {
    if (j.controlando) return null;
    const m = PT.ent.perto(j.x, j.z, 2.6, o => o.tipo === 'maquina');
    if (!m) return null;
    const ops = [];
    const c = j.carregando;
    if (c && c.tipo === 'paleteira' && c.carga && c.carga.tipo === 'pilha' && c.carga.produto === 'CHAPA' && m.def.entrada === 'chapa') {
      ops.push({ rotulo: 'Abastecer ' + m.nome + ' com ' + c.carga.qtd + ' chapas', prio: 1, acao: () => {
        const p = c.carga; m.chapas = { qtd: p.qtd, comprimento: p.comprimento, defeituosas: p.defeituosas };
        c.carga = null; c.lento = 0.75; PT.ent.remover(p); atualizarEstado(m); PT.ev.emit('aviso', 'Chapas na entrada da dobradeira.'); } });
    }
    if (c) return ops;
    if (!m.cabo) ops.push({ rotulo: 'Puxar cabo do quadro até a ' + m.nome, prio: 1, acao: () => { PT.construcao.conectar(m); atualizarEstado(m); } });
    ops.push({ rotulo: 'Abrir painel CLP — ' + (NOMES_ESTADO[m.estado] || m.estado), prio: 2, acao: () => PT.ui.abrirCLP(m) });
    if (m.estado === 'enroscada') ops.unshift({ rotulo: 'Cortar o enrosco com a esmerilhadeira (faíscas!)', prio: 0, acao: () => {
      PT.ui.progresso('Cortando a espiral de chapa...', 3, () => { m.estado = m.ligada ? 'pronta' : 'desligada'; atualizarEstado(m); PT.ev.emit('aviso', 'Enrosco limpo. Os pedaços foram para a caçamba de sucata.'); }); } });
    ops.push({ rotulo: 'Passar graxa nos rolos (desgaste ' + Math.round(m.desgaste * 100) + '%)', prio: 6, acao: () => {
      PT.ui.progresso('Graxeira nos rolos...', 2, () => { m.lubrificado = 300; PT.ev.emit('aviso', 'Rolos engraxados: desgaste mais lento nos próximos 300 m.'); }); } });
    if (!m.ligada && !m.bobina) ops.push({ rotulo: 'Mover a máquina (desinstalar)', prio: 8, acao: () => desinstalar(m) });
    return ops;
  });

  return {
    lista, NOMES_ESTADO, instalar, reinstalar, desinstalar, tentarMontar, desmontarBobina, ligar, alinhar, iniciar, parar,
    chanceTorta, atualizarEstado, pontoEntrada, pontoSaida, saidaDisponivel, mesaOcupada,
    salvar() {
      return lista.map(m => ({ defId: m.defId, x: m.x, z: m.z, rot: m.rot, ligada: m.ligada, conectada: !!m.cabo, estado: m.estado === 'produzindo' ? 'pronta' : m.estado,
        cfg: m.cfg, alinhamento: m.alinhamento, alinhado: m.alinhado, produzidas: m.produzidas, desgaste: m.desgaste, lubrificado: m.lubrificado,
        nivelamento: m.nivelamento, autoLote: !!m.autoLote, progressoM: m.progressoM, sucataM: m.sucataM || 0, bobinaCodigo: m.bobina ? m.bobina.codigo : null, chapas: m.chapas, mesaId: m.mesa ? m.mesa.id : null }));
    },
    carregar(arr) {
      arr.forEach(s => {
        const m = instalar(s.defId, s.x, s.z, s.rot, { cfg: s.cfg, alinhamento: s.alinhamento, alinhado: s.alinhado, produzidas: s.produzidas,
          desgaste: s.desgaste, lubrificado: s.lubrificado, nivelamento: s.nivelamento, chapas: s.chapas,
          progressoM: Number.isFinite(s.progressoM) && s.progressoM >= 0 ? s.progressoM : 0, sucataM: s.sucataM || 0, autoLote: !!s.autoLote });
        if (s.conectada) PT.construcao.conectar(m);
        m.ligada = s.ligada; m.estado = s.estado;
        if (s.bobinaCodigo) { const b = PT.ent.lista.find(o => o.tipo === 'bobina' && o.codigo === s.bobinaCodigo); if (b) { m.bobina = b; b.montadaEm = m.id; } }
        if (s.mesaId) m.mesa = PT.ent.lista.find(o => o.id === s.mesaId) || null;
        atualizarEstado(m);
      });
    }
  };
})();
