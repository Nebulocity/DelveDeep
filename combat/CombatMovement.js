// We pick legal movement destinations here and steer around other combatants. A requested
// point is not automatically a safe point: the arena boundary, terrain and unit foot size
// all matter. Maps remember destinations and range decisions per unit. WeakMap caches can
// forget a unit after nothing else refers to it, which helps avoid stale paths.

import combatSpacing from '../config/combatSpacing.js';
import { arenaDistance } from '../config/combatRanges.js';
import { beneficialZones, positionZoneValue, zoneAttackRate, zoneMoveSpeed } from './BeneficialZones.js';
import { damageEstimate } from './AbilityUsefulness.js';
import { createTacticalContext } from './TacticalUsefulness.js';

// This class picks safe destinations and keeps units from crowding each other. BattleUnit
// still controls movement speed and screen projection.
export default class CombatMovement {

  // We set up this instance's starting state. Values stored on this belong to this
  // instance and can be reused by its other methods. scene is the Phaser screen that owns
  // the objects, clock and input used here. config supplies this instance's settings; the
  // caller chooses those values.
  constructor(scene, config = combatSpacing) {
    this.scene = scene;
    this.config = config;

    // A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
    // object; get/set read and write that same key.
    this.slots = new Map();
    this.rangeStates = new Map();

    // WeakMap stores object references without keeping unused objects alive. That is
    // useful for temporary per-object bookkeeping.
    this.paths = new WeakMap();
    this.zoneChoices = new WeakMap();
  }

  // Collect living, active combatants that have finished their landing.
  getLivingCombatUnits() {

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place. ... expands these entries into the new list or call. It
    // does not deep-copy the objects inside.
    return [...this.scene.partyUnits, ...this.scene.enemies]
      .filter(unit => unit.alive && !unit.landing && unit.container?.active !== false);
  }

  // Collect fallen party members still present on this battlefield.
  getFallenPartyUnits() {

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    return this.scene.partyUnits.filter(unit => !unit.alive && unit.container?.active !== false);
  }

  // Planning and execution share the same footprint, foot projection and tolerance.
  // Keep these observations local to one search; bodies and warnings can move afterward.
  rushClearanceContext(unit, target) {
    return { target, blockers: [...this.getLivingCombatUnits(), ...this.getFallenPartyUnits()]
      .filter(other => other !== unit).map(other => ({ other,
        clearance: Math.max((unit.bodyRadius ?? 0) + (other.bodyRadius ?? 0) + this.config.personalSpaceGap,
          Math.min(this.getRequiredUnitSpacing(unit, other), this.config.normal)) })),
      warnings: (this.scene.activeTelegraphs ?? []).filter(warning => warning.autoAvoid !== false) };
  }

  rushFloorBlock(unit, point) {
    const terrain = this.scene.terrain;
    const foot = terrain?.getUnitFootPoint(unit, point.x, point.y) ?? point;
    if (!this.scene.battlefield.containsArenaPoint(point.x, point.y, this.config.edgePadding)
      || !this.scene.battlefield.containsArenaPoint(foot.x, foot.y, this.config.terrainFootRadius))
      return { reason: 'floor_edge', point };
    if (terrain?.isUnitBlocked(unit, point.x, point.y, this.config.terrainFootRadius)) {
      const zone = terrain.blockedZones.find(area => terrain.containsPoint(area, foot.x, foot.y));
      return { reason: 'terrain', blockerId: zone?.id, point };
    }
    return null;
  }

  rushBodyBlock(other, target) {
    return { reason: other === target ? 'target_footprint' : other.alive ? 'dynamic_body' : 'fallen_body',
      blockerId: other.id, blockerName: other.name, blockerType: other.isEnemy ? 'enemy' : 'ally' };
  }

  rushStandingBlock(unit, point, context) {
    const floor = this.rushFloorBlock(unit, point);
    if (floor) return floor;
    const body = context.blockers.find(({ other, clearance }) => arenaDistance(other, point) < clearance - .25);
    if (body) return this.rushBodyBlock(body.other, context.target);
    const warning = context.warnings.find(area => arenaDistance(point, area) < area.radius + (unit.bodyRadius ?? 20) + 25);
    return warning ? { reason: 'warning', blockerId: warning.id ?? warning.attacker?.id, point } : null;
  }

  rushSegmentBlock(unit, start, end, context) {
    const dx = end.x - start.x, dy = end.y - start.y, length = Math.hypot(dx, dy);

    // A zero-time launch callback has no movement segment to collide with.
    if (length <= .001) return null;
    for (const { other, clearance } of context.blockers) {
      const projection = ((other.arenaX - start.x) * dx + (other.arenaY - start.y) * dy) / (length * length);
      const closest = { x: start.x + dx * Math.max(0, Math.min(1, projection)),
        y: start.y + dy * Math.max(0, Math.min(1, projection)) };
      const initial = arenaDistance(other, start);

      // A crowded origin may separate, but cannot move deeper into an existing overlap.
      if (arenaDistance(other, closest) < Math.min(clearance, initial) - .25)
        return this.rushBodyBlock(other, context.target);
    }
    const count = Math.ceil(length / 12);
    for (let index = 1; index <= count; index++) {
      const point = { x: start.x + dx * index / count, y: start.y + dy * index / count };
      const floor = this.rushFloorBlock(unit, point);
      if (floor) return floor;
      const warning = context.warnings.find(area => arenaDistance(point, area)
        < Math.min(area.radius + (unit.bodyRadius ?? 20) + 25, arenaDistance(start, area) - .25));
      if (warning) return { reason: 'warning', blockerId: warning.id ?? warning.attacker?.id, point };
    }
    return null;
  }

  // Use the ordinary navigator's 48-unit stepping-stone spacing, with a small local
  // A* budget and exact destination. This never changes walking paths or range caches.
  getRushRoute(unit, destination, maxDistance, context, budget = { remaining: 64 }) {
    const start = { x: unit.arenaX, y: unit.arenaY };
    const blocked = this.rushStandingBlock(unit, destination, context);
    if (blocked) return { blocked: { ...blocked, stage: 'landing' } };
    const direct = arenaDistance(start, destination);
    if (direct > maxDistance + .001) return { blocked: { reason: 'travel_budget', stage: 'reach' } };
    const obstruction = this.rushSegmentBlock(unit, start, destination, context);
    if (!obstruction) return { waypoints: [destination], distance: direct };
    const limit = Math.min(maxDistance, direct + Math.min(160, direct * .5 + 48));
    const open = [{ x: start.x, y: start.y, id: '0,0', ix: 0, iy: 0, cost: 0, score: direct, previous: null }];
    const costs = new Map([['0,0', 0]]);
    let visits = 0;
    while (open.length && visits < 64 && budget.remaining > 0) {
      open.sort((a, b) => a.score - b.score || a.cost - b.cost);
      const current = open.shift();
      if (current.cost > costs.get(current.id)) continue;
      visits++; budget.remaining--;
      const remaining = arenaDistance(current, destination);
      if (current.cost + remaining <= limit + .001 && !this.rushSegmentBlock(unit, current, destination, context)) {
        const chain = [destination];
        for (let node = current; node.previous; node = node.previous) chain.unshift({ x: node.x, y: node.y });
        const waypoints = [];
        let from = start, index = 0;
        while (index < chain.length && waypoints.length < 6) {
          let last = index;
          for (let next = chain.length - 1; next > index; next--) {
            if (!this.rushSegmentBlock(unit, from, chain[next], context)) { last = next; break; }
          }
          waypoints.push(chain[last]); from = chain[last]; index = last + 1;
        }
        if (index < chain.length) return { blocked: { ...obstruction, routeLimit: 'waypoints' } };
        let distance = 0; from = start;
        for (const point of waypoints) { distance += arenaDistance(from, point); from = point; }
        return { waypoints, distance };
      }
      for (let ix = -1; ix <= 1; ix++) for (let iy = -1; iy <= 1; iy++) {
        if (!ix && !iy) continue;
        const next = { ix: current.ix + ix, iy: current.iy + iy };
        next.x = start.x + next.ix * 48; next.y = start.y + next.iy * 48;
        next.id = next.ix + ',' + next.iy;
        next.cost = current.cost + Math.hypot(ix, iy) * 48;
        next.score = next.cost + arenaDistance(next, destination);
        if (next.score > limit + .001 || next.cost >= (costs.get(next.id) ?? Infinity)
          || this.rushStandingBlock(unit, next, context) || this.rushSegmentBlock(unit, current, next, context)) continue;
        costs.set(next.id, next.cost);
        open.push({ ...next, previous: current });
      }
    }
    return { blocked: { ...obstruction, routeLimit: budget.remaining <= 0 ? 'decision_budget' : 'search_limit' } };
  }

