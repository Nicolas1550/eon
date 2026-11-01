"""Create original textured tree glTF assets for EON. No third-party models or textures.
Branches are tapered meshes; foliage uses thousands of individually placed alpha-masked leaf cards.
"""
from pathlib import Path
import math, random, numpy as np
from PIL import Image, ImageDraw, ImageFilter
import trimesh
from trimesh.visual.texture import TextureVisuals
from trimesh.visual.material import PBRMaterial

ROOT=Path(__file__).resolve().parents[1] / 'public' / 'assets' / 'trees'
ROOT.mkdir(parents=True,exist_ok=True)

# Original leaf texture: soft-edge botanical blade with veins, not a geometric canopy.
S=256
img=Image.new('RGBA',(S,S),(0,0,0,0))
px=img.load()
for y in range(S):
    v=1-y/(S-1)
    for x in range(S):
        u=(x/(S-1)-0.5)*2
        # leaf has pointed tip and narrowing stem, gentle lobes
        width=(max(0,math.sin(math.pi*v))**0.67)*(0.80+0.09*math.sin(7*v*math.pi))
        inside=abs(u)<width
        if inside:
            edge=max(0,min(1,(width-abs(u))*55))
            light=0.85+0.14*math.sin(v*10+u*2)
            center=1-min(1,abs(u)*5)
            vein=(max(0,1-abs(u)*33) + max(0,1-abs((v*8+u*4)%1-0.5)*15)*0.16)
            r=int((69+36*v+30*center+24*vein)*light)
            g=int((119+37*v+18*center+30*vein)*light)
            b=int((43+18*v+8*vein)*light)
            px[x,y]=(min(255,r),min(255,g),min(255,b),int(255*edge))
img.save(ROOT/'eon_leaf.png', optimize=True)

# Bark texture, rough cracked and organic, original procedurally generated.
rng=random.Random(5123)
bark=Image.new('RGB',(256,512),(93,75,57)); d=ImageDraw.Draw(bark,'RGB')
for i in range(1600):
    x=rng.randrange(256);y=rng.randrange(512)
    val=rng.randint(-25,25)
    base=(max(15,95+val),max(14,74+val),max(12,56+val))
    d.line([(x,y),(x+rng.randint(-3,3),y+rng.randint(4,32))],fill=base,width=rng.randint(1,3))
for i in range(230):
    x=rng.randrange(256);y=rng.randrange(512)
    d.line([(x,y),(x+rng.randint(-2,2),y+rng.randint(7,43))],fill=(48,41,32),width=1)
bark=bark.filter(ImageFilter.GaussianBlur(0.32))
bark.save(ROOT/'eon_bark.jpg',quality=88)

BARKMAT=PBRMaterial(name='eon_original_bark',baseColorTexture=bark,baseColorFactor=[255,255,255,255],metallicFactor=0,roughnessFactor=0.98,doubleSided=False)
LEAFMAT=PBRMaterial(name='eon_original_leaf',baseColorTexture=img,baseColorFactor=[255,255,255,255],metallicFactor=0,roughnessFactor=0.92,alphaMode='MASK',alphaCutoff=0.28,doubleSided=True)


def basis(direction):
    w=np.array(direction,dtype=float);w/=np.linalg.norm(w)
    ref=np.array([0,1,0],dtype=float) if abs(w[1])<0.94 else np.array([1,0,0],dtype=float)
    u=np.cross(w,ref);u/=np.linalg.norm(u)
    v=np.cross(w,u)
    return u,v


