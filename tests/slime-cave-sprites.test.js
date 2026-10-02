import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import enemies from '../data/enemies.js';
import { SLIME_SPRITES, preloadSlimeSprites } from '../data/slimeSprites.js';
import { slimePose, monsterDeathPose, MONSTER_DEATH_MS } from '../combat/SpritePresentation.js';

const ids = ['caveSlime', 'elderSlime', 'slimeSovereign'];
const directions = ['south-east', 'south-west', 'north-east', 'north-west'];
const states = ['idle', 'walk', 'attack', 'block', 'hit', 'death'];
const base = new URL('../assets/enemies/slime-cave/', import.meta.url);

for (const id of ids) {
  const sprite = SLIME_SPRITES[id];
  const layout = JSON.parse(readFileSync(new URL(`${id}/reference-v2/sheets/layout.json`, base), 'utf8'));
  assert.equal(sprite.textures.length, 6);
  assert.equal(layout.frameWidth, 192);
  assert.equal(layout.frameHeight, 192);
  for (const [stateIndex, state] of states.entries()) {
    const texture = sprite.textures[stateIndex];
    assert.ok(existsSync(fileURLToPath(texture.url)), texture.url);
    const png = readFileSync(fileURLToPath(texture.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), layout.states[state].columns * 192);
    assert.equal(png.readUInt32BE(20), directions.length * 192);
    for (const [row, direction] of directions.entries()) {
      const clip = sprite.clips[state][direction];
      assert.equal(clip.frames.length, layout.states[state].counts[direction]);
      assert.equal(clip.frames[0].frame, row * layout.states[state].columns);
      assert.equal(clip.frames.at(-1).frame, row * layout.states[state].columns + clip.frames.length - 1);
      assert.ok(clip.frames.every(frame => !frame.flipX));
    }
  }
  assert.deepEqual(sprite.clips.dead['south-east'].frames[0], sprite.clips.death['south-east'].frames.at(-1));
}

assert.equal(enemies.caveSlime.name, 'Cave Slime');
assert.equal(enemies.elderSlime.name, 'Elder Slime');
assert.equal(enemies.slimeSovereign.name, 'Slime Sovereign');
assert.ok(enemies.caveSlime.maxHp < enemies.elderSlime.maxHp);
assert.ok(enemies.elderSlime.maxHp < enemies.slimeSovereign.maxHp);
assert.deepEqual(ids.map(id => SLIME_SPRITES[id].scale), [2, 2.2, 3.3]);
assert.deepEqual(ids.map(id => SLIME_SPRITES[id].clips.idle.south.frames[0].originY),
  [170, 168, 178].map(y => y / 192));
assert.ok(SLIME_SPRITES.caveSlime.scale < SLIME_SPRITES.elderSlime.scale);
assert.ok(SLIME_SPRITES.elderSlime.scale < SLIME_SPRITES.slimeSovereign.scale);
for (const id of ids) {
  const { motion } = SLIME_SPRITES[id];
  const idle = slimePose(motion, 'idle', motion.period / 4, 600);
  assert.ok(idle.scaleX !== 1 && idle.scaleY !== 1, `${id} visibly squishes at idle`);
  assert.ok(idle.y < 0, `${id} lifts at idle`);
  const attack = slimePose(motion, 'attack', 175, 350);
  const hit = slimePose(motion, 'hit', 150, 300);
  assert.ok(attack.y < 0 && attack.scaleX > 1, `${id} lunges on attack`);
  assert.ok(hit.scaleY < 1, `${id} recoils on hit`);
}
assert.equal(monsterDeathPose(0).alpha, 1);
assert.ok(monsterDeathPose(80).alpha < monsterDeathPose(160).alpha, 'death flickers');
assert.ok(monsterDeathPose(850).alpha < monsterDeathPose(560).alpha, 'death fades');
assert.ok(monsterDeathPose(960).scale > 1, 'death pops');
assert.equal(monsterDeathPose(MONSTER_DEATH_MS).alpha, 0);
const loaded = [];
preloadSlimeSprites({ textures: { exists: () => false }, load: { spritesheet: (...args) => loaded.push(args) } });
for (const id of ids) assert.equal(loaded.filter(([key]) => key.startsWith(`${id}-`)).length, 6);
console.log('Slime Cave sprite sheets, clips, scales, enemy names and preload checks passed.');