  // Clamp the requested point and ask terrain for a nearby legal destination. unit is the
  // live combatant, with current resources and arena position.
  getSafeArenaPoint(arenaX, arenaY, unit = null) {
    const edgePadding = this.config.edgePadding;
    const clampedPoint = this.scene.battlefield.clampPoint(arenaX, arenaY, edgePadding, edgePadding);

    if (!unit) return this.scene.terrain?.nearestSafePoint(clampedPoint.x, clampedPoint.y) ?? clampedPoint;

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    return this.scene.terrain?.nearestSafeUnitPoint(
      unit,
      clampedPoint.x,
      clampedPoint.y,
      this.config.terrainFootRadius
    ) ?? clampedPoint;
  }

  // Normalize a new actor's placement once, before combat movement begins.
  validateUnitPosition(unit) {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    let safePosition = this.scene.terrain?.nearestSafeUnitPoint(
      unit,
      unit.arenaX,
      unit.arenaY,
      this.config.terrainFootRadius
    ) ?? this.scene.battlefield.clampPoint(unit.arenaX, unit.arenaY, this.config.edgePadding, this.config.edgePadding);

    // Placement repair runs only on spawn, before this actor starts combat. Never
    // move existing actors, and never turn this into a mid-combat repulsion pass.
    const blockers = [...this.getLivingCombatUnits(), ...this.getFallenPartyUnits()].filter(other => other !== unit);
    const clear = point => !this.rushFloorBlock(unit, point)
      && blockers.every(other => arenaDistance(other, point) >= this.getCollisionSpacing(unit, other));
    if (!clear(safePosition)) {
      let found = null;
      for (let radius = 24; radius <= 288 && !found; radius += 24) {
        for (let index = 0; index < 16; index++) {
          const angle = index * Math.PI / 8;
          const point = { x: safePosition.x + Math.cos(angle) * radius, y: safePosition.y + Math.sin(angle) * radius };
          if (clear(point)) { found = point; break; }
        }
      }
      if (found) safePosition = found;
    }
    unit.setArenaPosition(safePosition.x, safePosition.y);

    return safePosition;
  }

  // Classify reach from enemy attack range or the party member's melee role.
  isMeleeUnit(unit) {

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    return unit.isEnemy ? unit.attackRange <= this.config.meleeThreshold
      : unit.role === 'Tank' || unit.role === 'Melee DPS';
  }

  // Combine formation preference with both units' visible clearance requirements.
  getRequiredUnitSpacing(firstUnit, secondUnit) {

    // The condition before ? chooses the first value when true and the value after : when
    // false. Math.max chooses the largest value; pairing it with Math.min can keep a
    // result inside both a lower and an upper bound. ?? uses the fallback only for null or
    // undefined. A real zero or false stays intact.
    const formationSpacing = firstUnit.isEnemy || secondUnit.isEnemy
      ? this.config.normal
      : Math.max(
        this.config[firstUnit.spacingMode ?? 'normal'],
        this.config[secondUnit.spacingMode ?? 'normal']
      );

    // Add both body radii and the desired personal gap. This stops large sprites from
    // overlapping even when their formation spacing would allow it.
    const visibleClearance = (firstUnit.bodyRadius ?? 0) + (secondUnit.bodyRadius ?? 0)
      + this.config.personalSpaceGap;

    return Math.max(formationSpacing, visibleClearance);
  }

  // We arrange the selected units on a circle around the requested center. Neighbor
  // spacing is a chord: radius = spacing / (2 * sin(PI / count)). We pad the center by
  // that radius before adding offsets, so clamping cannot push several slots onto the same
  // edge. Cosine supplies x; sine supplies y.
  getFormationPositions(units, center, mode = 'normal', anchor = null) {
    if (mode === 'spread') return this.getSpreadPositions(units, center, anchor);
    const formationSpacing = Math.max(this.config[mode], ...units.map(unit => (unit.bodyRadius ?? 0) * 2));

    // The condition before ? chooses the first value when true and the value after : when
    // false. Angles are radians. cos(angle) gives the horizontal part of a circle;
    // sin(angle) gives the vertical part. Multiplying by a radius turns those fractions
    // into offsets.
    const formationRadius = units.length > 1
      ? formationSpacing / (2 * Math.sin(Math.PI / units.length))
      : 0;

    // Clamp the center, not each offset, so arena edges cannot merge slots.
    const centerPadding = this.config.edgePadding + formationRadius;
    const formationCenter = this.scene.battlefield.clampPoint(
      center.x,
      center.y,
      centerPadding,
      centerPadding
    );

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry.
    return units.map((_unit, formationIndex) => {

      // A full turn is 2 * PI radians. Divide it evenly by the number of units. Starting
      // at -PI / 2 puts the first slot above the center. Each index advances one slot
      // around the circle; the radius sets how far from center it sits.
      const slotAngle = -Math.PI / 2 + formationIndex * Math.PI * 2 / units.length;

      // Angles are radians. cos(angle) gives the horizontal part of a circle; sin(angle)
      // gives the vertical part. Multiplying by a radius turns those fractions into
      // offsets.
      return {
        x: formationCenter.x + Math.cos(slotAngle) * formationRadius,
        y: formationCenter.y + Math.sin(slotAngle) * formationRadius
      };
    });
  }

  // Try a ten-pace ring first, then sample the authored floor when that ring will not fit.
  // Greedy spacing picks the point farthest from the center and every assigned ally.
  getSpreadPositions(units, center, anchor = null) {
    const desired = this.config.spreadDistance;
    const placed = [{ x: center.x, y: center.y }];
    const positions = new Map();
    if (anchor && units.includes(anchor)) positions.set(anchor, placed[0]);

    for (const unit of units.filter(unit => unit !== anchor)) {
      const candidates = [];

      // Angles use radians. These 48 points retain the chosen center whenever a ring fits.
      for (let index = 0; index < 48; index++) {
        const angle = index * Math.PI * 2 / 48;
        candidates.push(this.getSafeArenaPoint(center.x + Math.cos(angle) * desired,
          center.y + Math.sin(angle) * desired, unit));
      }

      // Sample continuous floor coordinates, without introducing tactical cells or snapping movement.
      for (let x = this.config.edgePadding; x < this.scene.battlefield.logicalWidth; x += 100) {
        for (let y = this.config.edgePadding; y < this.scene.battlefield.logicalHeight; y += 100) {
          candidates.push(this.getSafeArenaPoint(x, y, unit));
        }
      }

      let best = this.getSafeArenaPoint(center.x, center.y, unit);
      let bestSpacing = -1;
      let bestCenterError = Infinity;
      for (const point of candidates) {
        const spacing = Math.min(desired, ...placed.map(other => Math.hypot(point.x - other.x, point.y - other.y)));
        const centerError = Math.abs(Math.hypot(point.x - center.x, point.y - center.y) - desired);
        if (spacing > bestSpacing + 0.01 || (Math.abs(spacing - bestSpacing) <= 0.01 && centerError < bestCenterError)) {
          best = point;
          bestSpacing = spacing;
          bestCenterError = centerError;
        }
      }
      positions.set(unit, best);
      placed.push(best);
    }
    return units.map(unit => positions.get(unit));
  }

