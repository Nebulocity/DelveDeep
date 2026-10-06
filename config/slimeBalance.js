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
    maxHp: 20000, armor: 160, attackPower: 200,
    abilities: {
      primary: { name: 'Crushing Slime Slam', cooldown: 5400, telegraph: 1350, radius: 165,
        power: 180, ...physicalPotency },
      secondary: { name: 'Toxic Glob', cooldown: 7200, windup: 750,
        power: 120, ...physicalPotency }
    }
  }
};
