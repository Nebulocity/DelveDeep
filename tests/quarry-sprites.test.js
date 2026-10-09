// Check the standalone Quarry sprite contract without starting Phaser. The catalogs
// must point to real transparent sheets and every clip must stay inside its own rows.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import { QUARRY_SPRITES, QUARRY_EFFECTS, preloadQuarrySprites } from '../data/quarrySprites.js';
import enemies from '../data/enemies.js';
import { getDelveById } from '../data/delves.js';
import { createEncounterWaves } from '../data/encounters.js';
import UnitSprite from '../combat/UnitSprite.js';
import { pois } from '../data/illustratedWorldMap.js';

const ids = ['quarryWorm', 'quarryBehemoth', 'quarryReaver', 'depthsSovereign'];
const states = ['facing', 'idle', 'walk', 'attack', 'cast', 'block', 'hit', 'death'];
const directions = ['south-east', 'south-west', 'north-east', 'north-west'];
const keys = new Set();

// The retained map ID must select Quarry even when an old snapshot names Dolmark.
const delve = getDelveById('old-quarry');
const waves = createEncounterWaves(delve, 1400, () => 0);
assert.equal(waves.length, 6);
assert.ok(waves.slice(0, -1).every(wave => wave.enemies.length === 3));
assert.equal(waves.at(-1).boss, true);
assert.equal(waves.at(-1).enemies[0].type, 'depthsSovereign');
assert.deepEqual([...new Set(waves.flatMap(wave => wave.enemies.map(enemy => enemy.type)))].sort(), [...ids].sort());
assert.deepEqual(createEncounterWaves({ ...delve, id: 'march-west-delves', encounterId: 'dolmark-den' }, 1400, () => 0), waves);
assert.deepEqual(createEncounterWaves(getDelveById('march-west-delves'), 1400, () => 0), waves);
assert.equal(pois.find(poi => poi.id === 'march-west-delves').template, 'old-quarry');
assert.deepEqual(delve.visuals, getDelveById('dolmark-den').visuals);
assert.equal(createEncounterWaves(getDelveById('dolmark-den'), 1400, () => 0)[0].enemies[0].type, 'denWarden');
for (const id of ids) {
  assert.deepEqual(enemies[id].abilities, {});
  assert.equal(UnitSprite.definitionFor({ isEnemy: true, spriteId: id,
    scene: { textures: { exists: () => true } } }), QUARRY_SPRITES[id]);
}

// PNG stores width, height and color type near the start of the file. Color type 6
// means RGBA, so the game can draw the creature without a rectangular background.
function checkPng(url, width, height) {
  const png = fs.readFileSync(new URL(url));
  assert.equal(png.subarray(1, 4).toString(), 'PNG');
  assert.equal(png.readUInt32BE(16), width);
  assert.equal(png.readUInt32BE(20), height);
  assert.equal(png[25], 6);
  assert.equal(png.subarray(-8, -4).toString(), 'IEND');
}

assert.deepEqual(Object.keys(QUARRY_SPRITES), ids);
for (const id of ids) {
  const sprite = QUARRY_SPRITES[id];
  const layout = JSON.parse(fs.readFileSync(new URL(`../assets/enemies/old-quarry/${id}/sheets/layout.json`, import.meta.url)));
  assert.deepEqual(layout.directions, directions);
  assert.deepEqual(Object.keys(layout.states), states);
  assert.equal(sprite.textures.length, states.length);
  assert.ok(sprite.scale > 0);
  const capacities = new Map();

  for (const [index, texture] of sprite.textures.entries()) {
    const state = states[index];
    assert.ok(!keys.has(texture.key), 'texture keys must be unique');
    keys.add(texture.key);
    assert.equal(texture.frameWidth, 256);
    assert.equal(texture.frameHeight, 256);
    checkPng(texture.url, layout.states[state].columns * 256, directions.length * 256);
    capacities.set(texture.key, layout.states[state].columns * directions.length);
  }

  for (const [state, clips] of Object.entries(sprite.clips)) {
    assert.equal(Object.keys(clips).length, 8, 'all movement headings need a view');
    for (const [direction, clip] of Object.entries(clips)) {
      assert.ok(clip.frameMs > 0);
      assert.ok(clip.frames.length > 0);
      for (const frame of clip.frames) {
        assert.ok(capacities.has(frame.key));
        assert.ok(Number.isInteger(frame.frame));
        assert.ok(frame.frame >= 0 && frame.frame < capacities.get(frame.key));
        assert.ok(frame.originX > 0 && frame.originX < 1);
        assert.ok(frame.originY > 0 && frame.originY <= 1);
        assert.equal(frame.flipX, false, 'use authored facings without mirroring');
      }
      if (state === 'dead') {
        assert.deepEqual(clip.frames, [sprite.clips.death[direction].frames.at(-1)]);
      }
    }
  }

  for (const effect of layout.effects) assert.ok(QUARRY_EFFECTS[effect]);
}

assert.equal(Object.keys(QUARRY_EFFECTS).length, 6);
for (const effect of Object.values(QUARRY_EFFECTS)) {
  assert.ok(!keys.has(effect.key));
  keys.add(effect.key);
  assert.equal(effect.count, effect.columns);
  checkPng(effect.url, effect.columns * 256, 256);
}

// The loader must skip textures already present after revisiting an encounter.
const loaded = [];
const scene = {
  textures: { exists: key => loaded.includes(key) },
  load: { spritesheet: key => loaded.push(key) }
};
preloadQuarrySprites(scene);
assert.equal(loaded.length, keys.size);
preloadQuarrySprites(scene);
assert.equal(loaded.length, keys.size);
console.log('Quarry sheets, clip bounds, effects and preload contract passed.');
