import { requestOrder, acceptOrder, rejectOrder, cancelOrder, targetedTacticUnits } from '../game/GameplayEvents.js';
// Planning stores IDs and input coordinates only. No actions, resources, AI targets or
// cooldowns change here; Resume dispatches through BattleScene's existing command paths.
import GameState from '../game/GameState.js';
import { equippedItem } from '../game/Equipment.js';
import { leaderAbilities } from '../game/LeaderProgression.js';
import { expandedTacticRecipients, expandedTacticHasBenefit, tacticCanRevive } from './LeaderTacticEffects.js';
const POSITIONAL_TACTICS = ['focusFire', 'coordinatedAttack', 'lunarAssault'];
const TARGET_MODES = { focusFire: 'FOCUS', coordinatedAttack: 'COORDINATED_ATTACK', lunarAssault: 'LUNAR_ASSAULT', revive: 'REVIVE' };
const ORDERS = ['MOVE', 'HOLD', 'SPREAD', 'STACK', 'ATTACK', 'INTERRUPT', 'ASSIST'];

export default class LeaderOrderPlan {
  constructor(scene) { this.scene = scene; }

  get orders() { return this.scene.pendingLeaderOrders ?? []; }
  get tactics() { return this.scene.pendingPausedTactics ?? []; }
  get count() { return this.orders.length + this.tactics.length; }

  nextSerial() { return ++this.scene.leaderOrderSerial; }

  membersForTactic(id, targetId) {
    const ability = leaderAbilities.find(entry => entry.id === id);
    if (ability?.effects) return expandedTacticRecipients(this.scene, ability);
    const party = this.scene.partyUnits;
    if (id === 'coordinatedAttack' || id === 'lunarAssault')
      return targetedTacticUnits(this.scene, id === 'coordinatedAttack' ? 'COORDINATED_ATTACK' : 'LUNAR_ASSAULT').map(unit => unit.id);
    if (id === 'revive') return party.filter(unit => unit.id === targetId).map(unit => unit.id);
    if (id === 'arise') return party.filter(unit => !unit.alive && !unit.delvesUsed?.honorSacrifice).map(unit => unit.id);
    return party.filter(unit => {
      if (!unit.alive) return false;
      if (id === 'shieldWall') return unit.role === 'Tank';
      if (id === 'manaVortex') return unit.maxMana > 0;
      if (id === 'supplies') {
        const hero = GameState.roster.find(entry => entry.id === unit.id);
        return Boolean(hero && equippedItem(hero, 'potion'));
      }
      return true;
    }).map(unit => unit.id);
  }

  reject(message) {
    this.scene.showBattleMessage(message, '#fca5a5');
    return false;
  }

  replaceMembers(ids) {
    const affected = new Set(ids);
    for (const order of this.orders) {
      const removed = order.unitIds.filter(id => affected.has(id));
      if (removed.length) cancelOrder(this.scene, order.observation, 'superseded', removed);
    }
    for (const tactic of this.tactics) if (POSITIONAL_TACTICS.includes(tactic.id)
      && this.membersForTactic(tactic.id, tactic.targetId).some(id => affected.has(id)))
      cancelOrder(this.scene, tactic.observation, 'superseded');
    this.scene.pendingLeaderOrders = this.orders.map(order => ({ ...order,
      unitIds: order.unitIds.filter(id => !affected.has(id)) }))
      .filter(order => order.type === 'INTERRUPT' || order.unitIds.length);
    // Whole-party tactics cannot be partially executed safely by their existing handler.
    this.scene.pendingPausedTactics = this.tactics.filter(tactic => !POSITIONAL_TACTICS.includes(tactic.id)
      || !this.membersForTactic(tactic.id, tactic.targetId).some(id => affected.has(id)));
  }

  prepare(type, { point, target, anchorId, observation } = {}) {
    const scene = this.scene;
    observation ??= requestOrder(scene, type, scene.getSelectedUnits(), { targetId: target?.id ?? null, destination: point ?? null });
    if (!scene.combatPaused || scene.battleOver || !ORDERS.includes(type)) {
      rejectOrder(scene, observation, 'cannot_prepare');
      return this.reject('That order cannot be prepared');
    }
    const action = target?.pendingAction;
    const order = { type, observation, unitIds: type === 'INTERRUPT' ? [] : scene.getSelectedUnits().map(unit => unit.id),
      point: point ? { x: point.x, y: point.y } : null, targetId: target?.id ?? null, anchorId: anchorId ?? null,
      waveIndex: scene.currentWaveIndex, castId: action?.id ?? null,
      castStartAt: action?.startAt ?? null, castName: action?.name ?? null };
    const error = this.validate(order);
    if (error) { rejectOrder(scene, observation, error); return this.reject(error); }
    if (type === 'INTERRUPT') {
      for (const entry of this.orders.filter(o => o.type === 'INTERRUPT')) cancelOrder(scene, entry.observation, 'superseded');
      scene.pendingLeaderOrders = this.orders.filter(entry => entry.type !== 'INTERRUPT');
    }
    else this.replaceMembers(order.unitIds);
    order.serial = this.nextSerial();
    scene.pendingLeaderOrders.push(order);
    acceptOrder(scene, observation, true);
    this.finishPreparation(`${type} prepared`, type);
    return true;
  }

