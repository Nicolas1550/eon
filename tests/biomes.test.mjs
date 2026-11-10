import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { join } from 'node:path';

const root = new URL('../public/assets/genesis/biomes/', import.meta.url);
const ids = ['awakening-valley','frostbound-peaks','ember-wastes','astral-marsh','sunfall-dunes'];

test('all five authored GLB worlds are present with valid binary GLTF headers', () => {
  for (const id of ids) {
    const path = new URL(`${id}/scene.glb`,root);
    assert.ok(existsSync(path), `${id} missing`);
    const start = Buffer.alloc(12);
    const fd = openSync(path, 'r');
    readSync(fd, start, 0, 12, 0);
    closeSync(fd);
    assert.equal(start.toString('utf8',0,4),'glTF');
    assert.equal(start.readUInt32LE(4),2);
    assert.equal(start.readUInt32LE(8),statSync(path).size);
  }
});
test('every biome has a web-friendly preview and the city route is preserved', () => {
  for (const id of ids) assert.ok(existsSync(new URL(`${id}/preview.webp`,root)));
  assert.ok(existsSync(new URL('../src/app/city/page.tsx', import.meta.url)));
  assert.match(readFileSync(new URL('../src/app/city/page.tsx', import.meta.url),'utf8'),/EonApp/);
});
