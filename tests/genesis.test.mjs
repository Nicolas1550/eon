import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';

const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('GENESIS core is mounted in original EON scene', () => {
  const city = source('src/components/CityScene.tsx');
  assert.match(city, /<GenesisCore\s+city=\{props\.city\}/);
  assert.match(city, /<WorldPerformance\s+onSample=\{props\.onFps\}/);
  assert.match(city, /quality === 'ultra' \? 2/);
});

test('UI exposes awakening and stores by seed, not in Neon', () => {
  const ui = source('src/components/EonApp.tsx');
  assert.match(ui, /AWAKEN WORLD/);
  assert.match(ui, /localStorage\.setItem\(awakeningKey, '1'\)/);
  assert.match(ui, /genesis\.awakening\.\$\{generatorVersion\}\.\$\{seed\}\.\$\{grid\}/);
  assert.doesNotMatch(source('src/app/api/cities/route.ts'), /genesis\.awakening/);
});

test('NVIDIA OptiX render helper is included for offline Blender', () => {
  assert.ok(existsSync(new URL('../tools/blender_genesis_optix.py', import.meta.url)));
  assert.match(source('tools/blender_genesis_optix.py'), /'OPTIX', 'CUDA'/);
});
