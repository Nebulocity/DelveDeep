// Exercise autonomous choices with real battle units and authored floor geometry.
import { test, expect } from '@playwright/test';

test('party support, threat changes and overlapping hazard escape use live combat rules', async ({ page }) => {
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene'));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene')
    .enemies?.some(enemy => enemy.alive && !enemy.landing));
  const result = await page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    clearInterval(qa.game.backgroundProgress.timer);
    qa.game.backgroundProgress.setHidden(true);
    scene.battleEvents.forEach(event => event.timer.remove(false));
    scene.battleEvents.clear();
    const tank = scene.partyUnits.find(unit => unit.role === 'Tank');
    const [attacked, safe, healer, secondHealer] = scene.partyUnits.filter(unit => unit !== tank);
    const monster = scene.getLivingEnemies()[0];
    scene.partyUnits.forEach(unit => {
      unit.finishAction();
      unit.hp = unit.maxHp;
      unit.status = {};
      unit.criticalKnockback = null;
    });
    scene.getLivingEnemies().forEach(enemy => { enemy.finishAction(); enemy.currentTargetId = null; });
    const center = scene.movement.getSafeArenaPoint(1100, 500, tank);
    tank.setArenaPosition(center.x, center.y);
    attacked.setArenaPosition(center.x + 90, center.y);
    safe.setArenaPosition(center.x - 90, center.y);
    monster.setArenaPosition(attacked.arenaX + 70, attacked.arenaY);
    monster.currentTargetId = attacked.id;
    safe.hp = safe.maxHp * 0.2;
    tank.abilities = { testWard: { name: 'Test Ward', effect: 'protect', target: 'ally',
      range: 6, power: 50, powerUnit: 'shield HP', duration: 3000, windup: 300, cooldown: 10000 } };
    scene.classAbilitySystem.update(tank, scene.time.now, 0.05);
    const shieldEvent = [...scene.battleEvents].find(event => event.data.kind === 'classAbility');
    const wardTarget = shieldEvent?.data.targetId;
    tank.finishAction();
    scene.battleEvents.forEach(event => event.timer.remove(false));
    scene.battleEvents.clear();

    // Remove the old encounter lead to check opening attention and skill-only threat.
    scene.enemyThreat.set(monster.id, new Map());
    const opening = scene.getHighestThreatTarget(monster).id;
    scene.generateAbilityThreat(attacked, { manaCost: 10 });
    const pulled = scene.getHighestThreatTarget(monster).id;
    scene.addThreat(monster, tank, 1000);
    const regained = scene.getHighestThreatTarget(monster).id;

    healer.role = 'Healer';
    secondHealer.role = 'Healer';
    const heal = { name: 'Test Heal', effect: 'heal', target: 'ally', range: 10,
      power: 200, windup: 300, cooldown: 10000, powerUnit: 'percent' };
    healer.spellHealing = safe.maxHp;
    secondHealer.spellHealing = safe.maxHp;
    healer.abilities = { testHeal: heal };
    secondHealer.abilities = { testHeal: heal };
    healer.setArenaPosition(center.x, center.y + 90);
    secondHealer.setArenaPosition(center.x, center.y - 90);
    scene.classAbilitySystem.update(healer, scene.time.now, 0.05);
    scene.classAbilitySystem.update(secondHealer, scene.time.now, 0.05);
    const reserved = healer.pendingAction?.healingReservations?.[safe.id] > 0;
    const duplicate = secondHealer.pendingAction?.name === 'Test Heal';

    // Real escape points must fit this battlefield and clear both active circles.
    const warnings = [{ arenaX: center.x, arenaY: center.y, radius: 150 },
      { arenaX: center.x + 160, arenaY: center.y - 80, radius: 150 }];
    const escape = scene.movement.getEscapePoint(tank, warnings);
    return { wardTarget, attackedId: attacked.id, opening, tankId: tank.id,
      pulled, regained, reserved, duplicate, escape,
      safeEscape: Boolean(escape && warnings.every(warning => Math.hypot(escape.x - warning.arenaX,
        escape.y - warning.arenaY) > warning.radius + tank.bodyRadius)
        && !scene.terrain.isUnitBlocked(tank, escape.x, escape.y, scene.movement.config.terrainFootRadius)) };
  });
  expect(result.wardTarget).toBe(result.attackedId);
  expect(result.opening).toBe(result.tankId);
  expect(result.pulled).toBe(result.attackedId);
  expect(result.regained).toBe(result.tankId);
  expect(result.reserved).toBe(true);
  expect(result.duplicate).toBe(false);
  expect(result.safeEscape).toBe(true);
});
