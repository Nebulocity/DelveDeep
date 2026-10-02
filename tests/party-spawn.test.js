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
  const units = roles.map((role, index) => ({ id: `unit-${index}`, role }));
  const tactics = new context.TacticsController(battlefield);
  tactics.registerParty(units);
  const positions = units.map((unit, index) => tactics.getSpawnPosition(unit, index));
  const columns = positions.map((position) => Math.floor(position.x / 175));
  assert.equal(new Set(columns).size, 5);
  assert.ok(positions.every((position) => position.y >= 0 && position.y < 150));
  assert.equal(columns[roles.indexOf('Tank')], 4);
  units.forEach((unit, index) => {
    if (unit.role === 'Healer') assert.ok([2, 6].includes(columns[index]));
  });
  if (roles.filter((role) => role === 'Healer').length === 2) {
    units.forEach((unit, index) => {
      if (unit.role.includes('DPS')) assert.ok([0, 8].includes(columns[index]));
    });
  }
}

console.log('Party spawn: bottom-row squares and role-centered positions passed.');
