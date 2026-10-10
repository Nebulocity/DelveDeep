// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import enemies from '../data/enemies.js';
import { ENEMY_SPRITES, preloadEnemySprites } from '../data/enemySprites.js';

const ids = ['lasher', 'ruffian', 'hedgeMage', 'rongarTheCrusher'];
const directions = ['south', 'south-east', 'east', 'south-west', 'west', 'north', 'north-east', 'north-west'];
const counts = { idle: 4, walk: 8, attack: 9, block: 5, hit: 5, death: 9 };
for (const id of ids) {
  assert.ok(enemies[id]);
  const sprite = ENEMY_SPRITES[id];
  assert.equal(sprite.textures.length, 6);

  for (const texture of sprite.textures) assert.ok(existsSync(fileURLToPath(texture.url)), texture.url);

  // Object.entries turns own fields into [key, value] pairs so we can visit or transform
  // them.
  for (const [state, count] of Object.entries(counts)) {
    for (const direction of directions) {
      const frames = sprite.clips[state][direction].frames;
      assert.equal(frames.length, count);

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      assert.equal(frames.at(-1).frame, (direction === 'north-west' ? 3 : direction === 'north' || direction === 'north-east' ? 2 : direction === 'west' || direction === 'south-west' ? 1 : 0) * count + count - 1);
    }
  }

  for (const direction of directions) {
    assert.deepEqual(sprite.clips.dead[direction].frames[0], sprite.clips.death[direction].frames.at(-1));
  }
}

const loaded = [];
preloadEnemySprites({ textures: { exists: () => false }, load: { spritesheet: (...args) => loaded.push(args) } });
assert.equal(loaded.length, Object.values(ENEMY_SPRITES).reduce((total, sprite) => total + sprite.textures.length, 0));
assert.equal(enemies.lasher.name, 'Lasher');
assert.equal(enemies.ruffian.name, 'Ruffian');
assert.equal(enemies.hedgeMage.name, 'Hedge Mage');
assert.equal(enemies.rongarTheCrusher.name, 'Rongar the Crusher');

assert.ok(enemies.hedgeMage.abilities.secondary);
assert.ok(enemies.rongarTheCrusher.abilities.primary.telegraph);
console.log('Thornbriar enemy stats, sprites and preload checks passed.');
