// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import { chooseWaveLandings } from '../combat/WaveLanding.js';
import { createEncounterWaves } from '../data/encounters.js';
import enemies from '../data/enemies.js';

const battlefield = { logicalWidth: 1750, logicalHeight: 900 };

// map builds one output entry for each input entry, in the same order. The callback's
// return value becomes that output entry.
const partyUnits = [0, 2, 4, 6, 8].map(column => ({
  alive: true, arenaX: (column + 0.5) * 175, arenaY: 75
}));
const terrain = { isBlocked: () => false, isUnitBlocked: () => false };
let seed = 12345;
const random = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

for (const delve of [
  { id: 'slime-cave', difficulty: 'Easy' },
  { id: 'thornbriar-hollow', difficulty: 'Easy' },
  { id: 'forgotten-cavern', difficulty: 'Difficult' },
  { id: 'forgotten-cavern', difficulty: 'Impossible' },

  { id: 'void-portal', type: 'void', depth: 5 }
]) {
  for (const [waveIndex, wave] of createEncounterWaves(delve, 1750).entries()) {
    const landings = chooseWaveLandings(wave, battlefield, terrain, partyUnits, random);
    assert.equal(landings.length, wave.enemies.length);

    // every requires all entries to pass the check; an empty list gives true.
    assert.ok(landings.every(Boolean), `${delve.id}: wave ${waveIndex + 1} needs a landing for every monster`);

    // A Set keeps each value once. has checks membership without searching a list for
    // duplicate entries.
    assert.equal(new Set(landings.map(point => `${point.x},${point.y}`)).size, landings.length);
    for (const point of landings) {
      assert.ok(partyUnits.every(unit => Math.hypot(point.x - unit.arenaX, point.y - unit.arenaY) >= 240));
      assert.ok(landings.every(other => other === point || Math.hypot(other.x - point.x, other.y - point.y) >= 110));
    }

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound. ... expands these entries into the new list
    // or call. It does not deep-copy the objects inside.
    const tier = Math.max(...wave.enemies.map(spawn =>
      (enemies[spawn.type].boss ? 1000000 : 0) + enemies[spawn.type].maxHp));
    wave.enemies.forEach((spawn, index) => {

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      if ((enemies[spawn.type].boss ? 1000000 : 0) + enemies[spawn.type].maxHp !== tier) return;
      const cell = landings[index];
      assert.ok(cell.y >= 495 && cell.x >= 525 && cell.x <= 1225,
        `${delve.id}: wave ${waveIndex + 1} highest tier landed outside upper center`);
    });
  }
}

const crowdedWave = { enemies: Array.from({ length: 13 }, () => ({ type: 'ruffian' })) };
const crowdedLandings = chooseWaveLandings(crowdedWave, battlefield, terrain, partyUnits, random);
assert.equal(crowdedWave.enemies.length, 13);
assert.ok(crowdedLandings.every(Boolean));
assert.equal(new Set(crowdedLandings.map(point => `${point.x},${point.y}`)).size, 13);

const wave = { enemies: [{ type: 'caveSlime' }, { type: 'stoneCrawler' }] };
const blocked = {

  // Reject a point outside the walkable floor, beyond padded bounds or too close to
  // blocking terrain.
  isBlocked: (x, y) => x < 350 && y > 450,

  // This check answers whether unit blocked. The caller uses the returned result to decide
  // whether to continue with that action.
  isUnitBlocked: (_unit, x, y) => x < 350 && y > 450
};

assert.ok(chooseWaveLandings(wave, battlefield, blocked, partyUnits, random)
  .every(cell => cell && !blocked.isBlocked(cell.x, cell.y)));
const fullyBlocked = { isBlocked: () => true, isUnitBlocked: () => true };
assert.deepEqual(chooseWaveLandings(wave, battlefield, fullyBlocked, partyUnits, random), [null, null]);
const reserved = [{ x: 800, y: 750 }];
assert.ok(chooseWaveLandings(wave, battlefield, terrain, partyUnits, random, reserved)
  .every(cell => Math.hypot(cell.x - 800, cell.y - 750) >= 110));

const fallen = { alive: false, arenaX: 875, arenaY: 525, container: { active: true } };
assert.ok(chooseWaveLandings(wave, battlefield, terrain, [...partyUnits, fallen], random)
  .every(cell => Math.hypot(cell.x - fallen.arenaX, cell.y - fallen.arenaY) >= 240));
console.log('Wave landings: every delve, tier placement, character clearance, distinct positions and terrain passed.');
