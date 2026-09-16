import Phaser from 'phaser';

export default class BattleUnit {
  // I prepare a combatant with its stats, action state, and touchable
  // display.
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
    this.maxMana = Math.max(0, config.maxMana ?? 0);
    this.mana = this.maxMana;
    this.manaRegen = Math.max(0, config.manaRegen ?? 0);
    this.basicHealManaCost = Math.max(0, config.basicHealManaCost ?? 0);
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
    this.armor = config.armor ?? 0;
    this.damageTakenMultiplier = config.damageTakenMultiplier ?? 1;
    this.description = config.description ?? '';
    this.startsStealthed = config.startsStealthed === true;
    this.stealthed = this.startsStealthed;
    this.abilities = config.abilities ?? {};
    this.status = {
      blindUntil: 0,
      blindChance: 0,
      stunnedUntil: 0,
      damageReductionUntil: 0,
      damageReduction: 0,
      outgoingDamageReductionUntil: 0,
      outgoingDamageReduction: 0,
      damageTakenBoostUntil: 0,
      damageTakenBoost: 0,
      armorExposeUntil: 0,
      armorReduction: 0,
      damageBoostUntil: 0,
      damageBoost: 0,
      shieldUntil: 0,
      arcaneShieldUntil: 0,
      spellLockUntil: 0
    };
    this.delvesUsed = {};
    this.lastAttackAt = -Infinity;
    this.lastHealAt = -Infinity;
    this.lastAbilityAt = {};
    this.lastCombatActionAt = -Infinity;
    this.lastDealtDamageAt = -Infinity;
    this.lastTakenDamageAt = -Infinity;
    this.seekingRestealth = false;
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

    // I enlarge the invisible touch target to ease crowded melee taps.
    this.hitZone = scene.add.circle(0, 0, this.isEnemy ? 68 : 58, 0xffffff, 0.001);

