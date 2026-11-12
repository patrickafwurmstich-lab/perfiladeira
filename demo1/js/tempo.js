// =====================================================================
// tempo.js — relógio do jogo
// Turno 7h–17h = 12 min reais. Às 17h a noite é pulada (dorme no
// escritório) e o jogo processa a noite (energia de máquina ligada etc.).
// Emite: 'minuto' (a cada minuto de jogo), 'hora', 'fimDoTurno', 'dia'.
// Regra anti-bug: a simulação anda em PASSOS FIXOS de 1 minuto de jogo,
// mesmo com velocidade x60 — nada "pula" eventos.
// =====================================================================
window.PT = window.PT || {};

PT.tempo = (function () {
  const D = PT.DADOS.tempo;
  const st = { dia: D.diaInicial, minutos: D.horaInicio * 60, velIdx: 0, pausado: false, acum: 0, noite: false };
  const segPorMinuto = D.segundosReaisPorHora / 60;   // 1,2 s reais por minuto de jogo

  function rotulo() {
    const h = Math.floor(st.minutos / 60), m = Math.floor(st.minutos % 60);
    return 'Dia ' + st.dia + ' ' + String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
  }
  function agoraHoras() { return (st.dia - 1) * 24 + st.minutos / 60; }   // relógio absoluto em horas

  function passoMinuto() {
    st.minutos += 1;
    PT.ev.emit('minuto', { dia: st.dia, minutos: st.minutos });
    if (st.minutos % 60 === 0) PT.ev.emit('hora', { dia: st.dia, hora: st.minutos / 60 });
    if (st.minutos >= D.horaFim * 60) pularNoite();
  }

  function pularNoite() {
    PT.ev.emit('fimDoTurno', { dia: st.dia });
    const horasNoite = 24 - D.horaFim + D.horaInicio;     // 14 h
    PT.ev.emit('noite', { dia: st.dia, horas: horasNoite });
    st.dia += 1; st.minutos = D.horaInicio * 60;
    PT.ev.emit('dia', { dia: st.dia });
  }

  return {
    st, rotulo, agoraHoras, pularNoite,
    get vel() { return D.velocidades[st.velIdx]; },
    alternarVel() { st.velIdx = (st.velIdx + 1) % D.velocidades.length; return this.vel; },
    pausar(v) { st.pausado = v === undefined ? !st.pausado : v; },
    // chamado a cada frame com dt real (s)
    atualizar(dt) {
      if (st.pausado) return;
      st.acum += Math.min(dt, 0.25) * this.vel;
      let passos = 0;
      while (st.acum >= segPorMinuto && passos < 200) { st.acum -= segPorMinuto; passoMinuto(); passos++; }
    },
    // fração de minuto já decorrida (para animação suave)
    fracao() { return st.acum / segPorMinuto; },
    minutosDeJogo(dtReal) { return dtReal * this.vel / segPorMinuto; },
    carregar(o) { Object.assign(st, o, { acum: 0, pausado: false }); }
  };
})();
