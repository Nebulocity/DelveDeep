// Check the player-facing preparation text and the actual delayed boss response.
// This uses the real scene, warning registration and scheduled damage callback.
import { test, expect } from '@playwright/test';
import { simulateRegionalDelve } from './regionalDelveSimulation.js';

const profiles = [
  { delve: 'old-quarry', bossType: 'depthsSovereign', level: 20 },
  { delve: 'sunken-watch', bossType: 'earthsinker', level: 25 },
  { delve: 'murmuring-abyss', bossType: 'abyssalSovereign', level: 30, prepared: true }
];

for (const profile of profiles) {
  test(`${profile.delve} advice and boss response work at phone size`, async ({ page }) => {
    test.setTimeout(120000);
    await page.setViewportSize({ width: 915, height: 412 });
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.evaluate(delve => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve }), profile.delve);
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
    expect(advice).toContain(`Level ${profile.level}`);
    expect(advice).toContain(profile.prepared ? 'best available' : 'Uncommon gear');
    expect(advice).toContain('all 4 ability slots');
    expect(advice).toContain('earned skill points');
    await page.screenshot({ path: `output/qa/regional-simulation/${profile.delve}-preparation-915.png` });

    const response = await page.evaluate(async profile => {
      const qa = window.__DELVE_DEEP_VISUAL_QA__;
      const scene = qa.game.scene.getScene('BattleScene');
      scene.selectionDetailsClose();
      clearInterval(qa.game.backgroundProgress.timer);
      qa.game.loop.stop();
      scene.combatPaused = false;
      scene.time.removeAllEvents();
      scene.battleEvents.clear();
      scene.currentWaveIndex = scene.bossWaveIndex;
      const boss = scene.createEnemy(profile.bossType, { x: 700, y: 480 }, 0);
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
      scene.time.preUpdate(pauseStart + 7000, 7000);
      scene.time.update(pauseStart + 7000, 7000);
      const paused = scene.time.now === pauseStart && scene.activeTelegraphs.length === 1;
      scene.time.paused = false;
      scene.commandMode = 'INTERRUPT';
      scene.handleEnemyTap(boss);
      const canceled = !boss.pendingAction && scene.activeTelegraphs.length === 0;

      // Advance timers past the original impact. A canceled action cannot hit later.
      scene.time.preUpdate(scene.time.now + 7000, 7000);
      scene.time.update(scene.time.now + 7000, 7000);
      return { registered, castCenter, fixedCenter, paused, canceled, noDelayedDamage: target.hp === hpBefore };
    }, profile);
    expect(response.registered).toEqual({ radius: 500, autoAvoid: false, ...response.castCenter, windup: 6000 });
    expect(response.fixedCenter).toBe(true);
    expect(response.paused).toBe(true);
    expect(response.canceled).toBe(true);
    expect(response.noDelayedDamage).toBe(true);
  });

  test(`${profile.delve} seeds reproduce across repeated scene visits`, async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/?visualQa=1');
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
    await page.locator('#loading-screen').waitFor({ state: 'hidden' });
    await page.evaluate(delve => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve }), profile.delve);
    await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').partyUnits?.length === 5);
    const results = await simulateRegionalDelve(page, {
      delve: profile.delve, bossType: profile.bossType, parties: 2, partySeedStride: 104729, seeds: [11], farmMs: 0,
      candidates: [{ name: 'repeatability', tuning: {} }],
      scenarios: [
        { mode: 'boss', level: profile.level, prepared: profile.prepared, build: 'balanced' },
        { mode: 'boss', level: profile.level, prepared: profile.prepared, build: 'balanced' }
      ]
    });

    // Entire paired records must match, including gear, wave times and remaining HP.
    // This catches accidental dependence on wall time, a previous fixture or unseeded RNG.
    for (let index = 0; index < results.length; index += 2) expect(results[index]).toEqual(results[index + 1]);
  });
  

}
