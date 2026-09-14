# Beagentry: monta una secuencia de .jpg en un .mp4, usando el FFmpeg que trae
# Blender dentro. No hace falta instalar nada.
#
#   blender -b -P beagentry/tools/reel_montar.py -- <carpeta> <salida.mp4> <fps> <ancho> <alto>
#
# Trampa gorda: Blender 4.x aplica AgX como transformacion de vista por defecto.
# Si no se pone en 'Standard', los negros de la web se levantan y el video sale
# lavado, sin que nada avise. La web es negra sobre negro: se notaria muchisimo.
#
# Segunda trampa: en Blender 4.4+ la coleccion de tiras se llama `strips`; antes
# era `sequences`. Se prueban las dos para no atarse a una version.

import bpy, sys, os, glob

argv = sys.argv[sys.argv.index('--') + 1:]
carpeta, salida, fps, ancho, alto = argv[0], argv[1], int(argv[2]), int(argv[3]), int(argv[4])

ficheros = sorted(os.path.basename(p) for p in glob.glob(os.path.join(carpeta, '*.jpg')))
if not ficheros:
    raise SystemExit('no hay .jpg en ' + carpeta)

scn = bpy.context.scene
scn.render.resolution_x = ancho
scn.render.resolution_y = alto
scn.render.resolution_percentage = 100
scn.render.fps = fps
scn.render.fps_base = 1.0

# que los pixeles salgan como entraron
scn.view_settings.view_transform = 'Standard'
scn.view_settings.look = 'None'
scn.view_settings.exposure = 0.0
scn.view_settings.gamma = 1.0

scn.render.image_settings.file_format = 'FFMPEG'
scn.render.ffmpeg.format = 'MPEG4'
scn.render.ffmpeg.codec = 'H264'
scn.render.ffmpeg.constant_rate_factor = 'PERC_LOSSLESS'
scn.render.ffmpeg.ffmpeg_preset = 'GOOD'
scn.render.ffmpeg.gopsize = 12
scn.render.ffmpeg.audio_codec = 'NONE'
scn.render.filepath = salida

if not scn.sequence_editor:
    scn.sequence_editor_create()
se = scn.sequence_editor
tiras = getattr(se, 'strips', None) or se.sequences

tira = tiras.new_image(name='reel', filepath=os.path.join(carpeta, ficheros[0]),
                       channel=1, frame_start=1)
for f in ficheros[1:]:
    tira.elements.append(f)

scn.frame_start = 1
scn.frame_end = len(ficheros)

print(f'[montar] {len(ficheros)} fotogramas -> {ancho}x{alto} @ {fps}fps '
      f'({len(ficheros)/fps:.1f} s) -> {salida}')
bpy.ops.render.render(animation=True)
print('[montar] hecho')
