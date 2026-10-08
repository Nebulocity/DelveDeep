// Ordinary waves bank their rewards before the boss. The saved nextWave is zero-based,
// while the player sees wave numbers starting at one. Farming repeats the last pre-boss
// wave and only gives XP and Happiness to living adventurers. Gold and materials are
// shared. The checkpoint guard prevents paying an ordinary first-clear reward twice.

import { delveMaterialIds } from './DelveDrops.js';
import GameState from './GameState.js';
import { grantMaterial } from './Equipment.js';
import { grantAdventurerXp, adjustHappiness } from './AdventurerProgression.js';
import { saveProfile } from './GameStorage.js';

export const WAVE_REWARDS = {
  Easy: { gold: 12, goldStep: 3, xp: 8, materialCount: 1 },
  Difficult: { gold: 20, goldStep: 4, xp: 12, materialCount: 1 },
  Tough: { gold: 30, goldStep: 5, xp: 17, materialCount: 2 },
  'Very Tough': { gold: 42, goldStep: 6, xp: 23, materialCount: 2 },

  'Incredibly Tough': { gold: 56, goldStep: 7, xp: 30, materialCount: 3 },
  Impossible: { gold: 72, goldStep: 8, xp: 38, materialCount: 3 }
};

export const FARM_REWARDS = {
  Easy: { gold: 1, xp: 1, happiness: 1, materialCount: 1 },
  Difficult: { gold: 2, xp: 2, happiness: 2, materialCount: 2 },
  Tough: { gold: 3, xp: 3, happiness: 3, materialCount: 2 },
  'Very Tough': { gold: 4, xp: 4, happiness: 4, materialCount: 3 },

  'Incredibly Tough': { gold: 5, xp: 5, happiness: 5, materialCount: 3 },
  Impossible: { gold: 6, xp: 6, happiness: 6, materialCount: 3 }
};


// Check whether this encounter uses ordinary wave banking and camp instead of the portal
// flow.
export function isOrdinaryDelve(delve = GameState.currentDelve) {

  // ?. only follows this link when the value exists; a missing optional value gives
  // undefined.
  return delve?.type === 'delve';
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
  const nextWave = Math.min(bossIndex, Math.max(0, saved?.nextWave ?? (legacyClear ? bossIndex : 0)));
  return { nextWave, campUnlocked: saved?.campUnlocked === true || legacyClear || nextWave >= bossIndex };
}

// Validate this payout, grant shared resources and roster XP, then bank the next
// checkpoint.
export function awardOrdinaryWave(delve, waveIndex, bossIndex, farming = false, partyUnits = [], random = Math.random) {

  // Only valid pre-boss waves can pay here. Farm also requires unlocked camp and the final
  // pre-boss wave. Returning null is a rejected reward attempt, so no Gold, XP or
  // materials have been changed.
  if (!isOrdinaryDelve(delve) || !Number.isSafeInteger(waveIndex)
    || waveIndex < 0 || waveIndex >= bossIndex
    || (farming && (waveIndex !== bossIndex - 1 || !getDelveCheckpoint(delve, bossIndex).campUnlocked))) return null;
  const checkpoint = getDelveCheckpoint(delve, bossIndex);

  // First-clear rewards must match the saved next uncleared wave. That check prevents
  // duplicate calls or revisited earlier waves from paying again.
  if (!farming && waveIndex !== checkpoint.nextWave) return null;

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  const table = farming ? FARM_REWARDS : WAVE_REWARDS;

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
  const values = table[delve.difficulty] ?? table.Easy;

  // Ordinary wave Gold grows by goldStep for each zero-based wave index. Farm uses its
  // fixed difficulty amount every time, so it does not keep growing simply because the
  // player has stayed in camp longer.
  const gold = farming ? values.gold : values.gold + values.goldStep * waveIndex;
  const xp = values.xp;
  const pool = delveMaterialIds(delve);
  const materials = {};

  for (let index = 0; index < values.materialCount && pool.length; index += 1) {

    // Farm rolls each material independently: random() * pool.length spans the list, and
    // floor turns it into an index. Ordinary rewards use a stable index from Delve ID
    // length plus wave index, wrapped with % pool.length.
    const id = pool[farming ? Math.floor(random() * pool.length) : (delve.id.length + waveIndex) % pool.length];
    materials[id] = (materials[id] ?? 0) + 1;
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
    grantAdventurerXp(hero, xp);
    xpByHero[hero.id] = xp;
    if (farming) {
      adjustHappiness(hero, values.happiness);

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const unit = partyUnits.find(member => member.id === hero.id);
      if (unit) unit.happiness = hero.happiness;
    }
  });

  // Move the saved checkpoint only for a first clear. Repeated farm payouts leave it at
  // camp. The next wave is waveIndex + 1; reaching bossIndex means all ordinary waves are
  // done and the camp can reopen on a later visit.
  if (!farming) GameState.delveCheckpoints[delve.id] = {
    nextWave: waveIndex + 1,
    campUnlocked: waveIndex + 1 >= bossIndex
  };

  // Bank the shared resources and updated checkpoint before returning the reward
  // description. The battle save provider combines this with the completed action's phase
  // so a reload cannot repeat the same payout.
  saveProfile();

  const materialId = Object.keys(materials)[0];
  return { gold, xp, xpByHero, happiness: values.happiness ?? 0, materials,
    materialId, materialCount: materials[materialId] ?? 0, farming };
}
