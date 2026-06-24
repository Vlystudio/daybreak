# Procedural cozy low-poly 3D bird generator for Daybreak / Nest.
#
# Builds a parametric, rigged, animated bird from primitives. Markings are thin
# SHELLS that hug the head/body (so they read as painted plumage, not blobs).
# Proportions come from a per-species ARCHETYPE (songbird vs owl vs heron vs
# duck …) so silhouettes differ; colours + beak shape + crest + marks come from
# the species params. Exports a rigged GLB (8 animation clips) + .blend and
# preview renders.
#
#   blender --background --factory-startup --python make_bird.py -- <id> <out_root> <render_dir>

import bpy, bmesh, sys, os, math, json
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SPECIES = argv[0] if len(argv) > 0 else "black_capped_chickadee"
OUT_ROOT = argv[1] if len(argv) > 1 else "public/assets/birds3d"
RENDER_DIR = argv[2] if len(argv) > 2 else "C:/Users/benma/AppData/Local/Temp/bird3d"
PARAMS_FILE = os.path.join(os.path.dirname(__file__), "params.json")

# ---------------------------------------------------------------- helpers
def hx(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16) / 255.0, int(h[2:4], 16) / 255.0, int(h[4:6], 16) / 255.0)

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)

_mats = {}
def mat(name, color):
    if name in _mats:
        return _mats[name]
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes.get("Principled BSDF")
    b.inputs["Base Color"].default_value = (*color, 1.0)
    b.inputs["Roughness"].default_value = 0.92
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = 0.1
    _mats[name] = m
    return m

