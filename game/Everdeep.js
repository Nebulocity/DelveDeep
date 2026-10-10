// Everdeep expeditions are separate from visible Delve combat. Each expedition freezes its
// selected party and settles scheduled waves against wall-clock time. Seeded reward
// choices make repeat settlement consistent. Claim and recall guards prevent the same
// progress from paying twice. Multiple expeditions have independent IDs and clocks.

import { armorReduction } from '../config/characterProgression.js';
import GameState from './GameState.js';
import { restoreEverdeep } from './EverdeepState.js';
import { CRAFTING_MATERIALS, EQUIPMENT_ITEMS } from '../data/items.js';
import { grantEquipment, grantMaterial } from './Equipment.js';
import { getEquippedAdventurer } from './Equipment.js';
import { saveProfile } from './GameStorage.js';

export const EVERDEEP_REGION_ID = 'pineshire-reach';
export const EVERDEEP_WRIT_COST = 120;
export const EVERDEEP_INTERVAL_MS = 120000;
export const EVERDEEP_DURATION_MS = 7200000;
export const EVERDEEP_MAX_WAVES = 60;
export const EVERDEEP_MAX_CHESTS = 6;

export const everdeepRegion = {
  id: EVERDEEP_REGION_ID,
  name: 'Pineshire Reach',
  ordinaryDelves: ['slime-cave', 'thornbriar-hollow', 'dolmark-den', 'march-west-delves', 'verge-delves'],
  encounterLevels: [1, 3],
  rewardLevelCap: 3,
  rewardRarities: ['common', 'uncommon'],
  materials: Object.keys(CRAFTING_MATERIALS),
  rewardTableVersion: 1
};

export const EVERDEEP_REGIONS = { [EVERDEEP_REGION_ID]: everdeepRegion };

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const hashSeed = (text) => {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  // These bit operators work with 32-bit integers. >>> shifts in zero bits, while ^ mixes
  // bits with XOR. They are different from ordinary multiplication or exponentiation.
  return hash >>> 0;
};

// We derive a repeatable random-looking fraction from the seed and these inputs. The XOR
// and shifts mix 32-bit integer bits; >>> 0 treats the final bits as an unsigned number.
// Dividing by 4294967296, which is 2 to the power of 32, puts the result between zero
// inclusive and one exclusive. Same inputs give the same roll.
function randomFor(seed, ...parts) {

  // ... expands these entries into the new list or call. It does not deep-copy the objects
  // inside.
  let value = hashSeed([seed, ...parts].join(':'));

  // These bit operators work with 32-bit integers. >>> shifts in zero bits, while ^ mixes
  // bits with XOR. They are different from ordinary multiplication or exponentiation.
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;

  return (value >>> 0) / 4294967296;
}

// Check this region's required ordinary Delve clears before opening expeditions. state is
// the game data to read or change; a default can point at shared GameState.
export function everdeepUnlocked(state = GameState) {
  const region = EVERDEEP_REGIONS[EVERDEEP_REGION_ID];
  const finalDelve = region.ordinaryDelves.at(-1);

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact. ?.
  // only follows this link when the value exists; a missing optional value gives
  // undefined.
  return state.development.unlockAll || state.world.clearedDelves.includes(finalDelve)
    || (state.records[finalDelve]?.clears ?? 0) > 0;
}

// Estimate the frozen party's strength for Everdeep settlement using its current combat
// stats. hero is the roster record, rather than the artwork that displays that character.
// state is the game data to read or change; a default can point at shared GameState.
function partyPower(hero, state) {
  const effective = getEquippedAdventurer(hero, state);

  // The condition before ? chooses the first value when true and the value after : when
  // false. ?? uses the fallback only for null or undefined. A real zero or false stays
  // intact. Math.max chooses the largest value; pairing it with Math.min can keep a result
  // inside both a lower and an upper bound.
  return effective.maxHp * (1 + (effective.statProgressionVersion === 2 ? armorReduction(effective.armor) : effective.armor ?? 0)) * 0.22
    + Math.max(effective.attackPower, effective.spellDamage ?? 0) * 2.2 + (effective.spellHealing ?? effective.healPower ?? 0) * 1.3
    + (effective.maxMana ?? 0) * 0.08 + (effective.level ?? 1) * 8;
}

