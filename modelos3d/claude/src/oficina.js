// =====================================================================
// oficina.js — ferramentas para modelar em código (three.js r128 → GLB)
// Estilo: low poly arredondado, cores chapadas e foscas, compatível com
// Grab3D "Cozy Industrial" e ithappy. Escala real em metros, pivot no
// chão (Y=0) e no centro da base; comprimento no eixo X.
// =====================================================================
window.OF = (function () {
  // paleta única do jogo (acertada com o kit industrial do Grab3D)
  const COR = {
    teal: 0x3dae9f, tealEsc: 0x2b8a7e, menta: 0x9fdcc9, amarelo: 0xf5c84b, laranja: 0xf08a3c,
    vermelho: 0xe0574f, verde: 0x5cc26b, azul: 0x5aa0d8, preto: 0x2b2f36, grafite: 0x4a525c,
    cinza: 0x8e98a2, aco: 0xaab4bd, galvalume: 0xa7b1b9, galvEsc: 0x87939d, branco: 0xf4f1ea,
    madeira: 0xc98d52, madeiraEsc: 0x9a6538, concreto: 0xbdb8ae, latao: 0xd8a93b, borracha: 0x30343a
  };
  const cacheMat = {};
  function mat(cor, op) {
    op = op || {};
    const k = cor + '|' + JSON.stringify(op);
    if (!cacheMat[k]) {
      // cores da paleta estão em sRGB; o glTF guarda cor LINEAR (sem isso tudo sai desbotado)
      const metal = [COR.galvalume, COR.galvEsc, COR.aco].includes(cor);   // chapa/aço: leve brilho metálico
      const o = Object.assign(metal ? { roughness: 0.45, metalness: 0.35 } : { roughness: 0.75, metalness: 0.0 }, op);
      if (o.emissive !== undefined) o.emissive = new THREE.Color(o.emissive).convertSRGBToLinear();
      cacheMat[k] = new THREE.MeshStandardMaterial(o); cacheMat[k].color = new THREE.Color(cor).convertSRGBToLinear();
    }
    return cacheMat[k];
  }
  function malha(geo, cor, nome, op) { const m = new THREE.Mesh(geo, typeof cor === 'object' ? cor : mat(cor, op)); if (nome) m.name = nome; return m; }

  // caixa arredondada (w = X, h = Y, d = Z); raio padrão proporcional
  function caixa(w, h, d, cor, nome, raio, seg) {
    raio = raio === undefined ? Math.min(0.04, Math.min(w, h, d) * 0.18) : raio;
    const g = raio > 0 ? new THREE.RoundedBoxGeometry(w, h, d, seg || 2, raio) : new THREE.BoxGeometry(w, h, d);
    return malha(g, cor, nome);
  }
  // cilindro com borda arredondada (eixo Y), feito em torno
  function cilindro(r, h, cor, nome, raioBorda, lados) {
    raioBorda = raioBorda === undefined ? Math.min(r * 0.25, h * 0.25, 0.03) : raioBorda;
    const pts = [], b = raioBorda, n = 3;
    pts.push(new THREE.Vector2(0, -h / 2));
    for (let i = 0; i <= n; i++) { const a = -Math.PI / 2 + (i / n) * Math.PI / 2; pts.push(new THREE.Vector2(r - b + Math.cos(a) * b, -h / 2 + b + Math.sin(a) * b)); }
    for (let i = 0; i <= n; i++) { const a = (i / n) * Math.PI / 2; pts.push(new THREE.Vector2(r - b + Math.cos(a) * b, h / 2 - b + Math.sin(a) * b)); }
    pts.push(new THREE.Vector2(0, h / 2));
    return malha(new THREE.LatheGeometry(pts, lados || 20), cor, nome);
  }
  // anel/tubo grosso (bobina): raio interno, externo, largura (eixo Y)
  function anel(ri, re, h, cor, nome, lados, borda) {
    const b = borda === undefined ? Math.min(0.03, (re - ri) * 0.2) : borda, n = 2, pts = [];
    const canto = (cx, cy, a0) => { for (let i = 0; i <= n; i++) { const a = a0 + (i / n) * Math.PI / 2; pts.push(new THREE.Vector2(cx + Math.cos(a) * b, cy + Math.sin(a) * b)); } };
    canto(re - b, -h / 2 + b, -Math.PI / 2); canto(re - b, h / 2 - b, 0); canto(ri + b, h / 2 - b, Math.PI / 2); canto(ri + b, -h / 2 + b, Math.PI);
    pts.push(pts[0].clone());
    return malha(new THREE.LatheGeometry(pts, lados || 28), cor, nome);
  }
  // extrusão de um perfil 2D (pontos [x,y]) ao longo de Z, com chanfro leve
  function extrudar(pontos, comp, cor, nome, chanfro) {
    const s = new THREE.Shape(pontos.map(p => new THREE.Vector2(p[0], p[1])));
    const geo = new THREE.ExtrudeGeometry(s, { depth: comp, bevelEnabled: !!chanfro, bevelThickness: chanfro || 0, bevelSize: chanfro || 0, bevelSegments: 1, curveSegments: 6 });
    geo.translate(0, 0, -comp / 2);
    return malha(geo, cor, nome);
  }
  // perfil de chapa (linha aberta) vira polígono fechado com espessura
  function chapaPerfil(linha, esp) {
    const ida = [], volta = [];
    for (let i = 0; i < linha.length; i++) {
      const p = linha[i], a = linha[Math.max(0, i - 1)], c = linha[Math.min(linha.length - 1, i + 1)];
      let nx = -(c[1] - a[1]), ny = c[0] - a[0]; const l = Math.hypot(nx, ny) || 1; nx /= l; ny /= l;
      ida.push([p[0], p[1]]); volta.unshift([p[0] + nx * esp, p[1] + ny * esp]);
    }
    return ida.concat(volta);
  }
  // textura com texto (exportada embutida no GLB)
  function texturaTexto(w, h, desenhar) {
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d'); desenhar(ctx, w, h);
    const t = new THREE.CanvasTexture(cv); t.encoding = THREE.sRGBEncoding; t.anisotropy = 4; return t;
  }
  function grupo(nome, filhos) { const g = new THREE.Group(); g.name = nome; (filhos || []).forEach(f => g.add(f)); return g; }
  function pos(o, x, y, z) { o.position.set(x, y, z); return o; }
  function rot(o, x, y, z) { o.rotation.set(x || 0, y || 0, z || 0); return o; }

  function triangulos(obj) { let t = 0; obj.traverse(o => { if (o.isMesh) { const g = o.geometry; t += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); return Math.round(t); }
  function medidas(obj) { const b = new THREE.Box3().setFromObject(obj), s = b.getSize(new THREE.Vector3()); return { x: +s.x.toFixed(3), y: +s.y.toFixed(3), z: +s.z.toFixed(3), minY: +b.min.y.toFixed(3) }; }

  function exportarGLB(obj) {
    return new Promise((ok, erro) => {
      new THREE.GLTFExporter().parse(obj, r => ok(r), { binary: true, onlyVisible: true, embedImages: true });
    });
  }
  return { COR, mat, malha, caixa, cilindro, anel, extrudar, chapaPerfil, texturaTexto, grupo, pos, rot, triangulos, medidas, exportarGLB, MODELOS: {} };
})();
