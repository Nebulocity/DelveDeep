import combatSpacing from '../config/combatSpacing.js';

// Shared destination selection and soft personal space for both armies.
// BattleUnit still owns movement speed and the arena-to-screen projection.
export default class CombatMovement {
  constructor(scene, config = combatSpacing) {
    this.scene = scene;
    this.config = config;
    this.slots = new Map();
    this.rangeStates = new Map();
  }

  getUnits() {
    return [...this.scene.partyUnits, ...this.scene.enemies]
      .filter(unit => unit.alive && unit.container?.active !== false);
  }

  clamp(x, y) {
    const padding = this.config.edgePadding;
    const point = this.scene.battlefield.clampPoint(x, y, padding, padding);
    return this.scene.terrain?.nearestSafePoint(point.x, point.y, padding) ?? point;
  }

  isMelee(unit) {
    return unit.isEnemy ? unit.attackRange <= this.config.meleeThreshold
      : unit.role === 'Tank' || unit.role === 'Melee DPS';
  }

  getSpacing(first, second) {
    const formationSpacing = first.isEnemy || second.isEnemy
      ? this.config.normal
      : Math.max(this.config[first.spacingMode ?? 'normal'], this.config[second.spacingMode ?? 'normal']);
    const visibleClearance = (first.bodyRadius ?? 0) + (second.bodyRadius ?? 0) + this.config.personalSpaceGap;
    return Math.max(formationSpacing, visibleClearance);
  }

  getFormationPositions(units, center, mode = 'normal') {
    const spacing = this.config[mode];
    const radius = units.length > 1 ? spacing / (2 * Math.sin(Math.PI / units.length)) : 0;
    // Clamp the center, not each offset, so arena edges cannot merge slots.
    const padding = this.config.edgePadding + radius;
    const anchor = this.scene.battlefield.clampPoint(center.x, center.y, padding, padding);
    return units.map((unit, index) => {
      const angle = -Math.PI / 2 + index * Math.PI * 2 / units.length;
      return { x: anchor.x + Math.cos(angle) * radius, y: anchor.y + Math.sin(angle) * radius };
    });
  }

  // Reduce inward travel before applying it, so pursuit cannot continually
  // overpower gentle separation. Tangential travel stays smooth and lets
  // units pass a neighbor instead of stopping head-on in a crowded approach.
  steerStep(unit, dx, dy) {
    const travel = Math.hypot(dx, dy);
    for (const other of this.getUnits()) {
      if (other === unit) continue;
      const x = unit.arenaX - other.arenaX, y = unit.arenaY - other.arenaY;
      const distance = Math.hypot(x, y);
      // Spread is a formation preference, not a wide movement obstruction.
      const spacing = Math.min(this.getSpacing(unit, other), this.config.normal);
      if (distance < 0.001 || distance >= spacing + travel) continue;
      const nx = x / distance, ny = y / distance;
      const inward = dx * nx + dy * ny;
      if (inward >= 0) continue;
      const core = spacing * this.config.personalSpaceCore;
      const allowed = Math.max(0, Math.min(1, (distance - core) / (spacing - core)));
      dx -= nx * inward * (1 - allowed);
      dy -= ny * inward * (1 - allowed);
      if (Math.abs(dx * ny - dy * nx) < travel * 0.1) {
        // Consistent right-hand passing; opposing movers choose opposite
        // world-space sides without changing their choice every frame.
        dx -= ny * travel * this.config.sidestepStrength * (1 - allowed);
        dy += nx * travel * this.config.sidestepStrength * (1 - allowed);
      }
    }
    const scale = Math.min(1, travel / (Math.hypot(dx, dy) || 1));
    const desired = this.scene.battlefield.clampPoint(
      unit.arenaX + dx * scale,
      unit.arenaY + dy * scale,
      this.config.edgePadding,
      this.config.edgePadding
    );
    return this.scene.terrain?.resolveStep(unit, desired.x, desired.y, unit.bodyRadius ?? 0) ?? desired;
  }

  getMeleeApproachPosition(unit, target, time) {
    const c = this.config;
    // A target-relative attack radius must clear both visible bodies. The
    // existing attack ranges use center points, so melee gets a small shared
    // reach allowance instead of visually entering another unit's sprite.
    const desiredRadius = Math.max(
      unit.role === 'Tank' ? c.tankRange : c.meleeRange,
      (unit.bodyRadius ?? 0) + (target.bodyRadius ?? 0) + c.personalSpaceGap
    );
    const radius = Math.min(desiredRadius, unit.attackRange + c.meleeReachPadding - c.arrival);
    for (const [owner, slot] of this.slots) {
      if (!owner.alive || owner.container?.active === false || !slot.target.alive || time - slot.usedAt > c.slotLeaseMs
        || this.scene.isPositionLocked(owner)) this.slots.delete(owner);
    }
    const position = index => {
      const angle = index * Math.PI * 2 / c.meleeSlots;
      return { x: target.arenaX + Math.cos(angle) * radius, y: target.arenaY + Math.sin(angle) * radius };
    };
    let claim = this.slots.get(unit);
    const valid = point => {
      const safe = this.clamp(point.x, point.y);
      return Math.hypot(safe.x - point.x, safe.y - point.y) < c.arrival;
    };
    if (!claim || claim.target !== target || (time >= claim.recheckAt && !valid(position(claim.index)))) {
      const others = [...this.slots.entries()].filter(([owner, slot]) => owner !== unit && slot.target === target);
      const candidates = Array.from({ length: c.meleeSlots }, (_, index) => {
        const point = position(index);
        const occupied = others.filter(([, slot]) => slot.index === index).length;
        const crowding = this.getUnits().filter(other => other !== unit && other !== target)
          .reduce((score, other) => score + Math.max(0, c.normal - Math.hypot(other.arenaX - point.x, other.arenaY - point.y)), 0);
        const flank = this.scene.tactics?.tactics?.meleePosition;
        const wrongFlank = unit.role === 'Melee DPS'
          && ((flank === 'left' && point.x > target.arenaX) || (flank === 'right' && point.x < target.arenaX));
        return { index, score: occupied * 10000 + (valid(point) ? 0 : 5000) + (wrongFlank ? c.normal : 0)
          + Math.hypot(unit.arenaX - point.x, unit.arenaY - point.y) + crowding * 2 };
      });
      candidates.sort((a, b) => a.score - b.score || a.index - b.index);
      claim = { target, index: candidates[0].index, recheckAt: time + c.slotRecheckMs };
      this.slots.set(unit, claim);
    }
    claim.usedAt = time;
    if (time >= claim.recheckAt) claim.recheckAt = time + c.slotRecheckMs;
    const point = position(claim.index);
    return this.clamp(point.x, point.y);
  }