def sphere(name, loc, scale, m, segs=20):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=max(8, segs // 2), location=loc)
    o = bpy.context.object; o.name = name; o.scale = scale
    bpy.ops.object.shade_smooth(); o.data.materials.append(m)
    return o

def shell(name, center, rad, region, color, segs=24):
    """Thin colour shell hugging a sphere of radius `rad` at `center`. Keeps only
    verts where region(x,y,z) is True (unit-sphere coords: +Y fwd, +Z up)."""
    o = sphere(name, center, (rad * 1.012, rad * 1.012, rad * 1.012), mat(name, color), segs)
    me = o.data; bm = bmesh.new(); bm.from_mesh(me)
    for v in list(bm.verts):
        x, y, z = v.co
        if not region(x, y, z):
            bm.verts.remove(v)
    bm.to_mesh(me); bm.free()
    return o

def cone(name, loc, r1, r2, depth, m, rot=(0, 0, 0), segs=12):
    bpy.ops.mesh.primitive_cone_add(vertices=segs, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; bpy.ops.object.shade_smooth(); o.data.materials.append(m)
    return o

def cyl(name, loc, rad, depth, m, rot=(0, 0, 0), segs=8):
    bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=rad, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.data.materials.append(m)
    return o

# ---------------------------------------------------------------- archetypes
# body_scale (x,y,z), head_r, neck, leg, tail, head_up (extra head height),
# head_fwd factor, eye_sz, big_eyes(forward owl eyes)
A = {
    "songbird":  dict(bs=(1.0, 1.15, 1.05), hr=0.85, neck=0.12, leg=0.5,  tail=1.0, up=0.0,  fwd=0.16, eye=0.15, owl=False),
    "plump":     dict(bs=(1.05, 1.28, 1.05), hr=0.68, neck=0.1, leg=0.42, tail=1.25, up=0.0, fwd=0.18, eye=0.12, owl=False),
    "thrush":    dict(bs=(0.95, 1.05, 1.28), hr=0.74, neck=0.28, leg=0.72, tail=1.0, up=0.25, fwd=0.12, eye=0.14, owl=False),
    "corvid":    dict(bs=(1.12, 1.4, 1.12), hr=0.78, neck=0.22, leg=0.55, tail=1.25, up=0.1, fwd=0.16, eye=0.14, owl=False),
    "owl":       dict(bs=(1.15, 1.05, 1.18), hr=1.12, neck=0.02, leg=0.3,  tail=0.5, up=0.0, fwd=0.05, eye=0.28, owl=True),
    "raptor":    dict(bs=(1.0, 1.12, 1.32), hr=0.78, neck=0.16, leg=0.5,  tail=1.1, up=0.3, fwd=0.1, eye=0.16, owl=False),
    "duck":      dict(bs=(1.2, 1.55, 0.92), hr=0.66, neck=0.28, leg=0.16, tail=0.7, up=0.05, fwd=0.22, eye=0.11, owl=False),
    "goose":     dict(bs=(1.12, 1.5, 1.05), hr=0.56, neck=1.25, leg=0.22, tail=0.7, up=0.0, fwd=0.05, eye=0.1, owl=False),
    "wader":     dict(bs=(0.82, 1.0, 1.08), hr=0.48, neck=1.7, leg=1.7,  tail=0.55, up=0.0, fwd=0.04, eye=0.09, owl=False),
    "seabird":   dict(bs=(0.95, 1.2, 1.38), hr=0.76, neck=0.08, leg=0.42, tail=0.55, up=0.3, fwd=0.1, eye=0.13, owl=False),
    "shorebird": dict(bs=(1.0, 1.15, 0.95), hr=0.66, neck=0.2, leg=1.0,  tail=0.55, up=0.05, fwd=0.16, eye=0.16, owl=False),
    "gamebird":  dict(bs=(1.26, 1.42, 1.16), hr=0.52, neck=0.6, leg=0.72, tail=1.25, up=0.1, fwd=0.06, eye=0.1, owl=False),
    "hummer":    dict(bs=(0.58, 0.82, 0.66), hr=0.46, neck=0.04, leg=0.1, tail=0.6, up=0.0, fwd=0.2, eye=0.13, owl=False),
    "swallow":   dict(bs=(0.8, 1.32, 0.78), hr=0.58, neck=0.08, leg=0.18, tail=1.35, up=0.05, fwd=0.16, eye=0.13, owl=False),
}

# region functions (unit sphere coords: +Y forward, +Z up)
REG = {
    "cap_full":  lambda x, y, z: z > -0.35,
    "cap_small": lambda x, y, z: z > 0.2,
    "hood":      lambda x, y, z: z > -0.75,
    "mask":      lambda x, y, z: y > 0.12 and -0.32 < z < 0.34,
    "eyebrow":   lambda x, y, z: y > 0.2 and 0.22 < z < 0.5,
    "cheek":     lambda x, y, z: y > 0.2 and abs(x) > 0.4 and -0.55 < z < 0.18,
    "bib":       lambda x, y, z: y > 0.05 and z < -0.42,
    "throat":    lambda x, y, z: y > 0.2 and z < -0.3 and abs(x) < 0.55,
    "forehead":  lambda x, y, z: y > 0.15 and z > 0.32,
    "nape":      lambda x, y, z: y < -0.2 and z > 0.1,
    "collar":    lambda x, y, z: z < -0.55,
}
BREG = {
    "belly":  lambda x, y, z: y > 0.15 and z < 0.4,
    "breast": lambda x, y, z: y > 0.3 and -0.2 < z < 0.7,
    "barback": lambda x, y, z: y < 0.1 and z > -0.2,
}

# ---------------------------------------------------------------- params
if os.path.exists(PARAMS_FILE):
    PARAMS = json.load(open(PARAMS_FILE, encoding="utf-8"))
else:
    PARAMS = {}
DEFAULT = {
    "arch": "songbird", "body": "#9a8a72", "belly": "#e8dcc6", "wing": "#6f6052",
    "beak": "#3a342e", "beak_type": "cone", "crest": None, "marks": [],
}
P = PARAMS.get(SPECIES, DEFAULT)
ar = A[P.get("arch", "songbird")]

# ---------------------------------------------------------------- build mesh
reset()
parts = []
C_body = mat("body", hx(P["body"]))
C_wing = mat("wing", hx(P["wing"]))
C_beak = mat("beak", hx(P["beak"]))
C_eye = mat("eye", (0.08, 0.07, 0.06))
C_glint = mat("glint", (1, 1, 1))
C_leg = mat("leg", hx(P["beak"]))

bs = tuple(ar["bs"]); hr = ar["hr"]; neck = ar["neck"]; ll = ar["leg"]; tl = ar["tail"]
head = Vector((0, bs[1] * ar["fwd"], bs[2] + hr * 0.5 + neck + ar["up"]))
eye_y = head.y + hr * 0.7
eye_z = head.z + (hr * 0.18 if ar["owl"] else hr * 0.04)
esz = ar["eye"]

# body + belly shell
parts.append((sphere("Body", (0, 0, 0), bs, C_body), "chest"))
parts.append((shell("Belly", (0, 0, 0), max(bs), BREG["belly"], hx(P["belly"]), 26), "chest"))
# neck (if long)
if neck > 0.4:
    nk = cyl("Neck", ((head * 0.5).x, head.y * 0.5, (bs[2] + head.z) * 0.5), hr * 0.42, neck + hr, C_body, segs=12)
    nk.rotation_euler = (math.radians(8), 0, 0)
    parts.append((nk, "neck"))
# head
parts.append((sphere("Head", head, (hr, hr, hr), C_body), "head"))

# eyes (+ glint)
if ar["owl"]:
    ex = hr * 0.34
else:
    ex = hr * 0.45
for sx, grp in ((-1, "eye_L"), (1, "eye_R")):
    parts.append((sphere("Eye_%s" % grp[-1], (sx * ex, eye_y, eye_z), (esz, esz * 0.92, esz), C_eye, 12), grp))
    if ar["owl"]:
        parts.append((sphere("Iris_%s" % grp[-1], (sx * ex, eye_y - 0.02, eye_z), (esz * 1.4, esz * 0.5, esz * 1.4), mat("iris", (0.9, 0.7, 0.2)), 12), grp))
        parts.append((sphere("EyeD_%s" % grp[-1], (sx * ex, eye_y, eye_z), (esz * 0.6, esz * 0.9, esz * 0.6), C_eye, 12), grp))
    parts.append((sphere("Glint_%s" % grp[-1], (sx * ex - sx * esz * 0.3, eye_y + esz * 0.4, eye_z + esz * 0.5), (esz * 0.32, esz * 0.28, esz * 0.32), C_glint, 8), grp))

# beak
bt = P.get("beak_type", "cone")
bbase = Vector((0, head.y + hr * 0.92, eye_z - hr * 0.12))
def beak_cone(length, width, droop=0.0, m=C_beak):
    c = cone("Beak", (bbase.x, bbase.y + length * 0.42, bbase.z - droop * length * 0.4), width, width * 0.08, length, m,
             rot=(math.radians(-90 + droop * 30), 0, 0))
    parts.append((c, "beak_upper"))
    c2 = cone("BeakL", (bbase.x, bbase.y + length * 0.36, bbase.z - width * 0.5 - droop * length * 0.4), width * 0.85, width * 0.07, length * 0.85, m,
              rot=(math.radians(-90 + droop * 30), 0, 0))
    parts.append((c2, "beak_lower"))
BK = {
    "cone": (0.5 * hr, 0.2 * hr, 0), "thin": (0.7 * hr, 0.12 * hr, 0), "stout": (0.45 * hr, 0.24 * hr, 0),
    "chisel": (0.8 * hr, 0.13 * hr, 0), "dagger": (1.5 * hr, 0.16 * hr, 0), "long": (2.0 * hr, 0.12 * hr, 0),
    "decurved": (0.9 * hr, 0.15 * hr, 0.5), "hook": (0.55 * hr, 0.24 * hr, 0.6), "huge": (0.95 * hr, 0.5 * hr, 0.15),
    "spatula": (0.7 * hr, 0.42 * hr, 0.05),
}
bl, bw, droop = BK.get(bt, BK["cone"])
beak_cone(bl, bw, droop)
if bt == "huge":  # puffin – flatten + recolour front
    pass

# wings (swept flattened, hugging the sides)
for sx, grp in ((-1, "wing_L"), (1, "wing_R")):
    w = sphere("Wing_%s" % grp[-1], (sx * bs[0] * 0.96, -bs[1] * 0.08, bs[2] * 0.08), (0.2 * bs[0], 0.66 * bs[1], 0.5 * bs[2]), C_wing)
    w.rotation_euler = (math.radians(6), sx * math.radians(-6), 0)
    parts.append((w, grp))

# tail (flattened wedge)
tail = cone("Tail", (0, -bs[1] - tl * 0.42, bs[2] * 0.04), bs[0] * 0.5, bs[0] * 0.16, tl, C_wing, rot=(math.radians(90), 0, 0))
tail.scale = (1.0, 1.0, 0.32)
parts.append((tail, "tail_base"))

# legs + feet
leg_col = C_leg
for sx, lg, fg in ((-1, "leg_L", "foot_L"), (1, "leg_R", "foot_R")):
    parts.append((cyl("Leg_%s" % lg[-1], (sx * bs[0] * 0.26, bs[1] * 0.06, -bs[2] - ll * 0.5), 0.058, ll, leg_col), lg))
    parts.append((sphere("Foot_%s" % fg[-1], (sx * bs[0] * 0.26, bs[1] * 0.2, -bs[2] - ll), (0.15, 0.22, 0.06), leg_col, 10), fg))

# crest
if P.get("crest"):
    ck = mat("crest", hx(P["crest"]))
    parts.append((cone("Crest", (0, head.y - hr * 0.15, head.z + hr * 0.95), hr * 0.36, 0.01, hr * 1.0, ck, rot=(math.radians(12), 0, 0)), "head"))

# markings (shells)
for mk in P.get("marks", []):
    region, col = mk[0], mk[1]
    if region in REG:
        parts.append((shell("mk_%s" % region, head, hr, REG[region], hx(col), 26), "head"))
    elif region in BREG:
        parts.append((shell("mk_%s" % region, (0, 0, 0), max(bs), BREG[region], hx(col), 26), "chest"))

# assign each part to its bone group, then join
for o, grp in parts:
    bpy.context.view_layer.objects.active = o
    vg = o.vertex_groups.new(name=grp)
    vg.add(range(len(o.data.vertices)), 1.0, "REPLACE")
bpy.ops.object.select_all(action="DESELECT")
for o, _ in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = parts[0][0]
bpy.ops.object.join()
bird = bpy.context.object; bird.name = "Bird_%s" % SPECIES

# ---------------------------------------------------------------- armature
bpy.ops.object.armature_add(location=(0, 0, 0))
arm = bpy.context.object; arm.name = "Rig"; amt = arm.data
bpy.ops.object.mode_set(mode="EDIT")
ebs = amt.edit_bones; ebs.remove(ebs[0])
def bone(name, h, t, parent=None):
    b = ebs.new(name); b.head = Vector(h); b.tail = Vector(t)
    if parent:
        b.parent = ebs[parent]; b.use_connect = False
    return b
bl_ = bl
bz = -bs[2] - ll
bone("root", (0, 0, bz), (0, 0, bz + 0.3))
bone("body", (0, 0, -bs[2] * 0.3), (0, 0, bs[2] * 0.2), "root")
bone("chest", (0, 0, bs[2] * 0.2), (0, 0, bs[2] * 0.7), "body")
bone("neck", (0, head.y * 0.5, bs[2] * 0.7), (0, head.y, head.z - hr * 0.6), "chest")
bone("head", (0, head.y, head.z - hr * 0.5), (0, head.y, head.z + hr * 0.5), "neck")
bone("beak_upper", (0, head.y + hr * 0.85, eye_z), (0, head.y + hr * 0.85 + bl_, eye_z), "head")
bone("beak_lower", (0, head.y + hr * 0.85, eye_z - hr * 0.15), (0, head.y + hr * 0.85 + bl_ * 0.85, eye_z - hr * 0.15), "head")
bone("eye_L", (-ex, eye_y, eye_z), (-ex, eye_y + 0.1, eye_z), "head")
bone("eye_R", (ex, eye_y, eye_z), (ex, eye_y + 0.1, eye_z), "head")
for sx, wl, wt in ((-1, "wing_L", "wingtip_L"), (1, "wing_R", "wingtip_R")):
    bone(wl, (sx * bs[0] * 0.5, 0, bs[2] * 0.15), (sx * bs[0] * 1.0, -bs[1] * 0.1, bs[2] * 0.0), "chest")
    bone(wt, (sx * bs[0] * 1.0, -bs[1] * 0.1, 0), (sx * bs[0] * 1.4, -bs[1] * 0.3, -0.1), wl)
bone("tail_base", (0, -bs[1] * 0.6, bs[2] * 0.05), (0, -bs[1] - tl * 0.5, bs[2] * 0.05), "body")
bone("tail_tip", (0, -bs[1] - tl * 0.5, bs[2] * 0.05), (0, -bs[1] - tl, bs[2] * 0.08), "tail_base")
for sx, lg, ft in ((-1, "leg_L", "foot_L"), (1, "leg_R", "foot_R")):
    bone(lg, (sx * bs[0] * 0.26, bs[1] * 0.05, -bs[2] * 0.2), (sx * bs[0] * 0.26, bs[1] * 0.05, -bs[2] - ll * 0.7), "body")
    bone(ft, (sx * bs[0] * 0.26, bs[1] * 0.05, -bs[2] - ll * 0.7), (sx * bs[0] * 0.26, bs[1] * 0.3, -bs[2] - ll), lg)
bpy.ops.object.mode_set(mode="OBJECT")
bird.parent = arm
md = bird.modifiers.new("Armature", "ARMATURE"); md.object = arm

# ---------------------------------------------------------------- animations
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
for pb in arm.pose.bones:
    pb.rotation_mode = "XYZ"
R = math.radians
def new_action(name):
    act = bpy.data.actions.new(name); arm.animation_data_create(); arm.animation_data.action = act
    return act
def insert(frame, poses):
    for bn, tr in poses.items():
        pb = arm.pose.bones.get(bn)
        if not pb:
            continue
        if "rot" in tr:
            pb.rotation_euler = tr["rot"]; pb.keyframe_insert("rotation_euler", frame=frame)
        if "loc" in tr:
            pb.location = tr["loc"]; pb.keyframe_insert("location", frame=frame)
        if "scale" in tr:
            pb.scale = tr["scale"]; pb.keyframe_insert("scale", frame=frame)
def build(name, frames):
    new_action(name)
    for f, poses in frames:
        insert(f, poses)
    return name
ACT = []
ACT.append(build("idle", [
    (1, {"chest": {"scale": (1, 1, 1)}, "head": {"rot": (0, 0, 0)}, "tail_base": {"rot": (0, 0, 0)}}),
    (30, {"chest": {"scale": (1.04, 1.0, 1.04)}, "head": {"rot": (R(4), 0, R(3))}, "tail_base": {"rot": (R(-4), 0, 0)}}),
    (60, {"chest": {"scale": (1, 1, 1)}, "head": {"rot": (0, 0, 0)}, "tail_base": {"rot": (0, 0, 0)}}),
]))
ACT.append(build("hop", [
    (1, {"root": {"loc": (0, 0, 0)}, "body": {"scale": (1, 1, 1)}, "wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}}),
    (6, {"body": {"scale": (1.1, 1.05, 0.85)}}),
    (12, {"root": {"loc": (0, 0.15, 0.6)}, "body": {"scale": (0.92, 0.95, 1.15)}, "wing_L": {"rot": (0, 0, R(-30))}, "wing_R": {"rot": (0, 0, R(30))}}),
    (20, {"root": {"loc": (0, 0.3, 0)}, "body": {"scale": (1.06, 1.02, 0.95)}}),
    (24, {"root": {"loc": (0, 0.3, 0)}, "body": {"scale": (1, 1, 1)}, "wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}}),
]))
ACT.append(build("peck", [
    (1, {"neck": {"rot": (0, 0, 0)}, "head": {"rot": (0, 0, 0)}, "beak_lower": {"rot": (0, 0, 0)}}),
    (8, {"neck": {"rot": (R(35), 0, 0)}, "head": {"rot": (R(20), 0, 0)}, "beak_lower": {"rot": (R(-14), 0, 0)}}),
    (12, {"neck": {"rot": (R(40), 0, 0)}, "beak_lower": {"rot": (R(-24), 0, 0)}}),
    (18, {"neck": {"rot": (R(35), 0, 0)}, "beak_lower": {"rot": (R(-14), 0, 0)}}),
    (24, {"neck": {"rot": (0, 0, 0)}, "head": {"rot": (0, 0, 0)}, "beak_lower": {"rot": (0, 0, 0)}}),
]))
ACT.append(build("look_around", [
    (1, {"head": {"rot": (0, 0, 0)}, "body": {"rot": (0, 0, 0)}}),
    (18, {"head": {"rot": (0, 0, R(38))}, "body": {"rot": (0, 0, R(6))}}),
    (36, {"head": {"rot": (0, 0, 0)}}),
    (54, {"head": {"rot": (0, 0, R(-38))}, "body": {"rot": (0, 0, R(-6))}}),
    (72, {"head": {"rot": (0, 0, 0)}, "body": {"rot": (0, 0, 0)}}),
]))
ACT.append(build("flap", [
    (1, {"wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}, "wingtip_L": {"rot": (0, 0, 0)}, "wingtip_R": {"rot": (0, 0, 0)}}),
    (5, {"wing_L": {"rot": (R(-15), 0, R(-58))}, "wing_R": {"rot": (R(-15), 0, R(58))}, "wingtip_L": {"rot": (0, 0, R(-25))}, "wingtip_R": {"rot": (0, 0, R(25))}}),
    (11, {"wing_L": {"rot": (R(10), 0, R(35))}, "wing_R": {"rot": (R(10), 0, R(-35))}, "wingtip_L": {"rot": (0, 0, R(20))}, "wingtip_R": {"rot": (0, 0, R(-20))}}),
    (16, {"wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}, "wingtip_L": {"rot": (0, 0, 0)}, "wingtip_R": {"rot": (0, 0, 0)}}),
]))
ACT.append(build("short_fly", [
    (1, {"root": {"loc": (0, 0, 0)}, "wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}}),
    (5, {"root": {"loc": (0, 0, 0.45)}, "wing_L": {"rot": (R(-20), 0, R(-68))}, "wing_R": {"rot": (R(-20), 0, R(68))}}),
    (11, {"root": {"loc": (0, 0, 0.55)}, "wing_L": {"rot": (R(15), 0, R(45))}, "wing_R": {"rot": (R(15), 0, R(-45))}}),
    (16, {"root": {"loc": (0, 0, 0.45)}, "wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}}),
]))
ACT.append(build("sleep", [
    (1, {"neck": {"rot": (R(18), 0, 0)}, "head": {"rot": (R(10), 0, 0)}, "eye_L": {"scale": (1, 1, 0.08)}, "eye_R": {"scale": (1, 1, 0.08)}, "chest": {"scale": (1, 1, 1)}}),
    (40, {"chest": {"scale": (1.03, 1, 1.03)}, "head": {"rot": (R(13), 0, 0)}}),
    (80, {"neck": {"rot": (R(18), 0, 0)}, "head": {"rot": (R(10), 0, 0)}, "eye_L": {"scale": (1, 1, 0.08)}, "eye_R": {"scale": (1, 1, 0.08)}, "chest": {"scale": (1, 1, 1)}}),
]))
ACT.append(build("happy", [
    (1, {"root": {"loc": (0, 0, 0)}, "head": {"rot": (0, 0, 0)}, "wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}}),
    (7, {"root": {"loc": (0, 0, 0.4)}, "head": {"rot": (0, R(8), R(10))}, "wing_L": {"rot": (0, 0, R(-42))}, "wing_R": {"rot": (0, 0, R(42))}}),
    (14, {"root": {"loc": (0, 0, 0)}, "wing_L": {"rot": (0, 0, R(-10))}, "wing_R": {"rot": (0, 0, R(10))}}),
    (20, {"root": {"loc": (0, 0, 0.35)}, "head": {"rot": (0, R(-8), R(-10))}, "wing_L": {"rot": (0, 0, R(-42))}, "wing_R": {"rot": (0, 0, R(42))}}),
    (28, {"root": {"loc": (0, 0, 0)}, "head": {"rot": (0, 0, 0)}, "wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}}),
]))
bpy.ops.object.mode_set(mode="OBJECT")
arm.animation_data.action = None
for name in ACT:
    act = bpy.data.actions[name]
    tr = arm.animation_data.nla_tracks.new(); tr.name = name
    tr.strips.new(name, 1, act)

# ---------------------------------------------------------------- export
out_dir = os.path.join(OUT_ROOT, SPECIES); os.makedirs(out_dir, exist_ok=True)
glb = os.path.join(out_dir, "%s.glb" % SPECIES); blend = os.path.join(out_dir, "%s.blend" % SPECIES)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=False,
                          export_animations=True, export_animation_mode="NLA_TRACKS", export_yup=True, export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=blend)

# ---------------------------------------------------------------- render
os.makedirs(RENDER_DIR, exist_ok=True)
scene = bpy.context.scene
scene.render.engine = "BLENDER_EEVEE_NEXT"
try:
    scene.view_settings.view_transform = "Standard"
except Exception:
    pass
scene.render.film_transparent = True
scene.render.resolution_x = 320; scene.render.resolution_y = 320
world = bpy.data.worlds.new("W"); scene.world = world; world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.93, 0.95, 0.92, 1)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.85
bpy.ops.object.light_add(type="SUN", location=(4, -6, 9)); bpy.context.object.data.energy = 3.2
bpy.ops.object.camera_add(); cam = bpy.context.object; scene.camera = cam; cam.data.lens = 55
target = Vector((0, 0, head.z * 0.42))
def look(az, el, dist):
    a = math.radians(az); e = math.radians(el)
    cam.location = target + Vector((math.cos(e) * math.sin(a), -math.cos(e) * math.cos(a), math.sin(e))) * dist
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
dist = 7.0 + (head.z) * 1.1
FAST = len(argv) > 3 and argv[3] == "fast"
ANGLES = (("q34", 140, 14),) if FAST else (("front", 165, 6), ("q34", 140, 14), ("side", 95, 4))
for label, az, el in ANGLES:
    look(az, el, dist)
    scene.render.filepath = os.path.join(RENDER_DIR, "%s_%s.png" % (SPECIES, label))
    bpy.ops.render.render(write_still=True)
print("DONE", SPECIES, "->", glb)
