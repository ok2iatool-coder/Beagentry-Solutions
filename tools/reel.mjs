// Beagentry: graba la web scrolleando y saca un video vertical (Reels/TikTok)
// y otro horizontal 4K, sin instalar nada.
//
//   node beagentry/tools/reel.mjs --probe          una sola captura, para medir
//   node beagentry/tools/reel.mjs --vertical       2160x3840, web movil
//   node beagentry/tools/reel.mjs --horizontal     3840x2160, web escritorio
//   node beagentry/tools/reel.mjs --cuadrado       1080x1080, publicacion de feed
//
// Como: se lanza Chrome (el instalado, no uno descargado) con el protocolo de
// DevTools abierto, se le fija el viewport, se le va poniendo el scroll
// fotograma a fotograma y se le pide una captura de cada uno. Luego Blender
// -- que trae FFmpeg dentro -- monta la secuencia en .mp4.
//
// Por que NO headless por defecto: el turbofan son 264 piezas y 2142 alabes en
// WebGL. En headless Chrome rasteriza por software (SwiftShader) y cada
// fotograma puede irse a segundos. Con ventana real usa la GPU. La ventana se
// abre fuera de pantalla para no molestar.
//
// Trampa: el scroll no se toca con `window.scrollTo` sino fijando scrollTop y
// disparando el evento, porque la portada mueve el turbofan leyendo el scroll
// una vez por fotograma; si el navegador anima el scroll por su cuenta, las
// capturas salen a destiempo.

import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PUERTO = 9333;
const URL = process.env.REEL_URL || 'https://beagentry.com/';
// Marcador de 'la portada ya esta montada'. Cada web tiene el suyo: el turbofan
// publica window.__motor y residencial-vertice publica window.__dbg. Sin esto
// el grabador espera cuarenta segundos a un objeto que nunca va a existir.
const LISTO = process.env.REEL_LISTO || '__motor';
const SEG = Number(process.env.REEL_SEG || 16);

const args = process.argv.slice(2);
const modo = args.includes('--vertical') ? 'vertical'
           : args.includes('--horizontal') ? 'horizontal'
           : args.includes('--cuadrado') ? 'cuadrado'
           : 'probe';

// ancho/alto en pixeles CSS; la escala los multiplica hasta la resolucion final
const PERFIL = {
  vertical:   { w: 540,  h: 960,  escala: 4, fps: 30, seg: SEG }, // -> 2160x3840
  horizontal: { w: 1920, h: 1080, escala: 2, fps: 30, seg: SEG }, // -> 3840x2160
  // 1:1 para publicacion de feed. Se captura al doble y se baja al montar: a
  // escala 1 el texto sale sin suavizar, y aqui hay mucha letra pequena.
  cuadrado:   { w: 1080, h: 1080, escala: 2, fps: 30, seg: SEG }, // -> 2160x2160
  probe:      { w: 540,  h: 960,  escala: 4, fps: 30, seg: 0 },
}[modo];

const SALIDA = join(process.env.REEL_OUT || '.', 'reel-' + modo);

// ---------------------------------------------------------------- CDP minimo

async function conectar(url) {
  const ws = new WebSocket(url);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  let id = 0;
  const pendientes = new Map();
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.id && pendientes.has(m.id)) {
      const { res, rej } = pendientes.get(m.id);
      pendientes.delete(m.id);
      m.error ? rej(new Error(m.error.message)) : res(m.result);
    }
  };
  return {
    ws,
    enviar(metodo, params = {}) {
      const i = ++id;
      return new Promise((res, rej) => {
        pendientes.set(i, { res, rej });
        ws.send(JSON.stringify({ id: i, method: metodo, params }));
        setTimeout(() => {
          if (pendientes.has(i)) { pendientes.delete(i); rej(new Error('sin respuesta: ' + metodo)); }
        }, 120000);
      });
    },
  };
}

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

