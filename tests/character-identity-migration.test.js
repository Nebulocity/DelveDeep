// Former spellings are deliberate fixtures here. Every link in a legacy save must
// migrate together; replacing only roster IDs would silently break an ongoing battle.
import assert from 'node:assert/strict';
import adventurers from '../data/adventurers.js';
import GameState from '../game/GameState.js';
import { loadProfile, saveProfile } from '../game/GameStorage.js';
import { packBattleValue, unpackBattleValue, validBattleSnapshot } from '../game/BattleSnapshot.js';
import { migrateCharacterIdentities } from '../game/CharacterIdentityMigration.js';
import { loadLastCombatLog } from '../combat/CombatLog.js';
import { PROFILE_STORAGE_KEY } from '../game/BuildSave.js';

const formerCharacters = [
  ['sturm', 'Sturm', 'Aldren', 'aldren'],
  ['fistandantilus', 'Fistandantilus', 'Malrec', 'malrec'],
  ['mishakal', 'Mishakal', 'Solenne', 'selenne'],
  ['goldmoon', 'Goldmoon', 'Sylva', 'sylva'],
  ['flint', 'Flint', 'Brogan', 'durgrim'],
  ['riverwind', 'Riverwind', 'Torren', 'chaska'],
  ['tika', 'Tika', 'Mara', 'zahra'],
  ['tasslehoff', 'Tasslehoff', 'Pip', 'yasmin'],
  ['dalamar', 'Dalamar', 'Corven', 'zareth'],
  ['palin', 'Palin', 'Oren', 'nadira'],
  ['tanis', 'Tanis', 'Rowan', 'orwen']
];
const storage = new Map();
globalThis.localStorage = { getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value) };
loadProfile(adventurers);
saveProfile();
const profile = JSON.parse(storage.get(PROFILE_STORAGE_KEY));
const beforeGear = structuredClone(profile.inventory.equipment);
const oldByCurrentId = new Map(formerCharacters.map(([id, name, provisional, currentId]) =>
  [currentId, { id, name, provisional }]));
profile.gold = 321;
for (const member of profile.roster) {
  const old = oldByCurrentId.get(member.id);
  if (!old) continue;
  member.id = old.id;
  member.name = old.name;
  member.level = 4;
  member.xp = 13;
  member.happiness = 68;
  member.delvesCompleted = 2;
  member.skillPoints = 7;
}
profile.roster.find(member => member.id === 'garrick').level = 4;
profile.roster.find(member => member.id === 'garrick').xp = 13;
profile.lastPartyIds = ['garrick', 'dalamar'];
const templates = ['garrick', 'dalamar'].map(id => {
  const currentId = formerCharacters.find(row => row[0] === id)?.[3] ?? id;
  const base = adventurers.find(hero => hero.id === currentId);
  return { ...base, id, spriteId: id, name: oldByCurrentId.get(currentId)?.name ?? base.name };
});
const unit = (template, hp) => ({ ...template, hp, maxHp: 500, mana: 17,
  arenaX: 500, arenaY: 300, status: { shield: { ownerId: 'dalamar', until: 7000 } },
  targetName: 'Garrick', targetId: 'garrick',
  abilities: { legacySpell: { power: 37, cooldown: 900 } } });
const snapshot = {
  version: 1, delveId: 'slime-cave', time: 1000, savedAtMs: 10000,
  partyIds: profile.lastPartyIds, partyTemplates: packBattleValue(templates),
  party: [unit(templates[0], 113), { ...unit(templates[1], 217),
    pendingAction: { id: 4, name: 'Shadow Bolt', startAt: 900, duration: 250 },
    savedFrame: { key: 'dalamar-reference-v2-idle', frame: 2 } }],
  enemies: [{ ...unit({ id: 'enemy-1', name: 'Cave Slime' }, 23), enemyType: 'slime' }],
  decoys: [{ ...unit({ id: 'decoy-1', name: "Dalamar's Image", spriteId: 'dalamar' }, 8),
    decoyOwnerId: 'dalamar', decoyUntil: 9000 }],
  events: [{ remainingMs: 150, data: { kind: 'classAbility', unitId: 'dalamar',
    targetId: 'garrick', actionId: 4 } }],
  traps: [{ ownerId: 'dalamar', point: { x: 600, y: 300 }, until: 11000 }],
  scene: packBattleValue({ currentWaveIndex: 0,
    selectedUnitIds: new Set(['garrick']),
    healerPriorityTargets: new Map([['dalamar', 'garrick']]),
    enemyThreat: new Map([['enemy-1', new Map([['garrick', 75], ['dalamar', 20]])]]) }),
  run: { entry: 'progression', startingGold: 280 },
  movement: { slots: [{ ownerId: 'dalamar', state: { targetId: 'garrick', x: 400, y: 300 } }], rangeStates: [] },
  preferences: packBattleValue(new Map([['dalamar', 'ranged']])),
  log: { party: [{ name: 'Garrick' }, { name: 'Dalamar' }], summary: { partyDamageTaken: 12 },
    entries: [{ actor: 'Dalamar', target: 'Garrick', amount: 12, time: 0.5,
      message: 'Dalamar shields Garrick.' }], casualties: [{ target: 'Garrick', time: 0.2 }] }
};
profile.activeBattle = snapshot;
profile.everdeep = { schemaVersion: 2, runs: [{ id: 'run-1',
  party: profile.roster.slice(0, 5).map(hero => ({ id: hero.id, name: hero.name, level: 4, power: 50 })),
  startedAtMs: 100, endsAtMs: 10000, waveIntervalMs: 100, resolvedWave: 3,
  earnedChestCount: 0, claimedChestCount: 0 }] };
