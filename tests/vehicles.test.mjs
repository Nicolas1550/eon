import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

for (const model of ['sedan', 'suv', 'hatchback', 'van', 'bus']) {
  test(`${model} is a complete bundled glTF vehicle with body, windows and wheels`, () => {
    const file = new URL(`../public/assets/vehicles/${model}.glb`, import.meta.url);
    const buffer = readFileSync(file);
    assert.equal(buffer.toString('utf8', 0, 4), 'glTF');
    assert.equal(buffer.readUInt32LE(4), 2);
    assert.equal(buffer.readUInt32LE(8), buffer.length);
    const length = buffer.readUInt32LE(12);
    const json = JSON.parse(buffer.toString('utf8', 20, 20 + length));
    const nodes = new Set(json.nodes.map(n => n.name));
    for (const required of ['paint', 'glass', 'trim', 'headlights', 'taillights', 'wheel_0_L', 'wheel_0_R', 'wheel_1_L', 'wheel_1_R']) {
      assert.ok(nodes.has(required), `${model} missing ${required}`);
    }
    assert.ok(json.meshes.length >= 11);
    assert.ok(statSync(file).size < 500_000);
  });
}
test('Vehicle engine loads all bundled GLB assets and no old box buses', () => {
  const engine = readFileSync(new URL('../src/components/VehicleTraffic.tsx', import.meta.url), 'utf8');
  const scene = readFileSync(new URL('../src/components/CityScene.tsx', import.meta.url), 'utf8');
  const dressing = readFileSync(new URL('../src/components/RealityDressing.tsx', import.meta.url), 'utf8');
  for (const model of ['sedan','suv','hatchback','van','bus']) assert.ok(engine.includes(`/assets/vehicles/${model}.glb`));
  assert.ok(scene.includes('<VehicleTraffic'));
  assert.ok(!dressing.includes('<TransitFleet'));
});
