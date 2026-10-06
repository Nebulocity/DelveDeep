import { STARTING_EQUIPMENT } from '../data/startingEquipment.js';
import GameState from './GameState.js';
import { equipItem, grantEquipment } from './Equipment.js';

export function grantStartingEquipment(savedRoster, state = GameState) {
  for (const hero of state.roster) {
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
