// This rebuilds a battle from BattleSnapshot data. Units must exist before we reconnect
// their targets, threat tables and movement records. Saved timer descriptions become new
// Phaser timers; old callbacks and display objects cannot be revived from JSON. Restore
// order matters.

import GameState from '../game/GameState.js';
import { captureBattle, unpackBattleValue } from '../game/BattleSnapshot.js';
import { saveProfile, setBattleSaveProvider } from '../game/GameStorage.js';

// Attach the scene's snapshot provider and lifecycle save hooks, then remove them on
// shutdown. scene is the Phaser screen that owns the objects, clock and input used here.
export function installBattlePersistence(scene) {
  let lastSavedAt = 0;
  let lastPhase = '';
  const provider = () => {
    const progress = scene.game.backgroundProgress;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const savedAtMs = progress ? progress.lastWallTime - progress.pendingMs : Date.now();
    return captureBattle(scene, GameState, savedAtMs);
  };

  setBattleSaveProvider(provider, () => scene.game.backgroundProgress?.isReplaying === true);
  const checkpoint = () => {
    const phase = [scene.currentWaveIndex, GameState.run.entry, scene.battleOver,
      scene.waveRetreating, scene.waveTransitioning, scene.combatPaused, scene.awaitingRevive,
      scene.farmStopRequested].join(':');

    if (phase !== lastPhase || Date.now() - lastSavedAt >= 2000) {
      lastPhase = phase;
      lastSavedAt = Date.now();
      saveProfile();
    }
  };

  const save = () => saveProfile();

  // on registers a callback for later events; it does not call that callback now.
  // Long-lived emitters need matching listener cleanup.
  scene.events.on('postupdate', checkpoint);
  scene.input.on('pointerup', save);
  const pageEvents = ['visibilitychange', 'freeze', 'resume'];
  const windowEvents = ['pagehide', 'pageshow', 'delveAppState'];
  pageEvents.forEach(event => document.addEventListener(event, save));
  windowEvents.forEach(event => window.addEventListener(event, save));

  // once registers a callback that removes itself after the first matching event.
  scene.events.once('shutdown', () => {
    scene.events.off('postupdate', checkpoint);
    scene.input.off('pointerup', save);
    pageEvents.forEach(event => document.removeEventListener(event, save));
    windowEvents.forEach(event => window.removeEventListener(event, save));
    setBattleSaveProvider(null);
    GameState.activeBattle = null;
    saveProfile();
  });

  checkpoint();
}

// Create a live combatant, then restore its saved resources, statuses and gameplay
// position. unit is the live combatant, with current resources and arena position.
function restoreUnit(unit, saved) {
  const model = unpackBattleValue(saved);
  delete model.spriteVisual;
  delete model.presentationDeferred;

  // Object.assign writes these fields into its first argument. Later sources replace
  // earlier fields; nested values are not deep-copied.
  Object.assign(unit, model);
  unit.syncPresentation();
  unit.setStealthed(unit.stealthed);
  unit.updateHealthBar();
  unit.setTargetName(unit.targetName);

  if (unit.pendingAction) {

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    unit.actionLabel.setText(unit.pendingAction.name === 'Attack' ? '' : unit.pendingAction.name);
    unit.castBack.setVisible(true);
    unit.castFill.setVisible(true);
    unit.updateActionBar(unit.scene.time.now);
  }

  if (!unit.alive) {
    const elapsed = unit.deathElapsed;
    unit.defeat();
    if (unit.isEnemy) {
      unit.deathElapsed = elapsed;
      unit.updateDeathPresentation(0);
    }
  } else if (unit.isEnemy && !unit.landing) unit.hitZone.setInteractive({ useHandCursor: true });
}

