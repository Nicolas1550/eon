export const CELL = 22;
export const ROAD = 5.5;
export const GENERATOR_VERSION = 'citygen-1.0.0';

export type Weather = 'clear' | 'haze' | 'rain';
export type Quality = 'balanced' | 'cinematic';
export type Building = {
  id: number;
  x: number;
  z: number;
  height: number;
  width: number;
  depth: number;
  style: number;
  tier: number;
  floors: number;
  district: string;
  occupancy: number;
  energy: number;
};
export type Park = { x: number; z: number; size: number };
export type Tree = { x: number; z: number; scale: number; tone: number };
export type CityData = {
  buildings: Building[];
  parks: Park[];
  trees: Tree[];
  size: number;
  grid: number;
  population: number;
  energy: number;
  greenSpace: number;
  roads: number;
  avgHeight: number;
};

export function rng(seed: number) {
  let t = seed >>> 0;
  return () => {
    t += 0x6D2B79F5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

export function generateCity(seed: number, grid = 20): CityData {
  const random = rng(seed);
  const buildings: Building[] = [];
  const parks: Park[] = [];
  const trees: Tree[] = [];
  const size = grid * CELL;
  let population = 0;
  let energy = 0;
  let heightSum = 0;
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      const x = (col - (grid - 1) / 2) * CELL;
      const z = (row - (grid - 1) / 2) * CELL;
      const distance = Math.hypot((col - (grid - 1) / 2) / (grid / 2), (row - (grid - 1) / 2) / (grid / 2));
      const downtown = Math.max(0, 1 - distance);
      const parkChance = 0.085 + (distance > 0.6 ? 0.07 : 0);
      if (random() < parkChance) {
        parks.push({ x, z, size: CELL - ROAD - 1 });
        const count = 4 + Math.floor(random() * 8);
        for (let k = 0; k < count; k++) {
          trees.push({
            x: x + (random() - 0.5) * (CELL - ROAD - 5),
            z: z + (random() - 0.5) * (CELL - ROAD - 5),
            scale: 0.65 + random() * 0.8,
            tone: Math.floor(random() * 3),
          });
        }
        continue;
      }
      const downtownHeight = Math.pow(downtown, 1.85) * (78 + random() * 35);
      const suburbHeight = 8 + random() * (18 + downtown * 12);
      let height = suburbHeight + downtownHeight * (0.32 + random() * 0.86);
      if (random() < 0.08 && downtown > 0.45) height *= 1.28;
      height = Math.min(145, Math.max(7, height));
      const width = 9.5 + random() * 5.5;
      const depth = 9.5 + random() * 5.5;
      const tier = height < 24 ? 0 : height < 65 ? 1 : 2;
      const floors = Math.max(2, Math.round(height / 3.4));
      const occupancy = Math.round(floors * (width * depth / 65) * (1.5 + random() * 2.5));
      const power = Math.round((occupancy * (0.0011 + random() * 0.0009)) * 100) / 100;
      const district = distance < 0.38 ? 'Central Business District' : distance < 0.7 ? 'Midtown' : 'Outer Boroughs';
      const building: Building = {
        id: buildings.length + 1,
        x, z, height, width, depth,
        style: Math.floor(random() * 4),
        tier, floors, district, occupancy, energy: power,
      };
      buildings.push(building);
      population += occupancy;
      energy += power;
      heightSum += height;
      // Tree-lined sidewalks: sparse to keep sight lines clear.
      if (random() > 0.27) {
        for (const sign of [-1, 1]) {
          trees.push({
            x: x + sign * (CELL / 2 - ROAD / 2 - 1.1),
            z: z + (random() - 0.5) * 11,
            scale: 0.65 + random() * 0.65,
            tone: Math.floor(random() * 3),
          });
        }
      }
    }
  }
  return {
    buildings, parks, trees, grid, size, cell: CELL, plazas: [],
    population,
    energy: Math.round(energy * 10) / 10,
    greenSpace: Math.round((parks.length / (grid * grid)) * 100),
    roads: Math.round(((grid + 1) * 2 * size) / 100) / 10,
    avgHeight: Math.round(heightSum / Math.max(buildings.length, 1)),
  };
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat('es-AR').format(Math.round(n));
}
