// Playtest presets use ordinary saved fields and owned equipment instances.
// Their balances are repeatable snapshots, rather than rewards that stack per tap.
import GameState from './GameState.js';
import { EQUIPMENT_ITEMS } from '../data/items.js';
import { STARTING_EQUIPMENT } from '../data/startingEquipment.js';
import { rebuildCharacterStats } from './CharacterStats.js';
import { abilityEntries, abilityLevelRequired, abilitySkillPointCost } from './AdventurerAbilities.js';
import { canEquipItem, equipItem, equipmentOwner, grantEquipment } from './Equipment.js';
import { everdeepRuns, EVERDEEP_MAX_WAVES } from './Everdeep.js';
import { saveLeaderProgression } from './LeaderProgression.js';
import { saveProfile } from './GameStorage.js';

export const BOOST_PRESETS = [
  { level: 5, gearLevel: 1, clears: 0, gold: 1000 },
  { level: 10, gearLevel: 7, clears: 1, gold: 3000 },
  { level: 15, gearLevel: 12, clears: 2, gold: 6000 },
  { level: 20, gearLevel: 12, clears: 3, gold: 10000 },
  { level: 25, gearLevel: 17, clears: 4, gold: 15000 },
  { level: 30, gearLevel: 17, clears: 5, gold: 22000 }
];
const DELVES = ['slime-cave', 'thornbriar-hollow', 'dolmark-den', 'march-west-delves', 'verge-delves'];

// Keep legal training within the new level's total SP budget. Lower presets trim
// excess ranks; free starters cost nothing and remaining points stay available.
function setTrainingLevel(hero, level) {
  let remaining = level;
  const ranks = {};
  for (const [key, ability] of abilityEntries(hero)) {
    if (hero.level < abilityLevelRequired(hero, key, 1)) continue;
    let rank = 1;
    const wanted = hero.abilityRanks?.[key] ?? rank;
    while (rank < wanted && hero.level >= abilityLevelRequired(hero, key, rank + 1)
      && remaining >= abilitySkillPointCost(rank + 1)) {
      rank += 1;
      remaining -= abilitySkillPointCost(rank);
    }
    if (rank) ranks[key] = rank;
  }
  hero.abilityRanks = ranks;
  hero.abilityLoadout = (hero.abilityLoadout ?? []).filter(key => ranks[key]);
  hero.skillPoints = remaining;
}

// Supply a compatible tier without deleting previously owned gear. Reuse an
// unenchanted, available copy first so repeated presets cannot duplicate inventory.
function setBaselineEquipment(hero, preset, state) {
  const starter = STARTING_EQUIPMENT[hero.className];
  for (const slot of ['weapon', 'armor', 'accessory']) {
    const starterItem = EQUIPMENT_ITEMS.find(item => item.id === starter?.[slot]);
    const candidates = EQUIPMENT_ITEMS.filter(item => item.slot === slot
      && ['common', 'uncommon'].includes(item.rarity)
      && (item.minimumLevel ?? 1) <= (slot === 'accessory' ? preset.level : preset.gearLevel)
      && canEquipItem(hero, item));

    // Prefer the starter weapon family, such as shortswords for Barmaid. Armor
    // uses the highest available baseline tier, with price breaking equal-tier ties.
    const family = starterItem?.name.split(' ').at(-1);
    candidates.sort((a, b) => (b.minimumLevel ?? 1) - (a.minimumLevel ?? 1)
      || Number(b.name.endsWith(family)) - Number(a.name.endsWith(family)) || b.price - a.price);
    const definition = candidates[0];
    hero.equipment ??= {};
    hero.equipment[slot] = null;
    if (!definition) continue;
    const copy = state.inventory.equipment.find(item => item.itemId === definition.id
      && !item.enchantmentId && !equipmentOwner(item.id, state)) ?? grantEquipment(definition.id, state);
    equipItem(hero.id, copy.id, state);
  }
}

// A preset sets exact roster levels and baseline wallets. Existing discoveries,
// boss records and unlocked tactics survive; new boss claims follow normal rewards.
export function applyDevelopmentBoost(level, state = GameState) {
  const preset = BOOST_PRESETS.find(entry => entry.level === level);
  if (!preset) return { ok: false, message: 'Choose a listed Boost level.' };
  for (const hero of state.roster) {
    hero.level = level;
    hero.xp = 0;
    Object.assign(hero, rebuildCharacterStats(hero));
    setTrainingLevel(hero, level);
    setBaselineEquipment(hero, preset, state);
  }
  const cleared = DELVES.slice(0, preset.clears);
  state.world.clearedDelves = [...new Set([...state.world.clearedDelves, ...cleared])];
  const discoveries = DELVES.slice(0, preset.clears + 1);
  if (preset.clears === 5) discoveries.push('everdeep', 'murmuring-abyss');
  state.world.discoveredLocations = [...new Set([...state.world.discoveredLocations, ...discoveries])];
  const leader = state.leader;
  leader.claimedCharacterMilestones = [...new Set([...(leader.claimedCharacterMilestones ?? []),
    ...Array.from({ length: level / 5 }, (_, index) => (index + 1) * 5)])];
  leader.claimedDelveBosses = [...new Set([...(leader.claimedDelveBosses ?? []), ...cleared])];

  // One starting point plus one per shared milestone, boss and portal. Spent RP
  // stays spent, so retained tactic purchases cannot also leave duplicate currency.
  const earned = 1 + leader.claimedCharacterMilestones.length + leader.claimedDelveBosses.length
    + (leader.closedVoidPortals?.length ?? 0);
  leader.level = Math.min(50, earned);
  leader.renownPoints = Math.max(0, earned - (leader.spentRenownPoints ?? 0));
  state.gold = preset.gold;
  saveLeaderProgression(leader);
  saveProfile();
  return { ok: true, message: `Boost ${level}: roster equipped, ${preset.gold} Gold, ${leader.renownPoints} RP.` };
}

// Set waves directly and rebase the wall clock so the next settlement continues
// from this position. Claimed chests remain claimed, even when testing lower waves.
export function setDevelopmentExpeditionWave(value, runId = null, now = Date.now(), state = GameState) {
  const complete = value === 'Complete';
  if (!complete && ![10, 20, 30, 40, 50, 60].includes(value)) return 0;
  const runs = everdeepRuns(state).filter(run => !runId || run.id === runId);
  for (const run of runs) {
    run.resolvedWave = complete ? EVERDEEP_MAX_WAVES : value;
    run.earnedChestCount = Math.max(run.claimedChestCount, Math.floor(run.resolvedWave / 10));
    run.startedAtMs = now - run.resolvedWave * run.waveIntervalMs;
    run.endsAtMs = run.startedAtMs + EVERDEEP_MAX_WAVES * run.waveIntervalMs;
    run.failedWave = null;
    run.stoppedAtMs = complete || value === 60 ? now : null;
    run.stopReason = run.stoppedAtMs ? 'expired' : null;
  }
  saveProfile();
  return runs.length;
}
