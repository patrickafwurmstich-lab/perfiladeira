// =====================================================================
// ponte.js — ponte rolante com BOTOEIRA PENDENTE.
// E perto do gancho pega a botoeira. Com ela: WASD move ponte/carro
// (relativo à câmera) e o jogador anda junto; R sobe, F desce o gancho;
// ESPAÇO engata/solta; E larga a botoeira.
// A ponte anda em TEMPO REAL (não acelera com x20) — é o jogador operando.
// Sobrecarga: cabo amarelo → vermelho vibrando → ESTOURA em ~3 s.
// A carga presa é "filha" do gancho (sem física) até soltar.
// =====================================================================
window.PT = window.PT || {};

PT.ponte = (function () {
  const M = PT.DADOS.mundo, PC = M.ponte;
  const st = { x: PC.xIni, z: PC.zIni, y: 6, carga: null, estresse: 0, rompida: 0, capacidade: PC.capacidadeKg,
               vx: 0, vz: 0, swx: 0, swz: 0, svx: 0, svz: 0, rangeu: 0 };
  const caindo = [];   // {o, vy}
  let viga, carro, cabo, gancho;

  function init() {
    const sc = PT.mundo.scene;
    viga = PT.modelo('ponte_viga', { semRotulo: true }); sc.add(viga);
    carro = PT.modelo('ponte_carro', { semRotulo: true }); sc.add(carro);
    // cabo: cilindro de 1 m com base na origem, esticado em Y conforme a altura do gancho
    cabo = new THREE.Group();
    const cm = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 1, 8), new THREE.MeshLambertMaterial({ color: 0x888888 }));
    cabo.add(cm); cabo.userData.mesh = cm; sc.add(cabo);
    PT.registroModelos.usos.ponte_cabo = 1; PT.registroModelos.max.ponte_cabo = 1;
    gancho = PT.modelo('ponte_gancho', { rotulo: 'Gancho — ' + st.capacidade + ' kg' }); sc.add(gancho);
    PT.registroModelos.usos.botoeira = 1; PT.registroModelos.max.botoeira = 1;
  }

  function corCabo() {
    if (st.rompida > 0) return 0x444444;
    if (!st.carga) return 0x888888;
    const r = st.carga.pesoKg / st.capacidade;
    if (st.estresse > 1.5) return 0xe74c3c;
    if (r > 1 || st.estresse > 0) return 0xf1c40f;
    if (r > 0.85) return 0xd4ac0d;
    return 0x888888;
  }

  function alturaMinGancho() { return st.carga ? st.carga.g.userData.altura * cargaEscala() + 0.02 : PC.ganchoMin; }
  function cargaEscala() { return st.carga && st.carga.tipo === 'bobina' ? st.carga.g.userData.mesh.scale.x : 1; }

  // ---------- controle pela botoeira ----------
  const controle = {
    nome: 'botoeira',
    controlar(dt, t) {
      dt = Math.min(dt, 0.05);
      let fx = 0, fz = 0;
      if (t.KeyW) fz -= 1; if (t.KeyS) fz += 1; if (t.KeyA) fx -= 1; if (t.KeyD) fx += 1;
      const s = Math.sin(PT.mundo.cam.yaw), c = Math.cos(PT.mundo.cam.yaw);
      const mx = fx * c + fz * s, mz = -fx * s + fz * c;
      const lento = t.ShiftLeft ? 0.35 : 1;            // SHIFT = velocidade de precisão
      const ax = mx * PC.vel.ponte * lento, az = mz * PC.vel.carro * lento;
      st.svx += (st.vx - ax) * 0.9; st.svz += (st.vz - az) * 0.9;   // "tranco" alimenta o balanço
      st.vx = ax; st.vz = az;
      const nx = PT.util.clamp(st.x + st.vx * dt, 1, M.L - 1), nz = PT.util.clamp(st.z + st.vz * dt, 1, M.D - 1);
      // a carga pendurada não atravessa máquinas, pilhas e paredes: precisa subir o gancho (ChatGPT, bug 7)
      if (!cargaBate(nx, st.z)) st.x = nx; else avisoBate();
      if (!cargaBate(st.x, nz)) st.z = nz; else avisoBate();
      if (st.rompida <= 0) {
        if (t.KeyR) st.y = Math.min(PC.alturaTrilho - 1.2, st.y + PC.vel.gancho * dt);
        if (t.KeyF) st.y = Math.max(alturaMinGancho(), st.y - PC.vel.gancho * dt);
      }
      // jogador acompanha a carga a 1,6 m (lado da câmera), sem entrar em parede
      const j = PT.mundo.jog;
      const ox = st.x + Math.sin(PT.mundo.cam.yaw) * 1.6, oz = st.z + Math.cos(PT.mundo.cam.yaw) * 1.6;
      const p = PT.mundo.empurrar(ox, oz, PT.DADOS.personagem.raio);
      j.x += (p.x - j.x) * Math.min(1, dt * 8); j.z += (p.z - j.z) * Math.min(1, dt * 8);
      j.rot = Math.atan2(st.x - j.x, st.z - j.z);
    }
  };

  function cargaBate(x, z) {
    const o = st.carga; if (!o) return false;
    const base = st.y - o.g.userData.altura * cargaEscala();
    const fp = PT.construcao.footprint(x, z, o.dims, o.rot);
    if (base < 3.3 && PT.mundo.paredes.some(p => PT.construcao.cruza(fp, p))) return true;
    const fpAgora = PT.construcao.footprint(st.x, st.z, o.dims, o.rot);
    const topo = e => e.y + e.g.userData.altura * (e.tipo === 'bobina' ? e.g.userData.mesh.scale.x : 1);
    // bate se vai entrar num objeto mais alto que a base da carga (e se já não estava encostado nele — para poder sair)
    return PT.ent.lista.some(e => e !== o && !e.preso && e.aabb && PT.construcao.cruza(fp, e.aabb) && base < topo(e) - 0.05 && !PT.construcao.cruza(fpAgora, e.aabb));
  }
  let ultAviso = 0;
  function avisoBate() { const t = performance.now(); if (t - ultAviso > 2500) { ultAviso = t; PT.ev.emit('aviso', 'A carga vai bater! Suba o gancho (R).'); } }

  function pegarBotoeira() { PT.mundo.jog.controlando = controle; PT.ev.emit('aviso', 'Botoeira na mão: WASD move, R/F gancho, ESPAÇO engata, SHIFT precisão, E larga.'); }
  function largarBotoeira() { PT.mundo.jog.controlando = null; }

  PT.ev.on('tecla', code => {
    if (PT.mundo.jog.controlando !== controle || PT.ui.modalAberto()) return;
    if (code === 'Space') engatarOuSoltar();
  });

  function engatarOuSoltar() {
    if (st.rompida > 0) { PT.ev.emit('aviso', 'Cabo rompido! Esperando o técnico.'); return; }
    if (!st.carga) {
      const o = PT.ent.perto(st.x, st.z, 1.2, e => e.icavel && !e.preso);
      if (!o) { PT.ev.emit('aviso', 'Nada para engatar aqui embaixo.'); return; }
      const topo = o.y + o.g.userData.altura * (o.tipo === 'bobina' ? o.g.userData.mesh.scale.x : 1);
      if (st.y - topo > 0.7) { PT.ev.emit('aviso', 'Desça mais o gancho (F).'); return; }
      st.carga = o; o.preso = 'ponte'; st.estresse = 0; st.y = Math.max(st.y, topo);
      if (o.montadaEm) PT.maq.desmontarBobina(o);
      PT.ev.emit('engatou', o);
      const r = o.pesoKg / st.capacidade;
      if (r > 1) PT.ev.emit('celular', { de: 'Vendedor', texto: 'Essa ponte é de ' + st.capacidade + ' kg, patrão... e isso aí pesa ' + Math.round(o.pesoKg) + '. Não diga que eu não avisei!' });
      else if (r > 0.85) PT.ev.emit('aviso', 'A ponte guincha... ' + Math.round(r * 100) + '% da capacidade.');
    } else {
      soltar(false);
    }
  }

  function soltar(rompeu) {
    const o = st.carga; if (!o) return;
    st.carga = null; o.preso = null; st.estresse = 0;
    // em cima do desbobinador de uma máquina? monta direto
    if (!rompeu && o.tipo === 'bobina' && PT.maq.tentarMontar(o)) return;
    if (o.y > 0.4) caindo.push({ o, vy: 0, de: o.y, rompeu });
    else { o.y = 0; PT.ent.sync(o); PT.ev.emit('soltou', o); }
  }

  // ---------- frame ----------
  function atualizar(dt) {
    dt = Math.min(dt, 0.05);
    if (st.rompida > 0) { st.rompida -= PT.tempo.minutosDeJogo(dt); if (st.rompida <= 0) { st.y = 6; PT.ev.emit('celular', { de: 'Técnico da ponte', texto: 'Cabo novo instalado! E dessa vez respeita a plaquinha de capacidade, viu?' }); } }
    // balanço (mola amortecida) — só visual
    st.svx += -st.swx * 18 * dt; st.svz += -st.swz * 18 * dt; st.svx *= (1 - 2.5 * dt); st.svz *= (1 - 2.5 * dt);
    st.swx += st.svx * dt * 0.08; st.swz += st.svz * dt * 0.08;
    st.swx = PT.util.clamp(st.swx, -0.6, 0.6); st.swz = PT.util.clamp(st.swz, -0.6, 0.6);
    if (!st.carga && !PT.mundo.jog.controlando) { st.swx *= 0.95; st.swz *= 0.95; }

    // sobrecarga
    if (st.carga) {
      const acima = st.carga.y > 0.15 || st.y > alturaMinGancho() + 0.15;
      if (st.carga.pesoKg > st.capacidade && acima) {
        st.estresse += dt;
        st.rangeu -= dt; if (st.rangeu <= 0) { st.rangeu = 0.9; PT.ev.emit('rangido', st.estresse); }
        if (st.estresse >= PC.estresseSegundos) romper();
      } else st.estresse = Math.max(0, st.estresse - dt);
    }

    // visual
    const vib = st.estresse > 1.5 ? (Math.random() - 0.5) * 0.08 : 0;
    // com os modelos 3D o carro roda em cima do trilho da viga (topo a 1,08 m) e o cabo sai do tambor
    const g3 = PT.glb && PT.glb.ativo('ponte_viga'), olhal = (PT.glb && PT.glb.ativo('ponte_gancho')) ? 0.72 : 0.8;
    const yViga = PC.alturaTrilho + 0.25, yCarro = g3 ? yViga + 1.08 : PC.alturaTrilho + 0.75;
    viga.position.set(st.x, yViga, M.D / 2);
    carro.position.set(st.x, yCarro, st.z);
    const hx = st.x + st.swx + vib, hz = st.z + st.swz + vib;
    const topoCabo = g3 ? yCarro + 0.4 : yCarro, comp = Math.max(0.05, topoCabo - st.y - olhal);
    cabo.visible = st.rompida <= 0;
    cabo.position.set((st.x + hx) / 2, st.y + olhal, (st.z + hz) / 2);
    cabo.scale.set(1, comp, 1); cabo.userData.mesh.position.y = 0.5;
    cabo.rotation.set(Math.atan2(hz - st.z, comp) * 0.9, 0, -Math.atan2(hx - st.x, comp) * 0.9);
    cabo.userData.mesh.material.color.setHex(corCabo());
    gancho.position.set(hx, st.rompida > 0 ? topoCabo - 1.5 : st.y, hz);
    if (st.carga) {
      const o = st.carga;
      o.x = hx; o.z = hz; o.y = st.y - o.g.userData.altura * cargaEscala();
      PT.ent.sync(o);
    }
    // quedas
    caindo.slice().forEach(q => {
      q.vy -= 9.8 * dt; q.o.y += q.vy * dt;
      if (q.o.y <= 0) {
        q.o.y = 0; PT.ent.sync(q.o); caindo.splice(caindo.indexOf(q), 1);
        aterrissou(q);
      } else PT.ent.sync(q.o);
    });
  }

  function aterrissou(q) {
    const o = q.o, j = PT.mundo.jog;
    const pesada = o.pesoKg >= 500, alto = q.de > 1.2;
    if (pesada && alto) PT.zoeira.cicatriz(o.x, o.z, o.pesoKg > 1500 ? 2 : 1);
    PT.ev.emit('impacto', { o, altura: q.de });
    const dist = Math.hypot(j.x - o.x, j.z - o.z);
    if (pesada && alto && dist < PC.raioMorte && !j.morto) PT.zoeira.morrer(q.rompeu ? 'cabo' : 'geral', o);
    else if (pesada && alto) PT.zoeira.acidente('Bobina despencou de ' + q.de.toFixed(1) + ' m!');
  }

  function romper() {
    PT.ev.emit('caboRompeu', { carga: st.carga });
    soltar(true);
    st.rompida = 60;                    // 1 h de jogo até o técnico trocar o cabo (sem custo: zoeira não tira progresso)
    largarBotoeira();
  }

  // ---------- interação ----------
  PT.inter.registrar(j => {
    if (j.controlando === controle) return [{ rotulo: 'Largar a botoeira', acao: largarBotoeira }];
    if (j.controlando || j.carregando) return null;
    if (Math.hypot(j.x - st.x, j.z - st.z) < PC.alcanceBotoeira) return [{ rotulo: 'Pegar a botoeira da ponte', prio: 2, acao: pegarBotoeira }];
    return null;
  });

  return {
    st, init, atualizar, controle, emOperacao: () => !!st.carga || caindo.length > 0,
    salvar() { return { x: st.x, z: st.z, y: st.y, capacidade: st.capacidade, rompida: Math.max(0, st.rompida) }; },
    carregar(o) { Object.assign(st, { rompida: 0 }, o, { carga: null, estresse: 0 }); }
  };
})();
