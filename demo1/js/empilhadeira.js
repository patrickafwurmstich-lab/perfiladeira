// =====================================================================
// empilhadeira.js — Fase 2 (ordem do Gemini: 2º). Arcade com consequência.
// E entra/sai · ao entrar aparece o prompt do CINTO (C) · W/S acelera/ré
// A/D vira (direção traseira: curva depende da velocidade) · R/F garfo
// ESPAÇO pega/solta a carga na frente (garfo baixo).
// Bobina SÓ com MANDRIL — sem ele a bobina rola e amassa o capô.
// Curva rápida + garfo alto + carga pesada = TOMBA:
//   com cinto: fica preso na gaiola (desvirar leva tempo); sem cinto: é arremessado.
// =====================================================================
window.PT = window.PT || {};

PT.empi = (function () {
  const E = () => PT.DADOS.empilhadeira;
  let atual = null;               // empilhadeira que o jogador está dirigindo
  let ultAviso = 0;

  function criar(x, z, rot, extra) {
    const o = PT.ent.add(Object.assign({ tipo: 'empilhadeira', modelo: 'empilhadeira_eletrica', rotulo: 'Empilhadeira elétrica', x, z, rot: rot || 0, solido: true,
      garfoY: 0, vel: 0, carga: null, acessorio: 'garfos', bateria: 1, cinto: false, tombada: 0 }, extra || {}));
    // garfo (placeholder separado para ver a altura)
    const g = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.08, 1.1), new THREE.MeshLambertMaterial({ color: 0x222222 }));
    const g2 = g.clone(); g.position.set(1.7, 0.1, -0.3); g2.position.set(1.7, 0.1, 0.3);
    o.g.add(g); o.g.add(g2); o.garfos = [g, g2];
    atualizarVisual(o);
    return o;
  }
  function atualizarVisual(o) {
    o.garfos.forEach(g => { g.position.y = 0.1 + o.garfoY; g.rotation.y = Math.PI / 2; g.material.color.setHex(o.acessorio === 'mandril' ? 0x8e44ad : 0x222222); });
    if (o.g.userData.rotulo) o.g.userData.rotulo.userData.atualizar((o.bateria <= E().alertaBateria ? '🔋! ' : '') + 'Empilhadeira ' + Math.round(o.bateria * 100) + '%' + (o.acessorio === 'mandril' ? ' + mandril' : '') + (o.tombada > 0 ? ' — TOMBADA' : ''));
    o.g.rotation.z = o.tombada > 0 ? Math.PI / 2 * 0.95 : 0;
  }
  function frente(o, d) { return { x: o.x + Math.cos(o.rot) * d, z: o.z - Math.sin(o.rot) * d }; }   // frente = +X local

  // ---------- dirigir ----------
  const controle = {
    nome: 'empilhadeira',
    controlar(dt, t) {
      const o = atual; if (!o) return;
      dt = Math.min(dt, 0.05);
      const D = E();
      if (o.tombada > 0) { o.vel = 0; return; }
      const pesoCarga = o.carga ? (o.carga.pesoKg || 0) : 0;
      const vmax = D.velMax * (1 - Math.min(0.5, pesoCarga / D.capacidadeKg * 0.4)) * (o.bateria > 0 ? 1 : 0);
      let acel = 0; if (t.KeyW) acel = 1; if (t.KeyS) acel = -1;
      if (acel) o.vel += acel * D.aceleracao * dt; else o.vel *= Math.pow(0.15, dt);
      o.vel = PT.util.clamp(o.vel, -vmax * 0.5, vmax);
      let giro = 0; if (t.KeyA) giro = 1; if (t.KeyD) giro = -1;
      const taxaGiro = giro * D.giro * Math.min(1, Math.abs(o.vel) / 1.2) * Math.sign(o.vel || 1);
      if (t.KeyR) o.garfoY = Math.min(D.garfoMax, o.garfoY + D.velGarfo * dt);
      if (t.KeyF) o.garfoY = Math.max(0, o.garfoY - D.velGarfo * dt);
      // move com colisão (empilhadeira para, não atravessa)
      const nrot = o.rot + taxaGiro * dt;
      const nx = o.x + Math.cos(nrot) * o.vel * dt, nz = o.z - Math.sin(nrot) * o.vel * dt;
      if (!bate(o, nx, nz, nrot)) { o.x = nx; o.z = nz; o.rot = nrot; }
      else { if (Math.abs(o.vel) > 1.5) aviso('POF! Bateu. ' + PT.util.escolha(['Quem colocou isso aqui?', 'Tava no ponto cego!'])); o.vel = 0; }
      PT.ent.sync(o);
      // bateria
      o.bateria = Math.max(0, o.bateria - (Math.abs(o.vel) > 0.1 || t.KeyR ? D.consumoBateriaPorSeg * dt : 0));
      if (o.bateria <= D.alertaBateria && o.bateria > 0 && !o.alertou) { o.alertou = true; PT.ev.emit('aviso', '🔋 PIII-PIII — bateria da empilhadeira em ' + Math.round(o.bateria * 100) + '%. Leve para o carregador perto do quadro.'); }
      if (o.bateria <= 0 && !o.avisouBateria) { o.avisouBateria = true; PT.ev.emit('celular', { de: 'Empilhadeira', texto: 'Piiii... BATERIA ACABOU. Bem na pior hora, como manda a tradição.' }); }
      // TOMBAMENTO: velocidade × curva × altura do garfo × peso
      const risco = Math.abs(o.vel) * Math.abs(taxaGiro) * (1 + o.garfoY * D.fatorAltura) * (1 + pesoCarga / D.capacidadeKg);
      o.risco = risco;
      if (risco > D.limiarTombo) tombar(o, taxaGiro);
      // jogador vai junto, sentado
      const j = PT.mundo.jog; j.x = o.x - Math.cos(o.rot) * 0.2; j.z = o.z + Math.sin(o.rot) * 0.2; j.y = 0.9; j.rot = o.rot + Math.PI / 2;
      // carga acompanha o garfo
      if (o.carga) { const f = frente(o, 1.7 + (o.carga.dims ? o.carga.dims[0] / 2 - 0.5 : 0)); o.carga.x = f.x; o.carga.z = f.z; o.carga.y = o.garfoY + 0.15; o.carga.rot = o.rot; PT.ent.sync(o.carga); }
      atualizarVisual(o);
    }
  };
  function bate(o, x, z, rot) {
    const fp = PT.construcao.footprint(x, z, o.dims, rot);
    const M = PT.DADOS.mundo;
    if (fp.x0 < 0.2 || fp.x1 > M.L - 0.2 || fp.z0 < 0.2 || fp.z1 > M.D - 0.2) return true;
    if (PT.mundo.paredes.some(p => PT.construcao.cruza(fp, p))) return true;
    const agora = PT.construcao.footprint(o.x, o.z, o.dims, o.rot);
    return PT.ent.lista.some(e => e !== o && e !== o.carga && !e.preso && e.aabb && e.solido && e.y < 0.5 && PT.construcao.cruza(fp, e.aabb) && !PT.construcao.cruza(agora, e.aabb));
  }
  function aviso(t) { const n = performance.now(); if (n - ultAviso > 2500) { ultAviso = n; PT.ev.emit('aviso', t); } }

  function entrar(o) {
    if (o.tombada > 0) { PT.ev.emit('aviso', 'Ela está tombada. Desvire primeiro.'); return; }
    atual = o; o.cinto = false; PT.mundo.jog.controlando = controle;
    PT.ev.emit('aviso', '🔔 Aperte C para colocar o CINTO. W/S anda, A/D vira, R/F garfo, ESPAÇO pega/solta, E sai.');
  }
  function sair() {
    const o = atual; if (!o) return;
    const j = PT.mundo.jog; atual = null; j.controlando = null; j.y = 0;
    const p = PT.mundo.empurrar(o.x + Math.sin(o.rot) * 1.4, o.z + Math.cos(o.rot) * 1.4, 0.35); j.x = p.x; j.z = p.z;
    o.vel = 0;
  }

  // ---------- carga ----------
  function pegarOuSoltar() {
    const o = atual; if (!o || o.tombada > 0) return;
    const D = E();
    if (o.carga) {
      if (o.garfoY > 0.6) { PT.ev.emit('aviso', 'Baixe o garfo antes de soltar (F).'); return; }
      const c = o.carga; o.carga = null;
      if (c.tipo === 'bobina' && PT.maq.tentarMontar(c)) { c.preso = null; return; }
      const f = frente(o, 1.7 + (c.dims ? c.dims[0] / 2 - 0.5 : 0)); PT.estoque.soltarNoChao(c, f.x, f.z);
      return;
    }
    if (o.garfoY > 0.35) { PT.ev.emit('aviso', 'Abaixe o garfo para enfiar embaixo da carga.'); return; }
    const f = frente(o, 2.0);
    const alvo = PT.ent.perto(f.x, f.z, 1.3, e => !e.preso && e.y < 0.6 && ['pilha', 'volume', 'bobina'].includes(e.tipo) && !(e.tipo === 'volume' && e.pequeno));
    if (!alvo) { PT.ev.emit('aviso', 'Nada na frente do garfo.'); return; }
    if ((alvo.pesoKg || 0) > D.capacidadeKg) { PT.ev.emit('aviso', 'Pesado demais: ' + Math.round(alvo.pesoKg) + ' kg (máx. ' + D.capacidadeKg + ').'); return; }
    if (alvo.tipo === 'bobina' && o.acessorio !== 'mandril') {
      // zoeira: a bobina rola e amassa o capô
      const d = frente(o, 3.5); PT.estoque.soltarNoChao(alvo, d.x, d.z);
      PT.ev.emit('celular', { de: 'Você', texto: 'A bobina escorregou do garfo, rolou e amassou o capô. Bobina precisa de MANDRIL!' });
      PT.zoeira.acidente('Bobina rolou do garfo!'); return;
    }
    if (alvo.montadaEm) PT.maq.desmontarBobina(alvo);
    o.carga = alvo; alvo.preso = 'empilhadeira';
    PT.ev.emit('empiPegou', alvo);
  }

  function tombar(o, giro) {
    o.tombada = E().minutosDesvirar; o.vel = 0;
    const c = o.carga; o.carga = null;
    if (c) { const f = frente(o, 2.5); PT.estoque.soltarNoChao(c, f.x + Math.sign(giro) * 1.5, f.z); }
    PT.ev.emit('empiTombou', { o, cinto: o.cinto });
    if (o.cinto) {
      PT.zoeira.acidente('A empilhadeira TOMBOU! (você ficou preso na gaiola de cabeça para baixo — o cinto salvou)');
      sair();
    } else {
      sair(); PT.zoeira.arremessar(Math.atan2(-Math.sin(o.rot + Math.sign(giro) * Math.PI / 2), Math.cos(o.rot + Math.sign(giro) * Math.PI / 2)), 'Tombou sem cinto e foi arremessado pela lateral!');
    }
    atualizarVisual(o);
  }

  PT.ev.on('tecla', code => {
    if (PT.mundo.jog.controlando !== controle || PT.ui.modalAberto()) return;
    if (code === 'Space') pegarOuSoltar();
    if (code === 'KeyC' && atual) { atual.cinto = !atual.cinto; PT.ev.emit('aviso', atual.cinto ? '✔ Cinto colocado. Clique!' : 'Cinto solto.'); }
  });
  // tempo de desvirar e bateria (minutos de jogo)
  PT.ev.on('minuto', () => PT.ent.lista.forEach(o => {
    if (o.tipo !== 'empilhadeira') return;
    if (o.tombada > 0 && o.desvirando) { o.tombada -= 1; if (o.tombada <= 0) { o.tombada = 0; o.desvirando = false; atualizarVisual(o); PT.ev.emit('aviso', 'Empilhadeira desvirada. Nem arranhou... quase.'); } }
    if (o.carregando) { o.bateria = Math.min(1, o.bateria + 1 / (E().horasRecarga * 60)); if (o.bateria >= 1) o.carregando = false; o.avisouBateria = false; o.alertou = false; atualizarVisual(o); }
  }));

  // ---------- interações ----------
  PT.inter.registrar(j => {
    if (j.controlando === controle) return [{ rotulo: 'Sair da empilhadeira', acao: sair }];
    if (j.controlando) return null;
    const o = PT.ent.perto(j.x, j.z, 2.2, e => e.tipo === 'empilhadeira');
    if (!o) return null;
    const ops = [];
    const c = j.carregando;
    if (c && c.tipo === 'mao' && c.ent.item === 'mandril') ops.push({ rotulo: 'Instalar o MANDRIL na empilhadeira', prio: 1, acao: () => { o.acessorio = 'mandril'; PT.ent.remover(c.ent); j.carregando = null; atualizarVisual(o); PT.ev.emit('aviso', 'Mandril instalado: agora dá para pegar bobina.'); } });
    if (c) return ops;
    if (o.tombada > 0) ops.push({ rotulo: o.desvirando ? 'Desvirando... (' + o.tombada + ' min)' : 'Desvirar a empilhadeira (macaco + corda)', prio: 1, acao: () => { o.desvirando = true; } });
    else ops.push({ rotulo: 'Subir na empilhadeira', prio: 2, acao: () => entrar(o) });
    if (o.acessorio === 'mandril') ops.push({ rotulo: 'Trocar mandril por garfos', prio: 7, acao: () => { o.acessorio = 'garfos'; atualizarVisual(o); } });
    const q = PT.DADOS.mundo.quadro;
    if (Math.hypot(o.x - q.x, o.z - q.z) < 6 && o.bateria < 1) ops.push({ rotulo: 'Ligar no carregador (' + Math.round(o.bateria * 100) + '%)', prio: 5, acao: () => { o.carregando = true; PT.ev.emit('aviso', 'Carregando a bateria.'); } });
    return ops;
  });

  return { criar, entrar, sair, controle, pegarOuSoltar, get atual() { return atual; }, atualizarVisual };
})();
