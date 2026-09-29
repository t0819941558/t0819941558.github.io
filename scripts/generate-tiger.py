"""Generate the editable Blender source, preview render, and optimized GLB tiger."""

from __future__ import annotations

import math
from pathlib import Path

import bpy
from mathutils import Vector


ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR = ROOT / "assets" / "tiger"
PUBLIC_DIR = ROOT / "public" / "models"
BLEND_PATH = SOURCE_DIR / "tiger.blend"
GLB_PATH = PUBLIC_DIR / "tiger.glb"
PREVIEW_PATH = PUBLIC_DIR / "tiger-preview.png"

SOURCE_DIR.mkdir(parents=True, exist_ok=True)
PUBLIC_DIR.mkdir(parents=True, exist_ok=True)


def clean_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for data in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.cameras, bpy.data.lights):
        for item in list(data):
            if item.users == 0:
                data.remove(item)


def material(name: str, color: tuple[float, float, float, float], roughness: float = 0.72, metallic: float = 0.0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = color
    mat.use_nodes = True
    shader = mat.node_tree.nodes.get("Principled BSDF")
    shader.inputs["Base Color"].default_value = color
    shader.inputs["Roughness"].default_value = roughness
    shader.inputs["Metallic"].default_value = metallic
    return mat


def empty(name: str, location=(0.0, 0.0, 0.0), parent=None):
    obj = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(obj)
    obj.location = location
    obj.empty_display_type = "PLAIN_AXES"
    obj.empty_display_size = 0.18
    if parent:
        obj.parent = parent
    return obj


def parent_keep(obj, parent) -> None:
    matrix = obj.matrix_world.copy()
    obj.parent = parent
    obj.matrix_world = matrix


def smooth_mesh(obj) -> None:
    if obj.type != "MESH":
        return
    for polygon in obj.data.polygons:
        polygon.use_smooth = True


def sphere(name: str, location, scale, mat, parent=None, segments=32, rings=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=location)
    obj = bpy.context.object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    smooth_mesh(obj)
    obj.data.materials.append(mat)
    if parent:
        parent_keep(obj, parent)
    return obj


def wedge(name: str, center, width: float, height: float, depth: float, mat, parent=None, rotation=0.0):
    x, y, z = center
    vertices = [
        (x - width / 2, y - depth / 2, z + height / 2),
        (x + width / 2, y - depth / 2, z + height / 2),
        (x, y - depth / 2, z - height / 2),
        (x - width / 2, y + depth / 2, z + height / 2),
        (x + width / 2, y + depth / 2, z + height / 2),
        (x, y + depth / 2, z - height / 2),
    ]
    faces = [(0, 2, 1), (3, 4, 5), (0, 1, 4, 3), (1, 2, 5, 4), (2, 0, 3, 5)]
    mesh = bpy.data.meshes.new(f"{name}Mesh")
    mesh.from_pydata(vertices, [], faces)
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    obj.rotation_euler[1] = rotation
    if parent:
        parent_keep(obj, parent)
    bevel = obj.modifiers.new("Soft edges", "BEVEL")
    bevel.width = 0.025
    bevel.segments = 2
    return obj


def curve(name: str, points, bevel: float, mat, parent=None):
    data = bpy.data.curves.new(name, "CURVE")
    data.dimensions = "3D"
    data.resolution_u = 3
    data.bevel_depth = bevel
    data.bevel_resolution = 3
    spline = data.splines.new("BEZIER")
    spline.bezier_points.add(len(points) - 1)
    for handle, point in zip(spline.bezier_points, points):
        handle.co = point
        handle.handle_left_type = "AUTO"
        handle.handle_right_type = "AUTO"
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(mat)
    if parent:
        parent_keep(obj, parent)
    return obj


def look_at(obj, target) -> None:
    direction = Vector(target) - obj.location
    obj.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def merge_static_meshes(parent, protected=()) -> None:
    """Merge same-material pieces under one animation pivot to reduce draw calls."""
    protected = set(protected)
    candidates = [child for child in list(parent.children) if child.type in {"MESH", "CURVE"}]
    for obj in candidates:
        bpy.context.view_layer.objects.active = obj
        obj.select_set(True)
        if obj.type == "CURVE":
            bpy.ops.object.convert(target="MESH")
        for modifier in list(obj.modifiers):
            bpy.ops.object.modifier_apply(modifier=modifier.name)
        obj.select_set(False)

    buckets = {}
    for obj in [child for child in list(parent.children) if child.type == "MESH"]:
        if obj.name in protected or not obj.data.materials:
            continue
        buckets.setdefault(obj.data.materials[0].name, []).append(obj)

    for material_name, objects in buckets.items():
        if len(objects) < 2:
            continue
        bpy.ops.object.select_all(action="DESELECT")
        for obj in objects:
            obj.select_set(True)
        active = objects[0]
        bpy.context.view_layer.objects.active = active
        bpy.ops.object.join()
        active.name = f"{parent.name}_{material_name.replace(' ', '')}"


clean_scene()
bpy.context.preferences.filepaths.save_version = 0

orange = material("Tiger Orange", (0.78, 0.11, 0.018, 1.0), 0.68)
orange_light = material("Tiger Highlight", (1.0, 0.26, 0.03, 1.0), 0.7)
cream = material("Warm Cream", (1.0, 0.72, 0.38, 1.0), 0.78)
stripe = material("Deep Brown", (0.095, 0.045, 0.028, 1.0), 0.62)
pink = material("Nose Pink", (0.92, 0.20, 0.14, 1.0), 0.7)
eye_black = material("Eye Black", (0.012, 0.009, 0.008, 1.0), 0.18)
eye_glint = material("Eye Glint", (1.0, 0.97, 0.9, 1.0), 0.24)
inner_ear = material("Inner Ear", (0.95, 0.28, 0.20, 1.0), 0.8)

root = empty("TigerRoot")
body_rig = empty("BodyRig", (0.0, 0.0, 1.48), root)
head_rig = empty("HeadRig", (0.0, -0.02, 2.74), root)
left_paw_rig = empty("FrontPaw_L", (-0.63, -0.18, 1.38), body_rig)
right_paw_rig = empty("FrontPaw_R", (0.63, -0.18, 1.38), body_rig)
tail_rig = empty("TailRig", (0.74, 0.18, 1.57), body_rig)

# Body: pear-shaped torso with a soft belly and seated haunches.
sphere("Body", (0.0, 0.02, 1.48), (0.82, 0.53, 0.88), orange, body_rig)
sphere("Chest", (0.0, -0.36, 1.68), (0.56, 0.28, 0.62), orange_light, body_rig)
sphere("Belly", (0.0, -0.53, 1.38), (0.46, 0.10, 0.53), cream, body_rig, 28, 18)

for side, x in (("L", -0.62), ("R", 0.62)):
    sphere(f"Haunch.{side}", (x, 0.08, 0.72), (0.55, 0.48, 0.48), orange, body_rig)
    sphere(f"Foot.{side}", (x, -0.42, 0.39), (0.47, 0.62, 0.25), orange_light, body_rig)
    sphere(f"ToePatch.{side}", (x, -0.92, 0.38), (0.28, 0.08, 0.13), cream, body_rig, 24, 16)

# Front paws have their own pivots for the click reaction.
for side, x, rig, angle in (
    ("L", -0.58, left_paw_rig, -0.09),
    ("R", 0.58, right_paw_rig, 0.09),
):
    paw = sphere(f"Foreleg.{side}", (x, -0.43, 1.13), (0.30, 0.27, 0.62), orange_light, rig)
    paw.rotation_euler[1] = angle
    sphere(f"FrontToes.{side}", (x, -0.58, 0.59), (0.32, 0.29, 0.20), cream, rig, 24, 16)

# Head and face. Black oval eyes with highlights avoid the disconnected white-eye look.
sphere("Head", (0.0, -0.03, 2.72), (0.94, 0.62, 0.78), orange, head_rig)
sphere("FaceMask", (0.0, -0.50, 2.67), (0.70, 0.20, 0.52), orange_light, head_rig, 30, 18)

for side, x in (("L", -0.34), ("R", 0.34)):
    sphere(f"Cheek.{side}", (x, -0.69, 2.48), (0.36, 0.15, 0.27), cream, head_rig, 28, 18)
    eye = sphere(f"Eye_{side}", (x, -0.655, 2.88), (0.145, 0.075, 0.19), eye_black, head_rig, 24, 16)
    eye["base_scale_y"] = eye.scale.z
    sphere(f"EyeGlint.{side}", (x - 0.035, -0.722, 2.96), (0.045, 0.025, 0.060), eye_glint, head_rig, 18, 12)

sphere("Nose", (0.0, -0.835, 2.60), (0.145, 0.075, 0.105), pink, head_rig, 24, 14)
curve("Mouth", [(0.0, -0.835, 2.56), (0.0, -0.84, 2.46)], 0.018, stripe, head_rig)
curve("Mouth.L", [(0.0, -0.84, 2.46), (-0.16, -0.825, 2.40), (-0.27, -0.78, 2.43)], 0.015, stripe, head_rig)
curve("Mouth.R", [(0.0, -0.84, 2.46), (0.16, -0.825, 2.40), (0.27, -0.78, 2.43)], 0.015, stripe, head_rig)

# Rounded ears and recessed inner ears.
for side, x, tilt in (("L", -0.69, -0.30), ("R", 0.69, 0.30)):
    ear = sphere(f"Ear.{side}", (x, -0.01, 3.30), (0.42, 0.18, 0.46), orange, head_rig, 28, 18)
    ear.rotation_euler[1] = tilt
    inner = sphere(f"InnerEar.{side}", (x, -0.17, 3.31), (0.25, 0.075, 0.29), inner_ear, head_rig, 24, 16)
    inner.rotation_euler[1] = tilt

# Forehead wedges and compact side stripes follow the head surface.
for index, x in enumerate((-0.30, 0.0, 0.30)):
    wedge(f"ForeheadStripe.{index + 1}", (x, -0.615, 3.29), 0.18, 0.34 if index == 1 else 0.28, 0.055, stripe, head_rig)

for side, x, angle in (("L", -0.78, -0.30), ("R", 0.78, 0.30)):
    for index, z in enumerate((2.70, 2.92)):
        mark = sphere(f"FaceStripe.{side}.{index + 1}", (x, -0.46, z), (0.20, 0.055, 0.065), stripe, head_rig, 20, 12)
        mark.rotation_euler[1] = angle

# Body side stripes are embedded close to the orange silhouette.
for side, x, angle in (("L", -0.73, -0.22), ("R", 0.73, 0.22)):
    for index, z in enumerate((1.35, 1.64, 1.91)):
        mark = sphere(f"BodyStripe.{side}.{index + 1}", (x, -0.28, z), (0.16, 0.055, 0.22), stripe, body_rig, 20, 12)
        mark.rotation_euler[1] = angle

# Whiskers use thin curves and stay parented to the head pivot.
for side, direction in (("L", -1), ("R", 1)):
    for index, offset in enumerate((-0.06, 0.07)):
        curve(
            f"Whisker.{side}.{index + 1}",
            [
                (direction * 0.30, -0.80, 2.51 + offset),
                (direction * 0.68, -0.78, 2.49 + offset),
                (direction * 1.00, -0.68, 2.56 + offset),
            ],
            0.009,
            stripe,
            head_rig,
        )

# A curled, banded tail made of overlapping tapered pieces.
tail_points = [
    (0.82, 0.13, 1.58),
    (1.10, 0.15, 1.72),
    (1.34, 0.12, 1.93),
    (1.48, 0.06, 2.18),
    (1.44, -0.02, 2.44),
    (1.25, -0.12, 2.61),
    (1.04, -0.18, 2.55),
]
for index, point in enumerate(tail_points):
    radius = 0.22 - index * 0.016
    mat = stripe if index in (2, 5, 6) else orange
    sphere(f"TailSegment.{index + 1}", point, (radius, radius * 0.88, radius * 1.18), mat, tail_rig, 22, 14)

# Small eyebrow arcs make pointer-following expressions readable.
curve("Brow.L", [(-0.49, -0.66, 3.08), (-0.34, -0.70, 3.13), (-0.19, -0.66, 3.10)], 0.020, stripe, head_rig)
curve("Brow.R", [(0.19, -0.66, 3.10), (0.34, -0.70, 3.13), (0.49, -0.66, 3.08)], 0.020, stripe, head_rig)

merge_static_meshes(body_rig)
merge_static_meshes(head_rig, protected={"Eye_L", "Eye_R"})
merge_static_meshes(left_paw_rig)
merge_static_meshes(right_paw_rig)
merge_static_meshes(tail_rig)

# Preview-only studio floor, camera, and lighting.
floor_mat = material("Preview Floor", (0.91, 0.87, 0.80, 1.0), 0.88)
bpy.ops.mesh.primitive_plane_add(size=18, location=(0.0, 0.0, 0.10))
floor = bpy.context.object
floor.name = "PreviewFloor"
floor.data.materials.append(floor_mat)

bpy.ops.object.camera_add(location=(5.4, -9.6, 4.5))
camera = bpy.context.object
camera.name = "PreviewCamera"
camera.data.lens = 58
look_at(camera, (0.0, 0.0, 1.75))
bpy.context.scene.camera = camera

for name, location, energy, size, color in (
    ("Key", (-4.5, -5.5, 7.0), 1050, 4.0, (1.0, 0.72, 0.46)),
    ("Fill", (4.5, -3.0, 4.5), 780, 3.0, (0.52, 0.70, 1.0)),
    ("Rim", (2.0, 4.0, 6.0), 980, 3.0, (1.0, 0.46, 0.20)),
):
    data = bpy.data.lights.new(name, "AREA")
    data.energy = energy
    data.shape = "DISK"
    data.size = size
    data.color = color
    light = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(light)
    light.location = location
    look_at(light, (0.0, 0.0, 1.6))

scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE"
scene.render.resolution_x = 720
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = str(PREVIEW_PATH)
scene.render.film_transparent = False
scene.world.color = (0.045, 0.035, 0.028)
scene.view_settings.look = "AgX - Medium High Contrast"
scene.render.image_settings.color_mode = "RGBA"

bpy.ops.wm.save_as_mainfile(filepath=str(BLEND_PATH))
bpy.ops.render.render(write_still=True)

# Export only the character hierarchy; preview objects remain in the .blend source.
bpy.ops.object.select_all(action="DESELECT")
root.select_set(True)
for obj in root.children_recursive:
    obj.select_set(True)
bpy.context.view_layer.objects.active = root
bpy.ops.export_scene.gltf(
    filepath=str(GLB_PATH),
    export_format="GLB",
    use_selection=True,
    export_yup=True,
    export_apply=True,
    export_animations=False,
    export_cameras=False,
    export_lights=False,
    export_materials="EXPORT",
)

print(f"BLEND={BLEND_PATH}")
print(f"GLB={GLB_PATH}")
print(f"PREVIEW={PREVIEW_PATH}")
