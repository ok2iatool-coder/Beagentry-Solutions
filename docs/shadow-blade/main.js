// Secuencia por scroll con tres personajes de Meshy. El scroll no anima nada directamente:
// da un progreso p en [0,1] y de ahi salen la camara, el disolvido entre personajes y los
// textos. Todo se amortigua por fotograma para que el scroll a saltos no de tirones.
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const ACCENT = new THREE.Color('#ff2a3c');
// El Shinobi es un busto (cabeza y hombros) del mismo tamano que las figuras enteras: en el
// epilogo se queda detras, grande, como la sombra que da nombre a la pieza.
const MODELS = [
  { file: 'assets/shinobi.glb',     lineup: [0, 0.15, -2.4], lineupScale: 1.25 },
  { file: 'assets/shadowblade.glb', lineup: [-1.05, 0, 0.3], lineupScale: 1 },
  { file: 'assets/samurai.glb',     lineup: [1.05, 0, 0.3],  lineupScale: 1 },
];

// ------------------------------------------------------------------ escena --
const canvas = document.getElementById('gl');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.background = new THREE.Color('#07070a');
scene.fog = new THREE.Fog('#07070a', 5, 13);
scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
scene.environmentIntensity = 0.35;

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 50);

// luces: clave calida delante-derecha, contra carmesi detras-izquierda, relleno frio
const key = new THREE.DirectionalLight('#fff1dc', 2.6);
key.position.set(2.5, 4.5, 3.5); key.castShadow = true;
key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02;
Object.assign(key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -1, near: 1, far: 14 });
const rim = new THREE.DirectionalLight(ACCENT, 3.5); rim.position.set(-3, 2.5, -3);
const fill = new THREE.DirectionalLight('#6f86ff', 0.5); fill.position.set(-3, 1, 3);
const back = new THREE.DirectionalLight('#9fb4ff', 0.9); back.position.set(2, 3, -4);   // que la espalda no sea solo silueta roja
const top = new THREE.SpotLight('#ffffff', 40, 12, Math.PI / 5, 0.6, 1.4); top.position.set(0, 6, 0.5); top.target.position.set(0, 0, 0);
scene.add(key, rim, fill, back, top, top.target, new THREE.HemisphereLight('#2a2d3a', '#000000', 0.6));

// suelo: disco oscuro que recibe sombra y se pierde en la niebla
const floor = new THREE.Mesh(
  new THREE.CircleGeometry(24, 64),
  new THREE.MeshStandardMaterial({ color: '#0d0d12', roughness: 0.9, metalness: 0.1 }),
);
floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

// ---------------------------------------------------------------- disolver --
// Cada material recibe un umbral uDissolve: 0 = entero, >1 = desaparece. El ruido 3D en
// coordenadas de mundo decide que fragmentos se van, con un sesgo por altura para que el
// barrido suba de los pies a la cabeza, y un borde emisivo en el frente del disolvido.
const DISSOLVE_GLSL = `
  uniform float uDissolve; uniform float uYMin; uniform float uYMax; uniform vec3 uEdge;
  varying vec3 vWPos;
  float hash3(vec3 p){ p = fract(p * 0.3183099 + .1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
  float noise3(vec3 x){ vec3 i = floor(x); vec3 f = fract(x); f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x), mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x), mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z); }
  float dissolveField(vec3 p){ float n = noise3(p * 8.0) * 0.6 + noise3(p * 28.0) * 0.4;
    float h = clamp((p.y - uYMin) / (uYMax - uYMin), 0.0, 1.0); return n * 0.7 + h * 0.3; }
`;
function makeDissolvable(mat, yMin, yMax) {
  const u = { uDissolve: { value: 0 }, uYMin: { value: yMin }, uYMax: { value: yMax }, uEdge: { value: ACCENT.clone().multiplyScalar(6) } };
  mat.userData.u = u;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, u);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\n' + DISSOLVE_GLSL)
      .replace('#include <clipping_planes_fragment>', '#include <clipping_planes_fragment>\n float dField = dissolveField(vWPos); if (dField < uDissolve) discard;')
      .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n float dEdge = (1.0 - smoothstep(0.0, 0.035, dField - uDissolve)) * step(0.001, uDissolve); gl_FragColor.rgb = mix(gl_FragColor.rgb, uEdge, dEdge);');
  };
  mat.customProgramCacheKey = () => 'dissolve';
  mat.needsUpdate = true;
}

