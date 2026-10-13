// Private backups encrypt both legacy save records together. This protects the file
// against casual editing; it does not prove gameplay was earned or protect purchases.
import { PROFILE_STORAGE_KEY, LEADER_STORAGE_KEY } from './BuildSave.js';
import { validBattleSnapshot } from './BattleSnapshot.js';
import { restoreEverdeep } from './EverdeepState.js';
import enemies from '../data/enemies.js';
import { getDelveById } from '../data/delves.js';

export const MAX_TRANSFER_BYTES = 12 * 1024 * 1024;
const MAX_PAYLOAD_BYTES = 8 * 1024 * 1024;
const ITERATIONS = 600000;
const HEADER = 'DelveDeep.private-backup.v1';
const encoder = new TextEncoder();
const decoder = new TextDecoder('utf-8', { fatal: true });
export const RECOVERY_KEY = 'delveDeep.privateRecovery.v1';
export const JOURNAL_KEY = 'delveDeep.restoreJournal.v1';

// Reject dangerous object keys and unreasonable nesting before existing loaders run.
// Battle snapshots use tagged objects for Maps/Sets; those remain ordinary JSON here.
function checkTree(value, depth = 0, budget = { remaining: 150000 }) {
  if (depth > 64 || --budget.remaining < 0) throw new Error('Backup data is too complex.');
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error('Invalid number in backup.');
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (['__proto__', 'constructor', 'prototype'].includes(key)) throw new Error('Unsafe backup data.');
      checkTree(item, depth + 1, budget);
    }
  }
}

const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const count = value => Number.isSafeInteger(value) && value >= 0;
const strings = value => Array.isArray(value) && value.every(item => typeof item === 'string');
const require = (condition, message) => { if (!condition) throw new Error(message); };

