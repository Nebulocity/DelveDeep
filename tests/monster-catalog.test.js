// Exercise the revised roster and difficulty progression independently of the workbook.
// These assertions protect authored counts, farm positions and the preserved boss response.
import assert from 'node:assert/strict';
import enemies from '../data/enemies.js';
import { getDelveById } from '../data/delves.js';
import { createEncounterWaves } from '../data/encounters.js';
import { abilityPower } from '../game/CharacterStats.js';

for (const [id, count, boss] of [
  ['slime-cave', 6, 'slimeSovereign'], ['thornbriar-hollow', 10, 'rongarTheCrusher'],
  ['dolmark-den', 16, 'silvanarkTheForestLord'], ['old-quarry', 24, 'depthsSovereign'],
  ['sunken-watch', 24, 'earthsinker'], ['murmuring-abyss', 34, 'abyssalSovereign']
]) {
  const delve = getDelveById(id);
  const waves = createEncounterWaves(delve, 1400, () => 0);
  assert.equal(delve.rooms, count);
  assert.equal(waves.length, count);
  assert.equal(waves.at(-1).enemies[0].type, boss);
  assert.equal(waves.at(-1).boss, true);
  assert.ok(!waves.at(-2).boss, 'the farming composition is second-to-last');
  assert.equal(waves.flatMap(w => w.enemies).filter(e => e.type === boss).length, 1);
  const before = waves[1].enemies[0].arenaX;
  waves[0].enemies[0].arenaX = -100;
  assert.equal(waves[1].enemies[0].arenaX, before, 'spawns never share mutable records');
}

assert.deepEqual(createEncounterWaves(getDelveById('slime-cave')).map(w => w.enemies.length), [3, 5, 4, 3, 3, 4]);
assert.deepEqual(createEncounterWaves(getDelveById('thornbriar-hollow')).map(w => w.enemies.length), [3, 3, 4, 4, 6, 6, 8, 8, 10, 7]);
assert.equal(enemies.quarryWorm.maxHp, 5200);
assert.equal(enemies.depthsSovereign.armor, 950);
assert.equal(enemies.earthsinker.maxHp, 50000);
assert.equal(enemies.abyssalSovereign.maxHp, 84000);
assert.equal(enemies.denColossus.boss, false);
assert.equal(enemies.lasher.attackRange, 210);

// Check the exported totals after catalog overrides and shared normalization. Hedge
// Mage's spell stats must survive without changing its physical attack or skill potency.
for (const [type, health, armor, attack, spellDamage, spellHealing] of [
  ['ruffian', 3360, 96, 35, 35, 0],
  ['lasher', 9800, 144, 39, 39, 0],
  ['hedgeMage', 9800, 144, 64, 128, 64],
  ['rongarTheCrusher', 30000, 200, 275, 275, 0]
]) {
  const enemy = enemies[type];
  assert.deepEqual([enemy.level, enemy.maxHp, enemy.armor, enemy.attackPower,
    enemy.spellDamage, enemy.spellHealing], [3, health, armor, attack, spellDamage, spellHealing]);
}
assert.equal(abilityPower(enemies.lasher, enemies.lasher.abilities.primary), 78);
assert.equal(abilityPower(enemies.hedgeMage, enemies.hedgeMage.abilities.primary), 230.4);
assert.ok(Math.abs(abilityPower(enemies.hedgeMage, enemies.hedgeMage.abilities.secondary) - 128 * 15 / 7) < 1e-9);

assert.equal(enemies.abyssalSovereign.abilities.tertiary.name, "Sovereign's Ruin");
assert.equal(abilityPower(enemies.slimeSovereign, enemies.slimeSovereign.abilities.tertiary), 690);
assert.equal(enemies.rongarTheCrusher.abilities.secondary.stunDuration, 3000);
assert.equal(enemies.rongarTheCrusher.abilities.tertiary.damageType, 'spell');
console.log('Revised catalog, authored wave counts, independent spawns and final boss mechanics passed.');
