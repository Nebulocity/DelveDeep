import GameState from '../game/GameState.js';
import { deferUnitPresentation, deferredDisplay, UNIT_VIEWS } from './DeferredPresentation.js';
import { notifyIdleDeath } from '../services/DeathNotifications.js';

const STEP_MS = 50;
const PRESENTATION_METHODS = ['updateHud', 'updatePotionHud', 'refreshFarmControls',
  'updateEncounterStatus', 'refreshPartySelection', 'updateLeaderLoadoutBar',
  'setTargetingInputState', 'showWaveAnnouncement', 'updateWaveCountdown',
  'clearWaveAnnouncement', 'showBattleMessage', 'clearBattleMessage',
  'createFloatingText', 'createProjectile', 'createMeleePulse', 'announceAbility', 'flashPartyHudName'];

// Keep the actual combat clock, AI, threat, movement, abilities and charge tweens running.
function beginIdleBattle(scene) {
  if (scene.idleSimulation) return;
  scene.idleSimulating = true;
  const simulation = { views: new Map(), methods: new Map(), timers: {}, result: null };
  scene.idleSimulation = simulation;
  simulation.visible = scene.sys.settings.visible;
  scene.sys.settings.visible = false;
  scene.idleSummary ??= { waves: 0, gold: 0, xp: 0, materials: {}, deaths: [], casualties: [] };
  for (const unit of [...scene.partyUnits, ...scene.enemies]) simulation.views.set(unit, deferUnitPresentation(unit));
  for (const name of PRESENTATION_METHODS) {
    simulation.methods.set(name, scene[name]);
    scene[name] = () => {};
  }
  simulation.methods.set('showResultOverlay', scene.showResultOverlay);
  scene.showResultOverlay = (...args) => { simulation.result = args; };
  simulation.add = scene.add;
  scene.add = Object.create(scene.add);
  for (const name of ['circle', 'ellipse', 'text', 'rectangle', 'container', 'image']) scene.add[name] = () => deferredDisplay();
  simulation.tweenAdd = scene.tweens.add;
  scene.tweens.add = () => deferredDisplay();
  simulation.tweenDelta = scene.tweens.getDelta;
  scene.tweens.getDelta = () => STEP_MS;
  simulation.tweens = scene.tweens.tweens.filter(tween => !scene.classAbilitySystem.chargeTweens.has(tween));
  scene.tweens.tweens = scene.tweens.tweens.filter(tween => scene.classAbilitySystem.chargeTweens.has(tween));
  const gameplayTimers = new Set([...scene.battleEvents].map(event => event.timer));
  for (const key of ['_active', '_pendingInsertion', '_pendingRemoval']) {
    simulation.timers[key] = scene.time[key].filter(timer => !gameplayTimers.has(timer));
    scene.time[key] = scene.time[key].filter(timer => gameplayTimers.has(timer));
  }
  simulation.blockedZones = Object.getOwnPropertyDescriptor(scene.terrain, 'blockedZones');
  const blockedZones = scene.terrain.blockedZones;
  Object.defineProperty(scene.terrain, 'blockedZones', { configurable: true, get: () => blockedZones });
  simulation.isBlocked = scene.terrain.isBlocked;
  simulation.getFootPoint = scene.terrain.getUnitFootPoint;
  const feet = new WeakMap();
  scene.terrain.getUnitFootPoint = function (unit, x = unit.arenaX, y = unit.arenaY) {
    let cache = feet.get(unit);
    if (!cache) { cache = new Map(); feet.set(unit, cache); }
    const key = `${x}:${y}`;
    if (cache.has(key)) return cache.get(key);
    const point = simulation.getFootPoint.call(this, unit, x, y);
    if (cache.size >= 256) cache.clear();
    cache.set(key, point);
    return point;
  };
  const terrainChecks = new Map();
  scene.terrain.isBlocked = function (x, y, padding = 0) {
    const key = `${x}:${y}:${padding}`;
    if (terrainChecks.has(key)) return terrainChecks.get(key);
    const result = simulation.isBlocked.call(this, x, y, padding);
    if (terrainChecks.size >= 8192) terrainChecks.clear();
    terrainChecks.set(key, result);
    return result;
  };
  simulation.membershipMethods = new Map();
  for (const name of ['getLivingCombatUnits', 'getFallenPartyUnits']) {
    const original = scene.movement[name];
    simulation.membershipMethods.set(name, original);
    let party, enemies, size, revision, units;
    scene.movement[name] = function () {
      if (party !== scene.partyUnits || enemies !== scene.enemies || size !== scene.enemies.length
        || revision !== scene.combatMembershipRevision) {
        party = scene.partyUnits;
        enemies = scene.enemies;
        size = enemies.length;
        revision = scene.combatMembershipRevision;
        units = original.call(this);
      }
      return units;
    };
  }
}

