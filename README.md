# Beagentry

Miniagencia: webs para negocios, agentes automatizados y labs. La web publica
es un PORTFOLIO y no anuncia precios — el porque, en el punto Legal de abajo.
El generador de webs de cliente (`generar.mjs`) sigue manejando los tres
escalones de 200 / 350 / 600 en `config.json`, que es otra cosa: eso va en el
presupuesto que se le manda a un cliente, no publicado en beagentry.com.

- `docs/` — TODO lo publico. Es lo que sirve GitHub Pages (repo `ok2iatool-coder/Beagentry-Solutions`, Settings > Pages > main, carpeta /docs) y lo que se sube tal cual a `public_html` en Hostinger. Dentro: `index.html` + `logo.png` (la web de la agencia, correo ok2iatool@gmail.com), `vela/` (producto ficticio, agente de WhatsApp) y `shadow-blade/` (copia estatica de `../shinobi-scroll`: tres modelos 3D con scroll; si cambia el original, volver a copiar index.html, main.js, assets/ y vendor/), `motor/` (el Le Rhone 9C de `escuela/obras/lerhone9c` con despiece animado; three.js propio en `motor/vendor/`) y `nova-engine/` (el editor 3D compilado, ver abajo), mas `legal/` (aviso legal, privacidad y cookies) y `fuentes/` (las tipografias, servidas desde aqui y no desde Google).
- La galeria "Avances" de la web se rellena en la lista `AVANCES` al principio del script de `docs/index.html`; los enlaces son relativos para que valgan en localhost, Pages y Hostinger.
- **Legal, y por que la web NO tiene precios.** La portada tenia tres
  escalones (200 / 350 / 600), un embudo de pago con Bizum y un
  `ProfessionalService` con tres `Offer` en los datos estructurados. Todo eso
  se quito el 2026-09-15 **a proposito**: anunciar tarifa publica es ejercer
  una actividad economica, y eso obliga a darse de alta y a publicar titular,
  NIF y domicilio (art. 10 LSSI). Mientras no haya alta, la web es un
  **portfolio**: ensena trabajos y no vende nada, y asi no tiene que publicar
  ningun dato personal. **No devolver los precios sin hablarlo**: si vuelven,
  vuelve tambien el aviso legal completo (el bloque JSON-LD con las tres
  ofertas esta en el historial de git).
  - `publicar.mjs` lo vigila solo: recorre `docs/` buscando precios en euros,
    `Offer`, `priceRange`, Bizum o enlaces de Stripe, y **se niega a publicar**
    si encuentra alguno y la pagina legal no tiene aviso legal. Las demos de
    cliente (`docs/demo/`) estan excluidas: son webs de otro negocio, con su
    propio legal dentro. Valvula de escape: `--sin-revisar-legal`.
  - `docs/legal/` es una sola pagina con tres apartados anclados: privacidad,
    cookies y uso. Enlazada desde el pie de TODAS las paginas; las de labs no
    tenian pie y se les puso uno.
  - **Esta web no usa cookies**, asi que no lleva banner: no hay analitica ni
    pixeles. Lo unico que se guarda en el navegador es `nova-engine.autosave`
    en localStorage (la escena del editor, exenta por el art. 22.2 LSSI) y esta
    declarado.
  - Por eso mismo las tipografias se sirven desde `docs/fuentes/` y ya no desde
    `fonts.googleapis.com`: pedirlas a Google manda la IP del visitante a un
    tercero de EE. UU. sin avisarle, y entonces la frase "no cedemos tus datos"
    seria falsa. Son fuentes VARIABLES, un binario por familia cubre todos los
    pesos: 216 KB en vez de los 852 KB que salen de descargar un fichero por
    peso. Si alguna pagina nueva necesita otra familia, se anade ahi, no por
    `<link>` a Google.
  - El JSON-LD de las cuatro obras apunta a `#autor` (una `Organization` a
    secas). Antes era `#negocio`, un `ProfessionalService` con precios; al
    quitarlo se habrian quedado cuatro `creator` colgando de un `@id`
    inexistente.

- **SEO.** `docs/robots.txt` y `docs/sitemap.xml` (las seis paginas reales, legal incluida),
  y en la portada datos estructurados JSON-LD: `Organization` (como autor de
  los trabajos) mas `WebSite`. Aqui hubo un `ProfessionalService` con los tres
  escalones como `Offer`; se retiro al pasar la web a portfolio, ver el punto
  Legal de arriba. El `<title>` era la palabra "Beagentry" a secas — ahora
  lleva el gancho.
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

- `docs/escaparate/` — **el escaparate del laboratorio, pensado para grabarlo.**
  Una columna de 620 px con la portada, seis fichas (turbofan, Le Rhone 9C,
  Phantom 4, el plegable, ORION V7 y la torre) y el cierre; cada una ocupa una
  pantalla entera. Sin dependencias: HTML, CSS y siete `.webp` que suman 232 kB.
  Las fotos las prepara `python beagentry/tools/escaparate_img.py`, que recorta
  cada render de `escuela/obras/` a su pieza — los de control salen con la pieza
  flotando en un fondo enorme y cada uno con un margen distinto — y los baja a
  1400 px.

  Se graba con el mismo `tools/reel.mjs` que la portada:

      REEL_URL=https://beagentry.com/escaparate/ REEL_LISTO=__escaparate         node beagentry/tools/reel.mjs --vertical

  Lo que hay que respetar si se toca:
  - **el alto de cada seccion lo pone el script con `innerHeight`**, no `100svh`.
    En el Chrome que usa el grabador `svh` vale menos que `innerHeight`, y con
    `svh` cada ficha se iba descolocando un poco mas que la anterior hasta que
    la sexta entraba por la mitad;
  - **nada se anima con `transition`.** El avance sale del scroll y se escribe
    en `--e0..--e3` una vez por fotograma, asi que el grabador puede parar en
    cualquier punto y la captura es exactamente la de ese punto. La pagina
    publica `window.__grabar()` para eso, y `window.__escaparate` como aviso de
    que ya esta montada;
  - **el bucle se para solo** cuando el scroll deja de moverse. Con un `rAF`
    eterno, Chrome no daba nunca la pagina por pintada y las capturas fallaban;
  - **el grabador no da el cuadro que pide.** Medido sobre sus propias
    capturas: se le piden 540x960 y el viewport sale 590x1049; de ahi captura
    los 590 de ancho enteros pero solo los 960 primeros pixeles de alto, y los
    mete en 1080x1920. O sea que **recorta un 8 % por abajo y estira un 9 % a lo
    alto** — y eso vale para todo lo que se grabe con `reel.mjs`, no solo para
    esta pagina. Consecuencia practica aqui: abajo del todo no puede ir nada que
    importe, y por eso el "desliza" de la portada va a un 12 % del borde y no
    pegado a el.

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
