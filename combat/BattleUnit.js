// One BattleUnit is one combatant for this encounter. It holds current HP, mana, status
// expiry times and action cooldowns, along with the display objects that show those
// values. The roster definition is the starting information; this live unit can change
// during a fight. arenaX and arenaY are gameplay coordinates. BattlefieldGeometry turns
// them into screen pixels.

import { fontPx, UI_FONT_FAMILIES, UI_FONT_WEIGHTS } from '../config/uiTypography.js';
import Phaser from 'phaser';
import { armorReduction } from '../config/characterProgression.js';
import { characterStats } from '../game/CharacterStats.js';
import UnitSprite from './UnitSprite.js';
import { monsterDeathPose, criticalHitDirection, criticalHitPose, CRITICAL_RECOIL_MS } from './SpritePresentation.js';
import HapticsService from '../services/HapticsService.js';

import { deferUnitPresentation, deferredSprite } from './DeferredPresentation.js';

export default class BattleUnit {

  // This helper creates a combatant from its class or enemy configuration. It initializes
  // resources, cooldowns, statuses, and arena position, then builds the unit body, touch
  // target, labels, health bar, and cast bar.
  constructor(scene, config) {

    // Copy identity, class stats, and ability data into this encounter-specific combatant.
    this.scene = scene;
    this.battlefield = config.battlefield;
    this.id = config.id;
    this.spriteId = config.spriteId;
    this.name = config.name;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    this.className = config.className ?? '';
    this.shortName = config.shortName;
    this.classAbilities = config.classAbilities === true;
    this.role = config.role ?? '';
    this.color = config.color;
    this.isBoss = config.boss === true;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    this.bodyRadius = config.bodyRadius ?? (config.isEnemy ? 45 : 36);

    // Max values are the capacity; hp and mana are the resources this live unit has right
    // now. They start full and can change without changing the roster record or the class
    // definition.
    this.maxHp = config.maxHp;
    this.hp = config.maxHp;

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    this.maxMana = Math.max(0, config.maxMana ?? 0);
    this.mana = this.maxMana;
    this.manaRegen = Math.max(0, config.manaRegen ?? 0);
    this.basicHealManaCost = Math.max(0, config.basicHealManaCost ?? 0);

    // The configured speed is multiplied by the game's existing 1.5 movement pace
    // adjustment. Movement later multiplies speed by elapsed seconds, so this stays
    // consistent at different frame rates.
    this.moveSpeed = config.moveSpeed * 1.5;
    this.attackPower = config.attackPower;
    this.basicAttackDamageType = config.basicAttackDamageType ?? 'physical';

    this.statProgressionVersion = config.statProgressionVersion;
    this.minimumAccuracy = config.minimumAccuracy ?? 0;
    this.speed = config.speed ?? 100;

    for (const stat of ['level', 'strength', 'agility', 'constitution', 'intellect', 'wisdom', 'happiness', 'delvesCompleted']) {
      this[stat] = config[stat] ?? 0;
    }

    // Speed 100 means the normal action rate. Divide by 100 to get a multiplier, then
    // divide cooldown and windup by that multiplier: a higher Speed acts more often.
    // Math.max(1, speed) prevents a zero divisor.
    const actionRate = Math.max(1, this.speed) / 100;
    const stats = characterStats(config);
    this.spellDamage = stats.spellDamage;
    this.spellHealing = stats.spellHealing;

    this.hitChance = stats.hitChance;
    this.dodge = stats.dodge;
    this.block = stats.block;
    this.critChance = config.critChance ?? 0.1;
    this.critMultiplier = config.critMultiplier ?? 1.75;

    // A configured ranged reach above 180 is expanded to the logical arena diagonal. That
    // distance reaches any two arena positions. Melee keeps its authored reach;
    // perspective does not change either range.
    this.attackRange = config.attackRange > 180
      ? Math.hypot(this.battlefield.logicalWidth, this.battlefield.logicalHeight) : config.attackRange;

    // Cooldown is the wait between attempts; windup is the delay before an action
    // resolves. Both are milliseconds and both shorten with actionRate.
    this.attackCooldown = config.attackCooldown / actionRate;
    this.attackWindup = (config.attackWindup ?? 250) / actionRate;
    this.healPower = config.healPower ?? 0;
    this.healRange = config.healRange ?? 0;
    this.basicHealPower = config.basicHealPower ?? 0;

    this.basicHealRange = config.basicHealRange > 2 ? 1000 : config.basicHealRange ?? 0;
    this.healCooldown = (config.healCooldown ?? 0) / actionRate;
    this.healWindup = (config.healWindup ?? 400) / actionRate;
    this.threatMultiplier = config.threatMultiplier ?? 1;
    this.armor = config.armor ?? 0;
    this.damageTakenMultiplier = config.damageTakenMultiplier ?? 1;
    this.description = config.description ?? '';

    this.startsStealthed = config.startsStealthed === true;
    this.stealthed = this.startsStealthed;

    // Object.fromEntries turns [key, value] pairs back into an object. A later pair with
    // the same key replaces the earlier value. map builds one output entry for each input
    // entry, in the same order. The callback's return value becomes that output entry.
    // Object.entries turns own fields into [key, value] pairs so we can visit or transform
    // them.
    this.abilities = Object.fromEntries(Object.entries(config.abilities ?? {}).map(([key, ability]) => [key, {
      ...ability, cooldown: ability.cooldown / actionRate, windup: (ability.windup ?? 300) / actionRate,
      telegraph: ability.telegraph === undefined ? undefined : ability.telegraph / actionRate
    }]));

    // Start timed effects inactive. Their expiration timestamps are checked against the
    // battle clock.
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

    // Track once-per-delve effects separately from cooldowns and recent combat timestamps.
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

    if (scene.idleSimulating) {
      deferUnitPresentation(this);

      // The sprite wrapper owns the character's animation and foot anchor. The arena
      // position remains the gameplay position; this object displays it.
      this.spriteVisual = deferredSprite(UnitSprite.definitionFor(this));
      this.presentationDeferred = true;

      return;
    }

    this.createPresentation();
  }

