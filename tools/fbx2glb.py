"""
FBX → GLB für die 3D-Welt von Fiera (headless mit Blender).

Aufruf:
  blender -b -P tools/fbx2glb.py -- <eingabe.fbx | ordner> <ausgabeordner>

Jede FBX-Datei wird einzeln importiert und als gleichnamige .glb mit eingebetteten Texturen
exportiert. Texturen, die neben der FBX liegen (Unity-Pakete: oft in ../Textures), sucht
Blender beim Import selbst; fehlende Texturen meldet das Skript.
"""
import os
import sys

import bpy


def convert(src: str, out_dir: str) -> None:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=src, use_image_search=True)
    # Unity-FBX sind oft in Zentimetern skaliert; die Spielwelt normalisiert die Größe ohnehin.
    missing = [img.filepath for img in bpy.data.images if img.source == 'FILE' and not img.has_data]
    for path in missing:
        print(f'  Textur fehlt: {path}')
    name = os.path.splitext(os.path.basename(src))[0]
    dst = os.path.join(out_dir, name + '.glb')
    bpy.ops.export_scene.gltf(
        filepath=dst,
        export_format='GLB',
        export_apply=True,
        export_yup=True,
        export_animations=False,
    )
    print(f'OK {src} -> {dst}')


def main() -> None:
    args = sys.argv[sys.argv.index('--') + 1 :] if '--' in sys.argv else []
    if len(args) != 2:
        print(__doc__)
        sys.exit(1)
    src, out_dir = args
    os.makedirs(out_dir, exist_ok=True)
    files = (
        [os.path.join(root, f) for root, _, names in os.walk(src) for f in names if f.lower().endswith('.fbx')]
        if os.path.isdir(src)
        else [src]
    )
    for f in sorted(files):
        try:
            convert(f, out_dir)
        except Exception as error:  # noqa: BLE001 – eine kaputte Datei soll den Rest nicht aufhalten
            print(f'FEHLER {f}: {error}')


main()
