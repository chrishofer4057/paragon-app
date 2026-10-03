"""
Gebäude für Fiera prozedural in Blender bauen (headless), als GLB exportieren und eine
Vorschau rendern.

Aufruf:
  blender -b -P tools/blender/buildings.py -- <ausgabeordner> [modell ...]

Modelle: house_north_0 … _3 (Dachfarben), house_south_0 (Kuppel), house_south_1 (Sonnensegel); ohne Angabe: alle. Ergebnis je Modell:
  <ausgabeordner>/<modell>.glb   (für public/models/, siehe tools/README.md)
  <ausgabeordner>/<modell>.png   (Vorschau)

Maßstab: 1 Blender-Einheit = 1 Kachel. Ursprung = Mitte der Grundfläche am Boden.
Vorderseite (Tür) zeigt nach -Y in Blender = Süden (+Z) im Spiel.
Stil (docs/ART_DIRECTION.md): weiche, abgerundete Kanten (Bevel), satte warme Farben,
leicht schiefe Formen für den handgemachten Look.
"""
import math
import os
import random
import sys

import bpy
import bmesh

# --- Grundlagen --------------------------------------------------------------------

_materials: dict[str, bpy.types.Material] = {}


def material(name: str, color: tuple[float, float, float], roughness: float = 0.85, emission: float = 0.0):
    if name in _materials:
        return _materials[name]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = roughness
    if emission > 0:
        bsdf.inputs['Emission Color'].default_value = (*color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emission
    _materials[name] = m
    return m


def hex_color(h: int) -> tuple[float, float, float]:
    """sRGB-Hex → lineare Farbe für Blender."""
    def lin(c: float) -> float:
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    return (lin(((h >> 16) & 255) / 255), lin(((h >> 8) & 255) / 255), lin((h & 255) / 255))


def finish(obj, mat, bevel: float = 0.0):
    obj.data.materials.append(mat)
    if bevel > 0:
        mod = obj.modifiers.new('Bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = 1  # eine Fase reicht für den weichen Look und hält die Dateien klein
        mod.limit_method = 'ANGLE'
    for poly in obj.data.polygons:
        poly.use_smooth = False
    return obj


def box(name, sx, sy, sz, x, y, z, mat, bevel=0.02, rot=(0.0, 0.0, 0.0)):
    """Quader mit Unterkante auf z."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, z + sz / 2), rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, mat, bevel)


def cylinder(name, r, h, x, y, z, mat, verts=12, bevel=0.02, r_top=None):
    bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r if r_top is None else r_top, depth=h, location=(x, y, z + h / 2))
    obj = bpy.context.active_object
    obj.name = name
    return finish(obj, mat, bevel)


def prism_roof(name, length, depth, height, x, y, z, mat, along_y=False, thickness=0.09, sag=0.0):
    """Satteldach als Fläche mit Dicke; First entlang x (oder y)."""
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    hl, hd = length / 2, depth / 2
    # leicht durchhängender First für den handgemachten Look
    ridge = [bm.verts.new((-hl, 0, height)), bm.verts.new((0, 0, height - sag)), bm.verts.new((hl, 0, height))]
    left = [bm.verts.new((-hl, -hd, 0)), bm.verts.new((0, -hd, -sag * 0.5)), bm.verts.new((hl, -hd, 0))]
    right = [bm.verts.new((-hl, hd, 0)), bm.verts.new((0, hd, -sag * 0.5)), bm.verts.new((hl, hd, 0))]
    for i in range(2):
        bm.faces.new((left[i], left[i + 1], ridge[i + 1], ridge[i]))
        bm.faces.new((ridge[i], ridge[i + 1], right[i + 1], right[i]))
    bm.to_mesh(mesh)
    bm.free()
    solid = obj.modifiers.new('Solidify', 'SOLIDIFY')
    solid.thickness = thickness
    obj.location = (x, y, z)
    if along_y:
        obj.rotation_euler = (0, 0, math.pi / 2)
    return finish(obj, mat, 0.02)


def gable_wall(name, width, height, x, y, z, mat, along_y=False, thickness=0.06):
    mesh = bpy.data.meshes.new(name)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    bm = bmesh.new()
    a = bm.verts.new((-width / 2, 0, 0))
    b = bm.verts.new((width / 2, 0, 0))
    c = bm.verts.new((0, 0, height))
    bm.faces.new((a, b, c))
    bm.to_mesh(mesh)
    bm.free()
    solid = obj.modifiers.new('Solidify', 'SOLIDIFY')
    solid.thickness = thickness
    solid.offset = 0
    obj.location = (x, y, z)
    if along_y:
        obj.rotation_euler = (0, 0, math.pi / 2)
    return finish(obj, mat, 0)


# --- Bauteile ----------------------------------------------------------------------

def window(prefix, x, y, z, frame_mat, glass_mat, facing='front', w=0.3, h=0.38, shutters=None):
    """Fenster auf einer Wandseite (y = Wandfläche vorne)."""
    d = 0.05
    if facing == 'front':
        box(f'{prefix}_frame', w + 0.08, d, h + 0.08, x, y - d / 2, z - 0.04, frame_mat, 0.01)
        box(f'{prefix}_glass', w, d, h, x, y - d, z, glass_mat, 0.0)
        box(f'{prefix}_sill', w + 0.14, 0.1, 0.05, x, y - 0.05, z - 0.08, frame_mat, 0.01)
        if shutters:
            for side in (-1, 1):
                box(f'{prefix}_shutter{side}', w * 0.5, 0.04, h + 0.04, x + side * (w * 0.75 + 0.04), y - 0.04, z - 0.02, shutters, 0.01)
    else:  # Seite (x = Wandfläche rechts)
        box(f'{prefix}_frame', d, w + 0.08, h + 0.08, x + d / 2, y, z - 0.04, frame_mat, 0.01)
        box(f'{prefix}_glass', d, w, h, x + d, y, z, glass_mat, 0.0)


def timber_face(prefix, width, y, z0, height, mat, posts=4, braces=True, facing='front', x_wall=0.0):
    """Fachwerk auf einer Wandseite: Pfosten, Schwelle, Rähm und Streben."""
    t = 0.08
    off = 0.025
    def beam(name, sx, sz, cx, cz, rot=0.0):
        if facing == 'front':
            box(name, sx, 0.05, sz, cx, y - off, cz, mat, 0.01, rot=(0, rot, 0))
        else:
            box(name, 0.05, sx, sz, x_wall + off, cx, cz, mat, 0.01, rot=(rot, 0, 0))
    beam(f'{prefix}_sill', width + 0.04, t, 0, z0)
    beam(f'{prefix}_plate', width + 0.04, t, 0, z0 + height - t)
    for i in range(posts):
        cx = -width / 2 + t / 2 + i * (width - t) / (posts - 1)
        beam(f'{prefix}_post{i}', t, height, cx, z0)
    if braces:
        span = (width - t) / (posts - 1)
        ang = math.atan2(span, height - 2 * t)
        length = math.hypot(span, height - 2 * t)
        for side in (-1, 1):
            cx = side * (width / 2 - t / 2 - span / 2)
            beam(f'{prefix}_brace{side}', 0.06, length, cx, z0 + t + (height - 2 * t) / 2 - length / 2, side * ang)


# --- Modelle -----------------------------------------------------------------------

ROOF_COLORS_NORTH = [0xa2432f, 0x3f62a8, 0x7d4f2c, 0xb0563a]


def house_north(variant=0):
    random.seed(variant)
    stone = material('stone', hex_color(0x8f8a8f), 0.95)
    plaster = material('plaster', hex_color(0xf3e6cc))
    timber = material('timber', hex_color(0x5e3a20))
    rc = ROOF_COLORS_NORTH[variant % len(ROOF_COLORS_NORTH)]
    roof_col = material(f'roof_{variant}', hex_color(rc))
    dark = tuple(int(((rc >> sh) & 255) * 0.78) for sh in (16, 8, 0))
    roof_dark = material(f'roof_{variant}_dark', hex_color((dark[0] << 16) | (dark[1] << 8) | dark[2]))
    glass = material('glass', hex_color(0x2b3a55), 0.3, emission=0.0)
    door = material('door', hex_color(0x7a4a26))
    shutter = material('shutter_green', hex_color(0x3f6b4a))
    flowers = material('flowers', hex_color(0xd8504a))
    leaves = material('leaves', hex_color(0x4f8d34))

    w, d = 2.55, 2.4
    box('plinth', w + 0.1, d + 0.1, 0.25, 0, 0, 0, stone, 0.05)
    # Erdgeschoss
    h1 = 0.85
    box('floor1', w, d, h1, 0, 0, 0.25, plaster, 0.03)
    timber_face('f1_front', w, -d / 2, 0.25, h1, timber, posts=5)
    timber_face('f1_back', w, d / 2 + 0.05, 0.25, h1, timber, posts=5)
    timber_face('f1_right', d, 0, 0.25, h1, timber, posts=4, facing='side', x_wall=w / 2)
    timber_face('f1_left', d, 0, 0.25, h1, timber, posts=4, facing='side', x_wall=-w / 2 - 0.05)
    box('door', 0.42, 0.06, 0.66, 0, -d / 2 - 0.02, 0.25, door, 0.02)
    box('door_frame', 0.52, 0.04, 0.72, 0, -d / 2 - 0.005, 0.25, timber, 0.01)
    for x in (-0.85, 0.85):
        window(f'w1_{x}', x, -d / 2, 0.55, timber, glass, shutters=shutter)
        box(f'flowerbox_{x}', 0.4, 0.14, 0.1, x, -d / 2 - 0.1, 0.4, timber, 0.01)
        for i in range(4):
            bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.06, location=(x - 0.15 + i * 0.1, -d / 2 - 0.1, 0.53))
            finish(bpy.context.active_object, flowers if i % 2 else leaves)
    # Obergeschoss mit Überhang
    h2 = 0.8
    w2, d2 = w + 0.14, d + 0.14
    z2 = 0.25 + h1
    box('floor2', w2, d2, h2, 0, 0, z2, plaster, 0.03)
    timber_face('f2_front', w2, -d2 / 2, z2, h2, timber, posts=5)
    timber_face('f2_back', w2, d2 / 2 + 0.05, z2, h2, timber, posts=5)
    timber_face('f2_right', d2, 0, z2, h2, timber, posts=4, facing='side', x_wall=w2 / 2)
    timber_face('f2_left', d2, 0, z2, h2, timber, posts=4, facing='side', x_wall=-w2 / 2 - 0.05)
    for x in (-0.75, 0.0, 0.75):
        window(f'w2_{x}', x, -d2 / 2, z2 + 0.25, timber, glass)
    for yy in (-0.5, 0.5):
        window(f'ws_{yy}', w2 / 2, yy, z2 + 0.25, timber, glass, facing='side')
    # Giebel zur Straße, steiles Dach mit Überstand und Ziegelreihen
    z3 = z2 + h2
    rh = 1.35
    prism_roof('roof', d2 + 0.45, w2 + 0.35, rh, 0, 0, z3, roof_col, along_y=True, sag=0.04)
    for i, f in enumerate((0.15, 0.38, 0.61, 0.84)):
        for side in (-1, 1):
            zz = z3 + rh * f
            xx = side * (w2 + 0.35) / 2 * (1 - f)
            ang = math.atan2(rh, (w2 + 0.35) / 2)
            box(f'tiles{i}_{side}', 0.07, d2 + 0.47, 0.04, xx, 0, zz, roof_dark, 0.01, rot=(0, -side * ang, 0))
    for side in (-1, 1):
        gable_wall(f'gable{side}', w2, rh * 0.9, 0, side * d2 / 2, z3, plaster)
        # Giebelfachwerk
        box(f'gable_post{side}', 0.08, 0.05, rh * 0.8, 0, side * (d2 / 2 + 0.035), z3, timber, 0.01)
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.15, depth=0.06, location=(0, side * (d2 / 2 + 0.04), z3 + rh * 0.42), rotation=(math.pi / 2, 0, 0))
        finish(bpy.context.active_object, glass)
    # Schornstein
    cx = (w2 / 2 - 0.45) * (1 if variant % 2 == 0 else -1)
    box('chimney', 0.3, 0.3, rh + 0.4, cx, 0.4, z3, stone, 0.03)
    box('chimney_cap', 0.38, 0.38, 0.08, cx, 0.4, z3 + rh + 0.4, stone, 0.02)
    # Laterne neben der Tür
    box('lantern_arm', 0.05, 0.25, 0.05, 0.4, -d / 2 - 0.12, 0.95, timber, 0.01)
    lantern = material('lantern', hex_color(0xffd27a), 0.4, emission=3.0)
    box('lantern', 0.12, 0.12, 0.16, 0.4, -d / 2 - 0.24, 0.78, lantern, 0.01)


def house_south(variant=0):
    random.seed(variant)
    wall = material('wall_white', hex_color(0xfbf5e8), 0.9)
    trim = material('trim_blue', hex_color(0x2c5aa0), 0.6)
    dome_mat = material('dome_blue', hex_color(0x2f6fc4), 0.35)
    gold = material('gold', hex_color(0xe0b23a), 0.3)
    glass = material('glass_dark', hex_color(0x1f2b40), 0.3)
    wood = material('wood_door', hex_color(0x3566b0), 0.7)
    deck = material('roof_deck', hex_color(0xd8b28a))
    pot = material('pot', hex_color(0xb5653a))
    leaves = material('leaves_s', hex_color(0x4f9a3a))

    w, d, h = 2.6, 2.5, 1.7
    box('body', w, d, h, 0, 0, 0, wall, 0.06)
    box('band', w + 0.06, d + 0.06, 0.1, 0, 0, h - 0.25, trim, 0.02)
    box('deck', w - 0.2, d - 0.2, 0.03, 0, 0, h, deck, 0.0)
    # Brüstung mit Zinnen
    n = 6
    for i in range(n + 1):
        x = -w / 2 + 0.08 + i * (w - 0.16) / n
        for y in (-d / 2 + 0.08, d / 2 - 0.08):
            box(f'cren_{i}_{y}', 0.16, 0.16, 0.16, x, y, h, wall, 0.03)
    # Bogentür und Bogenfenster
    box('door', 0.5, 0.06, 0.75, 0, -d / 2 - 0.02, 0, wood, 0.02)
    bpy.ops.mesh.primitive_cylinder_add(vertices=16, radius=0.25, depth=0.06, location=(0, -d / 2 - 0.025, 0.75), rotation=(math.pi / 2, 0, 0))
    finish(bpy.context.active_object, wood)
    for x in (-0.85, 0.85):
        box(f'win_{x}', 0.28, 0.06, 0.4, x, -d / 2 - 0.02, 0.75, glass, 0.01)
        bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.14, depth=0.06, location=(x, -d / 2 - 0.025, 1.15), rotation=(math.pi / 2, 0, 0))
        finish(bpy.context.active_object, glass)
        box(f'win_trim_{x}', 0.4, 0.05, 0.05, x, -d / 2 - 0.03, 0.7, trim, 0.01)
    if variant % 2 == 1:
        # Dachterrasse mit gestreiftem Sonnensegel statt Kuppel
        stripe_a = material('awning_a', hex_color(0xc9663f))
        for i in range(5):
            box(f'awning{i}', 0.26, 1.2, 0.03, -0.1 + i * 0.26, 0.15, h + 0.65, stripe_a if i % 2 == 0 else wall, 0.0)
        for x in (-0.25, 1.05):
            for y in (-0.4, 0.7):
                cylinder(f'post_{x}_{y}', 0.03, 0.65, x, y, h, wood, verts=6, bevel=0)
        return
    # Kuppel auf Tambour
    cylinder('drum', 0.55, 0.3, 0.2, 0.2, h, wall, verts=16)
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20, ring_count=10, radius=0.58, location=(0.2, 0.2, h + 0.3))
    dome = bpy.context.active_object
    bpy.ops.object.mode_set(mode='EDIT')
    bm = bmesh.from_edit_mesh(dome.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.001], context='VERTS')
    bmesh.update_edit_mesh(dome.data)
    bpy.ops.object.mode_set(mode='OBJECT')
    finish(dome, dome_mat)
    cylinder('spire', 0.06, 0.45, 0.2, 0.2, h + 0.85, gold, verts=8, r_top=0.0)
    # Blumentöpfe auf dem Dach
    for i, x in enumerate((-0.8, -0.4)):
        cylinder(f'pot{i}', 0.09, 0.14, x, -d / 2 + 0.35, h, pot, verts=8, r_top=0.11)
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1, radius=0.14, location=(x, -d / 2 + 0.35, h + 0.28))
        finish(bpy.context.active_object, leaves)


MODELS = {
    **{f'house_north_{v}': (lambda v=v: house_north(v)) for v in range(4)},
    **{f'house_south_{v}': (lambda v=v: house_south(v)) for v in range(2)},
}


# --- Export und Vorschau -------------------------------------------------------------

def render_preview(path: str):
    scene = bpy.context.scene
    bpy.ops.object.light_add(type='SUN', location=(3, -4, 6), rotation=(math.radians(50), math.radians(10), math.radians(35)))
    bpy.context.active_object.data.energy = 4.0
    world = bpy.data.worlds.new('sky')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (*hex_color(0xa9dcf2), 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
    scene.world = world
    bpy.ops.mesh.primitive_plane_add(size=8, location=(0, 0, 0))
    ground = bpy.context.active_object
    ground.data.materials.append(material('ground', hex_color(0x7cb85a)))
    bpy.ops.object.camera_add(location=(4.2, -5.4, 4.4))
    cam = bpy.context.active_object
    direction = -cam.location + bpy.data.objects['plinth' if 'plinth' in bpy.data.objects else 'body'].location
    direction.z += 1.3
    cam.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()
    cam.data.lens = 42
    scene.camera = cam
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = 48
    scene.cycles.device = 'CPU'
    scene.cycles.use_denoising = False  # Debian-Blender hat keinen OpenImageDenoiser
    scene.cycles.samples = 96
    scene.render.resolution_x = 900
    scene.render.resolution_y = 700
    scene.view_settings.view_transform = 'Filmic' if 'Filmic' in [i.identifier for i in scene.view_settings.bl_rna.properties['view_transform'].enum_items] else 'Standard'
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)
    # Hilfsobjekte nicht exportieren
    for name in [ground.name, cam.name]:
        bpy.data.objects.remove(bpy.data.objects[name])


def export(name: str, out_dir: str):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    _materials.clear()
    MODELS[name]()
    model_objects = list(bpy.context.scene.objects)
    bpy.ops.object.select_all(action='DESELECT')
    for o in model_objects:
        o.select_set(True)
    glb = os.path.join(out_dir, f'{name}.glb')
    bpy.ops.export_scene.gltf(filepath=glb, export_format='GLB', use_selection=True, export_apply=True, export_yup=True)
    render_preview(os.path.join(out_dir, f'{name}.png'))
    print(f'OK {glb}')


def main():
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    if not args:
        print(__doc__)
        sys.exit(1)
    out_dir = args[0]
    os.makedirs(out_dir, exist_ok=True)
    for name in args[1:] or list(MODELS):
        export(name, out_dir)


main()
