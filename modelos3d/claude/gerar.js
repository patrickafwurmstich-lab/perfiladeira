// node gerar.js [ids...]  → gera glb/<id>.glb e relatorio.json
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage(); const er = [];
  p.on('pageerror', e => er.push(e.message)); p.on('console', m => { if (m.type() === 'error') er.push(m.text()); });
  await p.goto('http://localhost:8765/modelos3d/claude/oficina.html'); await p.waitForTimeout(300);
  const ids = process.argv.slice(2).length ? process.argv.slice(2) : await p.evaluate(() => Object.keys(OF.MODELOS));
  const rel = [];
  for (const id of ids) {
    const r = await p.evaluate(async id => {
      try { const g = OF.MODELOS[id](); const buf = await OF.exportarGLB(g);
        const bytes = new Uint8Array(buf); let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return { id, b64: btoa(s), tris: OF.triangulos(g), med: OF.medidas(g) };
      } catch (e) { return { id, erro: e.message + ' ' + (e.stack || '').split('\n')[1] }; }
    }, id);
    if (r.erro) { console.log('ERRO', id, r.erro); rel.push(r); continue; }
    fs.writeFileSync(path.join(__dirname, 'glb', id + '.glb'), Buffer.from(r.b64, 'base64'));
    delete r.b64; rel.push(r); console.log(id.padEnd(26), String(r.tris).padStart(6), 'tri', r.med.x + ' x ' + r.med.z + ' x ' + r.med.y + ' m', 'minY ' + r.med.minY);
  }
  const arq = path.join(__dirname, 'relatorio.json'); const ant = fs.existsSync(arq) ? JSON.parse(fs.readFileSync(arq)) : {};
  rel.forEach(r => ant[r.id] = r); fs.writeFileSync(arq, JSON.stringify(ant, null, 1));
  if (er.length) console.log('ERROS DA PÁGINA:', er.slice(0, 5));
  await b.close();
})();
