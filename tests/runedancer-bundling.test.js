// Build the two asset catalogs in memory. Source-file checks alone cannot catch paths
// that work in Vite's development server but fail inside the packaged Android game.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { ALHANNA_SPRITES } from '../data/alhannaSprites.js';
import { RUNEDANCER_EFFECTS } from '../data/runedancerEffects.js';
import { RUNEDANCER_ABILITIES } from '../data/runedancerAbilities.js';

// Every phase, including the rare weapon echo, needs a real clip before preload.
// This catches the missing-name lookup that previously crashed BattleScene.
for (const effect of RUNEDANCER_EFFECTS) {
  assert.ok(effect.clips?.length, `${effect.id} needs sprite clips`);
  for (const clip of effect.clips) {
    assert.ok(clip.key, `${effect.id} needs a texture key`);
    const png = readFileSync(new URL(clip.url));
    const cells = Math.floor(png.readUInt32BE(16) / clip.width)
      * Math.floor(png.readUInt32BE(20) / clip.height);
    assert.ok(cells >= clip.frames, `${clip.key} must contain all 32 frames`);
  }
}
assert.equal(new Set(RUNEDANCER_EFFECTS.flatMap(effect => effect.clips.map(clip => clip.key))).size, 6);
assert.equal(RUNEDANCER_EFFECTS.find(effect => effect.id === 'runic-refrain-echo').clips[0].key, 'runedancer-garnet-rune');
assert.deepEqual(RUNEDANCER_ABILITIES.map(ability => ability.name), [
  'Garnet Stride', 'Garnet Flourish', 'Garnet Spring', 'Ruby Finale',
  'Aquamarine Drift', 'Aquamarine Chassé', 'Aquamarine Glide', 'Sapphire Reprise',
  'Fluorite Sway', 'Fluorite Pivot', 'Fluorite Rise', 'Amethyst Refrain'
]);

// Published save IDs stay stable even when the displayed skill names change.
assert.deepEqual(RUNEDANCER_ABILITIES.map(ability => ability.id.replace('ability_v2_runedance_', '')), [
  'amber_cadence', 'fluorite_flourish', 'amethyst_traverse', 'topaz_finale',
  'fluorite_step', 'amber_tempo', 'amethyst_edge', 'topaz_shelter',
  'mercy_glyph', 'mirror_sigil', 'snaring_verse', 'refrain_of_return'
]);

const root = fileURLToPath(new URL('../', import.meta.url));
const result = await build({
  configFile: false,
  root,
  logLevel: 'silent',
  build: {
    write: false,
    assetsInlineLimit: 0,
    rollupOptions: {
      input: ['data/alhannaSprites.js', 'data/runedancerEffects.js'],

      // Keep the exported catalogs even though this focused bundle has no game entry.
      preserveEntrySignatures: 'strict',
    },
  },
});
const assets = result.output.filter(file => file.type === 'asset');
const code = result.output.filter(file => file.type === 'chunk').map(file => file.code).join('\n');
const urls = new Set([
  ...ALHANNA_SPRITES.textures.map(texture => texture.url),
  ...RUNEDANCER_EFFECTS.flatMap(effect => effect.clips.map(clip => clip.url)),
]);
assert.equal(urls.size, 12, 'six character sheets and six shared gemstone rune sheets');

for (const url of urls) {
  const source = readFileSync(new URL(url));
  const bundled = assets.find(asset => Buffer.from(asset.source).equals(source));
  assert.ok(bundled, `missing bundled PNG: ${url}`);
  assert.ok(code.includes(bundled.fileName), `catalog must reference bundled PNG: ${url}`);
}
console.log('Production bundle includes and references all six Alhanna sheets and six gemstone rune sheets.');
