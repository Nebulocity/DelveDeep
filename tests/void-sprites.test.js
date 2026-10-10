// Validate the standalone sheets and the catalog together, including legacy save IDs.
// Reading PNG headers catches mismatched cell dimensions without a graphics runtime.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { VOID_SPRITES, preloadVoidSprites } from '../data/voidSprites.js';
import enemies from '../data/enemies.js';
import { createEncounterWaves } from '../data/encounters.js';
import { getDelveById } from '../data/delves.js';

const identities = ['voidCrawler', 'voidStalker', 'voidKeeper', 'abyssalSovereign', 'voidWisp'];
const directions = ['south-east', 'south-west', 'north-east', 'north-west'];
for (const id of identities) {
  const sprite = VOID_SPRITES[id];
  const layout = JSON.parse(fs.readFileSync(new URL(`../assets/enemies/murmuring-abyss/${id}/sheets/layout.json`, import.meta.url)));
  assert.deepEqual(layout.directions, directions);
  assert.ok(enemies[id], `${id} has a runtime definition`);
  const capacities = new Map();
  for (const texture of sprite.textures) {
    const png = fs.readFileSync(new URL(texture.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png[25], 6, `${id} retains RGBA transparency`);
    assert.equal(png.readUInt32BE(16) % 256, 0);
    assert.equal(png.readUInt32BE(20), texture.key === 'void-bolt' ? 256 : 1024);
    capacities.set(texture.key, png.readUInt32BE(16) / 256 * png.readUInt32BE(20) / 256);
  }
  for (const state of ['idle', 'walk', 'attack', 'block', 'hit', 'death']) assert.ok(sprite.clips[state]);
  for (const [state, clips] of Object.entries(sprite.clips)) {
    assert.equal(Object.keys(clips).length, 8);
    for (const clip of Object.values(clips)) {
      assert.ok(clip.frameMs > 0);
      for (const frame of clip.frames) {
        assert.ok(frame.frame >= 0 && frame.frame < capacities.get(frame.key), `${id}/${state} stays inside its sheet`);
        assert.equal(frame.flipX, false);
        assert.ok(frame.originY > 0 && frame.originY <= 1);
      }
    }
  }
  for (const direction of directions) {
    assert.deepEqual(sprite.clips.dead[direction].frames[0], sprite.clips.death[direction].frames.at(-1));
  }
  for (const ability of Object.values(enemies[id].abilities)) {
    assert.ok(sprite.clips[ability.animation ?? 'attack'], `${id}/${ability.name} has its chosen action clip`);
  }
}
assert.equal(VOID_SPRITES.voidWarden, VOID_SPRITES.voidKeeper);
assert.equal(VOID_SPRITES.abyssalMaw, VOID_SPRITES.voidKeeper);
assert.equal(VOID_SPRITES.riftSentinel, VOID_SPRITES.voidStalker);
assert.equal(VOID_SPRITES.voidKeeperGuardian, VOID_SPRITES.voidKeeper);
assert.equal(enemies.voidKeeperGuardian.maxHp, enemies.voidKeeper.maxHp);

// Shared bolt sheets and legacy aliases must not queue duplicate texture keys.
const loaded = [];
preloadVoidSprites({ textures: { exists: () => false }, load: { spritesheet: key => loaded.push(key) } });
assert.equal(loaded.length, new Set(loaded).size);
preloadVoidSprites({ textures: { exists: () => true }, load: { spritesheet: () => assert.fail('cached textures reloaded') } });

const waves = createEncounterWaves(getDelveById('murmuring-abyss'));
assert.equal(waves.length, 34);
assert.ok(waves.slice(0, -2).some(wave => wave.boss), 'guardian pacing stays inside the opening progression');
assert.equal(waves.at(-1).boss, true);
assert.equal(waves.at(-1).enemies[0].type, 'abyssalSovereign');
const seen = new Set(waves.flatMap(wave => wave.enemies.map(spawn => spawn.type)));
for (const id of identities) assert.ok(seen.has(id), `${id} appears in the Abyss`);
for (const wave of waves) for (const spawn of wave.enemies) assert.ok(VOID_SPRITES[spawn.type]);
console.log('Void roster, standalone RGBA sheets, action clips, save aliases and 34-wave integration passed.');