// Validate the transfer schema and loader-facing types, without rewriting legacy saves.
// Numerical checks protect loaders from broken input, not from plausible cheated totals.
export function validateSnapshot(snapshot) {
  require(object(snapshot) && snapshot.version === 1 && snapshot.app === 'com.waywardkobold.app'
    && count(snapshot.createdAt), 'Unsupported backup format.');
  require(typeof snapshot.profile === 'string' && typeof snapshot.leader === 'string', 'Backup must contain both save records.');
  require(encoder.encode(JSON.stringify(snapshot)).length <= MAX_PAYLOAD_BYTES, 'Backup is too large.');
  let profile, leader;
  try { profile = JSON.parse(snapshot.profile); leader = JSON.parse(snapshot.leader); }
  catch { throw new Error('Backup contains unreadable save records.'); }
  checkTree(profile);
  checkTree(leader);
  require(object(profile) && count(profile.gold) && Array.isArray(profile.roster)
    && profile.roster.length > 0 && profile.roster.length <= 1000, 'Invalid profile or roster.');
  const ids = new Set();
  for (const hero of profile.roster) {
    require(object(hero) && typeof hero.id === 'string' && hero.id.length > 0 && !ids.has(hero.id)
      && count(hero.level) && hero.level >= 1 && count(hero.xp ?? 0)
      && Number.isFinite(hero.happiness ?? 70) && (hero.happiness ?? 70) >= 0 && (hero.happiness ?? 70) <= 100
      && count(hero.skillPoints ?? 0) && count(hero.delvesCompleted ?? 0), 'Invalid adventurer progression.');
    ids.add(hero.id);
    require(hero.abilityLoadout === undefined || strings(hero.abilityLoadout), 'Invalid ability loadout.');
    require(hero.abilityRanks === undefined || (object(hero.abilityRanks)
      && Object.values(hero.abilityRanks).every(count)), 'Invalid ability ranks.');
    require(hero.equipment === undefined || object(hero.equipment), 'Invalid equipped items.');
  }
  require(object(profile.inventory) && Array.isArray(profile.inventory.equipment)
    && object(profile.inventory.materials) && Object.values(profile.inventory.materials).every(count)
    && strings(profile.inventory.knownRecipes ?? []) && count(profile.inventory.nextEquipmentId), 'Invalid inventory.');
  const gearIds = new Set();
  for (const gear of profile.inventory.equipment) {
    require(object(gear) && typeof gear.id === 'string' && !gearIds.has(gear.id), 'Invalid owned equipment.');
    gearIds.add(gear.id);
  }
  require(object(profile.world) && strings(profile.world.discoveredLocations)
    && strings(profile.world.clearedDelves) && typeof profile.world.currentLocation === 'string'
    && strings(profile.lastPartyIds ?? []), 'Invalid world progress.');
  require(object(profile.records ?? {}) && object(profile.delveCheckpoints ?? {})
    && object(profile.development ?? {}), 'Invalid profile records.');
  for (const entry of Object.values(profile.delveCheckpoints ?? {})) {
    require(object(entry) && count(entry.nextWave), 'Invalid Delve checkpoint.');
  }
  require(object(leader) && count(leader.level) && leader.level >= 1 && count(leader.xp ?? 0)
    && count(leader.renownPoints ?? leader.tacticsPoints ?? leader.inspirationPoints ?? 0)
    && count(leader.spentRenownPoints ?? leader.spentTacticsPoints ?? leader.spentInspiration ?? 0)
    && strings(leader.unlockedAbilities) && strings(leader.battleLoadout ?? []), 'Invalid leader progression.');
  require(!profile.activeBattle || (validBattleSnapshot(profile.activeBattle, profile.roster)
    && getDelveById(profile.activeBattle.delveId)
    && profile.activeBattle.enemies.every(unit => enemies[unit.enemyType])), 'Invalid or unsupported active battle.');
  if (profile.everdeep !== undefined) {
    require(object(profile.everdeep) && [1, 2].includes(profile.everdeep.schemaVersion), 'Unsupported Everdeep save.');
    require(profile.everdeep.schemaVersion !== 2 || Array.isArray(profile.everdeep.runs), 'Invalid Everdeep expeditions.');
    const expectedRuns = profile.everdeep.schemaVersion === 2 ? profile.everdeep.runs.length : (profile.everdeep.activeRun ? 1 : 0);
    require(restoreEverdeep(profile.everdeep).runs.length === expectedRuns, 'Invalid Everdeep expedition records.');
  }
  return { savedAt: snapshot.createdAt, gold: profile.gold, heroes: profile.roster.length,
    leaderLevel: leader.level, clearedDelves: profile.world.clearedDelves.length, activeBattle: Boolean(profile.activeBattle) };
}

// Uint8Array is raw bytes. Base64 stores those bytes in a portable text envelope.
function base64(bytes) {
  let text = '';
  for (let start = 0; start < bytes.length; start += 8192) {
    text += String.fromCharCode(...bytes.subarray(start, start + 8192));
  }
  return btoa(text);
}
function fromBase64(text) {
  require(typeof text === 'string' && /^[A-Za-z0-9+/]*={0,2}$/.test(text) && text.length % 4 === 0, 'Invalid backup encoding.');
  const bytes = Uint8Array.from(atob(text), character => character.charCodeAt(0));
  require(base64(bytes) === text, 'Invalid backup encoding.');
  return bytes;
}

// PBKDF2 slows password guesses; the random salt gives each backup a different key.
// AES-GCM encrypts and authenticates the file. A changed byte or wrong password fails.
async function deriveKey(passphrase, salt) {
  require(typeof passphrase === 'string' && passphrase.length >= 12 && passphrase.length <= 1024,
    'Use a backup passphrase of 12 to 1024 characters.');
  require(globalThis.crypto?.subtle, 'Secure backup encryption is unavailable in this browser.');
  const material = await crypto.subtle.importKey('raw', encoder.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: ITERATIONS },
    material, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export async function encryptSnapshot(snapshot, passphrase) {
  validateSnapshot(snapshot);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv,
    additionalData: encoder.encode(HEADER), tagLength: 128 }, key, encoder.encode(JSON.stringify(snapshot)));
  return JSON.stringify({ format: HEADER, salt: base64(salt), iv: base64(iv), data: base64(new Uint8Array(encrypted)) });
}