// ------------------------------------------------------------------- carga --
const loaderEl = document.getElementById('loader');
const gltf = new GLTFLoader();
const chars = [];   // { group, mats[], height }

// El progreso por fichero no llega por LoadingManager (un GLB es una sola peticion), asi
// que se suma el onProgress de cada carga para tener una barra que avance de verdad.
const loaded = MODELS.map(() => 0);
function loadOne(i) {
  return new Promise((ok, ko) => gltf.load(MODELS[i].file, ok, (ev) => {
    if (ev.total) loaded[i] = ev.loaded / ev.total;
    const pct = Math.round(100 * loaded.reduce((a, b) => a + b, 0) / MODELS.length);
    loaderEl.querySelector('.n').textContent = pct + '%';
    loaderEl.querySelector('.p b').style.width = pct + '%';
  }, ko));
}

Promise.all(MODELS.map((_, i) => loadOne(i))).then((results) => {
  results.forEach((g, i) => {
    const root = g.scene;
    // pies en y=0 y centrado en x/z: asi las tres poses comparten sitio
    const box = new THREE.Box3().setFromObject(root);
    const size = box.getSize(new THREE.Vector3()); const c = box.getCenter(new THREE.Vector3());
    root.position.set(-c.x, -box.min.y, -c.z);
    const group = new THREE.Group(); group.add(root); scene.add(group);
    const mats = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      o.material.envMapIntensity = 0.5;
      makeDissolvable(o.material, 0, size.y);
      mats.push(o.material);
    });
    chars.push({ group, mats, height: size.y });
    console.log(`[shinobi-scroll] ${MODELS[i].file}: ${size.x.toFixed(2)} x ${size.y.toFixed(2)} x ${size.z.toFixed(2)} m`);
  });
  loaderEl.classList.add('off');
  ready = true;
}).catch((e) => { loaderEl.querySelector('.t').textContent = 'No se pudo cargar: ' + e.message; console.error(e); });

// ---------------------------------------------------------------- guion ----
// Cada tramo devuelve el estado objetivo para un p dado. Todo se interpola despues.
const clamp01 = (x) => Math.min(1, Math.max(0, x));
const ease = (x) => x * x * (3 - 2 * x);                       // suave en los dos extremos
const easeIn = (x) => x * x * x;
const seg = (p, a, b) => clamp01((p - a) / (b - a));           // 0..1 dentro del tramo [a,b]
const lerp = (a, b, t) => a + (b - a) * t;

// Actos: [inicio, fin] de cada personaje en solitario; entre medias, el disolvido.
const ACTS = [[0.00, 0.30], [0.40, 0.58], [0.68, 0.86]];
const FINAL = 0.86;

