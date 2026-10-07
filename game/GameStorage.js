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
let pendingSave = false;
let saveGeneration = 0;

// A single profile write commits resources, progression and the battle position together.
export function setBattleSaveProvider(provider) {
  battleSaveProvider = provider;
}

// This function restores character and shared world progress into GameState.
// Adventurer identity and base stats come from the
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
  const savedRoster = new Map((saved?.roster ?? []).map((entry) => [entry.id === 'aoth' ? 'fistandantilus' : entry.id, entry]));

  // Restore currencies, inventory, world state, and development options with
  // defaults for missing save fields.
  GameState.gold = Number.isFinite(saved?.gold) ? saved.gold : 0;
  const savedMaterials = saved?.inventory?.materials ?? {};
  const materials = {};
  if (saved?.inventory?.equipmentSchemaVersion === 1) {
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
  const starterRecipes = CRAFTING_RECIPES.filter(recipe => recipe.knownAtStart).map(recipe => recipe.id);
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
  GameState.delveCheckpoints = Object.fromEntries(Object.entries(saved?.delveCheckpoints ?? {})
    .filter(([id, entry]) => id && Number.isSafeInteger(entry?.nextWave) && entry.nextWave >= 0)
    .map(([id, entry]) => [id, { nextWave: entry.nextWave, campUnlocked: entry.campUnlocked === true }]));
  GameState.lastPartyIds = Array.isArray(saved?.lastPartyIds)
    ? saved.lastPartyIds.map((id) => id === 'aoth' ? 'fistandantilus' : id) : [];
  GameState.development = {
    unlockAll: saved?.development?.unlockAll === true,
    replayCleared: saved?.development?.replayCleared === true,
    showArenaBorder: (saved?.development?.showArenaBorder ?? saved?.development?.showGridLines) === true
  };
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

  // Rebuild stats from current base values and saved levels. Reusing saved
  // derived stats here would apply level gains twice.
  GameState.roster = baseRoster.map((base) => {

    const prior = savedRoster.get(base.id) ?? {};
    const level = Math.max(1, prior.level ?? base.level ?? 1);
    const levelBonus = Math.max(0, level - 1);
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

// This function writes the persistent portion of GameState to local storage.
// It includes currencies, inventory, world progress, records, the previous
// party, roster advancement and a restorable active battle snapshot.
export function saveProfile() {
  if (battleSaveProvider) {
    if (!pendingSave) {
      pendingSave = true;
      const generation = saveGeneration;
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

function writeProfile() {
  try {
    if (battleSaveProvider) GameState.activeBattle = battleSaveProvider();
  } catch (error) {
    console.warn('Could not capture the active Delve Deep battle.', error);
    return;
  }

  // Select the fields that persist between sessions instead of serializing
  // the entire live game state.
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

// This function removes character and shared world progress on reset.
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
