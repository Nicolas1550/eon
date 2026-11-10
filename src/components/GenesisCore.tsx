'use client';

/** GENESIS / Awakening Core — web-native real-time centerpiece.
 * No CUDA inference or RTX-specific APIs are required by the browser.
 * Scene elements are instanced and deterministic for a given city seed.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { rng, type CityData, type Quality } from '@/lib/city';

export function getGenesisCoreLocation(city: CityData): [number, number, number] {
  const park = city.parks.reduce<{ x: number; z: number } | null>((best, item) => {
    if (!best) return item;
    return item.x * item.x + item.z * item.z < best.x * best.x + best.z * best.z ? item : best;
  }, null);
  return park ? [park.x, 0.72, park.z] : [0, 0.72, 0];
}

type Sprout = { x: number; z: number; height: number; scale: number; hue: number; phase: number };

export default function GenesisCore({ city, seed, awakened, quality }: {
  city: CityData;
  seed: number;
  awakened: boolean;
  quality: Quality;
}) {
  const location = useMemo(() => getGenesisCoreLocation(city), [city]);
  const progress = useRef(awakened ? 1 : 0);
  const torusA = useRef<THREE.Mesh>(null);
  const torusB = useRef<THREE.Mesh>(null);
  const crystal = useRef<THREE.Group>(null);
  const wave = useRef<THREE.Mesh>(null);
  const stems = useRef<THREE.InstancedMesh>(null);
  const petals = useRef<THREE.InstancedMesh>(null);
  const glow = useRef<THREE.PointLight>(null);
  const bloomMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#75e6b8', metalness: .1, roughness: .38, emissive: '#178a7a', emissiveIntensity: 1.2 }), []);
  const tipMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#bdfff1', metalness: .1, roughness: .28, emissive: '#28d8b0', emissiveIntensity: 1.6 }), []);
  const crystalMaterial = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#60cabf', metalness: .4, roughness: .12, clearcoat: 1, clearcoatRoughness: .06, emissive: '#138b85', emissiveIntensity: 1.2, flatShading: true }), []);
  const stemGeo = useMemo(() => new THREE.ConeGeometry(.28, 2, 5), []);
  const tipGeo = useMemo(() => new THREE.OctahedronGeometry(.62, 0), []);
  const sprouts = useMemo(() => {
    const result: Sprout[] = [];
    const priority = [...city.parks].sort((a, b) => (a.x - location[0]) ** 2 + (a.z - location[2]) ** 2 - (b.x - location[0]) ** 2 - (b.z - location[2]) ** 2).slice(0, quality === 'balanced' ? 12 : 22);
    const localRandom = rng(seed ^ 0x158fa9e2);
    priority.forEach((p, index) => {
      const density = index === 0 ? 72 : index < 5 ? 25 : 12;
      for (let i = 0; i < density; i++) {
        const radius = p.size * (0.1 + localRandom() * .30);
        const theta = localRandom() * Math.PI * 2;
        const x = p.x + Math.cos(theta) * radius;
        const z = p.z + Math.sin(theta) * radius;
        if (Math.hypot(x - location[0], z - location[2]) < 7) continue;
        result.push({ x, z, height: .6 + localRandom() * 1.8, scale: .38 + localRandom() * .9, hue: localRandom(), phase: localRandom() * 5 });
      }
    });
    return result;
  }, [city.parks, location, seed, quality]);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const bloomTime = useRef(0);
  const lastProgress = useRef(-1);
  const oldAwakened = useRef(awakened);
  const waveTime = useRef(0);

  useEffect(() => {
    return () => { bloomMaterial.dispose(); tipMaterial.dispose(); crystalMaterial.dispose(); stemGeo.dispose(); tipGeo.dispose(); };
  }, [bloomMaterial, tipMaterial, crystalMaterial, stemGeo, tipGeo]);

  useFrame((state, delta) => {
    const dt = Math.min(.075, delta);
    const desired = awakened ? 1 : 0;
    progress.current = THREE.MathUtils.damp(progress.current, desired, awakened ? .52 : 1.4, dt);
    if (Math.abs(progress.current - desired) < .0005) progress.current = desired;
    const p = progress.current;
    bloomTime.current += dt;

    if (oldAwakened.current !== awakened) {
      oldAwakened.current = awakened;
      waveTime.current = 0;
    }
    waveTime.current += dt;
    if (torusA.current) {
      torusA.current.rotation.z = bloomTime.current * .1;
      torusA.current.rotation.x = .28 + Math.sin(bloomTime.current * .28) * .13;
      (torusA.current.material as THREE.MeshBasicMaterial).opacity = .24 + p * .6;
    }
    if (torusB.current) {
      torusB.current.rotation.y = bloomTime.current * -.23;
      torusB.current.rotation.z = .45 + bloomTime.current * -.09;
      (torusB.current.material as THREE.MeshBasicMaterial).opacity = .18 + p * .5;
    }
    if (crystal.current) {
      crystal.current.rotation.y = bloomTime.current * .28;
      crystal.current.position.y = 8.5 + Math.sin(bloomTime.current * 1.3) * .45;
      crystal.current.scale.setScalar(1 + p * .25);
    }
    crystalMaterial.emissiveIntensity = 1.2 + p * 2.6 + Math.sin(bloomTime.current * 2) * .16;
    if (glow.current) glow.current.intensity = 8 + p * 54;
    if (wave.current) {
      const pulse = awakened && waveTime.current < 5.5;
      wave.current.visible = pulse;
      const t = Math.min(1, waveTime.current / 5.5);
      wave.current.scale.setScalar(1 + t * Math.min(14, city.size / 90));
      (wave.current.material as THREE.MeshBasicMaterial).opacity = pulse ? .42 * (1 - t) : 0;
    }
    if (Math.abs(lastProgress.current - p) < .004 && (p === 0 || p === 1)) return;
    lastProgress.current = p;
    if (!stems.current || !petals.current) return;
    for (let i = 0; i < sprouts.length; i++) {
      const s = sprouts[i];
      // Activation travels outwards as a wave, not as an instantaneous on/off switch.
      const distance = Math.hypot(s.x - location[0], s.z - location[2]);
      const arrival = THREE.MathUtils.clamp((distance / Math.max(180, city.size * .75)) * .48, 0, .48);
      const growth = THREE.MathUtils.smoothstep(p, arrival, Math.min(1, arrival + .47));
      const size = Math.max(.0001, growth * s.scale);
      dummy.position.set(s.x, .7 + s.height * size, s.z);
      dummy.rotation.set(0, s.phase, 0);
      dummy.scale.set(size, s.height * size, size);
      dummy.updateMatrix();
      stems.current.setMatrixAt(i, dummy.matrix);
      dummy.position.y = .7 + 2 * s.height * size;
      dummy.rotation.set(0, s.phase + bloomTime.current * .08, 0);
      dummy.scale.setScalar(size * (.6 + s.hue * .65));
      dummy.updateMatrix();
      petals.current.setMatrixAt(i, dummy.matrix);
      if (p < .005) continue;
      const color = new THREE.Color().setHSL(.37 + s.hue * .15, .52, .34 + s.hue * .24);
      stems.current.setColorAt(i, color);
      petals.current.setColorAt(i, new THREE.Color().setHSL(.42 + s.hue * .12, .82, .65));
    }
    stems.current.instanceMatrix.needsUpdate = true;
    petals.current.instanceMatrix.needsUpdate = true;
    if (stems.current.instanceColor) stems.current.instanceColor.needsUpdate = true;
    if (petals.current.instanceColor) petals.current.instanceColor.needsUpdate = true;
    // Avoid stale visibility culling bounds after instance growth.
    stems.current.computeBoundingSphere();
    petals.current.computeBoundingSphere();
  });

  return <group>
    <group position={location}>
      {/* Ground reticle marks an existing park, so no buildings need to be removed. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, .015, 0]}>
        <circleGeometry args={[9.5, 80]}/>
        <meshStandardMaterial color="#0b272a" metalness={.55} roughness={.28} emissive="#044c4a" emissiveIntensity={.6}/>
      </mesh>
      {[6.7, 9.6, 11.2].map((radius, index) => <mesh key={radius} position={[0, .12 + index * .03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <torusGeometry args={[radius, index === 1 ? .15 : .055, 8, 100]}/>
        <meshBasicMaterial color={index === 1 ? '#a6ffe9' : '#35b8a1'} transparent opacity={index === 1 ? .75 : .33} depthWrite={false}/>
      </mesh>)}
      <mesh position={[0, 3.5, 0]}>
        <cylinderGeometry args={[1.45, 2.1, 6.5, 8, 1]}/>
        <meshStandardMaterial color="#123d43" metalness={.83} roughness={.21} emissive="#12877c" emissiveIntensity={.48}/>
      </mesh>
      <mesh position={[0, 6.5, 0]} rotation={[0, Math.PI / 8, 0]}>
        <cylinderGeometry args={[2.7, 1.8, .85, 8]}/>
        <meshPhysicalMaterial color="#a4c3c2" metalness={.8} roughness={.16} clearcoat={.7}/>
      </mesh>
      <group ref={crystal}>
        <mesh castShadow>
          <icosahedronGeometry args={[4.3, 1]}/>
          <primitive object={crystalMaterial} attach="material"/>
        </mesh>
        <mesh scale={.58}>
          <icosahedronGeometry args={[4.3, 0]}/>
          <meshBasicMaterial color="#dcfff4" transparent opacity={.32} blending={THREE.AdditiveBlending} depthWrite={false}/>
        </mesh>
      </group>
      <mesh ref={torusA} position={[0, 8.5, 0]} rotation={[.28, .3, 0]}>
        <torusGeometry args={[6.3, .115, 10, 140]}/>
        <meshBasicMaterial color="#90f8df" transparent opacity={.3} blending={THREE.AdditiveBlending} depthWrite={false}/>
      </mesh>
      <mesh ref={torusB} position={[0, 8.5, 0]} rotation={[1.35, 0, .4]}>
        <torusGeometry args={[5.2, .09, 10, 130]}/>
        <meshBasicMaterial color="#c1f9ff" transparent opacity={.2} blending={THREE.AdditiveBlending} depthWrite={false}/>
      </mesh>
      <mesh ref={wave} rotation={[-Math.PI / 2, 0, 0]} position={[0, .18, 0]} visible={false}>
        <torusGeometry args={[12, .16, 8, 150]}/>
        <meshBasicMaterial color="#a0ffee" transparent opacity={.4} blending={THREE.AdditiveBlending} depthWrite={false}/>
      </mesh>
      <pointLight ref={glow} position={[0, 8, 0]} color="#64eddf" intensity={8} distance={115} decay={2}/>
    </group>
    {/* Batching allows hundreds of interactive plants with only two draw calls. */}
    <instancedMesh ref={stems} args={[stemGeo, bloomMaterial, sprouts.length]} frustumCulled={false}/>
    <instancedMesh ref={petals} args={[tipGeo, tipMaterial, sprouts.length]} frustumCulled={false}/>
  </group>;
}