  moveToCombatPosition(unit, target, time, delta) {
    if (!target?.alive || this.scene.isPositionLocked(unit) || !unit.canStartAction(time)) return;
    if (!this.isMelee(unit)) {
      const nearest = this.getUnits().filter(other => other.isEnemy !== unit.isEnemy)
        .sort((a, b) => unit.distanceTo(a) - unit.distanceTo(b))[0];
      const min = unit.role === 'Healer' ? this.config.healerMin : this.config.rangedMin;
      if (nearest && nearest !== target && unit.distanceTo(nearest) < min + this.config.rangeHysteresis
        && this.maintainRange(unit, nearest, delta, true)) return;
      this.maintainRange(unit, target, delta);
      return;
    }
    const point = this.getMeleeApproachPosition(unit, target, time);
    if (unit.distanceToPoint(point.x, point.y) > this.config.arrivalTolerance) {
      unit.moveToward(point.x, point.y, delta, this.config.arrival);
    }
  }

  maintainRange(unit, target, delta, retreatOnly = false) {
    const c = this.config;
    const healer = unit.role === 'Healer';
    const max = Math.min(healer ? c.healerMax : c.rangedMax, unit.attackRange - c.arrival);
    const min = Math.min(healer ? c.healerMin : c.rangedMin, max - c.rangeHysteresis * 2);
    const distance = unit.distanceTo(target);
    let state = this.rangeStates.get(unit);
    if (!state || state.target !== target) state = { target, direction: 0 };
    if (distance < min) state.direction = -1;
    else if (distance > max && !retreatOnly) state.direction = 1;
    else if ((state.direction < 0 && distance >= min + c.rangeHysteresis)
      || (state.direction > 0 && distance <= max - c.rangeHysteresis)) state.direction = 0;
    // A safety-only check must not erase the healer's approach hysteresis.
    if (retreatOnly && state.direction > 0) return false;
    this.rangeStates.set(unit, state);
    if (state.direction < 0) {
      unit.moveAwayFrom(target.arenaX, target.arenaY, delta, min + c.rangeHysteresis);
    } else if (state.direction > 0) {
      unit.moveToward(target.arenaX, target.arenaY, delta, max - c.rangeHysteresis);
    }
    return state.direction !== 0;
  }

  // Apply every pair from the same snapshot, avoiding order-dependent pushes.
  // Held allies yield only to another held ally; their settled anchors move
  // with the small correction so Hold never pulls them back into overlap.
  separate(delta) {
    const units = this.getUnits();
    const offsets = new Map(units.map(unit => [unit, { x: 0, y: 0 }]));
    const locked = unit => !unit.isEnemy && this.scene.isPositionLocked(unit);
    for (let i = 0; i < units.length; i += 1) {
      for (let j = i + 1; j < units.length; j += 1) {
        const a = units[i], b = units[j];
        const dx = a.arenaX - b.arenaX, dy = a.arenaY - b.arenaY;
        const distance = Math.hypot(dx, dy);
        const spacing = this.getSpacing(a, b);
        if (distance >= spacing) continue;
        // Stable directions also resolve exact overlap (including spawn piles).
        const angle = (i * 2.399963 + j * 1.618034);
        const nx = distance > 0.001 ? dx / distance : Math.cos(angle);
        const ny = distance > 0.001 ? dy / distance : Math.sin(angle);
        const push = (spacing - distance) * (1 - Math.exp(-this.config.separationForce * delta));
        const aLocked = locked(a), bLocked = locked(b);
        const shareA = aLocked && !bLocked ? 0 : bLocked && !aLocked ? 1 : 0.5;
        offsets.get(a).x += nx * push * shareA;
        offsets.get(a).y += ny * push * shareA;
        offsets.get(b).x -= nx * push * (1 - shareA);
        offsets.get(b).y -= ny * push * (1 - shareA);
      }
    }
    for (const unit of units) {
      const offset = offsets.get(unit);
      const length = Math.hypot(offset.x, offset.y);
      if (length < 0.001) continue;
      const scale = Math.min(1, this.config.maxSeparationSpeed * delta / length);
      const point = this.clamp(unit.arenaX + offset.x * scale, unit.arenaY + offset.y * scale);
      const anchor = this.scene.manualTargets.get(unit.id);
      if (locked(unit) && anchor && unit.distanceToPoint(anchor.x, anchor.y) <= this.config.arrivalTolerance) {
        anchor.x += point.x - unit.arenaX;
        anchor.y += point.y - unit.arenaY;
      }
      unit.setArenaPosition(point.x, point.y);
    }
  }
}
