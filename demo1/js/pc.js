// =====================================================================
// pc.js — "ParecisOS": o sistema operacional do computador do escritório.
// Área de trabalho com ícones, barra de tarefas (Iniciar, apps abertos,
// saldo, sino de notificações, relógio do JOGO), janelas arrastáveis,
// minimizar/maximizar/fechar, várias abertas ao mesmo tempo.
// Os apps ficam em pc_apps.js — cada um com a cara de uma empresa diferente.
// Decidido na sala: ChatGPT (regras de design, layout dos apps) + Gemini
// (barra viva, notificações, sons) + Claude.
// =====================================================================
window.PT = window.PT || {};

PT.pc = (function () {
  const apps = {};                 // id → { nome, icone, abrir(corpo, janela), atualizar?(corpo, janela), larg, alt, desktop }
  const janelas = [];              // { id, app, el, corpo, min, max }
  const st = { aberto: false, z: 10, notifs: [], naoLidas: 0, piscar: {}, som: true, papel: 0 };
  let raiz, area, barra, tarefas, menuIniciar, central;

  // ---------------- sons (WebAudio, sintetizados — sem arquivos) ----------------
  let ac = null;
  function som(tipo) {
    if (!st.som) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain(); o.connect(g); g.connect(ac.destination);
      const t = ac.currentTime, f = { clique: [1800, 0.03, 0.04], abrir: [660, 0.12, 0.06], notif: [880, 0.25, 0.08], erro: [180, 0.25, 0.08] }[tipo] || [1000, 0.05, 0.04];
      o.type = tipo === 'erro' ? 'square' : 'sine'; o.frequency.setValueAtTime(f[0], t);
      if (tipo === 'notif') o.frequency.setValueAtTime(f[0] * 1.5, t + 0.1);
      g.gain.setValueAtTime(f[2], t); g.gain.exponentialRampToValueAtTime(0.0001, t + f[1]);
      o.start(t); o.stop(t + f[1] + 0.02);
    } catch (e) { }
  }

  function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; }
  function icone(nome) { return 'img/icones/' + nome + '.png'; }

  // ---------------- montagem ----------------
  function montar() {
    raiz = el('div', 'pcos'); raiz.id = 'pcos';
    raiz.innerHTML = '<div class="pc-papel"></div><div class="pc-area"></div><div class="pc-barra"><button class="pc-iniciar" title="Iniciar"><span class="pc-logo"></span>Iniciar</button>' +
      '<div class="pc-tarefas"></div><div class="pc-bandeja"><button class="pc-saldo" title="Abrir o Banco Cerrado"></button><button class="pc-sino" title="Notificações"><img src="' + icone('sino') + '" alt=""><b class="pc-badge"></b></button>' +
      '<div class="pc-relogio"></div><button class="pc-desligar" title="Levantar do computador (Esc)">⏻</button></div></div>' +
      '<div class="pc-menu"></div><div class="pc-central"><h4>Notificações</h4><div class="pc-notifs"></div></div>';
    document.body.appendChild(raiz);
    area = raiz.querySelector('.pc-area'); barra = raiz.querySelector('.pc-barra'); tarefas = raiz.querySelector('.pc-tarefas');
    menuIniciar = raiz.querySelector('.pc-menu'); central = raiz.querySelector('.pc-central');
    // ícones da área de trabalho (coluna, como no Windows)
    Object.keys(apps).filter(id => apps[id].desktop !== false).forEach(id => {
      const a = apps[id], b = el('button', 'pc-icone', '<img src="' + icone(a.icone) + '" alt=""><span>' + a.nome + '</span><b class="pc-badge"></b>');
      b.dataset.app = id;
      b.onclick = () => { area.querySelectorAll('.pc-icone.sel').forEach(x => x.classList.remove('sel')); b.classList.add('sel'); som('clique'); };
      b.ondblclick = () => abrirApp(id);
      b.onkeydown = e => { if (e.key === 'Enter') abrirApp(id); };
      area.appendChild(b);
    });
    raiz.querySelector('.pc-iniciar').onclick = e => { e.stopPropagation(); alternarMenu(); };
    raiz.querySelector('.pc-saldo').onclick = () => abrirApp('banco');
    raiz.querySelector('.pc-sino').onclick = e => { e.stopPropagation(); central.classList.toggle('aberta'); menuIniciar.classList.remove('aberto'); st.naoLidas = 0; desenharNotifs(); };
    raiz.querySelector('.pc-desligar').onclick = fechar;
    raiz.addEventListener('mousedown', e => {
      if (!menuIniciar.contains(e.target) && !e.target.closest('.pc-iniciar')) menuIniciar.classList.remove('aberto');
      if (!central.contains(e.target) && !e.target.closest('.pc-sino')) central.classList.remove('aberta');
    });
    desenharMenu(); aplicarPapel();
  }
  function aplicarPapel() { raiz.querySelector('.pc-papel').className = 'pc-papel papel' + st.papel; }
  function desenharMenu() {
    menuIniciar.innerHTML = '<div class="pc-menu-topo"><img src="' + icone('fabrica') + '" alt=""><div><b>Parecis Telha</b><small>Escritório — computador da administração</small></div></div><div class="pc-menu-lista">' +
      Object.keys(apps).map(id => '<button data-app="' + id + '"><img src="' + icone(apps[id].icone) + '" alt="">' + apps[id].nome + '</button>').join('') + '</div>' +
      '<div class="pc-menu-rodape"><button data-acao="sair">⏻ Levantar do computador</button></div>';
    menuIniciar.querySelectorAll('[data-app]').forEach(b => b.onclick = () => { menuIniciar.classList.remove('aberto'); abrirApp(b.dataset.app); });
    menuIniciar.querySelector('[data-acao="sair"]').onclick = fechar;
  }
  function alternarMenu() { menuIniciar.classList.toggle('aberto'); central.classList.remove('aberta'); som('clique'); }

  // ---------------- janelas ----------------
  function abrirApp(id, opcoes) {
    const a = apps[id]; if (!a) return;
    let j = janelas.find(x => x.id === id);
    if (j) { j.opcoes = opcoes || j.opcoes; restaurar(j); if (opcoes) desenhar(j); return j; }
    const n = janelas.length;
    const w = Math.min(a.larg || 820, window.innerWidth - 40), h = Math.min(a.alt || 560, window.innerHeight - 90);
    const e = el('div', 'pc-janela app-' + id);
    e.style.width = w + 'px'; e.style.height = h + 'px';
    e.style.left = Math.max(10, Math.min(window.innerWidth - w - 10, 140 + n * 28)) + 'px';
    e.style.top = Math.max(10, Math.min(window.innerHeight - h - 60, 30 + n * 24)) + 'px';
    e.innerHTML = '<div class="pc-titulo"><img src="' + icone(a.icone) + '" alt=""><span>' + (a.titulo || a.nome) + '</span>' +
      '<button class="b-min" title="Minimizar">—</button><button class="b-max" title="Maximizar">▢</button><button class="b-fechar" title="Fechar">✕</button></div><div class="pc-corpo"></div>';
    raiz.appendChild(e);
    j = { id, app: a, el: e, corpo: e.querySelector('.pc-corpo'), min: false, max: false, opcoes };
    janelas.push(j);
    e.addEventListener('mousedown', () => focar(j));
    e.addEventListener('mouseenter', () => j.mouseDentro = true);
    e.addEventListener('mouseleave', () => { j.mouseDentro = false; });
    e.querySelector('.b-fechar').onclick = ev => { ev.stopPropagation(); fecharJanela(j); };
    e.querySelector('.b-min').onclick = ev => { ev.stopPropagation(); minimizar(j); };
    e.querySelector('.b-max').onclick = ev => { ev.stopPropagation(); maximizar(j); };
    e.querySelector('.pc-titulo').ondblclick = () => maximizar(j);
    arrastavel(j);
    desenhar(j); focar(j); som('abrir');
    st.piscar[id] = false; atualizarTarefas();
    return j;
  }
  function desenhar(j) {
    const c = j.corpo, sc = c.scrollTop;
    try { j.app.abrir(c, j); } catch (e) { console.error(e); c.innerHTML = '<p style="padding:16px">O aplicativo parou de responder. (' + e.message + ')</p>'; }
    c.scrollTop = sc;
  }
  function focar(j) { j.el.style.zIndex = ++st.z; janelas.forEach(x => x.el.classList.toggle('ativa', x === j)); atualizarTarefas(); }
  function minimizar(j) { j.min = true; j.el.style.display = 'none'; atualizarTarefas(); }
  function restaurar(j) { j.min = false; j.el.style.display = ''; focar(j); }
  function maximizar(j) {
    j.max = !j.max;
    if (j.max) { j.antes = { l: j.el.style.left, t: j.el.style.top, w: j.el.style.width, h: j.el.style.height }; Object.assign(j.el.style, { left: '0px', top: '0px', width: '100%', height: 'calc(100% - 46px)' }); }
    else Object.assign(j.el.style, { left: j.antes.l, top: j.antes.t, width: j.antes.w, height: j.antes.h });
  }
  function fecharJanela(j) { j.el.remove(); janelas.splice(janelas.indexOf(j), 1); atualizarTarefas(); som('clique'); }
  function arrastavel(j) {
    const t = j.el.querySelector('.pc-titulo');
    t.addEventListener('mousedown', e => {
      if (e.target.tagName === 'BUTTON' || j.max) return;
      const ox = e.clientX - j.el.offsetLeft, oy = e.clientY - j.el.offsetTop;
      const mover = m => { j.el.style.left = Math.max(-j.el.offsetWidth + 80, Math.min(window.innerWidth - 80, m.clientX - ox)) + 'px'; j.el.style.top = Math.max(0, Math.min(window.innerHeight - 80, m.clientY - oy)) + 'px'; };
      const soltar = () => { window.removeEventListener('mousemove', mover); window.removeEventListener('mouseup', soltar); };
      window.addEventListener('mousemove', mover); window.addEventListener('mouseup', soltar);
    });
  }
  function atualizarTarefas() {
    if (!tarefas) return;
    const topo = janelas.slice().sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0];
    tarefas.innerHTML = '';
    janelas.forEach(j => {
      const b = el('button', 'pc-tarefa' + (j === topo && !j.min ? ' ativa' : '') + (st.piscar[j.id] ? ' piscar' : ''), '<img src="' + icone(j.app.icone) + '" alt=""><span>' + j.app.nome + '</span>');
      b.onclick = () => { if (j.min) restaurar(j); else if (j === topo) minimizar(j); else focar(j); };
      tarefas.appendChild(b);
    });
  }

  // ---------------- notificações ----------------
  const CATEG = { 'Banco Cerrado': 'Financeiro', 'Conta de luz': 'Financeiro', 'RH': 'Funcionários', 'Equipe': 'Funcionários', 'Vendedor': 'Fornecedores', 'Técnico da ponte': 'Fornecedores', 'Quadro elétrico': 'Produção' };
  function notificar(n) {
    const cat = n.categoria || CATEG[n.de] || (n.app === 'correio' ? 'Clientes' : 'Fábrica');
    st.notifs.unshift({ quando: PT.tempo.rotulo(), de: n.de, texto: n.texto, app: n.app, cat }); if (st.notifs.length > 40) st.notifs.pop();
    st.naoLidas++;
    if (n.app && !(janelas.find(j => j.id === n.app && !j.min))) st.piscar[n.app] = true;
    if (st.aberto) { som('notif'); desenharNotifs(); atualizarTarefas(); toast(n); }
  }
  function toast(n) {
    const t = el('div', 'pc-toast', '<b>' + n.de + '</b><span>' + n.texto + '</span>'); raiz.appendChild(t);
    if (n.app) { t.style.cursor = 'pointer'; t.onclick = () => abrirApp(n.app); }
    setTimeout(() => t.classList.add('sumir'), 4200); setTimeout(() => t.remove(), 4800);
  }
  function desenharNotifs() {
    if (!raiz) return;
    const b = raiz.querySelector('.pc-sino .pc-badge'); b.textContent = st.naoLidas > 0 ? (st.naoLidas > 9 ? '9+' : st.naoLidas) : ''; b.style.display = st.naoLidas ? '' : 'none';
    const lista = raiz.querySelector('.pc-notifs');
    if (!st.notifs.length) { lista.innerHTML = '<p class="vazio">Nada por aqui. A fábrica está quieta... por enquanto.</p>'; return; }
    const grupos = {}; st.notifs.slice(0, 25).forEach(n => (grupos[n.cat] = grupos[n.cat] || []).push(n));
    lista.innerHTML = Object.keys(grupos).map(g => '<div class="grupo">' + g + '</div>' + grupos[g].map((n, i) => '<div class="notif" data-app="' + (n.app || '') + '"><b>' + n.de + '</b> <small>' + n.quando.replace(/^Dia \d+ /, '') + '</small><br>' + n.texto + '</div>').join('')).join('');
    lista.querySelectorAll('.notif').forEach(d => d.onclick = () => { if (d.dataset.app) { abrirApp(d.dataset.app); central.classList.remove('aberta'); } });
  }
  PT.ev.on('celular', m => notificar({ de: m.de, texto: m.texto, app: m.de === '📧 E-mail' ? 'correio' : (/Banco|luz/.test(m.de) ? 'banco' : null) }));
  PT.ev.on('pedidoNovo', p => { if (!p.silencioso && p.canal === 'email') st.piscar.pedidos = true; });

  // ---------------- abrir/fechar o computador ----------------
  function abrir() {
    if (!raiz) montar();
    st.aberto = true; raiz.style.display = 'block'; PT.ui.abrirModal('pcos');
    st.naoLidas = st.notifs.length ? st.naoLidas : 0; desenharNotifs(); atualizarTarefas(); atualizar(true); som('abrir');
  }
  function fechar() {
    if (!raiz) return;
    st.aberto = false; raiz.style.display = 'none'; menuIniciar.classList.remove('aberto'); central.classList.remove('aberta');
    PT.ui.fecharModal();
  }

  // ---------------- atualização (a fábrica continua viva com o PC aberto) ----------------
  let ultimo = 0;
  function atualizar(forcar) {
    if (!st.aberto || !raiz) return;
    const agora = performance.now();
    const rot = PT.tempo.rotulo().split(' ');            // ["Dia", "3", "09:31"]
    raiz.querySelector('.pc-relogio').innerHTML = '<b>' + rot[2] + '</b><small>Dia ' + rot[1] + '</small>';
    const sb = raiz.querySelector('.pc-saldo'); const cx = PT.eco.st.caixa;
    sb.textContent = PT.util.reais(cx); sb.classList.toggle('negativo', PT.eco.st.cheque > 0);
    // badges nos ícones da área de trabalho
    const nl = PT.ui.correioNaoLidos ? PT.ui.correioNaoLidos() : 0;
    const ofertas = PT.pedidos.st.lista.filter(p => p.status === 'oferta').length;
    const badge = { correio: nl, pedidos: ofertas, empregos: PT.func.st.tartaruga > 0 ? '!' : 0 };
    area.querySelectorAll('.pc-icone').forEach(b => { const v = badge[b.dataset.app]; const bd = b.querySelector('.pc-badge'); bd.textContent = v || ''; bd.style.display = v ? '' : 'none'; });
    if (!forcar && agora - ultimo < 1500) return;
    ultimo = agora;
    // redesenha só janelas que mudam e quando o mouse NÃO está nelas (evita perder clique) — regra do ChatGPT: feedback sem atrapalhar
    janelas.forEach(j => { if (!j.min && j.app.vivo && !j.mouseDentro && !(document.activeElement && j.el.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName))) desenhar(j); });
  }

  PT.ev.on('tecla', code => { if (st.aberto && code === 'Escape') { if (menuIniciar.classList.contains('aberto')) menuIniciar.classList.remove('aberto'); else fechar(); } });

  return {
    st, apps, janelas, abrir, fechar, abrirApp, fecharJanela, desenhar, atualizar, notificar, som, icone,
    registrar(id, def) { apps[id] = def; },
    redesenhar(id) { const j = janelas.find(x => x.id === id); if (j) desenhar(j); },
    trocarPapel(n) { st.papel = n; if (raiz) aplicarPapel(); },
    get aberto() { return st.aberto; }
  };
})();
