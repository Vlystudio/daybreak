# Procedural 3D bird generator for Daybreak / Nest — metaball edition.
#
# The body, neck, head and tail are fused METABALLS -> one smooth continuous
# surface (no "snowman of spheres"). Markings are painted as VERTEX COLOURS on
# that surface (clean regions, no protruding blobs). Shaped beak / wings / tail
# feathers / legs / eyes are added as geometry, the whole thing is auto-skinned
# to a reusable armature with 8 animation clips, and exported as a rigged GLB.
#
#   blender --background --factory-startup --python make_bird.py -- <id> <out_root> <render_dir> [fast]

import bpy, bmesh, sys, os, math, json
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []
SPECIES = argv[0] if len(argv) > 0 else "cedar_waxwing"
OUT_ROOT = argv[1] if len(argv) > 1 else "public/assets/birds3d"
RENDER_DIR = argv[2] if len(argv) > 2 else "C:/Users/benma/AppData/Local/Temp/bird3d"
FAST = len(argv) > 3 and argv[3] == "fast"
PARAMS_FILE = os.path.join(os.path.dirname(__file__), "params.json")

def hx(h):
    h = h.lstrip("#")
    return (int(h[0:2], 16) / 255.0, int(h[2:4], 16) / 255.0, int(h[4:6], 16) / 255.0)

def solid(name, color, rough=0.92):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*color, 1.0); b.inputs["Roughness"].default_value = rough
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = 0.1
    return m

def vcol_mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    nt = m.node_tree; b = nt.nodes["Principled BSDF"]
    b.inputs["Roughness"].default_value = 0.92
    if "Specular IOR Level" in b.inputs:
        b.inputs["Specular IOR Level"].default_value = 0.1
    vc = nt.nodes.new("ShaderNodeVertexColor"); vc.layer_name = "Col"
    nt.links.new(vc.outputs["Color"], b.inputs["Base Color"])
    return m

