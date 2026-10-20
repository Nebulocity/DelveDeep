import GameState from '../game/GameState.js';
import { beginRecruitmentTutorial, skipRecruitmentTutorial } from '../game/RecruitmentTutorial.js';
import { showConfirmation } from './ConfirmationDialog.js';
import { showFeatureToast } from './FeatureToast.js';
import { showSelectionDetails } from './SelectionDetails.js';
import { syncRegionMapCameras } from './RegionMapUI.js';

// Escape, closing a prompt or leaving its scene counts as exiting the lesson too.
// Check after the input turn so the dialog's ordinary close-before-confirm behavior
// cannot mistake a real BEGIN/TAVERN/CHOOSE PARTY action for dismissal.
function tutorialPrompt(scene, options) {
  let answered = false;
  showConfirmation(scene, { ...options,
    onConfirm: () => { answered = true; options.onConfirm(); },
    onCancel: () => { answered = true; options.onCancel(); }
  });
  const modalClose = scene.selectionDetailsClose;
  const cleanup = () => {
    scene.events.off('postupdate', update);
    scene.events.off('shutdown', dismiss);
  };
  const dismiss = () => {
    cleanup();
    if (answered) return;
    answered = true;
    const result = skipRecruitmentTutorial();
    if (!result.ok && scene.sys.isActive()) showFeatureToast(scene, result.message);
  };
  const update = () => {
    if (answered) cleanup();
    else if (scene.selectionDetailsClose !== modalClose) dismiss();
  };
  scene.events.on('postupdate', update);
  scene.events.once('shutdown', dismiss);
}

// Opt-in, resume and replay all use the existing shared Tutorial entry and dialogs.
export function openRecruitmentTutorial(scene, replay = false) {
  if (GameState.activeBattle) {
    showSelectionDetails(scene, { title: 'Tutorial',
      description: 'Finish your active expedition before starting the recruitment lesson.' });
    syncRegionMapCameras(scene);
    return;
  }
  if (GameState.tutorial.status === 'pending' || replay) {
    tutorialPrompt(scene, {
      title: replay ? 'Replay recruitment tutorial?' : 'Learn to recruit your party?',
      description: 'Visit the Tavern, hire Garrick for free, then choose and save five adventurers including your new tank.\n\nChoose CANCEL to skip. Garrick will be available immediately.',
      confirmLabel: replay ? 'REPLAY' : 'BEGIN',
      onConfirm: () => {
        const result = beginRecruitmentTutorial();
        if (result.ok) scene.scene.start('TownScene');
        else showFeatureToast(scene, result.message);
      },
      onCancel: () => {
        const result = skipRecruitmentTutorial();
        if (!result.ok) showFeatureToast(scene, result.message);
      }
    });
  } else if (GameState.tutorial.status === 'active') {
    const recruit = GameState.tutorial.step === 'recruit';
    tutorialPrompt(scene, {
      title: recruit ? 'First, recruit your tank' : 'Prepare your five adventurers',
      description: recruit
        ? 'Open the Tavern, select Garrick and confirm Hire for Free. His recruitment is permanent.\n\nCANCEL exits the tutorial and grants Garrick automatically.'
        : 'Garrick has joined your roster. Select him and four companions in Party Management, then press Save.\n\nCANCEL exits the tutorial and keeps all recruited adventurers.',
      confirmLabel: recruit ? 'TAVERN' : 'CHOOSE PARTY',
      onConfirm: () => scene.scene.start(recruit ? 'TavernScene' : 'PartySelectScene',
        recruit ? { characterId: 'garrick' } : { origin: 'town', returnScene: 'TownScene' }),
      onCancel: () => {
        const result = skipRecruitmentTutorial();
        if (!result.ok) showFeatureToast(scene, result.message);
      }
    });
  }
  syncRegionMapCameras(scene);
}
