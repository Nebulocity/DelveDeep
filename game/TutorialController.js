import GameState from './GameState.js';
import { flushProfileSave } from './GameStorage.js';
import { observeGameplay } from './GameplayEvents.js';
import { emptyTutorialProgress, validTutorialProgress, tutorialRuntime, invalidateTutorialCallbacks } from './TutorialProgress.js';

const COMPLETION_EVENTS = new Set(['tutorial.continued', 'tutorial.action.accepted', 'selection.changed', 'combat.order.executed', 'combat.interrupt.succeeded',
  'combat.leaderTap.accepted', 'combat.leaderTap.resolved', 'combat.movement.arrived',
  'combat.mechanic.resolved', 'combat.encounter.finished', 'scene.entered', 'adventurer.recruited', 'party.saved']);

// The controller owns durable facts. Scene scopes own transient listeners and timers;
// neither navigation nor a stale presentation callback may reset gameplay transactions.
export default class TutorialController {
  constructor(definitions, state = GameState, persist = flushProfileSave) {
    this.definitions = definitions;
    this.state = state;
    this.persist = persist;
  }

  get progress() { return this.state.tutorialProgress ?? emptyTutorialProgress(); }

  capture() {
    const p = this.progress;
    return Object.freeze({ lessonId: p.lessonId, checkpointId: p.checkpointId, attemptId: p.attemptId,
      authorityId: p.authorityId, generation: tutorialRuntime(this.state).generation,
      profileEpoch: this.state.gameplay?.epoch ?? null, afterSequence: this.state.gameplay?.serial ?? 0 });
  }

  authorized(token) {
    const p = this.progress, runtime = tutorialRuntime(this.state);
    return !!token && token.generation === runtime.generation
      && token.lessonId === p.lessonId && token.checkpointId === p.checkpointId
      && token.attemptId === p.attemptId && token.authorityId === p.authorityId
      && token.profileEpoch === (this.state.gameplay?.epoch ?? null)
      && (!token.ownerId || runtime.scopes.has(token.ownerId));
  }

  commit(token, change, statuses) {
    const runtime = tutorialRuntime(this.state);
    if (runtime.busy || !this.authorized(token)) return { ok: false, reason: 'stale_authority' };
    if (!statuses.includes(this.progress.status)) return { ok: false, reason: 'invalid_transition' };
    const previous = this.progress, next = structuredClone(previous);
    try { change(next); } catch { return { ok: false, reason: 'checkpoint_unavailable' }; }
    next.authorityId = crypto.randomUUID();
    if (!validTutorialProgress(next)) return { ok: false, reason: 'invalid_checkpoint' };

    // Revoke before persistence, including failure. A retry must acquire fresh authority,
    // while the last durable progress remains intact. Reentrant writes are not allowed.
    runtime.busy = true;
    invalidateTutorialCallbacks(this.state);
    const generation = runtime.generation;
    this.state.tutorialProgress = next;
    let saved = false;
    try { saved = this.persist() === true; } catch { saved = false; }
    finally { runtime.busy = false; }
    if (this.state.tutorialProgress !== next || runtime.generation !== generation)
      return { ok: false, reason: 'state_replaced' };
    if (saved) return { ok: true, authority: this.capture() };
    this.state.tutorialProgress = previous;
    return { ok: false, reason: 'save_failed' };
  }

  begin(lessonId, mode, token) {
    const lesson = this.definitions[lessonId];
    if (!lesson?.checkpoints?.[lesson.firstCheckpoint] || !['campaign', 'practice'].includes(mode))
      return { ok: false, reason: 'unknown_lesson' };
    return this.commit(token, p => {
      const openingRecord = lessonId.startsWith('help-')
        ? p.lessonId === 'pineshire-first-adventure' ? { status: p.status, completed: p.completed, find: p.find ?? null, finds: p.finds ?? [] } : p.openingRecord
        : null;
      Object.assign(p, emptyTutorialProgress(), { openingRecord, status: 'active', lessonId, mode,
        attemptId: crypto.randomUUID() });
      this.setCheckpoint(p, lesson.firstCheckpoint);
    }, ['idle', 'active', 'paused', 'retry', 'skipped', 'complete']);
  }

