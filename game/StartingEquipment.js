// We grant the authored starter loadout through the ordinary equipment helpers. The guard
// matters: loading a save or rebuilding the roster must not keep handing out extra copies.
// Stable roster IDs connect each starter entry to the intended adventurer.

import { STARTING_EQUIPMENT } from '../data/startingEquipment.js';
import GameState from './GameState.js';
import { equipItem, grantEquipment } from './Equipment.js';

// Grant the authored starter items once, avoiding duplicates when a profile is restored.
// state is the game data to read or change; a default can point at shared GameState.
export function grantStartingEquipment(savedRoster, state = GameState) {
  for (const hero of state.roster) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    hero.startingEquipmentGranted = hero.startingEquipmentGranted === true
      || savedRoster.get(hero.id)?.startingEquipmentGranted === true;
    const loadout = STARTING_EQUIPMENT[hero.className];

    if (hero.startingEquipmentGranted || !loadout) continue;

    // Fill missing gear once without replacing owned equipment or refilling sold items.
    for (const [slot, itemId] of Object.entries(loadout)) {
      if (hero.equipment?.[slot]) continue;
      const item = grantEquipment(itemId, state);
      if (item) equipItem(hero.id, item.id, state);
    }
    hero.startingEquipmentGranted = true;
  }
}
