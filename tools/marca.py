# Identidad de Beagentry (2026-10-15). Mismo nombre, todo lo demas nuevo.
#
#     python beagentry/tools/marca.py
#
# El isotipo es una "b" minuscula hecha de dos piezas -un fuste y un cuenco- y
# un punto naranja arriba a la derecha: la senal. Se lee como la inicial y como
# "algo encendido que avisa", que es lo que hace un agente. Todo sale de la
# geometria de abajo (rejilla de 64): el SVG de la web, el PNG para quien no
# lee SVG, el favicon, el icono de iPhone y la imagen de compartir. Si se toca
# una cota, se regenera todo y nada se desincroniza.
#
# Paleta (la misma en beagentry.com, en Beagentry OS y en las demos):
#   tinta  #14161B   papel  #F6F4EF   senal  #FF5A1F
#   gris   #6B6F76   linea  #E3DFD6   bien   #1F9D55

from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

AQUI = Path(__file__).resolve().parent
DOCS = AQUI.parent / 'docs'
MARCA = DOCS / 'marca'
MARCA.mkdir(exist_ok=True)

TINTA, PAPEL, SENAL, GRIS = '#14161B', '#F6F4EF', '#FF5A1F', '#6B6F76'

# --- geometria, rejilla de 64 ---------------------------------------------
TESELA = dict(x=0, y=0, lado=64, radio=15)
FUSTE = dict(x=15, y=12, ancho=9, alto=40)           # x 15-24, y 12-52
CUENCO = dict(cx=34.5, cy=37.5, r=14.5, hueco=6.5)    # x 20-49, y 23-52
PUNTO = dict(cx=47.5, cy=15.5, r=5.5)


def svg_isotipo(fondo=TINTA, letra=PAPEL, punto=SENAL, tesela=True):
    f, c, p = FUSTE, CUENCO, PUNTO
    r = f['ancho'] / 2
    # Fuste y pie en UN trazado que se mete 1 unidad dentro del anillo: si las
    # piezas solo se tocan, el antialiasing deja una costura fina entre ellas.
    ri = c['r'] - 1
    fuste = (f"M{f['x']} {f['y'] + r}a{r} {r} 0 0 1 {f['ancho']} 0V{c['cy']}H{c['cx'] - ri}"
             f"A{ri} {ri} 0 0 0 {c['cx']} {c['cy'] + ri}V{c['cy'] + c['r']}H{f['x'] + r}a{r} {r} 0 0 1 {-r} {-r}Z")
    # El cuenco es un anillo (evenodd). Va en su PROPIO trazado: si comparte
    # trazado con el fuste, evenodd convierte en hueco la zona donde se solapan.
    cuenco = (f"M{c['cx'] - c['r']} {c['cy']}a{c['r']} {c['r']} 0 1 0 {2 * c['r']} 0a{c['r']} {c['r']} 0 1 0 {-2 * c['r']} 0Z"
              f"M{c['cx'] - c['hueco']} {c['cy']}a{c['hueco']} {c['hueco']} 0 1 1 {2 * c['hueco']} 0a{c['hueco']} {c['hueco']} 0 1 1 {-2 * c['hueco']} 0Z")
    t = TESELA
    capa = f'<rect width="{t["lado"]}" height="{t["lado"]}" rx="{t["radio"]}" fill="{fondo}"/>' if tesela else ''
    return (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Beagentry">'
            f'{capa}<path fill="{letra}" d="{fuste}"/><path fill="{letra}" fill-rule="evenodd" d="{cuenco}"/>'
                        f'<circle cx="{p["cx"]}" cy="{p["cy"]}" r="{p["r"]}" fill="{punto}"/></svg>')


def pinta_isotipo(lado, fondo=TINTA, letra=PAPEL, punto=SENAL, tesela=True, ss=8):
    """El mismo dibujo en PIL, supermuestreado para que los bordes salgan limpios."""
    k = lado * ss / 64
    img = Image.new('RGBA', (lado * ss, lado * ss), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    S = lambda *v: [round(x * k) for x in v]
    if tesela:
        d.rounded_rectangle(S(0, 0, 64, 64), radius=round(TESELA['radio'] * k), fill=fondo)
    f, c, p = FUSTE, CUENCO, PUNTO
    r = f['ancho'] / 2
    d.ellipse(S(f['x'], f['y'], f['x'] + f['ancho'], f['y'] + f['ancho']), fill=letra)
    d.rectangle(S(f['x'], f['y'] + r, f['x'] + f['ancho'], c['cy']), fill=letra)
    d.ellipse(S(c['cx'] - c['r'], c['cy'] - c['r'], c['cx'] + c['r'], c['cy'] + c['r']), fill=letra)
    d.rectangle(S(f['x'] + r, c['cy'], c['cx'], f['y'] + f['alto']), fill=letra)
    d.rectangle(S(f['x'], c['cy'], f['x'] + r, f['y'] + f['alto'] - r), fill=letra)
    d.ellipse(S(f['x'], f['y'] + f['alto'] - f['ancho'], f['x'] + f['ancho'], f['y'] + f['alto']), fill=letra)
    hueco = fondo if tesela else (0, 0, 0, 0)
    d.ellipse(S(c['cx'] - c['hueco'], c['cy'] - c['hueco'], c['cx'] + c['hueco'], c['cy'] + c['hueco']), fill=hueco)
    d.ellipse(S(p['cx'] - p['r'], p['cy'] - p['r'], p['cx'] + p['r'], p['cy'] + p['r']), fill=punto)
    return img.resize((lado, lado), Image.LANCZOS)


def og():
    W, H = 1200, 630
    img = Image.new('RGB', (W, H), PAPEL)
    d = ImageDraw.Draw(img)
    negrita = ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 76)
    texto = ImageFont.truetype('C:/Windows/Fonts/segoeui.ttf', 34)
    peq = ImageFont.truetype('C:/Windows/Fonts/seguisb.ttf', 24)
    img.paste(pinta_isotipo(120), (80, 80), pinta_isotipo(120))
    d.text((222, 108), 'Beagentry', font=ImageFont.truetype('C:/Windows/Fonts/segoeuib.ttf', 54), fill=TINTA)
    d.text((80, 270), 'Webs y automatizaciones', font=negrita, fill=TINTA)
    d.text((80, 356), 'para negocios de verdad.', font=negrita, fill=TINTA)
    d.text((80, 470), 'Ves tu web hecha antes de pagar nada. Lista en 48 horas.', font=texto, fill=GRIS)
    d.rectangle((0, H - 14, W, H), fill=SENAL)
    d.text((W - 80, 560), 'beagentry.com', font=peq, fill=TINTA, anchor='rs')
    img.save(DOCS / 'og.png', optimize=True)


if __name__ == '__main__':
    (MARCA / 'isotipo.svg').write_text(svg_isotipo(), encoding='utf-8')
    (MARCA / 'isotipo-papel.svg').write_text(svg_isotipo(fondo=PAPEL, letra=TINTA), encoding='utf-8')
    (MARCA / 'isotipo-solo.svg').write_text(svg_isotipo(tesela=False, letra=TINTA), encoding='utf-8')
    (DOCS / 'favicon.svg').write_text(svg_isotipo(), encoding='utf-8')
    pinta_isotipo(512).save(DOCS / 'logo.png', optimize=True)
    pinta_isotipo(180).save(DOCS / 'apple-touch-icon.png', optimize=True)
    pinta_isotipo(48).save(MARCA / 'favicon-48.png', optimize=True)
    og()
    print('marca: isotipo.svg, logo.png, favicon.svg, apple-touch-icon.png, og.png')