assert.equal(validBattleSnapshot(snapshot, profile.roster), true);
const original = JSON.stringify(profile);
storage.set(PROFILE_STORAGE_KEY, original);
storage.set('delveDeep.lastCombatLog.v1', JSON.stringify(snapshot.log));
loadProfile(adventurers);
assert.equal(GameState.gold, 321);
assert.deepEqual(GameState.inventory.equipment, beforeGear);
for (const [, , , id] of formerCharacters) {
  const restored = GameState.roster.find(member => member.id === id);
  assert.equal(restored.name, adventurers.find(member => member.id === id).name);
  assert.equal(restored.level, 4);
  assert.equal(restored.xp, 13);
  assert.equal(restored.happiness, 68);
  assert.equal(restored.delvesCompleted, 2);
  assert.equal(restored.skillPoints, 7);
  const prior = profile.roster.find(member => member.id === oldByCurrentId.get(id).id);
  assert.deepEqual(restored.equipment, prior.equipment);
  assert.deepEqual(restored.abilityRanks, prior.abilityRanks);
  assert.deepEqual(restored.abilityLoadout, prior.abilityLoadout);
}
const battle = GameState.activeBattle;
assert.equal(validBattleSnapshot(battle, GameState.roster), true);
assert.deepEqual(GameState.lastPartyIds, ['garrick', 'zareth']);
assert.deepEqual(battle.partyIds, ['garrick', 'zareth']);
assert.equal(battle.party[1].hp, 217);
assert.equal(battle.party[1].mana, 17);
assert.equal(battle.party[1].spriteId, 'zareth');
assert.equal(battle.party[1].savedFrame.key, 'zareth-reference-v2-idle');
assert.equal(battle.party[1].status.shield.ownerId, 'zareth');
assert.equal(battle.party[1].status.shield.until, 7000);
assert.deepEqual(battle.party[1].abilities, snapshot.party[1].abilities);
assert.deepEqual(battle.party[1].pendingAction, snapshot.party[1].pendingAction);
assert.equal(battle.enemies[0].targetId, 'garrick');
assert.equal(battle.decoys[0].decoyOwnerId, 'zareth');
assert.equal(battle.decoys[0].name, "Zareth's Image");
assert.equal(battle.traps[0].ownerId, 'zareth');
assert.deepEqual(battle.events[0], { remainingMs: 150,
  data: { kind: 'classAbility', unitId: 'zareth', targetId: 'garrick', actionId: 4 } });
assert.equal(battle.movement.slots[0].ownerId, 'zareth');
assert.equal(battle.movement.slots[0].state.targetId, 'garrick');
assert.deepEqual(unpackBattleValue(battle.scene).selectedUnitIds, new Set(['garrick']));
assert.equal(unpackBattleValue(battle.scene).enemyThreat.get('enemy-1').get('garrick'), 75);
assert.equal(unpackBattleValue(battle.scene).healerPriorityTargets.get('zareth'), 'garrick');
assert.equal(unpackBattleValue(battle.preferences).get('zareth'), 'ranged');
assert.equal(battle.log.entries[0].message, 'Zareth shields Garrick.');
assert.equal(battle.log.entries[0].amount, 12);
assert.equal(loadLastCombatLog().entries[0].message, 'Zareth shields Garrick.');
assert.equal(GameState.everdeep.runs[0].party[0].id, 'zareth');
assert.equal(GameState.everdeep.runs[0].party[0].power, 50);
assert.equal(GameState.everdeep.runs[0].resolvedWave, 3);
assert.equal(storage.get(PROFILE_STORAGE_KEY), original);

// The first pass changed names while retaining the former IDs. Both generations of
// names and the oldest aliases must still load, and running migration twice is safe.
for (const [id, , provisional, currentId] of formerCharacters) {
  assert.deepEqual(migrateCharacterIdentities({ id, name: provisional }),
    { id: currentId, name: adventurers.find(hero => hero.id === currentId).name });
}
assert.equal(migrateCharacterIdentities('aoth'), 'malrec');
assert.equal(migrateCharacterIdentities('pipeline, foreign, temporary'), 'pipeline, foreign, temporary');
const migrated = migrateCharacterIdentities(profile);
assert.deepEqual(migrateCharacterIdentities(migrated), migrated);
saveProfile();
const committed = JSON.parse(storage.get(PROFILE_STORAGE_KEY));
assert.equal(committed.roster.some(member => member.id === 'garrick'), true);
loadProfile(adventurers);
assert.equal(GameState.roster.find(hero => hero.id === 'garrick').xp, 13);
console.log('Remaining legacy identities, gear, progression, battle links, texture keys, logs and frozen expeditions migrate together.');