  setCheckpoint(p, checkpointId) {
    const step = this.definitions[p.lessonId]?.checkpoints[checkpointId];
    if (!step) throw new Error('Unknown tutorial checkpoint: ' + checkpointId);
    Object.assign(p, { checkpointId, targetId: step.targetId ?? null,
      allowedInteractions: [...(step.allowedInteractions ?? [])] });
  }

  matchesEvidence(event, token) {
    const p = this.progress, rule = this.definitions[p.lessonId]?.checkpoints[p.checkpointId]?.evidence;
    if (!token?.ownerId || !this.authorized(token) || p.status !== 'active' || !rule
      || !event || event.version !== 1 || typeof event.eventId !== 'string'
      || !COMPLETION_EVENTS.has(event.type) || event.type !== rule.type
      || event.source?.kind === 'ai' || event.source?.kind !== rule.source
      || event.profileEpoch !== token.profileEpoch || !(event.sequence > token.afterSequence)
      || event.sceneSessionId !== token.sceneSessionId || event.queued
      || event.tutorial?.attemptId !== p.attemptId || event.tutorial?.authorityId !== p.authorityId
      || event.tutorial?.lessonId !== p.lessonId || event.tutorial?.checkpointId !== p.checkpointId) return false;
    if (event.type.startsWith('combat.') && (!p.encounterId || event.encounterId !== p.encounterId || event.mode !== p.mode)) return false;
    for (const key of ['command', 'phase', 'targetId', 'castId', 'waveId', 'outcome', 'sceneId', 'selectionId', 'role', 'action', 'waveIndex'])
      if (rule[key] !== undefined && event[key] !== rule[key]) return false;
    if (rule.validate && !rule.validate(event, this.state)) return false;
    if (rule.memberIds && (event.memberIds?.length !== rule.memberIds.length
      || !rule.memberIds.every(id => event.memberIds.includes(id)))) return false;
    if (['adventurer.recruited', 'party.saved'].includes(event.type)
      && (event.phase !== 'committed' || !this.state.gameplay?.transactions?.some(e => e.eventId === event.eventId))) return false;
    if (rule.actorId && event.actorId !== rule.actorId && !event.subjectIds?.includes(rule.actorId)
      && !event.manualAvoidance?.some(entry => entry.actorId === rule.actorId)) return false;
    if (event.type === 'combat.order.executed' && !event.subjectIds?.length && event.phase !== 'interrupt') return false;
    if (event.type === 'combat.movement.arrived' && !event.started) return false;
    if (event.type === 'combat.mechanic.resolved' && !event.manualAvoidance?.some(entry =>
      (!rule.actorId || entry.actorId === rule.actorId) && entry.tutorial?.attemptId === p.attemptId
      && entry.tutorial?.authorityId === p.authorityId)) return false;
    if (event.type === 'combat.encounter.finished' && !this.state.gameplay?.outcomes.some(o => o.eventId === event.eventId)) return false;
    return true;
  }

  complete(checkpointId, event, token) {
    const p = this.progress;
    if (token?.attemptId === p.attemptId && token?.lessonId === p.lessonId
      && Object.hasOwn(p.completed, checkpointId) && p.completed[checkpointId] === event?.eventId)
      return { ok: true, duplicate: true };
    if (checkpointId !== p.checkpointId || !this.matchesEvidence(event, token)) return { ok: false, reason: 'invalid_evidence' };
    return this.commit(token, next => {
      next.completed[checkpointId] = event.eventId;
      const step = this.definitions[next.lessonId].checkpoints[checkpointId];
      if (step.next) this.setCheckpoint(next, step.next);
      else { next.status = 'complete'; next.allowedInteractions = []; next.targetId = null; }
    }, ['active']);
  }

  bindEncounter(encounterId, mode, token) {
    if (mode !== this.progress.mode || typeof encounterId !== 'string') return { ok: false, reason: 'encounter_mismatch' };
    return this.commit(token, p => { p.encounterId = encounterId; p.outcome = null; }, ['active']);
  }

