import { isMageClass } from '../config/characterProgression.js';
import GameState from './GameState.js';
import { newGameplayState, reconcileTutorialOutcome, tutorialEvidenceContext } from './TutorialProgress.js';

const listeners = new Set();
let deliveryScheduled = false;
let deliveries = [];
export const PLAYER_SOURCE = Object.freeze({ kind: 'player', actorId: 'party_leader' });
export const SYSTEM_SOURCE = Object.freeze({ kind: 'system' });

// Subscribers receive plain immutable facts. A failed observer cannot stop gameplay.
// Delivery waits for the current gameplay transaction to finish. Only outcome and
// checkpoint evidence is durable; no event history is retained without a subscriber.
export function observeGameplay(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function gameplayId(kind) {
  const state = GameState.gameplay ??= newGameplayState();
  return state.epoch + ':' + kind + ':' + (++state.serial);
}

export function beginGameplayEncounter(scene) {
  scene.gameplayObserverSessionId = crypto.randomUUID();
  scene.gameplayContext = { encounterId: gameplayId('encounter'), mode: 'campaign', waveSerial: 0 };
}

function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

export function emitGameplay(scene, type, details = {}, source = SYSTEM_SOURCE) {
  if (!scene.gameplayContext) beginGameplayEncounter(scene);
  const context = scene.gameplayContext;
  const event = freeze(structuredClone({ version: 1, type, ...details, source,
    sceneSessionId: scene.gameplayObserverSessionId,
    tutorial: Object.hasOwn(details, 'tutorial') ? details.tutorial : tutorialEvidenceContext(GameState),
    eventId: gameplayId('event'), profileEpoch: GameState.gameplay.epoch,
    encounterId: context.encounterId, mode: context.mode,
    waveId: context.encounterId + ':wave:' + context.waveSerial,
    waveIndex: scene.currentWaveIndex, combatTimeMs: scene.time?.now ?? 0,
    sequence: GameState.gameplay.serial }));
  if (listeners.size) {
    deliveries.push({ event, recipients: [...listeners] });
    if (!deliveryScheduled) {
      deliveryScheduled = true;
      queueMicrotask(() => {
        const batch = deliveries;
        deliveries = []; deliveryScheduled = false;
        for (const { event, recipients } of batch) for (const listener of recipients) if (listeners.has(listener)) {
          try { listener(event); } catch (error) { console.warn('Gameplay observer failed.', error); }
        }
      });
    }
  }
  return event;
}

export function requestOrder(scene, command, units = [], details = {}) {
  if (scene.executingGameplayOrder) return scene.executingGameplayOrder;
  const order = { commandId: gameplayId('command'), command, subjectIds: units.map(u => u.id), tutorial: tutorialEvidenceContext(GameState), ...details };
  emitGameplay(scene, 'combat.order.requested', order, PLAYER_SOURCE);
  return order;
}

export function rejectOrder(scene, order, reason, recipients = {}) {
  emitGameplay(scene, 'combat.order.rejected', { ...order, reason, affectedRecipientIds: [], affectedTargetIds: [], outcome: 'rejected', ...recipients }, PLAYER_SOURCE);
  return false;
}

export function acceptOrder(scene, order, queued = false, recipients = {}) {
  if (!scene.executingGameplayOrder) emitGameplay(scene, 'combat.order.accepted', { ...order, queued, ...recipients }, PLAYER_SOURCE);
}

export function executeOrder(scene, order, unit, details = {}) {
  const { reportExecution = true, ...reported } = details;
  const previous = unit.leaderCommand;
  if (!details.preserveMovement && unit.manualMovement && !unit.manualMovement.arrived) emitGameplay(scene, 'combat.movement.superseded',
    { actorId: unit.id, ...unit.manualMovement, reason: 'new_order' }, PLAYER_SOURCE);
  if (!details.preserveMovement) unit.manualMovement = null;
  if (previous && previous.commandId !== order.commandId && !details.preserveMovement)
    emitGameplay(scene, 'combat.order.cancelled', { ...previous, subjectIds: [unit.id], reason: 'superseded' }, PLAYER_SOURCE);
  unit.leaderCommand = { ...order };
  if (reportExecution) emitGameplay(scene, 'combat.order.executed', { ...order, subjectIds: [unit.id], phase: 'assignment', ...reported }, PLAYER_SOURCE);
}

export function cancelOrder(scene, order, reason, subjectIds = order?.subjectIds ?? []) {
  if (!order) return;
  emitGameplay(scene, 'combat.order.cancelled', { ...order, subjectIds, reason, affectedRecipientIds: [], affectedTargetIds: [], outcome: 'cancelled' }, PLAYER_SOURCE);
}

export function finishGameplayEncounter(scene, outcome) {
  const context = scene.gameplayContext;
  if (context?.outcome) return;
  const event = emitGameplay(scene, 'combat.encounter.finished', { outcome });
  scene.gameplayContext.outcome = { eventId: event.eventId, encounterId: event.encounterId, mode: event.mode, outcome };
  const state = GameState.gameplay;
  state.outcomes = [...state.outcomes.filter(o => o.encounterId !== event.encounterId), scene.gameplayContext.outcome].slice(-16);
  reconcileTutorialOutcome(GameState);
}

export function castStarted(unit, action, target, ability) {
  action.castId = gameplayId('cast');
  action.tutorial = tutorialEvidenceContext(GameState);
  action.gameplaySource = { kind: 'ai', actorId: unit.id };
  action.commandId = unit.leaderCommand && target && unit.leaderCommand.targetId === target.id
    ? unit.leaderCommand.commandId : null;
  emitGameplay(unit.scene, 'combat.cast.started', { actorId: unit.id, targetId: target?.id ?? null,
    castId: action.castId, tutorial: action.tutorial, commandId: action.commandId, name: action.name, abilityId: ability?.id ?? null,
    isBoss: !!unit.isBoss, durationMs: action.duration }, action.gameplaySource);
}

export function castFinished(unit, action, outcome, reason, cause) {
  if (!action?.castId) return;
  const terminal = outcome === 'resolved' ? 'resolved' : outcome === 'interrupted' ? 'interrupted' : 'cancelled';
  emitGameplay(unit.scene, 'combat.cast.' + terminal, { actorId: unit.id, castId: action.castId,
    tutorial: action.tutorial, commandId: action.commandId, isBoss: !!unit.isBoss, name: action.name, reason,
    cause: cause ?? null }, action.gameplaySource);
}

// Capture the real warning and candidate positions once, before anyone moves.
export function warningStarted(scene, warning) {
  const action = warning.action;
  if (!action || action.warningEvidence) return;
  const inside = unit => unit.distanceToPoint(warning.arenaX, warning.arenaY) <= warning.radius;
  action.warningEvidence = { castId: action.castId, tutorial: action.tutorial ?? null,
    geometry: { shape: 'circle', x: warning.arenaX, y: warning.arenaY, radius: warning.radius },
    candidates: scene.partyUnits.filter(u => u.alive && inside(u)).map(u => ({ actorId: u.id,
      movementSerial: u.manualMovementSerial ?? 0 })) };
  emitGameplay(scene, 'combat.mechanic.warning', { actorId: warning.attacker.id, ...action.warningEvidence });
}

export function warningResolved(scene, action) {
  const evidence = action.warningEvidence;
  if (!evidence) return;
  const { geometry } = evidence;
  const avoidedIds = [], manualAvoidance = [];
  const affectedIds = scene.partyUnits.filter(u => u.alive
    && u.distanceToPoint(geometry.x, geometry.y) <= geometry.radius).map(u => u.id);
  for (const candidate of evidence.candidates) {
    const unit = scene.partyUnits.find(u => u.id === candidate.actorId);
    if (!unit?.alive) continue;
    if (unit.distanceToPoint(geometry.x, geometry.y) <= geometry.radius) continue;
    avoidedIds.push(unit.id);
    // Credit only a player movement that actually crossed this captured area boundary.
    const escape = unit.manualWarningEscapes?.[action.castId];
    if (escape?.serial > candidate.movementSerial) manualAvoidance.push({ actorId: unit.id, commandId: escape.commandId, tutorial: escape.tutorial });
  }
  emitGameplay(scene, 'combat.mechanic.resolved', { castId: action.castId, geometry, affectedIds, avoidedIds, manualAvoidance });
}

export function assignMovement(scene, unit, point, order) {
  unit.manualMovement = { commandId: order.commandId, destination: { x: point.x, y: point.y },
    tutorial: order.tutorial, started: false, arrived: false, blocked: false };
  emitGameplay(scene, 'combat.movement.assigned', { actorId: unit.id, ...unit.manualMovement }, PLAYER_SOURCE);
}

// These tactics choose whole role groups independently of current UI selection. Planning
// records intended recipients; execution re-reads the same production role predicates.
export function targetedTacticUnits(scene, command) {
  return scene.partyUnits.filter(unit => command === 'COORDINATED_ATTACK'
    ? unit.alive && unit.role === 'Melee DPS' : command === 'LUNAR_ASSAULT'
      ? unit.alive && isMageClass(unit.className) : false);
}

export function tacticRecipients(order, units) {
  const validRecipientIds = units.map(unit => unit.id);
  return { intendedRecipientIds: order.intendedRecipientIds ?? validRecipientIds,
    validRecipientIds, subjectIds: validRecipientIds };
}
