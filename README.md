# Beagentry

Miniagencia: webs para negocios (200 / 350 / 600), agentes automatizados y labs.

- `docs/` — TODO lo publico. Es lo que sirve GitHub Pages (repo `ok2iatool-coder/Beagentry-Solutions`, Settings > Pages > main, carpeta /docs) y lo que se sube tal cual a `public_html` en Hostinger. Dentro: `index.html` + `logo.png` (la web de la agencia, correo ok2iatool@gmail.com), `vela/` (producto ficticio, agente de WhatsApp) y `shadow-blade/` (copia estatica de `../shinobi-scroll`: tres modelos 3D con scroll; si cambia el original, volver a copiar index.html, main.js, assets/ y vendor/).
- La galeria "Avances" de la web se rellena en la lista `AVANCES` al principio del script de `docs/index.html`; los enlaces son relativos para que valgan en localhost, Pages y Hostinger.
- `clientes/*.json` + `plantillas/` + `generar.mjs` — generador de webs de negocio local con pagina de activacion (Bizum + Stripe) y legal. Salida en `salida/<slug>/`. `--final` quita la barra de demo.
- `config.json` — datos de la agencia: Bizum, WhatsApp, enlaces de Stripe, escalones de precio. Los campos vacios salen como aviso al generar.
- `serve.mjs` — puerto 5190. Raiz = `docs/`, detras `salida/`. `/demos` lista lo generado.
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