  // Only the mover may change position. Formation spacing is a destination preference;
  // authored arena body radii are the hard footprints, independent of sprite height.
  getCollisionSpacing(first, second) {
    return (first.bodyRadius ?? 0) + (second.bodyRadius ?? 0);
  }

  // Forced displacement can leave feet legal but the center inside the larger edge
  // margin. Allow voluntary steps back out of that margin, never through actual terrain.
  walkingFloorBlock(unit, point) {
    const blocked = this.rushFloorBlock(unit, point);
    if (!blocked || blocked.reason !== 'floor_edge') return blocked;
    const start = { x: unit.arenaX, y: unit.arenaY };
    if (this.rushFloorBlock(unit, start)?.reason !== 'floor_edge'
      || !this.scene.battlefield.containsArenaPoint(start.x, start.y)
      || !this.scene.battlefield.containsArenaPoint(point.x, point.y)
      || this.scene.terrain?.isUnitBlocked(unit, start.x, start.y, this.config.terrainFootRadius)
      || this.scene.terrain?.isUnitBlocked(unit, point.x, point.y, this.config.terrainFootRadius)) return blocked;
    const interior = this.getSafeArenaPoint(start.x, start.y, unit);
    return arenaDistance(point, interior) < arenaDistance(start, interior) - .001 ? null : blocked;
  }

  getCollisionStep(unit, desiredPoint, blockers) {
    const start = { x: unit.arenaX, y: unit.arenaY };
    const dx = desiredPoint.x - start.x, dy = desiredPoint.y - start.y;
    const lengthSquared = dx * dx + dy * dy;
    if (lengthSquared < .000001) return start;
    let fraction = 1;
    for (const other of blockers) {
      if (other === unit) continue;
      const radius = this.getCollisionSpacing(unit, other);
      const x = start.x - other.arenaX, y = start.y - other.arenaY;
      const distanceSquared = x * x + y * y, dot = x * dx + y * dy;

      // Initial/spawn or forced-displacement overlaps can be exited voluntarily.
      // Never deepen them or relocate the other actor to manufacture an exit.
      if (distanceSquared < radius * radius) {
        if (dot < -.001) fraction = 0;
        continue;
      }
      if (dot >= 0) continue;
      const discriminant = dot * dot - lengthSquared * (distanceSquared - radius * radius);
      if (discriminant <= 0) continue;
      const entry = (-dot - Math.sqrt(discriminant)) / lengthSquared;
      if (entry >= 0 && entry < fraction) fraction = Math.max(0, entry - .001 / Math.sqrt(lengthSquared));
    }
    const count = Math.max(1, Math.ceil(Math.sqrt(lengthSquared) * fraction / 12));
    let safe = start;
    for (let index = 1; index <= count; index++) {
      const sample = { x: start.x + dx * fraction * index / count, y: start.y + dy * fraction * index / count };
      if (this.walkingFloorBlock(unit, sample)) break;
      safe = sample;
    }
    return safe;
  }

  // Try stable forward steering, then stop at the first swept collision. Every
  // candidate checks living/fallen bodies and the whole terrain segment.
  getSteeredMovementPoint(unit, movementX, movementY, steer = true) {
    const start = { x: unit.arenaX, y: unit.arenaY };
    if (this.scene.time?.now < Math.max(unit.status?.rootedUntil ?? 0, unit.status?.stunnedUntil ?? 0)) return start;
    const distance = Math.hypot(movementX, movementY);
    if (distance < .001) return start;
    const blockers = [...this.getLivingCombatUnits(), ...this.getFallenPartyUnits()];
    const direct = this.getCollisionStep(unit, { x: start.x + movementX, y: start.y + movementY }, blockers);
    if (!steer || arenaDistance(start, direct) >= distance - .001) return direct;
    let best = direct, score = ((direct.x - start.x) * movementX + (direct.y - start.y) * movementY) / distance;
    const seed = String(unit.id ?? '').split('').reduce((total, char) => total + char.charCodeAt(0), 0);
    const side = seed % 2 ? 1 : -1;
    for (const degrees of [25, 45, 65, 85]) for (const turn of [side, -side]) {
      const angle = degrees * turn * Math.PI / 180;
      const x = movementX * Math.cos(angle) - movementY * Math.sin(angle);
      const y = movementX * Math.sin(angle) + movementY * Math.cos(angle);
      const point = this.getCollisionStep(unit, { x: start.x + x, y: start.y + y }, blockers);
      const progress = ((point.x - start.x) * movementX + (point.y - start.y) * movementY) / distance;
      if (progress > score + .001) { best = point; score = progress; }
    }
    return best;
  }

  // Move an unreachable wave return target just outside a fallen ally.
  getWaveReturnPointClearOfFallenAllies(unit, destination) {
    let safeDestination = destination;

    for (const fallenUnit of this.getFallenPartyUnits()) {
      if (fallenUnit === unit) continue;
      const clearanceRadius = this.getRequiredUnitSpacing(unit, fallenUnit);
      let directionX = safeDestination.x - fallenUnit.arenaX;
      let directionY = safeDestination.y - fallenUnit.arenaY;

      // Math.hypot calculates straight-line length from the x/y differences: square each,
      // add them, then take the square root.
      let distanceFromCorpse = Math.hypot(directionX, directionY);

      if (distanceFromCorpse >= clearanceRadius) continue;

      if (distanceFromCorpse < 0.001) {
        directionX = unit.arenaX - fallenUnit.arenaX;
        directionY = unit.arenaY - fallenUnit.arenaY;
        distanceFromCorpse = Math.hypot(directionX, directionY) || 1;
      }

      safeDestination = {
        x: fallenUnit.arenaX + directionX / distanceFromCorpse * clearanceRadius,
        y: fallenUnit.arenaY + directionY / distanceFromCorpse * clearanceRadius
      };
    }

    return safeDestination;
  }

  // Choose a reachable position near this target while making room for other units. unit
  // is the live combatant, with current resources and arena position.
  meleeSlotPoint(unit, target, index) {
    const radius = Math.min(Math.max(unit.role === 'Tank' ? this.config.tankRange : this.config.meleeRange,
      (unit.bodyRadius ?? 0) + (target.bodyRadius ?? 0) + this.config.personalSpaceGap),
    unit.attackRange + this.config.meleeReachPadding - this.config.arrival);
    const angle = index * Math.PI * 2 / this.config.meleeSlots;
    return { x: target.arenaX + Math.cos(angle) * radius, y: target.arenaY + Math.sin(angle) * radius };
  }

