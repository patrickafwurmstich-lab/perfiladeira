// =====================================================================
// mundo.js — cena 3D, barracão, personagem, câmera, entrada, colisão,
// ENTIDADES (tudo que existe no chão) e INTERAÇÕES (tecla E).
// =====================================================================
window.PT = window.PT || {};

PT.mundo = (function () {
  const M = PT.DADOS.mundo, P = PT.DADOS.personagem, C = PT.DADOS.camera;
  let renderer, scene, camera;
  const teclas = {};
  const cam = { yaw: 2.4, pitch: 0.5, dist: C.dist, arrastando: false, ux: 0, uy: 0 };
  const paredes = [];   // AABB fixas {x0,x1,z0,z1}

  // ---------------- INICIALIZAÇÃO ----------------
  function init(container) {
    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    container.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0xb9d6ee);
    scene.fog = new THREE.Fog(0xb9d6ee, 120, 320);
    camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 600);

    scene.add(new THREE.HemisphereLight(0xffffff, 0x667788, 0.75));
    const sol = new THREE.DirectionalLight(0xffffff, 0.7);
    sol.position.set(40, 60, 20); sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    const sc = sol.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.far = 160;
    scene.add(sol); scene.add(sol.target); PT.mundo.sol = sol;

    construirBarracao();
    criarPersonagem();
    eventosEntrada();
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  function caixa(w, h, d, cor, x, y, z, sombra) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color: cor }));
    m.position.set(x, y, z); m.receiveShadow = true; m.castShadow = !!sombra; scene.add(m); return m;
  }

  function construirBarracao() {
    // pátio
    caixa(320, 0.1, 140, 0x8fa36b, M.L / 2, -0.06, M.D / 2);
    // piso do barracão (tiles para depois virar cicatriz)
    PT.registroModelos.usos.barracao_132x40 = 1; PT.registroModelos.max.barracao_132x40 = 1;
    caixa(M.L, 0.1, M.D, 0x7f8a93, M.L / 2, 0, M.D / 2);
    PT.registroModelos.usos.piso_concreto = Math.ceil(M.L / 6) * Math.ceil(M.D / 6);
    PT.registroModelos.max.piso_concreto = PT.registroModelos.usos.piso_concreto;
    // corredor do caminhão (asfalto escuro) passando por dentro
    caixa(M.L + 80, 0.12, M.corredor.z1 - M.corredor.z0, 0x4a4f55, M.L / 2, 0.01, (M.corredor.z0 + M.corredor.z1) / 2);
    // faixas
    for (let x = -36; x < M.L + 40; x += 6) caixa(3, 0.13, 0.15, 0xf5f5f5, x, 0.02, (M.corredor.z0 + M.corredor.z1) / 2);
    // paredes (baixas, para enxergar dentro) com aberturas dos portões no corredor
    const h = 3.2, cw = 0x9aa4ad;
    caixa(M.L, h, 0.3, cw, M.L / 2, h / 2, M.D);                       // fundo
    paredes.push({ x0: 0, x1: M.L, z0: M.D - 0.2, z1: M.D + 0.5 });
    // frente, com porta de pedestre para a loja de balcão
    const pf = M.portaFrente;
    caixa(pf.x0, h, 0.3, cw, pf.x0 / 2, h / 2, 0); paredes.push({ x0: 0, x1: pf.x0, z0: -0.5, z1: 0.2 });
    caixa(M.L - pf.x1, h, 0.3, cw, (pf.x1 + M.L) / 2, h / 2, 0); paredes.push({ x0: pf.x1, x1: M.L, z0: -0.5, z1: 0.2 });
    caixa(pf.x1 - pf.x0, 0.6, 0.3, cw, (pf.x0 + pf.x1) / 2, h - 0.3, 0);   // verga da porta
    // laterais com portão (abertura no corredor)
    [0, M.L].forEach(x => {
      const zA = M.corredor.z1, len = M.D - zA;
      caixa(0.3, h, len, cw, x, h / 2, zA + len / 2);
      paredes.push({ x0: x - 0.4, x1: x + 0.4, z0: zA, z1: M.D });
      caixa(0.3, h, M.corredor.z0, cw, x, h / 2, M.corredor.z0 / 2);
      paredes.push({ x0: x - 0.4, x1: x + 0.4, z0: 0, z1: M.corredor.z0 });
    });
    // pilares e trilhos da ponte (vigas de rolamento já instaladas)
    for (let x = 0; x <= M.L; x += 12) {
      [0.4, M.D - 0.4].forEach(z => caixa(0.5, M.ponte.alturaTrilho, 0.5, 0x7b8790, x, M.ponte.alturaTrilho / 2, z, true));
    }
    [0.4, M.D - 0.4].forEach(z => caixa(M.L, 0.5, 0.4, 0x5d6d7e, M.L / 2, M.ponte.alturaTrilho, z));
    // zonas pintadas
    Object.keys(M.zonas).forEach(k => {
      const zn = M.zonas[k];
      const w = zn.x1 - zn.x0, d = zn.z1 - zn.z0;
      const m = caixa(w, 0.02, d, zn.cor, zn.x0 + w / 2, 0.06, zn.z0 + d / 2);
      m.material.transparent = true; m.material.opacity = 0.45;
      const r = PT.rotuloSprite(zn.nome); r.position.set(zn.x0 + w / 2, 0.8, zn.z0 + d / 2); scene.add(r);
      PT.registroModelos.usos.marcacao_zona = (PT.registroModelos.usos.marcacao_zona || 0) + 1;
    });
    // escritório
    const E = M.escritorio;
    const of = PT.modelo('escritorio'); of.position.set((E.x0 + E.x1) / 2, 0, (E.z0 + E.z1) / 2);
    of.userData.mesh.material.transparent = true; of.userData.mesh.material.opacity = 0.35; scene.add(of);
    paredes.push({ x0: E.x0, x1: E.x1, z0: E.z0, z1: E.z0 + 0.3 });            // parede da frente do escritório
    paredes.push({ x0: E.x1 - 0.3, x1: E.x1, z0: E.z0, z1: M.porta.z - 0.7 });   // lateral com porta
    paredes.push({ x0: E.x1 - 0.3, x1: E.x1, z0: M.porta.z + 0.7, z1: E.z1 });
    const pc = PT.modelo('computador_mesa'); pc.position.set(M.computador.x, 0, M.computador.z); scene.add(pc);
    paredes.push({ x0: M.computador.x - 0.7, x1: M.computador.x + 0.7, z0: M.computador.z - 0.35, z1: M.computador.z + 0.35 });
    const porta = PT.modelo('porta_escritorio', { semRotulo: true }); porta.position.set(E.x1, 0, M.porta.z); porta.rotation.y = Math.PI / 2; scene.add(porta);
    // quadro elétrico
    const q = PT.modelo('quadro_eletrico'); q.position.set(M.quadro.x, 0, M.quadro.z); scene.add(q);
    PT.mundo.quadroObj = q;
  }

  // ---------------- PERSONAGEM ----------------
  const jog = { x: M.porta.x + 1, z: M.porta.z, y: 0, rot: Math.PI, vy: 0, g: null, morto: false, controlando: null, carregando: null };
  function criarPersonagem() {
    jog.g = PT.modelo('personagem_dono', { semRotulo: true });
    const nariz = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.3), new THREE.MeshLambertMaterial({ color: 0xffcc99 }));
    nariz.position.set(0, 1.5, 0.3); jog.g.add(nariz);                      // mostra para onde olha
    scene.add(jog.g);
  }

  // ---------------- ENTRADA ----------------
  function eventosEntrada() {
    window.addEventListener('keydown', e => {
      if (PT.ui && PT.ui.capturandoTeclado()) return;
      teclas[e.code] = true;
      if (!e.repeat) PT.ev.emit('tecla', e.code);          // segurar ESPAÇO não alterna engatar/soltar sem parar — ChatGPT, bug 7
      if (['Tab', 'Space'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', e => { teclas[e.code] = false; });
    // ALT+TAB ou morte com tecla apertada: nada fica "preso" — ChatGPT, bug 8
    const limpar = () => Object.keys(teclas).forEach(k => teclas[k] = false);
    window.addEventListener('blur', limpar); PT.ev.on('morreu', limpar); PT.ev.on('respawn', limpar);
    const cv = () => renderer.domElement;
    window.addEventListener('mousedown', e => {
      if (e.target !== cv()) return;
      cam.arrastando = true; cam.ux = e.clientX; cam.uy = e.clientY; cam.moveu = 0;
    });
    window.addEventListener('mouseup', e => {
      if (cam.arrastando && cam.moveu < 4 && e.target === cv()) PT.ev.emit('clique', { x: e.clientX, y: e.clientY, botao: e.button });
      cam.arrastando = false;
    });
    window.addEventListener('mousemove', e => {
      PT.mundo.mouse = { x: e.clientX, y: e.clientY };
      if (!cam.arrastando) return;
      const dx = e.clientX - cam.ux, dy = e.clientY - cam.uy; cam.ux = e.clientX; cam.uy = e.clientY;
      cam.moveu += Math.abs(dx) + Math.abs(dy);
      cam.yaw -= dx * 0.005; cam.pitch = PT.util.clamp(cam.pitch + dy * 0.004, 0.08, 1.35);
    });
    window.addEventListener('wheel', e => {
      if (e.target !== cv()) return;
      cam.dist = PT.util.clamp(cam.dist * (e.deltaY > 0 ? 1.12 : 0.89), C.distMin, C.distMax);
    }, { passive: true });
    window.addEventListener('contextmenu', e => { if (e.target === cv()) e.preventDefault(); });
  }

  // ---------------- COLISÃO ----------------
  function obstaculos() {
    const l = paredes.slice();
    PT.ent.lista.forEach(o => { if (o.solido && !o.preso && o.aabb) l.push(o.aabb); });
    return l;
  }
  function empurrar(x, z, r) {
    obstaculos().forEach(b => {
      const cx = PT.util.clamp(x, b.x0, b.x1), cz = PT.util.clamp(z, b.z0, b.z1);
      const dx = x - cx, dz = z - cz, d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 1e-6) { const d = Math.sqrt(d2), k = (r - d) / d; x += dx * k; z += dz * k; }
        else { // dentro da caixa: empurra pela menor saída
          const op = [[b.x0 - r - x, 0], [b.x1 + r - x, 0], [0, b.z0 - r - z], [0, b.z1 + r - z]];
          op.sort((a, c) => Math.abs(a[0] + a[1]) - Math.abs(c[0] + c[1])); x += op[0][0]; z += op[0][1];
        }
      }
    });
    return { x, z };
  }

  // ---------------- ATUALIZAÇÃO ----------------
  function atualizar(dt) {
    if (!jog.morto && !(PT.ui && PT.ui.modalAberto())) {
      if (jog.controlando && jog.controlando.controlar) {
        jog.controlando.controlar(dt, teclas);
      } else {
        let fx = 0, fz = 0;
        if (teclas.KeyW) fz -= 1; if (teclas.KeyS) fz += 1; if (teclas.KeyA) fx -= 1; if (teclas.KeyD) fx += 1;
        if (fx || fz) {
          const l = Math.hypot(fx, fz); fx /= l; fz /= l;
          const s = Math.sin(cam.yaw), c = Math.cos(cam.yaw);
          const mx = fx * c + fz * s, mz = -fx * s + fz * c;
          let v = P.vel * (teclas.ShiftLeft ? P.correr : 1);
          if (jog.carregando && jog.carregando.lento) v *= jog.carregando.lento;
          const passo = Math.min(dt, 0.05);
          let nx = jog.x + mx * v * passo, nz = jog.z + mz * v * passo;
          const p = empurrar(nx, nz, P.raio); jog.x = p.x; jog.z = p.z;
          jog.rot = Math.atan2(mx, mz);
        }
      }
    }
    jog.g.position.set(jog.x, jog.y, jog.z);
    if (!jog.morto) jog.g.rotation.set(0, jog.rot, 0);
    // câmera 3ª pessoa
    const alvo = new THREE.Vector3(jog.x, 1.4, jog.z);
    const cp = Math.cos(cam.pitch);
    camera.position.set(alvo.x + Math.sin(cam.yaw) * cp * cam.dist, alvo.y + Math.sin(cam.pitch) * cam.dist, alvo.z + Math.cos(cam.yaw) * cp * cam.dist);
    camera.lookAt(alvo);
    PT.mundo.sol.position.set(jog.x + 30, 60, jog.z + 20); PT.mundo.sol.target.position.set(jog.x, 0, jog.z);
    // rótulos somem de longe
    scene.traverse(o => { if (o.userData && o.userData.ehRotulo) o.visible = o.getWorldPosition(new THREE.Vector3()).distanceTo(camera.position) < 38; });
  }
  function render() { renderer.render(scene, camera); }

  // ponto do chão sob o mouse (para construção)
  const ray = new THREE.Raycaster(), plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  function chaoSobMouse() {
    if (!PT.mundo.mouse) return null;
    const v = new THREE.Vector2((PT.mundo.mouse.x / window.innerWidth) * 2 - 1, -(PT.mundo.mouse.y / window.innerHeight) * 2 + 1);
    ray.setFromCamera(v, camera); const p = new THREE.Vector3();
    return ray.ray.intersectPlane(plano, p) ? p : null;
  }

  return {
    init, atualizar, render, teclas, jog, cam, chaoSobMouse, empurrar, paredes,
    get scene() { return scene; }, get camera() { return camera; }
  };
})();