// Validate access, party and Gold, then create an independent expedition with a frozen
// lineup. state is the game data to read or change; a default can point at shared
// GameState.
export function startEverdeepRun(characterIds, now = Date.now(), state = GameState) {
  if (!everdeepUnlocked(state)) return { ok: false, message: 'Defeat the boss of The Sunken Watch first.' };
  const runs = everdeepRuns(state);
  if (state.gold < EVERDEEP_WRIT_COST) return { ok: false, message: `A Writ costs ${EVERDEEP_WRIT_COST} Gold.` };

  // A Set keeps each value once. has checks membership without searching a list for
  // duplicate entries.
  if (!Array.isArray(characterIds) || characterIds.length !== 5 || new Set(characterIds).size !== 5) {
    return { ok: false, message: 'Choose five different adventurers.' };
  }

  // map builds one output entry for each input entry, in the same order. The callback's
  // return value becomes that output entry.
  const party = characterIds.map((id) => state.roster.find((hero) => hero.id === id));

  // some stops with true as soon as one entry passes the check; an empty list gives false.
  if (party.some((hero) => !hero)) return { ok: false, message: 'One or more selected adventurers are unavailable.' };

  // filter keeps entries whose callback returns true. It builds a new list and leaves the
  // original list in place.
  const tanks = party.filter((hero) => hero.role === 'Tank').length;
  const healers = party.filter((hero) => hero.role === 'Healer').length;
  const dps = party.length - tanks - healers;

  if (tanks > 1 || healers > 2 || dps > 4) return { ok: false, message: 'The party exceeds the usual role limits.' };

  // function toString() { [native code] }
  const seed = `${now}-${hashSeed(characterIds.join('|')).toString(36)}-${Math.random().toString(36).slice(2)}`;
  state.gold -= EVERDEEP_WRIT_COST;
  state.everdeep.totals.runsStarted += 1;
  const run = {
    id: seed,
    regionId: EVERDEEP_REGION_ID,
    party: party.map((hero) => ({ id: hero.id, level: hero.level, power: Math.round(partyPower(hero, state) * 100) / 100 })),
    startedAtMs: now,
    endsAtMs: now + EVERDEEP_DURATION_MS,
    stoppedAtMs: null,
    stopReason: null,
    failedWave: null,
    waveIntervalMs: EVERDEEP_INTERVAL_MS,
    durationMs: EVERDEEP_DURATION_MS,
    seed,
    rulesVersion: 1,
    rewardTableVersion: everdeepRegion.rewardTableVersion,
    resolvedWave: 0,
    earnedChestCount: 0,
    claimedChestCount: 0
  };

  runs.push(run);
  saveProfile();
  return { ok: true, run };
}

// Calculate this expedition's success chance at the requested wave.
function waveChance(run, wave) {

  // reduce carries an accumulated result from one entry to the next. The callback returns
  // the accumulator for the next step; the final argument supplies its starting value.
  const partyPowerTotal = run.party.reduce((sum, hero) => sum + hero.power, 0);

  // sort rearranges this array in place. A negative comparator result puts a before b;
  // positive puts it after; zero keeps them tied. map builds one output entry for each
  // input entry, in the same order. The callback's return value becomes that output entry.
  // ... expands these entries into the new list or call. It does not deep-copy the objects
  // inside.
  const medianLevel = [...run.party].map((hero) => hero.level).sort((a, b) => a - b)[2];

  // Math.floor rounds toward the smaller whole number, so 3.8 becomes 3.
  const encounterLevel = clamp(everdeepRegion.encounterLevels[0] + Math.floor((wave - 1) / 20),
    everdeepRegion.encounterLevels[0], everdeepRegion.encounterLevels[1]);
  const requiredPower = 180 + (encounterLevel - 1) * 38 + Math.floor((wave - 1) / 10) * 8;
  const levelFactor = clamp(medianLevel / encounterLevel, 0.75, 1.35);

  return clamp(0.72 + (partyPowerTotal * levelFactor - requiredPower) / 240, 0.45, 0.98);
}

// Return the normalized saved expedition list. state is the game data to read or change; a
// default can point at shared GameState.
export function everdeepRuns(state = GameState) {

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  if (state.everdeep?.schemaVersion !== 2) state.everdeep = restoreEverdeep(state.everdeep);
  return state.everdeep.runs;
}

// Advance every expedition to the supplied real time and save resulting progress. state is
// the game data to read or change; a default can point at shared GameState.
export function settleEverdeep(now = Date.now(), state = GameState) {
  const runs = everdeepRuns(state);
  let changed = false;
  for (const run of runs) {
    const wave = run.resolvedWave;
    const stopped = run.stoppedAtMs;
    settleRun(run, now);

    // ||= assigns only when the current value is falsy, such as false, zero or undefined.
    changed ||= wave !== run.resolvedWave || stopped !== run.stoppedAtMs;
  }

  if (changed) saveProfile();
  return runs;
}

// Calculate time until the next wave and expedition expiry from real timestamps.
export function everdeepTimers(run, now = Date.now()) {
  const stopped = Boolean(run.stoppedAtMs);

  // The condition before ? chooses the first value when true and the value after : when
  // false. Math.max chooses the largest value; pairing it with Math.min can keep a result
  // inside both a lower and an upper bound.
  return {
    nextWaveMs: stopped ? 0 : Math.max(0, run.startedAtMs + (run.resolvedWave + 1) * run.waveIntervalMs - now),
    remainingMs: stopped ? 0 : Math.max(0, run.endsAtMs - now)
  };
}

// Find the independent expedition by its stable run ID. state is the game data to read or
// change; a default can point at shared GameState.
function findRun(state, runId) {
  const runs = everdeepRuns(state);

  // The condition before ? chooses the first value when true and the value after : when
  // false. find returns the first matching entry, or undefined when none matches. Check
  // for that missing result before using its fields.
  return runId ? runs.find(run => run.id === runId) : runs[0];
}

