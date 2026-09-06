# Renderiza el vídeo del despiece del Le Rhône 9C para Instagram.
#
#   "C:/Users/rdmat/tools/blender-4.5.13-windows-x64/blender.exe" -b ^
#       --python beagentry/tools/render_lerhone.py -- <salida.mp4> [ancho] [alto] [segundos]
#
# Importa el .glb ya exportado (no reconstruye el motor), reparte las piezas
# hacia fuera desde el eje y gira la cámara alrededor. Sale en vertical 1080x1920
# por defecto, que es lo que llena la pantalla en un reel.
#
# EEVEE, no Cycles: aquí no hace falta trazado de rayos y baja de horas a minutos.

import sys
import math
import bpy
from mathutils import Vector

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SALIDA = argv[0] if argv else '//lerhone.mp4'
ANCHO = int(argv[1]) if len(argv) > 1 else 1080
ALTO = int(argv[2]) if len(argv) > 2 else 1920
SEGUNDOS = float(argv[3]) if len(argv) > 3 else 12.0
# 5o argumento: en vez del video, un solo fotograma en PNG para revisar encuadre
SUELTO = int(argv[4]) if len(argv) > 4 else 0
FPS = 30
TOTAL = int(SEGUNDOS * FPS)

GLB = bpy.path.abspath('//') if False else \
    r'C:\Users\rdmat\Claude\Claude proyectos\escuela\obras\lerhone9c\salida\lerhone9c.glb'

# ---------------------------------------------------------------- escena limpia

bpy.ops.wm.read_factory_settings(use_empty=True)
esc = bpy.context.scene
esc.render.fps = FPS
esc.frame_start = 1
esc.frame_end = TOTAL

bpy.ops.import_scene.gltf(filepath=GLB)
piezas = [o for o in esc.objects if o.type == 'MESH']
print(f'[lerhone] piezas importadas: {len(piezas)}')
if not piezas:
    raise SystemExit('no se importó ninguna malla')

# ---------------------------------------------------------------- encuadre

def centro_de(o):
    """Centro real de la pieza. NO vale o.matrix_world.translation: el
    exportador de glTF deja el origen de las 103 piezas en el mismo punto, asi
    que usar el origen mueve todas en la misma direccion en vez de abrirlas."""
    pts = [o.matrix_world @ Vector(v) for v in o.bound_box]
    return sum(pts, Vector((0, 0, 0))) / len(pts)

minimo = Vector((1e9, 1e9, 1e9))
maximo = Vector((-1e9, -1e9, -1e9))
for o in piezas:
    for v in o.bound_box:
        p = o.matrix_world @ Vector(v)
        minimo = Vector((min(minimo[i], p[i]) for i in range(3)))
        maximo = Vector((max(maximo[i], p[i]) for i in range(3)))
centro = (minimo + maximo) / 2
tam = maximo - minimo
radio = max(tam) / 2
print(f'[lerhone] centro {centro}, radio {radio:.3f}')

# ---------------------------------------------------------------- despiece
#
# Cada pieza se aleja del centro por su propia dirección. En un rotativo de
# nueve cilindros eso abre la estrella, que es justo lo que se quiere ver.

SEPARACION = radio * 0.72

def clave(o, f, loc):
    o.location = loc
    o.keyframe_insert('location', frame=f)

# tramos del guion, en fracción de la duración total
f_quieto = int(TOTAL * 0.10)
f_abierto = int(TOTAL * 0.38)
f_aguanta = int(TOTAL * 0.62)
f_cerrado = int(TOTAL * 0.90)

for o in piezas:
    base = o.location.copy()
    centro_pieza = centro_de(o)
    d = centro_pieza - centro
    d = d.normalized() if d.length > 1e-6 else Vector((0, 0, 0))
    fuera = base + d * SEPARACION
    clave(o, 1, base)
    clave(o, f_quieto, base)
    clave(o, f_abierto, fuera)
    clave(o, f_aguanta, fuera)
    clave(o, f_cerrado, base)
    clave(o, TOTAL, base)
    if o.animation_data and o.animation_data.action:
        for fc in o.animation_data.action.fcurves:
            for k in fc.keyframe_points:
                k.interpolation = 'BEZIER'
                k.easing = 'EASE_IN_OUT'

# ---------------------------------------------------------------- cámara

pivote = bpy.data.objects.new('Pivote', None)
esc.collection.objects.link(pivote)
pivote.location = centro

cam_datos = bpy.data.cameras.new('Camara')
cam_datos.lens = 42
cam = bpy.data.objects.new('Camara', cam_datos)
esc.collection.objects.link(cam)
cam.parent = pivote

# La distancia se calcula, no se tantea. En un fotograma vertical Blender ajusta
# el sensor al lado LARGO (la altura), asi que el campo horizontal es mucho mas
# estrecho y es el que manda: encuadrar por el vertical deja las piezas fuera.
SENSOR = 36.0
media_v = math.atan((SENSOR / 2) / cam_datos.lens)
media_h = math.atan((SENSOR / 2) * (ANCHO / ALTO) / cam_datos.lens)
media = min(media_v, media_h)
distancia = lambda r: r * 1.06 / math.tan(media)
d_cerrado = distancia(radio)
d_abierto = distancia(radio + SEPARACION)
print(f'[lerhone] camara: {d_cerrado:.2f} montado -> {d_abierto:.2f} despiezado')

