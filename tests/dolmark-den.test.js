// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import enemies from '../data/enemies.js';
import { ENEMY_SPRITES, preloadEnemySprites } from '../data/enemySprites.js';

const ids = ['denWarden', 'denProtector', 'silvanarkTheForestLord'];
const states = { idle: 4, walk: 8, attack: 8, block: 4, hit: 4, death: 8 };
const directions = ['south-east', 'south-west', 'north-east', 'north-west'];

for (const id of ids) {
  assert.ok(enemies[id]);
  const sprite = ENEMY_SPRITES[id];
  assert.equal(sprite.textures.length, 6);
  const layout = JSON.parse(readFileSync(
    new URL(`../assets/enemies/dolmark-den/${id}/reference-v2/sheets/layout.json`, import.meta.url), 'utf8'));
  assert.deepEqual(layout.directions, directions);

  // Object.entries turns own fields into [key, value] pairs so we can visit or transform
  // them.
  for (const [state, count] of Object.entries(states)) {
    assert.equal(layout.states[state].columns, count);
    const file = fileURLToPath(sprite.textures[Object.keys(states).indexOf(state)].url);
    assert.ok(existsSync(file), file);
    const png = readFileSync(file);
    assert.equal(png.readUInt32BE(16), count * 256);
    assert.equal(png.readUInt32BE(20), 4 * 256);

    for (const direction of directions) {
      assert.equal(sprite.clips[state][direction].frames.length, count);
      for (let index = 0; index < count; index++) {
        assert.ok(existsSync(fileURLToPath(new URL(
          `../assets/enemies/dolmark-den/${id}/reference-v2/${state}/${direction}/frame-${index}.png`,
          import.meta.url))));
      }
    }
  }
}

const loaded = [];
preloadEnemySprites({ textures: { exists: () => false }, load: { spritesheet: (...args) => loaded.push(args) } });
for (const id of ids) {

  // filter keeps entries whose callback returns true. It builds a new list and leaves the
  // original list in place.
  assert.equal(loaded.filter(([key]) => key.startsWith(`${id}-`)).length, 6);
}

assert.equal(enemies.silvanarkTheForestLord.boss, true);
console.log('Dolmark Den enemy sprites and runtime registration passed.');
