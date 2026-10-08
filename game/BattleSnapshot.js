// A battle save is a picture of the gameplay data at one moment, not a copy of Phaser
// itself. Maps, Sets and special numbers need tagged objects because JSON cannot keep
// their types. We save unit IDs instead of live object links and reconnect them in
// BattlePersistence. The version and field names are part of our save format; comments
// should not change that contract. A Symbol is a unique marker. It cannot collide with a
// real saved string like "omit", so callers can distinguish unsupported data from valid
// values.
const OMIT = Symbol('omit');

// Ignore these property names when rebuilding plain saved objects. They have special
// prototype meanings in JavaScript and are not game state fields.
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

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    return packed === OMIT ? null : packed;
  });

  if (typeof value !== 'object' || Object.getPrototypeOf(value) !== Object.prototype) return OMIT;

  // Object.fromEntries turns [key, value] pairs back into an object. A later pair with the
  // same key replaces the earlier value. flatMap builds callback results and flattens one
  // array level. Returning [] removes an entry; returning [value] keeps one result. filter
  // keeps entries whose callback returns true. It builds a new list and leaves the
  // original list in place.
  return Object.fromEntries(Object.entries(value).filter(([key]) => !UNSAFE_KEYS.has(key)).flatMap(([key, item]) => {
    const packed = packBattleValue(item);

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    return packed === OMIT ? [] : [[key, packed]];
  }));
}

// We reverse the tags made by packBattleValue and recursively rebuild children. A saved
// list of entries becomes a real Map again, and a list of unique values becomes a Set.
// Unsafe object keys are filtered on this path too, before turning user-controlled save
// data into ordinary JavaScript objects.
export function unpackBattleValue(value) {
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.map(unpackBattleValue);
  if (value.battleType === 'number') return value.value === '-Infinity' ? -Infinity : value.value === 'Infinity' ? Infinity : NaN;

  if (value.battleType === 'map') return new Map(value.entries.map(([key, item]) => [unpackBattleValue(key), unpackBattleValue(item)]));
  if (value.battleType === 'set') return new Set(value.values.map(unpackBattleValue));

  // Object.fromEntries turns [key, value] pairs back into an object. A later pair with the
  // same key replaces the earlier value. map builds one output entry for each input entry,
  // in the same order. The callback's return value becomes that output entry. filter keeps
  // entries whose callback returns true. It builds a new list and leaves the original list
  // in place.
  return Object.fromEntries(Object.entries(value).filter(([key]) => !UNSAFE_KEYS.has(key)).map(([key, item]) => [key, unpackBattleValue(item)]));
}

// This allowlist is the battle scene data we can restore. Display objects, scene
// references and callbacks are deliberately absent. Add durable model fields here when
// their state must survive leaving or reloading the app.
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

// Extract one unit's durable state while excluding live scene and graphics references.
// unit is the live combatant, with current resources and arena position.
function unitSnapshot(unit) {

  // A unit points back to its scene and display objects, which cannot be saved as model
  // data and can contain circular references. Exclude those fields and rebuild their
  // presentation from the unit's durable state later.
  const excluded = new Set(['scene', 'battlefield', 'definition', 'presentationDeferred', 'spriteVisual']);

  // Object.fromEntries turns [key, value] pairs back into an object. A later pair with the
  // same key replaces the earlier value. filter keeps entries whose callback returns true.
  // It builds a new list and leaves the original list in place. Object.entries turns own
  // fields into [key, value] pairs so we can visit or transform them.
  const model = Object.fromEntries(Object.entries(unit).filter(([key]) => !excluded.has(key)));
  if (unit.landing) model.landingVisualY = (unit.spriteVisual?.image ?? unit.body).y;
  return packBattleValue(model);
}

// Capture the scene, units, remaining events and stable object links in the versioned save
// format. scene is the Phaser screen that owns the objects, clock and input used here.
// state is the game data to read or change; a default can point at shared GameState.
export function captureBattle(scene, state, savedAtMs = Date.now()) {

  // map builds one output entry for each input entry, in the same order. The callback's
  // return value becomes that output entry. Object.fromEntries turns [key, value] pairs
  // back into an object. A later pair with the same key replaces the earlier value. filter
  // keeps entries whose callback returns true. It builds a new list and leaves the
  // original list in place.
  return {
    version: 1, delveId: state.currentDelve.id, savedAtMs, time: scene.time.now,
    partyIds: state.activeParty.map(hero => hero.id),
    partyTemplates: packBattleValue(state.activeParty), leader: packBattleValue(state.leader),
    run: packBattleValue(state.run), rewards: packBattleValue(state.rewards), tactics: packBattleValue(state.tactics),
    scene: packBattleValue(Object.fromEntries(SCENE_FIELDS.filter(key => scene[key] !== undefined).map(key => [key, scene[key]]))),
    party: scene.partyUnits.map(unitSnapshot), enemies: scene.enemies.map(unitSnapshot),

    // Keep only uncompleted events and save their remaining delay plus typed event data. A
    // reload creates fresh timers on the restored gameplay clock rather than trying to
    // serialize a JavaScript callback.
    events: [...(scene.battleEvents ?? [])].filter(event => !event.timer.hasDispatched)
      .map(event => ({ remainingMs: Math.max(0, event.timer.getRemaining()), data: packBattleValue(event.data) })),

    traps: scene.classAbilitySystem.traps.map(trap => ({ ownerId: trap.owner.id,
      point: packBattleValue(trap.point), ability: packBattleValue(trap.ability), wave: trap.wave })),

    // Movement Maps use live units as keys and targets. Save those links as
    // ownerId/targetId instead, then reconnect them after every unit is rebuilt.
    movement: packBattleValue(Object.fromEntries(['slots', 'rangeStates'].map(key => [key,
      [...scene.movement[key]].map(([owner, value]) => ({ ownerId: owner.id,
        state: { ...value, target: undefined, targetId: value.target.id } }))]))),
    preferences: packBattleValue(scene.tactics.preferences),
    log: packBattleValue({ ...scene.combatLog.record, entries: scene.combatLog.entries.slice(-1000) }),
    logStartedAt: scene.combatLog.startedAt
  };
}

// Reject unsupported or inconsistent saved battles before attempting to reconnect live
// units and timers.
export function validBattleSnapshot(snapshot, roster) {
  try {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined. A Set keeps each value once. has checks membership without searching a
    // list for duplicate entries. every requires all entries to pass the check; an empty
    // list gives true.
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

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry. ... expands these entries into the new list
    // or call. It does not deep-copy the objects inside.
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
