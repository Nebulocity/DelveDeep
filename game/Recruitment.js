import GameState from './GameState.js';
import adventurers from '../data/adventurers.js';
import { RECRUITMENT_COSTS, RECRUITMENT_LINES } from '../data/recruitment.js';
import { rebuildCharacterStats } from './CharacterStats.js';
import { restoreAdventurerAbilities } from './AdventurerAbilities.js';
import { grantStartingEquipment } from './StartingEquipment.js';
import { flushProfileSave } from './GameStorage.js';

export const isRecruited = id => GameState.recruitedIds.includes(id);

// Locked previews use current definitions without granting gear or changing progression.
export function recruitmentPreview(id) {
  const owned = GameState.roster.find(hero => hero.id === id);
  if (owned) return owned;
  const base = adventurers.find(hero => hero.id === id);
  return base ? restoreAdventurerAbilities(rebuildCharacterStats({ ...base }), {}, false) : null;
}

// This synchronous transaction rechecks ownership and funds at confirmation time. One
// profile write commits both changes; a failed write restores the in-memory purchase.
export function recruitAdventurer(id) {
  const cost = RECRUITMENT_COSTS[id];
  const hero = recruitmentPreview(id);
  if (!hero || !Number.isSafeInteger(cost)) return { ok: false, message: 'This adventurer is unavailable.' };
  if (isRecruited(id)) return { ok: false, message: `${hero.name} has already joined your roster.` };
  if (!Number.isSafeInteger(GameState.gold) || GameState.gold < cost) {
    return { ok: false, message: `You need ${Math.max(0, cost - GameState.gold)} more gold to hire ${hero.name}.` };
  }
  const previous = {
    gold: GameState.gold, recruitedIds: GameState.recruitedIds, roster: GameState.roster,
    inventory: structuredClone(GameState.inventory), tutorial: { ...GameState.tutorial }
  };
  GameState.gold -= cost;
  GameState.recruitedIds = [...GameState.recruitedIds, id];
  GameState.roster = [...GameState.roster, hero];
  grantStartingEquipment(new Map(), { ...GameState, roster: [hero] });
  if (id === 'garrick' && GameState.tutorial?.step === 'recruit') GameState.tutorial.step = 'party';
  if (!flushProfileSave()) {
    Object.assign(GameState, previous);
    return { ok: false, message: 'Your recruitment could not be saved. No gold was spent. Please try again.' };
  }
  return { ok: true, message: `${hero.name} joins your roster! “${RECRUITMENT_LINES[id]}”` };
}
