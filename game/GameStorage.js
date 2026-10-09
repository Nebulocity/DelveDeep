// This connects our shared GameState to the device's localStorage. We save ordinary data,
// then rebuild current stats and reconnect battle objects when loading. Stable IDs keep a
// saved character or item attached to the right definition even if a list changes order.
// Old save fields are migrated here, so be careful about removing a fallback just because
// new saves work.

import { rebuildCharacterStats } from './CharacterStats.js';
import GameState from './GameState.js';
import { restoreEverdeep } from './EverdeepState.js';
import { restoreEquipment } from './Equipment.js';
import { grantStartingEquipment } from './StartingEquipment.js';
import { restoreAdventurerAbilities } from './AdventurerAbilities.js';
import { CRAFTING_MATERIALS, CRAFTING_RECIPES, MATERIAL_ID_ALIASES } from '../data/items.js';

import { PROFILE_STORAGE_KEY } from './BuildSave.js';
import { validBattleSnapshot } from './BattleSnapshot.js';
import { roads, pois, nodes, WORLD_LAYOUT_ID } from '../data/worldMap.js';

const STORAGE_KEY = PROFILE_STORAGE_KEY;
let battleSaveProvider = null;
let battleReplayActive = () => false;
let lastBattleSaveAt = -Infinity;

// pendingSave coalesces requests from one synchronous action. saveGeneration identifies
// the current save lifecycle, allowing a reset to invalidate an already queued callback
// before it writes old progress back.
let pendingSave = false;
let saveGeneration = 0;

// A single profile write commits resources, progression and the battle position together.
export function setBattleSaveProvider(provider, isReplaying = () => false) {
  battleSaveProvider = provider;
  battleReplayActive = isReplaying;
  lastBattleSaveAt = -Infinity;
}

// This helper restores character and shared world progress into GameState. Adventurer
// identity and base stats come from the current roster definitions, while saved levels,
// experience, and happiness carry forward.
export function loadProfile(baseRoster) {

  let saved = null;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    saved = raw ? JSON.parse(raw) : null;
  } catch (error) {
    console.warn('Could not load Delve Deep profile.', error);
  }

  // Index records by stable character ID, rather than their position in the old roster.
  // The aoth alias is a save migration for Fistandantilus; changing list order must not
  // hand one character's progress to another.
  const savedRoster = new Map((saved?.roster ?? []).map((entry) => [entry.id === 'aoth' ? 'fistandantilus' : entry.id, entry]));

  // Restore currencies, inventory, world state, and development options with defaults for
  // missing save fields.
  GameState.gold = Number.isFinite(saved?.gold) ? saved.gold : 0;

  // ?? uses the fallback only for null or undefined. A real zero or false stays intact. ?.
  // only follows this link when the value exists; a missing optional value gives
  // undefined.
  const savedMaterials = saved?.inventory?.materials ?? {};
  const materials = {};
  if (saved?.inventory?.equipmentSchemaVersion === 1) {

    // Object.entries turns own fields into [key, value] pairs so we can visit or transform
    // them.
    for (const [oldId, count] of Object.entries(savedMaterials)) {
      const id = MATERIAL_ID_ALIASES[oldId];
      if (id && CRAFTING_MATERIALS[id] && Number.isSafeInteger(count) && count > 0) {
        materials[id] = (materials[id] ?? 0) + count;
      }
    }
  } else {
    for (const [id, count] of Object.entries(savedMaterials)) {
      if (CRAFTING_MATERIALS[id] && Number.isSafeInteger(count) && count > 0) materials[id] = count;
    }
  }

  // Starter recipes join the saved discoveries. Set removes duplicates, then the catalog
  // check drops unknown IDs. A new catalog can add a starter recipe without throwing away
  // recipes the player already discovered.
  const starterRecipes = CRAFTING_RECIPES.filter(recipe => recipe.knownAtStart).map(recipe => recipe.id);

  // ... expands these entries into the new list or call. It does not deep-copy the objects
  // inside. A Set keeps each value once. has checks membership without searching a list
  // for duplicate entries.
  GameState.inventory = {
    equipment: [],
    materials,
    nextEquipmentId: 1,
    equipmentSchemaVersion: 2,
    knownRecipes: [...new Set([...(saved?.inventory?.knownRecipes ?? []), ...starterRecipes])]
      .filter(id => CRAFTING_RECIPES.some(recipe => recipe.id === id))
  };

  GameState.records = saved?.records ?? {};
  GameState.everdeep = restoreEverdeep(saved?.everdeep);

  // Object.fromEntries turns [key, value] pairs back into an object. A later pair with the
  // same key replaces the earlier value.
  GameState.delveCheckpoints = Object.fromEntries(Object.entries(saved?.delveCheckpoints ?? {})
    .filter(([id, entry]) => id && Number.isSafeInteger(entry?.nextWave) && entry.nextWave >= 0)
    .map(([id, entry]) => [id, { nextWave: entry.nextWave, campUnlocked: entry.campUnlocked === true }]));
  GameState.lastPartyIds = Array.isArray(saved?.lastPartyIds)
    ? saved.lastPartyIds.map((id) => id === 'aoth' ? 'fistandantilus' : id) : [];
  GameState.development = {
    unlockAll: saved?.development?.unlockAll === true,
    replayCleared: saved?.development?.replayCleared === true,
    showArenaBorder: (saved?.development?.showArenaBorder ?? saved?.development?.showGridLines) === true,
    musicEnabled: saved?.development?.musicEnabled === true
  };

  // some stops with true as soon as one entry passes the check; an empty list gives false.
  // Math.max chooses the largest value; pairing it with Math.min can keep a result inside
  // both a lower and an upper bound.
  GameState.world = {
    layoutId: WORLD_LAYOUT_ID,
    currentLocation: nodes[saved?.world?.currentLocation] ? saved.world.currentLocation : 'pineshire',
    discoveredLocations: Array.from(new Set(['pineshire', 'slime-cave', ...(saved?.world?.discoveredLocations ?? [])])),
    clearedDelves: Array.from(new Set(saved?.world?.clearedDelves ?? [])),
    travel: saved?.world?.layoutId === WORLD_LAYOUT_ID
      && roads.some((road) => road.id === saved?.world?.travel?.edgeId)
      && Number.isFinite(saved.world.travel.t)
      ? { edgeId: saved.world.travel.edgeId, t: Math.max(0, Math.min(1, saved.world.travel.t)),
        target: nodes[saved.world.travel.target] ? saved.world.travel.target : null,
        destinationId: pois.some((poi) => poi.id === saved.world.travel.destinationId) ? saved.world.travel.destinationId : null }
      : null
  };

  // Rebuild stats from current base values and saved levels. Reusing saved derived stats
  // here would apply level gains twice.
  GameState.roster = baseRoster.map((base) => {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    const prior = savedRoster.get(base.id) ?? {};

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    const level = Math.max(1, prior.level ?? base.level ?? 1);
    const levelBonus = Math.max(0, level - 1);

    // ... copies the source's own fields into this object; fields listed later replace
    // earlier ones. This is a shallow copy, so nested objects are still shared. The
    // condition before ? chooses the first value when true and the value after : when
    // false.
    return restoreAdventurerAbilities(rebuildCharacterStats({
      ...base,
      level,
      xp: Math.max(0, prior.xp ?? 0),
      happiness: Math.min(100, Math.max(0, prior.happiness ?? base.happiness ?? 70)),
      delvesCompleted: Math.max(0, prior.delvesCompleted ?? 0),
      maxHp: base.maxHp + levelBonus * 6,
      attackPower: base.attackPower + levelBonus * 2,
      healPower: Number.isFinite(base.healPower) ? base.healPower + levelBonus * 2 : base.healPower
    }), prior, Boolean(savedRoster.has(base.id) && !prior.abilityRanks));
  });

  restoreEquipment(saved?.inventory, savedRoster);
  grantStartingEquipment(savedRoster);

  // Discard saved party IDs that no longer exist in the current roster.
  GameState.lastPartyIds = GameState.lastPartyIds.filter((id) => GameState.roster.some((adventurer) => adventurer.id === id));
  GameState.activeBattle = validBattleSnapshot(saved?.activeBattle, GameState.roster) ? saved.activeBattle : null;
}