def sphere(name, loc, scale, m, segs=18):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segs, ring_count=max(8, segs // 2), location=loc)
    o = bpy.context.object; o.name = name; o.scale = scale; bpy.ops.object.shade_smooth(); o.data.materials.append(m)
    return o

def cone(name, loc, r1, r2, depth, m, rot=(0, 0, 0), segs=14):
    bpy.ops.mesh.primitive_cone_add(vertices=segs, radius1=r1, radius2=r2, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; bpy.ops.object.shade_smooth(); o.data.materials.append(m)
    return o

def cyl(name, loc, rad, depth, m, rot=(0, 0, 0), segs=8):
    bpy.ops.mesh.primitive_cylinder_add(vertices=segs, radius=rad, depth=depth, location=loc, rotation=rot)
    o = bpy.context.object; o.name = name; o.data.materials.append(m)
    return o

# ---------------------------------------------------------------- archetypes
A = {
    "songbird":  dict(bs=(0.95, 1.12, 1.02), hr=0.72, neck=0.2, leg=0.5,  tail=1.0, up=0.0, fwd=0.3, eye=0.13, owl=False, nseg=1),
    "plump":     dict(bs=(1.0, 1.25, 1.0), hr=0.6, neck=0.18, leg=0.42, tail=1.25, up=0.0, fwd=0.32, eye=0.11, owl=False, nseg=1),
    "thrush":    dict(bs=(0.9, 1.02, 1.2), hr=0.64, neck=0.4, leg=0.72, tail=1.0, up=0.3, fwd=0.22, eye=0.12, owl=False, nseg=2),
    "corvid":    dict(bs=(1.05, 1.32, 1.05), hr=0.7, neck=0.34, leg=0.55, tail=1.25, up=0.12, fwd=0.28, eye=0.12, owl=False, nseg=2),
    "owl":       dict(bs=(1.08, 1.0, 1.1), hr=0.98, neck=0.05, leg=0.3,  tail=0.5, up=0.0, fwd=0.1, eye=0.24, owl=True, nseg=1),
    "raptor":    dict(bs=(0.95, 1.08, 1.25), hr=0.68, neck=0.28, leg=0.5, tail=1.1, up=0.34, fwd=0.18, eye=0.14, owl=False, nseg=2),
    "duck":      dict(bs=(1.12, 1.5, 0.9), hr=0.58, neck=0.42, leg=0.16, tail=0.7, up=0.08, fwd=0.42, eye=0.1, owl=False, nseg=2),
    "goose":     dict(bs=(1.05, 1.45, 1.0), hr=0.5, neck=1.5, leg=0.22, tail=0.7, up=0.0, fwd=0.1, eye=0.09, owl=False, nseg=5),
    "wader":     dict(bs=(0.8, 0.98, 1.05), hr=0.42, neck=2.0, leg=2.0, tail=0.55, up=0.0, fwd=0.08, eye=0.08, owl=False, nseg=6),
    "seabird":   dict(bs=(0.92, 1.18, 1.32), hr=0.68, neck=0.1, leg=0.42, tail=0.55, up=0.34, fwd=0.18, eye=0.12, owl=False, nseg=1),
    "shorebird": dict(bs=(0.98, 1.12, 0.92), hr=0.62, neck=0.3, leg=1.0, tail=0.55, up=0.08, fwd=0.3, eye=0.15, owl=False, nseg=2),
    "gamebird":  dict(bs=(1.2, 1.38, 1.12), hr=0.46, neck=0.7, leg=0.72, tail=1.25, up=0.12, fwd=0.12, eye=0.09, owl=False, nseg=3),
    "hummer":    dict(bs=(0.55, 0.8, 0.62), hr=0.42, neck=0.06, leg=0.1, tail=0.6, up=0.0, fwd=0.4, eye=0.12, owl=False, nseg=1),
    "swallow":   dict(bs=(0.78, 1.28, 0.74), hr=0.54, neck=0.1, leg=0.18, tail=1.35, up=0.06, fwd=0.32, eye=0.12, owl=False, nseg=1),
}

# vertex-colour regions. head coords are unit-ish (p-head)/hr ; +Y fwd +Z up
HREG = {
    "cap_full": lambda x, y, z: z > -0.3,
    "cap_small": lambda x, y, z: z > 0.25,
    "hood": lambda x, y, z: z > -0.85,
    "mask": lambda x, y, z: y > 0.1 and -0.34 < z < 0.36,
    "eyebrow": lambda x, y, z: y > 0.15 and 0.24 < z < 0.55,
    "cheek": lambda x, y, z: y > 0.15 and abs(x) > 0.38 and -0.6 < z < 0.2,
    "bib": lambda x, y, z: y > 0.0 and z < -0.4,
    "throat": lambda x, y, z: y > 0.15 and z < -0.28 and abs(x) < 0.6,
    "forehead": lambda x, y, z: y > 0.1 and z > 0.34,
    "nape": lambda x, y, z: y < -0.15 and z > 0.05,
    "collar": lambda x, y, z: z < -0.7,
}

# ---------------------------------------------------------------- params
PARAMS = json.load(open(PARAMS_FILE, encoding="utf-8")) if os.path.exists(PARAMS_FILE) else {}
P = PARAMS.get(SPECIES, {"arch": "songbird", "body": "#9a8a72", "belly": "#e8dcc6", "wing": "#6f6052", "beak": "#3a342e", "beak_type": "cone", "crest": None, "marks": []})
ar = A[P.get("arch", "songbird")]
bs = tuple(ar["bs"]); hr = ar["hr"]; neck = ar["neck"]; ll = ar["leg"]; tl = ar["tail"]
head = Vector((0, bs[1] * ar["fwd"], bs[2] + hr * 0.35 + neck + ar["up"]))
eye_y = head.y + hr * 0.72
eye_z = head.z + (hr * 0.22 if ar["owl"] else hr * 0.06)
esz = ar["eye"]
ex = hr * (0.32 if ar["owl"] else 0.42)
body_rgb = hx(P["body"]); belly_rgb = hx(P["belly"])

# ---------------------------------------------------------------- metaball body
bpy.ops.wm.read_factory_settings(use_empty=True)
mb = bpy.data.metaballs.new("Bird"); mb.resolution = 0.10; mb.threshold = 0.62
mbo = bpy.data.objects.new("BodyMB", mb); bpy.context.scene.collection.objects.link(mbo)
def meta(loc, radii, stiff=2.0):
    e = mb.elements.new(type="ELLIPSOID"); e.co = Vector(loc); e.size_x, e.size_y, e.size_z = radii; e.stiffness = stiff
meta((0, 0, 0), (bs[0], bs[1], bs[2]))
meta((0, -bs[1] * 0.85, bs[2] * 0.08), (bs[0] * 0.42, bs[1] * 0.7, bs[2] * 0.3), 1.5)  # tail taper
nstart = Vector((0, head.y * 0.35, bs[2] * 0.5)); nend = Vector((0, head.y, head.z - hr * 0.7))
for i in range(1, ar["nseg"] + 1):
    t = i / (ar["nseg"] + 1); p = nstart.lerp(nend, t)
    meta((p.x, p.y, p.z), (hr * 0.5, hr * 0.5, hr * 0.55), 1.5)
meta((head.x, head.y, head.z), (hr, hr * 0.96, hr))  # head
bpy.context.view_layer.objects.active = mbo; mbo.select_set(True)
bpy.ops.object.convert(target="MESH")
bird = bpy.context.object; bird.name = "Bird_%s" % SPECIES
bpy.ops.object.shade_smooth()

# vertex colours
me = bird.data
ca = me.color_attributes.new(name="Col", type="FLOAT_COLOR", domain="POINT")
neck_z = bs[2] * 0.55
marks = P.get("marks", [])
def color_for(co):
    p = Vector(co)
    if p.z < neck_z + 0.1:  # body zone
        # belly: front-lower
        if p.y > bs[1] * 0.05 and p.z < bs[2] * 0.45:
            return belly_rgb
        # breast mark
        for r, c in marks:
            if r == "breast" and p.y > bs[1] * 0.1 and p.z > -bs[2] * 0.1:
                return hx(c)
        if "barback" in [m[0] for m in marks] and p.y < 0:
            pass
        return body_rgb
    # head zone
    hpx = (p.x) / hr; hpy = (p.y - head.y) / hr; hpz = (p.z - head.z) / hr
    col = body_rgb
    for r, c in marks:
        if r in HREG and HREG[r](hpx, hpy, hpz):
            col = hx(c)
    return col
for i, v in enumerate(me.vertices):
    ca.data[i].color = (*color_for(v.co), 1.0)
bird.data.materials.append(vcol_mat("body"))

parts = [(bird, None)]  # (obj, force_group or None=auto)
C_wing = solid("wing", hx(P["wing"])); C_beak = solid("beak", hx(P["beak"]))
C_eye = solid("eye", (0.07, 0.06, 0.05), 0.4); C_glint = solid("glint", (1, 1, 1), 0.3)
C_leg = solid("leg", hx(P["beak"]))

# eyes
for sx in (-1, 1):
    parts.append((sphere("Eye", (sx * ex, eye_y, eye_z), (esz, esz * 0.9, esz), C_eye, 14), None))
    if ar["owl"]:
        parts.append((sphere("Iris", (sx * ex, eye_y - 0.01, eye_z), (esz * 1.5, esz * 0.5, esz * 1.5), solid("iris", (0.92, 0.72, 0.2)), 14), None))
        parts.append((sphere("Pup", (sx * ex, eye_y, eye_z), (esz * 0.62, esz * 0.85, esz * 0.62), C_eye, 14), None))
    parts.append((sphere("Glint", (sx * ex - sx * esz * 0.3, eye_y + esz * 0.4, eye_z + esz * 0.5), (esz * 0.3, esz * 0.26, esz * 0.3), C_glint, 8), None))

# beak
bt = P.get("beak_type", "cone")
BK = {"cone": (0.55 * hr, 0.22 * hr, 0), "thin": (0.75 * hr, 0.12 * hr, 0), "stout": (0.5 * hr, 0.26 * hr, 0),
      "chisel": (0.85 * hr, 0.13 * hr, 0), "dagger": (1.6 * hr, 0.16 * hr, 0), "long": (2.1 * hr, 0.12 * hr, 0),
      "decurved": (0.95 * hr, 0.15 * hr, 0.5), "hook": (0.6 * hr, 0.26 * hr, 0.6), "huge": (1.0 * hr, 0.52 * hr, 0.15),
      "spatula": (0.75 * hr, 0.44 * hr, 0.05)}
blen, bw, droop = BK.get(bt, BK["cone"])
bb = Vector((0, head.y + hr * 0.86, eye_z - hr * 0.16))
bk = cone("BeakU", (0, bb.y + blen * 0.42, bb.z - droop * blen * 0.35), bw, bw * 0.06, blen, C_beak, rot=(math.radians(-90 + droop * 28), 0, 0))
if bt in ("spatula", "huge"):
    bk.scale = (1.0, 0.5 if bt == "huge" else 0.55, 1.0)
parts.append((bk, "beak_upper"))
parts.append((cone("BeakL", (0, bb.y + blen * 0.36, bb.z - bw * 0.45 - droop * blen * 0.35), bw * 0.82, bw * 0.05, blen * 0.82, C_beak, rot=(math.radians(-90 + droop * 28), 0, 0)), "beak_lower"))

# wings — shaped swept teardrops hugging the body
for sx, grp in ((-1, "wing_L"), (1, "wing_R")):
    w = sphere("Wing", (sx * bs[0] * 0.92, -bs[1] * 0.12, bs[2] * 0.05), (0.16 * bs[0], 0.72 * bs[1], 0.46 * bs[2]), C_wing, 16)
    w.rotation_euler = (math.radians(8), sx * math.radians(-7), sx * math.radians(4))
    parts.append((w, grp))

# tail — flattened fan
tail = cone("Tail", (0, -bs[1] - tl * 0.4, bs[2] * 0.05), bs[0] * 0.55, bs[0] * 0.14, tl, C_wing, rot=(math.radians(90), 0, 0))
tail.scale = (1.0, 1.0, 0.28)
parts.append((tail, "tail_base"))

# legs + feet
for sx, lg, fg in ((-1, "leg_L", "foot_L"), (1, "leg_R", "foot_R")):
    parts.append((cyl("Leg", (sx * bs[0] * 0.24, bs[1] * 0.05, -bs[2] - ll * 0.5), 0.055, ll, C_leg), lg))
    parts.append((sphere("Foot", (sx * bs[0] * 0.24, bs[1] * 0.22, -bs[2] - ll), (0.14, 0.22, 0.05), C_leg, 10), fg))

# crest
if P.get("crest"):
    parts.append((cone("Crest", (0, head.y - hr * 0.1, head.z + hr * 0.92), hr * 0.34, 0.01, hr * 0.95, solid("crest", hx(P["crest"])), rot=(math.radians(12), 0, 0)), "head"))

# ---------------------------------------------------------------- armature
bpy.ops.object.armature_add(location=(0, 0, 0))
arm = bpy.context.object; arm.name = "Rig"; amt = arm.data
bpy.ops.object.mode_set(mode="EDIT"); ebs = amt.edit_bones; ebs.remove(ebs[0])
def bone(name, h, t, parent=None):
    b = ebs.new(name); b.head = Vector(h); b.tail = Vector(t)
    if parent:
        b.parent = ebs[parent]; b.use_connect = False
    return b
bz = -bs[2] - ll
bone("root", (0, 0, bz), (0, 0, bz + 0.3))
bone("body", (0, 0, -bs[2] * 0.3), (0, 0, bs[2] * 0.2), "root")
bone("chest", (0, 0, bs[2] * 0.2), (0, 0, bs[2] * 0.7), "body")
bone("neck", (0, head.y * 0.4, bs[2] * 0.7), (0, head.y, head.z - hr * 0.6), "chest")
bone("head", (0, head.y, head.z - hr * 0.55), (0, head.y, head.z + hr * 0.5), "neck")
bone("beak_upper", (0, head.y + hr * 0.85, eye_z), (0, head.y + hr * 0.85 + blen, eye_z), "head")
bone("beak_lower", (0, head.y + hr * 0.85, eye_z - hr * 0.15), (0, head.y + hr * 0.85 + blen * 0.8, eye_z - hr * 0.15), "head")
bone("eye_L", (-ex, eye_y, eye_z), (-ex, eye_y + 0.1, eye_z), "head")
bone("eye_R", (ex, eye_y, eye_z), (ex, eye_y + 0.1, eye_z), "head")
for sx, wl, wt in ((-1, "wing_L", "wingtip_L"), (1, "wing_R", "wingtip_R")):
    bone(wl, (sx * bs[0] * 0.45, 0, bs[2] * 0.15), (sx * bs[0] * 1.0, -bs[1] * 0.1, bs[2] * 0.0), "chest")
    bone(wt, (sx * bs[0] * 1.0, -bs[1] * 0.1, 0), (sx * bs[0] * 1.4, -bs[1] * 0.35, -0.1), wl)
bone("tail_base", (0, -bs[1] * 0.6, bs[2] * 0.05), (0, -bs[1] - tl * 0.5, bs[2] * 0.05), "body")
bone("tail_tip", (0, -bs[1] - tl * 0.5, bs[2] * 0.05), (0, -bs[1] - tl, bs[2] * 0.08), "tail_base")
for sx, lg, ft in ((-1, "leg_L", "foot_L"), (1, "leg_R", "foot_R")):
    bone(lg, (sx * bs[0] * 0.24, bs[1] * 0.05, -bs[2] * 0.2), (sx * bs[0] * 0.24, bs[1] * 0.05, -bs[2] - ll * 0.7), "body")
    bone(ft, (sx * bs[0] * 0.24, bs[1] * 0.05, -bs[2] - ll * 0.7), (sx * bs[0] * 0.24, bs[1] * 0.3, -bs[2] - ll), lg)
bpy.ops.object.mode_set(mode="OBJECT")

# pre-assign appendage parts to their bone group (weight 1) so they stay crisp;
# body gets auto weights.
for o, grp in parts:
    if grp and o is not bird:
        bpy.context.view_layer.objects.active = o
        vg = o.vertex_groups.new(name=grp); vg.add(range(len(o.data.vertices)), 1.0, "REPLACE")

# join everything into the body mesh
bpy.ops.object.select_all(action="DESELECT")
for o, _ in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = bird
bpy.ops.object.join()

# auto weights for the smooth body; existing appendage groups are preserved
bpy.ops.object.select_all(action="DESELECT")
bird.select_set(True); arm.select_set(True); bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
# decimate to keep the GLB light (the metaball mesh is dense); shade-smooth keeps
# it looking smooth without a poly-quadrupling subdivision pass.
dec = bird.modifiers.new("Decimate", "DECIMATE"); dec.ratio = 0.4

# ---------------------------------------------------------------- animations
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="POSE")
for pb in arm.pose.bones:
    pb.rotation_mode = "XYZ"
R = math.radians
def na(name):
    a = bpy.data.actions.new(name); arm.animation_data_create(); arm.animation_data.action = a; return a
def ins(f, poses):
    for bn, tr in poses.items():
        pb = arm.pose.bones.get(bn)
        if not pb:
            continue
        if "rot" in tr:
            pb.rotation_euler = tr["rot"]; pb.keyframe_insert("rotation_euler", frame=f)
        if "loc" in tr:
            pb.location = tr["loc"]; pb.keyframe_insert("location", frame=f)
        if "scale" in tr:
            pb.scale = tr["scale"]; pb.keyframe_insert("scale", frame=f)
def build(name, frames):
    na(name)
    for f, p in frames:
        ins(f, p)
    return name
ACT = []
ACT.append(build("idle", [(1, {"chest": {"scale": (1, 1, 1)}, "head": {"rot": (0, 0, 0)}, "tail_base": {"rot": (0, 0, 0)}}), (30, {"chest": {"scale": (1.04, 1, 1.04)}, "head": {"rot": (R(4), 0, R(3))}, "tail_base": {"rot": (R(-4), 0, 0)}}), (60, {"chest": {"scale": (1, 1, 1)}, "head": {"rot": (0, 0, 0)}, "tail_base": {"rot": (0, 0, 0)}})]))
ACT.append(build("hop", [(1, {"root": {"loc": (0, 0, 0)}, "body": {"scale": (1, 1, 1)}}), (6, {"body": {"scale": (1.1, 1.05, 0.85)}}), (12, {"root": {"loc": (0, 0.15, 0.6)}, "body": {"scale": (0.92, 0.95, 1.15)}, "wing_L": {"rot": (0, 0, R(-30))}, "wing_R": {"rot": (0, 0, R(30))}}), (20, {"root": {"loc": (0, 0.3, 0)}, "body": {"scale": (1.06, 1.02, 0.95)}}), (24, {"root": {"loc": (0, 0.3, 0)}, "body": {"scale": (1, 1, 1)}, "wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}})]))
ACT.append(build("peck", [(1, {"neck": {"rot": (0, 0, 0)}, "head": {"rot": (0, 0, 0)}}), (8, {"neck": {"rot": (R(35), 0, 0)}, "head": {"rot": (R(20), 0, 0)}}), (12, {"neck": {"rot": (R(42), 0, 0)}}), (18, {"neck": {"rot": (R(35), 0, 0)}}), (24, {"neck": {"rot": (0, 0, 0)}, "head": {"rot": (0, 0, 0)}})]))
ACT.append(build("look_around", [(1, {"head": {"rot": (0, 0, 0)}, "body": {"rot": (0, 0, 0)}}), (18, {"head": {"rot": (0, 0, R(38))}, "body": {"rot": (0, 0, R(6))}}), (36, {"head": {"rot": (0, 0, 0)}}), (54, {"head": {"rot": (0, 0, R(-38))}, "body": {"rot": (0, 0, R(-6))}}), (72, {"head": {"rot": (0, 0, 0)}, "body": {"rot": (0, 0, 0)}})]))
ACT.append(build("flap", [(1, {"wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}}), (5, {"wing_L": {"rot": (R(-15), 0, R(-58))}, "wing_R": {"rot": (R(-15), 0, R(58))}}), (11, {"wing_L": {"rot": (R(10), 0, R(35))}, "wing_R": {"rot": (R(10), 0, R(-35))}}), (16, {"wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}})]))
ACT.append(build("short_fly", [(1, {"root": {"loc": (0, 0, 0)}, "wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}}), (5, {"root": {"loc": (0, 0, 0.45)}, "wing_L": {"rot": (R(-20), 0, R(-68))}, "wing_R": {"rot": (R(-20), 0, R(68))}}), (11, {"root": {"loc": (0, 0, 0.55)}, "wing_L": {"rot": (R(15), 0, R(45))}, "wing_R": {"rot": (R(15), 0, R(-45))}}), (16, {"root": {"loc": (0, 0, 0.45)}, "wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}})]))
ACT.append(build("sleep", [(1, {"neck": {"rot": (R(20), 0, 0)}, "head": {"rot": (R(12), 0, 0)}, "chest": {"scale": (1, 1, 1)}}), (40, {"chest": {"scale": (1.03, 1, 1.03)}, "head": {"rot": (R(15), 0, 0)}}), (80, {"neck": {"rot": (R(20), 0, 0)}, "head": {"rot": (R(12), 0, 0)}, "chest": {"scale": (1, 1, 1)}})]))
ACT.append(build("happy", [(1, {"root": {"loc": (0, 0, 0)}, "head": {"rot": (0, 0, 0)}, "wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}}), (7, {"root": {"loc": (0, 0, 0.4)}, "head": {"rot": (0, R(8), R(10))}, "wing_L": {"rot": (0, 0, R(-42))}, "wing_R": {"rot": (0, 0, R(42))}}), (14, {"root": {"loc": (0, 0, 0)}}), (20, {"root": {"loc": (0, 0, 0.35)}, "head": {"rot": (0, R(-8), R(-10))}, "wing_L": {"rot": (0, 0, R(-42))}, "wing_R": {"rot": (0, 0, R(42))}}), (28, {"root": {"loc": (0, 0, 0)}, "head": {"rot": (0, 0, 0)}, "wing_L": {"rot": (0, 0, 0)}, "wing_R": {"rot": (0, 0, 0)}})]))
bpy.ops.object.mode_set(mode="OBJECT")
arm.animation_data.action = None
for name in ACT:
    tr = arm.animation_data.nla_tracks.new(); tr.name = name; tr.strips.new(name, 1, bpy.data.actions[name])

# ---------------------------------------------------------------- export
out_dir = os.path.join(OUT_ROOT, SPECIES); os.makedirs(out_dir, exist_ok=True)
glb = os.path.join(out_dir, "%s.glb" % SPECIES); blend = os.path.join(out_dir, "%s.blend" % SPECIES)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=False, export_animations=True,
                          export_animation_mode="NLA_TRACKS", export_yup=True, export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=blend)

# ---------------------------------------------------------------- render
os.makedirs(RENDER_DIR, exist_ok=True)
sc = bpy.context.scene; sc.render.engine = "BLENDER_EEVEE_NEXT"
try: sc.view_settings.view_transform = "Standard"
except Exception: pass
sc.render.film_transparent = True; sc.render.resolution_x = 320; sc.render.resolution_y = 320
w = bpy.data.worlds.new("W"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.93, 0.95, 0.92, 1); w.node_tree.nodes["Background"].inputs[1].default_value = 0.85
bpy.ops.object.light_add(type="SUN", location=(4, -6, 9)); bpy.context.object.data.energy = 3.2
bpy.ops.object.camera_add(); cam = bpy.context.object; sc.camera = cam; cam.data.lens = 55
target = Vector((0, 0, head.z * 0.45))
def look(az, el, dist):
    a = math.radians(az); e = math.radians(el)
    cam.location = target + Vector((math.cos(e) * math.sin(a), -math.cos(e) * math.cos(a), math.sin(e))) * dist
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
dist = 7.0 + head.z * 1.2
ANG = (("q34", 140, 14),) if FAST else (("front", 165, 6), ("q34", 140, 14), ("side", 95, 4))
for label, az, el in ANG:
    look(az, el, dist); sc.render.filepath = os.path.join(RENDER_DIR, "%s_%s.png" % (SPECIES, label)); bpy.ops.render.render(write_still=True)
print("DONE", SPECIES)
