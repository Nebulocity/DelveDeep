// Party spawn slots and mechanic preferences live here. CombatMovement handles ongoing
// positioning and steering; saved battles retain the historical preference records.

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

  // Assign stable spawn slots and preserve the older offsets stored in battle snapshots.
  // Keep these random draws and saved fields intact when removing unused positioning
  // helpers, so cleanup does not change encounter randomness or saved preference records.
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

  // This helper lets non-tanks dodge ground hazards when avoidance is enabled.
  shouldAvoidMechanics(unit) {

    return this.tactics.mechanicResponse === 'avoid';
  }
}
