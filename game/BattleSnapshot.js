const OMIT = Symbol('omit');
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const EVENT_KINDS = new Set(['countdown', 'pendingLandings', 'landing', 'attack', 'heal',
  'enemyAbility', 'classAbility', 'groundSlam']);

// Store only model data; Phaser objects and functions are rebuilt from game code.
export function packBattleValue(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : { battleType: 'number', value: String(value) };
  if (value instanceof Map) return { battleType: 'map', entries: [...value].map(([key, item]) => [packBattleValue(key), packBattleValue(item)]) };
  if (value instanceof Set) return { battleType: 'set', values: [...value].map(packBattleValue) };
  if (Array.isArray(value)) return value.map(item => {
    const packed = packBattleValue(item);
    return packed === OMIT ? null : packed;
  });
  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return OMIT;
  return Object.fromEntries(Object.entries(value).filter(([key]) => !UNSAFE_KEYS.has(key)).flatMap(([key, item]) => {
    const packed = packBattleValue(item);
    return packed === OMIT ? [] : [[key, packed]];
  }));
}

export function unpackBattleValue(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(unpackBattleValue);
  if (value.battleType === 'number') return value.value === '-Infinity' ? -Infinity : value.value === 'Infinity' ? Infinity : NaN;
  if (value.battleType === 'map') return new Map(value.entries.map(([key, item]) => [unpackBattleValue(key), unpackBattleValue(item)]));
  if (value.battleType === 'set') return new Set(value.values.map(unpackBattleValue));
  return Object.fromEntries(Object.entries(value).filter(([key]) => !UNSAFE_KEYS.has(key)).map(([key, item]) => [key, unpackBattleValue(item)]));
}

const SCENE_FIELDS = [
  'battleOver', 'waveTransitioning', 'waveRetreating', 'farmStopRequested', 'currentWaveIndex',
  'enemySerial', 'earnedGold', 'enemyThreat', 'lastPotionUseAt', 'selectedUnitIds', 'manualTargets',
  'attackTargets', 'healerPriorityTargets', 'heldUnitIds', 'commandMode', 'focusTargetId',
  'focusDamageTargetId', 'focusDamageUntil',
  'leaderAbilityCooldowns', 'assaultUntil', 'assaultBonus', 'braceUntil', 'braceReduction',
  'usedLeaderAbilities', 'pendingPausedTactics', 'awaitingRevive', 'combatPaused',
  'waveReturnPositions', 'waveReturnTargets', 'waveReturnReadyAt', 'waveReturnStartedAt',
  'waveReturnTimedOut', 'waveReturnProgress', 'waveReturnSettled', 'pendingWaveSpawns',
  'idlePhaseRemainingMs', 'idleSummary', 'idleSummaryResumePaused', 'combatRngState'
];

function unitSnapshot(unit) {
  const excluded = new Set(['scene', 'battlefield', 'definition', 'presentationDeferred', 'spriteVisual']);
  const model = Object.fromEntries(Object.entries(unit).filter(([key]) => !excluded.has(key)));
  if (unit.landing) model.landingVisualY = (unit.spriteVisual?.image ?? unit.body).y;
  return packBattleValue(model);
}

