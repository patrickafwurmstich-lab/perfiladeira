// =====================================================================
// eventos.js — barramento de eventos. Os módulos conversam por aqui
// (no Godot isto vira os "signals" de um autoload EventBus).
// =====================================================================
window.PT = window.PT || {};

PT.ev = (function () {
  const ouvintes = {};
  const log = [];                       // últimos eventos (painel de debug F3)
  return {
    on(nome, fn) { (ouvintes[nome] = ouvintes[nome] || []).push(fn); return fn; },
    off(nome, fn) { const l = ouvintes[nome]; if (l) { const i = l.indexOf(fn); if (i >= 0) l.splice(i, 1); } },
    emit(nome, dados) {
      log.push({ t: PT.tempo ? PT.tempo.rotulo() : '', nome });
      if (log.length > 60) log.shift();
      (ouvintes[nome] || []).slice().forEach(fn => {
        try { fn(dados); } catch (e) { console.error('[evento ' + nome + ']', e); }
      });
    },
    log
  };
})();

// utilidades pequenas usadas por todos
PT.util = {
  rand(a, b) { return a + Math.random() * (b - a); },
  randInt(a, b) { return Math.floor(a + Math.random() * (b - a + 1)); },
  escolha(l) { return l[Math.floor(Math.random() * l.length)]; },
  escolhaPeso(obj) {              // {chave:{peso}} -> chave
    const ks = Object.keys(obj); let tot = 0; ks.forEach(k => tot += obj[k].peso);
    let r = Math.random() * tot;
    for (const k of ks) { r -= obj[k].peso; if (r <= 0) return k; }
    return ks[ks.length - 1];
  },
  reais(v) { return 'R$ ' + Math.round(v).toLocaleString('pt-BR'); },
  clamp(v, a, b) { return Math.max(a, Math.min(b, v)); },
  snap(v, g) { return Math.round(v / g) * g; },
  id: (function () { let n = 0; return p => (p || 'o') + '_' + (++n) + '_' + Math.floor(Math.random() * 1e4); })()
};
