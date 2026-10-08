// These are the Raid Leader's battle commands and formation preferences. Commands update
// unit targets or movement intent; the normal movement and combat systems then carry them
// out. A selected group and a unit's current attack target are different pieces of state.

import Phaser from 'phaser';

const DEFAULT_TACTICS = {
  tankPosition: 'center',
  meleePosition: 'auto',
  rangedFormation: 'spread',
  healerFormation: 'back',
  mechanicResponse: 'avoid'
};

export default class TacticsController {

  // This helper combines formation settings with the battlefield they operate in.
  constructor(battlefield, tactics = {}) {

    this.battlefield = battlefield;

    // ... copies the source's own fields into this object; fields listed later replace
    // earlier ones. This is a shallow copy, so nested objects are still shared.
    this.tactics = { ...DEFAULT_TACTICS, ...tactics };

    // A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
    // object; get/set read and write that same key.
    this.preferences = new Map();
  }

  // This helper assigns each party member stable random position offsets and a preferred
  // side for the encounter. Formation calculations reuse those preferences so units keep
  // individual positions instead of choosing new ones every frame.
  registerParty(units) {

    const slots = [0, 2, 4, 6, 8];
    const centralSlots = [2, 1, 3];
    const outerSlots = [0, 4, 1, 3];

    // A Map pairs a key with a value. Unlike an array index, the key can be an ID or an
    // object; get/set read and write that same key.
    const assigned = new Map();

    // sort rearranges this array in place. A negative comparator result puts a before b;
    // positive puts it after; zero keeps them tied. filter keeps entries whose callback
    // returns true. It builds a new list and leaves the original list in place.
    const supports = units.filter((unit) => unit.role === 'Tank' || unit.role === 'Healer')
      .sort((a, b) => Number(b.role === 'Tank') - Number(a.role === 'Tank'));
    supports.forEach((unit, index) => assigned.set(unit.id, centralSlots[index]));
    units.filter((unit) => !assigned.has(unit.id)).forEach((unit, index) => {

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact. filter keeps entries whose callback returns true. It builds a new list and
      // leaves the original list in place.
      assigned.set(unit.id, outerSlots.filter((slot) => ![...assigned.values()].includes(slot))[0] ?? index);
    });

    units.forEach((unit, index) => {

      const jitterX = Phaser.Math.Between(-55, 55);
      const jitterY = Phaser.Math.Between(-35, 35);
      const side = Phaser.Math.RND.pick([-1, 1]);

      // ?? uses the fallback only for null or undefined. A real zero or false stays
      // intact.
      this.preferences.set(unit.id, {
        jitterX,
        jitterY,
        side,
        reactionDelay: Phaser.Math.Between(40, 180),
        slot: index,
        spawnSlot: slots[assigned.get(unit.id)] ?? slots[index]
      });
    });
  }

  // Spread initial positions across the lower part of each walkable arena.
  getSpawnPosition(unit, index) {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    // ?. only follows this link when the value exists; a missing optional value gives
    // undefined.
    const slot = this.preferences.get(unit.id)?.spawnSlot ?? [0, 2, 4, 6, 8][index] ?? 4;
    return { x: this.battlefield.logicalWidth * (0.18 + slot * 0.08),
      y: this.battlefield.logicalHeight * 0.22 };
  }

  // This helper places the tank near the enemy while favoring the arena center.
  getTankPosition(tank, primaryEnemy) {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    const preference = this.preferences.get(tank.id) ?? { jitterX: 0 };
    const centerX = this.battlefield.logicalWidth / 2;

    // Clamp keeps the first argument between the lower bound (second argument) and upper
    // bound (third argument).
    const desiredX = Phaser.Math.Clamp(primaryEnemy.arenaX, centerX - 180, centerX + 180) + preference.jitterX * 0.25;
    const desiredY = Phaser.Math.Clamp(primaryEnemy.arenaY - 100, 380, 650);
    return this.safePoint(desiredX, desiredY, 100);
  }

  // This helper gives melee attackers a flank that follows their tactics.
  getMeleePosition(unit, enemy) {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    const preference = this.preferences.get(unit.id) ?? { side: 1, jitterY: 0 };
    let side = preference.side;
    if (this.tactics.meleePosition === 'left') {
      side = -1;
    } else if (this.tactics.meleePosition === 'right') {
      side = 1;
    }

    return this.safePoint(enemy.arenaX + side * 95, enemy.arenaY - 25 + preference.jitterY * 0.25, 80);
  }

  // This helper keeps ranged attackers back with spacing set by their formation.
  getRangedPosition(unit, enemy) {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    const preference = this.preferences.get(unit.id) ?? { side: 1, jitterX: 0, jitterY: 0 };

    // The condition before ? chooses the first value when true and the value after : when
    // false.
    const spread = this.tactics.rangedFormation === 'spread' ? 1 : 0.45;
    const x = this.battlefield.logicalWidth / 2 + preference.side * (330 * spread) + preference.jitterX;

    // Clamp keeps the first argument between the lower bound (second argument) and upper
    // bound (third argument).
    const y = Phaser.Math.Clamp(enemy.arenaY - 380 + preference.jitterY, 90, 310);
    return this.safePoint(x, y, 75);
  }

  // This helper positions healers behind the tank with some lateral space.
  getHealerPosition(unit, tank) {

    // ?? uses the fallback only for null or undefined. A real zero or false stays intact.
    const preference = this.preferences.get(unit.id) ?? { side: -1, jitterX: 0, jitterY: 0 };
    return this.safePoint(
      tank.arenaX + preference.side * 185 + preference.jitterX * 0.35,
      tank.arenaY - 230 + preference.jitterY,
      75
    );
  }

  // This helper lets non-tanks dodge ground hazards when avoidance is enabled.
  shouldAvoidMechanics(unit) {

    return this.tactics.mechanicResponse === 'avoid';
  }

  // This helper keeps formation positions clear of arena edges and lower corners.
  safePoint(x, y, padding = 60) {

    const safe = this.battlefield.clampPoint(x, y, padding, padding);

    // Narrow the rear formation space to avoid the lower corners.
    if (safe.y < 160) {

      // Clamp keeps the first argument between the lower bound (second argument) and upper
      // bound (third argument).
      safe.x = Phaser.Math.Clamp(safe.x, 150, this.battlefield.logicalWidth - 150);
    }

    return safe;
  }
}