// Angulos: theta=0 mira de frente (+Z). Cada vuelta suma 2*PI para que la camara no
// retroceda; los actos terminan siempre de frente (multiplo de 2*PI).
const TAU = Math.PI * 2;
function script(p) {
  const s = { theta: 0, phi: 1.42, radius: 3.2, ty: 1.0, fov: 32, dissolve: [0, 1.05, 1.05], lineup: 0, chapter: 0 };
  if (p < ACTS[0][1]) {                                  // I: el busto. Orbita lenta y acercamiento a la mirada
    const t = seg(p, 0, ACTS[0][1]);
    s.theta = lerp(-0.6, 0.45, ease(t)); s.radius = lerp(4.4, 2.9, ease(t)); s.ty = lerp(1.0, 1.25, t); s.phi = lerp(1.45, 1.36, t);
    s.dissolve = [0, 1.05, 1.05]; s.chapter = 0;
  } else if (p < ACTS[1][0]) {                           // I -> II: latigazo de casi una vuelta mientras uno se va y otro llega
    const t = seg(p, ACTS[0][1], ACTS[1][0]);
    s.theta = lerp(0.45, TAU - 0.7, ease(t)); s.radius = lerp(2.9, 3.6, t); s.ty = lerp(1.25, 1.0, t); s.phi = lerp(1.36, 1.45, t);
    s.dissolve = [lerp(0, 1.05, easeIn(seg(t, 0, 0.8))), lerp(1.05, 0, ease(seg(t, 0.15, 1))), 1.05]; s.chapter = 1;
  } else if (p < ACTS[1][1]) {                           // II: Shadowblade. Barrido de frente, la camara baja y se acerca
    const t = seg(p, ACTS[1][0], ACTS[1][1]);
    s.theta = lerp(TAU - 0.7, TAU + 0.5, ease(t)); s.radius = lerp(3.6, 2.6, ease(t)); s.ty = lerp(1.0, 0.95, t); s.phi = lerp(1.45, 1.6, t);
    s.dissolve = [1.05, 0, 1.05]; s.chapter = 1;
  } else if (p < ACTS[2][0]) {                           // II -> III
    const t = seg(p, ACTS[1][1], ACTS[2][0]);
    s.theta = lerp(TAU + 0.5, 2 * TAU - 0.6, ease(t)); s.radius = lerp(2.6, 3.8, t); s.ty = lerp(0.95, 1.1, t); s.phi = lerp(1.6, 1.35, t);
    s.dissolve = [1.05, lerp(0, 1.05, easeIn(seg(t, 0, 0.8))), lerp(1.05, 0, ease(seg(t, 0.15, 1)))]; s.chapter = 2;
  } else if (p < FINAL) {                                // III: Samurai. Picado ligero que se endereza y se acerca a la mascara
    const t = seg(p, ACTS[2][0], ACTS[2][1]);
    s.theta = lerp(2 * TAU - 0.6, 2 * TAU + 0.4, ease(t)); s.radius = lerp(3.8, 2.4, ease(t)); s.ty = lerp(1.1, 1.3, t); s.phi = lerp(1.35, 1.48, t);
    s.dissolve = [1.05, 1.05, 0]; s.chapter = 2;
  } else {                                               // Epilogo: las figuras se abren, el busto asoma detras y la camara retrocede
    const t = seg(p, FINAL, 1);
    s.theta = lerp(2 * TAU + 0.4, 2 * TAU, ease(t)); s.radius = lerp(2.4, 6.6, ease(t)); s.ty = lerp(1.3, 1.05, ease(t)); s.phi = lerp(1.48, 1.44, t);
    s.dissolve = [lerp(1.05, 0, ease(seg(t, 0.3, 0.9))), lerp(1.05, 0, ease(seg(t, 0.15, 0.75))), 0];
    s.lineup = ease(seg(t, 0, 0.6)); s.chapter = 3;
  }
  return s;
}

// ------------------------------------------------------------- interaccion --
let progress = 0, ready = false;
function readScroll() {
  const max = document.documentElement.scrollHeight - innerHeight;
  progress = max > 0 ? clamp01(scrollY / max) : 0;
}
addEventListener('scroll', readScroll, { passive: true });
readScroll();

