'use client';

/** Shared traffic-light timing with VehicleTraffic (28s cycle). */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { type CityData } from '@/lib/city';

export default function TrafficSignals({ city }: { city: CityData }) {
  const places = useMemo(() => {
    const result: { x: number; z: number; axis: 'x' | 'z' }[] = [];
    const center = Math.floor(city.grid / 2);
    for (let row = center - 3; row <= center + 3; row += 2) {
      for (let col = center - 3; col <= center + 3; col += 2) {
        const x = (col - city.grid / 2) * (city.cell ?? 48);
        const z = (row - city.grid / 2) * (city.cell ?? 48);
        result.push({ x: x + 10.2, z: z + 10.2, axis: 'z' });
        result.push({ x: x - 10.2, z: z - 10.2, axis: 'x' });
      }
    }
    return result;
  }, [city]);
  const redZ = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d43a32', emissive: '#f52418', emissiveIntensity: 0.08 }), []);
  const greenZ = useMemo(() => new THREE.MeshStandardMaterial({ color: '#33b67c', emissive: '#1aff8b', emissiveIntensity: 1.8 }), []);
  const redX = useMemo(() => redZ.clone(), [redZ]);
  const greenX = useMemo(() => greenZ.clone(), [greenZ]);
  const pole = useRef<THREE.InstancedMesh>(null);
  const housing = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    places.forEach((p, i) => {
      if (pole.current) {
        dummy.position.set(p.x, 1.75, p.z);
        dummy.rotation.set(0, 0, 0); dummy.scale.set(.13, 3.5, .13); dummy.updateMatrix();
        pole.current.setMatrixAt(i, dummy.matrix);
      }
      if (housing.current) {
        dummy.position.set(p.x, 3.72, p.z);
        dummy.scale.set(.47, 1.10, .43); dummy.updateMatrix(); housing.current.setMatrixAt(i, dummy.matrix);
      }
    });
    for (const mesh of [pole.current, housing.current]) {
      if (!mesh) continue;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
    }
  }, [places, dummy]);
  useFrame(({ clock }) => {
    const phase = clock.elapsedTime % 28;
    const z = phase < 12;
    const x = phase >= 14 && phase < 26;
    greenZ.emissiveIntensity = z ? 2.3 : .07;
    redZ.emissiveIntensity = z ? .08 : 2.3;
    greenX.emissiveIntensity = x ? 2.3 : .07;
    redX.emissiveIntensity = x ? .08 : 2.3;
  });
  // Light meshes are split by axis to avoid illuminating the wrong direction.
  // Each instanced group has a constant material and bounded draw calls.
  return <group>
    <instancedMesh ref={pole} args={[undefined, undefined, places.length]}>
      <cylinderGeometry args={[1, 1, 1, 8]}/><meshStandardMaterial color="#404b4c" metalness={.62} roughness={.42}/>
    </instancedMesh>
    <instancedMesh ref={housing} args={[undefined, undefined, places.length]}>
      <boxGeometry args={[1, 1, 1]}/><meshStandardMaterial color="#202b2e" metalness={.32} roughness={.53}/>
    </instancedMesh>
    {places.map((p, i) => <group key={i} position={[p.x, 3.72, p.z + .27]}>
      <mesh position={[0,.28,0]} material={p.axis === 'z' ? redZ : redX}>
        <sphereGeometry args={[.11, 8, 8]}/>
      </mesh>
      <mesh position={[0,-.28,0]} material={p.axis === 'z' ? greenZ : greenX}>
        <sphereGeometry args={[.11, 8, 8]}/>
      </mesh>
    </group>)}
  </group>;
}
