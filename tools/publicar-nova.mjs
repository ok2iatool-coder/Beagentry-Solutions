// Recompila Nova Engine y lo deja en docs/nova-engine/ listo para publicar.
//
//   node beagentry/tools/publicar-nova.mjs
//
// Vite reescribe index.html en cada compilacion, asi que la barra de autoria de
// Beagentry se vuelve a inyectar aqui. El build va con --base=./ porque en
// GitHub Pages la web cuelga de /Beagentry-Solutions/ y las rutas absolutas
// (/assets/...) apuntarian a la raiz del dominio y darian 404.
//
// Guardar en disco y exportar necesitan el servidor de nova-engine en el 5180:
// en la copia publica salen como "API offline", que es lo correcto.

import { spawnSync } from 'node:child_process';
import { cpSync, rmSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = fileURLToPath(new URL('.', import.meta.url)).replace(/[/\\]*$/, sep);
const BEAGENTRY = resolve(AQUI, '..');
const RAIZ = resolve(BEAGENTRY, '..');
const NOVA = join(RAIZ, 'nova-engine');
const NODE = 'C:/Users/rdmat/tools/node-v24.19.0-win-x64/node.exe';
const DESTINO = join(BEAGENTRY, 'docs', 'nova-engine');

const BARRA = `    <!-- Beagentry: barra de autoria, la reinyecta tools/publicar-nova.mjs -->
    <style>
      #bea-autor{position:fixed;right:12px;bottom:34px;z-index:9999;display:flex;align-items:center;gap:.7rem;
        font:400 10px/1 Inter,system-ui,"Segoe UI",sans-serif;letter-spacing:.16em;text-transform:uppercase;
        color:#8b95a3;padding:.5rem .8rem;border:1px solid rgba(255,255,255,.12);border-radius:999px;
        background:rgba(10,14,20,.82);backdrop-filter:blur(10px);text-decoration:none;transition:border-color .3s,color .3s}
      #bea-autor:hover{border-color:rgba(255,255,255,.4);color:#e8edf4}
      #bea-autor .p{color:#3ba0ff}
      #bea-autor .p::before{content:"";display:inline-block;width:5px;height:5px;border-radius:50%;
        background:#3ba0ff;margin-right:.45rem;vertical-align:middle;box-shadow:0 0 8px #3ba0ff}
      #bea-autor b{font-weight:600;color:#e8edf4;letter-spacing:.1em}
      #bea-autor .sep{width:1px;height:11px;background:rgba(255,255,255,.15)}
      @media(max-width:820px){#bea-autor .largo{display:none}}
    </style>
    <a id="bea-autor" href="../" title="Beagentry">
      <span class="p">Prueba</span><span class="sep"></span>
      <span><span class="largo">Editor 3D en el navegador, </span>hecho por <b>Beagentry</b></span>
    </a>
`;

if (!existsSync(join(NOVA, 'node_modules'))) {
  console.error('nova-engine sin node_modules: instala dependencias antes');
  process.exit(1);
}

console.log('compilando nova-engine...');
const r = spawnSync(NODE, ['node_modules/vite/bin/vite.js', 'build', '--base=./', '--outDir', 'dist-web'],
  { cwd: NOVA, encoding: 'utf8' });
console.log((r.stdout || '').trim().split('\n').slice(-4).join('\n'));
if (r.status !== 0) { console.error(r.stderr || 'fallo la compilacion'); process.exit(1); }

// Se vacia el contenido, no la carpeta: en Windows borrar el directorio falla
// con EPERM si alguna consola o el navegador lo tienen abierto.
rmSync(join(DESTINO, 'assets'), { recursive: true, force: true });
cpSync(join(NOVA, 'dist-web'), DESTINO, { recursive: true, force: true });

const idx = join(DESTINO, 'index.html');
let html = readFileSync(idx, 'utf8');
const ancla = '    <div id="modal-root"></div>\n';
if (!html.includes(ancla)) { console.error('no encuentro el ancla modal-root en index.html'); process.exit(1); }
writeFileSync(idx, html.replace(ancla, ancla + BARRA));

console.log('listo -> docs/nova-engine/ (con barra de autoria)');
console.log('publica con: node beagentry/publicar.mjs "nova engine al dia"');
