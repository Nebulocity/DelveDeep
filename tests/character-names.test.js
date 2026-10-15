// Old profiles must display the current names without resetting earned progression
// or changing the frozen gameplay records inside an active battle or expedition.
import assert from 'node:assert/strict';
import adventurers from '../data/adventurers.js';
import GameState from '../game/GameState.js';
import { loadProfile } from '../game/GameStorage.js';
import { packBattleValue } from '../game/BattleSnapshot.js';
import { refreshSavedCharacterNames } from '../game/SavedCharacterNames.js';

const hero = adventurers.find(member => member.id === 'zareth');
const snapshot = {
  version: 1, delveId: 'slime-cave', time: 1000, savedAtMs: 10000,
  partyIds: [hero.id], partyTemplates: [{ ...hero, name: 'Zareth' }],
  party: [{ id: hero.id, name: 'Zareth', hp: 17, mana: 9, targetName: "Zareth's Image",
    abilities: { legacySpell: { power: 37 } } }],
  enemies: [{ id: 'enemy-1', name: 'Cave Slime', hp: 23, targetName: 'Zareth' }],
  decoys: [{ id: 'decoy-1', decoyOwnerId: hero.id, name: "Zareth's Image", hp: 8, decoyUntil: 9000 }],
  events: [], traps: [], scene: { currentWaveIndex: 0 }, run: { entry: 'progression' },
  movement: { slots: [], rangeStates: [] }, preferences: packBattleValue(new Map()),
  log: { party: [{ name: 'Zareth' }], summary: { partyDamageTaken: 12 },
    entries: [{ actor: 'Zareth', target: "Zareth's Image", amount: 12, time: 0.5,
      message: "Zareth shields Zareth's Image." }],
    casualties: [{ target: 'Zareth', amount: 0 }] }
};

// Battle validation requires real resource bounds, positions and status records.
// These small fixtures are valid combat models even though no Phaser scene is running.
for (const unit of [...snapshot.party, ...snapshot.enemies, ...snapshot.decoys]) {
  Object.assign(unit, { maxHp: 100, arenaX: 500, arenaY: 300, status: {} });
}
const frozenParty = adventurers.slice(0, 5).map(member => ({ id: member.id,
  name: member.id === hero.id ? 'Zareth' : member.name, level: 4, power: 50 }));
const run = { id: 'run-1', party: frozenParty, startedAtMs: 100, endsAtMs: 10000,
  waveIntervalMs: 100, resolvedWave: 3, earnedChestCount: 0, claimedChestCount: 0 };
const profile = { gold: 123, roster: [{ id: hero.id, name: 'Zareth', level: 4, xp: 13 }],
  lastPartyIds: [hero.id], activeBattle: snapshot, everdeep: { schemaVersion: 2, runs: [run] } };
globalThis.localStorage = { getItem: () => JSON.stringify(profile) };
loadProfile(adventurers);
assert.equal(GameState.roster.find(member => member.id === hero.id).name, 'Zareth');
assert.equal(GameState.roster.find(member => member.id === hero.id).level, 4);
assert.equal(GameState.roster.find(member => member.id === hero.id).xp, 13);
assert.deepEqual(GameState.lastPartyIds, [hero.id]);
assert.equal(GameState.gold, 123);
const battle = GameState.activeBattle;
assert.ok(battle);
assert.equal(battle.partyTemplates[0].name, 'Zareth');
assert.equal(battle.party[0].name, 'Zareth');
assert.equal(battle.party[0].hp, 17);
assert.equal(battle.party[0].mana, 9);
assert.deepEqual(battle.party[0].abilities, snapshot.party[0].abilities);
assert.equal(battle.party[0].targetName, "Zareth's Image");
assert.equal(battle.enemies[0].targetName, 'Zareth');
assert.equal(battle.enemies[0].hp, 23);
assert.equal(battle.decoys[0].name, "Zareth's Image");
assert.equal(battle.decoys[0].decoyUntil, 9000);
assert.equal(battle.log.entries[0].message, "Zareth shields Zareth's Image.");
assert.equal(battle.log.entries[0].amount, 12);
assert.equal(battle.log.casualties[0].target, 'Zareth');
assert.equal(GameState.everdeep.runs[0].party[0].name, 'Zareth');
assert.equal(GameState.everdeep.runs[0].party[0].power, 50);
assert.equal(GameState.everdeep.runs[0].resolvedWave, 3);
const refreshed = JSON.stringify({ battle, everdeep: GameState.everdeep });
refreshSavedCharacterNames(GameState);
assert.equal(JSON.stringify({ battle, everdeep: GameState.everdeep }), refreshed);
assert.equal(profile.activeBattle.party[0].name, 'Zareth');
assert.equal(new Set(adventurers.map(member => member.name)).size, 15);
console.log('Current roster names restore across profiles, battles, decoys, logs and frozen expeditions without changing progress.');
