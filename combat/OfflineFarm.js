// Repeat farming uses elapsed time and rewards while the app is away. Only one current
// fight is built on return. Progression, bosses and player decisions use the normal path.
import GameState from '../game/GameState.js';
import { OFFLINE_FARM } from '../config/offlineFarm.js';
import { awardOfflineFarmWaves } from '../game/OfflineFarmRewards.js';
import { mergeEquipmentLoot } from '../game/EquipmentLoot.js';
import { delveFarmWaveIndex, getDelveCheckpoint, isOrdinaryDelve } from '../game/DelveCheckpoints.js';
import { farmCycleMs } from './FarmTiming.js';
import { beginIdleBattle } from './IdleBattle.js';
import { clearAbilityEffects } from './AbilityEffect.js';
import { clearSlimeAbilityEffects } from './SlimeAbilityEffects.js';
import { clearThornbriarAbilityEffects } from './ThornbriarAbilityEffects.js';
import { clearBossLandingEffects } from './BossLandingEffect.js';
import { clearLevelUpEffects } from './LevelUpEffect.js';
import { updateVoidProjectiles } from './VoidProjectile.js';
import { refreshReplacementTiming } from './ReplacementEffects.js';

// Return false when the caller should run ordinary combat. A short hidden gap waits up
// to five seconds before choosing estimation, avoiding free healing on momentary switches.
export function advanceOfflineFarm(scene, durationMs) {
  if (scene.restoringBattle || scene.isWaitingForPlayer()) return false;
  const delve = GameState.currentDelve;
  if (GameState.run.entry !== 'farm' || !isOrdinaryDelve(delve) || scene.farmStopRequested
    || scene.currentWaveIndex !== delveFarmWaveIndex(delve, scene.bossWaveIndex)
    || !getDelveCheckpoint(delve, scene.bossWaveIndex)?.campUnlocked
    || !scene.partyUnits.some(unit => unit.alive)) return false;

  if (!scene.offlineFarm?.active && durationMs < OFFLINE_FARM.minimumGapMs) {
    return scene.game.backgroundProgress?.hidden ? { consumedMs: 0 } : false;
  }
  beginIdleBattle(scene);
  if (!scene.offlineFarm?.active) {
    const cycleMs = farmCycleMs(scene);
    const timing = scene.farmTiming;

    // Credit the current unfinished cycle, never a previously paid clear. Older saves
    // without a timing anchor start at zero. A slow unfinished fight cannot create extra
    // completed waves before the player has actually been away.
    const anchor = timing.lastClearAt ?? (scene.waveRetreating ? scene.waveReturnStartedAt : timing.startedAt);
    const carryMs = Number.isFinite(anchor) ? Math.min(cycleMs * 0.95, Math.max(0, scene.time.now - anchor)) : 0;
    scene.offlineFarm = { active: true, cycleMs, carryMs, waves: 0, elapsedMs: 0 };
    timing.measuredClearAt = null;
  }

  const farm = scene.offlineFarm;
  const availableWaves = Math.floor((farm.carryMs + durationMs) / farm.cycleMs);
  const waves = Math.min(availableWaves, OFFLINE_FARM.maxWavesPerBatch);

  // Bound unusually large clock jumps without discarding owed time. Ordinary overnight
  // absences finish in one batch; remaining batches keep the existing responsive loader.
  const consumedMs = availableWaves > waves ? waves * farm.cycleMs - farm.carryMs : durationMs;
  const reward = awardOfflineFarmWaves(delve, scene.currentWaveIndex, scene.bossWaveIndex,
    waves, scene.partyUnits, () => scene.combatRandom());
  if (!reward) return false;
  farm.carryMs = Math.max(0, farm.carryMs + consumedMs - waves * farm.cycleMs);
  farm.waves += waves;
  farm.elapsedMs += consumedMs;
  scene.time.now += consumedMs;
  scene.farmTiming.lastClearAt = scene.time.now - farm.carryMs;

  // The summary reports the rewards already banked above. It never grants them again.
  // Keep per-adventurer totals because their caps can be reached at different times.
  const summary = scene.idleSummary;
  summary.xpByHero ??= Object.fromEntries(scene.partyUnits.map(unit => [unit.id, summary.xp]));
  summary.waves += waves;
  summary.estimatedWaves = (summary.estimatedWaves ?? 0) + waves;
  summary.gold += reward.gold;
  summary.items = mergeEquipmentLoot(summary.items, reward.items);
  summary.xp += reward.xp;
  summary.renownPoints = (summary.renownPoints ?? 0) + (reward.renownPoints ?? 0);
  summary.renownLevels = (summary.renownLevels ?? 0) + (reward.renownLevels ?? 0);
  for (const [id, xp] of Object.entries(reward.xpByHero)) summary.xpByHero[id] = (summary.xpByHero[id] ?? 0) + xp;
  for (const [id, count] of Object.entries(reward.materials)) summary.materials[id] = (summary.materials[id] ?? 0) + count;
  return { consumedMs };
}