  prepareTactic(id, targetId, observation = null) {
    const scene = this.scene;
    if (!scene.combatPaused || scene.battleOver) return this.reject('Tactics can only be prepared during Tactical Pause');
    observation ??= requestOrder(scene, 'TACTIC:' + id, this.membersForTactic(id, targetId).map(id => ({ id })), { targetId, intendedRecipientIds: this.membersForTactic(id, targetId) });
    observation = { ...observation, intendedRecipientIds: observation.intendedRecipientIds ?? this.membersForTactic(id, targetId),
      validRecipientIds: this.membersForTactic(id, targetId), subjectIds: this.membersForTactic(id, targetId) };
    const tactic = { id, observation, targetId, waveIndex: scene.currentWaveIndex, serial: this.nextSerial() };
    const error = this.validateTactic(tactic);
    if (error) { rejectOrder(scene, observation, error); return this.reject(error); }
    if (POSITIONAL_TACTICS.includes(id)) this.replaceMembers(this.membersForTactic(id, targetId));
    for (const entry of this.tactics.filter(t => t.id === id)) cancelOrder(scene, entry.observation, 'superseded');
    scene.pendingPausedTactics = this.tactics.filter(entry => entry.id !== id);
    scene.pendingPausedTactics.push(tactic);
    acceptOrder(scene, observation, true, { affectedRecipientIds: [], affectedTargetIds: [] });
    this.finishPreparation('Tactic prepared');
    return true;
  }

  finishPreparation(message, command = null) {
    const scene = this.scene;
    scene.commandMode = null;
    scene.setTargetingInputState(false);
    if (command) scene.completePartyCommand(command);
    scene.radialHud.close();
    scene.showBattleMessage(message, '#a9d5ff');
    scene.updateLeaderLoadoutBar();
    scene.refreshPartySelection();
  }

  validate(order) {
    const scene = this.scene;
    if (!ORDERS.includes(order.type)) return 'Unknown pending order canceled';
    const selected = scene.partyUnits.filter(unit => order.unitIds.includes(unit.id) && unit.alive);
    if (order.type !== 'INTERRUPT' && (!selected.length || selected.length !== order.unitIds.length)) return `${order.type}: adventurer unavailable`;
    if (['MOVE', 'SPREAD', 'STACK'].includes(order.type)) {
      const p = order.point;
      if (!p || !Number.isFinite(p.x) || !Number.isFinite(p.y)
        || !scene.battlefield.containsArenaPoint(p.x, p.y) || scene.terrain.isBlocked(p.x, p.y)) return `${order.type}: destination unavailable`;
      if (order.anchorId && !scene.partyUnits.some(unit => unit.id === order.anchorId && unit.alive)) return `${order.type}: anchor unavailable`;
    }
    if (order.type === 'ASSIST' && !scene.partyUnits.some(unit => unit.id === order.targetId && unit.alive)) return 'Assist target unavailable';
    if (order.type === 'ASSIST' && selected.length === 1 && selected[0].id === order.targetId) return 'Choose another ally to assist';
    if (['ATTACK', 'INTERRUPT'].includes(order.type)) {
      const enemy = scene.enemies.find(unit => unit.id === order.targetId && unit.alive && !unit.landing);
      if (!enemy || order.waveIndex !== scene.currentWaveIndex) return `${order.type}: enemy unavailable`;
      if (order.type === 'INTERRUPT') {
        const cast = enemy.pendingAction;
        if (scene.interruptCooldownRemainingMs > 0) return 'Interrupt is recharging';
        if (!cast || cast.id !== order.castId || cast.startAt !== order.castStartAt || cast.name !== order.castName) return 'Interrupt canceled: the chosen cast is no longer active';
      }
    }
    return null;
  }

  validateTactic(tactic) {
    const scene = this.scene;
    if (!scene.isLeaderAbilityReady(tactic.id)) return 'Tactic unavailable or recharging';
    const ability = leaderAbilities.find(entry => entry.id === tactic.id);
    if (ability?.effects && !expandedTacticHasBenefit(scene, ability)) return 'Tactic has no eligible effect yet';
    const living = scene.partyUnits.filter(unit => unit.alive);
    const fallen = scene.partyUnits.filter(unit => !unit.alive && !unit.delvesUsed?.honorSacrifice);
    if (!living.length && !(tacticCanRevive(ability) && fallen.length)) return 'Tactic has no eligible adventurers';
    if (['arise', 'revive'].includes(tactic.id) && !fallen.length) return 'Tactic has no eligible adventurers';
    if (tactic.id === 'encouragement' && !living.some(unit => unit.hp < unit.maxHp)) return 'The party is already at full health';
    if (tactic.id === 'manaVortex' && !living.some(unit => unit.mana < unit.maxMana)) return 'The party is already at full mana';
    if (['shieldWall', 'supplies'].includes(tactic.id) && !this.membersForTactic(tactic.id).length) return 'Tactic has no eligible recipients';
    if (TARGET_MODES[tactic.id]) {
      const target = (tactic.id === 'revive' ? scene.partyUnits : scene.enemies).find(unit => unit.id === tactic.targetId);
      if (tactic.waveIndex !== scene.currentWaveIndex || !target
        || (tactic.id === 'revive' ? target.alive || target.delvesUsed?.honorSacrifice : !target.alive || target.landing)) return 'Tactic target unavailable';
    }
    if (tactic.id === 'coordinatedAttack' && !this.membersForTactic(tactic.id).length) return 'No living melee adventurers';
    if (tactic.id === 'lunarAssault' && !this.membersForTactic(tactic.id).length) return 'No living lunar mages';
    return null;
  }

