// El turbofan de `escuela/obras/turbofan/`, pilotado por el scroll de la portada.
//
// Es el visor de `turbofan-web/main.js` recortado a lo imprescindible: mismos
// materiales por nombre, mismos shaders de flujo y llama, mismo recorrido de
// camara de los once planos de Blender. Fuera quedan la interfaz, el modo
// manual y la camara libre: aqui no hay mandos, manda la barra de scroll.
//
// Dos relojes, y la diferencia importa:
//   - el scroll elige el FOTOGRAMA (camara, calor, llama, seccion, regimen),
//   - el tiempo real integra el GIRO de los dos ejes con el regimen de ese
//     fotograma. Por eso el fan sigue girando si paras de scrollear, en vez de
//     quedarse congelado, que es lo que pasaria si el giro colgase del scroll.
//
// El bucle solo corre mientras la banda esta en pantalla (lo enciende y apaga
// el IntersectionObserver de la portada): fuera de vista no gasta GPU.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (t) => t * t * (3 - 2 * t);
// Blender (x, y, z) -> three (x, z, -y): el eje del motor sigue siendo X
const B = (v) => new THREE.Vector3(v[0], v[2], -v[1]);

// tabla por nombre de material de Blender: color, metal, rugosidad, y si es de
// la seccion caliente (tinte + rescoldo que siguen a `calor`)
const MAT = {
  TI_fan: [0x9ea1a8, 1, 0.22], TI_pulido: [0xb0b3ba, 1, 0.12], AC_alabe_compresor: [0x9599a4, 1, 0.26],
  AC_disco: [0x7c7f88, 1, 0.38], AL_carcasa: [0xa3a5aa, 1, 0.45], AC_inox: [0xb4b7bf, 1, 0.2],
  AC_pavonado: [0x1a1b1e, 1, 0.42], AC_eje: [0x6a6d75, 1, 0.24], LATON: [0xa07a3c, 1, 0.32],
  COBRE: [0xb8603a, 1, 0.3], ABRADIBLE: [0x5a5850, 0, 0.85], COMPOSITE_carbono: [0x17181b, 0.15, 0.32],
  PINTURA_gondola: [0xd8dadd, 0.02, 0.28], PINTURA_aviso: [0xb03a1e, 0, 0.4], GOMA: [0x111113, 0, 0.9],
  AISLANTE_cable: [0x1b1c20, 0, 0.6], MANGUITO_trenzado: [0x6a6c72, 0.6, 0.55], SENSOR_cuerpo: [0x202228, 0, 0.5],
  SECCION_corte: [0x8a2a1e, 0, 0.8],
  INCONEL_carcasa: [0x85878d, 1, 0.42, { hot: 0.0, x0: 2.0, x1: 3.1 }],
  INCONEL_alabe_HPT: [0x7c7a78, 1, 0.45, { hot: 1.0, x0: 2.4, x1: 2.65 }],
  INCONEL_alabe_LPT: [0x84827f, 1, 0.42, { hot: 0.25, x0: 2.5, x1: 3.1 }],
  INCONEL_escape: [0x87878a, 1, 0.48, { hot: 0.18, x0: 2.6, x1: 3.9 }],
  AC_HPC_trasero: [0x8c8c90, 1, 0.34, { hot: 0.0, x0: 1.5, x1: 2.2 }],
  CERAMICA_TBC: [0xbdb8ae, 0, 0.7, { hot: 0.6, x0: 2.16, x1: 2.48, ceramica: true }],
  BUJIA_chispa: [0xffd9a0, 0, 0.4, { emisivo: 3 }],
};
const PAJA = new THREE.Color(0x9c8a5c), AZUL = new THREE.Color(0x3d4a78), VIOLETA = new THREE.Color(0x5a3c66);