  // A buff is only a preference among positions that preserve role, flank and safety.
  // Straight-route sampling is conservative; normal moveToward still owns navigation.
  usefulZoneRoute(unit, target, point) {
    const distance = arenaDistance(unit, point), melee = this.isMeleeUnit(unit);
    const flank = this.scene.tactics?.tactics?.meleePosition;
    if (unit.role === 'Melee DPS' && (flank === 'left' && point.x > target.arenaX
      || flank === 'right' && point.x < target.arenaX)) return false;
    const reach = unit.attackRange + (melee ? this.config.meleeReachPadding : 0) - this.config.arrival;
    if (arenaDistance(point, target) > reach) return false;
    const blockers = [...this.getLivingCombatUnits(), ...this.getFallenPartyUnits()].filter(other => other !== unit);
    const steps = Math.max(1, Math.ceil(distance / 12));
    for (let i = 0; i <= steps; i++) {
      const sample = { x: unit.arenaX + (point.x - unit.arenaX) * i / steps,
        y: unit.arenaY + (point.y - unit.arenaY) * i / steps };
      const safe = this.getSafeArenaPoint(sample.x, sample.y, unit);
      if (arenaDistance(sample, safe) > 1 || this.scene.terrain?.isUnitBlocked(unit, sample.x, sample.y, 12)) return false;
      if ((this.scene.activeTelegraphs ?? []).some(warning => arenaDistance(sample, warning) <= warning.radius + (unit.bodyRadius ?? 20))) return false;
      if (blockers.some(other => arenaDistance(other, sample) < Math.min(arenaDistance(other, unit),
        this.getRequiredUnitSpacing(unit, other)) - .001)) return false;
      if (!melee && this.scene.getLivingEnemies().some(enemy => arenaDistance(sample, enemy)
        < (unit.role === 'Healer' ? this.config.healerMin : this.config.rangedMin))) return false;
    }
    return true;
  }

  // Called after special-action selection but before a routine basic or ordinary
  // positioning. Decisions use combat time and transient caches, never saved plans.
  tryUsefulZoneMove(unit, time, delta, basic = null) {
    if (unit.isEnemy || basic?.kind === 'mend' || unit.stealthed
      || this.scene.isPositionLocked(unit) || this.scene.manualTargets?.has(unit.id)
      || !unit.canStartAction(time) || unit.status.rootedUntil > time
      || unit.status.replacementCostRootUntil > time || unit.status.replacementChannel?.until > time) return false;
    const system = this.scene.classAbilitySystem?.replacement;
    if (!system) return false;
    if (unit.role === 'Healer' && system.allies().some(ally => ally.hp / ally.maxHp < .8)) return false;
    const target = this.scene.getPrimaryTarget(unit, false);
    if (!target) return false;
    const cached = this.zoneChoices.get(unit);
    if (cached?.next > time) {
      if (cached.target !== target || !cached.point || cached.until <= time
        || !cached.zones.some(zone => zone.owner.alive && zone.record.until > time + 500
          && zone.owner.status.replacementZones?.includes(zone.record)
          && zone.record.wave === this.scene.currentWaveIndex)
        || arenaDistance(unit, cached.point) <= this.config.arrivalTolerance
        || !this.usefulZoneRoute(unit, target, cached.point)) return false;
      unit.moveToward(cached.point.x, cached.point.y, delta, this.config.arrival);
      return true;
    }
    this.zoneChoices.set(unit, { next: time + this.config.slotRecheckMs });
    const zones = beneficialZones(system, time).filter(zone => zone.until > time + 1500
      && arenaDistance(unit, zone.point) <= zone.ability.radius + 80);
    if (!zones.length) return false;
    const context = createTacticalContext(system, time);
    if (context.risk(unit).tier >= 2) return false;
    const current = positionZoneValue(context, zones, unit, unit, damageEstimate);
    const rate = Math.max(basic?.assessment.score ?? 0, zoneAttackRate(context, unit, unit, damageEstimate));
    const melee = this.isMeleeUnit(unit);
    const points = melee ? Array.from({ length: this.config.meleeSlots }, (_, index) =>
      ({ ...this.meleeSlotPoint(unit, target, index), index })) : zones.slice(0, 4).map(zone => {
      const distance = arenaDistance(unit, zone.point);
      const fraction = Math.max(0, distance - zone.ability.radius + 24) / Math.max(1, distance);
      return { x: unit.arenaX + (zone.point.arenaX - unit.arenaX) * fraction,
        y: unit.arenaY + (zone.point.arenaY - unit.arenaY) * fraction };
    });
    let best = null, bestGain = .02;
    for (const point of points) {
      const distance = arenaDistance(unit, point);
      const travel = distance / Math.max(1, zoneMoveSpeed(unit, time));
      if (distance <= this.config.arrivalTolerance || distance > 80 || travel > .6) continue;
      if (melee && [...this.slots.entries()].some(([owner, claim]) => owner !== unit && owner.alive
        && claim.target === target && claim.index === point.index && time - claim.usedAt <= this.config.slotLeaseMs)) continue;
      if (!this.usefulZoneRoute(unit, target, point)) continue;
      const gain = positionZoneValue(context, zones, unit, point, damageEstimate, travel * 1000) - current - rate * travel;
      if (gain > bestGain) { best = point; bestGain = gain; }
    }
    if (!best) return false;
    const until = Math.min(time + 1200, ...zones.filter(zone => arenaDistance(best, zone.point) <= zone.ability.radius).map(zone => zone.until - 500));
    this.zoneChoices.set(unit, { target, point: best, until, next: time + 1500,
      zones: zones.filter(zone => positionZoneValue(context, [zone], unit, best, damageEstimate) > 0) });
    if (melee) this.slots.set(unit, { target, index: best.index, usedAt: time, recheckAt: time + this.config.slotRecheckMs });
    else this.rangeStates.set(unit, { target, direction: 0, settled: true });
    unit.moveToward(best.x, best.y, delta, this.config.arrival);
    return true;
  }

