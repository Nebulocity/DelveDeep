// Verify encounter-local tuning, manual warning timing and save-safe definitions.
import assert from 'node:assert/strict';
import enemies from '../data/enemies.js';
import { getDelveById } from '../data/delves.js';
import { delveEnemyDefinition } from '../config/delveBalance.js';
import { abilityPower } from '../game/CharacterStats.js';

const delve = getDelveById('dolmark-den');
assert.deepEqual(delve.bossPreparation,
  { level: 15, gearRarity: 'uncommon', abilityCount: 4, spendSkillPoints: true });

// Scaling fresh spawns must leave shared catalog objects and saved-unit totals intact.
for (const [type, health, attack] of [
  ['denWarden', 2100, 9.5], ['denProtector', 3220, 13], ['denColossus', 4340, 19]
]) {
  const original = enemies[type];
  const before = structuredClone(original);
  const normal = delveEnemyDefinition(original, delve, false);
  assert.equal(normal.level, 10);
  assert.equal(normal.maxHp, health);
  assert.ok(Math.abs(normal.attackPower - attack) < 1e-9);
  assert.equal(normal.armor, original.armor);
  assert.deepEqual(original, before);

  // Escorts use the final boss scale, rather than the easier repeat-farm profile.
  const escort = delveEnemyDefinition(original, delve, true);
  assert.equal(escort.level, 15);
  assert.equal(escort.maxHp, Math.round(original.maxHp * 0.85));
  assert.equal(escort.attackPower, original.attackPower * 0.55);
}

const boss = delveEnemyDefinition(enemies.silvanarkTheForestLord, delve, true);
assert.equal(boss.maxHp, 35700);
const quake = boss.abilities.tertiary;
assert.equal(quake.name, 'Forest Quake');
assert.equal(quake.damageType, 'physical');
assert.equal(quake.telegraph, 6000);
assert.equal(quake.windup, 6000);
assert.equal(quake.cooldown, 16000);
assert.equal(quake.radius, 500);
assert.equal(quake.areaCenter, 'caster');
assert.equal(quake.autoAvoid, false);
assert.ok(Math.abs(abilityPower(boss, quake) - 1072.5) < 1e-9);
console.log('Dolmark fresh-spawn tuning, preparation and manual Forest Quake passed.');
