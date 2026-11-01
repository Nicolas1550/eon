'use client';

/** EON V4: near-camera architectural detail and urban life.
 * Instanced geometry keeps draw calls bounded even on 24x24 worlds.
 * This is visual dressing, not a calibrated traffic or pedestrian simulation.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { type CityData, type Quality, rng } from '@/lib/city';

function StreetFronts({ city }: { city: CityData }) {
  const commercial = useMemo(() => city.buildings.filter(b => b.style <= 5 && b.height >= 24), [city]);
  const residential = useMemo(() => city.buildings.filter(b => b.style >= 6 && b.height >= 13), [city]);
  const balconies = useMemo(() => residential.flatMap(b => {
    const count = Math.min(6, Math.max(1, Math.floor(b.height / 9)));
    return Array.from({ length: count }, (_, i) => ({ b, y: 7.4 + i * 6.9 }));
  }).filter(({ b, y }) => y < b.height - 2), [residential]);
  const fins = useMemo(() => commercial.filter(b => b.height > 55 && b.style < 3), [commercial]);
  const storefrontRef = useRef<THREE.InstancedMesh>(null);
  const awningRef = useRef<THREE.InstancedMesh>(null);
  const balconyRef = useRef<THREE.InstancedMesh>(null);
  const railingRef = useRef<THREE.InstancedMesh>(null);
  const finRef = useRef<THREE.InstancedMesh>(null);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const glass = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#4e899d', metalness: 0.52, roughness: 0.18, clearcoat: 0.75 }), []);
  const awning = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b6afa2', metalness: 0.18, roughness: 0.65 }), []);
  const concrete = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b4b2aa', roughness: 0.84 }), []);
  const rail = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5c6d72', metalness: 0.68, roughness: 0.34 }), []);
  const finsMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c7c5bb', metalness: 0.42, roughness: 0.46 }), []);
  useEffect(() => {
    const set = (ref: THREE.InstancedMesh | null, i: number, x: number, y: number, z: number, sx: number, sy: number, sz: number) => {
      if (!ref) return;
      dummy.position.set(x, y, z); dummy.rotation.set(0, 0, 0);
      dummy.scale.set(sx, sy, sz); dummy.updateMatrix(); ref.setMatrixAt(i, dummy.matrix);
    };
    commercial.forEach((b, i) => {
      const front = b.z + b.depth / 2 + 0.92;
      set(storefrontRef.current, i, b.x, 2.03, front, b.width * 0.79, 2.85, 0.14);
      set(awningRef.current, i, b.x, 3.64, front + 0.76, b.width * 0.84, 0.20, 1.78);
      if (storefrontRef.current) storefrontRef.current.setColorAt(i, new THREE.Color(['#9ec3c8', '#7196a5', '#8aa8b3'][b.id % 3]));
      if (awningRef.current) awningRef.current.setColorAt(i, new THREE.Color(['#b1a48b', '#637b82', '#8f8073', '#d0c6ad'][b.id % 4]));
    });
    balconies.forEach(({ b, y }, i) => {
      const front = b.z + b.depth / 2 + 1.05;
      set(balconyRef.current, i, b.x, y, front, b.width * 0.72, 0.22, 2.4);
      set(railingRef.current, i, b.x, y + 0.65, front + 1.22, b.width * 0.72, 1.04, 0.09);
    });
    fins.forEach((b, i) => {
      const front = b.z + b.depth / 2 + 0.83;
      set(finRef.current, i * 2, b.x - b.width * 0.34, b.height / 2 + 0.8, front, 0.3, b.height * 0.97, 0.3);
      set(finRef.current, i * 2 + 1, b.x + b.width * 0.34, b.height / 2 + 0.8, front, 0.3, b.height * 0.97, 0.3);
    });
    for (const ref of [storefrontRef, awningRef, balconyRef, railingRef, finRef]) {
      if (ref.current) {
        ref.current.instanceMatrix.needsUpdate = true;
        if (ref.current.instanceColor) ref.current.instanceColor.needsUpdate = true;
        ref.current.computeBoundingSphere();
      }
    }
  }, [commercial, balconies, fins, dummy]);
  if ((city.cell ?? 22) < 48) return null;
  return <group>
    {commercial.length > 0 && <instancedMesh ref={storefrontRef} args={[box, glass, commercial.length]} />}
    {commercial.length > 0 && <instancedMesh ref={awningRef} args={[box, awning, commercial.length]} castShadow />}
    {balconies.length > 0 && <instancedMesh ref={balconyRef} args={[box, concrete, balconies.length]} castShadow />}
    {balconies.length > 0 && <instancedMesh ref={railingRef} args={[box, rail, balconies.length]} />}
    {fins.length > 0 && <instancedMesh ref={finRef} args={[box, finsMat, fins.length * 2]} />}
  </group>;
}

function Waterfront({ city, quality }: { city: CityData; quality: Quality }) {
  const waterMat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: '#477b88', roughness: quality === 'cinematic' ? 0.20 : 0.37,
    metalness: 0.34, clearcoat: quality === 'cinematic' ? 0.7 : 0.2,
    clearcoatRoughness: 0.19, transparent: true, opacity: 0.96,
  }), [quality]);
  const ripple = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const c = canvas.getContext('2d')!;
    c.fillStyle = '#738b90'; c.fillRect(0, 0, 256, 256);
    const random = rng(28374);
    for (let i = 0; i < 1100; i++) {
      const x = random() * 256, y = random() * 256;
      c.strokeStyle = random() > 0.45 ? 'rgba(235,249,255,0.16)' : 'rgba(11,37,51,0.12)';
      c.lineWidth = 0.3 + random() * 1.3;
      c.beginPath(); c.moveTo(x, y); c.lineTo(x + 5 + random() * 21, y + random() * 2); c.stroke();
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(12, 18);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);
  useEffect(() => { waterMat.map = ripple; waterMat.needsUpdate = true; }, [waterMat, ripple]);
  useEffect(() => () => ripple.dispose(), [ripple]);
  useFrame((_state, delta) => { ripple.offset.x = (ripple.offset.x + delta * 0.0014) % 1; ripple.offset.y = (ripple.offset.y + delta * 0.0007) % 1; });
  if (!city.waterfront) return null;
  const shore = city.size / 2 + 20;
  return <group>
    <mesh position={[shore + 720, 0.18, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
      <planeGeometry args={[1440, city.size + 1250]}/><primitive object={waterMat} attach="material"/>
    </mesh>
    <mesh position={[shore - 7, 0.42, 0]} receiveShadow>
      <boxGeometry args={[10, 0.45, city.size + 25]}/><meshStandardMaterial color="#c3bfb0" roughness={0.92}/>
    </mesh>
    <mesh position={[shore - 0.4, 0.66, 0]}>
      <boxGeometry args={[0.35, 0.65, city.size + 25]}/><meshStandardMaterial color="#7c8a88" metalness={0.64} roughness={0.38}/>
    </mesh>
  </group>;
}

export default function RealityDressing({ city, seed, night, quality, traffic }: {
  city: CityData; seed: number; night: number; quality: Quality; traffic: boolean;
}) {
  // night is reserved for future emissive urban signage; geometry remains deterministic.
  void night; void seed; void traffic;
  return <group>
    <StreetFronts city={city}/>
    {(city.cell ?? 22) < 48 && <Waterfront city={city} quality={quality}/>}
    {/* GLB buses are now part of the shared V7 VehicleTraffic pool. */}
  </group>;
}
