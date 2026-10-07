import combatSpacing from '../config/combatSpacing.js';

// This class picks safe destinations and keeps units from crowding each other.
// BattleUnit still controls movement speed and screen projection.
export default class CombatMovement {
  constructor(scene, config = combatSpacing) {
    this.scene = scene;
    this.config = config;
    this.slots = new Map();
    this.rangeStates = new Map();
    this.paths = new WeakMap();
  }

  getLivingCombatUnits() {
    return [...this.scene.partyUnits, ...this.scene.enemies]
      .filter(unit => unit.alive && !unit.landing && unit.container?.active !== false);
  }

  getFallenPartyUnits() {
    return this.scene.partyUnits.filter(unit => !unit.alive && unit.container?.active !== false);
  }

  getSafeArenaPoint(arenaX, arenaY, unit = null) {
    const edgePadding = this.config.edgePadding;
    const clampedPoint = this.scene.battlefield.clampPoint(arenaX, arenaY, edgePadding, edgePadding);

    if (!unit) return this.scene.terrain?.nearestSafePoint(clampedPoint.x, clampedPoint.y) ?? clampedPoint;

    return this.scene.terrain?.nearestSafeUnitPoint(
      unit,
      clampedPoint.x,
      clampedPoint.y,
      this.config.terrainFootRadius
    ) ?? clampedPoint;
  }

  // Move a newly spawned or displaced unit to the nearest position where its feet are legal.
  validateUnitPosition(unit) {
    const safePosition = this.scene.terrain?.nearestSafeUnitPoint(
      unit,
      unit.arenaX,
      unit.arenaY,
      this.config.terrainFootRadius
    ) ?? this.scene.battlefield.clampPoint(unit.arenaX, unit.arenaY, this.config.edgePadding, this.config.edgePadding);
    unit.setArenaPosition(safePosition.x, safePosition.y);

    return safePosition;
  }

  isMeleeUnit(unit) {
    return unit.isEnemy ? unit.attackRange <= this.config.meleeThreshold
      : unit.role === 'Tank' || unit.role === 'Melee DPS';
  }

  getRequiredUnitSpacing(firstUnit, secondUnit) {
    const formationSpacing = firstUnit.isEnemy || secondUnit.isEnemy
      ? this.config.normal
      : Math.max(
        this.config[firstUnit.spacingMode ?? 'normal'],
        this.config[secondUnit.spacingMode ?? 'normal']
      );
    const visibleClearance = (firstUnit.bodyRadius ?? 0) + (secondUnit.bodyRadius ?? 0)
      + this.config.personalSpaceGap;

    return Math.max(formationSpacing, visibleClearance);
  }

  getFormationPositions(units, center, mode = 'normal') {
    const formationSpacing = this.config[mode];
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

    return units.map((_unit, formationIndex) => {
      const slotAngle = -Math.PI / 2 + formationIndex * Math.PI * 2 / units.length;

      return {
        x: formationCenter.x + Math.cos(slotAngle) * formationRadius,
        y: formationCenter.y + Math.sin(slotAngle) * formationRadius
      };
    });
  }

