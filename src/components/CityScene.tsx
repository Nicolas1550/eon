'use client';

import { Canvas, ThreeEvent, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Sky, Stars } from '@react-three/drei';
import { Suspense, useEffect, useMemo, useRef, type ComponentRef, type RefObject } from 'react';
import * as THREE from 'three';
import { Building, CameraMode, CityData, Plaza, Quality, rng, Weather, isArterial } from '@/lib/city';
import RealityDressing from './RealityDressing';
import NaturalTrees from './NaturalTrees';
import PedestrianLife from './PedestrianLife';
import TerrainWorld from './TerrainWorld';
import VehicleTraffic from './VehicleTraffic';
import TrafficSignals from './TrafficSignals';

export type SceneProps = {
  city: CityData;
  seed: number;
  time: number;
  weather: Weather;
  quality: Quality;
  traffic: boolean;
  cameraMode: CameraMode;
  resetCamera: number;
  selected: Building | null;
  onSelect: (building: Building | null) => void;
  onReady?: () => void;
};

type CityWorldProps = SceneProps & { night: number };

function createFacade(style: number, tier: number) {
  const width = 384;
  const height = 768;
  const canvas = document.createElement('canvas');
  const glow = document.createElement('canvas');
  canvas.width = glow.width = width;
  canvas.height = glow.height = height;
  const c = canvas.getContext('2d')!;
  const e = glow.getContext('2d')!;
  const random = rng(style * 231 + tier * 181 + 92);
  const palettes = [
    { wall: '#304450', mullion: '#52626a', glass: '#536e7a' },
    { wall: '#717875', mullion: '#999c96', glass: '#405b68' },
    { wall: '#4d5358', mullion: '#82898c', glass: '#4d6676' },
    { wall: '#77706b', mullion: '#a9a19a', glass: '#52616c' },
    { wall: '#414d58', mullion: '#a2adb5', glass: '#5d8295' },
    { wall: '#a3a39a', mullion: '#d4d0c3', glass: '#657a80' },
    { wall: '#b2a69b', mullion: '#ded0c2', glass: '#556c74' },
    { wall: '#c2b9a8', mullion: '#f0e3d4', glass: '#6a858b' },
    { wall: '#a9a398', mullion: '#d4c9b5', glass: '#637e87' },
    { wall: '#82786c', mullion: '#bfb3a5', glass: '#486b77' },
  ];
  const p = palettes[style] ?? palettes[0];
  c.fillStyle = p.wall;
  c.fillRect(0, 0, width, height);
  e.fillStyle = '#000000';
  e.fillRect(0, 0, width, height);
  const cols = style === 0 || style === 4 ? 12 : style >= 6 ? 6 : 9;
  const rows = tier === 0 ? 16 : tier === 1 ? 31 : 49;
  const gapX = width / cols;
  const gapY = height / rows;
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const insetX = style === 0 || style === 4 ? 2.6 : 5;
      const insetY = style >= 6 ? 5 : 3;
      const rx = x * gapX + insetX;
      const ry = y * gapY + insetY;
      const rw = gapX - insetX * 2;
      const rh = gapY - insetY * 2;
      const variation = random();
      c.fillStyle = variation > 0.95 ? '#d3e2e2' : variation > 0.38 ? p.glass : '#253943';
      c.fillRect(rx, ry, rw, rh);
      c.fillStyle = 'rgba(205,223,223,0.16)';
      c.fillRect(rx + 1, ry + 1, Math.max(1, rw * 0.12), rh - 2);
      // Depth cue: darker window lintels and thin reflected sky strips.
      c.fillStyle = 'rgba(12,26,34,0.20)'; c.fillRect(rx, ry + rh * 0.79, rw, Math.max(1, rh * 0.17));
      if (variation > 0.5) { c.fillStyle = 'rgba(213,236,244,0.18)'; c.fillRect(rx + rw * 0.65, ry + 1, Math.max(1, rw * 0.07), rh * 0.65); }
      if (random() > 0.86) {
        e.fillStyle = random() > 0.27 ? '#f5d8a3' : '#b8cde0';
        e.fillRect(rx, ry, rw, rh);
        c.fillStyle = 'rgba(246,214,157,0.11)';
        c.fillRect(rx, ry, rw, rh);
      }
    }
  }
  // Thin structural mullions, horizontal slab bands and selective balcony edges.
  c.strokeStyle = p.mullion;
  c.lineWidth = style === 4 ? 3 : 2;
  for (let x = 0; x < cols + 1; x++) {
    c.beginPath(); c.moveTo(x * gapX, 0); c.lineTo(x * gapX, height); c.stroke();
  }
  c.strokeStyle = style === 5 ? 'rgba(235,231,211,0.75)' : 'rgba(190,207,213,0.30)';
  c.lineWidth = style === 5 ? 5 : 2;
  for (let y = 0; y <= rows; y++) {
    c.beginPath(); c.moveTo(0, y * gapY); c.lineTo(width, y * gapY); c.stroke();
  }
  if (style === 3 || style >= 6) {
    c.fillStyle = 'rgba(224,219,203,0.20)';
    for (let y = 3; y < rows; y += 3) c.fillRect(0, y * gapY - 3, width, 6);
  }
  const map = new THREE.CanvasTexture(canvas);
  const emissive = new THREE.CanvasTexture(glow);
  map.colorSpace = THREE.SRGBColorSpace;
  emissive.colorSpace = THREE.SRGBColorSpace;
  map.anisotropy = emissive.anisotropy = 8;
  return { map, emissive };
}

