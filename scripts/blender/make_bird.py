# Procedural cozy low-poly 3D bird generator for Daybreak / Nest.
# Builds a parametric bird from primitives (body, belly, head, beak, eyes,
# wings, tail, legs/feet, crest + colour-coded marking parts), rigs it to a
# reusable armature, adds 8 looping animation clips, and exports a game-ready
# GLB (+ .blend) plus preview renders.
#
#   blender --background --python make_bird.py -- <species_id> <out_root> <render_dir>
#
# Species params come from PARAMS below (one entry per id).

import bpy, bmesh, sys, os, math
from mathutils import Vector

# ---------------------------------------------------------------- args
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SPECIES = argv[0] if len(argv) > 0 else "black_capped_chickadee"
OUT_ROOT = argv[1] if len(argv) > 1 else "public/assets/birds3d"
RENDER_DIR = argv[2] if len(argv) > 2 else "C:/Users/benma/AppData/Local/Temp/bird3d"

# ---------------------------------------------------------------- helpers
def hx(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16) / 255.0, int(h[2:4], 16) / 255.0, int(h[4:6], 16) / 255.0)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

_mats = {}
def mat(name, color):
    key = name
    if key in _mats:
        return _mats[key]
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = 0.9
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = 0.1
    _mats[key] = m
    return m

def sphere(name, loc, scale, m, segs=18):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=segs // 2, location=loc)
    o = bpy.context.object
    o.name = name
    o.scale = scale
    bpy.ops.object.shade_smooth()
    o.data.materials.append(m)
    return o

def hemisphere(name, loc, scale, m, keep="top", cut=-0.05, segs=18):
    """A sphere with one half removed — for caps / patches hugging a surface."""
    o = sphere(name, loc, scale, m, segs)
    me = o.data
    bm = bmesh.new(); bm.from_mesh(me)
    for v in list(bm.verts):
        z = v.co.z
        if (keep == "top" and z < cut) or (keep == "bot" and z > -cut):
            bm.verts.remove(v)
    bm.to_mesh(me); bm.free()
    return o

