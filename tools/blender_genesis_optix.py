"""GENESIS / optional NVIDIA RTX 3090 asset-production benchmark.

Run from the project root with Blender 4.x/5.x installed:
  blender -b -P tools/blender_genesis_optix.py

Produces public/genesis-render.png via Cycles. Prefers NVIDIA OptiX,
falls back to CUDA, and falls back to CPU if GPU access is unavailable.
This is an OFFLINE reference render, not the web renderer. No API server.
"""
import bpy
import math
import os
import random
from mathutils import Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
OUTPUT = os.path.join(ROOT, 'public', 'genesis-render.png')
os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.samples = 96
scene.cycles.use_denoising = True
scene.render.resolution_x = 1920
scene.render.resolution_y = 1080
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.filepath = OUTPUT

# Safely identify devices rather than claiming to use the GPU without checking.
device_label = 'CPU'
try:
    addon = bpy.context.preferences.addons['cycles']
    prefs = addon.preferences
    for backend in ('OPTIX', 'CUDA'):
        try:
            prefs.compute_device_type = backend
            prefs.get_devices()
            devices = [d for d in prefs.devices if d.type in ('OPTIX', 'CUDA')]
            if not devices:
                continue
            for d in prefs.devices:
                d.use = d in devices
            scene.cycles.device = 'GPU'
            device_label = backend + ': ' + ', '.join(d.name for d in devices)
            break
        except Exception:
            continue
except Exception as error:
    print('Cycles GPU configuration unavailable:', error)
if device_label == 'CPU':
    scene.cycles.device = 'CPU'
print('GENESIS render device:', device_label)

world = bpy.data.worlds.new('GENESIS Night Atmosphere') if not bpy.data.worlds else bpy.data.worlds[0]
scene.world = world
world.use_nodes = True
world.node_tree.nodes.get('Background').inputs['Color'].default_value = (.015, .035, .055, 1)
world.node_tree.nodes.get('Background').inputs['Strength'].default_value = .32


def material(name, color, metallic=0.0, roughness=.4, emission=None, intensity=0):
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = (*color, 1)
    mat.use_nodes = True
    node = mat.node_tree.nodes.get('Principled BSDF')
    node.inputs['Base Color'].default_value = (*color, 1)
    node.inputs['Metallic'].default_value = metallic
    node.inputs['Roughness'].default_value = roughness
    if emission:
        node.inputs['Emission Color'].default_value = (*emission, 1)
        node.inputs['Emission Strength'].default_value = intensity
    return mat

stone = material('Obsidian volcanic rock', (.028, .051, .063), .18, .72)
metal = material('Dark titanium frame', (.055, .16, .18), .85, .25)
crystal = material('GENESIS crystal', (.08, .6, .57), .5, .17, (.05, 1, .71), 1.8)
glow = material('Cyan plasma rings', (.3, 1, .75), .15, .18, (.12, .9, .72), 8.0)
embers = material('Life spores', (.16, .7, .53), .12, .35, (.2, 1, .65), 6)

# Terrain platform.
bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=8.8, depth=.9, location=(0,0,-.45))
platform=bpy.context.object;platform.name='GENESIS / Core platform';platform.data.materials.append(stone)
bevel=platform.modifiers.new('machined beveled edge','BEVEL');bevel.width=.32;bevel.segments=3
platform.modifiers.new('weighted normals','WEIGHTED_NORMAL')
for radius, minor, height in [(7.8,.10,.08),(6.4,.04,.14),(4.5,.08,.12)]:
    bpy.ops.mesh.primitive_torus_add(major_radius=radius, minor_radius=minor, location=(0,0,height))
    obj=bpy.context.object;obj.name='GENESIS / luminous perimeter';obj.data.materials.append(glow)

bpy.ops.mesh.primitive_cylinder_add(vertices=10,radius=1.35,depth=3.4,location=(0,0,2))
bpy.context.object.data.materials.append(metal)
bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=2.45,location=(0,0,6.0))
core=bpy.context.object;core.name='GENESIS / floating reactor';core.data.materials.append(crystal)
core.rotation_euler=(.22,.25,.13)
for rotation in [(1.0,0,.24),(.35,.45,.3),(.20,1.1,.8)]:
    bpy.ops.mesh.primitive_torus_add(major_radius=3.6,minor_radius=.053,location=(0,0,6.0),rotation=rotation)
    bpy.context.object.data.materials.append(glow)

random.seed(4403)
for i in range(100):
    angle=random.random()*math.tau
    radius=9+random.random()*13
    x=math.cos(angle)*radius;y=math.sin(angle)*radius
    size=.04+random.random()*.14
    z=.1+random.random()*2.6
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=0,radius=size,location=(x,y,z))
    bpy.context.object.data.materials.append(embers)

# Stone silhouette: enough environmental context without thousands of polygons.
for i in range(43):
    a=random.random()*math.tau
    r=10+random.random()*14
    h=.25+random.random()*2.2
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=(math.cos(a)*r, math.sin(a)*r, .1))
    obj=bpy.context.object
    obj.scale=(.4+random.random()*1.3,.4+random.random()*1.4,h)
    obj.rotation_euler=(random.random()*.2,random.random()*.2,random.random()*math.tau)
    obj.data.materials.append(stone)


def area(name, xyz, power, color, size):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.color=color;data.shape='DISK';data.size=size
    obj=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(obj);obj.location=xyz
    direction=Vector((0,0,4))-obj.location;obj.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
area('Key cyan', (5,-5,15),2200,(.38,1,.91),11)
area('Rim violet', (-8,5,13),1600,(.42,.42,1),13)
area('Warm horizon', (0,12,7),1300,(1,.58,.31),9)

bpy.ops.object.camera_add(location=(22,-28,16))
cam=bpy.context.object;scene.camera=cam
look=Vector((0,0,4.0));direction=look-cam.location
cam.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
cam.data.type='PERSP';cam.data.lens=40
scene.view_settings.view_transform='AgX'
print('Rendering reference scene to', OUTPUT)
bpy.ops.render.render(write_still=True)
print('Success:', OUTPUT)
