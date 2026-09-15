// Beagentry: publica la web de una vez, sin mover zips a mano.
//
//   node beagentry/publicar.mjs                      "cambios en la web"
//   node beagentry/publicar.mjs "nuevo cliente"      con mensaje propio
//   node beagentry/publicar.mjs --solo-ftp           no toca git, solo sube a Hostinger
//   node beagentry/publicar.mjs --solo-git           no sube por FTP
//   node beagentry/publicar.mjs --todo               reenvia por FTP todo, no solo lo cambiado
//   node beagentry/publicar.mjs --revisar-legal      SOLO revisa lo legal y sale, no publica
//   node beagentry/publicar.mjs --sin-revisar-legal  publica saltandose esa revision
//
// Antes de nada revisa la parte legal: la web es un portfolio sin precios, y
// si alguna pagina vuelve a anunciar tarifas sin que exista aviso legal, se
// niega a publicar (anunciar precios obliga a publicar NIF y domicilio).
//
// Despues hace dos cosas:
//   1. git add + commit + push  ->  GitHub Pages se actualiza solo en ~1 min.
//   2. Si existe ftp.json, sube a Hostinger SOLO los ficheros de docs/ que
//      cambiaron desde la ultima vez (huella sha1 en .ftp-estado.json).
//
// Para el FTP, copia ftp.ejemplo.json a ftp.json y rellena los datos que da
// Hostinger en hPanel > Archivos > Cuentas FTP. ftp.json NO se sube al repo.
// Si no existe ftp.json, el paso 2 se salta sin quejarse: con GitHub Pages basta.

import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, sep, posix } from 'node:path';
import { fileURLToPath } from 'node:url';
import { connect as netConnect } from 'node:net';
import { connect as tlsConnect } from 'node:tls';

const AQUI = fileURLToPath(new URL('.', import.meta.url)).replace(/[/\\]*$/, sep);
const DOCS = join(AQUI, 'docs');
const CONF_FTP = join(AQUI, 'ftp.json');
const ESTADO = join(AQUI, '.ftp-estado.json');
const PAGES = 'https://ok2iatool-coder.github.io/Beagentry-Solutions/';

const args = process.argv.slice(2);
const soloFtp = args.includes('--solo-ftp');
const soloGit = args.includes('--solo-git');
const todo = args.includes('--todo');
const mensaje = args.filter((a) => !a.startsWith('--'))[0] || 'cambios en la web';

const log = (...a) => console.log(...a);
const err = (...a) => console.error(...a);

// ------------------------------------------------------------ 1. git

function git(...a) {
  const r = spawnSync('git', a, { cwd: AQUI, encoding: 'utf8' });
  if (r.error) throw r.error;
  return { code: r.status, salida: (r.stdout || '') + (r.stderr || '') };
}

function publicarGit() {
  const pendiente = git('status', '--porcelain').salida.trim();
  if (!pendiente) {
    log('git: nada que subir, el repo ya esta al dia');
    return false;
  }
  log('git: cambios detectados');
  pendiente.split('\n').slice(0, 12).forEach((l) => log('  ' + l));
  if (pendiente.split('\n').length > 12) log(`  ... y ${pendiente.split('\n').length - 12} mas`);

  git('add', '-A');
  const c = git('-c', 'user.name=ok2iatool-coder', '-c', 'user.email=ok2iatool@gmail.com',
    'commit', '-m', `${mensaje}\n\nCo-Authored-By: Claude Opus 5 <noreply@anthropic.com>`);
  if (c.code !== 0) { err('git: fallo el commit\n' + c.salida); process.exit(1); }

  log('git: subiendo...');
  const p = git('push', 'origin', 'main');
  if (p.code !== 0) { err('git: fallo el push\n' + p.salida); process.exit(1); }
  log(`git: hecho. GitHub Pages tarda ~1 min -> ${PAGES}`);
  return true;
}

// ------------------------------------------------------------ ficheros de docs/

