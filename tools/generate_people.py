#!/usr/bin/env python3
"""Original EON pedestrians, generated offline as lightweight glTF assets.
No third-party model files are bundled. Stylized anatomically articulated meshes,
not scans or photorealistic human models.
"""
from pathlib import Path
import numpy as np
import trimesh
from trimesh.transformations import translation_matrix

ROOT = Path(__file__).resolve().parents[1] / 'public' / 'assets' / 'people'
ROOT.mkdir(parents=True, exist_ok=True)

PALETTES = [
    {'skin':'#bf9277', 'coat':'#354a54','shirt':'#e1d9cb','pants':'#333d4b','shoes':'#24272c','hair':'#30261f'},
    {'skin':'#d6ae90', 'coat':'#b78c6e','shirt':'#f2e5d8','pants':'#55576b','shoes':'#463a33','hair':'#4a3225'},
    {'skin':'#8d6048', 'coat':'#5a766d','shirt':'#d2d7cb','pants':'#242f35','shoes':'#1f2327','hair':'#171b1b'},
    {'skin':'#e2bca2', 'coat':'#707c93','shirt':'#e6e8e3','pants':'#5d665b','shoes':'#302d2b','hair':'#6a5140'},
    {'skin':'#ae7b63', 'coat':'#935f53','shirt':'#ede2c9','pants':'#394450','shoes':'#25272b','hair':'#24272a'},
    {'skin':'#d1a58d', 'coat':'#63705d','shirt':'#d4b99e','pants':'#4b4640','shoes':'#24282b','hair':'#27211f'},
]

def rgba(hexcode):
    h = hexcode.lstrip('#')
    return np.array([int(h[i:i+2],16) for i in (0,2,4)] + [255], dtype=np.uint8)

def ellipsoid(pos, dims, color, sub=2):
    mesh=trimesh.creation.icosphere(subdivisions=sub, radius=1)
    mesh.vertices = mesh.vertices * np.array(dims) + np.array(pos)
    mesh.visual.vertex_colors = np.tile(rgba(color), (len(mesh.vertices),1))
    return mesh

def cylinder_between(a, b, radius, color, sections=10):
    a=np.asarray(a); b=np.asarray(b)
    mesh=trimesh.creation.cylinder(radius=radius, height=float(np.linalg.norm(b-a)), sections=sections)
    mesh.apply_transform(trimesh.geometry.align_vectors([0,0,1], b-a))
    mesh.apply_translation((a+b)*0.5)
    mesh.visual.vertex_colors=np.tile(rgba(color),(len(mesh.vertices),1))
    return mesh

def loft(rings, color, sides=12):
    """Elliptical loft for human garment silhouettes; rings=(y, half_width, half_depth, center_z)."""
    v=[]; f=[]
    for y,w,d,z in rings:
        for j in range(sides):
            theta=2*np.pi*j/sides
            v.append([np.cos(theta)*w, y, z+np.sin(theta)*d])
    for i in range(len(rings)-1):
        for j in range(sides):
            a=i*sides+j; b=i*sides+(j+1)%sides; c=(i+1)*sides+j; d=(i+1)*sides+(j+1)%sides
            if rings[1][0] > rings[0][0]: f.extend([[a,c,b],[b,c,d]])
            else: f.extend([[a,b,c],[b,d,c]])
    for j in range(1,sides-1):
        f.append([0,j+1,j])
        f.append([(len(rings)-1)*sides, (len(rings)-1)*sides+j, (len(rings)-1)*sides+j+1])
    mesh=trimesh.Trimesh(vertices=v,faces=f,process=False)
    mesh.visual.vertex_colors=np.tile(rgba(color),(len(mesh.vertices),1))
    return mesh

def box(pos, ext, color):
    mesh=trimesh.creation.box(extents=ext)
    mesh.apply_translation(pos)
    mesh.visual.vertex_colors=np.tile(rgba(color),(len(mesh.vertices),1))
    return mesh

def merge(items):
    return trimesh.util.concatenate(items)

