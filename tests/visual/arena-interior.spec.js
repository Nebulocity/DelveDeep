// Exercise slow inward walking with actual feet, perspective and each authored floor.
import { test, expect } from '@playwright/test';

for (const delve of ['slime-cave', 'thornbriar-hollow', 'dolmark-den', 'old-quarry', 'sunken-watch', 'murmuring-abyss']) {
test(`automatic tanks walk inward from both lower corners of ${delve}`, async ({ page }) => {
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.evaluate(id => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      window.__oldInteriorParty = qa.game.scene.getScene('BattleScene').partyUnits;
      qa.activate('BattleScene', { delve: id });
    }, delve);
    await page.waitForFunction(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      return scene.partyUnits !== window.__oldInteriorParty && scene.partyHud?.length === 5
        && scene.enemies?.some(enemy => enemy.alive);
    });
    const results = await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      if (!scene.combatPaused) scene.togglePause();
      scene.manualTargets.clear();
      scene.heldUnitIds.clear();
      scene.activeTelegraphs = [];
      const tank = scene.partyUnits.find(unit => unit.role === 'Tank');
      const floor = scene.battlefield;
      const results = [];
      for (const side of [0.06, 0.94]) {
        for (const unit of scene.partyUnits) {
          unit.finishAction();
          unit.status = {};
          unit.criticalKnockback = null;
          const point = scene.movement.getSafeArenaPoint(floor.logicalWidth * side,
            floor.logicalHeight * 0.06, unit);
          unit.setArenaPosition(point.x, point.y);
        }
        const start = { x: tank.arenaX, y: tank.arenaY };
        let safe = true, moved = 0;

        // One second of voluntary movement uses normal body steering and floor checks.
        for (let step = 0; step < 30; step++) {
          if (scene.movement.tryReturnToInterior(tank, scene.time.now, 1 / 30)) moved++;
          safe &&= !scene.terrain.isUnitBlocked(tank, tank.arenaX, tank.arenaY, 12);
        }
        results.push({ safe, moved, inwardX: side < 0.5 ? tank.arenaX > start.x : tank.arenaX < start.x,
          inwardY: tank.arenaY > start.y });
      }
      return results;
    });
    for (const result of results) {
      expect(result.safe, delve).toBe(true);
      expect(result.moved, delve).toBeGreaterThan(0);
      expect(result.inwardX, delve).toBe(true);
      expect(result.inwardY, delve).toBe(true);
    }
});
}