function listar(dir, base = dir) {
  const salida = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) salida.push(...listar(p, base));
    else salida.push({ abs: p, rel: relative(base, p).split(sep).join('/'), bytes: statSync(p).size });
  }
  return salida;
}

const huella = (p) => createHash('sha1').update(readFileSync(p)).digest('hex');

// ------------------------------------------------------------ 2. FTP (sin dependencias)
//
// FTP es texto plano por el canal de control: cada respuesta acaba en una linea
// "NNN <texto>". Los datos van por una conexion aparte que abre PASV. Si el
// servidor pide cifrado (Hostinger lo admite), AUTH TLS asciende las dos.

function clienteFtp(cfg) {
  let sock = null;
  let buffer = '';
  let esperando = null;

  const alimentar = (d) => {
    buffer += d.toString('latin1');
    if (!esperando) return;
    const m = buffer.match(/^(?:\d{3}-[\s\S]*?)?(\d{3}) [^\n]*\r?\n/m);
    if (!m) return;
    const texto = buffer.slice(0, m.index + m[0].length);
    buffer = buffer.slice(m.index + m[0].length);
    const f = esperando; esperando = null;
    f.res({ codigo: Number(m[1]), texto });
  };

  const leer = () => new Promise((res, rej) => {
    esperando = { res, rej };
    alimentar('');
    setTimeout(() => { if (esperando) { esperando = null; rej(new Error('el servidor FTP no contesta')); } }, 30000);
  });

  const mandar = async (linea, oculto) => {
    log('  > ' + (oculto ? linea.split(' ')[0] + ' ****' : linea));
    sock.write(linea + '\r\n');
    const r = await leer();
    log('  < ' + r.texto.trim().split('\n').pop());
    return r;
  };

  const esperar = (s) => new Promise((res, rej) => {
    s.once('connect', () => res(s));
    s.once('secureConnect', () => res(s));
    s.once('error', rej);
  });

  return {
    async conectar() {
      const puerto = cfg.puerto || 21;
      log(`ftp: conectando a ${cfg.host}:${puerto}`);
      sock = netConnect({ host: cfg.host, port: puerto });
      sock.on('data', alimentar);
      await esperar(sock);
      await leer(); // saludo 220

      if (cfg.tls !== false) {
        const a = await mandar('AUTH TLS');
        if (a.codigo === 234) {
          sock.removeListener('data', alimentar);
          const seguro = tlsConnect({ socket: sock, servername: cfg.host, rejectUnauthorized: false });
          await esperar(seguro);
          sock = seguro;
          sock.on('data', alimentar);
          await mandar('PBSZ 0');
          await mandar('PROT P');
        } else if (cfg.tls === true) {
          throw new Error('el servidor rechazo AUTH TLS y ftp.json lo exige');
        }
      }

      const u = await mandar('USER ' + cfg.usuario);
      if (u.codigo === 331) {
        const p = await mandar('PASS ' + cfg.clave, true);
        if (p.codigo >= 400) throw new Error('usuario o clave incorrectos');
      } else if (u.codigo >= 400) throw new Error('el servidor rechazo el usuario');
      await mandar('TYPE I');
      this.cifrado = sock.encrypted === true;
    },

    async abrirDatos() {
      const r = await mandar('PASV');
      const m = r.texto.match(/(\d+),(\d+),(\d+),(\d+),(\d+),(\d+)/);
      if (!m) throw new Error('PASV sin direccion: ' + r.texto.trim());
      const puerto = Number(m[5]) * 256 + Number(m[6]);
      const host = cfg.host; // el host anunciado suele ser interno: usamos el mismo
      let d = netConnect({ host, port: puerto });
      await esperar(d);
      if (this.cifrado) {
        d = tlsConnect({ socket: d, servername: host, rejectUnauthorized: false, session: sock.getSession?.() });
        await esperar(d);
      }
      return d;
    },

    async crearDir(ruta) {
      const partes = ruta.split('/').filter(Boolean);
      let acc = ruta.startsWith('/') ? '' : '.';
      for (const p of partes) {
        acc = acc === '.' ? p : acc + '/' + p;
        await mandar('MKD ' + acc); // 550 si ya existe: da igual
      }
    },

    async subir(abs, destino) {
      const d = await this.abrirDatos();
      sock.write('STOR ' + destino + '\r\n');
      const pre = await leer();
      if (pre.codigo >= 400) { d.destroy(); throw new Error('STOR rechazado: ' + pre.texto.trim()); }
      await new Promise((res, rej) => {
        d.on('error', rej);
        d.end(readFileSync(abs), res);
      });
      const fin = await leer();
      if (fin.codigo >= 400) throw new Error('subida incompleta: ' + fin.texto.trim());
    },

    async cerrar() {
      if (sock && !sock.destroyed && sock.writable) { try { await mandar('QUIT'); } catch {} }
      sock?.destroy();
    },
  };
}

