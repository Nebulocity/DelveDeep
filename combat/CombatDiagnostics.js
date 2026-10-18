import { storageWarning } from './DiagnosticStorage.js';

// Diagnostic state belongs to CombatLog, never to combatants or AI evaluations.
const SETTINGS_KEY = 'delveDeep.combatDiagnostics.v2';
let diagnosticRuntimeSerial = 0;
export const DIAGNOSTIC_LEVELS = ['Normal', 'Detailed', 'AI Debug'];
export function diagnosticSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? '{}');
    return { level: DIAGNOSTIC_LEVELS.includes(saved.level) ? saved.level : 'Normal',
      inactivityMs: Math.max(500, Number(saved.inactivityMs) || 2000), repeatMs: 10000 };
  } catch { return { level: 'Normal', inactivityMs: 2000, repeatMs: 10000 }; }
}
export function setDiagnosticSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...diagnosticSettings(), ...settings }));
  } catch {
    storageWarning('diagnostic-settings-failed', 'Diagnostic settings could not be saved. Export and clean up legacy combat logs in Settings to free space. Player saves and settings were not deleted.');
  }
}

const identity = unit => unit ? { id: unit.id ?? null, name: unit.name ?? null } : null;
const position = unit => ({ x: unit.arenaX, y: unit.arenaY });
const snapshot = (unit, now) => unit ? { ...identity(unit), hp: unit.hp, maxHp: unit.maxHp,
  mana: unit.mana, maxMana: unit.maxMana, position: position(unit), alive: unit.alive,
  stealthed: unit.stealthed, statuses: Object.fromEntries(Object.entries(unit.status ?? {})
    .filter(([key, value]) => /Until$/.test(key) && typeof value === 'number' && value > now)) } : null;

export default class CombatDiagnostics {
  constructor(log, scene) {
    this.log = log;
    this.effectRunId = `${Date.now()}-${++diagnosticRuntimeSerial}`;
    this.scene = scene;
    this.settings = diagnosticSettings();
    this.enabled = this.settings.level !== 'Normal';
    this.ai = this.settings.level === 'AI Debug';
    this.context = null;
    this.idle = new Map();
    this.decisions = new Map();
    this.rejections = new Map();
    this.recoils = new Map();
    this.effects = new WeakMap();
    this.nextIdleAt = 0;
    this.uninstall = [];
    if (this.enabled) this.installCauses();
  }

  now() { return this.scene.time.now; }
  units() { return [...(this.scene.partyUnits ?? []), ...(this.scene.enemies ?? []), ...(this.scene.abilityDecoys ?? [])]; }
  state() {
    return this.log.record.diagnostics ??= { level: this.settings.level, active: {},
      totals: { actors: {}, abilities: {}, commands: 0, interruptAttempts: 0, successfulInterrupts: 0 },
      waves: [], bossActions: [], droppedBossActions: 0, droppedWaveSummaries: 0 };
  }
  emit(type, fields = {}, message = type) {
    if (!this.enabled || this.scene.restoringBattle) return null;
    return this.log.add(type, message, { diagnostic: true, wave: this.scene.currentWaveIndex + 1,
      combatTimeMs: this.now(), ...fields });
  }
  actionId(unit, action = unit?.pendingAction) {
    if (!action || !unit) return null;
    return `${this.log.record.startedAt}/${unit.id}/${action.startAt}/${action.id}`;
  }
  cause(actor, ability, extra = {}) {
    const name = typeof ability === 'string' ? ability : ability?.name;
    const matching = actor?.pendingAction?.name === name;
    const inherited = !!this.context && this.context.actorId === actor?.id && this.context.ability === name;
    const active = matching ? this.state().active[this.actionId(actor)] : null;
    return { actorId: actor?.id ?? null, actor: actor?.name ?? null,
      abilityId: typeof ability === 'object' ? ability?.id ?? null : inherited ? this.context.abilityId : active?.abilityId ?? null, ability: name ?? null,
      sourceActionId: inherited ? this.context.sourceActionId : matching ? this.actionId(actor) : null,
      effectId: inherited ? this.context.effectId ?? null : null,
      ...extra };
  }
  withCause(cause, callback) {
    const previous = this.context;
    this.context = cause;
    try { return callback(); } finally { this.context = previous; }
  }
  wrap(object, name, getCause) {
    if (typeof object?.[name] !== 'function') return;
    const original = object[name], diagnostics = this;
    const wrapped = function (...args) {
      return diagnostics.withCause(getCause(...args), () => original.apply(this, args));
    };
    object[name] = wrapped;
    this.uninstall.push(() => { if (object[name] === wrapped) object[name] = original; });
  }
  installCauses() {
    const scene = this.scene, system = scene.classAbilitySystem;
    this.wrap(scene, 'resolveDamage', (actor, target, amount, type, threat, ability) => this.cause(actor, ability));
    this.wrap(scene, 'resolveHeal', (actor, target, amount, ability) => this.cause(actor, ability));
    this.wrap(scene, 'applyTankTaunt', (actor, targets, key, time, commit, ability) => this.cause(actor, ability ?? actor.abilities[key]));
    this.wrap(scene, 'resolveGroundSlam', (actor, action, center, ability) => this.cause(actor, ability));
    this.wrap(system, 'resolve', (actor, target, ability) => this.cause(actor, ability));
    this.wrap(system?.replacement, 'resolve', (actor, target, ability) => this.cause(actor, ability));
    this.wrap(system?.replacement, 'damage', (actor, target, amount, ability) => this.cause(actor, ability));
    this.wrap(system?.replacement, 'heal', (actor, target, amount, ability) => this.cause(actor, ability));
  }

