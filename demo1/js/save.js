// =====================================================================
// save.js — salvar/carregar em JSON com save_version.
// Só salva em ESTADO ESTÁVEL: sem carga na ponte, nada caindo, nada na
// mão, fora do modo construção e personagem vivo (evita save corrompido).
// Carregar = guarda o JSON e recarrega a página (mundo limpo).
// Vector/rotação viram números simples.
// =====================================================================
window.PT = window.PT || {};

PT.save = (function () {
  const CHAVE = 'parecis_demo1_save', CHAVE_CARREGAR = 'parecis_demo1_carregar';
  const TIPOS_SALVOS = ['bobina', 'pilha', 'volume', 'paleteira', 'berco', 'decor', 'empilhadeira'];

  function estavel() {
    const j = PT.mundo.jog;
    if (j.morto) return 'Você está... ocupado morrendo.';
    if (j.carregando) return 'Solte o que está carregando.';
    if (j.controlando) return 'Largue a botoeira.';
    if (PT.ponte.emOperacao()) return 'Tem carga na ponte ou caindo.';
    if (PT.ent.lista.some(o => o.tipo === 'empilhadeira' && o.carga)) return 'Solte a carga da empilhadeira.';
    if (PT.construcao.ativo) return 'Saia do modo construção.';
    if (PT.entrega.st.caminhoes.some(c => c.estado !== 'saindo')) return 'Tem caminhão no pátio (espere ele sair).';
    if (PT.ui.modalAberto()) return 'Feche a janela aberta.';
    return null;
  }

  function montar() {
    const ents = PT.ent.lista.filter(o => TIPOS_SALVOS.includes(o.tipo)).map(o => {
      const b = { id: o.id, tipo: o.tipo, x: +o.x.toFixed(3), z: +o.z.toFixed(3), y: o.montadaEm ? +o.y.toFixed(3) : 0, rot: +(o.rot || 0).toFixed(4) };
      if (o.tipo === 'bobina') Object.assign(b, { spec: o.spec, codigo: o.codigo, pesoKg: o.pesoKg, metros: o.metros });
      if (o.tipo === 'pilha') Object.assign(b, { produto: o.produto, comprimento: o.comprimento, qtd: o.qtd, defeituosas: o.defeituosas });
      if (o.tipo === 'volume') Object.assign(b, { item: o.item, pequeno: !!o.pequeno });
      if (o.tipo === 'decor') Object.assign(b, { item: o.item });
      if (o.tipo === 'empilhadeira') Object.assign(b, { garfoY: o.garfoY, acessorio: o.acessorio, bateria: o.bateria, tombada: o.tombada });
      return b;
    });
    return {
      save_version: PT.DADOS.save_version, versao_jogo: PT.DADOS.versao, salvoEm: new Date().toISOString(),
      tempo: { dia: PT.tempo.st.dia, minutos: PT.tempo.st.minutos },
      jogador: { x: PT.mundo.jog.x, z: PT.mundo.jog.z },
      eco: PT.eco.salvar(), rep: PT.rep.salvar(), zoeira: PT.zoeira.salvar(), estoque: PT.estoque.salvar(),
      construcao: PT.construcao.salvar(), ponte: PT.ponte.salvar(), entrega: PT.entrega.salvar(), pedidos: PT.pedidos.salvar(),
      entidades: ents, maquinas: PT.maq.salvar(), correio: PT.ui.salvarCorreio()
    };
  }

  function salvar() {
    const motivo = estavel(); if (motivo) { PT.ev.emit('aviso', 'Não dá para salvar agora: ' + motivo); return false; }
    try { localStorage.setItem(CHAVE, JSON.stringify(montar())); PT.ev.emit('aviso', '💾 Jogo salvo (' + PT.tempo.rotulo() + ').'); return true; }
    catch (e) { PT.ev.emit('aviso', 'Erro ao salvar: ' + e.message); return false; }
  }
  function exportar() {
    const motivo = estavel(); if (motivo) { PT.ev.emit('aviso', 'Não dá para exportar agora: ' + motivo); return; }
    const blob = new Blob([JSON.stringify(montar(), null, 1)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'parecis_save_dia' + PT.tempo.st.dia + '.json'; a.click();
  }
  function existe() { try { return !!localStorage.getItem(CHAVE); } catch (e) { return false; } }
  function pedirCarregar(json) {
    try { localStorage.setItem(CHAVE_CARREGAR, json || localStorage.getItem(CHAVE)); location.reload(); }
    catch (e) { PT.ev.emit('aviso', 'Erro: ' + e.message); }
  }
  function importarArquivo(file) { const r = new FileReader(); r.onload = () => pedirCarregar(r.result); r.readAsText(file); }

  // migrações: quando save_version subir, converter aqui (v1 → v2 ...)
  function migrar(s) {
    if (!s.save_version) throw new Error('Arquivo sem save_version');
    if (s.save_version > PT.DADOS.save_version) throw new Error('Save de versão mais nova (' + s.save_version + ')');
    // if (s.save_version === 1) { ...converter...; s.save_version = 2; }
    return s;
  }

  // chamado no início (main.js). Retorna true se carregou um save.
  // validação mínima antes de mexer em qualquer coisa do jogo
  function validar(s) {
    const precisa = ['tempo', 'jogador', 'eco', 'rep', 'zoeira', 'estoque', 'construcao', 'ponte', 'entrega', 'pedidos', 'entidades', 'maquinas'];
    precisa.forEach(k => { if (s[k] === undefined) throw new Error('save sem o campo "' + k + '"'); });
    if (!Number.isFinite(s.eco.caixa)) throw new Error('caixa inválido');
    if (!Array.isArray(s.entidades) || !Array.isArray(s.maquinas)) throw new Error('listas inválidas');
    s.maquinas.forEach(m => { if (!PT.DADOS.maquinas[m.defId]) throw new Error('máquina desconhecida: ' + m.defId); });
    s.entidades.forEach(e => { if (e.tipo === 'bobina' && !PT.DADOS.bobinas[e.spec]) throw new Error('bobina desconhecida: ' + e.spec); });
  }

  function carregarPendente() {
    let txt = null;
    try { txt = localStorage.getItem(CHAVE_CARREGAR); } catch (e) { }
    if (!txt) return false;
    let s;
    try { s = migrar(JSON.parse(txt)); validar(s); }
    catch (e) { try { localStorage.removeItem(CHAVE_CARREGAR); } catch (x) { } throw new Error('arquivo de save inválido (' + e.message + '). Seu save anterior continua guardado.'); }
    try { localStorage.removeItem(CHAVE_CARREGAR); } catch (e) { }
    PT.tempo.carregar(s.tempo);
    PT.eco.carregar(s.eco); PT.rep.carregar(s.rep); PT.estoque.carregar(s.estoque); PT.construcao.carregar(s.construcao);
    PT.ponte.carregar(s.ponte); PT.entrega.carregar(s.entrega);
    s.entidades.forEach(b => {
      if (b.tipo === 'bobina') PT.estoque.novaBobina(b.spec, b.x, b.z, b.y, { codigo: b.codigo, pesoKg: b.pesoKg, metros: b.metros, id: b.id, rot: b.rot });
      else if (b.tipo === 'pilha') { const p = PT.estoque.novaPilha(b.produto, b.comprimento, b.x, b.z, { id: b.id, rot: b.rot }); p.qtd = b.qtd; p.defeituosas = b.defeituosas; PT.estoque.atualizarPilha(p); }
      else if (b.tipo === 'volume') {
        const f = PT.loja.ficha(b.item);
        if (b.pequeno) PT.ent.add({ id: b.id, tipo: 'volume', modelo: 'volume_caixa', item: b.item, rotulo: f.nome, pesoKg: f.pesoKg || 20, pequeno: true, solido: false, x: b.x, z: b.z, rot: b.rot });
        else PT.ent.add({ id: b.id, tipo: 'volume', modelo: 'volume_engradado', item: b.item, rotulo: 'Engradado: ' + f.nome, dimsVisual: [Math.min(f.dims[0], 4), f.dims[1], f.dims[2] + 0.2], pesoKg: f.pesoKg, icavel: true, solido: true, x: b.x, z: b.z, rot: b.rot });
      }
      else if (b.tipo === 'paleteira') PT.ent.add({ id: b.id, tipo: 'paleteira', modelo: 'paleteira', x: b.x, z: b.z, rot: b.rot, solido: false });
      else if (b.tipo === 'empilhadeira') PT.empi.criar(b.x, b.z, b.rot, { id: b.id, garfoY: b.garfoY || 0, acessorio: b.acessorio || 'garfos', bateria: Number.isFinite(b.bateria) ? b.bateria : 1, tombada: b.tombada || 0 });
      else if (b.tipo === 'berco') PT.ent.add({ id: b.id, tipo: 'berco', modelo: 'berco_bobina', x: b.x, z: b.z, rot: b.rot, solido: false });
      else if (b.tipo === 'decor') { const f = PT.loja.ficha(b.item); PT.ent.add({ id: b.id, tipo: 'decor', item: b.item, modelo: f.modelo, rotulo: f.nome, x: b.x, z: b.z, rot: b.rot, solido: true }); }
    });
    PT.maq.carregar(s.maquinas);
    PT.pedidos.carregar(s.pedidos);
    PT.zoeira.carregar(s.zoeira);
    PT.ui.carregarCorreio(s.correio);
    PT.mundo.jog.x = s.jogador.x; PT.mundo.jog.z = s.jogador.z;
    PT.ev.emit('aviso', 'Save carregado: ' + PT.tempo.rotulo());
    return true;
  }

  // salvamento automático no começo de cada dia (se estiver estável)
  PT.ev.on('dia', () => { if (!estavel()) { try { localStorage.setItem(CHAVE, JSON.stringify(montar())); } catch (e) { } } });

  return { salvar, exportar, existe, pedirCarregar, importarArquivo, carregarPendente, estavel, montar };
})();
