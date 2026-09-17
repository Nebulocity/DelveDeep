import GameState from './GameState.js';
import { restoreEquipment } from './Equipment.js';

const STORAGE_KEY = 'delveDeep.profile.v2';

// This function restores the saved profile into GameState, supplying defaults
// when no save is available. Adventurer identity and base stats come from the
// current roster definitions, while saved levels, experience, and happiness
// carry forward.
export function loadProfile(baseRoster) {

  let saved = null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    saved = raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Could not load Delve Deep profile.', error);
  }

  // Index saved adventurers by stable ID so roster order changes do not
  // attach progress to the wrong character.
  const savedRoster = new Map((saved?.roster ?? []).map((entry) => [entry.id, entry]));

  // Restore currencies, inventory, world state, and development options with
  // defaults for missing save fields.
  GameState.gold = Number.isFinite(saved?.gold) ? saved.gold : 0;
  GameState.inventory = {
    healingTonic: Math.max(0, saved?.inventory?.healingTonic ?? 0),
    voidKeys: Math.max(0, saved?.inventory?.voidKeys ?? 0)
  };
  GameState.records = saved?.records ?? {};
  GameState.lastPartyIds = Array.isArray(saved?.lastPartyIds) ? saved.lastPartyIds : [];
  GameState.development = {
    unlockAll: saved?.development?.unlockAll === true,
    replayCleared: saved?.development?.replayCleared === true
  };
  GameState.world = {
    currentLocation: saved?.world?.currentLocation ?? 'pineshire',
    discoveredLocations: Array.from(new Set(['pineshire', 'slime-cave', ...(saved?.world?.discoveredLocations ?? [])])),
    clearedDelves: Array.from(new Set(saved?.world?.clearedDelves ?? []))
  };

  // Rebuild stats from current base values and saved levels. Reusing saved
  // derived stats here would apply level gains twice.
  GameState.roster = baseRoster.map((base) => {

    const prior = savedRoster.get(base.id) ?? {};
    const level = Math.max(1, prior.level ?? base.level ?? 1);
    const levelBonus = Math.max(0, level - 1);
    return {
      ...base,
      level,
      xp: Math.max(0, prior.xp ?? 0),
      happiness: Math.min(100, Math.max(0, prior.happiness ?? base.happiness ?? 70)),
      delvesCompleted: Math.max(0, prior.delvesCompleted ?? 0),
      maxHp: base.maxHp + levelBonus * 6,
      attackPower: base.attackPower + levelBonus * 2,
      healPower: Number.isFinite(base.healPower) ? base.healPower + levelBonus * 2 : base.healPower
    };
  });

  restoreEquipment(saved?.inventory, savedRoster);

  // Discard saved party IDs that no longer exist in the current roster.
  GameState.lastPartyIds = GameState.lastPartyIds.filter((id) => GameState.roster.some((adventurer) => adventurer.id === id));
}

// This function writes the persistent portion of GameState to local storage.
// It includes currencies, inventory, world progress, records, the previous
// party, and roster advancement, while leaving temporary battle state out of
// the profile.
export function saveProfile() {

  // Select the fields that persist between sessions instead of serializing
  // the entire live game state.
  const profile = {
    gold: GameState.gold,
    inventory: GameState.inventory,
    records: GameState.records,
    lastPartyIds: GameState.lastPartyIds,
    development: GameState.development,
    world: GameState.world,
    roster: GameState.roster.map((adventurer) => ({
      id: adventurer.id,
      equipment: adventurer.equipment ?? { weapon: null, armor: null },
      level: adventurer.level,
      xp: adventurer.xp ?? 0,
      happiness: adventurer.happiness ?? 70,
      delvesCompleted: adventurer.delvesCompleted ?? 0,
      maxHp: adventurer.maxHp,
      attackPower: adventurer.attackPower,
      healPower: adventurer.healPower
    }))
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch (error) {
    console.warn('Could not save Delve Deep profile.', error);
  }
}

// This function removes the main profile when the player resets progress.
export function clearSavedProfile() {

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Could not clear Delve Deep profile.', error);
  }
}
