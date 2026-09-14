// Beagentry: genera la web de un negocio a partir de su brief.
//
//   node beagentry/generar.mjs clientes/pizzeria-mario.json      demo (con barra de activacion)
//   node beagentry/generar.mjs clientes/pizzeria-mario.json --final   entrega (sin barra, ya pagado)
//   node beagentry/generar.mjs --todos                            regenera todos los briefs
//
// Sale en salida/<slug>/: index.html, activar.html, legal.html y fotos/.
// Sin dependencias. Plantillas con {{campo}}, {{{sin_escapar}}},
// {{#si campo}}...{{#sino}}...{{/si}} y {{#cada lista}}...{{/cada}}.
// Si anidas dos bloques del mismo tipo, cierra con nombre: {{/cada lista}}.

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, copyFileSync } from 'node:fs';
import { join, resolve, basename, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const AQUI = fileURLToPath(new URL('.', import.meta.url)).replace(/[/\\]*$/, sep);
const PLANTILLAS = join(AQUI, 'plantillas');
const CLIENTES = join(AQUI, 'clientes');
const SALIDA = join(AQUI, 'salida');
const CONFIG = JSON.parse(readFileSync(join(AQUI, 'config.json'), 'utf8'));

const args = process.argv.slice(2);
const FINAL = args.includes('--final');
// Demo SIN la barra de activación.
//
// La barra ("esta web es una demo... actívala desde X €") cierra la venta sola
// cuando mandas la web en frío. Pero cuando ya estás hablando con la persona,
// sobra: le enseñas un precio que igual no es el que le has dicho, y mete prisa
// en una conversación que llevas tú. La página se sigue generando con sus
// huecos visibles, así que nadie la confunde con una web terminada.
const SIN_BARRA = args.includes('--sin-barra');
const ficheros = args.includes('--todos')
  ? readdirSync(CLIENTES).filter((f) => f.endsWith('.json')).map((f) => join(CLIENTES, f))
  : args.filter((a) => !a.startsWith('--')).map((a) => resolve(a));

if (!ficheros.length) {
  console.error('uso: node beagentry/generar.mjs clientes/<slug>.json [--final|--sin-barra] | --todos');
  process.exit(1);
}

// ------------------------------------------------------------ motor de plantillas

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const vacio = (v) => v == null || v === '' || v === false || (Array.isArray(v) && !v.length);

function render(tpl, ctx) {
  tpl = tpl.replace(/\{\{#cada (\w+)\}\}([\s\S]*?)\{\{\/cada(?: \1)?\}\}/g, (_, k, cuerpo) => {
    const lista = ctx[k] || [];
    return lista.map((it, i) => {
      const local = typeof it === 'object' && it !== null ? it : { valor: it };
      return render(cuerpo, { ...ctx, ...local, indice: i, numero: i + 1 });
    }).join('');
  });
  tpl = tpl.replace(/\{\{#si (\w+)\}\}([\s\S]*?)(?:\{\{#sino\}\}([\s\S]*?))?\{\{\/si(?: \1)?\}\}/g, (_, k, a, b = '') =>
    vacio(ctx[k]) ? render(b, ctx) : render(a, ctx));
  tpl = tpl.replace(/\{\{\{(\w+)\}\}\}/g, (_, k) => (ctx[k] ?? ''));
  tpl = tpl.replace(/\{\{(\w+)\}\}/g, (_, k) => esc(ctx[k] ?? ''));
  return tpl;
}

// ------------------------------------------------------------ contexto

const pendiente = (v, que) => (vacio(v) ? `<mark class="pendiente">[PENDIENTE: ${que}]</mark>` : esc(v));
const soloDigitos = (s) => String(s || '').replace(/\D/g, '');

function faviconSvg(inicial, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="${color}"/><text x="32" y="43" font-family="Segoe UI,Arial" font-size="34" font-weight="700" text-anchor="middle" fill="#fff">${inicial}</text></svg>`;
  return encodeURIComponent(svg);
}

function jsonLd(b, ctx) {
  const dias = { lunes: 'Monday', martes: 'Tuesday', miércoles: 'Wednesday', miercoles: 'Wednesday', jueves: 'Thursday', viernes: 'Friday', sábado: 'Saturday', sabado: 'Saturday', domingo: 'Sunday' };
  const j = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: b.nombre,
    description: b.eslogan,
    url: 'https://' + ctx.dominio_sugerido,
  };
  // En una demo de prospección puede faltar el contacto. Un `telephone: "+"` o
  // una dirección con el texto del hueco dentro NO se quedan a medias: Google
  // se los cree y quedan como datos malos del negocio. Mejor no declararlos.
  if (ctx.tel_limpio) j.telephone = '+' + ctx.tel_limpio;
  if (!vacio(b.direccion)) {
    j.address = { '@type': 'PostalAddress', streetAddress: b.direccion, addressLocality: b.ciudad, addressCountry: 'ES' };
  } else {
    j.areaServed = b.ciudad;
  }
  if (b.email) j.email = b.email;
  if (ctx.foto_principal) j.image = ctx.foto_principal;
  if (b.instagram) j.sameAs = ['https://instagram.com/' + b.instagram];

  // Horario, que es de donde sale el "Abierto ahora" de Google.
  //
  // Dos trampas, y las dos hacen daño de verdad porque un horario equivocado
  // manda a alguien a una puerta cerrada:
  //   · "Martes a jueves" es un RANGO. Cogiendo solo los nombres que aparecen
  //     se perdía el miércoles.
  //   · "13:00 – 16:00 · 20:00 – 23:30" son DOS turnos. Con el primero solo,
  //     el negocio figuraba cerrado por la noche.
  const ORDEN = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  const pelar = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const horas = [];
  for (const h of b.horario || []) {
    const textoDias = pelar(h.dias);
    const textoHoras = pelar(h.horas);
    if (/cerrado/.test(textoHoras)) continue;

    let nombres = textoDias.match(/lunes|martes|miercoles|jueves|viernes|sabado|domingo/g) || [];
    if (nombres.length === 2 && /\ba\b/.test(textoDias)) {
      const [i, f] = nombres.map((n) => ORDEN.indexOf(n));
      if (i >= 0 && f >= i) nombres = ORDEN.slice(i, f + 1);
    }
    const enIngles = nombres.map((n) => dias[n]).filter(Boolean);
    if (!enIngles.length) continue;

    for (const t of textoHoras.matchAll(/(\d{1,2}):(\d{2})\s*[–—-]\s*(\d{1,2}):(\d{2})/g)) {
      horas.push({
        '@type': 'OpeningHoursSpecification',
        dayOfWeek: enIngles,
        opens: `${t[1].padStart(2, '0')}:${t[2]}`,
        closes: `${t[3].padStart(2, '0')}:${t[4]}`,
      });
    }
  }
  if (horas.length) j.openingHoursSpecification = horas;

  return JSON.stringify(j);
}

// Huecos de una demo de prospección.
//
// Al preparar la web de alguien que todavía no es cliente no tienes su teléfono
// ni su dirección: estás enseñándosela precisamente para que te los dé. Antes
// esto era un error y no se generaba nada, así que no había nada que enseñar.
//
// Se rellenan con un hueco VISIBLE, entre corchetes, nunca con un número
// inventado: una web de electricista con un teléfono que no es el suyo es peor
// que no tener web. Y los enlaces se quedan inertes en vez de llevar a
// `tel:` vacío o a un WhatsApp de nadie.
const HUECO_TEL = '[tu teléfono]';
const HUECO_DIR = '[tu dirección o zona]';

function contexto(b) {
  const tel = soloDigitos(b.telefono);
  const telLimpio = tel.length === 9 ? '34' + tel : tel;
  const wa = soloDigitos(b.whatsapp) || telLimpio;
  const hayTel = !vacio(b.telefono);
  const hayDir = !vacio(b.direccion);
  const mensaje = encodeURIComponent(`Hola, os escribo desde la web de ${b.nombre}.`);
  const dominio = b.dominio || `${b.slug.replace(/-/g, '')}.es`;
  const fotos = (b.fotos || []).map((f) => (/^https?:\/\//.test(f) ? f : 'fotos/' + basename(f)));
  const inicial = (b.nombre || '?').trim()[0].toUpperCase();
  const escalonDef = CONFIG.escalones.find((e) => e.destacado) || CONFIG.escalones[0];
  const concepto = `${CONFIG.agencia.toUpperCase()} ${b.slug}`;

  return {
    ...b,
    demo: !FINAL && !SIN_BARRA,
    // `demo` manda la BARRA; `es_demo` manda el noindex. Son distintos: una
    // demo sin barra sigue siendo una demo y no se debe indexar.
    es_demo: !FINAL,
    fotos,
    foto_principal: fotos[0] || '',
    foto_secundaria: fotos[1] || '',
    galeria: fotos.slice(2),
    nombre_negocio: b.nombre,
    inicial,
    barrio: b.barrio || b.ciudad,
    // `barrio` cae en `ciudad` cuando no hay barrio, y la plantilla escribía
    // "{{barrio}}, {{ciudad}}" -> "Valencia, Valencia". `zona` dice el sitio
    // una sola vez.
    zona: b.barrio ? `${b.barrio}, ${b.ciudad}` : b.ciudad,
    titulo_servicios: b.titulo_servicios || 'Servicios',
    color: b.color || '#1f4e79',
    color_fondo: b.color_fondo || '#f7f7f5',
    telefono: hayTel ? b.telefono : HUECO_TEL,
    direccion: hayDir ? b.direccion : HUECO_DIR,
    hay_telefono: hayTel,
    hay_direccion: hayDir,
    // `href="tel:"` a secas es un enlace muerto. Sin teléfono, el botón no
    // lleva a ningún sitio en lugar de llevar a la nada.
    tel_href: hayTel ? `tel:${telLimpio}` : '#',
    tel_limpio: hayTel ? telLimpio : '',
    url_whatsapp: wa ? `https://wa.me/${wa}?text=${mensaje}` : '#',
    url_maps: hayDir
      ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(b.maps || `${b.nombre}, ${b.direccion}`)
      : '#',
    dominio_sugerido: dominio,
    anyo: new Date().getFullYear(),
    fecha: new Date().toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }),
    favicon: faviconSvg(inicial, b.color || '#1f4e79'),
    titular_legal_html: pendiente(b.titular_legal, 'nombre o razón social del titular'),
    nif_html: pendiente(b.nif, 'NIF'),
    // agencia
    agencia: CONFIG.agencia,
    agencia_mayus: CONFIG.agencia.toUpperCase(),
    agencia_dominio: CONFIG.dominio,
    agencia_instagram: CONFIG.instagram,
    agencia_bizum: CONFIG.bizum,
    agencia_whatsapp: CONFIG.whatsapp,
    agencia_url_whatsapp: CONFIG.whatsapp ? `https://wa.me/${soloDigitos(CONFIG.whatsapp)}?text=${encodeURIComponent(`Hola, soy de ${b.nombre}, he visto la demo de la web.`)}` : '',
    escalones: CONFIG.escalones.map((e) => ({ ...e, stripe_url: (CONFIG.stripe || {})[e.clave] || '' })),
    escalon_defecto_nombre: escalonDef.nombre,
    escalon_defecto_precio: escalonDef.precio,
    precio_base: Math.min(...CONFIG.escalones.map((e) => e.precio)),
    concepto_pago: concepto,
    cambio_extra: CONFIG.cambio_extra,
    mantenimiento: CONFIG.mantenimiento,
  };
}

// ------------------------------------------------------------ generar

function avisos(b) {
  // El contacto solo es obligatorio en la ENTREGA. En una demo de prospección
  // todavía no lo tienes —por eso se la enseñas—, pero entregar una web pagada
  // sin teléfono sí es inaceptable, así que con --final vuelve a ser un error.
  const obligatorios = ['slug', 'nombre', 'sector', 'eslogan', 'descripcion', 'ciudad'];
  if (FINAL) obligatorios.push('direccion', 'telefono');
  const faltan = obligatorios.filter((k) => vacio(b[k]));
  if (faltan.length) { console.error(`  ERROR ${b.slug || '?'}: faltan campos obligatorios: ${faltan.join(', ')}`); return false; }
  const av = [];
  if (!FINAL && vacio(b.telefono)) av.push(`sin teléfono: sale "${HUECO_TEL}" y los botones de llamar/WhatsApp quedan inertes`);
  if (!FINAL && vacio(b.direccion)) av.push(`sin dirección: sale "${HUECO_DIR}" y "Cómo llegar" queda inerte`);
  if (vacio(b.servicios)) av.push('sin servicios: la seccion saldra vacia');
  if (vacio(b.horario)) av.push('sin horario');
  if (vacio(b.fotos)) av.push('sin fotos: hero y "nosotros" usan color plano');
  if (vacio(b.titular_legal) || vacio(b.nif)) av.push('legal.html lleva marcas [PENDIENTE]: titular y NIF se piden al cobrar');
  if (vacio(CONFIG.bizum)) av.push('config.json sin numero de Bizum');
  if (vacio(CONFIG.whatsapp)) av.push('config.json sin WhatsApp de la agencia');
  if (!Object.values(CONFIG.stripe || {}).some(Boolean)) av.push('config.json sin enlaces de Stripe: la pestaña Tarjeta remite a WhatsApp');
  av.forEach((a) => console.log(`  aviso: ${a}`));
  return true;
}

function generar(fichero) {
  const b = JSON.parse(readFileSync(fichero, 'utf8'));
  b.slug = b.slug || basename(fichero, '.json');
  console.log(`${b.slug} (${FINAL ? 'entrega final' : 'demo'})`);
  if (!avisos(b)) return;

  const ctx = contexto(b);
  // `jsonLd()` estaba escrita pero NADIE la llamaba: la plantilla pide
  // {{{jsonld}}} y el contexto no lo traía, así que todas las webs salían con
  // un <script type="application/ld+json"> VACÍO. Justo lo que el escalón de
  // 350 € vende como "datos estructurados para que Google entienda el negocio".
  ctx.jsonld = jsonLd(b, ctx);
  const dir = join(SALIDA, b.slug);
  mkdirSync(join(dir, 'fotos'), { recursive: true });

  // fotos locales: se buscan en clientes/fotos/<slug>/ o por ruta relativa al brief
  for (const f of b.fotos || []) {
    if (/^https?:\/\//.test(f)) continue;
    const candidatos = [join(CLIENTES, 'fotos', b.slug, f), resolve(fichero, '..', f), resolve(f)];
    const origen = candidatos.find((c) => existsSync(c));
    if (!origen) { console.log(`  aviso: foto no encontrada: ${f}`); continue; }
    copyFileSync(origen, join(dir, 'fotos', basename(f)));
  }

  const plantilla = b.plantilla || 'local';
  const salidas = { 'index.html': `${plantilla}.html`, 'activar.html': 'activar.html', 'legal.html': 'legal.html' };
  for (const [destino, origen] of Object.entries(salidas)) {
    if (FINAL && destino === 'activar.html') continue;
    const tpl = readFileSync(join(PLANTILLAS, origen), 'utf8');
    const html = render(tpl, ctx);
    const sueltos = html.match(/\{\{[^}]+\}\}/g);
    if (sueltos) console.log(`  aviso: marcas sin resolver en ${destino}: ${[...new Set(sueltos)].join(' ')}`);
    writeFileSync(join(dir, destino), html);
  }
  console.log(`  -> salida/${b.slug}/`);
}

for (const f of ficheros) generar(f);
