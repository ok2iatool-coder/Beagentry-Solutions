# Beagentry

Miniagencia: webs para negocios (200 / 350 / 600), agentes automatizados y labs.

- `docs/` — TODO lo publico. Es lo que sirve GitHub Pages (repo `ok2iatool-coder/Beagentry-Solutions`, Settings > Pages > main, carpeta /docs) y lo que se sube tal cual a `public_html` en Hostinger. Dentro: `index.html` + `logo.png` (la web de la agencia, correo ok2iatool@gmail.com), `vela/` (producto ficticio, agente de WhatsApp) y `shadow-blade/` (copia estatica de `../shinobi-scroll`: tres modelos 3D con scroll; si cambia el original, volver a copiar index.html, main.js, assets/ y vendor/), `motor/` (el Le Rhone 9C de `escuela/obras/lerhone9c` con despiece animado; three.js propio en `motor/vendor/`) y `nova-engine/` (el editor 3D compilado, ver abajo).
- La galeria "Avances" de la web se rellena en la lista `AVANCES` al principio del script de `docs/index.html`; los enlaces son relativos para que valgan en localhost, Pages y Hostinger.
- `clientes/*.json` + `plantillas/` + `generar.mjs` — generador de webs de negocio local con pagina de activacion (Bizum + Stripe) y legal. Salida en `salida/<slug>/`. `--final` quita la barra de demo.
- `config.json` — datos de la agencia: Bizum, WhatsApp, enlaces de Stripe, escalones de precio. Los campos vacios salen como aviso al generar.
- `serve.mjs` — puerto 5190. Raiz = `docs/`, detras `salida/`. `/demos` lista lo generado.
- `tools/publicar-nova.mjs` — recompila Nova Engine con `--base=./` y lo deja en
  `docs/nova-engine/` con la barra de autoria reinyectada (vite reescribe el
  index.html en cada compilacion, por eso hace falta el script). En la copia
  publica sale "API offline": guardar y exportar necesitan el servidor del 5180.
- `tools/render_lerhone.py` — video del despiece del motor para Instagram:

      "C:/Users/rdmat/tools/blender-4.5.13-windows-x64/blender.exe" -b         --python beagentry/tools/render_lerhone.py -- video/lerhone9c.mp4 1080 1920 10

  Vertical, EEVEE, unos minutos. Un 5o argumento con un numero de fotograma
  saca un PNG suelto en vez del video, para revisar encuadre sin renderizar todo.
  Trampa ya resuelta: el exportador de glTF deja el origen de las 103 piezas en
  el mismo punto, asi que el despiece se calcula con el centro de la caja de
  cada pieza, no con `matrix_world.translation`.
- `publicar.mjs` — **la forma de actualizar la web. Sin zips.** Un comando:

      node beagentry/publicar.mjs "que has cambiado"

  Hace commit, push y GitHub Pages se actualiza solo en ~1 min. Si existe
  `ftp.json` (copiar de `ftp.ejemplo.json`, no se sube al repo), ademas manda a
  Hostinger por FTP **solo los ficheros que cambiaron**, comparando huellas en
  `.ftp-estado.json`. Sin `ftp.json` ese paso se salta. Banderas: `--solo-git`,
  `--solo-ftp`, `--todo` (reenviar todo por FTP).

  Mejor todavia: apuntar el dominio a GitHub Pages con un CNAME y olvidarse de
  Hostinger; entonces publicar es solo el push.

Pendiente: en `generar.mjs` falta `ctx.jsonld = jsonLd(b, ctx)` antes de renderizar (el bloque JSON-LD sale vacio). Y el video vertical para Instagram no esta hecho.
