import Phaser from 'phaser';
import GameState from '../game/GameState.js';
import enemies, { forgottenCavernWaves } from '../data/enemies.js';
import BattleUnit from '../combat/BattleUnit.js';
import BattlefieldGeometry from '../combat/BattlefieldGeometry.js';
import TacticsController from '../combat/TacticsController.js';
import HapticsService from '../services/HapticsService.js';
import { completeExpedition, failExpedition, formatDuration } from '../game/ExpeditionProgression.js';
import { saveProfile } from '../game/GameStorage.js';
import { UI_SAFE_TOP } from '../ui/Layout.js';

export default class BattleScene extends Phaser.Scene {
  constructor() {
    super('BattleScene');
  }

  create() {
    const { width, height } = this.scale;

    this.battleOver = false;
    this.waveTransitioning = false;
    this.activeTelegraphs = [];
    this.currentWaveIndex = -1;
    this.enemySerial = 0;
    this.earnedGold = 0;
    this.enemyThreat = new Map();
    this.enemies = [];
    this.lastTonicUseAt = 0;

    this.battlefield = new BattlefieldGeometry(this, {
      bottomLeftX: 120,
      bottomRightX: width - 120,
      topLeftX: width * 0.20,
      topRightX: width * 0.80,
      bottomY: height * 0.73,
      topY: height * 0.25,
      logicalWidth: 1400,
      logicalHeight: 900,
      nearScale: 1.08,
      farScale: 0.72
    });

    this.tactics = new TacticsController(this.battlefield, GameState.tactics);

    this.cameras.main.setBackgroundColor('#09080a');
    this.createHeader(width);
    this.createArena(width, height);
    this.createParty();
    this.createHud(width, height);
    this.startWave(0);
  }

  createHeader(width) {
    this.add.text(width / 2, UI_SAFE_TOP + 4, GameState.currentDelve?.name ?? 'THE FORGOTTEN CAVERN', {
      fontFamily: 'Arial',
      fontSize: '38px',
      fontStyle: 'bold',
      color: '#f5f5f4'
    }).setOrigin(0.5);

    this.waveTitle = this.add.text(width / 2, UI_SAFE_TOP + 46, '', {
      fontFamily: 'Arial',
      fontSize: '21px',
      fontStyle: 'bold',
      color: '#fb923c'
    }).setOrigin(0.5);
  }

  createArena(width) {
    this.drawCaveBackdrop(width);
    this.battlefield.drawPerspectiveFloor();
  }

  drawCaveBackdrop(width) {
    const { height } = this.scale;
    const wall = this.add.graphics();

    wall.fillStyle(0x111827, 1);
    wall.fillEllipse(width / 2, height * 0.42, width * 0.84, height * 0.70);

    wall.fillStyle(0x020617, 1);
    wall.fillEllipse(width / 2, height * 0.39, width * 0.62, height * 0.43);

    wall.fillStyle(0x243044, 0.9);
    wall.fillEllipse(width * 0.08, height * 0.44, width * 0.14, height * 0.66);
    wall.fillEllipse(width * 0.92, height * 0.44, width * 0.14, height * 0.66);
    wall.fillEllipse(width * 0.18, height * 0.29, width * 0.20, height * 0.24);
    wall.fillEllipse(width * 0.82, height * 0.29, width * 0.20, height * 0.24);

    for (let i = 0; i < 10; i += 1) {
      const mossX = Phaser.Math.Between(width * 0.05, width * 0.95);
      const mossY = Phaser.Math.Between(height * 0.24, height * 0.70);
      if (Math.abs(mossX - width / 2) < width * 0.24) {
        continue;
      }

      this.add.ellipse(
        mossX,
        mossY,
        Phaser.Math.Between(24, 58),
        Phaser.Math.Between(10, 24),
        0x65a30d,
        0.8
      );
    }
  }

  createParty() {
    const party = GameState.activeParty.length > 0
      ? GameState.activeParty
      : GameState.roster.slice(0, 4);

    this.partyUnits = party.map((adventurer) => new BattleUnit(this, {
      ...adventurer,
      battlefield: this.battlefield,
      arenaX: 500,
      arenaY: 110,
      isEnemy: false
    }));

    this.tactics.registerParty(this.partyUnits);
    this.partyUnits.forEach((unit, index) => {
      const spawn = this.tactics.getSpawnPosition(unit, index);
      unit.setArenaPosition(spawn.x, spawn.y);
    });

    this.tank = this.partyUnits.find((unit) => unit.role === 'Tank') ?? this.partyUnits[0];
    this.healer = this.partyUnits.find((unit) => unit.role === 'Healer');
    this.rogue = this.partyUnits.find((unit) => unit.className === 'Rogue');
    this.wizard = this.partyUnits.find((unit) => unit.className === 'Wizard');
  }

