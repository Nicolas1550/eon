/** EON Ultra Reality V3 — versioned, reproducible urban world generator.
 * Units are visual/meters-inspired, not calibrated real-world forecasts.
 * Previous generator versions remain in city-v1.ts and city-v2.ts.
 */
export const CELL = 42;
export const ROAD = 12;
export const ARTERIAL_ROAD = 17;
export const GENERATOR_VERSION = 'citygen-3.0.0';
export const PREVIOUS_VERSION = 'citygen-2.0.0';
export const LEGACY_VERSION = 'citygen-1.0.0';

export type Weather = 'clear' | 'haze' | 'rain';
export type Quality = 'balanced' | 'cinematic';
export type CameraMode = 'orbit' | 'street' | 'cinema';
export type Building = {
  id: number; x: number; z: number; height: number; width: number; depth: number;
  style: number; tier: number; floors: number; district: string;
  occupancy: number; energy: number;
  roof?: 'flat' | 'terrace' | 'mechanical' | 'green';
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

export function isArterial(index: number, grid: number) {
  return index % 5 === 0 || index === Math.floor(grid / 2);
}

/** Deterministic districts, setbacks, civic squares and a skyline with breathing room. */
export function generateCity(seed: number, grid = 20): CityData {
  const random = rng(seed);
  const buildings: Building[] = [];
  const parks: Park[] = [];
  const plazas: Plaza[] = [];
  const trees: Tree[] = [];
  const size = grid * CELL;
  let population = 0;
  let energy = 0;
  let heightSum = 0;
  // Shift the financial core off-axis, making the skyline less like a pyramid.
  const coreX = grid * 0.49 + 0.55;
  const coreZ = grid * 0.46 - 0.45;
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      const x = (col - (grid - 1) / 2) * CELL;
      const z = (row - (grid - 1) / 2) * CELL;
      const dx = (col - coreX) / (grid * 0.49);
      const dz = (row - coreZ) / (grid * 0.49);
      const distance = Math.hypot(dx, dz);
      const core = Math.max(0, 1 - distance);
      const boulevard = (col % 5 === 0 || row % 5 === 0);
      const outer = distance > 0.66;
      const greenChance = outer ? 0.19 : core > 0.57 ? 0.065 : 0.125;
      const plazaChance = core > 0.42 ? 0.075 : 0.035;
      const civicSquare = (col === Math.floor(grid * 0.67) && row === Math.floor(grid * 0.43)) ||
        (col === Math.floor(grid * 0.67) && row === Math.floor(grid * 0.43) + 1);
      const parkPromenade = col === Math.floor(grid * 0.23) && row > Math.floor(grid * 0.31) && row < Math.floor(grid * 0.7);
      const roll = random();
      if (parkPromenade || (!civicSquare && roll < greenChance)) {
        parks.push({ x, z, size: CELL - ARTERIAL_ROAD - 3 });
        const count = 7 + Math.floor(random() * 8);
        for (let k = 0; k < count; k++) {
          trees.push({
            x: x + (random() - 0.5) * 21,
            z: z + (random() - 0.5) * 21,
            scale: 0.75 + random() * 0.68,
            tone: Math.floor(random() * 4),
          });
        }
        continue;
      }
      if (civicSquare || roll < greenChance + plazaChance) {
        plazas.push({ x, z, size: CELL - ARTERIAL_ROAD - 3, variant: civicSquare ? 0 : Math.floor(random() * 3) });
        for (const sign of [-1, 1]) {
          trees.push({ x: x + sign * 9.4, z: z + (random() - 0.5) * 10,
            scale: 0.75 + random() * 0.35, tone: Math.floor(random() * 4) });
        }
        continue;
      }
      const commercial = core > 0.43 && (boulevard || random() > 0.36);
      const district = core > 0.59 ? 'Financial District' : core > 0.31 ? 'Midtown & Arts' : outer ? 'Garden Boroughs' : 'Civic Quarter';
      const skyline = Math.pow(core, 1.9) * (125 + random() * 75);
      let height = commercial
        ? 15 + random() * 28 + skyline * (0.32 + random() * 0.78)
        : 8 + random() * (outer ? 14 : 32) + skyline * random() * 0.30;
      if (boulevard && commercial && core > 0.35) height *= 1.11;
      if (random() < 0.05 && core > 0.50) height *= 1.26;
      height = Math.round(Math.max(8, Math.min(205, height)) * 10) / 10;
      const width = 15 + random() * 7.5;
      const depth = 15 + random() * 7.5;
      const tier = height < 29 ? 0 : height < 79 ? 1 : 2;
      const floors = Math.max(2, Math.round(height / 3.6));
      const style = commercial
        ? [0, 1, 2, 3, 4, 5][Math.floor(random() * 6)]
        : [2, 3, 5, 6, 7][Math.floor(random() * 5)];
      const occupancy = Math.round(floors * (width * depth / 96) * (1.25 + random() * 1.75));
      const power = Math.round(occupancy * (0.0011 + random() * 0.0009) * 100) / 100;
      const roof = (['flat', 'terrace', 'mechanical', 'green'] as const)[Math.floor(random() * 4)];
      buildings.push({ id: buildings.length + 1, x, z, height, width, depth,
        style, tier, floors, district, occupancy, energy: power, roof });
      population += occupancy;
      energy += power;
      heightSum += height;
      // Street trees remain outside the building footprint, including near arterials.
      if (random() > 0.20) {
        for (const sign of [-1, 1]) {
          trees.push({
            x: x + sign * 13.1,
            z: z + (random() - 0.5) * 17,
            scale: 0.70 + random() * 0.45,
            tone: Math.floor(random() * 4),
          });
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