// `leerAvance` devuelve 0..1 y se consulta UNA VEZ POR FOTOGRAMA, no en el
// evento `scroll`: leer la posicion en el bucle no puede desincronizarse ni
// perderse un evento, y de paso se salta el trabajo repetido cuando llegan
// varios scroll dentro del mismo fotograma.
export async function montar({ canvas, rutaModelo = './modelo/', alProgreso = null, leerAvance = null }) {
  const calientes = [];
  const materiales = new Map();
  function materialDe(nombre) {
    if (materiales.has(nombre)) return materiales.get(nombre);
    const d = MAT[nombre] || [0x8a8c92, 1, 0.4];
    const m = new THREE.MeshStandardMaterial({ color: d[0], metalness: d[1], roughness: d[2] });
    if (d[3]?.emisivo) { m.emissive = new THREE.Color(d[0]); m.emissiveIntensity = d[3].emisivo; }
    if (d[3]?.hot !== undefined) {
      m.emissive = new THREE.Color(0xff3c08); m.emissiveIntensity = 0;
      m.userData = { base: new THREE.Color(d[0]), ...d[3] }; calientes.push(m);
    }
    materiales.set(nombre, m); return m;
  }
  function pintarCalor(calor) {
    for (const m of calientes) {
      const u = m.userData, t = clamp(calor, 0, 1);
      const tinte = t < 0.5 ? PAJA.clone().lerp(AZUL, t * 2) : AZUL.clone().lerp(VIOLETA, (t - 0.5) * 2);
      m.color.copy(u.base).lerp(tinte, u.ceramica ? t * 0.35 : t * 0.55);
      if (u.ceramica) m.color.lerp(new THREE.Color(0x3a2e26), t * 0.5);
      m.emissiveIntensity = u.hot * Math.pow(t, 3.2) * 2.2;
    }
  }

  // cintas de flujo: trazos que corren por la coordenada u del tubo
  const flujoUniforms = { fase: { value: 0 }, intensidad: { value: 0 } };
  const materialFlujo = (nucleo) => new THREE.ShaderMaterial({
    uniforms: { ...flujoUniforms, nucleo: { value: nucleo ? 1 : 0 } },
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float fase, intensidad, nucleo; varying vec2 vUv;
      vec3 rampa(float u){
        if (nucleo < 0.5) return mix(vec3(0.10,0.42,1.0), vec3(0.30,0.85,1.0), u);
        vec3 c = vec3(0.10,0.42,1.0);
        c = mix(c, vec3(0.15,0.90,0.90), smoothstep(0.00,0.24,u));
        c = mix(c, vec3(0.85,0.95,0.20), smoothstep(0.24,0.42,u));
        c = mix(c, vec3(1.00,0.52,0.06), smoothstep(0.42,0.56,u));
        c = mix(c, vec3(1.00,0.16,0.03), smoothstep(0.56,0.72,u));
        c = mix(c, vec3(1.00,0.42,0.10), smoothstep(0.72,1.00,u));
        return c; }
      void main(){
        float trazos = nucleo > 0.5 ? 44.0 : 30.0;
        float f = fract(vUv.x * trazos - fase);
        float a = smoothstep(0.02,0.34,f) * (1.0 - smoothstep(0.62,0.90,f));
        gl_FragColor = vec4(rampa(vUv.x) * 2.2 * a * intensidad, a * intensidad); }`,
  });

  const RUIDO = `
    float h(vec3 p){ return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
    float n(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(mix(h(i),h(i+vec3(1,0,0)),f.x),mix(h(i+vec3(0,1,0)),h(i+vec3(1,1,0)),f.x),f.y),
                 mix(mix(h(i+vec3(0,0,1)),h(i+vec3(1,0,1)),f.x),mix(h(i+vec3(0,1,1)),h(i+vec3(1,1,1)),f.x),f.y),f.z); }`;

  // llama: anillo dentro del tubo de llama, lenguas de ruido animadas
  const llamaUniforms = { t: { value: 0 }, fuego: { value: 0 } };
  const matLlama = new THREE.ShaderMaterial({
    uniforms: llamaUniforms, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float t, fuego; varying vec3 vP; ${RUIDO}
      void main(){
        vec3 p = vP * 22.0 + vec3(-t*9.0, t*1.3, 0.0);
        float v = n(p) * 0.6 + n(p*2.1 + 3.0) * 0.3 + n(p*4.3) * 0.1;
        float a = smoothstep(0.50, 0.82, v) * fuego;
        vec3 c = mix(vec3(1.0,0.16,0.02), vec3(1.0,0.62,0.14), smoothstep(0.55,0.75,v));
        c = mix(c, vec3(0.62,0.78,1.0), smoothstep(0.80,0.92,v));
        gl_FragColor = vec4(c * 3.0 * a, a); }`,
  });
  const matPenacho = new THREE.ShaderMaterial({
    uniforms: { t: llamaUniforms.t, escape: { value: 0 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `
      uniform float t, escape; varying vec3 vP; ${RUIDO}
      void main(){ float d = clamp((vP.x - 3.5) / 2.8, 0.0, 1.0);
        float v = n(vP * 6.0 + vec3(-t*14.0, 0.0, 0.0));
        float a = (1.0 - d) * (1.0 - d) * smoothstep(0.35, 0.8, v) * 0.18 * escape;
        gl_FragColor = vec4(vec3(1.0,0.45,0.15) * a * 2.0, a); }`,
  });

  // ------------------------------------------------------------- escena
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;   // PCFSoft esta deprecado y three cae aqui igualmente, avisando por consola

  const scene = new THREE.Scene();
  // sin fondo propio: la banda va sobre el negro de la pagina. La niebla es
  // negra para que lo lejano se funda con ella en vez de recortarse.
  scene.fog = new THREE.Fog(0x000000, 18, 60);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;

  const camera = new THREE.PerspectiveCamera(38, 1, 0.02, 200);

  const key = new THREE.DirectionalLight(0xfff6ea, 2.4); key.position.set(-2, 6, 5); key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048); key.shadow.camera.left = -5; key.shadow.camera.right = 5;
  key.shadow.camera.top = 4; key.shadow.camera.bottom = -3; key.shadow.camera.near = 1; key.shadow.camera.far = 20;
  key.shadow.bias = -0.0005;
  const fill = new THREE.DirectionalLight(0xcfe0ff, 0.9); fill.position.set(4, 2, -6);
  const rim = new THREE.DirectionalLight(0xdde8ff, 1.3); rim.position.set(7, 3, 1);
  scene.add(key, fill, rim, new THREE.AmbientLight(0x30343c, 0.6));

  // suelo que solo recoge la sombra: sin plano gris que recorte la banda
  const suelo = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.ShadowMaterial({ opacity: 0.5 }));
  suelo.rotation.x = -Math.PI / 2; suelo.position.y = -1.34; suelo.receiveShadow = true; scene.add(suelo);

  const interiores = [];
  for (const [x, e] of [[0.9, 6], [1.7, 5], [2.3, 4], [2.9, 5]]) {
    const l = new THREE.PointLight(0xfff1e0, 0, 2.2, 1.6); l.position.set(x, 0.45, 0.55); scene.add(l); interiores.push([l, e]);
  }
  const luzLlama = new THREE.PointLight(0xff6a1e, 0, 1.6, 1.4); luzLlama.position.set(2.32, 0, 0); scene.add(luzLlama);
  const luzEscape = new THREE.PointLight(0xff5a22, 0, 3.5, 1.5); luzEscape.position.set(3.9, 0, 0); scene.add(luzEscape);

  // ------------------------------------------------------------- carga
  const programa = await (await fetch(rutaModelo + 'programa.json')).json();
  const gltf = await new GLTFLoader().loadAsync(rutaModelo + 'turbofan.glb');
  const motor = gltf.scene; scene.add(motor);

  const porNombre = new Map();
  motor.traverse((o) => { porNombre.set(o.name, o); });
  const ejeN1 = porNombre.get('EJE_N1'), ejeN2 = porNombre.get('EJE_N2');
  // el exportador se lleva tambien lo que se aparto de la escena: se oculta aqui
  for (const n of ['CORTE_longitudinal', 'VFX_distorsion', 'EST_suelo']) { const o = porNombre.get(n); if (o) o.visible = false; }

  const cintas = [];
  motor.traverse((o) => {
    if (!o.isMesh) return;
    if (o.name.startsWith('Lamina')) { o.visible = false; return; }
    o.castShadow = true; o.receiveShadow = true;
    const nombre = o.material?.name || '';
    if (o.name.startsWith('AIR_')) { o.material = materialFlujo(o.name.includes('nucleo')); o.castShadow = false; cintas.push(o); return; }
    if (o.name === 'VFX_llama') { o.material = matLlama; o.castShadow = false; return; }
    if (o.name === 'VFX_penacho') { o.material = matPenacho; o.castShadow = false; return; }
    o.material = materialDe(nombre);
  });
  const pares = [];   // [original, copia cortada]
  for (const [nombre, o] of porNombre) {
    if (nombre.endsWith('_sec')) { const orig = porNombre.get(nombre.slice(0, -4)); if (orig) pares.push([orig, o]); }
  }

  // ------------------------------------------------------------- estado
  const S = { frame: programa.inicio, avance: 0, n1: 0, n2: 0, fuego: 0, calor: 0, escape: 0,
              fase: 0, ang1: 0, ang2: 0, cutaway: false, flujo: false, luz: false, t: 0 };
  let faseTexto = '', corriendo = false, ultimo = 0;

  // Camara: NADA de los once planos de Blender. Aqui el motor se ve entero y
  // de lejos, y el scroll solo da la vuelta despacio a su alrededor. Un plano
  // corto contaria el motor por dentro, pero cortaria el ritmo de la pagina:
  // esto es un fondo que respira, no un documental.
  const OBJETIVO = new THREE.Vector3(1.9, 0, 0);
  // El motor mide 3,95 m de morro a tobera. Entra lejos y pequeno (a 21 m ocupa
  // un cuarto del alto) y se te viene encima segun sube de vueltas (a 12,5 m,
  // la mitad). Ese acercamiento es la mitad del efecto: la otra mitad es que
  // la vuelta es de 138 grados, no de 85, y que la camara baja casi al eje.
  // El arco no es arbitrario: en el programa de Blender TODOS los planos con la
  // seccion abierta caen entre -32 y +18 grados de azimut, que es el lado por
  // el que esta cortado el motor. Barrer mas alla lo ensenaria por su lado
  // ciego. Asi que se va de -70 a +25 grados: entra oblicuo, pasa por los
  // angulos que Blender ya da por buenos y acaba mirando las turbinas al rojo.
  const D0 = 21, D1 = 12.5, AZ0 = -1.22, AZ1 = 0.44, EL0 = 0.52, EL1 = 0.21, LENTE = 34;
  function camaraOrbita(p) {
    // ease-out, no smoothstep: el smoothstep arranca lento y los primeros
    // dedos de scroll no movian nada. Aqui el primer empujon ya se ve.
    const x = clamp(p, 0, 1), t = 1 - Math.pow(1 - x, 1.5);
    const az = AZ0 + (AZ1 - AZ0) * t, el = EL0 + (EL1 - EL0) * t, DIST = D0 + (D1 - D0) * t;
    // la vibracion crece con el regimen: de lejos es lo que delata que gira
    const v = (S.n1 / 100) ** 2 * 0.0016;
    camera.position.set(
      OBJETIVO.x + DIST * Math.cos(el) * Math.sin(az) + Math.sin(S.t * 37.1) * v,
      OBJETIVO.y + DIST * Math.sin(el) + Math.sin(S.t * 41.7 + 1) * v,
      OBJETIVO.z + DIST * Math.cos(el) * Math.cos(az));
    camera.lookAt(OBJETIVO);
    if (camera.fov !== LENTE) { camera.fov = LENTE; camera.updateProjectionMatrix(); }
  }

  // aviso a la pagina solo cuando hay algo nuevo que escribir: al cambiar de
  // plano, o cuando el regimen se ha movido medio punto. Sin esto seria una
  // escritura en el DOM por fotograma para que la mayoria no cambiase nada.
  let faseAvisada = null, n1Avisado = -1, n2Avisado = -1;
  function avisar() {
    if (!alProgreso) return;
    if (faseTexto === faseAvisada && Math.abs(S.n1 - n1Avisado) < 0.5 && Math.abs(S.n2 - n2Avisado) < 0.5) return;
    faseAvisada = faseTexto; n1Avisado = S.n1; n2Avisado = S.n2;
    alProgreso(faseTexto, S);
  }

  // El scroll recorre SOLO el estiron: en el programa de Blender el motor esta
  // plano a ralenti del 360 al 440 y vuelve a aplanarse pasado el 570, asi que
  // usar 360-620 regalaba un tercio de la pista a que no pasara nada. Del 440
  // al 570 el regimen sube del 22 % al 98 % sin un hueco muerto: cada dedo de
  // scroll mueve las vueltas, la llama, el calor y el penacho.
  // El tope son 600: en el 601 el programa apaga la seccion.
  // Seccion, flujo y luces van siempre puestas: de lejos, un fuselaje blanco
  // cerrado no cuenta nada.
  const F0 = 440, F1 = 570;
  function progreso(p) {
    S.frame = F0 + clamp(p, 0, 1) * (F1 - F0);
    const k = clamp(Math.round(S.frame) - programa.inicio, 0, programa.fin - programa.inicio);
    const s = programa.series;
    S.n1 = s.n1_pct[k]; S.n2 = s.n2_pct[k]; S.fuego = s.combustion[k];
    S.calor = s.calor[k]; S.escape = s.escape[k];
    S.cutaway = true; S.flujo = true; S.luz = true;
    faseTexto = S.n1 < 30 ? 'ralentí' : S.n1 < 60 ? 'acelerando'
              : S.n1 < 92 ? 'subiendo a régimen' : 'potencia de despegue';
  }

  function pintar(ahora) {
    if (!corriendo) return;
    const dt = Math.min(0.05, (ahora - ultimo) / 1000); ultimo = ahora;
    S.t += dt;
    // una sola lectura de la posicion por fotograma: la usan el motor y la camara
    const p = leerAvance ? leerAvance() : S.avance;
    S.avance = p; progreso(p);

    // el giro es la integral del regimen en tiempo real: el fan sigue girando
    // aunque el scroll este quieto. Ambos rotores giran en el mismo sentido.
    const w1 = S.n1 / 100 * programa.n1_max, w2 = S.n2 / 100 * programa.n2_max;
    S.ang1 -= w1 * 2 * Math.PI / 60 * dt; S.ang2 -= w2 * 2 * Math.PI / 60 * dt;
    if (ejeN1) { ejeN1.rotation.x = S.ang1; const v = (S.n1 / 100) ** 2 * 0.00045; ejeN1.position.y = Math.sin(S.t * 53) * v; ejeN1.position.z = Math.cos(S.t * 47) * v; }
    if (ejeN2) { ejeN2.rotation.x = S.ang2; const v = (S.n2 / 100) ** 2 * 0.0003; ejeN2.position.y = Math.sin(S.t * 71) * v; ejeN2.position.z = Math.cos(S.t * 67) * v; }
    S.fase += (0.010 + 0.040 * S.n1 / 100) * dt * programa.fps;

    llamaUniforms.t.value = S.t; llamaUniforms.fuego.value = S.fuego;
    matPenacho.uniforms.escape.value = S.escape;
    luzLlama.intensity = S.fuego * 30; luzEscape.intensity = S.escape * 25;
    pintarCalor(S.calor);
    flujoUniforms.fase.value = S.fase; flujoUniforms.intensidad.value = S.flujo ? Math.min(1, 0.12 + S.n1 / 55) : 0;
    for (const c of cintas) c.visible = S.flujo;
    for (const [o, s] of pares) { o.visible = !S.cutaway; s.visible = S.cutaway; }
    for (const [l, e] of interiores) l.intensity = (S.luz && S.cutaway) ? e : 0;

    camaraOrbita(p);
    avisar();

    const w = canvas.clientWidth, h = canvas.clientHeight, r = renderer.getPixelRatio();
    if (canvas.width !== Math.floor(w * r) || canvas.height !== Math.floor(h * r)) {
      renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
    }
    renderer.render(scene, camera);
    requestAnimationFrame(pintar);
  }

  return {
    progreso,
    cotas: programa.cotas,
    // N1/N2 salen del fotograma, o sea que solo cambian con el scroll: a quien
    // pinte una lectura le basta con leer aqui en el propio manejador de scroll
    estado: () => S,
    // asa para depurar el encuadre desde la consola, como el __dbg del visor grande
    dbg: { THREE, scene, camera, motor },
    arrancar() { if (corriendo) return; corriendo = true; ultimo = performance.now(); requestAnimationFrame(pintar); },
    parar() { corriendo = false; },
  };
}
