#!/usr/bin/env python3
"""Generate five ORIGINAL EON vehicle GLBs for offline bundling.

No third-party car meshes, brands, trademarks, or remote downloads are used.
The body is lofted from cross sections; cabins have sloping glazing and
separate wheel nodes so the frontend can animate wheel rotation.

Requires Python packages trimesh, numpy (only to regenerate the included GLBs).
"""
from pathlib import Path
import math
import numpy as np
import trimesh
from trimesh.transformations import translation_matrix, rotation_matrix

OUT = Path(__file__).resolve().parents[1] / 'public/assets/vehicles'
OUT.mkdir(parents=True, exist_ok=True)

def rgba(hexcode):
    h = hexcode.lstrip('#')
    return np.array([int(h[i:i+2], 16) for i in (0, 2, 4)] + [255], dtype=np.uint8)

def box(pos, ext, color='#ffffff'):
    mesh=trimesh.creation.box(extents=ext)
    mesh.apply_translation(pos)
    mesh.visual.vertex_colors=np.tile(rgba(color),(len(mesh.vertices),1))
    return mesh

def polygon(points, color='#ffffff', thickness=.006):
    """Double-sided thin polygon (for glazed windows), in arbitrary 3D plane."""
    v=np.array(points,dtype=float)
    verts=np.vstack((v, v+np.array([0,thickness,0])))
    n=len(v)
    faces=[]
    for j in range(1,n-1):
        faces.extend(([0,j,j+1],[n,n+j+1,n+j]))
    for j in range(n):
        k=(j+1)%n
        faces.extend(([j,k,n+k],[j,n+k,n+j]))
    mesh=trimesh.Trimesh(vertices=verts,faces=faces,process=False)
    mesh.visual.vertex_colors=np.tile(rgba(color),(len(mesh.vertices),1))
    return mesh

def loft_z(sections,color):
    """8-point beveled rectangular rings (z, halfwidth, bottomY, topY)."""
    v=[];f=[]
    for z,w,low,high in sections:
        for x,y in [(-w*.83,low),(w*.83,low),(w,low+.13),(w,high-.16),
                    (w*.86,high),(-w*.86,high),(-w,high-.16),(-w,low+.13)]:
            v.append([x,y,z])
    n=8
    for i in range(len(sections)-1):
        for j in range(n):
            a=i*n+j;b=i*n+(j+1)%n;c=(i+1)*n+j;d=(i+1)*n+(j+1)%n
            f.extend(([a,b,c],[b,d,c]))
    for j in range(1,n-1):
        f.extend(([0,j+1,j],[(len(sections)-1)*n,(len(sections)-1)*n+j,(len(sections)-1)*n+j+1]))
    m=trimesh.Trimesh(vertices=v,faces=f,process=False)
    m.fix_normals()
    m.visual.vertex_colors=np.tile(rgba(color),(len(m.vertices),1))
    return m

def tire_mesh(radius=.38, width=.23):
    """One vertex-colored glTF mesh per wheel; local rotation around X axis."""
    black=trimesh.creation.cylinder(radius=radius,height=width,sections=22)
    black.apply_transform(rotation_matrix(math.pi/2,[0,1,0]))
    black.visual.vertex_colors=np.tile(rgba('#151a1e'),(len(black.vertices),1))
    parts=[black]
    for s in [-1,1]:
        x=s*(width/2+.012)
        rim=trimesh.creation.cylinder(radius=radius*.65,height=.026,sections=18)
        rim.apply_transform(rotation_matrix(math.pi/2,[0,1,0]));rim.apply_translation([x,0,0])
        rim.visual.vertex_colors=np.tile(rgba('#a6b1b8'),(len(rim.vertices),1))
        parts.append(rim)
        hub=trimesh.creation.cylinder(radius=radius*.22,height=.033,sections=14)
        hub.apply_transform(rotation_matrix(math.pi/2,[0,1,0]));hub.apply_translation([x+s*.015,0,0])
        hub.visual.vertex_colors=np.tile(rgba('#39434a'),(len(hub.vertices),1))
        parts.append(hub)
        for j in range(5):
            theta=2*math.pi*j/5
            spoke=box([x+s*.020, math.cos(theta)*radius*.38, math.sin(theta)*radius*.38],
                      [.018,.055,.18], '#dce2df')
            # spokes are small accents; tire still reads as circular at distance
            parts.append(spoke)
    return trimesh.util.concatenate(parts)

