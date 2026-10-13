// Exercise encrypted transfers and interrupted two-record replacements without Phaser.
import assert from 'node:assert/strict';
import { encryptSnapshot, decryptSnapshot, validateSnapshot, replaceSnapshot,
  recoverInterruptedRestore, RECOVERY_KEY, JOURNAL_KEY } from '../game/SaveTransfer.js';
import { PROFILE_STORAGE_KEY, LEADER_STORAGE_KEY } from '../game/BuildSave.js';

const passphrase = 'private QA backup passphrase';
const snapshot = {
  app: 'com.waywardkobold.app', version: 1, createdAt: 1791834116000,
  profile: JSON.stringify({ gold: 73, roster: [{ id: 'caramon', level: 2, xp: 12 }],
    inventory: { equipment: [], materials: {}, knownRecipes: [], nextEquipmentId: 1 },
    world: { currentLocation: 'pineshire', discoveredLocations: ['pineshire'], clearedDelves: [] } }),
  leader: JSON.stringify({ level: 2, xp: 3, tacticsPoints: 1, spentTacticsPoints: 0,
    unlockedAbilities: ['focusFire'], battleLoadout: ['focusFire'] })
};
const encrypted = await encryptSnapshot(snapshot, passphrase);
assert.deepEqual(await decryptSnapshot(encrypted, passphrase), snapshot);
assert.equal(encrypted.includes('caramon'), false);
assert.notEqual(await encryptSnapshot(snapshot, passphrase), encrypted);
await assert.rejects(decryptSnapshot(encrypted, 'a different passphrase'), /Incorrect passphrase/);
await assert.rejects(decryptSnapshot(JSON.stringify(snapshot), passphrase), /Unsupported/);
const changed = JSON.parse(encrypted);
changed.data = (changed.data[0] === 'A' ? 'B' : 'A') + changed.data.slice(1);
await assert.rejects(decryptSnapshot(JSON.stringify(changed), passphrase), /changed or damaged/);
assert.throws(() => validateSnapshot({ ...snapshot, version: 2 }), /Unsupported/);
assert.throws(() => validateSnapshot({ ...snapshot, leader: '{}' }), /leader progression/);
assert.throws(() => validateSnapshot({ ...snapshot, profile: snapshot.profile.replace('"gold":73', '"gold":-1') }), /Invalid profile/);
assert.throws(() => validateSnapshot({ ...snapshot, profile: snapshot.profile.replace('"gold":73', '"__proto__":{},"gold":73') }), /Unsafe/);
const badBattle = JSON.parse(snapshot.profile);
badBattle.activeBattle = { version: 500 };
assert.throws(() => validateSnapshot({ ...snapshot, profile: JSON.stringify(badBattle) }), /active battle/);

// Tagged Maps and cooldown sentinels must survive encrypted battle transfer unchanged.
const battleProfile = JSON.parse(snapshot.profile);
battleProfile.activeBattle = {
  version: 1, delveId: 'slime-cave', time: 400, savedAtMs: snapshot.createdAt,
  partyIds: ['caramon'], party: [{ id: 'caramon', hp: 10, maxHp: 10, arenaX: 20, arenaY: 30, status: {} }],
  enemies: [], traps: [], events: [], scene: { currentWaveIndex: 0,
    enemyThreat: { battleType: 'map', entries: [] } }, partyTemplates: [{ id: 'caramon' }],
  movement: { slots: [], rangeStates: [] }, preferences: { battleType: 'map', entries: [] },
  log: { entries: [], summary: {} }, run: { entry: 'progress' },
  lastCooldown: { battleType: 'number', value: '-Infinity' }
};
const battleSnapshot = { ...snapshot, profile: JSON.stringify(battleProfile) };
assert.equal(validateSnapshot(battleSnapshot).activeBattle, true);
assert.deepEqual(await decryptSnapshot(await encryptSnapshot(battleSnapshot, passphrase), passphrase), battleSnapshot);
const malformedEverdeep = { ...JSON.parse(snapshot.profile), everdeep: { schemaVersion: 2, runs: [{}] } };
assert.throws(() => validateSnapshot({ ...snapshot, profile: JSON.stringify(malformedEverdeep) }), /Everdeep expedition/);

function memoryStorage() {
  const records = new Map([[PROFILE_STORAGE_KEY, 'previous profile'], [LEADER_STORAGE_KEY, 'previous leader'], ['another.app', 'preserve']]);
  return { records, getItem: key => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value), removeItem: key => records.delete(key) };
}
const storage = memoryStorage();
replaceSnapshot(snapshot, encrypted, storage);
assert.equal(storage.getItem(PROFILE_STORAGE_KEY), snapshot.profile);
assert.equal(storage.getItem(LEADER_STORAGE_KEY), snapshot.leader);
assert.equal(storage.getItem(RECOVERY_KEY), encrypted);
assert.equal(storage.getItem(JOURNAL_KEY), null);
assert.equal(storage.getItem('another.app'), 'preserve');

// A full disk while saving the recovery file must leave both live records intact.
const full = memoryStorage();
full.setItem = () => { throw new Error('quota'); };
assert.throws(() => replaceSnapshot(snapshot, encrypted, full), /quota/);
assert.equal(full.getItem(PROFILE_STORAGE_KEY), 'previous profile');
assert.equal(full.getItem(LEADER_STORAGE_KEY), 'previous leader');

// A failure halfway through replacement rolls both keys back, not just the second key.
const interrupted = memoryStorage();
const set = interrupted.setItem;
let failOnce = true;
interrupted.setItem = (key, value) => {
  if (key === LEADER_STORAGE_KEY && failOnce) { failOnce = false; throw new Error('disk'); }
  set(key, value);
};
assert.throws(() => replaceSnapshot(snapshot, encrypted, interrupted), /could not finish/);
assert.equal(interrupted.getItem(PROFILE_STORAGE_KEY), 'previous profile');
assert.equal(interrupted.getItem(LEADER_STORAGE_KEY), 'previous leader');

// Simulate termination after writing the profile but before writing the leader.
const startup = memoryStorage();
startup.setItem(JOURNAL_KEY, JSON.stringify({ version: 1, profile: 'previous profile', leader: 'previous leader' }));
startup.setItem(PROFILE_STORAGE_KEY, snapshot.profile);
assert.equal(recoverInterruptedRestore(startup), true);
assert.equal(startup.getItem(PROFILE_STORAGE_KEY), 'previous profile');
assert.equal(startup.getItem(LEADER_STORAGE_KEY), 'previous leader');
assert.equal(startup.getItem(JOURNAL_KEY), null);
assert.equal(recoverInterruptedRestore(startup), false);
console.log('Encrypted transfers reject damaged files and safely restore both legacy records.');
