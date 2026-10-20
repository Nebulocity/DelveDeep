import GameState from '../game/GameState.js';
import { openRecruitmentTutorial } from './RecruitmentTutorial.js';

// Replay uses the same saved lesson as new-game onboarding and preserves ownership.
export function openTutorialReplay(scene) {
  openRecruitmentTutorial(scene, ['complete', 'skipped'].includes(GameState.tutorial.status));
}