  exit(skip, token) {
    const status = skip ? 'skipped' : 'paused', p = this.progress;
    if (token?.attemptId === p.attemptId && token?.lessonId === p.lessonId && p.status === status)
      return { ok: true, duplicate: true };
    return this.commit(token, next => { next.status = status; next.allowedInteractions = []; }, ['active', 'paused', 'retry']);
  }

  resume(token) {
    return this.commit(token, p => { p.status = 'active'; this.setCheckpoint(p, p.checkpointId); }, ['paused', 'active']);
  }

  missedOpportunity(reason, token) {
    return this.commit(token, p => { p.status = 'retry'; p.retryReason = reason; p.allowedInteractions = []; }, ['active']);
  }

  retry(token) {
    return this.commit(token, p => {
      p.attemptId = crypto.randomUUID(); p.encounterId = null; p.outcome = null;
      p.retryReason = null; p.status = 'active'; this.setCheckpoint(p, p.checkpointId);
    }, ['retry']);
  }

  reconcile(token) {
    if (!this.authorized(token)) return { ok: false, reason: 'stale_authority' };
    const p = this.progress;
    const outcome = this.state.gameplay?.outcomes.find(o => o.encounterId === p.encounterId && o.mode === p.mode);
    if (!outcome || outcome.eventId === p.outcome?.eventId) return { ok: true, unchanged: true };
    return this.commit(token, next => { next.outcome = { ...outcome }; }, ['active', 'paused', 'retry', 'skipped', 'complete']);
  }

  reconcileFacts(token) {
    if (!token?.ownerId || !this.authorized(token)) return { ok: false, reason: 'stale_authority' };
    for (const event of this.state.gameplay?.transactions ?? []) {
      // A committed transaction can outlive its originating scene and a failed tutorial
      // save. Keep the exact original attempt/checkpoint/source predicate; only the
      // transient scene-session and observation watermark are reconstructed here.
      const origin = { ...token, sceneSessionId: event.sceneSessionId, afterSequence: event.sequence - 1 };
      if (this.matchesEvidence(event, origin)) return this.complete(token.checkpointId, event, origin);
    }
    return { ok: true, unchanged: true };
  }

  // Use a scope for callbacks created by a scene. Deferred apply runs only after checking
  // ownership again; an already committed gameplay transaction is never undone here.
  scope(scene) {
    const runtime = tutorialRuntime(this.state), ownerId = crypto.randomUUID();
    scene.gameplayObserverSessionId ??= crypto.randomUUID();
    const token = Object.freeze({ ...this.capture(), ownerId, sceneSessionId: scene.gameplayObserverSessionId });
    const cleanups = new Set();
    let closed = false;
    const valid = () => !closed && scene.sys?.isActive?.() !== false && this.authorized(token);
    const dispose = () => {
      if (closed) return;
      closed = true; runtime.scopes.delete(ownerId);
      for (const cleanup of [...cleanups]) { try { cleanup(); } catch (error) { console.warn('Tutorial cleanup failed.', error); } }
      cleanups.clear();
    };
    const own = cleanup => { if (closed) cleanup(); else cleanups.add(cleanup); return cleanup; };
    const guard = callback => (...args) => valid() ? callback(...args) : { ok: false, reason: 'stale_scope' };
    const on = (emitter, name, callback) => {
      const listener = guard(callback);
      emitter.on(name, listener); own(() => emitter.off(name, listener)); return listener;
    };
    const scope = { token, valid, dispose, own, guard, on,
      defer: async (operation, apply) => { const result = await operation; return guard(apply)(result); },
      observe: callback => own(observeGameplay(guard(event => {
        if (event.sceneSessionId === token.sceneSessionId) callback(event, token);
      }))),
      timer: (delay, callback) => { const timer = scene.time.delayedCall(delay, guard(callback)); own(() => timer.remove(false)); return timer; }
    };
    runtime.scopes.set(ownerId, scope);
    for (const name of ['shutdown', 'destroy']) { scene.events.on(name, dispose); own(() => scene.events.off(name, dispose)); }
    for (const name of ['hidden', 'blur']) if (scene.game?.events) {
      scene.game.events.on(name, dispose); own(() => scene.game.events.off(name, dispose));
    }
    return scope;
  }
}
