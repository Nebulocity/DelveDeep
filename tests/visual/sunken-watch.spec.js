// Review the supplied monsters on Sunken Watch's actual inherited battlefield. The QA
// bridge keeps these scene changes inside the test browser's local profile.
import { test, expect } from '@playwright/test';
import fs from 'node:fs/promises';

for (const width of [915, 1920]) {
  test(`Sunken Watch sprites and final wave at ${width}`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width, height: width === 915 ? 412 : 1080 });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });

    // Use the persistent map ID here to cover the same lookup that a saved battle uses.
    await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve: 'verge-delves' }));
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').enemies?.length > 0);
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    const result = await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      scene.combatPaused = true;
      scene.waveTransitioning = false;
      scene.waveRetreating = false;
      scene.clearWaveAnnouncement();

      // Pending ally casts can still hold an old target reference. Mark review targets
      // dead before destroying them, matching ordinary combat cleanup's alive guard.
      for (const enemy of scene.enemies) {
        enemy.alive = false;
        enemy.container.destroy();
      }
      const types = ['sunkenWatcher', 'deepTongue', 'drownedKnell', 'earthsinker'];
      const points = [[350, 650], [620, 650], [860, 650], [1050, 825]];

      // These are arena units. Terrain projection places the feet on the authored floor.
      scene.enemies = types.map((type, index) => scene.createEnemy(type,
        { x: points[index][0], y: points[index][1] }, index));
      return scene.enemies.map(enemy => {
        const visual = enemy.spriteVisual;
        if (!visual) return { type: enemy.enemyType, missing: true };
        const initial = visual.currentFrame();
        scene.combatPaused = false;

        // SpriteMotion caps one frame's idle advance at 100 ms. Two ordinary frame
        // steps cross the 150 ms idle-cell boundary without simulating a long stall.
        visual.update(100);
        visual.update(100);
        const advanced = visual.currentFrame();
        scene.combatPaused = true;
        visual.update(1000);
        const paused = visual.currentFrame();
        visual.motion.direction = 'south-east';
        visual.reset();
        enemy.syncPresentation();
        return { type: enemy.enemyType, missing: false,
          moved: initial.frame !== advanced.frame, paused: paused.frame === advanced.frame,
          states: Object.keys(visual.definition.clips) };
      });
    });
    for (const unit of result) {
      expect(unit.missing).toBe(false);
      expect(unit.moved).toBe(true);
      expect(unit.paused).toBe(true);
      for (const state of ['idle', 'walk', 'attack', 'cast', 'block', 'hit', 'death']) expect(unit.states).toContain(state);
    }
    await fs.mkdir('output/qa/sunken-watch/battle', { recursive: true });
    await page.evaluate(() => new Promise(resolve => window.__DELVE_DEEP_VISUAL_QA__.game.events.once('postrender', resolve)));
    await page.screenshot({ path: `output/qa/sunken-watch/battle/roster-${width}.png` });

    // Draw every action and authored facing through UnitSprite's actual frame lookup.
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
    expect(checked).toBe(128);

    // Confirm the real finale creates the rock boss and gives every spawn a sprite.
    await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      for (const enemy of scene.enemies) {
        enemy.alive = false;
        enemy.container.destroy();
      }
      scene.combatPaused = true;
      scene.waveRetreating = false;
      scene.currentWaveIndex = 5;
      scene.updateEncounterStatus();
      scene.spawnWave(5);

      // Settle the static review's landing tween while combat stays paused. Separate
      // maintained landing tests cover timing; this screenshot needs stable floor poses.
      for (const enemy of scene.enemies) {
        scene.tweens.killTweensOf(enemy.spriteVisual.image);
        enemy.spriteVisual.image.y = enemy.landingFloorY;
        scene.finishEnemyLanding(enemy);
        enemy.spriteVisual.reset();
        enemy.syncPresentation();
      }
    });
    await page.waitForFunction(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      return scene.enemies?.some(enemy => enemy.isBoss) && scene.enemies.every(enemy => !enemy.landing);
    });
    const finale = await page.evaluate(() => {
      const scene = window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene');
      scene.combatPaused = true;
      return scene.enemies.map(enemy => ({ type: enemy.enemyType, sprite: !!enemy.spriteVisual, boss: enemy.isBoss }));
    });
    expect(finale.some(enemy => enemy.type === 'earthsinker' && enemy.boss && enemy.sprite)).toBe(true);
    expect(finale.every(enemy => enemy.sprite)).toBe(true);
    await page.evaluate(() => new Promise(resolve => window.__DELVE_DEEP_VISUAL_QA__.game.events.once('postrender', resolve)));
    await page.screenshot({ path: `output/qa/sunken-watch/battle/finale-${width}.png` });

    // Reload the desktop review to prove the retained map ID survives an actual battle
    // snapshot. The test browser's storage is isolated from the player's normal profile.
    if (width === 1920) {
      await page.evaluate(async () => {
        const { saveProfile } = await import('/game/GameStorage.js');
        saveProfile();
      });
      await page.reload();
      await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('BattleScene').enemies?.length > 0);
      const restored = await page.evaluate(() => {
        const qa = window.__DELVE_DEEP_VISUAL_QA__;
        const scene = qa.game.scene.getScene('BattleScene');
        scene.combatPaused = true;
        return { id: qa.state.currentDelve.id, types: scene.enemies.map(enemy => enemy.enemyType),
          sprites: scene.enemies.every(enemy => !!enemy.spriteVisual) };
      });
      expect(restored.id).toBe('verge-delves');
      expect(restored.types).toContain('earthsinker');
      expect(restored.sprites).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}
