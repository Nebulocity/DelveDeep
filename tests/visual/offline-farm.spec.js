// Exercise the real snapshot and background service, including app termination while
// hidden. Earned rewards and partial-cycle time must survive without paying twice.
import { test, expect } from '@playwright/test';

test('hidden farm settlement survives reload and resumes one current fight', async ({ page }) => {
  test.setTimeout(180000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/?visualQa=1');
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('TitleScene').sys.isActive());
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  await page.evaluate(() => window.__DELVE_DEEP_VISUAL_QA__.activate('BattleScene', { delve: 'thornbriar-hollow' }));
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__.game.scene.getScene('BattleScene').partyUnits?.length === 5);
  await page.locator('#loading-screen').waitFor({ state: 'hidden' });
  const saved = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__, scene = qa.game.scene.getScene('BattleScene');
    const progress = qa.game.backgroundProgress;
    progress.setHidden(true);
    clearInterval(progress.timer);
    const { resumeIdleBattle } = await import('/combat/IdleBattle.js');
    resumeIdleBattle(scene);
    scene.idleSummary = null;
    qa.state.delveCheckpoints[qa.state.currentDelve.id] = { nextWave: scene.bossWaveIndex, campUnlocked: true };
    qa.state.run.entry = 'farm';
    scene.startWave(scene.bossWaveIndex - 1);
    scene.farmTiming = { samples: [40000], startedAt: scene.time.now };
    scene.partyUnits.forEach(unit => { unit.hp = 1; unit.mana = 0; });
    const wall = Date.now();
    progress.now = () => wall;
    progress.lastWallTime = wall - 125000;
    progress.pendingMs = 0;
    progress.pump();
    scene.input.emit('pointerup');
    await Promise.resolve();
    const profile = JSON.parse(localStorage.getItem('delveDeep.profile.v2'));
    return { gold: profile.gold, materials: profile.inventory.materials,
      summary: profile.activeBattle.scene.idleSummary, farm: profile.activeBattle.scene.offlineFarm };
  });
  expect(saved.farm.active).toBe(true);
  expect(saved.farm.carryMs).toBe(5000);
  expect(saved.summary.waves).toBe(3);
  await page.reload();
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('BattleScene').idleSummaryOpen);
  const restored = await page.evaluate(async () => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__, scene = qa.game.scene.getScene('BattleScene');
    scene.input.emit('pointerup');
    await Promise.resolve();
    return { gold: qa.state.gold, materials: qa.state.inventory.materials, summary: scene.idleSummary,
      farm: scene.offlineFarm, enemies: scene.enemies.map(unit => ({ id: unit.id, hp: unit.hp })),
      party: scene.partyUnits.map(unit => ({ id: unit.id, hp: unit.hp, mana: unit.mana })),
      events: scene.battleEvents.size };
  });
  expect(restored.gold).toBe(saved.gold);
  expect(restored.materials).toEqual(saved.materials);
  expect(restored.summary.waves).toBe(3);
  expect(restored.farm).toBeNull();
  expect(restored.events).toBe(0);
  expect(restored.enemies.length).toBeGreaterThan(0);

  // A second reload while reading the report preserves the staged fight byte for byte.
  await page.reload();
  await page.waitForFunction(() => window.__DELVE_DEEP_VISUAL_QA__?.game.scene.getScene('BattleScene').idleSummaryOpen);
  const again = await page.evaluate(() => {
    const qa = window.__DELVE_DEEP_VISUAL_QA__, scene = qa.game.scene.getScene('BattleScene');
    return { gold: qa.state.gold, enemies: scene.enemies.map(unit => ({ id: unit.id, hp: unit.hp })),
      party: scene.partyUnits.map(unit => ({ id: unit.id, hp: unit.hp, mana: unit.mana })) };
  });
  expect(again).toEqual({ gold: restored.gold, enemies: restored.enemies, party: restored.party });
  expect(errors).toEqual([]);
});
