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

    // Older healers started with Pine Staff and Barbarians with Bronze Longsword.
    // Keep that owned copy, but supply the newly authored compatible starter once if
    // restoration removed its slot. The next saved slot points at the replacement.
    const savedWeaponId = savedRoster.get(hero.id)?.equipment?.weapon;
    const formerWeapon = state.inventory.equipment.find(item => item.id === savedWeaponId);
    const changedStarter = hero.className === 'Barbarian' && formerWeapon?.itemId === 'BLS01'
      || hero.className?.startsWith('Cleric of ') && formerWeapon?.itemId === 'PST01';
    if (hero.startingEquipmentGranted && !hero.equipment?.weapon && changedStarter && loadout) {
      const replacement = grantEquipment(loadout.weapon, state);
      if (replacement) equipItem(hero.id, replacement.id, state);
    }

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