// Process this expedition's due waves once, using its seed for repeatable results.
function settleRun(run, now) {
  if (!run || run.stoppedAtMs) return run;

  // Math.floor rounds toward the smaller whole number, so 3.8 becomes 3. Math.min chooses
  // the smallest value; pairing it with Math.max can keep a result inside both a lower and
  // an upper bound.
  const targetWave = clamp(Math.floor((Math.min(now, run.endsAtMs) - run.startedAtMs) / run.waveIntervalMs), 0, EVERDEEP_MAX_WAVES);
  while (run.resolvedWave < targetWave) {
    const wave = run.resolvedWave + 1;
    if (randomFor(run.seed, 'wave', wave, run.rulesVersion) > waveChance(run, wave)) {
      run.failedWave = wave;
      run.resolvedWave = wave;
      run.stoppedAtMs = run.startedAtMs + wave * run.waveIntervalMs;
      run.stopReason = 'defeated';
      break;
    }

    run.resolvedWave = wave;

    // % gives the remainder. With a nonnegative index and positive list length, it wraps
    // the index back to the start of the list.
    if (wave % 10 === 0) run.earnedChestCount = Math.min(EVERDEEP_MAX_CHESTS, run.earnedChestCount + 1);
  }

  if (!run.stoppedAtMs && targetWave >= EVERDEEP_MAX_WAVES) {
    run.stoppedAtMs = run.endsAtMs;
    run.stopReason = 'expired';
  }

  return run;
}

// Settle current progress and stop this chosen expedition without changing other runs.
// state is the game data to read or change; a default can point at shared GameState.
export function recallEverdeep(now = Date.now(), state = GameState, runId) {
  settleEverdeep(now, state);
  const run = findRun(state, runId);
  if (!run || run.stoppedAtMs) return { ok: false, message: 'This expedition has already stopped.' };
  run.stoppedAtMs = now;
  run.stopReason = 'recalled';
  saveProfile();

  return { ok: true, run };
}

// Build the reward preview for the requested expedition milestone. state is the game data
// to read or change; a default can point at shared GameState.
export function everdeepChestPreview(index, state = GameState, runId) {
  const run = findRun(state, runId);
  if (!run || !Number.isSafeInteger(index) || index < 0 || index >= run.earnedChestCount) return null;
  const seed = `${run.seed}:${index + 1}:${run.rewardTableVersion}`;
  const materialIds = everdeepRegion.materials;

  // Math.floor rounds toward the smaller whole number, so 3.8 becomes 3.
  const materialId = materialIds[Math.floor(randomFor(seed, 'material') * materialIds.length)];

  // filter keeps entries whose callback returns true. It builds a new list and leaves the
  // original list in place.
  const gearPool = EQUIPMENT_ITEMS.filter((item) => item.slot === 'weapon' || item.slot === 'armor');
  const gear = gearPool[Math.floor(randomFor(seed, 'gear') * gearPool.length)];

  // sort rearranges this array in place. A negative comparator result puts a before b;
  // positive puts it after; zero keeps them tied. map builds one output entry for each
  // input entry, in the same order. The callback's return value becomes that output entry.
  // ... expands these entries into the new list or call. It does not deep-copy the objects
  // inside.
  const medianLevel = [...run.party].map((hero) => hero.level).sort((a, b) => a - b)[2];

  // Math.min chooses the smallest value; pairing it with Math.max can keep a result inside
  // both a lower and an upper bound.
  return { gold: 35 + Math.floor(randomFor(seed, 'gold') * 26), materialId, materialCount: 2,
    equipmentId: gear.id, itemLevel: Math.min(medianLevel, everdeepRegion.rewardLevelCap), rarity: gear.rarity };
}

// Validate the unclaimed milestone, grant its rewards and record the claim to prevent a
// second payout. state is the game data to read or change; a default can point at shared
// GameState.
export function claimEverdeepChest(state = GameState, runId) {
  const run = findRun(state, runId);
  if (!run || run.claimedChestCount >= run.earnedChestCount) return { ok: false, message: 'No unclaimed chest is ready.' };
  const index = run.claimedChestCount;
  const reward = everdeepChestPreview(index, state, run.id);
  state.gold += reward.gold;
  grantMaterial(reward.materialId, reward.materialCount, state);
  grantEquipment(reward.equipmentId, state);

  run.claimedChestCount += 1;
  state.everdeep.totals.chestsClaimed += 1;
  saveProfile();

  return { ok: true, reward };
}

// Close the chosen completed expedition according to its remaining reward state. state is
// the game data to read or change; a default can point at shared GameState.
export function finishEverdeepRun(state = GameState, runId) {
  const run = findRun(state, runId);
  if (!run || !run.stoppedAtMs || run.claimedChestCount < run.earnedChestCount) {
    return { ok: false, message: 'Claim every earned chest before dismissing this expedition.' };
  }

  // filter keeps entries whose callback returns true. It builds a new list and leaves the
  // original list in place.
  state.everdeep.runs = everdeepRuns(state).filter(entry => entry.id !== run.id);
  saveProfile();
  return { ok: true };
}