async function publicarFtp() {
  if (!existsSync(CONF_FTP)) {
    log('ftp: no hay ftp.json, me lo salto (GitHub Pages ya esta publicado)');
    return;
  }
  const cfg = JSON.parse(readFileSync(CONF_FTP, 'utf8'));
  for (const k of ['host', 'usuario', 'clave']) {
    if (!cfg[k]) { err(`ftp: falta "${k}" en ftp.json`); process.exit(1); }
  }
  const raiz = (cfg.destino || '/public_html').replace(/\/+$/, '');

  const previo = existsSync(ESTADO) && !todo ? JSON.parse(readFileSync(ESTADO, 'utf8')) : {};
  const ficheros = listar(DOCS);
  const nuevo = {};
  const pendientes = [];
  for (const f of ficheros) {
    nuevo[f.rel] = huella(f.abs);
    if (previo[f.rel] !== nuevo[f.rel]) pendientes.push(f);
  }

  if (!pendientes.length) { log('ftp: todo igual que la ultima vez, no subo nada'); return; }
  const mb = (pendientes.reduce((a, f) => a + f.bytes, 0) / 1e6).toFixed(1);
  log(`ftp: ${pendientes.length} fichero(s) por subir (${mb} MB)`);

  const c = clienteFtp(cfg);
  try {
    await c.conectar();
    const dirsHechos = new Set();
    for (const f of pendientes) {
      const destino = posix.join(raiz, f.rel);
      const dir = posix.dirname(destino);
      if (!dirsHechos.has(dir)) { await c.crearDir(dir); dirsHechos.add(dir); }
      log(`  subiendo ${f.rel} (${(f.bytes / 1e3).toFixed(0)} kB)`);
      await c.subir(f.abs, destino);
      previo[f.rel] = nuevo[f.rel];
      writeFileSync(ESTADO, JSON.stringify(previo, null, 2)); // por si se corta a medias
    }
    await c.cerrar();
    writeFileSync(ESTADO, JSON.stringify(nuevo, null, 2));
    log(`ftp: hecho. ${cfg.web || 'tu dominio'} actualizado`);
  } catch (e) {
    await c.cerrar();
    err('ftp: ' + e.message);
    err('     (lo de GitHub Pages si se ha publicado; revisa ftp.json y repite con --solo-ftp)');
    process.exit(1);
  }
}

// ------------------------------------------- 0. la pagina legal, antes de nada

// La web es un PORTFOLIO: ensena trabajos, no vende nada. Por eso no lleva
// aviso legal con nombre, NIF y domicilio — el articulo 10 de la LSSI obliga
// a publicarlos a quien ejerce una actividad economica, y esa parte esta en
// pausa hasta que haya alta.
//
// El riesgo real, entonces, no es que falten datos: es que un dia vuelvan los
// precios de un copiar y pegar y la web pase a ser un escaparate comercial sin
// que nadie se acuerde de que eso arrastra el aviso legal. Eso es lo que
// vigila esto.
const SENALES_COMERCIALES = [
  [/\b\d{1,5}([.,]\d{1,2})?\s*(&euro;|€|eur\b|euros\b)|(&euro;|€)\s*\d{1,5}/i, 'un precio en euros'],
  [/"@type"\s*:\s*"Offer"/, 'una Offer en los datos estructurados'],
  [/"priceRange"/, 'priceRange en los datos estructurados'],
  [/\bbizum\b/i, 'un cobro por Bizum'],
  [/stripe\.com|buy\.stripe/i, 'un enlace de pago de Stripe'],
];

