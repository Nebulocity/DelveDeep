import combatSpacing from '../config/combatSpacing.js';

// Shared destination selection and soft personal space for both armies. BattleUnit still owns movement speed and the arena-to-screen projection.
export default class CombatMovement {
  constructor(scene, config = combatSpacing) {
    this.scene = scene;
    this.config = config;
    this.slots = new Map();
    this.rangeStates = new Map();
  }

  getUnits() {
    return [...this.scene.partyUnits, ...this.scene.enemies]
      .filter(unit => unit.alive && !unit.landing && unit.container?.active !== false);
  }

  getCorpses() {
    return this.scene.partyUnits.filter(unit => !unit.alive && unit.container?.active !== false);
  }

  clamp(x, y, unit = null) {
    const padding = this.config.edgePadding;
    const point = this.scene.battlefield.clampPoint(x, y, padding, padding);
    if (!unit) return this.scene.terrain?.nearestSafePoint(point.x, point.y) ?? point;
    return this.scene.terrain?.nearestSafeUnitPoint(unit, point.x, point.y, this.config.terrainFootRadius) ?? point;
  }

  // Move a newly spawned or displaced unit to the nearest position where its feet are legal.
  validateUnitPosition(unit) {
    const point = this.scene.terrain?.nearestSafeUnitPoint(
      unit,
      unit.arenaX,
      unit.arenaY,
      this.config.terrainFootRadius
    ) ?? this.scene.battlefield.clampPoint(unit.arenaX, unit.arenaY, this.config.edgePadding, this.config.edgePadding);
    unit.setArenaPosition(point.x, point.y);
    return point;
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

  // Reduce inward travel before applying it, so pursuit cannot continually overpower gentle separation. Tangential travel stays smooth and lets units pass a neighbor instead of stopping head-on in a crowded approach.
  steerStep(unit, dx, dy, includeLiving = true) {
    if (this.scene.time?.now < Math.max(unit.status?.rootedUntil ?? 0, unit.status?.stunnedUntil ?? 0)) return { x: unit.arenaX, y: unit.arenaY };
    const travel = Math.hypot(dx, dy);
    const corpses = this.getCorpses();
    for (const other of [...(includeLiving ? this.getUnits() : []), ...corpses]) {
      if (other === unit) continue;
      const x = unit.arenaX - other.arenaX, y = unit.arenaY - other.arenaY;
      const distance = Math.hypot(x, y);
      // Spread is a formation preference, not a wide movement obstruction.
      const spacing = other.alive ? Math.min(this.getSpacing(unit, other), this.config.normal)
        : this.getSpacing(unit, other);
      if (distance < 0.001 || distance >= spacing + (other.alive ? travel : travel * 4)) continue;
      const nx = x / distance, ny = y / distance;
      const inward = dx * nx + dy * ny;
      if (inward >= 0) continue;
      if (!other.alive) {
        const side = x * dy - y * dx >= 0 ? 1 : -1;
        dx = -ny * side * travel;
        dy = nx * side * travel;
        continue;
      }
      const core = spacing * this.config.personalSpaceCore;
      const allowed = Math.max(0, Math.min(1, (distance - core) / (spacing - core)));
      dx -= nx * inward * (1 - allowed);
      dy -= ny * inward * (1 - allowed);
      if (Math.abs(dx * ny - dy * nx) < travel * 0.1) {
        // Consistent right-hand passing; opposing movers choose opposite world-space sides without changing their choice every frame.
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
    const terrainPoint = this.scene.terrain?.resolveStep(unit, desired.x, desired.y, this.config.terrainFootRadius) ?? desired;
    return this.resolveCorpseStep(unit, terrainPoint, corpses);
  }

  // Stop a movement segment at the first fallen character it would cross.
  resolveCorpseStep(unit, desired, corpses = this.getCorpses()) {
    let point = desired;
    for (const corpse of corpses) {
      if (corpse === unit) continue;
      const radius = this.getSpacing(unit, corpse);
      const startX = unit.arenaX - corpse.arenaX;
      const startY = unit.arenaY - corpse.arenaY;
      const dx = point.x - unit.arenaX;
      const dy = point.y - unit.arenaY;
      const lengthSquared = dx * dx + dy * dy;
      if (lengthSquared < 0.000001) continue;
      const startSquared = startX * startX + startY * startY;
      if (startSquared < radius * radius) continue;
      const projection = -(startX * dx + startY * dy) / lengthSquared;
      const closest = Math.max(0, Math.min(1, projection));
      const nearX = startX + dx * closest;
      const nearY = startY + dy * closest;
      if (nearX * nearX + nearY * nearY >= radius * radius) continue;
      const discriminant = Math.max(0, (startX * dx + startY * dy) ** 2
        - lengthSquared * (startSquared - radius * radius));
      const entry = Math.max(0, (-(startX * dx + startY * dy) - Math.sqrt(discriminant)) / lengthSquared);
      point = { x: unit.arenaX + dx * entry, y: unit.arenaY + dy * entry };
    }
    return point;
  }

  // Move an unreachable wave return target just outside a fallen ally.
  clearCorpseDestination(unit, destination) {
    let point = destination;
    for (const corpse of this.getCorpses()) {
      if (corpse === unit) continue;
      const radius = this.getSpacing(unit, corpse);
      let dx = point.x - corpse.arenaX;
      let dy = point.y - corpse.arenaY;
      let distance = Math.hypot(dx, dy);
      if (distance >= radius) continue;
      if (distance < 0.001) {
        dx = unit.arenaX - corpse.arenaX;
        dy = unit.arenaY - corpse.arenaY;
        distance = Math.hypot(dx, dy) || 1;
      }
      point = { x: corpse.arenaX + dx / distance * radius,
        y: corpse.arenaY + dy / distance * radius };
    }
    return point;
  }

  getMeleeApproachPosition(unit, target, time) {
    const c = this.config;
    // A target-relative attack radius must clear both visible bodies. The existing attack ranges use center points, so melee gets a small shared reach allowance instead of visually entering another unit's sprite.
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
      const safe = this.clamp(point.x, point.y, unit);
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
    return this.clamp(point.x, point.y, unit);
  }

  moveToCombatPosition(unit, target, time, delta) {
    if (!target?.alive || this.scene.isPositionLocked(unit) || !unit.canStartAction(time)) return;
    if (!this.isMelee(unit)) {
      const nearest = this.getUnits().filter(other => other.isEnemy !== unit.isEnemy)
        .sort((a, b) => unit.distanceTo(a) - unit.distanceTo(b))[0];
      const min = unit.role === 'Healer' ? this.config.healerMin : this.config.rangedMin;
      const max = unit.role === 'Healer' ? this.config.healerMax : this.config.rangedMax;
      if (nearest && nearest !== target && unit.distanceTo(nearest) < min + this.config.rangeHysteresis
        && this.maintainRange(unit, nearest, delta, true)) return;
      const settled = this.rangeStates.get(unit)?.settled;
      if (!unit.isEnemy && (settled || unit.distanceTo(target) <= max)
        && unit.distanceTo(target) >= min
        && unit.distanceTo(target) <= unit.attackRange - this.config.arrival) {
        this.rangeStates.set(unit, { target, direction: 0, settled: true });
        return;
      }
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

  // Apply every pair from the same snapshot, avoiding order-dependent pushes. Held allies yield only to another held ally; their settled anchors move with the small correction so Hold never pulls them back into overlap.
  separate(delta) {
    const living = this.getUnits();
    const units = [...living, ...this.getCorpses()];
    const offsets = new Map(living.map(unit => [unit, { x: 0, y: 0 }]));
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
        const aLocked = !a.alive || locked(a), bLocked = !b.alive || locked(b);
        const shareA = aLocked && !bLocked ? 0 : bLocked && !aLocked ? 1 : 0.5;
        if (a.alive) {
          offsets.get(a).x += nx * push * shareA;
          offsets.get(a).y += ny * push * shareA;
        }
        if (b.alive) {
          offsets.get(b).x -= nx * push * (1 - shareA);
          offsets.get(b).y -= ny * push * (1 - shareA);
        }
      }
    }
    for (const unit of living) {
      if (this.scene.time?.now < Math.max(unit.status?.rootedUntil ?? 0, unit.status?.stunnedUntil ?? 0)) continue;
      const offset = offsets.get(unit);
      const length = Math.hypot(offset.x, offset.y);
      if (length < 0.001) continue;
      const scale = Math.min(1, this.config.maxSeparationSpeed * delta / length);
      const point = this.clamp(unit.arenaX + offset.x * scale, unit.arenaY + offset.y * scale, unit);
      const anchor = this.scene.manualTargets.get(unit.id);
      if (locked(unit) && anchor && unit.distanceToPoint(anchor.x, anchor.y) <= this.config.arrivalTolerance) {
        anchor.x += point.x - unit.arenaX;
        anchor.y += point.y - unit.arenaY;
      }
      unit.setArenaPosition(point.x, point.y);
    }
  }
}
