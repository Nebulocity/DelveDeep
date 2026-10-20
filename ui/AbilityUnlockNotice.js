import GameState from '../game/GameState.js';
import { saveProfile } from '../game/GameStorage.js';
import { pendingAbilityUnlocks, acknowledgeAbilityUnlocks } from '../game/AbilityUnlockNotifications.js';
import { showSelectionDetails } from './SelectionDetails.js';
import { syncRegionMapCameras } from './RegionMapUI.js';

// Deliver on return to a menu, never in active combat. The shared details body scrolls
// when several adventurers or skipped milestones produce more text than fits on phone.
export function showAbilityUnlockNotice(scene) {
  if (!['TitleScene', 'TownScene', 'AbilitiesScene'].includes(scene.scene.key)) return;
  const groups = pendingAbilityUnlocks(GameState.roster);
  if (!groups.length || scene.selectionDetailsClose) return;
  const description = groups.map(({ hero }) =>
    `${hero.name} · Level ${hero.level}\nLearned a new ability!`)
    .join('\n\n');
  showSelectionDetails(scene, {
    title: 'Level Up!',
    description,
    descriptionColor: '#39ff70',
    panelWidth: 1400
  });
  if (scene.mapUiCamera) syncRegionMapCameras(scene);
  acknowledgeAbilityUnlocks(groups);
  saveProfile();
}
