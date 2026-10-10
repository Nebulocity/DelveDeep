// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import delves from '../data/delves.js';
import { getDelveArena } from '../combat/LayeredEnvironment.js';
import { chooseWaveLandings } from '../combat/WaveLanding.js';
import { createEncounterWaves } from '../data/encounters.js';

import { abilityDistance, zoneContains } from '../combat/ClassAbilitySystem.js';

const context = vm.createContext({ Phaser: { Math: {

  // We handle clamp here, keeping this operation in one place for its callers.
  Clamp: (value, min, max) => Math.max(min, Math.min(max, value)),

  // We handle linear here, keeping this operation in one place for its callers.
  Linear: (a, b, t) => a + (b - a) * t, DegToRad: degrees => degrees * Math.PI / 180
} } });

for (const name of ['BattlefieldGeometry', 'BattlefieldTerrain']) {
  vm.runInContext(fs.readFileSync(new URL(`../combat/${name}.js`, import.meta.url), 'utf8')
    .replace(/^import .*;\r?\n/gm, '')
    .replace(`export default class ${name}`, `globalThis.${name} = class ${name}`), context);
}
let seed = 12345;
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

for (const [width, height] of [[2400, 1080], [960, 432]]) {
  for (const delve of delves) {

    // ... copies the source's own fields into this object; fields listed later replace
    // earlier ones. This is a shallow copy, so nested objects are still shared.
    const geometry = new context.BattlefieldGeometry({}, {
      logicalWidth: 1750, logicalHeight: 900, ...getDelveArena(delve.visuals.environment, width, height)
    });
    const terrain = new context.BattlefieldTerrain({}, geometry);

    // Interior-square shortcuts must agree with the full polygon test, including
    // concave corners, points outside the floor and different foot clearances.
    for (const padding of [0, 12, 38, 64, 80]) {
      for (let sample = 0; sample < 2000; sample += 1) {
        const x = (random() * 1.2 - 0.1) * geometry.logicalWidth;
        const y = (random() * 1.2 - 0.1) * geometry.logicalHeight;
        assert.equal(geometry.containsArenaPoint(x, y, padding),
          geometry.containsArenaPointExact(x, y, padding), `${delve.name} cached floor query`);
      }
    }

    // every requires all entries to pass the check; an empty list gives true.
    assert.ok(geometry.boundary.every(point => point.y < height * 0.78));
    assert.equal(geometry.bottomY, height * 0.78 - 12, `${delve.name} reaches the HUD frame`);

    // Lower scenery must not interrupt movement to any starting slot or across the
    // foreground.
    const walker = { id: 'foreground-walker', spriteVisual: { definition: { footY: 0 } } };
    for (const y of [24, 90, 198]) {

      // Object.assign writes these fields into its first argument. Later sources replace
      // earlier fields; nested values are not deep-copied.
      Object.assign(walker, { arenaX: 1750 * 0.1, arenaY: y });
      for (let x = walker.arenaX; x <= 1750 * 0.9; x += 7) {
        const next = terrain.resolveStep(walker, x, y, 12);
        assert.equal(next.x, x, `${delve.name} foreground traversal`);
        assert.equal(next.y, y, `${delve.name} foreground traversal`);
        Object.assign(walker, { arenaX: next.x, arenaY: next.y });
      }
    }

    assert.equal(terrain.isBlocked(0, 0, 12), true);
    assert.equal(terrain.isBlocked(-1, -1), true);

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry.
    const party = [0.18, 0.34, 0.5, 0.66, 0.82].map((fraction, index) => {
      const unit = { id: `ally-${index}`, bodyRadius: 36,
        spriteVisual: { definition: { footY: 0 } }, arenaX: fraction * 1750, arenaY: 198 };
      const safe = terrain.nearestSafeUnitPoint(unit, unit.arenaX, unit.arenaY, 12);

      // Object.assign writes these fields into its first argument. Later sources replace
      // earlier fields; nested values are not deep-copied.
      Object.assign(unit, { arenaX: safe.x, arenaY: safe.y });
      assert.equal(terrain.isUnitBlocked(unit, unit.arenaX, unit.arenaY, 12), false, `${delve.name} party spawn`);
      return unit;
    });

    for (const [waveIndex, wave] of createEncounterWaves(delve, 1750).entries()) {
      const points = chooseWaveLandings(wave, geometry, terrain, party, random);
      assert.ok(points.every(Boolean), `${delve.name} wave ${waveIndex + 1} has enough safe landings`);
      assert.ok(points.every(point => !terrain.isBlocked(point.x, point.y, 12)));
    }

    for (const unit of party) {
      for (let step = 0; step < 200; step += 1) {
        const point = terrain.resolveStep(unit, unit.arenaX + (random() - 0.5) * 90,
          unit.arenaY + (random() - 0.5) * 90, 12);
        Object.assign(unit, { arenaX: point.x, arenaY: point.y });
        assert.equal(terrain.isUnitBlocked(unit, unit.arenaX, unit.arenaY, 12), false);
      }
    }
  }
}

assert.equal(abilityDistance({}, { x: 99, y: 50 }, { x: 101, y: 50 }), 0.02);
assert.equal(abilityDistance({}, { x: 0, y: 0 }, { x: 60, y: 80 }), 1);
assert.equal(zoneContains({}, { x: 201, y: 0 }, { x: 0, y: 0 }, 2), false);
console.log('All authored arenas: HUD clipping, safe party/enemy spawns, continuous distances and legal movement passed.');