# La camara retrocede a la vez que se abre el motor, con el mismo guion
for f, d in ((1, d_cerrado), (f_quieto, d_cerrado), (f_abierto, d_abierto),
             (f_aguanta, d_abierto), (f_cerrado, d_cerrado), (TOTAL, d_cerrado)):
    cam.location = (0, -d, d * 0.22)
    cam.keyframe_insert('location', frame=f)
for fc in cam.animation_data.action.fcurves:
    for k in fc.keyframe_points:
        k.interpolation = 'BEZIER'
        k.easing = 'EASE_IN_OUT'

seguir = cam.constraints.new('TRACK_TO')
seguir.target = pivote
seguir.track_axis = 'TRACK_NEGATIVE_Z'
seguir.up_axis = 'UP_Y'
esc.camera = cam

# Una vuelta y media en todo el clip, sin parar
pivote.rotation_euler = (0, 0, 0)
pivote.keyframe_insert('rotation_euler', frame=1)
pivote.rotation_euler = (0, 0, math.radians(540))
pivote.keyframe_insert('rotation_euler', frame=TOTAL)
for fc in pivote.animation_data.action.fcurves:
    for k in fc.keyframe_points:
        k.interpolation = 'LINEAR'

# ---------------------------------------------------------------- luces y fondo

mundo = bpy.data.worlds.new('Mundo')
mundo.use_nodes = True
mundo.node_tree.nodes['Background'].inputs[0].default_value = (0.03, 0.03, 0.035, 1)
mundo.node_tree.nodes['Background'].inputs[1].default_value = 0.35
esc.world = mundo

def luz(nombre, tipo, energia, pos, tam_luz=None, color=(1, 1, 1)):
    d = bpy.data.lights.new(nombre, tipo)
    d.energy = energia
    d.color = color
    if tam_luz and tipo == 'AREA':
        d.size = tam_luz
    o = bpy.data.objects.new(nombre, d)
    esc.collection.objects.link(o)
    o.location = Vector(pos) * radio + centro
    s = o.constraints.new('TRACK_TO')
    s.target = pivote
    s.track_axis = 'TRACK_NEGATIVE_Z'
    s.up_axis = 'UP_Y'
    return o

luz('Principal', 'AREA', 1400 * radio * radio, (2.2, -2.6, 2.4), tam_luz=radio * 3, color=(1.0, 0.96, 0.9))
luz('Relleno', 'AREA', 420 * radio * radio, (-2.8, -1.2, 0.6), tam_luz=radio * 4, color=(0.72, 0.8, 1.0))
luz('Contra', 'AREA', 900 * radio * radio, (-1.0, 3.0, 1.6), tam_luz=radio * 2.5, color=(0.85, 0.9, 1.0))

# ---------------------------------------------------------------- render

motores = [e.identifier for e in bpy.types.RenderSettings.bl_rna.properties['engine'].enum_items]
esc.render.engine = 'BLENDER_EEVEE_NEXT' if 'BLENDER_EEVEE_NEXT' in motores else 'BLENDER_EEVEE'
print(f'[lerhone] motor: {esc.render.engine}')

ee = getattr(esc, 'eevee', None)
if ee:
    if hasattr(ee, 'taa_render_samples'):
        ee.taa_render_samples = 32
    for attr, val in (('use_bloom', True), ('use_gtao', True), ('use_ssr', True)):
        if hasattr(ee, attr):
            setattr(ee, attr, val)
    if hasattr(ee, 'use_raytracing'):
        ee.use_raytracing = True

esc.render.resolution_x = ANCHO
esc.render.resolution_y = ALTO
esc.render.resolution_percentage = 100
esc.render.film_transparent = False
esc.view_settings.view_transform = 'AgX' if 'AgX' in [v.name for v in bpy.types.ColorManagedViewSettings.bl_rna.properties['view_transform'].enum_items] else 'Filmic'
esc.view_settings.look = 'None'
esc.view_settings.exposure = 0.6

esc.render.image_settings.file_format = 'FFMPEG'
esc.render.ffmpeg.format = 'MPEG4'
esc.render.ffmpeg.codec = 'H264'
esc.render.ffmpeg.constant_rate_factor = 'HIGH'
esc.render.ffmpeg.ffmpeg_preset = 'GOOD'
esc.render.ffmpeg.gopsize = 15
esc.render.filepath = SALIDA

if SUELTO:
    esc.render.image_settings.file_format = 'PNG'
    esc.frame_set(SUELTO)
    esc.render.filepath = SALIDA
    print(f'[lerhone] fotograma suelto {SUELTO} a {ANCHO}x{ALTO} -> {SALIDA}')
    bpy.ops.render.render(write_still=True)
    print('[lerhone] hecho')
    raise SystemExit(0)

print(f'[lerhone] renderizando {TOTAL} fotogramas a {ANCHO}x{ALTO} -> {SALIDA}')
bpy.ops.render.render(animation=True)
print('[lerhone] hecho')
