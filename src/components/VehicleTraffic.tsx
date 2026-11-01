'use client';

/** EON V7 / Vehicle Engine.
 * Five locally bundled ORIGINAL glTF vehicle models (sedan, SUV, hatchback,
 * delivery van, bus), with sloped windshields, real wheel silhouettes,
 * lights, door details, color variation and animated wheels.
 *
 * Dynamic pool: only the closest vehicles are rendered, while the full
 * deterministic traffic population is simulated. No network model fetches.
 */
import { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { type CityData, rng, isArterial } from '@/lib/city';

const MODELS = ['sedan', 'suv', 'hatchback', 'van', 'bus'] as const;
const POOL_SIZES = [20, 13, 10, 8, 7];
const PAINT_COLORS = ['#c8d1d3', '#25465c', '#a7adb0', '#ab4338', '#c9a774', '#e0e3de', '#253136', '#647c69', '#637a96'];
const CYCLE = 28;

type Vehicle = {
  model: number;
  color: number;
  axis: 'x' | 'z';
  street: number;
  direction: 1 | -1;
  progress: number;
  speed: number;
  velocity: number;
  distance: number;
};
type VehicleSlot = { model: number; scene: THREE.Group; wheels: THREE.Object3D[] };

function makeVehicles(city: CityData, seed: number): Vehicle[] {
  const random = rng(seed ^ 0xB03A19);
  const count = Math.min(152, Math.round(city.grid * city.grid * .36));
  const cell = city.cell ?? 48;
  const result: Vehicle[] = [];
  for (let i = 0; i < count; i++) {
    const roll = random();
    const model = roll < .42 ? 0 : roll < .64 ? 1 : roll < .81 ? 2 : roll < .92 ? 3 : 4;
    const axis = random() > .5 ? 'x' : 'z';
    let street = Math.floor(random() * (city.grid + 1));
    if (model === 4) {
      const arterial = Array.from({ length: city.grid + 1 }, (_, n) => n).filter(n => isArterial(n, city.grid));
      street = arterial[Math.floor(random() * arterial.length)];
    }
    // Populate the boulevard seen from the default STREET camera.
    if (i < 10) street = Math.floor(city.grid / 2) + (i % 3) - 1;
    const direction: 1 | -1 = random() > .5 ? 1 : -1;
    const progress = i < 10
      ? (city.size * .5 + city.size * .28 - i * 13 + cell * .5) % city.size
      : random() * city.size;
    const speed = (model === 4 ? 5.1 : model === 3 ? 6.6 : 8.5) + random() * 3.8;
    result.push({ model, color: Math.floor(random() * PAINT_COLORS.length), axis, street,
      direction, progress, speed, velocity: speed, distance: 0 });
  }
  return result;
}

function getCarPosition(car: Vehicle, city: CityData) {
  const cell = city.cell ?? 48;
  const arterial = isArterial(car.street, city.grid);
  const lane = car.direction * (arterial ? 4.35 : 3.0);
  const along = car.progress - city.size / 2;
  const road = (car.street - city.grid / 2) * cell;
  if (car.axis === 'x') return { x: along, z: road + lane, rotation: car.direction > 0 ? Math.PI / 2 : -Math.PI / 2 };
  return { x: road + lane, z: along, rotation: car.direction > 0 ? 0 : Math.PI };
}

function greenFor(axis: 'x' | 'z', phase: number) {
  return axis === 'z' ? phase < 12 : phase >= 14 && phase < 26;
}

export default function VehicleTraffic({ city, seed, enabled, night }: {
  city: CityData; seed: number; enabled: boolean; night: number;
}) {
  const sedan = useGLTF('/assets/vehicles/sedan.glb');
  const suv = useGLTF('/assets/vehicles/suv.glb');
  const hatchback = useGLTF('/assets/vehicles/hatchback.glb');
  const van = useGLTF('/assets/vehicles/van.glb');
  const bus = useGLTF('/assets/vehicles/bus.glb');
  const sourceScenes = useMemo(() => [sedan.scene, suv.scene, hatchback.scene, van.scene, bus.scene], [sedan, suv, hatchback, van, bus]);
  const vehicles = useMemo(() => makeVehicles(city, seed), [city, seed]);
  const { camera } = useThree();
  const holders = useRef<Array<THREE.Group | null>>([]);
  const assignments = useRef<Array<Vehicle | null>>([]);
  const refreshTimer = useRef(1);
  const materials = useMemo(() => {
    const paint = PAINT_COLORS.map(color => new THREE.MeshPhysicalMaterial({ color, vertexColors: true,
      metalness: .57, roughness: .28, clearcoat: .84, clearcoatRoughness: .18 }));
    return {
      paint,
      glass: new THREE.MeshPhysicalMaterial({ color: '#d9e5ee', vertexColors: true, metalness: .35, roughness: .12, clearcoat: 1 }),
      trim: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .15, roughness: .7 }),
      wheel: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .14, roughness: .72 }),
      metal: new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .75, roughness: .28 }),
      lamps: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    };
  }, []);
  const slots = useMemo<VehicleSlot[]>(() => {
    return MODELS.flatMap((_name, model) => Array.from({ length: POOL_SIZES[model] }, (_, i) => {
      const scene = sourceScenes[model].clone(true);
      const color = (i * 7 + model * 3) % PAINT_COLORS.length;
      const wheels: THREE.Object3D[] = [];
      scene.traverse(obj => {
        if (!(obj instanceof THREE.Mesh)) return;
        const key = obj.name.toLowerCase();
        if (key === 'paint') obj.material = materials.paint[color];
        else if (key === 'glass') obj.material = materials.glass;
        else if (key === 'trim') obj.material = materials.trim;
        else if (key === 'metal') obj.material = materials.metal;
        else if (key.startsWith('wheel_')) { obj.material = materials.wheel; wheels.push(obj); }
        else obj.material = materials.lamps;
        obj.castShadow = key !== 'glass' && key !== 'headlights' && key !== 'taillights';
        obj.receiveShadow = false;
      });
      return { model, scene, wheels };
    }));
  }, [sourceScenes, materials]);
  const { paint, glass, trim, wheel, metal, lamps } = materials;
  // All shared materials are owned by this component; GLB geometries stay cached.
  // (Unmounting the canvas releases WebGL resources.)
  void paint; void glass; void trim; void wheel; void metal; void lamps;

  useFrame(({ clock }, delta) => {
    if (!enabled) {
      for (const holder of holders.current) if (holder) holder.visible = false;
      return;
    }
    const dt = Math.min(delta, .065);
    const phase = clock.elapsedTime % CYCLE;
    for (const car of vehicles) {
      const cell = city.cell ?? 48;
      const local = ((car.progress % cell) + cell) % cell;
      const dist = car.direction > 0 ? cell - local : local;
      const green = greenFor(car.axis, phase);
      // Approach a stop line 7 m before a crossing on red. This is a visual
      // signal simulation, not a microscopic traffic engineering model.
      const braking = !green && dist > 6.5 && dist < 24;
      const target = braking ? Math.min(car.speed, Math.max(0, (dist - 7.1) * 1.8)) : car.speed;
      car.velocity += (target - car.velocity) * Math.min(1, dt * (target < car.velocity ? 4 : 1.3));
      const movement = car.velocity * dt * car.direction;
      car.progress = (car.progress + movement + city.size) % city.size;
      car.distance += Math.abs(movement);
    }
    refreshTimer.current += dt;
    if (refreshTimer.current > .48) {
      refreshTimer.current = 0;
      const nearest = vehicles.map(v => {
        const p = getCarPosition(v, city);
        const dx = p.x - camera.position.x, dy = camera.position.y - 1.2, dz = p.z - camera.position.z;
        return { v, distanceSq: dx * dx + dy * dy + dz * dz };
      }).sort((a, b) => a.distanceSq - b.distanceSq);
      let start = 0;
      for (let model = 0; model < MODELS.length; model++) {
        const close = nearest.filter(x => x.v.model === model && x.distanceSq < 1050 * 1050);
        for (let i = 0; i < POOL_SIZES[model]; i++) assignments.current[start + i] = close[i]?.v ?? null;
        start += POOL_SIZES[model];
      }
    }
    for (let i = 0; i < slots.length; i++) {
      const holder = holders.current[i];
      if (!holder) continue;
      const car = assignments.current[i];
      holder.visible = Boolean(car);
      if (!car) continue;
      const p = getCarPosition(car, city);
      holder.position.set(p.x, .075, p.z);
      holder.rotation.set(0, p.rotation, 0);
      // Bus uses 6 wheels, smaller vehicles 4. The wheel geometry is centered
      // on its own axle, so local X rotation produces visible rolling.
      for (const wheel of slots[i].wheels) wheel.rotation.x = -car.distance / (car.model === 4 ? .49 : .39);
    }
    // Headlamps remain readable at dusk/night; model materials are shared.
    void night;
  });
  return <group visible={enabled}>
    {slots.map((slot, i) => <group key={`${MODELS[slot.model]}-${i}`} visible={false}
      ref={node => { holders.current[i] = node; }}>
      <primitive object={slot.scene}/>
    </group>)}
  </group>;
}
