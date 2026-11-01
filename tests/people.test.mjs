import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
for (let i=1; i<=6; i++) {
  test(`pedestrian-${i} GLB has independently animatable human body parts`, () => {
    const buffer = readFileSync(new URL(`../public/assets/people/pedestrian-${i}.glb`, import.meta.url));
    assert.equal(buffer.toString('utf8',0,4),'glTF');
    assert.equal(buffer.readUInt32LE(4),2);
    assert.equal(buffer.readUInt32LE(8),buffer.length);
    const len=buffer.readUInt32LE(12);
    const json=JSON.parse(buffer.toString('utf8',20,20+len));
    const names=new Set(json.nodes.map(n=>n.name));
    for(const part of ['head','torso','leg_L','leg_R','arm_L','arm_R']) assert.ok(names.has(part),`${part} missing`);
    assert.ok(json.meshes.length>=6);
    assert.ok(buffer.length<350_000);
  });
}
