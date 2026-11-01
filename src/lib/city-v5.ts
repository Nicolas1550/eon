/** EON Real World V6 — deterministic, versioned procedural city generation.
 * Dimensions are illustrative scene units, not real-world forecasts.
 * V1/V2/V3 generators are preserved for already-saved cities.
 */
export const CELL = 48;
export const ROAD = 13;
export const ARTERIAL_ROAD = 19;
export const GENERATOR_VERSION = 'citygen-5.0.0';
export const PREVIOUS_VERSION = 'citygen-4.0.0';
export const V3_VERSION = 'citygen-3.0.0';
export const V2_VERSION = 'citygen-2.0.0';
export const LEGACY_VERSION = 'citygen-1.0.0';

export type Weather = 'clear' | 'haze' | 'rain';
export type Quality = 'balanced' | 'cinematic';
export type CameraMode = 'orbit' | 'street' | 'cinema';
export type Building = {
  id: number; x: number; z: number; height: number; width: number; depth: number;
  style: number; tier: number; floors: number; district: string;
  occupancy: number; energy: number;
  roof?: 'flat' | 'terrace' | 'mechanical' | 'green';
  setback?: boolean;
  form?: 'box' | 'round' | 'corner';
  rotation?: number;
};
export type Park = { x: number; z: number; size: number };
export type Plaza = { x: number; z: number; size: number; variant: number };
export type Tree = { x: number; z: number; scale: number; tone: number };
export type CityData = {
  buildings: Building[]; parks: Park[]; plazas?: Plaza[]; trees: Tree[];
  size: number; grid: number; cell?: number;
  population: number; energy: number; greenSpace: number; roads: number; avgHeight: number;
  waterfront?: boolean;
  boulevard?: boolean;
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
  const coreX = grid * 0.44;
  const coreZ = grid * 0.46;
  for (let row = 0; row < grid; row++) {
    for (let col = 0; col < grid; col++) {
      const centerX = (col - (grid - 1) / 2) * CELL;
      const centerZ = (row - (grid - 1) / 2) * CELL;
      let x = centerX;
      let z = centerZ;
      const dx = (col - coreX) / (grid * 0.48);
      const dz = (row - coreZ) / (grid * 0.49);
      const distance = Math.hypot(dx, dz);
      const secondary = Math.max(0, 1 - Math.hypot((col-grid*.76)/(grid*.25),(row-grid*.24)/(grid*.27)));
      const core = Math.max(0, 1 - distance);
      const boulevard = isArterial(col, grid) || isArterial(row, grid);
      const outer = distance > 0.67;
      const waterfrontPark = col === grid - 1 && (row % 4 !== 1);
      // A connected 3x3 central park reads as a district-scale landmark from ORBIT.
      const centralPark = col >= Math.floor(grid * .19) && col <= Math.floor(grid * .19)+2
        && row >= Math.floor(grid * .35) && row <= Math.floor(grid * .35)+2;
      const greenway = col === Math.floor(grid * 0.21) && row > grid * 0.28 && row < grid * 0.75;
      const civic = col === Math.floor(grid * 0.63) && (row === Math.floor(grid * 0.43) || row === Math.floor(grid * 0.43) + 1);
      const diagonalDistance = Math.abs(centerX * .32 - centerZ * .42) / Math.hypot(.32,.42);
      // Clear the actual footprint of a broad diagonal boulevard.
      if (diagonalDistance < 30 && Math.abs(centerX) < size*.41 && Math.abs(centerZ) < size*.32) continue;
      const roll = random();
      const greenChance = outer ? 0.18 : core > 0.60 ? 0.055 : 0.12;
      const plazaChance = core > 0.4 ? 0.065 : 0.03;
      if (centralPark || waterfrontPark || greenway || (!civic && roll < greenChance)) {
        parks.push({ x, z, size: CELL - ARTERIAL_ROAD - 4 });
        const count = 8 + Math.floor(random() * 7);
        for (let k = 0; k < count; k++) {
          trees.push({
            x: x + (random() - 0.5) * 25,
            z: z + (random() - 0.5) * 25,
            scale: 0.75 + random() * 0.65,
            tone: Math.floor(random() * 5),
          });
        }
        continue;
      }
      if (civic || roll < greenChance + plazaChance) {
        plazas.push({ x, z, size: CELL - ARTERIAL_ROAD - 4, variant: civic ? 0 : Math.floor(random() * 3) });
        for (const sign of [-1, 1]) {
          trees.push({ x: x + sign * 10.5, z: z + (random() - 0.5) * 13,
            scale: 0.75 + random() * 0.35, tone: Math.floor(random() * 5) });
        }
        continue;
      }
      const commercial = core > 0.45 && (boulevard || random() > 0.4);
      const district = core > 0.62 ? 'Financial District' : core > 0.32 ? 'Midtown & Arts' : outer ? 'Garden Boroughs' : 'Civic Quarter';
      const skyline = Math.pow(core, 1.9) * (128 + random() * 78) + Math.pow(secondary, 2.1) * (35 + random()*52);
      let height = commercial
        ? 16 + random() * 28 + skyline * (0.32 + random() * 0.76)
        : 9 + random() * (outer ? 15 : 34) + skyline * random() * 0.27;
      if (boulevard && commercial && core > 0.36) height *= 1.12;
      if (random() < 0.055 && core > 0.53) height *= 1.2;
      height = Math.round(Math.max(9, Math.min(250, height)) * 10) / 10;
      const width = 15 + random() * 9.5;
      const depth = 15 + random() * 9.5;
      const formRoll = random();
      const form: Building['form'] = height > 30 && formRoll > .71 ? 'round'
        : height > 17 && formRoll > .48 ? 'corner' : 'box';
      const rotation = form === 'corner' ? Math.floor(random()*4)*Math.PI/2 : 0;
      // Small, safe parcel offsets break the chessboard alignment without reaching sidewalks.
      x += (random()-.5)*4.4;
      z += (random()-.5)*4.4;
      const tier = height < 30 ? 0 : height < 85 ? 1 : 2;
      const floors = Math.max(2, Math.round(height / 3.65));
      const style = commercial ? Math.floor(random() * 6) : 5 + Math.floor(random() * 5);
      const occupancy = Math.round(floors * (width * depth / 98) * (1.2 + random() * 1.7));
      const power = Math.round(occupancy * (0.0011 + random() * 0.0009) * 100) / 100;
      const roof = (['flat', 'terrace', 'mechanical', 'green'] as const)[Math.floor(random() * 4)];
      const setback = tier === 2 && random() > 0.57;
      buildings.push({ id: buildings.length + 1, x, z, height, width, depth,
        style, tier, floors, district, occupancy, energy: power, roof, setback, form, rotation });
      population += occupancy;
      energy += power;
      heightSum += height;
      if (random() > 0.23) {
        for (const sign of [-1, 1]) {
          trees.push({ x: x + sign * 13.6, z: z + (random() - 0.5) * 19,
            scale: 0.65 + random() * 0.55, tone: Math.floor(random() * 5) });
        }
      }
    }
  }
  return {
    buildings, parks, plazas, trees, grid, size, cell: CELL, waterfront: true, boulevard: true,
    population, energy: Math.round(energy * 10) / 10,
    greenSpace: Math.round((parks.length / (grid * grid)) * 100),
    roads: Math.round(((grid + 1) * 2 * size) / 100) / 10,
    avgHeight: Math.round(heightSum / Math.max(1, buildings.length)),
  };
}
export function formatNumber(n: number) {
  return new Intl.NumberFormat('es-AR').format(Math.round(n));
}