// Clear abandoned casts and their timers before staging the present fight. This is a
// historical transition, so old artwork can be released immediately instead of faded.
function clearHistoricalFight(scene) {
  for (const event of scene.battleEvents) event.timer.remove(false);
  scene.battleEvents.clear();
  for (const tween of scene.classAbilitySystem.chargeTweens) tween.destroy();
  scene.classAbilitySystem.chargeTweens.clear();
  for (const warning of [...scene.activeTelegraphs]) scene.removeTelegraph(warning);
  clearAbilityEffects(scene);
  clearSlimeAbilityEffects(scene);
  clearThornbriarAbilityEffects(scene);
  clearBossLandingEffects(scene);
  clearLevelUpEffects(scene);
  updateVoidProjectiles(scene, 0, true);
  for (const unit of [...scene.enemies, ...(scene.abilityDecoys ?? [])]) unit.container.destroy();
  scene.enemies = [];
  scene.abilityDecoys = [];
  scene.classAbilitySystem.traps = [];
  for (const view of scene.classAbilitySystem.replacement.zoneViews.values()) view.destroy();
  scene.classAbilitySystem.replacement.zoneViews.clear();
  scene.enemyThreat.clear();
  scene.movement.slots.clear();
  scene.movement.rangeStates.clear();
  scene.movement.paths = new WeakMap();
  scene.terrain.avoidanceStates = new WeakMap();
  scene.pendingWaveSpawns = [];
  scene.waveRetreating = false;
  scene.waveTransitioning = false;
  scene.waveReturnReadyAt = null;
  scene.waveReturnTargets.clear();
  scene.earnedGold = 0;
  scene.waveRewardText?.destroy();
  scene.waveRewardText = null;
  scene.manualTargets.clear();
  scene.attackTargets.clear();
  scene.healerPriorityTargets.clear();
  scene.heldUnitIds.clear();
  scene.focusTargetId = null;
  scene.focusDamageTargetId = null;
  scene.assaultUntil = 0;
  scene.braceUntil = 0;
}

// Restore a plausible current farm wave, once per absence. The RNG state and resulting
// units are saved normally, so reopening the summary cannot reroll the fight or rewards.
export function finishOfflineFarm(scene) {
  const farm = scene.offlineFarm;
  if (!farm?.active || scene.game.backgroundProgress?.hidden) return;
  beginIdleBattle(scene);
  clearHistoricalFight(scene);
  const random = () => scene.combatRandom();
  const fraction = range => range[0] + random() * (range[1] - range[0]);
  const floor = scene.battlefield;
  const living = scene.partyUnits.filter(unit => unit.alive);

  for (const [index, unit] of living.entries()) {

    // Resources belong to the existing saved unit, including its original stat totals.
    // Spent potions and once-per-encounter skills stay spent; already fallen allies stay
    // fallen. The elapsed absence creates no new deaths or fabricated damage log entries.
    unit.finishAction('cancelled', 'state_invalidated', 'Offline farming replaces the historical combat state');
    unit.status = {};
    unit.charge = null;
    unit.criticalKnockback = null;
    unit.seekingRestealth = false;
    unit.setStealthed(unit.startsStealthed);
    refreshReplacementTiming(unit, scene.time.now);
    unit.hp = Math.max(1, Math.round(unit.maxHp * fraction(OFFLINE_FARM.partyHealth)));
    unit.mana = Math.round(unit.maxMana * fraction(OFFLINE_FARM.partyMana));
    unit.lastAttackAt = scene.time.now - unit.attackCooldown * random();
    unit.lastHealAt = scene.time.now - unit.healCooldown * random();
    unit.busyUntil = 0;

    // Logical y increases toward the rear. Put melee allies nearer the remaining
    // monsters, with ranged allies behind them, then enforce this Delve's own floor.
    const melee = scene.movement.isMeleeUnit(unit);
    const x = floor.logicalWidth * 0.5 + (index - (living.length - 1) / 2) * 120;
    const y = floor.logicalHeight * (melee ? 0.49 : 0.31);
    const point = scene.movement.getSafeArenaPoint(x, y, unit);
    unit.setArenaPosition(point.x, point.y);
    unit.currentTargetId = null;
    unit.setTargetName('');
  }

  // Pick only the remaining authored enemies. Removing an uncreated enemy grants no
  // extra kill or wave payout: rewards belong to completed cycles, and this fight is not
  // complete. Always leave at least one opponent for the player to fight.
  const spawns = [...scene.waves[scene.currentWaveIndex].enemies];
  for (let index = spawns.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [spawns[index], spawns[other]] = [spawns[other], spawns[index]];
  }
  const count = Math.max(1, Math.min(spawns.length, Math.round(spawns.length * fraction(OFFLINE_FARM.remainingEnemies))));
  scene.enemies = spawns.slice(0, count).map((spawn, index) => {
    const enemy = scene.createEnemy(spawn.type, {
      x: floor.logicalWidth * 0.5 + (index - (count - 1) / 2) * 135,
      y: floor.logicalHeight * (0.58 + random() * 0.1)
    }, index);
    enemy.hp = Math.max(1, Math.round(enemy.maxHp * fraction(OFFLINE_FARM.enemyHealth)));
    enemy.lastAttackAt = scene.time.now - enemy.attackCooldown * random();
    scene.setEnemyTarget(enemy, scene.getHighestThreatTarget(enemy), 'farm resumed');
    return enemy;
  });
  scene.combatMembershipRevision = (scene.combatMembershipRevision ?? 0) + 1;

  // This is a newly staged fight. Repair its placements once using the current
  // floor and body-clearance rules, without restoring mid-combat repulsion.
  for (const unit of [...living, ...scene.enemies]) scene.movement.validateUnitPosition(unit);
  scene.combatLog?.add('offline-farm', `${farm.waves} farm waves estimated while away`, {
    wave: scene.currentWaveIndex + 1, waves: farm.waves, durationMs: farm.elapsedMs, cycleMs: farm.cycleMs
  });
  scene.offlineFarm = null;
}
