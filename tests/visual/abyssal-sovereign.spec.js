// Review boss warnings and command hints in the actual arena at phone and desktop sizes.
import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

for (const width of [915, 1920]) {
  test(`Sovereign response prompts and Interrupt at ${width}`, async ({ page }) => {
    await page.setViewportSize({ width, height: width === 915 ? 412 : 1080 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve: 'murmuring-abyss' }));
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').enemies?.length > 0);
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await fs.mkdir('output/qa/abyssal-sovereign', { recursive: true });

    // Replace only this review's wave, then freeze combat so each warning can be inspected.
    await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      scene.combatPaused = true;
      for (const event of scene.battleEvents ?? []) event.timer?.remove(false);
      scene.battleEvents.clear();
      for (const unit of [...scene.partyUnits, ...scene.enemies]) unit.finishAction();
      for (const enemy of scene.enemies) {
        enemy.alive = false;
        scene.tweens.killTweensOf(enemy.container);
        scene.tweens.killTweensOf(enemy.spriteVisual?.image ?? enemy.body);
        enemy.container.destroy();
      }
      scene.clearWaveAnnouncement();
      scene.waveTransitioning = false;
      scene.currentWaveIndex = scene.waves.length - 1;
      scene.spawnWave(scene.currentWaveIndex);
      for (const enemy of scene.enemies) {
        scene.tweens.killTweensOf(enemy.spriteVisual?.image ?? enemy.body);
        scene.finishEnemyLanding(enemy);
      }
    });

    for (const key of ['primary', 'secondary', 'tertiary']) {
      const result = await page.evaluate(key => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
        const boss = scene.enemies.find(enemy => enemy.enemyType === 'abyssalSovereign');
        const target = scene.partyUnits.find(unit => unit.alive);
        boss.finishAction();
        if (key === 'secondary') scene.beginEnemyAbility(boss, target, key, scene.time.now);
        else scene.beginGroundSlam(boss, target, scene.time.now, boss.abilities[key], key);
        return { prompt: scene.battleMessageText.text, cast: boss.pendingAction.name,
          warnings: scene.activeTelegraphs.map(warning => ({ autoAvoid: warning.autoAvoid, radius: warning.radius })) };
      }, key);
      expect(result.prompt).toContain('INTERRUPT');
      expect(result.cast).toBeTruthy();
      if (key !== 'secondary') expect(result.warnings[0].autoAvoid).toBe(false);
      await page.screenshot({ path: `output/qa/abyssal-sovereign/${key}-${width}.png` });

      // Exercise the actual command handler and confirm the canceled floor warning vanishes.
      const canceled = await page.evaluate(() => {
        const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
        const boss = scene.enemies.find(enemy => enemy.enemyType === 'abyssalSovereign');
        scene.commandMode = 'INTERRUPT';
        scene.handleEnemyTap(boss);
        return { pending: boss.pendingAction, warnings: scene.activeTelegraphs.length };
      });
      expect(canceled).toEqual({ pending: null, warnings: 0 });
    }
    expect(errors).toEqual([]);
  });
}
