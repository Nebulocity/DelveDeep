import Phaser from 'phaser';

const DEFAULT_TACTICS = {
  tankPosition: 'center',
  meleePosition: 'auto',
  rangedFormation: 'spread',
  healerFormation: 'back',
  mechanicResponse: 'avoid'
};

export default class TacticsController {
  constructor(battlefield, tactics = {}) {
    this.battlefield = battlefield;
    this.tactics = { ...DEFAULT_TACTICS, ...tactics };
    this.preferences = new Map();
  }

  registerParty(units) {
    units.forEach((unit, index) => {
      const jitterX = Phaser.Math.Between(-55, 55);
      const jitterY = Phaser.Math.Between(-35, 35);
      const side = Phaser.Math.RND.pick([-1, 1]);
      this.preferences.set(unit.id, {
        jitterX,
        jitterY,
        side,
        reactionDelay: Phaser.Math.Between(40, 180),
        slot: index
      });
    });
  }

  getSpawnPosition(unit, index) {
    const preference = this.preferences.get(unit.id) ?? { jitterX: 0, jitterY: 0, side: 1 };
    const rolePositions = {
      Tank: { x: 700, y: 300 },
      Healer: { x: 420, y: 125 },
      'Melee DPS': { x: 760, y: 190 },
      'Ranged DPS': { x: 1040, y: 125 }
    };
    const base = rolePositions[unit.role] ?? { x: 260 + index * 150, y: 150 };
    return this.safePoint(base.x + preference.jitterX, base.y + preference.jitterY, 70);
  }

  getTankPosition(tank, primaryEnemy) {
    const preference = this.preferences.get(tank.id) ?? { jitterX: 0 };
    const desiredX = Phaser.Math.Clamp(primaryEnemy.arenaX, 520, 880) + preference.jitterX * 0.25;
    const desiredY = Phaser.Math.Clamp(primaryEnemy.arenaY - 100, 380, 650);
    return this.safePoint(desiredX, desiredY, 100);
  }

  getMeleePosition(unit, enemy) {
    const preference = this.preferences.get(unit.id) ?? { side: 1, jitterY: 0 };
    let side = preference.side;
    if (this.tactics.meleePosition === 'left') {
      side = -1;
    } else if (this.tactics.meleePosition === 'right') {
      side = 1;
    }
    return this.safePoint(enemy.arenaX + side * 95, enemy.arenaY - 25 + preference.jitterY * 0.25, 80);
  }

  getRangedPosition(unit, enemy) {
    const preference = this.preferences.get(unit.id) ?? { side: 1, jitterX: 0, jitterY: 0 };
    const spread = this.tactics.rangedFormation === 'spread' ? 1 : 0.45;
    const x = 700 + preference.side * (330 * spread) + preference.jitterX;
    const y = Phaser.Math.Clamp(enemy.arenaY - 380 + preference.jitterY, 90, 310);
    return this.safePoint(x, y, 75);
  }

  getHealerPosition(unit, tank) {
    const preference = this.preferences.get(unit.id) ?? { side: -1, jitterX: 0, jitterY: 0 };
    return this.safePoint(
      tank.arenaX + preference.side * 185 + preference.jitterX * 0.35,
      tank.arenaY - 230 + preference.jitterY,
      75
    );
  }

  shouldAvoidMechanics(unit) {
    return this.tactics.mechanicResponse === 'avoid' && unit.role !== 'Tank';
  }

  safePoint(x, y, padding = 60) {
    const safe = this.battlefield.clampPoint(x, y, padding, padding);
    // Keep preferred positions away from the extreme lower corners.
    if (safe.y < 160) {
      safe.x = Phaser.Math.Clamp(safe.x, 150, this.battlefield.logicalWidth - 150);
    }
    return safe;
  }
}