  // Soften steps that run into other units, then give crowded walkers room to pass.
  getSteeredMovementPoint(unit, movementX, movementY, includeLiving = true) {
    const isRootedOrStunned = this.scene.time?.now < Math.max(
      unit.status?.rootedUntil ?? 0,
      unit.status?.stunnedUntil ?? 0
    );

    if (isRootedOrStunned) return { x: unit.arenaX, y: unit.arenaY };

    const requestedDistance = Math.hypot(movementX, movementY);
    const fallenPartyUnits = this.getFallenPartyUnits();
    const nearbyUnits = [...(includeLiving ? this.getLivingCombatUnits() : []), ...fallenPartyUnits];

    for (const otherUnit of nearbyUnits) {
      if (otherUnit === unit) continue;

      const awayX = unit.arenaX - otherUnit.arenaX;
      const awayY = unit.arenaY - otherUnit.arenaY;
      const distance = Math.hypot(awayX, awayY);

      // Spread is a formation preference, not a wide movement obstruction.
      const safeSpacing = otherUnit.alive
        ? Math.min(this.getRequiredUnitSpacing(unit, otherUnit), this.config.normal)
        : this.getRequiredUnitSpacing(unit, otherUnit);
      const lookAheadDistance = otherUnit.alive ? requestedDistance : requestedDistance * 4;

      if (distance < 0.001 || distance >= safeSpacing + lookAheadDistance) continue;

      const awayDirectionX = awayX / distance;
      const awayDirectionY = awayY / distance;
      const movementTowardUnit = movementX * awayDirectionX + movementY * awayDirectionY;

      if (movementTowardUnit >= 0) continue;

      if (!otherUnit.alive) {
        const passingSide = awayX * movementY - awayY * movementX >= 0 ? 1 : -1;
        movementX = -awayDirectionY * passingSide * requestedDistance;
        movementY = awayDirectionX * passingSide * requestedDistance;
        continue;
      }

      const personalSpaceCore = safeSpacing * this.config.personalSpaceCore;
      const inwardMovementAllowed = Math.max(0, Math.min(1,
        (distance - personalSpaceCore) / (safeSpacing - personalSpaceCore)));

      movementX -= awayDirectionX * movementTowardUnit * (1 - inwardMovementAllowed);
      movementY -= awayDirectionY * movementTowardUnit * (1 - inwardMovementAllowed);

      if (Math.abs(movementX * awayDirectionY - movementY * awayDirectionX) < requestedDistance * 0.1) {
        // Keep a steady passing side so two walkers do not keep swapping places.
        movementX -= awayDirectionY * requestedDistance * this.config.sidestepStrength * (1 - inwardMovementAllowed);
        movementY += awayDirectionX * requestedDistance * this.config.sidestepStrength * (1 - inwardMovementAllowed);
      }
    }

    const adjustedDistance = Math.hypot(movementX, movementY);
    const movementScale = Math.min(1, requestedDistance / (adjustedDistance || 1));
    const desiredPoint = this.scene.battlefield.clampPoint(
      unit.arenaX + movementX * movementScale,
      unit.arenaY + movementY * movementScale,
      this.config.edgePadding,
      this.config.edgePadding
    );
    const terrainSafePoint = this.scene.terrain?.resolveStep(
      unit,
      desiredPoint.x,
      desiredPoint.y,
      this.config.terrainFootRadius
    ) ?? desiredPoint;

    return this.getSafeStepBeforeFallenUnit(unit, terrainSafePoint, fallenPartyUnits);
  }

  // Stop a movement segment at the first fallen character it would cross.
  getSafeStepBeforeFallenUnit(unit, desiredPoint, fallenPartyUnits = this.getFallenPartyUnits()) {
    let safePoint = desiredPoint;

    for (const fallenUnit of fallenPartyUnits) {
      if (fallenUnit === unit) continue;
      const clearanceRadius = this.getRequiredUnitSpacing(unit, fallenUnit);
      const unitFromCorpseX = unit.arenaX - fallenUnit.arenaX;
      const unitFromCorpseY = unit.arenaY - fallenUnit.arenaY;
      const movementX = safePoint.x - unit.arenaX;
      const movementY = safePoint.y - unit.arenaY;
      const movementLengthSquared = movementX * movementX + movementY * movementY;

      if (movementLengthSquared < 0.000001) continue;

      const startDistanceSquared = unitFromCorpseX * unitFromCorpseX + unitFromCorpseY * unitFromCorpseY;

      // If the unit already overlaps a body, let separation help it get free.
      if (startDistanceSquared < clearanceRadius * clearanceRadius) continue;

      const lineDotProduct = unitFromCorpseX * movementX + unitFromCorpseY * movementY;
      const closestPointRatio = -lineDotProduct / movementLengthSquared;
      const clampedClosestPointRatio = Math.max(0, Math.min(1, closestPointRatio));
      const closestX = unitFromCorpseX + movementX * clampedClosestPointRatio;
      const closestY = unitFromCorpseY + movementY * clampedClosestPointRatio;

      if (closestX * closestX + closestY * closestY >= clearanceRadius * clearanceRadius) continue;

      const intersectionRoot = Math.sqrt(Math.max(0, lineDotProduct ** 2
        - movementLengthSquared * (startDistanceSquared - clearanceRadius * clearanceRadius)));
      const collisionEntryRatio = Math.max(0, (-lineDotProduct - intersectionRoot) / movementLengthSquared);

      safePoint = {
        x: unit.arenaX + movementX * collisionEntryRatio,
        y: unit.arenaY + movementY * collisionEntryRatio
      };
    }

    return safePoint;
  }

