# Prepara las fotos del escaparate: recorta cada render a su pieza, lo baja a
# 1400 px de ancho y lo guarda en WebP.
#
#   python beagentry/tools/escaparate_img.py
#
# Por que recortar: los renders de control salen con la pieza flotando en medio
# de un fondo plano enorme, y cada uno con un margen distinto. En la pagina van
# uno detras de otro, asi que si no se igualan el tamano aparente salta de una
# ficha a la siguiente. Se busca la caja de lo que NO es fondo (distancia al
# color de la esquina) y se deja el mismo margen en todas.
#
# El color de la esquina se escribe ademas en `colores.json`: la ficha pinta el
# marco de ese color y la foto encaja sin costura.

import json
from pathlib import Path
from PIL import Image, ImageChops

RAIZ = Path(__file__).resolve().parents[2]
SALIDA = RAIZ / 'beagentry' / 'docs' / 'escaparate' / 'img'

ANCHO = 1400
MARGEN = 0.05          # margen alrededor de la pieza, en fracción del lado corto
UMBRAL = 14            # cuanto se tiene que separar un pixel del fondo para contar

# (nombre, ruta, recortar)
FOTOS = [
    ('turbofan', 'escuela/obras/turbofan/salida/fotos/cutaway_flujo.png',        False),
    ('lerhone',  'escuela/obras/lerhone9c/salida/tres_cuartos.png',              True),
    ('phantom',  'escuela/obras/phantom4/salida/tres_cuartos.png',               True),
    ('iphone',   'escuela/obras/iphone_duo/salida/abierto_tres_cuartos.png',     True),
    ('orion',    'escuela/obras/orion_v7/salida/tres_cuartos.png',               True),
    ('torre',    'escuela/obras/vertice/salida/conjunto.png',                    False),
]


def color_fondo(im):
    """Color de las cuatro esquinas, promediado."""
    w, h = im.size
    px = [im.getpixel(p) for p in ((2, 2), (w - 3, 2), (2, h - 3), (w - 3, h - 3))]
    return tuple(sum(c[i] for c in px) // len(px) for i in range(3))


def caja_pieza(im, fondo):
    """Caja de lo que se separa del fondo. None si ocupa casi todo (fondo con
    degradado: ahi la resta no distingue nada y recortar seria a ciegas)."""
    resta = ImageChops.difference(im, Image.new('RGB', im.size, fondo)).convert('L')
    caja = resta.point(lambda v: 255 if v > UMBRAL else 0).getbbox()
    if not caja:
        return None
    ancho, alto = caja[2] - caja[0], caja[3] - caja[1]
    if ancho > im.width * 0.97 and alto > im.height * 0.97:
        return None
    return caja


def main():
    SALIDA.mkdir(parents=True, exist_ok=True)
    colores = {}
    for nombre, rel, recortar in FOTOS:
        origen = RAIZ / rel
        im = Image.open(origen).convert('RGB')
        fondo = color_fondo(im)

        if recortar:
            caja = caja_pieza(im, fondo)
            if caja:
                m = int(min(im.size) * MARGEN)
                caja = (max(0, caja[0] - m), max(0, caja[1] - m),
                        min(im.width, caja[2] + m), min(im.height, caja[3] + m))
                im = im.crop(caja)

        if im.width > ANCHO:
            im = im.resize((ANCHO, round(im.height * ANCHO / im.width)), Image.LANCZOS)

        destino = SALIDA / f'{nombre}.webp'
        im.save(destino, 'WEBP', quality=82, method=6)
        colores[nombre] = {
            'fondo': '#%02x%02x%02x' % fondo,
            'w': im.width, 'h': im.height,
            'kb': round(destino.stat().st_size / 1024),
        }
        print(f'{nombre:9s} {im.width}x{im.height}  {colores[nombre]["fondo"]}  '
              f'{colores[nombre]["kb"]} kB')

    (SALIDA / 'colores.json').write_text(json.dumps(colores, indent=2), encoding='utf-8')
    print('total', sum(v['kb'] for v in colores.values()), 'kB')


main()