    this.label = scene.add.text(0, this.isEnemy ? -70 : -82, this.name, {
      fontFamily: 'Arial',
      fontSize: this.isEnemy ? '34px' : '30px',
      fontStyle: 'bold',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    this.targetLabel = scene.add.text(0, -106, '', {
      fontFamily: 'Arial',
      fontSize: '25px',
      fontStyle: 'bold',
      color: '#fca5a5',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setVisible(this.isEnemy);

    this.actionLabel = scene.add.text(0, this.isEnemy ? -138 : -112, '', {
      fontFamily: 'Arial',
      fontSize: this.isEnemy ? '27px' : '22px',
      fontStyle: 'bold',
      color: '#fde68a',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    const barWidth = this.isEnemy ? 116 : 92;
    // I keep health below the name and above the body to avoid overlap.
    const barY = -50;
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
      this.hitZone,
      this.body,
      this.label,
      this.targetLabel,
      this.actionLabel,
      this.hpGlow,
      this.hpBack,
      this.hpFill,
      this.castBack,
      this.castFill
    ]);

    this.setStealthed(this.stealthed);
    this.syncPresentation();
  }

  // I show who an enemy is targeting so its intent is readable.
  setTargetName(name) {

    if (!this.isEnemy || !this.targetLabel?.active) return;
    this.targetLabel.setText(name ? `(${name})` : '');
  }

  // I expose the displayed horizontal position for combat effects.
  get x() {

    return this.container.x;
  }

  // I expose the displayed vertical position for combat effects.
  get y() {

    return this.container.y;
  }

  // I measure combat range in arena space, independent of perspective.
  distanceTo(target) {

    return Phaser.Math.Distance.Between(this.arenaX, this.arenaY, target.arenaX, target.arenaY);
  }

  // I measure how far the unit is from an arena destination.
  distanceToPoint(arenaX, arenaY) {

    return Phaser.Math.Distance.Between(this.arenaX, this.arenaY, arenaX, arenaY);
  }

  // I check whether the unit is still winding up its current action.
  isBusy(time) {

    return this.pendingAction !== null && time < this.busyUntil;
  }

  // I require a living, unstunned unit with no unfinished action.
  canStartAction(time) {

    return this.alive
      && time >= (this.status.stunnedUntil ?? 0)
      && !this.isBusy(time)
      && this.pendingAction === null;
  }

  // I prevent spell use while the spell lock is active.
  canCast(time) {

    return time >= (this.status.spellLockUntil ?? 0);
  }

  // I check whether a timed combat effect is still active.
  hasStatus(key, time) {

    return time < (this.status[key] ?? 0);
  }

  // I begin an available action and show its windup to the player.
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

  // I release the current action and clear its cast display.
  finishAction() {

    this.pendingAction = null;
    this.busyUntil = 0;
    this.actionLabel.setText('');
    this.castBack.setVisible(false);
    this.castFill.setVisible(false).setScale(0, 1);
  }

  // I show how close the current action is to resolving.
  updateActionBar(time) {

    if (!this.pendingAction) {
      return;
    }

    const elapsed = Math.max(0, time - this.pendingAction.startAt);
    const ratio = Phaser.Math.Clamp(elapsed / Math.max(1, this.pendingAction.duration), 0, 1);
    this.castFill.setScale(ratio, 1);
  }

  // I move the unit in combat space and refresh its presentation.
  setArenaPosition(arenaX, arenaY) {

    this.arenaX = arenaX;
    this.arenaY = arenaY;
    this.syncPresentation();
  }

  // I keep unit placement, size, and draw order aligned with depth.
  syncPresentation() {

    const screenPosition = this.battlefield.arenaToScreen(this.arenaX, this.arenaY);
    const scale = this.battlefield.getUnitScale(this.arenaY);

    this.container.setPosition(screenPosition.x, screenPosition.y);
    this.container.setScale(scale);
    this.container.setDepth(100 + screenPosition.y);
  }

  // I advance toward a destination without overshooting the stop range.
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

  // I retreat until the unit has the requested breathing room.
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

  // I bring the unit back inside the playable arena bounds.
  clampToBattlefield(paddingX = 0, paddingY = 0) {

    const clamped = this.battlefield.clampPoint(this.arenaX, this.arenaY, paddingX, paddingY);
    this.arenaX = clamped.x;
    this.arenaY = clamped.y;
    this.syncPresentation();
  }

  // I check whether the unit can begin another basic attack.
  canAttack(time) {

    return this.canStartAction(time) && time - this.lastAttackAt >= this.attackCooldown;
  }

  // I check whether a capable healer is ready for another basic heal.
  canHeal(time) {

    return this.canStartAction(time) && this.healPower > 0 && time - this.lastHealAt >= this.healCooldown;
  }

  // I require an available action, enough mana, and a ready cooldown.
  abilityReady(key, time) {

    const ability = this.abilities[key];
    if (!ability || !this.canStartAction(time)) {
      return false;
    }
    if ((ability.manaCost ?? 0) > this.mana) return false;

    return time - (this.lastAbilityAt[key] ?? -Infinity) >= ability.cooldown;
  }

  // I commit the ability cooldown and its configured mana cost.
  markAbilityUsed(key, time) {

    const ability = this.abilities[key];
    this.lastAbilityAt[key] = time;
    if (ability?.manaCost) this.spendMana(ability.manaCost);
  }

  // I pay a mana cost only when the unit can afford it.
  spendMana(amount) {

    if (this.maxMana <= 0) return true;
    const cost = Math.max(0, amount ?? 0);
    if (this.mana < cost) return false;
    this.mana = Math.max(0, this.mana - cost);
    return true;
  }

  // I replenish living casters over time without exceeding their pool.
  regenMana(deltaSeconds) {

    if (!this.alive || this.maxMana <= 0 || this.mana >= this.maxMana || this.manaRegen <= 0) return;
    this.mana = Math.min(this.maxMana, this.mana + this.manaRegen * deltaSeconds);
  }

  // I keep stealth state and the unit transparency in agreement.
  setStealthed(value) {

    this.stealthed = value === true;
    if (this.body?.active) this.body.setAlpha(this.stealthed ? 0.55 : 1);
  }

  // I apply defenses and survival effects before marking a unit defeated.
  takeDamage(amount, options = {}) {

    if (!this.alive) {
      return false;
    }

    const now = options.time ?? this.scene.time.now;
    let adjusted = Math.max(0, amount);

    if (!this.isEnemy) {
      adjusted *= Math.max(0, 1 - this.armor);
    }
    adjusted *= this.damageTakenMultiplier;

    if (now < (this.status.damageReductionUntil ?? 0)) {
      adjusted *= Math.max(0, 1 - (this.status.damageReduction ?? 0));
    }
    if (now < (this.status.damageTakenBoostUntil ?? 0)) {
      adjusted *= 1 + (this.status.damageTakenBoost ?? 0);
    }
    if (now < (this.status.shieldUntil ?? 0)) {
      adjusted *= 0.35;
    }
    if (now < (this.status.arcaneShieldUntil ?? 0)) {
      adjusted *= options.ranged ? 0 : 0.55;
    }

    adjusted = Math.max(adjusted > 0 ? 1 : 0, Math.round(adjusted));
    this.hp = Math.max(0, this.hp - adjusted);

    // I allow one successful death escape per delve; failed rolls
    // leave the escape unused.
    if (this.hp <= 0 && this.className === 'Barbarian' && !this.delvesUsed.shrugDeath) {
      const chance = Math.min(0.8, 0.02 * Math.max(1, this.level ?? 1));
      if (Math.random() < chance) {
        this.delvesUsed.shrugDeath = true;
        this.hp = Math.max(1, Math.round(this.maxHp * 0.10));
        this.scene.createFloatingText?.(this.x, this.y - 110, 'SHRUG IT OFF!', '#fb923c', true);
      }
    }

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

  // I restore a living unit up to its maximum health.
  heal(amount) {

    if (!this.alive) {
      return;
    }

    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.updateHealthBar();
  }

  // I make the unit health bar reflect its remaining health.
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

  // I briefly emphasize a unit when combat affects it.
  flash(color = 0xffffff) {

    this.body.setStrokeStyle(6, color);
    this.scene.time.delayedCall(100, () => {

      if (this.body?.active) {
        this.body.setStrokeStyle(4, this.isEnemy ? 0x365314 : 0x1c1917);
      }
    });
  }
}
