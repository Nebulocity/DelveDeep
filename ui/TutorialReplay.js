import { showSelectionDetails } from './SelectionDetails.js';
import { syncRegionMapCameras } from './RegionMapUI.js';

// This is the map's replay entry point. Replace the notice when the shared interactive
// tutorial is available; replay must preserve the player's saved and active game state.
export function openTutorialReplay(scene) {
  showSelectionDetails(scene, {
    title: 'Tutorial',
    description: 'The tutorial is being prepared!\n\nYour next lesson in the arts of adventuring will be ready soon.',
    panelWidth: 1100
  });
  syncRegionMapCameras(scene);
}
