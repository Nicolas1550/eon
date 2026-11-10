/** Real Blender exports supplied with GENESIS. All labels describe the included assets, not an online live simulation. */
export const GENESIS_BIOMES = [
  {
    id: 'awakening-valley', number: '01', name: 'AWAKENING VALLEY', subtitle: 'Where life begins',
    caption: 'Un valle de montañas, bosques, agua y ruinas. El primer mundo que despertamos.',
    accent: '#92e8c9', backdrop: '#203d36', climate: 'TEMPERATE', feature: 'FOREST / RIVER',
    sizeMB: 133.27, sky: '#a6bdc4', fog: '#839a94', fogDistance: 255,
  },
  {
    id: 'frostbound-peaks', number: '02', name: 'FROSTBOUND PEAKS', subtitle: 'The frozen frontier',
    caption: 'Picos helados, coníferas oscuras y estructuras antiguas sobre un paisaje cubierto de nieve.',
    accent: '#aadcf8', backdrop: '#253e51', climate: 'ARCTIC', feature: 'ICE / PINES',
    sizeMB: 16.21, sky: '#c6d9e9', fog: '#b9cfe0', fogDistance: 300,
  },
  {
    id: 'ember-wastes', number: '03', name: 'EMBER WASTES', subtitle: 'The burning frontier',
    caption: 'Rocas volcánicas, fisuras, lava y un antiguo portal en un terreno hostil.',
    accent: '#ff9a69', backdrop: '#3d241f', climate: 'VOLCANIC', feature: 'LAVA / BASALT',
    sizeMB: 14.42, sky: '#76504c', fog: '#613934', fogDistance: 250,
  },
  {
    id: 'astral-marsh', number: '04', name: 'ASTRAL MARSH', subtitle: 'The luminous wetlands',
    caption: 'Pantanos, pozas, vegetación y hongos luminosos en un ecosistema misterioso.',
    accent: '#84e9df', backdrop: '#123b3a', climate: 'WETLAND', feature: 'POOLS / GLOW',
    sizeMB: 126.13, sky: '#527e82', fog: '#42696a', fogDistance: 220,
  },
  {
    id: 'sunfall-dunes', number: '05', name: 'SUNFALL DUNES', subtitle: 'Beyond the horizon',
    caption: 'Dunas de arena, piedra sedimentaria y ruinas que emergen del desierto.',
    accent: '#f5d6a2', backdrop: '#63402c', climate: 'ARID', feature: 'DUNES / RUINS',
    sizeMB: 15.21, sky: '#dbc7b0', fog: '#bb956f', fogDistance: 310,
  },
] as const;

export type GenesisBiome = (typeof GENESIS_BIOMES)[number];
export type GenesisBiomeId = GenesisBiome['id'];
export type GenesisQuality = 'eco' | 'high' | 'ultra';
export type GenesisCamera = 'orbit' | 'walk' | 'cinema';
export const biomeAsset = (id: GenesisBiomeId, file: 'scene.glb' | 'preview.webp' | 'scatter.json') =>
  `/assets/genesis/biomes/${id}/${file}`;
