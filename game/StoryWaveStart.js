// This signal runs before combat decisions, so a lesson can pause the same frame.
export const STORY_WAVE_READY = 'story-wave-ready';
export const storyWaveReadyId = scene => `${scene.gameplayContext?.encounterId}:${scene.gameplayContext?.waveSerial}`;
export const storyWaveHasLanded = scene => !scene.battleOver && !scene.waveTransitioning
  && !!scene.enemies?.some(enemy => enemy.alive) && !scene.pendingWaveSpawns?.length
  && !scene.enemies.some(enemy => enemy.landing);