  createHud(width, height) {
    const hudTop = height * 0.78;

    this.add.rectangle(
      width / 2,
      (hudTop + height) / 2,
      width,
      height - hudTop,
      0x0c0a09
    ).setDepth(4500);

    this.partyHud = [];

    const sectionWidth = width * 0.18;
    const startX = width * 0.10;

    this.partyUnits.forEach((unit, index) => {
      const x = startX + index * sectionWidth;

      this.add.circle(x, hudTop + 70, 22, unit.color).setDepth(4501);

      this.add.text(x + 38, hudTop + 52, `${unit.name} • ${unit.className}`, {
        fontFamily: 'Arial',
        fontSize: '20px',
        fontStyle: 'bold',
        color: '#f5f5f4'
      }).setOrigin(0, 0.5).setDepth(4501);

      const hpText = this.add.text(x + 38, hudTop + 82, '', {
        fontFamily: 'Arial',
        fontSize: '18px',
        color: '#a8a29e'
      }).setOrigin(0, 0.5).setDepth(4501);

      const threatText = this.add.text(x + 38, hudTop + 112, '', {
        fontFamily: 'Arial',
        fontSize: '16px',
        color: '#78716c'
      }).setOrigin(0, 0.5).setDepth(4501);

      this.partyHud.push({ unit, hpText, threatText });
    });

    this.enemyHudText = this.add.text(width - 92, hudTop + 45, '', {
      fontFamily: 'Arial',
      fontSize: '18px',
      fontStyle: 'bold',
      color: '#bef264',
      align: 'right',
      lineSpacing: 5
    }).setOrigin(1, 0).setDepth(4501);

    this.timerText = this.add.text(width / 2, hudTop + 40, '0:00', {
      fontFamily: 'Arial',
      fontSize: '20px',
      fontStyle: 'bold',
      color: '#a8a29e'
    }).setOrigin(0.5, 0).setDepth(4501);

    this.supplyText = this.add.text(width / 2, hudTop + 78, `Tonics: ${GameState.inventory.healingTonic}`, {
      fontFamily: 'Arial',
      fontSize: '18px',
      color: '#fca5a5'
    }).setOrigin(0.5, 0).setDepth(4501);
  }

  startWave(index) {
    if (index >= forgottenCavernWaves.length) {
      this.finishVictory();
      return;
    }

    this.currentWaveIndex = index;
    GameState.currentRoom = index;
    const wave = forgottenCavernWaves[index];
    this.waveTitle.setText(`WAVE ${index + 1} / ${forgottenCavernWaves.length} • ${wave.name}`);
    this.showBattleMessage(`WAVE ${index + 1}: ${wave.name}`, '#fb923c');

    this.enemies = wave.enemies.map((spawn, spawnIndex) => this.createEnemy(spawn.type, spawn, spawnIndex));
    this.waveTransitioning = false;

    if (wave.boss) {
      this.showBattleMessage('BOSS INCOMING', '#f97316');
      HapticsService.heavy();
    }
  }

  createEnemy(type, spawn, spawnIndex) {
    const definition = enemies[type];
    const serial = this.enemySerial++;
    const enemy = new BattleUnit(this, {
      ...definition,
      id: `${definition.id}-${this.currentWaveIndex}-${spawnIndex}-${serial}`,
      battlefield: this.battlefield,
      arenaX: spawn.arenaX + Phaser.Math.Between(-30, 30),
      arenaY: spawn.arenaY + Phaser.Math.Between(-22, 22),
      isEnemy: true
    });
    enemy.enemyType = type;
    enemy.definition = definition;
    enemy.rewarded = false;
    this.enemyThreat.set(enemy.id, new Map(this.partyUnits.map((unit) => [unit.id, 0])));
    return enemy;
  }