def tree(seed:int,shape:str,detail:bool):
    random=random_module.Random(seed)
    verts=[]; faces=[]; uvs=[]
    def branch(a,b,r0,r1,sides=7):
        nonlocal verts,faces,uvs
        a=np.array(a,dtype=float);b=np.array(b,dtype=float)
        delta=b-a
        if np.linalg.norm(delta)<1e-5: return
        u,v=basis(delta)
        start=len(verts)
        for k in range(sides+1):
            angle=2*math.pi*k/sides
            offset=u*math.cos(angle)+v*math.sin(angle)
            verts.extend([a+offset*r0,b+offset*r1]);uvs.extend([(k/sides,0),(k/sides,min(1.0,np.linalg.norm(delta)/3))])
        for k in range(sides):
            p=start+2*k
            faces.extend([(p,p+1,p+2),(p+1,p+3,p+2)])
    # tapered main trunk, slight lean, taper with height
    trunkH=4.8 if shape!='birch' else 5.3
    prev=np.array([0.,0.,0.])
    for k in range(1,11):
        t=k/10
        p=np.array([math.sin(t*1.7+seed)*0.13*t,trunkH*t,math.sin(t*2.3+seed)*0.11*t])
        branch(prev,p,0.37*(1-(k-1)/13),0.37*(1-k/13),9)
        prev=p
    terminals=[]
    nmain={'maple':13,'oak':16,'birch':11}[shape]
    for i in range(nmain):
        y=2.5+(i/nmain)*2.3+random.uniform(-0.12,0.12)
        theta=i*2.399+random.uniform(-0.4,0.4)
        length=random.uniform(2.3,3.7)*(0.88 if shape=='birch' else 1)
        rise=random.uniform(1.1,2.8)*(1.25 if shape=='birch' else 1)
        p0=np.array([0.1*math.sin(y),y,0.1*math.cos(y)])
        p1=p0+np.array([math.cos(theta)*length*0.55,rise*0.45,math.sin(theta)*length*0.55])
        p2=p0+np.array([math.cos(theta)*length,rise,math.sin(theta)*length])
        branch(p0,p1,0.135,0.085,7)
        branch(p1,p2,0.085,0.038,6)
        for j in range(3):
            ang=theta+random.uniform(-1.15,1.15)
            s=p1+(p2-p1)*(0.32+j*0.23)
            tip=s+np.array([math.cos(ang)*random.uniform(0.7,1.45),random.uniform(0.35,1.4),math.sin(ang)*random.uniform(0.7,1.45)])
            branch(s,tip,0.047,0.011,5)
            terminals.append(tip)
    # Crown center twigs, no smooth spheres or cone foliage
    for i in range(13):
        theta=random.random()*math.tau
        y=4.1+random.random()*1.0
        start=np.array([0.03,y,0.03])
        tip=np.array([math.cos(theta)*random.uniform(0.5,2.3),random.uniform(6.5,9.2),math.sin(theta)*random.uniform(0.5,2.3)])
        branch(start,tip,0.067,0.014,5)
        terminals.append(tip)
    leafverts=[]; leaffaces=[]; leafuv=[]
    per_terminal=(34 if detail else 7)
    for ti,p in enumerate(terminals):
        for j in range(per_terminal):
            jitter=np.array([random.gauss(0,0.65),random.gauss(0,0.46),random.gauss(0,0.65)])
            q=p+jitter
            if shape=='birch':q[1]+=random.uniform(-0.65,0.2)
            scale=random.uniform(0.27,0.48) * (0.85 if shape=='birch' else 1)
            # leaf blades rotate independently in 3D, not a cluster of spheres
            direction=np.array([random.uniform(-1,1),random.uniform(-0.2,1),random.uniform(-1,1)])
            direction/=max(1e-5,np.linalg.norm(direction))
            u,v=basis(direction)
            angle=random.uniform(-math.pi,math.pi)
            u2=u*math.cos(angle)+v*math.sin(angle)
            v2=-u*math.sin(angle)+v*math.cos(angle)
            # a double triangle quad with alpha-masked botanical leaf image
            w=scale*0.56; h=scale
            center=q+v2*h*0.22
            corners=[center-u2*w-v2*h,center+u2*w-v2*h,center+u2*w+v2*h,center-u2*w+v2*h]
            off=len(leafverts)
            leafverts.extend(corners)
            leaffaces.extend([(off,off+1,off+2),(off,off+2,off+3)])
            leafuv.extend([(0,0),(1,0),(1,1),(0,1)])
    trunk=trimesh.Trimesh(vertices=np.array(verts),faces=np.array(faces),process=False,visual=TextureVisuals(uv=np.array(uvs),material=BARKMAT))
    foliage=trimesh.Trimesh(vertices=np.array(leafverts),faces=np.array(leaffaces),process=False,visual=TextureVisuals(uv=np.array(leafuv),material=LEAFMAT))
    scene=trimesh.Scene()
    scene.add_geometry(trunk,node_name='bark',geom_name='bark')
    scene.add_geometry(foliage,node_name='foliage',geom_name='foliage')
    output=ROOT/f'{shape}-{"detail" if detail else "distance"}.glb'
    output.write_bytes(scene.export(file_type='glb'))
    reloaded=trimesh.load(output,force='scene')
    assert len(reloaded.geometry)==2, list(reloaded.geometry)
    print(output.name,output.stat().st_size,'bytes',len(faces)+len(leaffaces),'triangles')

random_module=random
for variant,seed in [('maple',551),('oak',702),('birch',843)]:
    tree(seed,variant,True)
    tree(seed,variant,False)
print('ALL ASSETS CREATED', ROOT)
