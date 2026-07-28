# Quick test: does a metaball body read as a smooth, connected bird (not a
# snowman of separate spheres)?  Builds body+neck+head+tail as fused metaballs,
# converts to mesh, smooths, renders 3 angles.
import bpy, math, os, tempfile
from mathutils import Vector

RENDER_DIR = os.path.join(tempfile.gettempdir(), "bird3d")
bpy.ops.wm.read_factory_settings(use_empty=True)

mb = bpy.data.metaballs.new("Bird")
mb.resolution = 0.12
mb.threshold = 0.6
obj = bpy.data.objects.new("BodyMB", mb)
bpy.context.scene.collection.objects.link(obj)

def meta(loc, radii, stiff=2.0):
    e = mb.elements.new(type="ELLIPSOID")
    e.co = Vector(loc); e.size_x, e.size_y, e.size_z = radii; e.stiffness = stiff

# +Y forward, +Z up.  A perched songbird: plump body, short neck, round head, tail taper.
meta((0, 0.0, 0.0), (0.95, 1.15, 1.05))     # body
meta((0, 0.30, 0.78), (0.5, 0.5, 0.6), 1.6) # neck (bridges body->head)
meta((0, 0.45, 1.35), (0.66, 0.66, 0.66))   # head
meta((0, -1.05, 0.18), (0.38, 0.8, 0.32), 1.4)  # tail base taper

bpy.context.view_layer.objects.active = obj
obj.select_set(True)
bpy.ops.object.convert(target="MESH")
bird = bpy.context.object
bpy.ops.object.shade_smooth()
mod = bird.modifiers.new("Subsurf", "SUBSURF")
mod.levels = 1; mod.render_levels = 2

m = bpy.data.materials.new("body"); m.use_nodes = True
m.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (0.72, 0.6, 0.45, 1)
m.node_tree.nodes["Principled BSDF"].inputs["Roughness"].default_value = 0.9
bird.data.materials.append(m)

# render
os.makedirs(RENDER_DIR, exist_ok=True)
sc = bpy.context.scene
sc.render.engine = "BLENDER_EEVEE_NEXT"
try: sc.view_settings.view_transform = "Standard"
except Exception: pass
sc.render.film_transparent = True
sc.render.resolution_x = 340; sc.render.resolution_y = 340
w = bpy.data.worlds.new("W"); sc.world = w; w.use_nodes = True
w.node_tree.nodes["Background"].inputs[0].default_value = (0.93, 0.95, 0.92, 1)
w.node_tree.nodes["Background"].inputs[1].default_value = 0.85
bpy.ops.object.light_add(type="SUN", location=(4, -6, 9)); bpy.context.object.data.energy = 3.2
bpy.ops.object.camera_add(); cam = bpy.context.object; sc.camera = cam; cam.data.lens = 55
target = Vector((0, 0, 0.6))
def look(az, el, dist):
    a = math.radians(az); e = math.radians(el)
    cam.location = target + Vector((math.cos(e)*math.sin(a), -math.cos(e)*math.cos(a), math.sin(e)))*dist
    cam.rotation_euler = (target - cam.location).to_track_quat("-Z", "Y").to_euler()
for label, az, el in (("mb_front", 165, 6), ("mb_q34", 140, 14), ("mb_side", 95, 4)):
    look(az, el, 7.0)
    sc.render.filepath = os.path.join(RENDER_DIR, "%s.png" % label)
    bpy.ops.render.render(write_still=True)
print("MB DONE")