  getMeleeApproachPosition(unit, target, time) {
    const spacingConfig = this.config;

    for (const [slotOwner, slotClaim] of this.slots) {

      // ?. only follows this link when the value exists; a missing optional value gives
      // undefined.
      if (!slotOwner.alive || slotOwner.container?.active === false || !slotClaim.target.alive
        || time - slotClaim.usedAt > spacingConfig.slotLeaseMs || this.scene.isPositionLocked(slotOwner)) {
        this.slots.delete(slotOwner);
      }
    }

    const getSlotPosition = slotIndex => this.meleeSlotPoint(unit, target, slotIndex);

    let slotClaim = this.slots.get(unit);
    const isSafeSlotPosition = slotPosition => {
      const nearestSafePosition = this.getSafeArenaPoint(slotPosition.x, slotPosition.y, unit);

      // Math.hypot calculates straight-line length from the x/y differences: square each,
      // add them, then take the square root.
      return Math.hypot(nearestSafePosition.x - slotPosition.x, nearestSafePosition.y - slotPosition.y)
        < spacingConfig.arrival && [...this.getLivingCombatUnits(), ...this.getFallenPartyUnits()]
          .every(other => other === unit || arenaDistance(other, slotPosition) >= this.getCollisionSpacing(unit, other));
    };

    if (!slotClaim || slotClaim.target !== target
      || (time >= slotClaim.recheckAt && !isSafeSlotPosition(getSlotPosition(slotClaim.index)))) {

      // filter keeps entries whose callback returns true. It builds a new list and leaves
      // the original list in place. ... expands these entries into the new list or call.
      // It does not deep-copy the objects inside.
      const otherClaims = [...this.slots.entries()]
        .filter(([slotOwner, otherClaim]) => slotOwner !== unit && otherClaim.target === target);
      const system = this.scene.classAbilitySystem?.replacement;
      const zones = !unit.isEnemy && system ? beneficialZones(system, time) : [];
      const context = zones.length ? createTacticalContext(system, time) : null;
      const possibleSlots = Array.from({ length: spacingConfig.meleeSlots }, (_, slotIndex) => {
        const slotPosition = getSlotPosition(slotIndex);

        // filter keeps entries whose callback returns true. It builds a new list and
        // leaves the original list in place.
        const existingClaimCount = otherClaims
          .filter(([, otherClaim]) => otherClaim.index === slotIndex).length;

        // reduce carries an accumulated result from one entry to the next. The callback
        // returns the accumulator for the next step; the final argument supplies its
        // starting value.
        const nearbyCrowding = this.getLivingCombatUnits()
          .filter(otherUnit => otherUnit !== unit && otherUnit !== target)
          .reduce((crowdingScore, otherUnit) => {

            // Math.hypot calculates straight-line length from the x/y differences: square
            // each, add them, then take the square root.
            const distanceToOtherUnit = Math.hypot(
              otherUnit.arenaX - slotPosition.x,
              otherUnit.arenaY - slotPosition.y
            );

            // Math.max chooses the largest value; pairing it with Math.min can keep a
            // result inside both a lower and an upper bound.
            return crowdingScore + Math.max(0, spacingConfig.normal - distanceToOtherUnit);
          }, 0);

        // ?. only follows this link when the value exists; a missing optional value gives
        // undefined.
        const requestedFlank = this.scene.tactics?.tactics?.meleePosition;
        const isWrongFlank = unit.role === 'Melee DPS'
          && ((requestedFlank === 'left' && slotPosition.x > target.arenaX)
            || (requestedFlank === 'right' && slotPosition.x < target.arenaX));

        // Math.hypot calculates straight-line length from the x/y differences: square
        // each, add them, then take the square root.
        const distanceToSlot = Math.hypot(unit.arenaX - slotPosition.x, unit.arenaY - slotPosition.y);

        // The condition before ? chooses the first value when true and the value after :
        // when false.
        const safetyPenalty = isSafeSlotPosition(slotPosition) ? 0 : 5000;
        const occupiedSlotPenalty = existingClaimCount * 10000;
        const flankPenalty = isWrongFlank ? spacingConfig.normal : 0;

        return {
          index: slotIndex,
          score: occupiedSlotPenalty + safetyPenalty + flankPenalty + distanceToSlot + nearbyCrowding * 2
            - (context && !isWrongFlank && this.usefulZoneRoute(unit, target, slotPosition)
              ? Math.min(35, positionZoneValue(context, zones, unit, slotPosition, damageEstimate) * 100) : 0)
        };
      });

      // sort rearranges this array in place. A negative comparator result puts a before b;
      // positive puts it after; zero keeps them tied.
      possibleSlots.sort((firstSlot, secondSlot) => firstSlot.score - secondSlot.score
        || firstSlot.index - secondSlot.index);
      slotClaim = {
        target,
        index: possibleSlots[0].index,
        recheckAt: time + spacingConfig.slotRecheckMs
      };

      this.slots.set(unit, slotClaim);
    }

    slotClaim.usedAt = time;

    if (time >= slotClaim.recheckAt) {
      slotClaim.recheckAt = time + spacingConfig.slotRecheckMs;
    }

    const approachPosition = getSlotPosition(slotClaim.index);

    return this.getSafeArenaPoint(approachPosition.x, approachPosition.y, unit);
  }

  // Choose and follow the unit's legal approach position for its current target.
  moveToCombatPosition(unit, target, time, delta) {

    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    if (!target?.alive || this.scene.isPositionLocked(unit) || !unit.canStartAction(time)) return;

    if (this.tryEscapeCrowd(unit, delta)) return;

    if (!this.isMeleeUnit(unit)) {

      // sort rearranges this array in place. A negative comparator result puts a before b;
      // positive puts it after; zero keeps them tied. filter keeps entries whose callback
      // returns true. It builds a new list and leaves the original list in place.
      const nearestEnemy = this.getLivingCombatUnits()
        .filter(otherUnit => otherUnit.isEnemy !== unit.isEnemy)
        .sort((firstEnemy, secondEnemy) => unit.distanceTo(firstEnemy) - unit.distanceTo(secondEnemy))[0];

      // The condition before ? chooses the first value when true and the value after :
      // when false.
      const preferredMinimumRange = unit.role === 'Healer' ? this.config.healerMin : this.config.rangedMin;
      const preferredMaximumRange = unit.role === 'Healer' ? this.config.healerMax : this.config.rangedMax;

      if (nearestEnemy && nearestEnemy !== target
        && unit.distanceTo(nearestEnemy) < preferredMinimumRange + this.config.rangeHysteresis
        && this.maintainPreferredRange(unit, nearestEnemy, delta, true)) return;

      const hasSettledRange = this.rangeStates.get(unit)?.settled;
      const distanceToTarget = unit.distanceTo(target);

      if (!unit.isEnemy && (hasSettledRange || distanceToTarget <= preferredMaximumRange)
        && distanceToTarget >= preferredMinimumRange
        && distanceToTarget <= unit.attackRange - this.config.arrival) {
        this.rangeStates.set(unit, { target, direction: 0, settled: true });
        return;
      }

      this.maintainPreferredRange(unit, target, delta);

      return;
    }

    const flank = this.scene.tactics?.tactics?.meleePosition;
    const wrongFlank = unit.role === 'Melee DPS' && (flank === 'left' && unit.arenaX > target.arenaX
      || flank === 'right' && unit.arenaX < target.arenaX);
    const clear = [...this.getLivingCombatUnits(), ...this.getFallenPartyUnits()].every(other => other === unit
      || arenaDistance(unit, other) >= this.getCollisionSpacing(unit, other) - .001);
    if (!wrongFlank && clear && this.scene.isWithinAttackReach(unit, target)) return;
    const approachPosition = this.getMeleeApproachPosition(unit, target, time);

    if (unit.distanceToPoint(approachPosition.x, approachPosition.y) > this.config.arrivalTolerance) {
      unit.moveToward(approachPosition.x, approachPosition.y, delta, this.config.arrival);
    }
  }