  start(unit, target, ability) {
    if (!this.enabled || this.scene.restoringBattle) return;
    const action = unit.pendingAction;
    const actionId = this.actionId(unit, action);
    const record = { actionId, actorId: unit.id, actor: unit.name, targetId: target?.id ?? null,
      target: target?.name ?? null, abilityId: ability?.id ?? null, ability: action.name,
      boss: unit.isBoss, castStartAt: action.startAt, scheduledCompletionAt: action.startAt + action.duration,
      stateBefore: 'idle', stateAfter: 'pending', actorState: snapshot(unit, this.now()),
      targetState: snapshot(target, this.now()), wave: this.scene.currentWaveIndex + 1,
      observedDamage: 0, observedHealing: 0, recipients: [],
      ...(ability?.handler === 'intervene' ? { mode: ability.interveneMode } : {}) };
    this.state().active[actionId] = record;
    this.emit('action_started', record);
    if (this.ai) {
      const decision = this.decisions.get(unit.id);
      this.emit('ai_decision', { actionId, actorId: unit.id, actor: unit.name, role: unit.role,
        targetId: target?.id ?? null, targetReason: unit.currentTargetReason ?? 'selected by ability targeting',
        ability: action.name, abilityId: ability?.id ?? null, hp: unit.hp, mana: unit.mana,
        command: this.commandState(unit), rejections: [...(this.rejections.get(unit.id)?.values() ?? [])]
          .filter(item => item.at === this.now()).slice(0, 3), ...(decision?.at === this.now() ? decision.data : {
          score: null, scoreAvailability: 'no comparable score available', selection: unit.isEnemy ? 'authored slot priority' : 'legacy or basic selection' }) });
    }
    this.idle.set(unit.id, { lastAction: this.now(), sampledAt: this.now(), position: position(unit), lastReport: -Infinity });
  }
  end(unit, outcome = 'cancelled', reasonCode = 'unknown', explanation = 'Unclassified action release', extra = {}) {
    if (!this.enabled || !unit.pendingAction || this.scene.restoringBattle) return;
    const actionId = this.actionId(unit), state = this.state();
    const active = state.active[actionId];
    const action = unit.pendingAction;
    const record = { ...(active ?? { actionId, actorId: unit.id, actor: unit.name, ability: action.name,
      castStartAt: action.startAt, scheduledCompletionAt: action.startAt + action.duration,
      startObservation: 'not captured in this diagnostic record', boss: unit.isBoss }),
      stateBefore: 'pending', stateAfter: outcome, actualTerminalAt: this.now(), reasonCode, explanation,
      cause: this.context, actorState: snapshot(unit, this.now()), ...extra };
    const rush = action.intervene;
    if (rush) {
      record.mode = rush.mode;
      record.intervene = { distanceTravelled: rush.travelled, neverLeftOrigin: !(rush.travelled > 1),
        destination: rush.point, waypoints: rush.waypoints, replans: rush.replans,
        failure: rush.failure ?? (outcome === 'resolved' ? null : { reason: reasonCode }) };
      const modes = state.totals.intervene ??= {};
      const metrics = modes[rush.mode] ??= { attempted: 0, travelled: 0, completed: 0, neverLeftOrigin: 0, braced: 0 };
      if (!(rush.travelled > 1)) metrics.neverLeftOrigin++;
      if (outcome === 'resolved') { metrics.completed++; if (!(rush.travelled > 1)) metrics.braced++; }
    }
    record.targetState = snapshot(this.units().find(target => target.id === record.targetId), this.now());
    record.commandedTargetId = this.scene.attackTargets?.get(unit.id) ?? this.scene.focusTargetId ?? null;
    record.commandedTargetAffected = record.commandedTargetId ? record.recipients?.includes(record.commandedTargetId) ?? false : null;
    record.noObservedDamageOrHealing = outcome === 'resolved' && !(record.observedDamage || record.observedHealing);
    this.emit(`action_${outcome}`, record);
    const key = `${unit.id}:${record.abilityId ?? record.ability}`;
    const stats = state.totals.abilities[key] ??= { actorId: unit.id, actor: unit.name,
      abilityId: record.abilityId, ability: record.ability, boss: unit.isBoss, attempts: 0,
      resolved: 0, cancelled: 0, interrupted: 0, failed: 0, expired: 0, reasons: {} };
    stats[outcome] = (stats[outcome] ?? 0) + 1;
    stats.reasons[reasonCode] = (stats.reasons[reasonCode] ?? 0) + 1;
    if (unit.isBoss) {
      state.bossActions.push(record);
      if (state.bossActions.length > 500) { state.bossActions.shift(); state.droppedBossActions++; }
    }
    delete state.active[actionId];
  }
  control(target, ability, kind, applied, reason, duration = 0, source = null) {
    if (!this.enabled) return null;
    const cause = source ? this.cause(source, ability) : this.context?.ability === ability?.name ? this.context
      : { actorId: null, actor: null, abilityId: ability?.id ?? null, ability: ability?.name ?? null, sourceActionId: null };
    const cancels = applied && ['stun', 'explicit_interrupt', 'taunt', 'truce'].includes(kind) && !!target?.pendingAction;
    if (kind === 'explicit_interrupt') {
      this.state().totals.interruptAttempts++;
      if (cancels) this.state().totals.successfulInterrupts++;
    }
    const event = this.emit('control_effect', { cause, targetId: target?.id ?? null, target: target?.name ?? null,
      affectedActionId: this.actionId(target), effect: kind, attempted: true, applied, reasonCode: reason,
      durationMs: duration, cancelsAction: cancels,
      cancellationMechanism: cancels ? kind === 'taunt' ? 'forced_target_action_release' : 'finishAction' : null,
      targetState: snapshot(target, this.now()) });
    return { ...cause, effect: kind, eventSequence: event?.sequence ?? null };
  }
  decision(unit, data) { if (this.ai) this.decisions.set(unit.id, { at: this.now(), data }); }
  reject(unit, ability, reasonCode) {
    if (!this.ai || !ability) return;
    if (!this.rejections.has(unit.id)) this.rejections.set(unit.id, new Map());
    this.rejections.get(unit.id).set(ability.id ?? ability.name, { abilityId: ability.id ?? null,
      ability: ability.name, reasonCode, at: this.now() });
  }
  commandState(unit) {
    return { hold: this.scene.heldUnitIds?.has(unit.id) ?? false,
      move: this.scene.manualTargets?.get(unit.id) ?? null, attackTargetId: this.scene.attackTargets?.get(unit.id) ?? null };
  }
  command(command, units, target = null) {
    if (!this.enabled) return;
    this.state().totals.commands++;
    this.emit('leader_command', { command, actorId: 'party_leader', units: units.map(identity), target: identity(target) });
  }
  observe(entry) {
    if (!this.enabled) return;
    const state = this.state();
    if (entry.type === 'action_started') {
      const key = `${entry.actorId}:${entry.abilityId ?? entry.ability}`;
      const stats = state.totals.abilities[key] ??= { actorId: entry.actorId, actor: entry.actor,
        abilityId: entry.abilityId, ability: entry.ability, boss: entry.boss, attempts: 0,
        resolved: 0, cancelled: 0, interrupted: 0, failed: 0, expired: 0, reasons: {} };
      stats.attempts++;
    }
    if (entry.abilityId === 'ability_v2_generic_physical_intervene' && entry.mode
      && (entry.type === 'action_started' || entry.stateAfter === 'intervene_movement_started')) {
      const modes = state.totals.intervene ??= {};
      const metrics = modes[entry.mode] ??= { attempted: 0, travelled: 0, completed: 0, neverLeftOrigin: 0, braced: 0 };
      if (entry.type === 'action_started') metrics.attempted++;
      else metrics.travelled++;
    }
    const actorStats = (id, name) => state.totals.actors[id] ??= { id, name, damageDealt: 0, damageTaken: 0,
      effectiveHealing: 0, overhealing: 0, deaths: 0, revives: 0 };
    if (entry.type === 'damage') {
      if (entry.actorId) actorStats(entry.actorId, entry.actor).damageDealt += entry.amount;
      if (entry.targetId) actorStats(entry.targetId, entry.target).damageTaken += entry.amount;
    }
    if (entry.type === 'healing' && entry.actorId) {
      const stats = actorStats(entry.actorId, entry.actor);
      stats.effectiveHealing += entry.amount;
      stats.overhealing += entry.overhealing ?? 0;
    }
    if (entry.type === 'death' && entry.targetId) {
      const stats = actorStats(entry.targetId, entry.target);
      stats.deaths++;
      stats.incapacitatedAt = this.now();
    }
    if (entry.type === 'revive' && entry.actorId) {
      const stats = actorStats(entry.actorId, entry.actor);
      stats.revives++;
      if (stats.incapacitatedAt != null) stats.incapacitatedMs = (stats.incapacitatedMs ?? 0) + this.now() - stats.incapacitatedAt;
      stats.incapacitatedAt = null;
    }
    const active = state.active[entry.sourceActionId];
    if (active && ['damage', 'healing'].includes(entry.type)) {
      active[entry.type === 'damage' ? 'observedDamage' : 'observedHealing'] += entry.amount;
      if (!active.recipients.includes(entry.targetId)) active.recipients.push(entry.targetId);
    }
  }
  effectApplied(record, actor, ability, kind, target = null) {
    if (!this.enabled || !record) return;
    const state = this.state();
    state.effectSerial = (state.effectSerial ?? 0) + 1;
    const cause = this.cause(actor, ability);
    const meta = { ...cause, effectId: `${this.log.record.startedAt}/effect/${this.effectRunId}/${state.effectSerial}` };
    this.effects.set(record, meta);
    this.emit('effect_applied', { ...meta, effect: kind, targetId: target?.id ?? null,
      until: record.until, position: record.point ?? null });
    return meta;
  }
  effectEvent(type, record, fields = {}) {
    if (!this.enabled) return;
    return this.emit(type, { ...(this.effects.get(record) ?? { effectId: null, sourceActionId: null,
      correlation: 'application not observed (possibly restored)' }), ability: record?.ability?.name, ...fields });
  }
  effectCause(record, actor, callback) {
    if (!this.enabled) return callback();
    return this.withCause({ ...this.cause(actor, record.ability), sourceActionId: null,
      ...this.effects.get(record) }, callback);
  }
  recoilStart(unit, attacker) {
    if (!this.enabled) return;
    this.recoils.set(unit.id, { from: position(unit), affectedActionId: this.actionId(unit),
      cause: this.context, at: this.now() });
    this.emit('knockback_started', { targetId: unit.id, actorId: attacker?.id, cause: this.context,
      attempted: true, affectedActionId: this.actionId(unit), cancelsAction: false, from: position(unit) });
  }
  recoilEnd(unit) {
    if (!this.enabled) return;
    const saved = this.recoils.get(unit.id);
    if (!saved) return;
    const distance = Math.hypot(unit.arenaX - saved.from.x, unit.arenaY - saved.from.y);
    this.emit('knockback_finished', { ...saved, targetId: unit.id, to: position(unit), distance,
      displaced: distance > 0, currentActionId: this.actionId(unit), cancelsAction: false });
    this.recoils.delete(unit.id);
  }
  sample() {
    if (!this.ai || this.now() < this.nextIdleAt) return;
    this.nextIdleAt = this.now() + 500;
    for (const unit of this.units()) {
      if (!unit.alive) continue;
      let state = this.idle.get(unit.id);
      if (!state) { state = { lastAction: this.now(), sampledAt: this.now(), position: position(unit), lastReport: -Infinity }; this.idle.set(unit.id, state); }
      const moving = Math.hypot(unit.arenaX - state.position.x, unit.arenaY - state.position.y) > 1;
      const command = this.commandState(unit), status = unit.status ?? {};
      const reason = unit.pendingAction ? 'pending_action' : status.replacementChannel?.until > this.now() ? 'channel'
        : status.stunnedUntil > this.now() ? 'stun' : unit.criticalKnockback ? 'knockback'
        : command.hold ? 'leader_hold' : command.move ? 'leader_move' : moving ? 'moving'
        : unit.stealthed ? 'stealthed_no_action_observed' : 'no_action_observed';
      const inactivityMs = this.now() - state.lastAction;
      if (inactivityMs >= this.settings.inactivityMs && (reason !== state.reason || this.now() - state.lastReport >= this.settings.repeatMs)) {
        this.emit('inactivity', { actorId: unit.id, actor: unit.name, inactivityMs, reasonCode: reason,
          reasonIsStateObservation: true, moving, command, actorState: snapshot(unit, this.now()),
          pendingActionId: this.actionId(unit), busyUntil: unit.busyUntil,
          lastAttackAt: Number.isFinite(unit.lastAttackAt) ? unit.lastAttackAt : null,
          lastAbilityAt: { ...unit.lastAbilityAt },
          rejectionObservations: [...(this.rejections.get(unit.id)?.values() ?? [])].slice(0, 3),
          lastDecision: this.decisions.get(unit.id)?.data ?? null });
        state.lastReport = this.now(); state.reason = reason;
      }
      state.position = position(unit); state.sampledAt = this.now();
    }
  }
  waveStart() {
    if (!this.enabled) return;
    this.idle.clear();
    this.decisions.clear();
    this.rejections.clear();
    const state = this.state();
    state.waveStart = { wave: this.scene.currentWaveIndex + 1, at: this.now(),
      resources: (this.scene.partyUnits ?? []).map(unit => snapshot(unit, this.now())),
      totals: JSON.parse(JSON.stringify(state.totals)) };
  }
  summary(outcome, encounter = false) {
    if (!this.enabled) return;
    const state = this.state(), start = state.waveStart;
    const summary = { outcome, durationMs: this.now() - (encounter ? this.log.record.simulationStartedAt : start?.at ?? this.now()),
      scope: encounter ? 'encounter' : 'wave', totals: JSON.parse(JSON.stringify(state.totals)),
      waveStartTotals: encounter ? undefined : start?.totals,
      resourcesAtStart: encounter ? undefined : start?.resources,
      resourcesAtEnd: (this.scene.partyUnits ?? []).map(unit => snapshot(unit, this.now())) };
    this.emit(encounter ? 'encounter_diagnostics' : 'wave_diagnostics', summary);
    if (!encounter) {
      state.waves.push({ wave: this.scene.currentWaveIndex + 1, ...summary });
      if (state.waves.length > 50) { state.waves.shift(); state.droppedWaveSummaries++; }
    }
  }
  close(reason = 'encounter_end') {
    if (!this.enabled) return;
    for (const unit of this.units()) if (unit.pendingAction) this.end(unit, 'cancelled', 'state_invalidated',
      'Pending work abandoned at encounter shutdown', { shutdownReason: reason });
    // Removed units can leave recorded pending work even when they are no longer in the scene.
    for (const record of Object.values(this.state().active)) {
      this.emit('action_cancelled', { ...record, stateBefore: 'pending', stateAfter: 'cancelled',
        reasonCode: 'state_invalidated', explanation: 'Actor no longer present at encounter shutdown',
        actualTerminalAt: this.now(), shutdownReason: reason });
      delete this.state().active[record.actionId];
    }
    this.summary(reason, true);
  }
  dispose() { for (const restore of this.uninstall) restore(); }
}
