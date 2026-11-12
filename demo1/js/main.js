// =====================================================================
// main.js — liga tudo e roda o laço principal.
// Ordem: mundo → ponte → zoeira → (save pendente OU jogo novo) → laço.
// =====================================================================
window.PT = window.PT || {};

(function () {
  PT.DEBUG = /[?&]debug=1/.test(location.search);
  PT.mundo.init(document.getElementById('cena'));
  PT.ponte.init();
  PT.zoeira.init();
  PT.balcao.construir();

  let carregou = false;
  try { carregou = PT.save.carregarPendente(); } catch (e) { console.error(e); PT.ev.emit('aviso', 'Save inválido: ' + e.message); }

  if (!carregou) {
    // JOGO NOVO: barracão vazio + kit herdado chegando no 1º caminhão
    PT.entrega.agendar(1, PT.DADOS.kitHerdado.slice(), 'Seu Tião (antigo dono)', { hora: 7.5 });
    setTimeout(() => {
      PT.ev.emit('celular', { de: 'Seu Tião (antigo dono)', texto: 'Bom dia, patrão novo! Tô levando a perfiladeira velha, uma bobina e a paleteira. A ponte já tá no trilho. Ela é de 1.500 kg e guincha até com vento contra, viu?' });
      PT.ui.email({ de: 'Banco Cerrado', assunto: 'Bem-vindo! Sua conta empresa está aberta', texto: 'Saldo inicial de ' + PT.util.reais(PT.DADOS.economia.caixaInicial) + ' e capital de giro pré-aprovado de ' + PT.util.reais(PT.DADOS.economia.limiteCredito) + ' (2% ao mês). FINAME liberado quando a empresa atingir a faixa 1 de reputação.' });
      PT.ev.emit('aviso', 'Aperte H para ver os controles.');
    }, 600);
  }

  const relogio = new THREE.Clock();
  function laco() {
    requestAnimationFrame(laco);
    const dt = Math.min(relogio.getDelta(), 0.1);
    PT.tempo.atualizar(dt);          // economia/produção em passos fixos de 1 min de jogo
    PT.mundo.atualizar(dt);          // personagem e câmera em tempo real
    PT.ponte.atualizar(dt);
    PT.estoque.atualizar(dt);
    PT.entrega.atualizar(dt);
    PT.construcao.atualizar(dt);
    PT.zoeira.atualizar(dt);
    PT.func.atualizar(dt);
    PT.balcao.atualizar(dt);
    PT.ui.hud(performance.now());
    PT.mundo.render();
  }
  laco();
  window.__PT_OK = true;             // usado pelos testes automáticos
})();