def cone(name, loc, rad1, rad2, depth, m, rot=(0, 0, 0), segs=12):
    bpy.ops.mesh.primitive_cone_add(vertices=segs, radius1=rad1, radius2=rad2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    bpy.ops.object.shade_smooth()
    o.data.materials.append(m)
    return o

def cyl(name, loc, rad, depth, m, rot=(0, 0, 0), segs=8):
    bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=rad, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(m)
    return o

# ---------------------------------------------------------------- params
# Minimal per-species params for the prototype. cols: body, belly, wing, beak.
PARAMS = {
    "black_capped_chickadee": {
        "name": "Black-capped Chickadee",
        "body": "#b7bec4", "belly": "#f3efe6", "wing": "#6f777c", "beak": "#2a2a2a",
        "body_scale": (1.0, 1.15, 1.05), "head_r": 0.92, "neck": 0.15,
        "beak_len": 0.45, "beak_w": 0.18, "tail_len": 1.0, "leg_len": 0.55,
        "crest": None,
        "marks": [
            ("cap", "#23211f"), ("cheek", "#ffffff"), ("bib", "#23211f"),
        ],
    },
    "cedar_waxwing": {
        "name": "Cedar Waxwing",
        "body": "#b89a72", "belly": "#d8c6a0", "wing": "#6f6052", "beak": "#2c2c2c",
        "body_scale": (0.95, 1.2, 1.0), "head_r": 0.82, "neck": 0.2,
        "beak_len": 0.4, "beak_w": 0.16, "tail_len": 1.1, "leg_len": 0.5,
        "crest": "#b89a72",
        "marks": [
            ("mask", "#1f1c19"),
        ],
    },
}

P = PARAMS.get(SPECIES, PARAMS["black_capped_chickadee"])

# ---------------------------------------------------------------- build mesh
reset()
parts = []  # (object, bone_group)

C_body = mat("body", hx(P["body"]))
C_belly = mat("belly", hx(P["belly"]))
C_wing = mat("wing", hx(P["wing"]))
C_beak = mat("beak", hx(P["beak"]))
C_eye = mat("eye", (0.09, 0.08, 0.07))
C_leg = mat("leg", hx(P["beak"]))

bs = P["body_scale"]
hr = P["head_r"]
head_z = bs[2] + hr * 0.55 + P["neck"]
head_fwd = bs[1] * 0.18
head = Vector((0, head_fwd, head_z))

# body + belly
parts.append((sphere("Body", (0, 0, 0), bs, C_body), "chest"))
parts.append((sphere("Belly", (0, bs[1] * 0.5, -bs[2] * 0.16), (bs[0] * 0.64, bs[1] * 0.46, bs[2] * 0.72), C_belly), "chest"))
# head
parts.append((sphere("Head", head, (hr, hr, hr), C_body), "head"))
# eyes
C_glint = mat("glint", (1, 1, 1))
eye_y = head.y + hr * 0.66
eye_z = head.z + hr * 0.02
for sx, grp in ((-1, "eye_L"), (1, "eye_R")):
    parts.append((sphere("Eye_%s" % grp[-1], (sx * hr * 0.42, eye_y, eye_z), (0.15, 0.13, 0.15), C_eye, 12), grp))
    parts.append((sphere("Glint_%s" % grp[-1], (sx * hr * 0.42 - sx * 0.04, eye_y + 0.05, eye_z + 0.07), (0.05, 0.04, 0.05), C_glint, 8), grp))
# beak (upper + lower) pointing +Y
bx = P["beak_w"]; bl = P["beak_len"]
beak_base_y = head.y + hr * 0.92
parts.append((cone("BeakUpper", (0, beak_base_y + bl * 0.4, head.z + 0.02), bx, bx * 0.12, bl, C_beak, rot=(math.radians(-90), 0, 0)), "beak_upper"))
parts.append((cone("BeakLower", (0, beak_base_y + bl * 0.35, head.z - 0.10), bx * 0.9, bx * 0.1, bl * 0.85, C_beak, rot=(math.radians(-90), 0, 0)), "beak_lower"))
# wings (flattened, angled along body)
for sx, grp in ((-1, "wing_L"), (1, "wing_R")):
    w = sphere("Wing_%s" % grp[-1], (sx * bs[0] * 0.92, -bs[1] * 0.05, bs[2] * 0.05), (0.22, 0.7, 0.5), C_wing)
    w.rotation_euler = (0, 0, sx * math.radians(-8))
    parts.append((w, grp))
# tail (flattened wedge pointing -Y)
tl = P["tail_len"]
tail = cone("Tail", (0, -bs[1] - tl * 0.4, bs[2] * 0.02), bs[0] * 0.55, bs[0] * 0.18, tl, C_wing, rot=(math.radians(90), 0, 0))
tail.scale = (1.0, 1.0, 0.35)
parts.append((tail, "tail_base"))
# legs + feet
ll = P["leg_len"]
for sx, lg, fg in ((-1, "leg_L", "foot_L"), (1, "leg_R", "foot_R")):
    leg = cyl("Leg_%s" % lg[-1], (sx * bs[0] * 0.28, bs[1] * 0.05, -bs[2] - ll * 0.5), 0.06, ll, C_leg)
    parts.append((leg, lg))
    foot = sphere("Foot_%s" % fg[-1], (sx * bs[0] * 0.28, bs[1] * 0.18, -bs[2] - ll), (0.16, 0.22, 0.07), C_leg, 10)
    parts.append((foot, fg))

# crest
if P.get("crest"):
    ck = mat("crest", hx(P["crest"]))
    cr = cone("Crest", (0, head.y - hr * 0.2, head.z + hr * 0.9), hr * 0.4, 0.02, hr * 1.1, ck, rot=(math.radians(15), 0, 0))
    parts.append((cr, "head"))

# markings
for mk, col in P.get("marks", []):
    mc = mat("mark_%s" % mk, hx(col))
    if mk == "cap":
        parts.append((hemisphere("Cap", head, (hr * 1.04, hr * 1.04, hr * 1.04), mc, "top", cut=-0.45), "head"))
    elif mk == "cheek":
        for sx in (-1, 1):
            parts.append((sphere("Cheek", (sx * hr * 0.62, head.y + hr * 0.62, head.z - hr * 0.12), (0.26 * hr, 0.2 * hr, 0.34 * hr), mc, 12), "head"))
    elif mk == "bib":
        parts.append((sphere("Bib", (0, head.y + hr * 0.72, head.z - hr * 0.5), (0.26 * hr, 0.24 * hr, 0.3 * hr), mc, 14), "head"))
    elif mk == "mask":
        parts.append((sphere("Mask", (0, head.y + hr * 0.55, eye_z), (hr * 0.95, hr * 0.5, hr * 0.32), mc, 14), "head"))
    elif mk == "throat":
        parts.append((sphere("Throat", (0, head.y + hr * 0.55, head.z - hr * 0.7), (0.3 * hr, 0.28 * hr, 0.34 * hr), mc, 12), "head"))
    elif mk == "collar":
        parts.append((sphere("Collar", (0, head.y + hr * 0.3, head.z - hr * 0.95), (hr * 0.9, hr * 0.55, hr * 0.4), mc, 14), "chest"))

# assign each part fully to its bone's vertex group, then join
for o, grp in parts:
    bpy.context.view_layer.objects.active = o
    vg = o.vertex_groups.new(name=grp)
    vg.add(range(len(o.data.vertices)), 1.0, "REPLACE")

bpy.ops.object.select_all(action="DESELECT")
for o, _ in parts:
    o.select_set(True)
body_obj = parts[0][0]
bpy.context.view_layer.objects.active = body_obj
bpy.ops.object.join()
bird = bpy.context.object
bird.name = "Bird_%s" % SPECIES

# ---------------------------------------------------------------- armature
bpy.ops.object.armature_add(location=(0, 0, 0))
arm = bpy.context.object
arm.name = "Rig"
amt = arm.data
bpy.ops.object.mode_set(mode="EDIT")
ebs = amt.edit_bones
ebs.remove(ebs[0])  # remove default bone

def bone(name, head_co, tail_co, parent=None):
    b = ebs.new(name)
    b.head = Vector(head_co); b.tail = Vector(tail_co)
    if parent:
        b.parent = ebs[parent]; b.use_connect = False
    return b

bz = -bs[2] - ll  # feet level
bone("root", (0, 0, bz), (0, 0, bz + 0.3))
bone("body", (0, 0, -bs[2] * 0.3), (0, 0, bs[2] * 0.2), "root")
bone("chest", (0, 0, bs[2] * 0.2), (0, 0, bs[2] * 0.7), "body")
bone("neck", (0, head.y * 0.6, bs[2] * 0.7), (0, head.y, head.z - hr * 0.6), "chest")
bone("head", (0, head.y, head.z - hr * 0.5), (0, head.y, head.z + hr * 0.5), "neck")
bone("beak_upper", (0, beak_base_y, head.z + 0.02), (0, beak_base_y + bl, head.z + 0.02), "head")
bone("beak_lower", (0, beak_base_y, head.z - 0.1), (0, beak_base_y + bl * 0.85, head.z - 0.1), "head")
bone("eye_L", (-hr * 0.42, eye_y, eye_z), (-hr * 0.42, eye_y + 0.1, eye_z), "head")
bone("eye_R", (hr * 0.42, eye_y, eye_z), (hr * 0.42, eye_y + 0.1, eye_z), "head")
for sx, wl, wt in ((-1, "wing_L", "wingtip_L"), (1, "wing_R", "wingtip_R")):
    bone(wl, (sx * bs[0] * 0.55, 0, bs[2] * 0.15), (sx * bs[0] * 1.0, -bs[1] * 0.1, bs[2] * 0.0), "chest")
    bone(wt, (sx * bs[0] * 1.0, -bs[1] * 0.1, 0), (sx * bs[0] * 1.4, -bs[1] * 0.3, -0.1), wl)
bone("tail_base", (0, -bs[1] * 0.6, bs[2] * 0.05), (0, -bs[1] - tl * 0.5, bs[2] * 0.05), "body")
bone("tail_tip", (0, -bs[1] - tl * 0.5, bs[2] * 0.05), (0, -bs[1] - tl, bs[2] * 0.08), "tail_base")
for sx, lg, ft in ((-1, "leg_L", "foot_L"), (1, "leg_R", "foot_R")):
    bone(lg, (sx * bs[0] * 0.28, bs[1] * 0.05, -bs[2] * 0.2), (sx * bs[0] * 0.28, bs[1] * 0.05, -bs[2] - ll * 0.7), "body")
    bone(ft, (sx * bs[0] * 0.28, bs[1] * 0.05, -bs[2] - ll * 0.7), (sx * bs[0] * 0.28, bs[1] * 0.3, -bs[2] - ll), lg)

bpy.ops.object.mode_set(mode="OBJECT")

# parent mesh to armature using existing vertex groups
bird.parent = arm
md = bird.modifiers.new("Armature", "ARMATURE")
md.object = arm

# ---------------------------------------------------------------- animations
import math as _m
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
for pb in arm.pose.bones:
    pb.rotation_mode = "XYZ"

def key(clip_frames, fn):
    """Create an action, run fn(frame) to pose, keyframe all transformed bones."""
    pass

def new_action(name):
    act = bpy.data.actions.new(name)
    arm.animation_data_create()
    arm.animation_data.action = act
    return act

def insert(frame, poses):
    """poses: dict bone -> dict('rot'|'loc'|'scale' -> tuple). Keyframe given bones."""
    for bn, tr in poses.items():
        pb = arm.pose.bones.get(bn)
        if not pb:
            continue
        if "rot" in tr:
            pb.rotation_euler = tr["rot"]
            pb.keyframe_insert("rotation_euler", frame=frame)
        if "loc" in tr:
            pb.location = tr["loc"]
            pb.keyframe_insert("location", frame=frame)
        if "scale" in tr:
            pb.scale = tr["scale"]
            pb.keyframe_insert("scale", frame=frame)

R = _m.radians
def build_anim(name, length, frames):
    act = new_action(name)
    for f, poses in frames:
        insert(f, poses)
    # loop: ensure first == last where appropriate handled by caller
    return act, length

ACTIONS = []

# idle: breathing (chest scale), tiny head, tail
ACTIONS.append(build_anim("idle", 60, [
    (1,  {"chest": {"scale": (1, 1, 1)}, "head": {"rot": (0, 0, 0)}, "tail_base": {"rot": (0, 0, 0)}}),
    (30, {"chest": {"scale": (1.04, 1.0, 1.04)}, "head": {"rot": (R(4), 0, R(3))}, "tail_base": {"rot": (R(-4), 0, 0)}}),
    (60, {"chest": {"scale": (1, 1, 1)}, "head": {"rot": (0, 0, 0)}, "tail_base": {"rot": (0, 0, 0)}}),
]))
# hop
ACTIONS.append(build_anim("hop", 24, [
    (1,  {"root": {"loc": (0, 0, 0)}, "body": {"scale": (1, 1, 1)}, "wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}}),
    (6,  {"root": {"loc": (0, 0, 0)}, "body": {"scale": (1.1, 1.05, 0.85)}}),
    (12, {"root": {"loc": (0, 0.15, 0.55)}, "body": {"scale": (0.92, 0.95, 1.15)}, "wing_L": {"rot": (0, 0, R(-30))}, "wing_R": {"rot": (0, 0, R(30))}}),
    (20, {"root": {"loc": (0, 0.3, 0)}, "body": {"scale": (1.06, 1.02, 0.95)}}),
    (24, {"root": {"loc": (0, 0.3, 0)}, "body": {"scale": (1, 1, 1)}, "wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}}),
]))
# peck
ACTIONS.append(build_anim("peck", 24, [
    (1,  {"neck": {"rot": (0, 0, 0)}, "head": {"rot": (0, 0, 0)}, "beak_lower": {"rot": (0, 0, 0)}}),
    (8,  {"neck": {"rot": (R(35), 0, 0)}, "head": {"rot": (R(20), 0, 0)}, "beak_lower": {"rot": (R(-12), 0, 0)}}),
    (12, {"neck": {"rot": (R(40), 0, 0)}, "beak_lower": {"rot": (R(-22), 0, 0)}}),
    (18, {"neck": {"rot": (R(35), 0, 0)}, "beak_lower": {"rot": (R(-12), 0, 0)}}),
    (24, {"neck": {"rot": (0, 0, 0)}, "head": {"rot": (0, 0, 0)}, "beak_lower": {"rot": (0, 0, 0)}}),
]))
# look_around
ACTIONS.append(build_anim("look_around", 72, [
    (1,  {"head": {"rot": (0, 0, 0)}, "body": {"rot": (0, 0, 0)}}),
    (18, {"head": {"rot": (0, 0, R(38))}, "body": {"rot": (0, 0, R(6))}}),
    (36, {"head": {"rot": (0, 0, 0)}}),
    (54, {"head": {"rot": (0, 0, R(-38))}, "body": {"rot": (0, 0, R(-6))}}),
    (72, {"head": {"rot": (0, 0, 0)}, "body": {"rot": (0, 0, 0)}}),
]))
# flap (wings flap on perch)
ACTIONS.append(build_anim("flap", 16, [
    (1,  {"wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}, "wingtip_L": {"rot": (0, 0, 0)}, "wingtip_R": {"rot": (0, 0, 0)}}),
    (5,  {"wing_L": {"rot": (R(-15), 0, R(-55))}, "wing_R": {"rot": (R(-15), 0, R(55))}, "wingtip_L": {"rot": (0, 0, R(-25))}, "wingtip_R": {"rot": (0, 0, R(25))}}),
    (11, {"wing_L": {"rot": (R(10), 0, R(35))}, "wing_R": {"rot": (R(10), 0, R(-35))}, "wingtip_L": {"rot": (0, 0, R(20))}, "wingtip_R": {"rot": (0, 0, R(-20))}}),
    (16, {"wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}, "wingtip_L": {"rot": (0, 0, 0)}, "wingtip_R": {"rot": (0, 0, 0)}}),
]))
# short_fly (faster flap + rise)
ACTIONS.append(build_anim("short_fly", 16, [
    (1,  {"root": {"loc": (0, 0, 0)}, "wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}}),
    (5,  {"root": {"loc": (0, 0, 0.4)}, "wing_L": {"rot": (R(-20), 0, R(-65))}, "wing_R": {"rot": (R(-20), 0, R(65))}}),
    (11, {"root": {"loc": (0, 0, 0.5)}, "wing_L": {"rot": (R(15), 0, R(45))}, "wing_R": {"rot": (R(15), 0, R(-45))}}),
    (16, {"root": {"loc": (0, 0, 0.4)}, "wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}}),
]))
# sleep (eyes closed via tiny eye scale, head tuck, slow breathing)
ACTIONS.append(build_anim("sleep", 80, [
    (1,  {"neck": {"rot": (R(18), 0, 0)}, "head": {"rot": (R(10), 0, 0)}, "eye_L": {"scale": (1, 1, 0.08)}, "eye_R": {"scale": (1, 1, 0.08)}, "chest": {"scale": (1, 1, 1)}}),
    (40, {"chest": {"scale": (1.03, 1, 1.03)}, "head": {"rot": (R(13), 0, 0)}}),
    (80, {"neck": {"rot": (R(18), 0, 0)}, "head": {"rot": (R(10), 0, 0)}, "eye_L": {"scale": (1, 1, 0.08)}, "eye_R": {"scale": (1, 1, 0.08)}, "chest": {"scale": (1, 1, 1)}}),
]))
# happy (bounce + wing flutter + head tilt)
ACTIONS.append(build_anim("happy", 28, [
    (1,  {"root": {"loc": (0, 0, 0)}, "head": {"rot": (0, 0, 0)}, "wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}}),
    (7,  {"root": {"loc": (0, 0, 0.4)}, "head": {"rot": (0, R(8), R(10))}, "wing_L": {"rot": (0, 0, R(-40))}, "wing_R": {"rot": (0, 0, R(40))}}),
    (14, {"root": {"loc": (0, 0, 0)}, "wing_L": {"rot": (0, 0, R(-10))}, "wing_R": {"rot": (0, 0, R(10))}}),
    (20, {"root": {"loc": (0, 0, 0.35)}, "head": {"rot": (0, R(-8), R(-10))}, "wing_L": {"rot": (0, 0, R(-40))}, "wing_R": {"rot": (0, 0, R(40))}}),
    (28, {"root": {"loc": (0, 0, 0)}, "head": {"rot": (0, 0, 0)}, "wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}}),
]))

bpy.ops.object.mode_set(mode="OBJECT")

# push every action to its own NLA track for clean named GLB clips
arm.animation_data.action = None
for act, length in ACTIONS:
    tr = arm.animation_data.nla_tracks.new()
    tr.name = act.name
    st = tr.strips.new(act.name, 1, act)
    st.name = act.name

# ---------------------------------------------------------------- export
out_dir = os.path.join(OUT_ROOT, SPECIES)
os.makedirs(out_dir, exist_ok=True)
glb = os.path.join(out_dir, "%s.glb" % SPECIES)
blend = os.path.join(out_dir, "%s.blend" % SPECIES)

bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(
    filepath=glb, export_format="GLB", use_selection=False,
    export_animations=True, export_animation_mode="NLA_TRACKS",
    export_yup=True, export_apply=True,
)
bpy.ops.wm.save_as_mainfile(filepath=blend)

# ---------------------------------------------------------------- preview render
os.makedirs(RENDER_DIR, exist_ok=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT"
try:
    scene.view_settings.view_transform = "Standard"
except Exception:
    pass
scene.render.film_transparent = True
scene.render.resolution_x = 360
scene.render.resolution_y = 360
world = bpy.data.worlds.new("W"); scene.world = world
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.93, 0.95, 0.92, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.9
# sun
bpy.ops.object.light_add(type="SUN", location=(4, -6, 8))
bpy.context.object.data.energy = 3.0
# camera
bpy.ops.object.camera_add()
cam = bpy.context.object
scene.camera = cam
cam.data.lens = 50

import mathutils
target = Vector((0, 0, head.z * 0.4))
def look_from(az_deg, el_deg, dist):
    az = math.radians(az_deg); el = math.radians(el_deg)
    cam.location = target + Vector((math.cos(el) * math.sin(az), -math.cos(el) * math.cos(az), math.sin(el))) * dist
    d = (target - cam.location)
    cam.rotation_euler = d.to_track_quat("-Z", "Y").to_euler()

for label, az, el in (("front", 168, 8), ("q34", 142, 14), ("side", 95, 4)):
    look_from(az, el, 6.8)
    scene.render.filepath = os.path.join(RENDER_DIR, "%s_%s.png" % (SPECIES, label))
    bpy.ops.render.render(write_still=True)

print("DONE", SPECIES, "->", glb)
