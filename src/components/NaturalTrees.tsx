'use client';

/**
 * EON V5 / NATURAL ASSETS
 * Six ORIGINAL GLB meshes: 3 species, 2 mesh-detail levels.
 * Branches are tapered and irregular. Every crown is composed of individually
 * shaped, alpha-masked leaves (not spheres, cones, or icosahedrons).
 *
 * Shared geometry/materials and InstancedMesh keep the draw-call count bounded.
 * Near/distant instances are re-batched only every 0.6 seconds.
 * All asset files are bundled locally under public/assets/trees/.
 */
import { useLayoutEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import type { CityData, Quality, Tree } from '@/lib/city';

const SPECIES = ['maple', 'oak', 'birch'] as const;
const SHADES = ['#d6e6c8', '#b9d5b0', '#d2e1ba', '#acc9a3', '#c5d7b3'];

type Parts = {
  bark: THREE.Mesh;
  foliage: THREE.Mesh;
};

function getParts(scene: THREE.Group): Parts {
  let bark: THREE.Mesh | undefined;
  let foliage: THREE.Mesh | undefined;
  scene.traverse((item) => {
    if (!(item instanceof THREE.Mesh)) return;
    const name = item.name.toLowerCase();
    if (name.includes('bark')) bark = item;
    if (name.includes('foliage')) foliage = item;
  });
  if (!bark || !foliage) throw new Error('El GLB de árboles EON no tiene mallas bark y foliage.');
  return { bark, foliage };
}

function SpeciesBatch({
  trees, detail, distance, quality,
}: {
  trees: Tree[];
  detail: Parts;
  distance: Parts;
  quality: Quality;
}) {
  const highBark = useRef<THREE.InstancedMesh>(null);
  const highLeaves = useRef<THREE.InstancedMesh>(null);
  const lowBark = useRef<THREE.InstancedMesh>(null);
  const lowLeaves = useRef<THREE.InstancedMesh>(null);
  const { camera } = useThree();
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const elapsed = useRef(1);
  const count = trees.length;

  const refresh = () => {
    if (!highBark.current || !highLeaves.current || !lowBark.current || !lowLeaves.current) return;
    let near = 0;
    let far = 0;
    const maxNear = quality === 'cinematic' ? 120 : 60;
    const maxDistanceSq = (quality === 'cinematic' ? 145 : 105) ** 2;
    const nearB = highBark.current;
    const nearF = highLeaves.current;
    const farB = lowBark.current;
    const farF = lowLeaves.current;
    // Nearest first: do not spend the detailed budget on distant trees.
    const sorted = trees.map((t) => {
      const dx = camera.position.x - t.x;
      const dz = camera.position.z - t.z;
      const dy = camera.position.y - 5 * t.scale;
      return { t, distanceSq: dx * dx + dy * dy + dz * dz };
    }).sort((a, b) => a.distanceSq - b.distanceSq);
    for (const { t, distanceSq } of sorted) {
      const isNear = distanceSq < maxDistanceSq && near < maxNear;
      const index = isNear ? near++ : far++;
      const scale = t.scale * 0.95;
      dummy.position.set(t.x, 0.58, t.z);
      // Deterministic per-tree rotation and subtle size differences.
      dummy.rotation.set(0, ((t.x * 17 + t.z * 29) % 100) * 0.063, 0);
      dummy.scale.set(scale, scale * (0.94 + (t.tone % 3) * 0.04), scale);
      dummy.updateMatrix();
      const b = isNear ? nearB : farB;
      const f = isNear ? nearF : farF;
      b.setMatrixAt(index, dummy.matrix);
      f.setMatrixAt(index, dummy.matrix);
      f.setColorAt(index, new THREE.Color(SHADES[t.tone % SHADES.length]));
    }
    nearB.count = near;
    nearF.count = near;
    farB.count = far;
    farF.count = far;
    for (const mesh of [nearB, nearF, farB, farF]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  };
  useLayoutEffect(() => { refresh(); }, [trees, quality, camera]);
  useFrame((_state, delta) => {
    elapsed.current += delta;
    if (elapsed.current < 0.6) return;
    elapsed.current = 0;
    refresh();
  });
  if (count === 0) return null;
  return <group>
    <instancedMesh ref={highBark} args={[detail.bark.geometry, detail.bark.material, count]} castShadow frustumCulled={false}/>
    <instancedMesh ref={highLeaves} args={[detail.foliage.geometry, detail.foliage.material, count]} castShadow={quality === 'cinematic'} frustumCulled={false}/>
    <instancedMesh ref={lowBark} args={[distance.bark.geometry, distance.bark.material, count]} frustumCulled={false}/>
    <instancedMesh ref={lowLeaves} args={[distance.foliage.geometry, distance.foliage.material, count]} frustumCulled={false}/>
  </group>;
}

export default function NaturalTrees({ city, quality }: { city: CityData; quality: Quality }) {
  // Static hooks: all models are bundled, cached by drei, and loaded once.
  const mapleDetail = useGLTF('/assets/trees/maple-detail.glb');
  const mapleDistance = useGLTF('/assets/trees/maple-distance.glb');
  const oakDetail = useGLTF('/assets/trees/oak-detail.glb');
  const oakDistance = useGLTF('/assets/trees/oak-distance.glb');
  const birchDetail = useGLTF('/assets/trees/birch-detail.glb');
  const birchDistance = useGLTF('/assets/trees/birch-distance.glb');
  const models = useMemo(() => [
    [getParts(mapleDetail.scene), getParts(mapleDistance.scene)],
    [getParts(oakDetail.scene), getParts(oakDistance.scene)],
    [getParts(birchDetail.scene), getParts(birchDistance.scene)],
  ] as const, [mapleDetail, mapleDistance, oakDetail, oakDistance, birchDetail, birchDistance]);
  const groups = useMemo(() => {
    const result: Tree[][] = [[], [], []];
    for (const t of city.trees) result[Math.abs((t.tone + Math.round(t.x * 0.7 + t.z * 0.3))) % SPECIES.length].push(t);
    return result;
  }, [city.trees]);
  return <group>
    {groups.map((trees, i) => <SpeciesBatch key={i} trees={trees} detail={models[i][0]} distance={models[i][1]} quality={quality}/>)}
  </group>;
}