  // Build views only for units still present when the player returns.
  createPresentation() {
    const scene = this.scene;
    this.presentationDeferred = false;
    this.hitZone = null;

    // Group the battlefield visuals so position, scale, depth, and defeat fading affect
    // the whole unit.
    this.container = scene.add.container(0, 0);

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    this.body = scene.add.circle(0, 0, this.bodyRadius, this.color)
      .setStrokeStyle(4, this.isEnemy ? 0x365314 : 0x1c1917);

    this.spriteVisual = UnitSprite.create(this);
    if (this.spriteVisual) {
      this.body.setVisible(false);
    }

    // Enlarge the invisible touch target to ease crowded melee taps.
    this.hitZone = this.spriteVisual
      ? scene.add.rectangle(0, -35, 120, 180, 0xffffff, 0.001)
      : scene.add.circle(0, 0, Math.max(this.bodyRadius + 20, this.isEnemy ? 68 : 58), 0xffffff, 0.001);

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.spriteVisual?.syncHitZone();

    const visual = this.spriteVisual;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    const topInset = visual?.definition.topFrameY ?? 0;
    const spriteTop = visual
      ? visual.image.y - (visual.image.originY * visual.image.height - topInset) * visual.definition.scale
      : -this.bodyRadius;
    const motion = visual?.definition.motion;
    const motionMargin = motion
      ? (motion.lift ?? 0) + Math.abs(spriteTop - (visual.definition.footY ?? 0)) * (motion.squish ?? 0) / 2
      : 0;

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound.
    const barY = Math.min(-this.bodyRadius, spriteTop) - (this.isEnemy ? 30 : 18) - motionMargin;
    const nameY = barY - (this.isEnemy ? 34 : 28);

    // Origin is the anchor within the object: 0 is the left/top edge, 0.5 is the center
    // and 1 is the right/bottom edge. x/y place that anchor, not necessarily the object's
    // corner.
    this.label = scene.add.text(0, nameY, this.name, {
      fontFamily: UI_FONT_FAMILIES.sans,
      fontSize: this.isEnemy ? fontPx('body34') : fontPx('body32'),
      fontStyle: UI_FONT_WEIGHTS.bold,
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    // Keep the current enemy target visible above its nameplate.
    this.targetLabel = scene.add.text(0, nameY - 36, '', {
      fontFamily: UI_FONT_FAMILIES.sans,
      fontSize: fontPx('support27'),
      fontStyle: UI_FONT_WEIGHTS.bold,
      color: '#fca5a5',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5).setVisible(this.isEnemy);

    this.actionLabel = scene.add.text(0, nameY - (this.isEnemy ? 68 : 30), '', {
      fontFamily: UI_FONT_FAMILIES.sans,
      fontSize: this.isEnemy ? fontPx('support29') : fontPx('compact24'),
      fontStyle: UI_FONT_WEIGHTS.bold,
      color: '#fde68a',
      stroke: '#000000',
      strokeThickness: 3
    }).setOrigin(0.5);

    const barWidth = this.isEnemy ? 116 : 92;

    // Keep health below the name and above the visible sprite.
    this.hpGlow = scene.add.rectangle(0, barY, barWidth + 8, 18, 0x000000, 0)
      .setStrokeStyle(5, 0xf97316, 0)
      .setVisible(!this.isEnemy);
    this.hpBack = scene.add.rectangle(0, barY, barWidth, 12, 0x1c1917);
    this.hpFill = scene.add.rectangle(-barWidth / 2, barY, barWidth, 12, 0x22c55e).setOrigin(0, 0.5);
    const castY = barY + (12 + 7) / 2 + 1;

    // Create the cast bar hidden; starting an action reveals it until the action finishes.
    this.castBack = scene.add.rectangle(0, castY, barWidth, 7, 0x0c0a09).setVisible(false);
    this.castFill = scene.add.rectangle(-barWidth / 2, castY, barWidth, 7, 0xfbbf24)
      .setOrigin(0, 0.5)
      .setVisible(false);

    this.container.add([
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

    if (this.spriteVisual) this.container.addAt(this.spriteVisual.image, 2);
    this.setStealthed(this.stealthed);
    this.syncPresentation();
  }

  // This helper shows who an enemy is targeting above its nameplate.
  setTargetName(name) {

    this.targetName = name;
    if (this.scene.idleSimulating) return;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (!this.isEnemy || !this.targetLabel?.active) return;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    this.targetLabel.setText(name ? `(${name})` : '');
  }

  // This helper exposes the displayed horizontal position for combat effects.
  get x() {

    return this.container.x;
  }

  // This helper exposes the displayed vertical position for combat effects.
  get y() {

    return this.container.y;
  }

  // This helper measures combat range in arena space, independent of perspective.
  distanceTo(target) {

    return Phaser.Math.Distance.Between(this.arenaX, this.arenaY, target.arenaX, target.arenaY);
  }

  // This helper measures how far the unit is from an arena destination.
  distanceToPoint(arenaX, arenaY) {

    return Phaser.Math.Distance.Between(this.arenaX, this.arenaY, arenaX, arenaY);
  }

  // This helper checks whether the unit is still winding up its current action.
  isBusy(time) {

    return this.pendingAction !== null && time < this.busyUntil;
  }

  // This helper requires a living, unstunned unit with no unfinished action.
  canStartAction(time) {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    return this.alive
      && time >= (this.status.stunnedUntil ?? 0)
      && !this.isBusy(time)
      && this.pendingAction === null;
  }

  // This helper prevents spell use while the spell lock is active.
  canCast(time) {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    return time >= (this.status.spellLockUntil ?? 0);
  }

  // This helper checks whether a timed combat effect is still active.
  hasStatus(key, time) {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    return time < (this.status[key] ?? 0);
  }

  // This helper begins an available action and shows its windup to the player.
  startAction(name, time, duration) {

    if (!this.canStartAction(time)) {
      return false;
    }

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    this.actionSerial = (this.actionSerial ?? 0) + 1;
    this.pendingAction = { id: this.actionSerial, name, startAt: time, duration };
    this.busyUntil = time + duration;

    if (this.scene.idleSimulating) return true;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    this.actionLabel.setText(name === 'Attack' ? '' : name);
    this.castBack.setVisible(true);
    this.castFill.setVisible(true).setScale(0, 1);

    return true;
  }

  // This helper releases the current action and clears its cast display.
  finishAction() {

    this.pendingAction = null;
    this.busyUntil = 0;
    if (this.scene.idleSimulating) return;
    this.actionLabel.setText('');
    this.castBack.setVisible(false);
    this.castFill.setVisible(false).setScale(0, 1);
  }

  // This helper shows how close the current action is to resolving.
  updateActionBar(time) {
    if (this.scene.idleSimulating) return;

    if (!this.pendingAction) {
      return;
    }

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    const elapsed = Math.max(0, time - this.pendingAction.startAt);
    const ratio = Phaser.Math.Clamp(elapsed / Math.max(1, this.pendingAction.duration), 0, 1);
    this.castFill.setScale(ratio, 1);
  }

  // This helper moves the unit in combat space and refreshes its presentation.
  setArenaPosition(arenaX, arenaY) {

    this.arenaX = arenaX;
    this.arenaY = arenaY;
    this.syncPresentation();
  }

  // This helper keeps unit placement, size, and draw order aligned with depth.
  syncPresentation() {
    if (this.scene.idleSimulating) return;

    const screenPosition = this.battlefield.arenaToScreen(this.arenaX, this.arenaY);
    const scale = this.battlefield.getUnitScale(this.arenaY);

    this.container.setPosition(screenPosition.x, screenPosition.y);
    this.container.setScale(scale);

    // Depth is drawing order, not distance or size. Higher-depth objects draw on top of
    // lower-depth objects.
    this.container.setDepth(100 + screenPosition.y);
  }

  // This helper advances toward a destination without overshooting the stop range.
  moveToward(targetX, targetY, deltaSeconds, stopDistance = 0, avoidUnits = true) {

    const distance = Phaser.Math.Distance.Between(this.arenaX, this.arenaY, targetX, targetY);
    if (distance <= stopDistance || distance === 0) {
      return;
    }

    let destination = { x: targetX, y: targetY };
    if (stopDistance > 0 && distance > stopDistance) {
      destination = { x: this.arenaX + (targetX - this.arenaX) * (distance - stopDistance) / distance,
        y: this.arenaY + (targetY - this.arenaY) * (distance - stopDistance) / distance };
    }

    // Ask for the next safe stepping stone before taking this frame's step.
    destination = this.scene?.movement?.getNavigationWaypoint(this, destination) ?? destination;
    const direction = new Phaser.Math.Vector2(destination.x - this.arenaX, destination.y - this.arenaY).normalize();

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const now = this.scene.time?.now ?? 0;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const moveBonus = now < (this.status.moveSpeedBonusUntil ?? 0) ? 1 + this.status.moveSpeedBonus : 1;
    const moveSlow = now < (this.status.moveSpeedSlowUntil ?? 0) ? 1 - this.status.moveSpeedSlow : 1;

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound.
    const travel = Math.min(this.moveSpeed * moveBonus * moveSlow * deltaSeconds,
      Phaser.Math.Distance.Between(this.arenaX, this.arenaY, destination.x, destination.y));

    this.moveBy(direction.x * travel, direction.y * travel, avoidUnits);
  }

  // This helper retreats until the unit has the requested breathing room.
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

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const now = this.scene.time?.now ?? 0;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const moveBonus = now < (this.status.moveSpeedBonusUntil ?? 0) ? 1 + this.status.moveSpeedBonus : 1;
    const moveSlow = now < (this.status.moveSpeedSlowUntil ?? 0) ? 1 - this.status.moveSpeedSlow : 1;
    const destination = this.scene?.movement?.getNavigationWaypoint(this, {
      x: this.arenaX + direction.x * (desiredDistance - distance),
      y: this.arenaY + direction.y * (desiredDistance - distance)
    }) ?? { x: this.arenaX + direction.x * (desiredDistance - distance), y: this.arenaY + direction.y * (desiredDistance - distance) };
    const route = new Phaser.Math.Vector2(destination.x - this.arenaX, destination.y - this.arenaY);

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound.
    const travel = Math.min(this.moveSpeed * moveBonus * moveSlow * deltaSeconds, route.length());
    if (route.lengthSq() > 0) route.normalize();
    this.moveBy(route.x * travel, route.y * travel);
  }

  // Combat movement shares personal-space steering. Wave returns ignore living allies
  // while still steering around fallen characters and terrain.
  moveBy(dx, dy, avoidUnits = true) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined. Math.max chooses the largest value; pairing it with Math.min can keep a
    // result inside both a lower and an upper bound. ?? uses the fallback only for null or
    // undefined. A real zero or false stays intact.
    if (this.scene.time?.now < Math.max(this.status?.rootedUntil ?? 0, this.status?.stunnedUntil ?? 0)) return;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const point = this.scene?.movement
      ? this.scene.movement.getSteeredMovementPoint(this, dx, dy, avoidUnits)
      : this.scene?.terrain?.resolveStep(this, this.arenaX + dx, this.arenaY + dy,
        this.scene.movement?.config.terrainFootRadius)
        ?? { x: this.arenaX + dx, y: this.arenaY + dy };
    this.setArenaPosition(point.x, point.y);
  }

  // This helper brings the unit back inside the playable arena bounds.
  clampToBattlefield(paddingX = 0, paddingY = 0) {

    const clamped = this.battlefield.clampPoint(this.arenaX, this.arenaY, paddingX, paddingY);
    this.arenaX = clamped.x;
    this.arenaY = clamped.y;
    this.syncPresentation();
  }

  // This helper checks whether the unit can begin another basic attack.
  canAttack(time) {

    // The condition before ? chooses the first value when true and the value after : when
    // false. ?? uses the fallback only for null or undefined. A real zero or false stays
    // intact.
    return this.canStartAction(time) && time - this.lastAttackAt >= this.attackCooldown / (time < (this.status.attackSlowUntil ?? 0) ? 1 - this.status.attackSlow : 1);
  }

  // This helper checks whether a capable healer is ready for another basic heal.
  canHeal(time) {

    return this.canStartAction(time) && this.basicHealPower > 0 && time - this.lastHealAt >= this.healCooldown;
  }

  // This helper requires an available action, enough mana, and a ready cooldown.
  abilityReady(key, time) {

    const ability = this.abilities[key];
    if (!ability || !this.canStartAction(time)) {
      return false;
    }

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    if ((ability.manaCost ?? 0) > this.mana) return false;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    return time - (this.lastAbilityAt[key] ?? -Infinity) >= ability.cooldown / (time < (this.status.attackSlowUntil ?? 0) ? 1 - this.status.attackSlow : 1);
  }

  // This helper commits the ability cooldown and its configured mana cost.
  markAbilityUsed(key, time) {

    const ability = this.abilities[key];
    this.lastAbilityAt[key] = time;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (ability?.manaCost) this.spendMana(ability.manaCost);
  }

  // This helper pays a mana cost only when the unit can afford it.
  spendMana(amount) {

    if (this.maxMana <= 0) return true;

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound. ?? uses the fallback only for null or
    // undefined. A real zero or false stays intact.
    const cost = Math.max(0, amount ?? 0);
    if (this.mana < cost) return false;
    this.mana = Math.max(0, this.mana - cost);

    return true;
  }

  // This helper replenishes living casters over time without exceeding their pool.
  regenMana(deltaSeconds) {

    if (!this.alive || this.maxMana <= 0 || this.mana >= this.maxMana || this.manaRegen <= 0) return;

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound.
    this.mana = Math.min(this.maxMana, this.mana + this.manaRegen * deltaSeconds);
  }

  // This helper keeps stealth state and the unit transparency in agreement.
  setStealthed(value) {

    this.stealthed = value === true;
    if (this.scene.idleSimulating) return;

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (this.body?.active) this.body.setAlpha(this.stealthed ? 0.55 : 1);

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    this.spriteVisual?.image.setAlpha(this.stealthed ? 0.55 : 1);
  }

  // This helper reduces incoming damage using armor and active defensive effects, then
  // subtracts it from health. It marks a defeated unit inactive and clears its current
  // action.
  takeDamage(amount, options = {}) {

    if (!this.alive) {
      return false;
    }

    // Apply armor and active damage modifiers before rounding and subtracting health.
    const now = options.time ?? this.scene.time.now;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    if (now < (this.status.immuneUntil ?? 0)) return false;
    if (now >= (this.status.temporaryHpUntil ?? Infinity)) this.status.temporaryHp = 0;

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    let adjusted = Math.max(0, amount);

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    if (this.statProgressionVersion === 2 ? options.physical !== false : !this.isEnemy) {
      const armor = now < (this.status.armorUntil ?? 0)
        ? this.armor * this.status.armorMultiplier
        : this.armor;
      const reduction = this.statProgressionVersion === 2
        ? Math.min(1, armorReduction(armor) * (options.armorBlocked ? 2 : 1)) : Math.min(0.9, armor);
      adjusted *= 1 - reduction;
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

    if (adjusted > 0 && this.status.nextHitReduction) {
      adjusted *= 1 - this.status.nextHitReduction;
      this.status.nextHitReduction = 0;
    }
    adjusted = Math.max(adjusted > 0 ? 1 : 0, Math.round(adjusted));

    if (now < (this.status.enrageUntil ?? 0)) adjusted = Math.round(adjusted * this.status.enrageIncoming);
    const absorbed = Math.min(adjusted, this.status.temporaryHp ?? 0);
    this.status.temporaryHp = (this.status.temporaryHp ?? 0) - absorbed;
    adjusted -= absorbed;
    this.hp = Math.max(0, this.hp - adjusted);

    this.updateHealthBar();

    // Cancel the action when a unit is defeated.
    if (this.hp <= 0) {
      this.defeat();
      return true;
    }

    if (amount > 0) this.spriteVisual?.play(options.blocked ? 'block' : 'hit', options.attacker);
    return false;
  }

  // Sprite-backed units use their normal animation wrapper. A combatant without a
  // supplied sheet gets the same shock on its circle body, so every unit can react.
  // Store fallback state on the display object: it is cosmetic and excluded from saves.
  playCriticalHit(attacker) {
    if (this.scene.idleSimulating) return;
    if (this.spriteVisual) this.spriteVisual.playCriticalHit(attacker);
    else this.body.criticalRecoil = { elapsed: 0, ...criticalHitDirection(this, attacker) };
  }

  // Update only the fallback body; UnitSprite advances its own shock clock. The scene
  // calls this beside the ordinary sprite update and skips it during background replay.
  updateCriticalRecoil(delta) {
    const recoil = this.body?.criticalRecoil;
    if (!recoil || this.scene.combatPaused) return;
    recoil.elapsed += Math.max(0, delta);
    const pose = criticalHitPose(recoil.elapsed, recoil.awayX, recoil.awayY);
    this.body.setPosition(pose.x, pose.y);
    if (recoil.elapsed >= CRITICAL_RECOIL_MS) this.body.criticalRecoil = null;
  }

  // Mark this combatant fallen, end its action and update the death lifecycle.
  defeat() {
    if (this.alive) this.scene.combatMembershipRevision = (this.scene.combatMembershipRevision ?? 0) + 1;

    // Pulse only for a new party death, never restored or replayed deaths.
    if (this.alive && !this.isEnemy && !this.scene.restoringBattle
      && !this.scene.game?.backgroundProgress?.isReplaying) {
      HapticsService.heavy();
    }
    this.hp = 0;
    this.alive = false;
    this.finishAction();

    if (this.scene.idleSimulating) {
      if (this.isEnemy) this.deathElapsed = 0;
      else this.stealthed = false;
      return;
    }

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.spriteVisual?.play('death');

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    this.body.setFillStyle(0x44403c, this.spriteVisual ? 0 : 1);
    if (this.isEnemy) {
      this.deathElapsed = 0;
      this.hitZone.disableInteractive();
      for (const visual of [this.label, this.targetLabel, this.actionLabel,
        this.hpBack, this.hpFill, this.castBack, this.castFill, this.hitZone]) {
        visual?.setVisible(false);
      }
    } else {
      this.setStealthed(false);
      this.spriteVisual?.image.setTint(0x777777);
      this.container.setAlpha(1);
    }

    this.updateHealthBar();
  }

  // Show the fallen unit's death feedback independently of reward bookkeeping. delta is
  // elapsed frame time in milliseconds; divide by 1000 for movement in seconds.
  updateDeathPresentation(delta) {
    if (this.alive || !this.isEnemy || this.deathElapsed === undefined) return;

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    this.deathElapsed += Math.max(0, delta);
    const pose = monsterDeathPose(this.deathElapsed);
    this.body.setAlpha(pose.alpha);

    if (!this.spriteVisual) this.body.setScale(pose.scale, pose.scale * 0.4);
  }

  // This helper revives a fallen ally with partial health and mana while preserving
  // encounter cooldowns and once-per-delve ability usage. Old statuses and orders must not
  // leave the revived unit disabled or frozen.
  revive(healthFraction = 0.5, manaFraction = 0.5) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (this.alive || this.isEnemy || this.delvesUsed?.honorSacrifice) return false;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    this.scene.combatMembershipRevision = (this.scene.combatMembershipRevision ?? 0) + 1;
    this.alive = true;

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound.
    this.hp = Math.max(1, Math.round(this.maxHp * healthFraction));
    this.mana = Math.round(this.maxMana * manaFraction);
    this.finishAction();
    Object.keys(this.status).forEach((key) => {

      this.status[key] = 0;
    });

    this.seekingRestealth = false;
    this.setStealthed(false);

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    this.body.setFillStyle(this.color, this.spriteVisual ? 0 : 1);
    this.spriteVisual?.reset();
    this.body.criticalRecoil = null;
    this.body.setPosition(0, 0);
    this.container.setAlpha(1);

    // This gives the display object an input hit area. Visible artwork alone does not make
    // an object respond to a tap.
    this.hitZone.setInteractive({ useHandCursor: true });
    this.updateHealthBar();
    return true;
  }

  // This helper restores a living unit up to its maximum health.
  heal(amount) {

    if (!this.alive) {
      return;
    }

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound.
    this.hp = Math.min(this.maxHp, this.hp + amount);
    this.updateHealthBar();
  }

  // This helper makes the unit health bar reflect its remaining health.
  updateHealthBar() {
    if (this.scene.idleSimulating) return;

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const ratio = this.maxHp > 0 ? this.hp / this.maxHp : 0;
    this.hpFill.setScale(ratio, 1);

    // Shift the health bar from green toward red as health crosses its warning thresholds.
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

  // This helper brieflies emphasize a unit when combat affects it.
  flash(color = 0xffffff) {
    if (this.scene.idleSimulating) return;

    this.body.setStrokeStyle(6, color);

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    this.spriteVisual?.image.setTintFill(color);

    // The delay is in milliseconds. Phaser calls the supplied function later on this
    // scene's clock, so pause and cleanup affect when it can run.
    this.scene.time.delayedCall(100, () => {

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      if (this.spriteVisual?.image.active) {
        if (this.alive || this.isEnemy) this.spriteVisual.image.clearTint();
        else this.spriteVisual.image.setTint(0x777777);
      }

      if (this.body?.active) {
        const selected = !this.isEnemy && this.scene.selectedUnitIds?.has(this.id);

        // The condition before ? chooses the first value when true and the value after :
        // when false.
        this.body.setStrokeStyle(selected ? 7 : 4,
          selected ? 0x60a5fa : (this.isEnemy ? 0x365314 : 0x1c1917),
          selected || !this.spriteVisual || this.isEnemy ? 1 : 0);
      }
    });
  }
}