def add_group(scene, parts, name, metal=0, rough=.5):
    if not parts:return
    mesh=trimesh.util.concatenate(parts)
    # Vertex colors encode the original color; PBR retains specular response.
    scene.add_geometry(mesh,geom_name=name,node_name=name)

CARS = {
  'sedan': dict(w=1.87,L=4.52,low=.35,hood=1.02,roof=1.62,front=.93,rear=-1.37,topFront=.43,topRear=-.93, radius=.37, axles=[-1.43,1.35]),
  'suv': dict(w=2.07,L=4.85,low=.40,hood=1.16,roof=1.92,front=1.14,rear=-1.56,topFront=.82,topRear=-1.26, radius=.43, axles=[-1.55,1.53]),
  'hatchback': dict(w=1.78,L=3.98,low=.34,hood=1.02,roof=1.57,front=.88,rear=-1.57,topFront=.35,topRear=-1.24, radius=.35, axles=[-1.30,1.22]),
  'van': dict(w=2.12,L=5.28,low=.42,hood=1.16,roof=2.48,front=2.06,rear=-2.31,topFront=1.75,topRear=-2.12, radius=.42, axles=[-1.77,1.66]),
  'bus': dict(w=2.53,L=9.65,low=.48,hood=2.93,roof=3.10,front=4.42,rear=-4.43,topFront=4.20,topRear=-4.20, radius=.49, axles=[-3.55,-2.18,3.18]),
}

