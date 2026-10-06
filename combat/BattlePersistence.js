import GameState from '../game/GameState.js';
import { captureBattle, unpackBattleValue } from '../game/BattleSnapshot.js';
import { saveProfile, setBattleSaveProvider } from '../game/GameStorage.js';

export function installBattlePersistence(scene) {
  let lastSavedAt = 0;
  let lastPhase = '';
  const provider = () => {
    const progress = scene.game.backgroundProgress;
    const savedAtMs = progress ? progress.lastWallTime - progress.pendingMs : Date.now();
    return captureBattle(scene, GameState, savedAtMs);
  };
  setBattleSaveProvider(provider);
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
  scene.events.on('postupdate', checkpoint);
  scene.input.on('pointerup', save);
  const pageEvents = ['visibilitychange', 'freeze', 'resume'];
  const windowEvents = ['pagehide', 'pageshow', 'delveAppState'];
  pageEvents.forEach(event => document.addEventListener(event, save));
  windowEvents.forEach(event => window.addEventListener(event, save));
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

function restoreUnit(unit, saved) {
  Object.assign(unit, unpackBattleValue(saved));
  unit.syncPresentation();
  unit.setStealthed(unit.stealthed);
  unit.updateHealthBar();
  unit.setTargetName(unit.targetName);
  if (unit.pendingAction) {
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
  Object.assign(scene, model);
  GameState.run = unpackBattleValue(snapshot.run);
  GameState.rewards = unpackBattleValue(snapshot.rewards);
  GameState.tactics = unpackBattleValue(snapshot.tactics);
  GameState.leader = unpackBattleValue(snapshot.leader);
  GameState.currentRoom = scene.currentWaveIndex;
  scene.time.now = snapshot.time;
  scene.time.paused = scene.combatPaused;
  scene.tactics.tactics = { ...GameState.tactics };
  const threat = scene.enemyThreat;
  const enemySerial = scene.enemySerial;
  scene.enemyThreat = new Map();
  scene.enemies = snapshot.enemies.map((saved, index) => {
    const unit = unpackBattleValue(saved);
    const enemy = scene.createEnemy(unit.enemyType, { x: unit.arenaX, y: unit.arenaY }, index);
    restoreUnit(enemy, saved);
    return enemy;
  });
  scene.enemyThreat = threat;
  scene.enemySerial = enemySerial;
  scene.partyUnits.forEach(unit => restoreUnit(unit, snapshot.party.find(saved => saved.id === unit.id)));
  scene.tactics.preferences = unpackBattleValue(snapshot.preferences);
  const units = [...scene.partyUnits, ...scene.enemies];
  const movement = unpackBattleValue(snapshot.movement);
  for (const key of ['slots', 'rangeStates']) {
    scene.movement[key] = new Map(movement[key].flatMap(({ ownerId, state }) => {
      const owner = units.find(unit => unit.id === ownerId);
      const target = units.find(unit => unit.id === state.targetId);
      return owner && target ? [[owner, { ...state, target }]] : [];
    }));
  }
  scene.classAbilitySystem.traps = snapshot.traps.map(trap => ({ ...trap,
    owner: units.find(unit => unit.id === trap.ownerId), point: unpackBattleValue(trap.point),
    ability: unpackBattleValue(trap.ability) })).filter(trap => trap.owner);
  scene.combatLog.record = unpackBattleValue(snapshot.log);
  scene.combatLog.entries = scene.combatLog.record.entries;
  scene.combatLog.startedAt = snapshot.logStartedAt;
  scene.combatLog.publish();

  for (const event of snapshot.events) {
    const data = unpackBattleValue(event.data);
    if (data.kind === 'groundSlam') {
      const attacker = units.find(unit => unit.id === data.unitId);
      if (attacker?.pendingAction?.startAt === data.actionStartAt) {
        scene.createSlamTelegraph(attacker, data.ability, data.center, event.remainingMs);
      }
    }
    if (data.kind === 'landing') {
      const enemy = units.find(unit => unit.id === data.unitId);
      if (enemy?.landing) {
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
  scene.pauseButtonText?.setText(scene.combatPaused ? 'RESUME' : 'PAUSE');
  scene.pauseButton?.setFillStyle(scene.combatPaused ? 0x3b321d : 0x1f2937);
  scene.setTargetingInputState(['ATTACK', 'FOCUS', 'INTERRUPT'].includes(scene.commandMode));
  if (scene.battleOver) {
    const victory = GameState.run.summary?.result === 'victory';
    if (victory) GameState.currentRoom = scene.waves.length;
    scene.showResultOverlay(victory ? 'DELVE CLEARED!' : 'DEFEATED', victory
      ? `${GameState.currentDelve.name} has been cleared.` : 'The party was driven back.', 'CONFIRM', () => {
      scene.scene.start(victory ? 'RewardScene' : 'EncounterSummaryScene');
    });
  } else if (GameState.run.entry === 'camp') scene.showDelveCamp();
  else if (scene.awaitingRevive) scene.showBattleMessage('PARTY DOWN - use ARISE! or FLEE', '#fde68a', true);
  else if (scene.combatPaused) scene.showBattleMessage('PAUSED', '#fbbf24', true);
  scene.game.backgroundProgress?.restore(snapshot.time, snapshot.savedAtMs,
    scene.combatPaused || scene.battleOver || scene.awaitingRevive || GameState.run.entry === 'camp');
}
