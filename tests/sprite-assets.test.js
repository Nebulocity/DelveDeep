// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import adventurers from '../data/adventurers.js';
import { CHARACTER_SPRITES, preloadCharacterSprites } from '../data/characterSprites.js';

const names = ['elyra', 'zahra', 'orwen', 'aldren', 'sylva', 'garrick', 'valtheris', 'zareth', 'nadira', 'yasmin', 'durgrim', 'chaska', 'malrek', 'selenne', 'alhanna'];
const states = ['idle', 'walk', 'attack', 'block', 'hit', 'death'];
const loaded = [];
for (const { id } of adventurers) assert.ok(CHARACTER_SPRITES[id], `missing combat sprite for roster ID ${id}`);
for (const name of names) {
  const sprite = CHARACTER_SPRITES[name];
  assert.ok(sprite, `missing sprite for ${name}`);
  const characterStates = name === 'valtheris' ? [...states, 'cast'] : states;
  assert.equal(sprite.textures.length, characterStates.length);
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

    // Each animation uses all four authored facing rows from its layout file.
    const columns = layout.states[characterStates[index]].columns;
    const rows = layout.directions.length;
    assert.equal(png.readUInt32BE(20), rows * 256);
    assert.equal(png.readUInt32BE(16), columns * 256);
    assert.equal(png[25], 6, 'sprite sheet keeps RGBA transparency');
    assert.equal(png.subarray(-8, -4).toString(), 'IEND');

    // The measured rows fill each atlas. Clip indices must stay inside those cells,
    // including the aliases used for the extra four movement headings.
    capacities.set(texture.key, columns * rows);
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

  if (name === 'elyra' || name === 'garrick' || name === 'sylva' || name === 'chaska' || name === 'yasmin' || name === 'zahra') {
    for (const state of states) {
      const sheet = layout.states[state];
      for (const [direction, count] of Object.entries(sheet.counts)) {
        const clip = sprite.clips[state][direction];
        assert.equal(clip.frames.length, count, `${name} ${state}/${direction} uses every authored frame`);
        assert.equal(clip.frameMs, sheet.frameMsByDirection?.[direction] ?? sheet.frameMs);
        assert.equal(clip.frames[0].originY, layout.anchors[direction].originY);
      }
    }
  }

  for (const direction of Object.keys(sprite.clips.death)) {
    assert.deepEqual(sprite.clips.dead[direction].frames[0], sprite.clips.death[direction].frames.at(-1));
  }
  assert.notEqual(sprite.clips.block['south-east'].frames[0].frame, sprite.clips.block['south-west'].frames[0].frame);
  assert.notEqual(sprite.clips.block['north-east'].frames[0].frame, sprite.clips.block['north-west'].frames[0].frame);
}

// Every Aldren pose must use the replacement artwork, including portraits and walking.
// Retained texture keys keep historical battle frames readable without shipping old art.
for (const [index, texture] of CHARACTER_SPRITES.aldren.textures.entries()) {
  assert.ok(texture.url.endsWith(`/Aldren-${states[index]}.png`));
  assert.equal(texture.key, `aldren-reference-v2-${states[index]}`);
}
assert.equal(fs.existsSync(new URL('../assets/characters/aldren/temporary/walk-test.png', import.meta.url)), false);

// Garrick supplies every Gladiator pose. The former PNGs are archived outside runtime.
for (const [index, texture] of CHARACTER_SPRITES.garrick.textures.entries()) {
  assert.ok(texture.url.endsWith(`/Garrick-${states[index]}.png`));
  assert.equal(fs.existsSync(new URL(`../assets/characters/garrick/sheets/${states[index]}.png`, import.meta.url)), false);
}

// Sylva's portraits and all six reactions use her approved woodland-cleric artwork.
// The old sheets stay in ignored cold storage and cannot be selected by the loader.
for (const [index, texture] of CHARACTER_SPRITES.sylva.textures.entries()) {
  assert.ok(texture.url.endsWith(`/Sylva-${states[index]}.png`));
  assert.equal(texture.key, `sylva-${states[index]}`);
  assert.equal(fs.existsSync(new URL(`../assets/characters/sylva/sheets/${states[index]}.png`, import.meta.url)), false);
}

// Chaska's approved ridge hunter supplies every reaction and shared portrait. The
// retired artwork stays outside the loader, so it cannot reappear in a combat state.
for (const [index, texture] of CHARACTER_SPRITES.chaska.textures.entries()) {
  assert.ok(texture.url.endsWith(`/Chaska-${states[index]}.png`));
  assert.equal(texture.key, `chaska-${states[index]}`);
  assert.equal(fs.existsSync(new URL(`../assets/characters/chaska/sheets/${states[index]}.png`, import.meta.url)), false);
}

// Every Zahra state uses her approved original artwork. Authored facings keep her
// pan in her left hand; flipping even one frame would reverse that grip on screen.
for (const [index, texture] of CHARACTER_SPRITES.zahra.textures.entries()) {
  assert.ok(texture.url.endsWith(`/Zahra-${states[index]}.png`));
  assert.equal(fs.existsSync(new URL(`../assets/characters/zahra/sheets/${states[index]}.png`, import.meta.url)), false);
}
for (const state of states) {
  for (const direction of ['south-east', 'south-west', 'north-east', 'north-west']) {
    const clip = CHARACTER_SPRITES.zahra.clips[state][direction];
    assert.ok(clip.frames.every(frame => frame.flipX === false));
    if (state === 'idle' || state === 'walk') assert.equal(clip.frames.length, 16);
  }
}

preloadCharacterSprites({
  textures: { exists: () => false },
  load: { spritesheet: (key, url, options) => loaded.push({ key, url, options }) },
});
assert.equal(loaded.length, names.reduce((count, name) => count + CHARACTER_SPRITES[name].textures.length, 0));

// every requires all entries to pass the check; an empty list gives true.
assert.ok(loaded.every(({ options }) => options.frameWidth === 256 && options.frameHeight === 256));
preloadCharacterSprites({
  textures: { exists: () => true },
  load: { spritesheet: () => assert.fail('should reuse existing textures') },
});
console.log(`Sprite sheets: ${names.length} characters, complete RGBA atlases, clips, facings and cached preloading passed.`);
