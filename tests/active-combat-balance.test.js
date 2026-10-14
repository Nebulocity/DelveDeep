// Verify mode switching, boss exclusions and durable optional save data.
import assert from 'node:assert/strict';
import { ACTIVE_MONSTER_POWER, prepareActiveMonster, syncActiveCombat, isActiveCombat } from '../config/activeCombatBalance.js';
import { packBattleValue, unpackBattleValue } from '../game/BattleSnapshot.js';

const scene = { game: { backgroundProgress: {} }, enemies: [] };
const base = { maxHp: 1000, hp: 400, attackPower: 20, spellDamage: 10, spellHealing: 0 };
for (const id of ['slime-cave', 'thornbriar-hollow', 'dolmark-den', 'old-quarry', 'sunken-watch', 'murmuring-abyss']) {
  const enemy = { ...base };
  const powerScale = ACTIVE_MONSTER_POWER[id] ?? 1.25;
  prepareActiveMonster(enemy, scene, { id });
  scene.enemies = [enemy];
  assert.equal(enemy.maxHp, 1150);
  assert.equal(enemy.hp, 460);
  assert.equal(enemy.attackPower, 20 * powerScale);
  assert.equal(enemy.spellDamage, 10 * powerScale);
  enemy.hp = 230;
  for (let cycle = 0; cycle < 100; cycle++) {
    scene.idleSimulating = true;
    syncActiveCombat(scene);
    assert.equal(enemy.maxHp, 1000);
    assert.equal(enemy.hp, 200);
    assert.equal(enemy.attackPower, 20);
    scene.idleSimulating = false;
    syncActiveCombat(scene);
    assert.equal(enemy.hp, 230);
  }
  scene.enemies = [unpackBattleValue(packBattleValue(enemy))];
  syncActiveCombat(scene, false);
  assert.equal(scene.enemies[0].hp, 200);
  assert.equal(scene.enemies[0].spellDamage, 10);
}

// Existing saved units and boss flags, including intermediate guardians, stay intact.
for (const [enemy, context, delve] of [
  [{ ...base, isBoss: true }, scene, { id: 'murmuring-abyss' }],
  [{ ...base }, { ...scene, restoringBattle: true }, { id: 'slime-cave' }],
  [{ ...base }, scene, { id: 'future-region' }]
]) {
  const before = structuredClone(enemy);
  prepareActiveMonster(enemy, context, delve);
  assert.deepEqual(enemy, before);
}
scene.enemies = [{ ...base }];
syncActiveCombat(scene);
assert.deepEqual(scene.enemies[0], base);

// Non-boss escorts receive only the modest increment on top of their boss-wave totals.
const escort = { ...base };
prepareActiveMonster(escort, { ...scene, currentWaveIndex: 5, bossWaveIndex: 5 }, { id: 'slime-cave' });
assert.equal(escort.maxHp, 1150);
assert.equal(escort.attackPower, 25);
for (const background of [{ hidden: true }, { isReplaying: true }, { pendingMs: 50 }]) {
  assert.equal(isActiveCombat({ game: { backgroundProgress: background } }), false);
}
assert.equal(isActiveCombat(scene), true);
console.log('Active monster stats, idle transitions, boss exclusions and save round trips passed.');
