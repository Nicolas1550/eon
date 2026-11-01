/** EON Reality Engine V2 — deterministic, versioned city generator.
 * Units are illustrative meters; outputs are visual/model estimates.
 */
export const CELL = 32;
export const ROAD = 8.5;
export const GENERATOR_VERSION = 'citygen-2.0.0';
export const LEGACY_VERSION = 'citygen-1.0.0';

export type Weather = 'clear' | 'haze' | 'rain';
export type Quality = 'balanced' | 'cinematic';
export type CameraMode = 'orbit' | 'street';
export type Building = {
  id: number; x: number; z: number; height: number; width: number; depth: number;
  style: number; tier: number; floors: number; district: string;
  occupancy: number; energy: number;
};
export type Park = { x: number; z: number; size: number };
export type Plaza = { x: number; z: number; size: number; variant: number };
export type Tree = { x: number; z: number; scale: number; tone: number };
export type CityData = {
  buildings: Building[]; parks: Park[]; plazas?: Plaza[]; trees: Tree[];
  size: number; grid: number; cell?: number;
  population: number; energy: number; greenSpace: number; roads: number; avgHeight: number;
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

/** Stable, non-random-in-time generation for a given seed and grid. */
export function generateCity(seed: number, grid = 20): CityData {
  const random = rng(seed);
  const buildings: Building[] = [];
  const parks: Park[] = [];
  const plazas: Plaza[] = [];
  const trees: Tree[] = [];
  const size = grid * CELL;
  let population = 0, energy = 0, heightSum = 0;

  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      const x = (col - (grid - 1) / 2) * CELL;
      const z = (row - (grid - 1) / 2) * CELL;
      const distance = Math.hypot((col - (grid - 1) / 2) / (grid / 2), (row - (grid - 1) / 2) / (grid / 2));
      const downtown = Math.max(0, 1 - distance);
      const greenChance = 0.11 + (distance > 0.65 ? 0.065 : 0);
      const plazaChance = distance < 0.7 ? 0.06 : 0.025;
      const roll = random();
      if (roll < greenChance) {
        parks.push({ x, z, size: CELL - ROAD - 2 });
        const count = 5 + Math.floor(random() * 7);
        for (let k = 0; k < count; k++) {
          trees.push({ x: x + (random() - 0.5) * 18, z: z + (random() - 0.5) * 18,
            scale: 0.65 + random() * 0.65, tone: Math.floor(random() * 4) });
        }
        continue;
      }
      if (roll < greenChance + plazaChance) {
        plazas.push({ x, z, size: CELL - ROAD - 2, variant: Math.floor(random() * 3) });
        for (const sign of [-1, 1]) {
          trees.push({ x: x + sign * 8.4, z: z + (random() - 0.5) * 9,
            scale: 0.65 + random() * 0.3, tone: Math.floor(random() * 4) });
        }
        continue;
      }
      const mainCorridor = (Math.abs(col - (grid - 1) / 2) < 2 || Math.abs(row - (grid - 1) / 2) < 2);
      const skyline = Math.pow(downtown, 1.75) * (85 + random() * 45);
      let height = 9 + random() * (17 + downtown * 15) + skyline * (0.24 + random() * 0.82);
      if (mainCorridor && downtown > 0.4) height *= 1.16;
      if (random() < 0.065 && downtown > 0.42) height *= 1.35;
      height = Math.min(190, Math.max(8, height));
      const width = 11.5 + random() * 7.0;
      const depth = 11.5 + random() * 7.0;
      const tier = height < 28 ? 0 : height < 76 ? 1 : 2;
      const floors = Math.max(2, Math.round(height / 3.5));
      const occupancy = Math.round(floors * (width * depth / 80) * (1.4 + random() * 2.3));
      const power = Math.round(occupancy * (0.0011 + random() * 0.0009) * 100) / 100;
      const district = distance < 0.38 ? 'Central Business District' : distance < 0.7 ? 'Midtown' : 'Outer Boroughs';
      buildings.push({ id: buildings.length + 1, x, z, height, width, depth,
        style: Math.floor(random() * 6), tier, floors, district, occupancy, energy: power });
      population += occupancy;
      energy += power;
      heightSum += height;
      // Sidewalk tree placement leaves the center of each parcel unobstructed.
      if (random() > 0.27) {
        for (const sign of [-1, 1]) {
          trees.push({ x: x + sign * (CELL / 2 - ROAD / 2 - 1.2),
            z: z + (random() - 0.5) * 12, scale: 0.60 + random() * 0.45,
            tone: Math.floor(random() * 4) });
        }
      }
    }
  }
  return {
    buildings, parks, plazas, trees, grid, size, cell: CELL, population,
    energy: Math.round(energy * 10) / 10,
    greenSpace: Math.round((parks.length / (grid * grid)) * 100),
    roads: Math.round(((grid + 1) * 2 * size) / 100) / 10,
    avgHeight: Math.round(heightSum / Math.max(buildings.length, 1)),
  };
}

export function formatNumber(n: number) {
  return new Intl.NumberFormat('es-AR').format(Math.round(n));
}
