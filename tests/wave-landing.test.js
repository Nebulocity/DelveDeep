import assert from 'node:assert/strict';
import { chooseWaveLandings } from '../combat/WaveLanding.js';
import { createEncounterWaves } from '../data/encounters.js';
import enemies from '../data/enemies.js';

const battlefield = {
  rows: 6, columns: 10,
  arenaPointToCell(x, y) { return { column: Math.floor(x / 175), row: Math.floor(y / 150) }; },
  getCellCenter(column, row) { return { x: (column + 0.5) * 175, y: (row + 0.5) * 150 }; }
};
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
  { id: 'void-portal', type: 'void', depth: 5 }
]) {
  for (const wave of createEncounterWaves(delve, 1750)) {
    const landings = chooseWaveLandings(wave, battlefield, terrain, partyUnits, random);
    assert.equal(landings.length, wave.enemies.length);
    assert.ok(landings.every(Boolean), `${delve.id}: ${wave.name} needs a landing for every monster`);
    assert.equal(new Set(landings.map(cell => `${cell.column},${cell.row}`)).size, landings.length);
    for (const cell of landings) {
      assert.ok(partyUnits.every(unit => {
        const partyCell = battlefield.arenaPointToCell(unit.arenaX, unit.arenaY);
        return Math.abs(cell.column - partyCell.column) > 1 || Math.abs(cell.row - partyCell.row) > 1;
      }), `${delve.id}: ${wave.name} landed adjacent to a character`);
    }
    const tier = Math.max(...wave.enemies.map(spawn =>
      (enemies[spawn.type].boss ? 1000000 : 0) + enemies[spawn.type].maxHp));
    wave.enemies.forEach((spawn, index) => {
      if ((enemies[spawn.type].boss ? 1000000 : 0) + enemies[spawn.type].maxHp !== tier) return;
      const cell = landings[index];
      assert.ok(cell.row >= 3 && cell.column >= 3 && cell.column <= 6,
        `${delve.id}: ${wave.name} highest tier landed outside upper center`);
    });
  }
}

const crowdedWave = createEncounterWaves({ id: 'thornbriar-hollow', difficulty: 'Easy' }, 1750, () => 0.999)[4];
const crowdedLandings = chooseWaveLandings(crowdedWave, battlefield, terrain, partyUnits, random);
assert.equal(crowdedWave.enemies.length, 13);
assert.ok(crowdedLandings.every(Boolean));
assert.equal(new Set(crowdedLandings.map(cell => `${cell.column},${cell.row}`)).size, 13);

const wave = { enemies: [{ type: 'caveSlime' }, { type: 'stoneCrawler' }] };
const blocked = {
  isBlocked: (x, y) => x < 350 && y > 450,
  isUnitBlocked: (_unit, x, y) => x < 350 && y > 450
};
assert.ok(chooseWaveLandings(wave, battlefield, blocked, partyUnits, random)
  .every(cell => cell && !blocked.isBlocked(cell.x, cell.y)));
const fullyBlocked = { isBlocked: () => true, isUnitBlocked: () => true };
assert.deepEqual(chooseWaveLandings(wave, battlefield, fullyBlocked, partyUnits, random), [null, null]);
const reserved = [{ column: 4, row: 5 }];
assert.ok(chooseWaveLandings(wave, battlefield, terrain, partyUnits, random, reserved)
  .every(cell => cell.column !== 4 || cell.row !== 5));
const fallen = { alive: false, arenaX: 875, arenaY: 525, container: { active: true } };
assert.ok(chooseWaveLandings(wave, battlefield, terrain, [...partyUnits, fallen], random)
  .every(cell => Math.abs(cell.column - 5) > 1 || Math.abs(cell.row - 3) > 1));
console.log('Wave landings: every delve, tier placement, character clearance, unique squares and terrain passed.');
