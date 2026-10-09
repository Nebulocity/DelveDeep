// Review the supplied void roster in its actual battlefield at desktop and phone sizes.
// The QA bridge changes only this browser's local battle; no player profile is exported.
import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

for (const width of [915, 1920]) {
  test(`Void monster sheets and battle playback at ${width}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: width === 915 ? 412 : 1080 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve: 'murmuring-abyss' }));
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').enemies?.length > 0);
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    const result = await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      scene.combatPaused = true;
      scene.waveTransitioning = false;
      scene.clearWaveAnnouncement();

      // This review replaces a live wave. Cancel its captured callbacks before
      // destroying their targets, so an old attack cannot redraw a disposed sprite.
      for (const event of scene.battleEvents ?? []) event.timer?.remove(false);
      scene.battleEvents?.clear();
      for (const unit of [...scene.partyUnits, ...scene.enemies]) unit.finishAction();
      for (const enemy of scene.enemies) {
        enemy.alive = false;
        scene.tweens.killTweensOf(enemy.spriteVisual?.image ?? enemy.body);
        scene.tweens.killTweensOf(enemy.container);
        enemy.container.destroy();
      }
      const types = ['voidCrawler', 'voidStalker', 'voidKeeper', 'abyssalSovereign', 'voidWisp'];

      // Spread the five review units across the actual authored floor, with the boss
      // toward the rear. These are arena coordinates, independent of browser pixels.
      const points = [[340, 650], [600, 650], [850, 660], [1020, 825], [1200, 640]];
      scene.enemies = types.map((type, index) => scene.createEnemy(type, { x: points[index][0], y: points[index][1] }, index));

      // Remove only transient combat popups from the paused art lineup. The real
      // battle interface and the units' own labels remain available for inspection.
      for (const object of scene.children.list.slice()) {
        if (object.type === 'Text' && object.depth === 4200) object.destroy();
      }
      return scene.enemies.map(enemy => {
        const visual = enemy.spriteVisual;
        if (!visual) return { type: enemy.enemyType, missing: true };

        // Terrain validation may adjust a review spawn. Reset the motion tracker at
        // that final legal point before checking idle playback, rather than counting
        // that one-time correction as the first movement frame.
        visual.reset();
        const initial = visual.currentFrame();
        scene.combatPaused = false;

        // Use normal frame steps. SpriteMotion caps a single long frame at 100 ms,
        // which is shorter than the 150 ms idle interval in these accepted sheets.
        for (let tick = 0; tick < 12; tick++) visual.update(16);
        const advanced = visual.currentFrame();
        scene.combatPaused = true;
        visual.update(1000);
        const paused = visual.currentFrame();
        visual.motion.direction = 'south-east';
        visual.reset();
        enemy.syncPresentation();
        return { type: enemy.enemyType, missing: false,
          moved: initial.key !== advanced.key || initial.frame !== advanced.frame,
          paused: paused.frame === advanced.frame, states: Object.keys(visual.definition.clips) };
      });
    });
    for (const unit of result) {
      expect(unit.missing).toBe(false);
      expect(unit.moved, `${unit.type} advances its visible animation`).toBe(true);
      expect(unit.paused).toBe(true);
      for (const state of ['idle', 'walk', 'attack', 'block', 'hit', 'death']) expect(unit.states).toContain(state);
    }
    await fs.mkdir('output/qa/void-baddies/battle', { recursive: true });
    await page.screenshot({ path: `output/qa/void-baddies/battle/roster-${width}.png` });

    // Each action/facing is drawn through UnitSprite, including its actual foot anchor.
    const checked = await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      let clips = 0;
      for (const enemy of scene.enemies) {
        const visual = enemy.spriteVisual;
        for (const [state, facings] of Object.entries(visual.definition.clips)) {
          for (const direction of ['south-east', 'south-west', 'north-east', 'north-west']) {
            visual.action = { state, elapsed: facings[direction].frameMs * 2 };
            visual.motion.direction = direction;
            visual.applyFrame(visual.currentFrame());
            visual.applyPose();
            clips++;
          }
        }
        visual.motion.direction = 'south-east';
        visual.reset();
      }
      return clips;
    });
    expect(checked).toBeGreaterThan(120);

    // Review the actual final wave as well as the spaced-out art lineup above.
    const finale = await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      for (const event of scene.battleEvents ?? []) event.timer?.remove(false);
      scene.battleEvents?.clear();
      for (const enemy of scene.enemies) {
        enemy.finishAction();
        enemy.alive = false;
        scene.tweens.killTweensOf(enemy.spriteVisual?.image ?? enemy.body);
        scene.tweens.killTweensOf(enemy.container);
        enemy.container.destroy();
      }
      scene.currentWaveIndex = scene.waves.length - 1;
      scene.updateEncounterStatus();
      scene.spawnWave(scene.currentWaveIndex);

      // Settle only this static review's drop-in tween. The maintained landing checks
      // cover its timing; this capture needs stable feet and readable sprite poses.
      for (const enemy of scene.enemies) {
        scene.tweens.killTweensOf(enemy.spriteVisual?.image ?? enemy.body);
        scene.finishEnemyLanding(enemy);
        enemy.spriteVisual?.reset();
        enemy.syncPresentation();
      }
      scene.combatPaused = true;
      return scene.enemies.map(enemy => ({ type: enemy.enemyType, sprite: !!enemy.spriteVisual, boss: enemy.isBoss }));
    });
    expect(finale.some(enemy => enemy.type === 'abyssalSovereign' && enemy.boss && enemy.sprite)).toBe(true);
    expect(finale.every(enemy => enemy.sprite)).toBe(true);
    await page.screenshot({ path: `output/qa/void-baddies/battle/finale-${width}.png` });
    expect(errors).toEqual([]);
  });
}