for variant,p in enumerate(PALETTES):
    scene=trimesh.Scene()
    # Anatomically proportioned, separate articulated parts; glTF node names are animation targets.
    torso=[loft([(0.96,.26,.14,0),(1.10,.29,.17,0),(1.35,.32,.19,0),(1.55,.39,.20,0),(1.62,.28,.16,0)],p['coat'])]
    torso += [loft([(1.39,.115,.015,.191),(1.53,.125,.015,.185),(1.62,.07,.015,.12)],p['shirt'])]
    torso += [ellipsoid((0,1.66,0),(.083,.10,.082),p['skin'],1)]
    # coat seam, buttons, belt buckle
    torso += [box((0,1.26,.193),(.012,.52,.015),'#b4b4ab'),box((0,1.02,.153),(.53,.045,.04),'#242a2e')]
    for yy in [1.11,1.22,1.33]:torso.append(ellipsoid((.018,yy,.205),(.013,.013,.009),'#d1c4ad',1))
    scene.add_geometry(merge(torso),node_name='torso',geom_name='torso')
    # Head: ears, nose, eye sockets, eyebrows and individual hair clumps.
    head=[ellipsoid((0,0.02,0),(.142,.188,.125),p['skin'],3),
          ellipsoid((-.143,.012,0),(.026,.048,.024),p['skin'],2),
          ellipsoid((.143,.012,0),(.026,.048,.024),p['skin'],2),
          ellipsoid((0,-.012,.128),(.027,.051,.035),p['skin'],2)]
    for s in [-1,1]:
        head.append(ellipsoid((s*.058,.035,.116),(.021,.013,.009),'#272d31',2))
        head.append(ellipsoid((s*.059,.060,.115),(.040,.009,.012),p['hair'],1))
    head.append(ellipsoid((0,-.091,.118),(.043,.008,.009),'#784f48',1))
    head.append(ellipsoid((0,.165,-.015),(.143,.065,.13),p['hair'],2))
    if variant in [0,2,4]:
        head += [ellipsoid((-.115,.084,-.015),(.038,.075,.11),p['hair'],2),ellipsoid((.115,.084,-.015),(.038,.075,.11),p['hair'],2)]
    elif variant in [1,3]:
        head += [ellipsoid((0,-.02,-.125),(.145,.17,.052),p['hair'],2)]
    scene.add_geometry(merge(head),node_name='head',geom_name='head',transform=translation_matrix([0,1.84,0]))
    # Legs pivot at hips, swing around X while walking; trouser knees and separate shoes.
    for s, name in [(-1,'leg_L'),(1,'leg_R')]:
        leg=[loft([(0,.107,.11,0),(-.19,.115,.112,0),(-.47,.095,.102,0),(-.78,.084,.082,0)],p['pants'])]
        for m in leg: m.apply_translation([s*.155,0,0])
        leg.append(ellipsoid((s*.155,-.77,0),(.087,.105,.09),p['pants'],2))
        leg.append(ellipsoid((s*.155,-.9,.085),(.108,.07,.18),p['shoes'],2))
        scene.add_geometry(merge(leg),node_name=name,geom_name=name,transform=translation_matrix([0,.99,0]))
    # Sleeves + cuffs + hands as distinct swingable arms.
    for s, name in [(-1,'arm_L'),(1,'arm_R')]:
        arm=[cylinder_between([s*.37,-.06,0],[s*.41,-.37,.005],.112,p['coat'],12),
             ellipsoid((s*.41,-.37,.005),(.102,.115,.105),p['coat'],2),
             cylinder_between([s*.41,-.40,.005],[s*.41,-.60,.022],.078,p['coat'],12),
             ellipsoid((s*.41,-.65,.032),(.076,.105,.071),p['skin'],2)]
        scene.add_geometry(merge(arm),node_name=name,geom_name=name,transform=translation_matrix([0,1.55,0]))
    out=ROOT/f'pedestrian-{variant+1}.glb'
    out.write_bytes(scene.export(file_type='glb'))
    loaded=trimesh.load(out,force='scene')
    assert all(n in loaded.graph.nodes for n in ['torso','head','leg_L','leg_R','arm_L','arm_R'])
    print(out.name,out.stat().st_size,'bytes',len(loaded.geometry),'meshes')
