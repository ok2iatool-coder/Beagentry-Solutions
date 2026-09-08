# Beagentry

Miniagencia: webs para negocios (200 / 350 / 600), agentes automatizados y labs.

- `docs/` — TODO lo publico. Es lo que sirve GitHub Pages (repo `ok2iatool-coder/Beagentry-Solutions`, Settings > Pages > main, carpeta /docs) y lo que se sube tal cual a `public_html` en Hostinger. Dentro: `index.html` + `logo.png` (la web de la agencia, correo ok2iatool@gmail.com), `vela/` (producto ficticio, agente de WhatsApp) y `shadow-blade/` (copia estatica de `../shinobi-scroll`: tres modelos 3D con scroll; si cambia el original, volver a copiar index.html, main.js, assets/ y vendor/), `motor/` (el Le Rhone 9C de `escuela/obras/lerhone9c` con despiece animado; three.js propio en `motor/vendor/`) y `nova-engine/` (el editor 3D compilado, ver abajo).
- La galeria "Avances" de la web se rellena en la lista `AVANCES` al principio del script de `docs/index.html`; los enlaces son relativos para que valgan en localhost, Pages y Hostinger.
- **SEO.** `docs/robots.txt` y `docs/sitemap.xml` (las cinco paginas reales),
  y en la portada datos estructurados JSON-LD: `ProfessionalService` con los
  tres escalones como `Offer`, mas `WebSite`. Tenia guasa que el escalon de
  350 € venda "datos estructurados para que Google entienda el negocio" y la
  web de la agencia no tuviera ninguno. El `<title>` era la palabra
  "Beagentry" a secas — ahora lleva el gancho y el precio.
  Todas las hijas llevan ya `canonical`: el sitio se sirve a la vez desde
  GitHub Pages y desde beagentry.com, y sin canonical Google tiene que elegir
  el original por su cuenta. El de `nova-engine/` lo reinyecta
  `tools/publicar-nova.mjs`, porque vite reescribe su `index.html` en cada
  compilacion; el de `shadow-blade/` hay que volver a ponerlo si se recopia
  desde `shinobi-scroll`.
  `docs/og.png` (1200x630) es la vista previa al compartir: antes se mandaba el
  logo cuadrado de 1254x1254 con una tarjeta `summary_large_image`, que lo
  recorta por arriba y por abajo. Se regenera con `python beagentry/tools/og.py`;
  ojo, `logo.png` tiene fondo BLANCO y hay que invertirlo como hace la web con
  `filter:invert(1)`, que es justo lo que ese script explica.

- `clientes/*.json` + `plantillas/` + `generar.mjs` — generador de webs de negocio local con pagina de activacion (Bizum + Stripe) y legal. Salida en `salida/<slug>/`. `--final` quita la barra de demo.
- `config.json` — datos de la agencia: Bizum, WhatsApp, enlaces de Stripe, escalones de precio. Los campos vacios salen como aviso al generar.
- `serve.mjs` — puerto 5190. Raiz = `docs/`, detras `salida/`. `/demos` lista lo generado.
- `docs/turbofan/` — la banda **Labs** de la portada: el turbofan de
  `escuela/obras/turbofan/` girando de fondo mientras se hace scroll. `motor.js`
  es el visor de `turbofan-web/main.js` recortado (mismos materiales por nombre,
  mismos shaders de flujo y llama) con dos cambios de fondo:
  - **la camara no hace el recorrido de Blender.** Los once planos cortos
    contaban el motor por dentro, pero cortaban el ritmo de la pagina. Aqui el
    motor entra lejos y pequeno (21 m, un 18 % del ancho) y se te viene encima
    segun sube de vueltas (12,5 m, un 39 %), dando una vuelta de 95 grados.
    El arco va de -70 a +25 grados de azimut **a proposito**: en el programa de
    Blender todos los planos con la seccion abierta caen entre -32 y +18, que
    es el lado por el que esta cortado el motor. Barrer mas alla lo ensena por
    su lado ciego.
  - **el motor no arranca ni se para.** El scroll recorre solo el estiron, del
    fotograma 440 al 570: el regimen sube del 22 % al 98 % sin un hueco muerto.
    Ojo con ampliar esa ventana — del 360 al 440 el motor esta PLANO a ralenti
    y pasado el 570 vuelve a aplanarse, asi que estirarla regala pista a que no
    pase nada. El tope duro son 600: en el 601 el programa apaga la seccion.
    Seccion, flujo y luces interiores van siempre puestas: de lejos, un
    fuselaje blanco cerrado no cuenta nada.
  - **la pista mide 220vh** (180vh en movil), poco mas de una pantalla de
    scroll. Con 420vh el mismo estiron se hacia el doble de largo.

  Dos relojes: el scroll elige el fotograma, y el tiempo real integra el giro de
  los ejes. Por eso el fan sigue girando aunque pares de scrollear.

  Trampas ya resueltas, por si se toca:
  - el `.glb` son **37 MB**, asi que la banda se carga en diferido y la portada
    pinta sin esperarlo. Se pide con un pantallazo de antelacion;
  - el disparador NO puede ser solo un `IntersectionObserver`: en una pestana
    estrangulada no llega a dispararse nunca y la banda se queda en "cargando"
    para siempre. Hay tres disparadores para lo mismo (observador, scroll y un
    reloj de 800 ms), y el reloj es ademas lo que PARA el bucle al salir;
  - el avance se lee **una vez por fotograma dentro del bucle**, no en el evento
    `scroll`: asi no puede perderse un evento ni quedarse con un estado viejo;
  - se regenera copiando `turbofan-web/modelo/` y `turbofan-web/vendor/`.

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
- `.github/workflows/hostinger.yml` — **GitHub sube a Hostinger solo.** Cada vez
  que cambia algo de `docs/` en `main`, este flujo hace un espejo por FTP en
  `public_html` con `lftp` (`--delete`, asi no quedan restos de versiones
  viejas). Necesita tres secretos en el repositorio, una sola vez:
  Settings > Secrets and variables > Actions > New repository secret, con
  `FTP_HOST`, `FTP_USER` y `FTP_PASS` (hPanel > Archivos > Cuentas FTP), y
  opcionalmente `FTP_DIR` si la web no cuelga de `/public_html`. Sin ellos el
  flujo se para en el primer paso con un mensaje claro, no sube nada a medias.
  Tambien se puede lanzar a mano desde la pestana Actions.
