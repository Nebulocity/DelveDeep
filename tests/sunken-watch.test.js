// Check the new roster, legacy map identity and standalone atlases together. PNG headers
// verify Phaser's cell dimensions without needing a browser or a generation service.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import enemies from '../data/enemies.js';
import { createEncounterWaves } from '../data/encounters.js';
import { getDelveById } from '../data/delves.js';
import { pois } from '../data/illustratedWorldMap.js';
import { SUNKEN_WATCH_SPRITES, preloadSunkenWatchSprites } from '../data/sunkenWatchSprites.js';

const identities = ['sunkenWatcher', 'deepTongue', 'drownedKnell', 'earthsinker'];
const delve = getDelveById('sunken-watch');
const waves = createEncounterWaves(delve, 1400, () => 0);
assert.equal(waves.length, 24);
assert.ok(waves.slice(0, -1).every(wave => wave.enemies.length === 6));
assert.equal(waves.at(-1).boss, true);
assert.equal(waves.at(-1).enemies[0].type, 'earthsinker');
const seen = new Set(waves.flatMap(wave => wave.enemies.map(enemy => enemy.type)));
assert.deepEqual([...seen].sort(), [...identities].sort());

// The old map ID takes precedence over its formerly saved Thornbriar template.
const legacy = { ...delve, id: 'verge-delves', encounterId: 'thornbriar-hollow' };
assert.deepEqual(createEncounterWaves(legacy, 1400, () => 0), waves);
assert.equal(getDelveById('verge-delves').id, 'verge-delves');
assert.deepEqual(createEncounterWaves(getDelveById('verge-delves'), 1400, () => 0), waves);
assert.equal(pois.find(poi => poi.id === 'verge-delves').template, 'sunken-watch');
assert.notDeepEqual(delve.visuals, getDelveById('thornbriar-hollow').visuals);
assert.deepEqual(getDelveById('verge-delves').visuals, delve.visuals);
assert.equal(createEncounterWaves(getDelveById('thornbriar-hollow'), 1400, () => 0)[0].enemies[0].type, 'ruffian');

for (const id of identities) {
  assert.ok(Object.keys(enemies[id].abilities).length >= 2, 'catalog skills are authored');
  const sprite = SUNKEN_WATCH_SPRITES[id];
  const layout = JSON.parse(fs.readFileSync(new URL(`../assets/enemies/sunken-watch/${id}/sheets/layout.json`, import.meta.url)));
  assert.deepEqual(layout.directions, ['south-east', 'south-west', 'north-east', 'north-west']);
  const capacities = new Map();
  for (const texture of sprite.textures) {
    const png = fs.readFileSync(new URL(texture.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png[25], 6, 'RGBA transparency');
    assert.equal(png.readUInt32BE(16) % texture.frameWidth, 0);
    assert.equal(png.readUInt32BE(20), texture.frameHeight * 4);
    capacities.set(texture.key, png.readUInt32BE(16) / texture.frameWidth * 4);
  }
  for (const state of ['idle', 'walk', 'attack', 'cast', 'block', 'hit', 'death', 'dead']) {
    assert.equal(Object.keys(sprite.clips[state]).length, 8);
    for (const clip of Object.values(sprite.clips[state])) {
      assert.ok(clip.frameMs > 0);
      assert.ok(clip.frames.length >= (state === 'dead' ? 1 : 4));
      for (const frame of clip.frames) {
        assert.ok(frame.frame >= 0 && frame.frame < capacities.get(frame.key));
        assert.equal(frame.flipX, false);
        assert.ok(frame.originY > 0 && frame.originY <= 1);
      }
    }
  }
}

const loaded = [];
preloadSunkenWatchSprites({ textures: { exists: () => false }, load: { spritesheet: key => loaded.push(key) } });
assert.equal(loaded.length, 28);
assert.equal(new Set(loaded).size, loaded.length);
preloadSunkenWatchSprites({ textures: { exists: () => true }, load: { spritesheet: () => assert.fail('cached texture reloaded') } });
console.log('Sunken Watch roster, 24 waves, old saves, dedicated chamber and RGBA clips passed.');
