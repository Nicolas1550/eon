'use client';

/** EON V6 Human Engine.
 * Six bundled original articulated GLBs, with separate head, legs and arms.
 * A fixed 30-person pool is dynamically assigned to the nearest pedestrians;
 * no geometry or GLTF downloads are created during animation.
 */
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { type CityData, rng } from '@/lib/city';

type Walker = { x: number; z: number; axis: 'x' | 'z'; offset: number; speed: number; phase: number; variant: number; length: number };
const POOL = 30;

function makeWalkers(city: CityData, seed: number): Walker[] {
  const random = rng(seed ^ 0x1A71D); const walkers: Walker[] = [];
  const cell = city.cell ?? 22;
  if (cell < 48) return walkers; // Keep old saved generators untouched.
  // Sidewalks, not lawns or streets: parcels have a 28m paved surface, building footprints ~20m.
  for (let row = 0; row < city.grid; row++) for (let col = 0; col < city.grid; col++) {
    const x = (col - (city.grid - 1) / 2) * cell;
    const z = (row - (city.grid - 1) / 2) * cell;
    const dx = col - city.grid * 0.47, dz = row - city.grid * 0.46;
    const downtown = Math.hypot(dx, dz) < city.grid * 0.32;
    const diagonalDistance = Math.abs(x*.32-z*.42)/Math.hypot(.32,.42);
    if (city.boulevard && diagonalDistance < 33 && Math.abs(x)<city.size*.41 && Math.abs(z)<city.size*.32) continue;
    const count = random() < (downtown ? 0.72 : 0.32) ? (downtown ? 3 : 2) : 0;
    for (let i = 0; i < count; i++) {
      const axis: 'x' | 'z' = i % 2 ? 'x' : 'z';
      const sign = random() > 0.5 ? 1 : -1;
      const sidewalk = cell * 0.5 - 8.9;
      walkers.push({
        x: x + (axis === 'z' ? sign * sidewalk : 0),
        z: z + (axis === 'x' ? sign * sidewalk : 0),
        axis, offset: random() * 15, speed: 0.65 + random() * 0.75,
        phase: random() * 23, variant: Math.floor(random() * 6), length: 14 + random() * 6,
      });
    }
  }
  return walkers;
}

function positionOf(w: Walker, time: number) {
  const travel = (time * w.speed + w.phase) % (2 * w.length);
  const forward = travel < w.length;
  const shift = (forward ? travel : 2 * w.length - travel) - w.length * 0.5;
  return {
    x: w.x + (w.axis === 'x' ? shift : 0),
    z: w.z + (w.axis === 'z' ? shift : 0),
    rotation: w.axis === 'z' ? (forward ? 0 : Math.PI) : (forward ? Math.PI / 2 : -Math.PI / 2),
    gait: time * w.speed * 7 + w.phase,
  };
}

export default function PedestrianLife({ city, seed }: { city: CityData; seed: number }) {
  const a = useGLTF('/assets/people/pedestrian-1.glb');
  const b = useGLTF('/assets/people/pedestrian-2.glb');
  const c = useGLTF('/assets/people/pedestrian-3.glb');
  const d = useGLTF('/assets/people/pedestrian-4.glb');
  const e = useGLTF('/assets/people/pedestrian-5.glb');
  const f = useGLTF('/assets/people/pedestrian-6.glb');
  const sources = useMemo(() => [a.scene, b.scene, c.scene, d.scene, e.scene, f.scene], [a,b,c,d,e,f]);
  const walkers = useMemo(() => makeWalkers(city, seed), [city, seed]);
  const models = useMemo(() => Array.from({ length: POOL }, (_, i) => {
    const clone = sources[i % 6].clone(true);
    clone.traverse(obj => { if (obj instanceof THREE.Mesh) { obj.castShadow = true; obj.frustumCulled = false; } });
    return clone;
  }), [sources]);
  const holders = useRef<(THREE.Group | null)[]>([]);
  const assigned = useRef<(Walker | undefined)[]>([]);
  const { camera } = useThree();
  const refresh = useRef(1);
  useFrame(({ clock }, delta) => {
    if (walkers.length === 0) return;
    const t = clock.elapsedTime;
    refresh.current += delta;
    if (refresh.current >= 0.65) {
      refresh.current = 0;
      const cx = camera.position.x, cz = camera.position.z;
      // Don't populate far-away ORBIT views with hundreds of expensive animated models.
      const closest = walkers.map(w => ({ w, d: (w.x-cx)**2 + (w.z-cz)**2 }))
        .filter(x => x.d < 155 * 155).sort((u,v) => u.d-v.d);
      // Each slot is tied to a model variant, so appearances are genuinely diverse.
      for (let variant = 0; variant < 6; variant++) {
        const candidates = closest.filter(x => x.w.variant === variant);
        for (let j = 0; j < POOL / 6; j++) assigned.current[variant + j * 6] = candidates[j]?.w;
      }
    }
    models.forEach((model, i) => {
      const group = holders.current[i]; if (!group) return;
      const walker = assigned.current[i];
      group.visible = Boolean(walker);
      if (!walker) return;
      const pos = positionOf(walker, t);
      group.position.set(pos.x, 0.64 + Math.abs(Math.sin(pos.gait)) * 0.025, pos.z);
      group.rotation.set(0, pos.rotation, 0);
      const stride = Math.sin(pos.gait) * 0.36;
      const leftLeg = model.getObjectByName('leg_L');
      const rightLeg = model.getObjectByName('leg_R');
      const leftArm = model.getObjectByName('arm_L');
      const rightArm = model.getObjectByName('arm_R');
      if (leftLeg) leftLeg.rotation.x = stride;
      if (rightLeg) rightLeg.rotation.x = -stride;
      if (leftArm) leftArm.rotation.x = -stride * 0.85;
      if (rightArm) rightArm.rotation.x = stride * 0.85;
    });
  });
  if ((city.cell ?? 22) < 48) return null;
  return <group>{models.map((model, i) => <group key={i} visible={false} ref={el => { holders.current[i] = el; }}>
    <primitive object={model}/>
  </group>)}</group>;
}
