import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

async function loadGenerator(file) {
  const source = readFileSync(new URL(file, import.meta.url), 'utf8');
  const compiled = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`);
}
const { generateCity, rng, CELL, ROAD, GENERATOR_VERSION, isArterial } = await loadGenerator('../src/lib/city.ts');
const { generateCity: generateCityV1 } = await loadGenerator('../src/lib/city-v1.ts');
const { generateCity: generateCityV2 } = await loadGenerator('../src/lib/city-v2.ts');
const { generateCity: generateCityV3 } = await loadGenerator('../src/lib/city-v3.ts');
const { generateCity: generateCityV4 } = await loadGenerator('../src/lib/city-v4.ts');
const { generateCity: generateCityV5 } = await loadGenerator('../src/lib/city-v5.ts');

test('V7 generator is deterministic', () => {
  assert.deepEqual(generateCity(18024, 20), generateCity(18024, 20));
});
test('different seeds create different urban worlds', () => {
  assert.notDeepEqual(generateCity(18024, 20), generateCity(18025, 20));
});
test('V7 produces a mixed skyline, parks, civic plazas, trees and a waterfront', () => {
  const city = generateCity(18024, 20);
  assert.ok(city.buildings.length > 200);
  assert.ok(city.parks.length > 0 && city.plazas.length > 0 && city.trees.length > 0);
  assert.ok(city.buildings.some(b => b.height > 100));
  assert.ok(city.buildings.some(b => b.height < 30));
  assert.ok(city.buildings.some(b => b.setback));
  assert.equal(city.waterfront, true);
});
test('V7 parcel setbacks and generator version are safe', () => {
  const city = generateCity(18024, 20);
  assert.equal(CELL, 48);
  assert.equal(ROAD, 13);
  assert.equal(city.cell, 48);
  assert.equal(city.size, 960);
  assert.equal(GENERATOR_VERSION, 'citygen-6.0.0');
  assert.ok(isArterial(5, 20));
  for (const b of city.buildings) {
    assert.ok(b.height >= 9 && b.height <= 250);
    assert.ok(b.width <= CELL - 19 - 2);
    assert.ok(b.depth <= CELL - 19 - 2);
    assert.ok(Math.abs(b.x) <= city.size / 2);
    assert.ok(Math.abs(b.z) <= city.size / 2);
    assert.ok(b.style >= 0 && b.style < 10);
    assert.ok(b.floors >= 2);
    assert.ok(['box','round','corner'].includes(b.form));
    assert.ok(['flat', 'terrace', 'mechanical', 'green'].includes(b.roof));
  }
});
test('statistics remain finite across seed and scale combinations', () => {
  for (const seed of [0, 1, 1024, 18024, 2147483647]) {
    for (const grid of [16, 20, 24]) {
      const city = generateCity(seed, grid);
      assert.ok(Number.isFinite(city.energy) && city.energy > 0);
      assert.ok(Number.isFinite(city.population) && city.population > 0);
      assert.ok(city.greenSpace >= 0 && city.greenSpace <= 100);
      assert.ok(city.buildings.length <= grid * grid);
    }
  }
});
test('V3 generator remains deterministic for old saved cities', () => {
  const old = generateCityV3(18024, 20);
  assert.equal(old.cell, 42);
  assert.deepEqual(old, generateCityV3(18024, 20));
  assert.notDeepEqual(old, generateCity(18024, 20));
});
test('V4 generator remains compatible with old saved cities', () => {
  const old = generateCityV4(18024, 20);
  assert.equal(old.cell, 48);
  assert.deepEqual(old, generateCityV4(18024, 20));
  assert.notDeepEqual(old, generateCity(18024, 20));
});
test('V7 retains superblocks, mixed footprints and secondary skylines', () => {
  const city = generateCity(18024, 20);
  const shapes = new Set(city.buildings.map(b => b.form));
  assert.deepEqual([...shapes].sort(), ['box', 'corner', 'round']);
  assert.ok(city.parks.length >= 9);
  const block = (col,row) => ({x:(col-(20-1)/2)*48,z:(row-(20-1)/2)*48});
  const park = block(Math.floor(20*.19),Math.floor(20*.35));
  assert.ok(city.parks.some(p => p.x === park.x && p.z === park.z));
});
test('V2 generator remains compatible', () => {
  const old = generateCityV2(18024, 20);
  assert.equal(old.cell, 32);
  assert.deepEqual(old, generateCityV2(18024, 20));
});
test('V1 generator remains compatible', () => {
  const old = generateCityV1(18024, 20);
  assert.equal(old.cell, 22);
  assert.deepEqual(old, generateCityV1(18024, 20));
});
test('RNG is bounded and reproducible', () => {
  const a = rng(42), b = rng(42);
  for (let i = 0; i < 200; i++) {
    const n = a();
    assert.equal(n, b());
    assert.ok(n >= 0 && n < 1);
  }
});
test('generation does not mutate an earlier output', () => {
  const old = generateCity(18024, 16);
  const snapshot = JSON.stringify(old);
  generateCity(100, 24);
  assert.equal(JSON.stringify(old), snapshot);
});

test('V6 generator remains byte-for-byte reproducible for Neon saves', () => {
  const old = generateCityV5(18024, 20);
  assert.equal(old.cell, 48);
  assert.deepEqual(old, generateCityV5(18024, 20));
  assert.notDeepEqual(old, generateCity(18024, 20));
});
test('V7 adds two new large public green areas and footprint variation', () => {
  const city = generateCity(18024, 20);
  const old = generateCityV5(18024, 20);
  assert.ok(city.parks.length > old.parks.length);
  const widths = new Set(city.buildings.map(b => Math.round(b.width)));
  assert.ok(widths.size > 10);
});