async function pagina() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PUERTO}/json/list`);
      const t = (await r.json()).find((x) => x.type === 'page' && x.webSocketDebuggerUrl);
      if (t) return t;
    } catch {}
    await esperar(500);
  }
  throw new Error('Chrome no abrio el puerto de depuracion');
}

// ---------------------------------------------------------------- marcha

const perfilDir = join(process.env.TEMP || '.', 'reel-chrome-' + modo);
const chrome = spawn(CHROME, [
  `--remote-debugging-port=${PUERTO}`,
  `--user-data-dir=${perfilDir}`,
  '--no-first-run', '--no-default-browser-check',
  '--window-position=-3000,0',                 // fuera de pantalla, no molesta
  `--window-size=${PERFIL.w},${PERFIL.h}`,
  '--hide-scrollbars',
  '--autoplay-policy=no-user-gesture-required',
  '--disable-features=CalculateNativeWinOcclusion',  // si no, congela la ventana oculta
  'about:blank',
], { detached: false, stdio: 'ignore' });

let cli;
try {
  const t = await pagina();
  cli = await conectar(t.webSocketDebuggerUrl);

  await cli.enviar('Page.enable');
  await cli.enviar('Runtime.enable');
  await cli.enviar('Emulation.setDeviceMetricsOverride', {
    width: PERFIL.w, height: PERFIL.h,
    deviceScaleFactor: PERFIL.escala,
    mobile: modo === 'vertical',
  });

  console.log(`[reel] ${modo}: ${PERFIL.w * PERFIL.escala}x${PERFIL.h * PERFIL.escala}, cargando ${URL}`);
  await cli.enviar('Page.navigate', { url: URL });
  await esperar(6000);

  const ev = async (expr) => (await cli.enviar('Runtime.evaluate',
    { expression: expr, returnByValue: true, awaitPromise: true })).result.value;

  await ev(`document.documentElement.style.scrollBehavior='auto'`);

  // esperar a que la portada este montada (el 3D es lo unico pesado)
  let listo = false;
  for (let i = 0; i < 40; i++) {
    await ev(`document.documentElement.scrollTop=Math.round(document.documentElement.scrollHeight*0.42);dispatchEvent(new Event('scroll'))`);
    await esperar(1000);
    if (await ev(`!!window[${JSON.stringify(LISTO)}]`)) { listo = true; break; }
  }
  console.log('[reel] ' + LISTO + ' ' + (listo ? 'cargado' : 'NO cargado (sigo igual)'));
  await esperar(2000);
  await ev(`document.documentElement.scrollTop=0;dispatchEvent(new Event('scroll'))`);
  await esperar(1500);

  const alto = await ev(`document.documentElement.scrollHeight - innerHeight`);
  console.log('[reel] recorrido de scroll:', alto, 'px');

  if (modo === 'probe') {
    const t0 = Date.now();
    const cap = await cli.enviar('Page.captureScreenshot', { format: 'jpeg', quality: 92 });
    const ms = Date.now() - t0;
    mkdirSync(SALIDA, { recursive: true });
    writeFileSync(join(SALIDA, 'probe.jpg'), Buffer.from(cap.data, 'base64'));
    console.log(`[reel] captura en ${ms} ms, ${(cap.data.length * 0.75 / 1024).toFixed(0)} kB -> ${SALIDA}/probe.jpg`);
    console.log(`[reel] estimado para ${PERFIL.fps * 16} fotogramas: ${(ms * PERFIL.fps * 16 / 60000).toFixed(1)} min`);
  } else {
    if (existsSync(SALIDA)) rmSync(SALIDA, { recursive: true, force: true });
    mkdirSync(SALIDA, { recursive: true });
    const total = PERFIL.fps * PERFIL.seg;
    const t0 = Date.now();
    for (let f = 0; f < total; f++) {
      const p = f / (total - 1);
      // suavizado en los extremos: arranca y frena, no corta en seco
      const s = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
      await ev(`document.documentElement.scrollTop=${Math.round(s * alto)};dispatchEvent(new Event('scroll'))`);
      // Si la pagina publica `__grabar`, que ponga el fotograma EXACTO para este
      // scroll. Sin esto, una escena con la camara amortiguada por tiempo avanza
      // a trompicones: el rato que tarda cada captura no es constante y en cada
      // fotograma la camara ha convergido un tanto distinto. Se ve como temblor.
      await ev(`typeof window.__grabar === 'function' ? window.__grabar().then(() => 1) : 1`);
      const cap = await cli.enviar('Page.captureScreenshot', { format: 'jpeg', quality: 94 });
      writeFileSync(join(SALIDA, String(f).padStart(5, '0') + '.jpg'), Buffer.from(cap.data, 'base64'));
      if (f % 30 === 0) {
        const rest = ((Date.now() - t0) / (f + 1) * (total - f - 1) / 1000).toFixed(0);
        console.log(`  ${f}/${total}  quedan ~${rest}s`);
      }
    }
    console.log(`[reel] ${total} fotogramas en ${SALIDA}`);
  }
} finally {
  try { await cli?.enviar('Browser.close'); } catch {}
  try { cli?.ws.close(); } catch {}
  await esperar(1500);
  if (!chrome.killed) chrome.kill();   // por las buenas; Browser.close ya lo cerro
}
