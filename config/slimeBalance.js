// These values tune the Slime Cave against the starting party without changing the shared
// combat rules. Treat durability, damage and skill potency as separate knobs. Enemy
// definitions read this configuration; the battle still uses the normal armor, accuracy
// and targeting code.

const physicalPotency = { damageType: 'physical', powerUnit: 'percent' };

export const SLIME_BALANCE = {
  caveSlime: {
    maxHp: 2400, armor: 80, attackPower: 25,
    abilities: {
      primary: { name: 'Slime Slam', cooldown: 6500, telegraph: 1200, radius: 135,
        power: 180, ...physicalPotency }
    }
  },

  elderSlime: {
    maxHp: 7000, armor: 120, attackPower: 28,
    abilities: {
      primary: { name: 'Crushing Slime Slam', cooldown: 5400, telegraph: 1350, radius: 165,
        power: 180, ...physicalPotency },

      secondary: { name: 'Toxic Glob', cooldown: 7200, windup: 750,
        power: 120, ...physicalPotency }
    }
  },

  slimeSovereign: {
    maxHp: 24000, armor: 160, attackPower: 230,
    abilities: {
      primary: { name: 'Crushing Slime Slam', cooldown: 5400, telegraph: 1350, radius: 165,
        power: 180, ...physicalPotency },

      secondary: { name: 'Toxic Glob', cooldown: 7200, windup: 750,
        power: 120, ...physicalPotency },

      // Timing is in milliseconds; range and radius are logical arena units. The six-
      // second windup is the warning phase itself. At 230 Attack Power, 200% deals 460
      // before physical defenses. Ground attacks cannot critically hit.
      // autoAvoid: false keeps the party from solving this warning automatically; the
      // player must interrupt or manually move adventurers outside the circle.
      tertiary: { name: 'Consume', cooldown: 30000, windup: 6000, telegraph: 6000,
        radius: 300, castRange: 300, areaCenter: 'caster', autoAvoid: false, manaCost: 0,
        power: 200, ...physicalPotency }
    }
  }
};
