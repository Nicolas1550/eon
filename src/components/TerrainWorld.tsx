'use client';

/** EON V6: continuous rolling terrain and a non-rectilinear coastline.
 * No giant 2400x2400 green box underneath the city.
 * All noise is deterministic, generated once per city seed.
 */
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { CityData } from '@/lib/city';

function smoothstep(a: number, b: number, v: number) {
  const t = THREE.MathUtils.clamp((v-a)/(b-a),0,1);
  return t*t*(3-2*t);
}
function shore(city: CityData, z: number) {
  return city.size / 2 + 20 + Math.sin(z * 0.0102) * 11 + Math.sin(z * 0.0243 + 0.8) * 3.8;
}
function elevation(city: CityData, x: number, z: number, seed: number) {
  const edge = city.size * 0.5 + 22;
  const dist = Math.max(Math.abs(x), Math.abs(z));
  const outside = smoothstep(edge, edge + 280, dist);
  const undulation = Math.sin(x*0.0043 + seed*0.01)*23 + Math.sin(z*0.0068)*17
    + Math.sin(x*0.013 + z*0.008)*8 + Math.cos(x*0.0018-z*0.0037)*14;
  const hills = outside * (16 + undulation);
  const waterDist = x - shore(city,z);
  const coastDrop = smoothstep(-2, 44, waterDist) * (11 + Math.max(0,waterDist)*0.003);
  return -0.32 + hills - coastDrop;
}

export default function TerrainWorld({ city, seed }: { city: CityData; seed: number }) {
  const terrain = useMemo(() => {
    const geo = new THREE.PlaneGeometry(3800,3800,164,164);
    geo.rotateX(-Math.PI/2);
    const positions=geo.attributes.position as THREE.BufferAttribute;
    const colors=new Float32Array(positions.count*3);
    const grass=new THREE.Color('#688565');
    const field=new THREE.Color('#86956b');
    const rock=new THREE.Color('#7e8478');
    for (let i=0;i<positions.count;i++) {
      const x=positions.getX(i), z=positions.getZ(i);
      const y=elevation(city,x,z,seed);
      positions.setY(i,y);
      const variation = Math.sin(x*.026+z*.018)*.5+.5;
      const c=grass.clone().lerp(field, variation*.47).lerp(rock, smoothstep(25,63,y)*.45);
      colors[i*3]=c.r;colors[i*3+1]=c.g;colors[i*3+2]=c.b;
    }
    geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
    positions.needsUpdate=true;geo.computeVertexNormals();
    return geo;
  },[city,seed]);
  const sea = useMemo(() => {
    const steps=150, verts:number[]=[], uv:number[]=[], indices:number[]=[];
    for(let i=0;i<=steps;i++){
      const z=-1500+i*(3000/steps);
      const left=shore(city,z);
      verts.push(left,.18,z, left+1800,.18,z);
      uv.push(0,i/steps*16, 18,i/steps*16);
      if(i<steps){const a=i*2;indices.push(a,a+1,a+2,a+1,a+3,a+2);}
    }
    const geo=new THREE.BufferGeometry();
    geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));
    geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));
    geo.setIndex(indices);geo.computeVertexNormals();return geo;
  },[city]);
  const waterTexture=useMemo(()=>{
    const canvas=document.createElement('canvas');canvas.width=canvas.height=256;
    const ctx=canvas.getContext('2d')!;ctx.fillStyle='#6b9298';ctx.fillRect(0,0,256,256);
    for(let i=0;i<1300;i++){
      const x=(i*139.7)%256,y=(i*83.3)%256;
      ctx.fillStyle=i%3?'rgba(200,235,240,.13)':'rgba(14,51,67,.13)';
      ctx.fillRect(x,y,4+(i%11),.65);
    }
    const tex=new THREE.CanvasTexture(canvas);tex.colorSpace=THREE.SRGBColorSpace;
    tex.wrapS=tex.wrapT=THREE.RepeatWrapping;return tex;
  },[]);
  useFrame((_state,delta)=>{waterTexture.offset.x=(waterTexture.offset.x+delta*.002)%1;});
  useEffect(()=>()=>{terrain.dispose();sea.dispose();waterTexture.dispose();},[terrain,sea,waterTexture]);
  return <group>
    <mesh geometry={terrain} receiveShadow>
      <meshStandardMaterial vertexColors roughness={1}/>
    </mesh>
    {city.waterfront && <mesh geometry={sea} receiveShadow>
      <meshPhysicalMaterial map={waterTexture} color="#c0dee4" roughness={0.25} metalness={0.23} clearcoat={0.62} side={THREE.DoubleSide}/>
    </mesh>}
  </group>;
}