export async function decryptSnapshot(fileText, passphrase) {
  require(typeof fileText === 'string' && encoder.encode(fileText).length <= MAX_TRANSFER_BYTES, 'Backup file is too large.');
  let envelope;
  try { envelope = JSON.parse(fileText); } catch { throw new Error('This is not a private Delve Deep backup.'); }
  require(object(envelope) && envelope.format === HEADER && Object.keys(envelope).length === 4, 'Unsupported backup format.');
  const salt = fromBase64(envelope.salt), iv = fromBase64(envelope.iv), data = fromBase64(envelope.data);
  require(salt.length === 16 && iv.length === 12 && data.length >= 16, 'Invalid backup envelope.');
  const key = await deriveKey(passphrase, salt);
  let plaintext;
  try {
    plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv,
      additionalData: encoder.encode(HEADER), tagLength: 128 }, key, data);
  } catch { throw new Error('Incorrect passphrase, or the backup was changed or damaged.'); }
  require(plaintext.byteLength <= MAX_PAYLOAD_BYTES, 'Backup is too large.');
  let snapshot;
  try { snapshot = JSON.parse(decoder.decode(plaintext)); } catch { throw new Error('Invalid decrypted backup.'); }
  validateSnapshot(snapshot);
  return snapshot;
}

// Capture exact legacy record bytes so current migrations run normally after restoration.
export function readSnapshot(storage = localStorage) {
  const snapshot = { app: 'com.waywardkobold.app', version: 1, createdAt: Date.now(),
    profile: storage.getItem(PROFILE_STORAGE_KEY), leader: storage.getItem(LEADER_STORAGE_KEY) };
  validateSnapshot(snapshot);
  return snapshot;
}

function writeRecord(storage, key, value) {
  if (value === null) storage.removeItem(key);
  else storage.setItem(key, value);
}

// localStorage cannot atomically replace two keys. Record the previous bytes in one
// journal first; startup rolls back interrupted work before either save loader runs.
export function recoverInterruptedRestore(storage = localStorage) {
  const raw = storage.getItem(JOURNAL_KEY);
  if (raw === null) return false;
  const journal = JSON.parse(raw);
  require(object(journal) && journal.version === 1
    && [journal.profile, journal.leader].every(value => value === null || typeof value === 'string'), 'Invalid recovery journal.');
  writeRecord(storage, PROFILE_STORAGE_KEY, journal.profile);
  writeRecord(storage, LEADER_STORAGE_KEY, journal.leader);
  storage.removeItem(JOURNAL_KEY);
  return true;
}

export function replaceSnapshot(snapshot, encryptedRecovery, storage = localStorage) {
  validateSnapshot(snapshot);
  require(typeof encryptedRecovery === 'string' && encryptedRecovery.length > 0
    && encoder.encode(encryptedRecovery).length <= MAX_TRANSFER_BYTES, 'A recovery backup is required.');
  require(storage.getItem(JOURNAL_KEY) === null, 'Finish the interrupted restore before starting another.');
  const journal = { version: 1, profile: storage.getItem(PROFILE_STORAGE_KEY), leader: storage.getItem(LEADER_STORAGE_KEY) };

  // Store the encrypted recovery file before touching either live record. If quota is
  // exhausted, this throws and existing progress remains untouched.
  storage.setItem(RECOVERY_KEY, encryptedRecovery);
  storage.setItem(JOURNAL_KEY, JSON.stringify(journal));
  try {
    storage.setItem(PROFILE_STORAGE_KEY, snapshot.profile);
    storage.setItem(LEADER_STORAGE_KEY, snapshot.leader);
    storage.removeItem(JOURNAL_KEY);
  } catch {
    try { recoverInterruptedRestore(storage); } catch { /* Startup retries this rollback. */ }
    throw new Error('Restore could not finish. Restart the game to recover the previous progress.');
  }
}