// arrastre: gira alrededor del personaje, y vuelve solo al soltar; el raton en reposo da paralaje
const drag = { on: false, x: 0, y: 0, dx: 0, dy: 0 };
const mouse = { x: 0, y: 0 };
canvas.addEventListener('pointerdown', (e) => { drag.on = true; drag.x = e.clientX; drag.y = e.clientY; canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', (e) => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1; mouse.y = (e.clientY / innerHeight) * 2 - 1;
  if (!drag.on) return;
  drag.dx += (e.clientX - drag.x) * 0.006; drag.dy += (e.clientY - drag.y) * 0.004;
  drag.x = e.clientX; drag.y = e.clientY;
});
const endDrag = () => { drag.on = false; };
canvas.addEventListener('pointerup', endDrag); canvas.addEventListener('pointercancel', endDrag);
canvas.style.cursor = 'grab';

// ------------------------------------------------------------------ bucle --
const cues = [...document.querySelectorAll('.cue')].map((el) => ({ el, a: +el.dataset.in, b: +el.dataset.out }));
const dots = [...document.querySelectorAll('#chapters i')];
const hint = document.getElementById('hint'); const bar = document.getElementById('bar');
const cur = { theta: -0.6, phi: 1.4, radius: 3.6, ty: 0.95, fov: 32, dissolve: [0, 1.05, 1.05], lineup: 0 };
const clock = new THREE.Clock();
// Para comprobar sin interfaz: __dbg.snap(p) coloca la camara en el estado de p sin amortiguar,
// renderiza un fotograma y devuelve un JPEG en base64.
window.__dbg = { camera, cur, get progress() { return progress; }, chars, drag, mouse,
  snap(p, w = 640, h = 480) {
    progress = p; Object.assign(cur, script(p)); cur.dissolve = [...script(p).dissolve];
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    frame.step(0.016); return canvas.toDataURL('image/jpeg', 0.7);
  },
  // rejilla con varios p, subida al servidor: PUT /__snap/<nombre> -> .snaps/<nombre>.jpg
  async sheet(ps, name = 'sheet', w = 480, h = 360) {
    const c2 = document.createElement('canvas'); const cols = Math.min(4, ps.length);
    c2.width = w * cols; c2.height = h * Math.ceil(ps.length / cols); const ctx = c2.getContext('2d');
    ps.forEach((p, i) => { this.snap(p, w, h); ctx.drawImage(canvas, (i % cols) * w, Math.floor(i / cols) * h, w, h);
      ctx.fillStyle = '#fff'; ctx.font = '16px monospace'; ctx.fillText('p=' + p, (i % cols) * w + 8, Math.floor(i / cols) * h + 20); });
    const blob = await new Promise((ok) => c2.toBlob(ok, 'image/jpeg', 0.8));
    return (await fetch('/__snap/' + name, { method: 'PUT', body: blob })).status;
  },
  // Graba la secuencia como si alguien hiciera scroll: `keys` son pares [segundo, p] y entre
  // ellos el progreso va con suavizado; cada fotograma pasa por frame.step (amortiguacion real)
  // y se compone con los textos y adornos HTML redibujados en 2D. Sube frame_00001.jpg... y
  // tools/encode_mp4.py los junta con Blender.
  async record({ fps = 30, w = 1280, h = 720, keys = [[0, 0], [2, 0], [6.5, 0.16], [9.5, 0.24], [12, 0.30], [15, 0.42], [19.5, 0.50], [22.5, 0.58], [26, 0.70], [30, 0.80], [33, 0.86], [37, 0.96], [39.5, 1], [45, 1]] } = {}) {
    const total = Math.round(keys[keys.length - 1][0] * fps);
    const c2 = document.createElement('canvas'); c2.width = w; c2.height = h; const ctx = c2.getContext('2d');
    const cueEls = [...document.querySelectorAll('.cue')];
    const wrap = (text, x, y, maxW, lh, align) => {
      const words = text.split(' '); let line = '';
      for (const wd of words) { const t = line ? line + ' ' + wd : wd; if (ctx.measureText(t).width > maxW && line) { ctx.fillText(line, x, y); y += lh; line = wd; } else line = t; }
      if (line) ctx.fillText(line, x, y); return y + lh;
    };
    const drawCue = (el) => {
      const o = parseFloat(el.style.opacity || 0); if (o <= 0.005) return;
      const dy = parseFloat(el.style.getPropertyValue('--dy') || 0);
      const kicker = el.querySelector('.kicker')?.textContent, num = el.querySelector('.num')?.textContent;
      const title = (el.querySelector('h1') || el.querySelector('h2')).innerText, body = el.querySelector('p:last-of-type').textContent;
      const hero = el.classList.contains('hero'), final = el.classList.contains('final'), right = el.classList.contains('right');
      const align = hero || final ? 'center' : right ? 'right' : 'left';
      const x = hero || final ? w / 2 : right ? w - Math.min(Math.max(24, w * 0.07), 128) : Math.min(Math.max(24, w * 0.07), 128);
      const hSize = hero ? Math.min(w * 0.11, 144) : final ? Math.min(w * 0.045, 54) : Math.min(w * 0.06, 74);
      const pSize = Math.min(Math.max(16, w * 0.014), 19), lines = title.split('\n');
      // altura total del bloque para centrarlo en vertical como hace el CSS
      const blockH = (kicker ? 30 : 0) + (num ? 26 : 0) + lines.length * hSize * 0.95 + 24 + 3 * pSize * 1.6;
      let y = final ? h - h * 0.09 - blockH : h / 2 - blockH / 2; y += dy;
      ctx.save(); ctx.globalAlpha = o; ctx.textAlign = align; ctx.textBaseline = 'top';
      if (kicker) { ctx.fillStyle = '#ff2a3c'; ctx.font = '600 11.5px Inter'; ctx.letterSpacing = '0.38em'; ctx.fillText(kicker.toUpperCase(), x, y); y += 30; }
      if (num) { ctx.fillStyle = '#ff2a3c'; ctx.font = '500 14px Cinzel'; ctx.letterSpacing = '0.3em'; ctx.fillText(num, x, y); y += 26; }
      ctx.fillStyle = '#ecebe6'; ctx.font = `700 ${hSize}px Cinzel`; ctx.letterSpacing = '0.02em';
      for (const l of lines) { ctx.fillText(l, x, y); y += hSize * 0.95; }
      y += hero || final ? 20 : 24; ctx.fillStyle = '#8f8d86'; ctx.font = `300 ${pSize}px Inter`; ctx.letterSpacing = '0px';
      wrap(body, x, y, 448, pSize * 1.6, align); ctx.restore();
    };
    const hint = document.getElementById('hint');
    for (let f = 0; f < total; f++) {
      const t = f / fps; let k = 0; while (k < keys.length - 2 && t >= keys[k + 1][0]) k++;
      const u = clamp01((t - keys[k][0]) / (keys[k + 1][0] - keys[k][0]));
      progress = lerp(keys[k][1], keys[k + 1][1], ease(u));
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      frame.step(1 / fps);
      ctx.drawImage(canvas, 0, 0, w, h);
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.hypot(w, h) / 2);
      g.addColorStop(0.45, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.55)'); ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      cueEls.forEach(drawCue);
      ctx.fillStyle = '#ff2a3c'; ctx.fillRect(0, 0, w * progress, 2);
      ctx.fillStyle = '#8f8d86'; ctx.font = '500 13px Cinzel'; ctx.letterSpacing = '0.3em'; ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('SHADOW BLADE', 26, 22);
      const ch = script(progress).chapter;
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.arc(w - 25, h / 2 - 30 + i * 20, i === ch ? 4.5 : 3, 0, TAU); ctx.fillStyle = i === ch ? '#ff2a3c' : 'rgba(255,255,255,0.22)'; ctx.fill(); }
      if (parseFloat(hint.style.opacity) > 0) { ctx.globalAlpha = 0.8; ctx.font = '400 11px Inter'; ctx.letterSpacing = '0.35em'; ctx.textAlign = 'center'; ctx.fillStyle = '#8f8d86'; ctx.fillText('DESPLÁZATE', w / 2, h - 36); ctx.fillStyle = '#ff2a3c'; ctx.fillRect(w / 2, h - 60, 1, 18 * (0.5 + 0.5 * Math.sin(t * 4))); ctx.globalAlpha = 1; }
      const blob = await new Promise((ok) => c2.toBlob(ok, 'image/jpeg', 0.92));
      await fetch('/__snap/frame_' + String(f + 1).padStart(5, '0'), { method: 'PUT', body: blob });
    }
    return total;
  } };

