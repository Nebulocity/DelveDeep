import { storyLocation } from '../data/storyLocations.js';
import { getDelveById } from '../data/delves.js';

// Completion rules are a fixed gameplay catalog, never authored event expressions.
export const STORY_ACTIONS = {
  'click-spotlight': { label: 'Click spotlight item', spotlight: true,
    instruction: 'Tap the highlighted control to continue.',
    matches: () => false, satisfied: () => false },
  'hire-garrick': { label: 'Hire Garrick for Free', scene: 'TavernScene', targetId: 'tavern-hire',
    instruction: 'Choose Hire for Free, then confirm Hire.',
    prepare: scene => {
      scene.selectionDetailsClose?.();
      if (scene.selectedId !== 'garrick' && scene.availableRecruits().some(hero => hero.id === 'garrick')) {
        scene.role = 'All'; scene.selectedId = 'garrick'; scene.render();
      }
    },
    matches: event => event.type === 'adventurer.recruited' && event.phase === 'committed'
      && event.source?.kind === 'player' && event.adventurerId === 'garrick',
    satisfied: state => state.recruitedIds.includes('garrick') }
};
export const storyAction = line => Object.hasOwn(STORY_ACTIONS, line?.completion) ? STORY_ACTIONS[line.completion] : null;
export const storyActionTargets = line => {
  const action = storyAction(line);
  return action?.spotlight ? (Array.isArray(line.targetIds) ? line.targetIds : []) : action ? [action.targetId] : [];
};
export const STORY_TRIGGERS = ['intro', 'scene-enter', 'after-previous', 'wave-start'];
export const storyPointScene = point => point?.trigger === 'wave-start' ? 'BattleScene' : storyLocation(point?.locationId)?.scene;
export const storyWaveMatches = (point, scene, state) => point?.trigger === 'wave-start'
  && scene?.scene.key === 'BattleScene' && scene.currentWaveIndex + 1 === point.wave
  && (state.currentDelve?.id === point.locationId || state.currentDelve?.id === storyLocation(point.locationId)?.delveId);
export const SCENE_EXIT_FADES = [0, 500, 1000, 1500];
export const storyLines = (document, point) => document.steps.filter(step => step.storyPointId === point.id && step.enabled);
export const storyPoints = document => document.storyPoints ?? [];
export const emptyStoryProgress = () => ({ completed: [], activeId: null, lineId: null, pausedEncounterId: null });
export const validStoryProgress = value => value && Array.isArray(value.completed) && value.completed.length <= 500
  && value.completed.every(id => typeof id === 'string' && id.length <= 120) && [value.activeId, value.lineId].every(id => id === null || typeof id === 'string')
  && (value.pausedEncounterId == null || typeof value.pausedEncounterId === 'string' && value.pausedEncounterId.length <= 200);
export const pendingIntro = (document, state) => storyPoints(document).some(point => point.enabled && point.trigger === 'intro'
  && !state.storyProgress?.completed?.includes(point.id) && storyLines(document, point).length);

export function validateStoryPoints(document) {
  const issues = [], ids = new Set(), waveTriggers = new Set();
  const error = (id, message) => issues.push({ level: 'error', id, message });
  if (document.storyPoints !== undefined && (!Array.isArray(document.storyPoints) || document.storyPoints.length > 200))
    return [{ level: 'error', message: 'Use at most 200 story points.' }];
  for (const point of storyPoints(document)) {
    if (!point || typeof point.id !== 'string' || !/^story-[a-z0-9-]{1,100}$/.test(point.id) || ids.has(point.id)) {
      error(point?.id, 'Each story point needs a unique ID.'); continue;
    }
    ids.add(point.id);
    if (Object.keys(point).some(key => !['id', 'label', 'locationId', 'trigger', 'wave', 'exitFadeMs', 'enabled'].includes(key))
      || typeof point.label !== 'string' || point.label.length > 160 || !storyLocation(point.locationId)
      || !STORY_TRIGGERS.includes(point.trigger) || !SCENE_EXIT_FADES.includes(point.exitFadeMs) || typeof point.enabled !== 'boolean')
      error(point.id, 'Choose a registered location, trigger and scene exit for this story point.');
    if (point.trigger === 'wave-start') {
      const location = storyLocation(point.locationId);
      const delve = location?.kind === 'delve' && getDelveById(location.delveId);
      if (!delve || !Number.isInteger(point.wave) || point.wave < 1 || point.wave > delve.rooms || point.exitFadeMs !== 0)
        error(point.id, 'Wave-start stories require a regular Delve, a valid wave number and Immediate scene exit.');
      if (point.enabled) {
        const key = point.locationId + ':' + point.wave;
        if (waveTriggers.has(key)) error(point.id, 'Use one enabled story point per Delve wave. Add dialogue to that point for a longer lesson.');
        waveTriggers.add(key);
      }
    }
    if (!document.steps.some(step => step?.storyPointId === point.id)) error(point.id, 'Add at least one dialogue line to the story point.');
  }
  for (const step of document.steps) if (step?.storyPointId !== undefined && !ids.has(step.storyPointId)) error(step.id, 'Dialogue references a missing story point.');
  return issues;
}