for name,c in CARS.items():
    w,L=c['w'],c['L'];hw=w/2;end=L/2; low=c['low'];hood=c['hood'];roof=c['roof']
    is_bus=name=='bus'; is_van=name=='van'; tall=is_bus or is_van
    scene=trimesh.Scene(); paint=[];glass=[];trim=[];white=[];red=[];amber=[];alloy=[]
    if is_bus:
        body_sections=[(-end,.96*hw,low,2.86),(-end+.22,hw,low,hood),
                       (-end+1,hw,low,hood),(end-1,hw,low,hood),(end-.18,hw,low,hood),(end,.94*hw,low,2.82)]
    else:
        body_sections=[(-end,.85*hw,low,hood-.12),(-end+.18,.98*hw,low,hood),
                       (-end+.67,hw,low,hood),(end-.65,hw,low,hood),
                       (end-.18,.98*hw,low,hood),(end,.84*hw,low,hood-.10)]
    paint.append(loft_z(body_sections,'#dce1e0'))
    if not is_bus:
        cabin=loft_z([(c['rear'],hw*.88,hood-.12,hood+.02),
                      (c['topRear'],hw*.84,hood-.1,roof),
                      (c['topFront'],hw*.84,hood-.1,roof),
                      (c['front'],hw*.89,hood-.12,hood+.04)],'#dce1e0')
        paint.append(cabin)
        # Glass panels are actual planar surfaces on the sloped cabin, not cuboid blocks.
        for s in [-1,1]:
            x=s*(hw*.88+.012)
            z1,z2=c['topRear']+.08,c['topFront']-.08
            glass.append(polygon([(x,hood+.12,z1),(x,roof-.16,z1+.08),
                                  (x,roof-.16,z2-.06),(x,hood+.12,z2)],'#456579'))
            # pillar between front/rear side windows
            trim.append(box([x+s*.009,(hood+roof)/2,(z1+z2)*.5], [.026,roof-hood-.06,.046],'#2b343a'))
        xw=hw*.70
        glass.append(polygon([(-xw,hood+.13,c['front']-.028),(xw,hood+.13,c['front']-.028),
                              (xw*.93,roof-.16,c['topFront']+.02),(-xw*.93,roof-.16,c['topFront']+.02)],'#42657b'))
        glass.append(polygon([(-xw,hood+.12,c['rear']+.025),(-xw*.93,roof-.16,c['topRear']-.02),
                              (xw*.93,roof-.16,c['topRear']-.02),(xw,hood+.12,c['rear']+.025)],'#42657b'))
        for s in [-1,1]:
            x=s*(hw+.025)
            # Door panel seams, handles, wing mirrors and side indicators.
            for z in [-(L*.19),.16]:
                trim.append(box([x,.79,z],[.016,.44,.014],'#30383b'))
                alloy.append(box([x+s*.025,1.0,z+.28],[.065,.035,.18],'#bdc6c9'))
            trim.append(box([s*(hw+.14),hood+.08,c['front']-.05],[.22,.12,.29],'#273239'))
            amber.append(box([x,.85,end-.49],[.02,.06,.12],'#e7a756'))
        if name in ('suv','van'):
            # Black wheel arch protectors and roof rails.
            for s in [-1,1]:
                for zz in c['axles']:
                    trim.append(box([s*(hw+.02),.53,zz],[.025,.17,.93],'#22282b'))
                paint.append(box([s*(hw*.71),roof+.045,(c['topRear']+c['topFront'])/2], [.045,.06,c['topFront']-c['topRear']-.08],'#abb5b5'))
    else:
        # Bus: separate dark tinted window modules and side doors.
        for s in [-1,1]:
            x=s*(hw+.015)
            for i in range(9):
                z=-3.9+i*.93
                if s>0 and i in (5,6):continue  # passenger door on right side
                glass.append(box([x,2.18,z],[.022,.95,.79],'#315467'))
                trim.append(box([x,2.17,z+.425],[.03,1.08,.042],'#bdc4bf'))
            # Door frame + two glass panes
            if s>0:
                for zz in [1.08,1.87]:
                    glass.append(box([x,1.55,zz],[.024,1.95,.58],'#426a7b'))
                    trim.append(box([x,1.54,zz+.32],[.045,2.05,.055],'#c3d1cd'))
                trim.append(box([x,.63,1.50],[.026,.15,1.8],'#323b3d'))
            paint.append(box([x,1.14,0],[.04,.13,L-.5],'#d0a45d'))
        glass.append(box([0,2.19,end+.01],[w*.82,1.20,.025],'#345c72'))
        glass.append(box([0,2.20,-end-.01],[w*.82,1.18,.025],'#345c72'))
        trim.append(box([0,2.89,end+.022],[1.72,.23,.04],'#1b292e'))
        paint.append(box([0,3.02,0],[w*.87,.12,L*.95],'#dce1e0'))
        for s in [-1,1]:
            trim.append(box([s*(hw+.13),2.45,end-.3],[.2,.25,.27],'#242b30'))
        # Articulated appearance without articulated physics: long bus silhouette.
    # front and rear bumpers, license plates, grille, lamps, reflectors
    for s in [-1,1]:
        x=s*hw*.64
        white.append(box([x,hood-.18,end+.04],[w*.18,.17,.085],'#fff3d4'))
        red.append(box([x,hood-.15,-end-.04],[w*.20,.16,.085],'#e73c34'))
        amber.append(box([s*hw*.87,hood-.22,end+.03],[.10,.10,.09],'#f6b35a'))
    trim.append(box([0,low+.16,end+.055],[w*.58,.22,.085],'#232d33'))
    trim.append(box([0,low+.15,-end-.055],[w*.55,.19,.085],'#343a3e'))
    alloy.append(box([0,low+.22,end+.105],[.54,.11,.025],'#e1e1da'))
    alloy.append(box([0,low+.22,-end-.105],[.52,.11,.025],'#e1e1da'))
    for s in [-1,1]:
        trim.append(box([s*hw*.72,low+.055,end-.14],[.19,.09,.16],'#262c31'))
        trim.append(box([s*hw*.72,low+.055,-end+.14],[.19,.09,.16],'#262c31'))
    for n, parts in [('paint',paint),('glass',glass),('trim',trim),('headlights',white),('taillights',red),('indicators',amber),('metal',alloy)]:
        add_group(scene,parts,n)
    # Named wheel nodes: wheel rotation can be driven by Three.js.
    for a,z in enumerate(c['axles']):
        for s,side in [(-1,'L'),(1,'R')]:
            tire=tire_mesh(c['radius'],.22 if not is_bus else .27)
            wheel_x=s*(hw-.045)
            node=f'wheel_{a}_{side}'
            scene.add_geometry(tire,geom_name=node,node_name=node,
                               transform=translation_matrix([wheel_x,c['radius']+.025,z]))
    path=OUT/f'{name}.glb';path.write_bytes(scene.export(file_type='glb',include_normals=True))
    loaded=trimesh.load(path,force='scene')
    assert 'paint' in loaded.graph.nodes and 'glass' in loaded.graph.nodes
    assert any(n.startswith('wheel_') for n in loaded.graph.nodes)
    assert path.stat().st_size < 2_000_000
    print(f'{name}: {path.stat().st_size:,} bytes, {len(loaded.geometry)} meshes, {len(loaded.graph.nodes)} nodes')
