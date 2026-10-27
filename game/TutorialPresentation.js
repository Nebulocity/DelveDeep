import published from '../data/tutorialPresentation.json' with { type: 'json' };
import { validateStoryPoints, storyAction, storyPointScene } from './StoryPresentation.js';
import authority from '../data/tutorialAuthority.json' with { type: 'json' };

export const PRESENTATION_VALIDATOR_VERSION = 6;
export const TUTORIAL_AUTHORITY = authority;
export const NARRATIVE_TYPES = ['narration', 'dialogue', 'cinematic', 'hint', 'optional-help'];
export const AUDIO_EVENTS = ['scene.entered', 'selection.changed', 'adventurer.recruited', 'party.saved',
  'combat.mechanic.warning', 'combat.interrupt.succeeded', 'combat.encounter.finished'];
export const EXIT_ANCHORS = ['top-right', 'top-left', 'bottom-right', 'bottom-left'];
export const clonePresentation = () => structuredClone(published);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const bounded = (n, lo, hi) => Number.isFinite(n) && n >= lo && n <= hi;

// Editable presentation never carries code, predicates, transactions or graph links.
export function validatePresentation(doc, catalogs = {}) {
  const issues = [], error = (id, message) => issues.push({ level: 'error', id, message });
  const warning = (id, message) => issues.push({ level: 'warning', id, message });
  if (!doc || doc.schemaVersion !== 1 || doc.curriculumVersion !== 2 || !Array.isArray(doc.steps)
    || doc.steps.length > 500 || !Array.isArray(doc.variants)) return [{ level: 'error', message: 'Expected presentation schema 1, curriculum 2 and bounded steps/variants.' }];
  if (!EXIT_ANCHORS.includes(doc.exitAnchor)) error('', 'Choose a supported safe Exit anchor.');
  if (typeof doc.title !== 'string' || doc.title.length > 200) error('', 'Use a project title under 200 characters.');
  issues.push(...validateStoryPoints(doc));
  const allowed = new Set(['storyPointId', 'id', 'anchor', 'lessonId', 'checkpointId', 'locked', 'label', 'chapter', 'scene', 'type', 'enabled', 'text', 'speaker', 'portraitId', 'portraitSide', 'portraitScale', 'portraitFrameScale', 'portraitOffsetX', 'portraitOffsetY', 'portraitMode', 'crop', 'preset', 'placement', 'dimming', 'fadeMs', 'easing', 'emphasis', 'entry', 'completion', 'pause', 'targetIds', 'audio']);
  const ids = new Set();
  const locked = doc.steps.filter(s => s?.locked);
  if (!same(locked.map(s => s.id), authority.map(s => s.id))) error('', 'Existing checkpoints cannot be added, removed or reordered. Add narrative beats under a checkpoint instead.');
  let currentAnchor = null;
  for (const s of doc.steps) {
    if (!s || typeof s.id !== 'string') { error('', 'Every step needs an ID.'); continue; }
    if (ids.has(s.id) || !/^[a-z0-9/-]{1,120}$/.test(s.id)) error(s.id, 'Duplicate or unsafe step ID.');
    ids.add(s.id);
    if (Object.keys(s).some(k => !allowed.has(k))) error(s.id, 'Unknown fields are not supported; gameplay expressions and graph links are not editable.');
    const base = authority.find(a => a.id === s.anchor);
    if (s.locked) currentAnchor = s.id;
    const point = doc.storyPoints?.find(point => point.id === s.storyPointId);
    if (point && (s.locked || s.entry !== 'after-previous' || s.lessonId !== 'story' || s.checkpointId !== point.id || s.scene !== storyPointScene(point) || s.anchor !== point.id)) error(s.id, 'Story dialogue must use its story point location and trigger.');
    if (!point && (!base || s.anchor !== currentAnchor || s.scene !== base?.scene || s.lessonId !== base?.lessonId
      || s.checkpointId !== base?.checkpointId)) error(s.id, 'A narrative beat must stay in its original checkpoint segment and scene.');
    if (typeof s.text !== 'string' || s.text.length > 8000 || typeof s.label !== 'string' || s.label.length > 160
      || typeof s.chapter !== 'string' || s.chapter.length > 120 || typeof s.locked !== 'boolean'
      || typeof s.speaker !== 'string' || s.speaker.length > 100 || typeof s.portraitId !== 'string' || typeof s.enabled !== 'boolean') error(s.id, 'Invalid text, speaker, chapter, label or enabled state.');
    if (s.locked && (!s.enabled || s.entry !== 'scene-ready' || s.pause !== base?.pause
      || s.completion !== (base?.evidence.type === 'tutorial.continued' ? 'continue' : 'authority')
      || !same(s.targetIds, base?.targetIds))) error(s.id, 'Checkpoint gates, targets, pause ownership and enabled state are locked to real gameplay authority.');
    if (point && storyAction(s)?.scene && storyAction(s).scene !== s.scene) error(s.id, 'This completion action belongs in the Tavern.');
    if (!s.locked && (!NARRATIVE_TYPES.includes(s.type) || !(s.completion === 'continue' || point && storyAction(s))
      || !['scene-ready', 'after-previous', ...AUDIO_EVENTS.map(e => 'event:' + e)].includes(s.entry) || !['none', 'narrative'].includes(s.pause))) error(s.id, 'Extra beats support narrative Continue, story completion actions and catalog entry events only; they cannot complete gameplay evidence.');
    if (!['none', 'left', 'right'].includes(s.portraitSide) || !['idle', 'portrait', 'talk', 'special'].includes(s.portraitMode)
      || !['contain', 'cover'].includes(s.crop) || !bounded(s.portraitScale, .5, 1.5)
      || !bounded(s.portraitFrameScale ?? 1.1, .8, 1.25)
      || !bounded(s.portraitOffsetX ?? 0, -100, 100) || !bounded(s.portraitOffsetY ?? 0, -100, 100)) error(s.id, 'Invalid portrait layout.');
    if (!['compact', 'wide'].includes(s.preset) || !bounded(s.dimming, 0, .8) || !bounded(s.fadeMs, 0, 500)
      || !['linear', 'sine'].includes(s.easing) || !['normal', 'gold'].includes(s.emphasis)) error(s.id, 'Invalid panel style or bounded timing.');
    if (!s.placement || !['auto', ...EXIT_ANCHORS, 'preferred'].includes(s.placement.anchor)
      || s.placement.space !== undefined && s.placement.space !== 'canvas'
      || s.placement.anchor === 'preferred' && (!bounded(s.placement.x, 0, 1) || !bounded(s.placement.y, 0, 1))) error(s.id, 'Placement must be a safe anchor or normalized preference.');
    if (!Array.isArray(s.targetIds) || s.targetIds.length > 8 || s.targetIds.some(id => typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,120}$/.test(id))) error(s.id, 'Invalid semantic spotlight IDs.');
    if (s.completion === 'click-spotlight' && (!Array.isArray(s.targetIds) || !s.targetIds.length)) error(s.id, 'Click spotlight item requires a spotlight control. Use Pick spotlight target to choose one.');
    if (s.portraitId && catalogs.portraits && !catalogs.portraits.some(p => p.id === s.portraitId && p.available)) warning(s.id, `Portrait unavailable: ${s.portraitId}. A visible missing-art message will replace it.`);
    if (!Array.isArray(s.audio) || s.audio.length > 12) { error(s.id, 'Use at most 12 cues per beat.'); continue; }
    for (const cue of s.audio) {
      if (!cue || !['sfx', 'ambience', 'music', 'voice'].includes(cue.kind) || !['onEnter', 'onAdvance', 'onLeave', 'afterMs', 'event'].includes(cue.trigger)
        || !bounded(cue.delayMs, 0, 30000) || !bounded(cue.durationMs, 50, 120000) || !bounded(cue.volume, 0, 1)
        || !bounded(cue.fadeMs, 0, 3000) || !['once-per-beat', 'each-preview'].includes(cue.replay) || typeof cue.assetId !== 'string') error(s.id, 'Invalid audio cue or timing bounds.');
      if (cue?.trigger === 'event' && !AUDIO_EVENTS.includes(cue.event)) error(s.id, `Unsupported authoritative event: ${cue.event || '(none)'}. Boss landing has no authoring event adapter.`);
      if (catalogs.audio && !catalogs.audio.some(a => a.id === cue?.assetId && a.available)) error(s.id, `Audio unavailable: ${cue?.assetId}. Choose an assigned registry asset or import a file.`);
    }
    if (!s.locked && Array.isArray(s.targetIds) && s.targetIds.length && catalogs.targets && s.targetIds.some(id => !catalogs.targets.includes(id))) warning(s.id, 'A spotlight target is unavailable in the current live scene.');
  }
  if (doc.variants.length !== published.variants.length || doc.variants.some((v, i) => !v || v.id !== published.variants[i]?.id
    || v.original !== published.variants[i]?.original || v.editable !== published.variants[i]?.editable || typeof v.text !== 'string'
    || v.text.length > 8000 || !v.editable && v.text !== v.original)) error('', 'Dynamic presentation variants must retain their identities and system templates.');
  return issues;
}

// Dynamic targeting and authority remain source-owned. Only matching authored text
// is replaced; resume/inspection/retry templates retain their original behavior.
export function withTutorialPresentation(step, lessonId, checkpointId) {
  if (!step || !publishedSafe) return step;
  const entry = published.steps.find(s => s.lessonId === lessonId && s.checkpointId === checkpointId);
  if (!entry) return step;
  const base = authority.find(s => s.id === entry.id);
  const variant = published.variants.find(v => v.original === step.instruction);
  const text = step.instruction === base?.text ? entry.text : variant?.text ?? step.instruction;
  return { ...step, instruction: text, authoredPresentation: entry, exitAnchor: published.exitAnchor };
}

const publishedSafe = (() => {
  try { return !validatePresentation(published).some(i => i.level === 'error'); }
  catch { return false; }
})();
