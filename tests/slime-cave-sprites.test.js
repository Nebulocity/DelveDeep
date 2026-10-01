import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import enemies from '../data/enemies.js';
import { SLIME_SPRITES, preloadSlimeSprites } from '../data/slimeSprites.js';

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
assert.ok(SLIME_SPRITES.caveSlime.scale < SLIME_SPRITES.elderSlime.scale);
assert.ok(SLIME_SPRITES.elderSlime.scale < SLIME_SPRITES.slimeSovereign.scale);
const loaded = [];
preloadSlimeSprites({ textures: { exists: () => false }, load: { spritesheet: (...args) => loaded.push(args) } });
for (const id of ids) assert.equal(loaded.filter(([key]) => key.startsWith(`${id}-`)).length, 6);
console.log('Slime Cave sprite sheets, clips, scales, enemy names and preload checks passed.');