  // Imagine the arena as graph paper. A* finds safe stepping stones around bodies and
  // walls.
  getNavigationWaypoint(unit, destination) {

    // filter keeps entries whose callback returns true. It builds a new list and leaves
    // the original list in place.
    // Route around all physical bodies, including allies and the target. The final
    // swept movement check remains authoritative when a body moves after planning.
    const fallenAllies = [...this.getFallenPartyUnits(), ...this.getLivingCombatUnits()]
      .filter(other => other !== unit);
    const bodyClearances = new Map(fallenAllies.map(other => [other, this.getCollisionSpacing(unit, other)]));
    const getBodyClearance = other => bodyClearances.get(other);

    // Automatic travel avoids entering warning circles. Player Move orders and authored
    // manual-response boss attacks keep their existing control rules.
    const warnings = !unit.isEnemy && !this.scene.manualTargets?.has(unit.id)
      && this.scene.tactics?.shouldAvoidMechanics(unit)
      ? (this.scene.activeTelegraphs ?? []).filter(warning => warning.autoAvoid !== false) : [];
    const entersWarning = point => warnings.some(warning => {
      const radius = warning.radius + (unit.bodyRadius ?? 20) + 25;
      const startDistance = Math.hypot(unit.arenaX - warning.arenaX, unit.arenaY - warning.arenaY);
      const distance = Math.hypot(point.x - warning.arenaX, point.y - warning.arenaY);
      return distance < Math.min(radius, startDistance - 1);
    });

    // Check the whole line so a long step cannot jump through a body or wall.
    const isSegmentBlocked = (segmentStart, segmentEnd) => {
      const segmentX = segmentEnd.x - segmentStart.x;
      const segmentY = segmentEnd.y - segmentStart.y;
      const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;

      // some stops with true as soon as one entry passes the check; an empty list gives
      // false.
      const crossesFallenAlly = fallenAllies.some(fallenAlly => {

        // The condition before ? chooses the first value when true and the value after :
        // when false. Math.max chooses the largest value; pairing it with Math.min can
        // keep a result inside both a lower and an upper bound.
        const closestPointRatio = segmentLengthSquared
          ? Math.max(0, Math.min(1,
            ((fallenAlly.arenaX - segmentStart.x) * segmentX
              + (fallenAlly.arenaY - segmentStart.y) * segmentY) / segmentLengthSquared))
          : 0;
        const closestX = segmentStart.x + segmentX * closestPointRatio;
        const closestY = segmentStart.y + segmentY * closestPointRatio;

        // Math.hypot calculates straight-line length from the x/y differences: square
        // each, add them, then take the square root.
        const initial = arenaDistance(fallenAlly, segmentStart);
        return Math.hypot(closestX - fallenAlly.arenaX, closestY - fallenAlly.arenaY)
          < Math.min(getBodyClearance(fallenAlly), initial) - .001;
      });

      if (crossesFallenAlly) return true;

      const segmentLength = Math.sqrt(segmentLengthSquared);

      // Math.ceil rounds upward to the next integer, including when the value has a
      // fractional part.
      const sampleCount = Math.ceil(segmentLength / 12);

      for (let sampleIndex = 1; sampleIndex <= sampleCount; sampleIndex += 1) {
        const sampleRatio = sampleIndex / sampleCount;
        const sampleX = segmentStart.x + segmentX * sampleRatio;
        const sampleY = segmentStart.y + segmentY * sampleRatio;

        if (entersWarning({ x: sampleX, y: sampleY })) return true;

        // ?. only follows this link when the value exists; a missing optional value gives
        // undefined.
        if (this.walkingFloorBlock(unit, { x: sampleX, y: sampleY })) return true;
      }

      return false;
    };

    const startPosition = { x: unit.arenaX, y: unit.arenaY };

    if (!isSegmentBlocked(startPosition, destination)) {
      this.paths.delete(unit);

      return destination;
    }

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const now = this.scene.time?.now ?? 0;
    const previousPath = this.paths.get(unit);

    // map builds one output entry for each input entry, in the same order. The callback's
    // return value becomes that output entry.
    const obstacleSignature = fallenAllies
      .map(fallenAlly => `${Math.round(fallenAlly.arenaX / 24)},${Math.round(fallenAlly.arenaY / 24)}`)
      .join('|');

    // Math.hypot calculates straight-line length from the x/y differences: square each,
    // add them, then take the square root.
    const previousStepIsUsable = previousPath
      && now < previousPath.recheckAt
      && previousPath.signature === obstacleSignature
      && Math.hypot(previousPath.destination.x - destination.x, previousPath.destination.y - destination.y) < 48
      && Math.hypot(previousPath.waypoint.x - startPosition.x, previousPath.waypoint.y - startPosition.y) > 20;

    if (previousStepIsUsable && !isSegmentBlocked(startPosition, previousPath.waypoint)) return previousPath.waypoint;

    // Put stepping stones 48 units apart. Each stone is one place the unit could stand.
    const gridStep = 48;

    // Math.ceil rounds upward to the next integer, including when the value has a
    // fractional part.
    const gridWidth = Math.ceil(this.scene.battlefield.logicalWidth / gridStep);
    const gridHeight = Math.ceil(this.scene.battlefield.logicalHeight / gridStep);
    const getCellId = (cellX, cellY) => cellY * gridWidth + cellX;
    const getCellCenter = (cellX, cellY) => ({
      x: Math.min(cellX * gridStep + gridStep / 2, this.scene.battlefield.logicalWidth),
      y: Math.min(cellY * gridStep + gridStep / 2, this.scene.battlefield.logicalHeight)
    });

    const isSafeStandingPoint = standingPoint => !fallenAllies.some(fallenAlly =>
      Math.hypot(standingPoint.x - fallenAlly.arenaX, standingPoint.y - fallenAlly.arenaY)
        < getBodyClearance(fallenAlly))
      && !entersWarning(standingPoint)
      && !this.rushFloorBlock(unit, standingPoint);

    // A* can visit the same candidate from eight neighbors. Keep its exact safety result
    // for this search only; moving bodies, warnings and floor changes are checked afresh
    // on the next call. Uint8Array stores small numbers: 0 unknown, 1 blocked, 2 safe.
    const standingSafety = new Uint8Array(gridWidth * gridHeight);
    const isSafeCell = (cellX, cellY) => {
      const id = getCellId(cellX, cellY);
      if (standingSafety[id] === 0) {
        standingSafety[id] = isSafeStandingPoint(getCellCenter(cellX, cellY)) ? 2 : 1;
      }
      return standingSafety[id] === 2;
    };

    // Math.max chooses the largest value; pairing it with Math.min can keep a result
    // inside both a lower and an upper bound. Math.floor rounds toward the smaller whole
    // number, so 3.8 becomes 3.
    const startCellX = Math.max(0, Math.min(gridWidth - 1, Math.floor(startPosition.x / gridStep)));
    const startCellY = Math.max(0, Math.min(gridHeight - 1, Math.floor(startPosition.y / gridStep)));
    const targetCellX = Math.max(0, Math.min(gridWidth - 1, Math.floor(destination.x / gridStep)));
    const targetCellY = Math.max(0, Math.min(gridHeight - 1, Math.floor(destination.y / gridStep)));
    let goalCellX = targetCellX;
    let goalCellY = targetCellY;

    if (!isSafeCell(goalCellX, goalCellY)) {

      // If the goal is inside a wall or body, use the closest safe stone nearby.
      let nearestGoalDistance = Infinity;

      for (let searchRadius = 1; searchRadius <= 6; searchRadius += 1) {
        for (let cellY = Math.max(0, targetCellY - searchRadius);
          cellY <= Math.min(gridHeight - 1, targetCellY + searchRadius); cellY += 1) {
          for (let cellX = Math.max(0, targetCellX - searchRadius);
            cellX <= Math.min(gridWidth - 1, targetCellX + searchRadius); cellX += 1) {
            const isOnSearchRing = Math.max(
              Math.abs(cellX - targetCellX),
              Math.abs(cellY - targetCellY)
            ) === searchRadius;

            if (!isOnSearchRing) continue;

            const candidatePoint = getCellCenter(cellX, cellY);
            const distanceToDestination = Math.hypot(
              candidatePoint.x - destination.x,
              candidatePoint.y - destination.y
            );

            if (distanceToDestination < nearestGoalDistance && isSafeCell(cellX, cellY)) {
              nearestGoalDistance = distanceToDestination;
              goalCellX = cellX;
              goalCellY = cellY;
            }
          }
        }

        if (nearestGoalDistance < Infinity) break;
      }
    }

    // The actor's exact position is a virtual node, not its containing cell center.
    // A legal rush landing may lie between occupied or out-of-floor grid centers.
    const startCellId = -1;
    const goalCellId = getCellId(goalCellX, goalCellY);
    const cellsToCheck = [];

    // Keep the most promising stone at the front of this little waiting line.
    const addCellToCheck = cell => {
      let cellIndex = cellsToCheck.length;
      cellsToCheck.push(cell);

      while (cellIndex > 0) {

        // Math.floor rounds toward the smaller whole number, so 3.8 becomes 3.
        const parentIndex = Math.floor((cellIndex - 1) / 2);

        if (cellsToCheck[parentIndex].score <= cell.score) break;

        cellsToCheck[cellIndex] = cellsToCheck[parentIndex];
        cellIndex = parentIndex;
      }

      cellsToCheck[cellIndex] = cell;
    };

    const takeBestCellToCheck = () => {
      const bestCell = cellsToCheck[0];
      const lastCell = cellsToCheck.pop();

      if (cellsToCheck.length) {
        let cellIndex = 0;

        while (true) {
          const leftChildIndex = cellIndex * 2 + 1;
          const rightChildIndex = leftChildIndex + 1;

          if (leftChildIndex >= cellsToCheck.length) break;

          // The condition before ? chooses the first value when true and the value after :
          // when false.
          const bestChildIndex = rightChildIndex < cellsToCheck.length
            && cellsToCheck[rightChildIndex].score < cellsToCheck[leftChildIndex].score
            ? rightChildIndex
            : leftChildIndex;

          if (cellsToCheck[bestChildIndex].score >= lastCell.score) break;

          cellsToCheck[cellIndex] = cellsToCheck[bestChildIndex];
          cellIndex = bestChildIndex;
        }

        cellsToCheck[cellIndex] = lastCell;
      }

      return bestCell;
    };

    const cheapestKnownDistance = new Map();
    const previousCellById = new Map();

    // Connect to visible legal stones within three local rings. This bounded exit
    // search handles narrow gaps without moving the actor or ignoring any bodies.
    for (let offsetY = -3; offsetY <= 3; offsetY++) {
      for (let offsetX = -3; offsetX <= 3; offsetX++) {
        const cellX = startCellX + offsetX, cellY = startCellY + offsetY;
        if (cellX < 0 || cellY < 0 || cellX >= gridWidth || cellY >= gridHeight || !isSafeCell(cellX, cellY)) continue;
        const point = getCellCenter(cellX, cellY);
        if (isSegmentBlocked(startPosition, point)) continue;
        const id = getCellId(cellX, cellY);
        const distanceWalked = arenaDistance(startPosition, point) / gridStep;
        cheapestKnownDistance.set(id, distanceWalked);
        previousCellById.set(id, startCellId);
        addCellToCheck({ cellX, cellY, id, distanceWalked,
          score: distanceWalked + Math.hypot(goalCellX - cellX, goalCellY - cellY) });
      }
    }

    // A Set keeps each value once. has checks membership without searching a list for
    // duplicate entries.
    const alreadyCheckedCellIds = new Set();
    let reachedGoal = false;

    while (cellsToCheck.length) {
      const currentCell = takeBestCellToCheck();

      if (currentCell.id === goalCellId) {
        reachedGoal = true;
        break;
      }

      if (alreadyCheckedCellIds.has(currentCell.id)) continue;

      alreadyCheckedCellIds.add(currentCell.id);

      for (let verticalOffset = -1; verticalOffset <= 1; verticalOffset += 1) {
        for (let horizontalOffset = -1; horizontalOffset <= 1; horizontalOffset += 1) {
          if (!horizontalOffset && !verticalOffset) continue;

          const nextCellX = currentCell.cellX + horizontalOffset;
          const nextCellY = currentCell.cellY + verticalOffset;

          if (nextCellX < 0 || nextCellY < 0 || nextCellX >= gridWidth || nextCellY >= gridHeight) continue;

          const nextCellCenter = getCellCenter(nextCellX, nextCellY);
          const nextCellId = getCellId(nextCellX, nextCellY);

          // The condition before ? chooses the first value when true and the value after :
          // when false.
          const segmentStart = getCellCenter(currentCell.cellX, currentCell.cellY);

        // Only step onto safe stones, and only when the line between stones is clear.
          if (alreadyCheckedCellIds.has(nextCellId)
            || !isSafeCell(nextCellX, nextCellY)
            || isSegmentBlocked(segmentStart, nextCellCenter)) continue;

          const isDiagonalStep = horizontalOffset !== 0 && verticalOffset !== 0;
          const stepDistance = isDiagonalStep ? 1.4142 : 1;
          const totalDistanceWalked = currentCell.distanceWalked + stepDistance;
          const bestKnownDistance = cheapestKnownDistance.get(nextCellId) ?? Infinity;

          if (totalDistanceWalked >= bestKnownDistance) continue;

          cheapestKnownDistance.set(nextCellId, totalDistanceWalked);
          previousCellById.set(nextCellId, currentCell.id);

          // Diagonal stones cost a little more because they are farther apart.
          addCellToCheck({
            cellX: nextCellX,
            cellY: nextCellY,
            id: nextCellId,
            distanceWalked: totalDistanceWalked,
            score: totalDistanceWalked + Math.hypot(goalCellX - nextCellX, goalCellY - nextCellY)
          });
        }
      }
    }

    // No route is a stop, not permission to repeatedly steer into the blocked goal.
    if (!reachedGoal) { this.paths.delete(unit); return startPosition; }

    // Follow the remembered stones backward, then take just the first step.
    const routeCellIds = [goalCellId];

    while (routeCellIds[routeCellIds.length - 1] !== startCellId
      && previousCellById.has(routeCellIds[routeCellIds.length - 1])) {
      routeCellIds.push(previousCellById.get(routeCellIds[routeCellIds.length - 1]));
    }

    const routePoints = routeCellIds.filter(id => id !== startCellId)
      .map(id => getCellCenter(id % gridWidth, Math.floor(id / gridWidth)));

    // Follow the farthest visible part of the real route. Never command a tiny
    // cell-center correction when a longer, equally safe segment is available.
    const waypoint = routePoints.find(point => !isSegmentBlocked(startPosition, point)) ?? startPosition;

    // Reuse this first step briefly so we do not redraw the map every frame.
    this.paths.set(unit, {
      waypoint,
      destination: { ...destination },
      signature: obstacleSignature,
      recheckAt: now + 500
    });

    return waypoint;
  }

