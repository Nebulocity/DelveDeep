// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import adventurers from '../data/adventurers.js';
import { CHARACTER_SPRITES, preloadCharacterSprites } from '../data/characterSprites.js';

const names = ['laurana', 'tika', 'tanis', 'sturm', 'goldmoon', 'caramon-gladiator', 'raistlin', 'dalamar', 'palin', 'tasslehoff', 'flint', 'riverwind', 'fistandantilus', 'mishakal'];
const states = ['idle', 'walk', 'attack', 'block', 'hit', 'death'];
const loaded = [];
for (const { id } of adventurers) assert.ok(CHARACTER_SPRITES[id], `missing combat sprite for roster ID ${id}`);
for (const name of names) {
  const sprite = CHARACTER_SPRITES[name];
  assert.ok(sprite, `missing sprite for ${name}`);
  assert.equal(sprite.textures.length, states.length);
  const layout = JSON.parse(fs.readFileSync(new URL(`../assets/characters/${name}/sheets/layout.json`, import.meta.url), 'utf8'));
  assert.equal(layout.frameWidth, 256);
  assert.equal(layout.frameHeight, 256);
  assert.deepEqual(layout.directions, ['south-east', 'south-west', 'north-east', 'north-west']);

  // A Set keeps each value once. has checks membership without searching a list for
  // duplicate entries.
  const keys = new Set();
  const capacities = new Map();
  for (const [index, texture] of sprite.textures.entries()) {
    assert.ok(!keys.has(texture.key));
    keys.add(texture.key);
    const png = fs.readFileSync(new URL(texture.url));

    // function toString() { [native code] }
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(20), 1024, 'four direction rows');
    assert.equal(png.readUInt32BE(16), layout.states[states[index]].columns * 256);
    assert.equal(png[25], 6, 'sprite sheet keeps RGBA transparency');
    assert.equal(png.subarray(-8, -4).toString(), 'IEND');

    // Four authored rows fill each atlas. Clip indices must stay inside those cells,
    // including the aliases used for the extra four movement headings.
    capacities.set(texture.key, layout.states[states[index]].columns * layout.directions.length);
  }

  // Object.entries turns own fields into [key, value] pairs so we can visit or transform
  // them.
  for (const [state, clips] of Object.entries(sprite.clips)) {
    assert.equal(Object.keys(clips).length, 8);
    for (const clip of Object.values(clips)) {

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      assert.ok(clip.frames.length >= (state === 'dead' ? 1 : 4));
      assert.ok(clip.frameMs > 0);
      for (const frame of clip.frames) {
        assert.ok(keys.has(frame.key));
        assert.ok(Number.isInteger(frame.frame));
        assert.ok(frame.frame >= 0 && frame.frame < capacities.get(frame.key), 'frame stays inside its atlas');
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

for (const direction of ['south', 'south-east', 'east']) {

  // map builds one output entry for each input entry, in the same order. The callback's
  // return value becomes that output entry.
  assert.deepEqual(
    CHARACTER_SPRITES.tika.clips.idle[direction].frames.map(({ frame }) => frame),
    [0, 1, 1, 0],
    'Tika idle should avoid the frames with the bright pan trail',
  );
}

preloadCharacterSprites({
  textures: { exists: () => false },
  load: { spritesheet: (key, url, options) => loaded.push({ key, url, options }) },
});
assert.equal(loaded.length, names.length * states.length);

// every requires all entries to pass the check; an empty list gives true.
assert.ok(loaded.every(({ options }) => options.frameWidth === 256 && options.frameHeight === 256));
preloadCharacterSprites({
  textures: { exists: () => true },
  load: { spritesheet: () => assert.fail('should reuse existing textures') },
});
console.log(`Sprite sheets: ${names.length} characters, complete RGBA atlases, clips, facings and cached preloading passed.`);
