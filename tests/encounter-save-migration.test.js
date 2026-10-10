// Difficulty extensions and newly banked portals must not discard active fights.
import assert from 'node:assert/strict';
import { migrateEncounterSnapshot, legacyPortalCheckpoint } from '../game/EncounterSaveMigration.js';
import { getDelveById } from '../data/delves.js';
const thorn = getDelveById('thornbriar-hollow');
const snapshot = { scene: { currentWaveIndex: 5 }, run: { entry: 'boss' },
  events: [{ data: { kind: 'countdown', index: 5 }, remainingMs: 700 },
    { data: { kind: 'attack', unitId: 'old-boss-5' }, remainingMs: 200 }],
  enemies: [{ id: 'old-boss-5', hp: 17 }] };
const migrated = migrateEncounterSnapshot(snapshot, thorn, 9, { nextWave: 9, campUnlocked: true });
assert.equal(migrated.scene.currentWaveIndex, 9);
assert.equal(migrated.events[0].data.index, 9);
assert.equal(migrated.events[0].remainingMs, 700);
assert.equal(migrated.events[1], snapshot.events[1]);
assert.equal(migrated.enemies, snapshot.enemies);
assert.equal(snapshot.scene.currentWaveIndex, 5);
assert.equal(migrateEncounterSnapshot({ ...snapshot, encounterWaveCount: 10 }, thorn, 9, null).scene.currentWaveIndex, 5);
const farm = migrateEncounterSnapshot({ ...snapshot, scene: { currentWaveIndex: 4 }, run: { entry: 'farm' } }, thorn, 9,
  { nextWave: 9, campUnlocked: true });
assert.equal(farm.scene.currentWaveIndex, 8);
const abyss = getDelveById('murmuring-abyss');
assert.deepEqual(legacyPortalCheckpoint({ ...snapshot, scene: { currentWaveIndex: 20 } }, abyss, 33),
  { nextWave: 20, campUnlocked: true });
assert.deepEqual(legacyPortalCheckpoint({ ...snapshot, scene: { currentWaveIndex: 14, waveRetreating: true } }, abyss, 33),
  { nextWave: 15, campUnlocked: true });
assert.equal(legacyPortalCheckpoint({ ...snapshot, encounterWaveCount: 34 }, abyss, 33), null);
console.log('Older boss/farm entries, timer indices, unit records and Abyss progress migrate safely.');
