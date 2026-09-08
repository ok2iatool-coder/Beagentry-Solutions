// Beagentry: sirve salida/ para revisar las demos antes de subirlas.
//
//   node beagentry/serve.mjs [puerto]        (por defecto 5190)
//
// La raiz es docs/ (la web publica: agencia + escaparates, lo mismo que sirve
// GitHub Pages) y detras salida/ lo generado. /demos lista los negocios generados
// con enlace a la web, la pagina de activacion y el legal. Sin cache.

import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = fileURLToPath(new URL('.', import.meta.url)).replace(/[/\\]*$/, sep);
const SALIDA = join(AQUI, 'salida') + sep;
const WEB = join(AQUI, 'docs') + sep;
const PORT = Number(process.argv[2] || 5190);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.glb': 'model/gltf-binary',
  '.woff2': 'font/woff2',
};

async function indice() {
  const dirs = [];
  for (const d of await readdir(SALIDA, { withFileTypes: true }).catch(() => [])) {
    if (!d.isDirectory()) continue;
    const tieneActivar = await stat(join(SALIDA, d.name, 'activar.html')).then(() => true, () => false);
    dirs.push({ slug: d.name, activar: tieneActivar });
  }
  const filas = dirs.map((d) => `<li><b>${d.slug}</b> · <a href="/${d.slug}/">web</a>${d.activar ? ` · <a href="/${d.slug}/activar.html">activar</a>` : ' · <i>entrega final</i>'} · <a href="/${d.slug}/legal.html">legal</a></li>`).join('');
  return `<!doctype html><meta charset="utf-8"><title>Beagentry · demos</title>
<style>body{font-family:system-ui;max-width:720px;margin:48px auto;padding:0 16px;line-height:1.7}li{padding:6px 0;border-bottom:1px solid #eee}code{background:#f4f4f4;padding:2px 6px;border-radius:4px}</style>
<h1>Beagentry · demos generadas</h1>
${dirs.length ? `<ul>${filas}</ul>` : '<p>No hay nada en <code>salida/</code>. Genera una con <code>node beagentry/generar.mjs clientes/pizzeria-mario.json</code>.</p>'}`;
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  let ruta = decodeURIComponent(url.pathname);
  if (ruta === '/demos' || ruta === '/demos/') {
    res.writeHead(200, { 'content-type': TYPES['.html'], 'cache-control': 'no-store' });
    return res.end(await indice());
  }
  if (ruta.endsWith('/')) ruta += 'index.html';
  const candidatos = [normalize(join(WEB, ruta)), normalize(join(SALIDA, ruta))];
  if (!candidatos[0].startsWith(WEB) || !candidatos[1].startsWith(SALIDA)) { res.writeHead(403); return res.end(); }
  try {
    const fichero = candidatos[0];
    const cuerpo = await readFile(fichero).catch(() => readFile(candidatos[1]));
    res.writeHead(200, { 'content-type': TYPES[extname(ruta).toLowerCase()] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(cuerpo);
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('no existe: ' + ruta);
  }
}).listen(PORT, () => console.log(`[beagentry] http://localhost:${PORT}`));
