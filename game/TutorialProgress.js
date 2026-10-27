export const TUTORIAL_CURRICULUM_VERSION = 2;

// Profile-local observation identity. This is independent of diagnostic logging.
export function newGameplayState() {
  return { version: 1, epoch: globalThis.crypto?.randomUUID?.() ?? String(Date.now()) + '-' + Math.random().toString(36).slice(2),
    serial: 0, outcomes: [], transactions: [] };
}

export function validGameplayState(value) {
  return value?.version === 1 && typeof value.epoch === 'string' && Number.isSafeInteger(value.serial)
    && value.serial >= 0 && Array.isArray(value.transactions) && value.transactions.length <= 16
    && value.transactions.every(e => e?.version === 1 && e.profileEpoch === value.epoch
      && ['adventurer.recruited', 'party.saved'].includes(e.type) && e.phase === 'committed'
      && typeof e.eventId === 'string' && Number.isSafeInteger(e.sequence))
    && Array.isArray(value.outcomes) && value.outcomes.length <= 16
    && value.outcomes.every(o => o && typeof o.encounterId === 'string' && typeof o.eventId === 'string'
      && ['victory', 'defeat', 'retreat'].includes(o.outcome) && o.mode === 'campaign');
}

export function emptyTutorialProgress() {
  return { version: 1, curriculumVersion: TUTORIAL_CURRICULUM_VERSION, status: 'idle', lessonId: null, checkpointId: null,
    attemptId: null, authorityId: null, find: null, finds: [], openingRecord: null, pauseOwnedEncounter: null, mode: 'campaign', encounterId: null, completed: {}, outcome: null,
    targetId: null, allowedInteractions: [], retryReason: null };
}

export function validTutorialProgress(value) {
  const id = v => v === null || typeof v === 'string';
  return value?.version === 1 && value.curriculumVersion === TUTORIAL_CURRICULUM_VERSION
    && ['idle', 'active', 'paused', 'skipped', 'complete', 'retry'].includes(value.status)
    && ['campaign', 'practice'].includes(value.mode)
    && ['lessonId', 'checkpointId', 'attemptId', 'authorityId', 'encounterId', 'targetId', 'retryReason'].every(k => id(value[k]))
    && (value.status === 'idle' || ['lessonId', 'checkpointId', 'attemptId', 'authorityId'].every(k => typeof value[k] === 'string'))
    && Array.isArray(value.allowedInteractions) && value.allowedInteractions.every(v => typeof v === 'string')
    && value.completed && Object.getPrototypeOf(value.completed) === Object.prototype
    && Object.entries(value.completed).every(([key, v]) => !['__proto__', 'constructor', 'prototype'].includes(key)
      && typeof v === 'string')
    && (value.outcome === null || typeof value.outcome?.eventId === 'string');
}

// Reconciliation is evidence only. Campaign settlement remains owned by expedition code.
export function reconcileTutorialOutcome(state) {
  const p = state.tutorialProgress;
  if (!p?.encounterId) return false;
  const outcome = state.gameplay?.outcomes.find(o => o.encounterId === p.encounterId && o.mode === p.mode);
  if (!outcome || p.outcome?.eventId === outcome.eventId) return false;
  p.outcome = { ...outcome };
  return true;
}

// Runtime leases are deliberately not saved. Reload and scene disposal invalidate old
// closures even when the durable checkpoint and attempt correctly remain unchanged.
const runtimes = new WeakMap();
export function tutorialRuntime(state) {
  if (!runtimes.has(state)) runtimes.set(state, { generation: crypto.randomUUID(), scopes: new Map(), busy: false });
  return runtimes.get(state);
}

export function invalidateTutorialCallbacks(state) {
  const runtime = tutorialRuntime(state);
  runtime.generation = crypto.randomUUID();
  for (const scope of [...runtime.scopes.values()]) scope.dispose();
  return runtime;
}

export function tutorialEvidenceContext(state) {
  const p = state.tutorialProgress;
  return p?.status === 'active' ? { lessonId: p.lessonId, checkpointId: p.checkpointId,
    attemptId: p.attemptId, authorityId: p.authorityId } : null;
}