// =====================================================================
// ENTIDADES — tudo que existe fisicamente no barracão e pode ser salvo
// tipo: 'volume' | 'bobina' | 'pilha' | 'maquina' | 'decor' | 'paleteira' | 'berco' | 'cimento' | 'tinta'
// =====================================================================
PT.ent = (function () {
  const lista = [];
  function atualizarAABB(o) {
    const d = o.dims, c = Math.abs(Math.cos(o.rot || 0)), s = Math.abs(Math.sin(o.rot || 0));
    const w = c * d[0] + s * d[1], p = s * d[0] + c * d[1];
    o.aabb = { x0: o.x - w / 2, x1: o.x + w / 2, z0: o.z - p / 2, z1: o.z + p / 2, ent: o };
  }
  function add(o) {
    o.id = o.id || PT.util.id(o.tipo);
    o.y = o.y || 0; o.rot = o.rot || 0;
    if (!o.g) o.g = PT.modelo(o.modelo, { rotulo: o.rotulo, dims: o.dimsVisual });
    o.dims = o.dims || o.g.userData.dims;
    PT.mundo.scene.add(o.g);
    sync(o); lista.push(o);
    PT.ev.emit('entAdd', o);
    return o;
  }
  function sync(o) {
    o.g.position.set(o.x, o.y, o.z); o.g.rotation.y = o.rot; atualizarAABB(o);
  }
  function remover(o) {
    const i = lista.indexOf(o); if (i >= 0) lista.splice(i, 1);
    PT.mundo.scene.remove(o.g); if (o.g.userData.liberar) o.g.userData.liberar();
    PT.ev.emit('entRem', o);
  }
  function perto(x, z, raio, filtro) {
    let melhor = null, md = raio;
    lista.forEach(o => {
      if (filtro && !filtro(o)) return;
      const cx = PT.util.clamp(x, o.aabb.x0, o.aabb.x1), cz = PT.util.clamp(z, o.aabb.z0, o.aabb.z1);
      const d = Math.hypot(x - cx, z - cz);
      if (d < md) { md = d; melhor = o; }
    });
    return melhor;
  }
  function naZona(nome, filtro) {
    const z = PT.DADOS.mundo.zonas[nome];
    return lista.filter(o => o.x >= z.x0 && o.x <= z.x1 && o.z >= z.z0 && o.z <= z.z1 && (!filtro || filtro(o)));
  }
  return { lista, add, remover, sync, perto, naZona, atualizarAABB };
})();

// =====================================================================
// INTERAÇÕES — cada módulo registra "provedores" que dizem o que o
// jogador pode fazer perto dele. A tecla E executa a opção principal;
// as teclas 1–4 executam opções extras mostradas na dica da tela.
// =====================================================================
PT.inter = (function () {
  const provedores = [];
  let atuais = [];
  function registrar(fn) { provedores.push(fn); }
  function calcular() {
    const j = PT.mundo.jog; atuais = [];
    if (j.morto) return atuais;
    provedores.forEach(fn => { try { const r = fn(j); if (r) atuais = atuais.concat(r); } catch (e) { console.error(e); } });
    atuais.sort((a, b) => (a.prio || 5) - (b.prio || 5));
    return atuais;
  }
  PT.ev.on('tecla', code => {
    if (PT.ui && PT.ui.modalAberto()) return;
    const idx = { KeyE: 0, Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4 }[code];
    if (idx === undefined) return;
    const op = atuais[idx];
    if (op) op.acao();
  });
  return { registrar, calcular, get atuais() { return atuais; } };
})();