  // Move an unreachable wave return target just outside a fallen ally.
  getWaveReturnPointClearOfFallenAllies(unit, destination) {
    let safeDestination = destination;

    for (const fallenUnit of this.getFallenPartyUnits()) {
      if (fallenUnit === unit) continue;
      const clearanceRadius = this.getRequiredUnitSpacing(unit, fallenUnit);
      let directionX = safeDestination.x - fallenUnit.arenaX;
      let directionY = safeDestination.y - fallenUnit.arenaY;
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

  getMeleeApproachPosition(unit, target, time) {
    const spacingConfig = this.config;
    // Keep both sprites apart while staying close enough for a center-based attack range.
    // The shared reach allowance lets melee attack without walking into the target's sprite.
    const desiredRadius = Math.max(
      unit.role === 'Tank' ? spacingConfig.tankRange : spacingConfig.meleeRange,
      (unit.bodyRadius ?? 0) + (target.bodyRadius ?? 0) + spacingConfig.personalSpaceGap
    );
    const approachRadius = Math.min(
      desiredRadius,
      unit.attackRange + spacingConfig.meleeReachPadding - spacingConfig.arrival
    );

    for (const [slotOwner, slotClaim] of this.slots) {
      if (!slotOwner.alive || slotOwner.container?.active === false || !slotClaim.target.alive
        || time - slotClaim.usedAt > spacingConfig.slotLeaseMs || this.scene.isPositionLocked(slotOwner)) {
        this.slots.delete(slotOwner);
      }
    }

    const getSlotPosition = slotIndex => {
      const slotAngle = slotIndex * Math.PI * 2 / spacingConfig.meleeSlots;

      return {
        x: target.arenaX + Math.cos(slotAngle) * approachRadius,
        y: target.arenaY + Math.sin(slotAngle) * approachRadius
      };
    };

    let slotClaim = this.slots.get(unit);
    const isSafeSlotPosition = slotPosition => {
      const nearestSafePosition = this.getSafeArenaPoint(slotPosition.x, slotPosition.y, unit);

      return Math.hypot(nearestSafePosition.x - slotPosition.x, nearestSafePosition.y - slotPosition.y)
        < spacingConfig.arrival;
    };

    if (!slotClaim || slotClaim.target !== target
      || (time >= slotClaim.recheckAt && !isSafeSlotPosition(getSlotPosition(slotClaim.index)))) {
      const otherClaims = [...this.slots.entries()]
        .filter(([slotOwner, otherClaim]) => slotOwner !== unit && otherClaim.target === target);
      const possibleSlots = Array.from({ length: spacingConfig.meleeSlots }, (_, slotIndex) => {
        const slotPosition = getSlotPosition(slotIndex);
        const existingClaimCount = otherClaims
          .filter(([, otherClaim]) => otherClaim.index === slotIndex).length;
        const nearbyCrowding = this.getLivingCombatUnits()
          .filter(otherUnit => otherUnit !== unit && otherUnit !== target)
          .reduce((crowdingScore, otherUnit) => {
            const distanceToOtherUnit = Math.hypot(
              otherUnit.arenaX - slotPosition.x,
              otherUnit.arenaY - slotPosition.y
            );

            return crowdingScore + Math.max(0, spacingConfig.normal - distanceToOtherUnit);
          }, 0);
        const requestedFlank = this.scene.tactics?.tactics?.meleePosition;
        const isWrongFlank = unit.role === 'Melee DPS'
          && ((requestedFlank === 'left' && slotPosition.x > target.arenaX)
            || (requestedFlank === 'right' && slotPosition.x < target.arenaX));
        const distanceToSlot = Math.hypot(unit.arenaX - slotPosition.x, unit.arenaY - slotPosition.y);
        const safetyPenalty = isSafeSlotPosition(slotPosition) ? 0 : 5000;
        const occupiedSlotPenalty = existingClaimCount * 10000;
        const flankPenalty = isWrongFlank ? spacingConfig.normal : 0;

        return {
          index: slotIndex,
          score: occupiedSlotPenalty + safetyPenalty + flankPenalty + distanceToSlot + nearbyCrowding * 2
        };
      });

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

  moveToCombatPosition(unit, target, time, delta) {
    if (!target?.alive || this.scene.isPositionLocked(unit) || !unit.canStartAction(time)) return;

    if (!this.isMeleeUnit(unit)) {
      const nearestEnemy = this.getLivingCombatUnits()
        .filter(otherUnit => otherUnit.isEnemy !== unit.isEnemy)
        .sort((firstEnemy, secondEnemy) => unit.distanceTo(firstEnemy) - unit.distanceTo(secondEnemy))[0];
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

    const approachPosition = this.getMeleeApproachPosition(unit, target, time);

    if (unit.distanceToPoint(approachPosition.x, approachPosition.y) > this.config.arrivalTolerance) {
      unit.moveToward(approachPosition.x, approachPosition.y, delta, this.config.arrival);
    }
  }

  // Imagine the arena as graph paper. A* finds safe stepping stones around bodies and walls.
  getNavigationWaypoint(unit, destination) {
    const fallenAllies = this.getFallenPartyUnits().filter(fallenAlly => fallenAlly !== unit);
    const getBodyClearance = fallenAlly => this.getRequiredUnitSpacing(unit, fallenAlly);

    // Check the whole line so a long step cannot jump through a body or wall.
    const isSegmentBlocked = (segmentStart, segmentEnd) => {
      const segmentX = segmentEnd.x - segmentStart.x;
      const segmentY = segmentEnd.y - segmentStart.y;
      const segmentLengthSquared = segmentX * segmentX + segmentY * segmentY;
      const crossesFallenAlly = fallenAllies.some(fallenAlly => {
        const closestPointRatio = segmentLengthSquared
          ? Math.max(0, Math.min(1,
            ((fallenAlly.arenaX - segmentStart.x) * segmentX
              + (fallenAlly.arenaY - segmentStart.y) * segmentY) / segmentLengthSquared))
          : 0;
        const closestX = segmentStart.x + segmentX * closestPointRatio;
        const closestY = segmentStart.y + segmentY * closestPointRatio;

        return Math.hypot(closestX - fallenAlly.arenaX, closestY - fallenAlly.arenaY)
          < getBodyClearance(fallenAlly);
      });

      if (crossesFallenAlly) return true;

      const segmentLength = Math.sqrt(segmentLengthSquared);
      const sampleCount = Math.ceil(segmentLength / 12);

      for (let sampleIndex = 1; sampleIndex < sampleCount; sampleIndex += 1) {
        const sampleRatio = sampleIndex / sampleCount;
        const sampleX = segmentStart.x + segmentX * sampleRatio;
        const sampleY = segmentStart.y + segmentY * sampleRatio;

        if (this.scene.terrain?.isUnitBlocked(unit, sampleX, sampleY, this.config.terrainFootRadius)) {
          return true;
        }
      }

      return false;
    };

    const startPosition = { x: unit.arenaX, y: unit.arenaY };

    if (!isSegmentBlocked(startPosition, destination)) {
      this.paths.delete(unit);

      return destination;
    }

    const now = this.scene.time?.now ?? 0;
    const previousPath = this.paths.get(unit);
    const obstacleSignature = fallenAllies
      .map(fallenAlly => `${Math.round(fallenAlly.arenaX / 24)},${Math.round(fallenAlly.arenaY / 24)}`)
      .join('|');
    const previousStepIsUsable = previousPath
      && now < previousPath.recheckAt
      && previousPath.signature === obstacleSignature
      && Math.hypot(previousPath.destination.x - destination.x, previousPath.destination.y - destination.y) < 48
      && Math.hypot(previousPath.waypoint.x - startPosition.x, previousPath.waypoint.y - startPosition.y) > 20;

    if (previousStepIsUsable) return previousPath.waypoint;

    // Put stepping stones 48 units apart. Each stone is one place the unit could stand.
    const gridStep = 48;
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
      && !this.scene.terrain?.isUnitBlocked(
        unit,
        standingPoint.x,
        standingPoint.y,
        this.config.terrainFootRadius
      );
    const startCellX = Math.max(0, Math.min(gridWidth - 1, Math.floor(startPosition.x / gridStep)));
    const startCellY = Math.max(0, Math.min(gridHeight - 1, Math.floor(startPosition.y / gridStep)));
    const targetCellX = Math.max(0, Math.min(gridWidth - 1, Math.floor(destination.x / gridStep)));
    const targetCellY = Math.max(0, Math.min(gridHeight - 1, Math.floor(destination.y / gridStep)));
    let goalCellX = targetCellX;
    let goalCellY = targetCellY;

    if (!isSafeStandingPoint(getCellCenter(goalCellX, goalCellY))) {
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

            if (distanceToDestination < nearestGoalDistance && isSafeStandingPoint(candidatePoint)) {
              nearestGoalDistance = distanceToDestination;
              goalCellX = cellX;
              goalCellY = cellY;
            }
          }
        }

        if (nearestGoalDistance < Infinity) break;
      }
    }

    const startCellId = getCellId(startCellX, startCellY);
    const goalCellId = getCellId(goalCellX, goalCellY);
    const cellsToCheck = [];

    // Keep the most promising stone at the front of this little waiting line.
    const addCellToCheck = cell => {
      let cellIndex = cellsToCheck.length;
      cellsToCheck.push(cell);

      while (cellIndex > 0) {
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

    // The score adds the walk already taken to a straight-line guess of what is left.
    addCellToCheck({
      cellX: startCellX,
      cellY: startCellY,
      id: startCellId,
      distanceWalked: 0,
      score: Math.hypot(goalCellX - startCellX, goalCellY - startCellY)
    });

    // Remember the cheapest path so far and the stone that led to each new stone.
    const cheapestKnownDistance = new Map([[startCellId, 0]]);
    const previousCellById = new Map();
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
          const segmentStart = currentCell.id === startCellId
            ? startPosition
            : getCellCenter(currentCell.cellX, currentCell.cellY);

        // Only step onto safe stones, and only when the line between stones is clear.
          if (alreadyCheckedCellIds.has(nextCellId)
            || !isSafeStandingPoint(nextCellCenter)
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

    if (!reachedGoal) return destination;

    // Follow the remembered stones backward, then take just the first step.
    const routeCellIds = [goalCellId];

    while (routeCellIds[routeCellIds.length - 1] !== startCellId
      && previousCellById.has(routeCellIds[routeCellIds.length - 1])) {
      routeCellIds.push(previousCellById.get(routeCellIds[routeCellIds.length - 1]));
    }

    const nextStepCellId = routeCellIds[routeCellIds.length - 2];
    const waypoint = routeCellIds.length > 1
      ? getCellCenter(nextStepCellId % gridWidth, Math.floor(nextStepCellId / gridWidth))
      : destination;

    // Reuse this first step briefly so we do not redraw the map every frame.
    this.paths.set(unit, {
      waypoint,
      destination: { ...destination },
      signature: obstacleSignature,
      recheckAt: now + 500
    });

    return waypoint;
  }

  maintainPreferredRange(unit, target, delta, retreatOnly = false) {
    const spacingConfig = this.config;
    const isHealer = unit.role === 'Healer';
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
      unit.moveAwayFrom(
        target.arenaX,
        target.arenaY,
        delta,
        minimumAllowedRange + spacingConfig.rangeHysteresis
      );
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

  // Check every pair from the same snapshot so update order does not change the result.
  // A held unit can move a little to fix an overlap, and its anchor moves with it.
  separateUnits(delta) {
    const livingUnits = this.getLivingCombatUnits();
    const unitsToSeparate = [...livingUnits, ...this.getFallenPartyUnits()];
    const movementOffsets = new Map(livingUnits.map(unit => [unit, { x: 0, y: 0 }]));
    const isPlayerUnitLocked = unit => !unit.isEnemy && this.scene.isPositionLocked(unit);

    for (let firstIndex = 0; firstIndex < unitsToSeparate.length; firstIndex += 1) {
      for (let secondIndex = firstIndex + 1; secondIndex < unitsToSeparate.length; secondIndex += 1) {
        const firstUnit = unitsToSeparate[firstIndex];
        const secondUnit = unitsToSeparate[secondIndex];
        const distanceX = firstUnit.arenaX - secondUnit.arenaX;
        const distanceY = firstUnit.arenaY - secondUnit.arenaY;
        const distanceBetweenUnits = Math.hypot(distanceX, distanceY);
        const desiredSpacing = this.getRequiredUnitSpacing(firstUnit, secondUnit);

        if (distanceBetweenUnits >= desiredSpacing) continue;

        // Stable directions also resolve exact overlap (including spawn piles).
        const stableAngle = firstIndex * 2.399963 + secondIndex * 1.618034;
        const directionX = distanceBetweenUnits > 0.001 ? distanceX / distanceBetweenUnits : Math.cos(stableAngle);
        const directionY = distanceBetweenUnits > 0.001 ? distanceY / distanceBetweenUnits : Math.sin(stableAngle);
        const pushDistance = (desiredSpacing - distanceBetweenUnits)
          * (1 - Math.exp(-this.config.separationForce * delta));
        const firstUnitIsFixed = !firstUnit.alive || isPlayerUnitLocked(firstUnit) || firstUnit.isEnemy;
        const secondUnitIsFixed = !secondUnit.alive || isPlayerUnitLocked(secondUnit) || secondUnit.isEnemy;
        const firstUnitShare = firstUnitIsFixed && !secondUnitIsFixed
          ? 0
          : secondUnitIsFixed && !firstUnitIsFixed ? 1 : 0.5;

        if (firstUnit.alive) {
          movementOffsets.get(firstUnit).x += directionX * pushDistance * firstUnitShare;
          movementOffsets.get(firstUnit).y += directionY * pushDistance * firstUnitShare;
        }

        if (secondUnit.alive) {
          movementOffsets.get(secondUnit).x -= directionX * pushDistance * (1 - firstUnitShare);
          movementOffsets.get(secondUnit).y -= directionY * pushDistance * (1 - firstUnitShare);
        }
      }
    }

    for (const unit of livingUnits) {
      if (this.scene.time?.now < Math.max(unit.status?.rootedUntil ?? 0, unit.status?.stunnedUntil ?? 0)) continue;
      const movementOffset = movementOffsets.get(unit);
      const offsetLength = Math.hypot(movementOffset.x, movementOffset.y);

      if (offsetLength < 0.001) continue;

      const maxCorrectionDistance = this.config.maxSeparationSpeed * delta;
      const correctionScale = Math.min(1, maxCorrectionDistance / offsetLength);
      const correctedPosition = this.getSafeArenaPoint(
        unit.arenaX + movementOffset.x * correctionScale,
        unit.arenaY + movementOffset.y * correctionScale,
        unit
      );
      const manualHoldAnchor = this.scene.manualTargets.get(unit.id);
      const isAtHoldAnchor = manualHoldAnchor
        && unit.distanceToPoint(manualHoldAnchor.x, manualHoldAnchor.y) <= this.config.arrivalTolerance;

      if (isPlayerUnitLocked(unit) && isAtHoldAnchor) {
        manualHoldAnchor.x += correctedPosition.x - unit.arenaX;
        manualHoldAnchor.y += correctedPosition.y - unit.arenaY;
      }

      unit.setArenaPosition(correctedPosition.x, correctedPosition.y);
    }
  }
}