function Buildings({ city, night, selected, onSelect }: Pick<CityWorldProps, 'city' | 'night' | 'selected' | 'onSelect'>) {
  const groups = useMemo(() => {
    const grouped: Building[][] = Array.from({ length: 90 }, () => []);
    for (const building of city.buildings) {
      const form = building.form === 'round' ? 1 : building.form === 'corner' ? 2 : 0;
      grouped[form * 30 + building.style * 3 + building.tier].push(building);
    }
    return grouped;
  }, [city]);
  const textures = useMemo(() => {
    return Array.from({ length: 30 }, (_, idx) => createFacade(Math.floor(idx / 3), idx % 3));
  }, []);
  const mats = useMemo(() => textures.map(({ map, emissive }, idx) => new THREE.MeshStandardMaterial({
    map, emissiveMap: emissive, emissive: new THREE.Color('#ffe8b8'),
    emissiveIntensity: 0.02, roughness: idx < 3 || (idx >= 12 && idx < 15) ? 0.24 : idx >= 18 ? 0.82 : 0.49,
    metalness: idx < 3 || (idx >= 12 && idx < 15) ? 0.68 : 0.17,
  })), [textures]);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const round = useMemo(() => new THREE.CylinderGeometry(0.5,0.5,1,16), []);
  const corner = useMemo(() => {
    const shape = new THREE.Shape();
    shape.moveTo(-.5,-.5);shape.lineTo(.5,-.5);shape.lineTo(.5,-.13);
    shape.lineTo(-.13,-.13);shape.lineTo(-.13,.5);shape.lineTo(-.5,.5);shape.closePath();
    const geo = new THREE.ExtrudeGeometry(shape,{depth:1,bevelEnabled:false,steps:1});
    geo.rotateX(-Math.PI/2);geo.translate(0,-.5,0);geo.computeVertexNormals();return geo;
  }, []);
  const roofGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const upperRefs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const upperGroups = useMemo(() => groups.map(g => g.filter(b => b.setback)), [groups]);
  const roofMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#606b6e', roughness: 0.87, metalness: 0.13 }), []);
  const refs = useRef<Array<THREE.InstancedMesh | null>>([]);
  const roofRef = useRef<THREE.InstancedMesh>(null);
  const podiumRef = useRef<THREE.InstancedMesh>(null);
  const crownRef = useRef<THREE.InstancedMesh>(null);
  const podiumMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#899397', roughness: 0.72, metalness: 0.18 }), []);
  const crownMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7d959e', roughness: 0.3, metalness: 0.65 }), []);
  const crownBuildings = useMemo(() => city.buildings.filter(b => b.tier === 2 && b.form !== 'round'), [city]);
  const flatBuildings = useMemo(() => city.buildings.filter(b => b.form !== 'round'), [city]);
  const roundBuildings = useMemo(() => city.buildings.filter(b => b.form === 'round'), [city]);
  const roundRoofRef = useRef<THREE.InstancedMesh>(null);
  const roundBaseRef = useRef<THREE.InstancedMesh>(null);
  const roofEquipmentRef = useRef<THREE.InstancedMesh>(null);
  const equipGeo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const equipMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#747f80', roughness: 0.82, metalness: 0.33 }), []);
  const equipmentBuildings = useMemo(() => city.buildings.filter((b) => b.id % 3 !== 0), [city]);
  const solarBuildings = useMemo(() => city.buildings.filter(b => b.roof === 'terrace' || (!b.roof && b.id % 8 === 0)), [city]);
  const gardenBuildings = useMemo(() => city.buildings.filter(b => b.roof === 'green'), [city]);
  const solarRef = useRef<THREE.InstancedMesh>(null);
  const gardenRef = useRef<THREE.InstancedMesh>(null);
  const solarMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#24485d', metalness: 0.8, roughness: 0.19 }), []);
  const gardenMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#607d55', roughness: 0.97 }), []);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  useEffect(() => {
    for (let group = 0; group < groups.length; group++) {
      const mesh = refs.current[group];
      if (!mesh) continue;
      groups[group].forEach((b, index) => {
        const baseHeight = b.setback ? b.height * 0.73 : b.height;
        dummy.position.set(b.x, baseHeight / 2 + 0.6, b.z);
        dummy.rotation.set(0, b.rotation ?? 0, 0);
        dummy.scale.set(b.width, baseHeight, b.depth);
        dummy.updateMatrix();
        mesh.setMatrixAt(index, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingSphere();
      const upper = upperRefs.current[group];
      if (upper) {
        upperGroups[group].forEach((b, i) => {
          const h = b.height * 0.27;
          dummy.position.set(b.x, b.height * 0.73 + h / 2 + 0.6, b.z);
          dummy.rotation.set(0, b.rotation ?? 0, 0);
          dummy.scale.set(b.width * 0.70, h, b.depth * 0.70);
          dummy.updateMatrix(); upper.setMatrixAt(i, dummy.matrix);
        });
        upper.instanceMatrix.needsUpdate = true; upper.computeBoundingSphere();
      }
    }
    if (podiumRef.current) {
      flatBuildings.forEach((b, i) => {
        dummy.position.set(b.x, 2.4, b.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(b.width + 1.5, 3.6, b.depth + 1.5);
        dummy.updateMatrix(); podiumRef.current!.setMatrixAt(i, dummy.matrix);
      });
      podiumRef.current.instanceMatrix.needsUpdate = true;
      podiumRef.current.computeBoundingSphere();
    }
    if (crownRef.current) {
      crownBuildings.forEach((b, i) => {
        dummy.position.set(b.x, b.height + 2.3, b.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(b.width * 0.72, 4.2, b.depth * 0.72);
        dummy.updateMatrix(); crownRef.current!.setMatrixAt(i, dummy.matrix);
      });
      crownRef.current.instanceMatrix.needsUpdate = true;
      crownRef.current.computeBoundingSphere();
    }
    const equipment = roofEquipmentRef.current;
    if (equipment) {
      equipmentBuildings.forEach((b, index) => {
        dummy.position.set(b.x + b.width * 0.22, b.height + 1.65, b.z - b.depth * 0.18);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(Math.min(3, b.width * 0.27), 1.5, Math.min(2.5, b.depth * 0.24));
        dummy.updateMatrix();
        equipment.setMatrixAt(index, dummy.matrix);
      });
      equipment.instanceMatrix.needsUpdate = true;
      equipment.computeBoundingSphere();
    }
    if (solarRef.current) {
      solarBuildings.forEach((b, index) => {
        dummy.position.set(b.x - b.width * 0.12, b.height + 1.24, b.z);
        dummy.rotation.set(-0.15, 0, 0);
        dummy.scale.set(b.width * 0.48, 0.12, b.depth * 0.48);
        dummy.updateMatrix(); solarRef.current!.setMatrixAt(index, dummy.matrix);
      });
      solarRef.current.instanceMatrix.needsUpdate = true;
      solarRef.current.computeBoundingSphere();
    }
    if (gardenRef.current) {
      gardenBuildings.forEach((b, index) => {
        dummy.position.set(b.x, b.height + 1.18, b.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(b.width * 0.74, 0.22, b.depth * 0.74);
        dummy.updateMatrix(); gardenRef.current!.setMatrixAt(index, dummy.matrix);
      });
      gardenRef.current.instanceMatrix.needsUpdate = true;
      gardenRef.current.computeBoundingSphere();
    }
    const roofs = roofRef.current;
    if (roofs) {
      flatBuildings.forEach((b, index) => {
        dummy.position.set(b.x, b.height + 0.85, b.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(b.width * 1.025, 0.5, b.depth * 1.025);
        dummy.updateMatrix();
        roofs.setMatrixAt(index, dummy.matrix);
      });
      roofs.instanceMatrix.needsUpdate = true;
      roofs.computeBoundingSphere();
    }
    for (const [ref, isRoof] of [[roundBaseRef, false], [roundRoofRef, true]] as const) {
      const mesh = ref.current;
      if (!mesh) continue;
      roundBuildings.forEach((b, i) => {
        dummy.position.set(b.x, isRoof ? b.height + .85 : 2.4, b.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(b.width * (isRoof ? 1.05 : 1.09), isRoof ? .5 : 3.6, b.depth * (isRoof ? 1.05 : 1.09));
        dummy.updateMatrix();mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
    }
  }, [groups, upperGroups, city, dummy, equipmentBuildings, crownBuildings, solarBuildings, gardenBuildings, flatBuildings, roundBuildings]);
  useEffect(() => {
    mats.forEach((mat) => { mat.emissiveIntensity = 0.015 + night * 1.15; });
  }, [night, mats]);
  useEffect(() => () => {
    textures.forEach(({ map, emissive }) => { map.dispose(); emissive.dispose(); });
  }, [textures]);
  return <group>
    {groups.map((buildings, group) => buildings.length > 0 && (
      <instancedMesh
        key={group}
        ref={(mesh) => { refs.current[group] = mesh; }}
        args={[group < 30 ? box : group < 60 ? round : corner, mats[group % 30], buildings.length]}
        castShadow receiveShadow
        onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { document.body.style.cursor = 'auto'; }}
        onClick={(e: ThreeEvent<MouseEvent>) => {
          e.stopPropagation();
          const b = buildings[e.instanceId ?? -1];
          if (b) onSelect(b);
        }}
      />
    ))}
    {upperGroups.map((items, group) => items.length > 0 && <instancedMesh key={`upper-${group}`} ref={mesh => { upperRefs.current[group] = mesh; }} args={[group < 30 ? box : group < 60 ? round : corner, mats[group % 30], items.length]} castShadow receiveShadow />)}
    {flatBuildings.length > 0 && <instancedMesh ref={podiumRef} args={[box, podiumMat, flatBuildings.length]} castShadow receiveShadow />}
    {roundBuildings.length > 0 && <instancedMesh ref={roundBaseRef} args={[round, podiumMat, roundBuildings.length]} castShadow receiveShadow />}
    <instancedMesh ref={crownRef} args={[box, crownMat, crownBuildings.length]} castShadow receiveShadow />
    {flatBuildings.length > 0 && <instancedMesh ref={roofRef} args={[roofGeo, roofMat, flatBuildings.length]} castShadow receiveShadow />}
    {roundBuildings.length > 0 && <instancedMesh ref={roundRoofRef} args={[round, roofMat, roundBuildings.length]} castShadow receiveShadow />}
    <instancedMesh ref={roofEquipmentRef} args={[equipGeo, equipMat, equipmentBuildings.length]} castShadow />
    {solarBuildings.length > 0 && <instancedMesh ref={solarRef} args={[box, solarMat, solarBuildings.length]} castShadow/>}
    {gardenBuildings.length > 0 && <instancedMesh ref={gardenRef} args={[box, gardenMat, gardenBuildings.length]} receiveShadow/>}
    {selected && <mesh position={[selected.x, selected.height + 1.3, selected.z]}>
      <boxGeometry args={[selected.width + 1, 0.65, selected.depth + 1]}/>
      <meshBasicMaterial color="#d7a66a" transparent opacity={0.9}/>
    </mesh>}
  </group>;
}

/** Seeded tileable surface detail avoids flat, plastic-looking roads. */
function surfaceTexture(kind: 'asphalt' | 'paving') {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 256;
  const c = canvas.getContext('2d')!;
  c.fillStyle = kind === 'asphalt' ? '#3d4649' : '#aaa9a1';
  c.fillRect(0, 0, 256, 256);
  const random = rng(kind === 'asphalt' ? 9172 : 18191);
  for (let i = 0; i < 9500; i++) {
    const x = random() * 256, y = random() * 256;
    const alpha = 0.015 + random() * (kind === 'asphalt' ? 0.09 : 0.06);
    c.fillStyle = random() > 0.5 ? `rgba(240,243,239,${alpha})` : `rgba(8,15,17,${alpha})`;
    const size = 0.3 + random() * 1.6;
    c.fillRect(x, y, size, size);
  }
  if (kind === 'paving') {
    c.strokeStyle = 'rgba(69,72,69,0.11)'; c.lineWidth = 1;
    for (let i = 0; i <= 256; i += 32) {
      c.beginPath(); c.moveTo(i, 0); c.lineTo(i, 256); c.stroke();
      c.beginPath(); c.moveTo(0, i); c.lineTo(256, i); c.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(kind === 'asphalt' ? 2 : 1, kind === 'asphalt' ? 12 : 1);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function StreetGrid({ city }: Pick<CityWorldProps, 'city'>) {
  const size = city.size;
  const grid = city.grid;
  const cell = city.cell ?? 22;
  const roadWidth = cell >= 48 ? 13 : cell >= 40 ? 12 : cell >= 30 ? 8.5 : 5.8;
  const roads = useMemo(() => Array.from({ length: grid + 1 }, (_, i) => ({
    at: (i - grid / 2) * cell,
    width: cell >= 48 && isArterial(i, grid) ? 19 : cell >= 40 && isArterial(i, grid) ? 17 : roadWidth,
    arterial: cell >= 40 && isArterial(i, grid),
  })), [grid, cell, roadWidth]);
  const markings = useMemo(() => {
    const positions: { x: number; z: number; rot: number }[] = [];
    for (const r of roads) {
      for (let i = 0; i < grid * 3; i++) {
        const p = -size / 2 + (i + 0.5) * (size / (grid * 3));
        positions.push({ x: r.at, z: p, rot: 0 });
        positions.push({ x: p, z: r.at, rot: Math.PI / 2 });
      }
    }
    return positions;
  }, [roads, grid, size]);
  const crosswalks = useMemo(() => {
    const stripes: { x: number; z: number; rot: number }[] = [];
    for (const x of roads) for (const z of roads) {
      for (let k = -3; k <= 3; k++) {
        stripes.push({ x: x.at + k * 0.93, z: z.at + z.width / 2 + 1.15, rot: 0 });
        stripes.push({ x: x.at + x.width / 2 + 1.15, z: z.at + k * 0.93, rot: Math.PI / 2 });
      }
    }
    return stripes;
  }, [roads, roadWidth]);
  const dashRef = useRef<THREE.InstancedMesh>(null);
  const crossRef = useRef<THREE.InstancedMesh>(null);
  const sidewalkRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const roadTexture = useMemo(() => surfaceTexture('asphalt'), []);
  const pavingTexture = useMemo(() => surfaceTexture('paving'), []);
  const roadMat = useMemo(() => new THREE.MeshStandardMaterial({ map: roadTexture, color: '#ffffff', roughness: 0.96 }), [roadTexture]);
  const sidewalkMat = useMemo(() => new THREE.MeshStandardMaterial({ map: pavingTexture, color: '#ffffff', roughness: 0.93 }), [pavingTexture]);
  useEffect(() => () => { roadTexture.dispose(); pavingTexture.dispose(); roadMat.dispose(); sidewalkMat.dispose(); }, [roadTexture, pavingTexture, roadMat, sidewalkMat]);
  const dashMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e1d6ae', roughness: 1 }), []);
  const crossMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#dedfd7', roughness: 1 }), []);
  useEffect(() => {
    if (crossRef.current) {
      crosswalks.forEach((p, i) => {
        dummy.position.set(p.x, 0.26, p.z);
        dummy.rotation.set(0, p.rot, 0);
        dummy.scale.set(0.64, 0.025, 1.8);
        dummy.updateMatrix(); crossRef.current!.setMatrixAt(i, dummy.matrix);
      });
      crossRef.current.instanceMatrix.needsUpdate = true;
      crossRef.current.computeBoundingSphere();
    }
    if (dashRef.current) {
      markings.forEach((p, i) => {
        dummy.position.set(p.x, 0.25, p.z);
        dummy.rotation.set(0, p.rot, 0);
        dummy.scale.set(0.15, 0.03, cell >= 30 ? 3.2 : 2.4);
        dummy.updateMatrix(); dashRef.current!.setMatrixAt(i, dummy.matrix);
      });
      dashRef.current.instanceMatrix.needsUpdate = true;
      dashRef.current.computeBoundingSphere();
    }
    if (sidewalkRef.current) {
      for (let row = 0; row < grid; row++) for (let col = 0; col < grid; col++) {
        const x = (col - (grid - 1) / 2) * cell;
        const z = (row - (grid - 1) / 2) * cell;
        dummy.position.set(x, 0.33, z);
        dummy.rotation.set(0, 0, 0);
        const diagonalDistance = Math.abs(x * .32 - z * .42) / Math.hypot(.32,.42);
        const cleared = city.boulevard && diagonalDistance < 30 && Math.abs(x) < size*.41 && Math.abs(z) < size*.32;
        const extent = cell - (cell >= 48 ? 20 : cell >= 40 ? 18 : roadWidth + 1.5);
        dummy.scale.set(cleared ? 0 : extent, cleared ? 0 : .46, cleared ? 0 : extent);
        dummy.updateMatrix(); sidewalkRef.current.setMatrixAt(row * grid + col, dummy.matrix);
      }
      sidewalkRef.current.instanceMatrix.needsUpdate = true;
      sidewalkRef.current.computeBoundingSphere();
    }
  }, [markings, crosswalks, grid, cell, roadWidth, dummy, city.boulevard, size]);
  return <group>
    {cell < 48 && <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, -0.08, 0]}>
      <planeGeometry args={[2400, 2400]}/>
      <meshStandardMaterial color="#748c75" roughness={1}/>
    </mesh>}
    {cell < 48 && <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow position={[0, 0.04, 0]}>
      <planeGeometry args={[size + 16, size + 16]}/>
      <primitive object={roadMat} attach="material"/>
    </mesh>}
    {roads.map((r, i) => <group key={i}>
      <mesh position={[r.at, 0.12, 0]} receiveShadow>
        <boxGeometry args={[r.width, 0.13, size + 12]}/>
        <primitive object={roadMat} attach="material"/>
      </mesh>
      <mesh position={[0, 0.14, r.at]} receiveShadow>
        <boxGeometry args={[size + 12, 0.13, r.width]}/>
        <primitive object={roadMat} attach="material"/>
      </mesh>
    </group>)}
    <instancedMesh ref={sidewalkRef} args={[geo, sidewalkMat, grid * grid]} receiveShadow />
    <instancedMesh ref={dashRef} args={[geo, dashMat, markings.length]} />
    <instancedMesh ref={crossRef} args={[geo, crossMat, crosswalks.length]} />
  </group>;
}

/** Real diagonal avenue; new V6 parcels are cleared before the road is drawn. */
function DiagonalBoulevard({ city }: { city: CityData }) {
  const size = city.size;
  const length = Math.hypot(size*.84, size*.64);
  const angle = Math.atan2(.84,.64);
  const dashCount = Math.floor(length/15);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const dashRef = useRef<THREE.InstancedMesh>(null);
  const dashGeo = useMemo(() => new THREE.BoxGeometry(1,1,1), []);
  const asphalt = useMemo(() => new THREE.MeshStandardMaterial({ color: '#42494a', roughness: .95 }), []);
  const stone = useMemo(() => new THREE.MeshStandardMaterial({ color: '#a6a59c', roughness: .9 }), []);
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e7d9ae', roughness: 1 }), []);
  useEffect(() => {
    const mesh=dashRef.current;if(!mesh)return;
    for(let i=0;i<dashCount;i++){
      const along=(i+.5)*15-length/2;
      dummy.position.set(Math.sin(angle)*along,.39,Math.cos(angle)*along);
      dummy.rotation.set(0,angle,0);dummy.scale.set(.16,.025,5.1);
      dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate=true;mesh.computeBoundingSphere();
  },[dashCount,length,angle,dummy]);
  return <group>
    <mesh position={[0,.24,0]} rotation={[0,angle,0]} receiveShadow>
      <boxGeometry args={[19,.21,length]}/><primitive object={asphalt} attach="material"/>
    </mesh>
    {[-1,1].map(side=><mesh key={side} position={[side*10.8*Math.cos(angle),.37,-side*10.8*Math.sin(angle)]} rotation={[0,angle,0]} receiveShadow>
      <boxGeometry args={[2.7,.25,length]}/><primitive object={stone} attach="material"/>
    </mesh>)}
    <instancedMesh ref={dashRef} args={[dashGeo,paint,dashCount]}/>
  </group>;
}

const EMPTY_PLAZAS: Plaza[] = [];
function PublicSpaces({ city }: { city: CityData }) {
  const plazas = city.plazas ?? EMPTY_PLAZAS;
  const paving = useRef<THREE.InstancedMesh>(null);
  const fountains = useRef<THREE.InstancedMesh>(null);
  const paths = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const box = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const circle = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 24), []);
  const stone = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b9b6ac', roughness: 0.91 }), []);
  const water = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#4e8493', roughness: 0.12, metalness: 0.36, clearcoat: 0.7 }), []);
  const pathMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c5c1ae', roughness: 0.98 }), []);
  useEffect(() => {
    plazas.forEach((p, i) => {
      if (paving.current) {
        dummy.position.set(p.x, 0.61, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(p.size - 1, 0.12, p.size - 1);
        dummy.updateMatrix(); paving.current.setMatrixAt(i, dummy.matrix);
      }
      if (fountains.current) {
        dummy.position.set(p.x, 0.79, p.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(p.variant === 0 ? 3.5 : 2.2, 0.22, p.variant === 0 ? 3.5 : 2.2);
        dummy.updateMatrix(); fountains.current.setMatrixAt(i, dummy.matrix);
      }
    });
    city.parks.forEach((p, i) => {
      if (!paths.current) return;
      dummy.position.set(p.x, 0.76, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(p.size * 0.9, 0.05, 1.45);
      dummy.updateMatrix(); paths.current.setMatrixAt(i * 2, dummy.matrix);
      dummy.scale.set(1.45, 0.05, p.size * 0.9);
      dummy.updateMatrix(); paths.current.setMatrixAt(i * 2 + 1, dummy.matrix);
    });
    for (const mesh of [paving.current, fountains.current, paths.current]) {
      if (mesh) { mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingSphere(); }
    }
  }, [plazas, city.parks, dummy]);
  return <group>
    {plazas.length > 0 && <instancedMesh ref={paving} args={[box, stone, plazas.length]} receiveShadow/>}
    {plazas.length > 0 && <instancedMesh ref={fountains} args={[circle, water, plazas.length]}/>}
    {city.parks.length > 0 && <instancedMesh ref={paths} args={[box, pathMat, city.parks.length * 2]} receiveShadow/>}
  </group>;
}

/** Low-cost city dressing: instanced curb stones, street signals, benches and transit shelters. */
function UrbanDetails({ city, night }: { city: CityData; night: number }) {
  const cell = city.cell ?? 22;
  const curbs = useMemo(() => {
    const items: { x: number; z: number; rot: number }[] = [];
    if (cell < 40) return items;
    for (let row = 0; row < city.grid; row++) for (let col = 0; col < city.grid; col++) {
      const x = (col - (city.grid - 1) / 2) * cell;
      const z = (row - (city.grid - 1) / 2) * cell;
      for (const sign of [-1, 1]) {
        items.push({ x: x + sign * (cell >= 48 ? 14.2 : 12.3), z, rot: 0 });
        items.push({ x, z: z + sign * (cell >= 48 ? 14.2 : 12.3), rot: Math.PI / 2 });
      }
    }
    return items;
  }, [city.grid, cell]);
  const benches = useMemo(() => {
    if (cell < 40) return [];
    return [...city.parks, ...(city.plazas ?? [])].flatMap((p, i) => [
      { x: p.x - 6.5, z: p.z + 5, rot: i % 2 ? Math.PI / 2 : 0 },
      { x: p.x + 6.5, z: p.z - 5, rot: i % 2 ? Math.PI / 2 : 0 },
    ]);
  }, [city.parks, city.plazas, cell]);
  const signals = useMemo(() => {
    const items: { x: number; z: number }[] = [];
    if (cell < 40) return items;
    for (let row = 0; row <= city.grid; row += 2) for (let col = 0; col <= city.grid; col += 2) {
      items.push({ x: (col - city.grid / 2) * cell + 11, z: (row - city.grid / 2) * cell + 11 });
    }
    return items;
  }, [city.grid, cell]);
  const shelters = useMemo(() => {
    const items: { x: number; z: number }[] = [];
    if (cell < 40) return items;
    for (let row = 2; row < city.grid - 1; row += 5) {
      items.push({ x: -city.size / 2 + cell * 5 + 13, z: (row - (city.grid - 1) / 2) * cell });
    }
    return items;
  }, [city.grid, city.size, cell]);
  const curbRef = useRef<THREE.InstancedMesh>(null);
  const benchRef = useRef<THREE.InstancedMesh>(null);
  const signalRef = useRef<THREE.InstancedMesh>(null);
  const lampRef = useRef<THREE.InstancedMesh>(null);
  const shelterRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const curbMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d4d0c5', roughness: 0.95 }), []);
  const benchMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#82684f', roughness: 0.84 }), []);
  const metalMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#505d61', roughness: 0.5, metalness: 0.65 }), []);
  const lightMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#edb17c', emissive: '#ef7d4e', emissiveIntensity: 0.2 }), []);
  const glassMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#78969c', metalness: 0.38, roughness: 0.24, transparent: true, opacity: 0.83 }), []);
  useEffect(() => { lightMat.emissiveIntensity = 0.2 + night * 1.8; }, [night, lightMat]);
  useEffect(() => {
    const write = (ref: RefObject<THREE.InstancedMesh | null>, items: { x: number; z: number; rot?: number }[],
      y: number, sx: number, sy: number, sz: number) => {
      if (!ref.current) return;
      items.forEach((item, i) => {
        dummy.position.set(item.x, y, item.z);
        dummy.rotation.set(0, item.rot ?? 0, 0);
        dummy.scale.set(sx, sy, sz);
        dummy.updateMatrix(); ref.current!.setMatrixAt(i, dummy.matrix);
      });
      ref.current.instanceMatrix.needsUpdate = true;
      ref.current.computeBoundingSphere();
    };
    write(curbRef, curbs, 0.56, 0.28, 0.3, 24);
    write(benchRef, benches, 1.05, 2.6, 0.3, 0.9);
    write(signalRef, signals, 3.2, 0.2, 6.1, 0.2);
    write(lampRef, signals, 6.2, 0.54, 1.15, 0.42);
    write(shelterRef, shelters, 3.1, 5.4, 0.24, 2.8);
  }, [curbs, benches, signals, shelters, dummy]);
  if (cell < 40) return null;
  return <group>
    <instancedMesh ref={curbRef} args={[geo, curbMat, curbs.length]} receiveShadow/>
    <instancedMesh ref={benchRef} args={[geo, benchMat, benches.length]} castShadow/>
    <instancedMesh ref={signalRef} args={[geo, metalMat, signals.length]}/>
    <instancedMesh ref={lampRef} args={[geo, lightMat, signals.length]}/>
    <instancedMesh ref={shelterRef} args={[geo, glassMat, shelters.length]} castShadow/>
  </group>;
}

function ParkGround({ city }: { city: CityData }) {
  const parkRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#668b5d', roughness: 1 }), []);
  useEffect(() => {
    if (!parkRef.current) return;
    city.parks.forEach((p, i) => {
      dummy.position.set(p.x, 0.6, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(p.size - 0.3, 0.12, p.size - 0.3);
      dummy.updateMatrix();
      parkRef.current!.setMatrixAt(i, dummy.matrix);
    });
    parkRef.current.instanceMatrix.needsUpdate = true;
    parkRef.current.computeBoundingSphere();
  }, [city.parks, dummy]);
  return <instancedMesh ref={parkRef} args={[geo, mat, city.parks.length]} receiveShadow/>;
}

function StreetFurniture({ city, night }: { city: CityData; night: number }) {
  const lights = useMemo(() => {
    const arr: { x: number; z: number }[] = [];
    const cell = city.cell ?? 22;
    for (let row = 0; row < city.grid; row += 2) for (let col = 0; col < city.grid; col += 2) {
      arr.push({
        x: (col - (city.grid - 1) / 2) * cell + cell * 0.32,
        z: (row - (city.grid - 1) / 2) * cell + cell * 0.32,
      });
    }
    return arr;
  }, [city]);
  const poleRef = useRef<THREE.InstancedMesh>(null);
  const bulbRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const poleGeo = useMemo(() => new THREE.CylinderGeometry(0.07, 0.13, 1, 6), []);
  const poleMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#4a5153', metalness: 0.6, roughness: 0.6 }), []);
  const bulbGeo = useMemo(() => new THREE.SphereGeometry(1, 6, 4), []);
  const bulbMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e7caa1', emissive: '#ffcf8d', emissiveIntensity: 0.01 }), []);
  useEffect(() => { bulbMat.emissiveIntensity = night * 2.5; }, [night, bulbMat]);
  useEffect(() => {
    lights.forEach((light, i) => {
      if (poleRef.current) {
        dummy.position.set(light.x, 3.7, light.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.set(1, 7.4, 1);
        dummy.updateMatrix(); poleRef.current.setMatrixAt(i, dummy.matrix);
      }
      if (bulbRef.current) {
        dummy.position.set(light.x, 7.5, light.z);
        dummy.scale.set(0.5, 0.28, 0.5);
        dummy.updateMatrix(); bulbRef.current.setMatrixAt(i, dummy.matrix);
      }
    });
    if (poleRef.current) { poleRef.current.instanceMatrix.needsUpdate = true; poleRef.current.computeBoundingSphere(); }
    if (bulbRef.current) { bulbRef.current.instanceMatrix.needsUpdate = true; bulbRef.current.computeBoundingSphere(); }
  }, [lights, dummy]);
  return <group>
    <instancedMesh ref={poleRef} args={[poleGeo, poleMat, lights.length]} />
    <instancedMesh ref={bulbRef} args={[bulbGeo, bulbMat, lights.length]} />
  </group>;
}

function LegacyTraffic({ city, seed, enabled, night }: { city: CityData; seed: number; enabled: boolean; night: number }) {
  const count = Math.min(140, Math.round(city.grid * city.grid * 0.23));
  const bodyRef = useRef<THREE.InstancedMesh>(null);
  const cabinRef = useRef<THREE.InstancedMesh>(null);
  const lightsRef = useRef<THREE.InstancedMesh>(null);
  const wheelsRef = useRef<THREE.InstancedMesh>(null);
  const cars = useMemo(() => {
    const random = rng(seed + 4135);
    return Array.from({ length: count }, () => ({
      axis: random() > 0.5 ? 'x' : 'z',
      street: Math.floor(random() * (city.grid + 1)),
      offset: random() * city.size,
      speed: 7 + random() * 13,
      direction: random() > 0.5 ? 1 : -1,
      color: Math.floor(random() * 6),
    }));
  }, [count, seed, city.grid, city.size]);
  const elapsed = useRef(0);
  const root = useMemo(() => new THREE.Object3D(), []);
  const part = useMemo(() => new THREE.Object3D(), []);
  const transform = useMemo(() => new THREE.Matrix4(), []);
  const geo = useMemo(() => new THREE.BoxGeometry(1, 1, 1), []);
  const bodyMat = useMemo(() => new THREE.MeshPhysicalMaterial({ color: '#ffffff', metalness: 0.6, roughness: 0.3, clearcoat: 0.7 }), []);
  const glassMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#33444d', metalness: 0.48, roughness: 0.2 }), []);
  const lightMat = useMemo(() => new THREE.MeshBasicMaterial({ color: '#fff0cb' }), []);
  const wheelGeo = useMemo(() => new THREE.CylinderGeometry(0.36, 0.36, 0.22, 8), []);
  const wheelMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#202428', roughness: 0.96 }), []);
  useFrame((_state, delta) => {
    if (!enabled || !bodyRef.current || !cabinRef.current || !lightsRef.current || !wheelsRef.current) return;
    elapsed.current += Math.min(delta, 0.1);
    cars.forEach((car, i) => {
      const lane = car.direction * 1.75;
      const along = ((car.offset + elapsed.current * car.speed * car.direction) % city.size + city.size) % city.size - city.size / 2;
      const road = (car.street - city.grid / 2) * (city.cell ?? 22);
      if (car.axis === 'x') {
        root.position.set(along, 0.82, road + lane);
        root.rotation.set(0, car.direction > 0 ? Math.PI / 2 : -Math.PI / 2, 0);
      } else {
        root.position.set(road + lane, 0.82, along);
        root.rotation.set(0, car.direction > 0 ? 0 : Math.PI, 0);
      }
      root.scale.set(1, 1, 1);
      root.updateMatrix();
      part.rotation.set(0, 0, 0);
      part.position.set(0, 0, 0);
      part.scale.set(1.7, 0.75, 3.7);
      part.updateMatrix(); transform.multiplyMatrices(root.matrix, part.matrix);
      bodyRef.current!.setMatrixAt(i, transform);
      part.position.set(0, 0.58, -0.15);
      part.scale.set(1.42, 0.76, 2.0);
      part.updateMatrix(); transform.multiplyMatrices(root.matrix, part.matrix);
      cabinRef.current!.setMatrixAt(i, transform);
      for (let k = 0; k < 2; k++) {
        part.position.set(k === 0 ? -0.53 : 0.53, 0.07, 1.9);
        part.scale.set(0.30, 0.20, 0.09);
        part.updateMatrix(); transform.multiplyMatrices(root.matrix, part.matrix);
        lightsRef.current!.setMatrixAt(i * 2 + k, transform);
      }
      for (let k = 0; k < 4; k++) {
        part.position.set(k % 2 === 0 ? -0.83 : 0.83, -0.40, k < 2 ? -1.1 : 1.1);
        part.rotation.set(0, 0, Math.PI / 2);
        part.scale.set(1, 1, 1);
        part.updateMatrix(); transform.multiplyMatrices(root.matrix, part.matrix);
        wheelsRef.current!.setMatrixAt(i * 4 + k, transform);
      }
    });
    for (const mesh of [bodyRef.current, cabinRef.current, lightsRef.current, wheelsRef.current]) mesh.instanceMatrix.needsUpdate = true;
  });
  useEffect(() => {
    if (!bodyRef.current) return;
    const colors = ['#c9d0d0', '#1b2d37', '#b7c2be', '#7d8b9c', '#9a6e59', '#e0ddd4'];
    cars.forEach((car, i) => bodyRef.current!.setColorAt(i, new THREE.Color(colors[car.color])));
    if (bodyRef.current.instanceColor) bodyRef.current.instanceColor.needsUpdate = true;
  }, [cars]);
  return <group visible={enabled}>
    <instancedMesh ref={bodyRef} args={[geo, bodyMat, count]} castShadow/>
    <instancedMesh ref={cabinRef} args={[geo, glassMat, count]} castShadow/>
    <instancedMesh ref={lightsRef} args={[geo, lightMat, count * 2]} visible={night > 0.35}/>
    <instancedMesh ref={wheelsRef} args={[wheelGeo, wheelMat, count * 4]}/>
  </group>;
}

function Rain({ city, active }: { city: CityData; active: boolean }) {
  const count = 1000;
  const points = useRef<THREE.Points>(null);
  const positions = useMemo(() => {
    const random = rng(2183);
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (random() - 0.5) * city.size * 1.2;
      arr[i * 3 + 1] = random() * 160;
      arr[i * 3 + 2] = (random() - 0.5) * city.size * 1.2;
    }
    return arr;
  }, [city.size]);
  useFrame((_state, delta) => {
    if (!active || !points.current) return;
    const geometry = points.current.geometry;
    const a = geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < count; i++) {
      let y = a.getY(i) - delta * 65;
      if (y < 0) y += 160;
      a.setY(i, y);
    }
    a.needsUpdate = true;
  });
  return <points ref={points} visible={active} frustumCulled={false}>
    <bufferGeometry>
      <bufferAttribute attach="attributes-position" args={[positions, 3]}/>
    </bufferGeometry>
    <pointsMaterial color="#c6d7e3" size={1.2} transparent opacity={0.48} depthWrite={false}/>
  </points>;
}

function Atmosphere({ time, weather, quality, night, city }: CityWorldProps) {
  const { scene } = useThree();
  const isDay = Math.max(0, Math.sin((time - 6) / 12 * Math.PI));
  const background = useMemo(() => new THREE.Color(), []);
  useEffect(() => {
    const day = new THREE.Color('#a7c5d7');
    const evening = new THREE.Color('#d8b7a2');
    const dark = new THREE.Color('#121d2c');
    background.copy(dark).lerp(evening, Math.min(1, isDay * 1.8)).lerp(day, Math.pow(isDay, 1.5) * 0.9);
    if (weather === 'rain') background.lerp(new THREE.Color('#465766'), 0.48);
    if (weather === 'haze') background.lerp(new THREE.Color('#9b9c93'), 0.3);
    scene.background = background.clone();
    scene.fog = new THREE.Fog(background.clone(), weather === 'haze' ? 380 : weather === 'rain' ? 430 : 1450, weather === 'haze' ? 1120 : weather === 'rain' ? 1550 : 3000);
    return () => { scene.fog = null; };
  }, [scene, background, isDay, weather]);
  return <>
    {isDay > 0.18 && <Sky distance={1800} sunPosition={[-120, Math.max(8, isDay * 220), -140]}
      turbidity={weather === 'haze' ? 10 : 1.8} rayleigh={1.25} mieCoefficient={0.002} mieDirectionalG={0.8} />}
    {night > 0.65 && weather === 'clear' && <Stars radius={1100} depth={350} count={450} factor={3} saturation={0} fade speed={0.25}/>}
    <ambientLight intensity={0.45 + isDay * 0.80} color={isDay > 0.5 ? '#f1f6fa' : '#91a4bc'}/>
    <hemisphereLight args={['#dcebf5', '#667568', 0.48 + isDay * 0.62]}/>
    <directionalLight
      position={[-130, 190, -100]}
      intensity={0.18 + isDay * 2.75}
      color={isDay > 0.55 ? '#fff3dd' : '#f8b785'}
      castShadow={quality === 'cinematic'}
      shadow-mapSize={[2048, 2048]}
      shadow-camera-left={-Math.min(city.size * 0.6, 280)}
      shadow-camera-right={Math.min(city.size * 0.6, 280)}
      shadow-camera-top={Math.min(city.size * 0.6, 280)}
      shadow-camera-bottom={-Math.min(city.size * 0.6, 280)}
      shadow-camera-near={0.5}
      shadow-camera-far={800}
      shadow-bias={-0.00015}
    />
    {night > 0.5 && <pointLight position={[0, 80, 0]} color="#c0d4f1" intensity={18} distance={350} decay={2}/>}
  </>;
}

function CameraRig({ city, onReady, cameraMode, resetCamera }: {
  city: CityData; onReady?: () => void; cameraMode: CameraMode; resetCamera: number;
}) {
  const controls = useRef<ComponentRef<typeof OrbitControls>>(null);
  const keys = useRef<Set<string>>(new Set());
  const { gl, camera } = useThree();
  useEffect(() => {
    const timeout = window.setTimeout(() => onReady?.(), 550);
    return () => window.clearTimeout(timeout);
  }, [onReady]);
  useEffect(() => { gl.domElement.style.touchAction = 'none'; }, [gl]);
  useEffect(() => {
    const target = controls.current;
    if (!target) return;
    if (cameraMode === 'street') {
      camera.position.set(2, 2.65, city.size * 0.28);
      target.target.set(0, 2.6, city.size * 0.28 - 38);
    } else {
      camera.position.set(city.size * 0.47, city.size * 0.23, city.size * 0.61);
      target.target.set(0, 24, 0);
    }
    target.update();
  }, [cameraMode, resetCamera, city.size, camera]);
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [contenteditable="true"]')) return;
      keys.current.add(e.key.toLowerCase());
    };
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase());
    const blur = () => keys.current.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, []);
  const forward = useMemo(() => new THREE.Vector3(), []);
  const right = useMemo(() => new THREE.Vector3(), []);
  const move = useMemo(() => new THREE.Vector3(), []);
  useFrame((_state, delta) => {
    const ctrl = controls.current;
    if (!ctrl) return;
    if (cameraMode === 'cinema') {
      const elapsed = _state.clock.elapsedTime * 0.07;
      const radius = city.size * 0.61;
      camera.position.set(Math.sin(elapsed) * radius, city.size * 0.22 + Math.sin(elapsed * 0.47) * 24, Math.cos(elapsed) * radius);
      ctrl.target.set(0, 32, 0);
      ctrl.update();
      return;
    }
    if (cameraMode !== 'street') return;
    forward.subVectors(ctrl.target, camera.position).setY(0).normalize();
    right.crossVectors(forward, camera.up).normalize();
    move.set(0, 0, 0);
    if (keys.current.has('w') || keys.current.has('arrowup')) move.add(forward);
    if (keys.current.has('s') || keys.current.has('arrowdown')) move.sub(forward);
    if (keys.current.has('d') || keys.current.has('arrowright')) move.add(right);
    if (keys.current.has('a') || keys.current.has('arrowleft')) move.sub(right);
    if (move.lengthSq() === 0) return;
    move.normalize().multiplyScalar(Math.min(delta, 0.05) * (keys.current.has('shift') ? 70 : 30));
    const bound = city.size * 0.48;
    const nextX = THREE.MathUtils.clamp(camera.position.x + move.x, -bound, bound);
    const nextZ = THREE.MathUtils.clamp(camera.position.z + move.z, -bound, bound);
    move.set(nextX - camera.position.x, 0, nextZ - camera.position.z);
    camera.position.add(move);
    ctrl.target.add(move);
    ctrl.update();
  });
  return <>
    <PerspectiveCamera makeDefault position={[city.size * 0.47, city.size * 0.23, city.size * 0.61]} fov={48} near={0.3} far={3500}/>
    <OrbitControls ref={controls} makeDefault target={[0, 24, 0]}
      minDistance={cameraMode === 'street' ? 5 : 28}
      maxDistance={cameraMode === 'street' ? 95 : city.size * 1.9}
      maxPolarAngle={Math.PI / 2.015} minPolarAngle={0.13}
      enableDamping dampingFactor={0.07} rotateSpeed={0.45}
      zoomSpeed={0.85} panSpeed={0.65} enablePan={cameraMode !== 'cinema'} enableRotate={cameraMode !== 'cinema'} enableZoom={cameraMode !== 'cinema'}/>
  </>;
}

function CityWorld(props: SceneProps) {
  const night = Math.max(0, 1 - Math.max(0, Math.sin((props.time - 6) / 12 * Math.PI)) * 2.4);
  return <group onPointerMissed={() => props.onSelect(null)}>
    <Atmosphere {...props} night={night}/>
    {(props.city.cell ?? 22) >= 48 && <TerrainWorld city={props.city} seed={props.seed}/>}
    <StreetGrid city={props.city}/>
    {props.city.boulevard && <DiagonalBoulevard city={props.city}/>}
    <Buildings city={props.city} night={night} selected={props.selected} onSelect={props.onSelect}/>
    <ParkGround city={props.city}/>
    <Suspense fallback={null}><NaturalTrees city={props.city} quality={props.quality}/></Suspense>
    <PublicSpaces city={props.city}/>
    <StreetFurniture city={props.city} night={night}/>
    <UrbanDetails city={props.city} night={night}/>
    {(props.city.cell ?? 22) >= 48 ? <>
      <Suspense fallback={null}><VehicleTraffic city={props.city} seed={props.seed} enabled={props.traffic} night={night}/></Suspense>
      <TrafficSignals city={props.city}/>
    </> : <LegacyTraffic city={props.city} seed={props.seed} enabled={props.traffic} night={night}/>}
    <Rain city={props.city} active={props.weather === 'rain'}/>
    <RealityDressing city={props.city} seed={props.seed} night={night} quality={props.quality} traffic={props.traffic}/>
    <Suspense fallback={null}><PedestrianLife city={props.city} seed={props.seed}/></Suspense>
    <CameraRig city={props.city} cameraMode={props.cameraMode} resetCamera={props.resetCamera} onReady={props.onReady}/>
  </group>;
}

export default function CityScene(props: SceneProps) {
  return <Canvas
    key={`${props.seed}-${props.city.grid}-${props.city.cell ?? 22}`}
    className="eon-canvas"
    dpr={props.quality === 'cinematic' ? [1, 1.8] : [1, 1.3]}
    shadows={props.quality === 'cinematic'}
    gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
    onCreated={({ gl }) => { gl.setClearColor('#121d2c'); gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = 1.08; }}
    onPointerMissed={() => props.onSelect(null)}
    fallback={<div className="webgl-error">Tu navegador no admite WebGL.</div>}
  >
    <CityWorld {...props} />
  </Canvas>;
}
