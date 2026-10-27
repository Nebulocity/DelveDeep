import published from '../data/tutorialPresentation.json' with { type: 'json' };
import { pendingIntro } from '../game/StoryPresentation.js';
import GameState from '../game/GameState.js';
import { tutorialGuidance } from '../game/TutorialGuidance.js';
import { showTutorialDialog } from './TutorialDialog.js';
import { showFeatureToast } from './FeatureToast.js';
import { syncRegionMapCameras } from './RegionMapUI.js';

// Opt-in, resume and replay all use the existing shared Tutorial entry and dialogs.
export function openRecruitmentTutorial(scene, replay = false) {
  const guide = tutorialGuidance(scene.game);
  if (globalThis.__tutorialStudioPreview || guide.storyActive || !replay && GameState.tutorial.status === 'pending' && (pendingIntro(published, GameState) || GameState.storyProgress?.activeId)) return;
  if (!replay && guide.controller.progress.retryReason === 'unsupported-curriculum') return;
  if (guide.opening.active() && !replay) return;
  if (GameState.activeBattle) {
    showTutorialDialog(scene, { title: 'Tutorial', confirmLabel: 'CLOSE',
      description: 'Finish your active expedition before starting the recruitment lesson.' });
    syncRegionMapCameras(scene);
    return;
  }
  const result = guide.opening.start(scene, replay);
  if (!result.ok) showFeatureToast(scene, result.message ?? 'Tutorial progress could not be saved. Please try again.');
  syncRegionMapCameras(scene);
}