  update(time, delta) {
    if (this.battleOver || this.waveTransitioning) {
      return;
    }

    const deltaSeconds = Math.min(delta / 1000, 0.05);

    this.partyUnits.forEach((unit) => unit.updateActionBar(time));
    this.enemies.forEach((enemy) => enemy.updateActionBar(time));

    const livingEnemies = this.getLivingEnemies();
    if (livingEnemies.length === 0) {
      this.completeWave();
      return;
    }

    this.updateTank(time, deltaSeconds);
    this.updateRogue(time, deltaSeconds);
    this.updateWizard(time, deltaSeconds);
    this.updateHealer(time, deltaSeconds);
    this.updateOtherPartyMembers(time, deltaSeconds);
    this.applySeparation(this.partyUnits, deltaSeconds, 62);
    this.applySeparation(livingEnemies, deltaSeconds, 78);
    this.updateEnemies(time, deltaSeconds);

    this.partyUnits.forEach((unit) => unit.clampToBattlefield(38, 20));
    livingEnemies.forEach((enemy) => enemy.clampToBattlefield(60, 20));

    this.tryUseHealingTonic(time);
    this.updateHud();

    if (this.partyUnits.every((unit) => !unit.alive)) {
      this.finishDefeat();
    }
  }


  tryUseHealingTonic(time) {
    if (GameState.inventory.healingTonic <= 0 || time - this.lastTonicUseAt < 1500) {
      return;
    }

    const target = this.partyUnits
      .filter((unit) => unit.alive && unit.hp / unit.maxHp <= 0.35)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];

    if (!target) {
      return;
    }

