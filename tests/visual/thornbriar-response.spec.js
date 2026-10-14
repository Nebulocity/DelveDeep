// Check the player-facing preparation text and the actual delayed boss response.
// This uses the real scene, warning registration and scheduled damage callback.
import { test, expect } from '@playwright/test';
import { simulateThornbriar } from './thornbriarSimulation.js';

test('Thornbriar advice and Belch response work at phone size', async ({ page }) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 915, height: 412 });
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve: 'thornbriar-hollow' }));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').partyUnits?.length === 5);
  const advice = await page.evaluate(async () => {
    const { delveDetails, showSelectionDetails } = await import('/ui/SelectionDetails.js');
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    scene.combatPaused = true;
    const details = delveDetails(qa.state.currentDelve);
    showSelectionDetails(scene, details);
    return details.description;
  });
  expect(advice).toContain('Level 10');
  expect(advice).toContain('Uncommon gear');
  expect(advice).toContain('best Common gear');
  expect(advice).toContain('all 4 ability slots');
  expect(advice).toContain('earned skill points');
  await page.screenshot({ path: 'output/qa/thornbriar-simulation/preparation-915.png' });

  const response = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__;
    const scene = qa.game.scene.getScene('BattleScene');
    scene.selectionDetailsClose();
    clearInterval(qa.game.backgroundProgress.timer);
    qa.game.loop.stop();
    scene.combatPaused = false;
    scene.time.removeAllEvents();
    scene.battleEvents.clear();
    scene.currentWaveIndex = scene.bossWaveIndex;
    const boss = scene.createEnemy('rongarTheCrusher', { x: 700, y: 480 }, 0);
    scene.enemies = [boss];
    const target = scene.partyUnits[0];
    target.arenaX = 700;
    target.arenaY = 480;
    target.hp = target.maxHp;
    const hpBefore = target.hp;
    scene.beginGroundSlam(boss, target, scene.time.now, boss.abilities.tertiary, 'tertiary');
    const warning = scene.activeTelegraphs[0];
    const registered = { radius: warning.radius, autoAvoid: warning.autoAvoid,
      x: warning.arenaX, y: warning.arenaY, windup: boss.pendingAction.duration };
    const castCenter = { x: boss.arenaX, y: boss.arenaY };
    boss.arenaX += 50;
    const fixedCenter = warning.arenaX === castCenter.x && warning.arenaY === castCenter.y;

    // Pause keeps both the delayed hit and the displayed warning on the combat clock.
    scene.time.paused = true;
    const pauseStart = scene.time.now;
    scene.time.preUpdate(pauseStart + 5000, 5000);
    scene.time.update(pauseStart + 5000, 5000);
    const paused = scene.time.now === pauseStart && scene.activeTelegraphs.length === 1;
    scene.time.paused = false;
    scene.commandMode = 'INTERRUPT';
    scene.handleEnemyTap(boss);
    const canceled = !boss.pendingAction && scene.activeTelegraphs.length === 0;

    // Advance timers past the original impact. A canceled action cannot hit later.
    scene.time.preUpdate(scene.time.now + 5000, 5000);
    scene.time.update(scene.time.now + 5000, 5000);
    return { registered, castCenter, fixedCenter, paused, canceled, noDelayedDamage: target.hp === hpBefore };
  });
  expect(response.registered).toEqual({ radius: 400, autoAvoid: false, ...response.castCenter, windup: 4500 });
  expect(response.fixedCenter).toBe(true);
  expect(response.paused).toBe(true);
  expect(response.canceled).toBe(true);
  expect(response.noDelayedDamage).toBe(true);
});

test('Thornbriar seeds reproduce across repeated scene visits', async ({ page }) => {
  test.setTimeout(120000);
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve: 'thornbriar-hollow' }));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').partyUnits?.length === 5);
  const results = await simulateThornbriar(page, {
    parties: 2, partySeedStride: 104729, seeds: [11, 22], farmMs: 0,
    candidates: [{ name: 'repeatability', tuning: {} }],
    scenarios: [
      { mode: 'boss', level: 10, build: 'balanced' },
      { mode: 'boss', level: 10, build: 'balanced' }
    ]
  });

  // Entire paired records must match, including gear, wave times and remaining HP.
  // This catches accidental dependence on wall time, a previous fixture or unseeded RNG.
  for (let index = 0; index < results.length; index += 2) expect(results[index]).toEqual(results[index + 1]);
});