// Recreate model state and timers without replaying rewards or paying action costs again.
export function restoreBattle(scene, snapshot) {
  const model = unpackBattleValue(snapshot.scene);

  // Object.assign writes these fields into its first argument. Later sources replace
  // earlier fields; nested values are not deep-copied.
  Object.assign(scene, model);
  GameState.run = unpackBattleValue(snapshot.run);
  GameState.rewards = unpackBattleValue(snapshot.rewards);
  GameState.tactics = unpackBattleValue(snapshot.tactics);
  GameState.leader = unpackBattleValue(snapshot.leader);
  GameState.currentRoom = scene.currentWaveIndex;
  scene.time.now = snapshot.time;

  scene.time.paused = scene.combatPaused;

  // ... copies the source's own fields into this object; fields listed later replace
  // earlier ones. This is a shallow copy, so nested objects are still shared.
  scene.tactics.tactics = { ...GameState.tactics };
  const threat = scene.enemyThreat;
  const enemySerial = scene.enemySerial;

  // A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
  // object; get/set read and write that same key.
  scene.enemyThreat = new Map();
  scene.enemies = snapshot.enemies.map((saved, index) => {
    const unit = unpackBattleValue(saved);
    const enemy = scene.createEnemy(unit.enemyType, { x: unit.arenaX, y: unit.arenaY }, index);
    restoreUnit(enemy, saved);

    return enemy;
  });

  // A Set keeps each value once. has checks membership without searching a list for
  // duplicate entries.
  const enemyIds = new Set(scene.enemies.map(unit => unit.id));

  // filter keeps entries whose callback returns true. It builds a new list and leaves the
  // original list in place.
  scene.enemyThreat = new Map([...threat].filter(([id]) => enemyIds.has(id)));
  scene.enemySerial = enemySerial;
  scene.partyUnits.forEach(unit => restoreUnit(unit, snapshot.party.find(saved => saved.id === unit.id)));
  scene.tactics.preferences = unpackBattleValue(snapshot.preferences);
  const units = [...scene.partyUnits, ...scene.enemies];
  const movement = unpackBattleValue(snapshot.movement);

  for (const key of ['slots', 'rangeStates']) {

    // flatMap builds callback results and flattens one array level. Returning [] removes
    // an entry; returning [value] keeps one result.
    scene.movement[key] = new Map(movement[key].flatMap(({ ownerId, state }) => {

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const owner = units.find(unit => unit.id === ownerId);
      const target = units.find(unit => unit.id === state.targetId);

      // The condition before ? chooses the first value when true and the value after :
      // when false. ... copies the source's own fields into this object; fields listed
      // later replace earlier ones. This is a shallow copy, so nested objects are still
      // shared.
      return owner && target ? [[owner, { ...state, target }]] : [];
    }));
  }

  scene.classAbilitySystem.traps = snapshot.traps.map(trap => ({ ...trap,
    owner: units.find(unit => unit.id === trap.ownerId), point: unpackBattleValue(trap.point),
    ability: unpackBattleValue(trap.ability) })).filter(trap => trap.owner);
  scene.combatLog.record = unpackBattleValue(snapshot.log);
  scene.combatLog.entries = scene.combatLog.record.entries;
  scene.combatLog.setSimulationClock(() => scene.time.now);
  scene.combatLog.startedAt = snapshot.logStartedAt;

  scene.combatLog.publish();

  for (const event of snapshot.events) {
    const data = unpackBattleValue(event.data);
    if (data.kind === 'groundSlam') {

      // find returns the first matching entry, or undefined when none matches. Check for
      // that missing result before using its fields.
      const attacker = units.find(unit => unit.id === data.unitId);

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      if (attacker?.pendingAction?.startAt === data.actionStartAt) {
        scene.createSlamTelegraph(attacker, data.ability, data.center, event.remainingMs);
      }
    }

    if (data.kind === 'landing') {
      const enemy = units.find(unit => unit.id === data.unitId);
      if (enemy?.landing) {

        // ?? uses the fallback only for null or undefined. A real zero or false stays
        // intact.
        const visual = enemy.spriteVisual?.image ?? enemy.body;
        visual.y = enemy.landingVisualY;
        scene.tweens.add({ targets: visual, y: enemy.landingFloorY,
          duration: event.remainingMs, ease: 'Bounce.Out' });

        for (const label of [enemy.label, enemy.targetLabel, enemy.actionLabel,
          enemy.hpBack, enemy.hpFill, enemy.castBack, enemy.castFill]) label.setAlpha(0);
      }
    }

    scene.scheduleBattleEvent(event.remainingMs, data);
  }

  for (const unit of units) {
    const charge = unit.charge;
    if (!charge || !unit.pendingAction) continue;
    const target = units.find(entry => entry.id === charge.targetId);

    if (!target || !scene.classAbilitySystem.startCharge(unit, target, charge.ability, unit.pendingAction, charge)) {
      unit.charge = null;
      unit.finishAction();
    }
  }

  const countdown = snapshot.events.find(event => event.data.kind === 'countdown');
  if (countdown) {
    scene.showWaveAnnouncement(`WAVE ${scene.currentWaveIndex + 1}`, Boolean(scene.waves[scene.currentWaveIndex].boss));
    scene.updateWaveCountdown(countdown.data.secondsRemaining);
  }
  scene.refreshFarmControls();
  scene.updateHud();

  scene.updateLeaderLoadoutBar();
  scene.updateEncounterStatus();

  // The condition before ? chooses the first value when true and the value after : when
  // false.
  scene.pauseButtonText?.setText(scene.combatPaused ? 'RESUME' : 'PAUSE');
  scene.pauseButton?.setFillStyle(scene.combatPaused ? 0x3b321d : 0x1f2937);
  scene.setTargetingInputState(['ATTACK', 'FOCUS', 'INTERRUPT'].includes(scene.commandMode));

  if (scene.battleOver) {
    const victory = GameState.run.summary?.result === 'victory';
    if (victory) GameState.currentRoom = scene.waves.length;
    scene.showResultOverlay(victory ? 'DELVE CLEARED!' : 'DEFEATED', victory
      ? `${GameState.currentDelve.name} has been cleared.` : 'The party was driven back.', 'CONFIRM', () => {

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      scene.scene.start(victory ? 'RewardScene' : 'EncounterSummaryScene');
    });
  } else if (GameState.run.entry === 'camp') scene.showDelveCamp();
  else if (scene.awaitingRevive) scene.showBattleMessage('PARTY DOWN - use ARISE! or FLEE', '#fde68a', true);
  else if (scene.combatPaused) scene.showBattleMessage('PAUSED', '#fbbf24', true);

  scene.game.backgroundProgress?.restore(snapshot.time, snapshot.savedAtMs,
    scene.combatPaused || scene.battleOver || scene.awaitingRevive || GameState.run.entry === 'camp');
}
