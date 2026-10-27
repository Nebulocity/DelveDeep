import GameState from '../game/GameState.js';
import { saveProfile } from '../game/GameStorage.js';
import { pendingAbilityUnlocks, acknowledgeAbilityUnlocks } from '../game/AbilityUnlockNotifications.js';
import { showSelectionDetails } from './SelectionDetails.js';
import { syncRegionMapCameras } from './RegionMapUI.js';
import { tutorialGuidance } from '../game/TutorialGuidance.js';

// Deliver on return to a menu, never in active combat. The shared details body scrolls
// when several adventurers or skipped milestones produce more text than fits on phone.
export function showAbilityUnlockNotice(scene) {
  if (!['TitleScene', 'TownScene', 'AbilitiesScene'].includes(scene.scene.key)) return;
  if (scene.abilityUnlockNoticeCleanup || !pendingAbilityUnlocks(GameState.roster).length) return;
  let rendered = null;
  const cleanup = () => {
    scene.events.off('postupdate', present);
    scene.events.off('shutdown', cleanup);
    if (rendered) scene.game.events.off('postrender', rendered);
    if (scene.abilityUnlockNoticeCleanup === cleanup) scene.abilityUnlockNoticeCleanup = null;
  };
  const present = () => {
    if (!scene.sys.isActive() || scene.selectionDetailsClose || rendered || tutorialGuidance(scene.game).ownsInput()) return;
    const groups = pendingAbilityUnlocks(GameState.roster);
    if (!groups.length) { cleanup(); return; }
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
    const noticeClose = scene.selectionDetailsClose;
    scene.abilityUnlockNoticeClose = noticeClose;

    // Opening a modal is not delivery. A same-frame prompt or scene transition can
    // replace it before rendering; keep those IDs pending and retry on this menu.
    rendered = () => {
      scene.game.events.off('postrender', rendered);
      rendered = null;
      if (tutorialGuidance(scene.game).ownsInput()) {
        if (scene.selectionDetailsClose === noticeClose) noticeClose?.();
        return;
      }
      if (!scene.sys.isActive() || !noticeClose || scene.selectionDetailsClose !== noticeClose) return;
      acknowledgeAbilityUnlocks(groups);
      saveProfile();
      cleanup();
    };
    scene.game.events.on('postrender', rendered);
  };

  // Recruitment prompts initialize synchronously. Wait until the scene update has
  // finished, then present only after the current modal has left its input slot.
  scene.abilityUnlockNoticeCleanup = cleanup;
  scene.events.on('postupdate', present);
  scene.events.once('shutdown', cleanup);
}