- `publicar.mjs` — **la forma de actualizar la web. Sin zips.** Un comando:

      node beagentry/publicar.mjs "que has cambiado"

  Hace commit, push y GitHub Pages se actualiza solo en ~1 min. Si existe
  `ftp.json` (copiar de `ftp.ejemplo.json`, no se sube al repo), ademas manda a
  Hostinger por FTP **solo los ficheros que cambiaron**, comparando huellas en
  `.ftp-estado.json`. Sin `ftp.json` ese paso se salta. Banderas: `--solo-git`,
  `--solo-ftp`, `--todo` (reenviar todo por FTP).

  El FTP de aqui es el plan B, para subir desde tu equipo sin pasar por GitHub.
  Lo normal es dejarlo sin `ftp.json` y que suba el flujo de Actions.

## El ciclo, de principio a fin

1. Editas lo que sea en `docs/`.
2. `node beagentry/publicar.mjs "que has cambiado"`.
3. GitHub Pages se actualiza en ~1 min y el flujo de Actions copia lo mismo a
   Hostinger. Las dos webs quedan iguales. Ningun zip de por medio.

Pendiente: en `generar.mjs` falta `ctx.jsonld = jsonLd(b, ctx)` antes de renderizar (el bloque JSON-LD sale vacio). Y el video vertical para Instagram no esta hecho.

## Prospeccion (`prospeccion/`)

Lista de negocios espanoles con Instagram y web rota, para vender por DM. Hecha el
2026-09-07: `radar-2026-09-07.{json,csv}` (266 filas, categorias A rota a la vista /
B caida o error / C mejorable) y `radar.html` (la misma lista con filtros y boton de
copiar el DM; publicada como artifact "Radar Beagentry"). Como se hizo, para repetirlo:

1. Overpass, toda Espana: `nwr["website"]["contact:instagram"]` -> 3.236 negocios.
2. `audit.mjs osm.json audit.json` (UA movil; `CONC=8 TIMEOUT=25000` si la red da
   timeouts falsos; `--dns-result-order=ipv4first`). Filtrar bancos, colegios, museos,
   asociaciones y nombres/dominios repetidos.
3. `recheck.mjs` sobre los dudosos con UA de escritorio (muros anti-bots, SPAs).
4. `ig.mjs`: existencia y seguidores leyendo las og: con UA `facebookexternalhit/1.1`.
5. Abrir en el Browser a 375 px todo lo que huela a fallo visual y ESPERAR 7 s antes de
   medir (`innerWidth > 500` = miniatura, `innerText < 250` = vacia). La mitad de los
   sospechosos estaban bien; "pie antiguo" o "jQuery viejo" no son ganchos.
6. `merge.mjs` cruza todo y saca la lista. Los enlaces profundos que dan 404 con la raiz
   viva van a C ("enlace antiguo"), no son gancho.
