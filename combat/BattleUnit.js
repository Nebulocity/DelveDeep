import Phaser from 'phaser';

export default class BattleUnit {
  constructor(scene, config) {
    this.scene = scene;
    this.battlefield = config.battlefield;
    this.id = config.id;
    this.name = config.name;
    this.className = config.className ?? '';
    this.role = config.role ?? '';
    this.color = config.color;
    this.maxHp = config.maxHp;
    this.hp = config.maxHp;
    this.moveSpeed = config.moveSpeed;
    this.attackPower = config.attackPower;
    this.critChance = config.critChance ?? 0.1;
    this.critMultiplier = config.critMultiplier ?? 1.75;
    this.attackRange = config.attackRange;
    this.attackCooldown = config.attackCooldown;
    this.attackWindup = config.attackWindup ?? 250;
    this.healPower = config.healPower ?? 0;
    this.healRange = config.healRange ?? 0;
    this.healCooldown = config.healCooldown ?? 0;
    this.healWindup = config.healWindup ?? 400;
    this.threatMultiplier = config.threatMultiplier ?? 1;
    this.abilities = config.abilities ?? {};
    this.lastAttackAt = -Infinity;
    this.lastHealAt = -Infinity;
    this.lastAbilityAt = {};
    this.isEnemy = config.isEnemy ?? false;
    this.alive = true;
    this.busyUntil = 0;
    this.pendingAction = null;
    this.arenaX = config.arenaX ?? config.x ?? 0;
    this.arenaY = config.arenaY ?? config.y ?? 0;

    this.container = scene.add.container(0, 0);

    this.shadow = scene.add.ellipse(0, 30, this.isEnemy ? 84 : 64, this.isEnemy ? 28 : 22, 0x000000, 0.28);
    this.body = scene.add.circle(0, 0, this.isEnemy ? 45 : 36, this.color)
      .setStrokeStyle(4, this.isEnemy ? 0x365314 : 0x1c1917);

    this.label = scene.add.text(0, this.isEnemy ? -70 : -82, this.name, {
      fontFamily: 'Arial',
      fontSize: this.isEnemy ? '34px' : '30px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    this.actionLabel = scene.add.text(0, this.isEnemy ? -102 : -112, '', {
      fontFamily: 'Arial',
      fontSize: this.isEnemy ? '27px' : '22px',
      fontStyle: 'bold',
      color: '#fde68a',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    const barWidth = this.isEnemy ? 100 : 92;
    // Party health lives where the class label used to be: under the name,
    // but above the character body so it never overlaps the unit itself.
    const barY = this.isEnemy ? 64 : -50;
    this.hpGlow = scene.add.rectangle(0, barY, barWidth + 8, 18, 0x000000, 0)
      .setStrokeStyle(5, 0xf97316, 0)
      .setVisible(!this.isEnemy);
    this.hpBack = scene.add.rectangle(0, barY, barWidth, 12, 0x1c1917);
    this.hpFill = scene.add.rectangle(-barWidth / 2, barY, barWidth, 12, 0x22c55e).setOrigin(0, 0.5);

    this.castBack = scene.add.rectangle(0, this.isEnemy ? barY + 18 : 54, barWidth, 7, 0x0c0a09).setVisible(false);
    this.castFill = scene.add.rectangle(-barWidth / 2, this.isEnemy ? barY + 18 : 54, barWidth, 7, 0xfbbf24)
      .setOrigin(0, 0.5)
      .setVisible(false);

    this.container.add([
      this.shadow,
      this.body,
      this.label,
      this.actionLabel,
      this.hpGlow,
      this.hpBack,
      this.hpFill,
      this.castBack,
      this.castFill
    ]);

    this.syncPresentation();
  }

  get x() {
    return this.container.x;
  }

  get y() {
    return this.container.y;
  }

  distanceTo(target) {
    return Phaser.Math.Distance.Between(this.arenaX, this.arenaY, target.arenaX, target.arenaY);
  }

  distanceToPoint(arenaX, arenaY) {
    return Phaser.Math.Distance.Between(this.arenaX, this.arenaY, arenaX, arenaY);
  }

  isBusy(time) {
    return this.pendingAction !== null && time < this.busyUntil;
  }

  canStartAction(time) {
    return this.alive && !this.isBusy(time) && this.pendingAction === null;
  }

  startAction(name, time, duration) {
    if (!this.canStartAction(time)) {
      return false;
    }

    this.pendingAction = { name, startAt: time, duration };
    this.busyUntil = time + duration;
    this.actionLabel.setText(name);
    this.castBack.setVisible(true);
    this.castFill.setVisible(true).setScale(0, 1);
    return true;
  }

  finishAction() {
    this.pendingAction = null;
    this.busyUntil = 0;
    this.actionLabel.setText('');
    this.castBack.setVisible(false);
    this.castFill.setVisible(false).setScale(0, 1);
  }

  updateActionBar(time) {
    if (!this.pendingAction) {
      return;
    }

    const elapsed = Math.max(0, time - this.pendingAction.startAt);
    const ratio = Phaser.Math.Clamp(elapsed / Math.max(1, this.pendingAction.duration), 0, 1);
    this.castFill.setScale(ratio, 1);
  }

  setArenaPosition(arenaX, arenaY) {
    this.arenaX = arenaX;
    this.arenaY = arenaY;
    this.syncPresentation();
  }

  syncPresentation() {
    const screenPosition = this.battlefield.arenaToScreen(this.arenaX, this.arenaY);
    const scale = this.battlefield.getUnitScale(this.arenaY);

    this.container.setPosition(screenPosition.x, screenPosition.y);
    this.container.setScale(scale);
    this.container.setDepth(100 + screenPosition.y);
  }

  moveToward(targetX, targetY, deltaSeconds, stopDistance = 0) {
    const distance = Phaser.Math.Distance.Between(this.arenaX, this.arenaY, targetX, targetY);
    if (distance <= stopDistance || distance === 0) {
      return;
    }

    const direction = new Phaser.Math.Vector2(targetX - this.arenaX, targetY - this.arenaY).normalize();
    const travel = Math.min(this.moveSpeed * deltaSeconds, Math.max(0, distance - stopDistance));

    this.arenaX += direction.x * travel;
    this.arenaY += direction.y * travel;
    this.syncPresentation();
  }

  moveAwayFrom(targetX, targetY, deltaSeconds, desiredDistance) {
    const distance = Phaser.Math.Distance.Between(this.arenaX, this.arenaY, targetX, targetY);
    if (distance >= desiredDistance) {
      return;
    }

    let direction;
    if (distance < 0.001) {
      direction = new Phaser.Math.Vector2(1, 0);
    } else {
      direction = new Phaser.Math.Vector2(this.arenaX - targetX, this.arenaY - targetY).normalize();
    }

    const travel = Math.min(this.moveSpeed * deltaSeconds, desiredDistance - distance);
    this.arenaX += direction.x * travel;
    this.arenaY += direction.y * travel;
    this.syncPresentation();
  }

  clampToBattlefield(paddingX = 0, paddingY = 0) {
    const clamped = this.battlefield.clampPoint(this.arenaX, this.arenaY, paddingX, paddingY);
    this.arenaX = clamped.x;
    this.arenaY = clamped.y;
    this.syncPresentation();
  }

  canAttack(time) {
    return this.canStartAction(time) && time - this.lastAttackAt >= this.attackCooldown;
  }

  canHeal(time) {
    return this.canStartAction(time) && this.healPower > 0 && time - this.lastHealAt >= this.healCooldown;
  }

  abilityReady(key, time) {
    const ability = this.abilities[key];
    if (!ability || !this.canStartAction(time)) {
      return false;
    }

    return time - (this.lastAbilityAt[key] ?? -Infinity) >= ability.cooldown;
  }

  markAbilityUsed(key, time) {
    this.lastAbilityAt[key] = time;
  }

  takeDamage(amount) {
    if (!this.alive) {
      return false;
    }

    this.hp = Math.max(0, this.hp - amount);
    this.updateHealthBar();

    if (this.hp <= 0) {
      this.alive = false;
      this.finishAction();
      this.body.setFillStyle(0x44403c);
      this.container.setAlpha(0.5);
      return true;
    }

    return false;
  }

  heal(amount) {
    if (!this.alive) {
      return;
    }

    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.updateHealthBar();
  }

  updateHealthBar() {
    const ratio = this.maxHp > 0 ? this.hp / this.maxHp : 0;
    this.hpFill.setScale(ratio, 1);

    let healthColor = 0x22c55e;
    if (ratio <= 0.25) {
      healthColor = 0xef4444;
    } else if (ratio <= 0.5) {
      healthColor = 0xf97316;
    } else if (ratio <= 0.75) {
      healthColor = 0xeab308;
    }

    this.hpFill.setFillStyle(healthColor);
    if (!this.isEnemy && this.hpGlow) {
      this.hpGlow.setStrokeStyle(5, healthColor, 0);
    }
  }

  flash(color = 0xffffff) {
    this.body.setStrokeStyle(6, color);
    this.scene.time.delayedCall(100, () => {
      if (this.body?.active) {
        this.body.setStrokeStyle(4, this.isEnemy ? 0x365314 : 0x1c1917);
      }
    });
  }
}