// Empty countdowns and the settled rest have no movement or resource updates to replay.
function nextStep(scene, remaining) {
  const countdown = scene.waveTransitioning && !scene.waveRetreating;
  const resting = scene.waveRetreating && scene.waveReturnReadyAt !== null
    && scene.partyUnits.filter(unit => unit.alive).every(unit => scene.waveReturnTimedOut
      || scene.waveReturnSettled?.has(unit.id)
      || unit.distanceToPoint(scene.waveReturnTargets.get(unit.id)?.x, scene.waveReturnTargets.get(unit.id)?.y) <= 6);
  if ((!countdown && !resting) || scene.classAbilitySystem.chargeTweens.size) return STEP_MS;
  let delay = resting ? scene.waveReturnReadyAt - scene.time.now : remaining;
  for (const event of scene.battleEvents) delay = Math.min(delay, event.timer.getRemaining());
  return Math.max(STEP_MS, Math.min(Math.floor(remaining / STEP_MS) * STEP_MS, Math.ceil(delay / STEP_MS) * STEP_MS));
}

// Consume bounded batches of real combat without SceneManager updates or historical drawing.
export function advanceIdleBattle(scene, durationMs, budgetNow = () => performance.now()) {
  if (scene.restoringBattle) return { consumedMs: 0 };
  if (scene.isWaitingForPlayer()) return { consumedMs: durationMs };
  if (!scene.idleSimulation && scene.idlePhaseRemainingMs !== undefined) resumeIdleBattle(scene);
  beginIdleBattle(scene);
  const started = budgetNow();
  let consumedMs = 0;
  while (durationMs - consumedMs >= STEP_MS) {
    const delta = nextStep(scene, durationMs - consumedMs);
    const time = scene.time.now + delta;
    scene.time.preUpdate(time, delta);
    scene.time.update(time, delta);
    scene.tweens.update();
    scene.update(time, STEP_MS);
    consumedMs += delta;
    if (scene.isWaitingForPlayer()) return { consumedMs: durationMs };
    if (budgetNow() - started >= 24) break;
  }
  return { consumedMs };
}

