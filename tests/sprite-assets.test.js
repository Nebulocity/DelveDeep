import assert from 'node:assert/strict';
import fs from 'node:fs';
import { CHARACTER_SPRITES, preloadCharacterSprites } from '../data/characterSprites.js';

const names = ['laurana', 'tika', 'tanis', 'sturm', 'goldmoon', 'raistlin', 'dalamar', 'palin', 'tasslehoff', 'flint', 'riverwind', 'fistandantilus', 'mishakal'];
const states = ['idle', 'walk', 'attack', 'block', 'hit', 'death'];
const loaded = [];
for (const name of names) {
  const sprite = CHARACTER_SPRITES[name];
  assert.ok(sprite, `missing sprite for ${name}`);
  assert.equal(sprite.textures.length, states.length);
  const keys = new Set();
  for (const texture of sprite.textures) {
    assert.ok(!keys.has(texture.key));
    keys.add(texture.key);
    const png = fs.readFileSync(new URL(texture.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(20), 1024, 'four direction rows');
    assert.ok(png.readUInt32BE(16) >= 1024, 'at least four frame columns');
    assert.equal(png[25], 6, 'sprite sheet keeps RGBA transparency');
    assert.equal(png.subarray(-8, -4).toString(), 'IEND');
  }
  for (const [state, clips] of Object.entries(sprite.clips)) {
    assert.equal(Object.keys(clips).length, 8);
    for (const clip of Object.values(clips)) {
      assert.ok(clip.frames.length >= (state === 'dead' ? 1 : 4));
      assert.ok(clip.frameMs > 0);
      for (const frame of clip.frames) {
        assert.ok(keys.has(frame.key));
        assert.ok(Number.isInteger(frame.frame));
        assert.ok(frame.originY > 0 && frame.originY <= 1);
        assert.equal(frame.flipX, false, 'no equipment mirroring');
      }
    }
  }
  for (const direction of Object.keys(sprite.clips.death)) {
    assert.deepEqual(sprite.clips.dead[direction].frames[0], sprite.clips.death[direction].frames.at(-1));
  }
  assert.notEqual(sprite.clips.block['south-east'].frames[0].frame, sprite.clips.block['south-west'].frames[0].frame);
  assert.notEqual(sprite.clips.block['north-east'].frames[0].frame, sprite.clips.block['north-west'].frames[0].frame);
}
preloadCharacterSprites({
  textures: { exists: () => false },
  load: { spritesheet: (key, url, options) => loaded.push({ key, url, options }) },
});
assert.equal(loaded.length, names.length * states.length);
assert.ok(loaded.every(({ options }) => options.frameWidth === 256 && options.frameHeight === 256));
preloadCharacterSprites({
  textures: { exists: () => true },
  load: { spritesheet: () => assert.fail('should reuse existing textures') },
});
console.log(`Sprite sheets: ${names.length} characters, complete RGBA atlases, clips, facings and cached preloading passed.`);