export function captureBattle(scene, state, savedAtMs = Date.now()) {
  return {
    version: 1, delveId: state.currentDelve.id, savedAtMs, time: scene.time.now,
    partyIds: state.activeParty.map(hero => hero.id),
    partyTemplates: packBattleValue(state.activeParty), leader: packBattleValue(state.leader),
    run: packBattleValue(state.run), rewards: packBattleValue(state.rewards), tactics: packBattleValue(state.tactics),
    scene: packBattleValue(Object.fromEntries(SCENE_FIELDS.filter(key => scene[key] !== undefined).map(key => [key, scene[key]]))),
    party: scene.partyUnits.map(unitSnapshot), enemies: scene.enemies.map(unitSnapshot),
    events: [...(scene.battleEvents ?? [])].filter(event => !event.timer.hasDispatched)
      .map(event => ({ remainingMs: Math.max(0, event.timer.getRemaining()), data: packBattleValue(event.data) })),
    traps: scene.classAbilitySystem.traps.map(trap => ({ ownerId: trap.owner.id,
      point: packBattleValue(trap.point), ability: packBattleValue(trap.ability), wave: trap.wave })),
    movement: packBattleValue(Object.fromEntries(['slots', 'rangeStates'].map(key => [key,
      [...scene.movement[key]].map(([owner, value]) => ({ ownerId: owner.id,
        state: { ...value, target: undefined, targetId: value.target.id } }))]))),
    preferences: packBattleValue(scene.tactics.preferences),
    log: packBattleValue({ ...scene.combatLog.record, entries: scene.combatLog.entries.slice(-1000) }),
    logStartedAt: scene.combatLog.startedAt
  };
}

export function validBattleSnapshot(snapshot, roster) {
  try {
    if (snapshot?.version !== 1 || typeof snapshot.delveId !== 'string'
      || !Number.isFinite(snapshot.time) || !Number.isFinite(snapshot.savedAtMs)
      || !Array.isArray(snapshot.partyIds) || snapshot.partyIds.length === 0 || snapshot.partyIds.length > 5
      || new Set(snapshot.partyIds).size !== snapshot.partyIds.length
      || !snapshot.partyIds.every(id => roster.some(hero => hero.id === id))
      || !Array.isArray(snapshot.party) || snapshot.party.length !== snapshot.partyIds.length
      || !Array.isArray(snapshot.enemies) || !Array.isArray(snapshot.events) || !Array.isArray(snapshot.traps)) return false;
    const model = unpackBattleValue(snapshot.scene);
    if (!Number.isSafeInteger(model.currentWaveIndex) || model.currentWaveIndex < -1
      || (model.currentWaveIndex === -1 && unpackBattleValue(snapshot.run)?.entry !== 'camp')) return false;
    const templates = unpackBattleValue(snapshot.partyTemplates);
    const movement = unpackBattleValue(snapshot.movement);
    const log = unpackBattleValue(snapshot.log);
    if (!Array.isArray(templates) || templates.length !== snapshot.partyIds.length
      || !templates.every((hero, index) => hero.id === snapshot.partyIds[index])
      || !Array.isArray(movement?.slots) || !Array.isArray(movement?.rangeStates)
      || !(unpackBattleValue(snapshot.preferences) instanceof Map)
      || !Array.isArray(log?.entries) || !log.summary || !unpackBattleValue(snapshot.run)) return false;
    for (const key of ['enemyThreat', 'manualTargets', 'attackTargets', 'healerPriorityTargets',
      'leaderAbilityCooldowns', 'lastPotionUseAt', 'waveReturnPositions', 'waveReturnTargets', 'waveReturnProgress']) {
      if (model[key] !== undefined && !(model[key] instanceof Map)) return false;
    }
    for (const key of ['selectedUnitIds', 'heldUnitIds', 'usedLeaderAbilities', 'waveReturnSettled']) {
      if (model[key] !== undefined && !(model[key] instanceof Set)) return false;
    }
    const units = [...snapshot.party, ...snapshot.enemies].map(unpackBattleValue);
    return new Set(units.map(unit => unit.id)).size === units.length
      && snapshot.party.every(unit => snapshot.partyIds.includes(unit.id))
      && units.every(unit => typeof unit.id === 'string' && Number.isFinite(unit.hp)
        && Number.isFinite(unit.maxHp) && unit.maxHp > 0 && unit.hp >= 0 && unit.hp <= unit.maxHp
        && Number.isFinite(unit.arenaX) && Number.isFinite(unit.arenaY) && unit.status && typeof unit.status === 'object')
      && snapshot.events.every(event => Number.isFinite(event.remainingMs) && event.remainingMs >= 0 && EVENT_KINDS.has(event.data?.kind));
  } catch {
    return false;
  }
}
