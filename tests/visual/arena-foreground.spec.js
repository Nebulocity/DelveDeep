import { test, expect } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

for (const viewport of [{ width: 915, height: 412 }, { width: 1920, height: 1080 }]) {
  test(`Foreground scenery permits lower-floor movement and returns at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await mkdir('output/qa/foreground', { recursive: true });
    for (const delve of ['slime-cave', 'thornbriar-hollow', 'dolmark-den', 'murmuring-abyss', 'verdant-tear']) {
      await page.evaluate(id => { const qa = window.__DELVE_DEEP_VISUAL_QA__; window.__previousArenaParty = qa.game.scene.getScene('BattleScene').partyUnits; qa.activate('BattleScene', { delve: id }); }, delve);
      await page.waitForFunction(() => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
        return scene.sys.isActive() && scene.partyHud?.length === 5 && scene.partyUnits !== window.__previousArenaParty;
      });
      await page.locator('#loading-screen').waitFor({ state: 'hidden' });
      const result = await page.evaluate(() => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
        if (!scene.combatPaused) scene.togglePause();
        const geometry = scene.battlefield;
        const frame = scene.children.list.find(child => child.name === 'carved-stone-panel' && child.depth === 4500 && child.y > scene.scale.height / 2);
        const foreground = scene.children.list.find(child => child.depth === 4300 && child.mask);
        const units = scene.partyUnits.map((unit, index) => {
          const home = { ...scene.waveReturnPositions.get(unit.id) };
          unit.status.stunnedUntil = 0;
          unit.status.rootedUntil = 0;
          const target = scene.movement.getSafeArenaPoint(geometry.logicalWidth * (index % 2 ? 0.1 : 0.9), scene.movement.config.edgePadding + 12, unit);
          unit.setArenaPosition(geometry.logicalWidth - target.x, target.y);
          let safe = true;
          for (let step = 0; step < Math.ceil(geometry.logicalWidth / unit.moveSpeed * 60) + 60; step += 1) {
            unit.moveToward(target.x, target.y, 1 / 60, 0, false);
            safe &&= !scene.terrain.isUnitBlocked(unit, unit.arenaX, unit.arenaY, 12);
          }
          const crossed = Math.hypot(unit.arenaX - target.x, unit.arenaY - target.y) < 1;
          for (let step = 0; step < Math.ceil(geometry.logicalWidth / unit.moveSpeed * 60) + 60; step += 1) {
            unit.moveToward(home.x, home.y, 1 / 60, 0, false);
            safe &&= !scene.terrain.isUnitBlocked(unit, unit.arenaX, unit.arenaY, 12);
          }
          const returned = Math.hypot(unit.arenaX - home.x, unit.arenaY - home.y) < 1;
          unit.setArenaPosition(home.x, target.y);
          return { safe, crossed, returned, occluded: !foreground || foreground.depth > unit.container.depth };
        });
        return { bottom: geometry.bottomY, frameTop: frame.y - frame.displayHeight / 2, units };
      });
      expect(result.bottom).toBeCloseTo(result.frameTop, 6);
      expect(result.units).toEqual(Array(5).fill({ safe: true, crossed: true, returned: true, occluded: true }));
      await page.screenshot({ path: `output/qa/foreground/${delve}-${viewport.width}.png` });
    }
    expect(errors).toEqual([]);
  });
}