function resize() {
  const w = innerWidth, h = innerHeight;
  if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
    renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
  }
}

function frame() {
  requestAnimationFrame(frame);
  resize();
  frame.step(Math.min(clock.getDelta(), 0.05));
}
frame.step = function (dt) {
  const t = clock.elapsedTime;
  const target = script(progress);

  // amortiguacion: exponencial, independiente de los fps
  const k = 1 - Math.exp(-dt * 5);
  for (const key of ['theta', 'phi', 'radius', 'ty', 'fov', 'lineup']) cur[key] = lerp(cur[key], target[key], k);
  for (let i = 0; i < 3; i++) cur.dissolve[i] = lerp(cur.dissolve[i], target.dissolve[i], 1 - Math.exp(-dt * 7));
  if (!drag.on) { drag.dx *= Math.exp(-dt * 1.2); drag.dy *= Math.exp(-dt * 1.2); }

  // camara orbital: theta alrededor de Y, phi desde el cenit, mas arrastre y paralaje del raton
  const theta = cur.theta + drag.dx + mouse.x * 0.08 + Math.sin(t * 0.25) * 0.03;
  const phi = Math.min(1.68, Math.max(0.6, cur.phi + drag.dy - mouse.y * 0.05));
  const r = cur.radius * Math.max(1, 1.05 / camera.aspect);           // en vertical hay que alejarse para que quepa lo mismo de ancho
  camera.position.set(r * Math.sin(phi) * Math.sin(theta), cur.ty + r * Math.cos(phi), r * Math.sin(phi) * Math.cos(theta));
  camera.lookAt(0, cur.ty, 0);
  scene.fog.near = r + 1.5; scene.fog.far = r + 9;                    // la niebla sigue a la camara: en vertical se aleja el doble y no debe tragarse la escena
  if (camera.fov !== cur.fov) { camera.fov = cur.fov; camera.updateProjectionMatrix(); }

  // personajes: en el epilogo cada uno va a su sitio de la fila; el resto del tiempo, al centro
  chars.forEach((ch, i) => {
    const L = MODELS[i].lineup;
    ch.group.position.set(lerp(0, L[0], cur.lineup), lerp(0, L[1], cur.lineup), lerp(0, L[2], cur.lineup));
    ch.group.scale.setScalar(lerp(1, MODELS[i].lineupScale, cur.lineup));
    ch.group.rotation.y = Math.sin(t * 0.3 + i) * 0.015;                // respiracion minima
    const d = cur.dissolve[i];
    ch.group.visible = d < 1.04;
    for (const m of ch.mats) m.userData.u.uDissolve.value = d;
  });

  // textos e indicadores
  for (const c of cues) {
    const inT = c.a === 0 ? 1 : seg(progress, c.a, c.a + 0.035), outT = c.b > 1 ? 1 : 1 - seg(progress, c.b - 0.03, c.b);
    const o = Math.min(inT, outT);
    c.el.style.opacity = ease(o).toFixed(3);
    c.el.style.setProperty('--dy', ((1 - o) * 30).toFixed(1) + 'px');
  }
  dots.forEach((d, i) => d.classList.toggle('on', i === target.chapter));
  hint.style.opacity = progress < 0.03 && ready ? 1 : 0;
  bar.style.width = (progress * 100).toFixed(2) + '%';

  if (ready) renderer.render(scene, camera);
};
frame();
