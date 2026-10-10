// This is a direct Node check of the game rules. Assertions stop the script when a result
// differs from the expected value. Test fixtures are deliberately small inputs that make a
// particular rule easy to check without launching the game.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const context = vm.createContext({
  Phaser: { Math: { Between: (min) => min, RND: { pick: (choices) => choices[0] } } }
});
vm.runInContext(fs.readFileSync(new URL('../combat/TacticsController.js', import.meta.url), 'utf8')
  .replace(/^import .*;\r?\n/gm, '')
  .replace('export default class TacticsController', 'globalThis.TacticsController = class TacticsController'), context);

const battlefield = {
  logicalWidth: 1750,
  logicalHeight: 900,

  // We work out cell bounds here so callers can use the result. Keep the calculation
  // together with the checks below that decide which inputs are usable.
  getCellBounds(column, row) {
    const width = this.logicalWidth / 10;
    const height = this.logicalHeight / 6;
    return { left: column * width, right: (column + 1) * width, bottom: row * height, top: (row + 1) * height };
  }
};

for (const roles of [
  ['Melee DPS', 'Ranged DPS', 'Healer', 'Tank', 'Melee DPS'],
  ['Melee DPS', 'Healer', 'Tank', 'Melee DPS', 'Ranged DPS'],
  ['Melee DPS', 'Healer', 'Tank', 'Healer', 'Ranged DPS']
]) {

  // map builds one output entry for each input entry, in the same order. The callback's
  // return value becomes that output entry.
  const units = roles.map((role, index) => ({ id: `unit-${index}`, role }));
  const tactics = new context.TacticsController(battlefield);
  tactics.registerParty(units);
  const positions = units.map((unit, index) => tactics.getSpawnPosition(unit, index));
  const columns = positions.map((position) => Math.round((position.x / 1750 - 0.18) / 0.08));

  // A Set keeps each value once. has checks membership without searching a list for
  // duplicate entries.
  assert.equal(new Set(columns).size, 5);

  // every requires all entries to pass the check; an empty list gives true.
  assert.ok(positions.every((position) => position.y >= 0 && position.y < 225));
  assert.equal(columns[roles.indexOf('Tank')], 4);
  units.forEach((unit, index) => {
    if (unit.role === 'Healer') assert.ok([2, 6].includes(columns[index]));
  });

  // filter keeps entries whose callback returns true. It builds a new list and leaves the
  // original list in place.
  if (roles.filter((role) => role === 'Healer').length === 2) {
    units.forEach((unit, index) => {
      if (unit.role.includes('DPS')) assert.ok([0, 8].includes(columns[index]));
    });
  }
}

console.log('Party spawn: continuous lower-arena positions and role-centered positions passed.');