    this.lastTonicUseAt = time;
    GameState.inventory.healingTonic -= 1;
    const amount = Math.max(1, Math.round(target.maxHp * 0.35));
    target.heal(amount);
    target.flash(0x86efac);
    this.createFloatingText(target.x, target.y - 100, `TONIC +${amount}`, '#86efac', true);
    this.showBattleMessage(`${target.name} drinks a Healing Tonic`, '#86efac');
    HapticsService.confirm();
    saveProfile();
  }

  getLivingEnemies() {
    return this.enemies.filter((enemy) => enemy.alive);
  }

  getPrimaryTarget(unit) {
    const living = this.getLivingEnemies();
    if (living.length === 0) {
      return null;
    }

    return living.sort((a, b) => {
      const bossPriority = Number(b.enemyType === 'elderSlime') - Number(a.enemyType === 'elderSlime');
      if (bossPriority !== 0) {
        return bossPriority;
      }
      return unit.distanceTo(a) - unit.distanceTo(b);
    })[0];
  }

  updateTank(time, deltaSeconds) {
    if (!this.tank?.alive) {
      return;
    }

    const target = this.getPrimaryTarget(this.tank);
    if (!target) {
      return;
    }

    if (this.tank.abilityReady('utility', time)) {
      const ability = this.tank.abilities.utility;
      this.tank.markAbilityUsed('utility', time);
      this.getLivingEnemies().forEach((enemy) => this.addThreat(enemy, this.tank, ability.threat));
      this.createFloatingText(this.tank.x, this.tank.y - 82, 'CHALLENGE!', '#60a5fa', false, 'buff');
    }

    const desired = this.tactics.getTankPosition(this.tank, target);
    if (!this.tank.isBusy(time) && this.tank.distanceToPoint(desired.x, desired.y) > 26) {
      this.tank.moveToward(desired.x, desired.y, deltaSeconds, 18);
    }

    if (this.tank.distanceTo(target) <= this.tank.attackRange + 20) {
      if (this.tank.abilityReady('primary', time)) {
        this.beginDamageAbility(this.tank, target, 'primary', time, 'melee');
      } else if (this.tank.canAttack(time)) {
        this.beginBasicAttack(this.tank, target, time, 'melee');
      }
    }
  }

  updateRogue(time, deltaSeconds) {
    if (!this.rogue?.alive) {
      return;
    }
    const target = this.getPrimaryTarget(this.rogue);
    if (!target) {
      return;
    }

    if (this.tryEvadeTelegraph(this.rogue, deltaSeconds)) {
      return;
    }

    const desired = this.tactics.getMeleePosition(this.rogue, target);
    if (!this.rogue.isBusy(time) && this.rogue.distanceToPoint(desired.x, desired.y) > 25) {
      this.rogue.moveToward(desired.x, desired.y, deltaSeconds, 16);
    }

    if (this.rogue.distanceTo(target) <= this.rogue.attackRange + 28) {
      if (this.rogue.abilityReady('primary', time)) {
        this.beginDamageAbility(this.rogue, target, 'primary', time, 'melee');
      } else if (this.rogue.canAttack(time)) {
        this.beginBasicAttack(this.rogue, target, time, 'melee');
      }
    }
  }

  updateWizard(time, deltaSeconds) {
    if (!this.wizard?.alive) {
      return;
    }
    const target = this.getPrimaryTarget(this.wizard);
    if (!target) {
      return;
    }

    if (this.tryEvadeTelegraph(this.wizard, deltaSeconds)) {
      return;
    }

    const desired = this.tactics.getRangedPosition(this.wizard, target);
    if (!this.wizard.isBusy(time) && this.wizard.distanceToPoint(desired.x, desired.y) > 42) {
      this.wizard.moveToward(desired.x, desired.y, deltaSeconds, 34);
    }

    if (this.wizard.distanceTo(target) <= this.wizard.attackRange) {
      if (this.wizard.abilityReady('primary', time)) {
        this.beginDamageAbility(this.wizard, target, 'primary', time, 'spell');
      } else if (this.wizard.canAttack(time)) {
        this.beginBasicAttack(this.wizard, target, time, 'spell');
      }
    }
  }

  updateHealer(time, deltaSeconds) {
    if (!this.healer?.alive) {
      return;
    }

    if (this.tryEvadeTelegraph(this.healer, deltaSeconds)) {
      return;
    }

    const injured = this.getMostInjuredPartyMember();
    if (injured && injured.hp / injured.maxHp < 0.84) {
      if (!this.healer.isBusy(time) && this.healer.distanceTo(injured) > this.healer.healRange * 0.9) {
        this.healer.moveToward(injured.arenaX, injured.arenaY, deltaSeconds, this.healer.healRange * 0.72);
      }

      if (this.healer.distanceTo(injured) <= this.healer.healRange) {
        if (injured.hp / injured.maxHp < 0.55 && this.healer.abilityReady('primary', time)) {
          this.beginHealAbility(this.healer, injured, 'primary', time);
        } else if (this.healer.canHeal(time)) {
          this.beginBasicHeal(this.healer, injured, time);
        }
      }
      return;
    }

    const anchor = this.tank?.alive ? this.tank : this.partyUnits.find((unit) => unit.alive);
    if (anchor && !this.healer.isBusy(time)) {
      const desired = this.tactics.getHealerPosition(this.healer, anchor);
      if (this.healer.distanceToPoint(desired.x, desired.y) > 45) {
        this.healer.moveToward(desired.x, desired.y, deltaSeconds, 30);
      }
    }

    const target = this.getPrimaryTarget(this.healer);
    if (target && this.healer.distanceTo(target) <= this.healer.attackRange && this.healer.canAttack(time)) {
      this.beginBasicAttack(this.healer, target, time, 'holy');
    }
  }

  updateOtherPartyMembers(time, deltaSeconds) {
    this.partyUnits.forEach((unit) => {
      if (!unit.alive || [this.tank, this.healer, this.rogue, this.wizard].includes(unit)) {
        return;
      }
      const target = this.getPrimaryTarget(unit);
      if (!target) {
        return;
      }
      if (this.tryEvadeTelegraph(unit, deltaSeconds)) {
        return;
      }
      if (!unit.isBusy(time)) {
        unit.moveToward(target.arenaX, target.arenaY, deltaSeconds, unit.attackRange * 0.85);
      }
      if (unit.distanceTo(target) <= unit.attackRange && unit.canAttack(time)) {
        this.beginBasicAttack(unit, target, time, 'melee');
      }
    });
  }

  updateEnemies(time, deltaSeconds) {
    this.getLivingEnemies().forEach((enemy) => {
      const target = this.getHighestThreatTarget(enemy);
      if (!target) {
        return;
      }

      const primary = enemy.abilities?.primary;
      if (primary?.telegraph && enemy.abilityReady('primary', time) && enemy.distanceTo(target) <= 220) {
        this.beginGroundSlam(enemy, target, time, primary);
        return;
      }

      const secondary = enemy.abilities?.secondary;
      if (secondary && enemy.abilityReady('secondary', time)) {
        const rangedTarget = this.partyUnits.find((unit) => unit.alive && unit.role === 'Ranged DPS')
          ?? this.partyUnits.find((unit) => unit.alive && unit.role === 'Healer')
          ?? target;
        this.beginEnemyAbility(enemy, rangedTarget, 'secondary', time);
        return;
      }

      if (!enemy.isBusy(time) && enemy.distanceTo(target) > enemy.attackRange) {
        enemy.moveToward(target.arenaX, target.arenaY, deltaSeconds, enemy.attackRange * 0.82);
      }

      if (enemy.distanceTo(target) <= enemy.attackRange + 8 && enemy.canAttack(time)) {
        this.beginBasicAttack(enemy, target, time, 'enemy');
      }
    });
  }

  beginBasicAttack(attacker, target, time, attackType) {
    if (!attacker.startAction('Attack', time, attacker.attackWindup)) {
      return;
    }

    attacker.lastAttackAt = time;
    this.time.delayedCall(attacker.attackWindup, () => {
      if (!attacker.alive || !target.alive || this.battleOver || attacker.pendingAction?.name !== 'Attack') {
        return;
      }
      if (attacker.distanceTo(target) <= attacker.attackRange + 28) {
        this.resolveDamage(attacker, target, attacker.attackPower, attackType, attacker.threatMultiplier, 'Attack');
      }
      attacker.finishAction();
    });
  }

  beginDamageAbility(attacker, target, key, time, attackType) {
    const ability = attacker.abilities[key];
    if (!ability || !attacker.startAction(ability.name, time, ability.windup)) {
      return;
    }

    attacker.markAbilityUsed(key, time);

    this.time.delayedCall(ability.windup, () => {
      if (!attacker.alive || !target.alive || this.battleOver || attacker.pendingAction?.name !== ability.name) {
        return;
      }
      const rangePadding = attackType === 'spell' ? 50 : 30;
      if (attacker.distanceTo(target) <= attacker.attackRange + rangePadding) {
        this.resolveDamage(
          attacker,
          target,
          ability.power,
          attackType,
          ability.threatMultiplier ?? attacker.threatMultiplier,
          ability.name
        );
      }
      attacker.finishAction();
    });
  }

  beginEnemyAbility(attacker, target, key, time) {
    const ability = attacker.abilities[key];
    if (!ability || !attacker.startAction(ability.name, time, ability.windup)) {
      return;
    }
    attacker.markAbilityUsed(key, time);

    this.time.delayedCall(ability.windup, () => {
      if (!attacker.alive || !target.alive || this.battleOver || attacker.pendingAction?.name !== ability.name) {
        return;
      }
      this.createProjectile(attacker, target, 0xa855f7);
      this.resolveDamage(attacker, target, ability.power, 'enemy', 1, ability.name);
      attacker.finishAction();
    });
  }

  beginBasicHeal(healer, target, time) {
    if (!healer.startAction('Mend', time, healer.healWindup)) {
      return;
    }
    healer.lastHealAt = time;
    this.time.delayedCall(healer.healWindup, () => {
      if (!healer.alive || !target.alive || this.battleOver || healer.pendingAction?.name !== 'Mend') {
        return;
      }
      if (healer.distanceTo(target) <= healer.healRange + 30) {
        this.resolveHeal(healer, target, healer.healPower, 'Mend');
      }
      healer.finishAction();
    });
  }

  beginHealAbility(healer, target, key, time) {
    const ability = healer.abilities[key];
    if (!ability || !healer.startAction(ability.name, time, ability.windup)) {
      return;
    }
    healer.markAbilityUsed(key, time);
    this.time.delayedCall(ability.windup, () => {
      if (!healer.alive || !target.alive || this.battleOver || healer.pendingAction?.name !== ability.name) {
        return;
      }
      if (healer.distanceTo(target) <= healer.healRange + 40) {
        this.resolveHeal(healer, target, ability.power, ability.name);
      }
      healer.finishAction();
    });
  }

  beginGroundSlam(attacker, target, time, ability) {
    if (!attacker.startAction(ability.name, time, ability.telegraph)) {
      return;
    }
    attacker.markAbilityUsed('primary', time);

    const center = { arenaX: target.arenaX, arenaY: target.arenaY };
    const screenCenter = this.battlefield.arenaToScreen(center.arenaX, center.arenaY);
    const radii = this.battlefield.getGroundEllipseRadii(ability.radius, center.arenaY);

    const warning = this.add.ellipse(screenCenter.x, screenCenter.y, radii.width * 2, radii.height * 2, 0xef4444, 0.14)
      .setStrokeStyle(8, 0xf87171, 0.88)
      .setDepth(40 + screenCenter.y);
    const inner = this.add.ellipse(screenCenter.x, screenCenter.y, 32, 16, 0xf87171, 0.35)
      .setDepth(41 + screenCenter.y);

    const telegraph = {
      arenaX: center.arenaX,
      arenaY: center.arenaY,
      radius: ability.radius,
      warning,
      inner,
      attacker
    };
    this.activeTelegraphs.push(telegraph);

    this.tweens.add({
      targets: inner,
      displayWidth: radii.width * 2,
      displayHeight: radii.height * 2,
      alpha: 0.08,
      duration: ability.telegraph,
      ease: 'Linear'
    });

    this.time.delayedCall(ability.telegraph, () => {
      if (!attacker.alive || this.battleOver) {
        this.removeTelegraph(telegraph);
        attacker.finishAction();
        return;
      }

      HapticsService.heavy();
      this.partyUnits.filter((unit) => unit.alive).forEach((unit) => {
        if (unit.distanceToPoint(center.arenaX, center.arenaY) <= ability.radius) {
          this.resolveDamage(attacker, unit, ability.power, 'enemy', 1, ability.name, false);
        }
      });

      const burst = this.add.ellipse(screenCenter.x, screenCenter.y, radii.width * 0.8, radii.height * 0.8, 0xef4444, 0.42)
        .setDepth(45 + screenCenter.y);
      this.tweens.add({
        targets: burst,
        displayWidth: radii.width * 2.6,
        displayHeight: radii.height * 2.6,
        alpha: 0,
        duration: 260,
        onComplete: () => burst.destroy()
      });

      this.removeTelegraph(telegraph);
      attacker.finishAction();
    });
  }

  tryEvadeTelegraph(unit, deltaSeconds) {
    if (!this.tactics.shouldAvoidMechanics(unit) || !unit.alive || this.activeTelegraphs.length === 0) {
      return false;
    }

    const danger = this.activeTelegraphs.find((telegraph) => unit.distanceToPoint(telegraph.arenaX, telegraph.arenaY) < telegraph.radius + 40);
    if (!danger) {
      return false;
    }

    unit.finishAction();
    unit.moveAwayFrom(danger.arenaX, danger.arenaY, deltaSeconds, danger.radius + 90);
    return true;
  }

  removeTelegraph(telegraph) {
    this.activeTelegraphs = this.activeTelegraphs.filter((item) => item !== telegraph);
    telegraph.warning?.destroy();
    telegraph.inner?.destroy();
  }

  rollCritical(attacker, allowCrit = true) {
    return allowCrit && Math.random() < (attacker.critChance ?? 0);
  }

  resolveDamage(attacker, target, baseAmount, attackType, threatMultiplier = 1, abilityName = 'Attack', allowCrit = true) {
    const critical = this.rollCritical(attacker, allowCrit);
    const amount = Math.round(baseAmount * (critical ? attacker.critMultiplier : 1));
    target.takeDamage(amount);

    const flashColor = attackType === 'spell'
      ? 0x60a5fa
      : attackType === 'holy'
        ? 0xfde68a
        : attackType === 'enemy'
          ? 0xf87171
          : 0xffffff;
    target.flash(flashColor);

    if (!attacker.isEnemy) {
      this.getLivingEnemies().forEach((enemy) => {
        if (enemy === target) {
          this.addThreat(enemy, attacker, amount * threatMultiplier);
        }
      });
    }

    if (attackType === 'spell' || attackType === 'holy') {
      this.createProjectile(attacker, target, attackType === 'holy' ? 0xfde68a : 0x60a5fa);
    } else {
      this.createMeleePulse(target, critical ? 0xfbbf24 : 0xffffff);
    }

    const prefix = critical ? 'CRIT ' : '';
    this.createFloatingText(target.x, target.y - 82, `${prefix}-${amount}`, '#ef4444', critical, 'damage');

    if (!target.alive && target.isEnemy) {
      this.handleEnemyDeath(target);
    }
  }

  resolveHeal(healer, target, baseAmount, abilityName) {
    const critical = this.rollCritical(healer, true);
    const amount = Math.round(baseAmount * (critical ? healer.critMultiplier : 1));
    const before = target.hp;
    target.heal(amount);
    const effectiveHealing = target.hp - before;

    target.flash(0x86efac);
    this.createProjectile(healer, target, 0x86efac);
    this.createFloatingText(target.x, target.y - 82, `+${effectiveHealing}${critical ? '!' : ''}`, '#22c55e', critical, 'healing');

    this.getLivingEnemies().forEach((enemy) => this.addThreat(enemy, healer, effectiveHealing * 0.45));
  }

  handleEnemyDeath(enemy) {
    if (enemy.rewarded) {
      return;
    }
    enemy.rewarded = true;
    const definition = enemy.definition;
    this.earnedGold += Phaser.Math.Between(definition.goldMin ?? 0, definition.goldMax ?? 0);
  }

  addThreat(enemy, unit, amount) {
    if (!enemy?.isEnemy || !unit || unit.isEnemy) {
      return;
    }
    const table = this.enemyThreat.get(enemy.id);
    if (!table) {
      return;
    }
    table.set(unit.id, (table.get(unit.id) ?? 0) + Math.max(0, amount));
  }

  getHighestThreatTarget(enemy) {
    const living = this.partyUnits.filter((unit) => unit.alive);
    if (living.length === 0) {
      return null;
    }
    const table = this.enemyThreat.get(enemy.id) ?? new Map();
    return living.sort((a, b) => {
      const diff = (table.get(b.id) ?? 0) - (table.get(a.id) ?? 0);
      if (Math.abs(diff) > 0.01) {
        return diff;
      }
      return enemy.distanceTo(a) - enemy.distanceTo(b);
    })[0];
  }

  getCombinedThreat(unit) {
    let total = 0;
    this.getLivingEnemies().forEach((enemy) => {
      total += this.enemyThreat.get(enemy.id)?.get(unit.id) ?? 0;
    });
    return total;
  }

  applySeparation(units, deltaSeconds, minimumDistance) {
    const living = units.filter((unit) => unit.alive);
    for (let i = 0; i < living.length; i += 1) {
      for (let j = i + 1; j < living.length; j += 1) {
        const first = living[i];
        const second = living[j];
        const distance = first.distanceTo(second);
        if (distance === 0 || distance >= minimumDistance) {
          continue;
        }
        const direction = new Phaser.Math.Vector2(first.arenaX - second.arenaX, first.arenaY - second.arenaY).normalize();
        const push = (minimumDistance - distance) * 2.3 * deltaSeconds;
        first.setArenaPosition(first.arenaX + direction.x * push, first.arenaY + direction.y * push);
        second.setArenaPosition(second.arenaX - direction.x * push, second.arenaY - direction.y * push);
      }
    }
  }

  getMostInjuredPartyMember() {
    return this.partyUnits
      .filter((unit) => unit.alive && unit.hp < unit.maxHp)
      .sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0] ?? null;
  }

  createProjectile(attacker, target, color) {
    const projectile = this.add.circle(attacker.x, attacker.y, 9, color).setDepth(4000);
    this.tweens.add({
      targets: projectile,
      x: target.x,
      y: target.y,
      duration: 180,
      ease: 'Linear',
      onComplete: () => projectile.destroy()
    });
  }

  createMeleePulse(target, color = 0xffffff) {
    const pulse = this.add.ellipse(target.x, target.y + 8, 48, 24, color, 0.25).setDepth(4000);
    this.tweens.add({
      targets: pulse,
      displayWidth: 120,
      displayHeight: 60,
      alpha: 0,
      duration: 120,
      onComplete: () => pulse.destroy()
    });
  }

  createFloatingText(x, y, text, color, critical = false) {
    const label = this.add.text(x, y, text, {
      fontFamily: 'Arial',
      fontSize: critical ? '52px' : '34px',
      fontStyle: 'bold',
      color,
      stroke: '#000000',
      strokeThickness: critical ? 8 : 5
    }).setOrigin(0.5).setDepth(4200);

    if (critical) {
      label.setScale(1.18);
    }

    this.tweens.add({
      targets: label,
      y: y - (critical ? 86 : 60),
      scale: critical ? 1 : 0.96,
      alpha: 0,
      duration: critical ? 1050 : 760,
      ease: 'Cubic.Out',
      onComplete: () => label.destroy()
    });
  }

  showBattleMessage(text, color = '#ffffff') {
    const { width, height } = this.scale;
    const label = this.add.text(width / 2, height * 0.16, text, {
      fontFamily: 'Arial',
      fontSize: '38px',
      fontStyle: 'bold',
      color,
      stroke: '#000000',
      strokeThickness: 6
    }).setOrigin(0.5).setDepth(5000).setAlpha(0);

    this.tweens.add({
      targets: label,
      alpha: 1,
      y: height * 0.18,
      duration: 180,
      yoyo: true,
      hold: 650,
      onComplete: () => label.destroy()
    });
  }

  completeWave() {
    if (this.waveTransitioning || this.battleOver) {
      return;
    }
    this.waveTransitioning = true;
    this.activeTelegraphs.forEach((telegraph) => this.removeTelegraph(telegraph));
    this.showBattleMessage('WAVE CLEARED', '#bef264');

    this.enemies.forEach((enemy) => {
      this.tweens.add({
        targets: enemy.container,
        alpha: 0,
        duration: 500,
        onComplete: () => enemy.container.destroy()
      });
    });

    if (this.currentWaveIndex + 1 >= forgottenCavernWaves.length) {
      this.time.delayedCall(900, () => this.finishVictory());
    } else {
      this.time.delayedCall(1200, () => this.startWave(this.currentWaveIndex + 1));
    }
  }

  updateHud() {
    this.partyHud?.forEach(({ unit, hpText, threatText }) => {
      hpText.setText(unit.alive ? `${Math.ceil(unit.hp)} / ${unit.maxHp} HP` : 'DOWN');
      threatText.setText(unit.alive ? `Threat ${Math.round(this.getCombinedThreat(unit))}` : '');
    });

    if (this.enemyHudText) {
      const lines = this.getLivingEnemies().slice(0, 4).map((enemy) => {
        const target = this.getHighestThreatTarget(enemy);
        return `${enemy.name}: ${Math.ceil(enemy.hp)}/${enemy.maxHp}\n→ ${target?.name ?? '-'}`;
      });
      this.enemyHudText.setText(lines.join('\n'));
    }

    if (this.timerText) {
      this.timerText.setText(formatDuration(Date.now() - (GameState.run.startedAt || Date.now())));
    }
    if (this.supplyText) {
      this.supplyText.setText(`Tonics: ${GameState.inventory.healingTonic}`);
    }
  }

  finishVictory() {
    if (this.battleOver) {
      return;
    }
    this.battleOver = true;
    const gold = Math.max(1, this.earnedGold);
    GameState.gold += gold;
    GameState.currentRoom = forgottenCavernWaves.length;
    GameState.rewards = [{ type: 'gold', amount: gold, source: GameState.currentDelve?.name ?? 'Delve' }];
    const summary = completeExpedition();
    saveProfile();
    HapticsService.success();
    this.showResultOverlay('VICTORY', 'The first delve has been cleared.', 'COLLECT REWARDS', () => {
      HapticsService.confirm();
      this.scene.start('RewardScene');
    });
  }

  finishDefeat() {
    if (this.battleOver) {
      return;
    }
    this.battleOver = true;
    failExpedition();
    this.showResultOverlay('DEFEAT', 'The cavern wins this round.', 'RETURN TO GUILD HALL', () => {
      HapticsService.confirm();
      GameState.currentDelve = null;
      GameState.activeParty = [];
      GameState.currentRoom = 0;
      this.scene.start('TownScene');
    });
  }

  showResultOverlay(title, subtitle, buttonLabel, callback) {
    const { width, height } = this.scale;
    const centerY = height * 0.5;

    this.add.rectangle(width / 2, centerY, width * 0.78, 390, 0x0c0a09, 0.97)
      .setStrokeStyle(5, title === 'VICTORY' ? 0x84cc16 : 0x991b1b)
      .setDepth(6000);

    this.add.text(width / 2, centerY - 95, title, {
      fontFamily: 'Arial',
      fontSize: '52px',
      fontStyle: 'bold',
      color: title === 'VICTORY' ? '#bef264' : '#fca5a5'
    }).setOrigin(0.5).setDepth(6001);

    this.add.text(width / 2, centerY - 22, subtitle, {
      fontFamily: 'Arial',
      fontSize: '24px',
      color: '#d6d3d1'
    }).setOrigin(0.5).setDepth(6001);

    const button = this.add.rectangle(width / 2, centerY + 90, width * 0.58, 96, 0x44403c)
      .setInteractive({ useHandCursor: true })
      .setDepth(6001);

    this.add.text(width / 2, centerY + 90, buttonLabel, {
      fontFamily: 'Arial',
      fontSize: '25px',
      fontStyle: 'bold',
      color: '#ffffff'
    }).setOrigin(0.5).setDepth(6002);

    button.on('pointerdown', callback);
    button.on('pointerover', () => button.setFillStyle(0x57534e));
    button.on('pointerout', () => button.setFillStyle(0x44403c));
  }
}