  cancelSelected(all = false) {
    const scene = this.scene;
    if (!scene.combatPaused) return;
    const ids = new Set(scene.getSelectedUnits().map(unit => unit.id));
    const count = this.count;
    for (const order of this.orders) {
      const removed = all || !ids.size ? order.unitIds : order.unitIds.filter(id => ids.has(id));
      if (removed.length || order.type === 'INTERRUPT' && (all || !ids.size || order.targetId === scene.inspectedEnemyId))
        cancelOrder(scene, order.observation, 'player_cancelled', removed);
    }
    for (const tactic of this.tactics) if (all || !ids.size
      || this.membersForTactic(tactic.id, tactic.targetId).some(id => ids.has(id)))
      cancelOrder(scene, tactic.observation, 'player_cancelled');
    if (all || !ids.size) {
      scene.pendingLeaderOrders = [];
      scene.pendingPausedTactics = [];
    } else {
      scene.pendingLeaderOrders = this.orders.map(order => ({ ...order, unitIds: order.unitIds.filter(id => !ids.has(id)) }))
        .filter(order => order.type === 'INTERRUPT' ? order.targetId !== scene.inspectedEnemyId : order.unitIds.length);
      scene.pendingPausedTactics = this.tactics.filter(tactic => !this.membersForTactic(tactic.id, tactic.targetId).some(id => ids.has(id)));
    }
    scene.showBattleMessage(this.count < count ? 'Pending orders canceled' : 'No matching pending orders', '#bdc9d4');
    scene.updateLeaderLoadoutBar();
  }

  flush() {
    const scene = this.scene;
    if (scene.combatPaused || scene.waveTransitioning || scene.battleOver) return;
    const pending = [...this.orders.map(order => ({ order, serial: order.serial })),
      ...this.tactics.map(tactic => ({ tactic, serial: tactic.serial }))].sort((a, b) => a.serial - b.serial);
    scene.pendingLeaderOrders = [];
    scene.pendingPausedTactics = [];
    const selection = scene.selectedUnitIds;
    const mode = scene.commandMode;
    const failures = [];
    try {
      for (const { order, tactic } of pending) {
        const error = order ? this.validate(order) : this.validateTactic(tactic);
        if (error) {
          cancelOrder(scene, (order ?? tactic).observation, error);
          failures.push(error); continue;
        }
        scene.executingGameplayOrder = (order ?? tactic).observation;
        scene.commandMode = null;
        if (tactic) {
          scene.useLeaderAbility(tactic.id);
          if (TARGET_MODES[tactic.id] && scene.commandMode === TARGET_MODES[tactic.id]) {
            const target = [...scene.partyUnits, ...scene.enemies].find(unit => unit.id === tactic.targetId);
            if (tactic.id === 'revive') scene.toggleUnitSelection(target);
            else scene.handleEnemyTap(target);
          }
        } else {
          scene.selectedUnitIds = new Set(order.unitIds);
          if (order.type === 'HOLD') scene.armCommand('HOLD');
          else if (order.type === 'ASSIST') scene.assignAllyTarget(scene.partyUnits.find(unit => unit.id === order.targetId));
          else {
            scene.commandMode = order.type;
            if (['ATTACK', 'INTERRUPT'].includes(order.type)) scene.handleEnemyTap(scene.enemies.find(unit => unit.id === order.targetId));
            else scene.handleArenaTap(order.point, scene.partyUnits.find(unit => unit.id === order.anchorId));
          }
        }
      }
    } finally {
      scene.executingGameplayOrder = null;
      scene.selectedUnitIds = selection;
      scene.commandMode = mode;
      scene.setTargetingInputState(['ATTACK', 'FOCUS', 'INTERRUPT', 'COORDINATED_ATTACK', 'LUNAR_ASSAULT'].includes(mode));
      scene.refreshTacticsMenus();
      scene.updateLeaderLoadoutBar();
    }
    if (failures.length) {
      failures.forEach(message => scene.addCombatAnnounce(message, '#fca5a5'));
      scene.showBattleMessage(`${failures[0]}${failures.length > 1 ? ` · ${failures.length - 1} more canceled` : ''}`, '#fca5a5');
    }
  }
}
