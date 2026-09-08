# Genera docs/og.png, la vista previa al compartir el enlace (WhatsApp, X,
# Instagram, LinkedIn).
#
#     python beagentry/tools/og.py
#
# Por que 1200x630 y no el logo: la portada declara la tarjeta
# `summary_large_image`, que es panoramica (1.91:1). Mandarle el logo cuadrado
# de 1254x1254 hacia que X lo recortase por arriba y por abajo.
#
# Trampa: `logo.png` viene con fondo BLANCO. En la web se arregla en CSS con
# `filter:invert(1)` y `mix-blend-mode:screen`. Aqui se hace lo mismo a mano —
# invertir y mezclar en claro sobre lienzo negro — y ademas hay que aplastar a
# cero los valores bajos, porque el blanco del original no es puro y al
# invertirlo dejaba ver el recuadro del logo sobre el negro.

from pathlib import Path
from PIL import Image, ImageChops, ImageDraw, ImageFont

AQUI = Path(__file__).resolve().parent
DOCS = AQUI.parent / 'docs'

W, H = 1200, 630
TINTA, SUAVE, PIE = (238, 238, 238), (138, 138, 138), (205, 205, 205)
FUENTE = 'C:/Windows/Fonts/segoeui.ttf'
FUENTE_NEGRITA = 'C:/Windows/Fonts/segoeuib.ttf'

img = Image.new('RGB', (W, H), (0, 0, 0))

lado = 500
logo = ImageChops.invert(Image.open(DOCS / 'logo.png').convert('RGB'))
logo = logo.resize((lado, lado), Image.LANCZOS).point(lambda v: 0 if v < 14 else v)
px, py = W - lado - 20, (H - lado) // 2
img.paste(ImageChops.lighter(img.crop((px, py, px + lado, py + lado)), logo), (px, py))

d = ImageDraw.Draw(img)
tit = ImageFont.truetype(FUENTE, 74)
sub = ImageFont.truetype(FUENTE, 34)
peq = ImageFont.truetype(FUENTE_NEGRITA, 22)

x = 74
d.text((x, 158), 'Tu web, hecha', font=tit, fill=TINTA)
d.text((x, 240), 'antes de pedirla.', font=tit, fill=TINTA)
d.text((x, 356), 'Precio cerrado desde 200 €.', font=sub, fill=SUAVE)
d.text((x, 400), 'Webs, agentes y labs.', font=sub, fill=SUAVE)
d.text((x, 470), 'B E A G E N T R Y . C O M', font=peq, fill=PIE)

salida = DOCS / 'og.png'
img.save(salida, optimize=True)
print(f'listo -> {salida}  {W}x{H}  {salida.stat().st_size // 1024} KB')