function revisarLegal() {
  const legal = join(DOCS, 'legal', 'index.html');
  if (!existsSync(legal)) {
    err('no encuentro docs/legal/index.html: no publiques sin la pagina de privacidad');
    process.exit(1);
  }

  // Las demos de cliente son webs de OTRO negocio, con su propio legal dentro;
  // que lleven precios no dice nada de esta web.
  const paginas = [];
  (function recorrer(dir) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      const rel = relative(DOCS, p).split(sep).join('/');
      if (rel.startsWith('demo/') || rel.startsWith('legal/')) continue;
      if (e.isDirectory()) recorrer(p);
      else if (e.name.endsWith('.html')) paginas.push([rel, p]);
    }
  })(DOCS);

  const hallazgos = [];
  for (const [rel, abs] of paginas) {
    const crudo = readFileSync(abs, 'utf8');
    // Mirar solo el HTML crudo no basta: en vela/ el precio estaba escrito
    // "49<small>&euro; / mes</small>", con la cifra y el simbolo separados por
    // una etiqueta, y ningun patron de "numero pegado a euro" lo veia. Se
    // revisa tambien el texto sin etiquetas, que es lo que lee una persona.
    const visible = crudo
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<[^>]+>/g, '')
      .replace(/&euro;/g, '€')
      .replace(/\s+/g, ' ');
    for (const [patron, que] of SENALES_COMERCIALES) {
      if (patron.test(crudo) || patron.test(visible)) hallazgos.push(`  ${rel}: ${que}`);
    }
  }

  const tieneAvisoLegal = /art[ií]culo 10/i.test(readFileSync(legal, 'utf8'));
  if (hallazgos.length && !tieneAvisoLegal) {
    err('\nla web ha vuelto a anunciar precios, y no hay aviso legal:');
    [...new Set(hallazgos)].forEach((h) => err(h));
    err('\nAnunciar tarifa publica es ejercer una actividad economica, y eso');
    err('obliga a publicar titular, NIF y domicilio (art. 10 LSSI), ademas de');
    err('indicar si los precios llevan IVA. O se quitan los precios, o se');
    err('recupera el aviso legal completo.');
    err('(para saltarse esta comprobacion: --sin-revisar-legal)\n');
    process.exit(1);
  }

  const huecos = readFileSync(legal, 'utf8').match(/PENDIENTE: [^<]+/g) || [];
  if (huecos.length) {
    err(`\npagina legal incompleta: quedan ${huecos.length} datos por rellenar`);
    [...new Set(huecos)].forEach((h) => err('  - ' + h));
    err('(para saltarse esta comprobacion: --sin-revisar-legal)\n');
    process.exit(1);
  }

  log(hallazgos.length
    ? 'legal: hay precios publicados y aviso legal puesto, correcto'
    : 'legal: portfolio sin precios, pagina de privacidad al dia');
}

// ------------------------------------------------------------ marcha

if (!existsSync(DOCS)) { err('no encuentro docs/'); process.exit(1); }

// Probar la revision legal NO puede exigir lanzar el publicador entero: con
// --solo-git se cuela hasta el push y publica la web sin querer. Paso una vez.
if (args.includes('--revisar-legal')) { revisarLegal(); process.exit(0); }

if (!args.includes('--sin-revisar-legal')) revisarLegal();
if (!soloFtp) publicarGit();
if (!soloGit) await publicarFtp();
log('listo.');