  // Compare legal escape points against every warning and nearby opponent together.
  // Rings use continuous coordinates. No gameplay cells or shared floor are introduced.
  getEscapePoint(unit, warnings = [], desiredClearance = 180) {
    const opponents = this.getLivingCombatUnits().filter(other => other.isEnemy !== unit.isEnemy);
    const dangerAt = point => warnings.reduce((sum, warning) => sum + Math.max(0,
      warning.radius + (unit.bodyRadius ?? 20) + 45
        - Math.hypot(point.x - warning.arenaX, point.y - warning.arenaY)), 0);
    const crowdAt = point => opponents.reduce((sum, other) => sum + Math.max(0,
      desiredClearance - Math.hypot(point.x - other.arenaX, point.y - other.arenaY)), 0);
    const start = { x: unit.arenaX, y: unit.arenaY };

    // Prefer exits in the middle 60% when they offer similar safety. Warning exposure
    // still costs far more, and opponents still outrank this gentle edge preference.
    const floor = this.scene.battlefield;
    const margin = this.config.interiorMargin;
    const edgeCost = point => Math.hypot(
      Math.max(0, floor.logicalWidth * margin - point.x, point.x - floor.logicalWidth * (1 - margin)),
      Math.max(0, floor.logicalHeight * margin - point.y, point.y - floor.logicalHeight * (1 - margin)));
    const score = point => dangerAt(point) * 100 + crowdAt(point) * 2
      + Math.hypot(point.x - start.x, point.y - start.y) * 0.15 + edgeCost(point) * 0.4;
    let best = start, bestScore = score(start);
    const farthest = Math.max(desiredClearance, ...warnings.map(w => w.radius * 2 + 100));
    for (const radius of [100, 220, farthest]) {
      for (let index = 0; index < 24; index++) {

        // Cosine and sine turn an angle in radians into an evenly sampled direction.
        const angle = index * Math.PI * 2 / 24;
        const point = this.getSafeArenaPoint(start.x + Math.cos(angle) * radius,
          start.y + Math.sin(angle) * radius, unit);
        if (this.scene.terrain?.isUnitBlocked(unit, point.x, point.y, this.config.terrainFootRadius)) continue;

        // Penalize crossing a safe warning on the way out of another. Sample the route
        // as well as its endpoint, and allow decreasing exposure inside the current zone.
        let crossing = 0;
        for (const fraction of [0.25, 0.5, 0.75]) {
          const sample = { x: start.x + (point.x - start.x) * fraction,
            y: start.y + (point.y - start.y) * fraction };
          crossing += Math.max(0, dangerAt(sample) - dangerAt(start));
        }
        const candidateScore = score(point) + crossing * 100;
        if (candidateScore < bestScore) {
          best = point;
          bestScore = candidateScore;
        }
      }
    }
    return best === start ? null : best;
  }

