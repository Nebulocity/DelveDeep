// Ordinary waves bank their rewards before the boss. The saved nextWave is zero-based,
// while the player sees wave numbers starting at one. Farming repeats the latest camp
// wave and only gives XP and Happiness to living uncapped adventurers. Gold and materials are
// shared. The checkpoint guard prevents paying an ordinary first-clear reward twice.

import { delveMaterialIds } from './DelveDrops.js';
import { FARM_MATERIAL_CHANCES } from '../config/farmMaterialDrops.js';
import GameState from './GameState.js';
import { grantMaterial } from './Equipment.js';
import { grantAdventurerXp, adjustHappiness } from './AdventurerProgression.js';
import { saveProfile } from './GameStorage.js';

export const WAVE_REWARDS = {
  Easy: { gold: 1, goldStep: 0, xp: 1, materialCount: 1 },
  Difficult: { gold: 2, goldStep: 0, xp: 2, materialCount: 1 },
  Tough: { gold: 3, goldStep: 0, xp: 3, materialCount: 2 },
  'Very Tough': { gold: 4, goldStep: 0, xp: 4, materialCount: 2 },

  'Incredibly Tough': { gold: 5, goldStep: 0, xp: 5, materialCount: 3 },
  Impossible: { gold: 6, goldStep: 0, xp: 6, materialCount: 3 }
};

export const FARM_REWARDS = {
  Easy: { gold: 1, xp: 1, happiness: 1 },
  Difficult: { gold: 2, xp: 1, happiness: 2 },
  Tough: { gold: 3, xp: 1, happiness: 3 },
  'Very Tough': { gold: 4, xp: 1, happiness: 4 },

  'Incredibly Tough': { gold: 5, xp: 1, happiness: 5 },
  Impossible: { gold: 6, xp: 1, happiness: 6 }
};


// Check whether this encounter uses ordinary wave banking and camp instead of the portal
// flow.
export function isOrdinaryDelve(delve = GameState.currentDelve) {

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  return delve?.type === 'delve' || Boolean(delve?.campWaves?.length);
}

// Camp numbers are the cleared waves shown to players, starting at one. Older Delves
// omit this list and keep their final pre-boss camp. The boss index equals that number.
export function delveCampWaves(delve, bossIndex = (delve?.rooms ?? 1) - 1) {
  return delve?.campWaves ?? [bossIndex];
}

// Repeat the latest camp wave the party has reached. nextWave is zero-based, so it is
// also the number of waves already cleared. Keep this derivable from older checkpoints.
export function delveFarmWaveIndex(delve, bossIndex = (delve?.rooms ?? 1) - 1) {
  const checkpoint = getDelveCheckpoint(delve, bossIndex);
  const reached = delveCampWaves(delve, bossIndex).filter(wave => wave <= (checkpoint?.nextWave ?? 0));
  return (reached.at(-1) ?? bossIndex) - 1;
}

// Gold is shared, so capped members remove their share of the payout. Round upward to
// keep Gold whole and avoid zero payouts for a small uncapped party on Easy. The roster
// is authoritative because live units keep their departure stats while earning levels.
export function delveRewardEligibility(delve = GameState.currentDelve) {
  const cap = delve?.bossPreparation?.level ?? Infinity;
  const ids = new Set(GameState.activeParty.map(hero => hero.id));
  const party = GameState.roster.filter(hero => ids.has(hero.id));
  const eligible = party.filter(hero => hero.level < cap);
  return { cap, partyCount: party.length, eligibleIds: new Set(eligible.map(hero => hero.id)),
    cappedCount: party.length - eligible.length };
}

// Materials keep their own unchanged rolls even when this helper returns zero Gold.
export function cappedDelveGold(amount, eligibility = delveRewardEligibility()) {
  if (!eligibility.partyCount) return 0;
  return Math.ceil(amount * eligibility.eligibleIds.size / eligibility.partyCount);
}

// Read the next uncleared wave and camp access, including the older world-clear fallback.
export function getDelveCheckpoint(delve = GameState.currentDelve, bossIndex = (delve?.rooms ?? 1) - 1) {
  if (!isOrdinaryDelve(delve)) return null;

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  const saved = GameState.delveCheckpoints?.[delve.id];

  // Older saves can have a world clear without the newer checkpoint record. Treat that
  // existing clear as unlocked camp instead of sending the player back through already
  // completed ordinary waves.
  const legacyClear = GameState.world.clearedDelves.includes(delve.id);

  // Prefer a saved wave, otherwise use the boss checkpoint for a legacy clear or wave zero
  // for a new Delve. Clamp to 0..bossIndex so a stale save cannot point beyond this
  // encounter's boss.
  // Older single-camp saves already finished progression. If difficulty adds waves,
  // keep that earned boss access instead of making the party repeat an expanded run.
  const completedProgression = saved?.campUnlocked === true && !delve.campWaves;
  const nextWave = Math.min(bossIndex, Math.max(0, completedProgression ? bossIndex
    : saved?.nextWave ?? (legacyClear ? bossIndex : 0)));
  return { nextWave, campUnlocked: saved?.campUnlocked === true || legacyClear
    || delveCampWaves(delve, bossIndex).some(wave => nextWave >= wave) };
}