// This helper writes the persistent portion of GameState to local storage. It includes
// currencies, inventory, world progress, records, the previous party, roster advancement
// and a restorable active battle snapshot.
export function saveProfile() {
  if (battleSaveProvider) {

    // A long catch-up may clear many waves in one real second. Capture the complete
    // battle at most once every two seconds during replay, matching normal autosaves.
    // Lifecycle saves and the final settled save run outside replay and stay immediate.
    if (battleReplayActive() && Date.now() - lastBattleSaveAt < 2000) return;
    if (!pendingSave) {
      pendingSave = true;
      const generation = saveGeneration;

      // This queues a callback after the current synchronous code finishes and before the
      // next normal event task. It lets related changes finish before we save their
      // combined result.
      queueMicrotask(() => {
        if (generation !== saveGeneration) return;
        pendingSave = false;
        writeProfile();
      });
    }

    return;
  }

  writeProfile();
}

// Write one coherent profile record containing resources, progression and any active
// battle snapshot.
function writeProfile() {
  try {
    if (battleSaveProvider) {
      GameState.activeBattle = battleSaveProvider();
      lastBattleSaveAt = Date.now();
    }
  } catch (error) {
    console.warn('Could not capture the active Delve Deep battle.', error);
    return;
  }

  // Select the fields that persist between sessions instead of serializing the entire live
  // game state.
  const profile = {
    gold: GameState.gold,
    inventory: GameState.inventory,
    records: GameState.records,
    delveCheckpoints: GameState.delveCheckpoints,
    lastPartyIds: GameState.lastPartyIds,
    development: GameState.development,
    world: GameState.world,
    everdeep: GameState.everdeep,
    activeBattle: GameState.activeBattle,
    roster: GameState.roster.map((adventurer) => ({
      id: adventurer.id,
      equipment: adventurer.equipment ?? { weapon: null, armor: null, accessory: null, potion: null },
      startingEquipmentGranted: adventurer.startingEquipmentGranted === true,
      abilityRanks: adventurer.abilityRanks ?? {},
      abilityLoadout: adventurer.abilityLoadout ?? [],
      skillPoints: adventurer.skillPoints ?? adventurer.level,
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

// This helper removes character and shared world progress on reset.
export function clearSavedProfile() {
  saveGeneration += 1;
  pendingSave = false;
  GameState.activeBattle = null;

  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.warn('Could not clear Delve Deep profile.', error);
  }
}
