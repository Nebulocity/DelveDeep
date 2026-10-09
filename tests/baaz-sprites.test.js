// Verify the padded attack row, petrification sequence and combat registration.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { BAAZ_SPRITES } from '../data/baazSprites.js';
import { ENEMY_SPRITES } from '../data/enemySprites.js';
import enemies from '../data/enemies.js';
import UnitSprite from '../combat/UnitSprite.js';

const sprite = BAAZ_SPRITES.baazDraconian;
const layout = JSON.parse(fs.readFileSync(new URL('../assets/enemies/baaz-draconian/reference-v2/sheets/layout.json', import.meta.url)));
assert.equal(ENEMY_SPRITES.baazDraconian, sprite);
assert.equal(UnitSprite.definitionFor({ isEnemy: true, spriteId: 'baazDraconian',
  scene: { textures: { exists: () => true } } }), sprite);
assert.equal(enemies.baazDraconian.name, 'Baaz Draconian');
assert.deepEqual(enemies.baazDraconian.abilities, {});

// Compare each authored row with its layout so padding cannot become an animation pose.
for (const [index, state] of Object.keys(layout.states).entries()) {
  const png = fs.readFileSync(new URL(sprite.textures[index].url));
  const settings = layout.states[state];
  assert.equal(png[25], 6);
  assert.equal(png.readUInt32BE(16), settings.columns * 256);
  assert.equal(png.readUInt32BE(20), 4 * 256);
  for (const [row, direction] of layout.directions.entries()) {
    const clip = sprite.clips[state][direction];
    assert.equal(clip.frames.length, settings.counts[direction]);
    assert.equal(clip.frameMs, settings.frameMs);
    assert.equal(clip.frames.at(-1).frame, row * settings.columns + settings.counts[direction] - 1);
    assert.ok(clip.frames.every(frame => frame.flipX === false));
    assert.equal(clip.frames[0].originY, layout.origins[direction].y);
  }
}
assert.equal(sprite.clips.attack['south-east'].frames.length, 7);
for (const direction of layout.directions) {
  assert.deepEqual(sprite.clips.dead[direction].frames, [sprite.clips.death[direction].frames.at(-1)]);
}
console.log('Baaz combat registration, playable cells, facings and stone death passed.');
