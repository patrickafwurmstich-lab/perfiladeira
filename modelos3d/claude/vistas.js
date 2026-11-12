// node vistas.js saida.png "id|yaw|pitch|zoom|dx|dy|dz" ...  → mosaico 2 colunas
const { chromium } = require('playwright'); const { execSync } = require('child_process');
(async () => {
  const b = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-webgl', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 900, height: 520 } }); const out = process.argv[2], arqs = [];
  for (const [i, v] of process.argv.slice(3).entries()) {
    const [id, yaw, pitch, zoom, dx, dy, dz] = v.split('|');
    await p.goto(`http://localhost:8765/modelos3d/claude/vista.html?id=${id}&yaw=${yaw||0.7}&pitch=${pitch||0.35}&zoom=${zoom||1}&dx=${dx||0}&dy=${dy||0}&dz=${dz||0}`);
    await p.waitForFunction(() => window.__ok, null, { timeout: 30000 });
    const f = `/tmp/claude-0/-home-claude/7d2cc255-f58b-5285-97b1-f4ca9d497ea3/scratchpad/v_${i}.png`; await p.screenshot({ path: f }); arqs.push(f);
  }
  await b.close();
  execSync('python3 ' + __dirname + '/mosaico.py ' + out + ' ' + arqs.join(' '));
})();