// Validate this payout, grant shared resources and roster XP, then bank the next
// checkpoint.
export function awardOrdinaryWave(delve, waveIndex, bossIndex, farming = false, partyUnits = [], random = Math.random) {

  // Only valid pre-boss waves can pay here. Farm also requires the latest unlocked camp
  // wave. Returning null is a rejected reward attempt, so no Gold, XP or
  // materials have been changed.
  if (!isOrdinaryDelve(delve) || !Number.isSafeInteger(waveIndex)
    || waveIndex < 0 || waveIndex >= bossIndex
    || (farming && (waveIndex !== delveFarmWaveIndex(delve, bossIndex)
      || !getDelveCheckpoint(delve, bossIndex).campUnlocked))) return null;
  const checkpoint = getDelveCheckpoint(delve, bossIndex);

  // First-clear rewards must match the saved next uncleared wave. That check prevents
  // duplicate calls or revisited earlier waves from paying again.
  if (!farming && waveIndex !== checkpoint.nextWave) return null;

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  const table = farming ? FARM_REWARDS : WAVE_REWARDS;

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  const values = table[delve.difficulty] ?? table.Easy;

  // Every clear pays fixed difficulty Gold. Normal XP equals that Gold amount; farm XP
  // is always one for each survivor. goldStep stays zero for older table consumers.
  const eligibility = delveRewardEligibility(delve);
  const gold = cappedDelveGold(values.gold, eligibility);
  const xp = values.xp;
  const pool = delveMaterialIds(delve);
  const materials = {};

  if (farming) {

    // Percentages are divided by 100 because random() returns a fraction from 0 to 1.
    // Each rarity rolls once, so a wave can pay no materials or several different ones.
    // Use the supplied combat random source for both visible play and idle catch-up.
    const chances = FARM_MATERIAL_CHANCES[delve.difficulty] ?? FARM_MATERIAL_CHANCES.Easy;
    for (const [rarity, percent] of Object.entries(chances)) {
      if (percent <= 0) continue;
      const eligible = delveMaterialIds(delve, [rarity]);

      // Missing catalog tiers award nothing; never substitute a lower rarity or a
      // crafted material. New catalog materials automatically join their environment.
      if (!eligible.length || random() >= percent / 100) continue;
      const id = eligible[Math.floor(random() * eligible.length)];
      materials[id] = 1;
    }
  } else {

    // First clears retain their guaranteed quantity and stable selection. The remainder
    // operator (%) wraps the Delve ID length plus wave index into this pool's bounds.
    for (let index = 0; index < values.materialCount && pool.length; index += 1) {
      const id = pool[(delve.id.length + waveIndex) % pool.length];
      materials[id] = (materials[id] ?? 0) + 1;
    }
  }

  GameState.gold += gold;

  // Object.entries turns own fields into [key, value] pairs so we can visit or transform
  // them.
  Object.entries(materials).forEach(([id, count]) => grantMaterial(id, count));

  // Farm recipients are the living battle units. Ordinary first clears use the selected
  // party. The Set lets us match those IDs against the persistent roster, where XP
  // actually lives, without depending on party list order.
  const partyIds = new Set((farming ? partyUnits.filter(unit => unit.alive) : GameState.activeParty).map(hero => hero.id));
  const xpByHero = {};
  GameState.roster.filter(hero => partyIds.has(hero.id)).forEach(hero => {
    const gained = grantAdventurerXp(hero, xp, eligibility.cap);
    xpByHero[hero.id] = gained.xpGained;
    if (farming && eligibility.eligibleIds.has(hero.id)) {
      adjustHappiness(hero, values.happiness);

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const unit = partyUnits.find(member => member.id === hero.id);
      if (unit) unit.happiness = hero.happiness;
    }
  });

  // Move the checkpoint only for a first clear. Repeated farm payouts leave it in place.
  // Camp stays unlocked while progressing onward, so leaving after an Abyss mid-run
  // fight still allows farming at the most recent camp on a later visit.
  if (!farming) GameState.delveCheckpoints[delve.id] = {
    nextWave: waveIndex + 1,
    campUnlocked: checkpoint.campUnlocked || delveCampWaves(delve, bossIndex).includes(waveIndex + 1)
  };

  // Bank the shared resources and updated checkpoint before returning the reward
  // description. The battle save provider combines this with the completed action's phase
  // so a reload cannot repeat the same payout.
  saveProfile();

  const materialId = Object.keys(materials)[0];
  const actualXp = Math.max(0, ...Object.values(xpByHero));
  return { gold, xp: actualXp, xpByHero, happiness: eligibility.eligibleIds.size ? values.happiness ?? 0 : 0, materials,
    materialId, materialCount: materials[materialId] ?? 0, farming };
}