  // A tank normally holds enemies; other roles seek an open edge of a large dog pile.
  // Emergency tank retreat requires both low health and several close opponents.
  tryEscapeCrowd(unit, delta) {
    if (unit.isEnemy && this.isMeleeUnit(unit)) return false;
    const opponents = this.getLivingCombatUnits().filter(other => other.isEnemy !== unit.isEnemy);
    const close = opponents.filter(other => Math.hypot(unit.arenaX - other.arenaX,
      unit.arenaY - other.arenaY) < 150);
    const minimumCount = this.isMeleeUnit(unit) ? 3 : 2;
    if (close.length < minimumCount || (unit.role === 'Tank' && unit.hp / unit.maxHp >= 0.35)) return false;
    const point = this.getEscapePoint(unit, [], this.isMeleeUnit(unit) ? 160 : 240);
    if (!point) return false;
    unit.moveToward(point.x, point.y, delta, this.config.arrival);
    return true;
  }

  // When the party drifts to an edge, take a slow voluntary step back toward open floor.
  // Enemies follow their usual threat targets. This changes no positions by force.
  tryReturnToInterior(unit, time, delta) {
    if (unit.isEnemy || this.scene.isPositionLocked(unit)
      || this.scene.manualTargets?.has(unit.id) || unit.criticalKnockback
      || !unit.canStartAction(time)
      || time < Math.max(unit.status?.rootedUntil ?? 0, unit.status?.stunnedUntil ?? 0)) return false;

    // Leave warning responses to the existing escape and Party Leader systems.
    if (this.scene.activeTelegraphs?.length || !this.scene.enemies.some(enemy => enemy.alive)) return false;
    const party = this.scene.partyUnits.filter(ally => ally.alive && !ally.landing);
    if (!party.length) return false;
    const floor = this.scene.battlefield;
    const margin = this.config.interiorMargin;
    const inset = point => ({
      x: Math.max(floor.logicalWidth * margin, Math.min(floor.logicalWidth * (1 - margin), point.x)),
      y: Math.max(floor.logicalHeight * margin, Math.min(floor.logicalHeight * (1 - margin), point.y))
    });

    // The average living-party position detects a drifting fight, rather than an
    // individual flanker. Logical y starts at the front; fractions work in either axis.
    const center = { x: party.reduce((sum, ally) => sum + ally.arenaX, 0) / party.length,
      y: party.reduce((sum, ally) => sum + ally.arenaY, 0) / party.length };
    const innerCenter = inset(center);
    if (Math.hypot(center.x - innerCenter.x, center.y - innerCenter.y) < 12) return false;
    const start = { x: unit.arenaX, y: unit.arenaY };
    const inner = inset(start);
    const distance = Math.hypot(inner.x - start.x, inner.y - start.y);
    if (distance < 12) return false;

    // Aim only 100 logical units ahead, preserving local navigation and body clearance.
    // Fragile roles avoid walking closer to opponents already within their safe range.
    const fraction = Math.min(1, 100 / distance);
    const point = this.getSafeArenaPoint(start.x + (inner.x - start.x) * fraction,
      start.y + (inner.y - start.y) * fraction, unit);
    if (Math.hypot(point.x - inner.x, point.y - inner.y) >= distance - 1) return false;
    if (!this.isMeleeUnit(unit)) {
      const clearance = unit.role === 'Healer' ? this.config.healerMin : this.config.rangedMin;
      if (this.scene.enemies.some(enemy => enemy.alive
        && Math.hypot(point.x - enemy.arenaX, point.y - enemy.arenaY)
          < Math.min(clearance, unit.distanceTo(enemy)) - 1)) return false;
    }
    unit.moveToward(point.x, point.y, delta * this.config.interiorReturnSpeed, this.config.arrival);
    return true;
  }

  // Approach or back away according to the unit's preferred combat distance. unit is the
  // live combatant, with current resources and arena position.
  maintainPreferredRange(unit, target, delta, retreatOnly = false) {
    const spacingConfig = this.config;
    const isHealer = unit.role === 'Healer';

    // Math.min chooses the smallest value; pairing it with Math.max can keep a result
    // inside both a lower and an upper bound. The condition before ? chooses the first
    // value when true and the value after : when false.
    const maximumAllowedRange = Math.min(
      isHealer ? spacingConfig.healerMax : spacingConfig.rangedMax,
      unit.attackRange - spacingConfig.arrival
    );
    const minimumAllowedRange = Math.min(
      isHealer ? spacingConfig.healerMin : spacingConfig.rangedMin,
      maximumAllowedRange - spacingConfig.rangeHysteresis * 2
    );

    const distanceToTarget = unit.distanceTo(target);
    let rangeState = this.rangeStates.get(unit);

    if (!rangeState || rangeState.target !== target) {
      rangeState = { target, direction: 0 };
    }

    if (distanceToTarget < minimumAllowedRange) rangeState.direction = -1;
    else if (distanceToTarget > maximumAllowedRange && !retreatOnly) rangeState.direction = 1;
    else if ((rangeState.direction < 0
      && distanceToTarget >= minimumAllowedRange + spacingConfig.rangeHysteresis)
      || (rangeState.direction > 0
        && distanceToTarget <= maximumAllowedRange - spacingConfig.rangeHysteresis)) {
      rangeState.direction = 0;
    }

    // A safety-only check must not erase the healer's approach hysteresis.
    if (retreatOnly && rangeState.direction > 0) return false;

    this.rangeStates.set(unit, rangeState);

    if (rangeState.direction < 0) {
      const escape = this.getEscapePoint(unit, [], minimumAllowedRange + spacingConfig.rangeHysteresis);
      if (escape) unit.moveToward(escape.x, escape.y, delta, spacingConfig.arrival);
    } else if (rangeState.direction > 0) {
      unit.moveToward(
        target.arenaX,
        target.arenaY,
        delta,
        maximumAllowedRange - spacingConfig.rangeHysteresis
      );
    }

    return rangeState.direction !== 0;
  }

}
