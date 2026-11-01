import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync } from 'node:fs';

for (const species of ['maple', 'oak', 'birch']) {
  for (const lod of ['detail', 'distance']) {
    test(`${species} ${lod} is a complete GLB with leaf material and bark`, () => {
      const path = new URL(`../public/assets/trees/${species}-${lod}.glb`, import.meta.url);
      const buffer = readFileSync(path);
      assert.equal(buffer.toString('utf8', 0, 4), 'glTF');
      assert.equal(buffer.readUInt32LE(4), 2);
      assert.equal(buffer.readUInt32LE(8), buffer.length);
      const chunkLength = buffer.readUInt32LE(12);
      const json = JSON.parse(buffer.toString('utf8', 20, 20 + chunkLength));
      assert.ok(json.meshes?.length >= 2);
      assert.ok(json.materials?.some(m => m.alphaMode === 'MASK' && m.doubleSided === true));
      assert.ok(json.nodes?.some(n => n.name === 'bark'));
      assert.ok(json.nodes?.some(n => n.name === 'foliage'));
      assert.ok(json.images?.length >= 2);
      assert.ok(statSync(path).size < 1_500_000, 'asset must be web sized');
    });
  }
}
