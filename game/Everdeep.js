import GameState from './GameState.js';
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
  return hash >>> 0;
};

function randomFor(seed, ...parts) {
  let value = hashSeed([seed, ...parts].join(':'));
  value ^= value << 13;
  value ^= value >>> 17;
  value ^= value << 5;
  return (value >>> 0) / 4294967296;
}

export function everdeepUnlocked(state = GameState) {
  const region = EVERDEEP_REGIONS[EVERDEEP_REGION_ID];
  const finalDelve = region.ordinaryDelves.at(-1);
  return state.development.unlockAll || state.world.clearedDelves.includes(finalDelve)
    || (state.records[finalDelve]?.clears ?? 0) > 0;
}

function partyPower(hero) {
  const effective = getEquippedAdventurer(hero);
  return effective.maxHp * (1 + (effective.armor ?? 0)) * 0.22
    + effective.attackPower * 2.2 + (effective.healPower ?? 0) * 1.3
    + (effective.maxMana ?? 0) * 0.08 + (effective.level ?? 1) * 8;
}

export function startEverdeepRun(characterIds, now = Date.now(), state = GameState) {
  if (!everdeepUnlocked(state)) return { ok: false, message: 'Defeat the boss of The Sunken Watch first.' };
  if (state.everdeep.activeRun) return { ok: false, message: 'Claim or dismiss your previous Everdeep expedition first.' };
  if (state.gold < EVERDEEP_WRIT_COST) return { ok: false, message: `A Writ costs ${EVERDEEP_WRIT_COST} Gold.` };
  if (!Array.isArray(characterIds) || characterIds.length !== 5 || new Set(characterIds).size !== 5) {
    return { ok: false, message: 'Choose five different adventurers.' };
  }
  const party = characterIds.map((id) => state.roster.find((hero) => hero.id === id));
  if (party.some((hero) => !hero)) return { ok: false, message: 'One or more selected adventurers are unavailable.' };
  const tanks = party.filter((hero) => hero.role === 'Tank').length;
  const healers = party.filter((hero) => hero.role === 'Healer').length;
  const dps = party.length - tanks - healers;
  if (tanks > 1 || healers > 2 || dps > 4) return { ok: false, message: 'The party exceeds the usual role limits.' };
  const seed = `${now}-${hashSeed(characterIds.join('|')).toString(36)}-${Math.random().toString(36).slice(2)}`;
  state.gold -= EVERDEEP_WRIT_COST;
  state.everdeep.totals.runsStarted += 1;
  state.everdeep.activeRun = {
    id: seed,
    regionId: EVERDEEP_REGION_ID,
    party: party.map((hero) => ({ id: hero.id, level: hero.level, power: Math.round(partyPower(hero) * 100) / 100 })),
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
  saveProfile();
  return { ok: true, run: state.everdeep.activeRun };
}

function waveChance(run, wave) {
  const partyPowerTotal = run.party.reduce((sum, hero) => sum + hero.power, 0);
  const medianLevel = [...run.party].map((hero) => hero.level).sort((a, b) => a - b)[2];
  const encounterLevel = clamp(everdeepRegion.encounterLevels[0] + Math.floor((wave - 1) / 20),
    everdeepRegion.encounterLevels[0], everdeepRegion.encounterLevels[1]);
  const requiredPower = 180 + (encounterLevel - 1) * 38 + Math.floor((wave - 1) / 10) * 8;
  const levelFactor = clamp(medianLevel / encounterLevel, 0.75, 1.35);
  return clamp(0.72 + (partyPowerTotal * levelFactor - requiredPower) / 240, 0.45, 0.98);
}

export function settleEverdeep(now = Date.now(), state = GameState) {
  const run = state.everdeep.activeRun;
  if (!run || run.stoppedAtMs) return run;
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
    if (wave % 10 === 0) run.earnedChestCount = Math.min(EVERDEEP_MAX_CHESTS, run.earnedChestCount + 1);
  }
  if (!run.stoppedAtMs && targetWave >= EVERDEEP_MAX_WAVES) {
    run.stoppedAtMs = run.endsAtMs;
    run.stopReason = 'expired';
  }
  saveProfile();
  return run;
}

export function recallEverdeep(now = Date.now(), state = GameState) {
  const run = settleEverdeep(now, state);
  if (!run || run.stoppedAtMs) return { ok: false, message: 'This expedition has already stopped.' };
  run.stoppedAtMs = now;
  run.stopReason = 'recalled';
  saveProfile();
  return { ok: true, run };
}

export function everdeepChestPreview(index, state = GameState) {
  const run = state.everdeep.activeRun;
  if (!run || !Number.isSafeInteger(index) || index < 0 || index >= run.earnedChestCount) return null;
  const seed = `${run.seed}:${index + 1}:${run.rewardTableVersion}`;
  const materialIds = everdeepRegion.materials;
  const materialId = materialIds[Math.floor(randomFor(seed, 'material') * materialIds.length)];
  const gearPool = EQUIPMENT_ITEMS.filter((item) => item.slot === 'weapon' || item.slot === 'armor');
  const gear = gearPool[Math.floor(randomFor(seed, 'gear') * gearPool.length)];
  const medianLevel = [...run.party].map((hero) => hero.level).sort((a, b) => a - b)[2];
  return { gold: 35 + Math.floor(randomFor(seed, 'gold') * 26), materialId, materialCount: 2,
    equipmentId: gear.id, itemLevel: Math.min(medianLevel, everdeepRegion.rewardLevelCap), rarity: gear.rarity };
}

export function claimEverdeepChest(state = GameState) {
  const run = state.everdeep.activeRun;
  if (!run || run.claimedChestCount >= run.earnedChestCount) return { ok: false, message: 'No unclaimed chest is ready.' };
  const index = run.claimedChestCount;
  const reward = everdeepChestPreview(index, state);
  state.gold += reward.gold;
  grantMaterial(reward.materialId, reward.materialCount, state);
  grantEquipment(reward.equipmentId, state);
  run.claimedChestCount += 1;
  state.everdeep.totals.chestsClaimed += 1;
  saveProfile();
  return { ok: true, reward };
}

export function finishEverdeepRun(state = GameState) {
  const run = state.everdeep.activeRun;
  if (!run || !run.stoppedAtMs || run.claimedChestCount < run.earnedChestCount) {
    return { ok: false, message: 'Claim every earned chest before dismissing this expedition.' };
  }
  state.everdeep.activeRun = null;
  saveProfile();
  return { ok: true };
}
