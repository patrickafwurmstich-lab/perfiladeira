// =====================================================================
// funcionarios.js — Fase 2 (ordem do Gemini: 3º). Menor conjunto que
// prova se é divertido:
//  • contratar no site "Trabalhe Conosco MT" (aba Equipe do computador)
//  • teto FÍSICO: 1 vaga por armário instalado no vestiário (até 6)
//  • QUADRO DE TAREFAS por setor (Produção / Expedição / Manutenção)
//    com prioridade alta/média/baixa; tarefas nascem das máquinas
//  • agentes reais a 10 Hz: PARADO → VERIFICAR → DESLOCAR → EXECUTAR → CONCLUIR
//  • cargo base 100% + qualquer um faz serviço de ajudante a 60%
//  • energia (cansado = lento), almoço 12h–13h, café quando sem tarefa
//  • personalidade: apressado/distraído às vezes ESCONDE telha torta
//  • folha quinzenal; sem dinheiro = OPERAÇÃO TARTARUGA ("SEM PIX, SEM TELHA")
// =====================================================================
window.PT = window.PT || {};

PT.func = (function () {
  const F = () => PT.DADOS.funcionarios;
  const st = { lista: [], candidatos: [], prioridade: { producao: 'alta', expedicao: 'media', manutencao: 'media' }, cont: 0, tartaruga: 0, ultimoCandidatos: 0 };
  const PESO_PRIO = { alta: 3, media: 2, baixa: 1 };
  let acum = 0;

  // ---------------- CONTRATAÇÃO ----------------
  function vagas() { return Math.min(F().maxAtivos, PT.ent.lista.filter(o => o.tipo === 'decor' && o.item === 'armario').length); }
  function gerarCandidatos() {
    const faixa = PT.rep.faixa(), D = F();
    st.candidatos = [];
    const cargos = Object.keys(D.cargos).filter(k => D.cargos[k].faixaMin <= faixa);
    for (let i = 0; i < 4; i++) {
      const cargo = PT.util.escolha(cargos), C = D.cargos[cargo];
      const at = { competencia: +PT.util.rand(0.4, 0.95).toFixed(2), seguranca: +PT.util.rand(0.4, 0.95).toFixed(2), ritmo: +PT.util.rand(0.4, 0.95).toFixed(2) };
      const media = (at.competencia + at.seguranca + at.ritmo) / 3;
      st.candidatos.push({ id: 'cand_' + (++st.cont), nome: PT.util.escolha(D.nomes) + ' ' + PT.util.escolha(D.sobrenomes), cargo, atributos: at,
        personalidade: PT.util.escolha(D.personalidades), salario: Math.round(PT.DADOS.salarios[C.salario] * (0.85 + media * 0.3) / 10) * 10,
        certificados: C.certificados.slice(), fala: PT.util.escolha(D.entrevistas) });
    }
    st.ultimoCandidatos = PT.tempo.st.dia;
  }
  function contratar(id) {
    const c = st.candidatos.find(x => x.id === id); if (!c) return { ok: false, msg: 'Candidato não existe mais.' };
    if (st.lista.length >= vagas()) return { ok: false, msg: 'Sem vaga: instale mais ARMÁRIOS no vestiário (' + st.lista.length + '/' + vagas() + ').' };
    st.candidatos = st.candidatos.filter(x => x !== c);
    const f = Object.assign({ energia: 1, estado: 'parado', tarefa: null, alvo: null, x: PT.DADOS.mundo.porta.x + 1.5, z: PT.DADOS.mundo.porta.z + 1, rot: 0,
      carregando: null, xp: {}, ausenteAte: 0, orientadoAte: 0 }, c);
    f.id = 'func_' + (++st.cont);
    criarVisual(f); st.lista.push(f);
    PT.ev.emit('celular', { de: f.nome, texto: 'Bom dia, patrão! ' + c.fala });
    return { ok: true, msg: f.nome + ' contratado(a) como ' + F().cargos[f.cargo].nome + '.' };
  }
  function demitir(id) {
    const f = st.lista.find(x => x.id === id); if (!f) return;
    soltar(f); PT.mundo.scene.remove(f.g); f.g.userData.liberar(); st.lista.splice(st.lista.indexOf(f), 1);
  }
  function criarVisual(f) {
    f.g = PT.modelo('funcionario', { cor: F().cargos[f.cargo].cor, rotulo: f.nome.split(' ')[0] });
    PT.mundo.scene.add(f.g);
  }

  // ---------------- QUADRO DE TAREFAS (gerado pelas máquinas) ----------------
  // cada tarefa: { id, setor, tipo, alvo, quem (cargo/certificado exigido), base (prioridade extra) }
  function tarefasAbertas() {
    const T = [];
    PT.maq.lista.forEach(m => {
      if (m.mesa && PT.ent.lista.includes(m.mesa) && !m.mesa.preso && (m.mesa.qtd >= F().pilhaParaTirar || m.estado === 'mesa_cheia' || m.estado === 'concluida') && m.mesa.qtd > 0)
        T.push({ id: 'tirar_' + m.mesa.id, setor: 'expedicao', tipo: 'tirarPilha', alvo: m.mesa, maq: m, ajudante: true });
      if (m.estado === 'enroscada') T.push({ id: 'enrosco_' + m.id, setor: 'manutencao', tipo: 'limparEnrosco', alvo: m, ajudante: true, base: 2 });
      if (m.desgaste > F().desgasteParaGraxa && !(m.lubrificado > 0)) T.push({ id: 'graxa_' + m.id, setor: 'manutencao', tipo: 'graxa', alvo: m, ajudante: true });
      if (m.cabo && m.ligada && ((m.estado === 'concluida' && m.bobina) || (m.estado === 'pronta' && m.alinhado) || (m.estado === 'desalinhada' && m.bobina)) && m.autoLote)
        T.push({ id: 'operar_' + m.id, setor: 'producao', tipo: 'operar', alvo: m, certificado: m.def.tipo });
    });
    return T.filter(t => !st.lista.some(f => f.tarefa && f.tarefa.id === t.id));
  }
  function pode(f, t) {
    if (t.certificado) return f.certificados.includes(t.certificado);
    return true;    // serviço de ajudante: qualquer um (a 60% se não for o cargo)
  }
  function escolherTarefa(f) {
    const ts = tarefasAbertas().filter(t => pode(f, t));
    if (!ts.length) return null;
    ts.sort((a, b) => score(f, b) - score(f, a));
    return ts[0];
  }
  function score(f, t) {
    const cargoBate = F().cargos[f.cargo].setores.includes(t.setor) ? 2 : 0;
    const dist = Math.hypot(f.x - t.alvo.x, f.z - t.alvo.z);
    return PESO_PRIO[st.prioridade[t.setor]] * 10 + (t.base || 0) * 5 + cargoBate - dist * 0.05;
  }

  // ---------------- MÁQUINA DE ESTADOS (10 Hz) ----------------
  function eficiencia(f, t) {
    const noCargo = t && F().cargos[f.cargo].setores.includes(t.setor);
    return (noCargo ? 1 : F().eficienciaAjudante) * (0.6 + f.atributos.ritmo * 0.5) * (f.energia < 0.25 ? 0.6 : 1);
  }
  function passo(f, dt) {
    const h = PT.tempo.st.minutos / 60;
    if (PT.tempo.st.dia * 24 + h < f.ausenteAte) { f.g.visible = false; return; } else f.g.visible = true;
    if (st.tartaruga > 0) { irPara(f, cafe(f), dt); f.estado = 'tartaruga'; return; }
    if (h >= 12 && h < 13) { if (f.tarefa && f.estado !== 'executar') cancelar(f); irPara(f, cafe(f), dt); f.estado = 'almoço'; f.energia = Math.min(1, f.energia + dt * 0.02); return; }
    switch (f.estado) {
      case 'parado': case 'almoço': case 'café': case 'tartaruga':
        f.tarefa = escolherTarefa(f);
        if (f.tarefa) { f.estado = 'deslocar'; f.etapa = 0; }
        else { f.estado = 'café'; irPara(f, cafe(f), dt); f.energia = Math.min(1, f.energia + dt * 0.01); }
        break;
      case 'deslocar': {
        const t = f.tarefa; if (!valida(t)) { cancelar(f); break; }
        const destino = destinoDa(f, t);
        if (irPara(f, destino, dt)) { f.estado = 'executar'; f.tempo = 0; }
        break;
      }
      case 'executar': {
        const t = f.tarefa; if (!valida(t)) { cancelar(f); break; }
        f.tempo += dt * eficiencia(f, t);
        if (executar(f, t)) { f.estado = 'parado'; f.tarefa = null; f.energia = Math.max(0, f.energia - F().energiaPorTarefa); }
        break;
      }
    }
  }
  function valida(t) {
    if (!t) return false;
    if (t.tipo === 'tirarPilha') return PT.ent.lista.includes(t.alvo) && (t.alvo.preso === 'funcionario' || !t.alvo.preso);
    if (t.tipo === 'limparEnrosco') return t.alvo.estado === 'enroscada';
    return PT.maq.lista.includes(t.alvo);
  }
  function destinoDa(f, t) {
    if (t.tipo === 'tirarPilha' && f.carregando) return zonaVerdeLivre(f.carregando);
    if (t.tipo === 'tirarPilha') return { x: t.alvo.x, z: t.alvo.z + 1.2 };
    if (t.tipo === 'operar') { const p = PT.maq.pontoEntrada(t.alvo); return { x: t.alvo.x - t.alvo.def.dims[0] / 2 + 1, z: t.alvo.z + t.alvo.def.dims[1] / 2 + 0.9 }; }
    return { x: t.alvo.x, z: t.alvo.z + t.alvo.def.dims[1] / 2 + 0.9 };
  }
  function executar(f, t) {
    const dur = F().duracao[t.tipo];
    if (f.tempo < dur) return false;
    if (t.tipo === 'tirarPilha') {
      if (!f.carregando) { f.carregando = t.alvo; t.alvo.preso = 'funcionario'; f.estado = 'deslocar'; return false; }
      // chegou na zona verde: solta (e talvez esconda as tortas...)
      const pl = f.carregando; f.carregando = null; const d = zonaVerdeLivre(pl);
      PT.estoque.soltarNoChao(pl, d.x, d.z);
      if (pl.defeituosas > 0 && ['apressado', 'distraído'].includes(f.personalidade) && PT.tempo.st.dia * 24 > f.orientadoAte && Math.random() < F().chanceEsconderTorta) {
        pl.tortasEscondidas = true; PT.estoque.atualizarPilha(pl); PT.ev.emit('loteSuspeito', { f, pl });
      }
      return true;
    }
    if (t.tipo === 'limparEnrosco') { t.alvo.estado = t.alvo.ligada ? 'pronta' : 'desligada'; PT.maq.atualizarEstado(t.alvo); PT.ev.emit('aviso', f.nome.split(' ')[0] + ' cortou o enrosco da ' + t.alvo.nome + '.'); return true; }
    if (t.tipo === 'graxa') { t.alvo.lubrificado = 300; return true; }
    if (t.tipo === 'operar') {
      const m = t.alvo;
      if (!m.alinhado && m.bobina) PT.maq.alinhar(m, PT.util.clamp(f.atributos.competencia + PT.util.rand(-0.15, 0.1) - (f.personalidade === 'distraído' ? 0.15 : 0), 0, 1));
      PT.maq.iniciar(m); return true;
    }
    return true;
  }
  function cancelar(f) { soltar(f); f.tarefa = null; f.estado = 'parado'; }
  function soltar(f) { if (f.carregando) { PT.estoque.soltarNoChao(f.carregando, f.carregando.x, f.carregando.z); f.carregando = null; } }
  function cafe(f) { const i = st.lista.indexOf(f); return { x: 12 + (i % 3) * 1.2, z: 30 + Math.floor(i / 3) * 1.2 }; }
  function zonaVerdeLivre(pl) {
    const z = PT.DADOS.mundo.zonas.expedicao;
    for (let zz = z.z0 + 1; zz < z.z1 - 0.5; zz += 1.3) for (let xx = z.x0 + pl.comprimento / 2 + 0.3; xx < z.x1 - pl.comprimento / 2; xx += 1) {
      const fp = PT.construcao.footprint(xx, zz, pl.dims, 0);
      if (!PT.ent.lista.some(e => e !== pl && !e.preso && e.aabb && PT.construcao.cruza(fp, e.aabb))) return { x: xx, z: zz };
    }
    return { x: (z.x0 + z.x1) / 2, z: (z.z0 + z.z1) / 2 };
  }
  // anda em linha reta desviando de obstáculos (empurrão); retorna true quando chegou
  function irPara(f, d, dt) {
    const dx = d.x - f.x, dz = d.z - f.z, dist = Math.hypot(dx, dz);
    if (dist < 0.4) return true;
    const v = F().velocidade * (0.7 + f.atributos.ritmo * 0.6) * (f.energia < 0.25 ? 0.6 : 1) * (f.carregando ? 0.7 : 1);
    const passo = Math.min(dist, v * dt);
    let nx = f.x + dx / dist * passo, nz = f.z + dz / dist * passo;
    const p = PT.mundo.empurrar(nx, nz, 0.3); f.x = p.x; f.z = p.z; f.rot = Math.atan2(dx, dz);
    return false;
  }

  // ---------------- laço ----------------
  function atualizar(dt) {
    if (!st.lista.length) return;
    acum += Math.min(dt, 0.25) * PT.tempo.vel;
    const tick = 1 / F().hz;
    let n = 0;
    while (acum >= tick && n < 50) { acum -= tick; st.lista.forEach(f => passo(f, tick)); n++; }
    st.lista.forEach(f => {
      f.g.position.set(f.x, 0, f.z); f.g.rotation.y = f.rot;
      if (f.carregando) { f.carregando.x = f.x + Math.sin(f.rot) * 1.0; f.carregando.z = f.z + Math.cos(f.rot) * 1.0; f.carregando.y = 0.5; f.carregando.rot = f.rot + Math.PI / 2; PT.ent.sync(f.carregando); }
      // ícone de estado para ler o gargalo de relance (Gemini)
      const ic = f.tarefa ? { tirarPilha: '📦', limparEnrosco: '🔧', graxa: '🛢', operar: '⚙' }[f.tarefa.tipo] : ({ 'café': '☕', 'almoço': '🍽', tartaruga: '🪧' }[f.estado] || '❓');
      if (f.g.userData.rotulo) { const r = ic + ' ' + f.nome.split(' ')[0] + ' — ' + (f.tarefa ? F().nomesTarefa[f.tarefa.tipo] : (f.estado === 'café' ? 'sem tarefa (café)' : f.estado)); if (r !== f.ultRot) { f.ultRot = r; f.g.userData.rotulo.userData.atualizar(r); } }
    });
  }

  // ---------------- folha e tartaruga ----------------
  function folhaMensal() { return st.lista.reduce((a, f) => a + f.salario * (1 + PT.DADOS.economia.encargos), 0); }
  PT.ev.on('dia', ({ dia }) => {
    if (st.tartaruga > 0) st.tartaruga -= 1;
    if (dia % 15 === 13 && st.lista.length) PT.ev.emit('celular', { de: 'RH', texto: 'Folha quinzenal em 2 dias: ' + PT.util.reais(folhaMensal() / 2) + '.' });
    if (dia % 15 === 0 && st.lista.length) {
      const v = folhaMensal() / 2;
      if (PT.eco.pagar(v, 'Folha quinzenal (' + st.lista.length + ' funcionários)')) { st.tartaruga = 0; }
      else { st.tartaruga = 2; st.devendo = v; PT.ev.emit('celular', { de: 'Equipe', texto: 'SEM PIX, SEM TELHA! Operação tartaruga até cair o salário.' }); }
    }
    if (dia - st.ultimoCandidatos >= 3) gerarCandidatos();
  });
  // curso na Escola Técnica Parecis: some 1 dia e volta certificado (certificado decorativo na parede)
  function treinar(id, cert) {
    const f = st.lista.find(x => x.id === id); if (!f || f.certificados.includes(cert)) return { ok: false, msg: 'Já tem esse certificado.' };
    if (!PT.eco.pagar(F().cursoPreco, 'Curso de ' + cert + ' — ' + f.nome)) return { ok: false, msg: 'Sem dinheiro para o curso.' };
    cancelar(f); f.ausenteAte = PT.tempo.st.dia * 24 + PT.tempo.st.minutos / 60 + F().cursoHoras; f.certificados.push(cert);
    return { ok: true, msg: f.nome.split(' ')[0] + ' foi para a Escola Técnica Parecis. Volta amanhã certificado em ' + cert + '.' };
  }
  function pagarAtrasado() {
    if (!st.devendo) return false;
    const multa = st.devendo * F().multaAtraso;
    if (!PT.eco.pagar(st.devendo + multa, 'Folha atrasada + multa')) return false;
    st.devendo = 0; st.tartaruga = 0; PT.ev.emit('celular', { de: 'Equipe', texto: 'Caiu o Pix! Bora trabalhar.' }); return true;
  }

  // ---------------- interações ----------------
  PT.inter.registrar(j => {
    if (j.controlando || j.carregando) return null;
    const ops = [];
    const pl = PT.ent.perto(j.x, j.z, 2.2, o => o.tipo === 'pilha' && o.tortasEscondidas);
    if (pl) ops.push({ rotulo: 'Inspecionar o lote (está meio esquisito...)', prio: 1, acao: () => { pl.tortasEscondidas = false; PT.estoque.atualizarPilha(pl); PT.ev.emit('aviso', 'Achou ' + pl.defeituosas + ' telha(s) torta(s) escondida(s) no meio da pilha!'); } });
    const f = st.lista.filter(x => Math.hypot(x.x - j.x, x.z - j.z) < 2 && x.g.visible).sort((a, b) => Math.hypot(a.x - j.x, a.z - j.z) - Math.hypot(b.x - j.x, b.z - j.z))[0];
    if (f) {
      ops.push({ rotulo: 'Orientar ' + f.nome.split(' ')[0] + ' (' + f.personalidade + ', energia ' + Math.round(f.energia * 100) + '%)', prio: 3, acao: () => {
        f.orientadoAte = PT.tempo.st.dia * 24 + PT.tempo.st.minutos / 60 + F().diasOrientacao * 24; PT.ev.emit('aviso', f.nome.split(' ')[0] + ': "Pode deixar, patrão, vou caprichar!"'); } });
    }
    return ops;
  });

  return {
    st, vagas, gerarCandidatos, contratar, demitir, treinar, tarefasAbertas, folhaMensal, pagarAtrasado, atualizar,
    salvar() { return { prioridade: st.prioridade, cont: st.cont, tartaruga: st.tartaruga, devendo: st.devendo || 0, candidatos: st.candidatos,
      lista: st.lista.map(f => ({ id: f.id, nome: f.nome, cargo: f.cargo, atributos: f.atributos, personalidade: f.personalidade, salario: f.salario, certificados: f.certificados, energia: f.energia, x: f.x, z: f.z, orientadoAte: f.orientadoAte, ausenteAte: f.ausenteAte })) }; },
    carregar(o) {
      if (!o) return;
      Object.assign(st, { prioridade: o.prioridade || st.prioridade, cont: o.cont || 0, tartaruga: o.tartaruga || 0, devendo: o.devendo || 0, candidatos: o.candidatos || [] });
      (o.lista || []).forEach(s => { const f = Object.assign({ estado: 'parado', tarefa: null, carregando: null, rot: 0, xp: {} }, s); criarVisual(f); st.lista.push(f); });
    }
  };
})();
