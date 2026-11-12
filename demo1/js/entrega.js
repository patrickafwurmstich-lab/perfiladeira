// =====================================================================
// entrega.js — caminhão em trilho fixo pelo corredor.
// Fornecedor: entra pelo portão, para na zona amarela, deixa volumes
// pequenos no chão; volumes grandes ficam NA CARROCERIA até a ponte
// tirar. Obstáculo no corredor: para a 2 m, buzina e reclama.
// Coleta de cliente (pedidos.js) usa o mesmo caminhão até a zona verde.
// =====================================================================
window.PT = window.PT || {};

PT.entrega = (function () {
  const M = PT.DADOS.mundo, CM = M.caminhao;
  const st = { fila: [], caminhoes: [] };   // fila: {dia, itens[], de, tipo:'fornecedor'|'coleta', pedidoId}

  function agendar(dia, itens, de, extra) { st.fila.push(Object.assign({ dia, itens, de, tipo: 'fornecedor', hora: 9 }, extra || {})); }

  // cria o caminhão físico
  function despachar(e) {
    const g = PT.modelo('caminhao_entrega', { rotulo: e.tipo === 'coleta' ? 'Coleta — ' + e.de : 'Entrega — ' + e.de });
    const zona = e.tipo === 'coleta' ? M.zonas.expedicao : M.zonas.recebimento;
    const c = { e, g, x: CM.xEntrada, estado: 'chegando', paradaX: (zona.x0 + zona.x1) / 2, carroceria: [], espera: 0, buzinou: 0 };
    g.position.set(c.x, 0, CM.z); g.rotation.y = 0;   // comprimento do caminhão ao longo do corredor (X), cabine para +X
    PT.mundo.scene.add(g); st.caminhoes.push(c);
    PT.ev.emit('celular', { de: e.de, texto: e.tipo === 'coleta' ? 'Caminhão da coleta entrando no pátio.' : 'Seu pedido chegou! Tô entrando no barracão.' });
    return c;
  }

  // algo bloqueando o corredor à frente?
  function bloqueio(c) {
    const frente = c.x + 6;        // meio caminhão (12 m)
    return PT.ent.lista.find(o => o.aabb && !o.preso && o.tipo !== 'pilhaCaminhao' &&
      o.aabb.z1 > M.corredor.z0 && o.aabb.z0 < M.corredor.z1 &&
      o.aabb.x0 < frente + CM.distParada + 0.5 && o.aabb.x1 > frente && !c.carroceria.includes(o));
  }

  function descarregar(c) {
    let xs = c.x - 4.5;
    c.e.itens.forEach(id => {
      const f = PT.loja.ficha(id);
      if (f.tipoItem === 'maquina') {
        const d = f.dims;
        const o = PT.ent.add({ tipo: 'volume', modelo: 'volume_engradado', item: id, rotulo: 'Engradado: ' + f.nome,
          dimsVisual: [Math.min(d[0], 4), d[1], d[2] + 0.2], pesoKg: f.pesoKg, icavel: true, solido: true,
          x: xs + 1.5, z: CM.z, y: 1.0 });
        c.carroceria.push(o); xs += 4;
      } else if (f.tipoItem === 'empilhadeira') {
        // veículo desce pela rampa do caminhão e fica na zona amarela
        const zr = M.zonas.recebimento; PT.empi.criar(zr.x0 + 3, zr.z1 - 1.5, 0);
        PT.ev.emit('celular', { de: c.e.de, texto: 'Desci a empilhadeira pela rampa. A chave tá no contato!' });
      } else if (f.tipoItem === 'bobina') {
        const o = PT.estoque.novaBobina(id, xs + 0.7, CM.z, 1.0); c.carroceria.push(o); xs += 1.8;
      } else {
        // pequeno: motorista deixa no chão da zona amarela
        const zr = M.zonas.recebimento;
        PT.ent.add({ tipo: 'volume', modelo: 'volume_caixa', item: id, rotulo: f.nome, pesoKg: f.pesoKg || 20, pequeno: true, solido: false,
          x: PT.util.rand(zr.x0 + 1, zr.x1 - 1), z: PT.util.rand(zr.z0 + 1, zr.z1 - 1) });
      }
    });
    if (c.carroceria.length) PT.ev.emit('celular', { de: c.e.de, texto: 'Os volumes grandes tão na carroceria. Pega com a ponte que eu não tenho guindaste não!' });
  }

  function atualizar(dt) {
    const sDt = Math.min(dt * PT.tempo.vel, 1);      // segundos "acelerados", com teto anti-túnel
    st.caminhoes.slice().forEach(c => {
      if (c.estado === 'chegando') {
        const b = bloqueio(c);
        c.bloqueado = !!b;
        if (b) {
          c.buzinou -= dt;
          if (c.buzinou <= 0) { c.buzinou = 12; PT.ev.emit('buzina', { de: c.e.de, texto: 'BÉÉÉÉM! Ô patrão, tira essa tranqueira da frente que eu tenho horário!' }); if (c.e.tipo === 'coleta' && PT.rep) PT.rep.efeito('pontualidade', PT.DADOS.reputacao.efeitos.caminhaoEsperando); }
          return;
        }
        // anda em sub-passos de 0,5 m e checa o bloqueio em cada um (anti-túnel no tempo acelerado)
        let resta = CM.velocidade * sDt;
        while (resta > 0 && c.x < c.paradaX) { const p = Math.min(0.5, resta); c.x = Math.min(c.paradaX, c.x + p); resta -= p; if (bloqueio(c)) break; }
        if (c.x >= c.paradaX) {
          c.estado = 'parado';
          if (c.e.tipo === 'coleta') PT.ev.emit('coletaChegou', c); else descarregar(c);
        }
      } else if (c.estado === 'parado') {
        // carroceria acompanha o caminhão; quando tudo saiu, vai embora
        c.carroceria = c.carroceria.filter(o => PT.ent.lista.includes(o) && !o.preso && Math.abs(o.y - 1.0) < 0.05 && Math.abs(o.z - CM.z) < 1.5 && Math.abs(o.x - c.x) < 6.5);
        if (c.e.tipo === 'fornecedor' && c.carroceria.length === 0) partir(c);
        if (c.e.tipo === 'fornecedor' && c.espera > 120 && !c.reclamou) { c.reclamou = true; PT.ev.emit('celular', { de: c.e.de, texto: 'Patrão, faz 2 horas que eu tô aqui parado... a diária do caminhão é cara! Mais 1 hora e eu levo de volta.' }); }
        // fornecedor esquecido: leva o que sobrou na carroceria e volta amanhã (sem cobrar de novo) — ChatGPT, bug 2
        if (c.e.tipo === 'fornecedor' && c.espera > PT.DADOS.mundo.caminhao.esperaMaxMin && c.carroceria.length) {
          const itens = c.carroceria.map(o => o.item || o.spec); c.carroceria.forEach(o => PT.ent.remover(o)); c.carroceria = [];
          agendar(PT.tempo.st.dia + 1, itens, c.e.de); partir(c);
          PT.ev.emit('celular', { de: c.e.de, texto: 'Cansei. Levei ' + itens.length + ' volume(s) de volta e trago amanhã às 9h.' });
        }
      } else if (c.estado === 'saindo') {
        c.x += CM.velocidade * sDt;
        if (c.x > CM.xSaida) { PT.mundo.scene.remove(c.g); c.g.userData.liberar(); st.caminhoes.splice(st.caminhoes.indexOf(c), 1); }
      }
      c.g.position.set(c.x, 0, CM.z);
    });
  }
  // carga visual na carroceria da coleta (só visual — o estoque real está no manifesto) — ChatGPT, bug 3
  function cargaVisual(c, comprimento, n) {
    c.visuais = c.visuais || 0;
    const h = 0.05 + 0.02 * n, box = new THREE.Mesh(new THREE.BoxGeometry(1.05, h, Math.max(0.5, comprimento)), new THREE.MeshLambertMaterial({ color: 0x5dade2 }));
    box.position.set(-0.6 + (c.visuais % 2) * 1.2, 1.25 + h / 2, -4 + Math.floor(c.visuais / 2) * (comprimento + 0.3)); c.g.add(box); c.visuais++;
  }
  function partir(c) { if (c.estado !== 'saindo') { c.estado = 'saindo'; PT.ev.emit('caminhaoSaiu', c); } }

  // verifica a fila a cada minuto de jogo
  PT.ev.on('minuto', ({ dia, minutos }) => {
    st.caminhoes.forEach(c => { if (c.estado === 'parado') c.espera += 1; });   // espera conta em minutos de JOGO (passo fixo)
    // caminhão travado na entrada por obstáculo: depois do limite, desiste e volta amanhã — ChatGPT, bug 1
    st.caminhoes.slice().forEach(c => {
      if (c.estado !== 'chegando' || !c.bloqueado) return;
      c.esperaBloqueio = (c.esperaBloqueio || 0) + 1;
      if (c.esperaBloqueio > PT.DADOS.mundo.caminhao.esperaMaxMin / 2) {
        PT.ev.emit('celular', { de: c.e.de, texto: 'Não deu pra entrar, o corredor tá trancado. Volto amanhã!' });
        agendar(PT.tempo.st.dia + 1, c.e.itens, c.e.de, { tipo: c.e.tipo, pedidoId: c.e.pedidoId, hora: c.e.tipo === 'coleta' ? 14 : 9 });
        if (c.e.tipo === 'coleta' && PT.rep) PT.rep.efeito('pontualidade', PT.DADOS.reputacao.efeitos.caminhaoEsperando * 5);
        PT.mundo.scene.remove(c.g); c.g.userData.liberar(); st.caminhoes.splice(st.caminhoes.indexOf(c), 1);
      }
    });
    const h = minutos / 60;
    st.fila.slice().forEach(e => {
      if (dia > e.dia || (dia === e.dia && h >= e.hora)) {
        // um caminhão por vez no corredor
        // faixa livre: nenhum caminhão parado/chegando e quem está saindo já se afastou da entrada
        if (st.caminhoes.some(c => c.estado !== 'saindo' || c.x < CM.xEntrada + 25)) return;
        st.fila.splice(st.fila.indexOf(e), 1); despachar(e);
      }
    });
  });

  return {
    st, agendar, atualizar, partir, despachar, cargaVisual,
    salvar() { return { fila: st.fila }; },     // caminhão em movimento não é salvo: volta para a fila
    carregar(o) { st.fila = o.fila || []; }
  };
})();