// Restore only the views belonging to the final current battlefield.
export function resumeIdleBattle(scene) {
  const simulation = scene.idleSimulation;
  if (!simulation) {

    // Older aggregate saves may contain a phase delay instead of a gameplay timer.
    const delay = scene.idlePhaseRemainingMs;
    if (delay === undefined || scene.isWaitingForPlayer()) return;
    delete scene.idlePhaseRemainingMs;
    if (scene.waveRetreating) {
      scene.waveReturnStartedAt ??= scene.time.now;
      scene.waveReturnReadyAt = scene.time.now + delay;
    } else if (scene.waveTransitioning && ![...scene.battleEvents].some(event => event.data.kind === 'countdown')) {
      const secondsRemaining = Math.max(1, Math.ceil(delay / 1000));
      scene.scheduleBattleEvent(Math.max(1, delay - (secondsRemaining - 1) * 1000), {
        kind: 'countdown', index: scene.currentWaveIndex, secondsRemaining
      });
    }
    return;
  }
  scene.idleSimulating = false;
  scene.idleSimulation = null;
  scene.sys.settings.visible = simulation.visible;
  scene.add = simulation.add;
  scene.terrain.isBlocked = simulation.isBlocked;
  scene.terrain.getUnitFootPoint = simulation.getFootPoint;
  for (const [name, method] of simulation.membershipMethods) scene.movement[name] = method;
  if (simulation.blockedZones) Object.defineProperty(scene.terrain, 'blockedZones', simulation.blockedZones);
  else delete scene.terrain.blockedZones;
  for (const [name, method] of simulation.methods) scene[name] = method;
  scene.tweens.add = simulation.tweenAdd;
  scene.tweens.getDelta = simulation.tweenDelta;
  const wallTime = Date.now();
  scene.tweens.startTime += wallTime - scene.tweens.prevTime;
  scene.tweens.prevTime = wallTime;
  const unitDisplays = new Set([...simulation.views.values()].flatMap(views =>
    UNIT_VIEWS.flatMap(key => key === 'spriteVisual' ? [views[key]?.image] : [views[key]])));
  for (const tween of simulation.tweens) {
    if (tween.targets?.some(target => unitDisplays.has(target))) tween.destroy();
    else scene.tweens.tweens.push(tween);
  }
  for (const key of Object.keys(simulation.timers)) scene.time[key].push(...simulation.timers[key]);
  const current = new Set([...scene.partyUnits, ...scene.enemies]);
  for (const [unit, views] of simulation.views) {
    if (!current.has(unit) || unit.container.active === false) views.container?.destroy();
    else Object.assign(unit, views);
  }
  for (const unit of current) {
    if (unit.container.active === false) continue;
    if (unit.presentationDeferred) {
      unit.createPresentation();
      if (unit.isEnemy) scene.bindEnemyInput(unit);
    }
    unit.syncPresentation();
    unit.setStealthed(unit.stealthed);
    unit.updateHealthBar();
    unit.setTargetName(unit.targetName);
    if (!unit.alive) unit.defeat();
    else if (unit.isEnemy && !unit.landing) scene.finishEnemyLanding(unit);
    if (unit.pendingAction) {
      unit.actionLabel.setText(unit.pendingAction.name === 'Attack' ? '' : unit.pendingAction.name);
      unit.castBack.setVisible(true);
      unit.castFill.setVisible(true);
      unit.updateActionBar(scene.time.now);
    }
  }
  for (const telegraph of [...scene.activeTelegraphs]) {
    const event = [...scene.battleEvents].find(entry => entry.data.kind === 'groundSlam'
      && entry.data.unitId === telegraph.attacker.id);
    telegraph.warning?.destroy();
    telegraph.inner?.destroy();
    if (event) {
      const presentation = scene.createSlamTelegraph(telegraph.attacker, event.data.ability,
        event.data.center, event.timer.getRemaining());
      telegraph.warning = presentation.warning;
      telegraph.inner = presentation.inner;
      scene.activeTelegraphs = scene.activeTelegraphs.filter(entry => entry !== presentation);
    } else scene.removeTelegraph(telegraph);
  }
  scene.clearWaveAnnouncement();
  const countdown = [...scene.battleEvents].find(event => event.data.kind === 'countdown');
  if (countdown) {
    scene.showWaveAnnouncement(`WAVE ${scene.currentWaveIndex + 1}`, Boolean(scene.waves[scene.currentWaveIndex].boss));
    scene.updateWaveCountdown(countdown.data.secondsRemaining);
  }
  if (GameState.run.entry === 'camp') scene.showDelveCamp();
  else if (simulation.result) scene.showResultOverlay(...simulation.result);
  else if (scene.awaitingRevive) scene.showBattleMessage('PARTY DOWN - use ARISE! or FLEE', '#fde68a', true);
}

// Retain the killing blow and its exact simulation timestamp alongside the return summary.
export function recordIdleEvent(scene, entry) {
  if (!scene.idleSimulating || entry.type !== 'death' || entry.targetSide !== 'party') return;
  const summary = scene.idleSummary;
  summary.deaths.push(entry.target);
  summary.casualties ??= [];
  summary.casualties.push({ name: entry.target, actor: entry.actor, ability: entry.ability,
    wave: entry.wave, time: entry.time });
  void notifyIdleDeath({ id: entry.target, name: entry.target }, GameState.currentDelve.name);
}
