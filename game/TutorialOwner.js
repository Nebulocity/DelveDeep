import GameState from './GameState.js';
import { skipRecruitmentTutorial } from './RecruitmentTutorial.js';
import { invalidateTutorialCallbacks } from './TutorialProgress.js';

// Recruitment owns its existing skip/grant transaction. Generic guidance only owns
// checkpoints. Neither path rolls back earned gameplay when presentation is dismissed.
export function tutorialOwner(state = GameState) {
  if (state.tutorialProgress?.lessonId?.startsWith('help-')) return 'guidance';
  if (state.tutorial?.status === 'active' || state.tutorialProgress?.lessonId === 'pineshire-first-adventure' && state.tutorialProgress.status === 'active') return 'recruitment';
  return state.tutorialProgress?.status === 'active' ? 'guidance' : null;
}

export function exitTutorial(controller, skip = false, owner = tutorialOwner(controller.state)) {
  if (owner === 'recruitment') {
    invalidateTutorialCallbacks(controller.state);
    const result = skipRecruitmentTutorial();
    if (result.ok && ['active', 'paused', 'retry'].includes(controller.progress.status)) {
      const guidance = controller.exit(true, controller.capture());
      if (!guidance.ok) return guidance;
    }
    return result;
  }
  return controller.exit(skip, controller.capture());
}
