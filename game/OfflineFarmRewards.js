// Estimate completed farm cycles and bank their rewards without resolving combat.
// Reward totals still follow the same caps and per-wave material probabilities.
import GameState from './GameState.js';
import { FARM_REWARDS, cappedDelveGold, delveRewardEligibility, delveFarmWaveIndex, getDelveCheckpoint, isOrdinaryDelve } from './DelveCheckpoints.js';
import { grantAdventurerXp, adjustHappiness, xpRequired } from './AdventurerProgression.js';
import { FARM_MATERIAL_CHANCES } from '../config/farmMaterialDrops.js';
import { delveMaterialIds } from './DelveDrops.js';
import { grantMaterial } from './Equipment.js';

// Validate the camp before granting anything. The caller saves these mutations together
// with its consumed time and battle state after the entire synchronous batch finishes.
export function awardOfflineFarmWaves(delve, waveIndex, bossIndex, waves, partyUnits, random) {
  if (!Number.isSafeInteger(waves) || waves < 0 || !isOrdinaryDelve(delve)
    || waveIndex < 0 || waveIndex >= bossIndex
    || waveIndex !== delveFarmWaveIndex(delve, bossIndex)
    || !getDelveCheckpoint(delve, bossIndex)?.campUnlocked) return null;

  const values = FARM_REWARDS[delve.difficulty] ?? FARM_REWARDS.Easy;
  const eligibility = delveRewardEligibility(delve);
  const livingIds = new Set(partyUnits.filter(unit => unit.alive).map(unit => unit.id));
  const partyIds = new Set(GameState.activeParty.map(hero => hero.id));
  const party = GameState.roster.filter(hero => partyIds.has(hero.id));
  const result = { waves, gold: 0, xp: 0, xpByHero: {}, levelsGainedByHero: {}, materials: {} };
  if (waves === 0) return result;
  const capWaves = [];
  const previousRenown = GameState.leader?.level ?? 1;
  const previousPoints = GameState.leader?.renownPoints ?? 0;

  for (const hero of party) {
    let eligibleWaves = 0;
    if (hero.level < eligibility.cap) {
      let room = Infinity;
      if (Number.isFinite(eligibility.cap)) {
        room = -(hero.xp ?? 0);
        for (let level = hero.level; level < eligibility.cap; level++) room += xpRequired(level);
      }

      // The clear that reaches the cap still earns Gold and Happiness. A previously
      // fallen ally earns no XP, so its existing share of Gold does not change here.
      eligibleWaves = livingIds.has(hero.id)
        ? Math.min(waves, Math.max(1, Math.ceil(room / values.xp))) : waves;
      if (eligibleWaves < waves) capWaves.push(eligibleWaves);
    }

    if (!livingIds.has(hero.id)) {
      result.xpByHero[hero.id] = 0;
      continue;
    }
    const gained = grantAdventurerXp(hero, values.xp * waves, eligibility.cap);
    result.xpByHero[hero.id] = gained.xpGained;
    result.levelsGainedByHero[hero.id] = gained.levelsGained;
    result.xp = Math.max(result.xp, gained.xpGained);
    adjustHappiness(hero, values.happiness * eligibleWaves);
    const unit = partyUnits.find(member => member.id === hero.id);
    unit.happiness = hero.happiness;
  }

  // Gold changes only when an adventurer reaches the cap. Sum at most five intervals,
  // preserving upward rounding on EACH wave instead of rounding one combined payout.
  let paidWaves = 0;
  let eligibleCount = eligibility.eligibleIds.size;
  for (const end of [...capWaves.sort((a, b) => a - b), waves]) {
    result.gold += (end - paidWaves) * cappedDelveGold(values.gold, {
      partyCount: eligibility.partyCount, eligibleIds: { size: eligibleCount }
    });
    paidWaves = end;
    eligibleCount -= 1;
  }

  // A few thousand random rolls are cheap compared with millions of combat updates.
  // Keep independent rolls and uniform material selection, including materials-only
  // farming at the level cap. Resolve each rarity's eligible catalog only once.
  const pools = Object.entries(FARM_MATERIAL_CHANCES[delve.difficulty] ?? FARM_MATERIAL_CHANCES.Easy)
    .map(([rarity, percent]) => ({ chance: percent / 100, ids: delveMaterialIds(delve, [rarity]) }))
    .filter(pool => pool.chance > 0 && pool.ids.length > 0);
  for (let wave = 0; wave < waves; wave++) {
    for (const pool of pools) {
      if (random() >= pool.chance) continue;
      const id = pool.ids[Math.floor(random() * pool.ids.length)];
      result.materials[id] = (result.materials[id] ?? 0) + 1;
    }
  }
  GameState.gold += result.gold;
  for (const [id, count] of Object.entries(result.materials)) grantMaterial(id, count);
  result.renownPoints = (GameState.leader?.renownPoints ?? previousPoints) - previousPoints;
  result.renownLevels = (GameState.leader?.level ?? previousRenown) - previousRenown;
  return result;
}
