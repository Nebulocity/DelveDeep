import assert from 'node:assert/strict';
import delves from '../data/delves.js';
import enemies from '../data/enemies.js';
import { createEncounterWaves } from '../data/encounters.js';
import { getBattleLayout } from '../ui/Layout.js';
import { loadLeaderProgression, saveLeaderProgression, grantLeaderLevels, recordDepthClear, purchaseLeaderAbility, toggleLeaderLoadoutAbility, leaderAbilities } from '../game/LeaderProgression.js';

const saved = new Map();
globalThis.localStorage = {
  getItem: (key) => saved.get(key) ?? null,
  setItem: (key, value) => saved.set(key, value)
};
const key = 'delveDeep.leaderProgression.v1';

// Existing point balances, purchases, and loadouts survive the TP rename.
localStorage.setItem(key, JSON.stringify({
  level: 10, highestClearedDepth: 9, inspirationPoints: 3,
  spentInspiration: 2, unlockedAbilities: ['focusFire', 'brace'],
  battleLoadout: ['brace', 'focusFire']
}));
let leader = loadLeaderProgression();
assert.equal(leader.tacticsPoints, 3);
assert.equal(leader.spentTacticsPoints, 2);
assert.deepEqual(leader.battleLoadout, ['brace', 'focusFire']);
assert.equal(purchaseLeaderAbility(leader, 'arise'), true);
assert.equal(leader.tacticsPoints, 1);
assert.equal(purchaseLeaderAbility(leader, 'arise'), false);
const migrated = JSON.parse(localStorage.getItem(key));
assert.equal(migrated.inspirationPoints, undefined);
assert.equal(migrated.spentInspiration, undefined);
assert.equal(loadLeaderProgression().tacticsPoints, 1);

// Zero TP must not restore a legacy balance if both keys are present.
localStorage.setItem(key, JSON.stringify({ tacticsPoints: 0, inspirationPoints: 9 }));
assert.equal(loadLeaderProgression().tacticsPoints, 0);

// Developer levels use the existing milestone rule and cannot be undone
// or rewarded twice by clearing a lower depth afterwards.
saved.clear();
leader = loadLeaderProgression();
grantLeaderLevels(leader, 3);
assert.equal(leader.level, 4);
assert.equal(leader.tacticsPoints, 0);
grantLeaderLevels(leader);
assert.equal(leader.level, 5);
assert.equal(leader.tacticsPoints, 1);
recordDepthClear(leader, 2);
assert.equal(leader.level, 5);
assert.equal(leader.tacticsPoints, 1);
recordDepthClear(leader, 9);
assert.equal(leader.level, 10);
assert.equal(leader.tacticsPoints, 2);
recordDepthClear(leader, 9);
assert.equal(leader.tacticsPoints, 2);
saveLeaderProgression(leader);
assert.equal(loadLeaderProgression().level, 10);

// The player can equip exactly five unlocked tactics, not six or duplicates.
leader.unlockedAbilities = leaderAbilities.map((ability) => ability.id);
leader.battleLoadout = [];
for (const ability of leaderAbilities.slice(0, 5)) {
  assert.equal(toggleLeaderLoadoutAbility(leader, ability.id), true);
}
assert.equal(toggleLeaderLoadoutAbility(leader, 'arise'), false);
assert.equal(toggleLeaderLoadoutAbility(leader, 'brace'), true);
assert.equal(toggleLeaderLoadoutAbility(leader, 'arise'), true);
assert.equal(leader.battleLoadout.length, 5);

// Each difficulty retains its original waves and ends with the requested
// boss group. Every spawn type resolves to real enemy data.
const slimeCave = delves.find((delve) => delve.id === 'slime-cave');
assert.ok(slimeCave.visuals?.battlefieldBackground?.key);
assert.ok(slimeCave.visuals?.battlefieldBackground?.url);
assert.equal(delves.filter((delve) => delve.visuals?.battlefieldBackground).length, 1);
for (const delve of delves) {
  const waves = createEncounterWaves(delve);
  const counts = { Easy: 4, Moderate: 5, Void: 6 };
  const finalCounts = { Easy: 1, Moderate: 3, Void: 4 };
  assert.equal(waves.length, counts[delve.difficulty]);
  assert.equal(delve.rooms, waves.length);
  const final = waves.at(-1);
  assert.equal(final.boss, true);
  assert.equal(final.enemies.length, finalCounts[delve.difficulty]);
  assert.equal(final.enemies.filter((spawn) => enemies[spawn.type].boss).length, 1);
  assert.ok(enemies[final.enemies[0].type].maxHp >= 2600);
  assert.ok(enemies[final.enemies[0].type].bodyRadius > 45);
  for (const wave of waves) {
    for (const spawn of wave.enemies) assert.ok(enemies[spawn.type]);
  }
  waves[0].enemies[0].arenaX = -999;
  assert.notEqual(createEncounterWaves(delve)[0].enemies[0].arenaX, -999);
}
const milestone = createEncounterWaves({ difficulty: 'Easy', depth: 5 });
assert.equal(milestone.length, 5);
assert.equal(milestone.at(-2).milestoneBoss, true);
assert.equal(milestone.at(-1).enemies[0].type, 'slimeSovereign');

// Check the entire button group, internal text rows, and header separation
// at the game's logical resolution. Phaser FIT preserves this geometry on
// landscape phones; the widest boss label offsets also clear the controls.
for (let count = 1; count <= 5; count++) {
  const layout = getBattleLayout(2400, 1080, count);
  assert.equal((layout.positions[0] + layout.positions.at(-1)) / 2, 1200);
  assert.ok(layout.positions[0] - layout.buttonWidth / 2 >= 345);
  assert.ok(layout.positions.at(-1) + layout.buttonWidth / 2 <= 2055);
  assert.ok(layout.titleY + 29 < layout.messageY - 24);
  assert.ok(layout.messageY + 24 < layout.statusY - 20);
  assert.ok(layout.statusY + 20 < layout.labelY - 17);
  assert.ok(layout.labelY + 17 < layout.buttonY - layout.buttonHeight / 2);
  assert.ok(layout.arenaTop - 169 * 0.74 - 14 > layout.buttonY + layout.buttonHeight / 2);
  for (let index = 1; index < count; index++) {
    assert.ok(layout.positions[index] - layout.positions[index - 1] > layout.buttonWidth);
  }
}
console.log('Progression, encounter, and layout checks passed.');
